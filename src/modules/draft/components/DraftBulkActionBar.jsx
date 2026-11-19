/**
 * @file DraftBulkActionBar.jsx
 * @description Taslak Planlama modülünde birden fazla program/kuşak seçildiğinde
 * ekranın alt kısmında beliren toplu kopyalama, silme ve taşıma işlem çubuğu.
 */
import React, { useState } from 'react';
import { Copy, Trash2, X, CheckSquare, ArrowRight, Calendar, Check, ChevronDown, Send } from 'lucide-react';
import { dialog } from '../../../store/dialogStore';

const DraftBulkActionBar = ({
  selectedCount = 0,
  selectedList = [],
  availableDays = [],
  onClearSelection,
  onDeleteSelected,
  onDuplicateSelected,
  onSendSelectedToBroadcast
}) => {
  const [targetDayKey, setTargetDayKey] = useState('');
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        borderRadius: '16px',
        padding: '10px 18px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        animation: 'slideUpBar 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        color: '#ffffff'
      }}
    >
      {/* Seçim Sayacı ve İkon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(59, 130, 246, 0.25)',
          color: '#60a5fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CheckSquare size={18} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800 }}>
            {selectedCount} Kuşak Seçildi
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>
            Toplu işlem için hazır
          </div>
        </div>
      </div>

      <div style={{ width: '1px', height: '28px', background: 'rgba(255, 255, 255, 0.15)' }} />

      {/* Kopyalama Seçenekleri */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Hızlı Aynı Güne Çoğalt */}
          <button
            type="button"
            onClick={() => onDuplicateSelected(selectedList, null)}
            title="Seçili programları bulundukları günlerin içine çoğaltır"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'; }}
          >
            <Copy size={14} />
            <span>Kopyala / Çoğalt</span>
          </button>

          {/* Başka Güne Kopyala Dropdown Butonu */}
          <button
            type="button"
            onClick={() => setShowCopyDropdown(prev => !prev)}
            title="Hedef gün seçerek kopyala"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 10px',
              borderRadius: '8px',
              background: showCopyDropdown ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Calendar size={13} />
            <span>Hedef Güne Aktar</span>
            <ChevronDown size={13} style={{ transform: showCopyDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {/* Seçilenleri Yayına Gönder Butonu */}
          {onSendSelectedToBroadcast && (
            <button
              type="button"
              onClick={() => onSendSelectedToBroadcast(selectedList)}
              title="Seçili programları Yayın Planlama modülüne aktar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
            >
              <Send size={13} />
              <span>Yayına Gönder</span>
            </button>
          )}
        </div>

        {/* Hedef Gün Seçim Popover'ı */}
        {showCopyDropdown && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: 0,
              background: '#0f172a',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              padding: '10px',
              boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
              minWidth: '220px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              zIndex: 2100
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', padding: '2px 6px' }}>
              Seçili {selectedCount} programı hangi güne kopyalamak istersiniz?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {availableDays.map(d => (
                <button
                  key={d.dateKey}
                  type="button"
                  onClick={() => {
                    onDuplicateSelected(selectedList, d.dateKey);
                    setShowCopyDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; e.currentTarget.style.color = '#93c5fd'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#ffffff'; }}
                >
                  <span>{d.dayName}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>{d.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toplu Silme Butonu */}
      <button
        type="button"
        onClick={async () => {
          const ok = await dialog.confirm(
            'Seçili Kuşakları Sil',
            `Seçili ${selectedCount} yayın kuşağını akıştan tamamen silmek istediğinize emin misiniz?`,
            { isDestructive: true, confirmText: 'Evet, Sil' }
          );
          if (ok) {
            onDeleteSelected(selectedList);
          }
        }}
        title="Seçili programları akıştan kaldırır"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
      >
        <Trash2 size={14} />
        <span>Seçilenleri Sil ({selectedCount})</span>
      </button>

      <div style={{ width: '1px', height: '28px', background: 'rgba(255, 255, 255, 0.15)' }} />

      {/* Seçimi Temizle Butonu */}
      <button
        type="button"
        onClick={onClearSelection}
        title="Seçimi İptal Et"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 10px',
          borderRadius: '8px',
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '12px',
          cursor: 'pointer',
          transition: 'color 0.15s'
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'; }}
      >
        <X size={15} />
        <span>Temizle</span>
      </button>
    </div>
  );
};

export default React.memo(DraftBulkActionBar);
