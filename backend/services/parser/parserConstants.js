/**
 * @file backend/services/parser/parserConstants.js
 * @description MAM Arşiv ayrıştırıcı (parser) modülü için ortak sabitler,
 * hariç tutulan klip filtreleri (cln, clean, kullanma, iptal, ham),
 * varsayılan program eşleştirme kuralları ve metin/süre biçimlendirme yardımcıları.
 */

/**
 * Yayın ve MAM Arşiv modüllerinde çekilecek resmi program kategorileri
 * (6: Reklam ve 11: Ham hariç tutulur; Reklam yalnızca Reklam Yönetimi alanında çekilir).
 */
export const BROADCAST_CATEGORY_IDS = [1, 2, 3, 4, 5, 7, 8, 9, 10];

/**
 * MSSQL sorgularında cln, clean, kullanma, iptal, silme ve ham klipleri filtreleyen SQL koşulu.
 */
export const SQL_EXCLUDE_CLIPS_FILTER = `
  AND f.name NOT LIKE '%cln%'
  AND f.name NOT LIKE '%clean%'
  AND f.name NOT LIKE '%kullanma%'
  AND f.name NOT LIKE '%iptal%'
  AND f.name NOT LIKE 'silme[_]%'
  AND f.name NOT LIKE 'ham[_]%'
  AND f.name NOT LIKE '%[_]ham'
`;

/**
 * Türkçe haftanın günleri (Delailü'l-Hayrat gibi 'gun' birimli programlar için).
 */
export const TURKISH_WEEKDAYS = [
    { rx: /pazartesi|pzt/i, order: 1, label: 'Pazartesi Günü' },
    { rx: /sal[ıi]/i, order: 2, label: 'Salı Günü' },
    { rx: /[cç]ar[sş]amba|crs/i, order: 3, label: 'Çarşamba Günü' },
    { rx: /per[sş]embe|prs/i, order: 4, label: 'Perşembe Günü' },
    { rx: /cumartesi|cmt/i, order: 6, label: 'Cumartesi Günü' }, // cumartesi, cuma'dan önce kontrol edilmeli
    { rx: /cuma(?!rtesi)/i, order: 5, label: 'Cuma Günü' },
    { rx: /pazar(?!tesi)/i, order: 7, label: 'Pazar Günü' }
];

/**
 * Varsayılan Program Eşleştirme ve Birim (Bölüm / Cüz / Gün) Kuralları.
 * Admin Panel üzerinden ekleme/çıkarma/düzenleme yapılabilir ve PostgreSQL archive_parsing_rules tablosunda saklanır.
 */
export const DEFAULT_PARSING_RULES = [
    {
        id: 1,
        programTitle: 'Hatm-i Şerif',
        categoryId: 4,
        matchPatterns: 'hatmiserif, hatmi_serif, hatim_i_serif, hatim_cuz, hatim_duas, hatim_duasi',
        excludePatterns: 'mukabele, tnt_',
        unitType: 'cuz', // 'bolum' | 'cuz' | 'gun'
        extractSource: 'both', // 'filename' | 'metadata' | 'both'
        description: 'Cüz bilgisini isim ve metadatadan çeker (1-30. Cüz). Mukabele ayrı bir program olarak tutulur.',
        isSystem: true
    },
    {
        id: 2,
        programTitle: 'Mukabele',
        categoryId: 4,
        matchPatterns: 'mukabele',
        excludePatterns: '40_hadis, kitabimiz_kuran, lugat, tnt_',
        unitType: 'cuz',
        extractSource: 'both',
        description: 'Sadece Mukabele olan programlar Hatm-i Şerif\'ten ayrı tutulur ve Cüz bilgisi çekilir.',
        isSystem: true
    },
    {
        id: 3,
        programTitle: 'Beş Vakit Bir Şehir',
        categoryId: 8,
        matchPatterns: '5vakit1sehir, 5vakit_1sehir, 5v_1s, 5v1s, bes_vakit, beş_vakit',
        excludePatterns: 'jenerik, autoparts, bes_vakit_namaz, suna, sundu, d-ediyor, d-edecek',
        unitType: 'bolum',
        extractSource: 'metadata',
        description: '5vakit1sehir şeklinde isimlendirme ile gelir; bölüm bilgisi dosya isminden değil metadatadan alınır.',
        isSystem: true
    },
    {
        id: 4,
        programTitle: 'Son İnci',
        categoryId: 4,
        matchPatterns: 's_inci, son_inci, sozun_incisi',
        excludePatterns: '',
        unitType: 'bolum',
        extractSource: 'filename',
        description: 's_inci_<bölüm_numarası> şeklinde gelir; bölüm numaraları doğrudan dosya ismi üzerinden çekilir.',
        isSystem: true
    },
    {
        id: 5,
        programTitle: "Delailü'l-Hayrat",
        categoryId: 4,
        matchPatterns: 'delail_hayrat, delailul_hayrat, delail',
        excludePatterns: 'minhacus_seni',
        unitType: 'gun',
        extractSource: 'filename',
        description: 'Bölüm olarak değil Gün şeklinde gelir; hangi gün olduğu (Pazartesi..Pazar) dosya isminden çekilir.',
        isSystem: true
    },
    {
        id: 6,
        programTitle: 'Tefsiri Mevakib',
        categoryId: 4,
        matchPatterns: 'tefsiri_mevakib, tefsir_i_mevakib, mevakib',
        excludePatterns: '',
        unitType: 'cuz',
        extractSource: 'metadata',
        description: 'Bölüm olarak değil Cüz şeklinde gelir; cüz ve sure bilgisi metadatadan çekilir.',
        isSystem: true
    },
    {
        id: 7,
        programTitle: 'İlim Dersleri- Tecvid',
        categoryId: 4,
        matchPatterns: 'i_dersleri_tecvid, ilim_dersleri_tecvid, tecvid_',
        excludePatterns: 'tnt_, autoparts, sunar, sundu',
        unitType: 'bolum',
        extractSource: 'both',
        description: 'İlim Dersleri - Tecvid bölümlerini (1..131) dosya ismi ve metadatadan ayrıştırır.',
        isSystem: true
    }
];

/**
 * Bir klibin adında, dosya adında veya metadata'sında cln, clean, kullanma, iptal, ham
 * ifadelerinin olup olmadığını denetler. True dönerse klip arşive/listeye dahil edilmez.
 */
export function isExcludedClip(rawName = '', fileName = '', metadataArr = []) {
    const combined = `${rawName || ''} ${fileName || ''}`.trim();
    if (!combined) return true;

    // 1. cln / clean / kullanma / kullanmayın / iptal / silme / ham kontrolü
    if (/(?:^|[\s_\-.()])(?:cln|clean|iptal|silme|bozuk[\s_-]*ses|ham)(?:$|[\s_\-.()]|\d)/i.test(combined)) {
        return true;
    }
    if (/(?:kullanma|kullanmayin|kullanmayın|eski_kullanma)/i.test(combined)) {
        return true;
    }
    if (/^(?:cln|clean|ham|kullanma|iptal|silme)[\s_-]/i.test(rawName || '')) {
        return true;
    }
    if (/[\s_-](?:cln|clean|ham|kullanma|iptal)$/i.test(rawName || '')) {
        return true;
    }

    // 2. Metadata içinde Video Durumu = Clean / Ham veya Onay Durumu = Kullanma/İptal kontrolü
    if (Array.isArray(metadataArr)) {
        for (const item of metadataArr) {
            if (!item || !item.keyName) continue;
            const k = String(item.keyName).toLocaleLowerCase('tr-TR').trim();
            const v = String(item.val || '').toLocaleLowerCase('tr-TR').trim();
            if ((k.includes('video durumu') || k.includes('onay durumu')) && /(?:clean|cln|ham|kullanma|iptal)/i.test(v)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Kelimeleri düzgün Başlık Düzenine (Title Case) çevirir.
 */
export function toTitleCase(str) {
    if (!str) return '';
    const words = str.trim().split(/[\s_]+/);
    return words.map(w => {
        if (!w) return '';
        const lower = w.toLowerCase();
        if (['tv', 'vtr', 'tnt', 'hd', 'sd', 'p1', 'p2', 'p3', 'p4', 'btv', 'dsf'].includes(lower)) return lower.toUpperCase();
        return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
    }).join(' ');
}

/**
 * Saniyeyi HH.MM.SS.FF formatına çevirir.
 */
export function formatSeconds(totalSec) {
    if (!totalSec || isNaN(totalSec)) return '00.00.00.00';
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = Math.floor(totalSec % 60);
    return `${h.toString().padStart(2, '0')}.${m.toString().padStart(2, '0')}.${s.toString().padStart(2, '0')}.00`;
}

/**
 * Türkçe karakterleri normalize ederek esnek eşleşme metni üretir.
 */
export function normalizeForMatch(str = '') {
    return String(str || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');
}

