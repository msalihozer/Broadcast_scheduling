/**
 * @file src/pages/DraftReportsPopout.jsx
 * @description Taslak Planlama Detaylı Raporlar, Program Bazlı (Günlük / Haftalık / Aylık / Yıllık)
 * Yayınlanma & Süre Analizi ve Yayına Giden Liste Karşılaştırması için Ayrı Pencere (/draft-reports).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { CHANNELS } from '../modules/draft/constants/draftPresets';
import scheduleHd from '../data/draft_schedule_ch_hd.json';
import scheduleWay from '../data/draft_schedule_ch_way.json';
import DraftReportsModal from '../modules/draft/components/DraftReportsModal';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const DraftReportsPopout = () => {
  const [selectedChannel, setSelectedChannel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('channel') || 'ch_hd';
  });

  const [weekStartStr, setWeekStartStr] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('week');
    if (w && /^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
    try {
      const savedWeek = localStorage.getItem('draft_active_week_start');
      if (savedWeek) return savedWeek;
    } catch (e) {}
    return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });

  const [schedulesByChannel, setSchedulesByChannel] = useState(() => {
    let hd = null;
    let way = null;
    try {
      const savedHd = localStorage.getItem('draft_schedule_ch_hd');
      if (savedHd) hd = JSON.parse(savedHd);
      const savedWay = localStorage.getItem('draft_schedule_ch_way');
      if (savedWay) way = JSON.parse(savedWay);
    } catch (e) {}
    return {
      ch_hd: hd !== null ? hd : (scheduleHd || {}),
      ch_way: way !== null ? way : (scheduleWay || {})
    };
  });

  useEffect(() => {
    document.title = 'Taslak Planlama — Detaylı Raporlar & Analiz Penceresi';

    const syncFromBackend = async () => {
      try {
        const res = await fetch('/api/getDraftSchedules');
        if (res.ok) {
          const data = await res.json();
          setSchedulesByChannel(prev => ({
            ch_hd: data?.ch_hd && Object.keys(data.ch_hd).length > 0 ? data.ch_hd : prev.ch_hd,
            ch_way: data?.ch_way && Object.keys(data.ch_way).length > 0 ? data.ch_way : prev.ch_way
          }));
        }
      } catch (err) {}
    };

    syncFromBackend();

    const handleStorage = e => {
      if (e.key === 'draft_schedule_ch_hd' || e.key === 'draft_schedule_ch_way') {
        try {
          const chId = e.key.replace('draft_schedule_', '');
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue);
            setSchedulesByChannel(prev => ({ ...prev, [chId]: parsed }));
          }
        } catch (err) {}
      }
      if (e.key === 'draft_active_week_start' && e.newValue) {
        setWeekStartStr(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', syncFromBackend);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', syncFromBackend);
    };
  }, []);

  const activeWeekDates = useMemo(() => {
    try {
      const monday = startOfWeek(parseISO(weekStartStr), { weekStartsOn: 1 });
      return [0, 1, 2, 3, 4, 5, 6].map(i => format(addDays(monday, i), 'yyyy-MM-dd'));
    } catch (e) {
      return [];
    }
  }, [weekStartStr]);

  const dateRangeLabel = useMemo(() => {
    if (activeWeekDates.length < 7) return '';
    try {
      const d1 = parseISO(activeWeekDates[0]);
      const d2 = parseISO(activeWeekDates[6]);
      return `${format(d1, 'd MMMM', { locale: tr })} - ${format(d2, 'd MMMM yyyy', { locale: tr })}`;
    } catch (e) {
      return `${activeWeekDates[0]} - ${activeWeekDates[6]}`;
    }
  }, [activeWeekDates]);

  const currentChannel = useMemo(() => {
    return CHANNELS.find(c => c.id === selectedChannel) || CHANNELS[0];
  }, [selectedChannel]);

  const channelAllSchedule = schedulesByChannel[selectedChannel] || {};

  const activeWeekSchedule = useMemo(() => {
    const slice = {};
    activeWeekDates.forEach(dKey => {
      if (channelAllSchedule[dKey]) {
        slice[dKey] = channelAllSchedule[dKey];
      }
    });
    return slice;
  }, [channelAllSchedule, activeWeekDates]);

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg-primary)' }}>
      <DraftReportsModal
        isOpen={true}
        isStandaloneWindow={true}
        onClose={() => window.close()}
        scheduleData={activeWeekSchedule}
        allChannelSchedule={channelAllSchedule}
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
        channels={CHANNELS}
        currentChannel={currentChannel}
        dateRangeLabel={dateRangeLabel}
        activeWeekDates={activeWeekDates}
      />
    </div>
  );
};

export default DraftReportsPopout;
