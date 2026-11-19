import React, { useRef } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { getProgramColor } from './constants';

/**
 * @file LibraryProgramItem.jsx
 * @description Sadeleştirilmiş Program Kütüphanesi kartı.
 * Yalnızca program adı, kategori ve bölüm sayısını gösterir.
 * Sürükle-bırak yapıldığında veya "+ Ekle" tıklandığında akıllı pop-up modal açılır.
 */
export const LibraryProgramItem = ({
  prog,
  catColor = '#3b82f6',
  onDragStartItem,
  onOpenAddModal
}) => {
  const episodeCount = prog.totalEpisodes || prog.episodeCount || prog.totalClips || 0;
  const progColor = getProgramColor(prog);
  const isDraggingRef = useRef(false);

  const handleDragStart = (e) => {
    isDraggingRef.current = true;
    onDragStartItem && onDragStartItem(e, prog);
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleClick = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onOpenAddModal && onOpenAddModal(prog);
  };

  return (
    <div
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      style={{
        flexShrink: 0,
        background: `linear-gradient(135deg, ${progColor}11 0%, ${progColor}04 100%), var(--bg-primary)`,
        border: `1px solid ${progColor}28`,
        borderLeft: `3.5px solid ${progColor}`,
        borderRadius: '8px',
        padding: '7px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'grab',
        userSelect: 'none',
        gap: '8px',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
      }}
      title="Akışa sürükleyin veya planlama pop-up'ını açmak için tıklayın"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = `0 4px 10px ${progColor}18`;
        e.currentTarget.style.borderColor = `${progColor}55`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)';
        e.currentTarget.style.borderColor = `${progColor}28`;
      }}
    >
      {/* Sol: Sürükleme İkonu + Program Adı & Bölüm Sayısı */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
        <div
          title="Sürükle ve Bırak"
          style={{
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <GripVertical size={16} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Program Adı */}
          <div style={{
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3
          }}>
            {prog.title || prog.name || 'İsimsiz Program'}
          </div>

          {/* Kategori ve Bölüm Sayısı Rozetleri */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
            <span style={{
              color: '#ffffff',
              background: catColor,
              padding: '1px 6px',
              borderRadius: '5px',
              fontWeight: 700,
              fontSize: '9.5px',
              whiteSpace: 'nowrap'
            }}>
              {prog.categoryName || 'Genel'}
            </span>

            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              background: 'var(--bg-tertiary)',
              padding: '1px 6px',
              borderRadius: '5px',
              whiteSpace: 'nowrap'
            }}>
              {episodeCount > 0 ? `${episodeCount} Bölüm` : 'Bölümler'}
            </span>
          </div>
        </div>
      </div>

      {/* Sağ: + Ekle Butonu */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenAddModal && onOpenAddModal(prog);
        }}
        title="Akışa Ekle (Pop-up aç)"
        style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          color: 'var(--accent-primary)',
          padding: '5px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          flexShrink: 0,
          transition: 'all 0.15s'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--accent-primary)';
          e.currentTarget.style.color = '#ffffff';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
          e.currentTarget.style.color = 'var(--accent-primary)';
        }}
      >
        <Plus size={13} />
        <span>Ekle</span>
      </button>
    </div>
  );
};

export default React.memo(LibraryProgramItem);
