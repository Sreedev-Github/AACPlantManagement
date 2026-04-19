import PDFDocument from 'pdfkit';
import { Router } from 'express';

import { ROLES } from '../constants.js';
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

const previousDate = (isoDate) => {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
};

const getRawDay = async (date) => collections().rawStockDays.findOne({ date });
const getFinishedDay = async (date) => collections().finishedStockDays.findOne({ date });

const buildDefaultRawItems = async (date) => {
  const prev = await getRawDay(previousDate(date));
  const prevMap = new Map((prev?.items || []).map((i) => [i.desc, safeNum(i.closing)]));

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
  };
});

const buildDefaultFinished = async (date) => {
  const prev = await getFinishedDay(previousDate(date));
  const prevItems = new Map((prev?.items || []).map((i) => [i.size, safeNum(i.closing)]));
  const prevMortarClosing = safeNum(prev?.mortarBag?.closing);
  const prevSummary = prev?.summary || {};

  const items = FINISHED_STOCK_SIZES.map((size, idx) => {
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
      closing: opening,
    };
  });

  return {
    items,
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
  const items = (payload.items || []).map((item, idx) => {
    const opening = safeNum(item.opening);
    const segregation = safeNum(item.segregation);
    const sale = safeNum(item.sale);
    const proRejection = safeNum(item.proRejection);
    const loadingRejection = safeNum(item.loadingRejection);
    const selfUse = safeNum(item.selfUse);
    const closing = (opening + segregation) - (sale + proRejection + loadingRejection + selfUse);

    return {
      id: idx,
      size: String(item.size || FINISHED_STOCK_SIZES[idx] || ''),
      opening,
      segregation,
      sale,
      proRejection,
      loadingRejection,
      selfUse,
      closing,
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

  return { items, mortarBag, summary };
};

const writePdfHeader = (doc, title, date) => {
  doc.fontSize(18).text('AAC Plant Management', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(13).text(title, { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).text(`Date: ${date}`, { align: 'center' });
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

    return res.json({ ok: true, date, items });
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

    return res.json({ ok: true, date, ...payload });
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
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
