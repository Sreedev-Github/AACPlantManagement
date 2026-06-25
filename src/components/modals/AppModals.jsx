import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  FileUp,
  Truck,
  X,
} from 'lucide-react';
import { SIZES } from '../../constants/appConstants';
import { calculatePiecesLoaded, convertTimeTo24h, createTimestamp, formatTruckTypeShort } from '../../utils/appHelpers';
import { InputGroup } from '../ui/AppUI';

const formatDispatchValue = (order) => {
  const parseMultiple = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && (val.includes(',') || val.startsWith('['))) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return val ? [String(val)] : [];
  };
  let cbmsList = [];
  const isDispatched = order.status === 'Dispatched' || (order.dispatchSlip !== undefined && order.dispatchSlip !== null && String(order.dispatchSlip).trim() !== '');

  if (isDispatched) {
    const rawSizes = String(order.size || '').split(',').map(s => s.trim()).filter(Boolean);
    const additional = Array.isArray(order.additionalProducts) ? order.additionalProducts : [];
    
    const totalCbm = parseFloat(order.cbm) || 0;
    let additionalCbmSum = 0;
    const additionalCbms = additional.map((p) => {
      const pCbm = parseFloat(p.cbm) || 0;
      additionalCbmSum += pCbm;
      return pCbm;
    });
    
    const primaryCbm = Math.max(0, totalCbm - additionalCbmSum);
    
    rawSizes.forEach((_, idx) => {
      if (idx === 0) {
        cbmsList.push(primaryCbm);
      } else {
        cbmsList.push(additionalCbms[idx - 1] || 0);
      }
    });
  } else {
    if (Array.isArray(order.sizes) && order.sizes.length > 0 && typeof order.sizes[0] === 'object') {
      cbmsList = order.sizes.map(s => s.cbm).filter(Boolean);
    } else {
      if (order.cbm !== undefined && order.cbm !== null && String(order.cbm).trim() !== '') {
        cbmsList.push(order.cbm);
      }
      if (Array.isArray(order.additionalProducts)) {
        order.additionalProducts.forEach((p) => {
          if (p.cbm !== undefined && p.cbm !== null && String(p.cbm).trim() !== '') {
            cbmsList.push(p.cbm);
          }
        });
      }
      if (cbmsList.length === 0) {
        cbmsList = parseMultiple(order.cbm);
      }
    }
  }

  const formattedCbms = cbmsList.map(c => {
    const num = parseFloat(c);
    if (!Number.isFinite(num)) return String(c);
    return Number(num.toFixed(3)).toString();
  });

  const cbmText = formattedCbms.join(', ');
  const bjmVal = order.bjm;
  const hasBjm = bjmVal !== undefined && bjmVal !== null && String(bjmVal).trim() !== '' && Number(bjmVal) !== 0 && String(bjmVal).trim() !== '-';
  const bjmText = hasBjm ? `${Number(bjmVal)} BJM` : '';

  if (!cbmText || cbmText === '-') return bjmText || '-';
  return bjmText ? `${cbmText}, ${bjmText}` : cbmText;
};

const formatDispatchPieces = (order) => {
  const parseMultiple = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && (val.includes(',') || val.startsWith('['))) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return val ? [String(val)] : [];
  };

  const getSizeVolume = (size) => {
    const parts = String(size || '')
      .toLowerCase()
      .match(/\d+(?:\.\d+)?/gu)
      ?.slice(0, 3)
      .map((item) => Number(item));

    if (!parts || parts.length !== 3 || parts.some((item) => !Number.isFinite(item) || item <= 0)) return null;

    const [lengthMm, widthMm, heightMm] = parts;
    return (lengthMm / 1000) * (widthMm / 1000) * (heightMm / 1000);
  };

  const derivePiecesLoaded = (cbm, size) => {
    const cbmValue = parseFloat(cbm);
    const volume = getSizeVolume(size);
    if (!Number.isFinite(cbmValue) || cbmValue <= 0 || !Number.isFinite(volume) || volume <= 0) return 0;
    return Math.max(0, Math.round(cbmValue / volume));
  };

  const isDispatched = order.status === 'Dispatched' || (order.dispatchSlip !== undefined && order.dispatchSlip !== null && String(order.dispatchSlip).trim() !== '');

  let piecesList = [];

  if (isDispatched) {
    const rawSizes = String(order.size || '').split(',').map(s => s.trim()).filter(Boolean);
    const additional = Array.isArray(order.additionalProducts) ? order.additionalProducts : [];
    
    const totalPieces = parseInt(order.piecesLoaded, 10) || 0;
    let additionalPiecesSum = 0;
    const additionalPieces = additional.map((p) => {
      const pCbm = parseFloat(p.cbm) || 0;
      const pSize = p.size || '';
      const pPieces = derivePiecesLoaded(pCbm, pSize);
      additionalPiecesSum += pPieces;
      return pPieces;
    });

    const primaryPieces = Math.max(0, totalPieces - additionalPiecesSum);

    rawSizes.forEach((_, idx) => {
      if (idx === 0) {
        piecesList.push(primaryPieces);
      } else {
        piecesList.push(additionalPieces[idx - 1] || 0);
      }
    });
  } else {
    if (order.size) {
      piecesList.push(parseInt(order.piecesLoaded, 10) || derivePiecesLoaded(order.cbm, order.size));
    }
    if (Array.isArray(order.sizes)) {
      order.sizes.forEach((s) => {
        if (s && typeof s === 'object' && s.size) {
          piecesList.push(derivePiecesLoaded(s.cbm, s.size));
        }
      });
    }
    if (Array.isArray(order.additionalProducts)) {
      order.additionalProducts.forEach((p) => {
        if (p && p.size) {
          piecesList.push(derivePiecesLoaded(p.cbm, p.size));
        }
      });
    }
    if (piecesList.length === 0) {
      piecesList = parseMultiple(order.piecesLoaded);
    }
  }

  const formattedPieces = piecesList.map(p => `${parseInt(p, 10) || 0} PCS`);
  return formattedPieces.length > 0 ? formattedPieces.join(', ') : '-';
};

const DispatchSlipContent = ({ order }) => {
  const parseMultiple = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && (val.includes(',') || val.startsWith('['))) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return val ? [String(val)] : [];
  };

  let sizesList = [];
  const isDispatched = order.status === 'Dispatched' || (order.dispatchSlip !== undefined && order.dispatchSlip !== null && String(order.dispatchSlip).trim() !== '');

  if (isDispatched) {
    if (order.size) {
      const rawSizes = String(order.size).split(',').map(s => s.trim()).filter(Boolean);
      sizesList.push(...rawSizes);
    }
  } else {
    if (Array.isArray(order.sizes) && order.sizes.length > 0) {
      if (typeof order.sizes[0] === 'object') {
        sizesList = order.sizes.map(s => s.size).filter(Boolean);
      } else {
        sizesList = order.sizes;
      }
    } else {
      if (order.size) {
        sizesList.push(order.size);
      }
      if (Array.isArray(order.additionalProducts)) {
        order.additionalProducts.forEach((p) => {
          if (p.size) sizesList.push(p.size);
        });
      }
      if (sizesList.length === 0) {
        sizesList = parseMultiple(order.size);
      }
    }
  }

  const formattedSizes = sizesList.map(part => {
    const normalized = String(part).replace(/[xX]/gu, ' X ').replace(/\s+/gu, ' ').trim();
    if (!/MM$/iu.test(normalized)) {
      return `${normalized.toUpperCase()} MM`;
    }
    return normalized.toUpperCase();
  });

  const displaySize = formattedSizes.join(', ') || '-';

  return (
    <div className="p-8 bg-white border border-slate-300 rounded-lg shadow-xl w-full max-w-sm mx-auto text-sm font-mono">
      <h3 className="text-center text-lg font-bold mb-4 border-b pb-2">DISPATCH SLIP (SIMULATED)</h3>
      <p className="text-xs text-slate-500 mb-4">Order ID: {order.id}</p>
      <div className="space-y-2">
        <div className="grid grid-cols-2"><span className="text-slate-600">Date / Invoice ID:</span><span className="font-bold text-slate-800">{order.orderDate} / {order.invoiceId || order.invoiceNumber || '-'}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">Consignee:</span><span className="font-bold text-slate-800">{order.consignee || order.client}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">Address:</span><span className="text-slate-800 break-words text-xs">{order.address || order.location}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">Vehicle No:</span><span className="font-bold text-slate-800">{order.vehicle}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">Driver:</span><span className="text-slate-800">{order.driverName || 'N/A'}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">Size:</span><span className="font-bold text-slate-800">{displaySize}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">Pieces Loaded:</span><span className="font-bold text-slate-800">{formatDispatchPieces(order)}</span></div>
        <div className="grid grid-cols-2"><span className="text-slate-600">CBM:</span><span className="font-bold text-slate-800">{formatDispatchValue(order)}</span></div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-600 mb-2">TIMING</h4>
        <div className="grid grid-cols-2 text-xs"><span className="text-slate-500">Load Start:</span><span className="font-semibold text-slate-700">{order.loadStartTime || '-'}</span></div>
        <div className="grid grid-cols-2 text-xs"><span className="text-slate-500">Load Finish:</span><span className="font-semibold text-slate-700">{order.loadFinishTime || '-'}</span></div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-200">
        <h4 className="text-xs font-bold text-slate-600 mb-2">WEIGHT DETAILS (Tons)</h4>
        <div className="grid grid-cols-3 text-xs"><span className="text-slate-500 font-bold">Gr. Wt.</span><span className="text-slate-500 font-bold">Tr. Wt.</span><span className="text-slate-500 font-bold">Nr. Wt.</span></div>
        <div className="grid grid-cols-3 font-bold text-sm"><span>{order.grossWeight || '-'}</span><span>{order.tareWeight || '-'}</span><span className="text-green-700">{order.netWt || '-'}</span></div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-200">
        <div className="grid grid-cols-2 text-xs"><span className="text-slate-600">Contact Person:</span><span className="font-bold text-slate-800">{order.contactPerson || '-'}</span></div>
        <div className="grid grid-cols-2 text-xs"><span className="text-slate-600">Driver Contact:</span><span className="font-bold text-slate-800">{order.driverContact || '-'}</span></div>
      </div>
    </div>
  );
};

export const ImportModal = ({ onClose, onImport }) => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');

  const handleFileChange = (e) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const processCSV = async () => {
    if (!file) return;
    setStatus('parsing');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = text.split('\n');
      const data = [];

      for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i].split(',').map((cell) => cell.trim());
        if (row.length < 5) continue;

        data.push({
          orderDate: row[0] || new Date().toISOString().split('T')[0],
          client: row[1] || 'Unknown',
          location: row[2] || '',
          vehicle: row[3] || '',
          transporter: row[4] || '',
          size: row[5] || SIZES[0],
          cbm: parseFloat(row[6]) || 0,
          rate: parseFloat(row[7]) || 0,
          status: 'Dispatched',
          createdAt: createTimestamp(),
          truckType: null,
          gsChecked: false,
          loadingRate: 0,
          unloadingRate: 0,
        });
      }

      onImport(data);
      setStatus('success');
    };

    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FileUp className="w-5 h-5" /> Import Data</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 mb-4">
          <strong>Instructions:</strong> Upload a CSV file with columns: <br />
          Date (YYYY-MM-DD), Client, Location, Vehicle, Transporter, Size, CBM, Rate
        </div>
        <input type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold text-sm">Cancel</button>
          <button onClick={processCSV} disabled={!file || status === 'parsing'} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
            {status === 'parsing' ? 'Processing...' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
      <div className="flex items-center gap-3 mb-4 text-red-600"><AlertTriangle className="w-6 h-6" /><h3 className="font-bold text-lg">{title}</h3></div>
      <p className="text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm">Delete</button>
      </div>
    </div>
  </div>
);

export const DocPreviewModal = ({ fileType, fileName, fileUrl, onClose, onApprove, canApprove, orderData }) => {
  const previewUrl = fileUrl || orderData?.invoiceUrl || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">{fileType === 'invoice' ? <FileText className="text-indigo-600" /> : <CheckCircle className="text-purple-600" />} Previewing: {fileName}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-start min-h-[300px] overflow-y-auto gap-4">
          {previewUrl ? (
            <iframe title={`Preview of ${fileName}`} src={previewUrl} className="w-full h-[65vh] rounded-lg border border-slate-200 bg-white shadow-md" />
          ) : fileType === 'slip' && orderData ? (
            <DispatchSlipContent order={orderData} />
          ) : (
            <div className="w-full h-[65vh] bg-white shadow-md border border-slate-200 rounded-lg flex items-center justify-center"><span className="text-sm text-slate-400 font-medium">Preview unavailable</span></div>
          )}
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-slate-500 text-sm">Document Preview Loaded</p>
            <p className="text-xs text-slate-400 break-all">{fileName}</p>
            {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">Open in new tab</a>}
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Close Preview</button>
          {canApprove && <button onClick={onApprove} className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Approve Document</button>}
        </div>
      </div>
    </div>
  );
};

export const MtcModal = ({ orderId, onClose, onGenerate }) => {
  // Utility functions for date handling
  const getTodayIso = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const subtractDaysIso = (isoDate, days) => {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const date = new Date(Date.UTC(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10),
      12,
      0,
      0,
    ));
    date.setUTCDate(date.getUTCDate() - days);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (isoDate) => {
    if (!isoDate) return '';
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  };

  const parseDisplayDate = (displayDate) => {
    if (!displayDate) return '';
    const match = displayDate.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (!match) return '';
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  };

  const issueDateIso = getTodayIso();
  const testingDateIso = subtractDaysIso(issueDateIso, 10);

  const [mtcForm, setMtcForm] = useState({
    issueDate: formatDateDisplay(issueDateIso),
    testingDate: formatDateDisplay(testingDateIso),
    requirementField1: '551-660',
    requirementField2: '>=4.0',
    dryDensity: '',
    compressiveStrength: '',
  });

  const [status, setStatus] = useState('idle');

  const handleGenerate = async () => {
    if (status === 'processing') return;

    // Validate required fields
    const issueDate = String(mtcForm.issueDate).trim();
    const testingDate = String(mtcForm.testingDate).trim();
    const dd = String(mtcForm.dryDensity).trim();
    const cs = String(mtcForm.compressiveStrength).trim();
    const req1 = String(mtcForm.requirementField1).trim();
    const req2 = String(mtcForm.requirementField2).trim();

    const missing = [];
    if (!issueDate) missing.push('Date of Issue');
    if (!testingDate) missing.push('Date of Testing');
    if (!req1) missing.push('Requirement Field 1');
    if (!req2) missing.push('Requirement Field 2');
    if (!dd) missing.push('Dry Density Result');
    if (!cs) missing.push('Compressive Strength Result');

    if (missing.length > 0) {
      window.alert(`Please fill the following required fields: ${missing.join(', ')}`);
      return;
    }

    if (isNaN(Number(dd)) || isNaN(Number(cs))) {
      window.alert('Dry Density and Compressive Strength must be numeric values.');
      return;
    }

    setStatus('processing');
    try {
      const testData = {
        issueDate: formatDateDisplay(parseDisplayDate(issueDate)),
        testingDate: formatDateDisplay(parseDisplayDate(testingDate)),
        dryDensityResult: dd,
        compressiveStrengthResult: cs,
        requirementField1: req1,
        requirementField2: req2,
      };
      await onGenerate(orderId, testData);
      setStatus('done');
    } catch (e) {
      console.error('MTC generation failed', e);
      window.alert(e?.message || 'Failed to generate MTC');
      setStatus('idle');
      return;
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
          <h3 className="font-bold text-blue-900 flex items-center gap-2"><FileText className="w-5 h-5" /> Generate Material Testing Certificate (MTC)</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-blue-400 hover:text-blue-600" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <h4 className="text-sm font-bold text-blue-700 border-b pb-1">TEST INFORMATION</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup label="Date of Issue">
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={mtcForm.issueDate}
                onChange={(e) => setMtcForm({ ...mtcForm, issueDate: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Date of Testing">
              <input
                type="text"
                placeholder="dd-mm-yyyy"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={mtcForm.testingDate}
                onChange={(e) => setMtcForm({ ...mtcForm, testingDate: e.target.value })}
              />
            </InputGroup>
          </div>

          <h4 className="text-sm font-bold text-blue-700 border-b pb-1 pt-2">REQUIREMENTS</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup label="Requirement Field 1">
              <input
                type="text"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={mtcForm.requirementField1}
                onChange={(e) => setMtcForm({ ...mtcForm, requirementField1: e.target.value })}
                placeholder="e.g. 551-660"
              />
            </InputGroup>
            <InputGroup label="Requirement Field 2">
              <input
                type="text"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={mtcForm.requirementField2}
                onChange={(e) => setMtcForm({ ...mtcForm, requirementField2: e.target.value })}
                placeholder="e.g. >=4.0"
              />
            </InputGroup>
          </div>

          <h4 className="text-sm font-bold text-blue-700 border-b pb-1 pt-2">TEST RESULTS</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputGroup label="Dry Density Result">
              <input
                type="text"
                inputMode="decimal"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={mtcForm.dryDensity}
                onChange={(e) => setMtcForm({ ...mtcForm, dryDensity: e.target.value })}
                placeholder="e.g. 620"
              />
            </InputGroup>
            <InputGroup label="Compressive Strength Result">
              <input
                type="text"
                inputMode="decimal"
                className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={mtcForm.compressiveStrength}
                onChange={(e) => setMtcForm({ ...mtcForm, compressiveStrength: e.target.value })}
                placeholder="e.g. 4.8"
              />
            </InputGroup>
          </div>

          <button type="submit" disabled={status === 'processing'} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-md mt-4">
            {status === 'processing' ? 'Generating MTC...' : 'Generate & Upload MTC'}
          </button>
        </form>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export const DispatchModal = ({ order, onClose, onSubmit, logs }) => {
  const normalizedTransporter = String(order.transporter || '').trim().toUpperCase();
  const isABC = normalizedTransporter.startsWith('ABC');
  const loadingStartLog = logs.find((log) => log.details.includes(`Updated Order ${order.id} to Loading`));
  const loadingFinishLog = logs.find((log) => log.details.includes(`Updated Order ${order.id} to Loading Complete`));

  const defaultStartTime = loadingStartLog?.timestamp
    ? new Date(loadingStartLog.timestamp.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const defaultFinishTime = loadingFinishLog?.timestamp
    ? new Date(loadingFinishLog.timestamp.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const parseMultiple = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && (val.includes(',') || val.startsWith('['))) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return val ? [String(val)] : [];
  };

  let sizesList = [];
  let cbmsList = [];

  if (Array.isArray(order.sizes) && order.sizes.length > 0) {
    if (typeof order.sizes[0] === 'object') {
      sizesList = order.sizes.map(s => s.size).filter(Boolean);
      cbmsList = order.sizes.map(s => s.cbm).filter(Boolean);
    } else {
      sizesList = order.sizes;
      cbmsList = parseMultiple(order.cbm);
    }
  } else {
    if (order.size) {
      sizesList.push(order.size);
    }
    if (order.cbm !== undefined && order.cbm !== null && String(order.cbm).trim() !== '') {
      cbmsList.push(order.cbm);
    }

    if (Array.isArray(order.additionalProducts)) {
      order.additionalProducts.forEach((p) => {
        if (p.size) sizesList.push(p.size);
        if (p.cbm !== undefined && p.cbm !== null && String(p.cbm).trim() !== '') {
          cbmsList.push(p.cbm);
        }
      });
    }

    if (sizesList.length === 0) {
      sizesList = parseMultiple(order.size);
    }
    if (cbmsList.length === 0) {
      cbmsList = parseMultiple(order.cbm);
    }
  }

  const isMultiSize = [...new Set(sizesList)].length > 1;
  const defaultSize = isMultiSize 
    ? [...new Set(sizesList.map(s => String(s).trim()).filter(Boolean))].join(', ')
    : (sizesList[0] || SIZES[3]);

  let defaultCbm = order.cbm || '';
  if (isMultiSize || cbmsList.length > 1) {
    const sumCbm = cbmsList.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    defaultCbm = sumCbm > 0 ? Number(sumCbm.toFixed(3)).toString() : '';
  } else if (cbmsList.length === 1) {
    defaultCbm = String(cbmsList[0]);
  }

  let defaultPieces = order.piecesLoaded;
  if (!defaultPieces) {
    if (isMultiSize && cbmsList.length > 0) {
      defaultPieces = sizesList.reduce((acc, size, idx) => {
        const cbmForSize = cbmsList[idx] || cbmsList[0] || 0;
        try {
          return acc + (parseInt(calculatePiecesLoaded(cbmForSize, size), 10) || 0);
        } catch {
          return acc;
        }
      }, 0);
    } else {
      defaultPieces = calculatePiecesLoaded(defaultCbm, defaultSize);
    }
  }

  const [dForm, setDForm] = useState({
    invoiceId: order.invoiceId || order.invoiceNumber || '',
    consignee: order.consignee || order.client || '',
    address: order.address || order.location || '',
    contactPerson: order.contactPerson || '',
    size: defaultSize,
    cbm: defaultCbm,
    piecesLoaded: defaultPieces || '',
    bjm: order.bjm || '',
    bjmRate: order.bjmRate || '',
    vehicle: order.vehicle || '',
    truckType: formatTruckTypeShort(order.truckType || order.vehicleType),
    transporter: order.transporter || '',
    driverName: order.driverName || '',
    driverContact: order.driverContact || '',
    loadStartTime: convertTimeTo24h(order.loadStartTime) || defaultStartTime,
    loadFinishTime: convertTimeTo24h(order.loadFinishTime) || defaultFinishTime,
    loadingBy: order.loadingBy || '',
    unloadingBy: order.unloadingBy || '',
    grossWeight: order.grossWeight || '',
    tareWeight: order.tareWeight || '',
    tripKm: order.tripKm || '',
    hsd: order.hsd || '',
  });

  const calculatedNetWt = (parseFloat(dForm.grossWeight) || 0) - (parseFloat(dForm.tareWeight) || 0);
  const getClassName = (fieldValue) => `w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 ${fieldValue ? 'bg-slate-100 border-slate-400 font-medium' : ''}`;

  const handleFormSubmit = (e) => {
    e.preventDefault();

    const timeTo12h = (time24h) => {
      if (!time24h) return '';
      const [h, m] = time24h.split(':');
      const hours = parseInt(h, 10);
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const displayHours = ((hours + 11) % 12) + 1;
      return `${displayHours}:${m} ${suffix}`;
    };

    const consigneeValue = String(dForm.consignee || '').trim() || String(order.consignee || order.client || '').trim();
    const addressValue = String(dForm.address || '').trim() || String(order.address || order.location || '').trim();
    const vehicleValue = String(dForm.vehicle || '').trim();
    const transporterValue = String(dForm.transporter || '').trim();
    const driverNameValue = String(dForm.driverName || '').trim();
    const loadingByValue = String(dForm.loadingBy || '').trim();
    const driverContactValue = String(dForm.driverContact || '').trim();
    const contactPersonValue = String(dForm.contactPerson || '').trim();
    const unloadingByValue = String(dForm.unloadingBy || '').trim();

    const missingTextFields = [
      ['Invoice ID', String(dForm.invoiceId || '').trim()],
      ['Consignee', consigneeValue],
      ['Address', addressValue],
      ['Vehicle Number', vehicleValue],
      ['Transporter', transporterValue],
      ['Driver Name', driverNameValue],
      ['Loading By', loadingByValue],
    ]
      .filter(([, value]) => !value)
      .map(([label]) => label);

    if (missingTextFields.length > 0) {
      window.alert(`${missingTextFields.join(', ')} are required before dispatch.`);
      return;
    }

    const toNumber = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const parsedTruckType = parseInt(String(dForm.truckType || '').replace(/\D/gu, ''), 10);
    const truckTypeValue = Number.isFinite(parsedTruckType)
      ? parsedTruckType
      : parseInt(String(order.truckType || order.vehicleType || '').replace(/\D/gu, ''), 10) || 0;

    const cbmValue = toNumber(dForm.cbm, toNumber(defaultCbm, 0));
    const piecesLoadedValue = toNumber(dForm.piecesLoaded, toNumber(defaultPieces || 0, 0));
    const bjmValue = toNumber(dForm.bjm, toNumber(order.bjm, 0));
    const bjmRateValue = toNumber(dForm.bjmRate, toNumber(order.bjmRate, 0));

    const finalData = {
      invoiceId: String(dForm.invoiceId || '').trim(),
      consignee: consigneeValue,
      address: addressValue,
      contactPerson: contactPersonValue,
      size: dForm.size,
      cbm: cbmValue,
      sizes: isMultiSize ? null : order.sizes,
      piecesLoaded: piecesLoadedValue,
      bjm: bjmValue,
      bjmRate: bjmRateValue,
      vehicle: vehicleValue,
      truckType: truckTypeValue,
      transporter: transporterValue,
      driverName: driverNameValue,
      driverContact: driverContactValue,
      loadStartTime: timeTo12h(dForm.loadStartTime),
      loadFinishTime: timeTo12h(dForm.loadFinishTime),
      loadingBy: loadingByValue,
      unloadingBy: isABC ? unloadingByValue : null,
      grossWeight: Number(dForm.grossWeight).toFixed(3),
      tareWeight: Number(dForm.tareWeight).toFixed(3),
      netWt: calculatedNetWt.toFixed(3),
      tripKm: isABC ? Number(dForm.tripKm) : null,
      hsd: isABC ? Number(dForm.hsd) : null,
    };

    onSubmit(order.id, finalData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50"><h3 className="font-bold text-purple-900 flex items-center gap-2"><Truck className="w-5 h-5" /> Generate Dispatch Slip & Dispatch</h3><button onClick={onClose}><X className="w-5 h-5 text-purple-400 hover:text-purple-600" /></button></div>
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {isABC && <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 mb-4"><p className="text-xs text-purple-700 font-bold flex items-center"><AlertTriangle className="w-3 h-3 mr-1" /> Transporter is ABC: Full HSD/KM log required.</p></div>}
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1">SHIPMENT DETAILS</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputGroup label="Invoice ID"><input required type="text" className={getClassName(dForm.invoiceId)} value={dForm.invoiceId} onChange={(e) => setDForm({ ...dForm, invoiceId: e.target.value })} placeholder="e.g. INV-2026-001" /></InputGroup>
            <InputGroup label="Consignee (P)"><input required type="text" className={getClassName(dForm.consignee)} value={dForm.consignee} onChange={(e) => setDForm({ ...dForm, consignee: e.target.value })} placeholder={order.client} /></InputGroup>
            <InputGroup label="Address (P)"><input required type="text" className={getClassName(dForm.address)} value={dForm.address} onChange={(e) => setDForm({ ...dForm, address: e.target.value })} placeholder={order.location} /></InputGroup>
            <InputGroup label="Contact Person"><input type="text" className={getClassName(dForm.contactPerson)} value={dForm.contactPerson} onChange={(e) => setDForm({ ...dForm, contactPerson: e.target.value })} placeholder="e.g. 7008..." /></InputGroup>
            {isMultiSize ? (
              <InputGroup label="AAC Size (P)"><input type="text" readOnly className={getClassName(dForm.size)} value={dForm.size} title={dForm.size} /></InputGroup>
            ) : (
              <InputGroup label="AAC Size (P)">
                <select className={getClassName(dForm.size)} value={dForm.size} onChange={(e) => setDForm({ ...dForm, size: e.target.value })}>
                  {[...new Set([...SIZES, dForm.size])].filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </InputGroup>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputGroup label="CBM (P)"><input required type="number" step="any" className={getClassName(dForm.cbm)} value={dForm.cbm} onChange={(e) => setDForm({ ...dForm, cbm: e.target.value })} /></InputGroup>
            <InputGroup label="Pieces Loaded"><input required type="number" step="any" className={getClassName(dForm.piecesLoaded)} value={dForm.piecesLoaded} onChange={(e) => setDForm({ ...dForm, piecesLoaded: e.target.value })} placeholder={defaultPieces} /></InputGroup>
            <InputGroup label="BJM Bags (P)"><input required type="number" step="any" className={getClassName(dForm.bjm)} value={dForm.bjm} onChange={(e) => setDForm({ ...dForm, bjm: e.target.value })} placeholder={order.bjm} /></InputGroup>
            <InputGroup label="BJM Rate"><input required type="number" step="any" className={getClassName(dForm.bjmRate)} value={dForm.bjmRate} onChange={(e) => setDForm({ ...dForm, bjmRate: e.target.value })} placeholder={order.bjmRate || '0'} /></InputGroup>
          </div>
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">VEHICLE DETAILS</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputGroup label="Vehicle No (P)"><input required type="text" className={getClassName(dForm.vehicle)} value={dForm.vehicle} onChange={(e) => setDForm({ ...dForm, vehicle: e.target.value })} placeholder={order.vehicle} /></InputGroup>
            <InputGroup label="Truck Type"><div className="relative"><input required type="text" inputMode="decimal" className={getClassName(dForm.truckType)} value={dForm.truckType} onChange={(e) => setDForm({ ...dForm, truckType: e.target.value })} placeholder="e.g. 12" /><span className="absolute right-3 top-2.5 text-slate-400 font-bold text-sm">W</span></div></InputGroup>
            <InputGroup label="Transporter (P)"><input required type="text" className={getClassName(dForm.transporter)} value={dForm.transporter} onChange={(e) => setDForm({ ...dForm, transporter: e.target.value })} placeholder={order.transporter} /></InputGroup>
            <InputGroup label="Driver Name"><input required type="text" pattern="[A-Za-z\s]+" title="Only alphabets and spaces are allowed" className={getClassName(dForm.driverName)} value={dForm.driverName} onChange={(e) => setDForm({ ...dForm, driverName: e.target.value })} placeholder="Driver" /></InputGroup>
          </div>
          <div className="max-w-md"><InputGroup label="Driver Contact"><input type="text" pattern="[0-9]+" title="Only numbers are allowed" className={getClassName(dForm.driverContact)} value={dForm.driverContact} onChange={(e) => setDForm({ ...dForm, driverContact: e.target.value })} placeholder="e.g. 9348..." /></InputGroup></div>
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">TIMING & PERSONNEL</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputGroup label="Load Start Time"><input required type="time" className={getClassName(dForm.loadStartTime)} value={dForm.loadStartTime} onChange={(e) => setDForm({ ...dForm, loadStartTime: e.target.value })} /></InputGroup>
            <InputGroup label="Load Finish Time"><input required type="time" className={getClassName(dForm.loadFinishTime)} value={dForm.loadFinishTime} onChange={(e) => setDForm({ ...dForm, loadFinishTime: e.target.value })} /></InputGroup>
            <InputGroup label="Loading By"><input required type="text" pattern="[A-Za-z\s]+" title="Only alphabets and spaces are allowed" className={getClassName(dForm.loadingBy)} value={dForm.loadingBy} onChange={(e) => setDForm({ ...dForm, loadingBy: e.target.value })} placeholder="Labor Name" /></InputGroup>
            {isABC && <InputGroup label="Unloading By"><input type="text" pattern="[A-Za-z\s]+" title="Only alphabets and spaces are allowed" className={getClassName(dForm.unloadingBy)} value={dForm.unloadingBy} onChange={(e) => setDForm({ ...dForm, unloadingBy: e.target.value })} placeholder="Labor Name" /></InputGroup>}
          </div>
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">WEIGHTS (Tons)</h4>
          <div className="grid grid-cols-3 gap-4">
            <InputGroup label="Gross Weight (Gr. Wt.)"><input required type="number" step="any" className={getClassName(dForm.grossWeight)} value={dForm.grossWeight} onChange={(e) => setDForm({ ...dForm, grossWeight: e.target.value })} placeholder="e.g. 28.510" /></InputGroup>
            <InputGroup label="Tare Weight (Tr. Wt.)"><input required type="number" step="any" className={getClassName(dForm.tareWeight)} value={dForm.tareWeight} onChange={(e) => setDForm({ ...dForm, tareWeight: e.target.value })} placeholder="e.g. 9.260" /></InputGroup>
            <InputGroup label="Net Weight (Nr. Wt.)"><input readOnly type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-green-50 text-green-700 font-bold" value={calculatedNetWt.toFixed(3)} /></InputGroup>
          </div>
          {isABC && <div className="animate-in fade-in slide-in-from-top-2"><h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">TRIP LOG (ABC ONLY)</h4><div className="grid grid-cols-2 gap-4 max-w-lg"><InputGroup label="Trip KM"><input required type="number" step="any" className={getClassName(dForm.tripKm)} value={dForm.tripKm} onChange={(e) => setDForm({ ...dForm, tripKm: e.target.value })} placeholder="0" /></InputGroup><InputGroup label="HSD (Litres)"><input required type="number" step="any" className={getClassName(dForm.hsd)} value={dForm.hsd} onChange={(e) => setDForm({ ...dForm, hsd: e.target.value })} placeholder="0.00" /></InputGroup></div></div>}
          <button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-md mt-4">Confirm Dispatch & Generate Slip</button>
        </form>
      </div>
    </div>
  );
};

