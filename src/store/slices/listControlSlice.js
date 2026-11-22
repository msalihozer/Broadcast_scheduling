/**
 * @file src/store/slices/listControlSlice.js
 * @description Yayın Liste Kontrol Modülü Zustand Durum Dilimi.
 *
 * Sorumluluklar:
 * 1. Reklam Rezervasyondan iletilen (`ready-*` + `adPlacements`) veya Yayın Planlamadan gelen listelerin
 *    `listControlDays` içine otomatik ve düzleştirilmiş (klip + reklam spotları) olarak senkronize edilmesi.
 * 2. Klip ve Reklam ekleme, değiştirme (bölüm/klip swap), silme, sıra taşıma ve süre güncelleme.
 * 3. Akıllı Revize İsteme (`lcRequestRevision`):
 *    - Klip / Program için: Operatörün seçimine göre `Taslak Planlama ('draft')`, `Yayın Planlama ('broadcast')` veya her ikisine (`'both'`) revize gönderir.
 *    - Reklam için: Doğrudan `Reklam Rezervasyon ('ads')` aşamasına revize gönderir.
 * 4. Tüm kontrol, hata, değişiklik ve revize işlemlerinin kalıcı `listControlLogs` altında tutulması ve sunucuyla (`/api/ads-store`) senkronize edilmesi.
 */
import { _recalculateStartTimes, createEmptyDay } from '../storeHelpers';
import { pushAdsStoreToServer, resolveProgramLogoForChannel } from './ads/adsCatalogHelpers';
import useAdminLogStore from '../adminLogStore';
import useBroadcastStore from '../../modules/broadcast/store/broadcastStore';

const LC_LOGS_STORAGE_KEY = 'yayin_list_control_logs_v1';
const LC_SETTINGS_STORAGE_KEY = 'yayin_list_control_settings_v1';

const DEFAULT_LC_SETTINGS = {
  primaryFormat: 'mxf',
  allowedFormats: ['mxf'], // Varsayılan genel yayın formatı .mxf; ayarlardan .mp4, .mov, .avi, .ts, .mpg vb. eklenebilir
  strictFormatCheck: true
};

const loadSavedListControlSettings = () => {
  try {
    const raw = localStorage.getItem(LC_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const fmts = Array.isArray(parsed.allowedFormats) && parsed.allowedFormats.length > 0
          ? parsed.allowedFormats.map(f => String(f || '').trim().toLowerCase().replace(/^\./, '')).filter(Boolean)
          : ['mxf'];
        return {
          ...DEFAULT_LC_SETTINGS,
          ...parsed,
          allowedFormats: fmts.length > 0 ? Array.from(new Set(fmts)) : ['mxf']
        };
      }
    }
  } catch (_) {}
  return DEFAULT_LC_SETTINGS;
};

const saveListControlSettingsLocal = (settings) => {
  try {
    localStorage.setItem(LC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
};

/**
 * Yalnızca saf sayısal MAM FileID değerlerini (örn. "248192" veya "110480.mxf") yakalar.
 * "Tecvid_70_270722" gibi içinde harf bulunan klip adlarından rakamları birleştirerek sahte ID üretmez!
 */
const extractPureNumericId = (...candidates) => {
  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    const m = s.match(/^(\d{3,10})(?:\.[a-zA-Z0-9]+)?$/);
    if (m) return Number(m[1]);
  }
  return null;
};

/**
 * Daha önce yanlışlıkla klip adındaki rakamların birleştirilmesiyle ("Tecvid_70_270722" -> "70270722.mxf")
 * oluşmuş bozuk code / fileId alanlarını otomatik onarır ve varsayılan .mxf uzantısını korur.
 */
const sanitizeProgramCodeAndFileId = (prog = {}) => {
  const titleStr = String(prog.clipName || prog.title || '').trim();
  const titleDigitsOnly = titleStr.replace(/\D+/g, '');
  const titleHasLetters = /[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(titleStr);

  let currentFileId = extractPureNumericId(prog.fileId, prog.clipId, prog.id);
  let currentCode = String(prog.code || prog.fileName || '').trim();

  // Eğer başlık harf içeriyorsa (örn: "Tecvid_70_270722") ve fileId/code sadece başlıktaki rakamların birleşimiyse ("70270722"), sıfırla
  if (titleHasLetters && titleDigitsOnly.length >= 4) {
    if (currentFileId && String(currentFileId) === titleDigitsOnly) {
      currentFileId = null;
    }
    const codeStem = currentCode.replace(/\.[^.]+$/, '');
    if (codeStem === titleDigitsOnly) {
      currentCode = '';
    }
  }

  if (!currentCode) {
    if (currentFileId) {
      currentCode = `${currentFileId}.mxf`;
    } else if (titleStr && !prog.isEmptyAdBreak) {
      const stem = titleStr.replace(/\.[^.]+$/, '');
      currentCode = `${stem}.mxf`;
    }
  } else if (!/\.[a-zA-Z0-9]{2,5}$/.test(currentCode)) {
    currentCode = `${currentCode}.mxf`;
  }

  return {
    fileId: currentFileId,
    code: currentCode,
    fileName: currentCode
  };
};

/**
 * Yayın akışındaki satırlara HER SATIRA logo yazmak yerine,
 * YALNIZCA Logo Giriş ve Çıkış noktalarını (Reklam Giriş, Reklam Çıkış, Yayın Giriş, Yayın Çıkış) işaretler.
 * Eğer operatör bir satırda manuel logo tetiklemesi (`manualLogoEvent`) seçmişse onu korur.
 */
export const applySmartLogoTransitions = (programs = [], channelId = 'ch_hd', adSettings = {}) => {
  if (!Array.isArray(programs) || programs.length === 0) return [];
  const chSettings = adSettings?.[channelId] || {};
  const broadcastLogo = chSettings.broadcastLogoName || (channelId === 'ch_way' ? 'Semerkand_WAY_Logo' : 'Semerkand_Tv_Logo_Corner');
  const adLogo = chSettings.adLogoName || (channelId === 'ch_way' ? 'Semerkand_WAY_Reklam_Logo' : 'Semerkand_HD_Reklam_Logo');

  const isRowAd = (r) => Boolean(r && (r.isAdClip || r.isFromAds || r.type === 'ad_break' || r.type === 'ad_spot'));
  const isRowIntro = (r) => Boolean(r && !isRowAd(r) && (r.isIntroClip || r.unitType === 'intro' || String(r.categoryName || r.category || '').toLowerCase().includes('jenerik') || String(r.title || '').toLowerCase().includes('_intro_')));

  let broadcastLogoActive = false;

  return programs.map((item, idx) => {
    const prev = idx > 0 ? programs[idx - 1] : null;
    const next = idx < programs.length - 1 ? programs[idx + 1] : null;
    const isAd = isRowAd(item);
    const prevIsAd = isRowAd(prev);
    const nextIsAd = isRowAd(next);
    const isIntro = isRowIntro(item);

    // Operatör manuel olarak bir logo giriş/çıkış durumu seçtiyse onu uygula
    if (item.manualLogoEvent && item.manualLogoEvent !== 'auto') {
      const ev = item.manualLogoEvent;
      if (ev === 'none') {
        return { ...item, logoEvent: 'none', logoEventLabel: '', logo: '' };
      }
      const isAdEv = ev === 'reklam_giris' || ev === 'reklam_cikis';
      const activeLogoName = item.manualLogoName || (isAdEv ? adLogo : broadcastLogo);
      const labelMap = {
        reklam_giris: '📢 REKLAM GİRİŞ',
        reklam_cikis: '📢 REKLAM ÇIKIŞ',
        yayin_giris: '📺 YAYIN GİRİŞ',
        yayin_cikis: '📺 YAYIN ÇIKIŞ'
      };
      return {
        ...item,
        logoEvent: ev,
        logoEventLabel: labelMap[ev] || '',
        logo: activeLogoName
      };
    }

    let autoEvent = 'none';
    let autoLabel = '';
    let autoLogo = '';

    if (isAd) {
      broadcastLogoActive = false;
      const isBreakFirstRow = !prevIsAd || (prev?.parentBreakId && item.parentBreakId && prev.parentBreakId !== item.parentBreakId);
      const isBreakLastRow = !nextIsAd || (next?.parentBreakId && item.parentBreakId && next.parentBreakId !== item.parentBreakId);

      if ((item.isBumperAd && item.bumperType === 'intro') || isBreakFirstRow) {
        autoEvent = 'reklam_giris';
        autoLabel = '📢 REKLAM GİRİŞ';
        autoLogo = adLogo;
      } else if ((item.isBumperAd && item.bumperType === 'outro') || isBreakLastRow) {
        autoEvent = 'reklam_cikis';
        autoLabel = '📢 REKLAM ÇIKIŞ';
        autoLogo = adLogo;
      }
    } else {
      // Program klibi: Yayın başında (intro sonrası ilk programda) veya reklam kuşağından hemen sonra yayına girerken Yayın Logosu Giriş işaretlenir
      if (!isIntro && !broadcastLogoActive) {
        autoEvent = 'yayin_giris';
        autoLabel = '📺 YAYIN GİRİŞ';
        autoLogo = broadcastLogo;
        broadcastLogoActive = true;
      } else if (!isIntro && nextIsAd) {
        // Reklam kuşağına girmeden hemen önceki son program klibinde Yayın Logosu Çıkış
        autoEvent = 'yayin_cikis';
        autoLabel = '📺 YAYIN ÇIKIŞ';
        autoLogo = broadcastLogo;
      }
    }

    return {
      ...item,
      logoEvent: autoEvent,
      logoEventLabel: autoLabel,
      logo: autoLogo
    };
  });
};

const loadSavedListControlLogs = () => {
  try {
    const raw = localStorage.getItem(LC_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
};

const saveListControlLogsLocal = (logs = []) => {
  try {
    const trimmed = (Array.isArray(logs) ? logs : []).slice(0, 1000);
    localStorage.setItem(LC_LOGS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
};

const syncListControlDayToServer = (key, dayObj, logsToSync = null) => {
  if (!key || !dayObj) return;
  const payload = {
    listControlDays: {
      [key]: dayObj
    }
  };
  if (Array.isArray(logsToSync)) {
    payload.listControlLogs = logsToSync.slice(0, 500);
  }
  pushAdsStoreToServer(payload);
};

/**
 * Saniyeyi okunabilir "X dk Y sn" veya "MM:SS" formatına çevirir.
 */
const formatSecLabel = (sec) => {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m > 0 && rem > 0) return `${m} dk ${rem} sn`;
  if (m > 0) return `${m} dk`;
  return `${rem} sn`;
};

export const createListControlSlice = (set, get) => ({
  listControlDays: {},
  listControlLogs: loadSavedListControlLogs(),
  listControlSettings: loadSavedListControlSettings(),

  /**
   * Liste Kontrol Format & Denetim Ayarlarını günceller (Varsayılan format: .mxf; ek formatlar eklenip çıkarılabilir).
   */
  lcUpdateFormatSettings: (updates = {}) => {
    set((state) => {
      const cur = state.listControlSettings || DEFAULT_LC_SETTINGS;
      let nextAllowed = Array.isArray(updates.allowedFormats)
        ? updates.allowedFormats
        : cur.allowedFormats;
      nextAllowed = Array.from(
        new Set(
          nextAllowed
            .map(f => String(f || '').trim().toLowerCase().replace(/^\./, ''))
            .filter(Boolean)
        )
      );
      if (nextAllowed.length === 0) nextAllowed = ['mxf'];

      const nextSettings = {
        ...cur,
        ...updates,
        primaryFormat: updates.primaryFormat
          ? String(updates.primaryFormat).trim().toLowerCase().replace(/^\./, '')
          : nextAllowed[0] || 'mxf',
        allowedFormats: nextAllowed
      };
      saveListControlSettingsLocal(nextSettings);
      return { listControlSettings: nextSettings };
    });
  },

  /**
   * Kalıcı Liste Kontrol log kaydı ekler (Hem localStorage, hem `/api/ads-store`, hem de Admin Log Store'a yazar).
   */
  lcAddAuditLog: (entry = {}) => {
    const nowIso = new Date().toISOString();
    const channelId = entry.channelId || get().selectedChannel || 'ch_hd';
    const channelName = channelId === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD';
    const newLog = {
      id: entry.id || `lclog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: entry.timestamp || nowIso,
      channelId,
      channelName,
      date: entry.date || get().selectedDate || '',
      actionType: entry.actionType || 'info', // 'clip_replace' | 'clip_add' | 'clip_delete' | 'duration_edit' | 'ad_replace' | 'ad_add' | 'ad_delete' | 'revision_request' | 'health_check' | 'approve_list' | 'sync_from_ads'
      actionLabel: entry.actionLabel || 'Liste Kontrol İşlemi',
      itemType: entry.itemType || 'clip', // 'clip' | 'ad' | 'system'
      itemTitle: entry.itemTitle || '',
      itemCode: entry.itemCode || '',
      oldValue: entry.oldValue || '',
      newValue: entry.newValue || '',
      targetStage: entry.targetStage || '', // 'draft' | 'broadcast' | 'ads' | 'both' | ''
      details: entry.details || '',
      status: entry.status || 'success', // 'success' | 'warning' | 'error'
      operator: entry.operator || 'Liste Kontrol Operatörü'
    };

    set((state) => {
      const nextLogs = [newLog, ...(Array.isArray(state.listControlLogs) ? state.listControlLogs : [])].slice(0, 1000);
      saveListControlLogsLocal(nextLogs);
      pushAdsStoreToServer({ listControlLogs: nextLogs.slice(0, 400) });
      return { listControlLogs: nextLogs };
    });

    try {
      useAdminLogStore.getState().addLog({
        category: 'lists',
        panel: 'lists',
        module: 'Yayın Liste Kontrol',
        action: newLog.actionLabel,
        details: newLog.details || `${channelName} (${newLog.date}): ${newLog.itemTitle}`,
        target: `${channelId}/${newLog.date}`,
        count: 1,
        status: newLog.status === 'error' ? 'error' : newLog.status === 'warning' ? 'warning' : 'success'
      });
    } catch (_) {}

    return newLog;
  },

  lcEnsureDayExists: (channelId, dateStr) => {
    const key = `list-control-${channelId}-${dateStr}`;
    const state = get();
    if (!state.listControlDays[key]) {
      set((s) => ({
        listControlDays: { ...s.listControlDays, [key]: createEmptyDay(dateStr) }
      }));
    }
    return key;
  },

  /**
   * Reklam Rezervasyondan iletilen (`ready-<channelId>-<date>` + `adPlacements`) veya
   * Yayın Planlama (`useBroadcastStore`) üzerinde hazırlanan akışı Liste Kontrol gününe düzleştirerek aktarır.
   */
  lcSyncFromAdsOrReady: (channelId, dateStr, { forceOverwrite = false, silent = false } = {}) => {
    const state = get();
    const lcKey = `list-control-${channelId}-${dateStr}`;
    const readyKey = `ready-${channelId}-${dateStr}`;
    const finalKey = `final-${channelId}-${dateStr}`;

    const existingLcDay = state.listControlDays?.[lcKey];
    const activeVariant = existingLcDay?.activeVariant || 'v1';
    const existingPrograms = existingLcDay?.variants?.[activeVariant]?.programs || [];
    const hasLegacyTpl3 = existingPrograms.some(p => String(p.id).toUpperCase() === 'TPL-3' || String(p.id).toUpperCase() === 'TPL-4');

    if (existingPrograms.length > 0 && !hasLegacyTpl3 && !forceOverwrite) {
      // Mevcut satırlarda daha önce harf+rakam birleşimiyle oluşmuş bozuk code/fileId varsa ve logo giriş/çıkış işaretleri eksikse otomatik onar
      let needsSanitize = false;
      const rawSanitized = existingPrograms.map(p => {
        if (p.isEmptyAdBreak) return p;
        const fixed = sanitizeProgramCodeAndFileId(p);
        if (fixed.fileId !== p.fileId || fixed.code !== p.code) {
          needsSanitize = true;
          return { ...p, ...fixed };
        }
        return p;
      });
      const withSmartLogos = applySmartLogoTransitions(rawSanitized, channelId, state.adSettings);
      const logoChanged = withSmartLogos.some((p, i) => p.logoEvent !== existingPrograms[i]?.logoEvent || p.logo !== existingPrograms[i]?.logo);
      if (needsSanitize || logoChanged) {
        const sanitizedDay = {
          ...existingLcDay,
          variants: {
            ...existingLcDay.variants,
            [activeVariant]: {
              ...existingLcDay.variants[activeVariant],
              programs: withSmartLogos
            }
          }
        };
        set((s) => ({
          listControlDays: {
            ...s.listControlDays,
            [lcKey]: sanitizedDay
          }
        }));
      }
      return { synced: false, count: existingPrograms.length, source: 'existing' };
    }

    const readyDay = state.days?.[readyKey] || state.days?.[finalKey];
    const placements = state.adPlacements?.[readyKey] || [];
    const materials = state.materials || [];
    const companies = state.companies || [];
    const products = state.products || [];

    // 1. Kaynak program listesini belirle: Önce readyDay, yoksa BroadcastStore'daki Liste A
    let sourcePrograms = [];
    let sourceLabel = 'Reklam Rezervasyon';
    let dayStartTime = readyDay?.startTime || 0;

    if (readyDay && readyDay.variants) {
      const rVar = readyDay.activeVariant || 'v1';
      sourcePrograms = readyDay.variants[rVar]?.programs || [];
    }

    if (sourcePrograms.length === 0) {
      try {
        const bStore = useBroadcastStore.getState();
        const bProgs = bStore.getComputedDayPrograms(channelId, dateStr, 'A') || [];
        if (bProgs.length > 0) {
          sourceLabel = 'Yayın Planlama & Reklam Havuzu';
          sourcePrograms = bProgs.map((bp, idx) => {
            const durSec = Number(bp.durationSec) || Math.round((Number(bp.durationFrames) || 0) / 25) || 60;
            return {
              ...bp,
              id: bp.fileId || bp.clipId || bp.id || `prog-${idx + 1}`,
              fileId: bp.fileId || null,
              title: bp.clipName || bp.title || bp.name || 'Program',
              clipName: bp.clipName || bp.title || bp.name || '',
              fileName: bp.fileName || (bp.fileId ? `${bp.fileId}.mxf` : ''),
              duration: durSec / 60,
              durationSec: durSec,
              categoryName: bp.category || bp.categoryName || 'Genel',
              categoryColor: bp.categoryColor || '#3b82f6',
              instanceId: bp.instanceId || `bprog-${idx}-${Date.now()}`
            };
          });
        }
      } catch (_) {}
    }

    if (sourcePrograms.length === 0) {
      return { synced: false, count: 0, source: 'empty' };
    }

    let allocatedAdDuration = 0;
    const flattenedPrograms = [];
    let runningMinute = dayStartTime;
    let breakCounter = 0;

    sourcePrograms.forEach((prog, pIdx) => {
      if (String(prog.id).toUpperCase() === 'TPL-4') return; // Eski boş kuşak dolgusunu atla

      const progStartMin = prog.startMinute !== undefined ? Number(prog.startMinute) : runningMinute;
      const h = Math.floor(progStartMin / 60) % 24;
      const m = Math.floor(progStartMin % 60);
      const shortTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const progDurMin = parseFloat(prog.duration) || ((Number(prog.durationSec) || 0) / 60) || 0;
      runningMinute = progStartMin + progDurMin;

      const isAdBreak =
        prog.type === 'ad_break' ||
        String(prog.id).toUpperCase() === 'TPL-3' ||
        (prog.title && String(prog.title).toUpperCase().includes('REKLAM KUŞAĞI'));

      if (isAdBreak && !prog.isAdClip) {
        breakCounter++;
        allocatedAdDuration += progDurMin;

        // Eşleşen reklam kuşağı yerleşimini bul
        const bp =
          placements.find(p => prog.instanceId && p.blockId === prog.instanceId) ||
          placements.find(p => p.time === shortTime) ||
          placements[breakCounter - 1];

        const breakLabel = bp?.label || prog.title || `${breakCounter}. Reklam Kuşağı`;
        const breakBlockId = bp?.blockId || prog.instanceId || `break-${breakCounter}`;

        if (bp && Array.isArray(bp.ads) && bp.ads.length > 0) {
          bp.ads.forEach((ad, adIdx) => {
            const material = materials.find(mat => String(mat.id) === String(ad.materialId));
            const company = companies.find(c => String(c.id) === String(ad.companyId || material?.companyId));
            const product = products.find(pr => String(pr.id) === String(ad.productId || material?.productId));
            const adDurSec = Math.max(1, parseFloat(ad.duration) || parseFloat(material?.duration) || 15);
            const resolvedClipId = material?.clipId || ad.clipId || material?.code || ad.code || ad.materialId || ad.id;
            const pureAdFileId = extractPureNumericId(material?.clipId, ad.clipId, material?.code, ad.code);
            const rawCodeBase = material?.code || ad.code || resolvedClipId || (material?.clipName || ad.clipName || 'reklam');
            const resolvedCode = /\.[a-zA-Z0-9]{2,5}$/.test(String(rawCodeBase))
              ? String(rawCodeBase)
              : `${String(rawCodeBase).replace(/\.[^.]+$/, '')}.mxf`;

            const adRow = {
              ...prog,
              id: resolvedClipId || `AD-${breakCounter}-${adIdx + 1}`,
              fileId: pureAdFileId,
              clipId: resolvedClipId || null,
              code: resolvedCode,
              fileName: resolvedCode,
              materialId: ad.materialId || material?.id || null,
              companyId: ad.companyId || material?.companyId || null,
              companyName: ad.companyName || company?.name || '',
              productId: ad.productId || material?.productId || null,
              productName: ad.productName || product?.name || '',
              title: material
                ? (material.clipName || material.name)
                : (ad.clipName || ad.name || ad.materialName || 'Reklam Klibi'),
              clipName: material?.clipName || ad.clipName || ad.name || '',
              duration: adDurSec / 60,
              durationSec: adDurSec,
              instanceId: ad.instanceId || `lc-ad-${breakCounter}-${adIdx}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'ad_spot',
              isAdClip: true,
              isFromAds: true,
              isBumperAd: Boolean(ad.isBumperAd),
              bumperType: ad.bumperType || null,
              bumperCategoryName: ad.bumperCategoryName || null,
              isSponsor: Boolean(ad.isSponsor || ad.sponsorRole),
              sponsorRole: ad.sponsorRole || null,
              parentBreakId: breakBlockId,
              parentBreakOrder: breakCounter,
              parentBreakTitle: breakLabel,
              adOrderInBreak: adIdx + 1,
              adTotalInBreak: bp.ads.length,
              stageOrigin: 'ads'
            };
            adRow.logo = resolveProgramLogoForChannel(adRow, channelId, state.adSettings);
            flattenedPrograms.push(adRow);
          });
        } else {
          // Eğer reklam kuşağının içi boş bırakılmışsa uyarı satırı olarak koru ki operatör reklam ekleyebilsin veya revize isteyebilsin
          const emptyBreakRow = {
            ...prog,
            id: prog.id || `EMPTY-BREAK-${breakCounter}`,
            title: `${breakLabel} (Spot Yerleştirilmemiş Boş Kuşak)`,
            duration: progDurMin || 3,
            durationSec: Math.round((progDurMin || 3) * 60),
            instanceId: prog.instanceId || `lc-empty-break-${breakCounter}`,
            type: 'ad_break',
            isAdClip: true,
            isFromAds: true,
            isEmptyAdBreak: true,
            parentBreakId: breakBlockId,
            parentBreakOrder: breakCounter,
            parentBreakTitle: breakLabel,
            stageOrigin: 'ads'
          };
          emptyBreakRow.logo = resolveProgramLogoForChannel(emptyBreakRow, channelId, state.adSettings);
          flattenedPrograms.push(emptyBreakRow);
        }
      } else {
        const durSec = Math.max(1, Math.round(Number(prog.durationSec) || progDurMin * 60 || 60));
        const sanitized = sanitizeProgramCodeAndFileId(prog);
        const progRow = {
          ...prog,
          fileId: sanitized.fileId,
          clipId: prog.clipId || sanitized.fileId || prog.id,
          code: sanitized.code,
          fileName: sanitized.fileName,
          duration: durSec / 60,
          durationSec: durSec,
          instanceId: prog.instanceId || `lc-prog-${pIdx}-${Math.random().toString(36).slice(2, 7)}`,
          stageOrigin: prog.isAdClip || prog.isFromAds ? 'ads' : (prog.isFromDraft ? 'draft' : 'broadcast')
        };
        progRow.logo = resolveProgramLogoForChannel(progRow, channelId, state.adSettings);
        flattenedPrograms.push(progRow);
      }
    });

    const recalculated = applySmartLogoTransitions(
      _recalculateStartTimes(flattenedPrograms, dayStartTime),
      channelId,
      state.adSettings
    );
    const updatedDay = {
      ...(readyDay || createEmptyDay(dateStr)),
      date: dateStr,
      startTime: dayStartTime,
      activeVariant: 'v1',
      allocatedAdDuration,
      syncedFromSource: sourceLabel,
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variants: {
        ...(readyDay?.variants || {}),
        v1: {
          programs: recalculated
        }
      }
    };

    set((s) => ({
      listControlDays: {
        ...s.listControlDays,
        [lcKey]: updatedDay
      }
    }));

    syncListControlDayToServer(lcKey, updatedDay);

    if (!silent) {
      get().lcAddAuditLog({
        channelId,
        date: dateStr,
        actionType: 'sync_from_ads',
        actionLabel: 'Liste Reklam Rezervasyondan Senkronize Edildi',
        itemType: 'system',
        itemTitle: `${recalculated.length} Satır (${breakCounter} Reklam Kuşağı)`,
        details: `${sourceLabel} üzerinden gelen yayın ve reklam listesi (${recalculated.length} öğe) Liste Kontrol ekranına aktarıldı.`,
        status: 'success'
      });
    }

    return { synced: true, count: recalculated.length, source: sourceLabel };
  },

  /**
   * Listedeki bir klibi veya reklamı yeni bir klip/bölüm veya reklam materyali ile değiştirir (Swap).
   */
  lcReplaceItem: (channelId, dateStr, variant = 'v1', targetInstanceId, newItemPayload = {}) => {
    get()._saveSnapshot();
    const lcKey = `list-control-${channelId}-${dateStr}`;
    let replacedOldItem = null;
    let replacedNewItem = null;

    set((state) => {
      const day = state.listControlDays[lcKey];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');
      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const idx = programs.findIndex(p => p.instanceId === targetInstanceId);
      if (idx === -1) return state;

      const oldItem = programs[idx];
      replacedOldItem = oldItem;

      const isReplacingWithAd = Boolean(newItemPayload.isAdClip || newItemPayload.isFromAds || oldItem.isAdClip);
      const durSec = Math.max(
        1,
        Math.round(
          Number(newItemPayload.durationSec) ||
          (Number(newItemPayload.duration) ? Number(newItemPayload.duration) * 60 : 0) ||
          Number(oldItem.durationSec) ||
          (Number(oldItem.duration) || 1) * 60
        )
      );

      const rawId = newItemPayload.fileId || newItemPayload.clipId || newItemPayload.id || oldItem.id;
      const sanitizedNew = sanitizeProgramCodeAndFileId({ ...oldItem, ...newItemPayload, id: rawId });

      const updatedItem = {
        ...oldItem,
        ...newItemPayload,
        id: rawId,
        fileId: sanitizedNew.fileId,
        clipId: newItemPayload.clipId || sanitizedNew.fileId || rawId,
        code: sanitizedNew.code,
        fileName: sanitizedNew.fileName,
        title: newItemPayload.title || newItemPayload.clipName || newItemPayload.name || oldItem.title,
        clipName: newItemPayload.clipName || newItemPayload.name || newItemPayload.title || oldItem.clipName,
        duration: durSec / 60,
        durationSec: durSec,
        instanceId: oldItem.instanceId, // Aynı satır kimliğini koru
        isAdClip: isReplacingWithAd,
        isFromAds: isReplacingWithAd,
        isEmptyAdBreak: false,
        modifiedInListControl: true,
        previousItemSnapshot: {
          id: oldItem.id,
          fileId: oldItem.fileId,
          code: oldItem.code || oldItem.fileName,
          title: oldItem.title,
          durationSec: oldItem.durationSec || Math.round((Number(oldItem.duration) || 0) * 60),
          episodeNo: oldItem.episodeNo
        },
        modifiedAt: new Date().toISOString()
      };
      updatedItem.logo = resolveProgramLogoForChannel(updatedItem, channelId, state.adSettings);
      replacedNewItem = updatedItem;

      programs[idx] = updatedItem;
      const recalculated = applySmartLogoTransitions(
        _recalculateStartTimes(programs, day.startTime || 0),
        channelId,
        state.adSettings
      );

      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [vKey]: {
            ...day.variants[vKey],
            programs: recalculated
          }
        }
      };

      syncListControlDayToServer(lcKey, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [lcKey]: updatedDay
        }
      };
    });

    if (replacedOldItem && replacedNewItem) {
      const isAd = Boolean(replacedNewItem.isAdClip);
      get().lcAddAuditLog({
        channelId,
        date: dateStr,
        actionType: isAd ? 'ad_replace' : 'clip_replace',
        actionLabel: isAd ? 'Reklam Spotu Değiştirildi' : 'Program Klibi / Bölümü Değiştirildi',
        itemType: isAd ? 'ad' : 'clip',
        itemTitle: replacedNewItem.title,
        itemCode: replacedNewItem.code || String(replacedNewItem.id || ''),
        oldValue: `${replacedOldItem.title} (${replacedOldItem.code || replacedOldItem.id || '-'} • ${formatSecLabel(replacedOldItem.durationSec || (replacedOldItem.duration || 0) * 60)})`,
        newValue: `${replacedNewItem.title} (${replacedNewItem.code || replacedNewItem.id || '-'} • ${formatSecLabel(replacedNewItem.durationSec)})`,
        details: `"${replacedOldItem.title}" öğesi Liste Kontrol'de "${replacedNewItem.title}" ile değiştirildi.`,
        status: 'success'
      });
    }
  },

  /**
   * Listedeki bir klibin veya reklamın süresini (saniye bazında) günceller ve tüm başlangıç/bitiş saatlerini yeniden hesaplar.
   */
  lcUpdateItemDurationSec: (channelId, dateStr, variant = 'v1', targetInstanceId, newDurationSec) => {
    const safeSec = Math.max(1, Math.round(Number(newDurationSec) || 0));
    get()._saveSnapshot();
    const lcKey = `list-control-${channelId}-${dateStr}`;
    let oldItemSnap = null;
    let oldDurSec = 0;

    set((state) => {
      const day = state.listControlDays[lcKey];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');
      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const idx = programs.findIndex(p => p.instanceId === targetInstanceId);
      if (idx === -1) return state;

      oldItemSnap = programs[idx];
      oldDurSec = Math.round(Number(oldItemSnap.durationSec) || (Number(oldItemSnap.duration) || 0) * 60);

      programs[idx] = {
        ...oldItemSnap,
        duration: safeSec / 60,
        durationSec: safeSec,
        durationModifiedInListControl: true,
        originalDurationSec: oldItemSnap.originalDurationSec || oldDurSec,
        modifiedAt: new Date().toISOString()
      };

      const recalculated = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [vKey]: {
            ...day.variants[vKey],
            programs: recalculated
          }
        }
      };

      syncListControlDayToServer(lcKey, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [lcKey]: updatedDay
        }
      };
    });

    if (oldItemSnap && oldDurSec !== safeSec) {
      const isAd = Boolean(oldItemSnap.isAdClip);
      get().lcAddAuditLog({
        channelId,
        date: dateStr,
        actionType: 'duration_edit',
        actionLabel: isAd ? 'Reklam Süresi Güncellendi' : 'Klip Süresi Güncellendi',
        itemType: isAd ? 'ad' : 'clip',
        itemTitle: oldItemSnap.title,
        itemCode: oldItemSnap.code || String(oldItemSnap.id || ''),
        oldValue: formatSecLabel(oldDurSec),
        newValue: formatSecLabel(safeSec),
        details: `"${oldItemSnap.title}" süresi ${formatSecLabel(oldDurSec)} -> ${formatSecLabel(safeSec)} olarak güncellendi.`,
        status: 'success'
      });
    }
  },

  /**
   * Satır bazında Logo Giriş / Çıkış tetiklemesini ('auto' | 'yayin_giris' | 'yayin_cikis' | 'reklam_giris' | 'reklam_cikis' | 'none') günceller.
   */
  lcUpdateItemLogoEvent: (channelId, dateStr, variant = 'v1', targetInstanceId, manualLogoEvent = 'auto') => {
    get()._saveSnapshot();
    const lcKey = `list-control-${channelId}-${dateStr}`;
    let targetTitle = '';

    set((state) => {
      const day = state.listControlDays[lcKey];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');
      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const idx = programs.findIndex(p => p.instanceId === targetInstanceId);
      if (idx === -1) return state;

      targetTitle = programs[idx].title;
      programs[idx] = {
        ...programs[idx],
        manualLogoEvent
      };

      const withSmartLogos = applySmartLogoTransitions(programs, channelId, state.adSettings);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [vKey]: {
            ...day.variants[vKey],
            programs: withSmartLogos
          }
        }
      };

      syncListControlDayToServer(lcKey, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [lcKey]: updatedDay
        }
      };
    });

    if (targetTitle) {
      const labelMap = {
        auto: 'Otomatik (Giriş/Çıkış)',
        yayin_giris: '📺 Yayın Logo Giriş',
        yayin_cikis: '📺 Yayın Logo Çıkış',
        reklam_giris: '📢 Reklam Logo Giriş',
        reklam_cikis: '📢 Reklam Logo Çıkış',
        none: '— (Logo Tetiklemesi Yok)'
      };
      get().lcAddAuditLog({
        channelId,
        date: dateStr,
        actionType: 'logo_trigger_edit',
        actionLabel: 'Logo Giriş / Çıkış İşareti Güncellendi',
        itemType: 'clip',
        itemTitle: targetTitle,
        oldValue: '-',
        newValue: labelMap[manualLogoEvent] || manualLogoEvent,
        details: `"${targetTitle}" satırının logo giriş/çıkış durumu [${labelMap[manualLogoEvent] || manualLogoEvent}] olarak ayarlandı.`,
        status: 'success'
      });
    }
  },

  /**
   * Akıllı Revize İsteme Sistemi (Satır Bazlı veya Bütün Günü Revizeye Gönderme):
   * - Bütün Gün Revizesi (`isFullDayRevision: true`): Operatörün seçtiği birime ('draft' = Taslak Planlama, 'broadcast' = Yayın Planlama, 'ads' = Reklam Rezervasyon, 'all' = Tüm Birimler) bütün günü revizeye gönderir.
   * - Satır Bazlı Revize: Klip için Taslak/Yayın Planlama, Reklam için Reklam Rezervasyon aşamasına gönderir.
   * - Açıklama (`reason`) zorunludur.
   */
  lcRequestRevision: ({
    channelId,
    date,
    variant = 'v1',
    item = null,
    targetStage = 'broadcast', // 'draft' | 'broadcast' | 'ads' | 'both' | 'all'
    reason = '',
    isFullDayRevision = false,
    operator = 'Liste Kontrol Operatörü'
  }) => {
    const cleanReason = String(reason || '').trim();
    if (!cleanReason) {
      throw new Error('Revize açıklaması zorunludur.');
    }
    const nowIso = new Date().toISOString();
    const lcKey = `list-control-${channelId}-${date}`;
    const readyKey = `ready-${channelId}-${date}`;
    const finalKey = `final-${channelId}-${date}`;
    const draftKey = `draft-${channelId}-${date}`;

    const isFullDay = Boolean(isFullDayRevision || !item || item?.isFullDayRevision);
    const isAdItem = !isFullDay && Boolean(item?.isAdClip || item?.isFromAds || item?.type === 'ad_break' || targetStage === 'ads');
    const effectiveStage = isAdItem ? 'ads' : targetStage;

    const stageLabelMap = {
      draft: 'Taslak Planlama Birimi',
      broadcast: 'Yayın Planlama Birimi',
      both: 'Taslak Planlama + Yayın Planlama Birimleri',
      ads: 'Reklam Rezervasyon Birimi',
      all: 'Tüm Birimler (Taslak + Yayın Planlama + Reklam Rezervasyon)'
    };
    const stageLabel = stageLabelMap[effectiveStage] || 'Yayın Planlama Birimi';

    const revisionRecord = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requestedAt: nowIso,
      channelId,
      date,
      isFullDayRevision: isFullDay,
      targetStage: effectiveStage,
      targetStageLabel: stageLabel,
      reason: cleanReason,
      operator,
      itemInstanceId: isFullDay ? null : (item?.instanceId || null),
      itemId: isFullDay ? null : (item?.id || item?.fileId || item?.clipId || null),
      itemCode: isFullDay ? date : (item?.code || item?.fileName || ''),
      itemTitle: isFullDay ? `${date} Tüm Gün Yayın & Reklam Listesi` : (item?.title || 'Tüm Gün Listesi'),
      isAd: isAdItem,
      status: 'pending'
    };

    set((state) => {
      const lcDay = state.listControlDays[lcKey] || createEmptyDay(date);
      const vKey = lcDay.variants?.[variant] ? variant : (lcDay.activeVariant || 'v1');
      const currentProgs = [...(lcDay.variants?.[vKey]?.programs || [])];

      const updatedProgs = currentProgs.map(p => {
        if (!isFullDay && item?.instanceId && p.instanceId === item.instanceId) {
          return {
            ...p,
            revisionRequested: true,
            revisionTargetStage: effectiveStage,
            revisionTargetLabel: stageLabel,
            revisionReason: cleanReason,
            revisionRequestedAt: nowIso
          };
        }
        return p;
      });

      const prevRevisions = Array.isArray(lcDay.revisions) ? lcDay.revisions : [];
      const updatedLcDay = {
        ...lcDay,
        isRevised: true,
        isFullDayRevised: isFullDay || Boolean(lcDay.isFullDayRevised),
        isApprovedInListControl: false,
        lastRevision: revisionRecord,
        revisions: [revisionRecord, ...prevRevisions],
        updatedAt: nowIso,
        variants: {
          ...lcDay.variants,
          [vKey]: {
            ...(lcDay.variants?.[vKey] || {}),
            programs: updatedProgs
          }
        }
      };

      const nextDays = { ...state.days };

      // 1. Eğer Reklam Rezervasyona (veya Tüm Birimlere) revize gittiyse ready ve final günlerini 'revised' olarak işaretle
      if (effectiveStage === 'ads' || effectiveStage === 'all') {
        const rDay = nextDays[readyKey] || createEmptyDay(date);
        nextDays[readyKey] = {
          ...rDay,
          isRevised: true,
          adsStatus: 'revised',
          revisionCount: (Number(rDay.revisionCount) || 0) + 1,
          revisionReason: cleanReason,
          revisionItemTitle: revisionRecord.itemTitle,
          revisionRequestedAt: nowIso,
          updatedAt: nowIso
        };
        if (nextDays[finalKey]) {
          nextDays[finalKey] = {
            ...nextDays[finalKey],
            isRevised: true,
            adsStatus: 'revised',
            revisionReason: cleanReason,
            revisionRequestedAt: nowIso
          };
        }
      }

      // 2. Eğer Taslak Planlama aşamasına (veya Her İkisine / Tüm Birimlere) revize gittiyse draft gününü işaretle
      if (effectiveStage === 'draft' || effectiveStage === 'both' || effectiveStage === 'all') {
        const dDay = nextDays[draftKey] || createEmptyDay(date);
        nextDays[draftKey] = {
          ...dDay,
          isRevised: true,
          revisionFromListControl: revisionRecord,
          revisionReason: cleanReason,
          revisionRequestedAt: nowIso,
          updatedAt: nowIso
        };
      }

      // 3. Eğer Yayın Planlama aşamasına (veya Her İkisine / Tüm Birimlere) revize gittiyse ready gününü işaretle
      if (effectiveStage === 'broadcast' || effectiveStage === 'both' || effectiveStage === 'all') {
        const rDay = nextDays[readyKey] || createEmptyDay(date);
        nextDays[readyKey] = {
          ...rDay,
          isRevised: true,
          broadcastRevisionRequested: true,
          revisionFromListControl: revisionRecord,
          revisionReason: cleanReason,
          revisionRequestedAt: nowIso,
          updatedAt: nowIso
        };
      }

      pushAdsStoreToServer({
        planningDays: nextDays,
        listControlDays: {
          [lcKey]: updatedLcDay
        }
      });

      return {
        days: nextDays,
        listControlDays: {
          ...state.listControlDays,
          [lcKey]: updatedLcDay
        }
      };
    });

    get().lcAddAuditLog({
      channelId,
      date,
      actionType: 'revision_request',
      actionLabel: `${isFullDay ? 'Bütün Gün Revizeye Gönderildi' : 'Satır Revize Talebi Gönderildi'} → ${stageLabel}`,
      itemType: isFullDay ? 'system' : (isAdItem ? 'ad' : 'clip'),
      itemTitle: revisionRecord.itemTitle,
      itemCode: revisionRecord.itemCode,
      targetStage: effectiveStage,
      oldValue: 'Kontrol Aşamasında',
      newValue: `Revize: ${stageLabel}`,
      details: `[${stageLabel}] "${revisionRecord.itemTitle}" için revize istendi. Zorunlu Açıklama: ${cleanReason}`,
      status: 'warning',
      operator
    });

    return revisionRecord;
  },

  lcAddProgramToDay: (channelId, date, variant = 'v1', program, insertIndex = -1, providedInstanceId) => {
    get()._saveSnapshot();
    const key = get().lcEnsureDayExists(channelId, date);
    let addedProgramObj = null;

    set((state) => {
      const day = state.listControlDays[key];
      if (!day) return state;

      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');
      const durSec = Math.max(
        1,
        Math.round(
          Number(program.durationSec) ||
          (Number(program.duration) ? Number(program.duration) * 60 : 60)
        )
      );
      const rawId = program.fileId || program.clipId || program.id || `item-${Date.now()}`;
      const sanitizedAdd = sanitizeProgramCodeAndFileId({ ...program, id: rawId });

      const newInstanceId = providedInstanceId || `lc-${rawId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newProgram = {
        ...program,
        id: rawId,
        fileId: sanitizedAdd.fileId,
        clipId: program.clipId || sanitizedAdd.fileId || rawId,
        code: sanitizedAdd.code,
        fileName: sanitizedAdd.fileName,
        title: program.title || program.clipName || program.name || 'Yeni Öğe',
        clipName: program.clipName || program.name || program.title || '',
        duration: durSec / 60,
        durationSec: durSec,
        instanceId: newInstanceId,
        addedInListControl: true,
        stageOrigin: program.isAdClip || program.isFromAds ? 'ads' : 'list-control',
        logo: program.logo || resolveProgramLogoForChannel(program, channelId, state.adSettings)
      };
      addedProgramObj = newProgram;

      const currentPrograms = [...(day.variants?.[vKey]?.programs || [])];
      let finalIndex = insertIndex;
      if (finalIndex === -1) {
        if (state.insertPosition === 'en_ust') {
          finalIndex = 0;
        } else if (state.insertPosition === 'ust') {
          finalIndex = state.lastSelectedIndex !== -1 ? state.lastSelectedIndex : 0;
        } else if (state.insertPosition === 'alt') {
          finalIndex = state.lastSelectedIndex !== -1 ? state.lastSelectedIndex + 1 : currentPrograms.length;
        } else {
          finalIndex = currentPrograms.length;
        }
      }

      if (finalIndex >= currentPrograms.length || finalIndex < 0) {
        currentPrograms.push(newProgram);
      } else {
        currentPrograms.splice(finalIndex, 0, newProgram);
      }

      const updatedPrograms = applySmartLogoTransitions(
        _recalculateStartTimes(currentPrograms, day.startTime || 0),
        channelId,
        state.adSettings
      );
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [vKey]: { ...day.variants[vKey], programs: updatedPrograms }
        }
      };

      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });

    if (addedProgramObj) {
      const isAd = Boolean(addedProgramObj.isAdClip || addedProgramObj.isFromAds);
      get().lcAddAuditLog({
        channelId,
        date,
        actionType: isAd ? 'ad_add' : 'clip_add',
        actionLabel: isAd ? 'Listeye Reklam Spotu Eklendi' : 'Listeye Klip / Bölüm Eklendi',
        itemType: isAd ? 'ad' : 'clip',
        itemTitle: addedProgramObj.title,
        itemCode: addedProgramObj.code || String(addedProgramObj.id || ''),
        oldValue: '-',
        newValue: `${addedProgramObj.title} (${formatSecLabel(addedProgramObj.durationSec)})`,
        details: `Liste Kontrol ekranında "${addedProgramObj.title}" akışa eklendi.`,
        status: 'success'
      });
    }
  },

  lcMoveProgramUp: (channelId, date, variant = 'v1', instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index <= 0) return state;

      const temp = programs[index - 1];
      programs[index - 1] = programs[index];
      programs[index] = temp;

      const updatedPrograms = applySmartLogoTransitions(
        _recalculateStartTimes(programs, day.startTime || 0),
        channelId,
        state.adSettings
      );
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [vKey]: { ...day.variants[vKey], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcMoveProgramDown: (channelId, date, variant = 'v1', instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1 || index >= programs.length - 1) return state;

      const temp = programs[index + 1];
      programs[index + 1] = programs[index];
      programs[index] = temp;

      const updatedPrograms = applySmartLogoTransitions(
        _recalculateStartTimes(programs, day.startTime || 0),
        channelId,
        state.adSettings
      );
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [vKey]: { ...day.variants[vKey], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcReorderProgram: (channelId, date, variant = 'v1', oldIndex, newIndex) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const programs = [...(day.variants?.[vKey]?.programs || [])];
      if (oldIndex < 0 || oldIndex >= programs.length || newIndex < 0 || newIndex >= programs.length) return state;

      const [movedItem] = programs.splice(oldIndex, 1);
      programs.splice(newIndex, 0, movedItem);

      const updatedPrograms = applySmartLogoTransitions(
        _recalculateStartTimes(programs, day.startTime || 0),
        channelId,
        state.adSettings
      );
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [vKey]: { ...day.variants[vKey], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcDuplicateProgram: (channelId, date, variant = 'v1', instanceId) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1) return state;

      const programToCopy = programs[index];
      const newProgram = { ...programToCopy, instanceId: `${programToCopy.id}-${Date.now()}` };
      programs.splice(index + 1, 0, newProgram);

      const updatedPrograms = _recalculateStartTimes(programs, day.startTime || 0);
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [vKey]: { ...day.variants[vKey], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcUpdateProgramTime: (channelId, date, variant = 'v1', instanceId, newDuration, newStartMinute, newTitle) => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const programs = [...(day.variants?.[vKey]?.programs || [])];
      const index = programs.findIndex(p => p.instanceId === instanceId);
      if (index === -1) return state;

      if (newDuration !== undefined) {
        programs[index].duration = newDuration;
        programs[index].durationSec = Math.round(Number(newDuration) * 60);
      }

      if (newTitle !== undefined) {
        programs[index].title = newTitle;
      }

      let updatedPrograms;
      let newDayStartTime = day.startTime;

      if (newStartMinute !== undefined) {
        if (index === 0) {
          newDayStartTime = newStartMinute;
        }
        programs[index].startMinute = newStartMinute;
        updatedPrograms = [...programs];
        let currentStart = newStartMinute + updatedPrograms[index].duration;
        for (let i = index + 1; i < updatedPrograms.length; i++) {
          updatedPrograms[i].startMinute = currentStart;
          currentStart += updatedPrograms[i].duration;
        }
      } else {
        updatedPrograms = _recalculateStartTimes(programs, newDayStartTime || 0);
      }

      const updatedDay = {
        ...day,
        startTime: newDayStartTime,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [vKey]: { ...day.variants[vKey], programs: updatedPrograms } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  },

  lcRemovePrograms: (channelId, date, variant = 'v1', instanceIds = []) => {
    get()._saveSnapshot();
    const removedItems = [];

    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const currentProgs = day.variants?.[vKey]?.programs || [];
      currentProgs.forEach(p => {
        if (instanceIds.includes(p.instanceId)) {
          removedItems.push(p);
        }
      });

      const programs = currentProgs.filter(p => !instanceIds.includes(p.instanceId));
      const updatedPrograms = applySmartLogoTransitions(
        _recalculateStartTimes(programs, day.startTime || 0),
        channelId,
        state.adSettings
      );
      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: {
          ...day.variants,
          [vKey]: { ...day.variants[vKey], programs: updatedPrograms }
        }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        },
        selectedInstanceIds: [],
        selectedTimelineBlock: null
      };
    });

    removedItems.forEach(item => {
      const isAd = Boolean(item.isAdClip || item.isFromAds);
      get().lcAddAuditLog({
        channelId,
        date,
        actionType: isAd ? 'ad_delete' : 'clip_delete',
        actionLabel: isAd ? 'Reklam Spotu Silindi' : 'Klip / Program Silindi',
        itemType: isAd ? 'ad' : 'clip',
        itemTitle: item.title,
        itemCode: item.code || String(item.id || ''),
        oldValue: `${item.title} (${formatSecLabel(item.durationSec || (item.duration || 0) * 60)})`,
        newValue: 'Silindi',
        details: `Liste Kontrol ekranından "${item.title}" silindi.`,
        status: 'warning'
      });
    });
  },

  lcApproveDayList: (channelId, dateStr, summaryNotes = '') => {
    const nowIso = new Date().toISOString();
    const lcKey = `list-control-${channelId}-${dateStr}`;
    const finalKey = `final-${channelId}-${dateStr}`;
    const readyKey = `ready-${channelId}-${dateStr}`;

    set((state) => {
      const lcDay = state.listControlDays[lcKey];
      if (!lcDay) return state;

      const updatedLcDay = {
        ...lcDay,
        isApprovedInListControl: true,
        approvedAt: nowIso,
        isRevised: false,
        adsStatus: 'sent_to_master',
        approvalNotes: summaryNotes,
        updatedAt: nowIso
      };

      const nextDays = { ...state.days };
      if (nextDays[readyKey]) {
        nextDays[readyKey] = {
          ...nextDays[readyKey],
          adsStatus: 'sent_to_master',
          isApprovedInListControl: true,
          approvedAt: nowIso
        };
      }
      if (nextDays[finalKey]) {
        nextDays[finalKey] = {
          ...nextDays[finalKey],
          adsStatus: 'sent_to_master',
          isApprovedInListControl: true,
          approvedAt: nowIso
        };
      }

      pushAdsStoreToServer({
        planningDays: nextDays,
        listControlDays: { [lcKey]: updatedLcDay }
      });

      return {
        days: nextDays,
        listControlDays: {
          ...state.listControlDays,
          [lcKey]: updatedLcDay
        }
      };
    });

    get().lcAddAuditLog({
      channelId,
      date: dateStr,
      actionType: 'approve_list',
      actionLabel: 'Yayın Listesi Kontrol Edildi ve Onaylandı',
      itemType: 'system',
      itemTitle: `${dateStr} Nihai Yayın Listesi`,
      oldValue: 'Kontrol Aşamasında',
      newValue: 'Onaylandı (Dönüşüme Hazır)',
      details: summaryNotes || `${dateStr} günü yayın ve reklam listesi tüm kontrollerden geçerek onaylandı.`,
      status: 'success'
    });
  },

  lcClearDay: (channelId, date, variant = 'v1') => {
    get()._saveSnapshot();
    set((state) => {
      const key = `list-control-${channelId}-${date}`;
      const day = state.listControlDays[key];
      if (!day) return state;
      const vKey = day.variants?.[variant] ? variant : (day.activeVariant || 'v1');

      const updatedDay = {
        ...day,
        updatedAt: new Date().toISOString(),
        variants: { ...day.variants, [vKey]: { ...day.variants[vKey], programs: [] } }
      };
      syncListControlDayToServer(key, updatedDay);

      return {
        listControlDays: {
          ...state.listControlDays,
          [key]: updatedDay
        }
      };
    });
  }
});
