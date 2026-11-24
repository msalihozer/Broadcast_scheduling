/**
 * @file DraftProgramCard.jsx
 * @description Semerkand TV Kurumsal Kimlik 2026 - Taslak Planlama kurumsal program kartı (.pc).
 * - 11 kategori rengine göre %12 tint zemin, %34 kenarlık, 5px sol dikey şerit ve kategori başlık rengi
 * - Dolgu kuşağı (#109AAD) için kesikli (dashed) kenarlık
 * - Canlı yayın (#DD1C40) için CANLI rozeti
 * - Roboto Mono tabular-nums saat ve süre rozetleri
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
import { getProgramColor, getCategoryTitleTextColor } from './library/constants';
import useThemeStore, { hexToRgba } from '../../../store/themeStore';

function formatCompactArchiveDuration(formattedStr, partsCount) {
  if (!formattedStr) return '';
  const clean = String(formattedStr).replace(/\s+/g, ' ').trim();
  if (partsCount && partsCount > 1) {
    return `${partsCount} Part • ${clean}`;
  }
  return clean;
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
  const draftTheme = useThemeStore(state => state.config?.modules?.draft) || {};
  const boxRadius = draftTheme.boxRadius || '4px';
  const cardPadding = draftTheme.cardPadding || (isKisa ? '6px 8px' : '7px 9px');
  const borderWidth = Number(draftTheme.borderWidth) || 1;
  const leftAccentWidth = Number(draftTheme.leftAccentWidth) || 5;
  const tintAlpha = Math.max(0.06, Math.min(0.28, (Number(draftTheme.cardTintOpacity) || 12) / 100));
  const categoryTitleColor = draftTheme.useCategoryTitleColor !== false
    ? getCategoryTitleTextColor(prog)
    : null;

  const cardBg = isSelected
    ? hexToRgba(progColor, Math.min(0.26, tintAlpha + 0.1))
    : isDragOver
    ? 'var(--turkuaz-50, #E7F0F3)'
    : isHovered
    ? hexToRgba(progColor, Math.min(0.20, tintAlpha + 0.05))
    : hexToRgba(progColor, tintAlpha);

  const cardBorder = isSelected
    ? progColor
    : isDragOver
    ? 'var(--turkuaz, #0C617C)'
    : hexToRgba(progColor, 0.34);

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
        borderStyle: isKisa ? 'dashed' : 'solid',
        borderWidth: `${borderWidth}px`,
        borderColor: cardBorder,
        borderLeftStyle: 'solid',
        borderLeftWidth: `${leftAccentWidth}px`,
        borderLeftColor: progColor,
        borderTop: isDragOver && !localDropAfter ? '2px solid var(--turkuaz, #0C617C)' : undefined,
        borderBottom: isDragOver && localDropAfter ? '2px solid var(--turkuaz, #0C617C)' : undefined,
        borderRadius: boxRadius,
        padding: cardPadding,
        cursor: 'grab',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '4px',
        opacity: isDragging ? 0.35 : 1,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* YÜZER HIZLI İŞLEM ÇUBUĞU (Hover) */}
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
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderRadius: '4px',
            padding: '2px'
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
                  background: 'transparent',
                  border: 0,
                  width: '20px',
                  height: '20px',
                  borderRadius: '3px',
                  color: canMoveUp ? 'var(--yesil, #468625)' : 'var(--text-muted)',
                  opacity: canMoveUp ? 1 : 0.35,
                  cursor: canMoveUp ? 'pointer' : 'not-allowed',
                  display: 'grid',
                  placeItems: 'center'
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
                  background: 'transparent',
                  border: 0,
                  width: '20px',
                  height: '20px',
                  borderRadius: '3px',
                  color: canMoveDown ? 'var(--yesil, #468625)' : 'var(--text-muted)',
                  opacity: canMoveDown ? 1 : 0.35,
                  cursor: canMoveDown ? 'pointer' : 'not-allowed',
                  display: 'grid',
                  placeItems: 'center'
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
              background: 'transparent',
              border: 0,
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              color: 'var(--turkuaz, #0C617C)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center'
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
              border: 0,
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center'
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
              border: 0,
              width: '20px',
              height: '20px',
              borderRadius: '3px',
              color: 'var(--danger, #DD1C40)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center'
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
              color: isHovered ? 'var(--turkuaz, #0C617C)' : 'var(--text-muted)',
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
                  fontFamily: 'var(--font-sans)',
                  fontSize: px(isKisa ? 12 : 12.5),
                  fontWeight: 700,
                  margin: 0,
                  color: isKisa
                    ? '#0B6C79'
                    : isLive
                    ? '#DD1C40'
                    : (categoryTitleColor || 'var(--text-primary, #0A101D)'),
                  lineHeight: 1.25,
                  letterSpacing: '-0.01em',
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
                  fontWeight: 700,
                  background: '#DD1C40',
                  color: '#FFFFFF',
                  padding: '1px 5px',
                  borderRadius: '2px',
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap'
                }}>
                  CANLI
                </span>
              )}
            </div>

            {!isKisa && (prog.topic || prog.host) && (
              <div
                title={`${prog.host || ''}${prog.host && prog.topic ? ' • ' : ''}${prog.topic || ''}`}
                style={{
                  fontSize: px(10.5),
                  color: 'var(--text-secondary, #4B6478)',
                  lineHeight: 1.25,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {prog.host && <span style={{ fontWeight: 700 }}>{prog.host}</span>}
                {prog.host && prog.topic && ' • '}
                {prog.topic}
              </div>
            )}
          </div>
        </div>

        {/* Seçim Kutusu */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect && onToggleSelect(dateKey, targetId, e);
          }}
          title={isSelected ? 'Seçimi Kaldır' : 'Kuşağı Seç'}
          style={{
            cursor: 'pointer',
            color: isSelected ? 'var(--turkuaz, #0C617C)' : 'var(--text-muted)',
            display: 'grid',
            placeItems: 'center',
            width: '18px',
            height: '18px',
            flexShrink: 0
          }}
        >
          {isSelected ? (
            <CheckSquare size={14} style={{ color: 'var(--turkuaz, #0C617C)' }} />
          ) : (
            <Square size={14} style={{ opacity: isHovered ? 0.85 : 0.35 }} />
          )}
        </div>
      </div>

      {/* 2. DOLGU KUŞAĞI OPSİYONLARI */}
      {isKisa && (prog.availableOptions || []).length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '3px',
          marginTop: '2px'
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
                  gap: '3px',
                  padding: '1px 5px',
                  borderRadius: '2px',
                  border: '1px solid',
                  borderColor: isSelectedOption ? 'rgba(16, 154, 173, 0.45)' : 'var(--border-color, #DCE5E9)',
                  background: isSelectedOption ? 'rgba(255, 255, 255, 0.78)' : '#FFFFFF',
                  color: isSelectedOption ? '#0B6C79' : 'var(--text-muted, #6A7C88)',
                  fontSize: px(9.5),
                  fontWeight: 700,
                  cursor: 'pointer',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{opt}</span>
                {isSelectedOption && <span style={{ fontSize: px(9) }}>Tamam</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. ALT KISIM: BÖLÜM, PART VE SÜRE ROZETLERİ */}
      {!isKisa && (prog.episode || compactDurationLabel || !hideTimeBadge) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          marginTop: 'auto',
          paddingTop: '2px',
          minWidth: 0,
          width: '100%'
        }}>
          {!hideTimeBadge && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: px(10),
              fontWeight: 700,
              color: 'var(--turkuaz, #0C617C)',
              background: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(10, 16, 29, 0.1)',
              padding: '1px 5px',
              borderRadius: '2px',
              whiteSpace: 'nowrap'
            }}>
              {prog.startTime}-{prog.endTime}
            </span>
          )}

          {prog.episode && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: px(9.5),
              fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.78)',
              color: 'var(--text-primary, #0A101D)',
              border: '1px solid rgba(10, 16, 29, 0.1)',
              padding: '1px 5px',
              borderRadius: '2px',
              whiteSpace: 'nowrap'
            }}>
              Bölüm {prog.episode}
            </span>
          )}

          {compactDurationLabel && (
            <span
              title={`Bölüm Toplam Süresi: ${prog.episodeDurationFormatted}${prog.partsCount > 1 ? ` (${prog.partsCount} Part Toplamı)` : ''}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: px(9.5),
                color: 'var(--text-primary, #0A101D)',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.78)',
                border: '1px solid rgba(10, 16, 29, 0.1)',
                padding: '1px 5px',
                borderRadius: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%'
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
