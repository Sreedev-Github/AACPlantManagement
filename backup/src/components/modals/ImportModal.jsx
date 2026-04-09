import React, { useState } from 'react';
import { X, FileUp } from 'lucide-react';
import { SIZES } from '../../utils/constants';

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
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split(',').map(cell => cell.trim());
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
          truckType: null,
          gsChecked: false,
          loadingRate: 0,
          unloadingRate: 0
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
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FileUp className="w-5 h-5"/> Import Data
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400"/>
          </button>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 mb-4">
          <strong>Instructions:</strong> Upload a CSV file with columns: <br/> 
          Date (YYYY-MM-DD), Client, Location, Vehicle, Transporter, Size, CBM, Rate
        </div>
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileChange} 
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold text-sm">
            Cancel
          </button>
          <button 
            onClick={processCSV} 
            disabled={!file || status === 'parsing'} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'parsing' ? 'Processing...' : 'Start Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
