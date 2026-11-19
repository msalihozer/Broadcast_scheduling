/**
 * @file DraftDayFilter.jsx
 * @description Taslak Planlama kurumsal gün filtreleme sekme kartları.
 * 8 eşit sütunlu grid ile ekrana %100 oturur; her günün doluluk oranını ve kuşak sayısını gösterir.
 */
import React from 'react';
import { DAYS_KEYS } from '../constants/draftConstants';
import useThemeStore from '../../../store/themeStore';

const DAY_ACCENTS = {
  Pazartesi: { line: '#7dd3fc', bg: '#f0f9ff', text: '#0284c7' },
  Salı:      { line: '#c4b5fd', bg: '#f5f3ff', text: '#7c3aed' },
  Çarşamba:  { line: '#67e8f9', bg: '#ecfeff', text: '#0891b2' },
  Perşembe:  { line: '#86efac', bg: '#f0fdf4', text: '#16a34a' },
  Cuma:      { line: '#fcd34d', bg: '#fffbeb', text: '#d97706' },
  Cumartesi: { line: '#fda4af', bg: '#fff1f2', text: '#e11d48' },
  Pazar:     { line: '#a5b4fc', bg: '#eef2ff', text: '#4f46e5' }
};

const DraftDayFilter = ({
  scheduleData,
  selectedDayKey,
  onSelectDay
}) => {
  const themeConfig = useThemeStore(state => state.config);
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
      gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
      gap: '7px',
      fontFamily: 'var(--font-sans)'
    }}>
      {/* 1. TÜM HAFTA SEÇİM KARTI */}
      <button
        type="button"
        onClick={() => onSelectDay('all')}
        title="Tüm haftalık akışı (7 günü birden) yan yana ızgarada göster"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 8px',
          borderRadius: '10px',
          border: '1px solid',
          borderColor: selectedDayKey === 'all' ? '#1d4ed8' : 'var(--border-color)',
          background: selectedDayKey === 'all'
            ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
            : 'var(--bg-primary)',
          color: selectedDayKey === 'all' ? '#ffffff' : 'var(--text-primary)',
          cursor: 'pointer',
          boxShadow: selectedDayKey === 'all'
            ? '0 4px 12px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
            : 'var(--shadow-sm)',
          minHeight: '54px',
          minWidth: 0
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          fontWeight: 800,
          fontSize: '12px',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap'
        }}>
          {selectedDayKey === 'all' && <span>✓</span>}
          <span>TÜM HAFTA</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          marginTop: '3px'
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '5px',
            background: selectedDayKey === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-secondary)',
            color: selectedDayKey === 'all' ? '#ffffff' : 'var(--accent-primary)',
            whiteSpace: 'nowrap'
          }}>
            7 Gün
          </span>
          {totalWeeklyProgs > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '5px',
              background: selectedDayKey === 'all' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(16, 185, 129, 0.14)',
              color: selectedDayKey === 'all' ? '#ffffff' : '#059669'
            }}>
              {totalWeeklyProgs}
            </span>
          )}
        </div>
      </button>

      {/* 2. 7 GÜNLÜK KARTLAR (PAZARTESİ - PAZAR) */}
      {dayKeys.map(dateKey => {
        const day = scheduleData?.[dateKey];
        const isSelected = selectedDayKey === dateKey;
        const parts = dateKey.split('-');
        const shortDate = parts.length === 3 ? `${parts[2]}.${parts[1]}` : (day?.date || dateKey);
        const progCount = day?.programs?.length || 0;
        const totalMinutes = (day?.programs || []).reduce((acc, p) => acc + (p.duration || 0), 0);
        const filledMinutes = Math.min(1440, totalMinutes);
        const fillPercent = Math.min(100, Math.round((filledMinutes / 1440) * 100));
        const emptyPercent = Math.max(0, 100 - fillPercent);

        let cleanDayName = day?.dayName;
        try {
          if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            const trDays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
            cleanDayName = trDays[dateObj.getDay()];
          }
        } catch (e) {}
        if (!cleanDayName) cleanDayName = day?.dayName || 'Gün';
        const customDay = themeConfig?.dayColors?.[cleanDayName];
        const fallbackDay = DAY_ACCENTS[cleanDayName] || DAY_ACCENTS.Pazartesi;
        const dayAccent = {
          line: customDay?.line || fallbackDay.line,
          bg: customDay?.headerBg || fallbackDay.bg,
          text: customDay?.textAccent || fallbackDay.text
        };

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDay(dateKey)}
            title={`${cleanDayName} (${shortDate}) — ${progCount} Kuşak • Dolu: %${fillPercent} / Boş: %${emptyPercent}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '7px 6px',
              borderRadius: '10px',
              border: '1.5px solid',
              borderColor: isSelected ? '#2563eb' : dayAccent.line,
              borderTop: isSelected ? '3.5px solid #1d4ed8' : `4px solid ${dayAccent.line}`,
              background: isSelected
                ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
                : dayAccent.bg,
              color: isSelected ? '#ffffff' : 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: isSelected
                ? '0 4px 12px rgba(37, 99, 235, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)'
                : 'var(--shadow-sm)',
              minHeight: '62px',
              minWidth: 0,
              gap: '3px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              width: '100%'
            }}>
              <span style={{
                fontWeight: 800,
                fontSize: '12px',
                letterSpacing: '-0.02em',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {cleanDayName}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                fontWeight: 600,
                opacity: isSelected ? 0.9 : 0.7
              }}>
                ({shortDate})
              </span>
            </div>

            {/* Gün Altında Doluluk ve Boşluk Oranı */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              width: '100%',
              flexWrap: 'wrap'
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                fontWeight: 800,
                padding: '1px 4px',
                borderRadius: '4px',
                background: isSelected ? 'rgba(255, 255, 255, 0.24)' : 'rgba(16, 185, 129, 0.14)',
                color: isSelected ? '#ffffff' : '#047857',
                whiteSpace: 'nowrap'
              }}>
                Dolu %{fillPercent}
              </span>

              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9.5px',
                fontWeight: 800,
                padding: '1px 4px',
                borderRadius: '4px',
                background: isSelected ? 'rgba(255, 255, 255, 0.16)' : 'rgba(245, 158, 11, 0.14)',
                color: isSelected ? '#ffffff' : '#b45309',
                whiteSpace: 'nowrap'
              }}>
                Boş %{emptyPercent}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default React.memo(DraftDayFilter);
