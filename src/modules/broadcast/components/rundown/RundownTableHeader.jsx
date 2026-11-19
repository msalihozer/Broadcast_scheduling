/**
 * @file src/modules/broadcast/components/rundown/RundownTableHeader.jsx
 * @description Yayın akışı tablosunun sütun başlıkları satırı:
 * `# | Yayın Saati (Başlangıç → Bitiş) | Süre | Klip Adı | Bölüm / Part | Tür | İşlemler`
 */
import React, { memo } from 'react';
import { Clock } from 'lucide-react';
import { RUNDOWN_GRID_TEMPLATE } from '../../utils/rundownHelpers';

const RundownTableHeader = memo(function RundownTableHeader({
  programsCount = 0,
  selectedCount = 0,
  onSelectAll
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: RUNDOWN_GRID_TEMPLATE,
      columnGap: '8px',
      alignItems: 'center',
      padding: '9px 10px',
      background: 'var(--bg-tertiary)',
      borderBottom: '2px solid var(--border-color)',
      borderTopLeftRadius: '13px',
      borderTopRightRadius: '13px',
      fontSize: '11.5px',
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: '0.35px',
      color: 'var(--text-secondary)',
      userSelect: 'none',
      position: 'sticky',
      top: 0,
      zIndex: 15,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      width: '100%',
      minWidth: 0,
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        <input
          type="checkbox"
          checked={programsCount > 0 && selectedCount === programsCount}
          onChange={onSelectAll}
          title={selectedCount === programsCount ? 'Tüm seçimleri kaldır' : 'Tümünü seç'}
          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent-primary)', flexShrink: 0 }}
        />
        <span>#</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Clock size={13} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Yayın Saati</span>
      </div>
      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Süre</div>
      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Klip Adı</div>
      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Bölüm / Part</div>
      <div style={{ minWidth: 0, whiteSpace: 'nowrap' }}>Tür</div>
      <div style={{ textAlign: 'right', minWidth: 0, whiteSpace: 'nowrap' }}>İşlemler</div>
    </div>
  );
});

export default RundownTableHeader;

