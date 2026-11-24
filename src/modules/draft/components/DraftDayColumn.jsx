/**
 * @file DraftDayColumn.jsx
 * @description Taslak Planlama ızgara görünümündeki tek bir güne ait sütun bileşeni.
 * Her günün sol tarafında eklenen programa göre dinamik değişen saat şeridi (Saat Sütunu),
 * sağ tarafında ise program kartı yer alır.
 */
import React, { useState } from 'react';
import { CalendarOff, CheckSquare, Square, Plus, Send, Clock } from 'lucide-react';
import DraftProgramCard from './DraftProgramCard';
import { getProgramColor } from './library/constants';
import useThemeStore from '../../../store/themeStore';

const minutesToTime = (min) => {
  if (min >= 1440) return '24:00';
  const safeMin = Math.max(0, Math.round(min));
  const h = Math.floor(safeMin / 60);
  const m = safeMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatHoursAndMins = (mins) => {
  const safe = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h} sa ${m} dk`;
  if (h > 0) return `${h} sa`;
  return `${m} dk`;
};

const DAY_THEMES = {
  Pazartesi: {
    line: '#7dd3fc',
    border: '#bae6fd',
    timeBg: '#e0f2fe',
    headerBg: '#f0f9ff',
    subHeaderBg: '#e0f2fe',
    textAccent: '#0284c7'
  },
  Salı: {
    line: '#c4b5fd',
    border: '#ddd6fe',
    timeBg: '#ede9fe',
    headerBg: '#f5f3ff',
    subHeaderBg: '#ede9fe',
    textAccent: '#7c3aed'
  },
  Çarşamba: {
    line: '#67e8f9',
    border: '#a5f3fc',
    timeBg: '#cffafe',
    headerBg: '#ecfeff',
    subHeaderBg: '#cffafe',
    textAccent: '#0891b2'
  },
  Perşembe: {
    line: '#86efac',
    border: '#bbf7d0',
    timeBg: '#dcfce7',
    headerBg: '#f0fdf4',
    subHeaderBg: '#dcfce7',
    textAccent: '#16a34a'
  },
  Cuma: {
    line: '#fcd34d',
    border: '#fde68a',
    timeBg: '#fef3c7',
    headerBg: '#fffbeb',
    subHeaderBg: '#fef3c7',
    textAccent: '#d97706'
  },
  Cumartesi: {
    line: '#fda4af',
    border: '#fecdd3',
    timeBg: '#ffe4e6',
    headerBg: '#fff1f2',
    subHeaderBg: '#ffe4e6',
    textAccent: '#e11d48'
  },
  Pazar: {
    line: '#a5b4fc',
    border: '#c7d2fe',
    timeBg: '#e0e7ff',
    headerBg: '#eef2ff',
    subHeaderBg: '#e0e7ff',
    textAccent: '#4f46e5'
  }
};

const getDayTheme = (dayName) => {
  const customDays = useThemeStore.getState()?.config?.dayColors || DAY_THEMES;
  return (dayName && customDays[dayName]) || (dayName && DAY_THEMES[dayName]) || DAY_THEMES.Pazartesi;
};

const DraftDayColumn = ({
  dateKey,
  day,
  filteredProgs,
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
  onSendDayToBroadcast,
  textScale = 1
}) => {
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isColumnDragOver, setIsColumnDragOver] = useState(false);
  useThemeStore(state => state.config);
  const scale = Number(textScale) > 0 ? Number(textScale) : 1;
  const px = (base) => `${Math.round(base * scale * 10) / 10}px`;
  const timeColWidth = `${Math.round(56 * scale)}px`;

  if (!day) return null;

  let cleanDayName = day.dayName;
  try {
    const parts = dateKey.split('-');
    if (parts.length === 3) {
      const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const trDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      cleanDayName = trDays[dateObj.getDay()];
    }
  } catch (e) {}
  if (!cleanDayName) cleanDayName = day.dayName || 'Gün';
  const dayTheme = getDayTheme(cleanDayName);

  const totalMinutes = (day.programs || []).reduce((acc, p) => acc + (p.duration || 0), 0);
  const filledMinutes = Math.min(1440, totalMinutes);
  const emptyMinutes = Math.max(0, 1440 - filledMinutes);
  const fillPercent = Math.min(100, Math.round((filledMinutes / 1440) * 100));
  const emptyPercent = Math.max(0, 100 - fillPercent);
  const isFullDay = filledMinutes >= 1440;

  // Son programın bitiş dakikasını bul (yeni eklenecek kuşağın başlangıç saati)
  const lastProgram = (day.programs || [])[day.programs.length - 1];
  const nextAvailableMinute = lastProgram
    ? (typeof lastProgram.endMinute === 'number' ? lastProgram.endMinute : Math.min(1440, totalMinutes))
    : 0;
  const nextStartTimeStr = minutesToTime(nextAvailableMinute);

  // Bu gündeki tüm programlar seçili mi?
  const dayProgIds = (day.programs || []).map(p => p.instanceId);
  const isAllDaySelected = dayProgIds.length > 0 && dayProgIds.every(id => selectedProgramIds.includes(id));

  // Sürükleme Başlangıcı
  const handleDragStart = (e, info) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(info));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Kartın üzerine sürüklenirken
  const handleCardDragOver = (e, info) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (dragOverIndex !== info.progIndex) {
      setDragOverIndex(info.progIndex);
    }
  };

  const handleCardDragLeave = (e) => {
    e.stopPropagation();
  };

  // Kartın üzerine bırakıldığında
  const handleCardDrop = (e, info) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    setIsColumnDragOver(false);

    try {
      let dataStr = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      let source;
      try {
        source = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
        if (typeof source === 'string') source = JSON.parse(source);
      } catch (err) {
        return;
      }

      if (source && (source.isLibraryItem || source.programData)) {
        onAddLibraryProgram && onAddLibraryProgram({
          programData: source.programData || source,
          targetDays: [dateKey],
          targetProgIndex: info.progIndex
        });
        return;
      }

      if (source && source.instanceId) {
        onReorderPrograms && onReorderPrograms(
          source.dateKey,
          source.instanceId,
          dateKey,
          info.progIndex,
          Boolean(info.dropAfter)
        );
      }
    } catch (err) {
      console.error('Drag drop ayrıştırma hatası:', err);
    }
  };

  // Sütunun boş alanına sürüklenirken
  const handleColumnDragOver = (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (!isColumnDragOver) {
      setIsColumnDragOver(true);
    }
  };

  const handleColumnDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsColumnDragOver(false);
    setDragOverIndex(null);
  };

  // Sütunun sonuna bırakıldığında
  const handleColumnDrop = (e) => {
    e.preventDefault();
    setIsColumnDragOver(false);
    setDragOverIndex(null);

    try {
      let dataStr = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      let source;
      try {
        source = typeof dataStr === 'string' ? JSON.parse(dataStr) : dataStr;
        if (typeof source === 'string') source = JSON.parse(source);
      } catch (err) {
        return;
      }

      if (source && (source.isLibraryItem || source.programData)) {
        onAddLibraryProgram && onAddLibraryProgram({
          programData: source.programData || source,
          targetDays: [dateKey],
          targetSlotMinute: nextAvailableMinute,
          targetProgIndex: (day.programs || []).length
        });
        return;
      }

      if (source && source.instanceId) {
        const targetIndex = (day.programs || []).length;
        onReorderPrograms && onReorderPrograms(
          source.dateKey,
          source.instanceId,
          dateKey,
          targetIndex
        );
      }
    } catch (err) {
      console.error('Column drop ayrıştırma hatası:', err);
    }
  };

  return (
    <div
      onDragOver={handleColumnDragOver}
      onDragLeave={handleColumnDragLeave}
      onDrop={handleColumnDrop}
      style={{
        background: isColumnDragOver ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)',
        borderRadius: '14px',
        border: '1.5px solid',
        borderColor: isColumnDragOver ? 'var(--accent-primary)' : dayTheme.line,
        borderLeft: `3px solid ${dayTheme.line}`,
        borderTop: `4px solid ${dayTheme.line}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)',
        transition: 'border-color 0.15s, background-color 0.15s',
        minHeight: '350px'
      }}
    >
      {/* Sütun Başlığı */}
      <div style={{
        background: dayTheme.headerBg,
        borderBottom: `1.5px solid ${dayTheme.border}`,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        minWidth: 0,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '10px 12px 8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {/* Üst Satır: Seçim Kutusu + Gün Adı/Tarih & Gönder Butonu */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            minWidth: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
              {dayProgIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectAllDay && onSelectAllDay(dateKey)}
                  title={isAllDaySelected ? 'Günün seçimini kaldır' : 'Bu günün tüm programlarını seç'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: isAllDaySelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0
                  }}
                >
                  {isAllDaySelected ? <CheckSquare size={15} /> : <Square size={15} />}
                </button>
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  margin: 0,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.2
                }}>
                  {cleanDayName}
                </h3>
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '1px'
                }}>
                  {day.date} • {day.programs.length} Kuşak
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
                title={`${cleanDayName} taslağını Yayın Planlama modülüne aktar`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(37, 99, 235, 0.1)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  color: '#2563eb',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
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

          {/* Alt Satır: Doluluk ve Boşluk Oranı Rozetleri */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            paddingTop: '5px',
            borderTop: '1px dashed var(--border-color)',
            minWidth: 0
          }}>
            <span
              title={`Dolu Süre: ${formatHoursAndMins(filledMinutes)} (${day.programs.length} Kuşak)`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: px(10),
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#047857',
                border: '1px solid rgba(16, 185, 129, 0.22)',
                padding: '2px 7px',
                borderRadius: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              Dolu: %{fillPercent}
            </span>

            <span
              title={`Boş Süre: ${formatHoursAndMins(emptyMinutes)}`}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: px(10),
                color: emptyPercent === 0 ? '#047857' : '#b45309',
                background: emptyPercent === 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.1)',
                border: emptyPercent === 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.22)',
                padding: '2px 7px',
                borderRadius: '5px',
                fontWeight: 700,
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
                : 'linear-gradient(90deg, #10b981, #3b82f6)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Sütun İçi [ SAAT | PROGRAM ] Alt Başlığı */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${timeColWidth} minmax(0, 1fr)`,
          borderTop: `1px solid ${dayTheme.border}`,
          background: dayTheme.subHeaderBg,
          fontSize: px(9.5),
          fontWeight: 700,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: dayTheme.textAccent
        }}>
          <div style={{
            padding: '4px 2px',
            borderRight: `2px solid ${dayTheme.line}`,
            background: dayTheme.timeBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            color: dayTheme.textAccent
          }}>
            <Clock size={9} />
            <span>SAAT</span>
          </div>
          <div style={{
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontWeight: 800,
            color: dayTheme.textAccent
          }}>
            <span>{cleanDayName}</span>
          </div>
        </div>
      </div>

      {/* Program Satırları Listesi ([ Sol Dinamik Saat | Sağ Program Kartı ]) */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {day.programs.length === 0 ? (
          <div
            onClick={() => {
              onAddLibraryProgram && onAddLibraryProgram({
                programData: null,
                targetDays: [dateKey],
                targetSlotMinute: 0,
                targetProgIndex: 0
              });
            }}
            style={{
              padding: '32px 14px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              flex: 1,
              cursor: 'pointer'
            }}
          >
            <CalendarOff size={26} style={{ opacity: 0.35 }} />
            <div style={{ fontSize: px(12), fontWeight: 700, color: 'var(--text-secondary)' }}>
              Planlanmış Akış Yok
            </div>
            <div style={{ fontSize: px(11), opacity: 0.75, maxWidth: '180px', lineHeight: 1.3 }}>
              {isColumnDragOver ? 'Programı buraya bırakın' : '00:00 kuşağından başlamak için tıklayın veya program sürükleyin.'}
            </div>
          </div>
        ) : filteredProgs.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: px(12) }}>
            Aramaya uygun program bulunamadı.
          </div>
        ) : (
          <>
            {filteredProgs.map((prog, pIdx) => {
              const isSelected = selectedProgramIds.includes(prog.instanceId);
              const isOverThis = dragOverIndex === pIdx;
              const progColor = getProgramColor(prog);
              const duration = prog.duration || 30;

              return (
                <React.Fragment key={prog.instanceId || `${prog.id}_${pIdx}`}>
                  {isOverThis && (
                    <div style={{
                      height: '3px',
                      background: 'var(--accent-primary)',
                      boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)'
                    }} />
                  )}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `${timeColWidth} minmax(0, 1fr)`,
                    borderBottom: '1px solid var(--border-light)',
                    background: isOverThis
                      ? 'rgba(37, 99, 235, 0.1)'
                      : isSelected
                      ? 'rgba(37, 99, 235, 0.05)'
                      : 'transparent'
                  }}>
                    {/* SOL: HER GÜNE ÖZEL AÇIK PASTEL SAAT SÜTUNU VE ÇİZGİSİ */}
                    <div
                      onClick={() => onSelectProgram && onSelectProgram({ ...prog, dateKey })}
                      title={`${cleanDayName} • Kuşak Saati: ${prog.startTime} - ${prog.endTime} (${prog.episodeDurationFormatted || `${duration} dk`})`}
                      style={{
                        padding: '4px 2px',
                        borderRight: `2px solid ${dayTheme.line}`,
                        background: isSelected
                          ? 'rgba(37, 99, 235, 0.14)'
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
                        color: '#1e293b',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        textAlign: 'center'
                      }}>
                        {prog.startTime}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: px(10),
                        fontWeight: 600,
                        color: '#64748b',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.1,
                        textAlign: 'center'
                      }}>
                        {prog.endTime}
                      </span>
                      <span style={{
                        marginTop: '1px',
                        fontFamily: 'var(--font-mono)',
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: px(9.5),
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: `${progColor}14`,
                        color: progColor,
                        whiteSpace: 'nowrap',
                        textAlign: 'center'
                      }}>
                        {duration} dk
                      </span>
                    </div>

                    {/* SAĞ: PROGRAM KARTI */}
                    <div style={{ padding: '3px 4px', minWidth: 0 }}>
                      <DraftProgramCard
                        prog={prog}
                        dateKey={dateKey}
                        progIndex={pIdx}
                        totalProgramsInDay={filteredProgs.length}
                        isSelected={isSelected}
                        isDragOver={isOverThis}
                        hideTimeBadge={true}
                        textScale={scale}
                        onSelect={(p) => onSelectProgram && onSelectProgram(p || prog)}
                        onToggleOption={onToggleOption}
                        onToggleSelect={onToggleSelect}
                        onDragStart={handleDragStart}
                        onDragOver={handleCardDragOver}
                        onDragLeave={handleCardDragLeave}
                        onDrop={handleCardDrop}
                        onDragEnd={() => setDragOverIndex(null)}
                        onMoveOrder={onMoveProgramOrder}
                        onDuplicate={onDuplicateProgram}
                        onDelete={onDeleteProgram}
                        onEdit={onSelectProgram}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {/* Gün henüz 24 saati doldurmadıysa sıradaki dinamik saatten başlayan büyütülmüş "+ Program Ekle" butonu */}
            {nextAvailableMinute < 1440 && (
              <div
                onClick={() => {
                  onAddLibraryProgram && onAddLibraryProgram({
                    programData: null,
                    targetDays: [dateKey],
                    targetSlotMinute: nextAvailableMinute,
                    targetProgIndex: (day.programs || []).length
                  });
                }}
                style={{
                  padding: '8px',
                  cursor: 'pointer'
                }}
                title={`Sıradaki Kuşak (${nextStartTimeStr}) için program ekle`}
              >
                <div style={{
                  padding: '16px 12px',
                  minHeight: '62px',
                  borderRadius: '10px',
                  border: '2px dashed rgba(37, 99, 235, 0.35)',
                  background: 'rgba(37, 99, 235, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: 'var(--accent-primary)',
                  fontSize: px(12.5),
                  fontWeight: 800,
                  textAlign: 'center'
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
          </>
        )}
      </div>

      {/* GÜN ALTI DOLULUK VE BOŞLUK ORANI ÖZETİ */}
      <div style={{
        padding: '10px',
        borderTop: '2px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginTop: 'auto'
      }}>
        <div style={{
          fontSize: px(10.5),
          fontWeight: 800,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          letterSpacing: '0.02em',
          textTransform: 'uppercase'
        }}>
          {cleanDayName} Gün Sonu Özeti
        </div>

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
    </div>
  );
};

export default React.memo(DraftDayColumn);
