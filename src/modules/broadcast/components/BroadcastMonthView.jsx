/**
 * @file src/modules/broadcast/components/BroadcastMonthView.jsx
 * @description Yayın Planlama modülü Aylık Takvim Görünümü (Monthly View).
 * Seçili ayın tüm günlerini takvim ızgarasında gösterir; her hücrede o günün öğe sayısını,
 * toplam yayın süresini (HH.MM.SS.FF) ve sarkma uyarılarını özetler. Güne tıklandığında günlük görünüme geçer.
 */
import React, { useState, useMemo } from 'react';
import { 
  CalendarRange, ChevronLeft, ChevronRight, CheckCircle2, 
  AlertTriangle, Clock, Film 
} from 'lucide-react';
import { 
  parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths 
} from 'date-fns';
import { tr } from 'date-fns/locale';
import useBroadcastStore, { BROADCAST_CHANNELS } from '../store/broadcastStore';
import { 
  FRAMES_PER_DAY, 
  framesToTimecode, 
  formatFramesHuman 
} from '../utils/timecodeUtils';

const BroadcastMonthView = () => {
  const {
    selectedChannel,
    selectedDate,
    setSelectedDate,
    setViewMode,
    activeList,
    getRawDayPrograms,
    getPreviousDayOverflowFrames,
    getDayOverflowFrames
  } = useBroadcastStore();

  const [currentMonthDate, setCurrentMonthDate] = useState(() => parseISO(selectedDate));
  const currentChannelObj = BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];

  const monthTitle = useMemo(() => {
    return format(currentMonthDate, 'MMMM yyyy', { locale: tr });
  }, [currentMonthDate]);

  // Takvim günlerini hesapla (Pazartesi başlangıçlı)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonthDate]);

  const handleSelectDay = (d) => {
    setSelectedDate(format(d, 'yyyy-MM-dd'));
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
      {/* Üst Ay Navigasyonu */}
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
          <CalendarRange size={20} color="var(--accent-primary)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Aylık Akış Takvimi — {currentChannelObj.name} ({activeList === 'A' ? 'Liste A' : 'Liste B'})
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Tüm ayın yayın doluluğunu ve sarkma durumlarını inceleyin. Detay için güne tıklayın.
            </div>
          </div>
        </div>

        {/* Ay İleri / Geri */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setCurrentMonthDate(m => subMonths(m, 1))}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', minWidth: '130px', textAlign: 'center', textTransform: 'capitalize' }}>
            {monthTitle}
          </span>

          <button
            onClick={() => setCurrentMonthDate(m => addMonths(m, 1))}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Gün İsimleri Başlık Çubuğu */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        textAlign: 'center',
        padding: '8px 0',
        fontSize: '12px',
        fontWeight: '800',
        color: 'var(--text-secondary)'
      }}>
        {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(dName => (
          <div key={dName}>{dName}</div>
        ))}
      </div>

      {/* Takvim Günleri Izgarası */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: '1fr',
        gap: '1px',
        background: 'var(--border-color)',
        overflowY: 'auto'
      }}>
        {calendarDays.map((d, index) => {
          const dateStr = format(d, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(d, currentMonthDate);
          const isToday = isSameDay(d, new Date());
          const isSelected = dateStr === selectedDate;

          const progs = getRawDayPrograms(selectedChannel, dateStr, activeList);
          const prevOverflowFrames = getPreviousDayOverflowFrames(selectedChannel, dateStr, activeList);
          const nextOverflowFrames = getDayOverflowFrames(selectedChannel, dateStr, activeList);
          const totalFrames = progs.reduce((acc, p) => acc + (p.durationFrames || 0), 0) + prevOverflowFrames;

          return (
            <div
              key={index}
              onClick={() => handleSelectDay(d)}
              style={{
                background: isSelected 
                  ? 'var(--bg-tertiary)' 
                  : isCurrentMonth 
                  ? 'var(--bg-primary)' 
                  : 'var(--bg-secondary)',
                opacity: isCurrentMonth ? 1 : 0.45,
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background 0.15s',
                border: isSelected ? '2px solid var(--accent-primary)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = isCurrentMonth ? 'var(--bg-primary)' : 'var(--bg-secondary)';
              }}
            >
              {/* Gün Numarası ve Rozetler */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  color: isToday ? '#fff' : isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  background: isToday ? 'var(--accent-primary)' : 'transparent',
                  padding: isToday ? '2px 7px' : '0',
                  borderRadius: isToday ? '6px' : '0'
                }}>
                  {format(d, 'd')}
                </span>

                {isToday && (
                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase' }}>
                    Bugün
                  </span>
                )}
              </div>

              {/* Günün Yayın İstatistikleri */}
              <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
                {progs.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {progs.length} Öğe
                      </span>
                      <span style={{ fontWeight: '700', fontFamily: 'monospace', color: totalFrames >= FRAMES_PER_DAY ? '#10b981' : 'var(--text-primary)' }}>
                        {framesToTimecode(totalFrames)}
                      </span>
                    </div>

                    {/* Ertesi güne sarkma rozeti */}
                    {nextOverflowFrames > 0 && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        fontSize: '9px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <AlertTriangle size={9} />
                        <span>Sarkma: +{framesToTimecode(nextOverflowFrames)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Boş
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BroadcastMonthView;
