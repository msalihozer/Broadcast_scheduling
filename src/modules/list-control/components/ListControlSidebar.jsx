/**
 * @file src/modules/list-control/components/ListControlSidebar.jsx
 * @description Yayın Liste Kontrol Modülü Sol Paneli (Yayın Planlama Tarzı Tam Boy Medya, Bölüm & Reklam Kütüphanesi).
 *
 * Özellikler:
 * 1. İki ayrı kutunun üst üste binip ekranı daraltması kaldırıldı; panel Yayın Planlama gibi TEK PARÇA TAM BOY kaydırılabilir listedir.
 * 2. Sağdaki tabloda bir program klibine (örn: Tecvid_70_270722) tıklandığında otomatik olarak
 *    "Seçili Programın Bölümleri" moduna geçer ve o programın tüm bölüm/partlarını tam boy listeler;
 *    operatör tek tıkla "Tüm Medya Arşivi" sekmesine geçerek tüm arşivde arama yapabilir.
 * 3. Kanal introları (örn: SEMERKAND_intro_v3_2014) yanlışlıkla "Semerkand Sohbetleri" ile eşleştirilmez.
 * 4. Kartlarda "İzle" yazısı yerine "ⓘ" (Information / Bilgi & Önizleme Popup) ikonu yer alır.
 * 5. Dolgu Kuşağı (Filler Slot) ekleme alanı KESİNLİKLE YOKTUR.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Film, Megaphone, Plus, Info,
  ArrowLeftRight, X, Maximize2, Minimize2, Sparkles, Library
} from 'lucide-react';
import usePlanningStore from '../../../store/planningStore';
import {
  findMatchingAdminPrograms,
  fetchProgramClipsCached,
  sortSlotClips,
  deduplicateEpisodeClipsNewest,
  extractClipMeta,
  normalizeProgramText
} from '../../broadcast/utils/draftSlotMatcher';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import { formatSecondsReadable } from '../utils/listControlVerificationEngine';
import useResponsive from '../../../hooks/useResponsive';

const MIN_WIDTH = 290;
const DEFAULT_WIDTH = 350;
const EXPANDED_WIDTH = 500;
const MAX_WIDTH = 720;

export default function ListControlSidebar({
  selectedChannel,
  selectedDate,
  selectedItem = null,
  selectedIndex = -1,
  onReplaceSelected,
  onInsertItem,
  onOpenClipPreview,
  onCloseSidebar
}) {
  const { isCompact } = useResponsive();
  const materials = usePlanningStore(state => state.materials) || [];
  const companies = usePlanningStore(state => state.companies) || [];
  const products = usePlanningStore(state => state.products) || [];
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = useMemo(() => new Set((hiddenCategoryIds || []).map(Number)), [hiddenCategoryIds]);

  const [activeTab, setActiveTab] = useState('media'); // 'media' | 'ads'
  const [mediaScope, setMediaScope] = useState('all_library'); // 'selected_program' | 'all_library'
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);

  // Aktif programlar (Admin Panel -> Programlar) ve Kategoriler
  const [usedPrograms, setUsedPrograms] = useState([]);
  const [categories, setCategories] = useState([]);

  // Seçili satıra (tıklanan klibe) ait otomatik eşleşen programın bölümleri
  const [focusedProgramClips, setFocusedProgramClips] = useState([]);
  const [loadingFocusedClips, setLoadingFocusedClips] = useState(false);
  const [focusedEpisodeFilter, setFocusedEpisodeFilter] = useState('auto');
  const [focusedSearch, setFocusedSearch] = useState('');

  // Genel Medya Kütüphanesi Arama & Filtreler
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedProgramId, setSelectedProgramId] = useState('all');
  const [libraryEpisodeFilter, setLibraryEpisodeFilter] = useState('all');
  const [libraryClips, setLibraryClips] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Reklam Kütüphanesi Arama & Filtreler
  const [adSearch, setAdSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');

  const isSelectedAd = Boolean(
    selectedItem && (selectedItem.isAdClip || selectedItem.isFromAds || selectedItem.type === 'ad_break' || selectedItem.type === 'ad_spot')
  );

  const isSelectedGenericIntro = Boolean(
    selectedItem &&
    !isSelectedAd &&
    (selectedItem.isIntroClip ||
      selectedItem.unitType === 'intro' ||
      String(selectedItem.categoryName || selectedItem.category || '').toLowerCase().includes('jenerik') ||
      /semerkand_intro|jenerik|reklam_.*_(giris|cikis)/i.test(String(selectedItem.title || selectedItem.clipName || '')))
  );

  // Sağ kenardan sürükleyerek genişletme
  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e) => {
      const delta = e.clientX - startXRef.current;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidthRef.current + delta));
      setSidebarWidth(next);
    };
    const handleUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Aktif programları ve kategorileri yükle
  useEffect(() => {
    let mounted = true;
    fetch('/api/archive/used-programs')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (mounted && Array.isArray(data?.programs)) {
          setUsedPrograms(data.programs.filter(p => !hiddenCatSet.has(Number(p.categoryId))));
        }
      })
      .catch(() => {});

    fetch('/api/categories')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (mounted && Array.isArray(data)) {
          setCategories(data.filter(c => {
            const cid = Number(c.id || c.categoryId);
            return cid !== 6 && cid !== 11 && !hiddenCatSet.has(cid);
          }));
        }
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, [hiddenCatSet]);

  // 1. Tıklanan Klibin Ait Olduğu Programı Bul (Jenerik/İntro satırlarını yanlışlıkla Semerkand Sohbetleri ile eşleştirme!)
  const matchedFocusedPrograms = useMemo(() => {
    if (!selectedItem || isSelectedAd || isSelectedGenericIntro || usedPrograms.length === 0) return [];
    const candidateTitle = selectedItem.programTitle || selectedItem.clipName || selectedItem.title || '';
    const strippedTitle = String(candidateTitle)
      .replace(/\.[a-z0-9]{2,4}$/i, '')
      .replace(/[_\s-]+(blm|bolum|bölüm|cuz|cüz|part|prt|kisim|kısım|p)[_\s.-]*\d+.*$/i, '')
      .replace(/[_\s-]+\d{1,4}([_\s-]+\d{1,2})?([_\s-]+\d{4,8})?([_\s-]+p\d+)?$/i, '')
      .replace(/_/g, ' ')
      .trim();

    if (!strippedTitle || strippedTitle.length < 3) return [];

    const probeObj = {
      title: strippedTitle,
      name: candidateTitle
    };
    const matches = findMatchingAdminPrograms(probeObj, usedPrograms);
    if (matches.length > 0) return matches;

    const normCand = normalizeProgramText(strippedTitle);
    if (!normCand || normCand === 'semerkand') return [];
    return usedPrograms.filter(p => {
      const normProg = normalizeProgramText(p.title || '');
      return normProg && normProg.length >= 4 && (normCand === normProg || normCand.startsWith(normProg) || normProg.startsWith(normCand));
    }).slice(0, 3);
  }, [selectedItem, isSelectedAd, isSelectedGenericIntro, usedPrograms]);

  // Sağdaki listeden bir satıra tıklandığında sekmeyi ve odak modunu otomatik ayarla
  useEffect(() => {
    if (!selectedItem) return;
    if (isSelectedAd) {
      setActiveTab('ads');
    } else {
      setActiveTab('media');
      if (!isSelectedGenericIntro && matchedFocusedPrograms.length > 0) {
        setMediaScope('selected_program');
      } else {
        setMediaScope('all_library');
      }
    }
  }, [selectedItem?.instanceId, isSelectedAd, isSelectedGenericIntro, matchedFocusedPrograms.length]);

  useEffect(() => {
    let mounted = true;
    setFocusedEpisodeFilter('auto');
    setFocusedSearch('');

    if (!selectedItem || isSelectedAd || isSelectedGenericIntro || matchedFocusedPrograms.length === 0) {
      setFocusedProgramClips([]);
      return;
    }

    const loadFocused = async () => {
      setLoadingFocusedClips(true);
      try {
        const lists = await Promise.all(
          matchedFocusedPrograms.slice(0, 3).map(p => fetchProgramClipsCached(p.id).catch(() => []))
        );
        const combined = [];
        lists.forEach(arr => {
          if (Array.isArray(arr)) combined.push(...arr);
        });
        const selMeta = extractClipMeta(selectedItem.clipName || selectedItem.title || '');
        const targetEp = selectedItem.episodeNo ? Number(selectedItem.episodeNo) : selMeta.episodeNo;
        if (mounted) {
          setFocusedProgramClips(sortSlotClips(combined, targetEp));
        }
      } catch (_) {
        if (mounted) setFocusedProgramClips([]);
      } finally {
        if (mounted) setLoadingFocusedClips(false);
      }
    };

    loadFocused();
    return () => { mounted = false; };
  }, [selectedItem?.instanceId, isSelectedAd, isSelectedGenericIntro, matchedFocusedPrograms]);

  const focusedAvailableEpisodes = useMemo(() => {
    const epSet = new Set();
    focusedProgramClips.forEach(c => {
      if (c.episodeNo !== null && c.episodeNo !== undefined) {
        epSet.add(Number(c.episodeNo));
      }
    });
    return Array.from(epSet).sort((a, b) => b - a);
  }, [focusedProgramClips]);

  const effectiveFocusedEpisode = useMemo(() => {
    if (focusedEpisodeFilter !== 'auto') return focusedEpisodeFilter;
    const selMeta = extractClipMeta(selectedItem?.clipName || selectedItem?.title || '');
    const currentEp = selectedItem?.episodeNo ? Number(selectedItem.episodeNo) : selMeta.episodeNo;
    if (currentEp && focusedAvailableEpisodes.includes(Number(currentEp))) {
      return Number(currentEp);
    }
    return 'all';
  }, [focusedEpisodeFilter, selectedItem, focusedAvailableEpisodes]);

  const displayedFocusedClips = useMemo(() => {
    let list = focusedProgramClips;
    if (focusedSearch.trim()) {
      return filterAndSortBySearchPriority(
        list,
        focusedSearch,
        c => c.name || c.fileName || '',
        c => [c.note, c.unitLabel, c.episodeNo ? `Bölüm ${c.episodeNo}` : '', c.fileId]
      );
    }
    if (effectiveFocusedEpisode !== 'all' && typeof effectiveFocusedEpisode === 'number') {
      list = list.filter(c => Number(c.episodeNo) === effectiveFocusedEpisode);
      return deduplicateEpisodeClipsNewest(list, matchedFocusedPrograms[0]?.title || '');
    }
    return list.slice(0, 150);
  }, [focusedProgramClips, focusedSearch, effectiveFocusedEpisode, matchedFocusedPrograms]);

  // 2. Genel Medya Kütüphanesi Kliplerini Getir
  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(async () => {
      setLoadingLibrary(true);
      try {
        if (selectedProgramId && selectedProgramId !== 'all') {
          const list = await fetchProgramClipsCached(selectedProgramId);
          let sorted = sortSlotClips(Array.isArray(list) ? list : []);
          if (librarySearch.trim()) {
            sorted = filterAndSortBySearchPriority(
              sorted,
              librarySearch,
              c => c.name || c.fileName || '',
              c => [c.note, c.unitLabel, c.episodeNo ? `Bölüm ${c.episodeNo}` : '', c.fileId]
            );
          }
          if (mounted) setLibraryClips(sorted);
          return;
        }

        let url = `/api/archive/clips/search?q=${encodeURIComponent(librarySearch || '')}&limit=150&onlyActivePrograms=true`;
        if (selectedCategoryId && selectedCategoryId !== 'all') {
          url += `&categoryId=${selectedCategoryId}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (mounted && data?.success && Array.isArray(data.clips)) {
          const clean = data.clips.filter(c => !hiddenCatSet.has(Number(c.categoryId)));
          setLibraryClips(sortSlotClips(clean));
        }
      } catch (_) {
        if (mounted) setLibraryClips([]);
      } finally {
        if (mounted) setLoadingLibrary(false);
      }
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [librarySearch, selectedCategoryId, selectedProgramId, hiddenCatSet]);

  const libraryAvailableEpisodes = useMemo(() => {
    if (selectedProgramId === 'all') return [];
    const s = new Set();
    libraryClips.forEach(c => {
      if (c.episodeNo !== null && c.episodeNo !== undefined) s.add(Number(c.episodeNo));
    });
    return Array.from(s).sort((a, b) => b - a);
  }, [libraryClips, selectedProgramId]);

  const displayedLibraryClips = useMemo(() => {
    if (selectedProgramId === 'all' || libraryEpisodeFilter === 'all' || librarySearch.trim()) {
      return libraryClips.slice(0, 150);
    }
    return libraryClips.filter(c => Number(c.episodeNo) === Number(libraryEpisodeFilter));
  }, [libraryClips, selectedProgramId, libraryEpisodeFilter, librarySearch]);

  // 3. Reklam Kütüphanesi Filtrelemesi
  const filteredAdsCatalog = useMemo(() => {
    const companyMap = new Map(companies.map(c => [String(c.id), c.name]));
    const productMap = new Map(products.map(p => [String(p.id), p.name]));

    let list = materials.map(m => ({
      ...m,
      companyName: m.companyName || companyMap.get(String(m.companyId)) || 'Genel Firma',
      productName: m.productName || productMap.get(String(m.productId)) || ''
    }));

    if (selectedCompanyId !== 'all') {
      list = list.filter(m => String(m.companyId) === String(selectedCompanyId));
    }

    if (adSearch.trim()) {
      const q = adSearch.toLowerCase().trim();
      list = list.filter(m =>
        (m.clipName || m.name || '').toLowerCase().includes(q) ||
        (m.companyName || '').toLowerCase().includes(q) ||
        (m.productName || '').toLowerCase().includes(q) ||
        String(m.code || m.clipId || '').toLowerCase().includes(q)
      );
    }

    return list.slice(0, 150);
  }, [materials, companies, products, selectedCompanyId, adSearch]);

  const buildClipPayload = (clip) => {
    const durSec = Math.max(1, Number(clip.durationSec) || Math.round((Number(clip.duration) || 1) * 60));
    const fileId = clip.fileId || clip.id;
    const pureMatch = String(fileId || '').trim().match(/^(\d{3,10})(?:\.[a-zA-Z0-9]+)?$/);
    const code = clip.fileName || (pureMatch ? `${pureMatch[1]}.mxf` : `${clip.name || 'klip'}.mxf`);
    return {
      id: fileId,
      fileId: pureMatch ? Number(pureMatch[1]) : null,
      clipId: fileId,
      code,
      fileName: code,
      title: clip.name || clip.fileName || clip.title || 'Klip',
      clipName: clip.name || clip.fileName || clip.title || '',
      programTitle: clip.programTitle || matchedFocusedPrograms[0]?.title || '',
      duration: durSec / 60,
      durationSec: durSec,
      categoryName: clip.categoryName || 'Arşiv',
      categoryColor: clip.categoryColor || '#14b8a6',
      episodeNo: clip.episodeNo ?? null,
      partNo: clip.partNo ?? null,
      unitType: clip.unitType || 'bolum',
      unitLabel: clip.unitLabel || null,
      note: clip.note || '',
      isAdClip: false,
      isFromAds: false,
      type: 'clip'
    };
  };

  const buildAdPayload = (mat) => {
    const durSec = Math.max(1, Number(mat.duration) || Number(mat.durationSec) || 15);
    const clipId = mat.clipId || mat.code || mat.id;
    const pureMatch = String(clipId || '').trim().match(/^(\d{3,10})(?:\.[a-zA-Z0-9]+)?$/);
    const code = mat.code || (clipId ? `${String(clipId).replace(/\.[^.]+$/, '')}.mxf` : '');
    return {
      id: clipId,
      fileId: pureMatch ? Number(pureMatch[1]) : null,
      clipId,
      code,
      fileName: code,
      materialId: mat.id,
      companyId: mat.companyId || null,
      companyName: mat.companyName || '',
      productId: mat.productId || null,
      productName: mat.productName || '',
      title: mat.clipName || mat.name || 'Reklam Spotu',
      clipName: mat.clipName || mat.name || '',
      duration: durSec / 60,
      durationSec: durSec,
      isAdClip: true,
      isFromAds: true,
      type: 'ad_spot',
      parentBreakId: selectedItem?.parentBreakId || null,
      parentBreakTitle: selectedItem?.parentBreakTitle || 'Manuel Eklenen Reklam'
    };
  };

  const renderClipCard = (clip, isFocusedSection = false) => {
    const durSec = Number(clip.durationSec) || Math.round((Number(clip.duration) || 0) * 60);
    const isCurrentClip =
      selectedItem &&
      ((clip.fileId && String(selectedItem.fileId || selectedItem.id) === String(clip.fileId)) ||
        (clip.name && (selectedItem.title === clip.name || selectedItem.clipName === clip.name)));

    return (
      <div
        key={`${isFocusedSection ? 'foc' : 'lib'}-${clip.fileId || clip.id}-${clip.name}`}
        draggable={true}
        onDragStart={(e) => {
          const payload = buildClipPayload(clip);
          e.dataTransfer.setData('application/json', JSON.stringify({ source: 'lc_library_clip', payload }));
          e.dataTransfer.effectAllowed = 'copyMove';
        }}
        style={{
          padding: '9px 11px',
          borderRadius: '10px',
          background: isCurrentClip ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)',
          border: isCurrentClip
            ? '1.5px solid rgba(16, 185, 129, 0.5)'
            : '1px solid var(--border-color)',
          borderLeft: isCurrentClip ? '4px solid #10b981' : '3.5px solid #2563eb',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          cursor: 'grab',
          transition: 'all 0.12s ease'
        }}
        title="Sağdaki tabloya sürükleyip bırakabilir veya butonlarla ekleyip değiştirebilirsiniz"
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {clip.episodeNo != null && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(37, 99, 235, 0.14)',
                  color: '#2563eb'
                }}>
                  {clip.unitType === 'cuz' ? `${clip.episodeNo}. Cüz` : `Bölüm ${clip.episodeNo}`}
                </span>
              )}
              {clip.partNo != null && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(124, 58, 237, 0.14)',
                  color: '#7c3aed'
                }}>
                  Part {clip.partNo}
                </span>
              )}
              {isCurrentClip && (
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: '#10b981',
                  color: '#ffffff'
                }}>
                  Listedeki Klip
                </span>
              )}
            </div>
            <div style={{
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
              lineHeight: 1.3
            }}>
              {clip.name || clip.fileName}
            </div>
            {clip.note && (
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                {clip.note}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 800,
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: '5px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }}>
              {formatSecondsReadable(durSec)}
            </span>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 700 }}>
              ID: #{clip.fileId}
            </span>
          </div>
        </div>

        {/* Eylem Butonları: Değiştir, Ekle ve ⓘ Bilgi (Information) Popup */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '5px',
          paddingTop: '4px',
          borderTop: '1px dashed var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            {selectedItem && !isSelectedAd && !isCurrentClip && (
              <button
                type="button"
                onClick={() => onReplaceSelected(buildClipPayload(clip))}
                style={{
                  padding: '3.5px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(37, 99, 235, 0.45)',
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#2563eb',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title={`Seçili "#${selectedIndex + 1} ${selectedItem.title}" satırını bu kliple değiştir`}
              >
                <ArrowLeftRight size={11} />
                <span>Değiştir</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onInsertItem(buildClipPayload(clip), selectedIndex >= 0 ? selectedIndex + 1 : -1)}
              style={{
                padding: '3.5px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#059669',
                fontSize: '10.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px'
              }}
              title={selectedIndex >= 0 ? `Seçili #${selectedIndex + 1} satırının hemen altına ekle` : 'Listenin sonuna ekle'}
            >
              <Plus size={11} />
              <span>{selectedIndex >= 0 ? 'Altına Ekle' : 'Listeye Ekle'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenClipPreview(clip)}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: '1.5px solid rgba(37, 99, 235, 0.4)',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Klip Bilgileri, Veritabanı Künyesi ve Video Önizleme (Information ⓘ)"
          >
            <Info size={14} color="#2563eb" />
          </button>
        </div>
      </div>
    );
  };

  const hasMatchedProgram = Boolean(selectedItem && !isSelectedAd && !isSelectedGenericIntro && matchedFocusedPrograms.length > 0);
  const isShowingSelectedProgram = hasMatchedProgram && mediaScope === 'selected_program';

  return (
    <>
      {isCompact && (
        <div
          onClick={onCloseSidebar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 1140
          }}
        />
      )}
      <div
        style={isCompact ? {
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '360px',
          maxWidth: '92vw',
          height: '100dvh',
          background: 'var(--bg-secondary)',
          borderRight: '1.5px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
          zIndex: 1180,
          boxShadow: '12px 0 32px rgba(0,0,0,0.38)'
        } : {
          width: `${sidebarWidth}px`,
          minWidth: `${MIN_WIDTH}px`,
          maxWidth: `${MAX_WIDTH}px`,
          height: '100%',
          background: 'var(--bg-secondary)',
          borderRight: '1.5px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden'
        }}
      >
      {/* 1. ÜST SEKME BAŞLIĞI: Medya & Bölümler | Reklam Havuzu */}
      <div style={{
        padding: '8px 10px',
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          flex: 1,
          background: 'var(--bg-primary)',
          padding: '2.5px',
          borderRadius: '9px',
          border: '1px solid var(--border-color)',
          gap: '3px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('media')}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'media' ? '#2563eb' : 'transparent',
              color: activeTab === 'media' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px'
            }}
          >
            <Film size={13} />
            <span>Program & Klipler</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ads')}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'ads' ? '#d97706' : 'transparent',
              color: activeTab === 'ads' ? '#ffffff' : 'var(--text-secondary)',
              fontSize: '11.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px'
            }}
          >
            <Megaphone size={13} />
            <span>Reklamlar ({materials.length})</span>
          </button>
        </div>

        {isCompact && onCloseSidebar ? (
          <button
            type="button"
            onClick={onCloseSidebar}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Kütüphane Panelini Kapat"
          >
            <X size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarWidth(w => (w >= EXPANDED_WIDTH - 30 ? DEFAULT_WIDTH : EXPANDED_WIDTH))}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Sol Paneli Genişlet / Daralt"
          >
            {sidebarWidth >= EXPANDED_WIDTH - 30 ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
      </div>

      {/* 2. SEÇİLİ SATIR DURUM ŞERİDİ */}
      {selectedItem && (
        <div style={{
          padding: '7px 10px',
          background: isSelectedAd ? 'rgba(217, 119, 6, 0.1)' : 'rgba(37, 99, 235, 0.1)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          fontSize: '11px',
          flexShrink: 0
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{
              fontWeight: 800,
              color: isSelectedAd ? '#d97706' : '#2563eb',
              fontSize: '10px',
              textTransform: 'uppercase'
            }}>
              {isSelectedAd ? 'Seçili Reklam Satırı:' : 'Seçili Tablo Satırı:'}
            </span>
            <div style={{
              fontWeight: 800,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              #{selectedIndex + 1} • {selectedItem.title}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenClipPreview({
              fileId: selectedItem.fileId || selectedItem.clipId || selectedItem.id,
              name: selectedItem.clipName || selectedItem.title,
              title: selectedItem.title,
              fileName: selectedItem.code || selectedItem.fileName,
              durationSec: selectedItem.durationSec,
              categoryName: isSelectedAd ? 'Reklam' : selectedItem.categoryName
            })}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: '1.5px solid rgba(37, 99, 235, 0.45)',
              background: 'var(--bg-primary)',
              color: '#2563eb',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Seçili satırın bilgi & önizleme penceresini aç (ⓘ)"
          >
            <Info size={14} />
          </button>
        </div>
      )}

      {/* 3. SEKME 1: PROGRAM & KLİP KÜTÜPHANESİ (YAYIN PLANLAMA GİBİ TAM BOY TEK LİSTE!) */}
      {activeTab === 'media' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Eğer tıklanan satırın eşleşen bir programı varsa: "Seçili Programın Bölümleri" ↔ "Tüm Program Arşivi" Geçiş Çubuğu */}
          {hasMatchedProgram && (
            <div style={{
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              gap: '4px',
              flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => setMediaScope('selected_program')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '7px',
                  border: isShowingSelectedProgram ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                  background: isShowingSelectedProgram ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-primary)',
                  color: isShowingSelectedProgram ? '#2563eb' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  minWidth: 0
                }}
              >
                <Sparkles size={12} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {matchedFocusedPrograms[0]?.title} ({focusedProgramClips.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMediaScope('all_library')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: '7px',
                  border: !isShowingSelectedProgram ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                  background: !isShowingSelectedProgram ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-primary)',
                  color: !isShowingSelectedProgram ? '#2563eb' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <Library size={12} style={{ flexShrink: 0 }} />
                <span>Tüm Arşiv ({usedPrograms.length})</span>
              </button>
            </div>
          )}

          {isShowingSelectedProgram ? (
            /* A) SEÇİLİ PROGRAMIN BÖLÜMLERİ (TAM BOY LİSTE) */
            <>
              <div style={{
                padding: '8px 10px',
                background: 'rgba(37, 99, 235, 0.06)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {focusedAvailableEpisodes.length > 0 && (
                    <select
                      value={effectiveFocusedEpisode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFocusedEpisodeFilter(val === 'all' ? 'all' : Number(val));
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '7px',
                        border: '1px solid rgba(37, 99, 235, 0.45)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="all">Tüm Bölümler ({focusedAvailableEpisodes.length})</option>
                      {focusedAvailableEpisodes.map(ep => (
                        <option key={ep} value={ep}>
                          Bölüm {ep}
                        </option>
                      ))}
                    </select>
                  )}

                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '7px' }} />
                    <input
                      type="text"
                      value={focusedSearch}
                      onChange={(e) => setFocusedSearch(e.target.value)}
                      placeholder={`${matchedFocusedPrograms[0]?.title} bölümlerinde ara...`}
                      style={{
                        width: '100%',
                        padding: '5px 22px 5px 26px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '11.5px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    {focusedSearch && (
                      <button
                        type="button"
                        onClick={() => setFocusedSearch('')}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '6px',
                          border: 'none',
                          background: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {loadingFocusedClips ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Bölümler yükleniyor...
                  </div>
                ) : displayedFocusedClips.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Bu filtreye uygun bölüm bulunamadı.
                  </div>
                ) : (
                  displayedFocusedClips.map(clip => renderClipCard(clip, true))
                )}
              </div>
            </>
          ) : (
            /* B) TÜM MEDYA KÜTÜPHANESİ & PROGRAM ARŞİVİ (TAM BOY LİSTE) */
            <>
              <div style={{
                padding: '8px 10px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                flexShrink: 0
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={13} color="var(--text-secondary)" style={{ position: 'absolute', left: '9px' }} />
                  <input
                    type="text"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    placeholder="Klip adı, program, bölüm no veya FileID ara..."
                    style={{
                      width: '100%',
                      padding: '6px 26px 6px 28px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {librarySearch && (
                    <button
                      type="button"
                      onClick={() => setLibrarySearch('')}
                      style={{
                        position: 'absolute',
                        right: '7px',
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '5px' }}>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => {
                      setSelectedProgramId(e.target.value);
                      setLibraryEpisodeFilter('all');
                    }}
                    style={{
                      flex: 1,
                      padding: '5px 7px',
                      borderRadius: '7px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      fontWeight: 700,
                      outline: 'none',
                      minWidth: 0
                    }}
                  >
                    <option value="all">Tüm Programlar ({usedPrograms.length})</option>
                    {usedPrograms
                      .filter(p => selectedCategoryId === 'all' || String(p.categoryId) === String(selectedCategoryId))
                      .map(p => (
                        <option key={p.id} value={String(p.id)}>
                          {p.title} ({p.totalClips})
                        </option>
                      ))}
                  </select>

                  {libraryAvailableEpisodes.length > 0 ? (
                    <select
                      value={libraryEpisodeFilter}
                      onChange={(e) => setLibraryEpisodeFilter(e.target.value)}
                      style={{
                        width: '110px',
                        padding: '5px 7px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    >
                      <option value="all">Tüm Bölümler</option>
                      {libraryAvailableEpisodes.map(ep => (
                        <option key={ep} value={ep}>
                          Bölüm {ep}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      style={{
                        width: '110px',
                        padding: '5px 7px',
                        borderRadius: '7px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    >
                      <option value="all">Tüm Kategoriler</option>
                      {categories.map(c => (
                        <option key={c.id || c.categoryId} value={String(c.id || c.categoryId)}>
                          {c.name || c.categoryName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {loadingLibrary ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Medya arşivi aranıyor...
                  </div>
                ) : displayedLibraryClips.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Arama kriterine uygun klip bulunamadı.
                  </div>
                ) : (
                  displayedLibraryClips.map(clip => renderClipCard(clip, false))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. SEKME 2: REKLAM KÜTÜPHANESİ (TAM BOY TEK LİSTE) */}
      {activeTab === 'ads' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '8px 10px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0
          }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={13} color="var(--text-secondary)" style={{ position: 'absolute', left: '9px' }} />
              <input
                type="text"
                value={adSearch}
                onChange={(e) => setAdSearch(e.target.value)}
                placeholder="Reklam, firma, ürün veya klip ID ara..."
                style={{
                  width: '100%',
                  padding: '6px 26px 6px 28px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {adSearch && (
                <button
                  type="button"
                  onClick={() => setAdSearch('')}
                  style={{
                    position: 'absolute',
                    right: '7px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 8px',
                borderRadius: '7px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 700,
                outline: 'none'
              }}
            >
              <option value="all">Tüm Firmalar ({companies.length} Firma)</option>
              {companies.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {filteredAdsCatalog.map(mat => {
              const durSec = Number(mat.duration) || Number(mat.durationSec) || 15;
              return (
                <div
                  key={mat.id}
                  draggable={true}
                  onDragStart={(e) => {
                    const payload = buildAdPayload(mat);
                    e.dataTransfer.setData('application/json', JSON.stringify({ source: 'lc_library_ad', payload }));
                    e.dataTransfer.effectAllowed = 'copyMove';
                  }}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '10px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    borderLeft: '3.5px solid #d97706',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    cursor: 'grab'
                  }}
                  title="Sağdaki tabloya sürükleyip bırakabilir veya butonlarla ekleyip değiştirebilirsiniz"
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                        {mat.clipName || mat.name}
                      </div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
                        {mat.companyName}
                        {mat.productName ? ` • ${mat.productName}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: '5px',
                        background: 'rgba(217, 119, 6, 0.14)',
                        color: '#d97706'
                      }}>
                        {durSec} sn
                      </span>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 700 }}>
                        ID: #{mat.clipId || mat.code}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '5px',
                    paddingTop: '4px',
                    borderTop: '1px dashed var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {selectedItem && isSelectedAd && (
                        <button
                          type="button"
                          onClick={() => onReplaceSelected(buildAdPayload(mat))}
                          style={{
                            padding: '3.5px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(217, 119, 6, 0.45)',
                            background: 'rgba(217, 119, 6, 0.14)',
                            color: '#d97706',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                          title="Seçili reklam satırını bu reklamla değiştir"
                        >
                          <ArrowLeftRight size={11} />
                          <span>Değiştir</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onInsertItem(buildAdPayload(mat), selectedIndex >= 0 ? selectedIndex + 1 : -1)}
                        style={{
                          padding: '3.5px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#059669',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Plus size={11} />
                        <span>{selectedIndex >= 0 ? 'Altına Ekle' : 'Listeye Ekle'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenClipPreview({
                        fileId: String(mat.clipId || mat.code || '').replace(/\D+/g, ''),
                        name: mat.clipName || mat.name,
                        title: mat.name || mat.clipName,
                        fileName: mat.code || `${mat.clipId}.mxf`,
                        durationSec: durSec,
                        categoryName: 'Reklam'
                      })}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        border: '1.5px solid rgba(217, 119, 6, 0.45)',
                        background: 'rgba(217, 119, 6, 0.1)',
                        color: '#d97706',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      title="Reklam Bilgileri, Veritabanı Künyesi ve Video Önizleme (Information ⓘ)"
                    >
                      <Info size={14} color="#d97706" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sağ Kenar Sürükleme Tutamacı */}
      <div
        onMouseDown={(e) => {
          startXRef.current = e.clientX;
          startWidthRef.current = sidebarWidth;
          setIsResizing(true);
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '6px',
          cursor: 'col-resize',
          zIndex: 20,
          background: isResizing ? 'var(--accent-primary)' : 'transparent'
        }}
        title="Sürükleyerek sol paneli genişletin veya daraltın"
      />
    </div>
    </>
  );
}
