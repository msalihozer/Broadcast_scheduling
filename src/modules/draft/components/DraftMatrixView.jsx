/**
 * @file DraftMatrixView.jsx
 * @description Taslak Planlama Kurumsal Haftalık Akış Matrisi.
 *
 * Temel Özellikler:
 * 1. Tam Ekran Sığdırma (Zero Overflow):
 *    - Kütüphane kapalıyken 7 günün tamamı ekrana %100 tam oturur (minmax(0, 1fr)), taşma yapmaz
 * 2. Her Günün Solunda Kompakt Dinamik Saat Şeridi (52px):
 *    - JetBrains Mono tabular-nums tipografi ile net başlangıç, bitiş ve süre gösterimi
 *    - Saatler sabit değil, o güne eklenen programın gerçek süresine göre dinamik değişir
 * 3. Kurumsal SaaS Görünümü:
 *    - Gün doluluk ilerleme çubuğu (progress bar), zarif kuşak başlıkları ve sıfır çakışma
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Clock,
  CheckSquare,
  Square,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  Plus,
  Send,
  CornerDownRight
} from 'lucide-react';
import DraftProgramCard from './DraftProgramCard';
import { getProgramColor } from './library/constants';
import useThemeStore from '../../../store/themeStore';

const TIME_COL_WIDTH = '52px';

// Dakikaya dönüştürme yardımcısı (HH:MM -> minute)
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(val => parseInt(val, 10) || 0);
  return h * 60 + m;
};

// Dakikadan saat stringine dönüştürme (minute -> HH:MM)
const minutesToTime = (min) => {
  if (min >= 1440) return '24:00';
  const safeMin = Math.max(0, Math.round(min));
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// 4 Ana Yayın Kuşağı Tanımı (Semerkand TV Kurumsal 2026)
const KUŞAK_PERIODS = [
  {
    id: 'night',
    label: 'Gece Yayın Kuşağı (00:00 - 06:00)',
    shortLabel: 'Gece',
    icon: Moon,
    color: '#0B2B54',
    textColor: '#FFFFFF',
    startMinute: 0,
    endMinute: 360
  },
  {
    id: 'morning',
    label: 'Sabah Yayın Kuşağı (06:00 - 12:00)',
    shortLabel: 'Sabah',
    icon: Sunrise,
    color: '#E8B44C',
    textColor: '#0A101D',
    startMinute: 360,
    endMinute: 720
  },
  {
    id: 'afternoon',
    label: 'Öğle Yayın Kuşağı (12:00 - 18:00)',
    shortLabel: 'Öğle',
    icon: Sun,
    color: '#109AAD',
    textColor: '#FFFFFF',
    startMinute: 720,
    endMinute: 1080
  },
  {
    id: 'evening',
    label: 'Akşam & Prime Time Kuşağı (18:00 - 24:00)',
    shortLabel: 'Akşam',
    icon: Sunset,
    color: '#0C617C',
    textColor: '#FFFFFF',
    startMinute: 1080,
    endMinute: 1440
  }
];

// Dakikayı "X sa Y dk" formatına çevirir
const formatHoursAndMins = (mins) => {
  const safe = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h} sa ${m} dk`;
  if (h > 0) return `${h} sa`;
  return `${m} dk`;
};

// Her güne özel açık/pastel (koyu olmayan) çizgi ve saat sütunu renk teması
const DAY_THEMES = {
  Pazartesi: {
    line: '#7dd3fc',         // Açık gökyüzü mavisi çizgi
    border: '#bae6fd',       // Pastel mavi iç kenarlık
    timeBg: '#e0f2fe',       // Saat sütunu açık pastel mavi
    headerBg: '#f0f9ff',     // Üst başlık çok açık mavi
    subHeaderBg: '#e0f2fe',  // Kuşak alt başlığı pastel mavi
    textAccent: '#0369a1'
  },
  Salı: {
    line: '#c4b5fd',         // Açık lavanta/lila çizgi
    border: '#ddd6fe',       // Pastel lila iç kenarlık
    timeBg: '#ede9fe',       // Saat sütunu açık pastel lila
    headerBg: '#f5f3ff',     // Üst başlık çok açık lila
    subHeaderBg: '#ede9fe',
    textAccent: '#6d28d9'
  },
  Çarşamba: {
    line: '#67e8f9',         // Açık turkuaz/su yeşili çizgi
    border: '#a5f3fc',       // Pastel turkuaz iç kenarlık
    timeBg: '#cffafe',       // Saat sütunu açık pastel turkuaz
    headerBg: '#ecfeff',     // Üst başlık çok açık turkuaz
    subHeaderBg: '#cffafe',
    textAccent: '#0e7490'
  },
  Perşembe: {
    line: '#86efac',         // Açık nane yeşili çizgi
    border: '#bbf7d0',       // Pastel yeşil iç kenarlık
    timeBg: '#dcfce7',       // Saat sütunu açık pastel yeşil
    headerBg: '#f0fdf4',     // Üst başlık çok açık yeşil
    subHeaderBg: '#dcfce7',
    textAccent: '#15803d'
  },
  Cuma: {
    line: '#fcd34d',         // Açık şeftali/kehribar sarısı çizgi
    border: '#fde68a',       // Pastel sarı iç kenarlık
    timeBg: '#fef3c7',       // Saat sütunu açık pastel sarı
    headerBg: '#fffbeb',     // Üst başlık çok açık krem-sarı
    subHeaderBg: '#fef3c7',
    textAccent: '#b45309'
  },
  Cumartesi: {
    line: '#fda4af',         // Açık pudra/gül pembesi çizgi
    border: '#fecdd3',       // Pastel pembe iç kenarlık
    timeBg: '#ffe4e6',       // Saat sütunu açık pastel pembe
    headerBg: '#fff1f2',     // Üst başlık çok açık pudra
    subHeaderBg: '#ffe4e6',
    textAccent: '#be123c'
  },
  Pazar: {
    line: '#a5b4fc',         // Açık eflatun-mavi (periwinkle) çizgi
    border: '#c7d2fe',       // Pastel eflatun iç kenarlık
    timeBg: '#e0e7ff',       // Saat sütunu açık pastel eflatun
    headerBg: '#eef2ff',     // Üst başlık çok açık eflatun
    subHeaderBg: '#e0e7ff',
    textAccent: '#4338ca'
  }
};

const getDayTheme = (dayName, dayIdx = 0) => {
  const customDays = useThemeStore.getState()?.config?.dayColors || DAY_THEMES;
  if (dayName && customDays[dayName]) return customDays[dayName];
  if (dayName && DAY_THEMES[dayName]) return DAY_THEMES[dayName];
  const fallbackKeys = Object.keys(DAY_THEMES);
  return DAY_THEMES[fallbackKeys[dayIdx % fallbackKeys.length]];
};

const TR_MONTH_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

const formatShortTrDate = (dateKey, day) => {
  if (dateKey && typeof dateKey === 'string') {
    const parts = dateKey.split('-');
    if (parts.length === 3) {
      const mIdx = parseInt(parts[1], 10) - 1;
      const dNum = parseInt(parts[2], 10);
      if (!isNaN(dNum) && mIdx >= 0 && mIdx < 12) {
        return `${dNum} ${TR_MONTH_SHORT[mIdx]}`;
      }
    }
  }
  return day?.date || dateKey || '';
};

/**
 * Belirli bir gün ve kuşak dilimi (örn: 06:00 - 12:00) için
 * yalnızca eklenen gerçek programların listesini üretir.
 * Program eklenmeyen saatler için sahte/boş saat dilimleri üretmez;
 * program eklendikçe saatler otomatik hesaplanıp artar.
 */
function buildDynamicPeriodEntries(progs = [], period) {
  const entries = [];

  // 1. Önceki kuşaktan başlayıp bu kuşağa taşan program var mı kontrol et
  for (let i = 0; i < progs.length; i++) {
    const p = progs[i];
    const pStart = typeof p.startMinute === 'number' ? p.startMinute : timeToMinutes(p.startTime);
    const pDur = Math.max(1, parseInt(p.duration, 10) || 30);
    const pEnd = typeof p.endMinute === 'number' ? p.endMinute : pStart + pDur;

    if (pStart < period.startMinute && pEnd > period.startMinute) {
      const visEnd = Math.min(period.endMinute, pEnd);
      const visDur = Math.max(5, visEnd - period.startMinute);
      entries.push({
        type: 'continuation',
        key: `cont_${p.instanceId || p.id || i}_${period.id}`,
        prog: p,
        progIndex: i,
        startMinute: period.startMinute,
        endMinute: visEnd,
        startTime: minutesToTime(period.startMinute),
        endTime: minutesToTime(visEnd),
        origStartTime: p.startTime || minutesToTime(pStart),
        origEndTime: p.endTime || minutesToTime(pEnd),
        duration: visDur,
        visDuration: visDur
      });
    }
  }

  // 2. Yalnızca bu kuşak içinde eklenmiş gerçek programları sırayla yerleştir
  for (let i = 0; i < progs.length; i++) {
    const p = progs[i];
    const pStart = typeof p.startMinute === 'number' ? p.startMinute : timeToMinutes(p.startTime);
    const pDur = Math.max(1, parseInt(p.duration, 10) || 30);
    const pEnd = typeof p.endMinute === 'number' ? p.endMinute : pStart + pDur;

    if (pStart < period.startMinute || pStart >= period.endMinute) {
      continue;
    }

    const visEnd = Math.min(period.endMinute, pEnd);
    const visDur = Math.max(15, visEnd - pStart);

    entries.push({
      type: 'program',
      key: `prog_${p.instanceId || p.id || i}_${period.id}`,
      prog: p,
      progIndex: i,
      startMinute: pStart,
      endMinute: pEnd,
      startTime: p.startTime || minutesToTime(pStart),
      endTime: p.endTime || minutesToTime(pEnd),
      duration: pDur,
      visDuration: visDur
    });
  }

  return entries;
}

const DraftMatrixView = ({
  activeDaysKeys,
  scheduleData,
  filterProgram,
  selectedProgramIds = [],
  onSelectProgram,
  onToggleOption,
  onToggleSelect,
  onSelectAllDay,
  onReorderPrograms,
  onMoveProgramOrder,
  onDuplicateProgram,
  onDeleteProgram,
  onAddLibraryProgram,
  isLibraryOpen = true,
  timePeriodFilter = 'all',
  onSendDayToBroadcast,
  textScale = 1
}) => {
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const themeConfig = useThemeStore(state => state.config);
  const scale = Number(textScale) > 0 ? Number(textScale) : 1;
  const px = (base) => `${Math.round(base * scale * 10) / 10}px`;
  const timeColWidth = `${Math.round(56 * scale)}px`;

  const visiblePeriods = useMemo(() => {
    const customPeriods = themeConfig?.periodColors || {};
    const enriched = KUŞAK_PERIODS.map(p => {
      const pKey = p.id === 'afternoon' ? 'day' : p.id;
      const customColor = customPeriods[pKey]?.color || p.color;
      return { ...p, color: customColor };
    });
    if (timePeriodFilter === 'all') return enriched;
    return enriched.filter(p => p.id === timePeriodFilter);
  }, [timePeriodFilter, themeConfig]);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDragOverTarget(null);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  const handleDragStart = (e, info) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(info));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e, dateKey, targetProgIndex, slotMinute = null) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (
      !dragOverTarget ||
      dragOverTarget.dateKey !== dateKey ||
      dragOverTarget.targetProgIndex !== targetProgIndex ||
      dragOverTarget.slotMinute !== slotMinute
    ) {
      setDragOverTarget({ dateKey, targetProgIndex, slotMinute });
    }
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = (e, dateKey, targetProgIndex, slotMinute = null, dropAfter = false) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    try {
      let dataStr = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      let source;
      try {
        source = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
        if (typeof source === 'string') source = JSON.parse(source);
      } catch (err) {
        console.error('Matrix drop JSON ayrıştırma hatası:', err);
        return;
      }

      if (source && (source.isLibraryItem || source.programData)) {
        const progData = source.programData || source;
        onAddLibraryProgram && onAddLibraryProgram({
          programData: progData,
          targetDays: [dateKey],
          targetSlotMinute: slotMinute,
          targetProgIndex: targetProgIndex
        });
        return;
      }

      if (source && source.instanceId) {
        let finalIndex = targetProgIndex;
        if (finalIndex === undefined || finalIndex === null) {
          const progs = scheduleData[dateKey]?.programs || [];
          if (slotMinute !== null) {
            const foundIdx = progs.findIndex(p => timeToMinutes(p.startTime) >= slotMinute);
            finalIndex = foundIdx !== -1 ? foundIdx : progs.length;
          } else {
            finalIndex = progs.length;
          }
        }

        onReorderPrograms && onReorderPrograms(
          source.dateKey,
          source.instanceId,
          dateKey,
          finalIndex,
          Boolean(dropAfter)
        );
      }
    } catch (err) {
      console.error('Matrix drop ayrıştırma hatası:', err);
    }
  };

  const formatDayName = (dateKey, day) => {
    try {
      const parts = dateKey.split('-');
      if (parts.length === 3) {
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const trDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        return trDays[dateObj.getDay()];
      }
    } catch (e) {}
    return day?.dayName || 'Gün';
  };

  // Kütüphane kapalıyken ve %100 standart boyutta 7 gün ekrana %100 tam sığar; büyütme veya kütüphane açıkken yatay kaydırılabilir tam genişlik verir
  const isSingleDay = activeDaysKeys.length === 1;
  const colMinPx = Math.round(250 * scale);
  const colGapPx = isSingleDay ? 0 : 6;
  const colGap = `${colGapPx}px`;
  const totalGapsAndBordersPx = Math.max(0, activeDaysKeys.length - 1) * colGapPx + 4;

  const colTemplate = isSingleDay
    ? '1fr'
    : (isLibraryOpen || scale > 1)
    ? `repeat(${activeDaysKeys.length}, minmax(${colMinPx}px, 1fr))`
    : `repeat(${activeDaysKeys.length}, minmax(0, 1fr))`;

  const matrixMinWidth = isSingleDay
    ? '100%'
    : (isLibraryOpen || scale > 1)
    ? `${activeDaysKeys.length * colMinPx + totalGapsAndBordersPx}px`
    : '100%';

  return (
    <div style={{
      width: '100%',
      minWidth: matrixMinWidth,
      boxSizing: 'border-box',
      background: '#e2e8f0',
      borderRadius: '14px',
      border: '1.5px solid #cbd5e1',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* 1. ÜST SÜTUN BAŞLIKLARI (Sticky Günler + Her Günün Kendi Saat/Program Alt Başlığı) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        gap: colGap,
        background: '#cbd5e1',
        borderBottom: '2px solid #cbd5e1',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
      }}>
        {activeDaysKeys.map((dateKey, dayIdx) => {
          const day = scheduleData[dateKey];
          if (!day) return null;

          const dayProgIds = (day.programs || []).map(p => p.instanceId);
          const isAllDaySelected = dayProgIds.length > 0 && dayProgIds.every(id => selectedProgramIds.includes(id));
          const totalMinutes = (day.programs || []).reduce((acc, p) => acc + (p.duration || 0), 0);
          const filledMinutes = Math.min(1440, totalMinutes);
          const emptyMinutes = Math.max(0, 1440 - filledMinutes);
          const fillPercent = Math.min(100, Math.round((filledMinutes / 1440) * 100));
          const emptyPercent = Math.max(0, 100 - fillPercent);
          const cleanName = formatDayName(dateKey, day);
          const shortDateLabel = formatShortTrDate(dateKey, day);
          const dayTheme = getDayTheme(cleanName, dayIdx);
          const isFullDay = totalMinutes >= 1440;
          const isEvenDay = dayIdx % 2 === 0;

          return (
            <div
              key={dateKey}
              style={{
                borderTop: `4px solid ${dayTheme.line}`,
                borderLeft: `2.5px solid ${dayTheme.line}`,
                borderRight: `1.5px solid ${dayTheme.border}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: dayTheme.headerBg,
                userSelect: 'none',
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              {/* Gün Üst Bilgisi */}
              <div style={{
                padding: '9px 10px 7px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}>
                {/* Üst Satır: Seçim Kutusu + Gün Adı & Gönder Butonu */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  minWidth: 0
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }}>
                    {dayProgIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectAllDay && onSelectAllDay(dateKey)}
                        title={isAllDaySelected ? 'Günün seçimini kaldır' : 'Bu günün tüm programlarını seç'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '1px',
                          cursor: 'pointer',
                          color: isAllDaySelected ? dayTheme.textAccent : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isAllDaySelected ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: px(14),
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.02em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.2
                      }}>
                        {cleanName}
                      </div>
                      <div style={{
                        fontSize: px(10.5),
                        color: dayTheme.textAccent,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {shortDateLabel} • {day.programs.length} Kuşak
                      </div>
                    </div>
                  </div>

                  {day.programs.length > 0 && onSendDayToBroadcast && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSendDayToBroadcast(dateKey);
                      }}
                      title={`${cleanName} taslağını Yayın Planlama modülüne aktar`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: dayTheme.timeBg,
                        border: `1px solid ${dayTheme.line}`,
                        color: dayTheme.textAccent,
                        padding: '3px 7px',
                        borderRadius: '6px',
                        fontSize: px(10),
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      <Send size={9} />
                      <span>Gönder</span>
                    </button>
                  )}
                </div>

                {/* Orta Satır: Doluluk ve Boşluk Oranı Rozetleri */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                  minWidth: 0
                }}>
                  <span
                    title={`Dolu Süre: ${formatHoursAndMins(filledMinutes)} (${filledMinutes} dk)`}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: px(9.5),
                      fontWeight: 700,
                      background: 'rgba(16, 185, 129, 0.1)',
                      color: '#047857',
                      border: '1px solid rgba(16, 185, 129, 0.22)',
                      padding: '1.5px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    Dolu: %{fillPercent}
                  </span>

                  <span
                    title={`Boş Süre: ${formatHoursAndMins(emptyMinutes)} (${emptyMinutes} dk)`}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: px(9.5),
                      fontWeight: 700,
                      background: emptyPercent === 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.1)',
                      color: emptyPercent === 0 ? '#047857' : '#b45309',
                      border: emptyPercent === 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.22)',
                      padding: '1.5px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    Boş: %{emptyPercent}
                  </span>
                </div>

                {/* İnce Kurumsal Doluluk / Boşluk Çubuğu */}
                <div style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '999px',
                  background: '#e2e8f0',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${fillPercent}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: isFullDay
                      ? '#10b981'
                      : `linear-gradient(90deg, #10b981, ${dayTheme.line})`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Alt Şerit: Her Günün Kendi [ SAAT | YAYIN AKIŞI ] Sütun Başlığı */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `${timeColWidth} minmax(0, 1fr)`,
                borderTop: `1.5px solid ${dayTheme.border}`,
                background: dayTheme.subHeaderBg,
                fontSize: px(9.5),
                fontWeight: 700,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                color: dayTheme.textAccent
              }}>
                <div style={{
                  padding: '4px 2px',
                  borderRight: `1.5px solid ${dayTheme.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  color: dayTheme.textAccent,
                  background: dayTheme.timeBg
                }}>
                  <Clock size={9} />
                  <span>SAAT</span>
                </div>
                <div style={{
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: dayTheme.textAccent,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center'
                }}>
                  <span>{cleanName}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. TABLO GÖVDESİ (Yalnızca Eklenen Programlar Gösterilir, Boş Saatler Uzatılmaz) */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visiblePeriods.map(period => {
          const PeriodIcon = period.icon;

          // Bu kuşakta herhangi bir günde program var mı veya sıradaki eklenecek saat bu kuşağa denk geliyor mu?
          const hasAnyContentInPeriod = activeDaysKeys.some(dateKey => {
            const progs = scheduleData[dateKey]?.programs || [];
            const entries = buildDynamicPeriodEntries(progs, period);
            if (entries.length > 0) return true;
            const lastProg = progs[progs.length - 1];
            const nextMin = lastProg
              ? (typeof lastProg.endMinute === 'number' ? lastProg.endMinute : timeToMinutes(lastProg.endTime))
              : 0;
            return nextMin >= period.startMinute && nextMin < period.endMinute;
          });

          if (timePeriodFilter === 'all' && !hasAnyContentInPeriod) {
            return null;
          }

          return (
            <div key={period.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* KUŞAK AYIRICI BAŞLIĞI (Gece #0B2B54, Sabah #E8B44C, Öğle #109AAD, Akşam #0C617C) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 14px',
                background: period.color,
                color: period.id === 'morning' ? '#0A101D' : '#FFFFFF',
                borderTop: '1px solid var(--border-color, #DCE5E9)',
                borderBottom: '1px solid var(--border-color, #DCE5E9)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PeriodIcon size={15} />
                  <span style={{
                    fontSize: px(11.5),
                    fontWeight: 700,
                    color: period.id === 'morning' ? '#0A101D' : '#FFFFFF',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}>
                    {period.label}
                  </span>
                </div>

                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: px(11),
                  fontWeight: 500,
                  opacity: 0.9
                }}>
                  {minutesToTime(period.startMinute)} – {minutesToTime(period.endMinute)}
                </span>
              </div>

              {/* GÜNLERİN BU KUŞAKTAKİ [ SAAT | PROGRAM ] SÜTUNLARI */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: colTemplate,
                gap: colGap,
                background: '#cbd5e1',
                borderBottom: '1.5px solid #cbd5e1',
                alignItems: 'stretch'
              }}>
                {activeDaysKeys.map((dateKey, dayIdx) => {
                  const day = scheduleData[dateKey];
                  const progs = day?.programs || [];
                  const entries = buildDynamicPeriodEntries(progs, period);
                  const cleanName = formatDayName(dateKey, day);
                  const shortDateLabel = formatShortTrDate(dateKey, day);
                  const dayTheme = getDayTheme(cleanName, dayIdx);
                  const isEvenDay = dayIdx % 2 === 0;
                  const dayBg = isEvenDay ? '#ffffff' : '#f8fafc';

                  const lastProg = progs[progs.length - 1];
                  const nextAvailableMinute = lastProg
                    ? (typeof lastProg.endMinute === 'number' ? lastProg.endMinute : timeToMinutes(lastProg.endTime))
                    : 0;
                  const isNextSlotInThisPeriod =
                    nextAvailableMinute < 1440 &&
                    nextAvailableMinute >= period.startMinute &&
                    nextAvailableMinute < period.endMinute;
                  const nextStartTimeStr = minutesToTime(nextAvailableMinute);

                  const isSlotOver =
                    dragOverTarget &&
                    dragOverTarget.dateKey === dateKey &&
                    dragOverTarget.slotMinute === nextAvailableMinute;

                  return (
                    <div
                      key={`day_${dateKey}_period_${period.id}`}
                      onDragOver={(e) => {
                        if (isNextSlotInThisPeriod || entries.length === 0) {
                          handleDragOver(e, dateKey, null, isNextSlotInThisPeriod ? nextAvailableMinute : period.startMinute);
                        }
                      }}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => {
                        if (isNextSlotInThisPeriod || entries.length === 0) {
                          handleDrop(e, dateKey, null, isNextSlotInThisPeriod ? nextAvailableMinute : period.startMinute);
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderLeft: `2.5px solid ${dayTheme.line}`,
                        borderRight: `1.5px solid ${dayTheme.border}`,
                        background: dayBg,
                        minWidth: 0
                      }}
                    >
                      {/* Kuşak İçi Yumuşak Pastel Gün Alt Başlığı */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '4px',
                        padding: '4px 8px',
                        background: dayTheme.subHeaderBg,
                        borderBottom: `1.5px solid ${dayTheme.line}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                          <span style={{
                            fontSize: px(10.5),
                            fontWeight: 800,
                            color: dayTheme.textAccent,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {cleanName}
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: px(9.5),
                            fontWeight: 600,
                            color: dayTheme.textAccent,
                            opacity: 0.8,
                            whiteSpace: 'nowrap'
                          }}>
                            ({shortDateLabel})
                          </span>
                        </div>
                        <span style={{
                          fontSize: px(9),
                          fontWeight: 700,
                          color: dayTheme.textAccent,
                          background: 'rgba(255, 255, 255, 0.7)',
                          padding: '0.5px 5px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          {period.shortLabel}
                        </span>
                      </div>

                      {entries.map((entry, entryIdx) => {
                        const isLastEntry = entryIdx === entries.length - 1 && !isNextSlotInThisPeriod;
                        const minRowHeight = Math.max(Math.round(62 * scale), Math.round((entry.visDuration / 30) * 62 * scale));

                        // A. PROGRAM SATIRI ([ Sol Dinamik Saat | Sağ Program Kartı ])
                        if (entry.type === 'program') {
                          const { prog, progIndex } = entry;
                          const isMatchFilter = filterProgram(prog);
                          const isSelected = selectedProgramIds.includes(prog.instanceId);
                          const isOver =
                            dragOverTarget &&
                            dragOverTarget.dateKey === dateKey &&
                            dragOverTarget.targetProgIndex === progIndex;

                          const progColor = getProgramColor(prog);

                          return (
                            <div
                              key={entry.key}
                              className="corp-card-row"
                              onDragOver={(e) => handleDragOver(e, dateKey, progIndex, entry.startMinute)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, dateKey, progIndex, entry.startMinute)}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `${timeColWidth} minmax(0, 1fr)`,
                                flex: '0 0 auto',
                                minHeight: `${minRowHeight}px`,
                                borderBottom: isLastEntry ? 'none' : `1px solid ${dayTheme.border}`,
                                background: isOver
                                  ? 'rgba(37, 99, 235, 0.1)'
                                  : isSelected
                                  ? 'rgba(37, 99, 235, 0.05)'
                                  : dayBg,
                                boxSizing: 'border-box'
                              }}
                            >
                              {/* SOL: GÜNÜN AÇIK PASTEL RENKLİ SAAT SÜTUNU VE ÇİZGİSİ */}
                              <div
                                onClick={() => onSelectProgram && onSelectProgram({ ...prog, dateKey })}
                                title={`${cleanName} • Kuşak Saati: ${entry.startTime} - ${entry.endTime} (${
                                  prog.episodeDurationFormatted || `${entry.duration} dk`
                                }) — Düzenlemek için tıklayın`}
                                style={{
                                  padding: '4px 2px',
                                  borderRight: `2px solid ${dayTheme.line}`,
                                  background: isSelected
                                    ? dayTheme.border
                                    : dayTheme.timeBg,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  textAlign: 'center',
                                  gap: '2px',
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <span style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontVariantNumeric: 'tabular-nums',
                                  fontSize: px(11.5),
                                  fontWeight: 800,
                                  color: dayTheme.textAccent,
                                  letterSpacing: '-0.03em',
                                  lineHeight: 1.1,
                                  textAlign: 'center'
                                }}>
                                  {entry.startTime}
                                </span>

                                <span style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontVariantNumeric: 'tabular-nums',
                                  fontSize: px(10),
                                  fontWeight: 600,
                                  color: '#475569',
                                  letterSpacing: '-0.03em',
                                  lineHeight: 1.1,
                                  textAlign: 'center'
                                }}>
                                  {entry.endTime}
                                </span>

                                <span style={{
                                  marginTop: '1px',
                                  fontFamily: 'var(--font-mono)',
                                  fontVariantNumeric: 'tabular-nums',
                                  fontSize: px(9.5),
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.85)',
                                  color: dayTheme.textAccent,
                                  border: `1px solid ${dayTheme.line}`,
                                  whiteSpace: 'nowrap',
                                  textAlign: 'center'
                                }}>
                                  {entry.duration} dk
                                </span>
                              </div>

                              {/* SAĞ: PROGRAM KARTI */}
                              <div style={{
                                padding: '3px 4px',
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                                height: '100%',
                                boxSizing: 'border-box'
                              }}>
                                {isMatchFilter ? (
                                  <DraftProgramCard
                                    prog={prog}
                                    dateKey={dateKey}
                                    progIndex={progIndex}
                                    totalProgramsInDay={progs.length}
                                    isSelected={isSelected}
                                    isDragOver={isOver}
                                    hideTimeBadge={true}
                                    textScale={scale}
                                    onSelect={(p) => onSelectProgram && onSelectProgram(p || prog)}
                                    onToggleOption={onToggleOption}
                                    onToggleSelect={onToggleSelect}
                                    onDragStart={handleDragStart}
                                    onDragOver={(e) => handleDragOver(e, dateKey, progIndex, entry.startMinute)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e, info) => handleDrop(e, dateKey, progIndex, entry.startMinute, info?.dropAfter)}
                                    onMoveOrder={onMoveProgramOrder}
                                    onDuplicate={onDuplicateProgram}
                                    onDelete={onDeleteProgram}
                                    onEdit={onSelectProgram}
                                  />
                                ) : (
                                  <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: px(10.5),
                                    color: 'var(--text-muted)',
                                    fontStyle: 'italic',
                                    padding: '6px',
                                    border: '1px dashed var(--border-color)',
                                    borderRadius: '6px'
                                  }}>
                                    Filtre dışı ({entry.startTime})
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // B. ÖNCEKİ KUŞAKTAN DEVAM EDEN PROGRAM SATIRI
                        if (entry.type === 'continuation') {
                          const { prog } = entry;
                          const accentColor = getProgramColor(prog);

                          return (
                            <div
                              key={entry.key}
                              onClick={() => onSelectProgram && onSelectProgram({ ...prog, dateKey })}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `${timeColWidth} minmax(0, 1fr)`,
                                flex: '0 0 auto',
                                minHeight: `${Math.max(46, Math.round((entry.visDuration / 30) * 52 * scale))}px`,
                                borderBottom: isLastEntry ? 'none' : '1px solid var(--border-light)',
                                background: `linear-gradient(90deg, ${accentColor}10 0%, transparent 100%)`,
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                              }}
                              title={`${prog.title} (${entry.origStartTime} - ${entry.origEndTime}) önceki kuşaktan devam ediyor`}
                            >
                              <div style={{
                                padding: '4px 2px',
                                borderRight: '1px solid var(--border-light)',
                                borderLeft: `3px dashed ${accentColor}`,
                                background: '#f8fafc',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                gap: '1px'
                              }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: px(10), fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  {entry.startTime}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: px(10), fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {entry.endTime}
                                </span>
                              </div>

                              <div style={{
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: 'var(--text-secondary)',
                                fontSize: px(11),
                                fontWeight: 700,
                                minWidth: 0
                              }}>
                                <CornerDownRight size={11} style={{ color: accentColor, flexShrink: 0 }} />
                                <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span>{prog.title}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}

                      {/* Sadece sıradaki eklenecek program bu kuşaktaysa BÜYÜTÜLMÜŞ "+ Program Ekle" alanı göster */}
                      {isNextSlotInThisPeriod && (
                        <div
                          onClick={() => {
                            onAddLibraryProgram && onAddLibraryProgram({
                              programData: null,
                              targetDays: [dateKey],
                              targetSlotMinute: nextAvailableMinute,
                              targetProgIndex: progs.length
                            });
                          }}
                          style={{
                            padding: '8px',
                            cursor: 'pointer'
                          }}
                          title={`Sıradaki Kuşağa (${nextStartTimeStr}) program eklemek için tıklayın veya sürükleyin`}
                        >
                          <div style={{
                            padding: '16px 12px',
                            minHeight: '62px',
                            borderRadius: '10px',
                            border: isSlotOver
                              ? '2px dashed var(--accent-primary)'
                              : '2px dashed rgba(37, 99, 235, 0.35)',
                            background: isSlotOver
                              ? 'rgba(37, 99, 235, 0.12)'
                              : 'rgba(37, 99, 235, 0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            color: 'var(--accent-primary)',
                            fontSize: px(12.5),
                            fontWeight: 800,
                            textAlign: 'center',
                            transition: 'all 0.15s ease'
                          }}>
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: 'rgba(37, 99, 235, 0.14)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Plus size={15} />
                            </span>
                            <span>Program Ekle ({nextStartTimeStr})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. GÜNLERİN ALTINDA DOLULUK VE BOŞLUK ORANI ÖZETİ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
        gap: colGap,
        background: '#cbd5e1',
        borderTop: '2px solid #cbd5e1'
      }}>
        {activeDaysKeys.map((dateKey, dayIdx) => {
          const day = scheduleData[dateKey];
          if (!day) return null;

          const progs = day.programs || [];
          const totalMinutes = progs.reduce((acc, p) => acc + (p.duration || 0), 0);
          const filledMinutes = Math.min(1440, totalMinutes);
          const emptyMinutes = Math.max(0, 1440 - filledMinutes);
          const fillPercent = Math.min(100, Math.round((filledMinutes / 1440) * 100));
          const emptyPercent = Math.max(0, 100 - fillPercent);
          const isFullDay = filledMinutes >= 1440;
          const cleanName = formatDayName(dateKey, day);
          const dayTheme = getDayTheme(cleanName);

          return (
            <div
              key={`footer_${dateKey}`}
              style={{
                padding: '10px',
                background: dayTheme.headerBg,
                borderLeft: `2.5px solid ${dayTheme.line}`,
                borderTop: `3px solid ${dayTheme.line}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                minWidth: 0
              }}
            >
              <div style={{
                fontSize: px(10.5),
                fontWeight: 800,
                color: dayTheme.textAccent,
                textAlign: 'center',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}>
                {cleanName} Gün Sonu Özeti
              </div>

              {/* Doluluk ve Boşluk Oranı Kartları */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '5px'
              }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  borderRadius: '7px',
                  padding: '5px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '1px'
                }}>
                  <span style={{ fontSize: px(9.5), fontWeight: 700, color: '#047857' }}>
                    DOLULUK ORANI
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: px(12), fontWeight: 800, color: '#047857' }}>
                    %{fillPercent}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: px(9.5), fontWeight: 600, color: '#065f46' }}>
                    {formatHoursAndMins(filledMinutes)}
                  </span>
                </div>

                <div style={{
                  background: isFullDay ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.1)',
                  border: isFullDay ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.28)',
                  borderRadius: '7px',
                  padding: '5px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '1px'
                }}>
                  <span style={{ fontSize: px(9.5), fontWeight: 700, color: isFullDay ? '#047857' : '#b45309' }}>
                    BOŞLUK ORANI
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: px(12), fontWeight: 800, color: isFullDay ? '#047857' : '#b45309' }}>
                    %{emptyPercent}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: px(9.5), fontWeight: 600, color: isFullDay ? '#065f46' : '#92400e' }}>
                    {isFullDay ? 'Tam Dolu' : formatHoursAndMins(emptyMinutes)}
                  </span>
                </div>
              </div>

              {/* Görsel Doluluk / Boşluk Çubuğu */}
              <div style={{
                width: '100%',
                height: '6px',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.25)',
                overflow: 'hidden',
                display: 'flex'
              }}>
                <div style={{
                  width: `${fillPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(DraftMatrixView);
