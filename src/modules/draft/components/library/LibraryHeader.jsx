import React from 'react';
import { FolderPlus, ChevronLeft } from 'lucide-react';

/**
 * @file LibraryHeader.jsx
 * @description Program Kütüphanesi üst başlığı ve kapalı moddaki açma butonu.
 */
export const LibraryClosedButton = () => null;

export const LibraryHeader = ({ programCount = 0, onToggle }) => (
  <div style={{
    padding: '9px 12px',
    background: 'var(--bg-tertiary)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '26px',
        height: '26px',
        borderRadius: '7px',
        background: 'var(--accent-primary)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)'
      }}>
        <FolderPlus size={14} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
          Program Kütüphanesi
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
          ({programCount})
        </span>
      </div>
    </div>

    <button
      type="button"
      onClick={onToggle}
      title="Paneli Kapat"
      style={{
        background: 'transparent',
        border: 'none',
        padding: '4px',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
    >
      <ChevronLeft size={18} />
    </button>
  </div>
);

export default LibraryHeader;
