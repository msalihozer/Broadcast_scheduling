/**
 * @file src/utils/formatTimecode.js
 * @description Süreleri Türk yayıncılık standardı olan saat.dakika.saniye.salise (HH.MM.SS.FF) formatına çevirir.
 */

/**
 * Saniye cinsinden süreyi saat.dakika.saniye.salise formatına dönüştürür.
 * @param {number|string} totalSeconds - Toplam saniye
 * @param {number|string} frames - Salise / Frame (varsayılan 00)
 * @returns {string} Ör: "00.23.15.00", "01.45.10.00"
 */
export function formatTimecode(totalSeconds, frames = 0) {
  if (totalSeconds === null || totalSeconds === undefined || totalSeconds === '' || isNaN(totalSeconds)) {
    return '00.00.00.00';
  }

  const secNum = Math.max(0, Math.floor(Number(totalSeconds)));
  const h = Math.floor(secNum / 3600);
  const m = Math.floor((secNum % 3600) / 60);
  const s = secNum % 60;
  const f = Math.max(0, Math.min(99, Math.floor(Number(frames) || 0)));

  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  const ff = f.toString().padStart(2, '0');

  return `${hh}.${mm}.${ss}.${ff}`;
}

/**
 * Mevcut herhangi bir süre metnini (ör: "00:23:15", "00.23.15", "00:23:15:00", 1395 sn)
 * standart "saat.dakika.saniye.salise" (HH.MM.SS.FF) formatına normalize eder.
 * @param {string|number} raw 
 * @returns {string} Ör: "00.23.15.00"
 */
export function normalizeTimecode(raw) {
  if (!raw) return '00.00.00.00';
  if (typeof raw === 'number') return formatTimecode(raw);

  const str = String(raw).trim();
  // Zaten "00.00.00.00" formatındaysa
  if (/^\d{2,}\.\d{2}\.\d{2}\.\d{2}$/.test(str)) {
    return str;
  }

  // ":" ile ayrılmışsa (00:23:15 veya 00:23:15:00)
  const parts = str.split(/[:.]/);
  if (parts.length === 3) {
    // HH:MM:SS -> HH.MM.SS.00
    const [h, m, s] = parts.map(p => p.padStart(2, '0'));
    return `${h}.${m}.${s}.00`;
  }
  if (parts.length >= 4) {
    const [h, m, s, f] = parts.map(p => p.padStart(2, '0'));
    return `${h}.${m}.${s}.${f}`;
  }
  if (parts.length === 2) {
    // MM:SS -> 00.MM.SS.00
    const [m, s] = parts.map(p => p.padStart(2, '0'));
    return `00.${m}.${s}.00`;
  }

  const asNum = parseFloat(str);
  if (!isNaN(asNum)) {
    return formatTimecode(asNum);
  }

  return '00.00.00.00';
}

export default formatTimecode;
