export const STATE_DOC_ID = 'aac_plant_state';

export const STATE_KEYS = ['orders', 'dieselEntries', 'logs', 'rawStock', 'finishedStock'];

export const ROLES = {
  SALES: 'sales',
  LOADING: 'loading',
  ACCOUNTS: 'accounts',
  MANAGEMENT: 'management',
  PRODUCTION: 'production',
};

export const ORDER_STATUSES = {
  AWAITING_TRUCK: 'Awaiting Truck',
  TRUCK_AT_SITE: 'Truck at Site',
  LOADING: 'Loading',
  LOADING_COMPLETE: 'Loading Complete',
  INVOICED: 'Invoiced',
  APPROVED: 'Approved',
  DISPATCHED: 'Dispatched',
};

export const STATUS_TRANSITIONS = {
  [ORDER_STATUSES.AWAITING_TRUCK]: [ORDER_STATUSES.TRUCK_AT_SITE],
  [ORDER_STATUSES.TRUCK_AT_SITE]: [ORDER_STATUSES.LOADING],
  [ORDER_STATUSES.LOADING]: [ORDER_STATUSES.LOADING_COMPLETE],
  [ORDER_STATUSES.LOADING_COMPLETE]: [ORDER_STATUSES.INVOICED],
  [ORDER_STATUSES.INVOICED]: [ORDER_STATUSES.APPROVED, ORDER_STATUSES.LOADING_COMPLETE],
  [ORDER_STATUSES.APPROVED]: [ORDER_STATUSES.DISPATCHED],
  [ORDER_STATUSES.DISPATCHED]: [],
};

export const TRANSITION_PERMISSIONS = {
  [`${ORDER_STATUSES.AWAITING_TRUCK}->${ORDER_STATUSES.TRUCK_AT_SITE}`]: [ROLES.LOADING, ROLES.MANAGEMENT],
  [`${ORDER_STATUSES.TRUCK_AT_SITE}->${ORDER_STATUSES.LOADING}`]: [ROLES.LOADING, ROLES.MANAGEMENT],
  [`${ORDER_STATUSES.LOADING}->${ORDER_STATUSES.LOADING_COMPLETE}`]: [ROLES.LOADING, ROLES.MANAGEMENT],
  [`${ORDER_STATUSES.LOADING_COMPLETE}->${ORDER_STATUSES.INVOICED}`]: [ROLES.ACCOUNTS, ROLES.MANAGEMENT],
  [`${ORDER_STATUSES.INVOICED}->${ORDER_STATUSES.APPROVED}`]: [ROLES.SALES, ROLES.MANAGEMENT],
  [`${ORDER_STATUSES.INVOICED}->${ORDER_STATUSES.LOADING_COMPLETE}`]: [ROLES.SALES, ROLES.MANAGEMENT],
  [`${ORDER_STATUSES.APPROVED}->${ORDER_STATUSES.DISPATCHED}`]: [ROLES.LOADING, ROLES.MANAGEMENT],
};

export const DISPATCH_REQUIRED_FIELDS = [
  'consignee',
  'address',
  'size',
  'cbm',
  'piecesLoaded',
  'bjm',
  'bjmRate',
  'vehicle',
  'truckType',
  'transporter',
  'driverName',
  'loadStartTime',
  'loadFinishTime',
  'loadingBy',
  'grossWeight',
  'tareWeight',
  'netWt',
];

export const ABC_DISPATCH_REQUIRED_FIELDS = ['tripKm', 'hsd'];

export const COLLECTIONS = {
  USERS: 'users',
  ORDERS: 'orders',
  ORDER_EVENTS: 'order_events',
  DOCUMENTS: 'documents',
  DIESEL: 'diesel_entries',
  RAW_STOCK_DAYS: 'raw_stock_days',
  FINISHED_STOCK_DAYS: 'finished_stock_days',
  AUDIT_LOGS: 'audit_logs',
  APP_STATE: 'app_state',
};

export const createDefaultState = () => ({
  orders: [],
  dieselEntries: [],
  logs: [],
  rawStock: {},
  finishedStock: {},
});
