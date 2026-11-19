/**
 * @file src/modules/draft/components/DraftReportsModal.jsx
 * @description Taslak Planlama Modülü Detaylı Analiz, Kategori & Program Raporları,
 * Günlük/Haftalık/Aylık/Yıllık Yayınlanma İstatistikleri ve Yayına Giden Liste (Yayın Planlama)
 * Karşılaştırma / Değişiklik Raporu (PDF Sunum, Excel, CSV Çıktılı).
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  X,
  Calendar,
  Clock,
  Radio,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Download,
  GitCompare,
  PlusCircle,
  MinusCircle,
  Search
} from 'lucide-react';
import useBroadcastStore from '../../broadcast/store/broadcastStore';
import {
  exportToCSV,
  exportToExcel,
  exportToPresentationPDF,
  formatSecondsToHoursMin,
  formatMinutesToHoursMin,
  getDatePeriodBuckets
} from '../../../utils/reportExportUtils';

const normalizeTitleKey = (str = '') =>
  String(str || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\s*\(kopya\)\s*/gi, '')
    .replace(/[^a-z0-9ğüşıöç]/gi, '')
    .trim();

const DraftReportsModal = ({
  isOpen,
  onClose,
  scheduleData,
  allChannelSchedule,
  selectedChannel = 'ch_hd',
  currentChannel,
  dateRangeLabel
}) => {
  // 'programs' | 'periods' | 'categories' | 'comparison' | 'days'
  const [activeTab, setActiveTab] = useState('programs');
  // 'active_week' | 'all_data'
  const [dataScope, setDataScope] = useState('active_week');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const broadcastDays = useBroadcastStore(state => state.days || {});
  const activeBroadcastList = useBroadcastStore(state => state.activeList || 'A');

  const sourceSchedule = useMemo(() => {
    if (dataScope === 'all_data' && allChannelSchedule && Object.keys(allChannelSchedule).length > 0) {
      return allChannelSchedule;
    }
    return scheduleData || {};
  }, [dataScope, allChannelSchedule, scheduleData]);

  const reportData = useMemo(() => {
    const dayEntries = Object.entries(sourceSchedule || {})
      .filter(([k, v]) => k !== 'all' && v && Array.isArray(v.programs))
      .sort(([a], [b]) => a.localeCompare(b));

    let totalPrograms = 0;
    let totalSeconds = 0;
    let liveCount = 0;
    let liveSeconds = 0;
    let dolguCount = 0;
    let dolguSeconds = 0;
    let bantCount = 0;
    let bantSeconds = 0;

    const categoryMap = {};
    const programStatsMap = {};
    const dailyStats = [];
    const periodMap = {
      weekly: {},
      monthly: {},
      yearly: {}
    };

    // Taslak vs Yayın Planlama (Yayına Giden Liste) karşılaştırma kayıtları
    const comparisonRows = [];
    const addedInBroadcastOnly = [];
    const removedFromDraftInBroadcast = [];
    const durationChangedInBroadcast = [];

    dayEntries.forEach(([dateKey, dayObj]) => {
      const progs = dayObj?.programs || [];
      if (dataScope === 'all_data' && progs.length === 0) return;

      const periodInfo = getDatePeriodBuckets(dateKey);
      let dayTotalSec = 0;
      let dayLiveCount = 0;
      let dayDolguCount = 0;

      // Dönemsel kovaları hazırla
      if (!periodMap.weekly[periodInfo.weekKey]) {
        periodMap.weekly[periodInfo.weekKey] = {
          key: periodInfo.weekKey,
          label: periodInfo.weekLabel,
          daysCount: 0,
          programsCount: 0,
          seconds: 0,
          uniquePrograms: new Set()
        };
      }
      if (!periodMap.monthly[periodInfo.monthKey]) {
        periodMap.monthly[periodInfo.monthKey] = {
          key: periodInfo.monthKey,
          label: periodInfo.monthLabel,
          daysCount: 0,
          programsCount: 0,
          seconds: 0,
          uniquePrograms: new Set()
        };
      }
      if (!periodMap.yearly[periodInfo.yearKey]) {
        periodMap.yearly[periodInfo.yearKey] = {
          key: periodInfo.yearKey,
          label: `${periodInfo.yearKey} Yılı`,
          daysCount: 0,
          programsCount: 0,
          seconds: 0,
          uniquePrograms: new Set()
        };
      }

      if (progs.length > 0) {
        periodMap.weekly[periodInfo.weekKey].daysCount += 1;
        periodMap.monthly[periodInfo.monthKey].daysCount += 1;
        periodMap.yearly[periodInfo.yearKey].daysCount += 1;
      }

      // Bu gün için taslaktaki programların özet haritası (karşılaştırma için)
      const draftDayTitleMap = {};

      progs.forEach(p => {
        totalPrograms += 1;
        const sec =
          p.episodeTotalSec && p.episodeTotalSec > 0
            ? p.episodeTotalSec
            : (parseInt(p.duration, 10) || 30) * 60;

        totalSeconds += sec;
        dayTotalSec += sec;

        const isDolgu = p.isKisaSlot || p.title === 'Dolgu Kuşağı' || p.category === 'Kısa Program';
        const isLive = Boolean(p.isLive);

        if (isLive) {
          liveCount += 1;
          liveSeconds += sec;
          dayLiveCount += 1;
        } else if (isDolgu) {
          dolguCount += 1;
          dolguSeconds += sec;
          dayDolguCount += 1;
        } else {
          bantCount += 1;
          bantSeconds += sec;
        }

        const cat = isLive
          ? 'Canlı Yayın'
          : isDolgu
          ? 'Dolgu Kuşağı'
          : p.categoryBadge || p.category || 'Genel Program';

        if (!categoryMap[cat]) {
          categoryMap[cat] = {
            name: cat,
            count: 0,
            seconds: 0,
            uniquePrograms: new Set(),
            daysSet: new Set()
          };
        }
        categoryMap[cat].count += 1;
        categoryMap[cat].seconds += sec;
        categoryMap[cat].daysSet.add(dateKey);

        const progTitle = (p.customTitle || p.title || 'İsimsiz Program').trim();
        categoryMap[cat].uniquePrograms.add(progTitle);

        if (!programStatsMap[progTitle]) {
          programStatsMap[progTitle] = {
            title: progTitle,
            category: cat,
            isLive,
            count: 0,
            seconds: 0,
            daysMap: {}, // dateKey -> { dayName, count, seconds, times: [] }
            dayOfWeekMap: {}, // Pazartesi -> count
            weeksMap: {},
            monthsMap: {},
            yearsMap: {}
          };
        }
        const ps = programStatsMap[progTitle];
        ps.count += 1;
        ps.seconds += sec;

        const dName = dayObj?.dayName || periodInfo.dayName;
        ps.dayOfWeekMap[dName] = (ps.dayOfWeekMap[dName] || 0) + 1;

        if (!ps.daysMap[dateKey]) {
          ps.daysMap[dateKey] = {
            dateKey,
            dayName: dName,
            count: 0,
            seconds: 0,
            times: []
          };
        }
        ps.daysMap[dateKey].count += 1;
        ps.daysMap[dateKey].seconds += sec;
        if (p.startTime) ps.daysMap[dateKey].times.push(p.startTime);

        ps.weeksMap[periodInfo.weekLabel] = (ps.weeksMap[periodInfo.weekLabel] || 0) + 1;
        ps.monthsMap[periodInfo.monthLabel] = (ps.monthsMap[periodInfo.monthLabel] || 0) + 1;
        ps.yearsMap[periodInfo.yearKey] = (ps.yearsMap[periodInfo.yearKey] || 0) + 1;

        // Dönemsel kovalara ekle
        periodMap.weekly[periodInfo.weekKey].programsCount += 1;
        periodMap.weekly[periodInfo.weekKey].seconds += sec;
        periodMap.weekly[periodInfo.weekKey].uniquePrograms.add(progTitle);

        periodMap.monthly[periodInfo.monthKey].programsCount += 1;
        periodMap.monthly[periodInfo.monthKey].seconds += sec;
        periodMap.monthly[periodInfo.monthKey].uniquePrograms.add(progTitle);

        periodMap.yearly[periodInfo.yearKey].programsCount += 1;
        periodMap.yearly[periodInfo.yearKey].seconds += sec;
        periodMap.yearly[periodInfo.yearKey].uniquePrograms.add(progTitle);

        // Karşılaştırma için kaydet
        const normKey = normalizeTitleKey(progTitle);
        if (normKey) {
          if (!draftDayTitleMap[normKey]) {
            draftDayTitleMap[normKey] = {
              title: progTitle,
              category: cat,
              count: 0,
              seconds: 0,
              startTimes: []
            };
          }
          draftDayTitleMap[normKey].count += 1;
          draftDayTitleMap[normKey].seconds += sec;
          if (p.startTime) draftDayTitleMap[normKey].startTimes.push(p.startTime);
        }
      });

      const dayTotalMin = Math.round(dayTotalSec / 60);
      const fillPct = Math.min(100, Math.round((dayTotalSec / 86400) * 100));
      const emptyPct = Math.max(0, 100 - fillPct);

      dailyStats.push({
        dateKey,
        dayName: dayObj?.dayName || periodInfo.dayName,
        date: dayObj?.date || dateKey,
        programCount: progs.length,
        totalSec: dayTotalSec,
        totalMin: dayTotalMin,
        emptyMin: Math.max(0, 1440 - dayTotalMin),
        fillPct,
        emptyPct,
        liveCount: dayLiveCount,
        dolguCount: dayDolguCount
      });

      // YAYIN PLANLAMA (YAYINA GİDEN SON LİSTE) İLE KARŞILAŞTIRMA
      const bKey = `${selectedChannel}-${dateKey}`;
      const bDay = broadcastDays[bKey];
      const bProgsRaw =
        bDay?.variants?.[activeBroadcastList]?.programs ||
        bDay?.variants?.A?.programs ||
        [];

      // İntro ve reklam kuşakları dışındaki ana yayın öğelerini grupla
      const broadcastDayTitleMap = {};
      let broadcastAdBreakCount = 0;
      let broadcastAdBreakSec = 0;

      bProgsRaw.forEach(bp => {
        if (bp.type === 'ad_break' || /^Reklam Kuşağı/i.test(bp.title || '')) {
          broadcastAdBreakCount += 1;
          broadcastAdBreakSec += Number(bp.durationSec) || 300;
          return;
        }
        if (bp.isIntroClip || bp.unitType === 'intro' || /^semerkand_intro/i.test(bp.clipName || bp.title || '')) {
          return;
        }
        const rawTitle = (bp.programTitle || bp.title || bp.name || bp.clipName || 'İsimsiz Program').trim();
        const normKey = normalizeTitleKey(rawTitle);
        if (!normKey) return;
        const durSec = Number(bp.durationSec) || Math.round((Number(bp.durationFrames) || 0) / 25) || 1800;

        if (!broadcastDayTitleMap[normKey]) {
          broadcastDayTitleMap[normKey] = {
            title: rawTitle,
            category: bp.category || 'Genel',
            count: 0,
            seconds: 0,
            isFromDraft: Boolean(bp.isFromDraft || bp.draftId)
          };
        }
        broadcastDayTitleMap[normKey].count += 1;
        broadcastDayTitleMap[normKey].seconds += durSec;
      });

      const allNormKeys = new Set([
        ...Object.keys(draftDayTitleMap),
        ...Object.keys(broadcastDayTitleMap)
      ]);

      allNormKeys.forEach(nk => {
        const dItem = draftDayTitleMap[nk];
        const bItem = broadcastDayTitleMap[nk];

        if (dItem && bItem) {
          const diffSec = bItem.seconds - dItem.seconds;
          const diffCount = bItem.count - dItem.count;
          const status =
            Math.abs(diffSec) > 120 || diffCount !== 0
              ? 'Süre / Adet Değişti'
              : 'Birebir Uyumlu';

          const row = {
            dateKey,
            dayName: dayObj?.dayName || periodInfo.dayName,
            title: dItem.title,
            category: dItem.category,
            draftCount: dItem.count,
            draftSec: dItem.seconds,
            broadcastCount: bItem.count,
            broadcastSec: bItem.seconds,
            diffCount,
            diffSec,
            status
          };
          comparisonRows.push(row);
          if (status !== 'Birebir Uyumlu') {
            durationChangedInBroadcast.push(row);
          }
        } else if (!dItem && bItem) {
          // Taslak dışında Yayın Planlama'da sonradan eklenen program
          const row = {
            dateKey,
            dayName: dayObj?.dayName || periodInfo.dayName,
            title: bItem.title,
            category: bItem.category,
            draftCount: 0,
            draftSec: 0,
            broadcastCount: bItem.count,
            broadcastSec: bItem.seconds,
            diffCount: bItem.count,
            diffSec: bItem.seconds,
            status: 'Taslak Dışı Yayında Eklendi (+)'
          };
          comparisonRows.push(row);
          addedInBroadcastOnly.push(row);
        } else if (dItem && !bItem && bProgsRaw.length > 0) {
          // Taslakta olup yayına giden listede çıkarılan program
          const row = {
            dateKey,
            dayName: dayObj?.dayName || periodInfo.dayName,
            title: dItem.title,
            category: dItem.category,
            draftCount: dItem.count,
            draftSec: dItem.seconds,
            broadcastCount: 0,
            broadcastSec: 0,
            diffCount: -dItem.count,
            diffSec: -dItem.seconds,
            status: 'Yayın Listesinde Çıkarıldı (-)'
          };
          comparisonRows.push(row);
          removedFromDraftInBroadcast.push(row);
        }
      });
    });

    const activeDayCount = Math.max(1, dailyStats.filter(d => d.programCount > 0).length || dayEntries.length);
    const totalCapacitySec = Math.max(1, activeDayCount * 86400);
    const weeklyFillPct = Math.min(100, Math.round((totalSeconds / totalCapacitySec) * 100));
    const weeklyEmptyPct = Math.max(0, 100 - weeklyFillPct);

    const categories = Object.values(categoryMap)
      .map(c => ({
        ...c,
        uniqueProgramsCount: c.uniquePrograms.size,
        activeDaysCount: c.daysSet.size,
        sharePct: totalSeconds > 0 ? Math.round((c.seconds / totalSeconds) * 100) : 0,
        hoursFormatted: formatSecondsToHoursMin(c.seconds)
      }))
      .sort((a, b) => b.seconds - a.seconds);

    const programsList = Object.values(programStatsMap)
      .map(item => {
        const dayBreakdown = Object.entries(item.dayOfWeekMap)
          .map(([dName, cnt]) => `${dName}: ${cnt} kez`)
          .join(' • ');
        const detailedDates = Object.values(item.daysMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        const weeklyTotal = Object.values(item.weeksMap).reduce((a, b) => a + b, 0);
        const activeWeeks = Math.max(1, Object.keys(item.weeksMap).length);
        const avgPerWeek = Number((item.count / activeWeeks).toFixed(1));
        // Projeksiyon & Dönemsel Hesap
        const estMonthlyCount = Math.round(avgPerWeek * 4.3);
        const estYearlyCount = Math.round(avgPerWeek * 52);
        const estMonthlyHours = formatSecondsToHoursMin((item.seconds / activeWeeks) * 4.3);
        const estYearlyHours = formatSecondsToHoursMin((item.seconds / activeWeeks) * 52);

        return {
          ...item,
          activeDaysCount: detailedDates.length,
          dayBreakdown,
          detailedDates,
          weeklyTotal,
          avgPerWeek,
          estMonthlyCount,
          estYearlyCount,
          estMonthlyHours,
          estYearlyHours,
          hoursFormatted: formatSecondsToHoursMin(item.seconds),
          weeksSummary: Object.entries(item.weeksMap).map(([k, v]) => `${k} (${v})`).join(', '),
          monthsSummary: Object.entries(item.monthsMap).map(([k, v]) => `${k} (${v})`).join(', '),
          yearsSummary: Object.entries(item.yearsMap).map(([k, v]) => `${k} (${v})`).join(', ')
        };
      })
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds);

    return {
      totalPrograms,
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      totalHoursFormatted: formatSecondsToHoursMin(totalSeconds),
      weeklyFillPct,
      weeklyEmptyPct,
      liveCount,
      liveMinutes: Math.round(liveSeconds / 60),
      liveHoursFormatted: formatSecondsToHoursMin(liveSeconds),
      dolguCount,
      dolguMinutes: Math.round(dolguSeconds / 60),
      dolguHoursFormatted: formatSecondsToHoursMin(dolguSeconds),
      bantCount,
      bantMinutes: Math.round(bantSeconds / 60),
      bantHoursFormatted: formatSecondsToHoursMin(bantSeconds),
      categories,
      programsList,
      dailyStats,
      weeklyPeriods: Object.values(periodMap.weekly).sort((a, b) => b.key.localeCompare(a.key)),
      monthlyPeriods: Object.values(periodMap.monthly).sort((a, b) => b.key.localeCompare(a.key)),
      yearlyPeriods: Object.values(periodMap.yearly).sort((a, b) => b.key.localeCompare(a.key)),
      comparisonRows,
      addedInBroadcastOnly,
      removedFromDraftInBroadcast,
      durationChangedInBroadcast
    };
  }, [sourceSchedule, dataScope, selectedChannel, broadcastDays, activeBroadcastList]);

  const filteredPrograms = useMemo(() => {
    return reportData.programsList.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
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
  }, [reportData.programsList, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const channelName = currentChannel?.name || (selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD');
  const scopeText = dataScope === 'all_data' ? 'Tüm Kayıtlı Taslak Dönemleri' : (dateRangeLabel || 'Aktif Hafta');

  // EXCEL ÇIKTISI
  const handleExportExcel = () => {
    exportToExcel({
      filename: `Taslak_Planlama_Detayli_Rapor_${channelName}`,
      title: `TASLAK PLANLAMA DETAYLI YAYIN VE KARŞILAŞTIRMA RAPORU (${channelName})`,
      subtitle: `Kapsam: ${scopeText}`,
      kpis: [
        { label: 'Toplam Kuşak / Program', value: `${reportData.totalPrograms} Kuşak` },
        { label: 'Toplam Yayın Süresi', value: reportData.totalHoursFormatted },
        { label: 'Doluluk Oranı', value: `%${reportData.weeklyFillPct}` },
        { label: 'Canlı Yayın', value: `${reportData.liveCount} Kuşak (${reportData.liveHoursFormatted})` },
        { label: 'Taslak Dışı Yayında Eklenen', value: `${reportData.addedInBroadcastOnly.length} Program` }
      ],
      sections: [
        {
          title: '1. PROGRAM BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK YAYINLANMA RAPORU',
          headers: [
            'Program Adı',
            'Kategori',
            'Toplam Yayın (Kaç Defa)',
            'Toplam Saat / Süre',
            'Hangi Gün Kaç Defa Yayınlandı',
            'Haftalık Ort. Yayın',
            'Aylık Tahmini Yayın & Süre',
            'Yıllık Tahmini Yayın & Süre'
          ],
          rows: filteredPrograms.map(p => [
            p.title,
            p.category,
            `${p.count} Defa`,
            p.hoursFormatted,
            p.dayBreakdown,
            `${p.avgPerWeek} Kez/Hafta`,
            `${p.estMonthlyCount} Kez (${p.estMonthlyHours})`,
            `${p.estYearlyCount} Kez (${p.estYearlyHours})`
          ])
        },
        {
          title: '2. KATEGORİ BAZLI YAYIN DAĞILIMI (HANGİ KATEGORİDE KAÇ DEFA & KAÇ SAAT)',
          headers: ['Kategori Adı', 'Farklı Program Sayısı', 'Toplam Yayınlanma (Kaç Defa)', 'Toplam Süre (Saat)', 'Yayın Payı (%)'],
          rows: reportData.categories.map(c => [
            c.name,
            `${c.uniqueProgramsCount} Program`,
            `${c.count} Defa`,
            c.hoursFormatted,
            `%${c.sharePct}`
          ])
        },
        {
          title: '3. TASLAK PLANLAMA vs YAYINA GİDEN SON LİSTE (EKLENEN / ÇIKARILAN / DEĞİŞEN PROGRAMLAR)',
          headers: ['Tarih', 'Gün', 'Program Adı', 'Kategori', 'Taslakta (Adet / Süre)', 'Yayına Giden Listede (Adet / Süre)', 'Fark', 'Durum'],
          rows: reportData.comparisonRows.map(r => [
            r.dateKey,
            r.dayName,
            r.title,
            r.category,
            `${r.draftCount} Kez (${formatSecondsToHoursMin(r.draftSec)})`,
            `${r.broadcastCount} Kez (${formatSecondsToHoursMin(r.broadcastSec)})`,
            `${r.diffCount >= 0 ? `+${r.diffCount}` : r.diffCount} Kez (${formatSecondsToHoursMin(Math.abs(r.diffSec))})`,
            r.status
          ])
        }
      ]
    });
  };

  // CSV ÇIKTISI
  const handleExportCSV = () => {
    if (activeTab === 'comparison') {
      exportToCSV({
        filename: `Taslak_Yayin_Karsilastirma_${channelName}`,
        headers: ['Tarih', 'Gün', 'Program Adı', 'Kategori', 'Taslak Adet', 'Taslak Süre', 'Yayın Adet', 'Yayın Süre', 'Durum'],
        rows: reportData.comparisonRows.map(r => [
          r.dateKey,
          r.dayName,
          r.title,
          r.category,
          r.draftCount,
          formatSecondsToHoursMin(r.draftSec),
          r.broadcastCount,
          formatSecondsToHoursMin(r.broadcastSec),
          r.status
        ])
      });
      return;
    }

    exportToCSV({
      filename: `Taslak_Program_Yayın_Raporu_${channelName}`,
      headers: [
        'Program Adı',
        'Kategori',
        'Toplam Yayın (Kaç Defa)',
        'Toplam Süre (Saat)',
        'Hangi Gün Kaç Defa',
        'Haftalık Yayın',
        'Aylık Projeksiyon (Adet / Saat)',
        'Yıllık Projeksiyon (Adet / Saat)'
      ],
      rows: filteredPrograms.map(p => [
        p.title,
        p.category,
        p.count,
        p.hoursFormatted,
        p.dayBreakdown,
        p.avgPerWeek,
        `${p.estMonthlyCount} Kez (${p.estMonthlyHours})`,
        `${p.estYearlyCount} Kez (${p.estYearlyHours})`
      ])
    });
  };

  // PDF SUNUM ÇIKTISI
  const handleExportPDF = () => {
    exportToPresentationPDF({
      title: `TASLAK PLANLAMA YAYIN & DEĞİŞİKLİK ANALİZ SUNUMU`,
      subtitle: `Kanal: ${channelName} • Dönem Kapsamı: ${scopeText} • Karşılaştırılan Yayın Listesi: Liste ${activeBroadcastList}`,
      badgeText: 'TASLAK PLANLAMA STÜDYOSU • YÖNETİM SUNUM RAPORU',
      accentColor: '#2563eb',
      kpis: [
        { label: 'Toplam Planlanan Kuşak', value: `${reportData.totalPrograms} Kuşak`, sub: `${reportData.programsList.length} Farklı Program` },
        { label: 'Toplam Yayın Süresi', value: reportData.totalHoursFormatted, sub: `Doluluk: %${reportData.weeklyFillPct}` },
        { label: 'Canlı Yayın Kuşakları', value: `${reportData.liveCount} Kuşak`, sub: reportData.liveHoursFormatted, color: '#e11d48' },
        { label: 'Yayında Sonradan Eklenen', value: `${reportData.addedInBroadcastOnly.length} Program`, sub: 'Taslak dışı eklenenler', color: '#059669' },
        { label: 'Yayında Çıkarılan / Değişen', value: `${reportData.removedFromDraftInBroadcast.length + reportData.durationChangedInBroadcast.length} Kayıt`, sub: 'Taslak-Yayın farkı', color: '#d97706' }
      ],
      highlightCards: [
        {
          title: 'En Çok Yayınlanan 3 Kategori',
          body: reportData.categories.slice(0, 3).map(c => `${c.name}: ${c.count} kez (${c.hoursFormatted}, %${c.sharePct})`).join(' | ') || '-'
        },
        {
          title: 'Taslak vs Yayın Planlama (Yayına Giden Son Liste) Özeti',
          body: `Taslak dışı yayında eklenen: ${reportData.addedInBroadcastOnly.length} program • Taslaktan çıkarılan: ${reportData.removedFromDraftInBroadcast.length} program • Süresi değişen: ${reportData.durationChangedInBroadcast.length} program`
        }
      ],
      sections: [
        {
          title: '1. Hangi Program Hangi Gün Kaç Defa Yayınlandı (Haftalık / Aylık / Yıllık Saat Analizi)',
          description: 'Programların gün bazlı dağılımı, toplam yayın saati ve aylık/yıllık projeksiyonları.',
          headers: ['Program Adı', 'Kategori', 'Toplam Yayın', 'Toplam Saat', 'Hangi Gün Kaç Defa', 'Aylık (Adet / Saat)', 'Yıllık (Adet / Saat)'],
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
          title: '2. Kategori Bazlı Yayınlanma Raporu',
          description: 'Hangi kategoride kaç farklı program, toplam kaç defa ve kaç saat yayınlandı.',
          headers: ['Kategori', 'Farklı Program Sayısı', 'Yayınlanma Sayısı (Kaç Defa)', 'Toplam Yayın Saati', 'Oran (%)'],
          rows: reportData.categories.map(c => [
            c.name,
            `${c.uniqueProgramsCount} Program`,
            `${c.count} Defa`,
            c.hoursFormatted,
            `%${c.sharePct}`
          ])
        },
        {
          title: '3. Taslak Dışında Yayın Planlamada Eklenen & Değişen Programlar (Son Liste Kontrolü)',
          description: 'Taslak planlama ile yayına giden son liste arasındaki farklar ve sonradan eklenen programlar.',
          headers: ['Tarih / Gün', 'Program Adı', 'Kategori', 'Taslakta', 'Yayına Giden Listede', 'Fark / Durum'],
          rows: reportData.comparisonRows
            .filter(r => r.status !== 'Birebir Uyumlu')
            .concat(reportData.comparisonRows.filter(r => r.status === 'Birebir Uyumlu').slice(0, 20))
            .map(r => [
              `${r.dateKey} (${r.dayName})`,
              r.title,
              r.category,
              `${r.draftCount} Kez (${formatSecondsToHoursMin(r.draftSec)})`,
              `${r.broadcastCount} Kez (${formatSecondsToHoursMin(r.broadcastSec)})`,
              r.status
            ])
        }
      ]
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '18px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.38)',
          width: '100%',
          maxWidth: '1240px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ÜST BAŞLIK VE PDF / EXCEL / CSV ÇIKTI BUTONLARI */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            background: 'var(--bg-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #0ea5e9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
            >
              <BarChart3 size={21} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Taslak Planlama Detaylı Analiz &amp; Yayın Karşılaştırma Raporları
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{channelName}</span>
                <span>•</span>
                <span>{scopeText}</span>
                <span>•</span>
                <span>Yayın Listesi Kontrolü: <strong>Liste {activeBroadcastList}</strong></span>
              </div>
            </div>
          </div>

          {/* Kapsam Seçici + PDF / Excel / CSV Çıktı Butonları */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-secondary)',
                padding: '3px',
                borderRadius: '9px',
                border: '1px solid var(--border-color)'
              }}
            >
              <button
                type="button"
                onClick={() => setDataScope('active_week')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: dataScope === 'active_week' ? '#2563eb' : 'transparent',
                  color: dataScope === 'active_week' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Aktif Hafta
              </button>
              <button
                type="button"
                onClick={() => setDataScope('all_data')}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: dataScope === 'all_data' ? '#2563eb' : 'transparent',
                  color: dataScope === 'all_data' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Tüm Kayıtlı Dönemler (Aylık/Yıllık)
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportPDF}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '9px',
                border: 'none',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(220, 38, 38, 0.25)'
              }}
            >
              <FileText size={14} />
              <span>PDF (Sunum) İndir</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '9px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(5, 150, 105, 0.25)'
              }}
            >
              <FileSpreadsheet size={14} />
              <span>Excel (.xls) İndir</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <Download size={14} />
              <span>CSV İndir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 5 ÖZET KPI KARTI */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '10px',
            padding: '14px 24px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <div style={{ background: 'var(--bg-secondary)', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700 }}>TOPLAM YAYIN SAATİ &amp; DOLULUK</div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: '#2563eb', marginTop: '3px' }}>
              {reportData.totalHoursFormatted}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Doluluk: <strong>%{reportData.weeklyFillPct}</strong> (Boş: %{reportData.weeklyEmptyPct})
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700 }}>TOPLAM PROGRAM / KUŞAK</div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '3px' }}>
              {reportData.totalPrograms} Kuşak
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <strong>{reportData.programsList.length}</strong> Tekil Program • <strong>{reportData.categories.length}</strong> Kategori
            </div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '11px 13px', borderRadius: '10px', border: '1px solid rgba(225, 29, 72, 0.28)' }}>
            <div style={{ fontSize: '10.5px', color: '#e11d48', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={12} /> CANLI YAYIN &amp; DOLGU
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#be123c', marginTop: '3px' }}>
              {reportData.liveCount} Canlı • {reportData.dolguCount} Dolgu
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Canlı: {reportData.liveHoursFormatted} | Dolgu: {reportData.dolguHoursFormatted}
            </div>
          </div>

          <div
            onClick={() => setActiveTab('comparison')}
            style={{
              background: 'var(--bg-secondary)',
              padding: '11px 13px',
              borderRadius: '10px',
              border: '1.5px solid rgba(5, 150, 105, 0.4)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '10.5px', color: '#059669', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PlusCircle size={12} /> TASLAK DIŞI YAYINDA EKLENEN
            </div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: '#059669', marginTop: '3px' }}>
              +{reportData.addedInBroadcastOnly.length} Program
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Yayın Planlamada sonradan eklenenler &rarr;
            </div>
          </div>

          <div
            onClick={() => setActiveTab('comparison')}
            style={{
              background: 'var(--bg-secondary)',
              padding: '11px 13px',
              borderRadius: '10px',
              border: '1.5px solid rgba(217, 119, 6, 0.4)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '10.5px', color: '#d97706', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <GitCompare size={12} /> YAYINA GİDEN LİSTE FARKI
            </div>
            <div style={{ fontSize: '19px', fontWeight: 900, color: '#d97706', marginTop: '3px' }}>
              {reportData.removedFromDraftInBroadcast.length + reportData.durationChangedInBroadcast.length} Değişiklik
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Çıkarılan: {reportData.removedFromDraftInBroadcast.length} • Süre Farkı: {reportData.durationChangedInBroadcast.length}
            </div>
          </div>
        </div>

        {/* ALT SEKMELER VE ARAMA ÇUBUĞU */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-primary)'
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'programs', label: `1. Program & Gün Dağılımı (${reportData.programsList.length})` },
              { id: 'periods', label: '2. Haftalık / Aylık / Yıllık Yayın Analizi' },
              { id: 'categories', label: `3. Kategori Analizi (${reportData.categories.length})` },
              {
                id: 'comparison',
                label: `4. Yayına Giden Liste Kontrolü & Eklenen Programlar (${reportData.addedInBroadcastOnly.length + reportData.removedFromDraftInBroadcast.length + reportData.durationChangedInBroadcast.length} Fark)`
              },
              { id: 'days', label: `5. Günlük Doluluk (${reportData.dailyStats.length})` }
            ].map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: '8px',
                    border: active ? '1px solid #2563eb' : '1px solid var(--border-color)',
                    background: active ? '#2563eb' : 'var(--bg-secondary)',
                    color: active ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'programs' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                <option value="all">Tüm Kategoriler</option>
                {reportData.categories.map(c => (
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
                  background: 'var(--bg-secondary)'
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
                    width: '170px'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* İÇERİK GÖVDESİ */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {/* SEKME 1: HANGİ PROGRAM HANGİ GÜN KAÇ DEFA & KAÇ SAAT */}
          {activeTab === 'programs' && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px' }}>Program Adı</th>
                    <th style={{ padding: '10px 12px' }}>Kategori</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Kaç Defa Yayınlandı</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Toplam Kaç Saat</th>
                    <th style={{ padding: '10px 12px' }}>Hangi Gün Kaç Defa Yayınlandı</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Haftalık / Aylık / Yıllık Projeksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrograms.map(p => (
                    <tr key={p.title} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {p.title}
                        {p.isLive && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(225,29,72,0.14)', color: '#e11d48', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                            CANLI
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, color: '#2563eb', fontSize: '13px' }}>
                        {p.count} Defa
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>
                        {p.hoursFormatted}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
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
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <div>Haftalık: <strong>{p.avgPerWeek} kez</strong></div>
                        <div>Aylık: <strong>~{p.estMonthlyCount} kez ({p.estMonthlyHours})</strong></div>
                        <div>Yıllık: <strong>~{p.estYearlyCount} kez ({p.estYearlyHours})</strong></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SEKME 2: HAFTALIK / AYLIK / YILLIK YAYINLANMA DETAYLARI */}
          {activeTab === 'periods' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                {/* Haftalık Tablo */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                    📅 Haftalık Yayınlanma Özeti
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Hafta</th>
                        <th style={{ padding: '8px 10px' }}>Kuşak</th>
                        <th style={{ padding: '8px 10px' }}>Toplam Saat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.weeklyPeriods.map(w => (
                        <tr key={w.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{w.label} ({w.daysCount} gün)</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>{w.programsCount} Kez</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>{formatSecondsToHoursMin(w.seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Aylık Tablo */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                    🗓️ Aylık Yayınlanma Özeti
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Ay</th>
                        <th style={{ padding: '8px 10px' }}>Kuşak</th>
                        <th style={{ padding: '8px 10px' }}>Toplam Saat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.monthlyPeriods.map(m => (
                        <tr key={m.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.label} ({m.daysCount} gün)</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>{m.programsCount} Kez</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>{formatSecondsToHoursMin(m.seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Yıllık Tablo */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                    📊 Yıllık Yayınlanma Özeti
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Yıl</th>
                        <th style={{ padding: '8px 10px' }}>Kuşak</th>
                        <th style={{ padding: '8px 10px' }}>Toplam Saat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.yearlyPeriods.map(y => (
                        <tr key={y.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{y.label} ({y.daysCount} gün)</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>{y.programsCount} Kez</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>{formatSecondsToHoursMin(y.seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SEKME 3: KATEGORİ BAZLI YAYINLANMA ANALİZİ */}
          {activeTab === 'categories' && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
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
                  {reportData.categories.map(cat => (
                    <tr key={cat.name} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>{cat.name}</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700 }}>{cat.uniqueProgramsCount} Program</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 900, color: '#2563eb' }}>{cat.count} Defa</td>
                      <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>{cat.hoursFormatted}</td>
                      <td style={{ padding: '11px 14px', width: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '8px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${cat.sharePct}%`, height: '100%', background: '#2563eb', borderRadius: '999px' }} />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '12px', minWidth: '40px' }}>%{cat.sharePct}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SEKME 4: TASLAK PLANLAMA vs YAYINA GİDEN SON LİSTE (YAYIN PLANLAMA) KARŞILAŞTIRMASI */}
          {activeTab === 'comparison' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Taslak Dışında Yayın Planlamada Eklenen Programlar Kutusu */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(5, 150, 105, 0.45)',
                  background: 'rgba(5, 150, 105, 0.06)'
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#059669', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PlusCircle size={16} />
                  <span>Taslak Planlama Dışında Yayın Planlama (Liste {activeBroadcastList}) İçinde Eklenen Programlar ({reportData.addedInBroadcastOnly.length})</span>
                </div>
                {reportData.addedInBroadcastOnly.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Bu dönemde taslak planlama dışında yayın planlamaya sonradan eklenmiş farklı bir program bulunmuyor (veya ilgili gün henüz Yayın Planlamaya aktarılmadı).
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {reportData.addedInBroadcastOnly.map((item, idx) => (
                      <div
                        key={`${item.dateKey}-${item.title}-${idx}`}
                        style={{
                          padding: '7px 11px',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(5, 150, 105, 0.35)',
                          fontSize: '11.5px'
                        }}
                      >
                        <strong style={{ color: '#059669' }}>+ {item.title}</strong>{' '}
                        <span style={{ color: 'var(--text-muted)' }}>({item.dateKey} {item.dayName})</span> •{' '}
                        <strong>{item.broadcastCount} kez ({formatSecondsToHoursMin(item.broadcastSec)})</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tüm Karşılaştırma Tablosu */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 12px' }}>Tarih &amp; Gün</th>
                      <th style={{ padding: '10px 12px' }}>Program Adı</th>
                      <th style={{ padding: '10px 12px' }}>Kategori</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Taslak Planlamada</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Yayına Giden Son Listede</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Süre / Adet Farkı</th>
                      <th style={{ padding: '10px 12px' }}>Karşılaştırma Durumu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.comparisonRows.map((r, i) => {
                      const isAdded = r.status.includes('Eklendi');
                      const isRemoved = r.status.includes('Çıkarıldı');
                      const isChanged = r.status.includes('Değişti');
                      return (
                        <tr key={`${r.dateKey}-${r.title}-${i}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>
                            {r.dateKey} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({r.dayName})</span>
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>{r.title}</td>
                          <td style={{ padding: '9px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{r.category}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700 }}>
                            {r.draftCount > 0 ? `${r.draftCount} Kez (${formatSecondsToHoursMin(r.draftSec)})` : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>
                            {r.broadcastCount > 0 ? `${r.broadcastCount} Kez (${formatSecondsToHoursMin(r.broadcastSec)})` : '—'}
                          </td>
                          <td
                            style={{
                              padding: '9px 12px',
                              textAlign: 'center',
                              fontWeight: 800,
                              color: isAdded ? '#059669' : isRemoved ? '#dc2626' : isChanged ? '#d97706' : 'var(--text-muted)'
                            }}
                          >
                            {r.diffCount === 0 && Math.abs(r.diffSec) <= 60
                              ? 'Fark Yok'
                              : `${r.diffCount > 0 ? `+${r.diffCount}` : r.diffCount} Kez / ${r.diffSec >= 0 ? '+' : '-'}${formatSecondsToHoursMin(Math.abs(r.diffSec))}`}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: isAdded
                                  ? 'rgba(5, 150, 105, 0.14)'
                                  : isRemoved
                                  ? 'rgba(220, 38, 38, 0.14)'
                                  : isChanged
                                  ? 'rgba(217, 119, 6, 0.14)'
                                  : 'rgba(37, 99, 235, 0.1)',
                                color: isAdded
                                  ? '#059669'
                                  : isRemoved
                                  ? '#dc2626'
                                  : isChanged
                                  ? '#d97706'
                                  : '#2563eb'
                              }}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEKME 5: GÜNLÜK DOLULUK TABLOSU */}
          {activeTab === 'days' && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 12px' }}>Gün &amp; Tarih</th>
                    <th style={{ padding: '10px 12px' }}>Kuşak Sayısı</th>
                    <th style={{ padding: '10px 12px' }}>Canlı / Dolgu</th>
                    <th style={{ padding: '10px 12px' }}>Dolu Süre (Saat)</th>
                    <th style={{ padding: '10px 12px' }}>Boş Süre</th>
                    <th style={{ padding: '10px 12px' }}>Doluluk Oranı</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.dailyStats.map(d => (
                    <tr key={d.dateKey} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800 }}>
                        {d.dayName} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({d.dateKey})</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{d.programCount} Kuşak</td>
                      <td style={{ padding: '10px 12px' }}>
                        {d.liveCount} Canlı / {d.dolguCount} Dolgu
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#059669' }}>
                        {formatMinutesToHoursMin(d.totalMin)}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: d.emptyMin > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        {formatMinutesToHoursMin(d.emptyMin)}
                      </td>
                      <td style={{ padding: '10px 12px', width: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '7px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${d.fillPct}%`,
                                height: '100%',
                                background: d.fillPct >= 95 ? '#10b981' : '#3b82f6'
                              }}
                            />
                          </div>
                          <span style={{ fontWeight: 800, fontSize: '11.5px' }}>%{d.fillPct}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftReportsModal;
