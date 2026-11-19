/**
 * @file src/modules/broadcast/components/FillerSlotModal.jsx
 * @description Yayın akışındaki "Dolgu Kuşağı" satırına tıklandığında Sol Panelde (veya modal olarak) açılan
 * Dolgu Kuşağı Doldurma & Kategori/Klip Seçim Paneli.
 *
 * Özellikler:
 * 1. Sol panelde (mode="sidebar") doğrudan açılır; pop-up karmaşası yaratmaz.
 * 2. Bir Dolgu Kuşağından diğerine geçildiğinde (veya kuşak doldurulduğunda) önceki seçimler, arama ve filtreler tamamen sıfırlanır.
 * 3. Kategoriler (Kısa Program #10, Dini #4, Kültürel #8, Çocuk #5, Tanıtım #3, Jenerik #7, Tümü vb.) üzerinden filtreleme,
 *    program seçimi ve öncelik algoritmalı (başlayan -> kelime başlangıcı -> içeren) canlı arama sunar.
 * 4. Bir veya birden fazla klibi seçerek (toplam süreyi görerek) doğrudan ilgili Dolgu Kuşağı konumuna yerleştirir.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Search, Film, Plus, CheckSquare, Square, Loader2,
  Sparkles, Tv, Clock, Info, CheckCircle2, Layers, Tag
} from 'lucide-react';
import { extractClipMeta, getClipTimestamp, formatClipDurationReadable } from '../utils/draftSlotMatcher';
import { parseTimecodeDisplay } from '../utils/rundownHelpers';
import { secondsToTimecode } from '../utils/timecodeUtils';
import { BROADCAST_CATEGORIES } from '../../../utils/categoryColors';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import usePlanningStore from '../../../store/planningStore';
import ClipDetailMetadataModal from '../../../pages/admin/archive/ClipDetailMetadataModal';

export default function FillerSlotModal({
  isOpen = true,
  mode = 'sidebar', // 'sidebar' | 'modal'
  fillerItem = null,
  fillerSlotsList = [],
  onSelectFillerSlot = null,
  onClose,
  onConfirmClips,
  onRemoveAddedClip = null
}) {
  // Kategori filtresi: 'all' = Tüm Kategoriler (Varsayılan), '10' = Kısa Program, veya kategori ID ('4', '8', '5' vb.)
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('all');
  const [sortBy] = useState('newest'); // 'newest' | 'episode' | 'duration_asc'
  const [isAddedClipsExpanded, setIsAddedClipsExpanded] = useState(false);

  const [usedPrograms, setUsedPrograms] = useState([]);
  const [clips, setClips] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [loading, setLoading] = useState(false);

  // Çoklu seçim (seçilen kliplerin tam nesnelerini sırayla tutar)
  const [selectedClips, setSelectedClips] = useState([]);
  const [viewingClip, setViewingClip] = useState(null);

  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = useMemo(() => new Set((hiddenCategoryIds || []).map(id => Number(id))), [hiddenCategoryIds]);

  // KRİTİK: Bir Dolgu Kuşağından diğerine geçildiğinde önceki kuşağın verilerini tamamen sıfırla!
  const activeGroupKey = fillerItem?.fillerGroupId || fillerItem?.instanceId || fillerItem?.id || '';
  useEffect(() => {
    setSelectedClips([]);
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedProgramId('all');
    setViewingClip(null);
  }, [activeGroupKey]);

  // Aktif programları yükle
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    fetch('/api/archive/used-programs')
      .then(r => r.json())
      .then(data => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.programs) ? data.programs : []);
        setUsedPrograms(list.filter(p => !hiddenCatSet.has(Number(p.categoryId))));
      })
      .catch(err => console.error('FillerSlotModal used-programs hatası:', err));
    return () => { isMounted = false; };
  }, [isOpen, hiddenCatSet]);

  // Mevcut kategoriler listesi (Kısa Program #10, Tüm Kategoriler ve arşivdeki diğer aktif kategoriler)
  const categoryOptions = useMemo(() => {
    const countsByCat = new Map();
    usedPrograms.forEach(p => {
      const cId = String(p.categoryId || '');
      if (!cId) return;
      countsByCat.set(cId, (countsByCat.get(cId) || 0) + 1);
    });

    const baseList = [
      { id: 'all', label: 'Tüm Kategoriler', color: '#3b82f6', count: usedPrograms.length },
      { id: '10', label: '#10 Kısa Program', color: '#8b5cf6', count: countsByCat.get('10') || 0 }
    ];

    Object.values(BROADCAST_CATEGORIES).forEach(cat => {
      if (cat.id === 10 || hiddenCatSet.has(Number(cat.id))) return;
      const cStr = String(cat.id);
      const progCount = countsByCat.get(cStr) || 0;
      if (progCount > 0 || [4, 8, 5, 1, 3, 7].includes(cat.id)) {
        baseList.push({
          id: cStr,
          label: `#${cat.id} ${cat.name}`,
          color: cat.bg || '#0ea5e9',
          count: progCount
        });
      }
    });

    return baseList;
  }, [usedPrograms, hiddenCatSet]);

  // Seçili kategoriye göre filtrelenen program listesi (arama varsa öncelik algoritmasıyla sıralı)
  const availablePrograms = useMemo(() => {
    let list = usedPrograms;
    if (selectedCategory !== 'all') {
      list = list.filter(p => String(p.categoryId) === String(selectedCategory));
    }
    if (searchQuery.trim()) {
      return filterAndSortBySearchPriority(
        list,
        searchQuery,
        (p) => p.title || p.name || '',
        (p) => [p.categoryName, p.host]
      );
    }
    return list;
  }, [usedPrograms, selectedCategory, searchQuery]);

  // Kategori değiştiğinde seçili program filtresini sıfırla
  useEffect(() => {
    setSelectedProgramId('all');
  }, [selectedCategory]);

  // Klipleri sunucudan çek
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setVisibleLimit(150);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (selectedProgramId !== 'all') {
          const res = await fetch(`/api/archive/program/${selectedProgramId}/clips`);
          const data = await res.json();
          if (isMounted) {
            const progObj = usedPrograms.find(p => String(p.id) === String(selectedProgramId));
            const rawList = Array.isArray(data?.clips) ? data.clips.map(c => ({
              ...extractClipMeta(c),
              programTitle: c.programTitle || progObj?.title || '',
              categoryId: c.categoryId || progObj?.categoryId,
              categoryName: c.categoryName || progObj?.categoryName || ''
            })) : [];
            setClips(rawList);
          }
          return;
        }

        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        params.set('onlyActivePrograms', 'true');
        params.set('limit', 'all');
        if (selectedCategory !== 'all') {
          params.set('categoryId', String(selectedCategory));
        }

        const res = await fetch(`/api/archive/clips/search?${params.toString()}`);
        const data = await res.json();
        if (isMounted) {
          let rawList = Array.isArray(data?.clips)
            ? data.clips.filter(c => !hiddenCatSet.has(Number(c.categoryId)))
            : [];
          if (selectedCategory !== 'all') {
            rawList = rawList.filter(c => String(c.categoryId) === String(selectedCategory));
          }
          setClips(rawList.map(c => extractClipMeta(c)));
        }
      } catch (err) {
        console.error('Dolgu kuşağı klip arama hatası:', err);
        if (isMounted) setClips([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, selectedCategory, searchQuery, selectedProgramId, usedPrograms, hiddenCatSet]);

  // Sıralanmış klipler (Arama varsa önce Öncelik Algoritması: Başlayan -> Kelime Başlangıcı -> İçeren)
  const sortedClips = useMemo(() => {
    const baseComparator = (a, b) => {
      if (sortBy === 'newest') {
        const tDiff = getClipTimestamp(b) - getClipTimestamp(a);
        if (tDiff !== 0) return tDiff;
        return (Number(b.fileId) || 0) - (Number(a.fileId) || 0);
      }
      if (sortBy === 'duration_asc') {
        return (a.durationSec || a.duration || 0) - (b.durationSec || b.duration || 0);
      }
      const aHasEp = a.episodeNo !== null && a.episodeNo !== undefined;
      const bHasEp = b.episodeNo !== null && b.episodeNo !== undefined;
      if (aHasEp && !bHasEp) return -1;
      if (!aHasEp && bHasEp) return 1;
      if (aHasEp && bHasEp && a.episodeNo !== b.episodeNo) {
        return b.episodeNo - a.episodeNo;
      }
      const pA = a.partNo ?? 0;
      const pB = b.partNo ?? 0;
      if (pA !== pB) return pA - pB;
      return String(a.name || '').localeCompare(String(b.name || ''), 'tr');
    };

    if (searchQuery.trim()) {
      return filterAndSortBySearchPriority(
        clips,
        searchQuery,
        (c) => c.name || c.fileName || '',
        (c) => [c.programTitle, c.topic, c.note, c.categoryName, c.unitLabel, c.fileId],
        baseComparator
      );
    }

    const arr = [...clips];
    arr.sort(baseComparator);
    return arr;
  }, [clips, sortBy, searchQuery]);

  if (!isOpen) return null;

  const isSidebar = mode === 'sidebar';
  const startInfo = fillerItem
    ? parseTimecodeDisplay(fillerItem.calculatedStartTime || fillerItem.draftStartTime || '00.00.00.00')
    : { hhmmss: '00:00:00' };
  const endInfo = fillerItem
    ? parseTimecodeDisplay(fillerItem.calculatedEndTime || '00.00.00.00')
    : { hhmmss: '00:15:00' };
  const targetFillerSec = fillerItem
    ? (fillerItem.durationSec || Math.floor((fillerItem.durationFrames || 0) / 25) || 900)
    : 900;
  const addedClipsInSlot = Array.isArray(fillerItem?.addedClips) ? fillerItem.addedClips : [];
  const addedDurationSec = fillerItem?.addedDurationSec || 0;
  const addedFileIdsSet = new Set(
    addedClipsInSlot.map(c => c.fileId || c.clipName || c.name || c.title).filter(Boolean)
  );

  const selectedIdsSet = new Set(selectedClips.map(c => c.fileId || c.name));
  const totalSelectedSec = selectedClips.reduce((acc, c) => acc + (Number(c.durationSec || c.duration) || 0), 0);

  const toggleSelectClip = (clip) => {
    const key = clip.fileId || clip.name;
    setSelectedClips(prev => {
      const exists = prev.some(c => (c.fileId || c.name) === key);
      if (exists) {
        return prev.filter(c => (c.fileId || c.name) !== key);
      }
      return [...prev, clip];
    });
  };

  const handleSingleQuickAdd = (clip, e) => {
    e.stopPropagation();
    if (!fillerItem) return;
    const toAdd = [clip];
    onConfirmClips && onConfirmClips(toAdd, fillerItem);
  };

  const handleConfirmSelected = () => {
    if (selectedClips.length === 0 || !fillerItem) return;
    const toAdd = [...selectedClips];
    setSelectedClips([]);
    onConfirmClips && onConfirmClips(toAdd, fillerItem);
  };

  const innerContent = (
    <div
      onClick={(e) => e.stopPropagation()}
      style={
        isSidebar
          ? {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg-primary)',
              minHeight: 0
            }
          : {
              width: '100%',
              maxWidth: '1040px',
              height: '86vh',
              maxHeight: '860px',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }
      }
    >
      {/* 1. MİNİMAL ÜST BAŞLIK: SADECE SAAT ARALIĞI & KAPAT */}
      <div style={{
        padding: isSidebar ? '7px 10px' : '12px 18px',
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.14) 0%, var(--bg-secondary) 100%)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#8b5cf6',
              fontSize: '12px',
              fontWeight: '900',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              <Sparkles size={14} />
              <span>Dolgu:</span>
            </span>

            {fillerSlotsList.length > 1 ? (
              <select
                value={fillerItem?.instanceId || ''}
                onChange={(e) => {
                  const found = fillerSlotsList.find(f => f.instanceId === e.target.value);
                  if (found && onSelectFillerSlot) onSelectFillerSlot(found);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'var(--bg-primary)',
                  border: '1.5px solid rgba(139, 92, 246, 0.45)',
                  borderRadius: '6px',
                  padding: '3px 7px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '800',
                  fontFamily: 'monospace',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {fillerSlotsList.map((fItem, i) => {
                  const st = parseTimecodeDisplay(fItem.calculatedStartTime || fItem.draftStartTime || '00.00.00.00');
                  const et = parseTimecodeDisplay(fItem.calculatedEndTime || '00.00.00.00');
                  const dSec = fItem.durationSec || Math.floor((fItem.durationFrames || 0) / 25) || 900;
                  return (
                    <option key={fItem.instanceId || i} value={fItem.instanceId}>
                      {st.hhmmss} → {et.hhmmss} ({formatClipDurationReadable(dSec)})
                    </option>
                  );
                })}
              </select>
            ) : fillerItem ? (
              <span style={{
                background: 'rgba(139, 92, 246, 0.16)',
                color: '#8b5cf6',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '800',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap'
              }}>
                {startInfo.hhmmss} → {endInfo.hhmmss} ({formatClipDurationReadable(targetFillerSec)})
              </span>
            ) : (
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#d97706' }}>
                Listeden Dolgu Kuşağı seçin
              </span>
            )}

            {addedClipsInSlot.length > 0 && (
              <button
                type="button"
                onClick={() => setIsAddedClipsExpanded(prev => !prev)}
                title="Bu kuşağa eklenen klipleri göster/gizle"
                style={{
                  background: 'rgba(37, 99, 235, 0.14)',
                  color: '#2563eb',
                  border: '1px solid rgba(37, 99, 235, 0.38)',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                +{addedClipsInSlot.length} Klip {isAddedClipsExpanded ? '▴' : '▾'}
              </button>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '3px 7px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                flexShrink: 0
              }}
              title="Kapat"
            >
              <X size={12} />
              <span>Kapat</span>
            </button>
          )}
        </div>

        {/* İsteğe bağlı açılır: Bu kuşağa eklenmiş klipler */}
        {addedClipsInSlot.length > 0 && isAddedClipsExpanded && (
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid rgba(139, 92, 246, 0.35)',
            borderRadius: '7px',
            padding: '5px 7px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            maxHeight: '95px',
            overflowY: 'auto'
          }}>
            {addedClipsInSlot.map((ac, aIdx) => {
              const acSec = ac.durationSec || Math.floor((ac.durationFrames || 0) / 25) || 0;
              return (
                <div
                  key={ac.instanceId || aIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    fontSize: '11px'
                  }}
                >
                  <span style={{
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>
                    {aIdx + 1}. {ac.clipName || ac.title || ac.name}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#059669', fontSize: '10.5px', flexShrink: 0 }}>
                    {formatClipDurationReadable(acSec)}
                  </span>
                  {onRemoveAddedClip && (
                    <button
                      type="button"
                      onClick={() => onRemoveAddedClip(ac.instanceId)}
                      title="Klibi çıkar"
                      style={{
                        border: 'none',
                        background: 'rgba(239, 68, 68, 0.14)',
                        color: '#ef4444',
                        borderRadius: '4px',
                        padding: '0 5px',
                        fontSize: '11px',
                        fontWeight: '900',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. ARAMA ÇUBUĞU VE KOMPAKT KATEGORİ SEÇİMİ (Varsayılan: Tüm Kategoriler) */}
      <div style={{
        padding: isSidebar ? '8px 10px' : '10px 18px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0
      }}>
        {/* ARAMA KUTUSU (En Üstte) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '8px',
          padding: '6px 9px'
        }}>
          <Search size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Klip adı, program veya konu ara..."
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: '600',
              width: '100%',
              outline: 'none'
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          )}
          <span style={{
            fontSize: '10.5px',
            fontWeight: '800',
            color: 'var(--text-secondary)',
            background: 'var(--bg-tertiary)',
            padding: '2px 6px',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            {sortedClips.length} Klip
          </span>
        </div>

        {/* KOMPAKT KATEGORİ HAPLARI (Varsayılan: Tüm Kategoriler) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap'
        }}>
          {categoryOptions.map(cat => {
            const isActive = String(selectedCategory) === String(cat.id);
            const shortLabel = cat.id === 'all'
              ? 'Tüm Kategoriler'
              : cat.label.replace(/^#\d+\s*/, '');
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '999px',
                  border: isActive ? `1.5px solid ${cat.color}` : '1px solid var(--border-color)',
                  background: isActive ? cat.color : 'var(--bg-primary)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: isActive ? '800' : '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.12s'
                }}
              >
                <span>{shortLabel}</span>
                {cat.count > 0 && (
                  <span style={{
                    fontSize: '9.5px',
                    opacity: isActive ? 0.95 : 0.7,
                    background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--bg-tertiary)',
                    padding: '0 4px',
                    borderRadius: '999px'
                  }}>
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. KLİP LİSTESİ (ÇOKLU SEÇİMLİ) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: isSidebar ? '10px 12px' : '14px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
          minHeight: 0
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 250 && visibleLimit < sortedClips.length) {
            setVisibleLimit(prev => prev + 200);
          }
        }}
      >
        {loading ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: '700',
            padding: '32px 12px'
          }}>
            <Loader2 size={24} className="spin" color="#8b5cf6" />
            <span>Klipler yükleniyor...</span>
          </div>
        ) : sortedClips.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            padding: '30px 16px',
            textAlign: 'center'
          }}>
            <Film size={32} style={{ opacity: 0.35 }} />
            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>
              Arama kriterlerine uygun klip bulunamadı.
            </div>
            <div style={{ fontSize: '11.5px' }}>
              Üstteki kategorilerden <strong>"Tüm Kategoriler"</strong> seçeneğine geçebilir veya farklı bir arama yapabilirsiniz.
            </div>
          </div>
        ) : (
          sortedClips.slice(0, visibleLimit).map((clip, idx) => {
            const clipKey = clip.fileId || clip.name || idx;
            const isChecked = selectedIdsSet.has(clipKey);
            const isAlreadyInThisFiller =
              addedFileIdsSet.has(clip.fileId) ||
              (clip.name && addedFileIdsSet.has(clip.name));
            const clipSec = clip.durationSec || clip.duration || 0;
            const readableDur = formatClipDurationReadable(clipSec);
            const selectionOrder = selectedClips.findIndex(c => (c.fileId || c.name) === clipKey) + 1;

            return (
              <div
                key={clipKey}
                onClick={() => toggleSelectClip(clip)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  padding: '9px 11px',
                  borderRadius: '9px',
                  background: isChecked
                    ? 'rgba(139, 92, 246, 0.12)'
                    : isAlreadyInThisFiller
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'var(--bg-secondary)',
                  border: isChecked
                    ? '2px solid #8b5cf6'
                    : isAlreadyInThisFiller
                    ? '1.5px solid rgba(16, 185, 129, 0.45)'
                    : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.12s'
                }}
              >
                {/* Üst Satır: Checkbox + Klip Tam Adı */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isChecked ? '#8b5cf6' : 'var(--text-muted)',
                    marginTop: '1px',
                    flexShrink: 0
                  }}>
                    {isChecked ? <CheckSquare size={17} /> : <Square size={17} />}
                  </div>

                  {isChecked && (
                    <span style={{
                      background: '#8b5cf6',
                      color: '#ffffff',
                      borderRadius: '5px',
                      padding: '1px 6px',
                      fontSize: '10.5px',
                      fontWeight: '900',
                      flexShrink: 0
                    }}>
                      #{selectionOrder}
                    </span>
                  )}

                  {isAlreadyInThisFiller && (
                    <span style={{
                      background: '#10b981',
                      color: '#ffffff',
                      borderRadius: '5px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: '900',
                      flexShrink: 0
                    }}>
                      ✓ Eklendi
                    </span>
                  )}

                  <div style={{
                    fontSize: '12.5px',
                    fontWeight: '800',
                    color: 'var(--text-primary)',
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                    flex: 1
                  }}>
                    {clip.name || clip.fileName}
                  </div>
                </div>

                {/* Alt Satır: Etiketler + Süre + Detay & Ekle Butonları */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', minWidth: 0 }}>
                    {clip.programTitle && (
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.14)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '800'
                      }}>
                        📺 {clip.programTitle}
                      </span>
                    )}

                    {clip.categoryName && (
                      <span style={{
                        background: 'rgba(139, 92, 246, 0.14)',
                        color: '#8b5cf6',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '800'
                      }}>
                        {clip.categoryName}
                      </span>
                    )}

                    {clip.unitLabel && (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#059669',
                        border: '1px solid rgba(16, 185, 129, 0.32)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '800'
                      }}>
                        {clip.unitLabel}
                      </span>
                    )}

                    {clip.partNo && (
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.16)',
                        color: '#d97706',
                        border: '1px solid rgba(245, 158, 11, 0.38)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '900'
                      }}>
                        PART {clip.partNo}
                      </span>
                    )}
                  </div>

                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: '900',
                      color: '#059669',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      whiteSpace: 'nowrap'
                    }}>
                      {readableDur}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingClip(clip);
                      }}
                      title="Klip Detay & Ön İzleme"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--accent-primary)',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      <Info size={12} />
                      <span>İzle/Detay</span>
                    </button>

                    <button
                      type="button"
                      disabled={!fillerItem}
                      onClick={(e) => handleSingleQuickAdd(clip, e)}
                      title="Bu klibi hemen seçili Dolgu Kuşağına yerleştir"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '4px 9px',
                        borderRadius: '6px',
                        border: 'none',
                        background: fillerItem ? 'rgba(139, 92, 246, 0.18)' : 'var(--bg-tertiary)',
                        color: fillerItem ? '#8b5cf6' : 'var(--text-muted)',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: fillerItem ? 'pointer' : 'not-allowed'
                      }}
                    >
                      <Plus size={12} />
                      <span>Ekle</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. ALT ÖZET VE ÇOKLU EKLEME ÇUBUĞU (KOMPAKT TEK SATIR FOOTER) */}
      <div style={{
        padding: isSidebar ? '7px 10px' : '10px 18px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '800',
            color: 'var(--text-secondary)',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            padding: '4px 7px',
            borderRadius: '6px',
            whiteSpace: 'nowrap'
          }}>
            <strong style={{ color: '#8b5cf6' }}>{selectedClips.length} Klip</strong>
            {' • '}
            <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{formatClipDurationReadable(totalSelectedSec)}</strong>
          </span>

          {selectedClips.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedClips([])}
              title="Seçimi Temizle"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '4px 6px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={selectedClips.length === 0 || !fillerItem}
          onClick={handleConfirmSelected}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px 10px',
            borderRadius: '7px',
            border: 'none',
            background: selectedClips.length > 0 && fillerItem ? '#8b5cf6' : 'var(--bg-tertiary)',
            color: selectedClips.length > 0 && fillerItem ? '#ffffff' : 'var(--text-muted)',
            fontSize: '12px',
            fontWeight: '900',
            cursor: selectedClips.length > 0 && fillerItem ? 'pointer' : 'not-allowed',
            boxShadow: selectedClips.length > 0 && fillerItem ? '0 3px 10px rgba(139, 92, 246, 0.32)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <CheckCircle2 size={14} />
          <span>
            Seçilenleri Ekle ({selectedClips.length})
          </span>
        </button>
      </div>

      {/* Klip Detay & Metadata Modalı */}
      {viewingClip && (
        <ClipDetailMetadataModal
          clip={viewingClip}
          programTitle={viewingClip.programTitle || 'Dolgu Kuşağı'}
          onClose={() => setViewingClip(null)}
        />
      )}
    </div>
  );

  if (isSidebar) {
    return innerContent;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        padding: '20px'
      }}
    >
      {innerContent}
    </div>
  );
}
