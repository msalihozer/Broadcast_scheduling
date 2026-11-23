/**
 * @file src/modules/broadcast/components/rundown/BroadcastRundownRow.jsx
 * @description Yayın akışı tablosundaki tekil yayın öğesi satırı, 4 ana kuşak ayracı
 * (Gece, Sabah, Gündüz, Akşam) ve program sınır çizgisi bileşeni.
 *
 * Sütun Düzeni:
 * 1. # (Seçim + Sürükleme + Sıra No)
 * 2. Yayın Saati (Başlangıç → Bitiş, tek satır şık görünüm)
 * 3. Süre (Hemen yayın saatinin yanında, tek tıkla düzenlenebilir)
 * 4. Klip / Program Adı (Sadece klip/program ismi; kategori ve açıklama kalabalığı yok)
 * 5. Bölüm / Part (Part, Bölüm, Cüz veya Gün rozetleri)
 * 6. Tür (Bölüm/Part'tan hemen sonra: Klip, Dolgu Klip, Dolgu, Reklam, Program)
 * 7. İşlemler (Üst üste binmeyen ferah butonlar ve çalışan ⓘ bilgi butonu)
 */
import React, { memo } from 'react';
import {
  Tv, ArrowUp, ArrowDown, Trash2, Edit2,
  Film, Megaphone, GripVertical, Check, Sparkles, Info, AlertTriangle, Pin, X
} from 'lucide-react';
import { formatFramesHuman } from '../../utils/timecodeUtils';
import useThemeStore, { hexToRgba, BOX_SHADOW_OPTIONS } from '../../../../store/themeStore';
import { getCategoryColor, getCategoryTitleTextColor } from '../../../draft/components/library/constants';
import {
  RUNDOWN_FLEX_COLUMNS,
  parseTimecodeDisplay,
  getHourPeriodLabel,
  resolveItemUnitDisplay
} from '../../utils/rundownHelpers';
import { normalizeProgramText } from '../../utils/draftSlotMatcher';

export function isFillerRundownItem(item) {
  if (!item) return false;
  if (item.type === 'filler_slot' || item.isKisaSlot) return true;
  const norm = normalizeProgramText(item.title || item.name || '');
  return norm.includes('dolgu kusagi') || norm === 'dolgu';
}

export function isFillerClipRundownItem(item) {
  if (!item || isFillerRundownItem(item)) return false;
  if (item.isFillerClip) return true;
  if (item.category === 'Dolgu Kuşağı') return true;
  if (item.note && String(item.note).startsWith('Dolgu Kuşağı')) return true;
  if (item.categoryColor === '#8b5cf6' && (item.type === 'clip' || Boolean(item.fileId))) return true;
  return false;
}

const BroadcastRundownRow = memo(function BroadcastRundownRow({
  item,
  idx,
  index,
  totalProgramsCount,
  isSelected,
  isMultiSelected,
  isDragOver,
  isNewPeriodBlock,
  isNewProgramBoundary,
  isEditingDuration,
  inlineDurationVal,
  setInlineDurationVal,
  setEditingDurationId,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleRowClick,
  handleToggleRowCheckbox,
  handleStepDurationMinutes,
  handleStartInlineDurationEdit,
  handleSaveInlineDuration,
  onMoveUp,
  onMoveDown,
  onEditProgram,
  onRemoveProgram,
  onOpenFillerModal,
  onInspectClip,
  onUnpinProgram,
  onUpdateRamadanMeta,
  showRamadanControls = false
}) {
  const isAd = item.type === 'ad_break';
  const isFiller = isFillerRundownItem(item);
  const isFillerClip = isFillerClipRundownItem(item);
  const isLive = Boolean(item.isLive || item.type === 'live');
  const isNotFound = Boolean(item.isNotFound);
  const isPinned = Boolean(item.isPinnedTime);
  const isIntroClip = Boolean(
    item.isIntroClip ||
    item.unitType === 'intro' ||
    /^semerkand_intro/i.test(String(item.clipName || item.title || item.name || ''))
  );
  const isClip = !isFiller && !isLive && !isNotFound && (item.type === 'clip' || Boolean(item.fileId));

  const effectiveRamadanProgType = !isAd && !isFiller && !isIntroClip
    ? (item.ramadanProgramType || (/sahur/i.test(item.title || item.name || '') ? 'sahur' : /iftar/i.test(item.title || item.name || '') ? 'iftar' : ''))
    : '';
  const effectiveRamadanBreakTag = isAd ? (item.ramadanBreakTag || '') : '';

  const themeConfig = useThemeStore(state => state.config);
  const sp = themeConfig?.specialColors || {};
  const readyMod = themeConfig?.modules?.ready || {};
  const adColor = readyMod.adBreakColor || sp.adBreakColor || '#f59e0b';
  const fillerColor = readyMod.fillerColor || sp.fillerSlotColor || '#8b5cf6';
  const liveColor = readyMod.liveColor || sp.liveColor || '#ef4444';
  const introColor = sp.introColor || '#6366f1';
  const clipColor = getCategoryColor(item.categoryName || item.category) || sp.clipColor || '#0d9488';
  const readyTitleColor = readyMod.useCategoryTitleColor !== false
    ? getCategoryTitleTextColor(item.categoryName || item.category)
    : null;
  const readyLeftAccent = Number(readyMod.leftAccentWidth) || 4;
  const readyTintAlpha = Math.max(0.03, Math.min(0.28, (Number(readyMod.cardTintOpacity) || 10) / 100));
  const readyShadowObj = BOX_SHADOW_OPTIONS.find(s => s.id === readyMod.boxShadow) || BOX_SHADOW_OPTIONS[0];

  const startInfo = parseTimecodeDisplay(item.calculatedStartTime);
  const endInfo = parseTimecodeDisplay(item.calculatedEndTime);
  const durInfo = parseTimecodeDisplay(item.durationTc);
  const readableDur = formatFramesHuman(item.durationFrames);
  const hourPeriod = getHourPeriodLabel(startInfo.hourNum);
  const resolvedUnit = resolveItemUnitDisplay(item);

  // Dolgu kuşağı, Canlı Yayın, Reklam Kuşağı ve İntro renkleri Admin Panel -> Temalar alanından yönetilir
  const rowAccentColor = isAd
    ? adColor
    : (isFiller || isFillerClip)
    ? fillerColor
    : isNotFound
    ? '#ea580c'
    : isLive
    ? liveColor
    : isIntroClip
    ? introColor
    : item.isOverflow
    ? '#ef4444'
    : isClip
    ? clipColor
    : (item.categoryColor || '#3b82f6');

  const displayName = isLive
    ? (item.title || item.name || item.clipName || 'Canlı Yayın')
    : (item.clipName || item.title || item.name || 'İsimsiz İçerik');
  const liveDetailsText = isLive
    ? ([item.host, item.topic].filter(Boolean).join(' • ') || (item.note && item.note !== 'Canlı Yayın' ? item.note : ''))
    : '';

  const actionBtnStyle = {
    width: '23px',
    height: '23px',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: '1px solid transparent',
    background: 'transparent',
    padding: 0,
    cursor: 'pointer'
  };

  return (
    <>
      {/* 4 ANA GÜN KUŞAĞI BAŞLIĞI (Sadece Gece / Sabah / Gündüz / Akşam geçişlerinde gösterilir) */}
      {isNewPeriodBlock && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 14px',
          background: `linear-gradient(90deg, ${hourPeriod.color}18 0%, var(--bg-tertiary) 70%)`,
          borderTop: idx === 0 ? 'none' : `2px solid ${hourPeriod.color}55`,
          borderBottom: `1.5px solid ${hourPeriod.color}35`,
          borderLeft: `5px solid ${hourPeriod.color}`,
          fontSize: '12.5px',
          fontWeight: '800',
          color: 'var(--text-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              background: hourPeriod.color,
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '900',
              letterSpacing: '0.4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>{hourPeriod.icon}</span>
              <span>{hourPeriod.label}</span>
            </span>
            <span style={{
              color: 'var(--text-secondary)',
              fontSize: '12.5px',
              fontWeight: '700',
              fontFamily: 'monospace'
            }}>
              {hourPeriod.range}
            </span>
          </div>
          <div style={{
            flex: 1,
            height: '1px',
            background: `linear-gradient(90deg, ${hourPeriod.color}40 0%, transparent 100%)`,
            marginLeft: '14px'
          }} />
        </div>
      )}

      {/* FARKLI PROGRAMA GEÇİŞ AYRAÇ ÇİZGİSİ */}
      {!isNewPeriodBlock && isNewProgramBoundary && (
        <div style={{
          height: '2px',
          background: `linear-gradient(90deg, ${rowAccentColor}75 0%, var(--border-color) 50%, transparent 100%)`
        }} />
      )}

      {/* ANA YAYIN SATIRI (FLEX TABLO SATIRI) */}
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDrop={(e) => handleDrop(e, index)}
        onClick={(e) => handleRowClick(e, item, index)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: readyMod.cardPadding || ((isSelected || isMultiSelected) ? '8px 10px' : '7px 10px'),
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: (isSelected || isMultiSelected) ? 5 : 1,
          borderTop: isDragOver
            ? '3px solid var(--accent-primary)'
            : (isSelected || isMultiSelected)
            ? '2px solid #3b82f6'
            : 'none',
          borderBottom: (isSelected || isMultiSelected)
            ? '2px solid #3b82f6'
            : '1px solid var(--border-color)',
          borderRight: (isSelected || isMultiSelected)
            ? '2px solid #3b82f6'
            : 'none',
          background: (isSelected || isMultiSelected)
            ? 'linear-gradient(90deg, rgba(37, 99, 235, 0.26) 0%, rgba(59, 130, 246, 0.15) 60%, rgba(37, 99, 235, 0.22) 100%)'
            : isNotFound
            ? 'rgba(234, 88, 12, 0.10)'
            : isLive
            ? hexToRgba(liveColor, readyTintAlpha)
            : isIntroClip
            ? hexToRgba(introColor, readyTintAlpha * 0.7)
            : (isFiller || isFillerClip)
            ? hexToRgba(fillerColor, readyTintAlpha)
            : isAd
            ? hexToRgba(adColor, readyTintAlpha)
            : item.isOverflow
            ? 'rgba(239, 68, 68, 0.08)'
            : `linear-gradient(90deg, ${hexToRgba(rowAccentColor, readyTintAlpha * 0.65)} 0%, var(--bg-primary) 75%)`,
          borderLeft: (isMultiSelected || isSelected)
            ? '6px solid #2563eb'
            : `${readyLeftAccent}px solid ${rowAccentColor}`,
          boxShadow: (isSelected || isMultiSelected)
            ? '0 0 0 2px rgba(59, 130, 246, 0.28), 0 4px 14px rgba(37, 99, 235, 0.18)'
            : readyShadowObj.value,
          fontFamily: 'var(--ready-font-sans, var(--font-sans))',
          cursor: 'pointer',
          fontSize: '13.5px',
          transition: 'all 0.14s ease'
        }}
      >
        {/* 1. Sıra, Seçim Kutusu & Sürükleme Tutamacı */}
        <div style={{ ...RUNDOWN_FLEX_COLUMNS.order, display: 'flex', alignItems: 'center', gap: '3px' }}>
          <input
            type="checkbox"
            checked={isMultiSelected || isSelected}
            onChange={(e) => handleToggleRowCheckbox(e, item.instanceId, index)}
            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0 }}
          />
          <GripVertical size={12} color={(isSelected || isMultiSelected) ? '#2563eb' : 'var(--text-secondary)'} style={{ cursor: 'grab', flexShrink: 0, opacity: (isSelected || isMultiSelected) ? 1 : 0.65 }} />
          <span style={{
            fontFamily: 'monospace',
            fontWeight: '900',
            color: (isSelected || isMultiSelected) ? '#ffffff' : 'var(--text-secondary)',
            background: (isSelected || isMultiSelected) ? '#2563eb' : 'transparent',
            padding: (isSelected || isMultiSelected) ? '1px 4px' : '0',
            borderRadius: '4px',
            fontSize: '11.5px',
            boxShadow: (isSelected || isMultiSelected) ? '0 2px 6px rgba(37, 99, 235, 0.35)' : 'none'
          }}>
            {item.order}
          </span>
        </div>

        {/* 2. YAYIN SAATİ (Başlangıç → Bitiş, tek satır şık kapsül) */}
        <div style={{ ...RUNDOWN_FLEX_COLUMNS.time }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: isPinned ? 'rgba(245, 158, 11, 0.14)' : 'var(--bg-secondary)',
            border: `1.5px solid ${isPinned ? '#f59e0b' : isSelected ? 'var(--accent-primary)' : (isFiller || isFillerClip) ? 'rgba(139, 92, 246, 0.35)' : 'var(--border-color)'}`,
            borderLeft: `3px solid ${isPinned ? '#d97706' : rowAccentColor}`,
            padding: '4px 7px',
            borderRadius: '7px',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap'
          }}>
            {isPinned && (
              <Pin size={11} color="#d97706" style={{ flexShrink: 0 }} title="Bu saat sabitlenmiştir" />
            )}
            <span style={{
              fontFamily: 'monospace',
              fontSize: '12.5px',
              fontWeight: '900',
              color: isPinned ? '#d97706' : 'var(--text-primary)',
              letterSpacing: '0.1px'
            }}>
              {startInfo.hhmm}:{startInfo.ss}
            </span>

            <span style={{
              color: isPinned ? '#d97706' : rowAccentColor,
              fontWeight: '900',
              fontSize: '11.5px'
            }}>
              →
            </span>

            <span style={{
              fontFamily: 'monospace',
              fontSize: '12.5px',
              fontWeight: '900',
              color: item.isOverflow ? '#ef4444' : isPinned ? '#b45309' : 'var(--text-secondary)',
              letterSpacing: '0.1px'
            }}>
              {endInfo.hhmm}:{endInfo.ss}
            </span>
          </div>
        </div>

        {/* 3. SÜRE (Yayın Saati'nin hemen yanında) */}
        <div
          style={{ ...RUNDOWN_FLEX_COLUMNS.duration, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}
          onClick={(e) => e.stopPropagation()}
        >
          {isEditingDuration ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                autoFocus
                value={inlineDurationVal}
                onChange={(e) => setInlineDurationVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveInlineDuration(item);
                  if (e.key === 'Escape') setEditingDurationId(null);
                }}
                onBlur={() => handleSaveInlineDuration(item)}
                placeholder={isAd ? 'Dk (Ör: 5)' : '00.30.00.00'}
                style={{
                  width: isAd ? '64px' : '96px',
                  padding: '4px 7px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--accent-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '12.5px',
                  fontWeight: '800',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSaveInlineDuration(item);
                }}
                style={{
                  background: '#10b981',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '5px',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Süreyi Kaydet"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', minWidth: 0, maxWidth: '100%' }}>
              {isAd && (
                <button
                  type="button"
                  onClick={(e) => handleStepDurationMinutes(e, item, -1)}
                  title="Süreyi 1 dakika azalt"
                  style={{
                    padding: '3px 5px',
                    borderRadius: '5px',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    background: 'rgba(245, 158, 11, 0.14)',
                    color: '#d97706',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  -1
                </button>
              )}

              <button
                type="button"
                onClick={(e) => handleStartInlineDurationEdit(e, item)}
                title={`Timecode: ${durInfo.fullColon} — Süreyi düzenlemek için tıklayın`}
                style={{
                  fontWeight: '800',
                  fontSize: '12.5px',
                  color: isAd
                    ? '#d97706'
                    : (isFiller || isFillerClip)
                    ? '#8b5cf6'
                    : '#059669',
                  background: isAd
                    ? 'rgba(245, 158, 11, 0.15)'
                    : (isFiller || isFillerClip)
                    ? 'rgba(139, 92, 246, 0.14)'
                    : 'rgba(16, 185, 129, 0.12)',
                  border: isAd
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : (isFiller || isFillerClip)
                    ? '1px solid rgba(139, 92, 246, 0.35)'
                    : '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  minWidth: 0
                }}
              >
                <span>{readableDur}</span>
                <Edit2 size={10} style={{ opacity: 0.65, flexShrink: 0 }} />
              </button>

              {isAd && (
                <button
                  type="button"
                  onClick={(e) => handleStepDurationMinutes(e, item, 1)}
                  title="Süreyi 1 dakika artır"
                  style={{
                    padding: '3px 5px',
                    borderRadius: '5px',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    background: 'rgba(245, 158, 11, 0.14)',
                    color: '#d97706',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  +1
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4. KLİP / PROGRAM ADI (Canlı Yayınlarda Program + Canlı Rozeti + Detaylar, Bulunamayan Programlarda Uyarı Rozeti gösterilir) */}
        <div style={{ ...RUNDOWN_FLEX_COLUMNS.title, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontWeight: '800',
                fontSize: '13.5px',
                color: isAd
                  ? adColor
                  : isNotFound
                  ? '#ea580c'
                  : isLive
                  ? liveColor
                  : isIntroClip
                  ? introColor
                  : (isFiller || isFillerClip)
                  ? fillerColor
                  : (readyTitleColor || 'var(--text-primary)'),
                lineHeight: '1.3',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
              }}
              title={displayName}
            >
              {displayName}
            </span>

            {isNotFound && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: '900',
                  background: 'rgba(234, 88, 12, 0.16)',
                  color: '#ea580c',
                  border: '1px solid rgba(234, 88, 12, 0.45)',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap'
                }}
                title={item.notFoundReason || 'Bu program veya bölümü için arşivde eşleşen klip bulunamadı'}
              >
                <AlertTriangle size={12} />
                <span>PROGRAM / KLİP BULUNAMADI</span>
              </span>
            )}

            {(isSelected || isMultiSelected) && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '10.5px',
                fontWeight: '900',
                background: '#2563eb',
                color: '#ffffff',
                padding: '2px 7px',
                borderRadius: '5px',
                letterSpacing: '0.4px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                whiteSpace: 'nowrap'
              }}>
                ✓ SEÇİLİ
              </span>
            )}

            {isPinned && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUnpinProgram) onUnpinProgram(item.instanceId);
                }}
                title="Bu öğenin saati sabitlendi (Üst ve alttaki değişikliklerden etkilenmez). Sabitlemeyi kaldırmak için tıklayın."
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  fontWeight: '900',
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  letterSpacing: '0.3px',
                  boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Pin size={11} />
                <span>SABİT: {startInfo.hhmm}:{startInfo.ss}</span>
                <X size={11} style={{ marginLeft: '2px', opacity: 0.9 }} />
              </button>
            )}

            {isLive && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: '900',
                background: '#ef4444',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '5px',
                letterSpacing: '0.3px',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)',
                whiteSpace: 'nowrap'
              }}>
                ● CANLI YAYIN
              </span>
            )}

            {/* Ramazan Sahur / İftar Program Rozeti ve Hızlı Seçici (Sadece Ramazan tarihine 2 hafta kala veya Ramazan döneminde görünür) */}
            {showRamadanControls && !isAd && !isFiller && !isIntroClip && (effectiveRamadanProgType || isLive) && (
              <select
                value={effectiveRamadanProgType}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  if (onUpdateRamadanMeta) {
                    onUpdateRamadanMeta(item.instanceId, { ramadanProgramType: e.target.value });
                  }
                }}
                title="Bu programın Ramazan Sahur veya İftar programı olduğunu belirleyin (Program başlangıç saati reklam algoritmasına referans olur)"
                style={{
                  fontSize: '10.5px',
                  fontWeight: '900',
                  padding: '2px 7px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  outline: 'none',
                  background: effectiveRamadanProgType === 'sahur'
                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                    : effectiveRamadanProgType === 'iftar'
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : 'var(--bg-secondary)',
                  color: effectiveRamadanProgType ? '#ffffff' : 'var(--text-secondary)',
                  border: effectiveRamadanProgType ? '1px solid rgba(255,255,255,0.28)' : '1px dashed var(--border-color)'
                }}
              >
                <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>🌙 Ramazan İşareti Yok</option>
                <option value="sahur" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 SAHUR PROGRAMI (Başlangıç: {startInfo.hhmm})</option>
                <option value="iftar" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 İFTAR PROGRAMI (Başlangıç: {startInfo.hhmm})</option>
              </select>
            )}

            {/* Reklam Kuşağı Üzerinde Doğrudan Ramazan Özel İşaretleme Seçicisi (Sadece Ramazan tarihine 2 hafta kala veya Ramazan döneminde görünür) */}
            {showRamadanControls && isAd && (
              <select
                value={effectiveRamadanBreakTag}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  if (onUpdateRamadanMeta) {
                    onUpdateRamadanMeta(item.instanceId, { ramadanBreakTag: e.target.value });
                  }
                }}
                title="Bu reklam kuşağını Ramazan Özel (Sahur / İftar Öncesi, Arası, Sonrası) olarak işaretleyin"
                style={{
                  fontSize: '11px',
                  fontWeight: '900',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  outline: 'none',
                  background: effectiveRamadanBreakTag.startsWith('sahur')
                    ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                    : effectiveRamadanBreakTag.startsWith('iftar')
                    ? 'linear-gradient(135deg, #d97706, #b45309)'
                    : 'rgba(245, 158, 11, 0.12)',
                  color: effectiveRamadanBreakTag ? '#ffffff' : '#d97706',
                  border: effectiveRamadanBreakTag ? '1px solid rgba(255,255,255,0.3)' : '1px dashed rgba(245, 158, 11, 0.5)'
                }}
              >
                <option value="" style={{ background: '#1e293b', color: '#f8fafc' }}>🌙 Ramazan Özel İşaretle...</option>
                <option value="sahur_before" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 RAMAZAN: SAHUR ÖNCESİ KUŞAĞI</option>
                <option value="sahur_middle" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 RAMAZAN: SAHUR ARASI KUŞAĞI</option>
                <option value="sahur_after" style={{ background: '#1e293b', color: '#38bdf8' }}>🌙 RAMAZAN: SAHUR SONRASI KUŞAĞI</option>
                <option value="iftar_before" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 RAMAZAN: İFTAR ÖNCESİ KUŞAĞI</option>
                <option value="iftar_middle" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 RAMAZAN: İFTAR ARASI KUŞAĞI</option>
                <option value="iftar_after" style={{ background: '#1e293b', color: '#fbbf24' }}>🕌 RAMAZAN: İFTAR SONRASI KUŞAĞI</option>
              </select>
            )}

            {(isFiller || isFillerClip) && onOpenFillerModal && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFillerModal(item);
                }}
                title="Bu Dolgu Kuşağına Sol Panelden Kısa Program veya Klip Seçip Eklemek İçin Tıklayın"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: isFiller
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                    : 'rgba(139, 92, 246, 0.16)',
                  color: isFiller ? '#ffffff' : '#7c3aed',
                  border: isFiller
                    ? '1px solid rgba(255, 255, 255, 0.25)'
                    : '1px solid rgba(139, 92, 246, 0.4)',
                  padding: isFiller ? '5px 12px' : '3px 9px',
                  borderRadius: '7px',
                  fontSize: isFiller ? '12px' : '11px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: isFiller ? '0 3px 10px rgba(139, 92, 246, 0.35)' : 'none'
                }}
              >
                <Sparkles size={12} />
                <span>{isFiller ? 'Klip Seç ve Doldur' : '+ Bu Dolguya Klip Ekle'}</span>
              </button>
            )}
          </div>

          {isNotFound && item.notFoundReason && (
            <div style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#ea580c',
              lineHeight: 1.25
            }}>
              {item.notFoundReason} (Listeden kaldırılmadı, sol panelden farklı klip seçebilirsiniz)
            </div>
          )}

          {isLive && liveDetailsText && (
            <div style={{
              fontSize: '12.5px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              lineHeight: 1.25
            }}>
              {liveDetailsText}
            </div>
          )}
        </div>

        {/* 5. BÖLÜM / PART ROZETLERİ */}
        <div style={{ ...RUNDOWN_FLEX_COLUMNS.unit, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {isIntroClip ? (
            <span style={{
              background: 'rgba(99, 102, 241, 0.16)',
              color: '#4f46e5',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              whiteSpace: 'nowrap'
            }}>
              İntro
            </span>
          ) : null}
          {!isIntroClip && item.partNo ? (
            <span style={{
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              whiteSpace: 'nowrap'
            }}>
              PART {item.partNo}
            </span>
          ) : null}
          {!isIntroClip && resolvedUnit.unitLabel ? (
            <span style={{
              background: resolvedUnit.unitType === 'cuz'
                ? 'rgba(16, 185, 129, 0.14)'
                : resolvedUnit.unitType === 'gun'
                  ? 'rgba(139, 92, 246, 0.14)'
                  : isLive
                    ? 'rgba(239, 68, 68, 0.14)'
                    : 'rgba(59, 130, 246, 0.14)',
              color: resolvedUnit.unitType === 'cuz'
                ? '#10b981'
                : resolvedUnit.unitType === 'gun'
                  ? '#8b5cf6'
                  : isLive
                    ? '#dc2626'
                    : 'var(--accent-primary)',
              border: resolvedUnit.unitType === 'cuz'
                ? '1px solid rgba(16, 185, 129, 0.35)'
                : resolvedUnit.unitType === 'gun'
                  ? '1px solid rgba(139, 92, 246, 0.35)'
                  : isLive
                    ? '1px solid rgba(239, 68, 68, 0.35)'
                    : '1px solid rgba(59, 130, 246, 0.32)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              whiteSpace: 'nowrap'
            }}>
              {resolvedUnit.unitLabel}
            </span>
          ) : null}
          {!isIntroClip && !item.partNo && !resolvedUnit.unitLabel && (
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
          )}
        </div>

        {/* 6. TÜR ROZETİ (Bölüm ve Part'tan hemen sonra) */}
        <div style={{ ...RUNDOWN_FLEX_COLUMNS.type }}>
          {isAd ? (
            <span style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Megaphone size={13} color="#d97706" />
              <span>Reklam</span>
            </span>
          ) : isNotFound ? (
            <span style={{
              background: 'rgba(234, 88, 12, 0.18)',
              color: '#ea580c',
              border: '1px solid rgba(234, 88, 12, 0.45)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '900',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <AlertTriangle size={13} color="#ea580c" />
              <span>Bulunamadı</span>
            </span>
          ) : isLive ? (
            <span style={{
              background: 'rgba(239, 68, 68, 0.18)',
              color: '#dc2626',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '900',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Tv size={13} color="#dc2626" />
              <span>Canlı Yayın</span>
            </span>
          ) : isIntroClip ? (
            <span style={{
              background: 'rgba(99, 102, 241, 0.16)',
              color: '#4f46e5',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Film size={13} color="#4f46e5" />
              <span>İntro</span>
            </span>
          ) : isFiller ? (
            <span style={{
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Sparkles size={13} color="#8b5cf6" />
              <span>Dolgu</span>
            </span>
          ) : isFillerClip ? (
            <span style={{
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.45)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Sparkles size={13} color="#8b5cf6" />
              <span>Dolgu Klip</span>
            </span>
          ) : isClip ? (
            <span style={{
              background: 'rgba(13, 148, 136, 0.16)',
              color: '#0d9488',
              border: '1px solid rgba(13, 148, 136, 0.38)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Film size={13} color="#0d9488" />
              <span>Klip</span>
            </span>
          ) : (
            <span style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap'
            }}>
              <Tv size={13} color="var(--accent-primary)" />
              <span>Program</span>
            </span>
          )}
        </div>

        {/* 7. İŞLEMLER (Ferah, üst üste binmeyen butonlar ve çalışan ⓘ bilgi butonu) */}
        <div
          style={{
            ...RUNDOWN_FLEX_COLUMNS.actions,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '2px'
          }}
          onClick={e => e.stopPropagation()}
        >
          {!isAd && !isFiller && onInspectClip && (
            <button
              type="button"
              onClick={() => onInspectClip(item)}
              title="Klip Detayları, Veritabanı Metadataları & Video Önizleme (ⓘ)"
              style={{
                ...actionBtnStyle,
                background: 'rgba(59, 130, 246, 0.14)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: 'var(--accent-primary)'
              }}
            >
              <Info size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onMoveUp(item.instanceId)}
            disabled={index === 0}
            title="Yukarı Taşı (Alt+↑)"
            style={{
              ...actionBtnStyle,
              color: 'var(--text-secondary)',
              cursor: index === 0 ? 'not-allowed' : 'pointer',
              opacity: index === 0 ? 0.25 : 1
            }}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(item.instanceId)}
            disabled={index === totalProgramsCount - 1}
            title="Aşağı Taşı (Alt+↓)"
            style={{
              ...actionBtnStyle,
              color: 'var(--text-secondary)',
              cursor: index === totalProgramsCount - 1 ? 'not-allowed' : 'pointer',
              opacity: index === totalProgramsCount - 1 ? 0.25 : 1
            }}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            onClick={() => onEditProgram(item)}
            title="Düzenle"
            style={{
              ...actionBtnStyle,
              color: 'var(--text-secondary)'
            }}
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => onRemoveProgram(item.instanceId)}
            title="Listeden Kaldır (Delete)"
            style={{
              ...actionBtnStyle,
              color: '#ef4444'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  );
});

export default BroadcastRundownRow;
