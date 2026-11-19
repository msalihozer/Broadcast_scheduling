/**
 * @file draftConstants.jsx
 * @description Taslak Planlama modülü sabitleri ve yapılandırmaları.
 */
import React from 'react';
import { Film, Music, BookOpen } from 'lucide-react';

/**
 * 44. Hafta Gün Anahtarları (2025-10-27 - 2025-11-02)
 */
export const DAYS_KEYS = [
  '2025-10-27',
  '2025-10-28',
  '2025-10-29',
  '2025-10-30',
  '2025-10-31',
  '2025-11-01',
  '2025-11-02'
];

/**
 * Haftalık Dizi Dağılım Kotaları (Hedef Gün Sayısı ve Renk Kodu)
 */
export const SERIES_QUOTAS = [
  { name: 'Kısas-ı Enbiya', count: 5, color: '#3b82f6' },
  { name: 'Çerçeve', count: 4, color: '#6366f1' },
  { name: 'Hasbihal', count: 5, color: '#8b5cf6' },
  { name: 'Beş Vakit Bir Şehir', count: 7, color: '#ec4899' },
  { name: 'Semerkand Sohbetleri', count: 7, color: '#10b981' },
  { name: 'Hacegan Sohbetleri', count: 7, color: '#14b8a6' },
  { name: 'Yüzyılın Alimleri', count: 7, color: '#f59e0b' },
  { name: 'Güzergah', count: 7, color: '#f97316' },
  { name: 'Bedesten', count: 6, color: '#06b6d4' }
];

/**
 * Kısa Kuşak / Dolgu Seçenekleri İkon Haritası
 */
export const OPTION_ICONS = {
  'Kısa Program': <Film size={12} />,
  'Kaside': <Music size={12} />,
  'Aşr-ı Şerif': <BookOpen size={12} />
};
