/**
 * @file src/modules/broadcast/components/sidebar/DraftSidebarFilterHeader.jsx
 * @description "Günün Taslağı" sekmesinin arama, Eklenen / Eklenmeyen durum özeti ve
 * seçili klibin taslaktaki yerini gösteren üst kontrol şeridi.
 */
import React, { memo } from 'react';
import { RefreshCw, Search, X, CheckCircle2, AlertCircle, Crosshair } from 'lucide-react';

const DraftSidebarFilterHeader = memo(function DraftSidebarFilterHeader({
  draftProgramsCount = 0,
  draftSearchQuery = '',
  setDraftSearchQuery,
  draftStatusFilter = 'all',
  setDraftStatusFilter,
  draftCheckStats = { total: 0, missingCount: 0, addedCount: 0 },
  matchedDraftSlotsForSelectedClip = [],
  onScrollToDraftSlot,
  onManualRefreshDraft
}) {
  if (draftProgramsCount === 0) return null;

  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px'
      }}
    >
      {/* Üst Satır: Arama Kutusu + Yenile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '9px', pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={draftSearchQuery}
            onChange={e => setDraftSearchQuery(e.target.value)}
            placeholder="Günün taslağında program veya saat ara..."
            style={{
              width: '100%',
              padding: '6px 26px 6px 28px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: '600',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {draftSearchQuery && (
            <button
              type="button"
              onClick={() => setDraftSearchQuery('')}
              style={{
                position: 'absolute',
                right: '7px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex'
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onManualRefreshDraft}
          title="Taslağı ve Arşivi Yenile, Eksik veya Yeni Yüklenen Programları Otomatik Ekle"
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#60a5fa',
            padding: '6px 9px',
            borderRadius: '7px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11.5px',
            fontWeight: '700',
            whiteSpace: 'nowrap'
          }}
        >
          <RefreshCw size={12} /> Yenile & Kontrol Et
        </button>
      </div>

      {/* Alt Satır: Belirgin Tümü / Eklenen / Eklenmeyen Filtre Butonları */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px'
        }}
      >
        <button
          type="button"
          onClick={() => setDraftStatusFilter('all')}
          style={{
            padding: '5px 8px',
            borderRadius: '7px',
            border:
              draftStatusFilter === 'all'
                ? '1.5px solid var(--accent-primary)'
                : '1px solid var(--border-color)',
            background:
              draftStatusFilter === 'all'
                ? 'rgba(59, 130, 246, 0.16)'
                : 'var(--bg-secondary)',
            color:
              draftStatusFilter === 'all'
                ? 'var(--accent-primary)'
                : 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px'
          }}
        >
          <span>Tümü ({draftCheckStats.total})</span>
        </button>

        <button
          type="button"
          onClick={() => setDraftStatusFilter('added')}
          style={{
            padding: '5px 8px',
            borderRadius: '7px',
            border:
              draftStatusFilter === 'added'
                ? '1.5px solid #10b981'
                : '1px solid rgba(16, 185, 129, 0.35)',
            background:
              draftStatusFilter === 'added'
                ? '#10b981'
                : 'rgba(16, 185, 129, 0.1)',
            color: draftStatusFilter === 'added' ? '#ffffff' : '#10b981',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <CheckCircle2 size={13} />
          <span>Eklenen ({draftCheckStats.addedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setDraftStatusFilter('missing')}
          style={{
            padding: '5px 8px',
            borderRadius: '7px',
            border:
              draftStatusFilter === 'missing'
                ? '1.5px solid #ef4444'
                : '1px solid rgba(239, 68, 68, 0.35)',
            background:
              draftStatusFilter === 'missing'
                ? '#ef4444'
                : 'rgba(239, 68, 68, 0.1)',
            color: draftStatusFilter === 'missing' ? '#ffffff' : '#ef4444',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <AlertCircle size={13} />
          <span>
            {draftCheckStats.updatedCount > 0
              ? `Eksik/Güncel (${draftCheckStats.missingCount + draftCheckStats.updatedCount})`
              : `Eklenmeyen (${draftCheckStats.missingCount})`}
          </span>
        </button>
      </div>

      {/* Taslakta Güncellenen veya Eklenmeyen Kuşak Bildirim Şeridi */}
      {draftCheckStats.addedCount > 0 && (draftCheckStats.updatedCount > 0 || draftCheckStats.missingCount > 0) && (
        <div
          onClick={() => setDraftStatusFilter(draftStatusFilter === 'missing' ? 'all' : 'missing')}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer'
          }}
          title="Tıklayarak yalnızca güncellenen veya eklenmeyen kuşakları filtreleyin"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '800', color: '#d97706' }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            <span>
              Taslakta değişiklik:{' '}
              {draftCheckStats.updatedCount > 0 && `${draftCheckStats.updatedCount} güncellenen`}
              {draftCheckStats.updatedCount > 0 && draftCheckStats.missingCount > 0 && ', '}
              {draftCheckStats.missingCount > 0 && `${draftCheckStats.missingCount} eklenmeyen`} kuşak var
            </span>
          </div>
          <span style={{
            fontSize: '10.5px',
            fontWeight: '800',
            background: '#d97706',
            color: '#ffffff',
            padding: '2px 7px',
            borderRadius: '5px',
            whiteSpace: 'nowrap'
          }}>
            {draftStatusFilter === 'missing' ? 'Tümünü Göster' : 'Değişenleri Göster'}
          </span>
        </div>
      )}

      {/* Seçili Klip Taslakta Varsa Yeri Gösterge Çubuğu */}
      {matchedDraftSlotsForSelectedClip.length > 0 && (
        <div
          onClick={() => {
            if (onScrollToDraftSlot && matchedDraftSlotsForSelectedClip[0]) {
              onScrollToDraftSlot(matchedDraftSlotsForSelectedClip[0]);
            }
          }}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'linear-gradient(90deg, rgba(37, 99, 235, 0.18) 0%, rgba(79, 70, 229, 0.18) 100%)',
            border: '1.5px solid rgba(59, 130, 246, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            cursor: 'pointer'
          }}
          title="Tıklayarak taslaktaki kuşağa odaklanın"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            <Crosshair size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: '12px',
                fontWeight: '800',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              Seçili Klip Taslakta:{' '}
              <strong style={{ color: '#3b82f6', fontFamily: 'monospace' }}>
                {matchedDraftSlotsForSelectedClip.map(s => s.startTime).join(', ')}
              </strong>{' '}
              • {matchedDraftSlotsForSelectedClip[0]?.title}
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '800',
              color: '#ffffff',
              background: '#2563eb',
              padding: '2px 7px',
              borderRadius: '5px',
              flexShrink: 0
            }}
          >
            Göster
          </span>
        </div>
      )}
    </div>
  );
});

export default DraftSidebarFilterHeader;
