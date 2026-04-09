import React, { useState } from 'react';
import { 
  Package, Truck, FileText, LogOut, Plus, DollarSign, Briefcase, Calendar, BarChart3, 
  Search, ChevronLeft, ChevronRight, X, AlertTriangle, CheckCircle, Eye, Pencil, Trash2,
  ArrowRight, LayoutGrid, FileSpreadsheet, Fuel, ClipboardList, ScrollText, 
  Layers, Boxes, Download, Factory, AlertCircle, ShieldCheck, Users, Scale
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Card, StatCard, InputGroup, StatusBadge } from './components/ui/UIComponents';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { ImportModal } from './components/modals/ImportModal';
import { initializeTestData } from './utils/localStorage';
import { 
  getTodayString, 
  formatDateDisplay, 
  formatDateTimeDisplay,
} from './utils/helpers';
import { 
  SIZES, 
  LOADING_STATUSES, 
  RATE_CARD, 
  GS_SURCHARGE,
  RAW_MATERIALS_LIST,
  FINISHED_STOCK_SIZES 
} from './utils/constants';
import './index.css';

// Modals
const DocPreviewModal = ({ fileType, fileName, canApprove, onClose, onApprove, orderData }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">{fileType === 'slip' ? 'Dispatch Slip' : 'Tax Invoice'}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-slate-400"/></button>
      </div>
      <div className="bg-slate-100 rounded-lg p-6 text-center mb-4">
        <FileText className="w-16 h-16 mx-auto text-slate-400 mb-2"/>
        <p className="text-sm font-mono">{fileName}</p>
        <p className="text-xs text-slate-400 mt-1">Preview not available in local mode</p>
      </div>
      {orderData && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <h4 className="font-bold text-sm mb-2">Order Details:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-blue-600">Client:</span> {orderData.client}</div>
            <div><span className="text-blue-600">Vehicle:</span> {orderData.vehicle}</div>
            <div><span className="text-blue-600">CBM:</span> {orderData.cbm}</div>
            <div><span className="text-blue-600">Rate:</span> ₹{orderData.rate}</div>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Close</button>
        {canApprove && <button onClick={onApprove} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700">Approve</button>}
      </div>
    </div>
  </div>
);

const DispatchModal = ({ order, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    netWt: order.netWt || '',
    grossWeight: order.grossWeight || '',
    tareWeight: order.tareWeight || '',
    loadingBy: order.loadingBy || '',
    unloadingBy: order.unloadingBy || '',
    driverName: order.driverName || '',
    tripKm: order.tripKm || '',
    hsd: order.hsd || ''
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Truck className="w-5 h-5"/> Dispatch Truck</h3>
          <button onClick={onClose}><X className="w-5 h-5"/></button>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg mb-4">
          <p className="font-bold">{order.client}</p>
          <p className="text-sm text-purple-600">{order.vehicle} • {order.cbm} CBM</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(order.id, formData); }} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <InputGroup label="Net Wt (kg)">
              <input type="number" step="0.001" required className="w-full p-2 border rounded-lg" value={formData.netWt} onChange={e => setFormData({...formData, netWt: e.target.value})} />
            </InputGroup>
            <InputGroup label="Gross Wt (kg)">
              <input type="number" step="0.001" className="w-full p-2 border rounded-lg" value={formData.grossWeight} onChange={e => setFormData({...formData, grossWeight: e.target.value})} />
            </InputGroup>
            <InputGroup label="Tare Wt (kg)">
              <input type="number" step="0.001" className="w-full p-2 border rounded-lg" value={formData.tareWeight} onChange={e => setFormData({...formData, tareWeight: e.target.value})} />
            </InputGroup>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Loading By">
              <input type="text" required className="w-full p-2 border rounded-lg" value={formData.loadingBy} onChange={e => setFormData({...formData, loadingBy: e.target.value})} />
            </InputGroup>
            <InputGroup label="Unloading By">
              <input type="text" className="w-full p-2 border rounded-lg" value={formData.unloadingBy} onChange={e => setFormData({...formData, unloadingBy: e.target.value})} />
            </InputGroup>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <InputGroup label="Driver Name">
              <input type="text" className="w-full p-2 border rounded-lg" value={formData.driverName} onChange={e => setFormData({...formData, driverName: e.target.value})} />
            </InputGroup>
            <InputGroup label="Trip KM">
              <input type="number" className="w-full p-2 border rounded-lg" value={formData.tripKm} onChange={e => setFormData({...formData, tripKm: e.target.value})} />
            </InputGroup>
            <InputGroup label="HSD (Litres)">
              <input type="number" className="w-full p-2 border rounded-lg" value={formData.hsd} onChange={e => setFormData({...formData, hsd: e.target.value})} />
            </InputGroup>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700">Dispatch</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const RoleSelection = ({ onRoleSelect }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-6">
      <div className="text-center">
        <div className="bg-blue-600 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-blue-200 shadow-xl">
          <Package className="text-white w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">AAC Plant Manager</h1>
        <p className="text-slate-500 mt-2">Select your department</p>
      </div>
      <div className="grid gap-3">
        <button onClick={() => onRoleSelect('sales')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
          <div className="bg-blue-100 p-2 rounded-lg"><Briefcase className="text-blue-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Sales Team</p></div>
        </button>
        <button onClick={() => onRoleSelect('loading')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover;border-orange-500 hover:bg-orange-50 transition-all group">
          <div className="bg-orange-100 p-2 rounded-lg"><Truck className="text-orange-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Loading Team</p></div>
        </button>
        <button onClick={() => onRoleSelect('production')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover;border-cyan-500 hover:bg-cyan-50 transition-all group">
          <div className="bg-cyan-100 p-2 rounded-lg"><Calendar className="text-cyan-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Production Team</p></div>
        </button>
        <button onClick={() => onRoleSelect('accounts')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover;border-green-500 hover:bg-green-50 transition-all group">
          <div className="bg-green-100 p-2 rounded-lg"><DollarSign className="text-green-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Accounts</p></div>
        </button>
        <button onClick={() => onRoleSelect('management')} className="flex items-center p-4 border-2 border-slate-100 rounded-xl hover;border-purple-500 hover:bg-purple-50 transition-all group">
          <div className="bg-purple-100 p-2 rounded-lg"><BarChart3 className="text-purple-600 w-5 h-5" /></div>
          <div className="ml-4 text-left"><p className="font-bold text-slate-700">Management</p></div>
        </button>
      </div>
    </div>
  </div>
);
