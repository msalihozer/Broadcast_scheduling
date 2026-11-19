/**
 * @file src/modules/broadcast/utils/timecodeUtils.js
 * @description Türk televizyon yayıncılık standardı (PAL 25 fps / salise) için
 * zaman kodu (Timecode: HH.MM.SS.FF) ayrıştırma, hesaplama ve biçimlendirme araçları.
 */

export const BROADCAST_FPS = 25; // PAL 25 kare/saniye (1 saniye = 25 kare/salise)
export const FRAMES_PER_SECOND = BROADCAST_FPS;
export const FRAMES_PER_MINUTE = 60 * FRAMES_PER_SECOND; // 1500
export const FRAMES_PER_HOUR = 3600 * FRAMES_PER_SECOND; // 90000
export const FRAMES_PER_DAY = 24 * FRAMES_PER_HOUR; // 2,160,000 kare (24 saat)

export const START_OF_DAY_TIMECODE = '00.00.00.00';

/**
 * HH.MM.SS.FF veya HH:MM:SS:FF metnini veya saniyeyi toplam kare (frame) sayısına çevirir.
 * @param {string|number} tc - Zaman kodu metni veya sayı (saniye)
 * @param {number} fps - Saniyedeki kare sayısı (varsayılan: 25)
 * @returns {number} Toplam kare sayısı
 */
export function timecodeToFrames(tc, fps = BROADCAST_FPS) {
  if (tc === null || tc === undefined) return 0;
  if (typeof tc === 'number') {
    return Math.round(tc * fps);
  }

  const str = String(tc).trim();
  if (!str) return 0;

  // Nokta, iki nokta veya tire ayracı desteği
  const parts = str.split(/[:.-]/).map(p => parseInt(p, 10) || 0);

  if (parts.length === 4) {
    // HH, MM, SS, FF
    const [h, m, s, f] = parts;
    return (h * 3600 * fps) + (m * 60 * fps) + (s * fps) + f;
  } else if (parts.length === 3) {
    // HH, MM, SS (FF = 0)
    const [h, m, s] = parts;
    return (h * 3600 * fps) + (m * 60 * fps) + (s * fps);
  } else if (parts.length === 2) {
    // MM, SS
    const [m, s] = parts;
    return (m * 60 * fps) + (s * fps);
  } else if (parts.length === 1) {
    // Dakika veya saniye olabilir
    return parts[0] * fps;
  }

  return 0;
}

/**
 * Toplam kare (frame) sayısını HH.MM.SS.FF formatında zaman koduna çevirir.
 * @param {number} totalFrames - Toplam kare
 * @param {number} fps - FPS (varsayılan: 25)
 * @param {string} sep - Ayraç (varsayılan: '.')
 * @returns {string} Ör: "00.26.19.00"
 */
export function framesToTimecode(totalFrames, fps = BROADCAST_FPS, sep = '.') {
  if (isNaN(totalFrames) || totalFrames < 0) totalFrames = 0;

  totalFrames = Math.round(totalFrames);
  const f = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  const ff = String(f).padStart(2, '0');

  return `${hh}${sep}${mm}${sep}${ss}${sep}${ff}`;
}

/**
 * Saniye ve isteğe bağlı kare değerini HH.MM.SS.FF formatına çevirir.
 */
export function secondsToTimecode(seconds, frames = 0, sep = '.') {
  if (!seconds || isNaN(seconds)) seconds = 0;
  const totalFrames = Math.round(seconds * BROADCAST_FPS) + (frames || 0);
  return framesToTimecode(totalFrames, BROADCAST_FPS, sep);
}

/**
 * İki zaman kodunu toplar.
 */
export function addTimecodes(tc1, tc2, fps = BROADCAST_FPS) {
  const f1 = timecodeToFrames(tc1, fps);
  const f2 = timecodeToFrames(tc2, fps);
  return framesToTimecode(f1 + f2, fps);
}

/**
 * tc1'den tc2'yi çıkarır (negatifse 0 döner).
 */
export function subtractTimecodes(tc1, tc2, fps = BROADCAST_FPS) {
  const f1 = timecodeToFrames(tc1, fps);
  const f2 = timecodeToFrames(tc2, fps);
  return framesToTimecode(Math.max(0, f1 - f2), fps);
}

/**
 * Bir zaman kodunu normalleştirip standart HH.MM.SS.FF haline getirir.
 */
export function normalizeTimecode(tc) {
  if (!tc) return START_OF_DAY_TIMECODE;
  const frames = timecodeToFrames(tc);
  return framesToTimecode(frames);
}

/**
 * 24 saatlik döngüdeki saat görünümünü döner (00.00.00.00 - 23.59.59.24).
 * 24 saati aşan kareler gün döngüsüne mod alınarak gösterilir.
 */
export function framesToClockTime(totalFrames, fps = BROADCAST_FPS) {
  const normalizedFrames = ((Math.round(totalFrames) % FRAMES_PER_DAY) + FRAMES_PER_DAY) % FRAMES_PER_DAY;
  return framesToTimecode(normalizedFrames, fps);
}

/**
 * Kare sayısını insan okuyabilir formata çevirir (X sa Y dk Z sn).
 */
export function formatFramesHuman(totalFrames, fps = BROADCAST_FPS) {
  if (!totalFrames || totalFrames <= 0) return '0 sn';
  const totalSeconds = Math.floor(totalFrames / fps);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const f = totalFrames % fps;

  const parts = [];
  if (h > 0) parts.push(`${h} sa`);
  if (m > 0) parts.push(`${m} dk`);
  if (s > 0) parts.push(`${s} sn`);
  if (f > 0) parts.push(`${f} kare`);

  return parts.join(' ') || '0 sn';
}

/**
 * Kullanıcı tarafından girilen saat metnini (HH:MM, HH:MM:SS, HH.MM.SS.FF vb.)
 * 24 saatlik gün içerisindeki toplam kare (frame) değerine çevirir.
 * Örn: "05:00" -> 05:00:00.00 (450,000 kare), "04:59:59" -> 04:59:59.00
 */
export function parseClockTimeToFrames(clockStr, fps = BROADCAST_FPS) {
  if (clockStr === null || clockStr === undefined) return null;
  if (typeof clockStr === 'number' && !isNaN(clockStr)) {
    return Math.max(0, Math.round(clockStr));
  }
  const str = String(clockStr).trim();
  if (!str) return null;

  const rawParts = str.split(/[:.-]/).map(p => p.trim()).filter(Boolean);
  if (rawParts.length === 0) return null;

  const nums = rawParts.map(p => parseInt(p, 10));
  if (nums.some(n => isNaN(n) || n < 0)) return null;

  let h = 0;
  let m = 0;
  let s = 0;
  let f = 0;
  if (nums.length === 1) {
    h = nums[0];
  } else if (nums.length === 2) {
    [h, m] = nums;
  } else if (nums.length === 3) {
    [h, m, s] = nums;
  } else {
    [h, m, s, f] = nums;
  }

  h = Math.min(23, Math.max(0, h));
  m = Math.min(59, Math.max(0, m));
  s = Math.min(59, Math.max(0, s));
  f = Math.min(fps - 1, Math.max(0, f));

  return (h * 3600 * fps) + (m * 60 * fps) + (s * fps) + f;
}
