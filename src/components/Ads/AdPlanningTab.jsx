/**
 * @file src/components/Ads/AdPlanningTab.jsx
 * @description TailAdmin v2 — Günlük Reklam Kuşak & Yayın Akışı Yönetimi Ana Koordinatör Bileşeni.
 *
 * Yenilenen Operasyonel Tasarım:
 * - **Günlük Tarih Gösterimi:** Haftalık görünüm yerine doğrudan Günlük Tarih Seçici (Önceki Gün / Tarih / Sonraki Gün / Bugün).
 * - **Belirgin Kanal & Liste Seçimi:** Hangi kanalın (`Semerkand HD` / `Semerkand WAY`), hangi günün ve hangi listenin
 *   (`Liste A` / `Liste B`) düzenlendiği hem üst kontrol barında hem de aktif çalışma şeridinde net olarak gösterilir.
 * - **Gelen Yayın Listeleri & Revize Takibi:** Sol panelde revize gelen (`revised`), bekleyen (`pending`) ve
 *   onaylanan (`completed`) listeler tek tıkla erişilebilir şekilde sıralanır.
 * - **Sade 3 Sütunlu Ekran:** Solda Gelen/Revize Listeler, Ortada Seçili Günün Kuşakları, Sağda Seçili Kuşağa Hızlı Reklam Ekleme Havuzu.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Eye } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useBroadcastStore from '../../modules/broadcast/store/broadcastStore';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { dialog } from '../../store/dialogStore';

import {
  PRIORITY_BADGES,
  formatTcClock,
  formatSecToReadable,
  getMondayStr
} from './planning/adPlanningConstants';

import {
  AdPlanningTopControlBar,
  AdPlanningDaysSidebar
} from './planning/AdPlanningTopControlBar';

import AdPlanningDaySummaryCard from './planning/AdPlanningDaySummaryCard';

import {
  AdBreaksListView,
  AdQuickSpotPoolPanel,
  AdBroadcastFlowView,
  AdHourlyMatrixView,
  AdManualSpotModal
} from './planning/AdPlanningWorkspaceViews';
import { isRamadanFeatureWindowOpen, filterAndSortPrefixFirst } from './reservation/reservationConstants';
import AdMaterialDetailModal from './AdMaterialDetailModal';
import { resolveAdBreakBumpersForPrecedingProgram } from '../../store/slices/ads/adsPlacementEngine';

export { PRIORITY_BADGES, formatTcClock, formatSecToReadable, getMondayStr };

const AdPlanningTab = () => {
  const {
    days,
    channels,
    timeBlocks = [],
    reservations = [],
    companies = [],
    products = [],
    materials = [],
    adPlacements = {},
    adBreakBumperRules = [],
    libraryPrograms = [],
    ramadanConfig = { enabled: true, startDate: '', endDate: '', leadDays: 14, forceShow: false },
    setRamadanConfig,
    setBreakRamadanTag,
    ensureAdsBroadcastWeek,
    switchAdsDayListVariant,
    autoPlanAdsForDay,
    addManualAdToBreak,
    removeAdFromBreak,
    moveAdInBreak,
    reorderAdInBreak,
    clearAdBreak,
    completeAds,
    resetAds
  } = usePlanningStore();

  const updateBroadcastProgram = useBroadcastStore(state => state.updateProgram);

  const saveDaySchedule = useBroadcastStore(state => state.saveDaySchedule);
  const broadcastDays = useBroadcastStore(state => state.days || {});

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const [selectedChannel, setSelectedChannel] = useState('ch_hd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeListCode, setActiveListCode] = useState('A'); // 'A' | 'B'
  const [workspaceView, setWorkspaceView] = useState('breaks'); // 'breaks' | 'flow' | 'matrix'

  const [activeBreakTimeForManual, setActiveBreakTimeForManual] = useState(null);
  const [selectedAdTarget, setSelectedAdTarget] = useState(null); // { breakTime, adIndex, adTitle } | null
  const [insertPositionMode, setInsertPositionMode] = useState('below'); // 'above' | 'below' | 'end'
  const [manualSourceTab, setManualSourceTab] = useState('reservations'); // 'reservations' | 'catalog'
  const [manualSearch, setManualSearch] = useState('');
  const [manualCompanyFilter, setManualCompanyFilter] = useState('');
  const [quickModalBreak, setQuickModalBreak] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);

  const handlePreviewMaterial = (matOrId) => {
    if (!matOrId) return;
    if (typeof matOrId === 'object') {
      const targetId = matOrId.materialId || matOrId.id || matOrId.clipId;
      const found = materials.find(
        m => String(m.id) === String(targetId) || String(m.clipId) === String(targetId)
      );
      setPreviewMaterial(found ? { ...found, ...matOrId } : matOrId);
      return;
    }
    const found = materials.find(m => String(m.id) === String(matOrId) || String(m.clipId) === String(matOrId));
    if (found) setPreviewMaterial(found);
  };

  const selectedDayKey = `ready-${selectedChannel}-${selectedDate}`;

  // Seçili günün bulunduğu haftayı hazırla ve eğer Yayın Planlama (broadcastStore) içinde kayıtlı liste varsa senkronize et
  useEffect(() => {
    const mondayStr = getMondayStr(selectedDate);
    if (typeof ensureAdsBroadcastWeek === 'function') {
      ensureAdsBroadcastWeek(selectedChannel, mondayStr);
    }

    // Eğer ready gününde seçili varyant boşsa fakat broadcastStore içinde o günün programı varsa otomatik çek
    const readyDay = usePlanningStore.getState().days?.[selectedDayKey];
    const targetVarKey = activeListCode === 'B' ? 'v2' : 'v1';
    const existingProgs = readyDay?.variants?.[targetVarKey]?.programs || [];
    const bKey = `${selectedChannel}-${selectedDate}`;
    const bProgs = broadcastDays?.[bKey]?.variants?.[activeListCode]?.programs || [];

    if (existingProgs.length === 0 && bProgs.length > 0 && typeof saveDaySchedule === 'function') {
      saveDaySchedule(selectedChannel, selectedDate, activeListCode);
    }
  }, [selectedChannel, selectedDate, activeListCode, selectedDayKey, ensureAdsBroadcastWeek, broadcastDays, saveDaySchedule]);

  // Kanal seçimi
  const handleChannelSelect = (newChannelId) => {
    setSelectedChannel(newChannelId);
    const mondayStr = getMondayStr(selectedDate);
    if (typeof ensureAdsBroadcastWeek === 'function') {
      ensureAdsBroadcastWeek(newChannelId, mondayStr);
    }
    if (typeof switchAdsDayListVariant === 'function') {
      switchAdsDayListVariant(newChannelId, selectedDate, activeListCode);
    }
  };

  // Günlük tarih seçimi
  const handleSelectDate = (newDateStr) => {
    if (!newDateStr) return;
    setSelectedDate(newDateStr);
    const mondayStr = getMondayStr(newDateStr);
    if (typeof ensureAdsBroadcastWeek === 'function') {
      ensureAdsBroadcastWeek(selectedChannel, mondayStr);
    }
    if (typeof switchAdsDayListVariant === 'function') {
      switchAdsDayListVariant(selectedChannel, newDateStr, activeListCode);
    }
  };

  // Liste (A / B) seçimi
  const handleSelectListCode = (newListCode) => {
    const code = newListCode === 'B' ? 'B' : 'A';
    setActiveListCode(code);
    if (typeof switchAdsDayListVariant === 'function') {
      switchAdsDayListVariant(selectedChannel, selectedDate, code);
    }
    const bKey = `${selectedChannel}-${selectedDate}`;
    const bProgs = broadcastDays?.[bKey]?.variants?.[code]?.programs || [];
    if (bProgs.length > 0 && typeof saveDaySchedule === 'function') {
      saveDaySchedule(selectedChannel, selectedDate, code);
    }
  };

  // Sol panelden veya üst açılır menüden doğrudan Kanal + Gün + Liste seçimi
  const handleSelectFullListEntry = (channelId, dateStr, listCode = 'A') => {
    const code = listCode === 'B' ? 'B' : 'A';
    setSelectedChannel(channelId);
    setSelectedDate(dateStr);
    setActiveListCode(code);
    const mondayStr = getMondayStr(dateStr);
    if (typeof ensureAdsBroadcastWeek === 'function') {
      ensureAdsBroadcastWeek(channelId, mondayStr);
    }
    if (typeof switchAdsDayListVariant === 'function') {
      switchAdsDayListVariant(channelId, dateStr, code);
    }
  };

  const handleJumpToToday = () => {
    handleSelectDate(todayStr);
  };

  const handleSyncFromBroadcast = () => {
    if (typeof saveDaySchedule === 'function') {
      const res = saveDaySchedule(selectedChannel, selectedDate, activeListCode);
      const chName = channels.find(c => String(c.id) === String(selectedChannel))?.name || 'Semerkand HD';
      const formattedDay = format(parseISO(selectedDate), 'd MMMM yyyy, EEEE', { locale: tr });
      dialog.success(
        'Yayın Akışı Güncellendi',
        `${chName} — ${formattedDay} (Liste ${activeListCode}) akışı Yayın Planlama modülünden başarıyla çekildi (${res?.count || 0} yayın öğesi).`
      );
    }
  };

  // Seçili gün için Liste A ve Liste B program/kuşak sayıları
  const listCounts = useMemo(() => {
    const readyDay = days[selectedDayKey];
    const bDay = broadcastDays[`${selectedChannel}-${selectedDate}`];

    const getStatsFor = (code, varKey) => {
      const rProgs = readyDay?.variants?.[varKey]?.programs || [];
      const bProgs = bDay?.variants?.[code]?.programs || [];
      const source = rProgs.length > 0 ? rProgs : bProgs;
      const breaks = source.filter(
        p =>
          p.type === 'ad_break' ||
          String(p.id).toUpperCase() === 'TPL-3' ||
          (p.id && String(p.id).toUpperCase().startsWith('T'))
      ).length;
      return { programs: source.length, breaks };
    };

    return {
      A: getStatsFor('A', 'v1'),
      B: getStatsFor('B', 'v2')
    };
  }, [days, broadcastDays, selectedDayKey, selectedChannel, selectedDate]);

  // Tüm gelen, revize ve aktif günlük yayın listeleri (Sol panel ve üst liste seçici için)
  const allListEntries = useMemo(() => {
    const entries = [];
    const seen = new Set();

    Object.entries(days).forEach(([key, dayObj]) => {
      if (!key.startsWith('ready-') || !dayObj) return;
      const parts = key.split('-');
      const channelId = parts[1];
      const dateStr = parts.slice(2).join('-');
      if (!dateStr || dateStr.length < 10) return;

      const chName =
        channels.find(c => String(c.id) === String(channelId))?.name ||
        (channelId === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD');

      const v1Progs = dayObj?.variants?.v1?.programs || [];
      const v2Progs = dayObj?.variants?.v2?.programs || [];

      const buildEntry = (listCode, progs) => {
        const entryId = `${channelId}__${dateStr}__${listCode}`;
        if (seen.has(entryId)) return;
        seen.add(entryId);

        const breaksCount = progs.filter(
          p =>
            p.type === 'ad_break' ||
            String(p.id).toUpperCase() === 'TPL-3' ||
            (p.id && String(p.id).toUpperCase().startsWith('T'))
        ).length;

        const dayPlacements = adPlacements[key] || [];
        const spotsCount = dayPlacements.reduce((acc, b) => acc + (b.ads?.length || 0), 0);
        const filledSec = dayPlacements.reduce(
          (acc, b) => acc + (b.ads || []).reduce((s, a) => s + (Number(a.duration) || 0), 0),
          0
        );
        const totalCapSec = breaksCount * 6 * 60;
        const fillRatio = totalCapSec > 0 ? Math.min(100, Math.round((filledSec / totalCapSec) * 100)) : 0;

        const isRevised =
          dayObj.adsStatus === 'revised' ||
          (Boolean(dayObj.isRevised) &&
            dayObj.adsStatus !== 'completed' &&
            dayObj.adsStatus !== 'planned' &&
            spotsCount === 0);
        const adsStatus = isRevised
          ? 'revised'
          : dayObj.adsStatus === 'completed'
          ? 'completed'
          : spotsCount > 0
          ? 'planned'
          : (dayObj.adsStatus || 'pending');

        let statusBadgeText = '⏳ Bekliyor';
        if (isRevised) statusBadgeText = '🔄 REVİZE';
        else if (adsStatus === 'completed') statusBadgeText = '✓ Onaylandı';
        else if (spotsCount > 0) statusBadgeText = '🔵 Planlandı';

        let formattedDate = dateStr;
        try {
          formattedDate = format(parseISO(dateStr), 'd MMM yyyy, EEE', { locale: tr });
        } catch (e) {
          formattedDate = dateStr;
        }

        const sentAtFormatted = dayObj.sentToAdsAt
          ? new Date(dayObj.sentToAdsAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : null;

        entries.push({
          id: entryId,
          dayKey: key,
          channelId,
          channelName: chName,
          date: dateStr,
          formattedDate,
          listCode,
          programsCount: progs.length,
          breaksCount,
          spotsCount,
          filledSec,
          fillRatio,
          adsStatus,
          isRevised,
          revisionCount: Number(dayObj.revisionCount) || 0,
          sentAtFormatted,
          statusBadgeText
        });
      };

      // Her zaman aktif olan veya dolu olan listeleri ekle
      const activeCode = dayObj.sourceList === 'B' || dayObj.activeVariant === 'v2' ? 'B' : 'A';
      buildEntry('A', v1Progs);
      if (v2Progs.length > 0 || activeCode === 'B') {
        buildEntry('B', v2Progs);
      }
    });

    // Sıralama: Önce Revize gelenler, sonra seçili kanalın günleri, sonra tarihe göre
    return entries.sort((a, b) => {
      if (a.isRevised && !b.isRevised) return -1;
      if (!a.isRevised && b.isRevised) return 1;
      if (a.channelId === selectedChannel && b.channelId !== selectedChannel) return -1;
      if (a.channelId !== selectedChannel && b.channelId === selectedChannel) return 1;
      return a.date.localeCompare(b.date);
    });
  }, [days, channels, adPlacements, selectedChannel]);

  const revisedListsCount = useMemo(
    () => allListEntries.filter(e => e.isRevised).length,
    [allListEntries]
  );

  const selectedDayInfo = useMemo(() => {
    const dayObj = days[selectedDayKey];
    if (!dayObj) return null;
    return {
      key: selectedDayKey,
      channelId: selectedChannel,
      date: selectedDate,
      day: dayObj
    };
  }, [selectedDayKey, selectedChannel, selectedDate, days]);

  const selectedPlacements = useMemo(
    () => (selectedDayKey ? adPlacements[selectedDayKey] || [] : []),
    [selectedDayKey, adPlacements]
  );

  // Seçili günün ve seçili listenin (A -> v1, B -> v2) programlarını ve reklam kuşaklarını hesapla
  const enrichedTimeline = useMemo(() => {
    if (!selectedDayInfo) return [];
    let currentStart = selectedDayInfo.day?.startTime || 0;
    const targetVar = activeListCode === 'B' ? 'v2' : 'v1';
    const fallbackVar = selectedDayInfo.day?.activeVariant || 'v1';
    const varProgs = selectedDayInfo.day?.variants?.[targetVar]?.programs || [];
    const rawProgs =
      varProgs.length > 0
        ? varProgs
        : selectedDayInfo.day?.variants?.[fallbackVar]?.programs || [];
    const targetDayOfWeek = new Date(selectedDayInfo.date).getDay();

    const mapped = rawProgs.map((prog, idx) => {
      const startMinute = prog.startMinute !== undefined ? prog.startMinute : currentStart;
      const durationMin = parseFloat(prog?.duration) || 0;
      const endMinute = startMinute + durationMin;
      currentStart = endMinute;

      const h = Math.floor(startMinute / 60) % 24;
      const m = Math.floor(startMinute % 60);
      const shortTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const endH = Math.floor(endMinute / 60) % 24;
      const endM = Math.floor(endMinute % 60);
      const shortEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      const exactStartClock = formatTcClock(prog.calculatedStartTime) || shortTime;
      const exactEndClock = formatTcClock(prog.calculatedEndTime) || shortEndTime;

      const titleLower = (prog.title || '').toLocaleLowerCase('tr-TR');
      const isAdBlock =
        prog.type === 'ad_break' ||
        String(prog.id).toUpperCase() === 'TPL-3' ||
        (prog.id && String(prog.id).toUpperCase().startsWith('T')) ||
        titleLower.includes('reklam kuşağı') ||
        titleLower.includes('reklam kusagi');

      const progMinOfDay = h * 60 + m;
      const matchedTb =
        timeBlocks.find(tb => {
          if (!tb.isActive) return false;
          if (Array.isArray(tb.days) && tb.days.length > 0 && !tb.days.includes(targetDayOfWeek)) return false;
          const [sh, sm] = (tb.startTime || '00:00').split(':').map(Number);
          const [eh, em] = (tb.endTime || '24:00').split(':').map(Number);
          return progMinOfDay >= sh * 60 + sm && progMinOfDay < eh * 60 + em;
        }) || { id: 'tb-2', name: 'Genel Kuşak' };

      const placementObj = isAdBlock
        ? selectedPlacements.find(
            bp => (prog.instanceId && bp.blockId === prog.instanceId) || bp.time === shortTime
          )
        : null;

      const placedAds = placementObj?.ads || [];
      const capacitySec = Math.round((durationMin || 6) * 60);
      const filledSec = placedAds.reduce((acc, ad) => acc + (Number(ad.duration) || 0), 0);
      const remainingSec = Math.max(0, capacitySec - filledSec);
      const fillPct = capacitySec > 0 ? Math.min(100, Math.round((filledSec / capacitySec) * 100)) : 0;

      const titleFull = `${prog.programTitle || ''} ${prog.title || ''} ${prog.name || ''} ${prog.clipName || ''}`;
      const ramadanProgramType = !isAdBlock
        ? (prog.ramadanProgramType || (/sahur/i.test(titleFull) ? 'sahur' : /iftar/i.test(titleFull) ? 'iftar' : ''))
        : '';
      const ramadanBreakTag = isAdBlock
        ? (prog.ramadanBreakTag || placementObj?.ramadanBreakTag || '')
        : '';

      return {
        ...prog,
        idx,
        orderNo: prog.order || idx + 1,
        title: prog.clipName || prog.title || prog.name || 'İsimsiz Program',
        startMinute,
        endMinute,
        durationMin,
        shortTime,
        shortEndTime,
        exactStartClock,
        exactEndClock,
        isAdBlock,
        ramadanProgramType,
        ramadanBreakTag,
        timeBlockId: matchedTb.id,
        timeBlockName: matchedTb.name,
        capacitySec,
        filledSec,
        remainingSec,
        fillPct,
        placedAds
      };
    });

    // Sahur ve İftar programlarının başlangıç saatine göre komşu kuşakları otomatik etiketle (eğer manuel etiketlenmemişse)
    const autoDetectBreakRamadanTag = (idx) => {
      const curr = mapped[idx];
      if (!curr.isAdBlock) return '';
      if (curr.ramadanBreakTag) return curr.ramadanBreakTag;
      const prevProg = idx > 0 && !mapped[idx - 1].isAdBlock ? mapped[idx - 1] : null;
      const nextProg = idx < mapped.length - 1 && !mapped[idx + 1].isAdBlock ? mapped[idx + 1] : null;
      if (prevProg?.ramadanProgramType && nextProg?.ramadanProgramType === prevProg.ramadanProgramType) {
        return `${prevProg.ramadanProgramType}_middle`;
      }
      if (nextProg?.ramadanProgramType) {
        return `${nextProg.ramadanProgramType}_before`;
      }
      if (prevProg?.ramadanProgramType) {
        return `${prevProg.ramadanProgramType}_after`;
      }
      return '';
    };

    // Aktif sponsorluk rezervasyonlarını program başlığına göre eşleştir
    const normProgTitle = (s = '') =>
      String(s || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/\s*-\s*bölüm\s*\d+.*$/gi, '')
        .replace(/\s*\(part\s*\d+\).*$/gi, '')
        .replace(/\s*part\s*\d+.*$/gi, '')
        .replace(/[^a-z0-9ğüşıöç]/gi, '')
        .trim();

    const sponsorRulesList = [];
    reservations.forEach(res => {
      const items =
        Array.isArray(res.items) && res.items.length > 0
          ? res.items
          : [res];
      items.forEach(it => {
        const isSp = it.isSponsor !== undefined ? Boolean(it.isSponsor) : Boolean(res.isSponsor);
        const progTitle = String(it.sponsorProgramTitle || res.sponsorProgramTitle || '').trim();
        if (!isSp || !progTitle) return;
        const normTarget = normProgTitle(progTitle);
        if (!normTarget) return;
        const mat = materials.find(m => String(m.id) === String(it.materialId || res.materialId));
        const comp = companies.find(c => String(c.id) === String(it.companyId || res.companyId || mat?.companyId));
        sponsorRulesList.push({
          reservationId: res.id,
          normTarget,
          programTitle: progTitle,
          companyName: comp?.name || mat?.companyName || 'Sponsor Firma',
          materialName: mat?.name || 'Sponsor Klip',
          materialId: mat?.id || it.materialId,
          positions: it.sponsorPositions || res.sponsorPositions || []
        });
      });
    });

    const matchProgramSponsors = (progObj) => {
      if (!progObj || progObj.isAdBlock) return [];
      const rawT = `${progObj.programTitle || ''} ${progObj.title || ''} ${progObj.name || ''}`;
      const normP = normProgTitle(rawT);
      if (!normP) return [];
      return sponsorRulesList.filter(
        sr => normP.includes(sr.normTarget) || sr.normTarget.includes(normP)
      );
    };

    const withProgramSponsors = mapped.map(item => {
      if (item.isAdBlock) return item;
      const matchedSponsors = matchProgramSponsors(item);
      const uniqueSponsorNames = Array.from(new Set(matchedSponsors.map(s => `${s.companyName} (${s.materialName})`)));
      return {
        ...item,
        isSponsoredProgram: matchedSponsors.length > 0,
        sponsorBadges: matchedSponsors,
        sponsorSummaryText: uniqueSponsorNames.join(' • ')
      };
    });

    return withProgramSponsors.map((item, idx) => {
      if (!item.isAdBlock) return item;
      let prevProg = null;
      for (let p = idx - 1; p >= 0; p--) {
        if (withProgramSponsors[p].isAdBlock) break;
        const isIntro =
          Boolean(withProgramSponsors[p].isIntroClip) ||
          withProgramSponsors[p].unitType === 'intro' ||
          /^intro|jenerik/i.test(String(withProgramSponsors[p].category || ''));
        if (!isIntro) {
          prevProg = withProgramSponsors[p];
          break;
        }
      }
      let nextProg = null;
      for (let n = idx + 1; n < withProgramSponsors.length; n++) {
        if (withProgramSponsors[n].isAdBlock) break;
        const isIntro =
          Boolean(withProgramSponsors[n].isIntroClip) ||
          withProgramSponsors[n].unitType === 'intro' ||
          /^intro|jenerik/i.test(String(withProgramSponsors[n].category || ''));
        if (!isIntro) {
          nextProg = withProgramSponsors[n];
          break;
        }
      }

      const bumperInfo = resolveAdBreakBumpersForPrecedingProgram(
        { adBreakBumperRules, libraryPrograms },
        selectedDayInfo.channelId,
        prevProg,
        nextProg
      );

      const hasSponsorAds = (item.placedAds || []).some(ad => {
        if (ad.isBumperAd) return false;
        if (ad.isSponsorSpot || ad.lockOrder) return true;
        const rObj = reservations.find(r => String(r.id) === String(ad.reservationId));
        if (!rObj) return false;
        if (rObj.isSponsor) return true;
        return Array.isArray(rObj.items) && rObj.items.some(it => String(it.materialId) === String(ad.materialId) && it.isSponsor);
      });
      return {
        ...item,
        ramadanBreakTag: autoDetectBreakRamadanTag(idx),
        prevProgramTitle: prevProg?.title || null,
        nextProgramTitle: nextProg?.title || null,
        prevProgramStartClock: prevProg?.exactStartClock || null,
        nextProgramStartClock: nextProg?.exactStartClock || null,
        prevProgramIsSponsored: Boolean(prevProg?.isSponsoredProgram),
        nextProgramIsSponsored: Boolean(nextProg?.isSponsoredProgram),
        prevProgramSponsorText: prevProg?.sponsorSummaryText || '',
        nextProgramSponsorText: nextProg?.sponsorSummaryText || '',
        prevProgramCategoryName: bumperInfo.detectedCategoryName,
        expectedIntroBumperName: bumperInfo.introBumperAd?.name || null,
        expectedOutroBumperName: bumperInfo.outroBumperAd?.name || null,
        expectedBumperTotalSec: bumperInfo.totalBumperDurationSec || 0,
        hasSponsorAds
      };
    });
  }, [selectedDayInfo, activeListCode, selectedPlacements, timeBlocks, reservations, materials, companies, adBreakBumperRules, libraryPrograms]);

  // Seçili günün yayın listesinden çekilen Sahur ve İftar program başlangıç saatleri
  const todayRamadanScheduleInfo = useMemo(() => {
    const sahurProg = enrichedTimeline.find(it => !it.isAdBlock && it.ramadanProgramType === 'sahur');
    const iftarProg = enrichedTimeline.find(it => !it.isAdBlock && it.ramadanProgramType === 'iftar');
    const ramadanBreaks = enrichedTimeline.filter(it => it.isAdBlock && Boolean(it.ramadanBreakTag));
    return {
      sahurProg,
      iftarProg,
      ramadanBreaksCount: ramadanBreaks.length
    };
  }, [enrichedTimeline]);

  const adBreaksList = useMemo(
    () => enrichedTimeline.filter(item => item.isAdBlock),
    [enrichedTimeline]
  );

  useEffect(() => {
    if (adBreaksList.length > 0) {
      const exists = adBreaksList.some(b => b.shortTime === activeBreakTimeForManual);
      if (!exists) {
        setActiveBreakTimeForManual(adBreaksList[0].shortTime);
      }
    } else {
      setActiveBreakTimeForManual(null);
    }
  }, [adBreaksList, activeBreakTimeForManual]);

  const dailyPlacedCountByMaterial = useMemo(() => {
    const map = {};
    adBreaksList.forEach(brk => {
      (brk.placedAds || []).forEach(ad => {
        const key = String(ad.materialId);
        map[key] = (map[key] || 0) + 1;
      });
    });
    return map;
  }, [adBreaksList]);

  const eligibleReservationItems = useMemo(() => {
    if (!selectedDayInfo) return [];
    const targetDateObj = new Date(selectedDayInfo.date);
    const itemsList = [];

    reservations.forEach(res => {
      const resItems =
        Array.isArray(res.items) && res.items.length > 0
          ? res.items
          : res.materialId
          ? [
              {
                id: `${res.id}-0`,
                companyId: res.companyId,
                productId: res.productId,
                materialId: res.materialId,
                startDate: res.startDate,
                endDate: res.endDate,
                plannedSpots: res.totalPlannedSpots || 20,
                dailyMinSpots: res.dailyMinSpots || 1,
                dailyMaxSpots: res.dailyMaxSpots || 4,
                channelIds: res.channelIds,
                timeBlockIds: res.timeBlockIds
              }
            ]
          : [];

      resItems.forEach((it, idx) => {
        const itemChannels =
          Array.isArray(it.channelIds) && it.channelIds.length > 0
            ? it.channelIds
            : res.channelIds || ['ch_hd'];
        if (!itemChannels.includes(selectedDayInfo.channelId)) return;

        const mat = materials.find(m => String(m.id) === String(it.materialId));
        if (!mat) return;
        const comp = companies.find(c => String(c.id) === String(it.companyId || res.companyId || mat.companyId));
        const prod = products.find(p => String(p.id) === String(it.productId || res.productId || mat.productId));

        const startStr = it.startDate || res.startDate;
        const endStr = it.endDate || res.endDate;
        let isDateActive = true;
        if (startStr && endStr) {
          const s = new Date(startStr);
          s.setHours(0, 0, 0, 0);
          const e = new Date(endStr);
          e.setHours(23, 59, 59, 999);
          isDateActive = targetDateObj >= s && targetDateObj <= e;
        }

        const todayPlaced = dailyPlacedCountByMaterial[String(mat.id)] || 0;
        const minSpots = Number(it.dailyMinSpots ?? res.dailyMinSpots ?? 1);
        const maxSpots = Number(it.dailyMaxSpots ?? res.dailyMaxSpots ?? 4);

        const itemIsSponsor = it.isSponsor !== undefined ? Boolean(it.isSponsor) : Boolean(res.isSponsor);
        const itemSponsorProg = it.sponsorProgramTitle !== undefined ? it.sponsorProgramTitle : res.sponsorProgramTitle;

        itemsList.push({
          uniqueKey: `${res.id}-${it.id || idx}`,
          reservationId: res.id,
          priority: Number(it.priority || res.priority) || 700,
          isSponsor: itemIsSponsor,
          sponsorProgramTitle: itemSponsorProg || null,
          sponsorPositions: it.sponsorPositions || res.sponsorPositions || [],
          companyId: comp?.id || mat.companyId,
          companyName: comp?.name || mat.companyName || 'Firma',
          productId: prod?.id || mat.productId,
          productName: prod?.name || mat.productName || 'Ürün',
          materialId: mat.id,
          materialName: mat.name,
          durationSec: Number(mat.duration) || 20,
          dailyMinSpots: minSpots,
          dailyMaxSpots: maxSpots,
          plannedSpots: Number(it.plannedSpots || res.totalPlannedSpots || 20),
          timeBlockIds:
            Array.isArray(it.timeBlockIds) && it.timeBlockIds.length > 0
              ? it.timeBlockIds
              : res.timeBlockIds || ['tb-1', 'tb-2', 'tb-3'],
          isDateActive,
          todayPlaced
        });
      });
    });

    return itemsList.sort((a, b) => {
      if (a.isSponsor && !b.isSponsor) return -1;
      if (!a.isSponsor && b.isSponsor) return 1;
      return b.priority - a.priority;
    });
  }, [selectedDayInfo, reservations, materials, companies, products, dailyPlacedCountByMaterial]);

  const dayKpiSummary = useMemo(() => {
    const totalBreaks = adBreaksList.length;
    const filledBreaks = adBreaksList.filter(b => b.placedAds.length > 0).length;
    const breakRatioPct = totalBreaks > 0 ? Math.round((filledBreaks / totalBreaks) * 100) : 0;
    const totalCapacitySec = adBreaksList.reduce((acc, b) => acc + b.capacitySec, 0);
    const totalFilledSec = adBreaksList.reduce((acc, b) => acc + b.filledSec, 0);
    const totalSpots = adBreaksList.reduce((acc, b) => acc + b.placedAds.length, 0);
    const avgSpotsPerBreak = totalBreaks > 0 ? (totalSpots / totalBreaks).toFixed(1) : '0.0';
    const overallFillPct =
      totalCapacitySec > 0 ? Math.min(100, Math.round((totalFilledSec / totalCapacitySec) * 100)) : 0;

    const minTargetMetCount = eligibleReservationItems.filter(
      it => it.todayPlaced >= it.dailyMinSpots
    ).length;
    const totalEligibleItems = eligibleReservationItems.length;
    const quotaPct =
      totalEligibleItems > 0 ? Math.min(100, Math.round((minTargetMetCount / totalEligibleItems) * 100)) : 100;

    return {
      totalBreaks,
      filledBreaks,
      breakRatioPct,
      totalCapacitySec,
      totalFilledSec,
      totalSpots,
      avgSpotsPerBreak,
      overallFillPct,
      minTargetMetCount,
      totalEligibleItems,
      quotaPct
    };
  }, [adBreaksList, eligibleReservationItems]);

  const filteredPoolReservations = useMemo(() => {
    const byComp = eligibleReservationItems.filter(it => {
      if (manualCompanyFilter && String(it.companyId) !== String(manualCompanyFilter)) return false;
      return true;
    });
    if (!manualSearch.trim()) return byComp;
    return filterAndSortPrefixFirst(
      byComp,
      manualSearch,
      it => it?.materialName || it?.companyName || '',
      it => `${it?.companyName || ''} ${it?.productName || ''} ${it?.sponsorProgramTitle || ''}`
    );
  }, [eligibleReservationItems, manualCompanyFilter, manualSearch]);

  const filteredPoolCatalog = useMemo(() => {
    const byComp = materials.filter(m => {
      if (manualCompanyFilter && String(m.companyId) !== String(manualCompanyFilter)) return false;
      return true;
    });
    if (!manualSearch.trim()) return byComp.slice(0, 150);
    return filterAndSortPrefixFirst(
      byComp,
      manualSearch,
      m => m?.name || m?.clipName || '',
      m => `${m?.companyName || ''} ${m?.productName || ''} ${m?.clipId || ''}`
    );
  }, [materials, manualCompanyFilter, manualSearch]);

  const handleRunAutoPlanDay = (channelId, dateStr, dayKey, showSuccessDialog = false) => {
    if (typeof switchAdsDayListVariant === 'function') {
      switchAdsDayListVariant(channelId, dateStr, activeListCode);
    }
    autoPlanAdsForDay(channelId, dateStr);
    if (showSuccessDialog) {
      const formattedDay = format(parseISO(dateStr), 'd MMMM yyyy EEEE', { locale: tr });
      const chName = channels.find(c => String(c.id) === String(channelId))?.name || 'Semerkand HD';
      dialog.success(
        'Günlük Otomatik Planlama Tamamlandı',
        `${formattedDay} (Liste ${activeListCode}) yayın akışı için tüm reklam kuşakları otomatik algoritmayla optimize edilerek yerleştirildi.\n` +
          `Seçili Kanal: ${chName}\n` +
          `Planlanan Tarih: ${formattedDay}\n` +
          `Aktif Liste: Liste ${activeListCode}\n` +
          `Dağıtım Kriteri: Sponsorluk + Öncelik + Min/Max Kota`
      );
    }
  };

  const handleQuickAddSpotToBreak = async (targetBreak, itemPayload) => {
    if (!selectedDayInfo || !targetBreak) return;

    const mat = materials.find(m => String(m.id) === String(itemPayload.materialId));
    const adDurSec = Number(itemPayload.durationSec || mat?.duration || 20);
    const resObj = reservations.find(r => String(r.id) === String(itemPayload.reservationId));

    // Aşım Kontrolleri (Spot Sayısı, Kuşak Süresi, Tarih Aralığı, Fiyat/Bütçe)
    const warnings = [];
    let spotDiff = 0;
    let budgetDiff = 0;

    if (targetBreak.filledSec + adDurSec > targetBreak.capacitySec) {
      const overSec = (targetBreak.filledSec + adDurSec) - targetBreak.capacitySec;
      warnings.push(`• Kuşak Süresi Aşımı: -${overSec} sn (${targetBreak.shortTime} kuşağı kapasitesi: ${targetBreak.capacitySec} sn)`);
    }

    if (resObj) {
      let currentPlaced = Number(resObj.realizedSpots) || 0;
      const planned = Number(resObj.totalPlannedSpots) || 20;
      const nextSpotCount = currentPlaced + 1;
      if (nextSpotCount > planned) {
        spotDiff = planned - nextSpotCount; // negatif: örn -1, -5
        warnings.push(`• Rezervasyon Spot Kotası Aşımı: ${spotDiff} Spot (Planlanan: ${planned}, Yeni Gerçekleşen: ${nextSpotCount})`);
        const unitPrice = Number(resObj.spotPrice || resObj.items?.[0]?.spotPrice || 0);
        if (unitPrice > 0) {
          budgetDiff = spotDiff * unitPrice;
          warnings.push(`• Fiyat / Bütçe Farkı: ${budgetDiff.toLocaleString('tr-TR')} ₺`);
        }
      }

      if (resObj.startDate && resObj.endDate) {
        if (selectedDayInfo.date < resObj.startDate || selectedDayInfo.date > resObj.endDate) {
          warnings.push(`• Gün / Tarih Süresi Aşımı: Seçili gün (${selectedDayInfo.date}), rezervasyon tarih aralığı (${resObj.startDate} – ${resObj.endDate}) dışında!`);
        }
      }
    }

    if (warnings.length > 0) {
      const ok = await dialog.confirm(
        '⚠️ Spot / Süre / Fiyat Aşımı Uyarısı',
        `Bu spot eklendiğinde aşağıdaki sınırlar aşılacaktır:\n\n` +
          `${warnings.join('\n')}\n\n` +
          `"Devam Et" derseniz spot kuşağa eklenecek ve eksi (-) aşım bilgisi rezervasyonda tutulacaktır. Devam edilsin mi?`,
        {
          confirmText: 'Devam Et (Aşımla Ekle)',
          cancelText: 'Vazgeç'
        }
      );
      if (!ok) return;
    }

    // Eğer kullanıcı belirli bir reklam seçtiyse (veya sürükle-bırak ile bir sıraya bıraktıysa) eklenecek sırayı belirle
    let effectiveInsertIndex = itemPayload.insertAtIndex;
    if (
      typeof effectiveInsertIndex !== 'number' &&
      selectedAdTarget &&
      selectedAdTarget.breakTime === targetBreak.shortTime &&
      insertPositionMode !== 'end'
    ) {
      effectiveInsertIndex =
        insertPositionMode === 'above'
          ? selectedAdTarget.adIndex
          : selectedAdTarget.adIndex + 1;
    }

    addManualAdToBreak(
      selectedDayInfo.channelId,
      selectedDayInfo.date,
      {
        blockId: targetBreak.instanceId,
        time: targetBreak.shortTime,
        duration: targetBreak.durationMin,
        timeBlockId: targetBreak.timeBlockId,
        timeBlockName: targetBreak.timeBlockName
      },
      {
        ...itemPayload,
        insertAtIndex: effectiveInsertIndex
      }
    );

    if (
      typeof effectiveInsertIndex === 'number' &&
      selectedAdTarget &&
      selectedAdTarget.breakTime === targetBreak.shortTime
    ) {
      if (effectiveInsertIndex <= selectedAdTarget.adIndex) {
        setSelectedAdTarget(prev =>
          prev ? { ...prev, adIndex: prev.adIndex + 1 } : null
        );
      }
    }
  };

  const handleSetBreakRamadanTag = (brk, newTag) => {
    if (!selectedDayInfo || !brk) return;
    if (typeof setBreakRamadanTag === 'function') {
      setBreakRamadanTag(
        selectedDayInfo.channelId,
        selectedDayInfo.date,
        brk.instanceId || brk.shortTime,
        newTag
      );
    }
    if (brk.instanceId && typeof updateBroadcastProgram === 'function') {
      updateBroadcastProgram(
        selectedDayInfo.channelId,
        selectedDayInfo.date,
        activeListCode,
        brk.instanceId,
        { ramadanBreakTag: newTag }
      );
    }
  };

  const selectedStudioBreak = useMemo(
    () => adBreaksList.find(b => b.shortTime === activeBreakTimeForManual) || adBreaksList[0] || null,
    [adBreaksList, activeBreakTimeForManual]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. ÜST KONTROL MERKEZİ: 1. KANAL -> 2. GÜNLÜK TARİH -> 3. LİSTE SEÇİMİ */}
      <AdPlanningTopControlBar
        channels={channels}
        selectedChannel={selectedChannel}
        onChannelSelect={handleChannelSelect}
        selectedDate={selectedDate}
        todayStr={todayStr}
        onSelectDate={handleSelectDate}
        onJumpToToday={handleJumpToToday}
        activeListCode={activeListCode}
        onSelectListCode={handleSelectListCode}
        listCounts={listCounts}
        allAvailableLists={allListEntries}
        onSelectFullListEntry={handleSelectFullListEntry}
        onSyncFromBroadcast={handleSyncFromBroadcast}
        revisedListsCount={revisedListsCount}
      />

      {/* 2. ANA ÇALIŞMA ALANI: SOL (HIZLI REKLAM / SPOT HAVUZU) + ORTA (REKLAM KUŞAKLARI / TAM YAYIN AKIŞI) + SAĞ (GELEN/REVİZE LİSTELER) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '335px minmax(0, 1fr) 285px',
          gap: '16px',
          alignItems: 'start'
        }}
      >
        {/* SOL PANEL: SEÇİLİ KUŞAĞA / SEÇİLİ REKLAMIN ÜSTÜNE-ALTINA HIZLI REKLAM & SPOT EKLEME HAVUZU */}
        <AdQuickSpotPoolPanel
          manualSourceTab={manualSourceTab}
          onChangeManualSourceTab={setManualSourceTab}
          eligibleReservationItemsCount={eligibleReservationItems.length}
          materialsCount={materials.length}
          manualSearch={manualSearch}
          onChangeManualSearch={setManualSearch}
          manualCompanyFilter={manualCompanyFilter}
          onChangeManualCompanyFilter={setManualCompanyFilter}
          companies={companies}
          materials={materials}
          adBreaksList={adBreaksList}
          selectedStudioBreak={selectedStudioBreak}
          onSelectStudioBreakTime={setActiveBreakTimeForManual}
          selectedAdTarget={selectedAdTarget}
          onSelectAdTarget={setSelectedAdTarget}
          insertPositionMode={insertPositionMode}
          onChangeInsertPositionMode={setInsertPositionMode}
          filteredPoolReservations={filteredPoolReservations}
          filteredPoolCatalog={filteredPoolCatalog}
          onQuickAddSpotToBreak={handleQuickAddSpotToBreak}
          onPreviewMaterial={handlePreviewMaterial}
        />

        {/* ORTA PANEL: ŞU ANDA GÜNCELLENEN LİSTE BİLGİ BARI & KUŞAKLAR / TAM YAYIN AKIŞI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {!selectedDayInfo ? (
            <div className="ta-card" style={{ padding: '48px', alignItems: 'center', textAlign: 'center' }}>
              <Eye size={42} color="var(--ads-text-muted)" />
              <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-text-main)', marginTop: '10px' }}>
                Planlamak veya görüntülemek için bir yayın listesi seçin.
              </div>
            </div>
          ) : (
            <>
              <AdPlanningDaySummaryCard
                selectedDayInfo={selectedDayInfo}
                todayStr={todayStr}
                channels={channels}
                activeListCode={activeListCode}
                dayKpiSummary={dayKpiSummary}
                workspaceView={workspaceView}
                onChangeWorkspaceView={setWorkspaceView}
                adBreaksCount={adBreaksList.length}
                timelineCount={enrichedTimeline.length}
                onRunAutoPlanDay={handleRunAutoPlanDay}
                onResetAds={resetAds}
                onCompleteAds={completeAds}
              />

              {/* 🌙 RAMAZAN ÖZEL KONTROL ŞERİDİ: SADECE RAMAZAN BAŞLANGICINA 2 HAFTA KALA VEYA RAMAZAN AYINDA GÖSTERİLİR */}
              {isRamadanFeatureWindowOpen(ramadanConfig, selectedDayInfo?.date || selectedDate) && (
                <div
                  className="ta-card"
                  style={{
                    padding: '12px 16px',
                    border: '1.5px solid rgba(217, 119, 6, 0.45)',
                    background: 'rgba(217, 119, 6, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #d97706, #b45309)',
                        color: '#fff',
                        fontSize: '11.5px',
                        fontWeight: '900'
                      }}
                    >
                      🌙 Ramazan Özel Planlama
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
                      <span>Ramazan Ayı Aralığı:</span>
                      <input
                        type="date"
                        value={ramadanConfig?.startDate || ''}
                        onChange={e => setRamadanConfig && setRamadanConfig({ startDate: e.target.value })}
                        className="ads-saas-input"
                        style={{ padding: '3px 7px', fontSize: '11px', height: '28px' }}
                      />
                      <span>–</span>
                      <input
                        type="date"
                        value={ramadanConfig?.endDate || ''}
                        onChange={e => setRamadanConfig && setRamadanConfig({ endDate: e.target.value })}
                        className="ads-saas-input"
                        style={{ padding: '3px 7px', fontSize: '11px', height: '28px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '7px',
                        background: todayRamadanScheduleInfo.sahurProg ? 'rgba(2, 132, 199, 0.14)' : 'var(--ads-card-subtle)',
                        color: todayRamadanScheduleInfo.sahurProg ? '#0284c7' : 'var(--ads-text-muted)',
                        border: '1px solid rgba(2, 132, 199, 0.3)',
                        fontWeight: '800'
                      }}
                    >
                      🌙 Sahur Programı Başlangıç:{' '}
                      {todayRamadanScheduleInfo.sahurProg
                        ? `${todayRamadanScheduleInfo.sahurProg.exactStartClock} (${todayRamadanScheduleInfo.sahurProg.title})`
                        : 'Kuşak üzerinden işaretleyebilirsiniz'}
                    </span>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '7px',
                        background: todayRamadanScheduleInfo.iftarProg ? 'rgba(217, 119, 6, 0.16)' : 'var(--ads-card-subtle)',
                        color: todayRamadanScheduleInfo.iftarProg ? '#d97706' : 'var(--ads-text-muted)',
                        border: '1px solid rgba(217, 119, 6, 0.35)',
                        fontWeight: '800'
                      }}
                    >
                      🕌 İftar Programı Başlangıç:{' '}
                      {todayRamadanScheduleInfo.iftarProg
                        ? `${todayRamadanScheduleInfo.iftarProg.exactStartClock} (${todayRamadanScheduleInfo.iftarProg.title})`
                        : 'Kuşak üzerinden işaretleyebilirsiniz'}
                    </span>

                    <span
                      style={{
                        padding: '4px 9px',
                        borderRadius: '7px',
                        background: 'rgba(5, 150, 105, 0.14)',
                        color: '#059669',
                        fontWeight: '800'
                      }}
                    >
                      İşaretli Ramazan Kuşağı: {todayRamadanScheduleInfo.ramadanBreaksCount} Kuşak
                    </span>
                  </div>
                </div>
              )}

              {workspaceView === 'breaks' && (
                <AdBreaksListView
                  adBreaksList={adBreaksList}
                  selectedDayInfo={selectedDayInfo}
                  selectedStudioBreak={selectedStudioBreak}
                  onSelectStudioBreakTime={setActiveBreakTimeForManual}
                  selectedAdTarget={selectedAdTarget}
                  onSelectAdTarget={setSelectedAdTarget}
                  insertPositionMode={insertPositionMode}
                  onChangeInsertPositionMode={setInsertPositionMode}
                  companies={companies}
                  products={products}
                  materials={materials}
                  reservations={reservations}
                  onClearAdBreak={clearAdBreak}
                  onOpenQuickModalBreak={setQuickModalBreak}
                  onMoveAdInBreak={moveAdInBreak}
                  onReorderAdInBreak={reorderAdInBreak}
                  onRemoveAdFromBreak={removeAdFromBreak}
                  onPreviewMaterial={handlePreviewMaterial}
                  onQuickAddSpotToBreak={handleQuickAddSpotToBreak}
                  onSetBreakRamadanTag={
                    isRamadanFeatureWindowOpen(ramadanConfig, selectedDayInfo?.date || selectedDate)
                      ? handleSetBreakRamadanTag
                      : null
                  }
                />
              )}

              {workspaceView === 'flow' && (
                <AdBroadcastFlowView
                  enrichedTimeline={enrichedTimeline}
                  materials={materials}
                  companies={companies}
                  products={products}
                  reservations={reservations}
                  selectedDayInfo={selectedDayInfo}
                  selectedStudioBreak={selectedStudioBreak}
                  onSelectStudioBreakTime={setActiveBreakTimeForManual}
                  selectedAdTarget={selectedAdTarget}
                  onSelectAdTarget={setSelectedAdTarget}
                  insertPositionMode={insertPositionMode}
                  onChangeInsertPositionMode={setInsertPositionMode}
                  onClearAdBreak={clearAdBreak}
                  onOpenQuickModalBreak={setQuickModalBreak}
                  onMoveAdInBreak={moveAdInBreak}
                  onReorderAdInBreak={reorderAdInBreak}
                  onRemoveAdFromBreak={removeAdFromBreak}
                  onPreviewMaterial={handlePreviewMaterial}
                  onQuickAddSpotToBreak={handleQuickAddSpotToBreak}
                />
              )}

              {workspaceView === 'matrix' && (
                <AdHourlyMatrixView
                  adBreaksList={adBreaksList}
                  materials={materials}
                  reservations={reservations}
                  onOpenQuickModalBreak={setQuickModalBreak}
                  onPreviewMaterial={handlePreviewMaterial}
                />
              )}
            </>
          )}
        </div>

        {/* SAĞ PANEL: YAYIN LİSTELERİ & REVİZE TAKİBİ */}
        <AdPlanningDaysSidebar
          allListEntries={allListEntries}
          todayStr={todayStr}
          selectedDayKey={selectedDayKey}
          selectedChannel={selectedChannel}
          selectedDate={selectedDate}
          activeListCode={activeListCode}
          onSelectFullListEntry={handleSelectFullListEntry}
          onRunAutoPlanDay={handleRunAutoPlanDay}
        />
      </div>

      {/* HIZLI MANUEL SPOT EKLEME MODALI */}
      <AdManualSpotModal
        quickModalBreak={quickModalBreak}
        selectedDayInfo={selectedDayInfo}
        adBreaksList={adBreaksList}
        selectedAdTarget={selectedAdTarget}
        manualSourceTab={manualSourceTab}
        onChangeManualSourceTab={setManualSourceTab}
        eligibleReservationItemsCount={eligibleReservationItems.length}
        materialsCount={materials.length}
        manualSearch={manualSearch}
        onChangeManualSearch={setManualSearch}
        filteredPoolReservations={filteredPoolReservations}
        filteredPoolCatalog={filteredPoolCatalog}
        onQuickAddSpotToBreak={handleQuickAddSpotToBreak}
        onPreviewMaterial={handlePreviewMaterial}
        onClose={() => setQuickModalBreak(null)}
      />

      {/* REKLAM DETAY, TEKNİK KÜNYE (25/30/50 FPS & KARE) VE İLERİ-GERİ SARILABİLİR VİDEO ÖNİZLEME MODALI (ⓘ) */}
      {previewMaterial && (
        <AdMaterialDetailModal
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          companies={companies}
          products={products}
          materials={materials}
          reservations={reservations}
          adPlacements={adPlacements}
          selectedDayInfo={selectedDayInfo}
        />
      )}
    </div>
  );
};

export default AdPlanningTab;
