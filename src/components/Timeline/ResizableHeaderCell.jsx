/**
 * @file src/components/Timeline/ResizableHeaderCell.jsx
 * @description Akış tablolarında (Rundown) sütun genişliklerini fare ile sürükleyerek yeniden boyutlandırmayı sağlayan başlık hücresi.
 */
import React, { useRef, useState } from 'react';

const ResizableHeaderCell = ({ column, onResize }) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = column.width;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(30, startWidthRef.current + deltaX); // Min width 30px
      onResize(column.id, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  if (column.width === -1 || column.resizable === false) {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%', width: '100%', justifyContent: 'center' }}>
        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {column.label}
        </div>
        {/* Visible divider even for non-resizable columns (except last maybe, but it's okay) */}
        <div style={{ position: 'absolute', right: 0, width: '1px', height: '16px', background: 'var(--border-color)' }}></div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%', width: '100%', justifyContent: 'center' }}>
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {column.label}
      </div>
      <div 
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: '-8px',
          top: '-12px',
          bottom: '-12px',
          width: '16px',
          cursor: 'col-resize',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div style={{ 
          width: isResizing ? '3px' : '1px', 
          height: '16px', 
          background: isResizing ? 'var(--accent-primary)' : 'var(--border-color)', 
          borderRadius: '1px',
          transition: 'all 0.1s'
        }}></div>
      </div>
    </div>
  );
};

export default ResizableHeaderCell;
