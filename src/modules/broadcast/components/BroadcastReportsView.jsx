/**
 * @file src/modules/broadcast/components/BroadcastReportsView.jsx
 * @description Yayın Planlama (Yayına Hazır) Modülü İçin Özel Detaylı Raporlar Sayfası.
 *
 * Kapsam:
 * 1. Program Bazlı Günlük, Haftalık, Aylık ve Yıllık Yayınlanma Sayıları ve Kaç Saat Yayınlandığı.
 * 2. Tarih Aralığı Seçimi (Başlangıç - Bitiş Tarihi) ve Program Bazlı Filtreleme + Seçili Program Karnesi.
 * 3. Kategori Bazlı Yayın Dağılımı (Hangi kategoride kaç program, kaç defa ve kaç saat yayınlandı).
 * 4. Taslak Dışında Yayın Planlamada Eklenen Programlar ve Taslak-Yayın Fark Analizi.
 * 5. Reklam Rezervasyona İletilen Liste vs Reklam Rezervasyondan Sonra (Spotlar Yerleştirilmiş Yayına Gidecek Final Liste) Karşılaştırma Raporu.
 * 6. Tüm raporlar ve filtreler için Kurumsal PDF (Sunum), Excel (.xls) ve CSV (.csv) çıktısı.
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  FileText,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  RotateCcw,
  Eye,
  X
} from 'lucide-react';
import useBroadcastStore, { BROADCAST_CHANNELS } from '../store/broadcastStore';
import usePlanningStore from '../../../store/planningStore';
import { getChannelDraftScheduleMap } from '../utils/draftDataLoader';
import {
  exportToCSV,
  exportToExcel,
  exportToPresentationPDF,
  formatSecondsToHoursMin,
  getDatePeriodBuckets
} from '../../../utils/reportExportUtils';

const TR_DAY_ORDER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const normalizeTitleKey = (str = '') =>
  String(str || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s*-\s*bölüm\s*\d+/gi, '')
    .replace(/\s*\(part\s*\d+\)/gi, '')
    .replace(/\s*part\s*\d+/gi, '')
    .replace(/\s*\(kopya\)\s*/gi, '')
    .replace(/[^a-z0-9ğüşıöç]/gi, '')
    .trim();

const extractCleanProgramTitle = (prog = {}) => {
  if (prog.programTitle && String(prog.programTitle).trim()) {
    return String(prog.programTitle).trim();
  }
  const raw = String(prog.title || prog.name || prog.clipName || 'İsimsiz Program').trim();
  return raw
    .replace(/\s*-\s*Bölüm\s*\d+.*$/i, '')
    .replace(/\s*\(Part\s*\d+\).*$/i, '')
    .replace(/\s*_Part\s*\d+.*$/i, '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .trim();
};

const BroadcastReportsView = () => {
  const {
    days: broadcastDays = {},
    selectedChannel,
    selectedDate,
    activeList
  } = useBroadcastStore();

  const {
    days: readyDays = {},
    adPlacements = {},
    companies = [],
    materials = []
  } = usePlanningStore();

  // 'programs' | 'ads_comparison' | 'periods' | 'categories' | 'draft_added'
  const [activeTab, setActiveTab] = useState('programs');
  // 'all' | 'month' | 'week' | 'day'
  const [periodFilter, setPeriodFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedDayNameFilter, setSelectedDayNameFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProgramKey, setExpandedProgramKey] = useState(null);

  const currentChannelObj =
    BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];

  const selectedPeriodBuckets = useMemo(() => getDatePeriodBuckets(selectedDate), [selectedDate]);

  const reportData = useMemo(() => {
    const draftScheduleForChannel = getChannelDraftScheduleMap(selectedChannel) || {};
    const prefix = `${selectedChannel}-`;

    const allDateSet = new Set();
    Object.keys(broadcastDays || {}).forEach(k => {
      if (k.startsWith(prefix)) {
        const dStr = k.slice(prefix.length);
        if (dStr && dStr.length === 10) allDateSet.add(dStr);
      }
    });
    Object.keys(readyDays || {}).forEach(k => {
      const rPrefix = `ready-${selectedChannel}-`;
      if (k.startsWith(rPrefix)) {
        const dStr = k.slice(rPrefix.length);
        if (dStr && dStr.length === 10) allDateSet.add(dStr);
      }
    });
    if (selectedDate) allDateSet.add(selectedDate);

    const sortedDates = Array.from(allDateSet).sort();

    let totalItemsCount = 0;
    let totalProgramSec = 0;
    let totalAdBreakCount = 0;
    let totalPlannedAdBreakSec = 0;
    let totalRealizedAdSpots = 0;
    let totalRealizedAdSec = 0;
    let totalLiveCount = 0;
    let totalLiveSec = 0;
    let totalFillerCount = 0;
    let totalFillerSec = 0;

    const programStatsMap = {};
    const categoryStatsMap = {};
    const periodStats = {
      weekly: {},
      monthly: {},
      yearly: {}
    };

    const preVsPostAdsByDay = [];
    const postAdsBreakDetails = [];
    const addedOutsideDraftList = [];

    sortedDates.forEach(dateStr => {
      const pBuckets = getDatePeriodBuckets(dateStr);

      // Tarih aralığı filtresi varsa öncelikle onu uygula
      if (startDateFilter && dateStr < startDateFilter) return;
      if (endDateFilter && dateStr > endDateFilter) return;

      if (!startDateFilter && !endDateFilter) {
        if (periodFilter === 'day' && dateStr !== selectedDate) return;
        if (periodFilter === 'week' && pBuckets.weekKey !== selectedPeriodBuckets.weekKey) return;
        if (periodFilter === 'month' && pBuckets.monthKey !== selectedPeriodBuckets.monthKey) return;
      }

      if (selectedDayNameFilter !== 'all' && pBuckets.dayName !== selectedDayNameFilter) return;

      const bDay = broadcastDays[`${selectedChannel}-${dateStr}`];
      const rKey = `ready-${selectedChannel}-${dateStr}`;
      const rDay = readyDays[rKey];
      const varKey = activeList === 'B' ? 'v2' : 'v1';

      const bProgs = bDay?.variants?.[activeList]?.programs || [];
      const rProgs = rDay?.variants?.[varKey]?.programs || [];
      const effectiveProgs = bProgs.length > 0 ? bProgs : rProgs;

      if (effectiveProgs.length === 0 && dateStr !== selectedDate) return;

      const draftDayProgs = draftScheduleForChannel?.[dateStr]?.programs || [];
      const draftTitleKeys = new Set(
        draftDayProgs.map(dp => normalizeTitleKey(dp.customTitle || dp.title || '')).filter(Boolean)
      );

      if (!periodStats.weekly[pBuckets.weekKey]) {
        periodStats.weekly[pBuckets.weekKey] = {
          key: pBuckets.weekKey,
          label: pBuckets.weekLabel,
          daysCount: 0,
          programCount: 0,
          programSec: 0,
          adBreakCount: 0,
          adSpotsCount: 0,
          adSec: 0
        };
      }
      if (!periodStats.monthly[pBuckets.monthKey]) {
        periodStats.monthly[pBuckets.monthKey] = {
          key: pBuckets.monthKey,
          label: pBuckets.monthLabel,
          daysCount: 0,
          programCount: 0,
          programSec: 0,
          adBreakCount: 0,
          adSpotsCount: 0,
          adSec: 0
        };
      }
      if (!periodStats.yearly[pBuckets.yearKey]) {
        periodStats.yearly[pBuckets.yearKey] = {
          key: pBuckets.yearKey,
          label: `${pBuckets.yearKey} Yılı`,
          daysCount: 0,
          programCount: 0,
          programSec: 0,
          adBreakCount: 0,
          adSpotsCount: 0,
          adSec: 0
        };
      }

      if (effectiveProgs.length > 0) {
        periodStats.weekly[pBuckets.weekKey].daysCount += 1;
        periodStats.monthly[pBuckets.monthKey].daysCount += 1;
        periodStats.yearly[pBuckets.yearKey].daysCount += 1;
      }

      let dayProgCount = 0;
      let dayProgSec = 0;
      let dayAdBreakCount = 0;
      let dayPlannedAdBreakSec = 0;

      effectiveProgs.forEach(prog => {
        const isAd =
          prog.type === 'ad_break' ||
          String(prog.id || '').toUpperCase() === 'TPL-3' ||
          /^Reklam Kuşağı/i.test(prog.title || '');
        const isIntro =
          !isAd &&
          (prog.isIntroClip ||
            prog.unitType === 'intro' ||
            /^semerkand_intro/i.test(prog.clipName || prog.title || ''));
        const isLive = Boolean(prog.isLive || prog.type === 'live');
        const isFiller = Boolean(
          prog.type === 'filler_slot' ||
            prog.isKisaSlot ||
            prog.isFillerClip ||
            prog.category === 'Dolgu Kuşağı'
        );

        const durSec =
          Number(prog.durationSec) ||
          Math.round((Number(prog.durationFrames) || 0) / 25) ||
          Math.round((parseFloat(prog.duration) || 30) * 60);

        if (isAd) {
          dayAdBreakCount += 1;
          dayPlannedAdBreakSec += durSec;
          totalAdBreakCount += 1;
          totalPlannedAdBreakSec += durSec;
          periodStats.weekly[pBuckets.weekKey].adBreakCount += 1;
          periodStats.monthly[pBuckets.monthKey].adBreakCount += 1;
          periodStats.yearly[pBuckets.yearKey].adBreakCount += 1;
          return;
        }

        if (isIntro) return;

        totalItemsCount += 1;
        totalProgramSec += durSec;
        dayProgCount += 1;
        dayProgSec += durSec;

        if (isLive) {
          totalLiveCount += 1;
          totalLiveSec += durSec;
        } else if (isFiller) {
          totalFillerCount += 1;
          totalFillerSec += durSec;
        }

        periodStats.weekly[pBuckets.weekKey].programCount += 1;
        periodStats.weekly[pBuckets.weekKey].programSec += durSec;
        periodStats.monthly[pBuckets.monthKey].programCount += 1;
        periodStats.monthly[pBuckets.monthKey].programSec += durSec;
        periodStats.yearly[pBuckets.yearKey].programCount += 1;
        periodStats.yearly[pBuckets.yearKey].programSec += durSec;

        const cleanTitle = extractCleanProgramTitle(prog);
        const normKey = normalizeTitleKey(cleanTitle) || cleanTitle;
        const catName = isLive
          ? 'Canlı Yayın'
          : isFiller
          ? 'Dolgu Kuşağı'
          : prog.category || 'Genel Program';

        if (!categoryStatsMap[catName]) {
          categoryStatsMap[catName] = {
            name: catName,
            count: 0,
            seconds: 0,
            uniquePrograms: new Set(),
            daysSet: new Set()
          };
        }
        categoryStatsMap[catName].count += 1;
        categoryStatsMap[catName].seconds += durSec;
        categoryStatsMap[catName].uniquePrograms.add(cleanTitle);
        categoryStatsMap[catName].daysSet.add(dateStr);

        if (!programStatsMap[normKey]) {
          programStatsMap[normKey] = {
            key: normKey,
            title: cleanTitle,
            category: catName,
            isLive,
            isFromDraft: Boolean(prog.isFromDraft || prog.draftId),
            count: 0,
            seconds: 0,
            dayOfWeekMap: {}, // dayName -> { count, seconds }
            daysMap: {}, // dateStr -> { dateKey, dayName, count, seconds, slots: [] }
            weeksMap: {},
            monthsMap: {},
            yearsMap: {},
            episodesSet: new Set()
          };
        }
        const ps = programStatsMap[normKey];
        ps.count += 1;
        ps.seconds += durSec;
        if (isLive) ps.isLive = true;

        if (!ps.dayOfWeekMap[pBuckets.dayName]) {
          ps.dayOfWeekMap[pBuckets.dayName] = { count: 0, seconds: 0 };
        }
        ps.dayOfWeekMap[pBuckets.dayName].count += 1;
        ps.dayOfWeekMap[pBuckets.dayName].seconds += durSec;

        if (!ps.daysMap[dateStr]) {
          ps.daysMap[dateStr] = {
            dateKey: dateStr,
            dayName: pBuckets.dayName,
            count: 0,
            seconds: 0,
            slots: []
          };
        }
        ps.daysMap[dateStr].count += 1;
        ps.daysMap[dateStr].seconds += durSec;
        ps.daysMap[dateStr].slots.push({
          startTime: prog.startTime || prog.exactStartClock || '--:--',
          endTime: prog.endTime || prog.exactEndClock || '--:--',
          episode: prog.episodeNo || prog.episode || '',
          clipName: prog.clipName || '',
          seconds: durSec
        });

        if (!ps.weeksMap[pBuckets.weekKey]) {
          ps.weeksMap[pBuckets.weekKey] = {
            key: pBuckets.weekKey,
            label: pBuckets.weekLabel,
            count: 0,
            seconds: 0,
            daysSet: new Set()
          };
        }
        ps.weeksMap[pBuckets.weekKey].count += 1;
        ps.weeksMap[pBuckets.weekKey].seconds += durSec;
        ps.weeksMap[pBuckets.weekKey].daysSet.add(dateStr);

        if (!ps.monthsMap[pBuckets.monthKey]) {
          ps.monthsMap[pBuckets.monthKey] = {
            key: pBuckets.monthKey,
            label: pBuckets.monthLabel,
            count: 0,
            seconds: 0,
            daysSet: new Set()
          };
        }
        ps.monthsMap[pBuckets.monthKey].count += 1;
        ps.monthsMap[pBuckets.monthKey].seconds += durSec;
        ps.monthsMap[pBuckets.monthKey].daysSet.add(dateStr);

        if (!ps.yearsMap[pBuckets.yearKey]) {
          ps.yearsMap[pBuckets.yearKey] = {
            key: pBuckets.yearKey,
            label: `${pBuckets.yearKey} Yılı`,
            count: 0,
            seconds: 0,
            daysSet: new Set()
          };
        }
        ps.yearsMap[pBuckets.yearKey].count += 1;
        ps.yearsMap[pBuckets.yearKey].seconds += durSec;
        ps.yearsMap[pBuckets.yearKey].daysSet.add(dateStr);
        if (prog.episodeNo) ps.episodesSet.add(`Bölüm ${prog.episodeNo}`);

        const isNotInDraft =
          !prog.isFromDraft &&
          !prog.draftId &&
          (draftTitleKeys.size === 0 || !draftTitleKeys.has(normKey));
        if (isNotInDraft) {
          addedOutsideDraftList.push({
            date: dateStr,
            dayName: pBuckets.dayName,
            title: cleanTitle,
            clipName: prog.clipName || prog.title || cleanTitle,
            category: catName,
            durationSec: durSec,
            durationFormatted: formatSecondsToHoursMin(durSec),
            episodeNo: prog.episodeNo || null
          });
        }
      });

      const dayAdBlocks = adPlacements[rKey] || [];
      let dayRealizedSpots = 0;
      let dayRealizedAdSec = 0;
      let dayFilledBreaks = 0;

      dayAdBlocks.forEach((blk, bIdx) => {
        const ads = blk.ads || [];
        const blkFilledSec = ads.reduce((acc, a) => acc + (Number(a.duration) || 0), 0);
        const blkCapSec = Math.round((Number(blk.duration) || 5) * 60);
        if (ads.length > 0) dayFilledBreaks += 1;
        dayRealizedSpots += ads.length;
        dayRealizedAdSec += blkFilledSec;

        const spotNames = ads.map(a => {
          const mat = materials.find(m => String(m.id) === String(a.materialId));
          const comp = companies.find(c => String(c.id) === String(a.companyId || mat?.companyId));
          return `${comp?.name || 'Firma'}: ${mat?.name || a.materialId} (${a.duration}sn)`;
        });

        postAdsBreakDetails.push({
          date: dateStr,
          dayName: pBuckets.dayName,
          breakNo: bIdx + 1,
          time: blk.time || '00:00',
          timeBlockName: blk.timeBlockName || 'Genel Kuşak',
          ramadanTag: blk.ramadanBreakTag || '',
          plannedCapSec: blkCapSec,
          filledSec: blkFilledSec,
          diffSec: blkFilledSec - blkCapSec,
          spotsCount: ads.length,
          spotSummary: spotNames.join(' | ') || 'Henüz spot yerleşmedi'
        });
      });

      totalRealizedAdSpots += dayRealizedSpots;
      totalRealizedAdSec += dayRealizedAdSec;
      periodStats.weekly[pBuckets.weekKey].adSpotsCount += dayRealizedSpots;
      periodStats.weekly[pBuckets.weekKey].adSec += dayRealizedAdSec;
      periodStats.monthly[pBuckets.monthKey].adSpotsCount += dayRealizedSpots;
      periodStats.monthly[pBuckets.monthKey].adSec += dayRealizedAdSec;
      periodStats.yearly[pBuckets.yearKey].adSpotsCount += dayRealizedSpots;
      periodStats.yearly[pBuckets.yearKey].adSec += dayRealizedAdSec;

      const sentAt =
        bDay?.variants?.[activeList]?.sentToAdsAt ||
        rDay?.sentToAdsAt ||
        null;
      const adsStatus = rDay?.adsStatus || (dayRealizedSpots > 0 ? 'planned' : 'pending');

      const preAdsTotalBroadcastSec = dayProgSec + dayPlannedAdBreakSec;
      const postAdsFinalBroadcastSec = dayProgSec + dayRealizedAdSec;
      const netBroadcastDeltaSec = postAdsFinalBroadcastSec - preAdsTotalBroadcastSec;

      preVsPostAdsByDay.push({
        date: dateStr,
        dayName: pBuckets.dayName,
        listCode: activeList,
        sentAt: sentAt ? new Date(sentAt).toLocaleString('tr-TR') : 'İletilmedi / Yerel',
        adsStatus,
        programCount: dayProgCount,
        programSec: dayProgSec,
        adBreakCount: dayAdBreakCount,
        filledBreaksCount: dayFilledBreaks,
        preAdsPlannedAdSec: dayPlannedAdBreakSec,
        postAdsRealizedSpots: dayRealizedSpots,
        postAdsRealizedAdSec: dayRealizedAdSec,
        preAdsTotalBroadcastSec,
        postAdsFinalBroadcastSec,
        netBroadcastDeltaSec
      });
    });

    const categoriesList = Object.values(categoryStatsMap)
      .map(c => ({
        ...c,
        uniqueProgramsCount: c.uniquePrograms.size,
        activeDaysCount: c.daysSet.size,
        hoursFormatted: formatSecondsToHoursMin(c.seconds),
        sharePct: totalProgramSec > 0 ? Math.round((c.seconds / totalProgramSec) * 100) : 0
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const programsList = Object.values(programStatsMap)
      .map(p => {
        const sortedDaysOfWeek = Object.entries(p.dayOfWeekMap).sort(
          ([a], [b]) => TR_DAY_ORDER.indexOf(a) - TR_DAY_ORDER.indexOf(b)
        );
        const dayBreakdown = sortedDaysOfWeek
          .map(([d, obj]) => `${d}: ${obj.count} kez (${formatSecondsToHoursMin(obj.seconds)})`)
          .join(' • ');

        const detailedDates = Object.values(p.daysMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        const activeDaysCount = Math.max(1, detailedDates.length);
        const firstDateKey = detailedDates[0]?.dateKey || '';
        const lastDateKey = detailedDates[detailedDates.length - 1]?.dateKey || '';
        const formatShortTrDate = dStr => {
          if (!dStr || dStr.length < 10) return dStr;
          const [y, m, d] = dStr.split('-');
          return `${d}.${m}.${y}`;
        };
        const activeDateSpanLabel =
          firstDateKey && lastDateKey
            ? firstDateKey === lastDateKey
              ? formatShortTrDate(firstDateKey)
              : `${formatShortTrDate(firstDateKey)} – ${formatShortTrDate(lastDateKey)}`
            : '-';

        const weeksList = Object.values(p.weeksMap)
          .map(w => ({
            ...w,
            daysCount: w.daysSet ? w.daysSet.size : 0,
            hoursFormatted: formatSecondsToHoursMin(w.seconds)
          }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const monthsList = Object.values(p.monthsMap)
          .map(m => ({
            ...m,
            daysCount: m.daysSet ? m.daysSet.size : 0,
            hoursFormatted: formatSecondsToHoursMin(m.seconds)
          }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const yearsList = Object.values(p.yearsMap)
          .map(y => ({
            ...y,
            daysCount: y.daysSet ? y.daysSet.size : 0,
            hoursFormatted: formatSecondsToHoursMin(y.seconds)
          }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const activeWeeks = Math.max(1, weeksList.length);
        const activeMonths = Math.max(1, monthsList.length);
        const activeYears = Math.max(1, yearsList.length);

        // 1. Günde Ne Kadar (Gerçek Günlük Yayın)
        const dayCounts = detailedDates.map(d => d.count);
        const minDayCount = dayCounts.length > 0 ? Math.min(...dayCounts) : 0;
        const maxDayCount = dayCounts.length > 0 ? Math.max(...dayCounts) : 0;
        const dailyAvgCount = Number((p.count / activeDaysCount).toFixed(1));
        const dailyCountLabel =
          minDayCount === maxDayCount
            ? `Günde ${minDayCount} Defa`
            : `Günde ${minDayCount}–${maxDayCount} Defa (Ort. ${dailyAvgCount})`;
        const dailyAvgSeconds = Math.round(p.seconds / activeDaysCount);
        const dailyAvgHoursFormatted = formatSecondsToHoursMin(dailyAvgSeconds);
        const singleBroadcastFormatted = formatSecondsToHoursMin(Math.round(p.seconds / Math.max(1, p.count)));

        // 2. Haftada Ne Kadar (Pazartesi-Pazar Gerçek Haftalık Yayın)
        const weekCounts = weeksList.map(w => w.count);
        const minWeekCount = weekCounts.length > 0 ? Math.min(...weekCounts) : 0;
        const maxWeekCount = weekCounts.length > 0 ? Math.max(...weekCounts) : 0;
        const avgWeeklyCount = Number((p.count / activeWeeks).toFixed(1));
        const weeklyCountLabel =
          minWeekCount === maxWeekCount
            ? `Haftada ${minWeekCount} Defa`
            : `Haftada ${avgWeeklyCount} Defa (${minWeekCount}–${maxWeekCount})`;
        const weeklyAvgSeconds = Math.round(p.seconds / activeWeeks);
        const weeklyHoursFormatted = formatSecondsToHoursMin(weeklyAvgSeconds);
        const weeksBreakdownText = weeksList
          .map(w => `${w.label}: ${w.count} defa (${w.hoursFormatted}, ${w.daysCount} gün)`)
          .join(' • ');

        // 3. Ayda Ne Kadar (Sadece Kayıtlı Aylık Gerçek Veri)
        const monthlyRecordedCount = Number((p.count / activeMonths).toFixed(1));
        const monthlyRecordedHours = formatSecondsToHoursMin(Math.round(p.seconds / activeMonths));
        const monthsBreakdownText = monthsList
          .map(m => `${m.label}: ${m.count} Defa (${m.hoursFormatted}, ${m.daysCount} gün kayıtlı)`)
          .join(' • ');

        // 4. Yılda Ne Kadar (Sadece Kayıtlı Yıllık Gerçek Veri)
        const yearlyRecordedCount = Number((p.count / activeYears).toFixed(1));
        const yearlyRecordedHours = formatSecondsToHoursMin(Math.round(p.seconds / activeYears));
        const yearsBreakdownText = yearsList
          .map(y => `${y.label}: ${y.count} Defa (${y.hoursFormatted}, ${y.daysCount} gün / ${weeksList.length} hafta kayıtlı)`)
          .join(' • ');

        return {
          ...p,
          activeDaysCount: detailedDates.length,
          activeDateSpanLabel,
          durationSpanSummary: `${detailedDates.length} Günde / ${weeksList.length} Haftada (${activeDateSpanLabel})`,
          sortedDaysOfWeek,
          dayBreakdown,
          detailedDates,
          dailyAvgCount,
          dailyCountLabel,
          dailyAvgHoursFormatted,
          singleBroadcastFormatted,
          activeWeeks: weeksList.length,
          avgWeeklyCount,
          weeklyCountLabel,
          weeklyHoursFormatted,
          weeksBreakdownText,
          monthlyRecordedCount,
          monthlyRecordedHours,
          monthsBreakdownText,
          yearlyRecordedCount,
          yearlyRecordedHours,
          yearsBreakdownText,
          hoursFormatted: formatSecondsToHoursMin(p.seconds),
          weeksList,
          monthsList,
          yearsList,
          episodesList: Array.from(p.episodesSet)
        };
      })
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds);

    return {
      totalItemsCount,
      totalProgramSec,
      totalProgramHoursFormatted: formatSecondsToHoursMin(totalProgramSec),
      totalAdBreakCount,
      totalPlannedAdBreakSec,
      totalPlannedAdBreakHours: formatSecondsToHoursMin(totalPlannedAdBreakSec),
      totalRealizedAdSpots,
      totalRealizedAdSec,
      totalRealizedAdHours: formatSecondsToHoursMin(totalRealizedAdSec),
      totalFinalBroadcastHours: formatSecondsToHoursMin(totalProgramSec + totalRealizedAdSec),
      totalLiveCount,
      totalLiveHours: formatSecondsToHoursMin(totalLiveSec),
      totalFillerCount,
      totalFillerHours: formatSecondsToHoursMin(totalFillerSec),
      programsList,
      categoriesList,
      weeklyList: Object.values(periodStats.weekly).sort((a, b) => b.key.localeCompare(a.key)),
      monthlyList: Object.values(periodStats.monthly).sort((a, b) => b.key.localeCompare(a.key)),
      yearlyList: Object.values(periodStats.yearly).sort((a, b) => b.key.localeCompare(a.key)),
      preVsPostAdsByDay: preVsPostAdsByDay.sort((a, b) => b.date.localeCompare(a.date)),
      postAdsBreakDetails: postAdsBreakDetails.sort((a, b) => b.date.localeCompare(a.date) || a.breakNo - b.breakNo),
      addedOutsideDraftList
    };
  }, [
    broadcastDays,
    readyDays,
    adPlacements,
    selectedChannel,
    selectedDate,
    activeList,
    periodFilter,
    startDateFilter,
    endDateFilter,
    selectedDayNameFilter,
    selectedPeriodBuckets,
    materials,
    companies
  ]);

  const filteredPrograms = useMemo(() => {
    return reportData.programsList.filter(p => {
      if (selectedProgramFilter !== 'all' && p.key !== selectedProgramFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLocaleLowerCase('tr-TR');
        if (
          !p.title.toLocaleLowerCase('tr-TR').includes(q) &&
          !p.category.toLocaleLowerCase('tr-TR').includes(q) &&
          !p.dayBreakdown.toLocaleLowerCase('tr-TR').includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [reportData.programsList, selectedProgramFilter, categoryFilter, searchQuery]);

  const focusedProgram = useMemo(() => {
    if (selectedProgramFilter !== 'all') {
      return reportData.programsList.find(p => p.key === selectedProgramFilter) || null;
    }
    if (expandedProgramKey) {
      return reportData.programsList.find(p => p.key === expandedProgramKey) || null;
    }
    return null;
  }, [selectedProgramFilter, expandedProgramKey, reportData.programsList]);

  const periodScopeLabel =
    startDateFilter || endDateFilter
      ? `Tarih Aralığı: ${startDateFilter || 'Başlangıç'} — ${endDateFilter || 'Bitiş'}`
      : periodFilter === 'day'
      ? `Seçili Gün (${selectedDate})`
      : periodFilter === 'week'
      ? `Seçili Hafta (${selectedPeriodBuckets.weekLabel})`
      : periodFilter === 'month'
      ? `Seçili Ay (${selectedPeriodBuckets.monthLabel})`
      : 'Tüm Kayıtlı Yayın Dönemleri (Haftalık / Aylık / Yıllık)';

  const handleResetFilters = () => {
    setStartDateFilter('');
    setEndDateFilter('');
    setSelectedProgramFilter('all');
    setCategoryFilter('all');
    setSelectedDayNameFilter('all');
    setSearchQuery('');
    setPeriodFilter('all');
  };

  // EXCEL ÇIKTISI
  const handleExportExcel = () => {
    const sections = [
      {
        title: '1. PROGRAM BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK GERÇEK YAYINLANMA RAPORU',
        headers: [
          'Program Adı',
          'Kategori',
          'Toplam Kaç Defa & Ne Kadar Sürede',
          'Toplam Saat',
          'Günde Ne Kadar (Gerçek Günlük Veri)',
          'Haftada Ne Kadar (Pzt-Paz Gerçek Haftalık)',
          'Ayda Ne Kadar (Kayıtlı Aylık Gerçek Veri)',
          'Yılda Ne Kadar (Kayıtlı Yıllık Gerçek Veri)',
          'Hangi Gün Kaç Defa & Kaç Saat Yayınlandı'
        ],
        rows: filteredPrograms.map(p => [
          p.title,
          p.category,
          `${p.count} Defa (${p.durationSpanSummary})`,
          p.hoursFormatted,
          `${p.dailyCountLabel} (${p.dailyAvgHoursFormatted}/gün)`,
          `${p.weeklyCountLabel} (${p.weeklyHoursFormatted}/hafta • ${p.weeksBreakdownText})`,
          p.monthsBreakdownText,
          p.yearsBreakdownText,
          p.dayBreakdown
        ])
      }
    ];

    if (focusedProgram) {
      sections.push({
        title: `2. "${focusedProgram.title}" — GÜN GÜN VE SAAT SAAT YAYIN DÖKÜMÜ`,
        headers: ['Tarih', 'Gün', 'O Gün Kaç Defa', 'O Gün Toplam Süre', 'Yayın Saatleri ve Klipler'],
        rows: focusedProgram.detailedDates.map(d => [
          d.dateKey,
          d.dayName,
          `${d.count} Kez`,
          formatSecondsToHoursMin(d.seconds),
          d.slots.map(s => `${s.startTime}-${s.endTime}${s.episode ? ` (Bölüm ${s.episode})` : ''}`).join(', ')
        ])
      });
    }

    sections.push(
      {
        title: '3. REKLAM REZERVASYONA İLETİLEN LİSTE vs REKLAM SONRASI YAYINA GİDECEK FİNAL LİSTE KARŞILAŞTIRMASI',
        headers: [
          'Tarih',
          'Gün',
          'Program Sayısı & Süresi',
          'İletilen Reklam Kuşağı & Süresi',
          'Reklam Sonrası Yerleşen Spot & Süre',
          'İletilen Toplam Süre',
          'Reklam Sonrası Final Yayın Süresi',
          'Net Süre Farkı',
          'Durum'
        ],
        rows: reportData.preVsPostAdsByDay.map(d => [
          d.date,
          d.dayName,
          `${d.programCount} Program (${formatSecondsToHoursMin(d.programSec)})`,
          `${d.adBreakCount} Kuşak (${formatSecondsToHoursMin(d.preAdsPlannedAdSec)})`,
          `${d.postAdsRealizedSpots} Spot / ${d.filledBreaksCount} Dolu Kuşak (${formatSecondsToHoursMin(d.postAdsRealizedAdSec)})`,
          formatSecondsToHoursMin(d.preAdsTotalBroadcastSec),
          formatSecondsToHoursMin(d.postAdsFinalBroadcastSec),
          `${d.netBroadcastDeltaSec >= 0 ? '+' : '-'}${formatSecondsToHoursMin(Math.abs(d.netBroadcastDeltaSec))}`,
          d.adsStatus === 'completed' ? 'Onaylandı (Yayına Hazır)' : d.postAdsRealizedSpots > 0 ? 'Reklamlar Yerleşti' : 'Reklam Bekliyor'
        ])
      },
      {
        title: '4. KATEGORİ BAZLI YAYINLANMA RAPORU',
        headers: ['Kategori', 'Farklı Program Sayısı', 'Kaç Defa Yayınlandı', 'Toplam Saat', 'Oran (%)'],
        rows: reportData.categoriesList.map(c => [
          c.name,
          `${c.uniqueProgramsCount} Program`,
          `${c.count} Defa`,
          c.hoursFormatted,
          `%${c.sharePct}`
        ])
      },
      {
        title: '5. TASLAK DIŞINDA YAYIN PLANLAMADA EKLENEN PROGRAMLAR',
        headers: ['Tarih', 'Gün', 'Program Adı', 'Klip Adı', 'Kategori', 'Süre'],
        rows: reportData.addedOutsideDraftList.map(a => [
          a.date,
          a.dayName,
          a.title,
          a.clipName,
          a.category,
          a.durationFormatted
        ])
      }
    );

    exportToExcel({
      filename: focusedProgram
        ? `Yayin_Program_Raporu_${focusedProgram.title}_${currentChannelObj.name}`
        : `Yayin_Planlama_Detayli_Rapor_${currentChannelObj.name}_Liste_${activeList}`,
      title: focusedProgram
        ? `YAYIN PLANLAMA PROGRAM BAZLI RAPOR: ${focusedProgram.title} (${currentChannelObj.name})`
        : `YAYIN PLANLAMA & REKLAM SONRASI FİNAL YAYIN RAPORU (${currentChannelObj.name} - Liste ${activeList})`,
      subtitle: `Dönem Kapsamı: ${periodScopeLabel}`,
      kpis: [
        { label: 'Toplam Program / Klip', value: `${reportData.totalItemsCount} Yayın` },
        { label: 'Program Yayın Süresi', value: reportData.totalProgramHoursFormatted },
        { label: 'Reklama İletilen Kuşak', value: `${reportData.totalAdBreakCount} Kuşak (${reportData.totalPlannedAdBreakHours})` },
        { label: 'Reklam Sonrası Yerleşen Spot', value: `${reportData.totalRealizedAdSpots} Spot (${reportData.totalRealizedAdHours})` },
        { label: 'Final Yayına Gidecek Süre', value: reportData.totalFinalBroadcastHours }
      ],
      sections
    });
  };

  // CSV ÇIKTISI
  const handleExportCSV = () => {
    if (activeTab === 'ads_comparison') {
      exportToCSV({
        filename: `Yayin_Reklam_Oncesi_Sonrasi_Karsilastirma_${currentChannelObj.name}`,
        headers: [
          'Tarih',
          'Gün',
          'Program Sayısı',
          'Program Süresi',
          'İletilen Kuşak Sayısı',
          'İletilen Kuşak Süresi',
          'Yerleşen Reklam Spotu',
          'Yerleşen Reklam Süresi',
          'Final Yayın Süresi'
        ],
        rows: reportData.preVsPostAdsByDay.map(d => [
          d.date,
          d.dayName,
          d.programCount,
          formatSecondsToHoursMin(d.programSec),
          d.adBreakCount,
          formatSecondsToHoursMin(d.preAdsPlannedAdSec),
          d.postAdsRealizedSpots,
          formatSecondsToHoursMin(d.postAdsRealizedAdSec),
          formatSecondsToHoursMin(d.postAdsFinalBroadcastSec)
        ])
      });
      return;
    }

    exportToCSV({
      filename: focusedProgram
        ? `Yayin_Program_${focusedProgram.title}_${currentChannelObj.name}`
        : `Yayin_Planlama_Program_Raporu_${currentChannelObj.name}`,
      headers: [
        'Program Adı',
        'Kategori',
        'Toplam Yayın (Kaç Defa)',
        'Ne Kadar Sürede (Gün / Hafta / Tarih Aralığı)',
        'Toplam Saat',
        'Günde Ne Kadar (Adet)',
        'Günde Ne Kadar (Saat)',
        'Haftada Ne Kadar (Adet & Saat)',
        'Ayda Ne Kadar (Kayıtlı Aylık Gerçek Veri)',
        'Yılda Ne Kadar (Kayıtlı Yıllık Gerçek Veri)',
        'Hangi Gün Kaç Defa & Kaç Saat'
      ],
      rows: filteredPrograms.map(p => [
        p.title,
        p.category,
        `${p.count} Defa`,
        p.durationSpanSummary,
        p.hoursFormatted,
        p.dailyCountLabel,
        `${p.dailyAvgHoursFormatted}/gün`,
        `${p.weeklyCountLabel} (${p.weeklyHoursFormatted}/hafta)`,
        p.monthsBreakdownText,
        p.yearsBreakdownText,
        p.dayBreakdown
      ])
    });
  };

  // PDF SUNUM ÇIKTISI
  const handleExportPDF = () => {
    const sections = [
      {
        title: '1. Program Bazlı Günlük, Haftalık, Aylık ve Yıllık Gerçek Yayınlanma Raporu',
        description: 'Yayına giden listede her programın sistemde kayıtlı gerçek verilerine göre ne kadar sürede kaç defa ve kaç saat yayınlandığı.',
        headers: [
          'Program Adı',
          'Kategori',
          'Toplam Yayın & Kapsam Süresi',
          'Günde Ne Kadar',
          'Haftada Ne Kadar',
          'Ayda Ne Kadar (Kayıtlı)',
          'Yılda Ne Kadar (Kayıtlı)',
          'Hangi Günler Yayınlandı'
        ],
        rows: filteredPrograms.map(p => [
          p.title,
          p.category,
          `${p.count} Defa (${p.hoursFormatted}) • ${p.durationSpanSummary}`,
          `${p.dailyCountLabel} (${p.dailyAvgHoursFormatted}/gün)`,
          `${p.weeklyCountLabel} (${p.weeklyHoursFormatted}/hafta)`,
          p.monthsBreakdownText,
          p.yearsBreakdownText,
          p.dayBreakdown
        ])
      }
    ];

    if (focusedProgram) {
      sections.push({
        title: `2. "${focusedProgram.title}" — Gün Gün & Saat Saat Yayın Dökümü`,
        headers: ['Tarih', 'Gün', 'O Gün Kaç Defa', 'Toplam Süre', 'Yayın Saatleri'],
        rows: focusedProgram.detailedDates.map(d => [
          d.dateKey,
          d.dayName,
          `${d.count} Kez`,
          formatSecondsToHoursMin(d.seconds),
          d.slots.map(s => `${s.startTime}-${s.endTime}${s.episode ? ` (Bölüm ${s.episode})` : ''}`).join(', ')
        ])
      });
    }

    sections.push(
      {
        title: '3. Reklam Rezervasyona İletilen Liste vs Reklam Rezervasyondan Sonra Yayına Gidecek Liste Raporu',
        description: 'Reklam öncesi iletilen kuşak kapasitesi ile reklam yerleştirildikten sonraki final yayın listesi karşılaştırması.',
        headers: ['Tarih / Gün', 'Program Sayısı & Süresi', 'İletilen Kuşak & Süre', 'Reklam Sonrası Spot & Süre', 'İletilen Toplam', 'Yayına Gidecek Final Süre', 'Durum'],
        rows: reportData.preVsPostAdsByDay.map(d => [
          `${d.date} (${d.dayName})`,
          `${d.programCount} Prog (${formatSecondsToHoursMin(d.programSec)})`,
          `${d.adBreakCount} Kuşak (${formatSecondsToHoursMin(d.preAdsPlannedAdSec)})`,
          `${d.postAdsRealizedSpots} Spot (${formatSecondsToHoursMin(d.postAdsRealizedAdSec)})`,
          formatSecondsToHoursMin(d.preAdsTotalBroadcastSec),
          formatSecondsToHoursMin(d.postAdsFinalBroadcastSec),
          d.adsStatus === 'completed' ? 'Onaylandı (Yayına Hazır)' : d.postAdsRealizedSpots > 0 ? 'Reklamlar Yerleşti' : 'Bekliyor'
        ])
      },
      {
        title: '4. Kategori Bazlı Yayın Dağılımı',
        headers: ['Kategori', 'Farklı Program Sayısı', 'Kaç Defa Yayınlandı', 'Toplam Saat', 'Oran (%)'],
        rows: reportData.categoriesList.map(c => [
          c.name,
          `${c.uniqueProgramsCount} Program`,
          `${c.count} Defa`,
          c.hoursFormatted,
          `%${c.sharePct}`
        ])
      }
    );

    exportToPresentationPDF({
      title: focusedProgram
        ? `YAYIN PLANLAMA PROGRAM BAZLI ANALİZ SUNUMU: ${focusedProgram.title}`
        : `YAYIN PLANLAMA & REKLAM SONRASI FİNAL YAYIN ANALİZ SUNUMU`,
      subtitle: `Kanal: ${currentChannelObj.name} • Aktif Liste: Liste ${activeList} • Kapsam: ${periodScopeLabel}`,
      badgeText: 'YAYIN PLANLAMA STÜDYOSU • RESMİ YAYIN VE REKLAM RAPORU',
      accentColor: '#059669',
      kpis: focusedProgram
        ? [
            { label: 'Program Adı & Kapsam', value: `${focusedProgram.count} Defa (${focusedProgram.hoursFormatted})`, sub: focusedProgram.durationSpanSummary },
            { label: 'Günde Ne Kadar', value: focusedProgram.dailyCountLabel, sub: `${focusedProgram.dailyAvgHoursFormatted} / gün` },
            { label: 'Haftada Ne Kadar', value: focusedProgram.weeklyCountLabel, sub: `${focusedProgram.weeklyHoursFormatted} / hafta (${focusedProgram.activeWeeks} Hafta)` },
            { label: 'Ayda Ne Kadar (Kayıtlı)', value: `${focusedProgram.monthlyRecordedCount} Defa / Ay`, sub: focusedProgram.monthsBreakdownText, color: '#059669' },
            { label: 'Yılda Ne Kadar (Kayıtlı)', value: `${focusedProgram.yearlyRecordedCount} Defa / Yıl`, sub: focusedProgram.yearsBreakdownText, color: '#d97706' }
          ]
        : [
            { label: 'Program Yayın Süresi', value: reportData.totalProgramHoursFormatted, sub: `${reportData.totalItemsCount} Program / Klip` },
            { label: 'Reklama İletilen Kuşak', value: `${reportData.totalAdBreakCount} Kuşak`, sub: `Planlanan: ${reportData.totalPlannedAdBreakHours}`, color: '#d97706' },
            { label: 'Reklam Sonrası Spotlar', value: `${reportData.totalRealizedAdSpots} Spot`, sub: `Gerçekleşen: ${reportData.totalRealizedAdHours}`, color: '#2563eb' },
            { label: 'Yayına Gidecek Final Süre', value: reportData.totalFinalBroadcastHours, sub: 'Program + Yerleşen Reklamlar', color: '#059669' },
            { label: 'Taslak Dışı Eklenen', value: `${reportData.addedOutsideDraftList.length} Program`, sub: 'Yayın Planlamada eklenen', color: '#9333ea' }
          ],
      highlightCards: [
        {
          title: 'Reklam Rezervasyona İletilen Liste vs Reklam Sonrası Final Liste',
          body: `İletilen ${reportData.totalAdBreakCount} reklam kuşağına (${reportData.totalPlannedAdBreakHours}) karşılık Reklam Rezervasyon sonrasında toplam ${reportData.totalRealizedAdSpots} spot (${reportData.totalRealizedAdHours}) yerleştirilmiş olup final yayın süresi ${reportData.totalFinalBroadcastHours} olarak gerçekleşmiştir.`
        },
        {
          title: 'En Çok Yayınlanan Kategoriler',
          body: reportData.categoriesList.slice(0, 4).map(c => `${c.name}: ${c.count} kez (${c.hoursFormatted}, %${c.sharePct})`).join(' | ') || '-'
        }
      ],
      sections
    });
  };

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        padding: '18px 24px',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}
    >
      {/* 1. ÜST BAŞLIK, DÖNEM FİLTRESİ VE PDF / EXCEL / CSV ÇIKTI BUTONLARI */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)'
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>
              Yayın Planlama — Program Bazlı (Gün / Hafta / Ay / Yıl) &amp; Final Yayın Raporları
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Kanal: <strong style={{ color: 'var(--accent-primary)' }}>{currentChannelObj.name}</strong> • Aktif Liste:{' '}
              <strong>Liste {activeList}</strong> • Kapsam: <strong>{periodScopeLabel}</strong>
            </div>
          </div>
        </div>

        {/* Çıktı Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportPDF}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <FileText size={15} />
            <span>PDF (Sunum) İndir</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Excel (.xls) İndir</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '9px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>CSV İndir</span>
          </button>
        </div>
      </div>

      {/* 2. TARİH ARALIĞI VE PROGRAM BAZLI FİLTRELEME ŞERİDİ */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Calendar size={14} color="#059669" />
            <span>Dönem / Tarih Aralığı:</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              background: 'var(--bg-primary)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}
          >
            {[
              { id: 'all', label: 'Tüm Dönemler' },
              { id: 'month', label: 'Aylık' },
              { id: 'week', label: 'Haftalık' },
              { id: 'day', label: 'Seçili Gün' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPeriodFilter(p.id);
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: periodFilter === p.id && !startDateFilter && !endDateFilter ? 'var(--accent-primary)' : 'transparent',
                  color: periodFilter === p.id && !startDateFilter && !endDateFilter ? '#fff' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={startDateFilter}
            onChange={e => setStartDateFilter(e.target.value)}
            title="Başlangıç Tarihi"
            style={{
              padding: '5px 9px',
              borderRadius: '8px',
              border: startDateFilter ? '1.5px solid #059669' : '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700
            }}
          />
          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={e => setEndDateFilter(e.target.value)}
            title="Bitiş Tarihi"
            style={{
              padding: '5px 9px',
              borderRadius: '8px',
              border: endDateFilter ? '1.5px solid #059669' : '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700
            }}
          />

          <select
            value={selectedDayNameFilter}
            onChange={e => setSelectedDayNameFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: selectedDayNameFilter !== 'all' ? '1.5px solid #059669' : '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <option value="all">Tüm Günler (Pzt - Paz)</option>
            {TR_DAY_ORDER.map(dName => (
              <option key={dName} value={dName}>
                Sadece {dName}
              </option>
            ))}
          </select>
        </div>

        {/* Sağ: Program Bazlı Seçici, Kategori ve Arama */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Filter size={13} color="#059669" />
            <span>Program:</span>
          </div>

          <select
            value={selectedProgramFilter}
            onChange={e => {
              setSelectedProgramFilter(e.target.value);
              if (e.target.value !== 'all') setActiveTab('programs');
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: selectedProgramFilter !== 'all' ? '1.5px solid #059669' : '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 800,
              maxWidth: '240px'
            }}
          >
            <option value="all">Tüm Programlar ({reportData.programsList.length} Program)</option>
            {reportData.programsList.map(p => (
              <option key={p.key} value={p.key}>
                {p.title} ({p.count} Kez • {p.hoursFormatted})
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <option value="all">Tüm Kategoriler</option>
            {reportData.categoriesList.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)'
            }}
          >
            <Search size={13} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Program veya gün ara..."
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '165px'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {(startDateFilter ||
            endDateFilter ||
            selectedProgramFilter !== 'all' ||
            categoryFilter !== 'all' ||
            selectedDayNameFilter !== 'all' ||
            searchQuery) && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={12} />
              <span>Sıfırla</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. 5 ÖZET KPI KARTI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '13px 15px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>TOPLAM PROGRAM YAYIN SAATİ</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
            {reportData.totalProgramHoursFormatted}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            <strong>{reportData.totalItemsCount}</strong> Yayın • <strong>{filteredPrograms.length}</strong> Tekil Program
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '13px 15px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>REKLAMA İLETİLEN KUŞAK</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
            {reportData.totalAdBreakCount} Kuşak
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Planlanan Kapasite: <strong>{reportData.totalPlannedAdBreakHours}</strong>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '13px 15px', borderRadius: '12px', border: '1px solid rgba(5, 150, 105, 0.35)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>REKLAM SONRASI YERLEŞEN SPOT</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            {reportData.totalRealizedAdSpots} Spot
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Reklam Süresi: <strong>{reportData.totalRealizedAdHours}</strong>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '13px 15px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#8b5cf6' }}>YAYINA GİDECEK FİNAL SÜRE</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
            {reportData.totalFinalBroadcastHours}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Programlar + Yerleşen Reklam Spotları
          </div>
        </div>

        <div
          onClick={() => setActiveTab('draft_added')}
          style={{
            background: 'var(--bg-secondary)',
            padding: '13px 15px',
            borderRadius: '12px',
            border: '1px solid rgba(225, 29, 72, 0.35)',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#e11d48' }}>TASLAK DIŞI YAYINDA EKLENEN</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#e11d48', marginTop: '4px' }}>
            +{reportData.addedOutsideDraftList.length} Program
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Canlı: {reportData.totalLiveCount} • Dolgu: {reportData.totalFillerCount}
          </div>
        </div>
      </div>

      {/* 4. RAPOR SEKMELERİ */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'programs', label: `1. Program Bazlı (Gün / Hafta / Ay / Yıl & Saat) (${filteredPrograms.length})` },
            { id: 'ads_comparison', label: `2. Reklama İletilen vs Reklam Sonrası Final Liste (${reportData.preVsPostAdsByDay.length} Gün)` },
            { id: 'periods', label: '3. Haftalık / Aylık / Yıllık Dönem Tablosu' },
            { id: 'categories', label: `4. Kategori Dağılımı (${reportData.categoriesList.length})` },
            { id: 'draft_added', label: `5. Taslak Dışı Eklenen Programlar (${reportData.addedOutsideDraftList.length})` }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '7px 13px',
                borderRadius: '8px',
                border: activeTab === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                background: activeTab === t.id ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. SEKME İÇERİKLERİ */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          overflow: 'hidden'
        }}
      >
        {/* SEKME 1: PROGRAMLAR TABLOSU & SEÇİLİ PROGRAM KARNESİ */}
        {activeTab === 'programs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: focusedProgram ? '16px' : '0px' }}>
            {focusedProgram && (
              <div
                style={{
                  border: '2px solid #059669',
                  borderRadius: '12px',
                  background: 'var(--bg-primary)',
                  padding: '16px 18px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 9px', borderRadius: '6px', background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 800 }}>
                        SEÇİLİ PROGRAM KARNESİ
                      </span>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {focusedProgram.title}
                      </h3>
                      <span style={{ padding: '3px 9px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '11.5px', fontWeight: 700 }}>
                        {focusedProgram.category}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProgramFilter('all');
                      setExpandedProgramKey(null);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Detayı Kapat
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-secondary)', border: '1px solid rgba(37,99,235,0.3)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#2563eb' }}>1. GÜNDE NE KADAR (GERÇEK VERİ)</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, marginTop: '3px' }}>{focusedProgram.dailyCountLabel}</div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>{focusedProgram.dailyAvgHoursFormatted} / gün</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{focusedProgram.activeDaysCount} aktif günde</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-secondary)', border: '1px solid rgba(8,145,178,0.3)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0891b2' }}>2. HAFTADA NE KADAR (PZT–PAZ GERÇEK)</div>
                    <div style={{ fontSize: '17px', fontWeight: 900, marginTop: '3px' }}>{focusedProgram.weeklyCountLabel}</div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>{focusedProgram.weeklyHoursFormatted} / hafta</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{focusedProgram.weeksBreakdownText}</div>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-secondary)', border: '1px solid rgba(5,150,105,0.3)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>3. AYDA NE KADAR (KAYITLI VERİ)</div>
                    {focusedProgram.monthsList.map(m => (
                      <div key={m.key} style={{ marginTop: '3px' }}>
                        <div style={{ fontSize: '15.5px', fontWeight: 900 }}>{m.label}: {m.count} Defa</div>
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#059669' }}>{m.hoursFormatted} ({m.daysCount} gün kayıtlı)</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-secondary)', border: '1px solid rgba(217,119,6,0.35)' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#d97706' }}>4. YILDA NE KADAR (KAYITLI VERİ)</div>
                    {focusedProgram.yearsList.map(y => (
                      <div key={y.key} style={{ marginTop: '3px' }}>
                        <div style={{ fontSize: '15.5px', fontWeight: 900 }}>{y.label}: {y.count} Defa</div>
                        <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#d97706' }}>{y.hoursFormatted} ({y.daysCount} gün / {focusedProgram.activeWeeks} hafta kayıtlı)</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '7px 10px' }}>Tarih</th>
                        <th style={{ padding: '7px 10px' }}>Gün</th>
                        <th style={{ padding: '7px 10px', textAlign: 'center' }}>O Gün Kaç Defa</th>
                        <th style={{ padding: '7px 10px', textAlign: 'center' }}>Toplam Süre</th>
                        <th style={{ padding: '7px 10px' }}>Yayın Kuşakları</th>
                      </tr>
                    </thead>
                    <tbody>
                      {focusedProgram.detailedDates.map(d => (
                        <tr key={d.dateKey} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 800 }}>{d.dateKey}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700 }}>{d.dayName}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>{d.count} Kez</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{formatSecondsToHoursMin(d.seconds)}</td>
                          <td style={{ padding: '6px 10px' }}>
                            {d.slots.map((s, i) => `${s.startTime}-${s.endTime}${s.episode ? ` (Bölüm ${s.episode})` : ''}`).join(' • ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '11px 14px', width: '21%' }}>Program Adı &amp; Kategori</th>
                    <th style={{ padding: '11px 10px', textAlign: 'center', width: '14%' }}>
                      Kayıtlı Toplam Yayın
                      <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Ne Kadar Sürede Kaç Defa)</div>
                    </th>
                    <th style={{ padding: '11px 10px', textAlign: 'center', width: '12%', background: 'rgba(37,99,235,0.06)', color: '#1d4ed8' }}>
                      Günde Ne Kadar
                      <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Günlük Gerçek Veri)</div>
                    </th>
                    <th style={{ padding: '11px 10px', textAlign: 'center', width: '13%', background: 'rgba(8,145,178,0.06)', color: '#0e7490' }}>
                      Haftada Ne Kadar
                      <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Pzt–Paz Gerçek Haftalık)</div>
                    </th>
                    <th style={{ padding: '11px 10px', textAlign: 'center', width: '13%', background: 'rgba(5,150,105,0.06)', color: '#047857' }}>
                      Ayda Ne Kadar
                      <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Kayıtlı Aylık Gerçek Veri)</div>
                    </th>
                    <th style={{ padding: '11px 10px', textAlign: 'center', width: '13%', background: 'rgba(217,119,6,0.06)', color: '#b45309' }}>
                      Yılda Ne Kadar
                      <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Kayıtlı Yıllık Gerçek Veri)</div>
                    </th>
                    <th style={{ padding: '11px 14px', width: '14%' }}>Hangi Gün Kaç Defa Yayınlandı</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Seçili filtreye uygun yayınlanmış program kaydı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredPrograms.map(p => {
                      const isFocused = focusedProgram?.key === p.key;
                      return (
                        <tr
                          key={p.key}
                          onClick={() => setExpandedProgramKey(prev => (prev === p.key ? null : p.key))}
                          style={{
                            borderTop: '1px solid var(--border-color)',
                            background: isFocused ? 'rgba(5, 150, 105, 0.06)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px' }}>
                              {p.title}
                              {p.isLive && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(239,68,68,0.14)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  CANLI
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {p.category}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• Tek yayın: {p.singleBroadcastFormatted}</span>
                              <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Eye size={11} /> Detay
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                            <div style={{ fontWeight: 900, color: '#2563eb', fontSize: '13.5px' }}>{p.count} Defa</div>
                            <div style={{ fontWeight: 800, color: '#059669', fontSize: '12px' }}>{p.hoursFormatted}</div>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                              {p.activeDaysCount} Günde ({p.activeWeeks} Hafta)
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {p.activeDateSpanLabel}
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', background: 'rgba(37,99,235,0.03)' }}>
                            <div style={{ fontWeight: 900, color: '#2563eb' }}>{p.dailyCountLabel}</div>
                            <div style={{ fontWeight: 800, fontSize: '11.5px' }}>{p.dailyAvgHoursFormatted} / gün</div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', background: 'rgba(8,145,178,0.03)' }}>
                            <div style={{ fontWeight: 900, color: '#0891b2' }}>{p.weeklyCountLabel}</div>
                            <div style={{ fontWeight: 800, fontSize: '11.5px' }}>{p.weeklyHoursFormatted} / hafta</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                              {p.weeksList.map(w => (
                                <div key={w.key}>
                                  {w.label}: <strong>{w.count} kez</strong>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', background: 'rgba(5,150,105,0.03)' }}>
                            {p.monthsList.map(m => (
                              <div key={m.key} style={{ marginBottom: p.monthsList.length > 1 ? '4px' : '0px' }}>
                                <div style={{ fontWeight: 900, color: '#059669' }}>{m.label}: {m.count} Defa</div>
                                <div style={{ fontWeight: 800, fontSize: '11.5px' }}>{m.hoursFormatted}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({m.daysCount} gün kayıtlı)</div>
                              </div>
                            ))}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', background: 'rgba(217,119,6,0.03)' }}>
                            {p.yearsList.map(y => (
                              <div key={y.key} style={{ marginBottom: p.yearsList.length > 1 ? '4px' : '0px' }}>
                                <div style={{ fontWeight: 900, color: '#d97706' }}>{y.label}: {y.count} Defa</div>
                                <div style={{ fontWeight: 800, fontSize: '11.5px' }}>{y.hoursFormatted}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({y.daysCount} gün / {p.activeWeeks} hafta kayıtlı)</div>
                              </div>
                            ))}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {p.sortedDaysOfWeek.map(([dName, obj]) => (
                                <span
                                  key={dName}
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    background: 'rgba(37, 99, 235, 0.1)',
                                    color: '#2563eb'
                                  }}
                                >
                                  {dName}: <strong>{obj.count} kez</strong> ({formatSecondsToHoursMin(obj.seconds)})
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEKME 2: REKLAM REZERVASYONA İLETİLEN LİSTE vs REKLAM SONRASI FİNAL LİSTE */}
        {activeTab === 'ads_comparison' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Gün Bazlı: Reklam Rezervasyona İletilen Liste ile Reklam Sonrası (Yayına Gidecek) Liste Karşılaştırması
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px' }}>Tarih &amp; Gün</th>
                    <th style={{ padding: '10px 12px' }}>Programlar (Adet &amp; Saat)</th>
                    <th style={{ padding: '10px 12px' }}>Reklama İletilen Kuşaklar</th>
                    <th style={{ padding: '10px 12px' }}>Reklam Sonrası Yerleşen Spotlar</th>
                    <th style={{ padding: '10px 12px' }}>İletilen Toplam Süre</th>
                    <th style={{ padding: '10px 12px' }}>Yayına Gidecek Final Süre</th>
                    <th style={{ padding: '10px 12px' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.preVsPostAdsByDay.map(d => (
                    <tr key={d.date} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                        {d.date} <span style={{ color: 'var(--text-muted)' }}>({d.dayName})</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                        {d.programCount} Program ({formatSecondsToHoursMin(d.programSec)})
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#d97706' }}>
                        {d.adBreakCount} Kuşak ({formatSecondsToHoursMin(d.preAdsPlannedAdSec)})
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#059669' }}>
                        {d.postAdsRealizedSpots} Spot / {d.filledBreaksCount} Kuşak ({formatSecondsToHoursMin(d.postAdsRealizedAdSec)})
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                        {formatSecondsToHoursMin(d.preAdsTotalBroadcastSec)}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 900, color: '#2563eb' }}>
                        {formatSecondsToHoursMin(d.postAdsFinalBroadcastSec)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: '6px',
                            background:
                              d.adsStatus === 'completed'
                                ? 'rgba(5, 150, 105, 0.14)'
                                : d.postAdsRealizedSpots > 0
                                ? 'rgba(37, 99, 235, 0.14)'
                                : 'rgba(217, 119, 6, 0.14)',
                            color:
                              d.adsStatus === 'completed'
                                ? '#059669'
                                : d.postAdsRealizedSpots > 0
                                ? '#2563eb'
                                : '#d97706'
                          }}
                        >
                          {d.adsStatus === 'completed'
                            ? '✓ Yayına Hazır (Onaylandı)'
                            : d.postAdsRealizedSpots > 0
                            ? '● Reklamlar Yerleştirildi'
                            : '⏳ Reklam Planlama Bekliyor'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {reportData.postAdsBreakDetails.length > 0 && (
              <div>
                <h3 style={{ margin: '8px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Reklam Sonrası Kuşakların İçerik &amp; Spot Detayları ({reportData.postAdsBreakDetails.length} Kuşak)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', border: '1px solid var(--border-color)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 10px' }}>Tarih</th>
                      <th style={{ padding: '8px 10px' }}>Kuşak &amp; Saat</th>
                      <th style={{ padding: '8px 10px' }}>İletilen Kapasite</th>
                      <th style={{ padding: '8px 10px' }}>Yerleşen Spot &amp; Süre</th>
                      <th style={{ padding: '8px 10px' }}>Kuşak İçindeki Reklamlar (Yayına Gidecek Sıra)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.postAdsBreakDetails.slice(0, 60).map((b, idx) => (
                      <tr key={`${b.date}-${b.breakNo}-${idx}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{b.date} ({b.dayName})</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#d97706' }}>
                          {b.breakNo}. Kuşak ({b.time}) {b.ramadanTag ? `• 🌙 ${b.ramadanTag}` : ''}
                        </td>
                        <td style={{ padding: '8px 10px' }}>{b.plannedCapSec} sn</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>
                          {b.spotsCount} Spot ({b.filledSec} sn)
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{b.spotSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SEKME 3: HAFTALIK / AYLIK / YILLIK DÖNEM TABLOSU */}
        {activeTab === 'periods' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', padding: '16px' }}>
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                📅 Haftalık Yayın &amp; Reklam Özeti
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 10px' }}>Hafta</th>
                    <th style={{ padding: '8px 10px' }}>Program</th>
                    <th style={{ padding: '8px 10px' }}>Reklam Spot</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.weeklyList.map(w => (
                    <tr key={w.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{w.label}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>
                        {w.programCount} ({formatSecondsToHoursMin(w.programSec)})
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>
                        {w.adSpotsCount} Spot ({formatSecondsToHoursMin(w.adSec)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                🗓️ Aylık Yayın &amp; Reklam Özeti
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 10px' }}>Ay</th>
                    <th style={{ padding: '8px 10px' }}>Program</th>
                    <th style={{ padding: '8px 10px' }}>Reklam Spot</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.monthlyList.map(m => (
                    <tr key={m.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.label}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>
                        {m.programCount} ({formatSecondsToHoursMin(m.programSec)})
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>
                        {m.adSpotsCount} Spot ({formatSecondsToHoursMin(m.adSec)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                📊 Yıllık Yayın &amp; Reklam Özeti
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 10px' }}>Yıl</th>
                    <th style={{ padding: '8px 10px' }}>Program</th>
                    <th style={{ padding: '8px 10px' }}>Reklam Spot</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.yearlyList.map(y => (
                    <tr key={y.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>{y.label}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>
                        {y.programCount} ({formatSecondsToHoursMin(y.programSec)})
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>
                        {y.adSpotsCount} Spot ({formatSecondsToHoursMin(y.adSec)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEKME 4: KATEGORİ DAĞILIMI */}
        {activeTab === 'categories' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '11px 14px' }}>Kategori Adı</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Farklı Program Sayısı</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Kaç Defa Yayınlandı</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Toplam Yayın Saati</th>
                <th style={{ padding: '11px 14px' }}>Yayın Süresi Payı (%)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.categoriesList.map(cat => (
                <tr key={cat.name} style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 800 }}>{cat.name}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700 }}>{cat.uniqueProgramsCount} Program</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 900, color: '#2563eb' }}>{cat.count} Defa</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{cat.hoursFormatted}</td>
                  <td style={{ padding: '11px 14px', width: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${cat.sharePct}%`, height: '100%', background: '#059669' }} />
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '12px' }}>%{cat.sharePct}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* SEKME 5: TASLAK DIŞINDA YAYIN PLANLAMADA EKLENEN PROGRAMLAR */}
        {activeTab === 'draft_added' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '11px 14px' }}>Tarih &amp; Gün</th>
                <th style={{ padding: '11px 14px' }}>Program Adı</th>
                <th style={{ padding: '11px 14px' }}>Klip / Dosya Adı</th>
                <th style={{ padding: '11px 14px' }}>Kategori</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Süre</th>
                <th style={{ padding: '11px 14px' }}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {reportData.addedOutsideDraftList.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Bu dönemde taslak planlama dışında yayın planlamaya sonradan eklenmiş program kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                reportData.addedOutsideDraftList.map((a, idx) => (
                  <tr key={`${a.date}-${a.title}-${idx}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{a.date} ({a.dayName})</td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>{a.title}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text-secondary)' }}>{a.clipName}</td>
                    <td style={{ padding: '10px 14px' }}>{a.category}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{a.durationFormatted}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', background: 'rgba(5, 150, 105, 0.14)', color: '#059669' }}>
                        + Yayın Planlamada Eklendi
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BroadcastReportsView;
