/**
 * @file DraftAddScheduleModal.jsx
 * @description Kütüphaneden sürükle-bırak yapıldığında veya "Ekle" tıklandığında açılan
 * akıllı kuşak planlama ve bölüm dağıtım modalı.
 * 
 * Sorulan Sorular / Özellikler:
 * 1. Bölüm Seçimi: Manuel numara girişi veya API'den çekilen bölümler listesinden açılır seçim
 * 2. Kuşak Saati ve Süresi: Başlangıç saati (bırakılan slot varsayılan), süre (15/30/45/60/90/120 dk) ve bitiş aralığı
 * 3. Kaç Gün?: Seçili gün, Haftaiçi (Pzt-Cum), Haftasonu (Cmt-Paz), Tüm Hafta (7 Gün)
 * 4. Bölüm İlerlemesi?: Birden fazla gün seçildiğinde (örn: haftaiçi), bölüm numaralarının gün gün +1 artarak ilerlemesi seçeneği ve canlı önizleme
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  Calendar,
  Layers,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Radio,
  Film,
  Edit3
} from 'lucide-react';
import { CATEGORY_COLORS, TIME_SLOTS, DURATION_PRESETS } from './library/constants';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import { computeEpisodeSummariesForProgram } from '../../broadcast/utils/draftSlotMatcher';

const DAY_LABELS = {
  0: 'Pazar',
  1: 'Pazartesi',
  2: 'Salı',
  3: 'Çarşamba',
  4: 'Perşembe',
  5: 'Cuma',
  6: 'Cumartesi'
};

const SHORT_DAY_LABELS = {
  0: 'Paz',
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cmt'
};

const DOLGU_DEFAULT = {
  id: 'prog_dolgu_default',
  title: 'Dolgu Kuşağı',
  category: 'Dolgu Kuşağı',
  categoryName: 'Dolgu Kuşağı',
  categoryColor: '#06b6d4',
  isKisaSlot: true,
  duration: 30,
  availableOptions: ['Kısa Program', 'Kaside', 'Aşr-ı Şerif'],
  selectedOptions: ['Kısa Program', 'Kaside', 'Aşr-ı Şerif']
};

const CUSTOM_LIVE_DEFAULT = {
  id: 'prog_custom_live',
  title: 'Canlı Yayın Özel',
  customTitle: '',
  isCustomProgram: true,
  isLive: true,
  category: 'Canlı Yayın',
  categoryName: 'Canlı Yayın',
  categoryColor: '#e11d48',
  categoryBadge: 'Canlı',
  isKisaSlot: false,
  duration: 60,
  selectedOptions: ['Canlı']
};

const DraftAddScheduleModal = ({
  isOpen = false,
  onClose,
  data = null, // { program, dateKey, slotMinute, progIndex }
  scheduleData = {},
  allDaysKeys = [],
  activeDaysKeys = [],
  onConfirmAdd
}) => {
  if (!isOpen || !data) return null;

  const [selectedProgram, setSelectedProgram] = useState(() => data?.program || DOLGU_DEFAULT);
  const [availableProgramsList, setAvailableProgramsList] = useState([]);
  const [isProgSelectOpen, setIsProgSelectOpen] = useState(false);
  const [progSearch, setProgSearch] = useState('');

  // Canlı Yayın & Liste Dışı Özel Program Durumları
  const [isLive, setIsLive] = useState(() => Boolean(data?.program?.isLive));
  const [customTitleInput, setCustomTitleInput] = useState(() => data?.program?.customTitle || '');
  const [hostInput, setHostInput] = useState(() => data?.program?.host || '');
  const [topicInput, setTopicInput] = useState(() => data?.program?.topic || '');

  // API'den kullanılan programları çek (Program seçici için)
  useEffect(() => {
    let isMounted = true;
    const fetchPrograms = async () => {
      try {
        const res = await fetch('/api/archive/used-programs');
        if (res.ok) {
          const resData = await res.json();
          if (isMounted && resData.programs) {
            setAvailableProgramsList(resData.programs);
          }
        }
      } catch (e) {
        console.error('Kullanılan programlar çekilemedi:', e);
      }
    };
    fetchPrograms();
    return () => { isMounted = false; };
  }, []);

  // Modal verisi değiştiğinde seçili programı senkronize et
  useEffect(() => {
    if (data?.program) {
      setSelectedProgram(data.program);
      const defaultLive = Boolean(
        data.program.isLive ||
        (Array.isArray(data.program.selectedOptions) && data.program.selectedOptions.includes('Canlı')) ||
        /\bcanl[ıi]\b/i.test(`${data.program.title || ''}`)
      );
      setIsLive(defaultLive);
      setCustomTitleInput(
        data.program.customTitle !== undefined
          ? data.program.customTitle
          : (data.program.isCustomProgram && data.program.title !== 'Canlı Yayın Özel' && data.program.title !== 'Özel Program'
              ? data.program.title
              : '')
      );
      setHostInput(data.program.host || '');
      setTopicInput(data.program.topic || '');
    } else if (data && !data.program) {
      setSelectedProgram(DOLGU_DEFAULT);
      setIsLive(false);
      setCustomTitleInput('');
      setHostInput('');
      setTopicInput('');
    }
  }, [data]);

  const prog = selectedProgram || DOLGU_DEFAULT;
  const isDolgu = prog.title === 'Dolgu Kuşağı' || prog.category === 'Dolgu Kuşağı' || prog.isKisaSlot;
  const isCustomProgram = Boolean(prog.isCustomProgram || prog.id === 'prog_custom_live');
  const effectiveTitle = isCustomProgram
    ? (customTitleInput.trim() || (isLive ? 'Canlı Yayın Özel' : 'Özel Program'))
    : (prog.title || prog.name || 'Program');
  const catName = isDolgu
    ? 'Dolgu Kuşağı'
    : isCustomProgram
    ? (isLive ? 'Canlı Yayın' : 'Özel Yayın')
    : (prog.category || prog.categoryName || 'Genel');
  const catColor = isDolgu
    ? '#06b6d4'
    : isLive
    ? '#e11d48'
    : (CATEGORY_COLORS[catName] || prog.categoryColor || '#3b82f6');

  // 1. Durumlar (Form State)
  const [episodeInput, setEpisodeInput] = useState(prog.episode ? String(prog.episode) : '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [clipsList, setClipsList] = useState([]);
  const [isLoadingClips, setIsLoadingClips] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);

  // Başlangıç saati formatı (Örn: 600 -> "10:00")
  const initialStartTime = useMemo(() => {
    if (typeof data?.slotMinute === 'number') {
      const h = String(Math.floor(data.slotMinute / 60)).padStart(2, '0');
      const m = String(data.slotMinute % 60).padStart(2, '0');
      return `${h}:${m}`;
    }
    return '10:00';
  }, [data?.slotMinute]);

  const [startTime, setStartTime] = useState(initialStartTime);
  const [isManualTimeOverride, setIsManualTimeOverride] = useState(false);
  const [duration, setDuration] = useState(Number(prog.duration) || (isDolgu ? 30 : 60));

  // Modal her açıldığında veya program değiştiğinde formu senkronize et
  useEffect(() => {
    if (data) {
      if (typeof data.slotMinute === 'number') {
        const h = String(Math.floor(data.slotMinute / 60)).padStart(2, '0');
        const m = String(data.slotMinute % 60).padStart(2, '0');
        setStartTime(`${h}:${m}`);
        setIsManualTimeOverride(false);
      }
      setDuration(Number(prog.duration) || (isDolgu ? 30 : 60));
      setEpisodeInput(prog.episode ? String(prog.episode) : '');
      if (prog.selectedOptions) {
        setDolguOptions(prog.selectedOptions);
      }
    }
  }, [data, prog, isDolgu]);

  // Dolgu seçenekleri
  const [dolguOptions, setDolguOptions] = useState(
    prog.selectedOptions || ['Kısa Program', 'Kaside', 'Aşr-ı Şerif']
  );

  // Gün Seçimi (Scope)
  // 'selected' | 'weekdays' | 'weekend' | 'allWeek' | 'custom'
  const [targetScope, setTargetScope] = useState('selected');
  const [customSelectedDays, setCustomSelectedDays] = useState([]);

  // Bölüm İlerlemesi (Birden fazla gün seçildiğinde)
  const [incrementEpisode, setIncrementEpisode] = useState(true);

  // Klipleri API'den çek (Eğer Dolgu veya Liste Dışı Özel Program değilse ve program ID varsa)
  useEffect(() => {
    if (isDolgu || isCustomProgram || !prog.id || prog.id === 'prog_dolgu_default' || prog.id === 'prog_custom_live') {
      setClipsList([]);
      setSelectedClip(null);
      return;
    }

    let isMounted = true;
    const fetchClips = async () => {
      setIsLoadingClips(true);
      try {
        const res = await fetch(`/api/archive/program/${prog.id}/clips`);
        if (res.ok) {
          const resData = await res.json();
          if (isMounted && resData.clips) {
            // Bölüm ve Part bazlı en son eklenenleri seçerek toplam süreleri hesapla
            const { episodes, latestEpisode } = computeEpisodeSummariesForProgram(
              resData.clips,
              prog.title || prog.name || ''
            );

            setClipsList(episodes);

            const explicitEp = prog.episode ? String(prog.episode).trim() : '';
            const targetSummary = explicitEp
              ? episodes.find(e => String(e.episodeNo) === explicitEp) || latestEpisode
              : latestEpisode;

            if (targetSummary) {
              setSelectedClip(targetSummary);
              setEpisodeInput(String(targetSummary.episodeNo));
              if (!isLive && targetSummary.durationMin > 0) {
                setDuration(targetSummary.durationMin);
              }
            }
          }
        }
      } catch (err) {
        console.error('Klipler çekilemedi:', err);
      } finally {
        if (isMounted) setIsLoadingClips(false);
      }
    };

    fetchClips();
    return () => { isMounted = false; };
  }, [prog.id, prog.title, prog.name, prog.episode, isDolgu, isCustomProgram]);

  // Gün hesaplamaları
  const availableDays = allDaysKeys.length > 0 ? allDaysKeys : activeDaysKeys;
  const [chosenDay, setChosenDay] = useState(data.dateKey || availableDays[0]);

  // Belirli bir günün mevcut son programının bitiş dakikasını döndürür
  const getNextSlotMinuteForDay = (dayKey) => {
    const dayProgs = scheduleData?.[dayKey]?.programs || [];
    if (dayProgs.length === 0) return 0;
    const lastProg = dayProgs[dayProgs.length - 1];
    if (typeof lastProg.endMinute === 'number') {
      return lastProg.endMinute < 1440 ? lastProg.endMinute : 0;
    }
    if (lastProg.endTime) {
      const [eh, em] = lastProg.endTime.split(':').map(Number);
      const min = (eh || 0) * 60 + (em || 0);
      return min < 1440 ? min : 0;
    }
    return 0;
  };

  // data.dateKey değiştiğinde chosenDay'i güncelle
  useEffect(() => {
    if (data?.dateKey) {
      setChosenDay(data.dateKey);
    }
  }, [data?.dateKey]);

  // Kullanıcı modal içinde farklı bir hedef gün seçtiğinde (manuel saat girmediyse) o günün sıradaki saatini getir
  useEffect(() => {
    if (!chosenDay || isManualTimeOverride) return;
    if (chosenDay === data?.dateKey && typeof data?.slotMinute === 'number') {
      const h = String(Math.floor(data.slotMinute / 60)).padStart(2, '0');
      const m = String(data.slotMinute % 60).padStart(2, '0');
      setStartTime(`${h}:${m}`);
      return;
    }
    const nextMin = getNextSlotMinuteForDay(chosenDay);
    const h = String(Math.floor(nextMin / 60)).padStart(2, '0');
    const m = String(nextMin % 60).padStart(2, '0');
    setStartTime(`${h}:${m}`);
  }, [chosenDay, isManualTimeOverride, data?.dateKey, data?.slotMinute]);

  const getDayInfo = (dateKey) => {
    try {
      const parts = dateKey.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const dayIdx = d.getDay();
        return {
          dayName: DAY_LABELS[dayIdx] || 'Gün',
          shortName: SHORT_DAY_LABELS[dayIdx] || 'Gün',
          dateFormatted: `${parts[2]}.${parts[1]}`
        };
      }
    } catch (e) {}
    return { dayName: 'Gün', shortName: 'Gün', dateFormatted: dateKey };
  };

  const targetDaysList = useMemo(() => {
    if (targetScope === 'selected') {
      return [chosenDay || availableDays[0]];
    }
    if (targetScope === 'weekdays') {
      return availableDays.slice(0, 5); // Pzt - Cuma
    }
    if (targetScope === 'weekend') {
      return availableDays.slice(5, 7); // Cmt - Paz
    }
    if (targetScope === 'allWeek') {
      return availableDays; // 7 Gün
    }
    if (targetScope === 'custom') {
      return customSelectedDays.length > 0 ? customSelectedDays : [chosenDay || availableDays[0]];
    }
    return [chosenDay || availableDays[0]];
  }, [targetScope, chosenDay, availableDays, customSelectedDays]);

  // Gün Seçim Haplarına Tıklandığında
  const handleToggleDay = (dayKey) => {
    if (targetScope === 'selected') {
      setChosenDay(dayKey);
    } else {
      setTargetScope('custom');
      setCustomSelectedDays(prev => {
        const currentList = targetDaysList;
        if (currentList.includes(dayKey)) {
          const next = currentList.filter(d => d !== dayKey);
          return next.length > 0 ? next : [dayKey];
        } else {
          return [...currentList, dayKey].sort((a, b) => availableDays.indexOf(a) - availableDays.indexOf(b));
        }
      });
    }
  };

  // Bitiş saatini hesapla (Örn: 10:00 + 60 dk = 11:00)
  const endTimeStr = useMemo(() => {
    if (!startTime || typeof startTime !== 'string' || !startTime.includes(':')) return '11:00';
    const [h, m] = startTime.split(':').map(Number);
    const validDur = Number(duration) && !isNaN(Number(duration)) ? Number(duration) : 60;
    const totalMinutes = (((h || 0) * 60) + (m || 0) + validDur) % 1440;
    const endH = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const endM = String(totalMinutes % 60).padStart(2, '0');
    return `${endH}:${endM}`;
  }, [startTime, duration]);

  // Bölüm İlerlemesi Önizlemesi
  const episodePreviewList = useMemo(() => {
    const baseEp = parseInt(episodeInput, 10);
    const isValidNumber = !isNaN(baseEp);

    return targetDaysList.map((dayKey, idx) => {
      const info = getDayInfo(dayKey);
      let calculatedEp = episodeInput;
      if (isValidNumber && incrementEpisode && targetDaysList.length > 1) {
        calculatedEp = String(baseEp + idx);
      }
      return {
        dayKey,
        dayName: info.dayName,
        dateFormatted: info.dateFormatted,
        episode: calculatedEp
      };
    });
  }, [targetDaysList, episodeInput, incrementEpisode]);

  // Onaylama Eylemi
  const handleConfirm = () => {
    const [startH, startM] = startTime.split(':').map(Number);
    const manualTargetMinute = (startH * 60) + startM;
    const isInitialEndOfDay =
      data?.dateKey &&
      typeof data?.slotMinute === 'number' &&
      data.slotMinute === getNextSlotMinuteForDay(data.dateKey);

    // Gün gün program verilerini hazırla (Bölüm artışı, Canlı/Bant durumu ve her bölümün part toplam süresi dikkate alınarak)
    const configs = episodePreviewList.map(item => {
      const useArchiveClip = !isDolgu && !isCustomProgram && !isLive;
      const epSummary = useArchiveClip
        ? (clipsList.find(c => String(c.episodeNo) === String(item.episode)) || selectedClip)
        : null;
      const note = topicInput.trim() || epSummary?.note || selectedClip?.note || '';
      const manualDurMin = Math.max(1, parseInt(duration, 10) || 30);
      const epDurationMin = useArchiveClip && epSummary?.durationMin ? epSummary.durationMin : manualDurMin;

      // Eğer kullanıcı saati elle değiştirmediyse ve gün sonuna ekleme yapılıyorsa her gün kendi sıradaki saatine eklensin
      const resolvedDayTargetMinute =
        !isManualTimeOverride && isInitialEndOfDay && item.dayKey !== data?.dateKey
          ? getNextSlotMinuteForDay(item.dayKey)
          : manualTargetMinute;

      const resolvedTopic = isDolgu
        ? `Kullanılabilir: ${dolguOptions.join(', ')}`
        : (note || (item.episode ? `${item.episode}. Bölüm` : ''));

      return {
        dateKey: item.dayKey,
        targetSlotMinute: resolvedDayTargetMinute,
        targetProgIndex: item.dayKey === data?.dateKey ? data?.progIndex : null,
        programData: {
          programId: !isCustomProgram && typeof prog.id === 'number' ? prog.id : (prog.programId || null),
          title: effectiveTitle,
          episode: isDolgu ? '' : item.episode,
          duration: isDolgu || isLive || isCustomProgram ? manualDurMin : epDurationMin,
          episodeTotalSec: useArchiveClip && epSummary?.totalSec ? epSummary.totalSec : undefined,
          episodeDurationFormatted: useArchiveClip && epSummary?.durationFormatted ? epSummary.durationFormatted : undefined,
          partsCount: useArchiveClip && epSummary?.partsCount ? epSummary.partsCount : undefined,
          matchedClipNames: useArchiveClip && epSummary?.clips ? epSummary.clips.map(c => c.name || c.fileName || '') : undefined,
          category: catName,
          categoryColor: catColor,
          categoryBadge: isLive ? 'Canlı' : catName,
          host: hostInput.trim() || prog.host || '',
          topic: resolvedTopic,
          isKisaSlot: isDolgu,
          isLive: !isDolgu && Boolean(isLive),
          isCustomProgram: Boolean(isCustomProgram),
          availableOptions: isDolgu ? ['Kısa Program', 'Kaside', 'Aşr-ı Şerif'] : undefined,
          selectedOptions: isDolgu ? dolguOptions : (isLive ? ['Canlı'] : ['Bant'])
        }
      };
    });

    onConfirmAdd && onConfirmAdd(configs);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out'
        }}
      >
        {/* 1. MODAL BAŞLIĞI */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${catColor}18 0%, transparent 100%)`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '32px',
              borderRadius: '5px',
              background: catColor
            }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {effectiveTitle}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: catColor,
                  background: `${catColor}20`,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {catName}
                </span>
                {!isDolgu && isLive && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 900,
                    color: '#ffffff',
                    background: '#e11d48',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.3px',
                    boxShadow: '0 2px 6px rgba(225, 29, 72, 0.35)'
                  }}>
                    ● CANLI YAYIN
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {isDolgu
                  ? 'Hızlı Dolgu & Kısa Kuşak Yapılandırması'
                  : isCustomProgram
                  ? 'Liste Dışı / Özel Canlı veya Bant Program Yapılandırması'
                  : 'Yayın Akışına Ekleme & Bölüm Dağıtım Ayarları'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. MODAL İÇERİĞİ / SORULAR FORMU */}
        <div style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          maxHeight: 'calc(85vh - 130px)',
          overflowY: 'auto'
        }}>
          {/* PROGRAM SEÇİMİ (Açılır Seçim veya Değiştirme) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--bg-primary)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="var(--accent-primary)" />
                <span>Planlanacak Program:</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProgram(CUSTOM_LIVE_DEFAULT);
                    setIsLive(true);
                    setIsProgSelectOpen(false);
                  }}
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isCustomProgram ? '#ffffff' : '#e11d48',
                    background: isCustomProgram ? '#e11d48' : 'rgba(225, 29, 72, 0.1)',
                    border: '1px solid rgba(225, 29, 72, 0.35)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Programlar listesinde olmayan özel bir program (Örn: Mevlid, Kandil Özel) ekle"
                >
                  <Radio size={12} />
                  <span>Özel / Canlı Program Yaz</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsProgSelectOpen(prev => !prev)}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{isProgSelectOpen ? 'Listeyi Kapat' : 'Farklı Program Seç'}</span>
                  <ChevronDown size={13} style={{ transform: isProgSelectOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
              </div>
            </div>

            {/* Seçili Program Rozeti / Kartı */}
            <div
              onClick={() => setIsProgSelectOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1.5px solid ${catColor}50`,
                background: `linear-gradient(135deg, ${catColor}15 0%, transparent 100%)`,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '24px', borderRadius: '4px', background: catColor }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {effectiveTitle}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {isCustomProgram ? 'Liste Dışı / Özel Program' : (prog.categoryName || catName)}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} color="var(--text-muted)" />
            </div>

            {/* Liste Dışı Özel Program seçiliyse Program İsmi Giriş Alanı */}
            {isCustomProgram && (
              <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#be123c', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Edit3 size={13} />
                  <span>Program İsmi Girin (Örn: Mevlid Kandili Özel, Cuma Vaazı vb.):</span>
                </label>
                <input
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="Program ismini yazın (Örn: Mevlid Özel)..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid rgba(225, 29, 72, 0.45)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 800,
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Açılır Program Listesi Menüsü */}
            {isProgSelectOpen && (
              <div style={{
                position: 'relative',
                marginTop: '6px',
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Arama Inputu */}
                <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 2 }}>
                  <input
                    type="text"
                    value={progSearch}
                    onChange={(e) => setProgSearch(e.target.value)}
                    placeholder="Program ara..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                    autoFocus
                  />
                </div>

                {/* Hızlı Liste Dışı Özel / Canlı Program Seçeneği */}
                <div
                  onClick={() => {
                    setSelectedProgram(CUSTOM_LIVE_DEFAULT);
                    setIsLive(true);
                    setIsProgSelectOpen(false);
                    setProgSearch('');
                  }}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-color)',
                    background: isCustomProgram ? 'rgba(225, 29, 72, 0.14)' : 'transparent',
                    transition: 'background 0.12s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Radio size={14} color="#e11d48" />
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#be123c' }}>
                      Özel / Liste Dışı Canlı Program (Örn: Mevlid)
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(225, 29, 72, 0.18)', color: '#be123c', fontWeight: 800 }}>
                    ● Canlı / Özel
                  </span>
                </div>

                {/* Hızlı Dolgu Kuşağı Seçeneği */}
                <div
                  onClick={() => {
                    setSelectedProgram(DOLGU_DEFAULT);
                    setIsLive(false);
                    setIsProgSelectOpen(false);
                    setProgSearch('');
                  }}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-color)',
                    background: isDolgu ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                    transition: 'background 0.12s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#06b6d4" />
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0891b2' }}>Dolgu Kuşağı</span>
                  </div>
                  <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.2)', color: '#0891b2', fontWeight: 700 }}>
                    Kısa Kuşak
                  </span>
                </div>

                {/* API Programları (Öncelik Algoritması: Başlayan -> Kelime Başlangıcı -> İçeren) */}
                {filterAndSortBySearchPriority(
                  availableProgramsList,
                  progSearch,
                  (p) => p.title || p.name || '',
                  (p) => [p.categoryName, p.host]
                ).map(p => {
                    const pCat = p.categoryName || 'Genel';
                    const pColor = CATEGORY_COLORS[pCat] || '#3b82f6';
                    const isCurrent = prog.id === p.id;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          const autoLive = Boolean(/\bcanl[ıi]\b/i.test(p.title || p.name || ''));
                          setSelectedProgram({
                            id: p.id,
                            title: p.title || p.name || 'Program',
                            episode: '',
                            duration: p.categoryId === 10 ? 30 : 60,
                            category: pCat,
                            categoryColor: pColor,
                            categoryBadge: pCat,
                            host: p.host || '',
                            topic: '',
                            isKisaSlot: p.categoryId === 10,
                            isCustomProgram: false,
                            isLive: autoLive,
                            totalEpisodes: p.totalEpisodes,
                            totalClips: p.totalClips
                          });
                          setIsLive(autoLive);
                          setCustomTitleInput('');
                          setHostInput(p.host || '');
                          setIsProgSelectOpen(false);
                          setProgSearch('');
                        }}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background: isCurrent ? `${pColor}20` : 'transparent',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.12s'
                        }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {p.totalEpisodes ? `${p.totalEpisodes} Bölüm` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: `${pColor}20`, color: pColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {pCat}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* YAYIN TÜRÜ: CANLI MI / BANT MI? (Dolgu değilse her programda görünür) */}
          {!isDolgu && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              background: isLive ? 'rgba(225, 29, 72, 0.05)' : 'var(--bg-primary)',
              padding: '12px 14px',
              borderRadius: '12px',
              border: isLive ? '1.5px solid rgba(225, 29, 72, 0.35)' : '1px solid var(--border-color)',
              transition: 'all 0.15s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Radio size={15} color={isLive ? '#e11d48' : 'var(--accent-primary)'} />
                  <span>Yayın Türü (Canlı mı / Bant mı?):</span>
                </label>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIsLive(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: !isLive ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: !isLive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: !isLive ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🎬 Bant Yayın</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLive(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: isLive ? '1.5px solid #e11d48' : '1px solid rgba(225, 29, 72, 0.35)',
                      background: isLive ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'rgba(225, 29, 72, 0.08)',
                      color: isLive ? '#ffffff' : '#be123c',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: isLive ? '0 3px 10px rgba(225, 29, 72, 0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>● Canlı Yayın</span>
                  </button>
                </div>
              </div>

              {/* Canlı veya Özel Programda Opsiyonel Sunucu / Konu Bilgisi */}
              {(isLive || isCustomProgram) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginTop: '2px'
                }}>
                  <input
                    type="text"
                    value={hostInput}
                    onChange={(e) => setHostInput(e.target.value)}
                    placeholder="Sunucu / Konuk (İsteğe bağlı)"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  />
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    placeholder="Konu / Açıklama (İsteğe bağlı)"
                    style={{
                      padding: '7px 10px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* SORU 1: BÖLÜM SEÇİMİ (Dolgu değilse) */}
          {!isDolgu && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'var(--bg-primary)',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={15} color="var(--accent-primary)" />
                  <span>
                    {isCustomProgram || isLive
                      ? 'Bölüm Numarası (Canlı / Özel Programda İsteğe Bağlı):'
                      : 'Bölüm Numarası (En Son Eklenen Otomatik Seçilir):'}
                  </span>
                </label>
                {selectedClip && selectedClip.totalSec > 0 && !isLive && !isCustomProgram && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#059669',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {selectedClip.partsCount > 1
                      ? `${selectedClip.partsCount} Part Toplamı: ${selectedClip.durationFormatted} (~${selectedClip.durationMin} dk)`
                      : `Bölüm Süresi: ${selectedClip.durationFormatted} (~${selectedClip.durationMin} dk)`}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <input
                  type="text"
                  value={episodeInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEpisodeInput(val);
                    const matched = clipsList.find(c => String(c.episodeNo) === val.trim());
                    if (matched) {
                      setSelectedClip(matched);
                      if (matched.durationMin > 0 && !isLive && !isCustomProgram) setDuration(matched.durationMin);
                    }
                  }}
                  placeholder={isCustomProgram || isLive ? 'Bölüm No (Boş bırakılabilir veya Örn: 1)' : 'Bölüm No (Örn: 61)'}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 700
                  }}
                />

                {/* Açılır Bölüm Listesi Butonu */}
                {!isCustomProgram && (
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: isDropdownOpen ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                      color: isDropdownOpen ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <span>{isLoadingClips ? 'Yükleniyor...' : 'Bölüm Listesi'}</span>
                    <ChevronDown size={14} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>
                )}
              </div>

              {/* Açılır Bölüm Listesi Menüsü */}
              {isDropdownOpen && !isCustomProgram && (
                <div style={{
                  marginTop: '6px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                  gap: '5px',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.1)'
                }}>
                  {clipsList.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', padding: '10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Kayıtlı klip/bölüm bulunamadı (Manuel numara girebilirsiniz).
                    </div>
                  ) : (
                    clipsList.map((ep, epIdx) => {
                      const isCurr = String(ep.episodeNo) === String(episodeInput);
                      return (
                        <button
                          key={ep.episodeNo}
                          type="button"
                          onClick={() => {
                            setEpisodeInput(String(ep.episodeNo));
                            setSelectedClip(ep);
                            if (ep.durationMin > 0 && !isLive) setDuration(ep.durationMin);
                            setIsDropdownOpen(false);
                          }}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: isCurr ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            background: isCurr ? 'var(--accent-primary)' : 'var(--bg-primary)',
                            color: isCurr ? '#ffffff' : 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: isCurr ? 800 : 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          <span>
                            Bölüm {ep.episodeNo}
                            {epIdx === 0 ? ' (En Yeni)' : ''}
                          </span>
                          <span style={{ fontSize: '9.5px', opacity: isCurr ? 0.95 : 0.75, fontWeight: 600 }}>
                            {ep.partsCount > 1 ? `${ep.partsCount} Part • ` : ''}{ep.durationFormatted}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* SORU 2: KUŞAK SAATİ VE OTOMATİK SÜRE */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: 'var(--bg-primary)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} color="var(--accent-primary)" />
                <span>
                  {isDolgu
                    ? 'Dolgu Kuşağı Saati & Süresi:'
                    : isLive || isCustomProgram
                    ? 'Canlı / Özel Program Saati & Süresi:'
                    : 'Kuşak Yerleşim Saati & Otomatik Süre:'}
                </span>
              </label>

              {!isDolgu && !isLive && !isCustomProgram && selectedClip && selectedClip.totalSec > 0 && (
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  color: '#059669',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckCircle2 size={11} />
                  <span>Süre Arşivden Otomatik Alındı</span>
                </span>
              )}
            </div>

            {/* 3'lü Bilgi Özeti: Başlangıç Saati | Otomatik Süre | Hesaplanan Kuşak Aralığı */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '8px',
              alignItems: 'stretch'
            }}>
              {/* 1. Başlangıç Saati (Tam Dakika Gösteren & Düzenlenebilir Saat Girişi) */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '9px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '3px'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Başlangıç Saati
                </span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    if (e.target.value) {
                      setStartTime(e.target.value);
                      setIsManualTimeOverride(true);
                    }
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    padding: 0,
                    outline: 'none',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                />
              </div>

              {/* 2. Otomatik Bölüm Süresi veya Manuel Süre Girişi */}
              <div style={{
                background: !isDolgu && !isLive && !isCustomProgram && selectedClip?.totalSec > 0
                  ? 'rgba(16, 185, 129, 0.08)'
                  : isLive
                  ? 'rgba(225, 29, 72, 0.07)'
                  : 'var(--bg-secondary)',
                border: !isDolgu && !isLive && !isCustomProgram && selectedClip?.totalSec > 0
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : isLive
                  ? '1px solid rgba(225, 29, 72, 0.35)'
                  : '1px solid var(--border-color)',
                borderRadius: '9px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {isDolgu ? 'Dolgu Süresi' : isLive || isCustomProgram ? 'Program Süresi (dk)' : 'Bölüm Toplam Süresi'}
                </span>
                {isDolgu || isLive || isCustomProgram || (!isLoadingClips && (!selectedClip || !selectedClip.totalSec)) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={duration}
                      onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '62px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: isLive ? '#e11d48' : 'var(--text-primary)',
                        fontSize: '14px',
                        fontWeight: 800,
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Dakika</span>
                  </div>
                ) : (
                  <>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#059669',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {isLoadingClips
                        ? 'Hesaplanıyor...'
                        : selectedClip?.durationFormatted || `${duration} Dakika`}
                    </div>
                    {selectedClip?.totalSec > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        {selectedClip.partsCount > 1 ? `${selectedClip.partsCount} Part • ` : ''}~{duration} dk
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* 3. Yerleşeceği Kuşak Saat Aralığı */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.09)',
                border: '1px solid rgba(59, 130, 246, 0.28)',
                borderRadius: '9px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                  Yerleşeceği Saat
                </span>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  <span>{startTime}</span>
                  <ArrowRight size={12} />
                  <span>{endTimeStr}</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Sonraki kuşak: {endTimeStr}
                </span>
              </div>
            </div>

            {/* Dolgu Kuşağı, Canlı Yayın, Özel Program veya arşivde klip yoksa hızlı süre butonları göster */}
            {(isDolgu || isLive || isCustomProgram || (!isLoadingClips && (!selectedClip || !selectedClip.totalSec))) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginRight: '2px', fontWeight: 600 }}>
                  {isDolgu ? 'Dolgu Süresi Seçin:' : isLive || isCustomProgram ? 'Hızlı Süre Seç:' : 'Manuel Süre:'}
                </span>
                {[15, 30, 45, 60, 90, 120, 180].map(pMin => {
                  const isSelected = Number(duration) === pMin;
                  return (
                    <button
                      key={pMin}
                      type="button"
                      onClick={() => setDuration(pMin)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '7px',
                        border: isSelected
                          ? (isLive ? '1.5px solid #e11d48' : '1.5px solid var(--accent-primary)')
                          : '1px solid var(--border-color)',
                        background: isSelected
                          ? (isLive ? '#e11d48' : 'var(--accent-primary)')
                          : 'var(--bg-secondary)',
                        color: isSelected ? '#ffffff' : 'var(--text-primary)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {pMin} dk
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SORU 3: GÜN SEÇİMİ (Hangi Günlere Eklensin?) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            background: 'var(--bg-primary)',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} color="var(--accent-primary)" />
                <span>Gün Seçimi (Hangi Günlere Eklensin?):</span>
              </label>

              {/* Tek Gün Seçiminde Açılır Gün Dropdown'ı */}
              {targetScope === 'selected' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hedef Gün:</span>
                  <select
                    value={chosenDay}
                    onChange={(e) => setChosenDay(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {availableDays.map(dKey => {
                      const info = getDayInfo(dKey);
                      return (
                        <option key={dKey} value={dKey}>
                          {info.dayName} ({info.dateFormatted})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* Hızlı Kapsam Seçenekleri */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { id: 'selected', label: 'Tek Gün', sub: getDayInfo(chosenDay).dayName },
                { id: 'weekdays', label: 'Haftaiçi', sub: '5 Gün' },
                { id: 'weekend', label: 'Haftasonu', sub: '2 Gün' },
                { id: 'allWeek', label: 'Tüm Hafta', sub: '7 Gün' }
              ].map(item => {
                const isActive = targetScope === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTargetScope(item.id);
                      if (item.id === 'weekdays') setCustomSelectedDays(availableDays.slice(0, 5));
                      else if (item.id === 'weekend') setCustomSelectedDays(availableDays.slice(5, 7));
                      else if (item.id === 'allWeek') setCustomSelectedDays(availableDays);
                    }}
                    style={{
                      padding: '8px 6px',
                      borderRadius: '8px',
                      border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-secondary)',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>{item.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.85 }}>{item.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* İnteraktif 7 Günlük Seçim Butonları (Tıklanabilir Gün Hapları) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {targetScope === 'selected'
                  ? 'Hedef günü değiştirmek için aşağıdaki günlerden birini seçin:'
                  : 'Günleri tek tek eklemek veya çıkarmak için tıklayın:'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {availableDays.map(dayKey => {
                  const info = getDayInfo(dayKey);
                  const isDayInList = targetDaysList.includes(dayKey);

                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => handleToggleDay(dayKey)}
                      title={`${info.dayName} (${info.dateFormatted})`}
                      style={{
                        padding: '6px 2px',
                        borderRadius: '6px',
                        border: isDayInList ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        background: isDayInList ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                        color: isDayInList ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 800 }}>{info.shortName}</span>
                      <span style={{ fontSize: '9px', opacity: isDayInList ? 0.95 : 0.7 }}>{info.dateFormatted}</span>
                      {isDayInList && <span style={{ fontSize: '8px', lineHeight: 1 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SORU 4: BÖLÜM İLERLESİN Mİ? (Birden fazla gün seçildiğinde açılır) */}
          {!isDolgu && targetDaysList.length > 1 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.25)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={16} color="#d97706" />
                  <span>Bölüm Numarası İlerlesin mi?</span>
                </label>
              </div>

              {/* Seçenek Butonları */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIncrementEpisode(true)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: incrementEpisode ? '2px solid #d97706' : '1px solid var(--border-color)',
                    background: incrementEpisode ? '#fffbeb' : 'var(--bg-secondary)',
                    color: incrementEpisode ? '#b45309' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 size={14} color={incrementEpisode ? '#d97706' : 'transparent'} />
                  <span>Evet, Gün Gün +1 Artsın</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIncrementEpisode(false)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: !incrementEpisode ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: !incrementEpisode ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-secondary)',
                    color: !incrementEpisode ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 size={14} color={!incrementEpisode ? 'var(--accent-primary)' : 'transparent'} />
                  <span>Hayır, Aynı Bölüm Tekrar Etsin</span>
                </button>
              </div>

              {/* Canlı Gün Dağılımı Önizlemesi */}
              <div style={{
                marginTop: '4px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '8px 10px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflowX: 'auto'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  Önizleme:
                </span>
                {episodePreviewList.map((item, idx) => (
                  <div
                    key={item.dayKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'var(--bg-primary)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.dayName}:</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>
                      Bölüm {item.episode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. MODAL ALT BUTONLARI */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <span>✓ {targetDaysList.length} Güne Akışa Ekle</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraftAddScheduleModal);
