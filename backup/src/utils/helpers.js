// Date utilities
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
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
};

export const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};

export const getLocalOrderDateString = (timestamp) => {
    if (!timestamp) return getTodayString();
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Number utilities
export const safeNum = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

export const safeInt = (val) => {
  const parsed = parseInt(val);
  return isNaN(parsed) ? 0 : parsed;
};

// Time utilities
export const convertTimeTo24h = (time12h) => {
    if (!time12h) return '';
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') hours = '00';
    if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Calculation utilities
export const calculatePiecesLoaded = (cbm, size) => {
    if (!cbm || !size) return 0;
    const blockCBM = 0.024; 
    return Math.round(cbm / blockCBM);
};

export const calculateColumnTotal = (data, field) => {
    if (!data) return 0;
    return data.reduce((acc, item) => acc + safeNum(item[field]), 0).toFixed(2);
};
