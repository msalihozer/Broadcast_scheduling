/**
 * @file DraftDayFilter.jsx
 * @description Semerkand TV Kurumsal Kimlik 2026 - Taslak Planlama gün seçim ve doluluk şeridi (.days).
 * Sol: Tüm Hafta (7 Gün) butonu. Sağ: 7 gün kartı (Gün adı, kısa tarih, Dolu %, 4px ince ilerleme çubuğu).
 */
import React from 'react';
import { DAYS_KEYS } from '../constants/draftConstants';
import useResponsive from '../../../hooks/useResponsive';

const DraftDayFilter = ({
  scheduleData,
  selectedDayKey,
  onSelectDay
}) => {
  const { isMobile } = useResponsive();
  const dayKeys = (scheduleData && Object.keys(scheduleData).length > 0)
    ? Object.keys(scheduleData)
    : DAYS_KEYS;

  const totalWeeklyProgs = Object.values(scheduleData || {}).reduce(
    (acc, d) => acc + (d?.programs?.length || 0),
    0
  );

  return (
    <div style={{
      width: '100%',
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(4, minmax(0, 1fr))' : '150px repeat(7, minmax(0, 1fr))',
      gap: '6px',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* 1. TÜM HAFTA SEÇİM KARTI */}
      <button
        type="button"
        onClick={() => onSelectDay('all')}
        title="Tüm haftalık akışı (7 günü birden) yan yana ızgarada göster"
        style={{
          gridColumn: isMobile ? 'span 4' : 'span 1',
          background: selectedDayKey === 'all' ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
          border: selectedDayKey === 'all' ? '1px solid var(--turkuaz, #0C617C)' : '1px solid var(--border-color, #DCE5E9)',
          color: selectedDayKey === 'all' ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
          borderRadius: '4px',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: '54px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
          <span>TÜM HAFTA</span>
          {totalWeeklyProgs > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '2px',
              background: selectedDayKey === 'all' ? 'rgba(255, 255, 255, 0.22)' : 'var(--turkuaz-50, #E7F0F3)',
              color: selectedDayKey === 'all' ? '#FFFFFF' : 'var(--turkuaz, #0C617C)'
            }}>
              {totalWeeklyProgs}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: selectedDayKey === 'all' ? 'rgba(255, 255, 255, 0.86)' : 'var(--text-secondary, #4B6478)'
        }}>
          7 Gün • 168 Saat
        </div>
      </button>

      {/* 2. 7 GÜNLÜK KARTLAR */}
      {dayKeys.map(dateKey => {
        const day = scheduleData?.[dateKey];
        const isSelected = selectedDayKey === dateKey;
        const parts = dateKey.split('-');
        const shortDate = parts.length === 3 ? `${parts[2]}.${parts[1]}` : (day?.date || dateKey);
        const progCount = day?.programs?.length || 0;
        const totalMinutes = (day?.programs || []).reduce((acc, p) => acc + (p.duration || 0), 0);
        const filledMinutes = Math.min(1440, totalMinutes);
        const fillPercent = Math.min(100, Math.round((filledMinutes / 1440) * 100));
        const isWarn = fillPercent < 80;

        let cleanDayName = day?.dayName;
        try {
          if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const trDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
            cleanDayName = trDays[dateObj.getDay()];
          }
        } catch (e) {}
        if (!cleanDayName) cleanDayName = day?.dayName || 'Gün';

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDay(dateKey)}
            title={`${cleanDayName} (${shortDate}) — ${progCount} Kuşak • Dolu: %${fillPercent}`}
            style={{
              background: isSelected ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
              border: isSelected ? '1px solid var(--turkuaz, #0C617C)' : '1px solid var(--border-color, #DCE5E9)',
              color: isSelected ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
              borderRadius: '4px',
              padding: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              cursor: 'pointer',
              textAlign: 'left',
              minHeight: '54px',
              minWidth: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '4px', width: '100%' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: isSelected ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {cleanDayName}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                color: isSelected ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-muted, #6A7C88)',
                flexShrink: 0
              }}>
                {shortDate}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <div style={{
                flex: 1,
                height: '4px',
                background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-light, #EBF0F2)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <span style={{
                  display: 'block',
                  width: `${fillPercent}%`,
                  height: '100%',
                  background: isSelected
                    ? '#FFFFFF'
                    : isWarn
                    ? 'var(--hardal, #E8B44C)'
                    : 'var(--turkuaz, #0C617C)'
                }} />
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                color: isSelected ? '#FFFFFF' : 'var(--text-secondary, #4B6478)',
                whiteSpace: 'nowrap'
              }}>
                Dolu %{fillPercent}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(DraftDayFilter);
