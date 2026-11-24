/**
 * @file src/modules/broadcast/components/BroadcastReportsView.jsx
 * @description Yayın Planlama (Yayına Hazır) Modülü İçin Özel Detaylı Raporlar ve Geçmiş Yayın Listeleri Arşivi Sayfası.
 *
 * Kapsam:
 * 1. Program Bazlı Günlük, Haftalık (Pzt-Paz), Aylık ve Yıllık Gerçek Yayınlanma Sayıları ve Kaç Saat Yayınlandığı (Ne Kadar Sürede Kaç Defa).
 * 2. Yayın Listeleri & Geçmiş Liste Arşivi: Geçmişten günümüze tüm yayın listeleri (Liste A / Liste B),
 *    Reklam Rezervasyona iletilen listeler ve Reklam Sonrası (spotlar yerleşmiş) saat saat tam yayın akış listeleri.
 * 3. Reklam Rezervasyona İletilen Liste vs Reklam Rezervasyondan Sonra (Yayına Gidecek Final Liste) Karşılaştırma Raporu.
 * 4. Haftalık / Aylık / Yıllık Dönem Tablosu, Kategori Dağılımı ve Taslak Dışında Yayın Planlamada Eklenen Programlar.
 * 5. Tüm raporlar, geçmiş listeler ve filtreler için Kurumsal PDF (Sunum), Excel (.xls) ve CSV (.csv) çıktısı.
 */
import React, { useMemo, useState, useEffect } from 'react';
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
  X,
  ListOrdered,
  History,
  Clock,
  CheckCircle2,
  Megaphone,
  Tv,
  ExternalLink
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
  const raw = String(prog.customTitle || prog.title || prog.name || prog.clipName || 'İsimsiz Program').trim();
  return raw
    .replace(/\s*-\s*Bölüm\s*\d+.*$/i, '')
    .replace(/\s*\(Part\s*\d+\).*$/i, '')
    .replace(/\s*_Part\s*\d+.*$/i, '')
    .replace(/\s*\(Kopya\)\s*/gi, '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .trim();
};

const formatSecToClock = (totalSec = 0) => {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0)) % 86400;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatShortTrDate = (dStr = '') => {
  if (!dStr || dStr.length < 10) return dStr;
  const [y, m, d] = dStr.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

const BroadcastReportsView = () => {
  const {
    days: broadcastDays = {},
    selectedChannel,
    selectedDate,
    setSelectedDate,
    setViewMode,
    activeList,
    setActiveList
  } = useBroadcastStore();

  const {
    days: readyDays = {},
    adPlacements = {},
    companies = [],
    materials = []
  } = usePlanningStore();

  // 'programs' | 'lists_archive' | 'ads_comparison' | 'periods' | 'categories' | 'draft_added'
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

  // Yayın Listeleri & Geçmiş Liste Arşivi Sekmesi Durumları
  // 'all' | 'past' | 'upcoming' | 'sent_to_ads'
  const [archiveTimeFilter, setArchiveTimeFilter] = useState('all');
  // 'all_items' | 'programs_only' | 'ads_only'
  const [archiveItemMode, setArchiveItemMode] = useState('all_items');
  const [inspectedListDate, setInspectedListDate] = useState('');
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) allDateSet.add(dStr);
      }
    });
    Object.keys(readyDays || {}).forEach(k => {
      const rPrefix = `ready-${selectedChannel}-`;
      if (k.startsWith(rPrefix)) {
        const dStr = k.slice(rPrefix.length);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) allDateSet.add(dStr);
      }
    });
    Object.entries(draftScheduleForChannel || {}).forEach(([dStr, dObj]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr) && Array.isArray(dObj?.programs) && dObj.programs.length > 0) {
        allDateSet.add(dStr);
      }
    });
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      allDateSet.add(selectedDate);
    }

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
    const broadcastListsArchive = [];

    sortedDates.forEach(dateStr => {
      const pBuckets = getDatePeriodBuckets(dateStr);

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
      const draftDayProgs = draftScheduleForChannel?.[dateStr]?.programs || [];

      // Öncelik: 1. Yayın Planlama (broadcastDays) -> 2. Reklama İletilen (readyDays) -> 3. Taslak/Arşiv Kaydı
      let effectiveProgs = [];
      let listSourceType = 'empty';
      if (bProgs.length > 0) {
        effectiveProgs = bProgs;
        listSourceType = 'broadcast';
      } else if (rProgs.length > 0) {
        effectiveProgs = rProgs;
        listSourceType = 'ready';
      } else if (draftDayProgs.length > 0) {
        effectiveProgs = draftDayProgs.map((dp, idx) => ({
          ...dp,
          id: dp.id || `draft_${dateStr}_${idx}`,
          title: dp.customTitle || dp.title || 'Program',
          programTitle: dp.customTitle || dp.title || 'Program',
          clipName: Array.isArray(dp.matchedClipNames) && dp.matchedClipNames.length > 0
            ? dp.matchedClipNames.join(' + ')
            : (dp.rawTitle || dp.title || ''),
          durationSec:
            dp.episodeTotalSec && Number(dp.episodeTotalSec) > 0
              ? Number(dp.episodeTotalSec)
              : Math.round((parseFloat(dp.duration) || 30) * 60),
          isFromDraft: true
        }));
        listSourceType = 'draft_archive';
      }

      if (effectiveProgs.length === 0 && dateStr !== selectedDate) return;

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

      // O günün reklam yerleşimleri (kuşak bazlı)
      const dayAdBlocks = adPlacements[rKey] || [];
      let dayRealizedSpots = 0;
      let dayRealizedAdSec = 0;
      let dayFilledBreaks = 0;

      const adBreakPlacementsByIndex = {};
      dayAdBlocks.forEach((blk, bIdx) => {
        const ads = blk.ads || [];
        const blkFilledSec = ads.reduce((acc, a) => acc + (Number(a.duration) || 0), 0);
        const blkCapSec = Math.round((Number(blk.duration) || 5) * 60);
        if (ads.length > 0) dayFilledBreaks += 1;
        dayRealizedSpots += ads.length;
        dayRealizedAdSec += blkFilledSec;

        const detailedSpots = ads.map((a, sIdx) => {
          const mat = materials.find(m => String(m.id) === String(a.materialId));
          const comp = companies.find(c => String(c.id) === String(a.companyId || mat?.companyId));
          return {
            spotOrder: sIdx + 1,
            companyName: comp?.name || 'Firma',
            materialName: mat?.name || a.materialId || 'Reklam Spotu',
            durationSec: Number(a.duration) || 0,
            summary: `${sIdx + 1}. ${comp?.name || 'Firma'} - ${mat?.name || a.materialId} (${a.duration}sn)`
          };
        });

        adBreakPlacementsByIndex[bIdx] = {
          breakNo: bIdx + 1,
          time: blk.time || '00:00',
          timeBlockName: blk.timeBlockName || 'Genel Kuşak',
          ramadanTag: blk.ramadanBreakTag || '',
          plannedCapSec: blkCapSec,
          filledSec: blkFilledSec,
          spotsCount: ads.length,
          detailedSpots,
          spotSummary: detailedSpots.map(s => s.summary).join(' | ') || 'Henüz spot yerleşmedi'
        };

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
          spotSummary: detailedSpots.map(s => s.summary).join(' | ') || 'Henüz spot yerleşmedi'
        });
      });

      let dayProgCount = 0;
      let dayProgSec = 0;
      let dayAdBreakCount = 0;
      let dayPlannedAdBreakSec = 0;
      let dayIntroCount = 0;
      let runningSec = 0;
      let runningBreakIdx = 0;

      const dayRundownItems = [];

      effectiveProgs.forEach((prog, idx) => {
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
            (prog.isKisaSlot && !prog.fileId && prog.type !== 'clip') ||
            prog.isFillerClip ||
            prog.category === 'Dolgu Kuşağı' ||
            (prog.note && String(prog.note).startsWith('Dolgu Kuşağı'))
        );

        const durSec =
          Number(prog.durationSec) ||
          Math.round((Number(prog.durationFrames) || 0) / 25) ||
          Math.round((parseFloat(prog.duration) || 30) * 60);

        const itemStartClock = prog.calculatedStartTime
          ? String(prog.calculatedStartTime).slice(0, 8).replace(/\./g, ':')
          : prog.startTime
          ? String(prog.startTime)
          : formatSecToClock(runningSec);
        const itemEndClock = prog.calculatedEndTime
          ? String(prog.calculatedEndTime).slice(0, 8).replace(/\./g, ':')
          : prog.endTime
          ? String(prog.endTime)
          : formatSecToClock(runningSec + durSec);

        runningSec += durSec;

        if (isAd) {
          const matchedBreakInfo = adBreakPlacementsByIndex[runningBreakIdx] || null;
          runningBreakIdx += 1;
          dayAdBreakCount += 1;
          dayPlannedAdBreakSec += durSec;
          totalAdBreakCount += 1;
          totalPlannedAdBreakSec += durSec;
          periodStats.weekly[pBuckets.weekKey].adBreakCount += 1;
          periodStats.monthly[pBuckets.monthKey].adBreakCount += 1;
          periodStats.yearly[pBuckets.yearKey].adBreakCount += 1;

          dayRundownItems.push({
            orderNo: idx + 1,
            startTime: itemStartClock,
            endTime: itemEndClock,
            title: prog.title || `${runningBreakIdx}. Reklam Kuşağı`,
            clipName: matchedBreakInfo && matchedBreakInfo.spotsCount > 0
              ? `${matchedBreakInfo.spotsCount} Reklam Spotu (${matchedBreakInfo.filledSec} sn)`
              : (prog.note || 'Ticari Reklam Kuşağı'),
            category: 'Reklam Kuşağı',
            itemType: 'ad_break',
            typeLabel: 'Reklam Kuşağı',
            durationSec: durSec,
            durationFormatted: formatSecondsToHoursMin(durSec),
            placedAds: matchedBreakInfo?.detailedSpots || [],
            placedSpotSummary: matchedBreakInfo?.spotSummary || '',
            sourceLabel: 'Reklam Kuşağı'
          });
          return;
        }

        if (isIntro) {
          dayIntroCount += 1;
          dayRundownItems.push({
            orderNo: idx + 1,
            startTime: itemStartClock,
            endTime: itemEndClock,
            title: prog.title || prog.clipName || 'Jenerik / İntro',
            clipName: prog.clipName || prog.fileName || 'SEMERKAND_intro',
            category: 'Jenerik / İntro',
            itemType: 'intro',
            typeLabel: 'Jenerik / İntro',
            durationSec: durSec,
            durationFormatted: formatSecondsToHoursMin(durSec),
            placedAds: [],
            placedSpotSummary: '',
            sourceLabel: 'Otomatik İntro'
          });
          return;
        }

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

        const isNotInDraft =
          !prog.isFromDraft &&
          !prog.draftId &&
          (draftTitleKeys.size === 0 || !draftTitleKeys.has(normKey));

        dayRundownItems.push({
          orderNo: idx + 1,
          startTime: itemStartClock,
          endTime: itemEndClock,
          title: cleanTitle,
          clipName: prog.clipName || prog.fileName || (prog.episode ? `Bölüm ${prog.episode}` : cleanTitle),
          episodeNo: prog.episodeNo || prog.episode || '',
          category: catName,
          itemType: isLive ? 'live' : isFiller ? 'filler' : 'program',
          typeLabel: isLive ? 'Canlı Yayın' : isFiller ? 'Dolgu Kuşağı' : 'Bant Program',
          durationSec: durSec,
          durationFormatted: formatSecondsToHoursMin(durSec),
          placedAds: [],
          placedSpotSummary: '',
          sourceLabel: isNotInDraft ? '+ Yayında Eklendi' : 'Taslak Akışı'
        });

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
            dayOfWeekMap: {},
            daysMap: {},
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
          startTime: itemStartClock,
          endTime: itemEndClock,
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
      const savedAt =
        bDay?.variants?.[activeList]?.savedAt ||
        bDay?.savedAt ||
        rDay?.savedAt ||
        null;
      const adsStatus = rDay?.adsStatus || (dayRealizedSpots > 0 ? 'planned' : 'pending');

      const preAdsTotalBroadcastSec = dayProgSec + dayPlannedAdBreakSec;
      const postAdsFinalBroadcastSec = dayProgSec + dayRealizedAdSec;
      const netBroadcastDeltaSec = postAdsFinalBroadcastSec - preAdsTotalBroadcastSec;

      const isPastDate = dateStr < todayIso;
      const isTodayDate = dateStr === todayIso;

      let statusLabel = 'Kayıtlı Yayın Listesi';
      let statusColor = '#2563eb';
      let statusBg = 'rgba(37, 99, 235, 0.12)';
      if (adsStatus === 'completed') {
        statusLabel = 'Yayına Hazır (Reklam Onaylı)';
        statusColor = '#059669';
        statusBg = 'rgba(5, 150, 105, 0.14)';
      } else if (dayRealizedSpots > 0) {
        statusLabel = `● Reklam Spotları Yerleşti (${dayRealizedSpots} Spot)`;
        statusColor = '#0891b2';
        statusBg = 'rgba(8, 145, 178, 0.14)';
      } else if (sentAt) {
        statusLabel = 'Reklam Rezervasyona İletildi';
        statusColor = '#d97706';
        statusBg = 'rgba(217, 119, 6, 0.14)';
      } else if (listSourceType === 'draft_archive') {
        statusLabel = isPastDate ? 'Geçmiş Arşiv Listesi' : 'Planlanan Yayın Listesi';
        statusColor = '#6366f1';
        statusBg = 'rgba(99, 102, 241, 0.12)';
      }

      const dayArchiveRecord = {
        date: dateStr,
        formattedDate: formatShortTrDate(dateStr),
        dayName: pBuckets.dayName,
        weekLabel: pBuckets.weekLabel,
        monthLabel: pBuckets.monthLabel,
        listCode: activeList,
        listSourceType,
        isPastDate,
        isTodayDate,
        sentAt,
        sentAtFormatted: sentAt ? new Date(sentAt).toLocaleString('tr-TR') : null,
        savedAtFormatted: savedAt ? new Date(savedAt).toLocaleString('tr-TR') : null,
        adsStatus,
        statusLabel,
        statusColor,
        statusBg,
        totalItemsCount: dayRundownItems.length,
        programCount: dayProgCount,
        programSec: dayProgSec,
        programHoursFormatted: formatSecondsToHoursMin(dayProgSec),
        introCount: dayIntroCount,
        adBreakCount: dayAdBreakCount,
        filledBreaksCount: dayFilledBreaks,
        preAdsPlannedAdSec: dayPlannedAdBreakSec,
        postAdsRealizedSpots: dayRealizedSpots,
        postAdsRealizedAdSec: dayRealizedAdSec,
        preAdsTotalBroadcastSec,
        postAdsFinalBroadcastSec,
        totalBroadcastHoursFormatted: formatSecondsToHoursMin(
          dayRealizedSpots > 0 ? postAdsFinalBroadcastSec : preAdsTotalBroadcastSec
        ),
        netBroadcastDeltaSec,
        rundownItems: dayRundownItems
      };

      broadcastListsArchive.push(dayArchiveRecord);
      preVsPostAdsByDay.push(dayArchiveRecord);
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

        const monthlyRecordedCount = Number((p.count / activeMonths).toFixed(1));
        const monthlyRecordedHours = formatSecondsToHoursMin(Math.round(p.seconds / activeMonths));
        const monthsBreakdownText = monthsList
          .map(m => `${m.label}: ${m.count} Defa (${m.hoursFormatted}, ${m.daysCount} gün kayıtlı)`)
          .join(' • ');

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

    const sortedArchiveLists = [...broadcastListsArchive].sort((a, b) => b.date.localeCompare(a.date));

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
      preVsPostAdsByDay: sortedArchiveLists,
      broadcastListsArchive: sortedArchiveLists,
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
    companies,
    todayIso
  ]);

  // Geçmiş & Güncel Yayın Listeleri Filtresi
  const filteredArchiveLists = useMemo(() => {
    return reportData.broadcastListsArchive.filter(dayList => {
      if (archiveTimeFilter === 'past' && !dayList.isPastDate) return false;
      if (archiveTimeFilter === 'upcoming' && dayList.isPastDate) return false;
      if (
        archiveTimeFilter === 'sent_to_ads' &&
        !dayList.sentAt &&
        dayList.postAdsRealizedSpots === 0 &&
        dayList.adsStatus !== 'completed'
      ) {
        return false;
      }

      if (archiveSearchQuery.trim()) {
        const q = archiveSearchQuery.toLocaleLowerCase('tr-TR');
        const dateMatches =
          dayList.date.includes(q) ||
          dayList.formattedDate.includes(q) ||
          dayList.dayName.toLocaleLowerCase('tr-TR').includes(q);
        const itemMatches = dayList.rundownItems.some(
          it =>
            it.title.toLocaleLowerCase('tr-TR').includes(q) ||
            it.clipName.toLocaleLowerCase('tr-TR').includes(q) ||
            it.category.toLocaleLowerCase('tr-TR').includes(q)
        );
        if (!dateMatches && !itemMatches) return false;
      }

      return true;
    });
  }, [reportData.broadcastListsArchive, archiveTimeFilter, archiveSearchQuery]);

  // İncelenen aktif günlük yayın listesini otomatik seç
  useEffect(() => {
    if (filteredArchiveLists.length > 0) {
      const exists = filteredArchiveLists.some(d => d.date === inspectedListDate);
      if (!exists) {
        const matchSelected = filteredArchiveLists.find(d => d.date === selectedDate);
        setInspectedListDate(matchSelected ? matchSelected.date : filteredArchiveLists[0].date);
      }
    } else {
      setInspectedListDate('');
    }
  }, [filteredArchiveLists, inspectedListDate, selectedDate]);

  const activeInspectedDayList = useMemo(() => {
    return (
      filteredArchiveLists.find(d => d.date === inspectedListDate) ||
      filteredArchiveLists[0] ||
      null
    );
  }, [filteredArchiveLists, inspectedListDate]);

  const filteredInspectedRundownItems = useMemo(() => {
    if (!activeInspectedDayList) return [];
    return activeInspectedDayList.rundownItems.filter(it => {
      if (archiveItemMode === 'programs_only' && (it.itemType === 'ad_break' || it.itemType === 'intro')) return false;
      if (archiveItemMode === 'ads_only' && it.itemType !== 'ad_break') return false;
      if (archiveSearchQuery.trim()) {
        const q = archiveSearchQuery.toLocaleLowerCase('tr-TR');
        const dateMatches =
          activeInspectedDayList.date.includes(q) ||
          activeInspectedDayList.dayName.toLocaleLowerCase('tr-TR').includes(q);
        if (
          !dateMatches &&
          !it.title.toLocaleLowerCase('tr-TR').includes(q) &&
          !it.clipName.toLocaleLowerCase('tr-TR').includes(q) &&
          !it.placedSpotSummary.toLocaleLowerCase('tr-TR').includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [activeInspectedDayList, archiveItemMode, archiveSearchQuery]);

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
      ? `Tarih Aralığı: ${startDateFilter || 'Başlangıç'} — ${endDateFilter || 'Bitiş'} (${reportData.broadcastListsArchive.length} Gün)`
      : periodFilter === 'day'
      ? `Seçili Gün (${selectedDate})`
      : periodFilter === 'week'
      ? `Seçili Hafta (${selectedPeriodBuckets.weekLabel})`
      : periodFilter === 'month'
      ? `Seçili Ay (${selectedPeriodBuckets.monthLabel})`
      : `Tüm Kayıtlı Yayın Dönemleri (${reportData.broadcastListsArchive.length} Günlük Liste)`;

  const handleResetFilters = () => {
    setStartDateFilter('');
    setEndDateFilter('');
    setSelectedProgramFilter('all');
    setCategoryFilter('all');
    setSelectedDayNameFilter('all');
    setSearchQuery('');
    setArchiveSearchQuery('');
    setArchiveTimeFilter('all');
    setPeriodFilter('all');
  };

  // TEK BİR GEÇMİŞ / GÜNCEL GÜNÜN TAM YAYIN LİSTESİNİ ÇIKTI ALMA (PDF / EXCEL / CSV)
  const handleExportSingleDayList = (dayList, formatType = 'pdf') => {
    if (!dayList) return;
    const rows = dayList.rundownItems.map(it => [
      `#${it.orderNo}`,
      `${it.startTime} – ${it.endTime}`,
      it.title,
      it.clipName,
      it.typeLabel,
      it.category,
      it.durationFormatted,
      it.itemType === 'ad_break'
        ? it.placedSpotSummary || 'Kuşak içine henüz spot yerleşmedi'
        : it.sourceLabel
    ]);

    const headers = [
      'Sıra',
      'Saat Aralığı',
      'Program / Yayın Öğesi Adı',
      'Klip / Bölüm / Dosya Adı',
      'Yayın Türü',
      'Kategori',
      'Süre',
      'Kuşak İçi Reklam Spotları / Kaynak'
    ];

    if (formatType === 'csv') {
      exportToCSV({
        filename: `Yayin_Listesi_${currentChannelObj.name}_${dayList.date}_Liste_${dayList.listCode}`,
        headers,
        rows
      });
      return;
    }

    if (formatType === 'excel') {
      exportToExcel({
        filename: `Yayin_Listesi_${currentChannelObj.name}_${dayList.date}_Liste_${dayList.listCode}`,
        title: `${currentChannelObj.name} — ${dayList.formattedDate} (${dayList.dayName}) TAM YAYIN AKIŞ LİSTESİ (Liste ${dayList.listCode})`,
        subtitle: `Durum: ${dayList.statusLabel} • Toplam Yayın Süresi: ${dayList.totalBroadcastHoursFormatted}`,
        kpis: [
          { label: 'Yayın Tarihi & Gün', value: `${dayList.formattedDate} (${dayList.dayName})` },
          { label: 'Program Sayısı & Süresi', value: `${dayList.programCount} Program (${dayList.programHoursFormatted})` },
          { label: 'Reklam Kuşağı Sayısı', value: `${dayList.adBreakCount} Kuşak` },
          { label: 'Yerleşen Reklam Spotu', value: `${dayList.postAdsRealizedSpots} Spot (${formatSecondsToHoursMin(dayList.postAdsRealizedAdSec)})` },
          { label: 'Toplam Yayın Süresi', value: dayList.totalBroadcastHoursFormatted }
        ],
        sections: [
          {
            title: `${dayList.formattedDate} (${dayList.dayName}) SAAT SAAT YAYIN AKIŞ LİSTESİ (00:00 - 24:00)`,
            headers,
            rows
          }
        ]
      });
      return;
    }

    exportToPresentationPDF({
      title: `${dayList.formattedDate} (${dayList.dayName}) — TAM YAYIN AKIŞ LİSTESİ`,
      subtitle: `Kanal: ${currentChannelObj.name} • Liste ${dayList.listCode} • Durum: ${dayList.statusLabel}`,
      badgeText: 'YAYIN PLANLAMA & GEÇMİŞ YAYIN LİSTESİ ARŞİVİ • RESMİ YAYIN AKIŞI',
      accentColor: '#059669',
      kpis: [
        { label: 'Yayın Tarihi', value: dayList.formattedDate, sub: dayList.dayName },
        { label: 'Program Akışı', value: `${dayList.programCount} Program`, sub: dayList.programHoursFormatted },
        { label: 'Reklam Kuşakları', value: `${dayList.adBreakCount} Kuşak`, sub: `Planlanan: ${formatSecondsToHoursMin(dayList.preAdsPlannedAdSec)}`, color: '#d97706' },
        { label: 'Yerleşen Reklamlar', value: `${dayList.postAdsRealizedSpots} Spot`, sub: formatSecondsToHoursMin(dayList.postAdsRealizedAdSec), color: '#2563eb' },
        { label: 'Toplam Yayın Süresi', value: dayList.totalBroadcastHoursFormatted, sub: `Liste ${dayList.listCode}`, color: '#059669' }
      ],
      sections: [
        {
          title: `${dayList.formattedDate} (${dayList.dayName}) Saat Saat Yayın Akış Listesi (${dayList.rundownItems.length} Öğe)`,
          description: 'Programlar, klipler, canlı yayınlar, reklam kuşakları ve kuşak içine yerleşen reklam spotlarının sıralı tam listesi.',
          headers,
          rows
        }
      ]
    });
  };

  // GENEL EXCEL ÇIKTISI (Geçmiş Yayın Listeleri Özeti ve Seçili Gün Tam Listesi Dahil)
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
      },
      {
        title: '2. GEÇMİŞTEN GÜNÜMÜZE KAYITLI YAYIN LİSTELERİ ARŞİVİ & REKLAM ÖNCESİ/SONRASI KARŞILAŞTIRMASI',
        headers: [
          'Tarih',
          'Gün',
          'Geçmiş / Güncel',
          'Program Sayısı & Süresi',
          'İletilen Reklam Kuşağı & Süresi',
          'Reklam Sonrası Yerleşen Spot & Süre',
          'Toplam Yayın Süresi',
          'Durum'
        ],
        rows: filteredArchiveLists.map(d => [
          d.formattedDate,
          d.dayName,
          d.isPastDate ? 'Geçmiş Yayın Listesi' : d.isTodayDate ? 'Bugünün Listesi' : 'Planlanan Liste',
          `${d.programCount} Program (${d.programHoursFormatted})`,
          `${d.adBreakCount} Kuşak (${formatSecondsToHoursMin(d.preAdsPlannedAdSec)})`,
          `${d.postAdsRealizedSpots} Spot / ${d.filledBreaksCount} Dolu Kuşak (${formatSecondsToHoursMin(d.postAdsRealizedAdSec)})`,
          d.totalBroadcastHoursFormatted,
          d.statusLabel
        ])
      }
    ];

    if (activeInspectedDayList) {
      sections.push({
        title: `3. SEÇİLİ YAYIN LİSTESİ TAM AKIŞ DÖKÜMÜ: ${activeInspectedDayList.formattedDate} (${activeInspectedDayList.dayName})`,
        headers: [
          'Sıra',
          'Saat Aralığı',
          'Program / Yayın Öğesi Adı',
          'Klip / Bölüm Adı',
          'Tür',
          'Kategori',
          'Süre',
          'Kuşak İçi Reklam Spotları / Kaynak'
        ],
        rows: activeInspectedDayList.rundownItems.map(it => [
          `#${it.orderNo}`,
          `${it.startTime} – ${it.endTime}`,
          it.title,
          it.clipName,
          it.typeLabel,
          it.category,
          it.durationFormatted,
          it.itemType === 'ad_break' ? (it.placedSpotSummary || 'Spot yok') : it.sourceLabel
        ])
      });
    }

    sections.push(
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
      filename: `Yayin_Planlama_Detayli_Rapor_ve_Listeler_${currentChannelObj.name}_Liste_${activeList}`,
      title: `YAYIN PLANLAMA, GEÇMİŞ YAYIN LİSTELERİ VE FİNAL YAYIN RAPORU (${currentChannelObj.name} - Liste ${activeList})`,
      subtitle: `Dönem Kapsamı: ${periodScopeLabel}`,
      kpis: [
        { label: 'Kayıtlı Günlük Liste', value: `${filteredArchiveLists.length} Günlük Liste` },
        { label: 'Toplam Program / Klip', value: `${reportData.totalItemsCount} Yayın` },
        { label: 'Program Yayın Süresi', value: reportData.totalProgramHoursFormatted },
        { label: 'Reklam Sonrası Yerleşen Spot', value: `${reportData.totalRealizedAdSpots} Spot (${reportData.totalRealizedAdHours})` },
        { label: 'Final Yayına Gidecek Süre', value: reportData.totalFinalBroadcastHours }
      ],
      sections
    });
  };

  // GENEL CSV ÇIKTISI
  const handleExportCSV = () => {
    if (activeTab === 'lists_archive' && activeInspectedDayList) {
      handleExportSingleDayList(activeInspectedDayList, 'csv');
      return;
    }

    if (activeTab === 'ads_comparison') {
      exportToCSV({
        filename: `Yayin_Listeleri_Arsivi_ve_Reklam_Karsilastirma_${currentChannelObj.name}`,
        headers: [
          'Tarih',
          'Gün',
          'Program Sayısı',
          'Program Süresi',
          'İletilen Kuşak Sayısı',
          'İletilen Kuşak Süresi',
          'Yerleşen Reklam Spotu',
          'Yerleşen Reklam Süresi',
          'Final Yayın Süresi',
          'Durum'
        ],
        rows: filteredArchiveLists.map(d => [
          d.formattedDate,
          d.dayName,
          d.programCount,
          d.programHoursFormatted,
          d.adBreakCount,
          formatSecondsToHoursMin(d.preAdsPlannedAdSec),
          d.postAdsRealizedSpots,
          formatSecondsToHoursMin(d.postAdsRealizedAdSec),
          d.totalBroadcastHoursFormatted,
          d.statusLabel
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

  // GENEL PDF SUNUM ÇIKTISI
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
      },
      {
        title: '2. Geçmişten Günümüze Yayın Listeleri Arşivi & Reklam Öncesi / Sonrası Karşılaştırması',
        description: 'Kayıtlı tüm geçmiş ve güncel yayın listelerinin program, reklam kuşağı, yerleşen reklam spotu ve toplam yayın süresi özeti.',
        headers: ['Tarih / Gün', 'Dönem', 'Program Sayısı & Süresi', 'İletilen Kuşak & Süre', 'Reklam Sonrası Spot & Süre', 'Toplam Yayın Süresi', 'Durum'],
        rows: filteredArchiveLists.map(d => [
          `${d.formattedDate} (${d.dayName})`,
          d.isPastDate ? 'Geçmiş Liste' : d.isTodayDate ? 'Bugün' : 'Planlanan',
          `${d.programCount} Prog (${d.programHoursFormatted})`,
          `${d.adBreakCount} Kuşak (${formatSecondsToHoursMin(d.preAdsPlannedAdSec)})`,
          `${d.postAdsRealizedSpots} Spot (${formatSecondsToHoursMin(d.postAdsRealizedAdSec)})`,
          d.totalBroadcastHoursFormatted,
          d.statusLabel
        ])
      }
    ];

    if (activeInspectedDayList) {
      sections.push({
        title: `3. Seçili Gün Tam Yayın Akış Listesi: ${activeInspectedDayList.formattedDate} (${activeInspectedDayList.dayName} - Liste ${activeInspectedDayList.listCode})`,
        description: 'Seçili günün 00:00 - 24:00 arası saat saat program, klip, reklam kuşağı ve kuşak içi spot dökümü.',
        headers: ['Sıra', 'Saat Aralığı', 'Program / Öğe Adı', 'Klip / Bölüm', 'Tür', 'Süre', 'Kuşak İçi Spotlar / Kaynak'],
        rows: activeInspectedDayList.rundownItems.map(it => [
          `#${it.orderNo}`,
          `${it.startTime} – ${it.endTime}`,
          it.title,
          it.clipName,
          it.typeLabel,
          it.durationFormatted,
          it.itemType === 'ad_break' ? (it.placedSpotSummary || 'Spot yok') : it.sourceLabel
        ])
      });
    }

    sections.push({
      title: '4. Kategori Bazlı Yayın Dağılımı',
      headers: ['Kategori', 'Farklı Program Sayısı', 'Kaç Defa Yayınlandı', 'Toplam Saat', 'Oran (%)'],
      rows: reportData.categoriesList.map(c => [
        c.name,
        `${c.uniqueProgramsCount} Program`,
        `${c.count} Defa`,
        c.hoursFormatted,
        `%${c.sharePct}`
      ])
    });

    exportToPresentationPDF({
      title: focusedProgram
        ? `YAYIN PLANLAMA PROGRAM BAZLI ANALİZ SUNUMU: ${focusedProgram.title}`
        : `YAYIN PLANLAMA, GEÇMİŞ LİSTELER & FİNAL YAYIN ANALİZ SUNUMU`,
      subtitle: `Kanal: ${currentChannelObj.name} • Aktif Liste: Liste ${activeList} • Kapsam: ${periodScopeLabel}`,
      badgeText: 'YAYIN PLANLAMA STÜDYOSU • RESMİ YAYIN LİSTELERİ VE REKLAM RAPORU',
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
            { label: 'Kayıtlı Yayın Listesi', value: `${filteredArchiveLists.length} Günlük Liste`, sub: `Geçmiş: ${filteredArchiveLists.filter(d => d.isPastDate).length} • Güncel: ${filteredArchiveLists.filter(d => !d.isPastDate).length}` },
            { label: 'Program Yayın Süresi', value: reportData.totalProgramHoursFormatted, sub: `${reportData.totalItemsCount} Program / Klip` },
            { label: 'Reklama İletilen Kuşak', value: `${reportData.totalAdBreakCount} Kuşak`, sub: `Planlanan: ${reportData.totalPlannedAdBreakHours}`, color: '#d97706' },
            { label: 'Reklam Sonrası Spotlar', value: `${reportData.totalRealizedAdSpots} Spot`, sub: `Gerçekleşen: ${reportData.totalRealizedAdHours}`, color: '#2563eb' },
            { label: 'Yayına Gidecek Final Süre', value: reportData.totalFinalBroadcastHours, sub: 'Program + Yerleşen Reklamlar', color: '#059669' }
          ],
      highlightCards: [
        {
          title: 'Geçmiş & Güncel Yayın Listeleri Özeti',
          body: `Seçili kapsamda toplam ${filteredArchiveLists.length} günlük yayın listesi (${reportData.totalItemsCount} program kuşağı ve ${reportData.totalAdBreakCount} reklam kuşağı) bulunmaktadır.`
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
        minHeight: 0,
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '18px 24px 64px 24px',
        background: 'var(--bg-primary)',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
        {/* 1. ÜST BAŞLIK, DÖNEM FİLTRESİ VE PDF / EXCEL / CSV ÇIKTI BUTONLARI */}
        <div
          style={{
            flexShrink: 0,
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
                Yayın Planlama — Program Raporları, Geçmiş Yayın Listeleri Arşivi &amp; Reklam Sonrası Final Akış
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Kanal: <strong style={{ color: 'var(--accent-primary)' }}>{currentChannelObj.name}</strong> • Aktif Liste:{' '}
                <strong>Liste {activeList}</strong> • Kapsam: <strong>{periodScopeLabel}</strong>
              </div>
            </div>
          </div>

          {/* Liste A/B Seçici + Çıktı Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-primary)',
                padding: '3px',
                borderRadius: '9px',
                border: '1px solid var(--border-color)'
              }}
            >
              {['A', 'B'].map(lCode => (
                <button
                  key={lCode}
                  type="button"
                  onClick={() => setActiveList(lCode)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: activeList === lCode ? '#059669' : 'transparent',
                    color: activeList === lCode ? '#fff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Liste {lCode}
                </button>
              ))}
            </div>

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
            flexShrink: 0,
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
                { id: 'all', label: 'Tüm Kayıtlı Dönemler' },
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
        <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '13px 15px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>TOPLAM PROGRAM YAYIN SAATİ</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
              {reportData.totalProgramHoursFormatted}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <strong>{reportData.totalItemsCount}</strong> Yayın • <strong>{filteredPrograms.length}</strong> Tekil Program
            </div>
          </div>

          <div
            onClick={() => setActiveTab('lists_archive')}
            style={{
              background: 'var(--bg-secondary)',
              padding: '13px 15px',
              borderRadius: '12px',
              border: '1.5px solid rgba(37, 99, 235, 0.45)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <History size={13} /> YAYIN LİSTELERİ &amp; GEÇMİŞ ARŞİV
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
              {reportData.broadcastListsArchive.length} Günlük Liste
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Geçmiş: <strong>{reportData.broadcastListsArchive.filter(d => d.isPastDate).length}</strong> • Güncel/Plan:{' '}
              <strong>{reportData.broadcastListsArchive.filter(d => !d.isPastDate).length}</strong> &rarr;
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '13px 15px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>REKLAMA İLETİLEN &amp; SPOTLAR</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
              {reportData.totalAdBreakCount} Kuşak / {reportData.totalRealizedAdSpots} Spot
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Kuşak: <strong>{reportData.totalPlannedAdBreakHours}</strong> • Spot: <strong>{reportData.totalRealizedAdHours}</strong>
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
            flexShrink: 0,
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
              {
                id: 'lists_archive',
                label: `2. Yayın Listeleri & Geçmiş Liste Arşivi (${reportData.broadcastListsArchive.length} Günlük Liste)`
              },
              {
                id: 'ads_comparison',
                label: `3. Reklama İletilen vs Reklam Sonrası Final Liste (${reportData.preVsPostAdsByDay.length} Gün)`
              },
              { id: 'periods', label: '4. Haftalık / Aylık / Yıllık Dönem Tablosu' },
              { id: 'categories', label: `5. Kategori Dağılımı (${reportData.categoriesList.length})` },
              { id: 'draft_added', label: `6. Taslak Dışı Eklenen Programlar (${reportData.addedOutsideDraftList.length})` }
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

        {/* 5. SEKME İÇERİKLERİ (overflow: visible ile dikey kaydırma kesintisiz çalışır) */}
        <div
          style={{
            flexShrink: 0,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px'
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
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        <strong>{focusedProgram.activeDateSpanLabel}</strong> tarihleri arasında toplam{' '}
                        <strong>{focusedProgram.activeDaysCount} aktif günde ({focusedProgram.activeWeeks} haftada)</strong>{' '}
                        <strong>{focusedProgram.count} defa</strong> yayınlandı (Toplam süre: <strong>{focusedProgram.hoursFormatted}</strong>).
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

                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
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
                              {d.slots.map(s => `${s.startTime}-${s.endTime}${s.episode ? ` (Bölüm ${s.episode})` : ''}`).join(' • ')}
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

          {/* SEKME 2: YAYIN LİSTELERİ & GEÇMİŞ LİSTE ARŞİVİ (SAAT SAAT TAM AKIŞ LİSTELERİ) */}
          {activeTab === 'lists_archive' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
              {/* Geçmiş & Güncel Liste Filtreleme Çubuğu */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 900, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <History size={15} color="#2563eb" />
                    <span>Yayın Listesi Arşivi:</span>
                  </span>

                  {[
                    { id: 'all', label: `Tüm Listeler (${reportData.broadcastListsArchive.length})` },
                    {
                      id: 'past',
                      label: `Geçmiş Yayın Listeleri (${reportData.broadcastListsArchive.filter(d => d.isPastDate).length})`
                    },
                    {
                      id: 'upcoming',
                      label: `Bugün & Gelecek Listeler (${reportData.broadcastListsArchive.filter(d => !d.isPastDate).length})`
                    },
                    {
                      id: 'sent_to_ads',
                      label: `Reklama İletilmiş / Onaylı (${reportData.broadcastListsArchive.filter(d => d.sentAt || d.postAdsRealizedSpots > 0 || d.adsStatus === 'completed').length})`
                    }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setArchiveTimeFilter(f.id)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '8px',
                        border: archiveTimeFilter === f.id ? '1px solid #2563eb' : '1px solid var(--border-color)',
                        background: archiveTimeFilter === f.id ? '#2563eb' : 'var(--bg-secondary)',
                        color: archiveTimeFilter === f.id ? '#fff' : 'var(--text-secondary)',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <select
                    value={archiveItemMode}
                    onChange={e => setArchiveItemMode(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '11.5px',
                      fontWeight: 700
                    }}
                  >
                    <option value="all_items">Tam Yayın Listesi (Programlar + Reklam Kuşakları &amp; Spotlar)</option>
                    <option value="programs_only">Sadece Program Akışı (Reklam Kuşakları Hariç)</option>
                    <option value="ads_only">Sadece Reklam Kuşakları &amp; Yerleşen Spotlar</option>
                  </select>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)'
                    }}
                  >
                    <Search size={13} color="var(--text-muted)" />
                    <input
                      type="text"
                      value={archiveSearchQuery}
                      onChange={e => setArchiveSearchQuery(e.target.value)}
                      placeholder="Tarih, program veya klip ara..."
                      style={{
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        width: '180px'
                      }}
                    />
                    {archiveSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setArchiveSearchQuery('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2 Sütunlu Görünüm: Solda Geçmişten Günümüze Günlük Yayın Listeleri, Sağda Seçili Günün Saat Saat Tam Akışı */}
              <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '16px', alignItems: 'start' }}>
                {/* SOL: GEÇMİŞ & GÜNCEL YAYIN LİSTELERİ SEÇİCİ LİSTESİ */}
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    background: 'var(--bg-primary)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--bg-tertiary)',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '12.5px',
                      fontWeight: 900,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>Kayıtlı Günlük Yayın Listeleri ({filteredArchiveLists.length})</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Liste {activeList}</span>
                  </div>

                  <div style={{ maxHeight: '680px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {filteredArchiveLists.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Bu filtrede kayıtlı yayın listesi bulunamadı.
                      </div>
                    ) : (
                      filteredArchiveLists.map(dList => {
                        const isSelected = activeInspectedDayList?.date === dList.date;
                        return (
                          <div
                            key={dList.date}
                            onClick={() => setInspectedListDate(dList.date)}
                            style={{
                              padding: '12px 14px',
                              borderBottom: '1px solid var(--border-color)',
                              background: isSelected ? 'rgba(37, 99, 235, 0.09)' : 'transparent',
                              borderLeft: isSelected ? '4px solid #2563eb' : '4px solid transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                              <div style={{ fontWeight: 900, fontSize: '13px', color: 'var(--text-primary)' }}>
                                {dList.formattedDate} — {dList.dayName}
                              </div>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: '999px',
                                  background: dList.isPastDate
                                    ? 'rgba(100, 116, 139, 0.16)'
                                    : dList.isTodayDate
                                    ? 'rgba(16, 185, 129, 0.16)'
                                    : 'rgba(37, 99, 235, 0.12)',
                                  color: dList.isPastDate
                                    ? 'var(--text-secondary)'
                                    : dList.isTodayDate
                                    ? '#059669'
                                    : '#2563eb'
                                }}
                              >
                                {dList.isPastDate ? 'Geçmiş Liste' : dList.isTodayDate ? 'Bugün' : 'Planlanan'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', fontSize: '11.5px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                              <span><strong>{dList.programCount}</strong> Program ({dList.programHoursFormatted})</span>
                              <span>•</span>
                              <span><strong>{dList.adBreakCount}</strong> Kuşak</span>
                              {dList.postAdsRealizedSpots > 0 && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#059669', fontWeight: 800 }}>{dList.postAdsRealizedSpots} Spot</span>
                                </>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: dList.statusBg,
                                  color: dList.statusColor
                                }}
                              >
                                {dList.statusLabel}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Toplam: {dList.totalBroadcastHoursFormatted}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SAĞ: SEÇİLİ GÜNÜN SAAT SAAT TAM YAYIN AKIŞ LİSTESİ (00:00 - 24:00) */}
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    background: 'var(--bg-primary)',
                    overflow: 'hidden'
                  }}
                >
                  {!activeInspectedDayList ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      İncelemek için soldaki listeden bir yayın günü seçin.
                    </div>
                  ) : (
                    <>
                      {/* Seçili Günün Üst Bilgi ve Tekil İndirme Çubuğu */}
                      <div
                        style={{
                          padding: '14px 18px',
                          background: 'var(--bg-tertiary)',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: '#2563eb',
                                color: '#fff',
                                fontSize: '11px',
                                fontWeight: 800
                              }}
                            >
                              LİSTE {activeInspectedDayList.listCode}
                            </span>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                              {activeInspectedDayList.formattedDate} ({activeInspectedDayList.dayName}) — Saat Saat Yayın Akış Listesi
                            </h3>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: activeInspectedDayList.statusBg,
                                color: activeInspectedDayList.statusColor
                              }}
                            >
                              {activeInspectedDayList.statusLabel}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Toplam <strong>{activeInspectedDayList.totalItemsCount} yayın öğesi</strong> (
                            <strong>{activeInspectedDayList.programCount} program</strong>: {activeInspectedDayList.programHoursFormatted} •{' '}
                            <strong>{activeInspectedDayList.adBreakCount} reklam kuşağı</strong> •{' '}
                            <strong>{activeInspectedDayList.postAdsRealizedSpots} yerleşen reklam spotu</strong>) • Toplam Süre:{' '}
                            <strong>{activeInspectedDayList.totalBroadcastHoursFormatted}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDate(activeInspectedDayList.date);
                              setViewMode('daily');
                            }}
                            style={{
                              padding: '6px 11px',
                              borderRadius: '8px',
                              border: '1px solid rgba(37, 99, 235, 0.35)',
                              background: 'rgba(37, 99, 235, 0.08)',
                              color: '#2563eb',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <ExternalLink size={13} /> Editörde Bu Günü Aç
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSingleDayList(activeInspectedDayList, 'pdf')}
                            style={{
                              padding: '6px 11px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#dc2626',
                              color: '#fff',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <FileText size={13} /> Bu Listeyi PDF İndir
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSingleDayList(activeInspectedDayList, 'excel')}
                            style={{
                              padding: '6px 11px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#059669',
                              color: '#fff',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <FileSpreadsheet size={13} /> Bu Listeyi Excel İndir
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportSingleDayList(activeInspectedDayList, 'csv')}
                            style={{
                              padding: '6px 11px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <Download size={13} /> CSV
                          </button>
                        </div>
                      </div>

                      {/* Saat Saat Yayın Akış Tablosu */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                              <th style={{ padding: '9px 12px', width: '55px' }}>Sıra</th>
                              <th style={{ padding: '9px 12px', width: '135px' }}>Saat Aralığı</th>
                              <th style={{ padding: '9px 12px' }}>Program / Yayın Öğesi Adı</th>
                              <th style={{ padding: '9px 12px' }}>Klip / Bölüm / Dosya Adı</th>
                              <th style={{ padding: '9px 12px', width: '125px' }}>Tür / Kategori</th>
                              <th style={{ padding: '9px 12px', textAlign: 'center', width: '95px' }}>Süre</th>
                              <th style={{ padding: '9px 12px' }}>Kuşak İçi Reklam Spotları / Kaynak</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInspectedRundownItems.map(it => {
                              const isAd = it.itemType === 'ad_break';
                              const isLive = it.itemType === 'live';
                              const isIntro = it.itemType === 'intro';
                              return (
                                <tr
                                  key={`${activeInspectedDayList.date}-${it.orderNo}`}
                                  style={{
                                    borderTop: '1px solid var(--border-color)',
                                    background: isAd
                                      ? 'rgba(245, 158, 11, 0.06)'
                                      : isLive
                                      ? 'rgba(225, 29, 72, 0.05)'
                                      : isIntro
                                      ? 'rgba(100, 116, 139, 0.04)'
                                      : 'transparent'
                                  }}
                                >
                                  <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    #{it.orderNo}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontWeight: 900, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    {it.startTime} – {it.endTime}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontWeight: 800, color: isAd ? '#d97706' : 'var(--text-primary)' }}>
                                    {it.title}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                    {it.clipName}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 800,
                                        padding: '2px 7px',
                                        borderRadius: '5px',
                                        background: isAd
                                          ? 'rgba(245, 158, 11, 0.16)'
                                          : isLive
                                          ? 'rgba(225, 29, 72, 0.15)'
                                          : 'var(--bg-tertiary)',
                                        color: isAd ? '#d97706' : isLive ? '#e11d48' : 'var(--text-secondary)'
                                      }}
                                    >
                                      {it.category}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>
                                    {it.durationFormatted}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: '11.5px' }}>
                                    {isAd ? (
                                      it.placedAds && it.placedAds.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                          {it.placedAds.map((sp, sIdx) => (
                                            <span
                                              key={sIdx}
                                              style={{
                                                padding: '2px 7px',
                                                borderRadius: '5px',
                                                background: 'rgba(5, 150, 105, 0.12)',
                                                color: '#059669',
                                                fontWeight: 700,
                                                fontSize: '10.5px'
                                              }}
                                            >
                                              {sp.summary}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>Ticari Reklam Bloğu</span>
                                      )
                                    ) : (
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: it.sourceLabel.includes('+') ? '#059669' : 'var(--text-muted)'
                                        }}
                                      >
                                        {it.sourceLabel}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SEKME 3: REKLAM REZERVASYONA İLETİLEN LİSTE vs REKLAM SONRASI FİNAL LİSTE */}
          {activeTab === 'ads_comparison' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Gün Bazlı: Reklam Rezervasyona İletilen Liste ile Reklam Sonrası (Yayına Gidecek) Liste Karşılaştırması
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px 12px' }}>Tarih &amp; Gün</th>
                        <th style={{ padding: '10px 12px' }}>Programlar (Adet &amp; Saat)</th>
                        <th style={{ padding: '10px 12px' }}>Reklama İletilen Kuşaklar</th>
                        <th style={{ padding: '10px 12px' }}>Reklam Sonrası Yerleşen Spotlar</th>
                        <th style={{ padding: '10px 12px' }}>İletilen Toplam Süre</th>
                        <th style={{ padding: '10px 12px' }}>Yayına Gidecek Final Süre</th>
                        <th style={{ padding: '10px 12px' }}>Durum &amp; İncele</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.preVsPostAdsByDay.map(d => (
                        <tr key={d.date} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                            {d.formattedDate} <span style={{ color: 'var(--text-muted)' }}>({d.dayName})</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>
                            {d.programCount} Program ({d.programHoursFormatted})
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
                            {d.totalBroadcastHoursFormatted}
                          </td>
                          <td style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: d.statusBg,
                                color: d.statusColor
                              }}
                            >
                              {d.statusLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectedListDate(d.date);
                                setActiveTab('lists_archive');
                              }}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: '#2563eb',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                            >
                              Tam Listeyi Gör &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {reportData.postAdsBreakDetails.length > 0 && (
                <div>
                  <h3 style={{ margin: '8px 0', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Reklam Sonrası Kuşakların İçerik &amp; Spot Detayları ({reportData.postAdsBreakDetails.length} Kuşak)
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
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
                        {reportData.postAdsBreakDetails.slice(0, 100).map((b, idx) => (
                          <tr key={`${b.date}-${b.breakNo}-${idx}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{b.date} ({b.dayName})</td>
                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#d97706' }}>
                              {b.breakNo}. Kuşak ({b.time}) {b.ramadanTag ? `• ${b.ramadanTag}` : ''}
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
                </div>
              )}
            </div>
          )}

          {/* SEKME 4: HAFTALIK / AYLIK / YILLIK DÖNEM TABLOSU */}
          {activeTab === 'periods' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', padding: '16px' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                  Haftalık Yayın &amp; Reklam Özeti (Pazartesi – Pazar)
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
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{w.label} ({w.daysCount} gün)</td>
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
                  Aylık Yayın &amp; Reklam Özeti (Kayıtlı Gerçek Veri)
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
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.label} ({m.daysCount} gün)</td>
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
                  Yıllık Yayın &amp; Reklam Özeti (Kayıtlı Gerçek Veri)
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
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{y.label} ({y.daysCount} gün)</td>
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

          {/* SEKME 5: KATEGORİ DAĞILIMI */}
          {activeTab === 'categories' && (
            <div style={{ overflowX: 'auto' }}>
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
            </div>
          )}

          {/* SEKME 6: TASLAK DIŞINDA YAYIN PLANLAMADA EKLENEN PROGRAMLAR */}
          {activeTab === 'draft_added' && (
            <div style={{ overflowX: 'auto' }}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastReportsView;
