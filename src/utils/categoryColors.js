/**
 * @file categoryColors.js
 * @description MAM Resmi Kategorileri ve Semerkand TV Kurumsal 2026 Renk Haritası
 * Kaynak: tokens.json -> renk.kategori ve tema_kurumsal_2026.json
 */

import useThemeStore, { hexToRgba } from '../store/themeStore';

export const MSSQL_CATEGORIES = {
  1:  { id: 1,  name: 'Kadın',                color: '#C56D3B', titleTextColor: '#94522C', bg: 'rgba(197, 109, 59, 0.12)',  border: 'rgba(197, 109, 59, 0.34)',  badge: 'Kadın' },
  2:  { id: 2,  name: 'Haber',                color: '#142A44', titleTextColor: '#142A44', bg: 'rgba(20, 42, 68, 0.12)',    border: 'rgba(20, 42, 68, 0.34)',    badge: 'Haber' },
  3:  { id: 3,  name: 'Tanıtım',              color: '#0C617C', titleTextColor: '#0C617C', bg: 'rgba(12, 97, 124, 0.12)',   border: 'rgba(12, 97, 124, 0.34)',   badge: 'Tanıtım' },
  4:  { id: 4,  name: 'Dini / İlim',          color: '#468625', titleTextColor: '#3C721F', bg: 'rgba(70, 134, 37, 0.12)',   border: 'rgba(70, 134, 37, 0.34)',   badge: 'Dini' },
  5:  { id: 5,  name: 'Çocuk / Gençlik',      color: '#70AC42', titleTextColor: '#49702B', bg: 'rgba(112, 172, 66, 0.12)',  border: 'rgba(112, 172, 66, 0.34)',  badge: 'Çocuk' },
  6:  { id: 6,  name: 'Reklam',               color: '#E8B44C', titleTextColor: '#80632A', bg: 'rgba(232, 180, 76, 0.12)',  border: 'rgba(232, 180, 76, 0.34)',  badge: 'Reklam' },
  7:  { id: 7,  name: 'Jenerik / İntro',      color: '#0A101D', titleTextColor: '#0A101D', bg: 'rgba(10, 16, 29, 0.12)',    border: 'rgba(10, 16, 29, 0.34)',    badge: 'Jenerik' },
  8:  { id: 8,  name: 'Kültür / Tarih',       color: '#ED891E', titleTextColor: '#9A5914', bg: 'rgba(237, 137, 30, 0.12)',  border: 'rgba(237, 137, 30, 0.34)',  badge: 'Kültür' },
  9:  { id: 9,  name: 'Sohbet / Tasavvuf',    color: '#058193', titleTextColor: '#046E7D', bg: 'rgba(5, 129, 147, 0.12)',   border: 'rgba(5, 129, 147, 0.34)',   badge: 'Sohbet' },
  10: { id: 10, name: 'Kısa Program / Dolgu', color: '#109AAD', titleTextColor: '#0B6C79', bg: 'rgba(16, 154, 173, 0.12)',  border: 'rgba(16, 154, 173, 0.34)',  badge: 'Kısa' },
  11: { id: 11, name: 'Ham',                  color: '#5B5F66', titleTextColor: '#5B5F66', bg: 'rgba(91, 95, 102, 0.12)',   border: 'rgba(91, 95, 102, 0.34)',   badge: 'Ham' }
};

function getResolvedCategoryMeta(catId) {
  const base = MSSQL_CATEGORIES[catId];
  if (!base) return null;
  const custom = useThemeStore.getState()?.config?.categoryColors?.[catId];
  const color = custom?.color || base.color;
  const titleTextColor = custom?.titleTextColor || base.titleTextColor || color;
  return {
    ...base,
    color,
    titleTextColor,
    bg: hexToRgba(color, 0.12),
    bgColor: hexToRgba(color, 0.12),
    border: hexToRgba(color, 0.34),
    borderColor: hexToRgba(color, 0.34)
  };
}

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
  if (categoryId && MSSQL_CATEGORIES[categoryId]) {
    const meta = getResolvedCategoryMeta(categoryId);
    return {
      name: categoryName || meta.name,
      bg: meta.color,
      color: '#fff',
      textColor: meta.titleTextColor,
      titleTextColor: meta.titleTextColor,
      badgeBg: meta.bg,
      border: meta.border,
      badge: meta.badge,
      id: meta.id
    };
  }

  const rawName = (categoryName || '').trim();
  const n = rawName.toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/i̇/g, 'i').replace(/İ/g, 'i').replace(/I/g, 'i')
    .replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o');

  let matchId = null;
  if (n.includes('kadin') || n.includes('aile')) matchId = 1;
  else if (n.includes('haber')) matchId = 2;
  else if (n.includes('tanitim') || n.includes('fragman')) matchId = 3;
  else if (n.includes('sohbet') || n.includes('tasavvuf') || n.includes('detay')) matchId = 9;
  else if (n.includes('dini') || n.includes('ilim')) matchId = 4;
  else if (n.includes('cocuk') || n.includes('genclik')) matchId = 5;
  else if (n.includes('reklam')) matchId = 6;
  else if (n.includes('jenerik') || n.includes('intro')) matchId = 7;
  else if (n.includes('kultur') || n.includes('tarih') || n.includes('dizi') || n.includes('drama') || n.includes('belgesel')) matchId = 8;
  else if (n.includes('kisa') || n.includes('dolgu')) matchId = 10;
  else if (n.includes('ham')) matchId = 11;

  if (matchId) {
    const match = getResolvedCategoryMeta(matchId);
    return {
      name: rawName || match.name,
      bg: match.color,
      color: '#fff',
      textColor: match.titleTextColor,
      titleTextColor: match.titleTextColor,
      badgeBg: match.bg,
      border: match.border,
      badge: match.badge,
      id: match.id
    };
  }

  return {
    name: rawName || 'Genel Yayın',
    bg: '#5B5F66',
    color: '#fff',
    textColor: '#5B5F66',
    titleTextColor: '#5B5F66',
    badgeBg: 'rgba(91, 95, 102, 0.12)',
    border: 'rgba(91, 95, 102, 0.34)',
    badge: 'Genel',
    id: null
  };
};
