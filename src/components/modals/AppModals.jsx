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
import { calculatePiecesLoaded, convertTimeTo24h, createTimestamp } from '../../utils/appHelpers';
import { InputGroup } from '../ui/AppUI';

const DispatchSlipContent = ({ order }) => (
  <div className="p-8 bg-white border border-slate-300 rounded-lg shadow-xl w-full max-w-sm mx-auto text-sm font-mono">
    <h3 className="text-center text-lg font-bold mb-4 border-b pb-2">DISPATCH SLIP (SIMULATED)</h3>
    <p className="text-xs text-slate-500 mb-4">Order ID: {order.id}</p>
    <div className="space-y-2">
      <div className="grid grid-cols-2"><span className="text-slate-600">Date:</span><span className="font-bold text-slate-800">{order.orderDate}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">Consignee:</span><span className="font-bold text-slate-800">{order.consignee || order.client}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">Address:</span><span className="text-slate-800 break-words text-xs">{order.address || order.location}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">Vehicle No:</span><span className="font-bold text-slate-800">{order.vehicle}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">Driver:</span><span className="text-slate-800">{order.driverName || 'N/A'}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">Pieces Loaded:</span><span className="font-bold text-slate-800">{order.piecesLoaded || 'N/A'}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">CBM:</span><span className="font-bold text-slate-800">{order.cbm}</span></div>
      <div className="grid grid-cols-2"><span className="text-slate-600">BJM Bags:</span><span className="font-bold text-slate-800">{order.bjm || 'N/A'}</span></div>
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
          {fileType === 'slip' && orderData ? (
            <DispatchSlipContent order={orderData} />
          ) : previewUrl ? (
            <iframe title={`Preview of ${fileName}`} src={previewUrl} className="w-full h-[65vh] rounded-lg border border-slate-200 bg-white shadow-md" />
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

export const DispatchModal = ({ order, onClose, onSubmit, logs }) => {
  const isABC = order.transporter && order.transporter.toUpperCase() === 'ABC';
  const loadingStartLog = logs.find((log) => log.details.includes(`Updated Order ${order.id} to Loading`));
  const loadingFinishLog = logs.find((log) => log.details.includes(`Updated Order ${order.id} to Loading Complete`));

  const defaultStartTime = loadingStartLog?.timestamp
    ? new Date(loadingStartLog.timestamp.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const defaultFinishTime = loadingFinishLog?.timestamp
    ? new Date(loadingFinishLog.timestamp.seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const defaultPieces = order.piecesLoaded || calculatePiecesLoaded(order.cbm, order.size);

  const [dForm, setDForm] = useState({
    consignee: order.consignee || order.client || '',
    address: order.address || order.location || '',
    contactPerson: order.contactPerson || '',
    size: order.size || SIZES[3],
    cbm: order.cbm || '',
    piecesLoaded: defaultPieces,
    bjm: order.bjm || '',
    bjmRate: order.bjmRate || '',
    vehicle: order.vehicle || '',
    truckType: order.truckType || '',
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

    const finalData = {
      consignee: dForm.consignee,
      address: dForm.address,
      contactPerson: dForm.contactPerson,
      size: dForm.size,
      cbm: Number(dForm.cbm),
      piecesLoaded: Number(dForm.piecesLoaded),
      bjm: Number(dForm.bjm),
      bjmRate: Number(dForm.bjmRate),
      vehicle: dForm.vehicle,
      truckType: Number(dForm.truckType),
      transporter: dForm.transporter,
      driverName: dForm.driverName,
      driverContact: dForm.driverContact,
      loadStartTime: timeTo12h(dForm.loadStartTime),
      loadFinishTime: timeTo12h(dForm.loadFinishTime),
      loadingBy: dForm.loadingBy,
      unloadingBy: isABC ? dForm.unloadingBy : null,
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
            <InputGroup label="Consignee (P)"><input required type="text" className={getClassName(dForm.consignee)} value={dForm.consignee} onChange={(e) => setDForm({ ...dForm, consignee: e.target.value })} placeholder={order.client} /></InputGroup>
            <InputGroup label="Address (P)"><input required type="text" className={getClassName(dForm.address)} value={dForm.address} onChange={(e) => setDForm({ ...dForm, address: e.target.value })} placeholder={order.location} /></InputGroup>
            <InputGroup label="Contact Person"><input type="text" className={getClassName(dForm.contactPerson)} value={dForm.contactPerson} onChange={(e) => setDForm({ ...dForm, contactPerson: e.target.value })} placeholder="e.g. 7008..." /></InputGroup>
            <InputGroup label="AAC Size (P)"><select className={getClassName(dForm.size)} value={dForm.size} onChange={(e) => setDForm({ ...dForm, size: e.target.value })}>{SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</select></InputGroup>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputGroup label="CBM (P)"><input required type="text" inputMode="decimal" className={getClassName(dForm.cbm)} value={dForm.cbm} onChange={(e) => setDForm({ ...dForm, cbm: e.target.value })} /></InputGroup>
            <InputGroup label="Pieces Loaded"><input required type="text" inputMode="decimal" className={getClassName(dForm.piecesLoaded)} value={dForm.piecesLoaded} onChange={(e) => setDForm({ ...dForm, piecesLoaded: e.target.value })} placeholder={defaultPieces} /></InputGroup>
            <InputGroup label="BJM Bags (P)"><input required type="text" inputMode="decimal" className={getClassName(dForm.bjm)} value={dForm.bjm} onChange={(e) => setDForm({ ...dForm, bjm: e.target.value })} placeholder={order.bjm} /></InputGroup>
            <InputGroup label="BJM Rate"><input required type="text" inputMode="decimal" className={getClassName(dForm.bjmRate)} value={dForm.bjmRate} onChange={(e) => setDForm({ ...dForm, bjmRate: e.target.value })} placeholder={order.bjmRate || '0'} /></InputGroup>
          </div>
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">VEHICLE DETAILS</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputGroup label="Vehicle No (P)"><input required type="text" className={getClassName(dForm.vehicle)} value={dForm.vehicle} onChange={(e) => setDForm({ ...dForm, vehicle: e.target.value })} placeholder={order.vehicle} /></InputGroup>
            <InputGroup label="Truck Type"><div className="relative"><input required type="text" inputMode="decimal" className={getClassName(dForm.truckType)} value={dForm.truckType} onChange={(e) => setDForm({ ...dForm, truckType: e.target.value })} placeholder="e.g. 12" /><span className="absolute right-3 top-2.5 text-slate-400 font-bold text-sm">W</span></div></InputGroup>
            <InputGroup label="Transporter (P)"><input required type="text" className={getClassName(dForm.transporter)} value={dForm.transporter} onChange={(e) => setDForm({ ...dForm, transporter: e.target.value })} placeholder={order.transporter} /></InputGroup>
            <InputGroup label="Driver Name"><input required type="text" className={getClassName(dForm.driverName)} value={dForm.driverName} onChange={(e) => setDForm({ ...dForm, driverName: e.target.value })} placeholder="Driver" /></InputGroup>
          </div>
          <div className="max-w-md"><InputGroup label="Driver Contact"><input type="text" className={getClassName(dForm.driverContact)} value={dForm.driverContact} onChange={(e) => setDForm({ ...dForm, driverContact: e.target.value })} placeholder="e.g. 9348..." /></InputGroup></div>
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">TIMING & PERSONNEL</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InputGroup label="Load Start Time"><input required type="time" className={getClassName(dForm.loadStartTime)} value={dForm.loadStartTime} onChange={(e) => setDForm({ ...dForm, loadStartTime: e.target.value })} /></InputGroup>
            <InputGroup label="Load Finish Time"><input required type="time" className={getClassName(dForm.loadFinishTime)} value={dForm.loadFinishTime} onChange={(e) => setDForm({ ...dForm, loadFinishTime: e.target.value })} /></InputGroup>
            <InputGroup label="Loading By"><input required type="text" className={getClassName(dForm.loadingBy)} value={dForm.loadingBy} onChange={(e) => setDForm({ ...dForm, loadingBy: e.target.value })} placeholder="Labor Name" /></InputGroup>
            {isABC && <InputGroup label="Unloading By (ABC Only)"><input type="text" className={getClassName(dForm.unloadingBy)} value={dForm.unloadingBy} onChange={(e) => setDForm({ ...dForm, unloadingBy: e.target.value })} placeholder="Labor Name" /></InputGroup>}
          </div>
          <h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">WEIGHTS (Tons)</h4>
          <div className="grid grid-cols-3 gap-4">
            <InputGroup label="Gross Weight (Gr. Wt.)"><input required type="text" inputMode="decimal" className={getClassName(dForm.grossWeight)} value={dForm.grossWeight} onChange={(e) => setDForm({ ...dForm, grossWeight: e.target.value })} placeholder="e.g. 28.510" /></InputGroup>
            <InputGroup label="Tare Weight (Tr. Wt.)"><input required type="text" inputMode="decimal" className={getClassName(dForm.tareWeight)} value={dForm.tareWeight} onChange={(e) => setDForm({ ...dForm, tareWeight: e.target.value })} placeholder="e.g. 9.260" /></InputGroup>
            <InputGroup label="Net Weight (Nr. Wt.)"><input readOnly type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-green-50 text-green-700 font-bold" value={calculatedNetWt.toFixed(3)} /></InputGroup>
          </div>
          {isABC && <div className="animate-in fade-in slide-in-from-top-2"><h4 className="text-sm font-bold text-purple-700 border-b pb-1 pt-2">TRIP LOG (ABC ONLY)</h4><div className="grid grid-cols-2 gap-4 max-w-lg"><InputGroup label="Trip KM"><input required type="text" inputMode="decimal" className={getClassName(dForm.tripKm)} value={dForm.tripKm} onChange={(e) => setDForm({ ...dForm, tripKm: e.target.value })} placeholder="0" /></InputGroup><InputGroup label="HSD (Litres)"><input required type="text" className={getClassName(dForm.hsd)} value={dForm.hsd} onChange={(e) => setDForm({ ...dForm, hsd: e.target.value })} placeholder="0.00" /></InputGroup></div></div>}
          <button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-md mt-4">Confirm Dispatch & Generate Slip</button>
        </form>
      </div>
    </div>
  );
};
