/**
 * @file src/components/Ads/planning/adPlanningConstants.js
 * @description Reklam Kuşak & Yayın Akışı Yönetimi (`AdPlanningTab`) için sabitler ve zaman/tarih biçimlendirme yardımcıları.
 */
import { format, parseISO, startOfWeek } from 'date-fns';

export const PRIORITY_BADGES = {
  1000: { label: 'Zorunlu', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.12)', border: 'rgba(220, 38, 38, 0.25)' },
  700: { label: 'Yüksek', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.25)' },
  400: { label: 'Normal', color: '#0066ff', bg: 'rgba(0, 102, 255, 0.12)', border: 'rgba(0, 102, 255, 0.25)' },
  100: { label: 'Dolgu', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)', border: 'rgba(147, 51, 234, 0.25)' }
};

/**
 * 25 FPS timecode (`HH.MM.SS.FF`) dizgesini standart saat (`HH:MM:SS`) formatına çevirir.
 */
export const formatTcClock = (tc) => {
  if (!tc) return null;
  const parts = String(tc).split(/[:.-]/);
  if (parts.length < 3) return null;
  return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}:${String(parts[2]).padStart(2, '0')}`;
};

/**
 * Saniye cinsinden süreyi okunabilir Türkçe süreye (`X dk Y sn`) dönüştürür.
 */
export const formatSecToReadable = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem} sn`;
  if (rem === 0) return `${m} dk`;
  return `${m} dk ${rem} sn`;
};

/**
 * Verilen tarihin içinde bulunduğu haftanın Pazartesi gününü `yyyy-MM-dd` olarak döndürür.
 */
export const getMondayStr = (dateStr) => {
  try {
    const mondayObj = startOfWeek(parseISO(dateStr), { weekStartsOn: 1 });
    return format(mondayObj, 'yyyy-MM-dd');
  } catch {
    const fallbackMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return format(fallbackMonday, 'yyyy-MM-dd');
  }
};

