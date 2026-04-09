import React from 'react';

export const StatusBadge = ({ status }) => {
  let label = status.toUpperCase();
  let style = 'bg-gray-100 text-gray-800 border-gray-200';
  
  if (status === 'Awaiting Truck') {
    style = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  } else if (status === 'Truck at Site') {
    style = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (status === 'Loading') {
    style = 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
  } else if (status === 'Loading Complete') {
    label = "LOADING COMPLETE - Awaiting Bill";
    style = 'bg-red-50 text-red-700 border-red-200 font-bold';
  } else if (status === 'Invoiced') {
    label = "LOADING COMPLETE - Checking Bill";
    style = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (status === 'Approved') {
    label = "LOADING COMPLETE - Invoice Received";
    style = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
  } else if (status === 'Dispatched') {
    label = "DISPATCHED";
    style = 'bg-slate-800 text-white border-slate-800';
  }
  
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold border tracking-wide text-center ${style}`}>
      {label}
    </span>
  );
};

export const Card = ({ children, className = "", onClick }) => (
  <div 
    onClick={onClick} 
    className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
  >
    {children}
  </div>
);

export const StatCard = ({ label, value, icon: Icon, colorClass, onClick }) => (
  <Card 
    className={`p-4 flex items-center space-x-4 border-l-4 ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`} 
    style={{ borderLeftColor: 'currentColor' }} 
    onClick={onClick}
  >
    <div className={`p-3 rounded-lg ${colorClass} bg-opacity-20`}>
      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </Card>
);

export const InputGroup = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
      {label}
    </label>
    {children}
  </div>
);
