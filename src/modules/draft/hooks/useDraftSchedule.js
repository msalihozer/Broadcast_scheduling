/**
 * @file useDraftSchedule.js
 * @description Taslak Planlama modülü veri yönetimi, kanal izolasyonu,
 * backend senkronizasyonu, undo (Ctrl+Z) geçmişi ve CRUD operasyonları hook'u.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DAYS_KEYS } from '../constants/draftConstants';
import { AVAILABLE_PRESETS, CHANNELS } from '../constants/draftPresets';
import scheduleHd from '../../../data/draft_schedule_ch_hd.json';
import scheduleWay from '../../../data/draft_schedule_ch_way.json';
import {
  format,
  parseISO,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays
} from 'date-fns';
import { tr } from 'date-fns/locale';
import { dialog } from '../../../store/dialogStore';
import { updateLiveDraftSchedule } from '../../broadcast/utils/draftDataLoader';
import { enrichDraftScheduleWithArchiveDurations } from '../../broadcast/utils/draftSlotMatcher';
import { getItemSearchRank } from '../../../utils/searchRanker';
import useBroadcastStore from '../../broadcast/store/broadcastStore';

export const useDraftSchedule = () => {
  const [selectedChannel, setSelectedChannel] = useState('ch_hd');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    try {
      const savedWeek = localStorage.getItem('draft_active_week_start');
      if (savedWeek) return savedWeek;
    } catch (e) {}
    return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  });
  const [selectedDayKey, setSelectedDayKey] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'unsaved', 'saving'
  const [toastNotification, setToastNotification] = useState(null);

  // Undo (Ctrl+Z) Geçmiş Yığını (Son 30 işlem)
  const historyStackRef = useRef([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(prev => (prev?.message === message ? null : prev));
    }, duration);
  }, []);

  // Kanal bazlı haftalık akışların yerel depolama ve kaydedilmiş sunucu verisi ile başlatılması
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

  const channels = CHANNELS;
  const currentChannel = useMemo(() => {
    return channels.find(c => c.id === selectedChannel) || channels[0];
  }, [channels, selectedChannel]);

  // Aktif haftanın 7 günlük anahtarları (Pazartesi - Pazar)
  const weekDates = useMemo(() => {
    try {
      const monday = startOfWeek(parseISO(currentWeekStart), { weekStartsOn: 1 });
      return [0, 1, 2, 3, 4, 5, 6].map(i => format(addDays(monday, i), 'yyyy-MM-dd'));
    } catch (e) {
      return DAYS_KEYS;
    }
  }, [currentWeekStart]);

  const allDaysKeys = weekDates;

  // Aktif seçili kanala ve haftaya ait 7 günlük yayın akışı görünüm verisi
  const scheduleData = useMemo(() => {
    const channelAllDays = schedulesByChannel[selectedChannel] || schedulesByChannel['ch_hd'] || {};
    const weekSlice = {};

    weekDates.forEach((dateKey) => {
      if (channelAllDays[dateKey]) {
        weekSlice[dateKey] = channelAllDays[dateKey];
      } else {
        try {
          const d = parseISO(dateKey);
          weekSlice[dateKey] = {
            date: format(d, 'd MMMM yyyy', { locale: tr }),
            dayName: format(d, 'EEEE', { locale: tr }),
            programs: []
          };
        } catch (e) {
          weekSlice[dateKey] = {
            date: dateKey,
            dayName: 'Gün',
            programs: []
          };
        }
      }
    });

    return weekSlice;
  }, [schedulesByChannel, selectedChannel, weekDates]);

  // Ortak Güvenilir Sunucu Kaydetme Yardımcısı (Doğrudan Port 3001 veya Vite /api Proxy)
  const saveScheduleToBackend = useCallback(async (channel, schedule) => {
    try {
      let res;
      try {
        res = await fetch('/api/saveDraftSchedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, schedule })
        });
      } catch (err) {
        res = await fetch('/api/saveDraftSchedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, schedule })
        });
      }
      if (res && res.ok) {
        setSaveStatus('saved');
        return true;
      }
    } catch (e) {
      console.error('Kanal akışı sunucuya kaydedilemedi:', e);
    }
    setSaveStatus('unsaved');
    return false;
  }, []);

  // Sunucudan (Backend / Veritabanı) en güncel akış verilerini çek ve senkronize et
  useEffect(() => {
    let isMounted = true;
    const fetchDraftFromBackend = async () => {
      try {
        let res;
        try {
          res = await fetch(`/api/draftSchedule?channel=${selectedChannel}`);
        } catch (e) {
          res = await fetch(`/api/draftSchedule?channel=${selectedChannel}`);
        }
        if (res && res.ok) {
          const data = await res.json();
          // Boş akış ({}) dahi olsa geçerli kabul et ve state'e yansıt
          if (data && typeof data === 'object' && isMounted) {
            const cleaned = { ...data };
            delete cleaned.all;
            setSchedulesByChannel(prev => ({
              ...prev,
              [selectedChannel]: cleaned
            }));
            updateLiveDraftSchedule(selectedChannel, cleaned);
            useBroadcastStore.getState().notifyDraftUpdated(selectedChannel);
          }
        }
      } catch (err) {
        console.warn('Backend taslak akış okuma hatası (offline/fallback modu):', err);
      }
    };

    fetchDraftFromBackend();
    return () => { isMounted = false; };
  }, [selectedChannel]);

  // Undo Snapshot Kaydetme
  const pushHistorySnapshot = useCallback((channel, schedule, description = '') => {
    if (!schedule) return;
    try {
      const cloned = JSON.parse(JSON.stringify(schedule));
      historyStackRef.current.push({
        channel,
        schedule: cloned,
        description,
        timestamp: Date.now()
      });
      if (historyStackRef.current.length > 30) {
        historyStackRef.current.shift();
      }
    } catch (e) {}
  }, []);

  // Geri Al (Ctrl + Z)
  const undo = useCallback(async () => {
    if (historyStackRef.current.length === 0) {
      showToast('Geri alınacak önceki bir işlem bulunmuyor.', 'info', 2000);
      return false;
    }
    const lastSnapshot = historyStackRef.current.pop();
    if (!lastSnapshot) return false;

    const { channel, schedule, description } = lastSnapshot;
    setSaveStatus('unsaved');

    setSchedulesByChannel(prev => ({
      ...prev,
      [channel]: schedule
    }));

    showToast(description ? `Son işlem geri alındı: ${description}` : 'Son işlem geri alındı (Undo).', 'success', 2500);
    return true;
  }, [showToast]);

  // Arşiv süreleri ile zenginleştirilmiş günlerin tekrar işlenmesini önleyen takip kümesi
  const enrichedDaysSetRef = useRef(new Set());

  // Aktif haftadaki günlerde arşiv bölüm/part toplam süresi eksik olan programlar varsa otomatik zenginleştir
  useEffect(() => {
    let isCancelled = false;
    const channelAllDays = schedulesByChannel[selectedChannel] || {};
    const daysNeedingEnrichment = {};

    weekDates.forEach(dKey => {
      const cacheKey = `${selectedChannel}_${dKey}`;
      if (enrichedDaysSetRef.current.has(cacheKey)) return;
      const dayObj = channelAllDays[dKey];
      if (!dayObj || !Array.isArray(dayObj.programs) || dayObj.programs.length === 0) return;
      const needsEnrich = dayObj.programs.some(
        p => !p.isKisaSlot && !p.isLive && !p.isCustomProgram && p.title !== 'Dolgu Kuşağı' && !p.episodeDurationFormatted
      );
      if (needsEnrich) {
        daysNeedingEnrichment[dKey] = dayObj;
        enrichedDaysSetRef.current.add(cacheKey);
      }
    });

    if (Object.keys(daysNeedingEnrichment).length === 0) return;

    enrichDraftScheduleWithArchiveDurations(daysNeedingEnrichment)
      .then(enrichedSlice => {
        if (isCancelled || !enrichedSlice) return;
        setSchedulesByChannel(prev => {
          const currentCh = prev[selectedChannel] || {};
          const merged = { ...currentCh, ...enrichedSlice };
          updateLiveDraftSchedule(selectedChannel, merged);
          setTimeout(() => {
            useBroadcastStore.getState().notifyDraftUpdated(selectedChannel);
          }, 0);
          return {
            ...prev,
            [selectedChannel]: merged
          };
        });
      })
      .catch(err => console.warn('Taslak süre zenginleştirme uyarısı:', err));

    return () => {
      isCancelled = true;
    };
  }, [schedulesByChannel, selectedChannel, weekDates]);

  // Günlük akışların dakikalarını ve sıralarını eklenen program süresine göre dinamik yeniden hesaplayan yardımcı
  const recalculateDayTimes = useCallback((programs) => {
    let currentMinCursor = 0;
    return (programs || []).map((p, idx) => {
      const durMin = Math.max(
        1,
        parseInt(p.duration, 10) ||
          (p.episodeTotalSec && p.episodeTotalSec > 0 ? Math.round(p.episodeTotalSec / 60) : 30)
      );

      if (typeof p.anchorStartMinute === 'number' && p.anchorStartMinute > currentMinCursor) {
        currentMinCursor = p.anchorStartMinute;
      }

      const startMin = currentMinCursor;
      const endMin = Math.min(1440, startMin + durMin);
      currentMinCursor = endMin;

      const sh = String(Math.floor(startMin / 60)).padStart(2, '0');
      const sm = String(startMin % 60).padStart(2, '0');

      let eh = String(Math.floor(endMin / 60)).padStart(2, '0');
      let em = String(endMin % 60).padStart(2, '0');
      if (endMin >= 1440) {
        eh = '24';
        em = '00';
      }

      return {
        ...p,
        order: idx + 1,
        startTime: `${sh}:${sm}`,
        endTime: `${eh}:${em}`,
        startMinute: startMin,
        endMinute: endMin,
        duration: durMin
      };
    });
  }, []);

  // Aktif kanala ait akışı güncelleyen fonksiyon (Otomatik kayıt almaz; değişiklikleri 'unsaved' olarak işaretler)
  const setScheduleData = useCallback((updater, actionDescription = '') => {
    setSaveStatus('unsaved');
    setSchedulesByChannel(prev => {
      const channelAllDays = prev[selectedChannel] || prev['ch_hd'] || {};
      
      // Değişiklik öncesi Undo geçmişine kaydet
      pushHistorySnapshot(selectedChannel, channelAllDays, actionDescription);

      // Mevcut haftalık görünüm dilimini updater'a ver
      const currentWeekSlice = {};
      weekDates.forEach(k => {
        currentWeekSlice[k] = channelAllDays[k] || {
          date: k,
          dayName: 'Gün',
          programs: []
        };
      });

      const updatedSlice = typeof updater === 'function' ? updater(currentWeekSlice) : updater;

      // Güncellenen günleri tüm kanal veritabanına birleştir (Merge)
      const nextChannelAllDays = {
        ...channelAllDays,
        ...updatedSlice
      };
      delete nextChannelAllDays.all;

      return {
        ...prev,
        [selectedChannel]: nextChannelAllDays
      };
    });
  }, [selectedChannel, weekDates, pushHistorySnapshot]);

  // Manuel & Klavye Kısayolu (Ctrl + S) ile Taslak Akışını Kaydetme
  const handleSaveSchedule = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const current = { ...(schedulesByChannel[selectedChannel] || schedulesByChannel['ch_hd'] || {}) };
      delete current.all;
      updateLiveDraftSchedule(selectedChannel, current);
      useBroadcastStore.getState().notifyDraftUpdated(selectedChannel);

      const ok = await saveScheduleToBackend(selectedChannel, current);
      if (ok) {
        showToast(`${currentChannel?.name || 'Kanal'} taslak yayın akışı başarıyla kaydedildi!`, 'success');
      } else {
        setSaveStatus('unsaved');
        showToast('Sunucuya bağlanılamadı. Yerel tarayıcı hafızasına kaydedildi.', 'error', 4000);
      }
    } catch (err) {
      console.error('Kaydetme hatası:', err);
      setSaveStatus('unsaved');
      showToast(`Hata: ${err.message}`, 'error', 4000);
    }
  }, [schedulesByChannel, selectedChannel, currentChannel, saveScheduleToBackend, showToast]);

  const activeDaysKeys = useMemo(() => {
    if (selectedDayKey === 'all') return allDaysKeys;
    return [selectedDayKey];
  }, [selectedDayKey, allDaysKeys]);

  // Dinamik tarih aralığı etiketi (örn: 27 Ekim - 2 Kasım 2025)
  const dateRangeLabel = useMemo(() => {
    if (!allDaysKeys || allDaysKeys.length === 0) return '27 Ekim - 2 Kasım 2025';
    const firstDay = scheduleData[allDaysKeys[0]];
    const lastDay = scheduleData[allDaysKeys[allDaysKeys.length - 1]];
    if (firstDay && lastDay && firstDay.date && lastDay.date) {
      return `${firstDay.date} - ${lastDay.date}`;
    }
    return '27 Ekim - 2 Kasım 2025';
  }, [allDaysKeys, scheduleData]);

  const availableDaysList = useMemo(() => {
    return allDaysKeys.map(k => ({
      dateKey: k,
      dayName: scheduleData[k]?.dayName || k,
      date: scheduleData[k]?.date || ''
    }));
  }, [allDaysKeys, scheduleData]);

  // Sürükle - Bırak ile Kuşakların Yerini Değiştirme
  const handleReorderPrograms = useCallback((sourceDateKey, sourceInstanceId, targetDateKey, targetIndex, dropAfter = false) => {
    setScheduleData(prev => {
      const sourceDay = prev[sourceDateKey];
      const targetDay = prev[targetDateKey];
      if (!sourceDay || !targetDay) return prev;

      const sourceProgs = [...(sourceDay.programs || [])];
      const progIndex = sourceProgs.findIndex(
        p => (p.instanceId && p.instanceId === sourceInstanceId) || (p.id && p.id === sourceInstanceId)
      );
      if (progIndex === -1) return prev;

      if (sourceDateKey === targetDateKey) {
        if (targetIndex === progIndex && !dropAfter) return prev;

        const [movedProg] = sourceProgs.splice(progIndex, 1);
        let insertAt = targetIndex;

        if (progIndex < targetIndex) {
          // Üstteki kuşağı alttaki bir kuşağın üzerine bıraktığımızda:
          // splice(progIndex, 1) sonrası hedef öğe 1 indeks yukarı kaydığı için:
          // - Alt yarıya (dropAfter) veya hemen bir altındaki öğeye bırakıldıysa targetIndex'e (yani hedefin altına) yerleşir.
          // - Daha aşağıdaki bir öğenin üst yarısına bırakıldıysa targetIndex - 1'e (hedefin üstüne) yerleşir.
          if (dropAfter || targetIndex === progIndex + 1) {
            insertAt = Math.min(sourceProgs.length, targetIndex);
          } else {
            insertAt = Math.max(0, targetIndex - 1);
          }
        } else {
          // Alttaki kuşağı üstteki bir kuşağın üzerine bıraktığımızda:
          if (dropAfter && targetIndex + 1 !== progIndex) {
            insertAt = Math.min(sourceProgs.length, targetIndex + 1);
          } else {
            insertAt = Math.max(0, targetIndex);
          }
        }

        sourceProgs.splice(insertAt, 0, movedProg);

        // Sıralama değiştiğinde sabitlenmiş saat çapalarını (anchorStartMinute) temizle ki saatler 00:00'dan itibaren yeni sırayla hesaplansın
        const cleanedDayProgs = sourceProgs.map(p => {
          const copy = { ...p };
          delete copy.anchorStartMinute;
          return copy;
        });

        return {
          ...prev,
          [sourceDateKey]: {
            ...sourceDay,
            programs: recalculateDayTimes(cleanedDayProgs)
          }
        };
      } else {
        const [movedProg] = sourceProgs.splice(progIndex, 1);
        const cleanedMoved = { ...movedProg };
        delete cleanedMoved.anchorStartMinute;

        const targetProgs = [...(targetDay.programs || [])];
        const remappedMoved = {
          ...cleanedMoved,
          id: `prog_${targetDateKey}_${Date.now()}`,
          instanceId: `inst_${targetDateKey}_${Date.now()}`
        };
        const insertAt = dropAfter
          ? Math.min(targetProgs.length, (targetIndex ?? targetProgs.length) + 1)
          : Math.min(targetProgs.length, targetIndex ?? targetProgs.length);

        targetProgs.splice(insertAt, 0, remappedMoved);

        const cleanedSourceProgs = sourceProgs.map(p => {
          const copy = { ...p };
          delete copy.anchorStartMinute;
          return copy;
        });
        const cleanedTargetProgs = targetProgs.map(p => {
          const copy = { ...p };
          delete copy.anchorStartMinute;
          return copy;
        });

        return {
          ...prev,
          [sourceDateKey]: {
            ...sourceDay,
            programs: recalculateDayTimes(cleanedSourceProgs)
          },
          [targetDateKey]: {
            ...targetDay,
            programs: recalculateDayTimes(cleanedTargetProgs)
          }
        };
      }
    }, 'Kuşak Sıralaması Değiştirildi');
  }, [setScheduleData, recalculateDayTimes]);

  // Tek Tıkla Kuşağı Bir Üste / Bir Alta Taşıma
  const handleMoveProgramOrder = useCallback((dateKey, instanceId, direction) => {
    setScheduleData(prev => {
      const day = prev[dateKey];
      if (!day || !Array.isArray(day.programs) || day.programs.length < 2) return prev;

      const progs = [...day.programs];
      const idx = progs.findIndex(
        p => (p.instanceId && p.instanceId === instanceId) || (p.id && p.id === instanceId)
      );
      if (idx === -1) return prev;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= progs.length) return prev;

      const temp = progs[idx];
      progs[idx] = progs[targetIdx];
      progs[targetIdx] = temp;

      const cleanedProgs = progs.map(p => {
        const copy = { ...p };
        delete copy.anchorStartMinute;
        return copy;
      });

      return {
        ...prev,
        [dateKey]: {
          ...day,
          programs: recalculateDayTimes(cleanedProgs)
        }
      };
    }, direction === 'up' ? 'Program Üste Taşındı' : 'Program Alta Taşındı');
  }, [setScheduleData, recalculateDayTimes]);

  // Tekil Kuşak Silme
  const handleDeleteProgram = useCallback((dateKey, instanceId) => {
    setScheduleData(prev => {
      const day = prev[dateKey];
      if (!day) return prev;
      const remaining = (day.programs || []).filter(p => p.instanceId !== instanceId);
      return {
        ...prev,
        [dateKey]: {
          ...day,
          programs: recalculateDayTimes(remaining)
        }
      };
    }, 'Program Kuşağı Silindi');
    showToast('Program kuşağı silindi.', 'info', 2500);
  }, [setScheduleData, recalculateDayTimes, showToast]);

  // Çoklu Kuşak Silme
  const handleDeleteSelectedPrograms = useCallback((itemsToDelete) => {
    if (!itemsToDelete || itemsToDelete.length === 0) return;
    setScheduleData(prev => {
      const nextSchedule = { ...prev };
      const byDate = {};
      itemsToDelete.forEach(item => {
        if (!byDate[item.dateKey]) byDate[item.dateKey] = new Set();
        byDate[item.dateKey].add(item.instanceId);
      });

      Object.entries(byDate).forEach(([dKey, idSet]) => {
        if (nextSchedule[dKey]) {
          const remaining = (nextSchedule[dKey].programs || []).filter(p => !idSet.has(p.instanceId));
          nextSchedule[dKey] = {
            ...nextSchedule[dKey],
            programs: recalculateDayTimes(remaining)
          };
        }
      });
      return nextSchedule;
    }, `${itemsToDelete.length} Kuşak Topluca Silindi`);
    showToast(`${itemsToDelete.length} program kuşağı silindi.`, 'info', 2500);
  }, [setScheduleData, recalculateDayTimes, showToast]);

  // Tekil Kuşak Kopyalama
  const handleDuplicateProgram = useCallback((dateKey, instanceId, targetDateKey = dateKey) => {
    setScheduleData(prev => {
      const srcDay = prev[dateKey];
      const tgtDay = prev[targetDateKey];
      if (!srcDay || !tgtDay) return prev;

      const prog = (srcDay.programs || []).find(p => p.instanceId === instanceId);
      if (!prog) return prev;

      const tgtProgs = [...(tgtDay.programs || [])];
      const cleanTitle = String(prog.title || '').replace(/\s*\(Kopya\)\s*$/i, '');
      const duplicated = {
        ...prog,
        id: `prog_${targetDateKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        instanceId: `inst_${targetDateKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: cleanTitle
      };

      if (dateKey === targetDateKey) {
        const idx = tgtProgs.findIndex(p => p.instanceId === instanceId);
        tgtProgs.splice(idx + 1, 0, duplicated);
      } else {
        tgtProgs.push(duplicated);
      }

      return {
        ...prev,
        [targetDateKey]: {
          ...tgtDay,
          programs: recalculateDayTimes(tgtProgs)
        }
      };
    }, 'Kuşak Kopyalandı');
    showToast('Program kuşağı kopyalandı ve eklendi.', 'success', 2500);
  }, [setScheduleData, recalculateDayTimes, showToast]);

  // Çoklu Kuşak Kopyalama
  const handleDuplicateSelectedPrograms = useCallback((itemsToDuplicate, targetDateKey) => {
    if (!itemsToDuplicate || itemsToDuplicate.length === 0) return;
    setScheduleData(prev => {
      const nextSchedule = { ...prev };

      if (targetDateKey && nextSchedule[targetDateKey]) {
        const tgtProgs = [...(nextSchedule[targetDateKey].programs || [])];
        itemsToDuplicate.forEach(item => {
          const srcDay = prev[item.dateKey];
          const prog = srcDay?.programs?.find(p => p.instanceId === item.instanceId);
          if (prog) {
            const cleanTitle = String(prog.title || '').replace(/\s*\(Kopya\)\s*$/i, '');
            tgtProgs.push({
              ...prog,
              id: `prog_${targetDateKey}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
              instanceId: `inst_${targetDateKey}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
              title: cleanTitle
            });
          }
        });
        nextSchedule[targetDateKey] = {
          ...nextSchedule[targetDateKey],
          programs: recalculateDayTimes(tgtProgs)
        };
      } else {
        itemsToDuplicate.forEach(item => {
          const srcDay = nextSchedule[item.dateKey];
          if (srcDay) {
            const progs = [...srcDay.programs];
            const idx = progs.findIndex(p => p.instanceId === item.instanceId);
            if (idx !== -1) {
              const prog = progs[idx];
              const cleanTitle = String(prog.title || '').replace(/\s*\(Kopya\)\s*$/i, '');
              progs.splice(idx + 1, 0, {
                ...prog,
                id: `prog_${item.dateKey}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                instanceId: `inst_${item.dateKey}_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                title: cleanTitle
              });
              nextSchedule[item.dateKey] = {
                ...srcDay,
                programs: recalculateDayTimes(progs)
              };
            }
          }
        });
      }
      return nextSchedule;
    }, `${itemsToDuplicate.length} Kuşak Kopyalandı`);
    showToast(`${itemsToDuplicate.length} program kuşağı kopyalandı.`, 'success', 2500);
  }, [setScheduleData, recalculateDayTimes, showToast]);

  // Program Detay Güncelleme (Düzenleme)
  const handleUpdateProgram = useCallback((dateKey, updatedProgram) => {
    enrichedDaysSetRef.current.delete(`${selectedChannel}_${dateKey}`);
    setScheduleData(prev => {
      const day = prev[dateKey];
      if (!day) return prev;

      const progs = (day.programs || []).map(p => {
        if (p.instanceId === updatedProgram.instanceId) {
          const nextP = { ...p, ...updatedProgram };
          // Eğer kullanıcı süreyi manuel değiştirdiyse sabit arşiv saniyesini sıfırla ki yeni süre geçerli olsun
          if (Number(updatedProgram.duration) !== Number(p.duration)) {
            delete nextP.episodeTotalSec;
            delete nextP.episodeDurationFormatted;
          }
          // Eğer bölüm numarası değiştiyse yeni bölümün süresini arşivden çekebilmesi için işaretleri sıfırla
          if (String(updatedProgram.episode || '') !== String(p.episode || '')) {
            delete nextP.episodeTotalSec;
            delete nextP.episodeDurationFormatted;
          }
          return nextP;
        }
        return p;
      });

      return {
        ...prev,
        [dateKey]: {
          ...day,
          programs: recalculateDayTimes(progs)
        }
      };
    }, 'Program Bilgileri Güncellendi');
  }, [selectedChannel, setScheduleData, recalculateDayTimes]);

  // Kısa program kuşağı içerisindeki opsiyonları (Kaside, Aşr-ı Şerif vb.) açıp kapatma
  const handleToggleOption = useCallback((dateKey, instanceId, optionName, e) => {
    if (e) e.stopPropagation();

    setScheduleData(prev => {
      const day = prev[dateKey];
      if (!day) return prev;

      const updatedProgs = day.programs.map(p => {
        if (p.instanceId !== instanceId) return p;
        const currentSelected = p.selectedOptions || [];
        const isAlreadySelected = currentSelected.includes(optionName);
        let newSelected;
        if (isAlreadySelected) {
          newSelected = currentSelected.filter(o => o !== optionName);
        } else {
          newSelected = [...currentSelected, optionName];
        }

        const updatedTopic = newSelected.length > 0 
          ? "Seçili İçerikler: " + newSelected.join(', ')
          : "Henüz içerik seçilmedi";

        return {
          ...p,
          selectedOptions: newSelected,
          topic: updatedTopic
        };
      });

      return {
        ...prev,
        [dateKey]: {
          ...day,
          programs: updatedProgs
        }
      };
    }, 'Kısa Kuşak Opsiyonu Değiştirildi');
  }, [setScheduleData]);

  // Program olup olmadığını kontrol et
  const hasPrograms = useMemo(() => {
    return Object.values(scheduleData || {}).some(d => d.programs && d.programs.length > 0);
  }, [scheduleData]);

  // Liste / Akış Temizleme İşlemi (Günü veya Tüm Haftayı Temizleme ve Anında DB'ye Yazma)
  const handleClearSchedule = useCallback(async () => {
    if (selectedDayKey === 'all') {
      const confirmAll = await dialog.confirm(
        'Tüm Haftayı Temizle',
        'Tüm haftaya (7 gün) ait taslak yayın akışını tamamen temizlemek istediğinize emin misiniz?\n\n* Bilgi: Tüm günlerdeki program kuşakları silinecektir.',
        { isDestructive: true, confirmText: 'Evet, Tümünü Temizle' }
      );
      if (!confirmAll) return;

      const targetKeys = allDaysKeys.length > 0 ? allDaysKeys : DAYS_KEYS;
      const next = {};
      targetKeys.forEach(k => {
        const d = scheduleData?.[k] || {};
        next[k] = {
          date: d.date || k,
          dayName: d.dayName || 'Gün',
          programs: []
        };
      });

      setScheduleData(next, 'Tüm Haftalık Akış Temizlendi');
      showToast(`${currentChannel?.name || 'Kanal'} haftalık akışı temizlendi. Kaydet butonuna basarak onaylayabilirsiniz.`, 'info');
    } else {
      const day = scheduleData?.[selectedDayKey];
      const dayName = day?.dayName || 'Seçili';
      const confirmDay = await dialog.confirm(
        `${dayName} Gününü Temizle`,
        `${dayName} gününe ait taslak yayın akışını temizlemek istediğinize emin misiniz?`,
        { isDestructive: true, confirmText: 'Evet, Günü Temizle' }
      );
      if (!confirmDay) return;

      const next = {
        ...(scheduleData || {}),
        [selectedDayKey]: {
          ...(scheduleData?.[selectedDayKey] || {}),
          date: day?.date || selectedDayKey,
          dayName: day?.dayName || 'Gün',
          programs: []
        }
      };

      setScheduleData(next, `${dayName} Günü Akışı Temizlendi`);
      showToast(`${dayName} günü akışı temizlendi. Kaydet butonuna basarak onaylayabilirsiniz.`, 'info');
    }
  }, [selectedDayKey, scheduleData, currentChannel, allDaysKeys, setScheduleData, showToast]);

  // Varsayılan Akışı Geri Yükleme (Devre dışı — varsayılan şablon kullanılmaz)
  const handleRestoreDefault = useCallback(async () => {
    return;
  }, []);

  // Boş 7 günlük taslak hafta şablonu üretici
  const createEmptyWeek = useCallback((startDate) => {
    const monday = startOfWeek(startDate, { weekStartsOn: 1 });
    const sunday = endOfWeek(monday, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: monday, end: sunday });
    const newSchedule = {};
    days.forEach(d => {
      const k = format(d, 'yyyy-MM-dd');
      newSchedule[k] = {
        date: format(d, 'd MMMM yyyy', { locale: tr }),
        dayName: format(d, 'EEEE', { locale: tr }),
        programs: []
      };
    });
    return newSchedule;
  }, []);

  // Önceki Hafta Gezinme (7 gün geri git)
  const handlePrevWeek = useCallback(() => {
    try {
      const currentStart = parseISO(currentWeekStart);
      const prevWeekStart = subWeeks(currentStart, 1);
      const prevWeekKey = format(prevWeekStart, 'yyyy-MM-dd');

      setCurrentWeekStart(prevWeekKey);
      try {
        localStorage.setItem('draft_active_week_start', prevWeekKey);
      } catch (e) {}
      setSelectedDayKey('all');
    } catch (e) {
      console.error('Önceki hafta yükleme hatası:', e);
    }
  }, [currentWeekStart]);

  // Sonraki Hafta Gezinme (7 gün ileri git)
  const handleNextWeek = useCallback(() => {
    try {
      const currentStart = parseISO(currentWeekStart);
      const nextWeekStart = addWeeks(currentStart, 1);
      const nextWeekKey = format(nextWeekStart, 'yyyy-MM-dd');

      setCurrentWeekStart(nextWeekKey);
      try {
        localStorage.setItem('draft_active_week_start', nextWeekKey);
      } catch (e) {}
      setSelectedDayKey('all');
    } catch (e) {
      console.error('Sonraki hafta yükleme hatası:', e);
    }
  }, [currentWeekStart]);

  // Takvimden belirli bir haftayı seçme
  const handleSelectWeek = useCallback((weekDatesArr) => {
    if (!weekDatesArr || weekDatesArr.length === 0) return;
    const startKey = weekDatesArr[0];
    setCurrentWeekStart(startKey);
    try {
      localStorage.setItem('draft_active_week_start', startKey);
    } catch (e) {}
    setSelectedDayKey('all');
  }, []);

  // Takvimden belirli bir günü seçme
  const handleSelectDay = useCallback((dateKey, weekDatesArr) => {
    if (weekDatesArr && weekDatesArr.length > 0) {
      const startKey = weekDatesArr[0];
      setCurrentWeekStart(startKey);
      try {
        localStorage.setItem('draft_active_week_start', startKey);
      } catch (e) {}
    }
    setSelectedDayKey(dateKey);
  }, []);

  // Hazır Akış Paketine Geçiş Yapma (Kullanıcı bilinçli olarak şablon yüklemek istediğinde)
  const handleSwitchPreset = useCallback(async (presetId) => {
    const preset = AVAILABLE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const ok = await dialog.confirm(
      'Hazır Şablon Yükleme',
      `"${preset.label}" şablon akışını yüklemek istediğinize emin misiniz? Bu işlem seçili haftayı şablon verisiyle güncelleyecektir.`
    );
    if (!ok) return;

    if (preset.start) {
      setCurrentWeekStart(preset.start);
      try {
        localStorage.setItem('draft_active_week_start', preset.start);
      } catch (e) {}
    }
    setScheduleData(preset.data, `${preset.label} Paketi Yüklendi`);
    setSelectedDayKey('all');
    showToast(`${preset.label} şablon paketi başarıyla yüklendi.`, 'success');
  }, [setScheduleData, showToast]);

  // Tüm haftalık akışların birleşik haritası (Takvimde dolu günleri göstermek için)
  const allSchedulesMap = useMemo(() => {
    return schedulesByChannel[selectedChannel] || {};
  }, [schedulesByChannel, selectedChannel]);

  // Arama filtresi (Türkçe karakter duyarlı & öncelik skoru destekli)
  const filterProgram = useCallback((p) => {
    if (!searchQuery.trim()) return true;
    const rank = getItemSearchRank(
      p,
      searchQuery,
      (item) => item?.title || item?.name || '',
      (item) => [item?.episode ? `Bölüm ${item.episode}` : '', item?.host, item?.topic, item?.category, item?.startTime]
    );
    return rank !== Infinity;
  }, [searchQuery]);

  return {
    selectedChannel,
    setSelectedChannel,
    channels,
    currentChannel,
    schedulesByChannel,
    setSchedulesByChannel,
    scheduleData,
    setScheduleData,
    saveScheduleToBackend,
    saveStatus,
    setSaveStatus,
    toastNotification,
    setToastNotification,
    showToast,
    undo,
    currentWeekStart,
    setCurrentWeekStart,
    allDaysKeys,
    activeDaysKeys,
    selectedDayKey,
    setSelectedDayKey,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filterProgram,
    dateRangeLabel,
    availableDaysList,
    recalculateDayTimes,
    handleSaveSchedule,
    handleDeleteProgram,
    handleDeleteSelectedPrograms,
    handleDuplicateProgram,
    handleDuplicateSelectedPrograms,
    handleReorderPrograms,
    handleMoveProgramOrder,
    handleUpdateProgram,
    handleToggleOption,
    handleClearSchedule,
    handleRestoreDefault,
    handlePrevWeek,
    handleNextWeek,
    handleSelectWeek,
    handleSelectDay,
    handleSwitchPreset,
    allSchedulesMap,
    createEmptyWeek,
    hasPrograms
  };
};
