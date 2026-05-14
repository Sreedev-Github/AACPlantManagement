export const SIZES = [
  '600X250X200',
  '600X200X300',
  '600X200X250',
  '600X200X230',
  '600X200X225',
  '600X200X200',
  '600X200X200 (P)',
  '600X200X150',
  '600X200X125',
  '600X200X100',
  '600X200X75',
  '600X200X350',
  '600X200X250 (B)',
  '600X200X225 (HD)',
  '600X200X200 (B)',
  '600X200X150 (B)',
  '600X200X100 (B)',
  '600X200X125 (B)',
  '600X200X200 (HD)',
  '600X200X100 (HD)',
  '600X250X250',
];

export const LOADING_STATUSES = [
  'Awaiting Truck',
  'Truck at Site',
  'Loading',
  'Loading Complete',
];

export const RATE_CARD = {
  loading: { 4: 400, 6: 800, 10: 1000, 12: 1400, 14: 1600, 16: 1800, 18: 2000 },
  unloading: { 4: 600, 6: 1000, 10: 1800, 12: 2200, 14: 2500 },
};

export const GS_SURCHARGE = 500;

export const RAW_MATERIALS_LIST = [
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

export const FINISHED_STOCK_SIZES = [...SIZES];
