import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

import { httpError } from '../utils/httpError.js';
import { formatInvoiceId } from '../constants.js';

const ALLOWED_FORMATS = ['pdf', 'jpg'];
const DISPATCH_SLIP_DIR = 'dispatch-slips';
const PHP_DISPATCH_BRIDGE_PATH = path.resolve(globalThis.process.cwd(), 'api', 'dispatch_pdf_cli.php');

const TEMPLATE_PDF_PATH = path.resolve(globalThis.process.cwd(), 'api', 'public', 'letter head.pdf');
const TEMPLATE_JPG_PATH = path.resolve(globalThis.process.cwd(), 'public', 'Screenshot 2026-04-19 173145.png');
const MM_TO_PT = 72 / 25.4;

const STANDARD_ROWS = [
  ['DATE / INVOICE ID', 'dateInvoiceId'],
  ['CONSIGNEE', 'consignee'],
  ['ADDRESS', 'address'],
  ['VEHICLE NO. / TYPE', 'vehicleAndType'],
  ['DRIVER NAME', 'driverName'],
  ['MOBILE NUMBER', 'mobileNumber'],
  ['TRANSPORTER NAME', 'transporterName'],
  ['SIZE', 'size'],
  ['PIECES LOADED', 'piecesLoaded'],
  ['CBM', 'cbm'],
  ['LOAD START TIME', 'loadStartTime'],
  ['LOAD FINISH TIME', 'loadFinishTime'],
  ['LOADING', 'loading'],
];

const BLACK = rgb(0.08, 0.08, 0.08);

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const toUpperDisplay = (value) => {
  const text = String(value ?? '').trim();
  return text ? text.toUpperCase() : '-';
};

const formatDate = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = String(now.getFullYear());
    return `${dd} / ${mm} / ${yyyy}`;
  }

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]} / ${dateOnlyMatch[2]} / ${dateOnlyMatch[1]}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = String(parsed.getFullYear());
  return `${dd} / ${mm} / ${yyyy}`;
};

const formatNumber = (value, decimals = 0, trimTrailing = false) => {
  if (!hasValue(value)) return '-';

  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);

  const fixed = n.toFixed(decimals);
  if (!trimTrailing || decimals === 0) return fixed;
  return fixed.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
};

const formatSize = (size) => {
  const raw = String(size || '').trim();
  if (!raw) return '-';

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  const formatted = parts.map(part => {
    const normalized = part.replace(/[xX]/gu, ' X ').replace(/\s+/gu, ' ').trim();
    if (!/MM$/iu.test(normalized)) {
      return `${normalized.toUpperCase()} MM`;
    }
    return normalized.toUpperCase();
  });

  return formatted.length > 0 ? formatted.join(', ') : '-';
};

const formatTruckType = (value) => {
  const digits = String(value ?? '').replace(/\D/gu, '');
  return digits ? `${digits} W` : '';
};

const formatDispatchVolume = (cbm, bjm) => {
  const cbmText = hasValue(cbm) ? formatNumber(cbm, 3, true) : '-';
  const bjmText = hasValue(bjm) ? `${formatNumber(bjm, 3, true)} BJM` : '';

  if (!hasValue(cbm) || cbmText === '-') {
    return bjmText || '-';
  }

  return bjmText ? `${cbmText}, ${bjmText}` : cbmText;
};

const getSizeVolume = (size) => {
  const parts = String(size || '')
    .toLowerCase()
    .match(/\d+(?:\.\d+)?/gu)
    ?.slice(0, 3)
    .map((item) => Number(item));

  if (!parts || parts.length !== 3 || parts.some((item) => !Number.isFinite(item) || item <= 0)) return null;

  const [lengthMm, widthMm, heightMm] = parts;
  return (lengthMm / 1000) * (widthMm / 1000) * (heightMm / 1000);
};

const derivePiecesLoaded = (cbm, size) => {
  const cbmValue = parseFloat(cbm);
  const volume = getSizeVolume(size);
  if (!Number.isFinite(cbmValue) || cbmValue <= 0 || !Number.isFinite(volume) || volume <= 0) return 0;
  return Math.max(0, Math.round(cbmValue / volume));
};

const buildSlipValues = (order) => {
  let sizesList = [];
  let cbmsList = [];
  let piecesList = [];

  const isDispatched = order.status === 'Dispatched' || hasValue(order.dispatchSlip);

  if (isDispatched) {
    const rawSizes = String(order.size || '').split(',').map(s => s.trim()).filter(Boolean);
    const additional = Array.isArray(order.additionalProducts) ? order.additionalProducts : [];
    
    const totalCbm = parseFloat(order.cbm) || 0;
    const totalPieces = parseInt(order.piecesLoaded, 10) || 0;
    
    let additionalCbmSum = 0;
    let additionalPiecesSum = 0;
    
    const additionalItems = additional.map((p) => {
      const pCbm = parseFloat(p.cbm) || 0;
      const pSize = p.size || '';
      const pPieces = derivePiecesLoaded(pCbm, pSize);
      
      additionalCbmSum += pCbm;
      additionalPiecesSum += pPieces;
      
      return { cbm: pCbm, pieces: pPieces };
    });
    
    const primaryCbm = Math.max(0, totalCbm - additionalCbmSum);
    const primaryPieces = Math.max(0, totalPieces - additionalPiecesSum);
    
    rawSizes.forEach((sz, idx) => {
      sizesList.push(sz);
      if (idx === 0) {
        cbmsList.push(primaryCbm);
        piecesList.push(primaryPieces);
      } else {
        const addIndex = idx - 1;
        const addCbm = additionalItems[addIndex] ? additionalItems[addIndex].cbm : 0;
        const addPieces = additionalItems[addIndex] ? additionalItems[addIndex].pieces : 0;
        cbmsList.push(addCbm);
        piecesList.push(addPieces);
      }
    });
  } else {
    if (order.size) {
      sizesList.push(order.size);
      cbmsList.push(parseFloat(order.cbm) || 0);
      piecesList.push(parseInt(order.piecesLoaded, 10) || derivePiecesLoaded(order.cbm, order.size));
    }

    if (Array.isArray(order.sizes)) {
      order.sizes.forEach((s) => {
        if (s && typeof s === 'object') {
          if (s.size) {
            sizesList.push(s.size);
            cbmsList.push(parseFloat(s.cbm) || 0);
            piecesList.push(derivePiecesLoaded(s.cbm, s.size));
          }
        } else if (s) {
          sizesList.push(s);
          cbmsList.push(0);
          piecesList.push(0);
        }
      });
    }

    if (Array.isArray(order.additionalProducts)) {
      order.additionalProducts.forEach((p) => {
        if (p && p.size) {
          sizesList.push(p.size);
          cbmsList.push(parseFloat(p.cbm) || 0);
          piecesList.push(derivePiecesLoaded(p.cbm, p.size));
        }
      });
    }
  }

  const formattedSizes = formatSize(sizesList.join(', '));
  
  const formattedPieces = piecesList.length > 0 
    ? piecesList.map(p => `${formatNumber(p, 0)} PCS`).join(', ')
    : '-';
    
  const cbmValuesText = cbmsList.map(c => formatNumber(c, 3, true)).join(', ');
  const formattedCbm = formatDispatchVolume(cbmValuesText, order.bjm);

  return {
    dateInvoiceId: `${formatDate(order.orderDate)} / ${toUpperDisplay(formatInvoiceId(order.invoiceId || order.invoiceNumber, order.orderDate))}`,
    consignee: toUpperDisplay(order.consignee || order.client),
    address: toUpperDisplay(order.address || order.location),
    vehicleAndType: toUpperDisplay(`${order.vehicle || '-'}${formatTruckType(order.truckType || order.vehicleType) ? ` / ${formatTruckType(order.truckType || order.vehicleType)}` : ''}`),
    driverName: toUpperDisplay(order.driverName),
    mobileNumber: toUpperDisplay(order.driverContact),
    transporterName: toUpperDisplay(order.transporter),
    size: formattedSizes,
    piecesLoaded: formattedPieces,
    cbm: formattedCbm,
    loadStartTime: toUpperDisplay(order.loadStartTime),
    loadFinishTime: toUpperDisplay(order.loadFinishTime),
    loading: toUpperDisplay(order.loadingBy),
    grossWeight: formatNumber(order.grossWeight, 3),
    tareWeight: formatNumber(order.tareWeight, 3),
    netWeight: formatNumber(order.netWt, 3),
    contactPerson: toUpperDisplay(order.contactPerson),
  };
};

const resolveDispatchSlipLayout = (pageWidth, pageHeight) => {
  const tableLeft = pageWidth * 0.12;
  const tableWidth = pageWidth * 0.76;
  const tableTop = pageHeight * 0.185;
  const tableHeight = pageHeight * 0.55;
  const labelWidth = tableWidth * 0.29;
  const valueWidth = tableWidth - labelWidth;

  const unit = tableHeight / 16.2;
  const regularRowHeight = unit;
  const weightHeaderHeight = unit * 1.1;
  const weightValueHeight = unit * 1.1;
  const contactRowHeight = unit;

  const tableBottom = tableTop + tableHeight;

  return {
    tableLeft,
    tableTop,
    tableWidth,
    tableHeight,
    tableBottom,
    labelWidth,
    valueWidth,
    regularRowHeight,
    weightHeaderHeight,
    weightValueHeight,
    contactRowHeight,
    signatureLineY: tableBottom + (unit * 3.05),
    signatureTop: tableBottom + (unit * 3.55),
    signatureLeft: tableLeft,
    signatureWidth: tableWidth,
  };
};

const resolveDispatchSlipTemplatePath = () => {
  const candidates = [
    TEMPLATE_PDF_PATH,
    path.resolve(globalThis.process.cwd(), 'public', 'letter head.pdf'),
    path.resolve(globalThis.process.cwd(), 'letter head.pdf'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || TEMPLATE_PDF_PATH;
};

const mmToPt = (value) => value * MM_TO_PT;

const renderDispatchSlipPdfViaPhp = async (order) => {
  if (!fs.existsSync(PHP_DISPATCH_BRIDGE_PATH)) {
    return null;
  }

  const phpBinary = (globalThis.process && globalThis.process.env && globalThis.process.env.PHP_BINARY) || 'php';
  const result = spawnSync(phpBinary, [PHP_DISPATCH_BRIDGE_PATH], {
    input: JSON.stringify(order),
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8').trim() : '';
    throw new Error(stderr || `PHP dispatch bridge exited with status ${result.status}.`);
  }

  return globalThis.Buffer.from(result.stdout);
};

const fitTextPdf = (font, text, fontSize, maxWidth) => {
  const normalized = String(text || '').replace(/\s+/gu, ' ').trim();
  if (!normalized) return '-';

  if (font.widthOfTextAtSize(normalized, fontSize) <= maxWidth) return normalized;

  let truncated = normalized;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}...`, fontSize) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}...`;
};

const drawDispatchSlipBodyPdf = (page, fonts, values) => {
  const { regular, bold } = fonts;
  const pageHeight = page.getHeight();
  const tableLeft = 25.0;
  const tableTop = 55.0;
  const tableWidth = 160.0;
  const labelWidth = 46.0;
  const rowHeight = 10.0;
  const weightHeight = 20.0;
  const contactHeight = 10.0;
  const valueWidth = tableWidth - labelWidth;
  const tableRight = tableLeft + tableWidth;
  const dividerX = tableLeft + labelWidth;
  const valueThird = valueWidth / 3;
  const tableBottom = tableTop + (STANDARD_ROWS.length * rowHeight) + weightHeight + contactHeight;

  const drawLineMm = (x1, y1, x2, y2, thickness = 0.8) => {
    page.drawLine({
      start: { x: mmToPt(x1), y: pageHeight - mmToPt(y1) },
      end: { x: mmToPt(x2), y: pageHeight - mmToPt(y2) },
      thickness,
      color: BLACK,
    });
  };

  const drawCellMm = ({
    font,
    text,
    size,
    x,
    y,
    width,
    height,
    align = 'left',
    padding = 1.2,
    border = 1,
    xOffset = 0,
  }) => {
    const widthPt = mmToPt(width);
    const heightPt = mmToPt(height);
    const paddingPt = mmToPt(padding);
    const fitted = fitTextPdf(font, text, size, Math.max(widthPt - (paddingPt * 2), 10));
    const textWidth = font.widthOfTextAtSize(fitted, size);

    let drawX = mmToPt(x) + paddingPt;
    if (align === 'center') {
      drawX = mmToPt(x) + ((widthPt - textWidth) / 2);
    } else if (align === 'right') {
      drawX = mmToPt(x) + widthPt - paddingPt - textWidth;
    }
    drawX += mmToPt(xOffset);

    if (border > 0) {
      page.drawRectangle({
        x: mmToPt(x),
        y: pageHeight - mmToPt(y) - heightPt,
        width: widthPt,
        height: heightPt,
        borderWidth: 0.75,
        borderColor: BLACK,
      });
    }

    page.drawText(fitted, {
      x: drawX,
      y: pageHeight - mmToPt(y) - ((heightPt + size) / 2) + 2,
      size,
      font,
      color: BLACK,
    });
  };

  const drawTextMm = ({
    font,
    text,
    size,
    x,
    y,
    width,
    align = 'left',
    padding = 0,
  }) => {
    const widthPt = mmToPt(width);
    const paddingPt = mmToPt(padding);
    const fitted = fitTextPdf(font, text, size, Math.max(widthPt - (paddingPt * 2), 10));
    const textWidth = font.widthOfTextAtSize(fitted, size);

    let drawX = mmToPt(x) + paddingPt;
    if (align === 'center') {
      drawX = mmToPt(x) + ((widthPt - textWidth) / 2);
    } else if (align === 'right') {
      drawX = mmToPt(x) + widthPt - paddingPt - textWidth;
    }

    page.drawText(fitted, {
      x: drawX,
      y: pageHeight - mmToPt(y) - size,
      size,
      font,
      color: BLACK,
    });
  };

  drawLineMm(tableLeft, tableTop, tableRight, tableTop);
  drawLineMm(tableLeft, tableBottom, tableRight, tableBottom);
  drawLineMm(tableLeft, tableTop, tableLeft, tableBottom);
  drawLineMm(tableRight, tableTop, tableRight, tableBottom);
  drawLineMm(dividerX, tableTop, dividerX, tableBottom);

  let cursorY = tableTop;

  for (const [label, key] of STANDARD_ROWS) {
    const rowTop = cursorY;
    cursorY += rowHeight;

    drawLineMm(tableLeft, cursorY, tableRight, cursorY);
    drawCellMm({
      font: regular,
      text: label,
      size: 10,
      x: tableLeft,
      y: rowTop,
      width: labelWidth,
      height: rowHeight,
      align: key === 'dateInvoiceId' ? 'center' : 'left',
      padding: 7,
      border: 0,
    });
    drawCellMm({
      font: bold,
      text: values[key],
      size: 10.5,
      x: dividerX,
      y: rowTop,
      width: valueWidth,
      height: rowHeight,
      align: 'center',
      padding: 10,
      border: 0,
    });
  }

  const weightTop = cursorY;
  const weightBottom = weightTop + weightHeight;

  drawLineMm(dividerX + valueThird, weightTop, dividerX + valueThird, weightBottom);
  drawLineMm(dividerX + (valueThird * 2), weightTop, dividerX + (valueThird * 2), weightBottom);
  drawLineMm(dividerX, weightTop + 10.0, tableRight, weightTop + 10.0);

  cursorY = weightBottom;
  drawLineMm(tableLeft, cursorY, tableRight, cursorY);

  drawCellMm({
    font: regular,
    text: 'WEIGHTMENT DETAILS',
    size: 10,
    x: tableLeft,
    y: weightTop,
    width: labelWidth,
    height: weightHeight,
    align: 'left',
    padding: 7,
    border: 0,
  });

  const weightHeaders = ['Gross Wt.', 'Tare Wt.', 'Net Wt.'];
  const weightValues = [values.grossWeight, values.tareWeight, values.netWeight];

  for (let index = 0; index < weightHeaders.length; index += 1) {
    const colX = dividerX + (valueThird * index);

    drawCellMm({
      font: regular,
      text: weightHeaders[index],
      size: 10,
      x: colX,
      y: weightTop,
      width: valueThird,
      height: 10.0,
      align: 'center',
      padding: 4,
      border: 0,
    });

    drawCellMm({
      font: bold,
      text: weightValues[index],
      size: 10.5,
      x: colX,
      y: weightTop + 10.0,
      width: valueThird,
      height: 10.0,
      align: 'center',
      padding: 4,
      border: 0,
    });
  }

  const contactTop = cursorY;
  cursorY += contactHeight;
  drawLineMm(tableLeft, cursorY, tableRight, cursorY);

  drawCellMm({
    font: regular,
    text: 'CONTACT PERSON',
    size: 10,
    x: tableLeft,
    y: contactTop,
    width: labelWidth,
    height: contactHeight,
    align: 'left',
    padding: 7,
    border: 0,
  });
  drawCellMm({
    font: bold,
    text: values.contactPerson,
    size: 10.5,
    x: dividerX,
    y: contactTop,
    width: valueWidth,
    height: contactHeight,
    align: 'center',
    padding: 10,
    border: 0,
  });

  drawLineMm(25.0, 235.0, 60.0, 235.0);
  drawLineMm(85.0, 235.0, 125.0, 235.0);
  drawLineMm(150.0, 235.0, 190.0, 235.0);

  drawTextMm({
    font: regular,
    text: 'DRIVER SIGNATURE',
    size: 10,
    x: 25.0,
    y: 237.0,
    width: 35.0,
    align: 'center',
    padding: 0,
  });
  drawTextMm({
    font: regular,
    text: 'LOADING SUPERVISOR',
    size: 10,
    x: 85.0,
    y: 237.0,
    width: 40.0,
    align: 'center',
    padding: 0,
  });
  drawTextMm({
    font: regular,
    text: 'FOR ABC ASHPRO',
    size: 10,
    x: 150.0,
    y: 237.0,
    width: 40.0,
    align: 'center',
    padding: 0,
  });
};

const xmlEscape = (value) => String(value ?? '')
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;')
  .replace(/'/gu, '&apos;');

const truncateSvgText = (text, width, fontSize) => {
  const raw = String(text || '').replace(/\s+/gu, ' ').trim();
  if (!raw) return '-';

  const averageCharWidth = fontSize * 0.56;
  const maxChars = Math.max(1, Math.floor(width / averageCharWidth));
  if (raw.length <= maxChars) return raw;

  if (maxChars <= 3) return raw.slice(0, maxChars);
  return `${raw.slice(0, maxChars - 3)}...`;
};

const buildDispatchSlipOverlaySvg = (width, height, values) => {
  const layout = resolveDispatchSlipLayout(width, height);
  const tableRight = layout.tableLeft + layout.tableWidth;
  const dividerX = layout.tableLeft + layout.labelWidth;
  const lineColor = '#161616';

  const lines = [];
  const texts = [];

  const drawLine = (x1, y1, x2, y2, strokeWidth = 1.05) => {
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lineColor}" stroke-width="${strokeWidth}" />`);
  };

  const drawText = ({ text, x, y, width: cellWidth, height: cellHeight, align = 'start', size = 10, weight = 400, padding = 7, xOffset = 0 }) => {
    const usableWidth = Math.max(cellWidth - (padding * 2), 12);
    const clipped = truncateSvgText(text, usableWidth, size);
    const anchor = align === 'center' ? 'middle' : align === 'end' ? 'end' : 'start';

    let tx = x + padding;
    if (align === 'center') {
      tx = x + (cellWidth / 2);
    } else if (align === 'end') {
      tx = x + cellWidth - padding;
    }
    tx += xOffset;

    const ty = y + (cellHeight / 2) + 0.5;
    texts.push(`<text x="${tx}" y="${ty}" fill="${lineColor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" dominant-baseline="middle" text-anchor="${anchor}">${xmlEscape(clipped)}</text>`);
  };

  const getAlignedTextBoundsSvg = ({ text, x, width: cellWidth, align = 'start', size = 10, padding = 0 }) => {
    const usableWidth = Math.max(cellWidth - (padding * 2), 12);
    const clipped = truncateSvgText(text, usableWidth, size);
    const textWidth = Math.max(1, clipped.length * size * 0.56);

    let startX = x + padding;
    if (align === 'center') {
      startX = x + ((cellWidth - textWidth) / 2);
    } else if (align === 'end') {
      startX = x + cellWidth - padding - textWidth;
    }

    return { startX, endX: startX + textWidth };
  };

  drawLine(layout.tableLeft, layout.tableTop, tableRight, layout.tableTop);
  drawLine(layout.tableLeft, layout.tableBottom, tableRight, layout.tableBottom);
  drawLine(layout.tableLeft, layout.tableTop, layout.tableLeft, layout.tableBottom);
  drawLine(tableRight, layout.tableTop, tableRight, layout.tableBottom);
  drawLine(dividerX, layout.tableTop, dividerX, layout.tableBottom);

  let cursorY = layout.tableTop;

  for (const [label, key] of STANDARD_ROWS) {
    const rowTop = cursorY;
    cursorY += layout.regularRowHeight;
    drawLine(layout.tableLeft, cursorY, tableRight, cursorY);

    drawText({
      text: label,
      x: layout.tableLeft,
      y: rowTop,
      width: layout.labelWidth,
      height: layout.regularRowHeight,
      align: key === 'dateInvoiceId' ? 'center' : 'start',
      size: 10,
      weight: 500,
      padding: 7,
    });

    drawText({
      text: values[key],
      x: dividerX,
      y: rowTop,
      width: layout.valueWidth,
      height: layout.regularRowHeight,
      align: 'center',
      size: 10.5,
      weight: 600,
      padding: 10,
      xOffset: 0,
    });
  }

  const weightTop = cursorY;
  const weightBottom = weightTop + layout.weightHeaderHeight + layout.weightValueHeight;
  const valueThird = layout.valueWidth / 3;

  drawLine(dividerX + valueThird, weightTop, dividerX + valueThird, weightBottom);
  drawLine(dividerX + (valueThird * 2), weightTop, dividerX + (valueThird * 2), weightBottom);
  drawLine(dividerX, weightTop + layout.weightHeaderHeight, tableRight, weightTop + layout.weightHeaderHeight);

  cursorY = weightBottom;
  drawLine(layout.tableLeft, cursorY, tableRight, cursorY);

  drawText({
    text: 'WEIGHTMENT DETAILS',
    x: layout.tableLeft,
    y: weightTop,
    width: layout.labelWidth,
    height: layout.weightHeaderHeight + layout.weightValueHeight,
    align: 'start',
    size: 10,
    weight: 500,
    padding: 7,
  });

  const weightHeaders = ['Gross Wt.', 'Tare Wt.', 'Net Wt.'];
  const weightNumbers = [values.grossWeight, values.tareWeight, values.netWeight];

  for (let index = 0; index < weightHeaders.length; index += 1) {
    const colX = dividerX + (valueThird * index);

    drawText({
      text: weightHeaders[index],
      x: colX,
      y: weightTop,
      width: valueThird,
      height: layout.weightHeaderHeight,
      align: 'center',
      size: 10,
      weight: 500,
      padding: 4,
    });

    drawText({
      text: weightNumbers[index],
      x: colX,
      y: weightTop + layout.weightHeaderHeight,
      width: valueThird,
      height: layout.weightValueHeight,
      align: 'center',
      size: 10.5,
      weight: 600,
      padding: 4,
    });
  }

  const contactTop = cursorY;
  cursorY += layout.contactRowHeight;
  drawLine(layout.tableLeft, cursorY, tableRight, cursorY);

  drawText({
    text: 'CONTACT PERSON',
    x: layout.tableLeft,
    y: contactTop,
    width: layout.labelWidth,
    height: layout.contactRowHeight,
    align: 'start',
    size: 10,
    weight: 500,
    padding: 7,
  });

  drawText({
    text: values.contactPerson,
    x: dividerX,
    y: contactTop,
    width: layout.valueWidth,
    height: layout.contactRowHeight,
    align: 'center',
    size: 10.5,
    weight: 600,
    padding: 10,
  });

  const signatureLabels = ['DRIVER SIGNATURE', 'LOADING SUPERVISOR', 'FOR ABC ASHPRO'];
  const signatureWidth = layout.signatureWidth / 3;

  for (let index = 0; index < signatureLabels.length; index += 1) {
    const segX = layout.signatureLeft + (signatureWidth * index);
    const align = index === 0 ? 'start' : index === 2 ? 'end' : 'center';
    const bounds = getAlignedTextBoundsSvg({
      text: signatureLabels[index],
      x: segX,
      width: signatureWidth,
      align,
      size: 10,
      padding: 0,
    });
    drawLine(bounds.startX, layout.signatureLineY, bounds.endX, layout.signatureLineY);
  }

  signatureLabels.forEach((label, index) => {
    drawText({
      text: label,
      x: layout.signatureLeft + (signatureWidth * index),
      y: layout.signatureTop,
      width: signatureWidth,
      height: layout.regularRowHeight,
      align: index === 0 ? 'start' : index === 2 ? 'end' : 'center',
      size: 10,
      weight: 500,
      padding: 0,
    });
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <g fill="none">${lines.join('')}</g>
      <g>${texts.join('')}</g>
    </svg>
  `;
};

const ensureTemplateExists = (templatePath, label) => {
  if (!fs.existsSync(templatePath)) {
    throw httpError(500, `${label} template is missing at ${templatePath}`);
  }
};

const renderDispatchSlipPdf = async (order) => {
  const phpBuffer = await renderDispatchSlipPdfViaPhp(order);
  if (phpBuffer) {
    return phpBuffer;
  }

  const templatePath = resolveDispatchSlipTemplatePath();
  ensureTemplateExists(templatePath, 'Dispatch slip PDF');

  const templateBytes = await fs.promises.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  drawDispatchSlipBodyPdf(page, { regular, bold }, buildSlipValues(order));

  const outputBytes = await pdfDoc.save();
  return globalThis.Buffer.from(outputBytes);
};

const renderDispatchSlipJpg = async (order) => {
  ensureTemplateExists(TEMPLATE_JPG_PATH, 'Dispatch slip JPG');

  const template = sharp(TEMPLATE_JPG_PATH);
  const metadata = await template.metadata();
  const width = metadata.width || 446;
  const height = metadata.height || 768;

  const overlaySvg = buildDispatchSlipOverlaySvg(width, height, buildSlipValues(order));

  return sharp(TEMPLATE_JPG_PATH)
    .composite([{ input: globalThis.Buffer.from(overlaySvg) }])
    .jpeg({ quality: 94 })
    .toBuffer();
};

export const resolveDispatchSlipFormat = (rawFormat, fallback = 'pdf') => {
  const normalizedFallback = ALLOWED_FORMATS.includes(String(fallback || '').toLowerCase())
    ? String(fallback).toLowerCase()
    : 'pdf';

  const normalized = String(rawFormat || '').toLowerCase();
  return ALLOWED_FORMATS.includes(normalized) ? normalized : normalizedFallback;
};

export const generateDispatchSlip = async ({ order, format = 'pdf', uploadDir }) => {
  const orderId = String(order?.id || order?._id || '').trim();
  if (!orderId) {
    throw httpError(400, 'Cannot generate dispatch slip without order id.');
  }

  const normalizedFormat = resolveDispatchSlipFormat(format);
  const targetDir = path.join(uploadDir, DISPATCH_SLIP_DIR, orderId);
  await fs.promises.mkdir(targetDir, { recursive: true });

  const fileBuffer = normalizedFormat === 'jpg'
    ? await renderDispatchSlipJpg(order)
    : await renderDispatchSlipPdf(order);

  const filename = `${Date.now()}-dispatch-slip.${normalizedFormat}`;
  const filePath = path.join(targetDir, filename);

  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    filename,
    path: filePath,
    size: fileBuffer.length,
    format: normalizedFormat,
    mimeType: normalizedFormat === 'jpg' ? 'image/jpeg' : 'application/pdf',
  };
};
