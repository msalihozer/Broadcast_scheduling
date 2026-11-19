/**
 * @file src/modules/broadcast/components/BroadcastWeekView.jsx
 * @description Yayın Planlama modülü 7 Günlük Haftalık Matris Görünümü (Weekly View).
 * Seçili haftanın Pazartesi-Pazar günlerini yan yana 7 sütunda listeler; her günün toplam yayın süresini,
 * öğe sayısını, 24 saat (FRAMES_PER_DAY) doluluk durumunu ve ertesi güne sarkmaları (overflow) gösterir.
 */
import React, { useMemo } from 'react';
import { 
  CalendarDays, Clock, AlertTriangle, ArrowRight, Plus, 
  CheckCircle2, Film, Megaphone 
} from 'lucide-react';
import { 
  parseISO, startOfWeek, addDays, format, isSameDay 
} from 'date-fns';
import { tr } from 'date-fns/locale';
import useBroadcastStore, { BROADCAST_CHANNELS } from '../store/broadcastStore';
import useThemeStore, { hexToRgba } from '../../../store/themeStore';
import { 
  FRAMES_PER_DAY, 
  framesToTimecode, 
  formatFramesHuman 
} from '../utils/timecodeUtils';

const BroadcastWeekView = () => {
  const themeConfig = useThemeStore(state => state.config);
  const adColor = themeConfig?.modules?.ready?.adBreakColor || themeConfig?.specialColors?.adBreakColor || '#f59e0b';
  const {
    selectedChannel,
    selectedDate,
    setSelectedDate,
    setViewMode,
    activeList,
    getComputedDayPrograms,
    getPreviousDayOverflowFrames,
    getDayOverflowFrames
  } = useBroadcastStore();

  const currentChannelObj = BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];

  // Aktif haftanın 7 günü (Pazartesi - Pazar)
  const weekDays = useMemo(() => {
    try {
      const current = parseISO(selectedDate);
      const monday = startOfWeek(current, { weekStartsOn: 1 });
      return [0, 1, 2, 3, 4, 5, 6].map(i => {
        const d = addDays(monday, i);
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          dayName: format(d, 'EEEE', { locale: tr }),
          formattedDate: format(d, 'd MMMM', { locale: tr }),
          isToday: isSameDay(d, new Date()),
          isSelected: isSameDay(d, current)
        };
      });
    } catch (e) {
      return [];
    }
  }, [selectedDate]);

  const handleSelectDay = (dateStr) => {
    setSelectedDate(dateStr);
    setViewMode('daily');
  };

  return (
    <div style={{
      flex: 1,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--bg-primary)'
    }}>
      {/* Üst Bilgi Barı */}
      <div style={{
        padding: '14px 24px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CalendarDays size={20} color="var(--accent-primary)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Haftalık Akış Matrisi — {currentChannelObj.name} ({activeList === 'A' ? 'Liste A' : 'Liste B'})
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              7 günlük yayın akışını topluca inceleyin. Detaylı düzenlemek için herhangi bir güne tıklayabilirsiniz.
            </div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Hafta: <strong>{weekDays[0]?.formattedDate} - {weekDays[6]?.formattedDate}</strong>
        </div>
      </div>

      {/* 7 Günlük Kolon Izgarası */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '1px',
        background: 'var(--border-color)',
        overflowY: 'auto'
      }}>
        {weekDays.map(dayInfo => {
          const progs = getComputedDayPrograms(selectedChannel, dayInfo.dateStr, activeList);
          const prevOverflowFrames = getPreviousDayOverflowFrames(selectedChannel, dayInfo.dateStr, activeList);
          const nextOverflowFrames = getDayOverflowFrames(selectedChannel, dayInfo.dateStr, activeList);
          const totalFrames = progs.reduce((acc, p) => acc + (p.durationFrames || 0), 0) + prevOverflowFrames;
          const dayTheme = themeConfig?.dayColors?.[dayInfo.dayName];

          return (
            <div
              key={dayInfo.dateStr}
              style={{
                background: dayInfo.isSelected ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: '600px',
                borderLeft: dayTheme ? `2.5px solid ${dayTheme.line}` : 'none',
                borderTop: dayInfo.isSelected
                  ? '3.5px solid var(--accent-primary)'
                  : dayTheme
                  ? `3.5px solid ${dayTheme.line}`
                  : '3px solid transparent'
              }}
            >
              {/* Gün Başlığı */}
              <div
                onClick={() => handleSelectDay(dayInfo.dateStr)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-color)',
                  background: dayInfo.isSelected
                    ? 'var(--bg-tertiary)'
                    : dayTheme?.headerBg || 'var(--bg-secondary)',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => {
                  if (!dayInfo.isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: dayInfo.isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    {dayInfo.dayName}
                  </span>
                  {dayInfo.isToday && (
                    <span style={{ background: '#10b981', color: '#fff', fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '4px' }}>
                      BUGÜN
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {dayInfo.formattedDate}
                </div>

                {/* Süre ve Durum Özeti */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {progs.length} Öğe
                  </span>
                  <span style={{ fontWeight: '700', color: totalFrames >= FRAMES_PER_DAY ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                    {framesToTimecode(totalFrames)}
                  </span>
                </div>

                {/* Sarkma Bildirimi */}
                {nextOverflowFrames > 0 && (
                  <div style={{
                    marginTop: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertTriangle size={11} />
                    <span>Sarkma: +{framesToTimecode(nextOverflowFrames)}</span>
                  </div>
                )}
              </div>

              {/* Günün Program Kartları */}
              <div 
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  overflowY: 'auto'
                }}
              >
                {progs.length === 0 ? (
                  <div style={{
                    padding: '20px 8px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '11px'
                  }}>
                    Planlanan içerik yok
                  </div>
                ) : (
                  progs.map((p, pIdx) => (
                    <div
                      key={p.instanceId || pIdx}
                      onClick={() => handleSelectDay(dayInfo.dateStr)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: p.type === 'ad_break' ? hexToRgba(adColor, 0.12) : 'var(--bg-secondary)',
                        border: p.type === 'ad_break' ? `1px solid ${hexToRgba(adColor, 0.35)}` : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'transform 0.1s, border-color 0.1s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = p.type === 'ad_break' ? hexToRgba(adColor, 0.35) : 'var(--border-color)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: p.type === 'ad_break' ? adColor : 'var(--text-primary)' }}>
                          {p.calculatedStartTime}
                        </span>
                        <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: '700' }}>
                          {p.durationTc}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: p.type === 'ad_break' ? adColor : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={p.title}>
                        {p.title}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '9px' }}>
                        {p.type === 'ad_break' ? (
                          <span style={{ background: hexToRgba(adColor, 0.2), color: adColor, padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                            Reklam
                          </span>
                        ) : p.type === 'clip' ? (
                          <span style={{ background: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                            Klip
                          </span>
                        ) : null}
                        {p.episodeNo && (
                          <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '1px 4px', borderRadius: '3px' }}>
                            Bl.{p.episodeNo}
                          </span>
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {p.category}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BroadcastWeekView;
