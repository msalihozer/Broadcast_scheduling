import React from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { DURATION_PRESETS, TIME_SLOTS } from './constants';

/**
 * @file LibraryEpisodeSelector.jsx
 * @description Genişletilmiş program kartı içerisindeki bölüm seçimi, sürükle-bırak kartı ve akışa ekleme formu.
 */
export const LibraryEpisodeSelector = ({
  prog,
  catColor = '#3b82f6',
  clipsInfo,
  isLoadingClips = false,
  episodeInput = '',
  selectedEpisodeData = null,
  selectedDuration = 60,
  setSelectedDuration,
  targetScope = 'selected',
  setTargetScope,
  targetSlot = '10:00',
  setTargetSlot,
  targetDaysList = [],
  onSelectEpisode,
  onEpisodeInputLookup,
  onDragStartItem,
  onExecuteAdd
}) => {
  if (isLoadingClips) {
    return (
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
        Bölüm detayları çekiliyor...
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px',
      borderTop: '1px solid var(--border-color)',
      background: 'var(--bg-secondary)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* 1. Hızlı Bölüm Numarası Girişi */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
          Bölüm No Girin veya Seçin:
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="number"
            placeholder="Bölüm No (Örn: 24)"
            value={episodeInput}
            onChange={e => onEpisodeInputLookup(e.target.value)}
            style={{
              width: '130px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-primary)',
              fontSize: '12px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          {selectedEpisodeData && (
            <div style={{
              flex: 1,
              fontSize: '11px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              padding: '4px 8px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              <span>{selectedEpisodeData.parts?.length || 1} Parça ({Math.round((selectedEpisodeData.totalSec || 1800) / 60)} dk)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Seçili Bölümü Doğrudan Sürükleme Kartı */}
      {(selectedEpisodeData || episodeInput) && (
        <div
          draggable={true}
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStartItem(e, prog, selectedEpisodeData || { episodeNo: episodeInput, totalSec: selectedDuration * 60, note: '' });
          }}
          title="Bu bölümü matris üzerindeki istediğiniz saat dilimine veya güne sürükleyebilirsiniz"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.16) 0%, rgba(59, 130, 246, 0.06) 100%)',
            border: `2px dashed ${catColor}`,
            borderRadius: '10px',
            cursor: 'grab',
            userSelect: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: catColor,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <GripVertical size={16} />
            </div>
            <div>
              <strong style={{ fontSize: '12.5px', color: catColor, display: 'block', lineHeight: 1.2 }}>
                Bölüm {episodeInput || selectedEpisodeData?.episodeNo} (Matrise Sürükle)
              </strong>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                İstediğiniz gün veya saat dilimine bırakın
              </span>
            </div>
          </div>
          <span style={{ fontSize: '11.5px', background: catColor, color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
            {selectedDuration} dk
          </span>
        </div>
      )}

      {/* 3. Bölüm Çipleri (Hızlı Seçim & Sürükle-Bırak) */}
      {clipsInfo?.episodes && clipsInfo.episodes.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Mevcut Bölümler ({clipsInfo.episodes.length}):</span>
            <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700 }}>Tıkla veya Matrise Sürükle</span>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '5px',
            maxHeight: '140px',
            overflowY: 'auto',
            padding: '2px'
          }}>
            {clipsInfo.episodes.map(ep => {
              const isEpSelected = episodeInput === ep.episodeNo.toString();
              return (
                <div
                  key={ep.episodeNo}
                  role="button"
                  tabIndex={0}
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    onDragStartItem(e, prog, ep);
                  }}
                  onClick={() => onSelectEpisode(ep)}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '7px',
                    border: '1.5px solid',
                    borderColor: isEpSelected ? catColor : 'var(--border-color)',
                    background: isEpSelected ? catColor : 'var(--bg-primary)',
                    color: isEpSelected ? '#ffffff' : 'var(--text-primary)',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'grab',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.12s ease',
                    boxShadow: isEpSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                  }}
                  title={`Bölüm ${ep.episodeNo} (${Math.round(ep.totalSec / 60)} dk) • Tıklayarak seçin veya doğrudan matrise sürükleyin`}
                >
                  <GripVertical size={13} style={{ opacity: isEpSelected ? 0.9 : 0.45 }} />
                  <span>B.{ep.episodeNo}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Yayın Süresi Seçimi */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Kuşak Süresi:</span>
        {DURATION_PRESETS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDuration(d)}
            style={{
              padding: '2px 5px',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: selectedDuration === d ? catColor : 'var(--border-color)',
              background: selectedDuration === d ? catColor : 'var(--bg-primary)',
              color: selectedDuration === d ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {d} dk
          </button>
        ))}
      </div>

      {/* 5. Hedef Gün Kapsamı (Günlük / Haftalık Seçimi) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Hedef Gün(ler):</span>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { id: 'selected', label: 'Seçili Gün' },
            { id: 'weekdays', label: 'Hafta İçi (5 Gün)' },
            { id: 'weekend', label: 'Hafta Sonu' },
            { id: 'allWeek', label: 'Tüm Hafta (7 Gün)' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTargetScope(opt.id)}
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: targetScope === opt.id ? 'var(--accent-primary)' : 'var(--border-color)',
                background: targetScope === opt.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: targetScope === opt.id ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '9.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Saat Dilimi ve Ekle Butonu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
        <select
          value={targetSlot}
          onChange={e => setTargetSlot(e.target.value)}
          style={{
            padding: '4px 6px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            fontSize: '11px',
            color: 'var(--text-primary)'
          }}
        >
          <option value="end">Günün Sonuna Ekle</option>
          {TIME_SLOTS.map(t => (
            <option key={t} value={t}>{t} Kuşağı</option>
          ))}
        </select>

        <button
          type="button"
          onClick={onExecuteAdd}
          style={{
            flex: 1,
            background: `linear-gradient(135deg, ${catColor} 0%, #1e40af 100%)`,
            color: '#ffffff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            boxShadow: `0 2px 8px ${catColor}44`
          }}
        >
          <Plus size={13} />
          <span>{targetDaysList.length} Güne Akışa Ekle</span>
        </button>
      </div>
    </div>
  );
};

export default LibraryEpisodeSelector;
