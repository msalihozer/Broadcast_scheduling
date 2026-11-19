/**
 * @file DraftProgramCard.jsx
 * @description Taslak Planlama kurumsal program kartı bileşeni.
 * - Üst üste binmeleri (collision) tamamen ortadan kaldıran kompakt kurumsal tasarım
 * - Hover durumunda sağ üstte açılan yüzer (floating) hızlı işlem araç çubuğu (Düzenle, Kopyala, Sil)
 * - Dolgu kuşakları için tek satıra sığan kompakt opsiyon rozetleri
 * - Tabular-nums JetBrains Mono süre/bölüm rozetleri ve akıcı mikro-animasyonlar
 */
import React, { useState, useRef } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Edit3,
  Copy,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import { getProgramColor, getCategoryTitleTextColor, CATEGORY_COLORS } from './library/constants';
import useThemeStore, { BOX_SHADOW_OPTIONS, hexToRgba } from '../../../store/themeStore';

// Arşiv bölüm ve part toplam süresini kurumsal ve okunaklı formata dönüştürür (Örn: "2 Part • 46 dk 8 sn")
function formatCompactArchiveDuration(formattedStr, partsCount) {
  if (!formattedStr) return '';
  const clean = String(formattedStr)
    .replace(/\s+/g, ' ')
    .trim();
  if (partsCount && partsCount > 1) {
    return `${partsCount} Part • ${clean}`;
  }
  return clean;
}

// Dolgu opsiyon isimlerini gösterir
function formatShortOptionLabel(opt) {
  return opt;
}

const DraftProgramCard = ({
  prog,
  dateKey,
  progIndex,
  totalProgramsInDay = 0,
  isSelected = false,
  isDragging = false,
  isDragOver = false,
  onSelect,
  onToggleOption,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveOrder,
  onDuplicate,
  onDelete,
  onEdit,
  hideTimeBadge = false,
  textScale = 1
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [localDropAfter, setLocalDropAfter] = useState(false);
  const isDraggingRef = useRef(false);
  const scale = Number(textScale) > 0 ? Number(textScale) : 1;
  const px = (base) => `${Math.round(base * scale * 10) / 10}px`;
  const isKisa = Boolean(prog.isKisaSlot);
  const isLive = Boolean(
    prog.isLive ||
    (Array.isArray(prog.selectedOptions) && prog.selectedOptions.includes('Canlı')) ||
    /\bcanl[ıi]\b/i.test(`${prog.rawTitle || ''} ${prog.title || ''} ${prog.host || ''}`)
  );

  const progColor = getProgramColor(prog);
  const cardBorderColor = progColor;
  const duration = prog.duration || 30;

  const draftTheme = useThemeStore(state => state.config?.modules?.draft) || {};
  const boxRadius = draftTheme.boxRadius || '8px';
  const cardPadding = draftTheme.cardPadding || (isKisa ? '5px 7px' : '6px 8px');
  const borderWidth = Number(draftTheme.borderWidth) || 1;
  const leftAccentWidth = Number(draftTheme.leftAccentWidth) || 3.5;
  const tintAlpha = Math.max(0.03, Math.min(0.32, (Number(draftTheme.cardTintOpacity) || 11) / 100));
  const shadowObj = BOX_SHADOW_OPTIONS.find(s => s.id === draftTheme.boxShadow) || BOX_SHADOW_OPTIONS[1];
  const categoryTitleColor = draftTheme.useCategoryTitleColor !== false
    ? getCategoryTitleTextColor(prog)
    : null;

  const cardBg = isSelected
    ? `linear-gradient(135deg, ${hexToRgba(progColor, Math.min(0.35, tintAlpha + 0.08))} 0%, ${hexToRgba(progColor, tintAlpha * 0.6)} 100%), var(--bg-secondary)`
    : isDragOver
    ? 'rgba(37, 99, 235, 0.14)'
    : isHovered
    ? `linear-gradient(135deg, ${hexToRgba(progColor, Math.min(0.28, tintAlpha + 0.05))} 0%, ${hexToRgba(progColor, tintAlpha * 0.45)} 100%), var(--bg-secondary)`
    : `linear-gradient(135deg, ${hexToRgba(progColor, tintAlpha)} 0%, ${hexToRgba(progColor, tintAlpha * 0.3)} 100%), var(--bg-secondary)`;

  const cardBorder = isSelected
    ? progColor
    : isDragOver
    ? 'var(--accent-primary)'
    : isHovered
    ? `${progColor}65`
    : `${progColor}28`;

  const compactDurationLabel = formatCompactArchiveDuration(prog.episodeDurationFormatted, prog.partsCount);
  const canMoveUp = progIndex > 0;
  const canMoveDown = totalProgramsInDay > 0 ? progIndex < totalProgramsInDay - 1 : true;
  const targetId = prog.instanceId || prog.id;

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        isDraggingRef.current = true;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'copyMove';
        }
        onDragStart && onDragStart(e, { dateKey, instanceId: targetId, progIndex });
      }}
      onDragEnd={(e) => {
        setLocalDropAfter(false);
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 150);
        onDragEnd && onDragEnd(e);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const dropAfter = (e.clientY - rect.top) > rect.height / 2;
        if (localDropAfter !== dropAfter) {
          setLocalDropAfter(dropAfter);
        }
        onDragOver && onDragOver(e, { dateKey, instanceId: targetId, progIndex, dropAfter });
      }}
      onDragLeave={(e) => {
        setLocalDropAfter(false);
        onDragLeave && onDragLeave(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const dropAfter = (e.clientY - rect.top) > rect.height / 2;
        setLocalDropAfter(false);
        onDrop && onDrop(e, { dateKey, instanceId: targetId, progIndex, dropAfter });
      }}
      onClick={(e) => {
        if (isDraggingRef.current) return;
        onToggleSelect && onToggleSelect(dateKey, targetId, e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect && onSelect({ ...prog, dateKey });
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
        background: cardBg,
        border: `${borderWidth}px solid`,
        borderColor: cardBorder,
        borderLeft: `${leftAccentWidth}px solid ${cardBorderColor}`,
        borderTop: isDragOver && !localDropAfter ? '2.5px solid var(--accent-primary)' : `${borderWidth}px solid ${cardBorder}`,
        borderBottom: isDragOver && localDropAfter ? '2.5px solid var(--accent-primary)' : `${borderWidth}px solid ${cardBorder}`,
        borderRadius: boxRadius,
        padding: cardPadding,
        cursor: 'grab',
        transition: 'all 0.18s cubic-bezier(0.22, 1, 0.36, 1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '3px',
        boxShadow: isSelected
          ? '0 0 0 1.5px rgba(37, 99, 235, 0.3), 0 4px 10px rgba(37, 99, 235, 0.1)'
          : isHovered
          ? shadowObj.hoverValue
          : shadowObj.value,
        opacity: isDragging ? 0.35 : 1,
        transform: isHovered && !isDragging ? 'translateY(-1px)' : 'none',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* YÜZER HIZLI İŞLEM ÇUBUĞU (Hover durumunda sağ üstte açılır: Üste Taşı, Alta Taşı, Düzenle, Kopyala, Sil) */}
      {isHovered && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '4px',
            right: '24px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '2px',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.14)'
          }}
        >
          {onMoveOrder && (
            <>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canMoveUp) onMoveOrder(dateKey, targetId, 'up');
                }}
                title="Programı Bir Üste Taşı"
                style={{
                  background: canMoveUp ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  border: 'none',
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  color: canMoveUp ? '#059669' : 'var(--text-muted)',
                  opacity: canMoveUp ? 1 : 0.35,
                  cursor: canMoveUp ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowUp size={11} />
              </button>

              <button
                type="button"
                disabled={!canMoveDown}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canMoveDown) onMoveOrder(dateKey, targetId, 'down');
                }}
                title="Programı Bir Alta Taşı"
                style={{
                  background: canMoveDown ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                  border: 'none',
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  color: canMoveDown ? '#059669' : 'var(--text-muted)',
                  opacity: canMoveDown ? 1 : 0.35,
                  cursor: canMoveDown ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <ArrowDown size={11} />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect && onSelect({ ...prog, dateKey });
            }}
            title="Programı Düzenle (Çift Tık)"
            style={{
              background: 'rgba(37, 99, 235, 0.1)',
              border: 'none',
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Edit3 size={11} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate && onDuplicate(dateKey, targetId);
            }}
            title="Kuşağı Kopyala"
            style={{
              background: 'transparent',
              border: 'none',
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Copy size={11} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete && onDelete(dateKey, targetId);
            }}
            title="Kuşağı Sil"
            style={{
              background: 'transparent',
              border: 'none',
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              color: 'var(--danger)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {/* 1. ÜST KISIM: PROGRAM ADI & SEÇİM KUTUSU */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '4px',
        minWidth: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '3px', flex: 1, minWidth: 0 }}>
          <div
            title="Sırasını değiştirmek için sürükleyin"
            style={{
              color: isHovered ? 'var(--accent-primary)' : 'var(--text-muted)',
              opacity: isHovered ? 0.9 : 0.45,
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              marginTop: '1px',
              flexShrink: 0
            }}
          >
            <GripVertical size={11} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', minWidth: 0 }}>
              <h4
                title={prog.title}
                style={{
                  fontFamily: 'var(--draft-font-sans, var(--font-sans))',
                  fontSize: px(isKisa ? 12.5 : 13),
                  fontWeight: 800,
                  margin: 0,
                  color: isKisa
                    ? '#0891b2'
                    : isLive
                    ? '#e11d48'
                    : (categoryTitleColor || 'var(--text-primary)'),
                  lineHeight: 1.25,
                  letterSpacing: '-0.02em',
                  display: '-webkit-box',
                  WebkitLineClamp: isKisa ? 1 : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word'
                }}
              >
                {prog.title}
              </h4>

              {isLive && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: px(9),
                  fontWeight: 800,
                  background: '#e11d48',
                  color: '#ffffff',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap'
                }}>
                  ● CANLI
                </span>
              )}
            </div>

            {/* Alt Başlık: Sunucu veya Konu (Dolgu kuşağında tekrarı önlemek için gizlenir) */}
            {!isKisa && (prog.topic || prog.host) && (
              <div
                title={`${prog.host || ''}${prog.host && prog.topic ? ' • ' : ''}${prog.topic || ''}`}
                style={{
                  fontSize: px(11),
                  color: 'var(--text-muted)',
                  lineHeight: 1.25,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {prog.host && <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{prog.host}</span>}
                {prog.host && prog.topic && ' • '}
                {prog.topic}
              </div>
            )}
          </div>
        </div>

        {/* Sağ Üst: Çoklu Seçim Kutusu */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            const targetId = prog.instanceId || prog.id;
            onToggleSelect && onToggleSelect(dateKey, targetId, e);
          }}
          title={isSelected ? 'Seçimi Kaldır' : 'Kuşağı Seç'}
          style={{
            cursor: 'pointer',
            color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '4px',
            flexShrink: 0
          }}
        >
          {isSelected ? (
            <CheckSquare size={14} style={{ color: 'var(--accent-primary)' }} />
          ) : (
            <Square size={14} style={{ opacity: isHovered ? 0.85 : 0.35 }} />
          )}
        </div>
      </div>

      {/* 2. DOLGU KUŞAĞI OPSİYONLARI (Ortalanmış kurumsal haplar) */}
      {isKisa && (prog.availableOptions || []).length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          marginTop: '3px',
          textAlign: 'center'
        }}>
          {(prog.availableOptions || []).map(opt => {
            const isSelectedOption = (prog.selectedOptions || []).includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleOption(dateKey, prog.instanceId, opt, e);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '2px 6px',
                  borderRadius: '5px',
                  border: '1px solid',
                  borderColor: isSelectedOption ? 'rgba(8, 145, 178, 0.45)' : 'var(--border-color)',
                  background: isSelectedOption ? 'rgba(6, 182, 212, 0.13)' : 'var(--bg-primary)',
                  color: isSelectedOption ? '#0e7490' : 'var(--text-muted)',
                  fontSize: px(10),
                  fontWeight: 700,
                  cursor: 'pointer',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap'
                }}
                title={isSelectedOption ? `${opt} (Kaldırmak için tıkla)` : `${opt} (Eklemek için tıkla)`}
              >
                <span>{formatShortOptionLabel(opt)}</span>
                {isSelectedOption && <span style={{ fontSize: px(9), fontWeight: 900 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. ALT KISIM: ORTALANMIŞ BÖLÜM, PART VE SÜRE ROZETLERİ */}
      {!isKisa && (prog.episode || compactDurationLabel || !hideTimeBadge) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '5px',
          marginTop: 'auto',
          paddingTop: '4px',
          minWidth: 0,
          width: '100%',
          textAlign: 'center'
        }}>
          {!hideTimeBadge && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: px(10.5),
              fontWeight: 700,
              color: 'var(--accent-primary)',
              background: 'rgba(37, 99, 235, 0.1)',
              padding: '2px 6px',
              borderRadius: '5px',
              whiteSpace: 'nowrap',
              textAlign: 'center'
            }}>
              {prog.startTime}-{prog.endTime}
            </span>
          )}

          {/* Bölüm Rozeti (B. yerine Bölüm yazılır ve ortalanır) */}
          {prog.episode && (
            <span style={{
              fontFamily: 'var(--font-sans)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: px(11),
              fontWeight: 800,
              background: 'rgba(217, 119, 6, 0.14)',
              color: '#b45309',
              border: '1px solid rgba(217, 119, 6, 0.28)',
              padding: '2px 7px',
              borderRadius: '5px',
              whiteSpace: 'nowrap',
              textAlign: 'center'
            }}>
              Bölüm {prog.episode}
            </span>
          )}

          {/* Arşiv Bölüm/Part Toplam Süre Rozeti (Ortalanmış) */}
          {compactDurationLabel && (
            <span
              title={`Bölüm Toplam Süresi: ${prog.episodeDurationFormatted}${prog.partsCount > 1 ? ` (${prog.partsCount} Part Toplamı)` : ''}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: px(10.5),
                color: '#047857',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.13)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                padding: '2px 7px',
                borderRadius: '5px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                textAlign: 'center'
              }}
            >
              {compactDurationLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(DraftProgramCard);
