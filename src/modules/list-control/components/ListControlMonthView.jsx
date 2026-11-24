/**
 * @file src/modules/list-control/components/ListControlMonthView.jsx
 * @description Yayın Liste Kontrol Modülü — Aylık Takvim & Onay / Kontrol Durumu Görünümü.
 */
import React, { useMemo } from 'react';
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth
} from 'date-fns';
import { tr } from 'date-fns/locale';
import usePlanningStore from '../../../store/planningStore';

const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function ListControlMonthView({
  selectedChannel,
  selectedDate,
  onSelectDayToDaily
}) {
  const listControlDays = usePlanningStore(state => state.listControlDays) || {};
  const days = usePlanningStore(state => state.days) || {};
  const adPlacements = usePlanningStore(state => state.adPlacements) || {};
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const calendarCells = useMemo(() => {
    const base = parseISO(selectedDate || todayStr);
    const mStart = startOfMonth(base);
    const mEnd = endOfMonth(base);
    const cStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const cEnd = endOfWeek(mEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: cStart, end: cEnd }).map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const lcKey = `list-control-${selectedChannel}-${dateStr}`;
      const readyKey = `ready-${selectedChannel}-${dateStr}`;
      const lcDay = listControlDays[lcKey];
      const readyDay = days[readyKey];
      const placements = adPlacements[readyKey] || [];
      const activeVar = lcDay?.activeVariant || readyDay?.activeVariant || 'v1';
      const programs =
        lcDay?.variants?.[activeVar]?.programs ||
        readyDay?.variants?.[activeVar]?.programs ||
        [];

      const adCount = programs.filter(p => p.isAdClip || p.isFromAds || p.type === 'ad_break' || p.type === 'ad_spot').length;
      const clipCount = programs.length - adCount;
      const totalDurMin = programs.reduce((s, p) => s + (parseFloat(p.duration) || 0), 0);
      const fillPct = Math.min(100, Math.round((totalDurMin / 1440) * 100));

      const isApproved = Boolean(lcDay?.isApprovedInListControl || readyDay?.adsStatus === 'sent_to_master');
      const isRevised = Boolean(lcDay?.isRevised || readyDay?.isRevised || readyDay?.adsStatus === 'revised');
      const hasData = programs.length > 0 || placements.length > 0;

      return {
        date: d,
        dateStr,
        dayNum: format(d, 'd'),
        inMonth: isSameMonth(d, base),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        totalCount: programs.length,
        clipCount,
        adCount,
        fillPct,
        isApproved,
        isRevised,
        hasData
      };
    });
  }, [selectedChannel, selectedDate, todayStr, listControlDays, days, adPlacements]);

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Haftanın Günleri Başlığı */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: '8px'
      }}>
        {WEEKDAYS.map(w => (
          <div
            key={w}
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--text-secondary)'
            }}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Takvim Hücreleri */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: '8px',
        flex: 1
      }}>
        {calendarCells.map(cell => (
          <div
            key={cell.dateStr}
            onClick={() => onSelectDayToDaily(cell.dateStr)}
            style={{
              minHeight: '112px',
              padding: '10px',
              borderRadius: '12px',
              background: cell.inMonth ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
              opacity: cell.inMonth ? 1 : 0.55,
              border: cell.isToday
                ? '2px solid #2563eb'
                : cell.isSelected
                ? '2px solid var(--accent-primary)'
                : '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <span style={{
                fontSize: '14px',
                fontWeight: 900,
                color: cell.isToday ? '#2563eb' : 'var(--text-primary)'
              }}>
                {cell.dayNum}
              </span>
              {cell.isToday && (
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 900,
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: '#2563eb',
                  color: '#ffffff'
                }}>
                  BUGÜN
                </span>
              )}
            </div>

            {cell.hasData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: cell.isApproved
                    ? 'rgba(16, 185, 129, 0.15)'
                    : cell.isRevised
                    ? 'rgba(245, 158, 11, 0.16)'
                    : 'rgba(37, 99, 235, 0.12)',
                  color: cell.isApproved
                    ? '#059669'
                    : cell.isRevised
                    ? '#d97706'
                    : '#2563eb',
                  alignSelf: 'flex-start'
                }}>
                  {cell.isApproved ? 'Onaylandı' : cell.isRevised ? 'Revize' : 'Kontrol'}
                </span>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {cell.clipCount} Klip • {cell.adCount} Reklam
                </div>
                <div style={{ height: '5px', borderRadius: '999px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${cell.fillPct}%`,
                    height: '100%',
                    background: cell.fillPct >= 98 ? '#10b981' : '#3b82f6'
                  }} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Liste Yok
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
