/**
 * @file src/modules/broadcast/utils/draftDataLoader.js
 * @description Taslak Planlama modülündeki verileri okur ve Yayın Planlama ekranında
 * SADECE o gün için gerçekten taslak hazırlanmışsa gösterilecek ve "Taslak Uygula" ile eşleştirilecek
 * taslak akışını hazırlar. Taslak olmayan günlerde şablon/varsayılan taslak göstermez ([] döner).
 * Taslakta yapılan güncellemeleri anında (canlı bellek + localStorage + backend senkronu ile) yansıtır.
 */
import scheduleHd from '../../../data/draft_schedule_ch_hd.json';
import scheduleWay from '../../../data/draft_schedule_ch_way.json';
import { parseISO, getDay } from 'date-fns';

// Canlı bellek önbelleği (Taslak Planlama'da yapılan değişikliklerin milisaniyesinde yansıması için)
const liveDraftSchedules = {
  ch_hd: null,
  ch_way: null
};

const WEEKDAY_MAP = [
  { getDayIdx: 1, order: 1, dayName: 'Pazartesi', label: 'Pazartesi Günü', rx: /pazartesi|pzt/i },
  { getDayIdx: 2, order: 2, dayName: 'Salı', label: 'Salı Günü', rx: /sal[ıi]/i },
  { getDayIdx: 3, order: 3, dayName: 'Çarşamba', label: 'Çarşamba Günü', rx: /[cç]ar[sş]amba|crs/i },
  { getDayIdx: 4, order: 4, dayName: 'Perşembe', label: 'Perşembe Günü', rx: /per[sş]embe|prs/i },
  { getDayIdx: 6, order: 6, dayName: 'Cumartesi', label: 'Cumartesi Günü', rx: /cumartesi|cmt/i },
  { getDayIdx: 5, order: 5, dayName: 'Cuma', label: 'Cuma Günü', rx: /cuma(?!rtesi)/i },
  { getDayIdx: 0, order: 7, dayName: 'Pazar', label: 'Pazar Günü', rx: /pazar(?!tesi)/i }
];

function normalizeAscii(str = '') {
  return String(str || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[âîû]/g, (m) => ({ 'â': 'a', 'î': 'i', 'û': 'u' }[m] || m));
}

/**
 * Tarih dizgesinden (YYYY-MM-DD) veya metinden haftanın gün bilgisini çözümler.
 */
export function resolveWeekdayInfo(textHint = '', dateStr = '', preferDate = false) {
  if (!preferDate && textHint) {
    for (const w of WEEKDAY_MAP) {
      if (w.rx.test(textHint)) return w;
    }
  }
  if (dateStr) {
    try {
      const jsDay = getDay(parseISO(dateStr)); // 0=Pazar, 1=Pazartesi...
      const found = WEEKDAY_MAP.find(w => w.getDayIdx === jsDay);
      if (found) return found;
    } catch (e) {}
  }
  if (textHint) {
    for (const w of WEEKDAY_MAP) {
      if (w.rx.test(textHint)) return w;
    }
  }
  return null;
}

/**
 * İlgili kanalın güncel taslak takvim haritasını döndürür.
 */
export function getChannelDraftScheduleMap(channelId = 'ch_hd') {
  if (liveDraftSchedules[channelId] && typeof liveDraftSchedules[channelId] === 'object') {
    return liveDraftSchedules[channelId];
  }

  try {
    const storageKey = `draft_schedule_${channelId}`;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        liveDraftSchedules[channelId] = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Draft localStorage okunamadı:', e);
  }

  const fallback = channelId === 'ch_way' ? scheduleWay : scheduleHd;
  return fallback && typeof fallback === 'object' ? fallback : {};
}

/**
 * Taslak Planlama modülünde yapılan her türlü değişikliği anında canlı önbelleğe,
 * localStorage'a yazar ve Yayın Planlama bileşenlerini tetikler.
 */
export function updateLiveDraftSchedule(channelId = 'ch_hd', scheduleMap = {}) {
  if (!scheduleMap || typeof scheduleMap !== 'object') return;
  const cleaned = { ...scheduleMap };
  delete cleaned.all;

  liveDraftSchedules[channelId] = cleaned;
  try {
    localStorage.setItem(`draft_schedule_${channelId}`, JSON.stringify(cleaned));
  } catch (e) {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('draft-schedule-updated', {
      detail: { channelId, timestamp: Date.now() }
    }));
  }
}

/**
 * Sunucudan (/api/draftSchedule) ilgili kanalın en güncel taslak verisini çeker,
 * canlı önbelleği ve localStorage'ı senkronize eder.
 */
export async function fetchAndSyncDraftSchedule(channelId = 'ch_hd') {
  try {
    let res;
    try {
      res = await fetch(`/api/draftSchedule?channel=${channelId}`);
    } catch (err) {
      res = await fetch(`/api/draftSchedule?channel=${channelId}`);
    }
    if (res && res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        updateLiveDraftSchedule(channelId, data);
        return data;
      }
    }
  } catch (err) {
    // Offline / local fallback
  }
  return getChannelDraftScheduleMap(channelId);
}

/**
 * İlgili kanalda gerçekten taslak programı bulunan günlerin listesini döndürür.
 */
export function getAvailableDraftDates(channelId = 'ch_hd') {
  const scheduleMap = getChannelDraftScheduleMap(channelId);
  const validDateRx = /^\d{4}-\d{2}-\d{2}$/;
  const result = [];

  for (const [dateKey, dayObj] of Object.entries(scheduleMap || {})) {
    if (!validDateRx.test(dateKey)) continue;
    const progs = dayObj?.programs;
    if (Array.isArray(progs) && progs.length > 0) {
      result.push({
        dateStr: dateKey,
        dayName: dayObj.dayName || '',
        dateLabel: dayObj.date || dateKey,
        count: progs.length
      });
    }
  }

  return result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}

/**
 * Belirli bir kanal ve tarih için taslak yayın akışını getirir.
 * ÖNEMLİ: Sadece o tarihe (YYYY-MM-DD) özel olarak taslak kaydedilmişse/varsa döndürür.
 * Taslak uygulanmamış / oluşturulmamış günlerde başka haftaların şablonunu KESİNLİKLE göstermez ([] döner).
 *
 * @param {string} channelId - 'ch_hd' | 'ch_way'
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Array} Taslak program listesi
 */
export function getDraftProgramsForDay(channelId = 'ch_hd', dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];

  const scheduleMap = getChannelDraftScheduleMap(channelId);
  const dayEntry = scheduleMap?.[dateStr];

  if (!dayEntry || !Array.isArray(dayEntry.programs) || dayEntry.programs.length === 0) {
    return [];
  }

  return normalizeDraftPrograms(dayEntry.programs, dateStr, false);
}

/**
 * Taslak program objesini standart yapıya dönüştürür; Bölüm, Cüz ve Gün bilgilerini eksiksiz çıkarır.
 */
function normalizeDraftPrograms(rawPrograms, dateStr, isTemplate = false) {
  return rawPrograms.map((p, idx) => {
    const durationMin = parseInt(p.duration, 10) || 30;
    const durationSec = durationMin * 60;
    const rawTitleOrig = String(p.title || p.name || 'İsimsiz Program').trim();
    const rawFullTitle = String(p.rawTitle || '').trim();
    let hostStr = String(p.host || '').trim();
    let topicStr = String(p.topic || '').trim();
    const noteStr = String(p.note || '').trim();

    const isLive = Boolean(
      p.isLive ||
      (Array.isArray(p.selectedOptions) && p.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
      /\bcanl[ıi]\b/i.test(`${rawTitleOrig} ${rawFullTitle} ${hostStr}`)
    );

    // Eski ayrıştırmalardan host alanına 'Canlı' yazılmışsa temizle ve topic'teki gerçek sunucuyu öne al
    if (/^\s*canl[ıi](?:\s+yay[ıi]n)?\s*$/i.test(hostStr)) {
      if (topicStr.includes(' - ')) {
        const tParts = topicStr.split(' - ').map(s => s.trim()).filter(Boolean);
        hostStr = tParts[0] || '';
        topicStr = tParts.slice(1).join(' - ');
      } else {
        hostStr = '';
      }
    }

    // Başlıktaki '- Canlı' / 'Canlı' kuyruklarını arındır
    const rawTitle = rawTitleOrig
      .replace(/[\(\[\-\–\—\s]*\bcanl[ıi](?:\s+yay[ıi]n)?\b[\)\]\s]*/gi, ' ')
      .replace(/[-–—\s]+$/, '')
      .trim() || rawTitleOrig;
    const normTitle = normalizeAscii(rawTitle);

    let unitType = 'bolum';
    let resolvedEpisode = '';
    let resolvedEpisodeNo = null;
    let unitLabel = null;
    let dayName = null;

    const isDelail = normTitle.includes('delail') && !normTitle.includes('minhacus');
    const isCuzProg =
      normTitle.includes('hatm') ||
      normTitle.includes('mukabele') ||
      normTitle.includes('mevakib');

    if (isDelail) {
      unitType = 'gun';
      const wInfo = resolveWeekdayInfo(`${hostStr} ${p.episode || ''} ${rawFullTitle} ${noteStr}`, dateStr, isTemplate);
      if (wInfo) {
        resolvedEpisode = String(wInfo.order);
        resolvedEpisodeNo = wInfo.order;
        unitLabel = wInfo.label;
        dayName = wInfo.dayName;
      }
    } else if (isCuzProg) {
      unitType = 'cuz';
      let cuzNo = null;
      const epDirect = parseInt(p.episode || p.episodeNo, 10);
      if (!isNaN(epDirect) && epDirect >= 1 && epDirect <= 30) {
        cuzNo = epDirect;
      } else {
        const combinedCuzText = `${hostStr} ${rawFullTitle} ${noteStr} ${topicStr}`;
        const cuzM =
          combinedCuzText.match(/(?:c[uü]z|cz)[\s.:_-]*(\d{1,2})/i) ||
          combinedCuzText.match(/(\d{1,2})[\s._-]*(?:c[uü]z|cz)/i) ||
          hostStr.match(/^\s*(\d{1,2})\s*$/);
        if (cuzM) {
          const parsed = parseInt(cuzM[1], 10);
          if (parsed >= 1 && parsed <= 30) cuzNo = parsed;
        }
      }
      if (cuzNo !== null) {
        resolvedEpisode = String(cuzNo);
        resolvedEpisodeNo = cuzNo;
        unitLabel = `${cuzNo}. Cüz`;
      }
    } else {
      unitType = 'bolum';
      let epNo = null;
      const epDirect = parseInt(p.episode || p.episodeNo, 10);
      if (!isNaN(epDirect) && epDirect > 0) {
        epNo = epDirect;
      } else if (/^\s*(\d{1,4})\s*$/.test(hostStr)) {
        epNo = parseInt(hostStr.trim(), 10);
      } else {
        const cleanFullForEp = rawFullTitle.replace(/[\(\[\-\–\—\s]*\bcanl[ıi](?:\s+yay[ıi]n)?\b[\)\]\s]*/gi, '').trim();
        const tailMatch =
          cleanFullForEp.match(/(?:[-–]\s*|(?:bölüm|bolum|bl|b)\s*)(\d{1,4})\s*$/i) ||
          rawTitle.match(/(?:[-–]\s*|(?:bölüm|bolum|bl|b)\s*)(\d{1,4})\s*$/i);
        if (tailMatch) {
          epNo = parseInt(tailMatch[1], 10);
        }
      }
      if (epNo !== null && epNo > 0) {
        resolvedEpisode = String(epNo);
        resolvedEpisodeNo = epNo;
        unitLabel = `Bölüm ${epNo}`;
      }
    }

    const displayNoteParts = [];
    if (hostStr && !/^\d+$/.test(hostStr)) displayNoteParts.push(hostStr);
    if (topicStr) displayNoteParts.push(topicStr);
    if (noteStr && !displayNoteParts.includes(noteStr)) displayNoteParts.push(noteStr);

    return {
      id: p.id || `draft_p_${dateStr}_${idx}`,
      programId: p.programId || (typeof p.id === 'number' ? p.id : null),
      instanceId: p.instanceId || `draft_inst_${dateStr}_${idx}`,
      title: rawTitle,
      name: p.name || rawTitle,
      rawTitle: rawFullTitle,
      host: hostStr,
      topic: topicStr,
      dateStr: dateStr,
      startTime: p.startTime || '06:00',
      endTime: p.endTime || '',
      duration: durationMin,
      durationSec: durationSec,
      category: p.category || (isLive ? 'Canlı Yayın' : 'Genel'),
      categoryColor: p.categoryColor || (isLive ? '#ef4444' : '#3b82f6'),
      episode: resolvedEpisode,
      episodeNo: resolvedEpisodeNo,
      unitType: unitType,
      unitLabel: unitLabel,
      dayName: dayName,
      part: p.part || p.partNo || '',
      note: displayNoteParts.join(' • ') || (isLive ? 'Canlı Yayın' : (isTemplate ? 'Haftalık Şablon' : '')),
      isKisaSlot: Boolean(p.isKisaSlot),
      isLive: isLive,
      selectedOptions: isLive ? ['Canlı'] : (p.selectedOptions || ['Bant']),
      isDraftItem: true
    };
  });
}
