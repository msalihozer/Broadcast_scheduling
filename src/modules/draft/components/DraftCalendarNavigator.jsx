/**
 * @file DraftCalendarNavigator.jsx
 * @description Haftalık ve günlük yayın akışları arasında gezinti yapılmasını sağlayan,
 * dolu ve boş günleri açıkça belirten interaktif takvim ve hafta gezgini.
 */
import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Calendar,
  Layers,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
  isToday,
  getISOWeek
} from 'date-fns';
import { tr } from 'date-fns/locale';

const DraftCalendarNavigator = ({
  isOpen,
  onClose,
  currentWeekKeys = [],
  selectedDayKey = 'all',
  onSelectWeek,
  onSelectDay,
  allSchedules = {},
  availablePresets = [],
  onSwitchPreset
}) => {
  // Takvimde görüntülenen geçerli ayın başlangıç tarihi
  const initialDate = useMemo(() => {
    if (currentWeekKeys.length > 0) {
      try {
        return parseISO(currentWeekKeys[0]);
      } catch (e) {
        return new Date();
      }
    }
    return new Date();
  }, [currentWeekKeys]);

  const [currentMonthDate, setCurrentMonthDate] = useState(initialDate);

  // Ay değiştirme işlemleri
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    setCurrentMonthDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    setCurrentMonthDate(prev => addMonths(prev, 1));
  };

  const handleGoToActiveWeek = (e) => {
    e.stopPropagation();
    if (currentWeekKeys.length > 0) {
      try {
        setCurrentMonthDate(parseISO(currentWeekKeys[0]));
      } catch (err) {
        setCurrentMonthDate(new Date());
      }
    }
  };

  const handleGoToToday = (e) => {
    e.stopPropagation();
    setCurrentMonthDate(new Date());
  };

  const handleSelectTodayWeek = (e) => {
    e.stopPropagation();
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    const sunday = endOfWeek(monday, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: monday, end: sunday });
    const weekDates = days.map(d => format(d, 'yyyy-MM-dd'));
    if (onSelectWeek) {
      onSelectWeek(weekDates);
    }
    onClose();
  };

  // Takvim Hücreleri Matrisi (Haftalar ve Günler)
  const calendarWeeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonthDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Pazartesi ile başla
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Günleri 7'şerli haftalara böl
    const weeks = [];
    for (let i = 0; i < allDays.length; i += 7) {
      const weekDays = allDays.slice(i, i + 7);
      const weekNumber = getISOWeek(weekDays[0]);
      weeks.push({
        weekNumber,
        days: weekDays,
        weekStartDate: format(weekDays[0], 'yyyy-MM-dd'),
        weekEndDate: format(weekDays[6], 'yyyy-MM-dd')
      });
    }

    return weeks;
  }, [currentMonthDate]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInModal 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Başlığı */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CalendarDays size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Yayın Akışı Takvimi & Hafta Gezgini
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Haftalık ve günlük yayın planlarını seçin. Dolu ve boş günler renklendirilmiştir.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. Takvim Ay Kontrol Çubuğu */}
        <div style={{
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrevMonth}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} /> Önceki Ay
            </button>

            <span style={{
              fontSize: '16px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              padding: '0 8px',
              textTransform: 'capitalize'
            }}>
              {format(currentMonthDate, 'MMMM yyyy', { locale: tr })}
            </span>

            <button
              onClick={handleNextMonth}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sonraki Ay <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleGoToActiveWeek}
              title="Aktif taslak yayın haftasının bulunduğu aya git"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.08)',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <Calendar size={14} /> Aktif Haftaya Git
            </button>

            <button
              onClick={handleGoToToday}
              title="Bugünün bulunduğu aya git"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#10b981',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.18)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <Clock size={14} /> Bugüne Git
            </button>

            <button
              onClick={handleSelectTodayWeek}
              title="Bugünün bulunduğu haftayı seç ve taslak planlamada aç"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-primary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <Sparkles size={14} color="#f59e0b" /> Bugünün Haftasını Aç
            </button>
          </div>
        </div>

        {/* 3. Takvim Matrisi (Haftalar ve Günler) */}
        <div style={{
          padding: '16px 24px',
          overflowY: 'auto',
          flex: 1
        }}>
          {/* Sütun Başlıkları */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px repeat(7, 1fr)',
            gap: '6px',
            marginBottom: '8px'
          }}>
            <div style={{
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 800,
              color: 'var(--text-muted)',
              padding: '6px 0',
              textTransform: 'uppercase'
            }}>
              Hafta
            </div>
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day, idx) => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: idx >= 5 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  padding: '6px 0',
                  textTransform: 'uppercase'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Haftalık Satırlar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {calendarWeeks.map(week => {
              const isWeekActive = week.days.some(d => currentWeekKeys.includes(format(d, 'yyyy-MM-dd')));

              // Bu haftadaki dolu gün sayısı
              const filledDaysInWeek = week.days.filter(d => {
                const dateKey = format(d, 'yyyy-MM-dd');
                const dayData = allSchedules[dateKey];
                return dayData && dayData.programs && dayData.programs.length > 0;
              }).length;

              return (
                <div
                  key={week.weekNumber + week.weekStartDate}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px repeat(7, 1fr)',
                    gap: '6px',
                    alignItems: 'stretch'
                  }}
                >
                  {/* Sol: Hafta Seçim Butonu */}
                  <button
                    onClick={() => {
                      if (onSelectWeek) {
                        onSelectWeek(week.days.map(d => format(d, 'yyyy-MM-dd')));
                      }
                      onClose();
                    }}
                    title={`${week.weekNumber}. Haftayı Aç`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isWeekActive ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: isWeekActive ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                      color: isWeekActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      if (!isWeekActive) e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    }}
                    onMouseLeave={e => {
                      if (!isWeekActive) e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800 }}>
                      {week.weekNumber}. Hafta
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      marginTop: '2px',
                      color: filledDaysInWeek > 0 ? '#10b981' : 'var(--text-muted)'
                    }}>
                      {filledDaysInWeek > 0 ? `${filledDaysInWeek}/7 Dolu` : 'Boş'}
                    </span>
                  </button>

                  {/* 7 Günün Hücreleri */}
                  {week.days.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayData = allSchedules[dateKey];
                    const isDayInCurrentMonth = isSameMonth(day, currentMonthDate);
                    const isTodayDate = isToday(day);
                    const isDayInActiveWeek = currentWeekKeys.includes(dateKey);
                    const isDaySelected = selectedDayKey === dateKey;

                    // DOLU MU?
                    const progCount = dayData?.programs?.length || 0;
                    const isFilled = progCount > 0;
                    const totalMins = dayData?.programs?.reduce((acc, p) => acc + (p.duration || 0), 0) || 0;
                    const totalHours = Math.round(totalMins / 60);

                    return (
                      <div
                        key={dateKey}
                        onClick={() => {
                          if (onSelectDay) {
                            onSelectDay(dateKey, week.days.map(d => format(d, 'yyyy-MM-dd')));
                          }
                          onClose();
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '62px',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: isDaySelected
                            ? 'var(--accent-primary)'
                            : (isFilled ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'),
                          background: isDaySelected
                            ? 'rgba(59, 130, 246, 0.15)'
                            : (isFilled
                              ? 'rgba(16, 185, 129, 0.08)'
                              : (isDayInActiveWeek ? 'rgba(59, 130, 246, 0.04)' : 'var(--bg-secondary)')),
                          opacity: isDayInCurrentMonth ? 1 : 0.45,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = isDaySelected
                            ? 'var(--accent-primary)'
                            : (isFilled ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)');
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                        {/* Üst: Gün Numarası ve Bugün Etiketi */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '13px',
                            fontWeight: isTodayDate || isFilled ? 800 : 600,
                            color: isFilled ? 'var(--text-primary)' : 'var(--text-muted)'
                          }}>
                            {format(day, 'd')}
                          </span>

                          {isTodayDate && (
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              background: 'var(--accent-primary)',
                              color: '#fff',
                              padding: '1px 4px',
                              borderRadius: '4px'
                            }}>
                              Bugün
                            </span>
                          )}
                        </div>

                        {/* Alt: Doluluk Durumu ("Hangi günler dolu ise belli olsun") */}
                        <div style={{ marginTop: '4px' }}>
                          {isFilled ? (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '2px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#059669',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 700
                            }}>
                              <span>● {progCount} Kuşak</span>
                              <span style={{ fontSize: '9px', opacity: 0.85 }}>{totalHours} Sa</span>
                            </div>
                          ) : (
                            <span style={{
                              fontSize: '10px',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic'
                            }}>
                              Boş
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Alt Bilgi & Gösterge (Legend) */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)' }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Dolu Gün (Planlanmış Yayın Akışı Var)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Boş Gün</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.25)', border: '1px solid var(--accent-primary)' }} />
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Aktif Seçili</span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraftCalendarNavigator);
