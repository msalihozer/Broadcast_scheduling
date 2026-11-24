/**
 * @file src/modules/broadcast/components/sidebar/DraftSlotClipCard.jsx
 * @description Günün Taslağı yan panelindeki bir kuşağın altında listelenen tekil MAM klip kartı.
 * React.memo ile sarmalanarak gereksiz yeniden çizimleri önler.
 */
import React, { memo } from 'react';
import { Film, Plus, GripVertical, Check, Layers, Info } from 'lucide-react';
import { secondsToTimecode } from '../../utils/timecodeUtils';
import { formatClipDurationReadable } from '../../utils/draftSlotMatcher';

const DraftSlotClipCard = memo(function DraftSlotClipCard({
  clip,
  cIdx,
  draftItem,
  targetEpisodeNum,
  isAdded,
  isSelectedClip = false,
  otherSlotUsage,
  onDragStartClip,
  onAddClip,
  onViewClipInfo
}) {
  const clipDur = secondsToTimecode(clip.durationSec || 60);
  const clipDurReadable = formatClipDurationReadable(clip.durationSec || 60);
  const isTargetEp = targetEpisodeNum !== null && clip.episodeNo === targetEpisodeNum;
  const uType = clip.unitType || 'bolum';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStartClip(e, clip)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '11px 12px',
        borderRadius: '10px',
        background: isSelectedClip
          ? 'rgba(37, 99, 235, 0.16)'
          : isAdded
          ? 'rgba(16, 185, 129, 0.12)'
          : 'var(--bg-primary)',
        border: isSelectedClip
          ? '2px solid #3b82f6'
          : isAdded
          ? '1.5px solid rgba(16, 185, 129, 0.5)'
          : isTargetEp
          ? '1.5px solid rgba(59, 130, 246, 0.45)'
          : '1px solid var(--border-color)',
        borderLeft: isSelectedClip
          ? '6px solid #2563eb'
          : isAdded
          ? '5px solid #10b981'
          : isTargetEp
          ? '5px solid #3b82f6'
          : '5px solid #0d9488',
        boxShadow: isSelectedClip ? '0 0 0 2px rgba(59, 130, 246, 0.25)' : 'none',
        cursor: 'grab',
        transition: 'all 0.15s'
      }}
    >
      {/* Üst Satır: Tam Klip Adı + Sağda Hızlı ⓘ Bilgi Butonu */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', minWidth: 0, flex: 1 }}>
          <GripVertical size={15} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: '3px', opacity: 0.75 }} />
          <Film size={15} color={isAdded ? '#10b981' : '#0d9488'} style={{ flexShrink: 0, marginTop: '3px' }} />
          <div style={{
            fontSize: '13.5px',
            fontWeight: '800',
            color: isAdded ? '#059669' : 'var(--text-primary)',
            lineHeight: '1.4',
            wordBreak: 'break-word',
            flex: 1
          }} title={clip.name || clip.fileName}>
            {clip.name || clip.fileName}
          </div>
        </div>

        {onViewClipInfo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewClipInfo(clip);
            }}
            title="Klip Detayları, Metadataları ve Video İzleme (Play'e basmadıkça FFmpeg çalışmaz)"
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              color: '#3b82f6',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: '800',
              flexShrink: 0
            }}
          >
            <Info size={14} />
            <span>Detay</span>
          </button>
        )}
      </div>

      {/* Alt Satır: Belirgin Part / Bölüm / Metadata Rozetleri + Süre ve Ekle Butonu */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        flexWrap: 'wrap',
        paddingLeft: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {(clip.unitLabel || (clip.episodeNo !== null && clip.episodeNo !== undefined)) && (
            <span style={{
              background: uType === 'cuz'
                ? 'rgba(16, 185, 129, 0.16)'
                : uType === 'gun'
                  ? 'rgba(139, 92, 246, 0.16)'
                  : isTargetEp
                    ? 'rgba(59, 130, 246, 0.22)'
                    : 'rgba(59, 130, 246, 0.14)',
              color: uType === 'cuz'
                ? '#10b981'
                : uType === 'gun'
                  ? '#8b5cf6'
                  : 'var(--accent-primary)',
              border: uType === 'cuz'
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : uType === 'gun'
                  ? '1px solid rgba(139, 92, 246, 0.4)'
                  : `1px solid ${isTargetEp ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.35)'}`,
              padding: '3px 9px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800'
            }}>
              {clip.unitLabel || `Bölüm ${clip.episodeNo}`}
            </span>
          )}

          {clip.partNo !== null && clip.partNo !== undefined && (
            <span style={{
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              padding: '3px 9px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              letterSpacing: '0.2px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Layers size={12} />
              <span>PART {clip.partNo}</span>
            </span>
          )}

          {isTargetEp && (
            <span style={{
              background: 'rgba(16, 185, 129, 0.16)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '800'
            }}>
              Eşleşen Bölüm
            </span>
          )}

          {clip.note && (
            <span style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {clip.note}
            </span>
          )}

          {clip.metadataSummary?.sunucu && (
            <span
              title={`Sunucu: ${clip.metadataSummary.sunucu}`}
              style={{
                background: 'rgba(99, 102, 241, 0.14)',
                color: '#6366f1',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}
            >
              Sunucu: {clip.metadataSummary.sunucu}
            </span>
          )}

          {clip.metadataSummary?.konuk && (
            <span
              title={`Konuk: ${clip.metadataSummary.konuk}`}
              style={{
                background: 'rgba(139, 92, 246, 0.14)',
                color: '#8b5cf6',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700'
              }}
            >
              Konuk: {clip.metadataSummary.konuk}
            </span>
          )}

          {clip.metadataSummary?.yayinTarihi && (
            <span
              title={`Yayın Tarihi: ${clip.metadataSummary.yayinTarihi}`}
              style={{
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                fontFamily: 'monospace'
              }}
            >
              {clip.metadataSummary.yayinTarihi}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginLeft: 'auto', flexShrink: 0 }}>
          {isSelectedClip && (
            <span style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '800'
            }}>
              Seçili Klip
            </span>
          )}
          {isAdded ? (
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <Check size={12} strokeWidth={3} />
              <span>Eklendi</span>
            </span>
          ) : otherSlotUsage ? (
            <span
              title="Bu klip günün başka bir kuşağında kullanıldı. Bu kuşak için de eklemek isterseniz Ekle'ye tıklayın."
              style={{
                background: 'rgba(245, 158, 11, 0.16)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '800'
              }}
            >
              Başka Kuşakta ({otherSlotUsage.draftStartTime || 'Akışta'})
            </span>
          ) : null}

          <span
            title={`Tam Timecode: ${clipDur}`}
            style={{
              color: '#059669',
              fontWeight: '800',
              fontSize: '12px',
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '3px 8px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{clipDurReadable}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.85 }}>({clipDur})</span>
          </span>

          <button
            type="button"
            onClick={() => onAddClip(clip, draftItem)}
            title={isAdded ? 'Bu klip zaten yayına eklendi. Tekrar eklemek için tıklayın.' : 'Klip Adıyla Yayına Ekle'}
            style={{
              padding: '5px 11px',
              borderRadius: '7px',
              background: isAdded ? 'rgba(16, 185, 129, 0.2)' : '#0d9488',
              border: isAdded ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
              color: isAdded ? '#10b981' : '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: '800'
            }}
          >
            {isAdded ? (
              <Check size={14} strokeWidth={2.5} />
            ) : (
              <>
                <Plus size={14} strokeWidth={2.5} />
                <span>Ekle</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default DraftSlotClipCard;

