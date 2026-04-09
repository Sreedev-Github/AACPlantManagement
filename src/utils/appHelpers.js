export const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getPreviousDateString = (dateString) => {
  const parts = dateString.split('-');
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

export const formatDateTimeDisplay = (timestamp) => {
  if (!timestamp) return '';

  let millis = null;

  if (typeof timestamp === 'number') {
    millis = timestamp;
  } else if (timestamp.seconds) {
    millis = timestamp.seconds * 1000;
  } else if (timestamp instanceof Date) {
    millis = timestamp.getTime();
  }

  if (!millis) return '';

  const date = new Date(millis);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};

export const createTimestamp = () => ({ seconds: Math.floor(Date.now() / 1000) });

export const safeNum = (val) => {
  const parsed = parseFloat(val);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const safeInt = (val) => {
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const convertTimeTo24h = (time12h) => {
  if (!time12h) return '';
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getVolumePerPieceFromSize = (size) => {
  const dims = String(size || '')
    .toLowerCase()
    .split('x')
    .map((part) => Number(part.trim()));

  if (dims.length !== 3 || dims.some((value) => Number.isNaN(value) || value <= 0)) {
    return 0;
  }

  const [lengthMm, widthMm, heightMm] = dims;
  const lengthM = lengthMm / 1000;
  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;

  return lengthM * widthM * heightM;
};

export const convertCbmToPieces = (totalCbm, size) => {
  const cbm = safeNum(totalCbm);
  const volumePerPiece = getVolumePerPieceFromSize(size);
  if (!volumePerPiece) return 0;
  return cbm / volumePerPiece;
};

export const convertPiecesToCbm = (pieces, size) => {
  const pcs = safeNum(pieces);
  const volumePerPiece = getVolumePerPieceFromSize(size);
  if (!volumePerPiece) return 0;
  return pcs * volumePerPiece;
};

export const calculatePiecesLoaded = (cbm, size) => {
  if (!cbm || !size) return 0;
  return Math.round(convertCbmToPieces(cbm, size));
};

export const calculateColumnTotal = (data, field) => {
  if (!data) return 0;
  return data.reduce((acc, item) => acc + safeNum(item[field]), 0).toFixed(2);
};

export const createId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
