/**
 * @file src/modules/broadcast/utils/rundownHelpers.js
 * @description Yayın akışı tablosu (BroadcastRundownTable) için zaman kodu ayrıştırma,
 * saat kuşağı etiketi belirleme ve ardışık program/klip gruplama yardımcı fonksiyonları.
 */

import useThemeStore from '../../../store/themeStore';

// Sütun Sırası: 1.# | 2.Yayın Saati (Başlangıç-Bitiş) | 3.Süre | 4.Klip/Program Adı | 5.Bölüm/Part | 6.Tür | 7.İşlemler
export const RUNDOWN_GRID_TEMPLATE =
  '44px minmax(144px, 1.15fr) minmax(136px, 0.98fr) minmax(150px, 2.2fr) minmax(78px, 1fr) minmax(68px, 0.75fr) 124px';

/**
 * "HH.MM.SS.FF" formatındaki timecode metnini okunaklı saat parçalarına ayırır.
 * Örn: "14.26.50.00" -> { hh: "14", mm: "26", ss: "50", ff: "00", hhmm: "14:26", hhmmss: "14:26:50", hourNum: 14 }
 */
export function parseTimecodeDisplay(tc) {
  const parts = String(tc || '00.00.00.00').split(/[:.-]/);
  const hh = String(parts[0] || '00').padStart(2, '0');
  const mm = String(parts[1] || '00').padStart(2, '0');
  const ss = String(parts[2] || '00').padStart(2, '0');
  const ff = String(parts[3] || '00').padStart(2, '0');
  return {
    hh,
    mm,
    ss,
    ff,
    hhmm: `${hh}:${mm}`,
    hhmmss: `${hh}:${mm}:${ss}`,
    fullColon: `${hh}:${mm}:${ss}.${ff}`,
    hourNum: parseInt(hh, 10) || 0
  };
}

/**
 * Saate göre 4 ana gün kuşağı (Gece, Sabah, Gündüz, Akşam) bilgisini döndürür.
 */
export function getHourPeriodLabel(hour) {
  const customPeriods = useThemeStore.getState()?.config?.periodColors || {};
  if (hour >= 0 && hour < 6) {
    return { id: 'night', label: 'GECE KUŞAĞI', range: '00:00 - 06:00', icon: '🌙', color: customPeriods.night?.color || '#6366f1' };
  }
  if (hour >= 6 && hour < 12) {
    return { id: 'morning', label: 'SABAH KUŞAĞI', range: '06:00 - 12:00', icon: '🌅', color: customPeriods.morning?.color || '#f59e0b' };
  }
  if (hour >= 12 && hour < 18) {
    return { id: 'day', label: 'GÜNDÜZ KUŞAĞI', range: '12:00 - 18:00', icon: '☀️', color: customPeriods.day?.color || '#0ea5e9' };
  }
  return { id: 'evening', label: 'AKŞAM KUŞAĞI', range: '18:00 - 24:00', icon: '🌆', color: customPeriods.evening?.color || '#8b5cf6' };
}

/**
 * Bir yayın öğesinin kök program adını (ardışık klipleri gruplamak ve program çizgisi çekmek için) döndürür.
 */
export function getProgramGroupKey(item) {
  if (!item) return '';
  if (item.type === 'ad_break') return '__AD_BREAK__';
  if (item.note && item.note.startsWith('Klip:')) {
    return item.note.replace(/^Klip:\s*/i, '').trim().toLowerCase();
  }
  if (item.note && item.note.startsWith('Program:')) {
    return item.note.replace(/^Program:\s*/i, '').trim().toLowerCase();
  }
  const raw = String(item.title || item.name || '')
    .replace(/(?:_|^|\s|-)(?:part|p|pt)[_-]?\d+(?:[_\s.-]|$)/gi, '')
    .replace(/_\d{6,8}(?:_|$)/g, '')
    .replace(/_\d{1,3}$/g, '')
    .trim()
    .toLowerCase();
  return raw;
}

const WEEKDAY_RULES = [
  { rx: /pazartesi|pzt/i, order: 1, label: 'Pazartesi Günü' },
  { rx: /sal[ıi]/i, order: 2, label: 'Salı Günü' },
  { rx: /[cç]ar[sş]amba|crs/i, order: 3, label: 'Çarşamba Günü' },
  { rx: /per[sş]embe|prs/i, order: 4, label: 'Perşembe Günü' },
  { rx: /cumartesi|cmt/i, order: 6, label: 'Cumartesi Günü' },
  { rx: /cuma(?!rtesi)/i, order: 5, label: 'Cuma Günü' },
  { rx: /pazar(?!tesi)/i, order: 7, label: 'Pazar Günü' }
];

/**
 * Yayın akışındaki (veya localStorage'da önceden kayıtlı) bir öğenin birim bilgisini
 * (Bölüm / Cüz / Gün) ve doğru etiketini çözümler.
 */
export function resolveItemUnitDisplay(item) {
  if (!item) return { unitType: 'bolum', unitLabel: null, episodeNo: null };

  const rawName = String(item.clipName || item.name || item.title || '').trim();
  const noteStr = String(item.note || '').trim();
  const norm = rawName
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  // 1. Delailü'l-Hayrat -> Gün
  if (norm.includes('delail') && !norm.includes('minhacus')) {
    for (const d of WEEKDAY_RULES) {
      if (d.rx.test(rawName) || d.rx.test(noteStr)) {
        return { unitType: 'gun', unitLabel: d.label, episodeNo: d.order };
      }
    }
    if (item.unitType === 'gun' && item.unitLabel) {
      return { unitType: 'gun', unitLabel: item.unitLabel, episodeNo: item.episodeNo };
    }
  }

  // 2. Hatm-i Şerif, Mukabele, Tefsiri Mevakib -> Cüz
  if (
    norm.includes('hatmiserif') ||
    norm.includes('hatmi_serif') ||
    norm.includes('hatim_cuz') ||
    norm.includes('hatim_dua') ||
    norm.includes('mukabele') ||
    norm.includes('mevakib')
  ) {
    if (item.unitType === 'cuz' && item.unitLabel) {
      return { unitType: 'cuz', unitLabel: item.unitLabel, episodeNo: item.episodeNo };
    }
    const cuzM = rawName.match(/(?:cuz|cz)[\s_-]*(\d{1,2})/i) ||
                 rawName.match(/(\d{1,2})[\s_-]*(?:cuz|cz)/i) ||
                 noteStr.match(/(\d{1,2})\.\s*c[üu]z/i);
    if (cuzM) {
      const cNo = parseInt(cuzM[1], 10);
      return { unitType: 'cuz', unitLabel: `${cNo}. Cüz`, episodeNo: cNo };
    }
    if (/dua/i.test(rawName)) {
      return { unitType: 'cuz', unitLabel: 'Hatim Duası', episodeNo: null };
    }
    if (item.episodeNo >= 1 && item.episodeNo <= 30) {
      return { unitType: 'cuz', unitLabel: `${item.episodeNo}. Cüz`, episodeNo: item.episodeNo };
    }
  }

  // 3. Beş Vakit Bir Şehir (5vakit1sehir) -> Önekteki 5 veya 1'i bölüm olarak almamalı
  const bvMatch = norm.match(/(5vakit1sehir|5vakit_1sehir|5v_1s|5v1s|bes_vakit)/);
  if (bvMatch) {
    const idx = norm.indexOf(bvMatch[1]);
    const rem = rawName
      .slice(idx + bvMatch[1].length)
      .replace(/_(?:201\d|202\d)(?=_|$)/g, '_')
      .replace(/_(?:\d{6}|\d{8})[a-z]*(?=_|$)/gi, '_')
      .replace(/_(?:part|p|pt)[_-]?\d+[a-z]*(?=_|$)/gi, '_');
    const epM = rem.match(/^[\s_-]*(?:bolum[\s_-]*|b)?(\d{1,4})(?:[\s_-]|$)/i) ||
                rem.match(/_(\d{1,3})(?:_|$)/);
    if (epM) {
      const realEp = parseInt(epM[1], 10);
      return { unitType: 'bolum', unitLabel: `Bölüm ${realEp}`, episodeNo: realEp };
    }
    // Dosya isminde bölüm numarası yoksa (örn: 5V_1S_Afyon_P1) ve eski kayıtta 5 yazıyorsa temizle
    if (item.episodeNo === 5 && !item.unitLabel) {
      return { unitType: 'bolum', unitLabel: null, episodeNo: null };
    }
  }

  // 4. Son İnci (s_inci_<bölüm>)
  if (norm.includes('s_inci') || norm.includes('son_inci')) {
    const sInciM = rawName.match(/(?:s_inci|son_inci)[\s_-]*(\d{1,3})/i);
    if (sInciM) {
      const ep = parseInt(sInciM[1], 10);
      return { unitType: 'bolum', unitLabel: `Bölüm ${ep}`, episodeNo: ep };
    }
  }

  const uType = item.unitType || 'bolum';
  const epNo = item.episodeNo ?? item.episode ?? null;
  const uLabel = item.unitLabel || (
    epNo !== null && epNo !== undefined && epNo !== ''
      ? (uType === 'cuz' ? `${epNo}. Cüz` : uType === 'gun' ? `${epNo}. Gün` : `Bölüm ${epNo}`)
      : null
  );
  return { unitType: uType, unitLabel: uLabel, episodeNo: epNo };
}

