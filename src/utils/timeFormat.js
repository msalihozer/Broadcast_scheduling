/**
 * @file src/utils/timeFormat.js
 * @description Ondalıklı dakika (minutesFloat) değerlerini 25 FPS televizyon yayıncılığı standardında
 * HH:MM:SS:FF (Saat:Dakika:Saniye:Kare) formatına dönüştüren yardımcı fonksiyonlar.
 */
export const formatTime = (minutesFloat) => {
  if (isNaN(minutesFloat) || minutesFloat === null) return "00:00:00:00";
  // Dakikayı milisaniyeye çevirip frame hesabına uygun olarak böleceğiz
  const totalMs = Math.round(minutesFloat * 60000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  
  // 25 fps formatı için 1 frame = 40ms. Kalan milisaniyeyi frame'e (saliseye/kareye) çevir
  const f = Math.floor((totalMs % 1000) / 40); 
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
};

export const formatTotalDuration = formatTime;
export const formatDuration = formatTime;
export const formatExactTime = formatTime;
