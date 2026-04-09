import {
  ABC_DISPATCH_REQUIRED_FIELDS,
  DISPATCH_REQUIRED_FIELDS,
  ORDER_STATUSES,
  STATUS_TRANSITIONS,
  TRANSITION_PERMISSIONS,
} from '../constants.js';
import { httpError } from '../utils/httpError.js';

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const buildStoredFileUrl = (baseUrl, type, orderId, filename) => {
  if (!filename || !orderId) return null;

  const filePath = `/uploads/${type}/${encodeURIComponent(orderId)}/${encodeURIComponent(filename)}`;
  if (!baseUrl) return filePath;

  return `${String(baseUrl).replace(/\/$/, '')}${filePath}`;
};

export const validateOrderDraft = (payload) => {
  const requiredFields = ['vehicle', 'vehicleType', 'transporter'];
  for (const field of requiredFields) {
    if (!hasValue(payload[field])) {
      throw httpError(400, `${field} is required.`);
    }
  }
};

const canTransition = (fromStatus, toStatus) => {
  const nextStates = STATUS_TRANSITIONS[fromStatus] || [];
  return nextStates.includes(toStatus);
};

export const validateTransition = ({ fromStatus, toStatus, role }) => {
  if (!canTransition(fromStatus, toStatus)) {
    throw httpError(400, `Invalid status transition from ${fromStatus} to ${toStatus}.`);
  }

  const key = `${fromStatus}->${toStatus}`;
  const allowedRoles = TRANSITION_PERMISSIONS[key] || [];
  if (!allowedRoles.includes(role)) {
    throw httpError(403, `Role ${role} cannot change status from ${fromStatus} to ${toStatus}.`);
  }
};

export const validateDispatchPayload = (payload) => {
  for (const field of DISPATCH_REQUIRED_FIELDS) {
    if (!hasValue(payload[field])) {
      throw httpError(400, `${field} is required to dispatch.`);
    }
  }

  const isABC = String(payload.transporter || '').toUpperCase() === 'ABC';

  if (isABC) {
    for (const field of ABC_DISPATCH_REQUIRED_FIELDS) {
      if (!hasValue(payload[field])) {
        throw httpError(400, `${field} is required for ABC transporter dispatch.`);
      }
    }
  }

  if (!isABC) {
    payload.tripKm = null;
    payload.hsd = null;
  }

  return payload;
};

export const ensureRejectReason = (reason) => {
  if (!hasValue(reason)) {
    throw httpError(400, 'Rejection reason is required.');
  }
};

export const normalizeOrderDoc = (doc, { baseUrl } = {}) => {
  if (!doc) return null;
  const normalized = {
    ...doc,
    id: doc._id.toString(),
    _id: undefined,
  };

  if (normalized.invoice) {
    normalized.invoiceUrl = buildStoredFileUrl(baseUrl, 'invoices', normalized.id, normalized.invoice);
  }

  return normalized;
};

export const createOrderEvent = ({ orderId, fromStatus, toStatus, action, actor, metadata = {} }) => ({
  orderId,
  fromStatus,
  toStatus,
  action,
  actor,
  metadata,
  createdAt: new Date().toISOString(),
});

export const createAuditLog = ({ action, actor, details }) => ({
  action,
  actor,
  details,
  createdAt: new Date().toISOString(),
});

export const ORDER_ACTIONS = {
  CREATE: 'ORDER_CREATE',
  UPDATE: 'ORDER_UPDATE',
  TRANSITION: 'ORDER_TRANSITION',
  APPROVE: 'ORDER_APPROVE',
  REJECT: 'ORDER_REJECT',
  DISPATCH: 'ORDER_DISPATCH',
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
};

export const FINAL_STATUS = ORDER_STATUSES.DISPATCHED;
