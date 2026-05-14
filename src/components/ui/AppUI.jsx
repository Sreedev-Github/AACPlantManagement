import React, { useEffect, useRef, useState } from 'react';

export const StatusBadge = ({ status }) => {
  const normalizedStatus = String(status || 'Unknown');
  let label = normalizedStatus.toUpperCase();
  let style = 'bg-gray-100 text-gray-800 border-gray-200';

  if (normalizedStatus === 'Awaiting Truck') style = 'bg-yellow-50 text-yellow-700 border-yellow-200';
  else if (normalizedStatus === 'Truck at Site') style = 'bg-orange-50 text-orange-700 border-orange-200';
  else if (normalizedStatus === 'Loading') style = 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
  else if (normalizedStatus === 'Loading Complete') {
    label = 'LOADING COMPLETE - Awaiting Bill';
    style = 'bg-red-50 text-red-700 border-red-200 font-bold';
  } else if (normalizedStatus === 'Invoiced') {
    label = 'LOADING COMPLETE - Checking Bill';
    style = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (normalizedStatus === 'Approved') {
    label = 'LOADING COMPLETE - Invoice Received';
    style = 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
  } else if (normalizedStatus === 'Dispatched') {
    label = 'DISPATCHED';
    style = 'bg-slate-800 text-white border-slate-800';
  }

  return <span className={`px-3 py-1 rounded-full text-[10px] font-bold border tracking-wide text-center ${style}`}>{label}</span>;
};

export const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
    {children}
  </div>
);

export const StatCard = ({ label, value, icon: Icon, colorClass, onClick }) => (
  <Card className={`p-4 flex items-center space-x-4 border-l-4 ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`} style={{ borderLeftColor: 'currentColor' }} onClick={onClick}>
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
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

export const EditableCell = ({ value, onUpdate, type = 'text', className = '', inputMode = 'text', tableId, rowIndex, colIndex, readOnly = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');
  const inputRef = useRef(null);
  const cellRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    if (inputMode === 'decimal') {
      if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
        setLocalValue(newValue);
      }
    } else {
      setLocalValue(newValue);
    }
  };

  const finishEditing = () => {
    setIsEditing(false);
    if (!readOnly && localValue !== value) {
      onUpdate(localValue);
    }
  };

  const navigateGrid = (direction) => {
    if (!tableId) return;
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (direction === 'ArrowUp') nextRow -= 1;
    if (direction === 'ArrowDown') nextRow += 1;
    if (direction === 'ArrowLeft') nextCol -= 1;
    if (direction === 'ArrowRight') nextCol += 1;

    const nextCell = document.querySelector(`div[data-cell="${tableId}-${nextRow}-${nextCol}"]`);
    if (nextCell) {
      nextCell.focus();
      nextCell.click();
    }
  };

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter') {
      finishEditing();
      navigateGrid('ArrowDown');
    }
  };

  const handleKeyDownDiv = (e) => {
    if (readOnly) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(true);
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      navigateGrid(e.key);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        inputMode={inputMode}
        className={`w-full h-full bg-white border border-blue-500 outline-none font-bold text-sm text-slate-800 px-2 py-1 rounded shadow-sm ${className}`}
        value={localValue}
        onChange={handleChange}
        onBlur={finishEditing}
        onKeyDown={handleKeyDownInput}
      />
    );
  }

  return (
    <div
      ref={cellRef}
      tabIndex={0}
      data-cell={`${tableId}-${rowIndex}-${colIndex}`}
      onClick={() => { if (!readOnly) setIsEditing(true); }}
      onKeyDown={handleKeyDownDiv}
      className={`w-full h-full px-1 py-3 ${readOnly ? 'cursor-default' : 'cursor-text hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300'} rounded transition-colors font-bold text-sm text-slate-700 leading-relaxed ${className} flex items-center justify-end`}
    >
      {value || (value === 0 ? '0' : '')}
    </div>
  );
};
