/**
 * @file src/modules/broadcast/components/BroadcastReportsView.jsx
 * @description Yayın Planlama (Yayına Hazır) Modülü İçin Özel Detaylı Raporlar Sayfası.
 *
 * Kapsam:
 * 1. Hangi Program / Klip Hangi Gün Kaç Defa, Haftalık / Aylık / Yıllık Yayınlanma Sayıları ve Kaç Saat Yayınlandığı.
 * 2. Kategori Bazlı Yayın Dağılımı (Hangi kategoride kaç program, kaç defa ve kaç saat yayınlandı).
 * 3. Taslak Dışında Yayın Planlamada Eklenen Programlar ve Taslak-Yayın Fark Analizi.
 * 4. Reklam Rezervasyona İletilen Liste vs Reklam Rezervasyondan Sonra (Spotlar Yerleştirilmiş Yayına Gidecek Final Liste) Karşılaştırma Raporu.
 * 5. Tüm raporlar için Kurumsal PDF (Sunum), Excel (.xls) ve CSV (.csv) çıktısı.
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Tv,
  Film,
  Megaphone,
  Sparkles,
  FileText,
  FileSpreadsheet,
  Download,
  GitCompare,
  PlusCircle,
  CheckCircle2,
  Search,
  Layers,
  Radio
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
    products = [],
    materials = []
  } = usePlanningStore();

  // 'programs' | 'periods' | 'categories' | 'ads_comparison' | 'draft_added'
  const [activeTab, setActiveTab] = useState('programs');
  // 'all' | 'month' | 'week' | 'day'
  const [periodFilter, setPeriodFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentChannelObj =
    BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];

  const selectedPeriodBuckets = useMemo(() => getDatePeriodBuckets(selectedDate), [selectedDate]);

  const reportData = useMemo(() => {
    const draftScheduleForChannel = getChannelDraftScheduleMap(selectedChannel) || {};
    const prefix = `${selectedChannel}-`;

    // Seçili kanala ait tüm günleri topla (hem broadcastStore hem de planningStore.days ready-* birleşimi)
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

    // Reklam Rezervasyona İletilen Liste vs Reklam Rezervasyondan Sonra (Yayına Gidecek Final Liste)
    const preVsPostAdsByDay = [];
    const postAdsBreakDetails = [];
    // Taslak dışında Yayın Planlama'da eklenen programlar
    const addedOutsideDraftList = [];

    sortedDates.forEach(dateStr => {
      const pBuckets = getDatePeriodBuckets(dateStr);

      // Dönem filtresi kontrolü
      if (periodFilter === 'day' && dateStr !== selectedDate) return;
      if (periodFilter === 'week' && pBuckets.weekKey !== selectedPeriodBuckets.weekKey) return;
      if (periodFilter === 'month' && pBuckets.monthKey !== selectedPeriodBuckets.monthKey) return;

      const bDay = broadcastDays[`${selectedChannel}-${dateStr}`];
      const rKey = `ready-${selectedChannel}-${dateStr}`;
      const rDay = readyDays[rKey];
      const varKey = activeList === 'B' ? 'v2' : 'v1';

      const bProgs = bDay?.variants?.[activeList]?.programs || [];
      const rProgs = rDay?.variants?.[varKey]?.programs || [];
      const effectiveProgs = bProgs.length > 0 ? bProgs : rProgs;

      if (effectiveProgs.length === 0 && dateStr !== selectedDate) return;

      // Taslaktaki o günün program anahtarları
      const draftDayProgs = draftScheduleForChannel?.[dateStr]?.programs || [];
      const draftTitleKeys = new Set(
        draftDayProgs.map(dp => normalizeTitleKey(dp.customTitle || dp.title || '')).filter(Boolean)
      );

      // Dönemsel kovalar
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
        const catName = isLive
          ? 'Canlı Yayın'
          : isFiller
          ? 'Dolgu Kuşağı'
          : prog.category || 'Genel Program';

        // Kategori istatistiği
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

        // Program istatistiği
        if (!programStatsMap[cleanTitle]) {
          programStatsMap[cleanTitle] = {
            title: cleanTitle,
            category: catName,
            isLive,
            isFromDraft: Boolean(prog.isFromDraft || prog.draftId),
            count: 0,
            seconds: 0,
            dayOfWeekMap: {},
            datesMap: {},
            weeksMap: {},
            monthsMap: {},
            yearsMap: {},
            episodesSet: new Set()
          };
        }
        const ps = programStatsMap[cleanTitle];
        ps.count += 1;
        ps.seconds += durSec;
        ps.dayOfWeekMap[pBuckets.dayName] = (ps.dayOfWeekMap[pBuckets.dayName] || 0) + 1;
        ps.datesMap[dateStr] = (ps.datesMap[dateStr] || 0) + 1;
        ps.weeksMap[pBuckets.weekKey] = (ps.weeksMap[pBuckets.weekKey] || 0) + 1;
        ps.monthsMap[pBuckets.monthKey] = (ps.monthsMap[pBuckets.monthKey] || 0) + 1;
        ps.yearsMap[pBuckets.yearKey] = (ps.yearsMap[pBuckets.yearKey] || 0) + 1;
        if (prog.episodeNo) ps.episodesSet.add(`Bölüm ${prog.episodeNo}`);

        // Taslak dışında Yayın Planlama'da eklenen program kontrolü
        const normProg = normalizeTitleKey(cleanTitle);
        const isNotInDraft =
          !prog.isFromDraft &&
          !prog.draftId &&
          (draftTitleKeys.size === 0 || !draftTitleKeys.has(normProg));
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

      // Reklam Rezervasyondan Sonra Yerleşen Reklam Spotları (adPlacements[ready-channel-date])
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

      // Reklam Rezervasyona İletilen ListeToplam Süresi vs Reklam Sonrası Final Yayın Süresi
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
        const dayBreakdown = Object.entries(p.dayOfWeekMap)
          .map(([d, cnt]) => `${d}: ${cnt} kez`)
          .join(' • ');
        const activeWeeks = Math.max(1, Object.keys(p.weeksMap).length);
        const avgWeeklyCount = Number((p.count / activeWeeks).toFixed(1));
        const estMonthlyCount = Math.round(avgWeeklyCount * 4.3);
        const estYearlyCount = Math.round(avgWeeklyCount * 52);
        const estMonthlyHours = formatSecondsToHoursMin((p.seconds / activeWeeks) * 4.3);
        const estYearlyHours = formatSecondsToHoursMin((p.seconds / activeWeeks) * 52);

        return {
          ...p,
          activeDaysCount: Object.keys(p.datesMap).length,
          dayBreakdown,
          avgWeeklyCount,
          estMonthlyCount,
          estYearlyCount,
          estMonthlyHours,
          estYearlyHours,
          hoursFormatted: formatSecondsToHoursMin(p.seconds),
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
    selectedPeriodBuckets,
    materials,
    companies
  ]);

  const filteredPrograms = useMemo(() => {
    return reportData.programsList.filter(p => {
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
  }, [reportData.programsList, categoryFilter, searchQuery]);

  const periodScopeLabel =
    periodFilter === 'day'
      ? `Seçili Gün (${selectedDate})`
      : periodFilter === 'week'
      ? `Seçili Hafta (${selectedPeriodBuckets.weekLabel})`
      : periodFilter === 'month'
      ? `Seçili Ay (${selectedPeriodBuckets.monthLabel})`
      : 'Tüm Kayıtlı Yayın Dönemleri (Haftalık / Aylık / Yıllık)';

  // EXCEL ÇIKTISI
  const handleExportExcel = () => {
    exportToExcel({
      filename: `Yayin_Planlama_Detayli_Rapor_${currentChannelObj.name}_Liste_${activeList}`,
      title: `YAYIN PLANLAMA & REKLAM SONRASI FİNAL YAYIN RAPORU (${currentChannelObj.name} - Liste ${activeList})`,
      subtitle: `Dönem Kapsamı: ${periodScopeLabel}`,
      kpis: [
        { label: 'Toplam Program / Klip', value: `${reportData.totalItemsCount} Yayın` },
        { label: 'Program Yayın Süresi', value: reportData.totalProgramHoursFormatted },
        { label: 'Reklama İletilen Kuşak', value: `${reportData.totalAdBreakCount} Kuşak (${reportData.totalPlannedAdBreakHours})` },
        { label: 'Reklam Sonrası Yerleşen Spot', value: `${reportData.totalRealizedAdSpots} Spot (${reportData.totalRealizedAdHours})` },
        { label: 'Final Yayına Gidecek Süre', value: reportData.totalFinalBroadcastHours }
      ],
      sections: [
        {
          title: '1. PROGRAM BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK YAYINLANMA RAPORU',
          headers: [
            'Program Adı',
            'Kategori',
            'Kaç Defa Yayınlandı',
            'Toplam Saat',
            'Hangi Gün Kaç Defa Yayınlandı',
            'Haftalık Ort.',
            'Aylık Yayın & Saat',
            'Yıllık Yayın & Saat'
          ],
          rows: filteredPrograms.map(p => [
            p.title,
            p.category,
            `${p.count} Defa`,
            p.hoursFormatted,
            p.dayBreakdown,
            `${p.avgWeeklyCount} Kez`,
            `${p.estMonthlyCount} Kez (${p.estMonthlyHours})`,
            `${p.estYearlyCount} Kez (${p.estYearlyHours})`
          ])
        },
        {
          title: '2. REKLAM REZERVASYONA İLETİLEN LİSTE vs REKLAM SONRASI YAYINA GİDECEK FİNAL LİSTE KARŞILAŞTIRMASI',
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
          title: '3. KATEGORİ BAZLI YAYINLANMA RAPORU',
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
          title: '4. TASLAK DIŞINDA YAYIN PLANLAMADA EKLENEN PROGRAMLAR',
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
      ]
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
      filename: `Yayin_Planlama_Program_Raporu_${currentChannelObj.name}`,
      headers: [
        'Program Adı',
        'Kategori',
        'Kaç Defa Yayınlandı',
        'Toplam Saat',
        'Hangi Gün Kaç Defa',
        'Haftalık Ort.',
        'Aylık Yayın & Saat',
        'Yıllık Yayın & Saat'
      ],
      rows: filteredPrograms.map(p => [
        p.title,
        p.category,
        p.count,
        p.hoursFormatted,
        p.dayBreakdown,
        p.avgWeeklyCount,
        `${p.estMonthlyCount} Kez (${p.estMonthlyHours})`,
        `${p.estYearlyCount} Kez (${p.estYearlyHours})`
      ])
    });
  };

  // PDF SUNUM ÇIKTISI
  const handleExportPDF = () => {
    exportToPresentationPDF({
      title: `YAYIN PLANLAMA & REKLAM SONRASI FİNAL YAYIN ANALİZ SUNUMU`,
      subtitle: `Kanal: ${currentChannelObj.name} • Aktif Liste: Liste ${activeList} • Kapsam: ${periodScopeLabel}`,
      badgeText: 'YAYIN PLANLAMA STÜDYOSU • RESMİ YAYIN VE REKLAM RAPORU',
      accentColor: '#059669',
      kpis: [
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
      sections: [
        {
          title: '1. Program Bazlı Günlük, Haftalık, Aylık ve Yıllık Yayınlanma Raporu',
          description: 'Yayına giden listede hangi programın hangi gün kaç defa ve toplam kaç saat yayınlandığı.',
          headers: ['Program Adı', 'Kategori', 'Kaç Defa', 'Toplam Saat', 'Hangi Gün Kaç Defa', 'Aylık (Adet / Saat)', 'Yıllık (Adet / Saat)'],
          rows: filteredPrograms.map(p => [
            p.title,
            p.category,
            `${p.count} Defa`,
            p.hoursFormatted,
            p.dayBreakdown,
            `${p.estMonthlyCount} Kez (${p.estMonthlyHours})`,
            `${p.estYearlyCount} Kez (${p.estYearlyHours})`
          ])
        },
        {
          title: '2. Reklam Rezervasyona İletilen Liste vs Reklam Rezervasyondan Sonra Yayına Gidecek Liste Raporu',
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
          title: '3. Kategori Bazlı Yayın Dağılımı',
          headers: ['Kategori', 'Farklı Program Sayısı', 'Kaç Defa Yayınlandı', 'Toplam Saat', 'Oran (%)'],
          rows: reportData.categoriesList.map(c => [
            c.name,
            `${c.uniqueProgramsCount} Program`,
            `${c.count} Defa`,
            c.hoursFormatted,
            `%${c.sharePct}`
          ])
        }
      ]
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
        gap: '16px'
      }}
    >
      {/* 1. ÜST BAŞLIK, DÖNEM FİLTRESİ VE PDF / EXCEL / CSV ÇIKTI BUTONLARI */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '16px 20px',
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
              Yayın Planlama &amp; Reklam Sonrası Final Yayın Raporları
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Kanal: <strong style={{ color: 'var(--accent-primary)' }}>{currentChannelObj.name}</strong> • Aktif Liste:{' '}
              <strong>Liste {activeList}</strong> • Kapsam: <strong>{periodScopeLabel}</strong>
            </div>
          </div>
        </div>

        {/* Dönem Seçici + Çıktı Butonları */}
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
            {[
              { id: 'day', label: 'Seçili Gün' },
              { id: 'week', label: 'Haftalık' },
              { id: 'month', label: 'Aylık' },
              { id: 'all', label: 'Tüm Dönemler (Yıllık)' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodFilter(p.id)}
                style={{
                  padding: '6px 11px',
                  borderRadius: '6px',
                  border: 'none',
                  background: periodFilter === p.id ? 'var(--accent-primary)' : 'transparent',
                  color: periodFilter === p.id ? '#fff' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {p.label}
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

      {/* 2. 5 ÖZET KPI KARTI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)' }}>TOPLAM PROGRAM YAYIN SAATİ</div>
          <div style={{ fontSize: '21px', fontWeight: 900, color: '#2563eb', marginTop: '4px' }}>
            {reportData.totalProgramHoursFormatted}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            <strong>{reportData.totalItemsCount}</strong> Yayın • <strong>{reportData.programsList.length}</strong> Tekil Program
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>REKLAMA İLETİLEN KUŞAK</div>
          <div style={{ fontSize: '21px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
            {reportData.totalAdBreakCount} Kuşak
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Planlanan Kapasite: <strong>{reportData.totalPlannedAdBreakHours}</strong>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(5, 150, 105, 0.35)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>REKLAM SONRASI YERLEŞEN SPOT</div>
          <div style={{ fontSize: '21px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
            {reportData.totalRealizedAdSpots} Spot
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Reklam Süresi: <strong>{reportData.totalRealizedAdHours}</strong>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.35)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#8b5cf6' }}>YAYINA GİDECEK FİNAL SÜRE</div>
          <div style={{ fontSize: '21px', fontWeight: 900, color: '#8b5cf6', marginTop: '4px' }}>
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
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(225, 29, 72, 0.35)',
            cursor: 'pointer'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#e11d48' }}>TASLAK DIŞI YAYINDA EKLENEN</div>
          <div style={{ fontSize: '21px', fontWeight: 900, color: '#e11d48', marginTop: '4px' }}>
            +{reportData.addedOutsideDraftList.length} Program
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Canlı: {reportData.totalLiveCount} • Dolgu: {reportData.totalFillerCount}
          </div>
        </div>
      </div>

      {/* 3. RAPOR SEKMELERİ VE ARAMA */}
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
            { id: 'programs', label: `1. Programlar (Gün / Hafta / Ay / Yıl & Saat) (${reportData.programsList.length})` },
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

        {activeTab === 'programs' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  width: '180px'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. SEKME İÇERİKLERİ */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          overflow: 'hidden'
        }}
      >
        {/* SEKME 1: PROGRAMLAR TABLOSU */}
        {activeTab === 'programs' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '11px 14px' }}>Program Adı</th>
                <th style={{ padding: '11px 14px' }}>Kategori</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Kaç Defa Yayınlandı</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Toplam Yayın Saati</th>
                <th style={{ padding: '11px 14px' }}>Hangi Gün Kaç Defa Yayınlandı</th>
                <th style={{ padding: '11px 14px', textAlign: 'center' }}>Haftalık / Aylık / Yıllık Yayınlanma</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrograms.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Seçili filtreye uygun yayınlanmış program kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredPrograms.map(p => (
                  <tr key={p.title} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {p.title}
                      {p.isLive && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(239,68,68,0.14)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                          CANLI
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, color: '#2563eb', fontSize: '13.5px' }}>
                      {p.count} Defa
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>
                      {p.hoursFormatted}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Object.entries(p.dayOfWeekMap).map(([dName, cnt]) => (
                          <span
                            key={dName}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '5px',
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb'
                            }}
                          >
                            {dName}: <strong>{cnt} kez</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      <div>Haftalık: <strong>{p.avgWeeklyCount} kez</strong></div>
                      <div>Aylık: <strong>~{p.estMonthlyCount} kez ({p.estMonthlyHours})</strong></div>
                      <div>Yıllık: <strong>~{p.estYearlyCount} kez ({p.estYearlyHours})</strong></div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

            {/* Kuşak Bazlı Detaylı Spot Yerleşimi */}
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
