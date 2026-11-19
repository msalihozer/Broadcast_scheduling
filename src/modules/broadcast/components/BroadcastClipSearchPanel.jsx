/**
 * @file src/modules/broadcast/components/BroadcastClipSearchPanel.jsx
 * @description Admin Panel -> Programlar (aktif programlar) ve tüm MAM arşivi arasında canlı arama,
 * program/kategori filtreleme, uzun klip isimlerini ve Part/Bölüm rozetlerini yüksek okunabilirlikle listeleme
 * ve akışa sürükle-bırak / tek tıkla ekleme bileşeni (Vanilla CSS).
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Film, Plus, Loader2, GripVertical, Layers, X, Tv, Info } from 'lucide-react';
import useBroadcastStore from '../store/broadcastStore';
import usePlanningStore from '../../../store/planningStore';
import { secondsToTimecode } from '../utils/timecodeUtils';
import { extractClipMeta, normalizeProgramText } from './DraftProgramSlotItem';
import { sortSlotClips } from '../utils/draftSlotMatcher';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import ClipDetailMetadataModal from '../../../pages/admin/archive/ClipDetailMetadataModal';

export default function BroadcastClipSearchPanel({ usedPrograms = [] }) {
  const {
    selectedChannel,
    selectedDate,
    activeList,
    addProgram
  } = useBroadcastStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProgramId, setSelectedProgramId] = useState('all');
  const [selectedEpisode, setSelectedEpisode] = useState('auto'); // 'auto' | 'all' | number
  const [categories, setCategories] = useState([]);
  const [clips, setClips] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(150);
  const [loading, setLoading] = useState(false);
  const [viewingClip, setViewingClip] = useState(null);
  const searchTimeoutRef = useRef(null);
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds) || [];
  const hiddenCatSet = useMemo(() => new Set((hiddenCategoryIds || []).map(id => Number(id))), [hiddenCategoryIds]);

  const visibleCategories = useMemo(
    () => categories.filter(c => {
      const cId = Number(c.id || c.categoryId);
      return cId !== 6 && cId !== 11 && !hiddenCatSet.has(cId);
    }),
    [categories, hiddenCatSet]
  );

  const visibleUsedPrograms = useMemo(
    () => usedPrograms.filter(p => !hiddenCatSet.has(Number(p.categoryId))),
    [usedPrograms, hiddenCatSet]
  );

  // Kategorileri yükle
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }, []);

  // Seçili kategoriye göre filtrelenmiş Admin Panel aktif programları
  const filteredUsedPrograms = useMemo(() => {
    if (selectedCategory === 'all') return visibleUsedPrograms;
    return visibleUsedPrograms.filter(p => String(p.categoryId) === String(selectedCategory));
  }, [visibleUsedPrograms, selectedCategory]);

  // Canlı arama veya program seçimi değiştiğinde klipleri getir
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setVisibleLimit(150);

    setLoading(true);
    searchTimeoutRef.current = setTimeout(() => {
      fetchClips(searchTerm, selectedCategory, selectedProgramId);
    }, 120);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchTerm, selectedCategory, selectedProgramId, hiddenCatSet]);

  const fetchClips = async (query, catId, progId) => {
    setLoading(true);
    try {
      // Eğer Admin Panel programlarından belirli bir program seçildiyse o programın kliplerini çek (Bölüm sırasıyla)
      if (progId && progId !== 'all') {
        const res = await fetch(`/api/archive/program/${progId}/clips`);
        if (res.ok) {
          const data = await res.json();
          let list = Array.isArray(data.clips) ? sortSlotClips(data.clips) : [];
          if (query && query.trim()) {
            list = filterAndSortBySearchPriority(
              list,
              query,
              (c) => c.name || c.fileName || '',
              (c) => [
                c.note,
                c.unitLabel,
                c.episodeNo !== null ? `Bölüm ${c.episodeNo} Cüz ${c.episodeNo}` : '',
                c.partNo !== null ? `Part ${c.partNo}` : '',
                c.fileId
              ]
            );
          }
          setClips(list);
          return;
        }
      }

      // Yalnızca Admin Panel -> Programlar (aktif programlar) içindeki klipleri ara
      let url = `/api/archive/clips/search?q=${encodeURIComponent(query || '')}&limit=all&onlyActivePrograms=true`;
      if (catId && catId !== 'all') {
        url += `&categoryId=${catId}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.clips)) {
        const filteredClips = data.clips.filter(c => !hiddenCatSet.has(Number(c.categoryId)));
        const sorted = sortSlotClips(filteredClips);
        if (query && query.trim()) {
          setClips(
            filterAndSortBySearchPriority(
              sorted,
              query,
              (c) => c.name || c.fileName || '',
              (c) => [c.programTitle, c.note, c.unitLabel, c.categoryName, c.fileId]
            )
          );
        } else {
          setClips(sorted);
        }
      } else {
        setClips([]);
      }
    } catch (e) {
      console.error('Klip arama hatası:', e);
      setClips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClip = (clip) => {
    const durTc = secondsToTimecode(clip.durationSec || 60);
    addProgram(selectedChannel, selectedDate, activeList, {
      title: clip.name || clip.fileName || 'Klip',
      name: clip.name || clip.fileName || 'Klip',
      clipName: clip.name || clip.fileName,
      fileId: clip.fileId,
      durationTc: durTc,
      durationSec: clip.durationSec || 60,
      category: clip.categoryName || 'Arşiv',
      categoryColor: clip.categoryColor || '#14b8a6',
      episodeNo: clip.episodeNo,
      partNo: clip.partNo,
      unitType: clip.unitType || 'bolum',
      unitLabel: clip.unitLabel || null,
      note: clip.note || (clip.programTitle ? `Program: ${clip.programTitle}` : ''),
      type: 'clip'
    });
  };

  const handleDragStart = (e, clip) => {
    const durTc = secondsToTimecode(clip.durationSec || 60);
    const itemData = {
      title: clip.name || clip.fileName || 'Klip',
      name: clip.name || clip.fileName || 'Klip',
      clipName: clip.name || clip.fileName,
      fileId: clip.fileId,
      durationTc: durTc,
      durationSec: clip.durationSec || 60,
      category: clip.categoryName || 'Arşiv',
      categoryColor: clip.categoryColor || '#14b8a6',
      episodeNo: clip.episodeNo,
      partNo: clip.partNo,
      unitType: clip.unitType || 'bolum',
      unitLabel: clip.unitLabel || null,
      note: clip.note || (clip.programTitle ? `Program: ${clip.programTitle}` : ''),
      type: 'clip'
    };
    e.dataTransfer.setData('application/json', JSON.stringify({ item: itemData, source: 'clip_search' }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Seçili programdaki mevcut bölümler (En son eklenen / en büyük bölüm numarası üstte)
  const availableEpisodes = useMemo(() => {
    if (selectedProgramId === 'all') return [];
    const epSet = new Set();
    clips.forEach(c => {
      if (c.episodeNo !== null && c.episodeNo !== undefined) {
        epSet.add(Number(c.episodeNo));
      }
    });
    return Array.from(epSet).sort((a, b) => b - a);
  }, [clips, selectedProgramId]);

  const effectiveEpisodeFilter = useMemo(() => {
    if (selectedProgramId === 'all') return 'all';
    if (selectedEpisode !== 'auto') return selectedEpisode;
    if (availableEpisodes.length > 0) return availableEpisodes[0];
    return 'all';
  }, [selectedProgramId, selectedEpisode, availableEpisodes]);

  const visibleClips = useMemo(() => {
    if (selectedProgramId === 'all' || searchTerm.trim() || effectiveEpisodeFilter === 'all') {
      return clips;
    }
    return clips.filter(c => Number(c.episodeNo) === Number(effectiveEpisodeFilter));
  }, [clips, selectedProgramId, searchTerm, effectiveEpisodeFilter]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-secondary)',
      overflow: 'hidden'
    }}>
      {/* Arama ve Program/Kategori Filtre Alanı */}
      <div style={{
        padding: '12px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        background: 'var(--bg-tertiary)'
      }}>
        {/* Canlı Arama Kutusu */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Klip adı, program, bölüm no, part veya konu ara..."
            style={{
              width: '100%',
              padding: '8px 28px 8px 32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '600',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {loading ? (
            <Loader2 size={14} className="animate-spin" color="var(--accent-primary)" style={{ position: 'absolute', right: '10px' }} />
          ) : searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Admin Panel -> Programlar Seçicisi */}
        {usedPrograms.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tv size={16} color="#0d9488" style={{ flexShrink: 0 }} />
            <select
              value={selectedProgramId}
              onChange={(e) => {
                setSelectedProgramId(e.target.value);
                setSelectedEpisode('auto');
              }}
              style={{
                flex: 1,
                padding: '8px 11px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tüm Aktif Programlar ({visibleUsedPrograms.length} Program)</option>
              {filteredUsedPrograms.map(prog => (
                <option key={prog.id} value={String(prog.id)}>
                  {prog.title} ({prog.totalClips} Klip)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Seçili Program İçin Bölüm / Cüz / Gün Seçici (Tüm klipler aynı anda açılmaz, sadece seçilen bölüm gösterilir) */}
        {selectedProgramId !== 'all' && availableEpisodes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <select
              value={effectiveEpisodeFilter === 'all' ? 'all' : String(effectiveEpisodeFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedEpisode(v === 'all' ? 'all' : parseInt(v, 10));
              }}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1.5px solid var(--accent-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: '800',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {availableEpisodes.map(epNum => {
                const epClips = clips.filter(c => Number(c.episodeNo) === epNum);
                const label = epClips[0]?.unitLabel || `Bölüm ${epNum}`;
                return (
                  <option key={epNum} value={String(epNum)}>
                    Sadece {label} ({epClips.length} Klip)
                  </option>
                );
              })}
              <option value="all">Tüm Bölümleri Göster ({clips.length} Klip)</option>
            </select>
          </div>
        )}

        {/* Kategori Hap Filtreleri */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedProgramId('all');
            }}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: selectedCategory === 'all' ? '#0d9488' : 'var(--bg-primary)',
              color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s'
            }}
          >
            Tüm Kategoriler
          </button>
          {visibleCategories.map(cat => (
            <button
              key={cat.categoryId}
              onClick={() => {
                setSelectedCategory(String(cat.categoryId));
                setSelectedProgramId('all');
              }}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: selectedCategory === String(cat.categoryId) ? '#0d9488' : 'var(--bg-primary)',
                color: selectedCategory === String(cat.categoryId) ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s'
              }}
            >
              {cat.categoryName}
            </button>
          ))}
        </div>
      </div>

      {/* Sonuç Özeti Başlığı */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12.5px',
        color: 'var(--text-secondary)'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: 'var(--text-primary)' }}>
          <Film size={14} color="#0d9488" />
          <span>{visibleClips.length} Klip Listeleniyor</span>
        </span>
        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>Sürükleyip akışa bırakabilirsiniz</span>
      </div>

      {/* Klipler Listesi */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '9px'
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 250 && visibleLimit < visibleClips.length) {
            setVisibleLimit(prev => prev + 200);
          }
        }}
      >
        {loading && visibleClips.length === 0 ? (
          <div style={{
            padding: '30px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Loader2 size={22} className="animate-spin" color="var(--accent-primary)" />
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Programlar kategorisinden klipler aranıyor...</span>
          </div>
        ) : visibleClips.length === 0 ? (
          <div style={{
            padding: '30px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Film size={30} color="var(--border-color)" />
            <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>Aramanıza uygun klip bulunamadı.</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Başka bir arama terimi veya program seçin.</span>
          </div>
        ) : (
          visibleClips.slice(0, visibleLimit).map((clip, idx) => {
            const dur = secondsToTimecode(clip.durationSec || 0);
            return (
              <div
                key={clip.fileId || idx}
                draggable
                onDragStart={(e) => handleDragStart(e, clip)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '11px 12px',
                  borderRadius: '10px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderLeft: '5px solid #0d9488',
                  cursor: 'grab',
                  flexShrink: 0,
                  transition: 'border-color 0.15s, background 0.15s'
                }}
              >
                {/* Üst Satır: Tam Klip Adı + Sağda ⓘ Detay Butonu */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', minWidth: 0, flex: 1 }}>
                    <GripVertical size={15} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: '3px', opacity: 0.7 }} />
                    <Film size={15} color="#0d9488" style={{ flexShrink: 0, marginTop: '3px' }} />
                    <div style={{
                      fontSize: '13.5px',
                      fontWeight: '800',
                      color: 'var(--text-primary)',
                      lineHeight: '1.4',
                      wordBreak: 'break-word',
                      flex: 1
                    }} title={clip.name || clip.fileName}>
                      {clip.name || clip.fileName}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingClip(clip);
                    }}
                    title="Klip Detayları, Metadataları ve Video İzleme (Play'e basmadıkça FFmpeg çalışmaz)"
                    style={{
                      padding: '4px 9px',
                      borderRadius: '7px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.45)',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: '800',
                      flexShrink: 0
                    }}
                  >
                    <Info size={14} />
                    <span>Detay</span>
                  </button>
                </div>

                {/* Alt Satır: Belirgin Part / Bölüm / Program Rozetleri + Süre ve Ekle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                  paddingLeft: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {(clip.unitLabel || (clip.episodeNo !== null && clip.episodeNo !== undefined)) && (
                      <span style={{
                        background: clip.unitType === 'cuz'
                          ? 'rgba(16, 185, 129, 0.16)'
                          : clip.unitType === 'gun'
                            ? 'rgba(139, 92, 246, 0.16)'
                            : 'rgba(59, 130, 246, 0.15)',
                        color: clip.unitType === 'cuz'
                          ? '#10b981'
                          : clip.unitType === 'gun'
                            ? '#8b5cf6'
                            : 'var(--accent-primary)',
                        border: clip.unitType === 'cuz'
                          ? '1px solid rgba(16, 185, 129, 0.4)'
                          : clip.unitType === 'gun'
                            ? '1px solid rgba(139, 92, 246, 0.4)'
                            : '1px solid rgba(59, 130, 246, 0.35)',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '800'
                      }}>
                        {clip.unitLabel || `Bölüm ${clip.episodeNo}`}
                      </span>
                    )}

                    {clip.partNo !== null && clip.partNo !== undefined && (
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.18)',
                        color: '#d97706',
                        border: '1px solid rgba(245, 158, 11, 0.45)',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Layers size={12} />
                        <span>PART {clip.partNo}</span>
                      </span>
                    )}

                    {clip.programTitle && (
                      <span style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700'
                      }}>
                        {clip.programTitle}
                      </span>
                    )}

                    {/* Veritabanından Gelen Metadata Özeti (Bölüm Adı, Sunucu, Konuk, Yayın Tarihi) */}
                    {clip.note && clip.note.toLowerCase() !== (clip.name || '').toLowerCase() && (
                      <span style={{
                        background: 'rgba(139, 92, 246, 0.14)',
                        color: '#7c3aed',
                        border: '1px solid rgba(139, 92, 246, 0.32)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        maxWidth: '240px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} title={`Bölüm Adı / Not: ${clip.note}`}>
                        {clip.note}
                      </span>
                    )}
                    {clip.metadataSummary?.sunucu && (
                      <span style={{
                        background: 'rgba(14, 165, 233, 0.14)',
                        color: '#0369a1',
                        border: '1px solid rgba(14, 165, 233, 0.3)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700'
                      }} title={`Sunucu: ${clip.metadataSummary.sunucu}`}>
                        🎤 {clip.metadataSummary.sunucu}
                      </span>
                    )}
                    {clip.metadataSummary?.konuk && (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#047857',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700'
                      }} title={`Konuk: ${clip.metadataSummary.konuk}`}>
                        👤 {clip.metadataSummary.konuk}
                      </span>
                    )}
                    {clip.metadataSummary?.yayinTarihi && (
                      <span style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: '700'
                      }} title={`Yayın Tarihi: ${clip.metadataSummary.yayinTarihi}`}>
                        📅 {clip.metadataSummary.yayinTarihi}
                      </span>
                    )}
                  </div>

                  {/* Süre & Ekle Butonu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginLeft: 'auto', flexShrink: 0 }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: '800',
                      fontSize: '12px',
                      color: '#059669',
                      background: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {dur}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddClip(clip)}
                      title="Akışa Ekle"
                      style={{
                        padding: '5px 11px',
                        borderRadius: '7px',
                        background: '#0d9488',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: '800'
                      }}
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>Ekle</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Klip Detay, Metadata ve Video İzleme Modalı */}
      {viewingClip && (
        <ClipDetailMetadataModal
          isOpen={!!viewingClip}
          onClose={() => setViewingClip(null)}
          clip={viewingClip}
          program={{ title: viewingClip.programTitle || 'Programlar' }}
        />
      )}
    </div>
  );
}
