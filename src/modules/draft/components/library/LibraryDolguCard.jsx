import React, { useState, useRef } from 'react';
import { GripVertical, Sparkles, Plus, Radio, Clock, ChevronDown } from 'lucide-react';

/**
 * @file LibraryDolguCard.jsx
 * @description Program Kütüphanesi içerisindeki minimalize edilmiş (tek satırlık, yer kaplamayan)
 * Hızlı Dolgu Kuşağı ve Canlı / Özel Program sürükle-bırak & ekleme barı.
 */
export const LibraryDolguCard = ({
  onDragStart,
  onLiveCustomDragStart,
  onOpenAddModal
}) => {
  const isDraggingRef = useRef(false);
  const isLiveDraggingRef = useRef(false);

  const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDuration, setCustomDuration] = useState(60);
  const [customIsLive, setCustomIsLive] = useState(true);

  const dolguProg = {
    id: 'prog_dolgu_default',
    title: 'Dolgu Kuşağı',
    category: 'Dolgu Kuşağı',
    categoryName: 'Dolgu Kuşağı',
    categoryColor: '#06b6d4',
    isKisaSlot: true,
    duration: 30,
    availableOptions: ['Kısa Program', 'Kaside', 'Aşr-ı Şerif'],
    selectedOptions: ['Kısa Program', 'Kaside', 'Aşr-ı Şerif']
  };

  const buildCustomLiveProgramObj = () => {
    const cleanTitle = customTitle.trim() || (customIsLive ? 'Canlı Yayın Özel' : 'Özel Program');
    return {
      id: 'prog_custom_live',
      title: cleanTitle,
      customTitle: customTitle.trim(),
      isCustomProgram: true,
      isLive: Boolean(customIsLive),
      category: customIsLive ? 'Canlı Yayın' : 'Özel Yayın',
      categoryName: customIsLive ? 'Canlı Yayın' : 'Özel Yayın',
      categoryColor: customIsLive ? '#e11d48' : '#2563eb',
      categoryBadge: customIsLive ? 'Canlı' : 'Özel',
      isKisaSlot: false,
      duration: Math.max(5, parseInt(customDuration, 10) || 60),
      selectedOptions: customIsLive ? ['Canlı'] : ['Bant']
    };
  };

  const handleDragStart = (e) => {
    isDraggingRef.current = true;
    onDragStart && onDragStart(e);
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
    onOpenAddModal && onOpenAddModal(dolguProg);
  };

  const handleLiveDragStart = (e) => {
    isLiveDraggingRef.current = true;
    const progObj = buildCustomLiveProgramObj();
    if (onLiveCustomDragStart) {
      onLiveCustomDragStart(e, progObj);
    } else {
      const payload = {
        isLibraryItem: true,
        programData: progObj
      };
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'all';
    }
  };

  const handleLiveDragEnd = () => {
    setTimeout(() => {
      isLiveDraggingRef.current = false;
    }, 150);
  };

  const handleOpenLiveModal = (e) => {
    if (e) e.stopPropagation();
    if (isLiveDraggingRef.current) return;
    onOpenAddModal && onOpenAddModal(buildCustomLiveProgramObj());
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      flexShrink: 0
    }}>
      {/* TEK SATIR MİNİMAL BAR: Sol = Dolgu Kuşağı | Sağ = Canlı / Özel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px'
      }}>
        {/* 1. MİNİMAL DOLGU KUŞAĞI HAP BUTONU */}
        <div
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={handleClick}
          title="Dolgu Kuşağı: Takvime sürükleyin veya eklemek için tıklayın"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            background: 'rgba(6, 182, 212, 0.10)',
            border: '1px dashed #0891b2',
            borderRadius: '8px',
            cursor: 'grab',
            userSelect: 'none',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <GripVertical size={12} style={{ color: '#0891b2', flexShrink: 0 }} />
            <Sparkles size={12} color="#0891b2" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0e7490', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Dolgu Kuşağı
            </span>
          </div>

          <span style={{
            background: '#0891b2',
            color: '#ffffff',
            padding: '2px 5px',
            borderRadius: '5px',
            fontSize: '10px',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            flexShrink: 0
          }}>
            <Plus size={10} /> Ekle
          </span>
        </div>

        {/* 2. MİNİMAL CANLI / ÖZEL PROGRAM HAP BUTONU */}
        <div
          draggable={true}
          onDragStart={handleLiveDragStart}
          onDragEnd={handleLiveDragEnd}
          onClick={handleOpenLiveModal}
          title="Canlı / Özel Program: Takvime sürükleyin veya eklemek için tıklayın"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 7px',
            background: 'rgba(225, 29, 72, 0.10)',
            border: '1px dashed #e11d48',
            borderRadius: '8px',
            cursor: 'grab',
            userSelect: 'none',
            gap: '3px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
            <GripVertical size={12} style={{ color: '#e11d48', flexShrink: 0 }} />
            <Radio size={12} color="#e11d48" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#be123c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {customTitle.trim() ? customTitle.trim() : 'Canlı / Özel'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <span style={{
              background: '#e11d48',
              color: '#ffffff',
              padding: '2px 5px',
              borderRadius: '5px',
              fontSize: '10px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              <Plus size={10} /> Ekle
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsQuickFormOpen(prev => !prev);
              }}
              title="Hızlı isim ve süre ayarı aç/kapat"
              style={{
                background: 'rgba(225, 29, 72, 0.15)',
                color: '#be123c',
                border: 'none',
                borderRadius: '4px',
                padding: '2px 3px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ChevronDown
                size={11}
                style={{
                  transform: isQuickFormOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease'
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Opsiyonel Açılır Mini Ayar Satırı (Varsayılan kapalıdır, yer kaplamaz) */}
      {isQuickFormOpen && (
        <div
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--bg-primary)',
            padding: '5px 7px',
            borderRadius: '7px',
            border: '1px solid rgba(225, 29, 72, 0.3)'
          }}
        >
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleOpenLiveModal(e);
              }
            }}
            placeholder="İsim (Örn: Mevlid)..."
            style={{
              flex: 1,
              minWidth: 0,
              padding: '3px 6px',
              borderRadius: '5px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 700,
              outline: 'none'
            }}
          />
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '5px',
            padding: '2px 5px',
            flexShrink: 0
          }}>
            <Clock size={10} color="var(--text-muted)" />
            <input
              type="number"
              min="5"
              max="720"
              step="5"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              style={{
                width: '34px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 800,
                textAlign: 'center',
                outline: 'none',
                padding: 0
              }}
            />
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)' }}>dk</span>
          </div>
          <button
            type="button"
            onClick={() => setCustomIsLive(prev => !prev)}
            style={{
              padding: '3px 6px',
              borderRadius: '5px',
              border: 'none',
              background: customIsLive ? '#e11d48' : '#2563eb',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {customIsLive ? '● Canlı' : 'Bant'}
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(LibraryDolguCard);
