/**
 * @file categoryColors.js
 * @description MAM Resmi Kategorileri ve Renk Haritası
 * 
 * MSSQL Kategorileri:
 * 1: Kadın
 * 2: Haber
 * 3: Tanıtım
 * 4: Dini
 * 5: Çocuk
 * 6: Reklam
 * 7: Jenerik
 * 8: Kültürel
 * 9: Detay
 * 10: Kısa Program
 * 11: Ham
 */

import useThemeStore, { hexToRgba } from '../store/themeStore';

export const MSSQL_CATEGORIES = {
  1: { id: 1, name: 'Kadın', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.4)', color: '#ec4899', badge: 'Kadın' },
  2: { id: 2, name: 'Haber', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', badge: 'Haber' },
  3: { id: 3, name: 'Tanıtım', bg: 'rgba(20, 184, 166, 0.15)', border: 'rgba(20, 184, 166, 0.4)', color: '#14b8a6', badge: 'Tanıtım' },
  4: { id: 4, name: 'Dini', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', color: '#10b981', badge: 'Dini' },
  5: { id: 5, name: 'Çocuk', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b', badge: 'Çocuk' },
  6: { id: 6, name: 'Reklam', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.4)', color: '#eab308', badge: 'Reklam' },
  7: { id: 7, name: 'Jenerik', bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.4)', color: '#6366f1', badge: 'Jenerik' },
  8: { id: 8, name: 'Kültürel', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', color: '#3b82f6', badge: 'Kültür' },
  9: { id: 9, name: 'Detay', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.4)', color: '#8b5cf6', badge: 'Detay' },
  10: { id: 10, name: 'Kısa Program', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)', color: '#06b6d4', badge: 'Kısa' },
  11: { id: 11, name: 'Ham', bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.4)', color: '#64748b', badge: 'Ham' }
};

function getResolvedCategoryMeta(catId) {
  const base = MSSQL_CATEGORIES[catId];
  if (!base) return null;
  const custom = useThemeStore.getState()?.config?.categoryColors?.[catId];
  const color = custom?.color || base.color;
  return {
    ...base,
    color,
    bg: hexToRgba(color, 0.15),
    bgColor: hexToRgba(color, 0.15),
    border: hexToRgba(color, 0.4),
    borderColor: hexToRgba(color, 0.4)
  };
}

/**
 * Yayın ve MAM Arşiv modüllerinde kullanılan 9 resmi program kategorisi
 * (6: Reklam ve 11: Ham kategorileri hariç tutulur).
 */
export const BROADCAST_CATEGORY_IDS = [1, 2, 3, 4, 5, 7, 8, 9, 10];

export const BROADCAST_CATEGORIES = {
  1: MSSQL_CATEGORIES[1],
  2: MSSQL_CATEGORIES[2],
  3: MSSQL_CATEGORIES[3],
  4: MSSQL_CATEGORIES[4],
  5: MSSQL_CATEGORIES[5],
  7: MSSQL_CATEGORIES[7],
  8: MSSQL_CATEGORIES[8],
  9: MSSQL_CATEGORIES[9],
  10: MSSQL_CATEGORIES[10]
};

export const getCategoryDetails = (categoryId, categoryName) => {
  // 1. Doğrudan ID eşleşmesi
  if (categoryId && MSSQL_CATEGORIES[categoryId]) {
    const meta = getResolvedCategoryMeta(categoryId);
    return {
      name: categoryName || meta.name,
      bg: meta.color,
      color: '#fff',
      textColor: meta.color,
      badgeBg: meta.bg,
      border: meta.border,
      badge: meta.badge,
      id: meta.id
    };
  }

  // 2. İsim eşleşmesi (Türkçe karakter toleranslı)
  const rawName = (categoryName || '').trim();
  const n = rawName.toLowerCase()
    .replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/İ/g, 'i').replace(/I/g, 'i')
    .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o');

  let matchId = null;
  if (n.includes('kadin') || n.includes('aile')) matchId = 1;
  else if (n.includes('haber')) matchId = 2;
  else if (n.includes('tanitim') || n.includes('fragman')) matchId = 3;
  else if (n.includes('dini') || n.includes('ilim') || n.includes('sohbet') || n.includes('tasavvuf')) matchId = 4;
  else if (n.includes('cocuk') || n.includes('genclik')) matchId = 5;
  else if (n.includes('reklam')) matchId = 6;
  else if (n.includes('jenerik')) matchId = 7;
  else if (n.includes('kultur') || n.includes('tarih') || n.includes('dizi') || n.includes('drama') || n.includes('belgesel')) matchId = 8;
  else if (n.includes('detay')) matchId = 9;
  else if (n.includes('kisa') || n.includes('dolgu')) matchId = 10;
  else if (n.includes('ham')) matchId = 11;

  if (matchId) {
    const match = getResolvedCategoryMeta(matchId);
    return {
      name: rawName || match.name,
      bg: match.color,
      color: '#fff',
      textColor: match.color,
      badgeBg: match.bg,
      border: match.border,
      badge: match.badge,
      id: match.id
    };
  }

  // Varsayılan
  return {
    name: rawName || 'Genel Yayın',
    bg: '#64748b',
    color: '#fff',
    textColor: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    border: 'rgba(100, 116, 139, 0.4)',
    badge: 'Genel',
    id: null
  };
};
