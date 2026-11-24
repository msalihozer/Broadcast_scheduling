/**
 * @file src/components/Ads/AdBreakBumpersTab.jsx
 * @description Reklam Rezervasyon Modülü — Kategori ve Kanal Bazlı "Reklam Giriş & Çıkış Jenerikleri" Yönetim Ekranı.
 *
 * Özellikler:
 * 1. Her kanal (Semerkand HD, Semerkand WAY) için ayrı veya ortak Reklam Giriş ve Reklam Çıkış klibi tanımlama.
 * 2. Birden fazla kategori için aynı Reklam Giriş / Çıkış jeneriğini çoklu seçimle bağlayabilme
 *    (Örn: Dini -> reklam_dini_giris_2014 / reklam_dini_cikis_2014; Kültürel + Haber + Detay -> reklam_kulturel_giris_2014).
 * 3. Medya Kütüphanesi, Jenerik Havuzu ve Canlı MAM Arşivi üzerinden arama yaparak klip seçme.
 * 4. Seçilen veya listedeki her Giriş/Çıkış klibini "ⓘ" butonuyla (25/30/50 FPS kare bilgisi ve ileri-geri sarılabilir oynatıcıyla) izleme.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Tv,
  Radio,
  Film,
  CheckCircle2,
  Info,
  Copy,
  RotateCcw,
  Layers,
  LogIn,
  LogOut,
  X,
  RefreshCw,
  Sparkles,
  Check
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useBroadcastStore from '../../modules/broadcast/store/broadcastStore';
import { getBumperJingleClipsFromAdsMedia } from '../../store/slices/ads/adsCatalogHelpers';
import {
  extractBaseProgramTitle,
  detectPreviousEpisodeCategoryForLiveProgram,
  resolveAdBreakBumpersForPrecedingProgram
} from '../../store/slices/ads/adsPlacementEngine';
import { BROADCAST_CATEGORIES, getCategoryDetails } from '../../utils/categoryColors';
import { filterAndSortPrefixFirst } from './reservation/reservationConstants';
import { dialog } from '../../store/dialogStore';
import AdMaterialDetailModal from './AdMaterialDetailModal';

const BASE_CATEGORY_LIST = Object.values(BROADCAST_CATEGORIES).map(c => ({
  id: c.id,
  name: c.name,
  color: c.color,
  bg: c.bg,
  border: c.border
}));

const AdBreakBumpersTab = () => {
  const channels = usePlanningStore(state => state.channels || [
    { id: 'ch_hd', name: 'Semerkand HD' },
    { id: 'ch_way', name: 'Semerkand WAY' }
  ]);
  const materials = usePlanningStore(state => state.materials || []);
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const reservations = usePlanningStore(state => state.reservations || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const planningDays = usePlanningStore(state => state.days || {});
  const libraryPrograms = usePlanningStore(state => state.libraryPrograms || []);
  const usedArchivePrograms = usePlanningStore(state => state.usedArchivePrograms || []);
  const syncUsedArchiveProgramsForAds = usePlanningStore(state => state.syncUsedArchiveProgramsForAds);
  const broadcastDays = useBroadcastStore(state => state.days || {});

  const adBreakBumperRules = usePlanningStore(state => state.adBreakBumperRules || []);
  const saveAdBreakBumperRule = usePlanningStore(state => state.saveAdBreakBumperRule);
  const deleteAdBreakBumperRule = usePlanningStore(state => state.deleteAdBreakBumperRule);
  const toggleAdBreakBumperRuleActive = usePlanningStore(state => state.toggleAdBreakBumperRuleActive);
  const copyAdBreakBumperRulesBetweenChannels = usePlanningStore(state => state.copyAdBreakBumperRulesBetweenChannels);
  const resetAdBreakBumperRulesToDefault = usePlanningStore(state => state.resetAdBreakBumperRulesToDefault);

  const [selectedChannelFilter, setSelectedChannelFilter] = useState('all'); // 'all' | 'ch_hd' | 'ch_way'
  const [tableSearch, setTableSearch] = useState('');
  const [ourCategories, setOurCategories] = useState([]);
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [quickLiveProgramInput, setQuickLiveProgramInput] = useState('');

  // Kural Ekleme / Düzenleme Modalı State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formChannelMode, setFormChannelMode] = useState('ch_hd'); // 'ch_hd' | 'ch_way' | 'both'
  const [formRuleName, setFormRuleName] = useState('');
  const [formCategories, setFormCategories] = useState([]); // ['Dini', ...]
  const [formLiveProgramNames, setFormLiveProgramNames] = useState([]); // ['Hasbihal', 'Çerçeve', ...]
  const [formLiveProgramInput, setFormLiveProgramInput] = useState('');
  const [formIsChannelDefault, setFormIsChannelDefault] = useState(false);
  const [formIntroClip, setFormIntroClip] = useState(null);
  const [formOutroClip, setFormOutroClip] = useState(null);

  // Medya Kütüphanesi Seçici State (Giriş ve Çıkış için)
  const [activePickerSlot, setActivePickerSlot] = useState('intro'); // 'intro' | 'outro'
  const [pickerSourceTab, setPickerSourceTab] = useState('jingles'); // 'jingles' | 'library' | 'archive'
  const [pickerSearch, setPickerSearch] = useState('');
  const [archiveClips, setArchiveClips] = useState([]);
  const [isSearchingArchive, setIsSearchingArchive] = useState(false);

  // Bizim Kategorileri (/api/archive/our-categories) ve Arşiv Programlarını (/api/archive/used-programs) yükle
  useEffect(() => {
    let isMounted = true;
    if (typeof syncUsedArchiveProgramsForAds === 'function') {
      syncUsedArchiveProgramsForAds();
    }
    fetch('/api/archive/our-categories')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (isMounted && Array.isArray(data?.categories)) {
          setOurCategories(data.categories);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [syncUsedArchiveProgramsForAds]);

  // Yayın Planlama, Taslak Planlama ve Reklam Planlama listelerindeki "Canlı" etiketli tüm programları otomatik çek
  // (Kaç part olduğu önemli değil, baz program adına göre birleştirilir ve her part için geçerli olur)
  const detectedLiveProgramsFromSchedules = useMemo(() => {
    const liveMap = new Map();

    const registerLiveItem = (rawProg, channelIdHint = 'ch_hd', sourceLabel = 'Yayın Listesi') => {
      if (!rawProg || rawProg.type === 'ad_break' || rawProg.isIntroClip) return;
      const isLiveTagged = Boolean(
        rawProg.isLive ||
          rawProg.type === 'live' ||
          (Array.isArray(rawProg.selectedOptions) &&
            rawProg.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
          /canl[ıi]/i.test(String(rawProg.category || '')) ||
          /canl[ıi]/i.test(String(rawProg.categoryBadge || '')) ||
          /\bcanl[ıi]\b/i.test(String(rawProg.title || rawProg.name || ''))
      );
      if (!isLiveTagged) return;

      const baseTitle = extractBaseProgramTitle(rawProg);
      if (!baseTitle || baseTitle.length < 2) return;
      const key = baseTitle.toLocaleLowerCase('tr-TR');

      if (!liveMap.has(key)) {
        liveMap.set(key, {
          baseTitle,
          channelId: channelIdHint || 'ch_hd',
          partAndSlotCount: 1,
          sourceLabel,
          rawCategory: rawProg.category || rawProg.categoryName || 'Canlı Yayın'
        });
      } else {
        const entry = liveMap.get(key);
        entry.partAndSlotCount += 1;
      }
    };

    // 1. planningStore.days (Reklam Rezervasyona Gelen ve Taslak Listeler)
    Object.entries(planningDays || {}).forEach(([dayKey, dayObj]) => {
      const chId = dayKey.includes('ch_way') ? 'ch_way' : 'ch_hd';
      const variants = dayObj?.variants || {};
      Object.values(variants).forEach(vObj => {
        (vObj?.programs || []).forEach(p => registerLiveItem(p, chId, 'Yayın Planlama'));
      });
    });

    // 2. broadcastStore.days (Yayın Planlama Liste A / Liste B)
    Object.entries(broadcastDays || {}).forEach(([bKey, dayObj]) => {
      const chId = bKey.includes('ch_way') ? 'ch_way' : 'ch_hd';
      const variants = dayObj?.variants || {};
      Object.values(variants).forEach(vObj => {
        (vObj?.programs || []).forEach(p => registerLiveItem(p, chId, 'Yayın Planlama'));
      });
    });

    // 3. Taslak Planlama localStorage kayıtları
    if (typeof window !== 'undefined' && window.localStorage) {
      ['ch_hd', 'ch_way'].forEach(chId => {
        ['draft_schedule_v5_', 'yayin_taslak_schedule_'].forEach(prefix => {
          try {
            const raw = window.localStorage.getItem(`${prefix}${chId}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              Object.values(parsed || {}).forEach(dObj => {
                (dObj?.programs || []).forEach(p => registerLiveItem(p, chId, 'Taslak Planlama'));
              });
            }
          } catch (_) {}
        });
      });
    }

    // 4. Mevcut kurallarda kayıtlı olan canlı yayın program isimleri
    (adBreakBumperRules || []).forEach(r => {
      (r.liveProgramNames || []).forEach(lpName => {
        const baseTitle = extractBaseProgramTitle(lpName);
        if (!baseTitle) return;
        const key = baseTitle.toLocaleLowerCase('tr-TR');
        if (!liveMap.has(key)) {
          liveMap.set(key, {
            baseTitle,
            channelId: r.channelId || 'ch_hd',
            partAndSlotCount: 1,
            sourceLabel: 'Kural Listesi',
            rawCategory: 'Canlı Yayın'
          });
        }
      });
    });

    const activeCh = selectedChannelFilter === 'all' ? 'ch_hd' : selectedChannelFilter;
    const stateSnapshot = {
      adBreakBumperRules,
      libraryPrograms,
      usedArchivePrograms,
      days: planningDays
    };

    return Array.from(liveMap.values()).map(item => {
      const prevEpInfo = detectPreviousEpisodeCategoryForLiveProgram(stateSnapshot, {
        title: item.baseTitle,
        category: 'Canlı Yayın',
        isLive: true
      });
      const resolved = resolveAdBreakBumpersForPrecedingProgram(
        stateSnapshot,
        activeCh,
        {
          title: item.baseTitle,
          programTitle: item.baseTitle,
          category: 'Canlı Yayın',
          isLive: true
        },
        null
      );

      return {
        ...item,
        previousEpisodeCategory: prevEpInfo?.categoryName || null,
        resolutionMethod: resolved.resolutionMethod, // 'live_rule' | 'previous_episodes' | 'channel_default'
        resolvedCategoryLabel: resolved.detectedCategoryName,
        resolvedIntroName: resolved.introBumperAd?.name || 'reklam_kulturel_giris_2014',
        resolvedOutroName: resolved.outroBumperAd?.name || 'reklam_kulturel_cikis_2014',
        matchedRule: resolved.matchedRule
      };
    });
  }, [
    planningDays,
    broadcastDays,
    adBreakBumperRules,
    libraryPrograms,
    usedArchivePrograms,
    selectedChannelFilter
  ]);

  const allAvailableCategories = useMemo(() => {
    const map = new Map();
    BASE_CATEGORY_LIST.forEach(c => {
      map.set(c.name.toLocaleLowerCase('tr-TR'), c);
    });
    ourCategories.forEach(oc => {
      const cleanName = String(oc.name || '').trim();
      if (!cleanName) return;
      const key = cleanName.toLocaleLowerCase('tr-TR');
      if (key === 'reklam' || key === 'ham') return;
      if (!map.has(key)) {
        const meta = getCategoryDetails(oc.id, cleanName);
        map.set(key, {
          id: oc.id,
          name: cleanName,
          color: oc.color || meta.bg || '#3b82f6',
          bg: `${oc.color || meta.bg || '#3b82f6'}22`,
          border: `${oc.color || meta.bg || '#3b82f6'}66`
        });
      }
    });
    return Array.from(map.values());
  }, [ourCategories]);

  // Jenerik klipleri (reklam_dini_giris_2014 vb.) + Tüm Medya Kütüphanesi birleşimi
  const bumperJingleClips = useMemo(() => getBumperJingleClipsFromAdsMedia(), []);

  const fullMediaLibraryClips = useMemo(() => {
    const map = new Map();
    bumperJingleClips.forEach(c => map.set(String(c.clipId || c.id), c));
    materials.forEach(m => {
      const key = String(m.clipId || m.id);
      if (!map.has(key)) {
        map.set(key, {
          id: String(m.id),
          clipId: String(m.clipId || m.id),
          name: m.clipName || m.name,
          displayTitle: m.name,
          code: m.code || `${key}.mxf`,
          durationSec: Number(m.duration) || 20,
          durationMs: Number(m.durationMs) || (Number(m.duration) || 20) * 1000,
          companyName: m.companyName || 'Medya Kütüphanesi',
          productName: m.productName || 'Reklam'
        });
      }
    });
    return Array.from(map.values());
  }, [bumperJingleClips, materials]);

  // Canlı MAM Arşiv araması (pickerSourceTab === 'archive' veya arama yapıldığında)
  useEffect(() => {
    if (!isFormOpen || pickerSourceTab !== 'archive') return;
    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingArchive(true);
      try {
        const q = pickerSearch.trim() || 'reklam';
        const res = await fetch(`/api/archive/clips/search?q=${encodeURIComponent(q)}&limit=80`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.clips) ? data.clips : Array.isArray(data) ? data : [];
          if (isMounted) {
            setArchiveClips(
              list.map(c => ({
                id: String(c.fileId || c.id),
                clipId: String(c.fileId || c.id),
                name: c.name || c.title || '',
                code: c.fileName || `${c.fileId || c.id}.mxf`,
                durationSec: Math.max(1, Math.round(Number(c.durationSec || c.duration || 9))),
                durationMs: Math.round(Number(c.durationSec || c.duration || 9) * 1000),
                companyName: c.categoryName || 'MAM Arşiv',
                productName: c.programTitle || 'Jenerik / Arşiv'
              }))
            );
          }
        }
      } catch (_) {
      } finally {
        if (isMounted) setIsSearchingArchive(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isFormOpen, pickerSourceTab, pickerSearch]);

  const displayedPickerClips = useMemo(() => {
    const baseList =
      pickerSourceTab === 'jingles'
        ? bumperJingleClips
        : pickerSourceTab === 'library'
        ? fullMediaLibraryClips
        : archiveClips;

    if (!pickerSearch.trim()) {
      // Eğer Giriş seçiliyorsa 'giris' geçenleri, Çıkış seçiliyorsa 'cikis' geçenleri üstte göster
      const preferredKeyword = activePickerSlot === 'intro' ? 'giris' : 'cikis';
      return [...baseList]
        .sort((a, b) => {
          const aHas = String(a.name || '').toLowerCase().includes(preferredKeyword) ? 1 : 0;
          const bHas = String(b.name || '').toLowerCase().includes(preferredKeyword) ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          return String(a.name || '').localeCompare(String(b.name || ''), 'tr');
        })
        .slice(0, 150);
    }

    return filterAndSortPrefixFirst(
      baseList,
      pickerSearch,
      c => c?.name || c?.displayTitle || '',
      c => `${c?.code || ''} ${c?.clipId || ''} ${c?.companyName || ''}`
    );
  }, [pickerSourceTab, bumperJingleClips, fullMediaLibraryClips, archiveClips, pickerSearch, activePickerSlot]);

  const filteredRules = useMemo(() => {
    let list = adBreakBumperRules.filter(r => {
      if (selectedChannelFilter !== 'all' && String(r.channelId) !== String(selectedChannelFilter)) {
        return false;
      }
      return true;
    });

    if (tableSearch.trim()) {
      list = filterAndSortPrefixFirst(
        list,
        tableSearch,
        r => `${(r.categories || []).join(' ')} ${(r.liveProgramNames || []).join(' ')} ${r.ruleName || ''}`,
        r => `${r.introClip?.name || ''} ${r.outroClip?.name || ''} ${r.introClip?.code || ''} ${r.outroClip?.code || ''}`
      );
    }
    return list;
  }, [adBreakBumperRules, selectedChannelFilter, tableSearch]);

  const openNewRuleModal = (
    preselectChannelId = null,
    preselectCategoryName = null,
    preselectLiveProgramName = null,
    isDefaultRuleMode = false
  ) => {
    setEditingRule(null);
    setFormChannelMode(
      preselectChannelId
        ? preselectChannelId
        : selectedChannelFilter !== 'all'
        ? selectedChannelFilter
        : 'ch_hd'
    );
    setFormIsChannelDefault(Boolean(isDefaultRuleMode));
    setFormRuleName(
      isDefaultRuleMode
        ? 'Canlı Yayın & Kategorisiz Programlar Varsayılan (Default) Giriş & Çıkışı'
        : preselectLiveProgramName
        ? `Canlı Yayın: ${preselectLiveProgramName} (Tüm Partlar) Reklam Giriş & Çıkışı`
        : preselectCategoryName
        ? `${preselectCategoryName} Programları Reklam Giriş & Çıkışı`
        : ''
    );
    setFormCategories(preselectCategoryName ? [preselectCategoryName] : []);
    setFormLiveProgramNames(preselectLiveProgramName ? [extractBaseProgramTitle(preselectLiveProgramName)] : []);
    setFormLiveProgramInput('');
    setFormIntroClip(null);
    setFormOutroClip(null);
    setActivePickerSlot('intro');
    setPickerSourceTab('jingles');
    setPickerSearch('');
    setIsFormOpen(true);
  };

  const openEditRuleModal = rule => {
    setEditingRule(rule);
    setFormChannelMode(rule.channelId || 'ch_hd');
    setFormIsChannelDefault(Boolean(rule.isChannelDefault));
    setFormRuleName(rule.ruleName || '');
    setFormCategories(
      rule.isChannelDefault
        ? []
        : Array.isArray(rule.categories)
        ? [...rule.categories]
        : []
    );
    setFormLiveProgramNames(Array.isArray(rule.liveProgramNames) ? [...rule.liveProgramNames] : []);
    setFormLiveProgramInput('');
    setFormIntroClip(rule.introClip ? { ...rule.introClip } : null);
    setFormOutroClip(rule.outroClip ? { ...rule.outroClip } : null);
    setActivePickerSlot('intro');
    setPickerSourceTab('jingles');
    setPickerSearch('');
    setIsFormOpen(true);
  };

  const toggleFormCategory = catName => {
    setFormCategories(prev => {
      const exists = prev.some(c => c.toLocaleLowerCase('tr-TR') === catName.toLocaleLowerCase('tr-TR'));
      if (exists) {
        return prev.filter(c => c.toLocaleLowerCase('tr-TR') !== catName.toLocaleLowerCase('tr-TR'));
      }
      return [...prev, catName];
    });
  };

  const toggleFormLiveProgram = progName => {
    const clean = extractBaseProgramTitle(progName);
    if (!clean) return;
    setFormLiveProgramNames(prev => {
      const exists = prev.some(p => p.toLocaleLowerCase('tr-TR') === clean.toLocaleLowerCase('tr-TR'));
      if (exists) {
        return prev.filter(p => p.toLocaleLowerCase('tr-TR') !== clean.toLocaleLowerCase('tr-TR'));
      }
      return [...prev, clean];
    });
  };

  const handleAddCustomLiveProgramToForm = () => {
    const clean = extractBaseProgramTitle(formLiveProgramInput);
    if (!clean) return;
    setFormLiveProgramNames(prev => {
      if (prev.some(p => p.toLocaleLowerCase('tr-TR') === clean.toLocaleLowerCase('tr-TR'))) {
        return prev;
      }
      return [...prev, clean];
    });
    setFormLiveProgramInput('');
  };

  const handleSelectClipForSlot = clip => {
    const formattedClip = {
      clipId: String(clip.clipId || clip.id),
      name: clip.name || clip.clipName || 'Reklam Jeneriği',
      code: clip.code || `${clip.clipId || clip.id}.mxf`,
      durationSec: Math.max(1, Math.round(Number(clip.durationSec || clip.duration || 9))),
      durationMs: Number(clip.durationMs) || Math.round(Number(clip.durationSec || clip.duration || 9) * 1000)
    };

    if (activePickerSlot === 'intro') {
      setFormIntroClip(formattedClip);

      // Eğer seçilen Giriş klibinin adı "..._giris..." içeriyorsa ve Çıkış henüz seçilmediyse eşleşen "..._cikis..." klibini otomatik öner
      if (!formOutroClip && /giris/i.test(formattedClip.name)) {
        const expectedOutroName = formattedClip.name.replace(/giris/gi, 'cikis');
        const matchedOutro = fullMediaLibraryClips.find(
          c => String(c.name || '').toLowerCase() === expectedOutroName.toLowerCase()
        );
        if (matchedOutro) {
          setFormOutroClip({
            clipId: String(matchedOutro.clipId || matchedOutro.id),
            name: matchedOutro.name,
            code: matchedOutro.code,
            durationSec: Math.max(1, Math.round(Number(matchedOutro.durationSec || matchedOutro.duration || 9))),
            durationMs: Number(matchedOutro.durationMs) || 9040
          });
        }
      }
      // Giriş seçildikten sonra kullanıcı kolaylığı için Çıkış seçimine geç
      if (!formOutroClip) {
        setActivePickerSlot('outro');
      }
    } else {
      setFormOutroClip(formattedClip);
    }
  };

  const handleSaveRuleSubmit = e => {
    e.preventDefault();
    if (!formIsChannelDefault && formCategories.length === 0 && formLiveProgramNames.length === 0) {
      dialog.warning(
        'Kategori veya Canlı Yayın Programı Seçilmedi',
        'Lütfen en az 1 program kategorisi seçin VEYA canlı yayın program ismi ekleyin.'
      );
      return;
    }
    if (!formIntroClip && !formOutroClip) {
      dialog.warning(
        'Reklam Giriş veya Çıkış Klibi Seçilmedi',
        'Lütfen Medya Kütüphanesinden en az bir Reklam Giriş veya Reklam Çıkış klibi seçin.'
      );
      return;
    }

    const matchedCategoryIds = formCategories
      .map(cName => {
        const found = allAvailableCategories.find(
          ac => ac.name.toLocaleLowerCase('tr-TR') === cName.toLocaleLowerCase('tr-TR')
        );
        return found?.id ? Number(found.id) : null;
      })
      .filter(Boolean);

    const ruleTitleFallback = formIsChannelDefault
      ? 'Canlı Yayın & Kategorisiz Programlar Varsayılan (Default) Giriş & Çıkışı'
      : [
          ...(formCategories.length > 0 ? [formCategories.join(', ')] : []),
          ...(formLiveProgramNames.length > 0 ? [`Canlı: ${formLiveProgramNames.join(', ')}`] : [])
        ].join(' • ') + ' Reklam Giriş & Çıkışı';

    saveAdBreakBumperRule({
      id: editingRule?.id || null,
      channelId: formChannelMode === 'both' ? 'ch_hd' : formChannelMode,
      applyToBothChannels: formChannelMode === 'both',
      ruleName: formRuleName.trim() || ruleTitleFallback,
      categories: formIsChannelDefault ? ['Canlı Yayın (Varsayılan)'] : formCategories,
      categoryIds: matchedCategoryIds,
      liveProgramNames: formIsChannelDefault ? [] : formLiveProgramNames,
      isChannelDefault: formIsChannelDefault,
      introClip: formIntroClip,
      outroClip: formOutroClip,
      isActive: editingRule ? editingRule.isActive !== false : true
    });

    setIsFormOpen(false);
    setEditingRule(null);
  };

  const handleCopyChannelRules = async (fromCh, toCh) => {
    const fromName = channels.find(c => String(c.id) === fromCh)?.name || fromCh;
    const toName = channels.find(c => String(c.id) === toCh)?.name || toCh;
    const ok = await dialog.confirm(
      'Kanal Kurallarını Kopyala',
      `${fromName} kanalındaki tüm Reklam Giriş & Çıkış kuralları ${toName} kanalına kopyalansın mı?`,
      { confirmText: 'Evet, Kopyala', cancelText: 'Vazgeç' }
    );
    if (ok) {
      copyAdBreakBumperRulesBetweenChannels(fromCh, toCh);
    }
  };

  const handleResetDefaults = async () => {
    const ok = await dialog.confirm(
      'Varsayılan Eşleştirmeleri Yükle',
      'Tüm kanallar için standart kategori eşleştirmeleri (Dini -> reklam_dini_giris/cikis, Kadın -> reklam_bayan_giris/cikis, Çocuk -> reklam_cocuk_giris/cikis, Kültürel/Haber/Detay -> reklam_kulturel_giris/cikis) yeniden yüklensin mi?',
      { confirmText: 'Varsayılanları Yükle', cancelText: 'Vazgeç' }
    );
    if (ok) {
      resetAdBreakBumperRulesToDefault();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. ÜST KONTROL VE KANAL FİLTRE BARI */}
      <div
        className="ta-card"
        style={{
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          border: '1px solid var(--ads-border-strong)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #465fff 0%, #0d9488 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(70, 95, 255, 0.28)',
                flexShrink: 0
              }}
            >
              <Film size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                  Reklam Giriş &amp; Çıkış Jenerikleri (Kategori &amp; Kanal Eşleştirme)
                </h2>
                <span className="ta-badge ta-badge-brand" style={{ fontSize: '11px' }}>
                  {adBreakBumperRules.length} Kayıtlı Kural
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: 'var(--ads-text-muted)' }}>
                Program kategorilerine göre reklam kuşağı başında girecek <strong>Reklam Giriş</strong> (Örn:{' '}
                <code>reklam_dini_giris_2014</code>) ve kuşak sonunda çıkacak <strong>Reklam Çıkış</strong> (Örn:{' '}
                <code>reklam_dini_cikis_2014</code>) jeneriklerini kanal bazlı yönetin. Birden fazla kategori için aynı jeneriği seçebilirsiniz.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleCopyChannelRules('ch_hd', 'ch_way')}
              className="ads-saas-btn ads-saas-btn-sm"
              title="Semerkand HD kurallarını Semerkand WAY kanalına kopyala"
            >
              <Copy size={13} /> HD &rarr; WAY Kopyala
            </button>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="ads-saas-btn ads-saas-btn-sm"
              title="Standart Dini, Kadın, Çocuk, Kültürel giriş/çıkış kurallarını yükle"
            >
              <RotateCcw size={13} /> Varsayılanları Yükle
            </button>

            <button
              type="button"
              onClick={() => openNewRuleModal()}
              className="ads-saas-btn ads-saas-btn-primary"
            >
              <Plus size={15} /> Yeni Giriş / Çıkış Kuralı Ekle
            </button>
          </div>
        </div>

        {/* Kanal Seçim Sekmeleri + Arama */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--ads-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedChannelFilter('all')}
              className={`ads-saas-btn ${selectedChannelFilter === 'all' ? 'ads-saas-btn-primary' : ''}`}
              style={{ padding: '7px 14px', fontSize: '12px', fontWeight: '800' }}
            >
              <Layers size={14} /> Tüm Kanallar ({adBreakBumperRules.length})
            </button>

            {channels.map(ch => {
              const isSelected = String(selectedChannelFilter) === String(ch.id);
              const isWay = String(ch.id) === 'ch_way';
              const chCount = adBreakBumperRules.filter(r => String(r.channelId) === String(ch.id)).length;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChannelFilter(ch.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '9px',
                    border: isSelected ? '2px solid transparent' : '1px solid var(--ads-border-strong)',
                    background: isSelected
                      ? isWay
                        ? 'linear-gradient(135deg, #0d9488, #0f766e)'
                        : 'linear-gradient(135deg, #465fff, #3641f5)'
                      : 'var(--ads-card-subtle)',
                    color: isSelected ? '#ffffff' : 'var(--ads-text-main)',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px'
                  }}
                >
                  {isWay ? <Radio size={14} /> : <Tv size={14} />}
                  <span>{ch.name}</span>
                  <span
                    style={{
                      padding: '1px 7px',
                      borderRadius: '999px',
                      background: isSelected ? 'rgba(255,255,255,0.22)' : 'var(--ads-pill-bar-bg)',
                      fontSize: '10.5px'
                    }}
                  >
                    {chCount} Kural
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', minWidth: '240px', maxWidth: '320px', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ads-text-muted)' }} />
            <input
              type="text"
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              placeholder="Kategori, giriş/çıkış klip adı veya kod ara..."
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '30px' }}
            />
          </div>
        </div>
      </div>

      {/* 2. KANAL & KATEGORİ KAPSAMA ÖZETİ (Hangi kategori hangi giriş/çıkışa bağlı?) */}
      <div className="ta-card" style={{ padding: '16px 20px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Kategori Bazlı Eşleşme Durumu ({selectedChannelFilter === 'all' ? 'Semerkand HD & WAY' : channels.find(c => String(c.id) === selectedChannelFilter)?.name})
          </span>
          <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
            Herhangi bir kategoriye tıklayarak o kategori için doğrudan Reklam Giriş / Çıkış tanımlayabilir veya düzenleyebilirsiniz.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(225px, 1fr))', gap: '10px' }}>
          {allAvailableCategories.map(cat => {
            const targetCh = selectedChannelFilter === 'all' ? 'ch_hd' : selectedChannelFilter;
            const matchedRule = adBreakBumperRules.find(
              r =>
                !r.isChannelDefault &&
                String(r.channelId) === String(targetCh) &&
                (r.categories || []).some(c => c.toLocaleLowerCase('tr-TR') === cat.name.toLocaleLowerCase('tr-TR'))
            );

            return (
              <div
                key={cat.name}
                onClick={() => {
                  if (matchedRule) {
                    openEditRuleModal(matchedRule);
                  } else {
                    openNewRuleModal(targetCh, cat.name);
                  }
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '11px',
                  border: matchedRule ? `1.5px solid ${cat.color}` : '1.5px dashed var(--ads-border-strong)',
                  background: matchedRule ? `${cat.color}10` : 'var(--ads-card-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
                title={matchedRule ? 'Kuralı düzenlemek için tıklayın' : `${cat.name} kategorisine Reklam Giriş/Çıkış atamak için tıklayın`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: cat.color,
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                  >
                    {cat.name}
                  </span>
                  {matchedRule ? (
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={12} /> Tanımlı
                    </span>
                  ) : (
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#d97706' }}>
                      + Tanımla
                    </span>
                  )}
                </div>

                {matchedRule ? (
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-sub)', display: 'flex', flexDirection: 'column', gap: '2px', fontFamily: 'monospace' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ color: '#059669' }}>Giriş:</strong> {matchedRule.introClip?.name || '-'}
                    </div>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ color: '#d97706' }}>Çıkış:</strong> {matchedRule.outroClip?.name || '-'}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                    Henüz giriş/çıkış klibi atanmadı
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2B. CANLI YAYINLAR & KANAL BAZLI VARSAYILAN (DEFAULT) GİRİŞ / ÇIKIŞ YÖNETİMİ */}
      <div
        className="ta-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          border: '1.5px solid rgba(225, 29, 72, 0.35)',
          background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.04) 0%, rgba(37, 99, 235, 0.03) 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '900',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              CANLI YAYINLAR &amp; DEFAULT GİRİŞ / ÇIKIŞ
            </span>
            <span style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              Canlı Yayın Programları Otomatik Kategori &amp; Kanal Bazlı Varsayılan (Default) Ayarı
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={quickLiveProgramInput}
              onChange={e => setQuickLiveProgramInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && quickLiveProgramInput.trim()) {
                  e.preventDefault();
                  const clean = extractBaseProgramTitle(quickLiveProgramInput);
                  setQuickLiveProgramInput('');
                  openNewRuleModal(
                    selectedChannelFilter === 'all' ? 'ch_hd' : selectedChannelFilter,
                    null,
                    clean
                  );
                }
              }}
              placeholder="Canlı yayın program adı girin (Örn: Çerçeve, Hasbihal, Özel Yayın)..."
              className="ads-saas-input"
              style={{ minWidth: '280px', height: '33px', fontSize: '12px' }}
            />
            <button
              type="button"
              onClick={() => {
                const clean = extractBaseProgramTitle(quickLiveProgramInput);
                setQuickLiveProgramInput('');
                openNewRuleModal(
                  selectedChannelFilter === 'all' ? 'ch_hd' : selectedChannelFilter,
                  null,
                  clean || null
                );
              }}
              className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
              style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)', border: 'none' }}
            >
              <Plus size={13} /> Canlı Yayın Kuralı Ekle (Tüm Partlar)
            </button>
          </div>
        </div>

        {/* 3 Adımlı Canlı Yayın Çözümleme Açıklaması */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '8px',
            fontSize: '11.5px',
            color: 'var(--ads-text-sub)'
          }}
        >
          <div style={{ padding: '8px 11px', borderRadius: '8px', background: 'var(--ads-card-bg)', border: '1px solid var(--ads-border)' }}>
            <strong style={{ color: '#e11d48' }}>1. Listeden Canlı Etiketli Program:</strong> Yayın listesindeki canlı program buraya eklendiyse (kaç part olduğu önemli değil, her part için) doğrudan seçilen giriş/çıkış yerleşir.
          </div>
          <div style={{ padding: '8px 11px', borderRadius: '8px', background: 'var(--ads-card-bg)', border: '1px solid var(--ads-border)' }}>
            <strong style={{ color: '#2563eb' }}>2. Önceki Bölümlerden Kategori Kontrolü:</strong> Özel kural yoksa programın (örn: <em>Çerçeve</em>, <em>Hasbihal</em>) önceki bölümleri var mı kontrol edilir ve kategorisine göre otomatik yerleşir.
          </div>
          <div style={{ padding: '8px 11px', borderRadius: '8px', background: 'var(--ads-card-bg)', border: '1px solid var(--ads-border)' }}>
            <strong style={{ color: '#0d9488' }}>3. Kanal Varsayılanı (Default = reklam_kulturel):</strong> Kurala eklenmemiş ve önceki bölümü de yoksa kanalın aşağıdaki <strong>Default</strong> giriş ve çıkışı yerleşir (HD ve WAY için ayrı ayrı değiştirilebilir).
          </div>
        </div>

        {/* KANAL BAZLI VARSAYILAN (DEFAULT) GİRİŞ & ÇIKIŞ KARTLARI (SEMERKAND HD & SEMERKAND WAY) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '10px' }}>
          {channels.map(ch => {
            const isWay = String(ch.id) === 'ch_way';
            const defRule = adBreakBumperRules.find(
              r => String(r.channelId) === String(ch.id) && Boolean(r.isChannelDefault)
            );
            const introName = defRule?.introClip?.name || 'reklam_kulturel_giris_2014';
            const outroName = defRule?.outroClip?.name || 'reklam_kulturel_cikis_2014';
            const introSec = Number(defRule?.introClip?.durationSec) || 9;
            const outroSec = Number(defRule?.outroClip?.durationSec) || 9;

            return (
              <div
                key={`default-card-${ch.id}`}
                style={{
                  padding: '11px 14px',
                  borderRadius: '11px',
                  background: 'var(--ads-card-bg)',
                  border: isWay ? '1.5px solid rgba(13, 148, 136, 0.45)' : '1.5px solid rgba(70, 95, 255, 0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: isWay ? 'rgba(13, 148, 136, 0.14)' : 'rgba(70, 95, 255, 0.14)',
                        color: isWay ? '#0d9488' : '#465fff'
                      }}
                    >
                      {ch.name} • Varsayılan (Default) Ayar
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>
                      (Kategorisiz &amp; Önceki Bölümü Olmayan Canlı Yayınlar İçin)
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', fontFamily: 'monospace', color: 'var(--ads-text-main)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span>
                      <strong style={{ color: '#059669' }}>Giriş:</strong> {introName} ({introSec}sn)
                    </span>
                    <span>
                      <strong style={{ color: '#d97706' }}>Çıkış:</strong> {outroName} ({outroSec}sn)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (defRule) {
                      openEditRuleModal(defRule);
                    } else {
                      openNewRuleModal(ch.id, null, null, true);
                    }
                  }}
                  className="ads-saas-btn ads-saas-btn-sm"
                  style={{
                    border: isWay ? '1px solid #0d9488' : '1px solid #465fff',
                    color: isWay ? '#0d9488' : '#465fff',
                    fontWeight: '800'
                  }}
                >
                  <Edit2 size={12} /> Default Değiştir
                </button>
              </div>
            );
          })}
        </div>

        {/* YAYIN LİSTESİNDEN OTOMATİK ÇEKİLEN CANLI YAYINLAR LİSTESİ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
              Yayın &amp; Taslak Listelerinden Otomatik Çekilen Canlı Yayınlar ({detectedLiveProgramsFromSchedules.length})
            </span>
            <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
              Program kaç part olursa olsun (Part 1, Part 2, Part 3...) seçilen giriş ve çıkış tüm partlar için otomatik uygulanır.
            </span>
          </div>

          {detectedLiveProgramsFromSchedules.length === 0 ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--ads-card-bg)',
                border: '1px dashed var(--ads-border-strong)',
                fontSize: '12px',
                color: 'var(--ads-text-muted)'
              }}
            >
              Şu an aktif yayın listelerinde &quot;Canlı&quot; olarak etiketlenmiş program bulunamadı. Yayın listesine canlı yayın eklendiğinde otomatik olarak burada listelenir; veya yukarıdaki kutudan program adını (örn: <strong>Çerçeve</strong>, <strong>Hasbihal</strong>) yazarak kural ekleyebilirsiniz.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '8px' }}>
              {detectedLiveProgramsFromSchedules.map(liveItem => {
                const isCustomLiveRule = liveItem.resolutionMethod === 'live_rule';
                const isFromPrevEpisodes = liveItem.resolutionMethod === 'previous_episodes';

                return (
                  <div
                    key={liveItem.baseTitle}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--ads-card-bg)',
                      border: isCustomLiveRule
                        ? '1.5px solid #e11d48'
                        : isFromPrevEpisodes
                        ? '1.5px solid #2563eb'
                        : '1px solid var(--ads-border-strong)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: '5px',
                            background: '#e11d48',
                            color: '#ffffff',
                            fontSize: '10px',
                            fontWeight: '900'
                          }}
                        >
                          CANLI
                        </span>
                        <span style={{ fontSize: '12.5px', fontWeight: '900', color: 'var(--ads-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {liveItem.baseTitle}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--ads-text-muted)', fontWeight: '700' }}>
                          (Tüm Partlar)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isCustomLiveRule && liveItem.matchedRule) {
                            openEditRuleModal(liveItem.matchedRule);
                          } else {
                            openNewRuleModal(
                              selectedChannelFilter === 'all' ? liveItem.channelId : selectedChannelFilter,
                              null,
                              liveItem.baseTitle
                            );
                          }
                        }}
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '10.5px',
                          fontWeight: '800',
                          color: isCustomLiveRule ? '#e11d48' : '#2563eb'
                        }}
                      >
                        {isCustomLiveRule ? 'Kuralı Düzenle' : '+ Özel Giriş/Çıkış Seç'}
                      </button>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--ads-text-sub)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>
                        {isCustomLiveRule ? (
                          <span style={{ color: '#e11d48', fontWeight: '800' }}>
                            1. Yöntem: Canlı Yayın Özel Kuralı Tanımlı
                          </span>
                        ) : isFromPrevEpisodes ? (
                          <span style={{ color: '#2563eb', fontWeight: '800' }}>
                            Önceki Bölümlerden Kategori Tespit Edildi: {liveItem.previousEpisodeCategory}
                          </span>
                        ) : (
                          <span style={{ color: '#0d9488', fontWeight: '800' }}>
                            2. Yöntem: Önceki Bölümü Yok &rarr; Kanal Default ({liveItem.resolvedIntroName})
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '10.5px', color: 'var(--ads-text-muted)' }}>
                        {liveItem.resolvedIntroName} • {liveItem.resolvedOutroName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. KAYITLI REKLAM GİRİŞ & ÇIKIŞ KURALLARI TABLOSU */}
      <div className="ta-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ta-table">
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Yayın Kanalı</th>
                <th style={{ width: '240px' }}>Bağlı Program Kategorileri</th>
                <th>Reklam Giriş Jeneriği (Kuşak Başı)</th>
                <th>Reklam Çıkış Jeneriği (Kuşak Sonu)</th>
                <th style={{ width: '110px' }}>Toplam Süre</th>
                <th style={{ width: '100px' }}>Durum</th>
                <th style={{ width: '140px', textAlign: 'right' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '42px 20px', textAlign: 'center', color: 'var(--ads-text-muted)' }}>
                    Bu filtreye uygun Reklam Giriş / Çıkış kuralı bulunamadı. Üstteki <strong>&quot;+ Yeni Giriş / Çıkış Kuralı Ekle&quot;</strong> butonuna tıklayarak ekleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                filteredRules.map(rule => {
                  const isWay = String(rule.channelId) === 'ch_way';
                  const chName = channels.find(c => String(c.id) === String(rule.channelId))?.name || rule.channelId;
                  const introSec = Number(rule.introClip?.durationSec) || 0;
                  const outroSec = Number(rule.outroClip?.durationSec) || 0;

                  return (
                    <tr key={rule.id} style={{ opacity: rule.isActive === false ? 0.6 : 1 }}>
                      {/* Kanal */}
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: '800',
                            background: isWay ? 'rgba(13, 148, 136, 0.14)' : 'rgba(70, 95, 255, 0.14)',
                            color: isWay ? '#0d9488' : '#465fff'
                          }}
                        >
                          {isWay ? <Radio size={13} /> : <Tv size={13} />}
                          {chName}
                        </span>
                      </td>

                      {/* Bağlı Kategoriler & Canlı Yayın Programları */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          {rule.isChannelDefault && (
                            <span
                              style={{
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: '900'
                              }}
                            >
                              KANAL VARSAYILANI (DEFAULT)
                            </span>
                          )}
                          {!rule.isChannelDefault &&
                            (rule.categories || []).map(catName => {
                              const catMeta = getCategoryDetails(null, catName);
                              return (
                                <span
                                  key={catName}
                                  style={{
                                    padding: '3px 9px',
                                    borderRadius: '6px',
                                    background: catMeta.bg,
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: '800'
                                  }}
                                >
                                  {catName}
                                </span>
                              );
                            })}
                          {(rule.liveProgramNames || []).map(lpName => (
                            <span
                              key={`live-${lpName}`}
                              style={{
                                padding: '3px 9px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: '800'
                              }}
                              title="Bu canlı yayın kaç part olursa olsun tüm partları için geçerlidir"
                            >
                              Canlı: {lpName} (Tüm Partlar)
                            </span>
                          ))}
                        </div>
                        {rule.ruleName && (
                          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '4px', fontWeight: '600' }}>
                            {rule.ruleName}
                          </div>
                        )}
                      </td>

                      {/* Reklam Giriş Klibi */}
                      <td>
                        {rule.introClip ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              padding: '7px 10px',
                              borderRadius: '9px',
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <LogIn size={13} color="#059669" />
                                <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)', fontFamily: 'monospace' }}>
                                  {rule.introClip.name}
                                </span>
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                                #{rule.introClip.clipId} • {rule.introClip.code} • <strong style={{ color: '#059669' }}>{introSec} sn</strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setPreviewMaterial({
                                  id: rule.introClip.clipId,
                                  clipId: rule.introClip.clipId,
                                  name: rule.introClip.name,
                                  clipName: rule.introClip.name,
                                  code: rule.introClip.code,
                                  duration: introSec,
                                  durationMs: rule.introClip.durationMs || introSec * 1000,
                                  companyName: `${chName} • Reklam Giriş Jeneriği`,
                                  productName: `Kategoriler: ${(rule.categories || []).join(', ')}`
                                })
                              }
                              className="ads-saas-btn ads-saas-btn-sm"
                              style={{
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                borderRadius: '7px',
                                background: 'rgba(37, 99, 235, 0.12)',
                                border: '1px solid rgba(37, 99, 235, 0.35)',
                                color: '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              title="Reklam Giriş Jeneriğini İzle ve Kare (FPS) Bilgilerini Gör (ⓘ)"
                            >
                              <Info size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>Giriş Seçilmedi</span>
                        )}
                      </td>

                      {/* Reklam Çıkış Klibi */}
                      <td>
                        {rule.outroClip ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              padding: '7px 10px',
                              borderRadius: '9px',
                              background: 'rgba(217, 119, 6, 0.08)',
                              border: '1px solid rgba(217, 119, 6, 0.3)'
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <LogOut size={13} color="#d97706" />
                                <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)', fontFamily: 'monospace' }}>
                                  {rule.outroClip.name}
                                </span>
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                                #{rule.outroClip.clipId} • {rule.outroClip.code} • <strong style={{ color: '#d97706' }}>{outroSec} sn</strong>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setPreviewMaterial({
                                  id: rule.outroClip.clipId,
                                  clipId: rule.outroClip.clipId,
                                  name: rule.outroClip.name,
                                  clipName: rule.outroClip.name,
                                  code: rule.outroClip.code,
                                  duration: outroSec,
                                  durationMs: rule.outroClip.durationMs || outroSec * 1000,
                                  companyName: `${chName} • Reklam Çıkış Jeneriği`,
                                  productName: `Kategoriler: ${(rule.categories || []).join(', ')}`
                                })
                              }
                              className="ads-saas-btn ads-saas-btn-sm"
                              style={{
                                width: '28px',
                                height: '28px',
                                padding: 0,
                                borderRadius: '7px',
                                background: 'rgba(37, 99, 235, 0.12)',
                                border: '1px solid rgba(37, 99, 235, 0.35)',
                                color: '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              title="Reklam Çıkış Jeneriğini İzle ve Kare (FPS) Bilgilerini Gör (ⓘ)"
                            >
                              <Info size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>Çıkış Seçilmedi</span>
                        )}
                      </td>

                      {/* Toplam Süre */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: '800',
                            padding: '4px 9px',
                            borderRadius: '7px',
                            background: 'var(--ads-card-subtle)',
                            border: '1px solid var(--ads-border)',
                            color: 'var(--ads-text-main)'
                          }}
                        >
                          {introSec + outroSec} sn ({introSec}+{outroSec})
                        </span>
                      </td>

                      {/* Durum */}
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleAdBreakBumperRuleActive(rule.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            border: 'none',
                            background: rule.isActive !== false ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.18)',
                            color: rule.isActive !== false ? '#059669' : 'var(--ads-text-muted)',
                            fontSize: '11px',
                            fontWeight: '800',
                            cursor: 'pointer'
                          }}
                        >
                          {rule.isActive !== false ? '● Aktif' : '○ Pasif'}
                        </button>
                      </td>

                      {/* İşlemler */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => openEditRuleModal(rule)}
                            className="ads-saas-btn ads-saas-btn-sm"
                            title="Düzenle"
                          >
                            <Edit2 size={12} /> Düzenle
                          </button>
                          {!rule.isChannelDefault && (
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await dialog.confirm(
                                  'Kuralı Sil',
                                  `"${rule.ruleName}" kuralını silmek istediğinize emin misiniz?`,
                                  { confirmText: 'Sil', cancelText: 'Vazgeç' }
                                );
                                if (ok) deleteAdBreakBumperRule(rule.id);
                              }}
                              className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                              style={{ padding: '5px 7px' }}
                              title="Kuralı Sil"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. KURAL EKLEME / DÜZENLEME MODALI (KANAL + ÇOKLU KATEGORİ + MEDYA KÜTÜPHANESİ ARAMA/SEÇİM) */}
      {isFormOpen && (
        <div
          onClick={() => setIsFormOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(6px)',
            zIndex: 10050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '1020px',
              maxHeight: '92vh',
              background: 'var(--ads-card-bg, #ffffff)',
              border: '1px solid var(--ads-border-strong)',
              borderRadius: '18px',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Başlık */}
            <div
              style={{
                padding: '16px 22px',
                background: 'var(--ads-card-subtle)',
                borderBottom: '1px solid var(--ads-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #465fff, #0d9488)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Sparkles size={19} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                    {editingRule ? 'Reklam Giriş & Çıkış Kuralını Düzenle' : 'Yeni Reklam Giriş & Çıkış Kuralı Tanımla'}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--ads-text-muted)' }}>
                    1. Kanal Seçin &rarr; 2. Kategorileri Seçin (Birden Fazla Seçilebilir) &rarr; 3. Medya Kütüphanesinden Giriş ve Çıkış Kliplerini Seçin
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="ads-saas-btn ads-saas-btn-sm"
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Gövde */}
            <form
              onSubmit={handleSaveRuleSubmit}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* ADIM 1: KANAL SEÇİMİ VE KURAL BAŞLIĞI */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '14px',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'var(--ads-card-subtle)',
                  border: '1px solid var(--ads-border)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                    1. Yayın Kanalı Seçimi *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: '6px' }}>
                    {channels.map(ch => {
                      const isSel = formChannelMode === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setFormChannelMode(ch.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: isSel ? '2px solid #465fff' : '1px solid var(--ads-border-strong)',
                            background: isSel ? 'rgba(70, 95, 255, 0.14)' : 'var(--ads-card-bg)',
                            color: isSel ? '#465fff' : 'var(--ads-text-main)',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer'
                          }}
                        >
                          {ch.name}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setFormChannelMode('both')}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: formChannelMode === 'both' ? '2px solid #0d9488' : '1px solid var(--ads-border-strong)',
                        background: formChannelMode === 'both' ? 'rgba(13, 148, 136, 0.14)' : 'var(--ads-card-bg)',
                        color: formChannelMode === 'both' ? '#0d9488' : 'var(--ads-text-main)',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      Her İki Kanal (HD+WAY)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                    Kural Açıklaması / Başlığı (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    value={formRuleName}
                    onChange={e => setFormRuleName(e.target.value)}
                    placeholder="Örn: Dini Programlar Reklam Giriş & Çıkışı"
                    className="ads-saas-input"
                    style={{ width: '100%', height: '36px' }}
                  />
                </div>
              </div>

              {/* ADIM 2: KATEGORİ SEÇİMİ VEYA CANLI YAYIN PROGRAM İSMİ SEÇİMİ */}
              {formIsChannelDefault ? (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'rgba(13, 148, 136, 0.1)',
                    border: '1.5px solid rgba(13, 148, 136, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#0d9488' }}>
                      Kanal Varsayılan (Default) Giriş &amp; Çıkış Ayarı Düzenleniyor
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', marginTop: '3px' }}>
                      Reklam Giriş &amp; Çıkış alanına özel olarak eklenmemiş ve arşivde daha önce bölümü / kategori bilgisi bulunmayan canlı yayınlar için seçili kanalda aşağıdaki Giriş ve Çıkış klipleri otomatik olarak yerleşir.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 2A: KATEGORİ SEÇİMİ */}
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'var(--ads-card-subtle)',
                      border: '1px solid var(--ads-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                          2A. Program Kategorisi Seçimi (Birden Fazla Kategori Seçebilirsiniz)
                        </span>
                        <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                          Seçtiğiniz tüm kategorilerdeki programlardan sonra gelen reklam kuşağında aşağıdaki Giriş ve Çıkış jenerikleri kullanılacaktır.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setFormCategories(allAvailableCategories.map(c => c.name))}
                          className="ads-saas-btn ads-saas-btn-sm"
                          style={{ fontSize: '11px' }}
                        >
                          Tüm Kategorileri Seç
                        </button>
                        {formCategories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFormCategories([])}
                            className="ads-saas-btn ads-saas-btn-sm"
                            style={{ fontSize: '11px', color: '#ef4444' }}
                          >
                            Seçimi Temizle
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {allAvailableCategories.map(cat => {
                        const isChecked = formCategories.some(
                          c => c.toLocaleLowerCase('tr-TR') === cat.name.toLocaleLowerCase('tr-TR')
                        );
                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => toggleFormCategory(cat.name)}
                            style={{
                              padding: '7px 13px',
                              borderRadius: '9px',
                              border: isChecked ? `2px solid ${cat.color}` : '1px solid var(--ads-border-strong)',
                              background: isChecked ? cat.color : 'var(--ads-card-bg)',
                              color: isChecked ? '#ffffff' : 'var(--ads-text-main)',
                              fontSize: '12px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: isChecked ? `0 4px 12px ${cat.color}44` : 'none',
                              transition: 'all 0.12s ease'
                            }}
                          >
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '4px',
                                border: isChecked ? '1.5px solid #fff' : `1.5px solid ${cat.color}`,
                                background: isChecked ? 'rgba(255,255,255,0.22)' : 'transparent',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {isChecked && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span>{cat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2B: CANLI YAYIN / ÖZEL PROGRAM İSMİ SEÇİMİ (LİSTEDEN OTOMATİK ÇEKİLENLER + MANUEL İSİM GİRİŞİ) */}
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'rgba(225, 29, 72, 0.04)',
                      border: '1.5px solid rgba(225, 29, 72, 0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontSize: '12.5px', fontWeight: '900', color: '#e11d48' }}>
                          2B. Canlı Yayın / Özel Program İsmi Seçimi (Kaç Part Olduğu Önemli Değil - Tüm Partlar İçin Geçerli)
                        </span>
                        <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                          Yayın listesindeki canlı etiketli programlardan seçebilir veya program adını yazarak ekleyebilirsiniz.
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="text"
                          value={formLiveProgramInput}
                          onChange={e => setFormLiveProgramInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && formLiveProgramInput.trim()) {
                              e.preventDefault();
                              handleAddCustomLiveProgramToForm();
                            }
                          }}
                          placeholder="Program adı yazın (Örn: Çerçeve, Hasbihal)..."
                          className="ads-saas-input"
                          style={{ minWidth: '240px', height: '32px', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomLiveProgramToForm}
                          className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                          style={{ background: '#e11d48', border: 'none' }}
                        >
                          <Plus size={12} /> Program Ekle
                        </button>
                      </div>
                    </div>

                    {/* Seçili Canlı Yayın Programları */}
                    {formLiveProgramNames.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {formLiveProgramNames.map(lpName => (
                          <span
                            key={`sel-live-${lpName}`}
                            style={{
                              padding: '5px 11px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #e11d48, #be123c)',
                              color: '#ffffff',
                              fontSize: '11.5px',
                              fontWeight: '800',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <span>{lpName} (Tüm Partlar)</span>
                            <button
                              type="button"
                              onClick={() => toggleFormLiveProgram(lpName)}
                              style={{
                                border: 'none',
                                background: 'rgba(255,255,255,0.22)',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                padding: '1px 4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Kaldır"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Yayın Listesinden Otomatik Çekilen Canlı Yayınlar Hızlı Seçim Hapları */}
                    {detectedLiveProgramsFromSchedules.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--ads-text-sub)' }}>
                          Yayın &amp; Taslak Listelerinden Otomatik Çekilen Canlı Yayınlar (Seçmek İçin Tıklayın):
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {detectedLiveProgramsFromSchedules.map(liveItem => {
                            const isPicked = formLiveProgramNames.some(
                              p => p.toLocaleLowerCase('tr-TR') === liveItem.baseTitle.toLocaleLowerCase('tr-TR')
                            );
                            return (
                              <button
                                key={`modal-live-${liveItem.baseTitle}`}
                                type="button"
                                onClick={() => toggleFormLiveProgram(liveItem.baseTitle)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '8px',
                                  border: isPicked ? '2px solid #e11d48' : '1px solid var(--ads-border-strong)',
                                  background: isPicked ? 'rgba(225, 29, 72, 0.14)' : 'var(--ads-card-bg)',
                                  color: isPicked ? '#e11d48' : 'var(--ads-text-main)',
                                  fontSize: '11.5px',
                                  fontWeight: '800',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                {isPicked ? <Check size={12} /> : <Plus size={12} />}
                                <span>{liveItem.baseTitle}</span>
                                {liveItem.previousEpisodeCategory && (
                                  <span style={{ fontSize: '10px', opacity: 0.8 }}>
                                    ({liveItem.previousEpisodeCategory})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ADIM 3: REKLAM GİRİŞ & REKLAM ÇIKIŞ KLİBİ SEÇİMİ VE MEDYA KÜTÜPHANESİ ARAMA */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {/* SOL KART: SEÇİLİ REKLAM GİRİŞ JENERİĞİ */}
                  <div
                    onClick={() => setActivePickerSlot('intro')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border:
                        activePickerSlot === 'intro'
                          ? '2px solid #059669'
                          : '1.5px solid var(--ads-border-strong)',
                      background:
                        activePickerSlot === 'intro'
                          ? 'rgba(16, 185, 129, 0.09)'
                          : 'var(--ads-card-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LogIn size={15} />
                        3A. Reklam Giriş Seçimi (Kuşak Başı)
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '10px',
                          fontWeight: '800',
                          background: activePickerSlot === 'intro' ? '#059669' : 'var(--ads-pill-bar-bg)',
                          color: activePickerSlot === 'intro' ? '#fff' : 'var(--ads-text-muted)'
                        }}
                      >
                        {activePickerSlot === 'intro' ? '● Aşağıdan Seçiliyor' : 'Seçmek İçin Tıklayın'}
                      </span>
                    </div>

                    {formIntroClip ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--ads-text-main)', fontFamily: 'monospace' }}>
                            {formIntroClip.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                            #{formIntroClip.clipId} • {formIntroClip.code} • <strong>{formIntroClip.durationSec} sn</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewMaterial({
                                id: formIntroClip.clipId,
                                clipId: formIntroClip.clipId,
                                name: formIntroClip.name,
                                clipName: formIntroClip.name,
                                code: formIntroClip.code,
                                duration: formIntroClip.durationSec,
                                durationMs: formIntroClip.durationMs
                              })
                            }
                            className="ads-saas-btn ads-saas-btn-sm"
                            style={{ padding: '4px 7px', color: '#2563eb' }}
                            title="Önizle (ⓘ)"
                          >
                            <Info size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormIntroClip(null)}
                            className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                            style={{ padding: '4px 7px' }}
                            title="Kaldır"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', fontStyle: 'italic' }}>
                        Henüz Reklam Giriş klibi seçilmedi (Aşağıdaki listeden seçin, örn: reklam_dini_giris_2014)
                      </div>
                    )}
                  </div>

                  {/* SAĞ KART: SEÇİLİ REKLAM ÇIKIŞ JENERİĞİ */}
                  <div
                    onClick={() => setActivePickerSlot('outro')}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      border:
                        activePickerSlot === 'outro'
                          ? '2px solid #d97706'
                          : '1.5px solid var(--ads-border-strong)',
                      background:
                        activePickerSlot === 'outro'
                          ? 'rgba(217, 119, 6, 0.09)'
                          : 'var(--ads-card-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <LogOut size={15} />
                        3B. Reklam Çıkış Seçimi (Kuşak Sonu)
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '10px',
                          fontWeight: '800',
                          background: activePickerSlot === 'outro' ? '#d97706' : 'var(--ads-pill-bar-bg)',
                          color: activePickerSlot === 'outro' ? '#fff' : 'var(--ads-text-muted)'
                        }}
                      >
                        {activePickerSlot === 'outro' ? '● Aşağıdan Seçiliyor' : 'Seçmek İçin Tıklayın'}
                      </span>
                    </div>

                    {formOutroClip ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--ads-text-main)', fontFamily: 'monospace' }}>
                            {formOutroClip.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                            #{formOutroClip.clipId} • {formOutroClip.code} • <strong>{formOutroClip.durationSec} sn</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewMaterial({
                                id: formOutroClip.clipId,
                                clipId: formOutroClip.clipId,
                                name: formOutroClip.name,
                                clipName: formOutroClip.name,
                                code: formOutroClip.code,
                                duration: formOutroClip.durationSec,
                                durationMs: formOutroClip.durationMs
                              })
                            }
                            className="ads-saas-btn ads-saas-btn-sm"
                            style={{ padding: '4px 7px', color: '#2563eb' }}
                            title="Önizle (ⓘ)"
                          >
                            <Info size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormOutroClip(null)}
                            className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
                            style={{ padding: '4px 7px' }}
                            title="Kaldır"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', fontStyle: 'italic' }}>
                        Henüz Reklam Çıkış klibi seçilmedi (Aşağıdaki listeden seçin, örn: reklam_dini_cikis_2014)
                      </div>
                    )}
                  </div>
                </div>

                {/* MEDYA KÜTÜPHANESİ & ARŞİV ARAMA VE KLİP SEÇİCİ */}
                <div
                  style={{
                    borderRadius: '12px',
                    border: '1px solid var(--ads-border-strong)',
                    background: 'var(--ads-card-bg)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--ads-card-subtle)',
                      borderBottom: '1px solid var(--ads-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div className="ads-saas-pill-group">
                      <button
                        type="button"
                        onClick={() => setPickerSourceTab('jingles')}
                        className={`ads-saas-pill-btn ${pickerSourceTab === 'jingles' ? 'active' : ''}`}
                        style={{ fontSize: '11.5px' }}
                      >
                        Giriş / Çıkış Jenerikleri ({bumperJingleClips.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerSourceTab('library')}
                        className={`ads-saas-pill-btn ${pickerSourceTab === 'library' ? 'active' : ''}`}
                        style={{ fontSize: '11.5px' }}
                      >
                        Tüm Medya Kütüphanesi ({fullMediaLibraryClips.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPickerSourceTab('archive')}
                        className={`ads-saas-pill-btn ${pickerSourceTab === 'archive' ? 'active' : ''}`}
                        style={{ fontSize: '11.5px' }}
                      >
                        MAM Arşivde Ara
                      </button>
                    </div>

                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ads-text-muted)' }} />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={e => setPickerSearch(e.target.value)}
                        placeholder={
                          activePickerSlot === 'intro'
                            ? 'Reklam Giriş klibi ara (Örn: reklam_dini_giris, bayan, cocuk, kulturel)...'
                            : 'Reklam Çıkış klibi ara (Örn: reklam_dini_cikis, bayan, cocuk, kulturel)...'
                        }
                        className="ads-saas-input"
                        style={{ width: '100%', paddingLeft: '30px' }}
                      />
                      {isSearchingArchive && (
                        <RefreshCw size={13} className="spin" style={{ position: 'absolute', right: '10px', top: '9px' }} />
                      )}
                    </div>
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {displayedPickerClips.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--ads-text-muted)' }}>
                        {isSearchingArchive
                          ? 'MAM Arşiv veritabanında aranıyor...'
                          : 'Arama kriterine uygun klip bulunamadı. "Tüm Medya Kütüphanesi" veya "MAM Arşivde Ara" sekmesine geçebilirsiniz.'}
                      </div>
                    ) : (
                      displayedPickerClips.map(clip => {
                        const isPickedAsIntro =
                          formIntroClip &&
                          (String(formIntroClip.clipId) === String(clip.clipId) || formIntroClip.name === clip.name);
                        const isPickedAsOutro =
                          formOutroClip &&
                          (String(formOutroClip.clipId) === String(clip.clipId) || formOutroClip.name === clip.name);

                        return (
                          <div
                            key={`${clip.clipId}-${clip.code}`}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '9px',
                              border:
                                isPickedAsIntro || isPickedAsOutro
                                  ? '1.5px solid #2563eb'
                                  : '1px solid var(--ads-border)',
                              background:
                                isPickedAsIntro || isPickedAsOutro
                                  ? 'rgba(37, 99, 235, 0.08)'
                                  : 'var(--ads-card-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              flexWrap: 'wrap'
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)', fontFamily: 'monospace' }}>
                                  {clip.name}
                                </span>
                                {isPickedAsIntro && (
                                  <span style={{ padding: '1px 7px', borderRadius: '999px', background: '#059669', color: '#fff', fontSize: '10px', fontWeight: '800' }}>
                                    Giriş Olarak Seçili
                                  </span>
                                )}
                                {isPickedAsOutro && (
                                  <span style={{ padding: '1px 7px', borderRadius: '999px', background: '#d97706', color: '#fff', fontSize: '10px', fontWeight: '800' }}>
                                    Çıkış Olarak Seçili
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace', marginTop: '1px' }}>
                                #{clip.clipId} • {clip.code} • <strong>{clip.durationSec} sn</strong>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewMaterial({
                                    id: clip.clipId,
                                    clipId: clip.clipId,
                                    name: clip.name,
                                    clipName: clip.name,
                                    code: clip.code,
                                    duration: clip.durationSec,
                                    durationMs: clip.durationMs
                                  })
                                }
                                className="ads-saas-btn ads-saas-btn-sm"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  padding: 0,
                                  borderRadius: '7px',
                                  background: 'rgba(37, 99, 235, 0.12)',
                                  border: '1px solid rgba(37, 99, 235, 0.35)',
                                  color: '#2563eb',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Klibi İzle & Detaylarını Gör (ⓘ)"
                              >
                                <Info size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActivePickerSlot('intro');
                                  const formatted = {
                                    clipId: String(clip.clipId || clip.id),
                                    name: clip.name,
                                    code: clip.code,
                                    durationSec: clip.durationSec,
                                    durationMs: clip.durationMs
                                  };
                                  setFormIntroClip(formatted);
                                  if (!formOutroClip && /giris/i.test(formatted.name)) {
                                    const expectedOutro = formatted.name.replace(/giris/gi, 'cikis');
                                    const foundOutro = fullMediaLibraryClips.find(
                                      c => String(c.name || '').toLowerCase() === expectedOutro.toLowerCase()
                                    );
                                    if (foundOutro) {
                                      setFormOutroClip({
                                        clipId: String(foundOutro.clipId || foundOutro.id),
                                        name: foundOutro.name,
                                        code: foundOutro.code,
                                        durationSec: foundOutro.durationSec,
                                        durationMs: foundOutro.durationMs
                                      });
                                    }
                                  }
                                }}
                                className="ads-saas-btn ads-saas-btn-sm"
                                style={{
                                  background: isPickedAsIntro ? '#059669' : 'rgba(16, 185, 129, 0.12)',
                                  border: '1px solid rgba(16, 185, 129, 0.4)',
                                  color: isPickedAsIntro ? '#fff' : '#059669',
                                  fontWeight: '800',
                                  fontSize: '11px'
                                }}
                              >
                                <LogIn size={12} /> Giriş Seç
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActivePickerSlot('outro');
                                  setFormOutroClip({
                                    clipId: String(clip.clipId || clip.id),
                                    name: clip.name,
                                    code: clip.code,
                                    durationSec: clip.durationSec,
                                    durationMs: clip.durationMs
                                  });
                                }}
                                className="ads-saas-btn ads-saas-btn-sm"
                                style={{
                                  background: isPickedAsOutro ? '#d97706' : 'rgba(217, 119, 6, 0.12)',
                                  border: '1px solid rgba(217, 119, 6, 0.4)',
                                  color: isPickedAsOutro ? '#fff' : '#d97706',
                                  fontWeight: '800',
                                  fontSize: '11px'
                                }}
                              >
                                <LogOut size={12} /> Çıkış Seç
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Alt Butonlar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--ads-border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="ads-saas-btn"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="ads-saas-btn ads-saas-btn-primary"
                  style={{ padding: '9px 20px' }}
                >
                  <CheckCircle2 size={15} /> Kuralı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VİDEO ÖNİZLEME VE KARE (25/30/50 FPS) DETAY MODALI (ⓘ) */}
      {previewMaterial && (
        <AdMaterialDetailModal
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          companies={companies}
          products={products}
          materials={materials}
          reservations={reservations}
          adPlacements={adPlacements}
        />
      )}
    </div>
  );
};

export default React.memo(AdBreakBumpersTab);
