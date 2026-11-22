/**
 * @file src/modules/list-control/components/ListControlWeekView.jsx
 * @description Yayın Liste Kontrol Modülü — Haftalık (7 Günlük) Denetim & Akış Görünümü.
 * Herhangi bir güne tıklandığında o günün Günlük (Daily) kontrol ekranını açar.
 */
import React, { useMemo } from 'react';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Calendar, CheckCircle2, AlertTriangle, Clock, Film, Megaphone, ArrowRight
} from 'lucide-react';
import usePlanningStore from '../../../store/planningStore';
import { getDraftProgramsForDay } from '../../broadcast/utils/draftDataLoader';
import { isDraftSlotAddedToRundown } from '../../broadcast/components/DraftProgramSlotItem';
import { formatMinuteToClock, formatSecondsReadable } from '../utils/listControlVerificationEngine';

export default function ListControlWeekView({
  selectedChannel,
  selectedDate,
  onSelectDayToDaily
}) {
  const listControlDays = usePlanningStore(state => state.listControlDays) || {};
  const days = usePlanningStore(state => state.days) || {};
  const adPlacements = usePlanningStore(state => state.adPlacements) || {};
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const weekDays = useMemo(() => {
    const base = parseISO(selectedDate || todayStr);
    const weekStart = startOfWeek(base, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
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

      const draftSlots = getDraftProgramsForDay(selectedChannel, dateStr) || [];
      let matchedDraft = 0;
      draftSlots.forEach(slot => {
        if (isDraftSlotAddedToRundown(slot, programs, draftSlots)) matchedDraft++;
      });

      const isApproved = Boolean(lcDay?.isApprovedInListControl || readyDay?.adsStatus === 'sent_to_master');
      const isRevised = Boolean(lcDay?.isRevised || readyDay?.isRevised || readyDay?.adsStatus === 'revised');
      const isFromAds = Boolean(readyDay?.adsStatus === 'completed' || placements.length > 0 || programs.length > 0);

      return {
        dateStr,
        dayLabel: format(d, 'd MMMM', { locale: tr }),
        weekdayLabel: format(d, 'EEEE', { locale: tr }),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        programs,
        clipCount,
        adCount,
        totalDurMin,
        totalDraft: draftSlots.length,
        matchedDraft,
        isApproved,
        isRevised,
        isFromAds
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
      gap: '14px'
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '12px'
      }}>
        {weekDays.map(day => {
          const fillPct = Math.min(100, Math.round((day.totalDurMin / 1440) * 100));
          return (
            <div
              key={day.dateStr}
              onClick={() => onSelectDayToDaily(day.dateStr)}
              style={{
                borderRadius: '14px',
                background: 'var(--bg-secondary)',
                border: day.isToday
                  ? '2px solid #2563eb'
                  : day.isSelected
                  ? '2px solid var(--accent-primary)'
                  : '1px solid var(--border-color)',
                boxShadow: day.isToday ? '0 8px 24px rgba(37, 99, 235, 0.15)' : 'none',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Gün Başlığı */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {day.dayLabel}
                    </span>
                    {day.isToday && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 900,
                        padding: '1px 7px',
                        borderRadius: '999px',
                        background: '#2563eb',
                        color: '#ffffff'
                      }}>
                        BUGÜN
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {day.weekdayLabel}
                  </div>
                </div>

                {/* Durum Rozeti */}
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: day.isApproved
                    ? 'rgba(16, 185, 129, 0.15)'
                    : day.isRevised
                    ? 'rgba(245, 158, 11, 0.16)'
                    : day.isFromAds
                    ? 'rgba(37, 99, 235, 0.14)'
                    : 'var(--bg-tertiary)',
                  color: day.isApproved
                    ? '#059669'
                    : day.isRevised
                    ? '#d97706'
                    : day.isFromAds
                    ? '#2563eb'
                    : 'var(--text-muted)'
                }}>
                  {day.isApproved
                    ? '✓ Onaylandı'
                    : day.isRevised
                    ? '⚠️ Revize İstendi'
                    : day.isFromAds
                    ? '📺 Kontrol Bekliyor'
                    : 'Liste Yok'}
                </span>
              </div>

              {/* İstatistik Satırı */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                background: 'var(--bg-tertiary)',
                fontSize: '11.5px'
              }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10.5px' }}>Klip / Reklam</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {day.clipCount} Klip • {day.adCount} Reklam
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10.5px' }}>Taslak Uyumu</span>
                  <strong style={{ color: day.matchedDraft === day.totalDraft ? '#059669' : '#d97706' }}>
                    {day.matchedDraft} / {day.totalDraft} Kuşak
                  </strong>
                </div>
              </div>

              {/* Doluluk Barı */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>24 Saat Doluluk</span>
                  <span style={{ color: fillPct >= 98 ? '#059669' : '#d97706', fontFamily: 'monospace' }}>
                    %{fillPct} ({formatSecondsReadable(day.totalDurMin * 60)})
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '999px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${fillPct}%`,
                    height: '100%',
                    background: fillPct >= 98 ? '#10b981' : '#3b82f6',
                    borderRadius: '999px'
                  }} />
                </div>
              </div>

              {/* Mini Akış Önizlemesi */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '165px',
                overflowY: 'auto',
                paddingTop: '4px',
                borderTop: '1px dashed var(--border-color)'
              }}>
                {day.programs.length === 0 ? (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                    Bu gün için henüz iletilen yayın listesi bulunmuyor.
                  </div>
                ) : (
                  day.programs.slice(0, 7).map((p, idx) => {
                    const isAd = Boolean(p.isAdClip || p.isFromAds);
                    return (
                      <div
                        key={p.instanceId || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          fontSize: '11px',
                          padding: '3px 6px',
                          borderRadius: '6px',
                          background: isAd ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-primary)'
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatMinuteToClock(p.startMinute || 0).slice(0, 5)}
                        </span>
                        <span style={{
                          flex: 1,
                          fontWeight: 700,
                          color: isAd ? '#d97706' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {p.title}
                        </span>
                      </div>
                    );
                  })
                )}
                {day.programs.length > 7 && (
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', textAlign: 'center', fontWeight: 700 }}>
                    + {day.programs.length - 7} satır daha...
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDayToDaily(day.dateStr);
                }}
                style={{
                  marginTop: 'auto',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--accent-primary)',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>Günlük Kontrole Aç</span>
                <ArrowRight size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
