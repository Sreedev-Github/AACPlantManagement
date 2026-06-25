import PDFDocument from 'pdfkit';
import { Router } from 'express';

import { ROLES, STATE_DOC_ID } from '../constants.js';
import { collections } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { httpError } from '../utils/httpError.js';

const router = Router();

const RAW_MATERIALS = [
  { desc: 'FLYASH', unit: 'Ton' },
  { desc: 'CEMENT', unit: 'Ton' },
  { desc: 'LIME POWDER', unit: 'Ton' },
  { desc: 'GYPSUM (POP)', unit: 'Ton' },
  { desc: 'RICE HUSK', unit: 'Ton' },
  { desc: 'ALUM. POWDER', unit: 'KG' },
  { desc: 'SOLUBLE OIL', unit: 'Ltr' },
  { desc: 'MOULD OIL', unit: 'Ltr' },
  { desc: 'HARDENER', unit: 'KG' },
  { desc: 'SODIUM DICHROMATE', unit: 'KG' },
  { desc: 'CHARCOAL', unit: 'KG' },
  { desc: 'SALT', unit: 'KG' },
  { desc: 'COAL', unit: 'Ton' },
];

const FINISHED_STOCK_SIZES = [
  '600X250X200', '600X250X125', '600X200X250', '600X200X230', '600X200X225', '600X200X200',
  '600X200X150', '600X200X150(P)', '600X200X125', '600X200X100', '600X200X75', '600X200X350',
  '600X200X250(B)', '600X200X225 (B)', '600X200X200(B)', '600X200X150(B)', '600X200X100 (B)',
  '600x200x125 (B)', '600x200x200 (HD)', '600X200X100 (HD)', '600X250X250',
];

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normalizeSizeList = (sizes = []) => {
  const uniqueSizes = [];

  for (const size of Array.isArray(sizes) ? sizes : []) {
    const label = String(size || '').trim();
    if (!label || uniqueSizes.includes(label)) continue;
    uniqueSizes.push(label);
  }

  return uniqueSizes.length > 0 ? uniqueSizes : [...FINISHED_STOCK_SIZES];
};

const formatDateDdMmYyyy = (isoDate) => {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const [, yyyy, mm, dd] = match;
  return `${dd}-${mm}-${yyyy}`;
};

const previousDate = (isoDate) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
};

const getRawDay = async (date) => collections().rawStockDays.findOne({ date });
const getFinishedDay = async (date) => collections().finishedStockDays.findOne({ date });
const getLatestRawDayBefore = async (date) => {
  if (!date) return null;
  return collections().rawStockDays.findOne(
    { date: { $lt: date } },
    { sort: { date: -1 } },
  );
};

const getLatestFinishedDayBefore = async (date) => {
  if (!date) return null;
  return collections().finishedStockDays.findOne(
    { date: { $lt: date } },
    { sort: { date: -1 } },
  );
};

const sortStockDays = (days) => [...days].sort((left, right) => String(left.date).localeCompare(String(right.date)));

const syncLegacyState = async (key, value) => {
  await collections().appState.updateOne(
    { _id: STATE_DOC_ID },
    {
      $setOnInsert: {
        _id: STATE_DOC_ID,
        orders: [],
        dieselEntries: [],
        logs: [],
        rawStock: {},
        finishedStock: {},
      },
      $set: {
        [key]: value,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
};

const rebuildRawItemsFromBaseline = (sourceItems, openingMap) => {
  const sourceMap = new Map((Array.isArray(sourceItems) ? sourceItems : []).map((item) => [String(item?.desc || ''), item]));

  return RAW_MATERIALS.map((item, idx) => {
    const source = sourceMap.get(item.desc) || {};
    const opening = safeNum(openingMap.get(item.desc));
    const receipt = safeNum(source.receipt);
    const issue = safeNum(source.issue);
    const total = opening + receipt;
    const closing = total - issue;

    return {
      id: idx,
      desc: item.desc,
      unit: item.unit,
      opening,
      receipt,
      total,
      issue,
      closing,
      remarks: String(source.remarks || ''),
      inAutoclave: safeNum(source.inAutoclave),
    };
  });
};

const rebuildFinishedItemsFromBaseline = (sourceItems, openingMap, sizes = FINISHED_STOCK_SIZES) => {
  const sourceMap = new Map((Array.isArray(sourceItems) ? sourceItems : []).map((item) => [String(item?.size || ''), item]));

  return normalizeSizeList(sizes).map((size, idx) => {
    const source = sourceMap.get(size) || {};
    const opening = safeNum(openingMap.get(size));
    const segregation = safeNum(source.segregation);
    const sale = safeNum(source.sale);
    const proRejection = safeNum(source.proRejection);
    const loadingRejection = safeNum(source.loadingRejection);
    const selfUse = safeNum(source.selfUse);
    const selfUseBjm = safeNum(source.selfUseBjm);
    const inAutoclave = safeNum(source.inAutoclave);
    const closing = (opening + segregation) - (sale + proRejection + loadingRejection + selfUse + selfUseBjm);

    return {
      id: idx,
      size,
      opening,
      segregation,
      sale,
      proRejection,
      loadingRejection,
      selfUse,
      selfUseBjm,
      closing,
      inAutoclave,
    };
  });
};

const recalcRawStockChain = async (startDate, sourceItems) => {
  const startBaseline = await getLatestRawDayBefore(startDate);
  let openingMap = new Map((startBaseline?.items || []).map((item) => [item.desc, safeNum(item.closing)]));

  const futureDays = sortStockDays(await collections().rawStockDays.find({ date: { $gte: startDate } }).toArray());
  const recalculatedDays = [];

  for (const day of futureDays) {
    const items = rebuildRawItemsFromBaseline(day.date === startDate ? sourceItems : day.items, openingMap);
    const updatedAt = new Date().toISOString();

    await collections().rawStockDays.updateOne(
      { date: day.date },
      {
        $set: {
          date: day.date,
          items,
          updatedAt,
          updatedBy: day.updatedBy || null,
        },
      },
      { upsert: true },
    );

    recalculatedDays.push({ date: day.date, items, updatedAt });
    openingMap = new Map(items.map((item) => [item.desc, safeNum(item.closing)]));
  }

  return recalculatedDays;
};

const recalcFinishedStockChain = async (startDate, sourcePayload) => {
  const startBaseline = await getLatestFinishedDayBefore(startDate);
  let openingMap = new Map((startBaseline?.items || []).map((item) => [item.size, safeNum(item.closing)]));
  let mortarOpening = safeNum(startBaseline?.mortarBag?.closing);

  const futureDays = sortStockDays(await collections().finishedStockDays.find({ date: { $gte: startDate } }).toArray());
  const recalculatedDays = [];
  let activeSizes = normalizeSizeList(sourcePayload.sizes || startBaseline?.sizes || FINISHED_STOCK_SIZES);

  for (const day of futureDays) {
    const payload = day.date === startDate ? sourcePayload : day;
    const sizes = day.date === startDate ? normalizeSizeList(sourcePayload.sizes || startBaseline?.sizes || FINISHED_STOCK_SIZES) : activeSizes;
    const items = rebuildFinishedItemsFromBaseline(payload.items, openingMap, sizes);
    const sourceMortar = payload.mortarBag || {};
    const mortarBag = {
      opening: mortarOpening,
      receipt: safeNum(sourceMortar.receipt),
      sale: safeNum(sourceMortar.sale),
      closing: mortarOpening + safeNum(sourceMortar.receipt) - safeNum(sourceMortar.sale),
    };

    const saleDaily = items.reduce((acc, item) => acc + safeNum(item.sale), 0);
    const summary = {
      ...(day.summary || {}),
      saleDaily,
    };

    const updatedAt = new Date().toISOString();

    await collections().finishedStockDays.updateOne(
      { date: day.date },
      {
        $set: {
          date: day.date,
          items,
          sizes,
          mortarBag,
          summary,
          updatedAt,
          updatedBy: day.updatedBy || null,
        },
      },
      { upsert: true },
    );

    recalculatedDays.push({ date: day.date, items, mortarBag, summary, updatedAt });
    openingMap = new Map(items.map((item) => [item.size, safeNum(item.closing)]));
    mortarOpening = safeNum(mortarBag.closing);
    activeSizes = sizes;
  }

  return recalculatedDays;
};

const buildDefaultRawItems = async (date) => {
  const prevDate = previousDate(date);
  const prev = await getRawDay(prevDate);
  const baseline = prev || await getLatestRawDayBefore(date);
  const prevMap = new Map((baseline?.items || []).map((i) => [i.desc, safeNum(i.closing)]));

  return RAW_MATERIALS.map((item, idx) => {
    const opening = prevMap.get(item.desc) || 0;
    return {
      id: idx,
      desc: item.desc,
      unit: item.unit,
      opening,
      receipt: 0,
      total: opening,
      issue: 0,
      closing: opening,
      remarks: '',
      inAutoclave: 0,
    };
  });
};

const recomputeRawItems = (items) => items.map((item, idx) => {
  const opening = safeNum(item.opening);
  const receipt = safeNum(item.receipt);
  const issue = safeNum(item.issue);
  const total = opening + receipt;
  const closing = total - issue;
  return {
    id: idx,
    desc: item.desc,
    unit: item.unit,
    opening,
    receipt,
    total,
    issue,
    closing,
    remarks: String(item.remarks || ''),
    inAutoclave: safeNum(item.inAutoclave),
  };
});

const buildDefaultFinished = async (date) => {
  const prevDate = previousDate(date);
  const prev = await getFinishedDay(prevDate);
  const baseline = prev || await getLatestFinishedDayBefore(date);
  const prevItems = new Map((baseline?.items || []).map((i) => [i.size, safeNum(i.closing)]));
  const prevMortarClosing = safeNum(baseline?.mortarBag?.closing);
  const prevSummary = baseline?.summary || {};
  const sizes = normalizeSizeList(baseline?.sizes || FINISHED_STOCK_SIZES);

  const items = sizes.map((size, idx) => {
    const opening = prevItems.get(size) || 0;
    return {
      id: idx,
      size,
      opening,
      segregation: 0,
      sale: 0,
      proRejection: 0,
      loadingRejection: 0,
      selfUse: 0,
      selfUseBjm: 0,
      closing: opening,
      inAutoclave: 0,
    };
  });

  return {
    items,
    sizes,
    mortarBag: {
      opening: prevMortarClosing,
      receipt: 0,
      sale: 0,
      closing: prevMortarClosing,
    },
    summary: {
      saleDaily: 0,
      productionDaily: 0,
      totalSale: safeNum(prevSummary.totalSale),
      totalProduction: safeNum(prevSummary.totalProduction),
      totalMortarSale: 0,
    },
  };
};

const recomputeFinished = (payload) => {
  const sizes = normalizeSizeList(payload.sizes || (Array.isArray(payload.items) ? payload.items.map((item) => item?.size) : []) || FINISHED_STOCK_SIZES);
  const items = (payload.items || []).map((item, idx) => {
    const opening = safeNum(item.opening);
    const segregation = safeNum(item.segregation);
    const sale = safeNum(item.sale);
    const proRejection = safeNum(item.proRejection);
    const loadingRejection = safeNum(item.loadingRejection);
    const selfUse = safeNum(item.selfUse);
    const selfUseBjm = safeNum(item.selfUseBjm);
    const inAutoclave = safeNum(item.inAutoclave);
    const closing = (opening + segregation) - (sale + proRejection + loadingRejection + selfUse + selfUseBjm);

    return {
      id: idx,
      size: String(item.size || FINISHED_STOCK_SIZES[idx] || ''),
      opening,
      segregation,
      sale,
      proRejection,
      loadingRejection,
      selfUse,
      selfUseBjm,
      closing,
      inAutoclave,
    };
  });

  const mortarOpening = safeNum(payload.mortarBag?.opening);
  const mortarReceipt = safeNum(payload.mortarBag?.receipt);
  const mortarSale = safeNum(payload.mortarBag?.sale);

  const mortarBag = {
    opening: mortarOpening,
    receipt: mortarReceipt,
    sale: mortarSale,
    closing: mortarOpening + mortarReceipt - mortarSale,
  };

  const saleDaily = items.reduce((acc, item) => acc + safeNum(item.sale), 0);

  const summary = {
    saleDaily,
    productionDaily: safeNum(payload.summary?.productionDaily),
    totalSale: safeNum(payload.summary?.totalSale),
    totalProduction: safeNum(payload.summary?.totalProduction),
    totalMortarSale: safeNum(payload.summary?.totalMortarSale),
  };

  return { items, mortarBag, summary, sizes };
};

const writePdfHeader = (doc, title, date) => {
  const formattedDate = formatDateDdMmYyyy(date);
  doc.fontSize(18).text('AAC Plant Management', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(13).text(title, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).text(`Date: ${formattedDate}`, { align: 'center' });
  doc.moveDown();
};

router.use('/production', requireAuth);
router.use('/production', requireRoles(ROLES.PRODUCTION, ROLES.MANAGEMENT));

router.get('/production/raw/:date', async (req, res, next) => {
  try {
    const date = String(req.params.date);
    const existing = await getRawDay(date);

    if (existing) return res.json({ date, items: existing.items });

    const items = await buildDefaultRawItems(date);
    return res.json({ date, items });
  } catch (error) {
    return next(error);
  }
});

router.put('/production/raw/:date', async (req, res, next) => {
  try {
    const date = String(req.params.date);
    const items = recomputeRawItems(Array.isArray(req.body?.items) ? req.body.items : []);

    await collections().rawStockDays.updateOne(
      { date },
      {
        $set: {
          date,
          items,
          updatedAt: new Date().toISOString(),
          updatedBy: { userId: req.user.userId, username: req.user.username, role: req.user.role },
        },
      },
      { upsert: true },
    );

    const recalculatedDays = await recalcRawStockChain(date, items);
    const appStateDoc = await collections().appState.findOne({ _id: STATE_DOC_ID });
    const rawStockSnapshot = {
      ...(appStateDoc?.rawStock || {}),
      [date]: {
        items,
        timestamp: new Date().toISOString(),
      },
    };

    for (const day of recalculatedDays) {
      rawStockSnapshot[day.date] = {
        items: day.items,
        timestamp: day.updatedAt,
      };
    }

    await syncLegacyState('rawStock', rawStockSnapshot);

    return res.json({ ok: true, date, items, affectedDates: recalculatedDays });
  } catch (error) {
    return next(error);
  }
});

router.get('/production/finished/:date', async (req, res, next) => {
  try {
    const date = String(req.params.date);
    const existing = await getFinishedDay(date);

    if (existing) {
      return res.json({
        date,
        items: existing.items,
        sizes: existing.sizes || FINISHED_STOCK_SIZES,
        mortarBag: existing.mortarBag,
        summary: existing.summary,
      });
    }

    const seed = await buildDefaultFinished(date);
    return res.json({ date, ...seed });
  } catch (error) {
    return next(error);
  }
});

router.put('/production/finished/:date', async (req, res, next) => {
  try {
    const date = String(req.params.date);
    const payload = recomputeFinished(req.body || {});

    await collections().finishedStockDays.updateOne(
      { date },
      {
        $set: {
          date,
          ...payload,
          updatedAt: new Date().toISOString(),
          updatedBy: { userId: req.user.userId, username: req.user.username, role: req.user.role },
        },
      },
      { upsert: true },
    );

    const recalculatedDays = await recalcFinishedStockChain(date, payload);
    const appStateDoc = await collections().appState.findOne({ _id: STATE_DOC_ID });
    const finishedStockSnapshot = {
      ...(appStateDoc?.finishedStock || {}),
      [date]: {
        items: payload.items,
        sizes: payload.sizes,
        mortarBag: payload.mortarBag,
        summary: payload.summary,
        timestamp: new Date().toISOString(),
      },
    };

    for (const day of recalculatedDays) {
      finishedStockSnapshot[day.date] = {
        items: day.items,
        mortarBag: day.mortarBag,
        summary: day.summary,
        timestamp: day.updatedAt,
      };
    }

    await syncLegacyState('finishedStock', finishedStockSnapshot);

    return res.json({ ok: true, date, ...payload, affectedDates: recalculatedDays });
  } catch (error) {
    return next(error);
  }
});

router.get('/production/report/:date/pdf', async (req, res, next) => {
  try {
    const date = String(req.params.date);
    const reportType = String(req.query.type || 'raw');

    const doc = new PDFDocument({ size: 'A4', margin: 36 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Production_${reportType}_${date}.pdf`);

    doc.pipe(res);

    if (reportType === 'finished') {
      const record = (await getFinishedDay(date)) || (await buildDefaultFinished(date));
      writePdfHeader(doc, 'Daily Production Report', date);

      doc.fontSize(11).text('Finished Stock', { underline: true });
      doc.moveDown(0.4);
      record.items.forEach((item, idx) => {
        doc.fontSize(9).text(
          `${idx + 1}. ${item.size} | Opening: ${safeNum(item.opening).toFixed(2)} | Seg: ${safeNum(item.segregation).toFixed(2)} | Sale: ${safeNum(item.sale).toFixed(2)} | Closing: ${safeNum(item.closing).toFixed(2)}`,
        );
      });

      doc.moveDown(0.6);
      doc.fontSize(10).text(
        `Mortar Bag - Opening: ${safeNum(record.mortarBag.opening).toFixed(2)}, Receipt: ${safeNum(record.mortarBag.receipt).toFixed(2)}, Sale: ${safeNum(record.mortarBag.sale).toFixed(2)}, Closing: ${safeNum(record.mortarBag.closing).toFixed(2)}`,
      );

      doc.moveDown(0.6);
      doc.fontSize(10).text(
        `Summary - Sale Daily: ${safeNum(record.summary.saleDaily).toFixed(2)}, Production Daily: ${safeNum(record.summary.productionDaily).toFixed(2)}, Total Sale: ${safeNum(record.summary.totalSale).toFixed(2)}, Total Production: ${safeNum(record.summary.totalProduction).toFixed(2)}`,
      );
    } else {
      const record = (await getRawDay(date)) || { items: await buildDefaultRawItems(date) };
      writePdfHeader(doc, 'Raw Material Stock Report', date);

      record.items.forEach((item, idx) => {
        doc.fontSize(9).text(
          `${idx + 1}. ${item.desc} (${item.unit}) | Opening: ${safeNum(item.opening).toFixed(2)} | Receipt: ${safeNum(item.receipt).toFixed(2)} | Total: ${safeNum(item.total).toFixed(2)} | Issue: ${safeNum(item.issue).toFixed(2)} | Closing: ${safeNum(item.closing).toFixed(2)} | Remarks: ${item.remarks || '-'}`,
        );
      });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
});

router.delete('/production/reset', requireRoles(ROLES.MANAGEMENT), async (_req, res, next) => {
  try {
    await Promise.all([
      collections().rawStockDays.deleteMany({}),
      collections().finishedStockDays.deleteMany({}),
    ]);
    await syncLegacyState('rawStock', {});
    await syncLegacyState('finishedStock', {});
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
