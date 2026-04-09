import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export const ConfirmModal = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
      <div className="flex items-center gap-3 mb-4 text-red-600">
        <AlertTriangle className="w-6 h-6" />
        <h3 className="font-bold text-lg">{title}</h3>
      </div>
      <p className="text-slate-600 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button 
          onClick={onCancel} 
          className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          Cancel
        </button>
        <button 
          onClick={onConfirm} 
          className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);
