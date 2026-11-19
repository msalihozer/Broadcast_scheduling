/**
 * @file src/modules/broadcast/components/sidebar/DraftSidebarTopHeader.jsx
 * @description Sol Taslak & Klip Arama panelinin sadeleştirilmiş tek satırlık üst sekme çubuğu.
 */
import React, { memo } from 'react';
import { FileSpreadsheet, Film, Sparkles, Maximize2, Minimize2, X } from 'lucide-react';

const DraftSidebarTopHeader = memo(function DraftSidebarTopHeader({
  activeSidebarTab = 'draft',
  setActiveSidebarTab,
  draftProgramsCount = 0,
  fillerSlotsCount = 0,
  hasActiveFiller = false,
  isWide = false,
  onToggleWideMode,
  onCloseSidebar
}) {
  return (
    <div
      style={{
        padding: '7px 10px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '5px'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          background: 'var(--bg-primary)',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          flex: 1,
          minWidth: 0
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSidebarTab('draft')}
          style={{
            flex: 1,
            padding: '5px 6px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            background: activeSidebarTab === 'draft' ? 'var(--accent-primary)' : 'transparent',
            color: activeSidebarTab === 'draft' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          <FileSpreadsheet size={13} />
          <span>Taslak ({draftProgramsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSidebarTab('clip_search')}
          style={{
            flex: 1,
            padding: '5px 6px',
            borderRadius: '6px',
            border: 'none',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            background: activeSidebarTab === 'clip_search' ? '#0d9488' : 'transparent',
            color: activeSidebarTab === 'clip_search' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          <Film size={13} />
          <span>Klipler</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSidebarTab('filler')}
          style={{
            flex: 1,
            padding: '5px 6px',
            borderRadius: '6px',
            border: hasActiveFiller && activeSidebarTab !== 'filler' ? '1px solid #8b5cf6' : 'none',
            fontSize: '11.5px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
            background: activeSidebarTab === 'filler'
              ? '#8b5cf6'
              : hasActiveFiller
              ? 'rgba(139, 92, 246, 0.14)'
              : 'transparent',
            color: activeSidebarTab === 'filler'
              ? '#fff'
              : hasActiveFiller
              ? '#8b5cf6'
              : 'var(--text-secondary)'
          }}
        >
          <Sparkles size={13} />
          <span>Dolgu Kuşağı{fillerSlotsCount > 0 ? ` (${fillerSlotsCount})` : ''}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleWideMode}
        title={isWide ? 'Daralt' : 'Genişlet'}
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '5px 7px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {isWide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>

      <button
        type="button"
        onClick={onCloseSidebar}
        title="Paneli Gizle (T)"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '5px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
});

export default DraftSidebarTopHeader;
