import { Router } from 'express';

import { config } from '../config.js';
import { ORDER_STATUSES, ROLES } from '../constants.js';
import { collections } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
import { generateDispatchSlip, resolveDispatchSlipFormat } from '../services/dispatchSlip.js';
import {
  FINAL_STATUS,
  ORDER_ACTIONS,
  createAuditLog,
  createOrderEvent,
  ensureRejectReason,
  normalizeOrderDoc,
  validateDispatchPayload,
  validateOrderDraft,
  validateTransition,
} from '../services/orders.js';
import { httpError } from '../utils/httpError.js';
import { upload } from '../utils/uploads.js';

const router = Router();

const authenticateOrGuest = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    req.user = {
      userId: 'local-user',
      username: 'local-user',
      role: ROLES.MANAGEMENT,
    };
    return next();
  }

  return requireAuth(req, res, next);
};

const actorFromReq = (req) => ({
  userId: req.user.userId,
  username: req.user.username,
  role: req.user.role,
});

const hasDispatchValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const coalesceDispatchField = (payload, order, field, fallbackOrderFields = []) => {
  if (hasDispatchValue(payload[field])) return payload[field];
  if (hasDispatchValue(order[field])) return order[field];

  for (const fallbackField of fallbackOrderFields) {
    if (hasDispatchValue(order[fallbackField])) {
      return order[fallbackField];
    }
  }

  return payload[field] ?? order[field] ?? null;
};

const trimIfPresent = (value) => {
  if (value === undefined || value === null) return value;
  return String(value).trim();
};

const parseNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTruckType = (value) => {
  if (!hasDispatchValue(value)) return null;
  const digits = String(value).replace(/\D/gu, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSizeVolume = (size) => {
  const parts = String(size || '')
    .split(/x/iu)
    .map((item) => Number(item.trim()));

  if (parts.length !== 3 || parts.some((item) => !Number.isFinite(item) || item <= 0)) return null;

  const [lengthMm, widthMm, heightMm] = parts;
  return (lengthMm / 1000) * (widthMm / 1000) * (heightMm / 1000);
};

const derivePiecesLoaded = (cbm, size) => {
  const cbmValue = parseNumberOrNull(cbm);
  const volume = getSizeVolume(size);
  if (!Number.isFinite(cbmValue) || cbmValue <= 0 || !Number.isFinite(volume) || volume <= 0) return null;

  return Math.max(0, Math.round(cbmValue / volume));
};

const normalizeWeight = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0.000';
  return parsed.toFixed(3);
};

const buildDispatchPayload = (order, payload) => {
  const merged = {
    consignee: coalesceDispatchField(payload, order, 'consignee', ['client']),
    address: coalesceDispatchField(payload, order, 'address', ['location']),
    contactPerson: coalesceDispatchField(payload, order, 'contactPerson'),
    size: coalesceDispatchField(payload, order, 'size'),
    cbm: coalesceDispatchField(payload, order, 'cbm'),
    piecesLoaded: coalesceDispatchField(payload, order, 'piecesLoaded'),
    bjm: coalesceDispatchField(payload, order, 'bjm'),
    bjmRate: coalesceDispatchField(payload, order, 'bjmRate'),
    vehicle: coalesceDispatchField(payload, order, 'vehicle'),
    truckType: coalesceDispatchField(payload, order, 'truckType'),
    transporter: coalesceDispatchField(payload, order, 'transporter'),
    driverName: coalesceDispatchField(payload, order, 'driverName'),
    driverContact: coalesceDispatchField(payload, order, 'driverContact'),
    loadStartTime: coalesceDispatchField(payload, order, 'loadStartTime'),
    loadFinishTime: coalesceDispatchField(payload, order, 'loadFinishTime'),
    loadingBy: coalesceDispatchField(payload, order, 'loadingBy'),
    unloadingBy: coalesceDispatchField(payload, order, 'unloadingBy'),
    grossWeight: coalesceDispatchField(payload, order, 'grossWeight'),
    tareWeight: coalesceDispatchField(payload, order, 'tareWeight'),
    netWt: coalesceDispatchField(payload, order, 'netWt'),
    tripKm: coalesceDispatchField(payload, order, 'tripKm'),
    hsd: coalesceDispatchField(payload, order, 'hsd'),
  };

  merged.consignee = trimIfPresent(merged.consignee);
  merged.address = trimIfPresent(merged.address);
  merged.contactPerson = trimIfPresent(merged.contactPerson);
  merged.size = trimIfPresent(merged.size) || '600x200x150';
  merged.vehicle = trimIfPresent(merged.vehicle);
  merged.transporter = trimIfPresent(merged.transporter);
  merged.driverName = trimIfPresent(merged.driverName);
  merged.driverContact = trimIfPresent(merged.driverContact);
  merged.loadStartTime = trimIfPresent(merged.loadStartTime);
  merged.loadFinishTime = trimIfPresent(merged.loadFinishTime);
  merged.loadingBy = trimIfPresent(merged.loadingBy);
  merged.unloadingBy = trimIfPresent(merged.unloadingBy);

  merged.cbm = parseNumberOrNull(merged.cbm) ?? 0;
  merged.bjm = parseNumberOrNull(merged.bjm) ?? 0;
  merged.bjmRate = parseNumberOrNull(merged.bjmRate) ?? 0;
  merged.tripKm = parseNumberOrNull(merged.tripKm);
  merged.hsd = parseNumberOrNull(merged.hsd);
  merged.truckType = parseTruckType(merged.truckType) ?? parseTruckType(order.vehicleType) ?? 0;

  const parsedPiecesLoaded = parseNumberOrNull(merged.piecesLoaded);
  merged.piecesLoaded = Number.isFinite(parsedPiecesLoaded)
    ? parsedPiecesLoaded
    : (derivePiecesLoaded(merged.cbm, merged.size) ?? 0);

  merged.grossWeight = normalizeWeight(merged.grossWeight);
  merged.tareWeight = normalizeWeight(merged.tareWeight);
  merged.netWt = normalizeWeight(merged.netWt);

  merged.consignee = merged.consignee || trimIfPresent(order.client) || 'N/A';
  merged.address = merged.address || trimIfPresent(order.location) || 'N/A';
  merged.vehicle = merged.vehicle || 'N/A';
  merged.transporter = merged.transporter || 'N/A';
  merged.driverName = merged.driverName || 'N/A';
  merged.loadStartTime = merged.loadStartTime || 'N/A';
  merged.loadFinishTime = merged.loadFinishTime || 'N/A';
  merged.loadingBy = merged.loadingBy || 'N/A';

  if (String(merged.transporter || '').toUpperCase() === 'ABC') {
    merged.tripKm = Number.isFinite(merged.tripKm) ? merged.tripKm : 0;
    merged.hsd = Number.isFinite(merged.hsd) ? merged.hsd : 0;
  }

  return merged;
};

const getOrderById = async (id) => {
  if (!id || !String(id).trim()) {
    throw httpError(400, 'Invalid order id.');
  }

  const order = await collections().orders.findOne({ _id: String(id) });
  if (!order) {
    throw httpError(404, 'Order not found.');
  }

  return order;
};

const appendEventAndAudit = async ({ event, audit }) => {
  const c = collections();
  await Promise.all([
    c.orderEvents.insertOne(event),
    c.auditLogs.insertOne(audit),
  ]);
};

const getPublicBaseUrl = (req) => {
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
  const protocol = forwardedProto || req.protocol || 'http';
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
};

const normalizeOrderResponse = (req, doc) => normalizeOrderDoc(doc, { baseUrl: getPublicBaseUrl(req) });

router.use('/orders', authenticateOrGuest);

router.get('/orders', async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.date) query.orderDate = String(req.query.date);

    const docs = await collections().orders.find(query).sort({ orderDate: -1, createdAt: -1 }).toArray();
    res.json({ orders: docs.map((doc) => normalizeOrderResponse(req, doc)) });
  } catch (error) {
    next(error);
  }
});

router.get('/orders/:id/events', async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    const events = await collections().orderEvents
      .find({ orderId: order._id.toString() })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ events });
  } catch (error) {
    next(error);
  }
});

router.post('/orders', requireRoles(ROLES.SALES, ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const payload = req.body || {};
    validateOrderDraft(payload);

    const now = new Date().toISOString();
    const actor = actorFromReq(req);
    const order = {
      ...payload,
      status: ORDER_STATUSES.AWAITING_TRUCK,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      invoice: null,
      dispatchSlip: null,
      dispatchSlipFormat: null,
    };

    const result = await collections().orders.insertOne(order);
    const orderId = String(result.insertedId);

    await appendEventAndAudit({
      orderId,
      event: createOrderEvent({
        orderId,
        fromStatus: null,
        toStatus: ORDER_STATUSES.AWAITING_TRUCK,
        action: ORDER_ACTIONS.CREATE,
        actor,
      }),
      audit: createAuditLog({ action: ORDER_ACTIONS.CREATE, actor, details: `Created order ${orderId}` }),
    });

    const created = await collections().orders.findOne({ _id: result.insertedId });
    res.status(201).json({ order: normalizeOrderResponse(req, created) });
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:id', requireRoles(ROLES.SALES, ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    const isManagement = String(req.user?.role || '').toLowerCase() === ROLES.MANAGEMENT;

    if (order.status === FINAL_STATUS && !isManagement) {
      throw httpError(400, 'Dispatched orders cannot be edited.');
    }

    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    delete update.id;

    await collections().orders.updateOne(
      { _id: order._id },
      { $set: update },
    );

    const actor = actorFromReq(req);
    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus: order.status,
        action: ORDER_ACTIONS.UPDATE,
        actor,
        metadata: { fields: Object.keys(update) },
      }),
      audit: createAuditLog({
        action: ORDER_ACTIONS.UPDATE,
        actor,
        details: `Updated order ${order._id.toString()}`,
      }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    res.json({ order: normalizeOrderResponse(req, updated) });
  } catch (error) {
    next(error);
  }
});

router.patch('/orders/:id/dispatched-edit', requireRoles(ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);

    if (order.status !== FINAL_STATUS) {
      throw httpError(400, 'Only dispatched orders can be edited through this endpoint.');
    }

    const update = { ...req.body, updatedAt: new Date().toISOString() };
    delete update._id;
    delete update.id;
    delete update.status;

    await collections().orders.updateOne(
      { _id: order._id },
      { $set: update },
    );

    const actor = actorFromReq(req);
    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus: order.status,
        action: ORDER_ACTIONS.UPDATE,
        actor,
        metadata: {
          dispatchedEdit: true,
          fields: Object.keys(update),
        },
      }),
      audit: createAuditLog({
        action: ORDER_ACTIONS.UPDATE,
        actor,
        details: `Management edited dispatched order ${order._id.toString()}`,
      }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    res.json({ order: normalizeOrderResponse(req, updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/orders/:id', requireRoles(ROLES.SALES, ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);

    await Promise.all([
      collections().orders.deleteOne({ _id: order._id }),
      collections().orderEvents.deleteMany({ orderId: order._id.toString() }),
      collections().documents.deleteMany({ orderId: order._id.toString() }),
    ]);

    const actor = actorFromReq(req);
    await collections().auditLogs.insertOne(
      createAuditLog({
        action: ORDER_ACTIONS.UPDATE,
        actor,
        details: `Deleted order ${order._id.toString()}`,
      }),
    );

    res.json({ ok: true, id: order._id.toString() });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/transition', async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    const toStatus = String(req.body?.toStatus || '').trim();
    if (!toStatus) throw httpError(400, 'toStatus is required.');

    validateTransition({
      fromStatus: order.status,
      toStatus,
      role: req.user.role,
    });

    const extraData = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};

    await collections().orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: toStatus,
          ...extraData,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    const actor = actorFromReq(req);
    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus,
        action: ORDER_ACTIONS.TRANSITION,
        actor,
      }),
      audit: createAuditLog({
        action: ORDER_ACTIONS.TRANSITION,
        actor,
        details: `Transitioned ${order._id.toString()} from ${order.status} to ${toStatus}`,
      }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    res.json({ order: normalizeOrderResponse(req, updated) });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/documents/invoice', requireRoles(ROLES.ACCOUNTS, ROLES.MANAGEMENT), (req, _res, next) => {
  req.uploadType = 'invoices';
  next();
}, upload.single('file'), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    validateTransition({
      fromStatus: order.status,
      toStatus: ORDER_STATUSES.INVOICED,
      role: req.user.role,
    });

    if (!req.file) {
      throw httpError(400, 'Invoice file is required.');
    }

    const actor = actorFromReq(req);
    const now = new Date().toISOString();
    const doc = {
      orderId: order._id.toString(),
      type: 'invoice',
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: actor,
      createdAt: now,
    };

    await collections().documents.insertOne(doc);

    await collections().orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: ORDER_STATUSES.INVOICED,
          invoice: req.file.filename,
          updatedAt: now,
        },
      },
    );

    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus: ORDER_STATUSES.INVOICED,
        action: ORDER_ACTIONS.DOCUMENT_UPLOAD,
        actor,
      }),
      audit: createAuditLog({
        action: ORDER_ACTIONS.DOCUMENT_UPLOAD,
        actor,
        details: `Uploaded invoice for order ${order._id.toString()}`,
      }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    const normalizedOrder = normalizeOrderResponse(req, updated);
    res.json({
      order: normalizedOrder,
      document: {
        ...doc,
        url: normalizedOrder?.invoiceUrl || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/approve', requireRoles(ROLES.SALES, ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    validateTransition({ fromStatus: order.status, toStatus: ORDER_STATUSES.APPROVED, role: req.user.role });

    await collections().orders.updateOne(
      { _id: order._id },
      { $set: { status: ORDER_STATUSES.APPROVED, updatedAt: new Date().toISOString() } },
    );

    const actor = actorFromReq(req);
    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus: ORDER_STATUSES.APPROVED,
        action: ORDER_ACTIONS.APPROVE,
        actor,
      }),
      audit: createAuditLog({ action: ORDER_ACTIONS.APPROVE, actor, details: `Approved order ${order._id.toString()}` }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    res.json({ order: normalizeOrderResponse(req, updated) });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/reject', requireRoles(ROLES.SALES, ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    const reason = req.body?.reason;
    ensureRejectReason(reason);
    validateTransition({ fromStatus: order.status, toStatus: ORDER_STATUSES.LOADING_COMPLETE, role: req.user.role });

    await collections().orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: ORDER_STATUSES.LOADING_COMPLETE,
          rejectionReason: String(reason).trim(),
          updatedAt: new Date().toISOString(),
        },
      },
    );

    const actor = actorFromReq(req);
    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus: ORDER_STATUSES.LOADING_COMPLETE,
        action: ORDER_ACTIONS.REJECT,
        actor,
        metadata: { reason: String(reason).trim() },
      }),
      audit: createAuditLog({ action: ORDER_ACTIONS.REJECT, actor, details: `Rejected invoice for order ${order._id.toString()}` }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    res.json({ order: normalizeOrderResponse(req, updated) });
  } catch (error) {
    next(error);
  }
});

router.post('/orders/:id/dispatch', requireRoles(ROLES.LOADING, ROLES.MANAGEMENT), async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    validateTransition({ fromStatus: order.status, toStatus: ORDER_STATUSES.DISPATCHED, role: req.user.role });

    const requestedSlipFormat = req.body?.slipFormat;
    const slipFormat = resolveDispatchSlipFormat(requestedSlipFormat, 'pdf');

    const dispatchPayload = { ...req.body };
    delete dispatchPayload.slipFormat;

    const payload = validateDispatchPayload(buildDispatchPayload(order, dispatchPayload));
    const actor = actorFromReq(req);
    const now = new Date().toISOString();

    const slipFile = await generateDispatchSlip({
      order: {
        ...order,
        ...payload,
        id: order._id.toString(),
      },
      format: slipFormat,
      uploadDir: config.uploadDir,
    });

    const docRecord = {
      orderId: order._id.toString(),
      type: 'dispatch_slip',
      filename: slipFile.filename,
      originalName: slipFile.filename,
      path: slipFile.path,
      mimeType: slipFile.mimeType,
      size: slipFile.size,
      uploadedBy: actor,
      createdAt: now,
    };

    await collections().orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: ORDER_STATUSES.DISPATCHED,
          ...payload,
          dispatchSlip: slipFile.filename,
          dispatchSlipFormat: slipFormat,
          updatedAt: now,
        },
      },
    );

    await collections().documents.insertOne(docRecord);

    await appendEventAndAudit({
      orderId: order._id.toString(),
      event: createOrderEvent({
        orderId: order._id.toString(),
        fromStatus: order.status,
        toStatus: ORDER_STATUSES.DISPATCHED,
        action: ORDER_ACTIONS.DISPATCH,
        actor,
        metadata: { slipFormat },
      }),
      audit: createAuditLog({
        action: ORDER_ACTIONS.DISPATCH,
        actor,
        details: `Dispatched order ${order._id.toString()} and generated ${slipFormat.toUpperCase()} slip`,
      }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    const normalizedOrder = normalizeOrderResponse(req, updated);

    res.json({
      order: normalizedOrder,
      document: {
        ...docRecord,
        url: normalizedOrder?.dispatchSlipUrl || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
