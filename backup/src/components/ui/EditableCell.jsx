import React, { useState, useEffect, useRef } from 'react';

export const EditableCell = ({ 
  value, 
  onUpdate, 
  type = "text", 
  className = "", 
  inputMode = "text", 
  tableId, 
  rowIndex, 
  colIndex 
}) => {
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
    if (localValue !== value) {
      onUpdate(localValue);
    }
  };

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter') {
      finishEditing();
      navigateGrid('ArrowDown');
    }
  };

  const navigateGrid = (direction) => {
    if (!tableId) return;
    let nextRow = rowIndex;
    let nextCol = colIndex;
    
    if (direction === 'ArrowUp') nextRow--;
    if (direction === 'ArrowDown') nextRow++;
    if (direction === 'ArrowLeft') nextCol--;
    if (direction === 'ArrowRight') nextCol++;
    
    const nextCell = document.querySelector(`div[data-cell="${tableId}-${nextRow}-${nextCol}"]`);
    if (nextCell) {
      nextCell.focus();
      nextCell.click();
    }
  };

  const handleKeyDownDiv = (e) => {
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
      onClick={() => setIsEditing(true)}
      onKeyDown={handleKeyDownDiv}
      className={`w-full h-full px-1 py-3 cursor-text hover:bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded transition-colors font-bold text-sm text-slate-700 leading-relaxed ${className} flex items-center justify-end`}
    >
      {value || (value === 0 ? '0' : '')}
    </div>
  );
};
