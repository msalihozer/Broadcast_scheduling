/**
 * @file src/modules/ads/utils/adsAutoSyncEngine.js
 * @description Reklam Rezervasyon Modülü için:
 * 1. MAM Arşivi Veritabanı (`/api/archive/ads` - MSSQL Kategori 6), `adsMedia.json` ve `adsData.json`
 *    kaynaklarından Firmalar, Ürünler ve Materyalleri (Klipleri) otomatik ayrıştırıp senkronize eden motor.
 * 2. Medya Kütüphanesi ve Materyaller için Firma - Ürün - Materyal - Yükleme Zamanı - Süre (sn) zenginleştirmesi.
 * 3. Profesyonel Reklam Rezervasyon Raporlama Motoru (Hangi reklam kaç defa, toplam kaç saniye,
 *    günde ortalama kaç defa, hangi saatlerde ve hangi kuşaklarda yayınlandı analizi).
 */

/**
 * Klip adından veya dosya tarihinden YYYY-MM-DD formatında yükleme zamanı ve ISO timestamp çıkarır.
 * Örn: "r_montex_auto_care_31sn_211026" -> "2026-10-21"
 */
export function extractUploadDateFromClip(rawName = '', fileCreateTime = null) {
  if (fileCreateTime) {
    try {
      const d = new Date(fileCreateTime);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2035) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
  }

  const name = String(rawName || '').trim();

  // 1. Sondaki 6 haneli GGAAYY tarihi (örn: _211026 -> 21.10.2026)
  const sixDigitMatch = name.match(/[_-](\d{2})(\d{2})(\d{2})(?:[_-][a-z0-9]+)?$/i);
  if (sixDigitMatch) {
    const day = parseInt(sixDigitMatch[1], 10);
    const month = parseInt(sixDigitMatch[2], 10);
    const yearShort = parseInt(sixDigitMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const fullYear = yearShort <= 40 ? 2000 + yearShort : 1900 + yearShort;
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 2. Sondaki 8 haneli GGAAYYYY tarihi
  const eightDigitMatch = name.match(/[_-](\d{2})(\d{2})(20\d{2})$/);
  if (eightDigitMatch) {
    const day = parseInt(eightDigitMatch[1], 10);
    const month = parseInt(eightDigitMatch[2], 10);
    const year = parseInt(eightDigitMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // 3. İsim içinde geçen 4 haneli yıl (örn: 2024, 2025, 2026)
  const yearMatch = name.match(/(?:^|[_-])(20[12]\d)(?:[_-]|$)/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-15`;
  }

  return '2024-06-01';
}

export function extractUploadTimestamp(rawName = '', fileCreateTime = null, fallbackUploadDate = '') {
  if (fileCreateTime) {
    try {
      const d = new Date(fileCreateTime);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2035) {
        return d.toISOString();
      }
    } catch (e) {}
  }
  const dateStr = fallbackUploadDate || extractUploadDateFromClip(rawName, null);
  return `${dateStr}T12:00:00.000Z`;
}

/**
 * Milisaniye veya saniye olarak gelen süreyi her zaman net saniyeye (sn) çevirir.
 */
export function normalizeAdDurationSeconds(rawDuration, clipName = '') {
  const num = Number(rawDuration) || 0;
  if (num > 600) {
    return Math.max(1, Math.round(num / 1000));
  }
  if (num > 0) {
    return Math.max(1, Math.round(num));
  }
  const snMatch = String(clipName || '').match(/[_-](\d{1,3})\s*sn(?:[_-]|$)/i);
  if (snMatch) {
    return parseInt(snMatch[1], 10);
  }
  return 30;
}

/**
 * Milisaniye veya saniye olarak gelen süreyi hassas milisaniye (ms) olarak döndürür (Frame/Kare hesabı için).
 */
export function normalizeAdDurationMs(rawDuration, fallbackSec = 30) {
  const num = Number(rawDuration) || 0;
  if (num > 600) {
    return Math.round(num);
  }
  if (num > 0) {
    return Math.round(num * 1000);
  }
  return Math.round((Number(fallbackSec) || 30) * 1000);
}

/**
 * "kullanma", "sil", "silll", "cln", "clean" gibi yayına uygun olmayan reklam kayıtlarını tespit eder.
 */
export function isExcludedAdItem(name = '', clipName = '', description = '') {
  const combined = `${name || ''} ${clipName || ''} ${description || ''}`.toLocaleLowerCase('tr-TR');
  if (
    combined.includes('kullanma') ||
    combined.includes('silll') ||
    combined.includes('s i l') ||
    /^sil[\s_-]/i.test(name || '') ||
    /(?:^|[\s_.-])(cln|clean|iptal)(?:$|[\s_.-])/i.test(combined)
  ) {
    return true;
  }
  return false;
}

/**
 * Bilinen marka/firma anahtar kelimelerine göre temiz Firma Adı ve Ürün/Kampanya Adı çıkarır.
 */
const BRAND_DICTIONARY = [
  { rx: /ucuncu[\s_-]*binyil|üçüncü[\s_-]*binyıl|├╝c├╝nc├╝[\s_-]*binyil/i, company: 'ÜÇÜNCÜ BİNYIL AKADEMİ', product: 'Üçüncü Binyıl Eğitim & Akademi' },
  { rx: /aile[\s_-]*dergi|abone[\s_-]*\d*[\s_-]*aile/i, company: 'SEMERKAND YAYINLARI', product: 'Semerkand Aile Dergisi' },
  { rx: /mostar/i, company: 'SEMERKAND YAYINLARI', product: 'Mostar Dergisi' },
  { rx: /genc[\s_-]*okur|gencokur/i, company: 'SEMERKAND YAYINLARI', product: 'Genç Okur Dergisi' },
  { rx: /sekeragaci|şekerağacı/i, company: 'SEMERKAND YAYINLARI', product: 'Şekerağacı Dergisi' },
  { rx: /mavi[\s_-]*fidan|mavifidan/i, company: 'MAVİ UÇURTMA YAYINLARI', product: 'Mavi Fidan Çocuk Dergisi' },
  { rx: /alemlere[\s_-]*rahmet/i, company: 'SEMERKAND YAYINLARI', product: 'Alemlere Rahmet Külliyatı' },
  { rx: /delailul[\s_-]*hayrat/i, company: 'SEMERKAND YAYINLARI', product: 'Delailül Hayrat' },
  { rx: /fethur[\s_-]*rabbani/i, company: 'SEMERKAND YAYINLARI', product: 'Fethur Rabbani' },
  { rx: /ihyau[\s_-]*ulumiddin/i, company: 'SEMERKAND YAYINLARI', product: 'İhyau Ulumiddin' },
  { rx: /mushaf/i, company: 'SEMERKAND YAYINLARI', product: 'Mushaf-ı Şerif' },
  { rx: /semerkand[\s_-]*(?:dergi|abone|ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)|abone[\s_-]*\d*[\s_-]*semerkand/i, company: 'SEMERKAND YAYINLARI', product: 'Semerkand Dergisi' },
  { rx: /s-yay|semerkand[\s_-]*(?:yay|kitap|fuar|takvim)|dergiler[\s_-]*hediye/i, company: 'SEMERKAND YAYINLARI', product: 'Kitap & Kültür Yayınları' },
  { rx: /besir|beşir/i, company: 'BEŞİR DERNEĞİ', product: 'İnsani Yardım & Bağış Kampanyaları' },
  { rx: /semersah|semerşah/i, company: 'SEMERŞAH TURİZM', product: 'Hac ve Umre Organizasyonu' },
  { rx: /zehra[\s_-]*(?:grup|otel|villas|tatil)/i, company: 'ZEHRA GRUP OTEL & TATİL KÖYÜ', product: 'Zehra Otel & Villas Turizm' },
  { rx: /ziraat[\s_-]*katilim/i, company: 'ZİRAAT KATILIM BANKASI', product: 'Katılım Bankacılığı Hizmetleri' },
  { rx: /vakif[\s_-]*katilim/i, company: 'VAKIF KATILIM BANKASI', product: 'Katılım Bankacılığı Hizmetleri' },
  { rx: /kuveyt[\s_-]*turk/i, company: 'KUVEYT TÜRK', product: 'Katılım Bankacılığı Hizmetleri' },
  { rx: /albaraka/i, company: 'ALBARAKA TÜRK', product: 'Katılım Bankacılığı Hizmetleri' },
  { rx: /nakis[\s_-]*naksut|naksut/i, company: 'NAKIŞ GIDA', product: 'Naksüt Süt ve Süt Ürünleri' },
  { rx: /nakis[\s_-]*(?:gida[\s_-]*)?kumanya/i, company: 'NAKIŞ GIDA', product: 'Nakış Gıda Kumanya Paketi' },
  { rx: /nakis[\s_-]*(?:gida|cocuk|kandil|simidi)/i, company: 'NAKIŞ GIDA', product: 'Nakış Gıda & Unlu Mamuller' },
  { rx: /emsey/i, company: 'EMSEY HASTANESİ', product: 'Sağlık Hizmetleri & Check-Up' },
  { rx: /tabar[\s_-]*lojistik/i, company: 'TABAR LOJİSTİK', product: 'Uluslararası Lojistik Hizmetleri' },
  { rx: /recistan/i, company: 'RECİSTAN TURİZM', product: 'Kültür Turları & Turizm' },
  { rx: /hidro[\s_-]*eren/i, company: 'HİDRO EREN VİNÇ', product: 'Endüstriyel Vinç Sistemleri' },
  { rx: /gokturk[\s_-]*proje|göktürk/i, company: 'GÖKTÜRK PROJE DANIŞMANLIK', product: 'Mühendislik & Proje Danışmanlığı' },
  { rx: /zariftat/i, company: 'ZARİFTAT GIDA', product: 'Geleneksel Tatlı & Gıda' },
  { rx: /el[\s_-]*medine/i, company: 'EL MEDİNE', product: 'Hac & Umre Malzemeleri' },
  { rx: /gapex/i, company: 'GAPEX PLASTİK & YAPI', product: 'Yapı & Endüstri Ürünleri' },
  { rx: /hyperus/i, company: 'HYPERUS GMBH', product: 'Avrupa Kurumsal Hizmetler' },
  { rx: /moexclusive|mo[\s_-]*xclusive/i, company: 'MO EXCLUSIVE GMBH', product: 'Otomotiv & Exclusive Hizmetler' },
  { rx: /premium[\s_-]*selection/i, company: 'PREMIUM SELECTION AUTO', product: 'Premium Otomotiv' },
  { rx: /osmanli[\s_-]*sofrasi/i, company: 'OSMANLI SOFRASI', product: 'Restoran & Gastronomi' },
  { rx: /hasimi|haşimi/i, company: 'HAŞİMİ SOFRASI', product: 'Restoran & Gastronomi' },
  { rx: /mutes[\s_-]*yazilim/i, company: 'MUTES YAZILIM', product: 'Teknodünya & Etiket Yazılım Sistemleri' },
  { rx: /erdos[\s_-]*gmbh/i, company: 'ERDOS GMBH', product: 'Avrupa Kurumsal Tanıtım' },
  { rx: /eras[\s_-]*gmbh/i, company: 'ERAS GMBH', product: 'Avrupa Kurumsal Tanıtım' },
  { rx: /mars[\s_-]*gmbh/i, company: 'MARS GMBH', product: 'Avrupa Kurumsal Tanıtım' },
  { rx: /pars[\s_-]*gmbh/i, company: 'PARS GMBH', product: 'Avrupa Kurumsal Tanıtım' },
  { rx: /westwind[\s_-]*gmbh/i, company: 'WESTWIND GMBH', product: 'Avrupa Kurumsal Tanıtım' },
  { rx: /rg[\s_-]*bau/i, company: 'RG BAU', product: 'İnşaat & Yapı Sistemleri' },
  { rx: /efebau/i, company: 'EFEBAU İNŞAAT', product: 'İnşaat & Yapı Sistemleri' },
  { rx: /yt[\s_-]*holding/i, company: 'YT HOLDİNG', product: 'Kurumsal Holding Tanıtımı' },
  { rx: /kartvizit/i, company: 'KARTVİZİT REKLAM KUŞAĞI', product: 'Kartvizit Bant Reklamları' },
  { rx: /semerkand[\s_-]*tv|semerkand[\s_-]*hd|semerkand[\s_-]*way/i, company: 'SEMERKAND TV', product: 'Kurumsal Kanal Tanıtımı' }
];

const NOISE_WORDS_SET = new Set([
  'reklam', 'reklami', 'reklamı', 'spot', 'spotu', 'yeni', 'kisa', 'kısa', 'uzun',
  'filmi', 'tanitim', 'tanıtım', 'hayirli', 'hayırlı', 'ramazanlar', 'bayramlar',
  'cumalar', 'kamp', 'kampanya', 'kampanyasi', 'indirim', 'ozel', 'özel',
  'rmz', 'way', 'hd', 'tr', 'avrupa'
]);

export function sanitizeTurkishEncoding(str = '') {
  return String(str || '')
    .replace(/├╝/g, 'ü')
    .replace(/╠£/g, 'Ü')
    .replace(/├§/g, 'ç')
    .replace(/╠ğ/g, 'Ç')
    .replace(/├╢/g, 'ö')
    .replace(/╠û/g, 'Ö')
    .replace(/─▒/g, 'ı')
    .replace(/─░/g, 'İ')
    .replace(/┼ş/g, 'ş')
    .replace(/┼İ/g, 'Ş')
    .replace(/─ş/g, 'ğ')
    .replace(/─Ю/g, 'Ğ')
    .replace(/Ä°/g, 'İ')
    .replace(/Ä±/g, 'ı')
    .replace(/Ãœ/g, 'Ü')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã–/g, 'Ö')
    .replace(/Ã¶/g, 'ö')
    .replace(/Åž/g, 'Ş')
    .replace(/ÅŸ/g, 'ş')
    .replace(/Äž/g, 'Ğ')
    .replace(/ÄŸ/g, 'ğ');
}

export function formatCleanTitle(str = '') {
  return sanitizeTurkishEncoding(str)
    .replace(/^r[_-]/i, '')
    .replace(/\.mxf$/i, '')
    .replace(/[_-]\d{6,8}$/i, '')
    .replace(/[_-]\d{1,3}\s*sn(?:[_-]|$)/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1).toLocaleLowerCase('tr-TR'))
    .join(' ');
}

/**
 * Bir reklam klibinin adından Firma, Ürün ve Materyal başlığını akıllı olarak çözümler.
 */
export function resolveClipCompanyAndProduct(clipName = '', metaCompany = '', fallbackTitle = '') {
  const raw = sanitizeTurkishEncoding(String(clipName || fallbackTitle || '').trim());
  const cleanFallback = sanitizeTurkishEncoding(fallbackTitle);
  const cleanMetaCompany = sanitizeTurkishEncoding(metaCompany);
  const cleanMaterialTitle = formatCleanTitle(raw) || formatCleanTitle(cleanFallback) || raw;

  // 1. Önce bilinen kurumsal marka sözlüğüne bak
  for (const rule of BRAND_DICTIONARY) {
    if (rule.rx.test(raw) || (cleanFallback && rule.rx.test(cleanFallback))) {
      return {
        companyName: rule.company,
        productName: rule.product,
        materialTitle: cleanMaterialTitle
      };
    }
  }

  // 2. Eğer veritabanı FileMetadata'sından açık şirket/marka adı geldiyse kullan
  if (cleanMetaCompany && String(cleanMetaCompany).trim().length >= 2) {
    const compUpper = String(cleanMetaCompany).trim().toLocaleUpperCase('tr-TR');
    return {
      companyName: compUpper,
      productName: cleanMaterialTitle || `${formatCleanTitle(compUpper)} Kampanyası`,
      materialTitle: cleanMaterialTitle
    };
  }

  // 3. Klip adındaki kelimelerden Firma ve Ürün ayrıştır (örn: r_montex_auto_care_31sn_211026)
  const stripped = raw
    .replace(/^r[_-]/i, '')
    .replace(/\.mxf$/i, '')
    .replace(/[_-]\d{6,8}$/i, '')
    .replace(/[_-]\d{1,3}\s*sn(?:[_-]|$)/gi, '');

  const allTokens = stripped
    .split(/[_-\s]+/)
    .map(t => t.trim())
    .filter(t => t && !/^\d+$/.test(t));

  const coreTokens = allTokens.filter(t => !NOISE_WORDS_SET.has(t.toLocaleLowerCase('tr-TR')));
  const effectiveTokens = coreTokens.length > 0 ? coreTokens : allTokens;

  if (effectiveTokens.length >= 2) {
    // İlk 2 anlamlı kelime Firma Adı (örn: "MONTEX AUTO", "GULERYUZ ASANSOR", "DINCEL KUYUMCULUK")
    const companyName = effectiveTokens.slice(0, 2).join(' ').toLocaleUpperCase('tr-TR');
    // Eğer 3 veya daha fazla kelime varsa kalanı ürün/kampanya, yoksa temiz başlık
    const productTokens = effectiveTokens.length >= 3 ? effectiveTokens : allTokens;
    const productName = formatCleanTitle(productTokens.join(' ')) || `${formatCleanTitle(companyName)} Reklam Kampanyası`;

    return {
      companyName,
      productName,
      materialTitle: cleanMaterialTitle || productName
    };
  }

  if (effectiveTokens.length === 1) {
    const companyName = effectiveTokens[0].toLocaleUpperCase('tr-TR');
    const productName = `${formatCleanTitle(effectiveTokens[0])} Tanıtım & Reklam`;
    return {
      companyName,
      productName,
      materialTitle: cleanMaterialTitle || productName
    };
  }

  return {
    companyName: 'GENEL REKLAMVEREN',
    productName: cleanMaterialTitle || 'Genel Reklam Kampanyası',
    materialTitle: cleanMaterialTitle || raw || 'Reklam Spotu'
  };
}

/**
 * Canlı DB (`/api/archive/ads`), `adsMedia.json` ve `adsData.json` verilerini birleştirerek:
 * - Firmaları (`companies`)
 * - Ürünleri (`products`)
 * - Materyalleri / Klipleri (`materials`)
 * otomatik olarak oluşturur, birbirine bağlar ve en son yüklenen klipten eskiye doğru sıralar.
 */
export function buildAutoSyncedAdsCatalog({
  baseCompanies = [],
  baseProducts = [],
  baseMaterials = [],
  adsMediaList = [],
  remoteArchiveAds = []
}) {
  const companiesMap = new Map(); // id -> companyObj
  const companyIdByNormName = new Map(); // normName -> id

  const normalizeKey = (s = '') =>
    String(s || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  // Torba / jenerik firma isimleri (yalnızca geçersiz test/sil kayıtlarını hariç tut)
  const BUCKET_COMPANY_IDS = new Set(['154', '174']);
  const BUCKET_COMPANY_NAMES = new Set(['ramazan2020', 'sil', 'test']);

  // 1. Mevcut Firmaları Yükle (Tüm kayıtlı firmaları eksiksiz koru)
  baseCompanies.forEach(c => {
    if (!c || !c.name) return;
    const idStr = String(c.id);
    const cleanName = sanitizeTurkishEncoding(String(c.name).trim());
    const norm = normalizeKey(cleanName);
    if (!norm || BUCKET_COMPANY_IDS.has(idStr) || BUCKET_COMPANY_NAMES.has(norm)) return;
    if (isExcludedAdItem(cleanName)) return;

    if (companyIdByNormName.has(norm)) return;

    companiesMap.set(idStr, {
      ...c,
      id: idStr,
      name: cleanName.toLocaleUpperCase('tr-TR'),
      contactPerson: c.contactPerson && c.contactPerson !== 'X' ? c.contactPerson.trim() : '',
      phone: c.phone && c.phone !== 'X' ? c.phone.trim() : '',
      email: c.email && c.email !== 'X' ? c.email.trim() : '',
      website: c.website && c.website !== 'X' ? c.website.trim() : '',
      address: c.address && c.address !== 'X' ? c.address.trim() : '',
      isAutoSynced: Boolean(c.isAutoSynced),
      isManual: Boolean(c.isManual)
    });
    companyIdByNormName.set(norm, idStr);
  });

  const getOrCreateCompany = (companyName) => {
    const clean = sanitizeTurkishEncoding(String(companyName || 'GENEL REKLAMVEREN').trim()).toLocaleUpperCase('tr-TR');
    const norm = normalizeKey(clean);
    if (!norm) return getOrCreateCompany('GENEL REKLAMVEREN');

    if (companyIdByNormName.has(norm)) {
      return companiesMap.get(companyIdByNormName.get(norm));
    }

    const newId = `comp-${norm}`;
    const newComp = {
      id: newId,
      name: clean,
      contactPerson: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      isAutoSynced: true
    };
    companiesMap.set(newId, newComp);
    companyIdByNormName.set(norm, newId);
    return newComp;
  };

  // 2. Mevcut Ürünleri Yükle
  const productsMap = new Map(); // id -> productObj
  const productKeyMap = new Map(); // `${companyId}::${normProdName}` -> id

  baseProducts.forEach(p => {
    if (!p || !p.name) return;
    const cleanName = String(p.name).replace(/^-+\s*/, '').trim();
    if (!cleanName || isExcludedAdItem(cleanName) || /test/i.test(cleanName)) return;
    const idStr = String(p.id);
    const compId = String(p.companyId || '');
    if (!companiesMap.has(compId)) return;

    const normP = normalizeKey(cleanName);
    const lookupKey = `${compId}::${normP}`;
    if (productKeyMap.has(lookupKey)) return;

    const prodObj = {
      ...p,
      id: idStr,
      companyId: compId,
      name: cleanName,
      isAutoSynced: Boolean(p.isAutoSynced),
      isManual: Boolean(p.isManual)
    };
    productsMap.set(idStr, prodObj);
    productKeyMap.set(lookupKey, idStr);
  });

  const getOrCreateProduct = (companyId, productName) => {
    const clean = String(productName || 'Genel Kampanya').replace(/^-+\s*/, '').trim();
    const norm = normalizeKey(clean) || 'genelkampanya';
    const lookupKey = `${companyId}::${norm}`;
    if (productKeyMap.has(lookupKey)) {
      return productsMap.get(productKeyMap.get(lookupKey));
    }
    const newId = `prod-${companyId}-${norm}`;
    const newProd = {
      id: newId,
      companyId: String(companyId),
      name: clean,
      isAutoSynced: true
    };
    productsMap.set(newId, newProd);
    productKeyMap.set(lookupKey, newId);
    return newProd;
  };

  // 3. Materyalleri (Klipleri) Birleştir & Otomatik Eşleştir
  const materialsByClipKey = new Map(); // clipId -> materialObj

  // 3a. Önce baseMaterials içindeki kayıtları işle
  baseMaterials.forEach(m => {
    if (!m) return;
    const clipName = String(m.clipName || m.name || '').trim();
    if (isExcludedAdItem(m.name, clipName, m.description)) return;
    if (/^reklam_(?:bayan|erkek|giris|cikis|jenerik)/i.test(clipName)) return;

    const clipIdStr = m.clipId ? String(m.clipId) : String(m.id);
    const durSec = normalizeAdDurationSeconds(m.duration, clipName);
    const durMs = normalizeAdDurationMs(m.durationMs ?? m.duration, durSec);
    const uploadDate = m.uploadDate || extractUploadDateFromClip(clipName, m.fileCreateTime);
    const uploadTimestamp = m.uploadTimestamp || extractUploadTimestamp(clipName, m.fileCreateTime, uploadDate);

    let compId = String(m.companyId || '');
    let prodId = String(m.productId || '');

    // Eğer geçerli bir firmaya bağlıysa o firmayı koru; sadece firma geçersizse klip adından çöz
    if (!m.isManual) {
      if (!companiesMap.has(compId) || BUCKET_COMPANY_IDS.has(compId)) {
        const resolved = resolveClipCompanyAndProduct(clipName, '', m.name);
        const realComp = getOrCreateCompany(resolved.companyName);
        const realProd = getOrCreateProduct(realComp.id, resolved.productName);
        compId = realComp.id;
        prodId = realProd.id;
      } else if (!productsMap.has(prodId)) {
        const resolved = resolveClipCompanyAndProduct(clipName, '', m.name);
        const realProd = getOrCreateProduct(compId, resolved.productName);
        prodId = realProd.id;
      }
    }

    const compObj = companiesMap.get(compId);
    const prodObj = productsMap.get(prodId);
    const cleanMatName = String(m.name || '').replace(/^-+\s*/, '').trim() || formatCleanTitle(clipName);

    materialsByClipKey.set(clipIdStr, {
      id: String(m.id || clipIdStr),
      clipId: clipIdStr,
      name: cleanMatName,
      clipName: clipName || cleanMatName,
      code: m.code || m.fileName || `${clipIdStr}.mxf`,
      companyId: compId,
      companyName: compObj?.name || 'GENEL REKLAMVEREN',
      productId: prodId,
      productName: prodObj?.name || 'Genel Kampanya',
      duration: durSec,
      durationMs: durMs,
      uploadDate,
      uploadTimestamp,
      description: m.description || '',
      isAutoSynced: Boolean(m.isAutoSynced),
      isManual: Boolean(m.isManual)
    });
  });

  // 3b. Canlı DB (`/api/archive/ads` - 1598+ klip) ve `adsMedia.json` içindeki Reklam kliplerini otomatik dahil et
  const dbAdsArray = Array.isArray(remoteArchiveAds)
    ? remoteArchiveAds
    : Array.isArray(remoteArchiveAds?.ads)
    ? remoteArchiveAds.ads
    : Array.isArray(remoteArchiveAds?.clips)
    ? remoteArchiveAds.clips
    : [];

  const localAdsArray = Array.isArray(adsMediaList)
    ? adsMediaList.filter(
        x => !x.category || String(x.category).toLowerCase() === 'reklam' || /^r[_-]/i.test(x.name || '')
      )
    : [];

  // Önce canlı DB kliplerini, sonra yerel medya listesini işle
  const combinedRawMedia = [...dbAdsArray, ...localAdsArray];

  combinedRawMedia.forEach(item => {
    const rawClipName = String(item.name || item.clipName || '').trim();
    const rawCode = String(item.code || item.fileName || '').trim();
    const clipIdStr = String(item.fileId || item.id || rawClipName);

    if (!rawClipName || isExcludedAdItem(rawClipName, rawCode)) return;
    if (/^reklam_(?:bayan|erkek|giris|cikis|jenerik)/i.test(rawClipName)) return;

    const durSec = normalizeAdDurationSeconds(item.durationSec ?? item.duration, rawClipName);
    const durMs = normalizeAdDurationMs(item.durationMs ?? item.duration ?? item.durationSec, durSec);
    const uploadDate = extractUploadDateFromClip(rawClipName, item.fileCreateTime || item.uploadDate);
    const uploadTimestamp = extractUploadTimestamp(rawClipName, item.fileCreateTime, uploadDate);

    const metaCompany = item.metadataSummary?.sirketMarka || item.metadataSummary?.uretici || '';
    const resolved = resolveClipCompanyAndProduct(rawClipName, metaCompany, item.campaign);
    const compObj = getOrCreateCompany(resolved.companyName);
    const prodObj = getOrCreateProduct(compObj.id, resolved.productName);

    if (materialsByClipKey.has(clipIdStr)) {
      const existing = materialsByClipKey.get(clipIdStr);
      // Eğer kullanıcı manuel düzenlemediyse DB'den gelen güncel tarih/süre/dosya kodunu ve eksik firma/ürün bilgisini güncelle
      materialsByClipKey.set(clipIdStr, {
        ...existing,
        code: rawCode || existing.code,
        clipName: rawClipName || existing.clipName,
        duration: durSec || existing.duration,
        durationMs: (Number(item.duration) > 600 ? Number(item.duration) : 0) || existing.durationMs || durMs,
        uploadDate: item.fileCreateTime ? uploadDate : existing.uploadDate,
        uploadTimestamp: item.fileCreateTime ? uploadTimestamp : existing.uploadTimestamp,
        companyId: existing.isManual ? existing.companyId : compObj.id,
        companyName: existing.isManual ? existing.companyName : compObj.name,
        productId: existing.isManual ? existing.productId : prodObj.id,
        productName: existing.isManual ? existing.productName : prodObj.name
      });
      return;
    }

    materialsByClipKey.set(clipIdStr, {
      id: clipIdStr,
      clipId: clipIdStr,
      name: resolved.materialTitle || formatCleanTitle(rawClipName),
      clipName: rawClipName,
      code: rawCode || `${clipIdStr}.mxf`,
      companyId: compObj.id,
      companyName: compObj.name,
      productId: prodObj.id,
      productName: prodObj.name,
      duration: durSec,
      durationMs: durMs,
      uploadDate,
      uploadTimestamp,
      description: item.campaign || '',
      isAutoSynced: true
    });
  });

  // 4. Materyalleri varsayılan olarak EN SON YÜKLENENDEN ESKİYE doğru sırala
  const finalMaterials = Array.from(materialsByClipKey.values()).sort((a, b) => {
    const timeDiff = (b.uploadTimestamp || b.uploadDate || '').localeCompare(a.uploadTimestamp || a.uploadDate || '');
    if (timeDiff !== 0) return timeDiff;
    return ( parseInt(b.clipId, 10) || 0 ) - ( parseInt(a.clipId, 10) || 0 );
  });

  // 5. Ürün ve Firma istatistiklerini (materyal sayısı, son yükleme tarihi, toplam süre) hesapla
  // ve hiç materyali olmayan eski boş ürünleri/firmaları (manuel eklenenler hariç) ayıkla
  const matCountByProd = new Map();
  const matStatsByComp = new Map();

  finalMaterials.forEach(m => {
    // Ürün istatistiği
    const pStat = matCountByProd.get(m.productId) || {
      count: 0,
      totalSec: 0,
      lastUploadDate: m.uploadDate,
      lastUploadTimestamp: m.uploadTimestamp
    };
    pStat.count += 1;
    pStat.totalSec += Number(m.duration) || 0;
    if ((m.uploadTimestamp || '') > (pStat.lastUploadTimestamp || '')) {
      pStat.lastUploadTimestamp = m.uploadTimestamp;
      pStat.lastUploadDate = m.uploadDate;
    }
    matCountByProd.set(m.productId, pStat);

    // Firma istatistiği
    const cStat = matStatsByComp.get(m.companyId) || {
      materialCount: 0,
      totalSec: 0,
      lastUploadDate: m.uploadDate,
      lastUploadTimestamp: m.uploadTimestamp
    };
    cStat.materialCount += 1;
    cStat.totalSec += Number(m.duration) || 0;
    if ((m.uploadTimestamp || '') > (cStat.lastUploadTimestamp || '')) {
      cStat.lastUploadTimestamp = m.uploadTimestamp;
      cStat.lastUploadDate = m.uploadDate;
    }
    matStatsByComp.set(m.companyId, cStat);
  });

  // Her firmanın en az 1 ürünü olmasını garanti et (hiç ürünü olmayan firmalar için genel ürün oluştur)
  companiesMap.forEach(c => {
    const hasAnyProd = Array.from(productsMap.values()).some(p => String(p.companyId) === String(c.id));
    if (!hasAnyProd) {
      getOrCreateProduct(c.id, `${formatCleanTitle(c.name)} Genel Kampanya`);
    }
  });

  const finalProducts = Array.from(productsMap.values())
    .map(p => {
      const st = matCountByProd.get(p.id) || { count: 0, totalSec: 0, lastUploadDate: '2024-01-01', lastUploadTimestamp: '' };
      const comp = companiesMap.get(p.companyId);
      return {
        ...p,
        companyName: comp?.name || 'GENEL REKLAMVEREN',
        materialCount: st.count,
        totalDurationSec: st.totalSec,
        lastUploadDate: st.lastUploadDate,
        lastUploadTimestamp: st.lastUploadTimestamp
      };
    })
    .sort((a, b) => (b.lastUploadTimestamp || '').localeCompare(a.lastUploadTimestamp || '') || b.materialCount - a.materialCount);

  const prodCountByComp = new Map();
  finalProducts.forEach(p => {
    prodCountByComp.set(p.companyId, (prodCountByComp.get(p.companyId) || 0) + 1);
  });

  // Hiçbir firmayı eleme — tüm firmaları eksiksiz döndür
  const finalCompanies = Array.from(companiesMap.values())
    .map(c => {
      const st = matStatsByComp.get(c.id) || { materialCount: 0, totalSec: 0, lastUploadDate: '2024-01-01', lastUploadTimestamp: '' };
      return {
        ...c,
        productCount: prodCountByComp.get(c.id) || 0,
        materialCount: st.materialCount,
        totalDurationSec: st.totalSec,
        lastUploadDate: st.lastUploadDate,
        lastUploadTimestamp: st.lastUploadTimestamp
      };
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

  return {
    companies: finalCompanies,
    products: finalProducts,
    materials: finalMaterials
  };
}

/**
 * Saate göre hangi reklam kuşağına (Sabah, Öğle, Akşam Prime Time, Gece) düştüğünü döndürür.
 */
export function resolveTimeBlockInfo(timeStr = '09:00', timeBlocks = []) {
  const parts = String(timeStr || '09:00').split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const totalMin = h * 60 + m;

  for (const tb of timeBlocks) {
    if (!tb.startTime || !tb.endTime) continue;
    const [sh, sm] = tb.startTime.split(':').map(Number);
    const [eh, em] = tb.endTime.split(':').map(Number);
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = (eh || 24) * 60 + (em || 0);
    if (totalMin >= startMin && totalMin <= endMin) {
      return { id: tb.id, name: tb.name, range: `${tb.startTime} - ${tb.endTime}` };
    }
  }

  if (h >= 6 && h < 12) return { id: 'tb-1', name: 'Sabah Kuşağı', range: '06:00 - 12:00' };
  if (h >= 12 && h < 18) return { id: 'tb-2', name: 'Öğle Kuşağı', range: '12:00 - 18:00' };
  if (h >= 18 && h <= 23) return { id: 'tb-3', name: 'Akşam (Prime Time)', range: '18:00 - 24:00' };
  return { id: 'tb-4', name: 'Gece Kuşağı', range: '00:00 - 06:00' };
}

/**
 * Profesyonel Reklam Rezervasyon Raporu Hesaplama Motoru
 */
export function computeAdsAnalyticsReport({
  companies = [],
  products = [],
  materials = [],
  reservations = [],
  adPlacements = {},
  channels = [],
  timeBlocks = [],
  filters = {}
}) {
  const {
    companyId = '',
    productId = '',
    materialId = '',
    channelId = '',
    timeBlockId = '',
    startDate = '',
    endDate = '',
    searchQuery = ''
  } = filters;

  const materialMap = new Map(materials.map(m => [String(m.id), m]));
  materials.forEach(m => {
    if (m.clipId) materialMap.set(String(m.clipId), m);
  });
  const productMap = new Map(products.map(p => [String(p.id), p]));
  const companyMap = new Map(companies.map(c => [String(c.id), c]));
  const channelMap = new Map(channels.map(c => [String(c.id), c.name]));
  const reservationMap = new Map((reservations || []).map(r => [String(r.id), r]));

  // Materyal / Rezervasyon birim spot fiyatı ve planlanan spot / bütçe haritası
  const pricingByResAndMat = new Map();
  const pricingByMat = new Map();
  (reservations || []).forEach(res => {
    const items = Array.isArray(res.items) && res.items.length > 0 ? res.items : [res];
    items.forEach(it => {
      const mId = String(it.materialId || res.materialId || '');
      const planned = Math.max(1, Number(it.plannedSpots || res.totalPlannedSpots || 20));
      const unitPrice = Math.max(
        0,
        Number(it.spotPrice) ||
          Number(res.spotPrice) ||
          (Number(it.totalBudget || res.toplamTutar) > 0
            ? Number(it.totalBudget || res.toplamTutar) / planned
            : 0)
      );
      const totalBudget =
        Number(it.totalBudget) > 0
          ? Number(it.totalBudget)
          : Number(res.toplamTutar) > 0
          ? Number(res.toplamTutar)
          : Math.round(planned * unitPrice * 100) / 100;

      if (mId) {
        pricingByResAndMat.set(`${res.id}::${mId}`, { unitPrice, planned, totalBudget, res });
        if (!pricingByMat.has(mId) || unitPrice > 0) {
          pricingByMat.set(mId, { unitPrice, planned, totalBudget, res });
        }
      }
    });
  });

  const TR_DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const parseDateBuckets = (dStr = '') => {
    const clean = String(dStr || '2026-10-12').slice(0, 10);
    const [yS, mS, dS] = clean.split('-');
    const y = parseInt(yS, 10) || 2026;
    const m = Math.max(1, Math.min(12, parseInt(mS, 10) || 1));
    const d = Math.max(1, Math.min(31, parseInt(dS, 10) || 1));
    const dt = new Date(y, m - 1, d);
    const startOfYear = new Date(y, 0, 1);
    const pastDays = Math.floor((dt - startOfYear) / 86400000);
    const weekNo = Math.max(1, Math.ceil((pastDays + startOfYear.getDay() + 1) / 7));
    return {
      date: clean,
      dayName: TR_DAYS[dt.getDay()] || 'Gün',
      weekKey: `${y}-H${String(weekNo).padStart(2, '0')}`,
      weekLabel: `${y} • ${weekNo}. Hafta`,
      monthKey: `${y}-${String(m).padStart(2, '0')}`,
      monthLabel: `${TR_MONTHS[m - 1]} ${y}`,
      yearKey: String(y)
    };
  };

  const spotLogs = [];

  Object.entries(adPlacements || {}).forEach(([dayKey, blocks]) => {
    if (!Array.isArray(blocks)) return;
    const parts = dayKey.split('-');
    const chId = parts[1] || 'ch_hd';
    const dateStr = parts.slice(2).join('-') || '2026-10-12';

    if (channelId && String(chId) !== String(channelId)) return;
    if (startDate && dateStr < startDate) return;
    if (endDate && dateStr > endDate) return;

    const chName = channelMap.get(chId) || (chId === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD');

    blocks.forEach(block => {
      const blockTime = block.time || '09:00';
      const hourStr = `${String(blockTime.split(':')[0] || '09').padStart(2, '0')}:00`;
      const tbInfo = block.timeBlockName
        ? { id: block.timeBlockId || 'tb-custom', name: block.timeBlockName, range: '' }
        : resolveTimeBlockInfo(blockTime, timeBlocks);

      if (timeBlockId && tbInfo.id !== timeBlockId && tbInfo.name !== timeBlockId) return;

      (block.ads || []).forEach((ad, adIdx) => {
        const mat = materialMap.get(String(ad.materialId));
        const prod = mat
          ? productMap.get(String(mat.productId))
          : productMap.get(String(ad.productId));
        const comp = mat && mat.companyId
          ? companyMap.get(String(mat.companyId))
          : prod
          ? companyMap.get(String(prod.companyId))
          : companyMap.get(String(ad.companyId));

        const resolvedCompId = comp?.id || mat?.companyId || ad.companyId || 'unknown';
        const resolvedProdId = prod?.id || mat?.productId || ad.productId || 'unknown';
        const resolvedMatId = mat?.id || String(ad.materialId || 'unknown');

        if (companyId && String(resolvedCompId) !== String(companyId)) return;
        if (productId && String(resolvedProdId) !== String(productId)) return;
        if (materialId && String(resolvedMatId) !== String(materialId)) return;

        const matName = mat?.name || ad.materialName || `Reklam Spotu #${ad.materialId}`;
        const clipCode = mat?.clipName || mat?.code || '';
        const compName = comp?.name || mat?.companyName || 'Bilinmeyen Firma';
        const prodName = prod?.name || mat?.productName || 'Genel Kampanya';
        const durationSec = normalizeAdDurationSeconds(ad.duration || mat?.duration || 30, clipCode);

        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.toLocaleLowerCase('tr-TR').trim();
          const hay = `${matName} ${clipCode} ${compName} ${prodName} ${blockTime} ${tbInfo.name} ${dateStr}`.toLocaleLowerCase('tr-TR');
          if (!hay.includes(q)) return;
        }

        const pInfo =
          pricingByResAndMat.get(`${ad.reservationId}::${resolvedMatId}`) ||
          pricingByMat.get(String(resolvedMatId)) ||
          { unitPrice: 0, planned: 20, totalBudget: 0 };
        const dBuckets = parseDateBuckets(dateStr);

        spotLogs.push({
          id: `${dayKey}-${blockTime}-${adIdx}-${resolvedMatId}`,
          date: dateStr,
          dayName: dBuckets.dayName,
          weekKey: dBuckets.weekKey,
          weekLabel: dBuckets.weekLabel,
          monthKey: dBuckets.monthKey,
          monthLabel: dBuckets.monthLabel,
          yearKey: dBuckets.yearKey,
          time: blockTime,
          hourBucket: hourStr,
          channelId: chId,
          channelName: chName,
          timeBlockId: tbInfo.id,
          timeBlockName: tbInfo.name,
          companyId: resolvedCompId,
          companyName: compName,
          productId: resolvedProdId,
          productName: prodName,
          materialId: resolvedMatId,
          clipId: mat?.clipId || resolvedMatId,
          materialName: matName,
          clipName: clipCode,
          durationSec,
          unitPrice: pInfo.unitPrice || 0,
          reservationId: ad.reservationId || null,
          isSponsorSpot: Boolean(ad.isSponsorSpot),
          isRamadanSpot: Boolean(ad.isRamadanSpot),
          sponsorRoleLabel: ad.sponsorRoleLabel || ''
        });
      });
    });
  });

  spotLogs.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const byMaterialMap = new Map();
  const byCompanyMap = new Map();
  const byProductMap = new Map();
  const byDailyMaterialMap = new Map();
  const byTimeBlockMap = new Map();
  const byHourMap = new Map();
  const byWeekMap = new Map();
  const byMonthMap = new Map();
  const byYearMap = new Map();
  const uniqueDatesSet = new Set();

  spotLogs.forEach(log => {
    uniqueDatesSet.add(log.date);
    const spotCost = Number(log.unitPrice) || 0;

    if (!byMaterialMap.has(log.materialId)) {
      const mPricing = pricingByMat.get(String(log.materialId)) || { unitPrice: 0, planned: 20, totalBudget: 0 };
      byMaterialMap.set(log.materialId, {
        materialId: log.materialId,
        clipId: log.clipId,
        materialName: log.materialName,
        clipName: log.clipName,
        companyId: log.companyId,
        companyName: log.companyName,
        productId: log.productId,
        productName: log.productName,
        unitDurationSec: log.durationSec,
        unitPrice: mPricing.unitPrice || spotCost,
        plannedSpots: mPricing.planned || 20,
        plannedBudget: mPricing.totalBudget || 0,
        totalSpots: 0,
        totalDurationSec: 0,
        totalRevenue: 0,
        datesSet: new Set(),
        dailyCounts: {},
        dayOfWeekCounts: {},
        weeksCounts: {},
        monthsCounts: {},
        yearsCounts: {},
        hoursSet: new Set(),
        hoursCountMap: {},
        timeBlocksCountMap: {},
        channelsSet: new Set(),
        firstDate: log.date,
        lastDate: log.date
      });
    }
    const mStat = byMaterialMap.get(log.materialId);
    mStat.totalSpots += 1;
    mStat.totalDurationSec += log.durationSec;
    mStat.totalRevenue += spotCost || mStat.unitPrice || 0;
    mStat.datesSet.add(log.date);
    mStat.dailyCounts[log.date] = (mStat.dailyCounts[log.date] || 0) + 1;
    mStat.dayOfWeekCounts[log.dayName] = (mStat.dayOfWeekCounts[log.dayName] || 0) + 1;
    mStat.weeksCounts[log.weekLabel] = (mStat.weeksCounts[log.weekLabel] || 0) + 1;
    mStat.monthsCounts[log.monthLabel] = (mStat.monthsCounts[log.monthLabel] || 0) + 1;
    mStat.yearsCounts[log.yearKey] = (mStat.yearsCounts[log.yearKey] || 0) + 1;
    mStat.hoursSet.add(log.time);
    mStat.hoursCountMap[log.time] = (mStat.hoursCountMap[log.time] || 0) + 1;
    mStat.timeBlocksCountMap[log.timeBlockName] = (mStat.timeBlocksCountMap[log.timeBlockName] || 0) + 1;
    mStat.channelsSet.add(log.channelName);
    if (log.date < mStat.firstDate) mStat.firstDate = log.date;
    if (log.date > mStat.lastDate) mStat.lastDate = log.date;

    // ÜRÜN BAZLI ANALİZ
    if (!byProductMap.has(log.productId)) {
      byProductMap.set(log.productId, {
        productId: log.productId,
        productName: log.productName,
        companyId: log.companyId,
        companyName: log.companyName,
        totalSpots: 0,
        totalDurationSec: 0,
        totalRevenue: 0,
        materialsSet: new Set(),
        datesSet: new Set(),
        dayOfWeekCounts: {},
        weeksCounts: {},
        monthsCounts: {},
        yearsCounts: {},
        timeBlocksCountMap: {},
        firstDate: log.date,
        lastDate: log.date
      });
    }
    const pStat = byProductMap.get(log.productId);
    pStat.totalSpots += 1;
    pStat.totalDurationSec += log.durationSec;
    pStat.totalRevenue += spotCost;
    pStat.materialsSet.add(log.materialId);
    pStat.datesSet.add(log.date);
    pStat.dayOfWeekCounts[log.dayName] = (pStat.dayOfWeekCounts[log.dayName] || 0) + 1;
    pStat.weeksCounts[log.weekLabel] = (pStat.weeksCounts[log.weekLabel] || 0) + 1;
    pStat.monthsCounts[log.monthLabel] = (pStat.monthsCounts[log.monthLabel] || 0) + 1;
    pStat.yearsCounts[log.yearKey] = (pStat.yearsCounts[log.yearKey] || 0) + 1;
    pStat.timeBlocksCountMap[log.timeBlockName] = (pStat.timeBlocksCountMap[log.timeBlockName] || 0) + 1;
    if (log.date < pStat.firstDate) pStat.firstDate = log.date;
    if (log.date > pStat.lastDate) pStat.lastDate = log.date;

    // FİRMA BAZLI ANALİZ
    if (!byCompanyMap.has(log.companyId)) {
      byCompanyMap.set(log.companyId, {
        companyId: log.companyId,
        companyName: log.companyName,
        totalSpots: 0,
        totalDurationSec: 0,
        totalRevenue: 0,
        materialsSet: new Set(),
        productsSet: new Set(),
        datesSet: new Set(),
        dayOfWeekCounts: {},
        weeksCounts: {},
        monthsCounts: {},
        yearsCounts: {},
        timeBlocksCountMap: {},
        hoursSet: new Set()
      });
    }
    const cStat = byCompanyMap.get(log.companyId);
    cStat.totalSpots += 1;
    cStat.totalDurationSec += log.durationSec;
    cStat.totalRevenue += spotCost;
    cStat.materialsSet.add(log.materialId);
    cStat.productsSet.add(log.productId);
    cStat.datesSet.add(log.date);
    cStat.dayOfWeekCounts[log.dayName] = (cStat.dayOfWeekCounts[log.dayName] || 0) + 1;
    cStat.weeksCounts[log.weekLabel] = (cStat.weeksCounts[log.weekLabel] || 0) + 1;
    cStat.monthsCounts[log.monthLabel] = (cStat.monthsCounts[log.monthLabel] || 0) + 1;
    cStat.yearsCounts[log.yearKey] = (cStat.yearsCounts[log.yearKey] || 0) + 1;
    cStat.timeBlocksCountMap[log.timeBlockName] = (cStat.timeBlocksCountMap[log.timeBlockName] || 0) + 1;
    cStat.hoursSet.add(log.time);

    // HAFTALIK / AYLIK / YILLIK DÖNEMSEL TOPLAMLAR
    if (!byWeekMap.has(log.weekKey)) {
      byWeekMap.set(log.weekKey, { key: log.weekKey, label: log.weekLabel, spots: 0, durationSec: 0, revenue: 0, companiesSet: new Set(), materialsSet: new Set(), daysSet: new Set() });
    }
    const wObj = byWeekMap.get(log.weekKey);
    wObj.spots += 1;
    wObj.durationSec += log.durationSec;
    wObj.revenue += spotCost;
    wObj.companiesSet.add(log.companyId);
    wObj.materialsSet.add(log.materialId);
    wObj.daysSet.add(log.date);

    if (!byMonthMap.has(log.monthKey)) {
      byMonthMap.set(log.monthKey, { key: log.monthKey, label: log.monthLabel, spots: 0, durationSec: 0, revenue: 0, companiesSet: new Set(), materialsSet: new Set(), daysSet: new Set() });
    }
    const moObj = byMonthMap.get(log.monthKey);
    moObj.spots += 1;
    moObj.durationSec += log.durationSec;
    moObj.revenue += spotCost;
    moObj.companiesSet.add(log.companyId);
    moObj.materialsSet.add(log.materialId);
    moObj.daysSet.add(log.date);

    if (!byYearMap.has(log.yearKey)) {
      byYearMap.set(log.yearKey, { key: log.yearKey, label: `${log.yearKey} Yılı`, spots: 0, durationSec: 0, revenue: 0, companiesSet: new Set(), materialsSet: new Set(), daysSet: new Set() });
    }
    const yObj = byYearMap.get(log.yearKey);
    yObj.spots += 1;
    yObj.durationSec += log.durationSec;
    yObj.revenue += spotCost;
    yObj.companiesSet.add(log.companyId);
    yObj.materialsSet.add(log.materialId);
    yObj.daysSet.add(log.date);

    const dailyKey = `${log.date}::${log.channelId}::${log.materialId}`;
    if (!byDailyMaterialMap.has(dailyKey)) {
      byDailyMaterialMap.set(dailyKey, {
        key: dailyKey,
        date: log.date,
        channelId: log.channelId,
        channelName: log.channelName,
        companyId: log.companyId,
        companyName: log.companyName,
        productName: log.productName,
        materialId: log.materialId,
        clipId: log.clipId,
        materialName: log.materialName,
        unitDurationSec: log.durationSec,
        dailySpotCount: 0,
        dailyTotalSec: 0,
        broadcastTimes: [],
        timeBlocks: new Set()
      });
    }
    const dStat = byDailyMaterialMap.get(dailyKey);
    dStat.dailySpotCount += 1;
    dStat.dailyTotalSec += log.durationSec;
    dStat.broadcastTimes.push(log.time);
    dStat.timeBlocks.add(log.timeBlockName);

    if (!byTimeBlockMap.has(log.timeBlockName)) {
      byTimeBlockMap.set(log.timeBlockName, {
        timeBlockName: log.timeBlockName,
        totalSpots: 0,
        totalDurationSec: 0,
        uniqueMaterials: new Set(),
        uniqueCompanies: new Set(),
        hoursSet: new Set()
      });
    }
    const tbStat = byTimeBlockMap.get(log.timeBlockName);
    tbStat.totalSpots += 1;
    tbStat.totalDurationSec += log.durationSec;
    tbStat.uniqueMaterials.add(log.materialId);
    tbStat.uniqueCompanies.add(log.companyId);
    tbStat.hoursSet.add(log.time);

    if (!byHourMap.has(log.hourBucket)) {
      byHourMap.set(log.hourBucket, {
        hourBucket: log.hourBucket,
        timeBlockName: log.timeBlockName,
        totalSpots: 0,
        totalDurationSec: 0
      });
    }
    const hStat = byHourMap.get(log.hourBucket);
    hStat.totalSpots += 1;
    hStat.totalDurationSec += log.durationSec;
  });

  const materialReports = Array.from(byMaterialMap.values())
    .map(m => {
      const activeDaysCount = m.datesSet.size || 1;
      const dailyValues = Object.values(m.dailyCounts);
      const minDaily = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
      const maxDaily = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
      const activeWeeksCount = Math.max(1, Object.keys(m.weeksCounts).length);
      const avgWeeklySpots = Number((m.totalSpots / activeWeeksCount).toFixed(1));
      const estMonthlySpots = Math.round(avgWeeklySpots * 4.3);
      const estYearlySpots = Math.round(avgWeeklySpots * 52);
      const spotDiff = (m.plannedSpots || 20) - m.totalSpots; // negatifse aşım (- fark)

      return {
        ...m,
        activeDaysCount,
        avgDailySpots: Number((m.totalSpots / activeDaysCount).toFixed(1)),
        avgWeeklySpots,
        estMonthlySpots,
        estYearlySpots,
        spotBalance: spotDiff,
        minDailySpots: minDaily,
        maxDailySpots: maxDaily,
        dayOfWeekBreakdown: Object.entries(m.dayOfWeekCounts).map(([d, c]) => `${d}: ${c}`).join(' • '),
        weeksBreakdown: Object.entries(m.weeksCounts).map(([w, c]) => `${w}: ${c}`).join(' • '),
        monthsBreakdown: Object.entries(m.monthsCounts).map(([mo, c]) => `${mo}: ${c}`).join(' • '),
        yearsBreakdown: Object.entries(m.yearsCounts).map(([y, c]) => `${y}: ${c}`).join(' • '),
        sortedHours: Array.from(m.hoursSet).sort(),
        channelsList: Array.from(m.channelsSet),
        timeBlocksBreakdown: Object.entries(m.timeBlocksCountMap).map(([name, count]) => ({
          name,
          count
        }))
      };
    })
    .sort((a, b) => b.totalSpots - a.totalSpots || b.totalDurationSec - a.totalDurationSec);

  const productReports = Array.from(byProductMap.values())
    .map(p => {
      const activeDaysCount = p.datesSet.size || 1;
      const activeWeeksCount = Math.max(1, Object.keys(p.weeksCounts).length);
      const avgWeeklySpots = Number((p.totalSpots / activeWeeksCount).toFixed(1));
      return {
        ...p,
        activeDaysCount,
        materialsCount: p.materialsSet.size,
        avgDailySpots: Number((p.totalSpots / activeDaysCount).toFixed(1)),
        avgWeeklySpots,
        estMonthlySpots: Math.round(avgWeeklySpots * 4.3),
        estYearlySpots: Math.round(avgWeeklySpots * 52),
        dayOfWeekBreakdown: Object.entries(p.dayOfWeekCounts).map(([d, c]) => `${d}: ${c}`).join(' • '),
        weeksBreakdown: Object.entries(p.weeksCounts).map(([w, c]) => `${w}: ${c}`).join(' • '),
        monthsBreakdown: Object.entries(p.monthsCounts).map(([mo, c]) => `${mo}: ${c}`).join(' • '),
        yearsBreakdown: Object.entries(p.yearsCounts).map(([y, c]) => `${y}: ${c}`).join(' • '),
        timeBlocksBreakdown: Object.entries(p.timeBlocksCountMap).map(([name, count]) => ({
          name,
          count
        }))
      };
    })
    .sort((a, b) => b.totalSpots - a.totalSpots || b.totalDurationSec - a.totalDurationSec);

  const companyReports = Array.from(byCompanyMap.values())
    .map(c => {
      const activeDaysCount = c.datesSet.size || 1;
      const activeWeeksCount = Math.max(1, Object.keys(c.weeksCounts).length);
      const avgWeeklySpots = Number((c.totalSpots / activeWeeksCount).toFixed(1));
      return {
        ...c,
        activeDaysCount,
        materialsCount: c.materialsSet.size,
        productsCount: c.productsSet.size,
        avgDailySpots: Number((c.totalSpots / activeDaysCount).toFixed(1)),
        avgWeeklySpots,
        estMonthlySpots: Math.round(avgWeeklySpots * 4.3),
        estYearlySpots: Math.round(avgWeeklySpots * 52),
        dayOfWeekBreakdown: Object.entries(c.dayOfWeekCounts).map(([d, cnt]) => `${d}: ${cnt}`).join(' • '),
        weeksBreakdown: Object.entries(c.weeksCounts).map(([w, cnt]) => `${w}: ${cnt}`).join(' • '),
        monthsBreakdown: Object.entries(c.monthsCounts).map(([mo, cnt]) => `${mo}: ${cnt}`).join(' • '),
        yearsBreakdown: Object.entries(c.yearsCounts).map(([y, cnt]) => `${y}: ${cnt}`).join(' • '),
        sortedHours: Array.from(c.hoursSet).sort(),
        timeBlocksBreakdown: Object.entries(c.timeBlocksCountMap).map(([name, count]) => ({
          name,
          count
        }))
      };
    })
    .sort((a, b) => b.totalSpots - a.totalSpots || b.totalDurationSec - a.totalDurationSec);

  // YAYIN PLAN / REZERVASYON BAZLI KULLANIM VE FİYAT / AŞIM (- FARK) RAPORU
  const placedCountByResId = {};
  spotLogs.forEach(l => {
    if (l.reservationId) {
      placedCountByResId[l.reservationId] = (placedCountByResId[l.reservationId] || 0) + 1;
    }
  });

  const planReports = (reservations || [])
    .filter(res => {
      if (companyId && String(res.companyId) !== String(companyId)) return false;
      if (productId) {
        const matchProd =
          String(res.productId) === String(productId) ||
          (res.items || []).some(it => String(it.productId) === String(productId));
        if (!matchProd) return false;
      }
      if (materialId) {
        const matchMat =
          String(res.materialId) === String(materialId) ||
          (res.items || []).some(it => String(it.materialId) === String(materialId));
        if (!matchMat) return false;
      }
      return true;
    })
    .map(res => {
      const comp = companyMap.get(String(res.companyId));
      const items = Array.isArray(res.items) && res.items.length > 0 ? res.items : [res];
      const plannedSpots = Math.max(1, Number(res.totalPlannedSpots) || items.reduce((s, i) => s + (Number(i.plannedSpots) || 0), 0) || 20);
      const realizedSpots = Math.max(Number(res.realizedSpots) || 0, placedCountByResId[res.id] || 0);
      const spotDiff = plannedSpots - realizedSpots; // negatifse aşım (- fark)
      const unitPrice = Number(res.spotPrice || items[0]?.spotPrice || 0);
      const plannedBudget = Number(res.toplamTutar) || items.reduce((s, i) => s + (Number(i.totalBudget) || 0), 0) || Math.round(plannedSpots * unitPrice);
      const realizedBudget = unitPrice > 0 ? Math.round(realizedSpots * unitPrice) : plannedBudget;
      const budgetDiff = plannedBudget - realizedBudget;

      return {
        id: res.id,
        name: res.name || `${comp?.name || 'Firma'} Planı`,
        companyId: res.companyId,
        companyName: comp?.name || 'Firma',
        startDate: res.startDate || items[0]?.startDate || '-',
        endDate: res.endDate || items[0]?.endDate || '-',
        isSponsor: Boolean(res.isSponsor),
        isRamadanSpecial: Boolean(res.isRamadanSpecial),
        sponsorProgramTitle: res.sponsorProgramTitle || '',
        itemsCount: items.length,
        plannedSpots,
        realizedSpots,
        spotDiff,
        usagePct: Math.round((realizedSpots / Math.max(1, plannedSpots)) * 100),
        unitPrice,
        plannedBudget,
        realizedBudget,
        budgetDiff
      };
    });

  const periodReports = {
    weekly: Array.from(byWeekMap.values())
      .map(w => ({ ...w, companiesCount: w.companiesSet.size, materialsCount: w.materialsSet.size, daysCount: w.daysSet.size }))
      .sort((a, b) => b.key.localeCompare(a.key)),
    monthly: Array.from(byMonthMap.values())
      .map(m => ({ ...m, companiesCount: m.companiesSet.size, materialsCount: m.materialsSet.size, daysCount: m.daysSet.size }))
      .sort((a, b) => b.key.localeCompare(a.key)),
    yearly: Array.from(byYearMap.values())
      .map(y => ({ ...y, companiesCount: y.companiesSet.size, materialsCount: y.materialsSet.size, daysCount: y.daysSet.size }))
      .sort((a, b) => b.key.localeCompare(a.key))
  };

  const dailyReports = Array.from(byDailyMaterialMap.values())
    .map(d => ({
      ...d,
      broadcastTimes: d.broadcastTimes.sort(),
      timeBlocksList: Array.from(d.timeBlocks)
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.dailySpotCount - a.dailySpotCount);

  const totalSpotsCount = spotLogs.length;
  const totalBroadcastSec = spotLogs.reduce((acc, s) => acc + s.durationSec, 0);
  const totalRevenue = spotLogs.reduce((acc, s) => acc + (Number(s.unitPrice) || 0), 0);
  const totalBroadcastDays = uniqueDatesSet.size;

  const timeBlockReports = Array.from(byTimeBlockMap.values())
    .map(tb => ({
      timeBlockName: tb.timeBlockName,
      totalSpots: tb.totalSpots,
      totalDurationSec: tb.totalDurationSec,
      sharePercentage: totalSpotsCount > 0 ? Number(((tb.totalSpots / totalSpotsCount) * 100).toFixed(1)) : 0,
      uniqueMaterialsCount: tb.uniqueMaterials.size,
      uniqueCompaniesCount: tb.uniqueCompanies.size,
      hoursList: Array.from(tb.hoursSet).sort()
    }))
    .sort((a, b) => b.totalSpots - a.totalSpots);

  const hourlyReports = Array.from(byHourMap.values()).sort((a, b) =>
    a.hourBucket.localeCompare(b.hourBucket)
  );

  return {
    summary: {
      totalSpotsCount,
      totalBroadcastSec,
      totalBroadcastMin: Number((totalBroadcastSec / 60).toFixed(1)),
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalBroadcastDays,
      avgSpotsPerDay: totalBroadcastDays > 0 ? Number((totalSpotsCount / totalBroadcastDays).toFixed(1)) : 0,
      avgSecPerDay: totalBroadcastDays > 0 ? Math.round(totalBroadcastSec / totalBroadcastDays) : 0,
      activeCompaniesCount: companyReports.length,
      activeProductsCount: productReports.length,
      activeMaterialsCount: materialReports.length,
      topTimeBlock: timeBlockReports[0] || null
    },
    materialReports,
    productReports,
    companyReports,
    planReports,
    periodReports,
    dailyReports,
    timeBlockReports,
    hourlyReports,
    spotLogs
  };
}
