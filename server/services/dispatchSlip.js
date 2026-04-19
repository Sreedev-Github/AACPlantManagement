import fs from 'fs';
import path from 'path';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';

import { httpError } from '../utils/httpError.js';

const ALLOWED_FORMATS = ['pdf', 'jpg'];
const DISPATCH_SLIP_DIR = 'dispatch-slips';

const TEMPLATE_PDF_PATH = path.resolve(process.cwd(), 'public', 'letter head.pdf');
const TEMPLATE_JPG_PATH = path.resolve(process.cwd(), 'public', 'Screenshot 2026-04-19 173145.png');

const STANDARD_ROWS = [
  ['DATE', 'date'],
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

  const normalized = raw.replace(/[xX]/gu, ' X ').replace(/\s+/gu, ' ').trim();
  return /MM$/iu.test(normalized) ? normalized.toUpperCase() : `${normalized.toUpperCase()} MM`;
};

const buildSlipValues = (order) => ({
  date: formatDate(order.orderDate),
  consignee: toUpperDisplay(order.consignee || order.client),
  address: toUpperDisplay(order.address || order.location),
  vehicleAndType: toUpperDisplay(`${order.vehicle || '-'}${hasValue(order.truckType) ? ` / ${order.truckType}W` : ''}`),
  driverName: toUpperDisplay(order.driverName),
  mobileNumber: toUpperDisplay(order.driverContact),
  transporterName: toUpperDisplay(order.transporter),
  size: formatSize(order.size),
  piecesLoaded: hasValue(order.piecesLoaded) ? `${formatNumber(order.piecesLoaded, 0)} PCS` : '-',
  cbm: hasValue(order.cbm) ? `${formatNumber(order.cbm, 3, true)} CBM` : '-',
  loadStartTime: toUpperDisplay(order.loadStartTime),
  loadFinishTime: toUpperDisplay(order.loadFinishTime),
  loading: toUpperDisplay(order.loadingBy),
  grossWeight: formatNumber(order.grossWeight, 3),
  tareWeight: formatNumber(order.tareWeight, 3),
  netWeight: formatNumber(order.netWt, 3),
  contactPerson: toUpperDisplay(order.contactPerson),
});

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
    signatureLineY: tableBottom + (unit * 1.6),
    signatureTop: tableBottom + (unit * 2.0),
    signatureLeft: tableLeft,
    signatureWidth: tableWidth,
  };
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

const drawTextInCellPdf = ({
  page,
  font,
  text,
  size,
  x,
  y,
  width,
  height,
  align = 'left',
  padding = 8,
}) => {
  const fitted = fitTextPdf(font, text, size, Math.max(width - (padding * 2), 10));
  const textWidth = font.widthOfTextAtSize(fitted, size);

  let drawX = x + padding;
  if (align === 'center') {
    drawX = x + ((width - textWidth) / 2);
  } else if (align === 'right') {
    drawX = x + width - padding - textWidth;
  }

  const drawY = page.getHeight() - y - ((height + size) / 2) + 2;
  page.drawText(fitted, {
    x: drawX,
    y: drawY,
    size,
    font,
    color: BLACK,
  });
};

const drawLinePdf = (page, x1, y1, x2, y2, thickness = 0.8) => {
  page.drawLine({
    start: { x: x1, y: page.getHeight() - y1 },
    end: { x: x2, y: page.getHeight() - y2 },
    thickness,
    color: BLACK,
  });
};

const drawDispatchSlipBodyPdf = (page, fonts, values) => {
  const { regular, bold } = fonts;
  const layout = resolveDispatchSlipLayout(page.getWidth(), page.getHeight());
  const tableRight = layout.tableLeft + layout.tableWidth;
  const dividerX = layout.tableLeft + layout.labelWidth;

  drawLinePdf(page, layout.tableLeft, layout.tableTop, tableRight, layout.tableTop);
  drawLinePdf(page, layout.tableLeft, layout.tableBottom, tableRight, layout.tableBottom);
  drawLinePdf(page, layout.tableLeft, layout.tableTop, layout.tableLeft, layout.tableBottom);
  drawLinePdf(page, tableRight, layout.tableTop, tableRight, layout.tableBottom);
  drawLinePdf(page, dividerX, layout.tableTop, dividerX, layout.tableBottom);

  let cursorY = layout.tableTop;

  for (const [label, key] of STANDARD_ROWS) {
    const rowTop = cursorY;
    const rowHeight = layout.regularRowHeight;
    cursorY += rowHeight;

    drawLinePdf(page, layout.tableLeft, cursorY, tableRight, cursorY);
    drawTextInCellPdf({
      page,
      font: regular,
      text: label,
      size: 10,
      x: layout.tableLeft,
      y: rowTop,
      width: layout.labelWidth,
      height: rowHeight,
      align: 'left',
      padding: 7,
    });
    drawTextInCellPdf({
      page,
      font: bold,
      text: values[key],
      size: 10.5,
      x: dividerX,
      y: rowTop,
      width: layout.valueWidth,
      height: rowHeight,
      align: 'center',
      padding: 10,
    });
  }

  const weightTop = cursorY;
  const weightBottom = weightTop + layout.weightHeaderHeight + layout.weightValueHeight;
  const valueThird = layout.valueWidth / 3;

  drawLinePdf(page, dividerX + valueThird, weightTop, dividerX + valueThird, weightBottom);
  drawLinePdf(page, dividerX + (valueThird * 2), weightTop, dividerX + (valueThird * 2), weightBottom);
  drawLinePdf(page, dividerX, weightTop + layout.weightHeaderHeight, tableRight, weightTop + layout.weightHeaderHeight);

  cursorY = weightBottom;
  drawLinePdf(page, layout.tableLeft, cursorY, tableRight, cursorY);

  drawTextInCellPdf({
    page,
    font: regular,
    text: 'WEIGHTMENT DETAILS',
    size: 10,
    x: layout.tableLeft,
    y: weightTop,
    width: layout.labelWidth,
    height: layout.weightHeaderHeight + layout.weightValueHeight,
    align: 'left',
    padding: 7,
  });

  const weightHeaders = ['Gross Wt.', 'Tare Wt.', 'Net Wt.'];
  const weightValues = [values.grossWeight, values.tareWeight, values.netWeight];

  for (let index = 0; index < weightHeaders.length; index += 1) {
    const colX = dividerX + (valueThird * index);

    drawTextInCellPdf({
      page,
      font: regular,
      text: weightHeaders[index],
      size: 10,
      x: colX,
      y: weightTop,
      width: valueThird,
      height: layout.weightHeaderHeight,
      align: 'center',
      padding: 4,
    });

    drawTextInCellPdf({
      page,
      font: bold,
      text: weightValues[index],
      size: 10.5,
      x: colX,
      y: weightTop + layout.weightHeaderHeight,
      width: valueThird,
      height: layout.weightValueHeight,
      align: 'center',
      padding: 4,
    });
  }

  const contactTop = cursorY;
  cursorY += layout.contactRowHeight;
  drawLinePdf(page, layout.tableLeft, cursorY, tableRight, cursorY);

  drawTextInCellPdf({
    page,
    font: regular,
    text: 'CONTACT PERSON',
    size: 10,
    x: layout.tableLeft,
    y: contactTop,
    width: layout.labelWidth,
    height: layout.contactRowHeight,
    align: 'left',
    padding: 7,
  });
  drawTextInCellPdf({
    page,
    font: bold,
    text: values.contactPerson,
    size: 10.5,
    x: dividerX,
    y: contactTop,
    width: layout.valueWidth,
    height: layout.contactRowHeight,
    align: 'center',
    padding: 10,
  });

  const signatureLabels = ['DRIVER SIGNATURE', 'LOADING SUPERVISOR', 'FOR ABC ASHPRO'];
  const signatureWidth = layout.signatureWidth / 3;

  for (let index = 0; index < signatureLabels.length; index += 1) {
    const segX = layout.signatureLeft + (signatureWidth * index);
    drawLinePdf(page, segX, layout.signatureLineY, segX + signatureWidth, layout.signatureLineY);
  }

  signatureLabels.forEach((label, index) => {
    drawTextInCellPdf({
      page,
      font: regular,
      text: label,
      size: 10,
      x: layout.signatureLeft + (signatureWidth * index),
      y: layout.signatureTop,
      width: signatureWidth,
      height: layout.regularRowHeight,
      align: index === 0 ? 'left' : index === 2 ? 'right' : 'center',
      padding: 0,
    });
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

  const drawText = ({ text, x, y, width: cellWidth, height: cellHeight, align = 'start', size = 10, weight = 400, padding = 7 }) => {
    const usableWidth = Math.max(cellWidth - (padding * 2), 12);
    const clipped = truncateSvgText(text, usableWidth, size);
    const anchor = align === 'center' ? 'middle' : align === 'end' ? 'end' : 'start';

    let tx = x + padding;
    if (align === 'center') {
      tx = x + (cellWidth / 2);
    } else if (align === 'end') {
      tx = x + cellWidth - padding;
    }

    const ty = y + (cellHeight / 2) + 0.5;
    texts.push(`<text x="${tx}" y="${ty}" fill="${lineColor}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" dominant-baseline="middle" text-anchor="${anchor}">${xmlEscape(clipped)}</text>`);
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
      align: 'start',
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
    drawLine(segX, layout.signatureLineY, segX + signatureWidth, layout.signatureLineY);
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
  ensureTemplateExists(TEMPLATE_PDF_PATH, 'Dispatch slip PDF');

  const templateBytes = await fs.promises.readFile(TEMPLATE_PDF_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  drawDispatchSlipBodyPdf(page, { regular, bold }, buildSlipValues(order));

  const outputBytes = await pdfDoc.save();
  return Buffer.from(outputBytes);
};

const renderDispatchSlipJpg = async (order) => {
  ensureTemplateExists(TEMPLATE_JPG_PATH, 'Dispatch slip JPG');

  const template = sharp(TEMPLATE_JPG_PATH);
  const metadata = await template.metadata();
  const width = metadata.width || 446;
  const height = metadata.height || 768;

  const overlaySvg = buildDispatchSlipOverlaySvg(width, height, buildSlipValues(order));

  return sharp(TEMPLATE_JPG_PATH)
    .composite([{ input: Buffer.from(overlaySvg) }])
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
