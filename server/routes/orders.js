import { ObjectId } from 'mongodb';
import { Router } from 'express';

import { ORDER_STATUSES, ROLES } from '../constants.js';
import { collections } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRoles } from '../middleware/roles.js';
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

const getOrderById = async (id) => {
  if (!ObjectId.isValid(id)) {
    throw httpError(400, 'Invalid order id.');
  }

  const order = await collections().orders.findOne({ _id: new ObjectId(id) });
  if (!order) {
    throw httpError(404, 'Order not found.');
  }

  return order;
};

const appendEventAndAudit = async ({ orderId, event, audit }) => {
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

router.use(authenticateOrGuest);

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
    };

    const result = await collections().orders.insertOne(order);
    const orderId = result.insertedId.toString();

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

    if (order.status === FINAL_STATUS) {
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

    const payload = validateDispatchPayload({ ...req.body });

    await collections().orders.updateOne(
      { _id: order._id },
      {
        $set: {
          status: ORDER_STATUSES.DISPATCHED,
          ...payload,
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
        toStatus: ORDER_STATUSES.DISPATCHED,
        action: ORDER_ACTIONS.DISPATCH,
        actor,
      }),
      audit: createAuditLog({ action: ORDER_ACTIONS.DISPATCH, actor, details: `Dispatched order ${order._id.toString()}` }),
    });

    const updated = await collections().orders.findOne({ _id: order._id });
    res.json({ order: normalizeOrderResponse(req, updated) });
  } catch (error) {
    next(error);
  }
});

export default router;
