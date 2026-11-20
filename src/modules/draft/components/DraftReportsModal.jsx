/**
 * @file src/modules/draft/components/DraftReportsModal.jsx
 * @description Taslak Planlama Modülü Detaylı Analiz, Program Bazlı (Günlük / Haftalık / Aylık / Yıllık)
 * Yayınlanma & Süre Raporları, Tarih Aralığı ve Program Filtreleme, Kategori Dağılımı ve
 * Yayına Giden Liste (Yayın Planlama) Karşılaştırma Raporu (PDF Sunum, Excel, CSV Çıktılı).
 *
 * Hem bağımsız ayrı pencerede (/draft-reports, isStandaloneWindow=true) hem de tam ekran görünümde çalışır.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart3,
  X,
  Calendar,
  Clock,
  Radio,
  Layers,
  FileSpreadsheet,
  FileText,
  Download,
  GitCompare,
  PlusCircle,
  Search,
  Filter,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tv,
  Eye
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

const cleanDisplayProgramTitle = (p = {}) => {
  const raw = String(p.customTitle || p.title || p.rawTitle || 'İsimsiz Program').trim();
  return raw
    .replace(/\s*\(Kopya\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const resolveCleanCategory = (p = {}) => {
  const isDolgu = p.isKisaSlot || p.title === 'Dolgu Kuşağı' || p.category === 'Kısa Program';
  const isLive = Boolean(p.isLive);
  if (isLive) return 'Canlı Yayın';
  if (isDolgu) return 'Dolgu Kuşağı';
  if (p.category && String(p.category).trim()) return String(p.category).trim();
  if (p.categoryBadge && String(p.categoryBadge).trim()) return String(p.categoryBadge).trim();
  return 'Genel Program';
};

const DraftReportsModal = ({
  isOpen,
  onClose,
  scheduleData,
  allChannelSchedule,
  selectedChannel = 'ch_hd',
  onSelectChannel,
  channels = [],
  currentChannel,
  dateRangeLabel,
  activeWeekDates = [],
  isStandaloneWindow = false
}) => {
  // 'programs' | 'periods' | 'categories' | 'comparison' | 'days'
  const [activeTab, setActiveTab] = useState('programs');
  // 'all_data' | 'active_week' | 'custom_range'
  const [dataScope, setDataScope] = useState('all_data');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDayNameFilter, setSelectedDayNameFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProgramKey, setExpandedProgramKey] = useState(null);

  const broadcastDays = useBroadcastStore(state => state.days || {});
  const activeBroadcastList = useBroadcastStore(state => state.activeList || 'A');

  // Birleştirilmiş kaynak takvim (hem tüm kayıtlı günler hem aktif hafta)
  const mergedChannelSchedule = useMemo(() => {
    const combined = {
      ...(scheduleData || {}),
      ...(allChannelSchedule || {})
    };
    return combined;
  }, [scheduleData, allChannelSchedule]);

  // Kayıtlı ve içinde program bulunan tüm tarihleri bul
  const availableProgramDates = useMemo(() => {
    return Object.entries(mergedChannelSchedule)
      .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v && Array.isArray(v.programs) && v.programs.length > 0)
      .map(([k]) => k)
      .sort();
  }, [mergedChannelSchedule]);

  // Eğer aktif haftada program varsa ve ilk açılışsa kapsamı belirle
  useEffect(() => {
    if (activeWeekDates && activeWeekDates.length > 0) {
      const hasActiveWeekProgs = activeWeekDates.some(
        dKey => Array.isArray(mergedChannelSchedule?.[dKey]?.programs) && mergedChannelSchedule[dKey].programs.length > 0
      );
      if (hasActiveWeekProgs && !startDateFilter && !endDateFilter) {
        setDataScope('active_week');
      } else if (availableProgramDates.length > 0 && !startDateFilter && !endDateFilter) {
        setDataScope('all_data');
      }
    }
  }, [activeWeekDates, mergedChannelSchedule, availableProgramDates.length]);

  // Seçili kapsam ve tarih aralığına göre filtrelenmiş gün girişleri
  const filteredDayEntries = useMemo(() => {
    const allEntries = Object.entries(mergedChannelSchedule)
      .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && v && Array.isArray(v.programs))
      .sort(([a], [b]) => a.localeCompare(b));

    return allEntries.filter(([dateKey, dayObj]) => {
      const progs = dayObj?.programs || [];

      // Özel tarih aralığı girilmişse
      if (startDateFilter && dateKey < startDateFilter) return false;
      if (endDateFilter && dateKey > endDateFilter) return false;

      if (!startDateFilter && !endDateFilter) {
        if (dataScope === 'active_week') {
          if (activeWeekDates && activeWeekDates.length > 0) {
            return activeWeekDates.includes(dateKey);
          }
          return Object.prototype.hasOwnProperty.call(scheduleData || {}, dateKey);
        }
        // 'all_data' modunda boş günleri atla (en az 1 programı olan günleri dahil et)
        if (progs.length === 0) return false;
      } else {
        // Tarih aralığı seçiliyse ve o günde hiç program yoksa boş gün kalabalığı yapmasın
        if (progs.length === 0) return false;
      }

      if (selectedDayNameFilter !== 'all') {
        const pInfo = getDatePeriodBuckets(dateKey);
        const dName = dayObj?.dayName || pInfo.dayName;
        if (dName !== selectedDayNameFilter) return false;
      }

      return true;
    });
  }, [
    mergedChannelSchedule,
    startDateFilter,
    endDateFilter,
    dataScope,
    activeWeekDates,
    scheduleData,
    selectedDayNameFilter
  ]);

  const reportData = useMemo(() => {
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

    const allDistinctWeeksSet = new Set();
    const allDistinctMonthsSet = new Set();
    const allDistinctYearsSet = new Set();

    // Taslak vs Yayın Planlama (Yayına Giden Liste) karşılaştırma kayıtları
    const comparisonRows = [];
    const addedInBroadcastOnly = [];
    const removedFromDraftInBroadcast = [];
    const durationChangedInBroadcast = [];

    filteredDayEntries.forEach(([dateKey, dayObj]) => {
      const progs = dayObj?.programs || [];
      const periodInfo = getDatePeriodBuckets(dateKey);
      const dName = dayObj?.dayName || periodInfo.dayName;

      if (progs.length > 0) {
        allDistinctWeeksSet.add(periodInfo.weekKey);
        allDistinctMonthsSet.add(periodInfo.monthKey);
        allDistinctYearsSet.add(periodInfo.yearKey);
      }

      let dayTotalSec = 0;
      let dayLiveCount = 0;
      let dayDolguCount = 0;

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

      const draftDayTitleMap = {};

      progs.forEach(p => {
        totalPrograms += 1;
        const sec =
          p.episodeTotalSec && Number(p.episodeTotalSec) > 0
            ? Number(p.episodeTotalSec)
            : (parseFloat(p.duration) || 30) * 60;

        totalSeconds += sec;
        dayTotalSec += sec;

        const isDolgu = Boolean(p.isKisaSlot || p.title === 'Dolgu Kuşağı' || p.category === 'Kısa Program');
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

        const cat = resolveCleanCategory(p);
        const displayTitle = cleanDisplayProgramTitle(p);
        const normProgKey = normalizeTitleKey(displayTitle) || displayTitle;

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
        categoryMap[cat].uniquePrograms.add(displayTitle);

        if (!programStatsMap[normProgKey]) {
          programStatsMap[normProgKey] = {
            key: normProgKey,
            title: displayTitle,
            category: cat,
            isLive,
            isDolgu,
            count: 0,
            seconds: 0,
            episodesSet: new Set(),
            daysMap: {}, // dateKey -> { dateKey, dayName, count, seconds, slots: [] }
            dayOfWeekMap: {}, // Pazartesi -> { count, seconds }
            weeksMap: {}, // weekKey -> { label, count, seconds }
            monthsMap: {}, // monthKey -> { label, count, seconds }
            yearsMap: {} // yearKey -> { label, count, seconds }
          };
        }

        const ps = programStatsMap[normProgKey];
        ps.count += 1;
        ps.seconds += sec;
        if (isLive) ps.isLive = true;
        if (p.episode) ps.episodesSet.add(String(p.episode));

        if (!ps.dayOfWeekMap[dName]) {
          ps.dayOfWeekMap[dName] = { count: 0, seconds: 0 };
        }
        ps.dayOfWeekMap[dName].count += 1;
        ps.dayOfWeekMap[dName].seconds += sec;

        if (!ps.daysMap[dateKey]) {
          ps.daysMap[dateKey] = {
            dateKey,
            dayName: dName,
            count: 0,
            seconds: 0,
            slots: []
          };
        }
        ps.daysMap[dateKey].count += 1;
        ps.daysMap[dateKey].seconds += sec;
        ps.daysMap[dateKey].slots.push({
          startTime: p.startTime || '--:--',
          endTime: p.endTime || '--:--',
          episode: p.episode || '',
          host: p.host || '',
          seconds: sec
        });

        if (!ps.weeksMap[periodInfo.weekKey]) {
          ps.weeksMap[periodInfo.weekKey] = {
            key: periodInfo.weekKey,
            label: periodInfo.weekLabel,
            count: 0,
            seconds: 0,
            daysSet: new Set()
          };
        }
        ps.weeksMap[periodInfo.weekKey].count += 1;
        ps.weeksMap[periodInfo.weekKey].seconds += sec;
        ps.weeksMap[periodInfo.weekKey].daysSet.add(dateKey);

        if (!ps.monthsMap[periodInfo.monthKey]) {
          ps.monthsMap[periodInfo.monthKey] = {
            key: periodInfo.monthKey,
            label: periodInfo.monthLabel,
            count: 0,
            seconds: 0,
            daysSet: new Set()
          };
        }
        ps.monthsMap[periodInfo.monthKey].count += 1;
        ps.monthsMap[periodInfo.monthKey].seconds += sec;
        ps.monthsMap[periodInfo.monthKey].daysSet.add(dateKey);

        if (!ps.yearsMap[periodInfo.yearKey]) {
          ps.yearsMap[periodInfo.yearKey] = {
            key: periodInfo.yearKey,
            label: `${periodInfo.yearKey} Yılı`,
            count: 0,
            seconds: 0,
            daysSet: new Set()
          };
        }
        ps.yearsMap[periodInfo.yearKey].count += 1;
        ps.yearsMap[periodInfo.yearKey].seconds += sec;
        ps.yearsMap[periodInfo.yearKey].daysSet.add(dateKey);

        // Dönemsel kovalara ekle
        periodMap.weekly[periodInfo.weekKey].programsCount += 1;
        periodMap.weekly[periodInfo.weekKey].seconds += sec;
        periodMap.weekly[periodInfo.weekKey].uniquePrograms.add(displayTitle);

        periodMap.monthly[periodInfo.monthKey].programsCount += 1;
        periodMap.monthly[periodInfo.monthKey].seconds += sec;
        periodMap.monthly[periodInfo.monthKey].uniquePrograms.add(displayTitle);

        periodMap.yearly[periodInfo.yearKey].programsCount += 1;
        periodMap.yearly[periodInfo.yearKey].seconds += sec;
        periodMap.yearly[periodInfo.yearKey].uniquePrograms.add(displayTitle);

        if (normProgKey) {
          if (!draftDayTitleMap[normProgKey]) {
            draftDayTitleMap[normProgKey] = {
              title: displayTitle,
              category: cat,
              count: 0,
              seconds: 0,
              startTimes: []
            };
          }
          draftDayTitleMap[normProgKey].count += 1;
          draftDayTitleMap[normProgKey].seconds += sec;
          if (p.startTime) draftDayTitleMap[normProgKey].startTimes.push(p.startTime);
        }
      });

      const dayTotalMin = Math.round(dayTotalSec / 60);
      const fillPct = Math.min(100, Math.round((dayTotalSec / 86400) * 100));
      const emptyPct = Math.max(0, 100 - fillPct);

      dailyStats.push({
        dateKey,
        dayName: dName,
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

      const broadcastDayTitleMap = {};

      bProgsRaw.forEach(bp => {
        if (bp.type === 'ad_break' || /^Reklam Kuşağı/i.test(bp.title || '')) return;
        if (bp.isIntroClip || bp.unitType === 'intro' || /^semerkand_intro/i.test(bp.clipName || bp.title || '')) return;
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
            dayName: dName,
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
          const row = {
            dateKey,
            dayName: dName,
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
          const row = {
            dateKey,
            dayName: dName,
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

    const activeDayCount = Math.max(1, dailyStats.filter(d => d.programCount > 0).length);
    const totalActiveWeeks = Math.max(1, allDistinctWeeksSet.size);
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
        // Haftanın günlerine göre sıralı dağılım
        const sortedDaysOfWeek = Object.entries(item.dayOfWeekMap).sort(
          ([a], [b]) => TR_DAY_ORDER.indexOf(a) - TR_DAY_ORDER.indexOf(b)
        );
        const dayBreakdown = sortedDaysOfWeek
          .map(([dName, obj]) => `${dName}: ${obj.count} kez (${formatSecondsToHoursMin(obj.seconds)})`)
          .join(' • ');

        const detailedDates = Object.values(item.daysMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        const progActiveDays = Math.max(1, detailedDates.length);
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

        const weeksList = Object.values(item.weeksMap)
          .map(w => ({
            ...w,
            daysCount: w.daysSet ? w.daysSet.size : 0,
            hoursFormatted: formatSecondsToHoursMin(w.seconds)
          }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const monthsList = Object.values(item.monthsMap)
          .map(m => ({
            ...m,
            daysCount: m.daysSet ? m.daysSet.size : 0,
            hoursFormatted: formatSecondsToHoursMin(m.seconds)
          }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const yearsList = Object.values(item.yearsMap)
          .map(y => ({
            ...y,
            daysCount: y.daysSet ? y.daysSet.size : 0,
            hoursFormatted: formatSecondsToHoursMin(y.seconds)
          }))
          .sort((a, b) => a.key.localeCompare(b.key));

        const progActiveWeeks = Math.max(1, weeksList.length);
        const progActiveMonths = Math.max(1, monthsList.length);
        const progActiveYears = Math.max(1, yearsList.length);

        // 1. GÜNDE NE KADAR (Gerçek günlük yayın sayısı ve süresi)
        const dayCounts = detailedDates.map(d => d.count);
        const minDayCount = dayCounts.length > 0 ? Math.min(...dayCounts) : 0;
        const maxDayCount = dayCounts.length > 0 ? Math.max(...dayCounts) : 0;
        const dailyAvgCount = Number((item.count / progActiveDays).toFixed(1));
        const dailyCountLabel =
          minDayCount === maxDayCount
            ? `Günde ${minDayCount} Defa`
            : `Günde ${minDayCount}–${maxDayCount} Defa (Ort. ${dailyAvgCount})`;
        const dailyAvgSeconds = Math.round(item.seconds / progActiveDays);
        const dailyAvgHoursFormatted = formatSecondsToHoursMin(dailyAvgSeconds);
        const singleBroadcastAvgSec = Math.round(item.seconds / Math.max(1, item.count));
        const singleBroadcastFormatted = formatSecondsToHoursMin(singleBroadcastAvgSec);

        // 2. HAFTADA NE KADAR (Gerçek Pazartesi-Pazar haftalık yayın sayısı ve süresi)
        const weekCounts = weeksList.map(w => w.count);
        const minWeekCount = weekCounts.length > 0 ? Math.min(...weekCounts) : 0;
        const maxWeekCount = weekCounts.length > 0 ? Math.max(...weekCounts) : 0;
        const weeklyAvgCount = Number((item.count / progActiveWeeks).toFixed(1));
        const weeklyCountLabel =
          minWeekCount === maxWeekCount
            ? `Haftada ${minWeekCount} Defa`
            : `Haftada ${ weeklyAvgCount } Defa (${minWeekCount}–${maxWeekCount})`;
        const weeklyAvgSeconds = Math.round(item.seconds / progActiveWeeks);
        const weeklyHoursFormatted = formatSecondsToHoursMin(weeklyAvgSeconds);
        const weeksBreakdownText = weeksList
          .map(w => `${w.label}: ${w.count} defa (${w.hoursFormatted}, ${w.daysCount} gün)`)
          .join(' • ');

        // 3. AYDA NE KADAR (Sadece sistemde kayıtlı gerçek aylık veri — hayali projeksiyon yok!)
        const monthlyRecordedCount = Number((item.count / progActiveMonths).toFixed(1));
        const monthlyRecordedSec = Math.round(item.seconds / progActiveMonths);
        const monthlyRecordedHours = formatSecondsToHoursMin(monthlyRecordedSec);
        const monthsBreakdownText = monthsList
          .map(m => `${m.label}: ${m.count} Defa (${m.hoursFormatted}, ${m.daysCount} gün kayıtlı)`)
          .join(' • ');

        // 4. YILDA NE KADAR (Sadece sistemde kayıtlı gerçek yıllık veri — hayali 52 hafta çarpımı yok!)
        const yearlyRecordedCount = Number((item.count / progActiveYears).toFixed(1));
        const yearlyRecordedSec = Math.round(item.seconds / progActiveYears);
        const yearlyRecordedHours = formatSecondsToHoursMin(yearlyRecordedSec);
        const yearsBreakdownText = yearsList
          .map(y => `${y.label}: ${y.count} Defa (${y.hoursFormatted}, ${y.daysCount} gün / ${progActiveWeeks} hafta kayıtlı)`)
          .join(' • ');

        return {
          ...item,
          episodesCount: item.episodesSet.size,
          activeDaysCount: detailedDates.length,
          firstDateKey,
          lastDateKey,
          activeDateSpanLabel,
          durationSpanSummary: `${detailedDates.length} Günde / ${weeksList.length} Haftada (${activeDateSpanLabel})`,
          sortedDaysOfWeek,
          dayBreakdown,
          detailedDates,
          // Günlük gerçek metrikler
          dailyAvgCount,
          dailyCountLabel,
          dailyAvgSeconds,
          dailyAvgHoursFormatted,
          singleBroadcastFormatted,
          // Haftalık gerçek metrikler
          progActiveWeeks: weeksList.length,
          weeklyAvgCount,
          weeklyCountLabel,
          weeklyAvgSeconds,
          weeklyHoursFormatted,
          weeksBreakdownText,
          // Aylık gerçek kayıtlı metrikler
          progActiveMonths: monthsList.length,
          monthlyRecordedCount,
          monthlyRecordedHours,
          monthsBreakdownText,
          // Yıllık gerçek kayıtlı metrikler
          progActiveYears: yearsList.length,
          yearlyRecordedCount,
          yearlyRecordedHours,
          yearsBreakdownText,
          // Toplam
          hoursFormatted: formatSecondsToHoursMin(item.seconds),
          weeksList,
          monthsList,
          yearsList
        };
      })
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds);

    return {
      activeDayCount,
      totalActiveWeeks,
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
  }, [filteredDayEntries, selectedChannel, broadcastDays, activeBroadcastList]);

  // Program Bazlı Filtreleme (Kategori, Program Seçimi, Arama)
  const filteredPrograms = useMemo(() => {
    return reportData.programsList.filter(p => {
      if (selectedProgramFilter !== 'all' && p.key !== selectedProgramFilter) return false;
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
  }, [reportData.programsList, selectedProgramFilter, selectedCategory, searchQuery]);

  // Tek bir program seçiliyse veya detay satırı açılmışsa aktif detay programı
  const focusedProgram = useMemo(() => {
    if (selectedProgramFilter !== 'all') {
      return reportData.programsList.find(p => p.key === selectedProgramFilter) || null;
    }
    if (expandedProgramKey) {
      return reportData.programsList.find(p => p.key === expandedProgramKey) || null;
    }
    return null;
  }, [selectedProgramFilter, expandedProgramKey, reportData.programsList]);

  if (!isOpen && !isStandaloneWindow) return null;

  const channelName = currentChannel?.name || (selectedChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD');
  const firstDateInScope = reportData.dailyStats[0]?.dateKey || '';
  const lastDateInScope = reportData.dailyStats[reportData.dailyStats.length - 1]?.dateKey || '';
  const scopeText =
    startDateFilter || endDateFilter
      ? `Tarih Aralığı: ${startDateFilter || firstDateInScope || 'Başlangıç'} — ${endDateFilter || lastDateInScope || 'Bitiş'} (${reportData.dailyStats.length} Gün)`
      : dataScope === 'all_data'
      ? `Tüm Kayıtlı Dönemler (${firstDateInScope ? `${firstDateInScope} — ${lastDateInScope}, ` : ''}${reportData.dailyStats.length} Gün)`
      : `${dateRangeLabel || 'Aktif Hafta'} (${reportData.dailyStats.length} Gün)`;

  const handleResetFilters = () => {
    setStartDateFilter('');
    setEndDateFilter('');
    setSelectedProgramFilter('all');
    setSelectedCategory('all');
    setSelectedDayNameFilter('all');
    setSearchQuery('');
    setDataScope('all_data');
  };

  const handleOpenInSeparateWindow = () => {
    const weekParam = activeWeekDates?.[0] || firstDateInScope || '';
    const url = `/draft-reports?channel=${encodeURIComponent(selectedChannel)}&week=${encodeURIComponent(weekParam)}`;
    window.open(
      url,
      'TaslakRaporlarPenceresi',
      'width=1540,height=940,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
  };

  // EXCEL ÇIKTISI (Sadece gerçek kayıtlı verileri ve ne kadar sürede kaç defa girdiğini içerir)
  const handleExportExcel = () => {
    const sections = [
      {
        title: '1. PROGRAM BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK GERÇEK YAYINLANMA & SAAT RAPORU',
        headers: [
          'Program Adı',
          'Kategori',
          'Toplam Kaç Defa & Ne Kadar Sürede',
          'Toplam Yayın Saati',
          'Günde Ne Kadar (Günlük Gerçek Yayın & Süre)',
          'Haftada Ne Kadar (Haftalık Gerçek Yayın & Süre)',
          'Ayda Ne Kadar (Kayıtlı Aylık Gerçek Veri)',
          'Yılda Ne Kadar (Kayıtlı Yıllık Gerçek Veri)',
          'Hangi Gün Kaç Defa & Kaç Saat Yayınlandı'
        ],
        rows: filteredPrograms.map(p => [
          p.title,
          p.category,
          `${p.count} Defa (${p.durationSpanSummary})`,
          p.hoursFormatted,
          `${p.dailyCountLabel} (${p.dailyAvgHoursFormatted}/gün • Tek yayın: ${p.singleBroadcastFormatted})`,
          `${p.weeklyCountLabel} (${p.weeklyHoursFormatted}/hafta • ${p.weeksBreakdownText})`,
          p.monthsBreakdownText,
          p.yearsBreakdownText,
          p.dayBreakdown
        ])
      }
    ];

    if (focusedProgram) {
      sections.push({
        title: `2. "${focusedProgram.title}" — GÜN GÜN VE SAAT SAAT DETAYLI YAYIN DÖKÜMÜ`,
        headers: ['Tarih', 'Gün', 'Yayın Sayısı', 'O Gün Toplam Süre', 'Yayın Saatleri ve Bölümler'],
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
        title: '3. KATEGORİ BAZLI YAYIN DAĞILIMI (HANGİ KATEGORİDE KAÇ DEFA & KAÇ SAAT)',
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
        title: '4. HAFTALIK / AYLIK / YILLIK DÖNEMSEL YAYIN ÖZETİ',
        headers: ['Dönem Tipi', 'Dönem Adı', 'Aktif Gün Sayısı', 'Farklı Program', 'Toplam Yayın (Kuşak)', 'Toplam Yayın Saati'],
        rows: [
          ...reportData.weeklyPeriods.map(w => ['Haftalık', w.label, `${w.daysCount} Gün`, `${w.uniquePrograms.size} Program`, `${w.programsCount} Kez`, formatSecondsToHoursMin(w.seconds)]),
          ...reportData.monthlyPeriods.map(m => ['Aylık', m.label, `${m.daysCount} Gün`, `${m.uniquePrograms.size} Program`, `${m.programsCount} Kez`, formatSecondsToHoursMin(m.seconds)]),
          ...reportData.yearlyPeriods.map(y => ['Yıllık', y.label, `${y.daysCount} Gün`, `${y.uniquePrograms.size} Program`, `${y.programsCount} Kez`, formatSecondsToHoursMin(y.seconds)])
        ]
      },
      {
        title: '5. TASLAK PLANLAMA vs YAYINA GİDEN SON LİSTE KARŞILAŞTIRMASI',
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
    );

    exportToExcel({
      filename: focusedProgram
        ? `Taslak_Program_Raporu_${focusedProgram.title}_${channelName}`
        : `Taslak_Planlama_Detayli_Rapor_${channelName}`,
      title: focusedProgram
        ? `PROGRAM BAZLI DETAYLI YAYIN RAPORU: ${focusedProgram.title} (${channelName})`
        : `TASLAK PLANLAMA DETAYLI YAYIN VE KARŞILAŞTIRMA RAPORU (${channelName})`,
      subtitle: `${scopeText}${focusedProgram ? ` • Seçili Program: ${focusedProgram.title}` : ''}`,
      kpis: [
        { label: 'İncelenen Program Sayısı', value: `${filteredPrograms.length} Program` },
        { label: 'Toplam Kuşak / Yayın', value: `${reportData.totalPrograms} Kuşak` },
        { label: 'Toplam Yayın Süresi', value: reportData.totalHoursFormatted },
        { label: 'Doluluk Oranı', value: `%${reportData.weeklyFillPct}` },
        { label: 'Taslak Dışı Yayında Eklenen', value: `${reportData.addedInBroadcastOnly.length} Program` }
      ],
      sections
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

    if (activeTab === 'categories') {
      exportToCSV({
        filename: `Taslak_Kategori_Raporu_${channelName}`,
        headers: ['Kategori Adı', 'Farklı Program Sayısı', 'Kaç Defa Yayınlandı', 'Toplam Yayın Saati', 'Yayın Payı (%)'],
        rows: reportData.categories.map(c => [c.name, c.uniqueProgramsCount, c.count, c.hoursFormatted, `%${c.sharePct}`])
      });
      return;
    }

    exportToCSV({
      filename: focusedProgram
        ? `Taslak_Program_${focusedProgram.title}_${channelName}`
        : `Taslak_Program_Bazli_Rapor_${channelName}`,
      headers: [
        'Program Adı',
        'Kategori',
        'Toplam Yayın (Kaç Defa)',
        'Ne Kadar Sürede (Gün / Hafta / Tarih Aralığı)',
        'Toplam Süre (Saat)',
        'Günde Ne Kadar (Adet)',
        'Günde Ne Kadar (Süre)',
        'Haftada Ne Kadar (Adet & Süre)',
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
        title: '1. Program Bazlı Günlük, Haftalık, Aylık ve Yıllık Gerçek Yayınlanma & Süre Analizi',
        description:
          'Her programın sistemde kayıtlı gerçek verilerine göre ne kadar sürede kaç defa yayınlandığını ve günlük/haftalık/aylık/yıllık gerçek yayın sürelerini gösterir.',
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
        description: `${focusedProgram.title} programının seçili tarih aralığındaki tüm yayın günleri, saatleri ve süreleri.`,
        headers: ['Tarih', 'Gün', 'Yayın Sayısı', 'Toplam Süre', 'Yayın Saatleri & Bölüm Bilgisi'],
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
        title: '3. Kategori Bazlı Yayınlanma Raporu',
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
        title: '4. Taslak Dışında Yayın Planlamada Eklenen & Değişen Programlar (Son Liste Kontrolü)',
        description: 'Taslak planlama ile yayına giden son liste arasındaki farklar ve sonradan eklenen programlar.',
        headers: ['Tarih / Gün', 'Program Adı', 'Kategori', 'Taslakta', 'Yayına Giden Listede', 'Fark / Durum'],
        rows: reportData.comparisonRows
          .filter(r => r.status !== 'Birebir Uyumlu')
          .concat(reportData.comparisonRows.filter(r => r.status === 'Birebir Uyumlu').slice(0, 25))
          .map(r => [
            `${r.dateKey} (${r.dayName})`,
            r.title,
            r.category,
            `${r.draftCount} Kez (${formatSecondsToHoursMin(r.draftSec)})`,
            `${r.broadcastCount} Kez (${formatSecondsToHoursMin(r.broadcastSec)})`,
            r.status
          ])
      }
    );

    exportToPresentationPDF({
      title: focusedProgram
        ? `PROGRAM BAZLI YAYIN ANALİZ SUNUMU: ${focusedProgram.title}`
        : `TASLAK PLANLAMA YAYIN & DEĞİŞİKLİK ANALİZ SUNUMU`,
      subtitle: `Kanal: ${channelName} • ${scopeText} • Karşılaştırılan Yayın Listesi: Liste ${activeBroadcastList}`,
      badgeText: 'TASLAK PLANLAMA STÜDYOSU • YÖNETİM SUNUM RAPORU',
      accentColor: '#2563eb',
      kpis: focusedProgram
        ? [
            { label: 'Program Adı & Kapsam', value: `${focusedProgram.count} Defa (${focusedProgram.hoursFormatted})`, sub: focusedProgram.durationSpanSummary },
            { label: 'Günde Ne Kadar', value: focusedProgram.dailyCountLabel, sub: `${focusedProgram.dailyAvgHoursFormatted} / gün (Bölüm: ${focusedProgram.singleBroadcastFormatted})` },
            { label: 'Haftada Ne Kadar', value: focusedProgram.weeklyCountLabel, sub: `${focusedProgram.weeklyHoursFormatted} / hafta (${focusedProgram.progActiveWeeks} Hafta)` },
            { label: 'Ayda Ne Kadar (Kayıtlı)', value: `${focusedProgram.monthlyRecordedCount} Defa / Ay`, sub: focusedProgram.monthsBreakdownText, color: '#059669' },
            { label: 'Yılda Ne Kadar (Kayıtlı)', value: `${focusedProgram.yearlyRecordedCount} Defa / Yıl`, sub: focusedProgram.yearsBreakdownText, color: '#d97706' }
          ]
        : [
            { label: 'Listelenen Program', value: `${filteredPrograms.length} Program`, sub: `${reportData.totalPrograms} Toplam Kuşak` },
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
      sections
    });
  };

  const innerContent = (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: isStandaloneWindow ? '0px' : '18px',
        border: isStandaloneWindow ? 'none' : '1px solid var(--border-color)',
        boxShadow: isStandaloneWindow ? 'none' : '0 25px 60px -12px rgba(0, 0, 0, 0.38)',
        width: '100%',
        maxWidth: isStandaloneWindow ? '100%' : '1440px',
        minHeight: isStandaloneWindow ? '100vh' : 'auto',
        maxHeight: isStandaloneWindow ? 'none' : '94vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: isStandaloneWindow ? 'visible' : 'hidden'
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* 1. ÜST BAŞLIK, KANAL SEÇİCİ VE PDF / EXCEL / CSV ÇIKTI BUTONLARI */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--bg-primary)',
          position: isStandaloneWindow ? 'sticky' : 'static',
          top: 0,
          zIndex: 50
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
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Taslak Planlama — Program Bazlı Günlük / Haftalık / Aylık / Yıllık Analiz &amp; Raporlar
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{channelName}</span>
              <span>•</span>
              <span>{scopeText}</span>
              <span>•</span>
              <span>Yayın Listesi Kontrolü: <strong>Liste {activeBroadcastList}</strong></span>
            </div>
          </div>
        </div>

        {/* Sağ: Kanal Seçici (Ayrı Penceredeyse), Yeni Pencerede Aç, PDF / Excel / CSV Çıktı Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {channels && channels.length > 0 && onSelectChannel && (
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-secondary)',
                padding: '3px',
                borderRadius: '9px',
                border: '1px solid var(--border-color)',
                gap: '4px'
              }}
            >
              {channels.map(ch => {
                const active = selectedChannel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onSelectChannel(ch.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 11px',
                      borderRadius: '7px',
                      border: 'none',
                      background: active ? '#2563eb' : 'transparent',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    <Tv size={13} />
                    <span>{ch.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!isStandaloneWindow && (
            <button
              type="button"
              onClick={handleOpenInSeparateWindow}
              title="Raporları bağımsız ayrı bir pencerede aç"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '9px',
                border: '1px solid rgba(37, 99, 235, 0.35)',
                background: 'rgba(37, 99, 235, 0.08)',
                color: '#2563eb',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              <ExternalLink size={14} />
              <span>Ayrı Pencerede Aç</span>
            </button>
          )}

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
              padding: '8px 14px',
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
              padding: '8px 14px',
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

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={isStandaloneWindow ? 'Pencereyi Kapat' : 'Kapat'}
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
          )}
        </div>
      </div>

      {/* 2. TARİH ARALIĞI VE PROGRAM BAZLI FİLTRELEME ŞERİDİ */}
      <div
        style={{
          padding: '12px 24px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Sol: Dönem Kapsamı & Tarih Aralığı Seçici */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Calendar size={14} color="#2563eb" />
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
            <button
              type="button"
              onClick={() => {
                setDataScope('all_data');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: dataScope === 'all_data' && !startDateFilter && !endDateFilter ? '#2563eb' : 'transparent',
                color: dataScope === 'all_data' && !startDateFilter && !endDateFilter ? '#fff' : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Tüm Kayıtlı Dönemler
            </button>
            <button
              type="button"
              onClick={() => {
                setDataScope('active_week');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                background: dataScope === 'active_week' && !startDateFilter && !endDateFilter ? '#2563eb' : 'transparent',
                color: dataScope === 'active_week' && !startDateFilter && !endDateFilter ? '#fff' : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Seçili Hafta
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={startDateFilter}
              onChange={e => setStartDateFilter(e.target.value)}
              title="Başlangıç Tarihi"
              style={{
                padding: '5px 9px',
                borderRadius: '8px',
                border: startDateFilter ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
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
                border: endDateFilter ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 700
              }}
            />
          </div>

          {/* Gün Filtresi */}
          <select
            value={selectedDayNameFilter}
            onChange={e => setSelectedDayNameFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: selectedDayNameFilter !== 'all' ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
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

        {/* Sağ: Program Bazlı Filtreleme, Kategori Seçimi ve Arama */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Filter size={13} color="#2563eb" />
            <span>Program Filtresi:</span>
          </div>

          {/* Program Bazlı Seçim Dropdown */}
          <select
            value={selectedProgramFilter}
            onChange={e => {
              setSelectedProgramFilter(e.target.value);
              if (e.target.value !== 'all') {
                setActiveTab('programs');
              }
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: selectedProgramFilter !== 'all' ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
              background: selectedProgramFilter !== 'all' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 800,
              maxWidth: '250px'
            }}
          >
            <option value="all">Tüm Programlar ({reportData.programsList.length} Program)</option>
            {reportData.programsList.map(p => (
              <option key={p.key} value={p.key}>
                {p.title} ({p.count} Kez • {p.hoursFormatted})
              </option>
            ))}
          </select>

          {/* Kategori Seçimi */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: selectedCategory !== 'all' ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 700
            }}
          >
            <option value="all">Tüm Kategoriler ({reportData.categories.length})</option>
            {reportData.categories.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count} Kuşak)
              </option>
            ))}
          </select>

          {/* Hızlı Arama */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: searchQuery ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
              background: 'var(--bg-primary)'
            }}
          >
            <Search size={13} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Program, kategori veya gün ara..."
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 600,
                width: '185px'
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
            selectedCategory !== 'all' ||
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
              <span>Filtreyi Sıfırla</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. 5 ÖZET KPI KARTI */}
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
            {reportData.activeDayCount} Aktif Gün • Doluluk: <strong>%{reportData.weeklyFillPct}</strong>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700 }}>PROGRAM &amp; KUŞAK SAYISI</div>
          <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '3px' }}>
            {filteredPrograms.length} Program / {reportData.totalPrograms} Kuşak
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            <strong>{reportData.categories.length}</strong> Kategori • <strong>{reportData.totalActiveWeeks}</strong> Hafta
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

      {/* 4. ALT SEKMELER */}
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
            { id: 'programs', label: `1. Program Bazlı (Günlük / Haftalık / Aylık / Yıllık) Rapor (${filteredPrograms.length})` },
            { id: 'periods', label: '2. Haftalık / Aylık / Yıllık Dönem Tablosu' },
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
      </div>

      {/* 5. İÇERİK GÖVDESİ */}
      <div style={{ padding: '18px 24px', overflowY: isStandaloneWindow ? 'visible' : 'auto', flex: 1 }}>
        {/* SEKME 1: PROGRAM BAZLI GÜNLÜK / HAFTALIK / AYLIK / YILLIK DETAYLI YAYIN TABLOSU */}
        {activeTab === 'programs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Seçili Tekil Program Varsa veya Satırdan "Detay" Açılmışsa Program Karnesi */}
            {focusedProgram && (
              <div
                style={{
                  border: '2px solid #2563eb',
                  borderRadius: '14px',
                  background: 'var(--bg-primary)',
                  padding: '16px 20px',
                  boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
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
                        SEÇİLİ PROGRAM KARNESİ
                      </span>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {focusedProgram.title}
                      </h3>
                      <span
                        style={{
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                          fontSize: '11.5px',
                          fontWeight: 700
                        }}
                      >
                        {focusedProgram.category}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <strong>{focusedProgram.activeDateSpanLabel}</strong> tarihleri arasında toplam{' '}
                      <strong>{focusedProgram.activeDaysCount} aktif günde ({focusedProgram.progActiveWeeks} haftada)</strong>{' '}
                      <strong>{focusedProgram.count} defa</strong> yayınlandı (Toplam süre: <strong>{focusedProgram.hoursFormatted}</strong> • Tek yayın ort. süresi: <strong>{focusedProgram.singleBroadcastFormatted}</strong>).
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      style={{
                        padding: '6px 12px',
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
                      <FileText size={13} /> Bu Programın PDF Sunumu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProgramFilter('all');
                        setExpandedProgramKey(null);
                      }}
                      style={{
                        padding: '6px 11px',
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
                </div>

                {/* 4 Kutu: Günde Ne Kadar / Haftada Ne Kadar / Ayda Ne Kadar (Kayıtlı) / Yılda Ne Kadar (Kayıtlı) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb' }}>1. GÜNDE NE KADAR (GERÇEK VERİ)</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {focusedProgram.dailyCountLabel}
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                      Günlük Süre: {focusedProgram.dailyAvgHoursFormatted} / gün
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      Tek Yayın Süresi: {focusedProgram.singleBroadcastFormatted} • {focusedProgram.activeDaysCount} aktif yayın günü
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(8, 145, 178, 0.3)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0891b2' }}>2. HAFTADA NE KADAR (PZT–PAZ GERÇEK)</div>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {focusedProgram.weeklyCountLabel}
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                      Haftalık Süre: {focusedProgram.weeklyHoursFormatted} / hafta
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {focusedProgram.weeksBreakdownText}
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(5, 150, 105, 0.3)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>3. AYDA NE KADAR (KAYITLI AYLIK VERİ)</div>
                    {focusedProgram.monthsList.map(m => (
                      <div key={m.key} style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {m.label}: {m.count} Defa
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#059669' }}>
                          Toplam Süre: {m.hoursFormatted} ({m.daysCount} gün kayıtlı)
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid rgba(217, 119, 6, 0.35)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>4. YILDA NE KADAR (KAYITLI YILLIK VERİ)</div>
                    {focusedProgram.yearsList.map(y => (
                      <div key={y.key} style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {y.label}: {y.count} Defa
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#d97706' }}>
                          Toplam Süre: {y.hoursFormatted} ({y.daysCount} gün / {focusedProgram.progActiveWeeks} hafta kayıtlı)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seçili Programın Gün Gün ve Saat Saat Yayın Dökümü */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    📅 &ldquo;{focusedProgram.title}&rdquo; — Gün Gün &amp; Saat Saat Yayınlanma Listesi ({focusedProgram.detailedDates.length} Gün)
                  </div>
                  <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', background: 'var(--bg-primary)' }}>
                          <th style={{ padding: '8px 12px' }}>Tarih</th>
                          <th style={{ padding: '8px 12px' }}>Gün</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>O Gün Kaç Defa</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>O Gün Toplam Süre</th>
                          <th style={{ padding: '8px 12px' }}>Yayınlandığı Saat Kuşakları &amp; Bölüm Bilgisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {focusedProgram.detailedDates.map(d => (
                          <tr key={d.dateKey} style={{ borderTop: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '7px 12px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{d.dateKey}</td>
                            <td style={{ padding: '7px 12px', fontWeight: 700 }}>{d.dayName}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 800, color: '#2563eb' }}>{d.count} Defa</td>
                            <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 800, color: '#059669' }}>
                              {formatSecondsToHoursMin(d.seconds)}
                            </td>
                            <td style={{ padding: '7px 12px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {d.slots.map((s, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: '5px',
                                      background: 'rgba(37, 99, 235, 0.1)',
                                      color: '#2563eb',
                                      fontWeight: 700,
                                      fontSize: '11px'
                                    }}
                                  >
                                    {s.startTime} - {s.endTime}
                                    {s.episode ? ` • Bölüm ${s.episode}` : ''} ({formatSecondsToHoursMin(s.seconds)})
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ANA PROGRAM BAZLI TABLO */}
            {filteredPrograms.length === 0 ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '14px',
                  background: 'var(--bg-primary)'
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Seçili Tarih Aralığında veya Filtrede Program Bulunamadı
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  Aktif haftada henüz program yoksa <strong>&ldquo;Tüm Kayıtlı Dönemler&rdquo;</strong> butonuna tıklayabilir veya tarih aralığı filtresini sıfırlayabilirsiniz.
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Tüm Kayıtlı Dönemleri Göster
                </button>
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflowX: 'auto', background: 'var(--bg-primary)' }}>
                <table style={{ width: '100%', minWidth: '1120px', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '11px 12px', width: '21%' }}>Program Adı &amp; Kategori</th>
                      <th style={{ padding: '11px 10px', textAlign: 'center', width: '14%' }}>
                        Kayıtlı Toplam Yayın
                        <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Ne Kadar Sürede Kaç Defa)</div>
                      </th>
                      <th style={{ padding: '11px 10px', textAlign: 'center', width: '12%', background: 'rgba(37, 99, 235, 0.06)', color: '#1d4ed8' }}>
                        Günde Ne Kadar
                        <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Günlük Gerçek Veri)</div>
                      </th>
                      <th style={{ padding: '11px 10px', textAlign: 'center', width: '13%', background: 'rgba(8, 145, 178, 0.06)', color: '#0e7490' }}>
                        Haftada Ne Kadar
                        <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Pzt–Paz Gerçek Haftalık)</div>
                      </th>
                      <th style={{ padding: '11px 10px', textAlign: 'center', width: '13%', background: 'rgba(5, 150, 105, 0.06)', color: '#047857' }}>
                        Ayda Ne Kadar
                        <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Kayıtlı Aylık Gerçek Veri)</div>
                      </th>
                      <th style={{ padding: '11px 10px', textAlign: 'center', width: '13%', background: 'rgba(217, 119, 6, 0.06)', color: '#b45309' }}>
                        Yılda Ne Kadar
                        <div style={{ fontSize: '10px', fontWeight: 600, opacity: 0.85 }}>(Kayıtlı Yıllık Gerçek Veri)</div>
                      </th>
                      <th style={{ padding: '11px 12px', width: '14%' }}>Hangi Günler Yayınlandı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrograms.map(p => {
                      const isFocused = focusedProgram?.key === p.key;
                      return (
                        <tr
                          key={p.key}
                          onClick={() => setExpandedProgramKey(prev => (prev === p.key ? null : p.key))}
                          style={{
                            borderTop: '1px solid var(--border-color)',
                            background: isFocused ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                        >
                          {/* 1. Program Adı & Kategori */}
                          <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px' }}>{p.title}</span>
                              {p.isLive && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    background: 'rgba(225,29,72,0.14)',
                                    color: '#e11d48',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 800
                                  }}
                                >
                                  CANLI
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  background: 'var(--bg-tertiary)',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                {p.category}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                • Tek yayın: {p.singleBroadcastFormatted}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#2563eb', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Eye size={11} /> {isFocused ? 'Detay Açık' : 'Detay'}
                              </span>
                            </div>
                          </td>

                          {/* 2. Kayıtlı Toplam Yayın (Ne Kadar Sürede Kaç Defa Girmiş) */}
                          <td style={{ padding: '11px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '13.5px' }}>{p.count} Defa</div>
                            <div style={{ fontWeight: 800, color: '#059669', fontSize: '12px', marginTop: '2px' }}>{p.hoursFormatted}</div>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                              {p.activeDaysCount} Günde ({p.progActiveWeeks} Hafta)
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {p.activeDateSpanLabel}
                            </div>
                          </td>

                          {/* 3. Günde Ne Kadar (Gerçek Günlük Veri) */}
                          <td style={{ padding: '11px 10px', textAlign: 'center', verticalAlign: 'middle', background: 'rgba(37, 99, 235, 0.03)' }}>
                            <div style={{ fontWeight: 900, color: '#2563eb', fontSize: '13px' }}>
                              {p.dailyCountLabel}
                            </div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '11.5px', marginTop: '2px' }}>
                              {p.dailyAvgHoursFormatted} / gün
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              (Bölüm: {p.singleBroadcastFormatted})
                            </div>
                          </td>

                          {/* 4. Haftada Ne Kadar (Pazartesi-Pazar Gerçek Haftalık Veri) */}
                          <td style={{ padding: '11px 10px', textAlign: 'center', verticalAlign: 'middle', background: 'rgba(8, 145, 178, 0.03)' }}>
                            <div style={{ fontWeight: 900, color: '#0891b2', fontSize: '13px' }}>
                              {p.weeklyCountLabel}
                            </div>
                            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '11.5px', marginTop: '2px' }}>
                              {p.weeklyHoursFormatted} / hafta
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.35 }}>
                              {p.weeksList.map(w => (
                                <div key={w.key}>
                                  {w.label}: <strong>{w.count} kez</strong>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* 5. Ayda Ne Kadar (Sadece Kayıtlı Aylık Gerçek Veri) */}
                          <td style={{ padding: '11px 10px', textAlign: 'center', verticalAlign: 'middle', background: 'rgba(5, 150, 105, 0.03)' }}>
                            {p.monthsList.map(m => (
                              <div key={m.key} style={{ marginBottom: p.monthsList.length > 1 ? '4px' : '0px' }}>
                                <div style={{ fontWeight: 900, color: '#059669', fontSize: '12.5px' }}>
                                  {m.label}: {m.count} Defa
                                </div>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '11.5px', marginTop: '1px' }}>
                                  {m.hoursFormatted}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  ({m.daysCount} gün kayıtlı)
                                </div>
                              </div>
                            ))}
                          </td>

                          {/* 6. Yılda Ne Kadar (Sadece Kayıtlı Yıllık Gerçek Veri) */}
                          <td style={{ padding: '11px 10px', textAlign: 'center', verticalAlign: 'middle', background: 'rgba(217, 119, 6, 0.03)' }}>
                            {p.yearsList.map(y => (
                              <div key={y.key} style={{ marginBottom: p.yearsList.length > 1 ? '4px' : '0px' }}>
                                <div style={{ fontWeight: 900, color: '#d97706', fontSize: '12.5px' }}>
                                  {y.label}: {y.count} Defa
                                </div>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '11.5px', marginTop: '1px' }}>
                                  {y.hoursFormatted}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  ({y.daysCount} gün / {p.progActiveWeeks} hafta kayıtlı)
                                </div>
                              </div>
                            ))}
                          </td>

                          {/* 7. Hangi Gün Kaç Defa & Kaç Saat */}
                          <td style={{ padding: '11px 12px', verticalAlign: 'middle' }}>
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SEKME 2: HAFTALIK / AYLIK / YILLIK YAYINLANMA DETAYLARI */}
        {activeTab === 'periods' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              {/* Haftalık Tablo */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                  📅 Haftalık Yayınlanma Özeti
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Hafta</th>
                      <th style={{ padding: '8px 10px' }}>Farklı Program</th>
                      <th style={{ padding: '8px 10px' }}>Kuşak</th>
                      <th style={{ padding: '8px 10px' }}>Toplam Saat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.weeklyPeriods.map(w => (
                      <tr key={w.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{w.label} ({w.daysCount} gün)</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{w.uniquePrograms.size} Program</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>{w.programsCount} Kez</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>{formatSecondsToHoursMin(w.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Aylık Tablo */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                  🗓️ Aylık Yayınlanma Özeti
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Ay</th>
                      <th style={{ padding: '8px 10px' }}>Farklı Program</th>
                      <th style={{ padding: '8px 10px' }}>Kuşak</th>
                      <th style={{ padding: '8px 10px' }}>Toplam Saat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthlyPeriods.map(m => (
                      <tr key={m.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.label} ({m.daysCount} gün)</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{m.uniquePrograms.size} Program</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>{m.programsCount} Kez</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#059669' }}>{formatSecondsToHoursMin(m.seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Yıllık Tablo */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
                <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', fontWeight: 800, fontSize: '12.5px' }}>
                  📊 Yıllık Yayınlanma Özeti
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Yıl</th>
                      <th style={{ padding: '8px 10px' }}>Farklı Program</th>
                      <th style={{ padding: '8px 10px' }}>Kuşak</th>
                      <th style={{ padding: '8px 10px' }}>Toplam Saat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.yearlyPeriods.map(y => (
                      <tr key={y.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{y.label} ({y.daysCount} gün)</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{y.uniquePrograms.size} Program</td>
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
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
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

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
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
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-primary)' }}>
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
  );

  if (isStandaloneWindow) {
    return innerContent;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)'
      }}
      onClick={onClose}
    >
      {innerContent}
    </div>
  );
};

export default DraftReportsModal;
