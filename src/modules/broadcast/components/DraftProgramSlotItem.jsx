/**
 * @file src/modules/broadcast/components/DraftProgramSlotItem.jsx
 * @description Taslak akışındaki bir program kuşağını, sol zaman bloğunu (Başlangıç - Bitiş ve dakika süresi)
 * ve altındaki gerçek MAM kliplerini gösteren, önbellekli (cached) ve modüler yan panel kuşak bileşeni.
 */
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Film, Plus, ChevronDown, ChevronRight, GripVertical,
  Loader2, CheckCircle2, AlertCircle, Crosshair, Search, X, RefreshCw
} from 'lucide-react';
import { secondsToTimecode } from '../utils/timecodeUtils';
import {
  normalizeProgramText,
  extractClipMeta,
  findMatchingAdminPrograms,
  computeDraftEndTime,
  isDraftSlotAddedToRundown,
  getDraftSlotUpdateStatus,
  sortSlotClips,
  fetchProgramClipsCached,
  resolveDraftSlotTarget,
  deduplicateEpisodeClipsNewest,
  formatClipDurationReadable
} from '../utils/draftSlotMatcher';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import DraftSlotClipCard from './sidebar/DraftSlotClipCard';
import ClipDetailMetadataModal from '../../../pages/admin/archive/ClipDetailMetadataModal';

export {
  normalizeProgramText,
  extractClipMeta,
  findMatchingAdminPrograms,
  isDraftSlotAddedToRundown
};

const DraftProgramSlotItem = memo(function DraftProgramSlotItem({
  draftItem,
  index = 0,
  usedPrograms = [],
  allDraftPrograms = [],
  onAddProgram,
  onAddClip,
  onAddAllClips,
  onUpdateProgramInRundown,
  currentRundownPrograms = [],
  selectedDate = '',
  isSelectedFromRundown = false,
  selectedRundownItem = null,
  slotRef = null
}) {
  // Klipler varsayılan olarak kapalı (false) gelir; kullanıcı tıkladığında açılır
  const [isExpanded, setIsExpanded] = useState(false);
  const [clips, setClips] = useState([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [clipSearchTerm, setClipSearchTerm] = useState('');
  // Varsayılan olarak tüm klipler aynı anda açılmaz; sadece seçili bölümün (veya taslak bölümünün) klipleri gösterilir
  const [selectedEpisode, setSelectedEpisode] = useState('auto'); // 'auto' | 'all' | number
  const [viewingClip, setViewingClip] = useState(null);

  const resolvedTarget = useMemo(() => {
    return resolveDraftSlotTarget(draftItem, draftItem.dateStr || '');
  }, [draftItem]);

  const targetEpisodeNum = resolvedTarget.targetNo;

  const matchedAdminPrograms = useMemo(() => {
    return findMatchingAdminPrograms(draftItem, usedPrograms);
  }, [draftItem, usedPrograms]);

  const slotUnitType = useMemo(() => {
    if (resolvedTarget.unitType) return resolvedTarget.unitType;
    const progUnit = matchedAdminPrograms[0]?.unitType;
    if (progUnit) return progUnit;
    const clipUnit = clips.find(c => c.unitType)?.unitType;
    return clipUnit || 'bolum';
  }, [resolvedTarget.unitType, matchedAdminPrograms, clips]);

  const formatSlotUnitText = useCallback((num) => {
    if (!num) return '';
    if (slotUnitType === 'cuz') return `${num}. Cüz`;
    if (slotUnitType === 'gun') {
      const days = ['', 'Pazartesi Günü', 'Salı Günü', 'Çarşamba Günü', 'Perşembe Günü', 'Cuma Günü', 'Cumartesi Günü', 'Pazar Günü'];
      return days[Number(num)] || `${num}. Gün`;
    }
    return `Bölüm ${num}`;
  }, [slotUnitType]);

  // Yalnızca Admin Panel -> Programlar (aktif programlar) listesindeki eşleşen programların kliplerini getirir
  useEffect(() => {
    let isMounted = true;
    const fetchProgramClips = async () => {
      if (matchedAdminPrograms.length === 0) {
        if (isMounted) setClips([]);
        return;
      }
      setLoadingClips(true);
      try {
        let fetchedClips = [];
        const targetProgs = matchedAdminPrograms.slice(0, 5);
        const responses = await Promise.all(
          targetProgs.map(p => fetchProgramClipsCached(p.id).catch(() => []))
        );
        responses.forEach(list => {
          if (Array.isArray(list)) {
            fetchedClips.push(...list);
          }
        });

        if (isMounted) {
          setClips(sortSlotClips(fetchedClips, targetEpisodeNum));
        }
      } catch (e) {
        console.error('Klip getirme hatası:', e);
      } finally {
        if (isMounted) {
          setLoadingClips(false);
        }
      }
    };

    fetchProgramClips();
    return () => { isMounted = false; };
  }, [targetEpisodeNum, matchedAdminPrograms]);

  // Programdaki mevcut tüm Bölüm / Cüz / Gün numaralarının sıralı listesi (En yeni / en büyük bölümler üstte)
  const availableEpisodes = useMemo(() => {
    const epSet = new Set();
    clips.forEach(c => {
      if (c.episodeNo !== null && c.episodeNo !== undefined) {
        epSet.add(Number(c.episodeNo));
      }
    });
    return Array.from(epSet).sort((a, b) => b - a);
  }, [clips]);

  // Etkin Bölüm Filtresi: 'auto' iken öncelikle taslaktaki bölümü, yoksa EN SON EKLENEN (en yeni) bölümü seçer
  const effectiveEpisodeFilter = useMemo(() => {
    if (selectedEpisode !== 'auto') return selectedEpisode;
    if (targetEpisodeNum !== null && availableEpisodes.includes(targetEpisodeNum)) {
      return targetEpisodeNum;
    }
    if (availableEpisodes.length > 0) {
      return availableEpisodes[0];
    }
    return 'all';
  }, [selectedEpisode, targetEpisodeNum, availableEpisodes]);

  const filteredClips = useMemo(() => {
    let list = clips;

    // Arama kutusu doluysa öncelik algoritmasıyla (başlayan -> kelime başlangıcı -> içeren) ara
    if (clipSearchTerm.trim()) {
      return filterAndSortBySearchPriority(
        list,
        clipSearchTerm,
        (c) => c.name || c.fileName || '',
        (c) => [
          c.note,
          c.unitLabel,
          c.episodeNo !== null ? `Bölüm ${c.episodeNo} Cüz ${c.episodeNo}` : '',
          c.partNo !== null ? `Part ${c.partNo}` : '',
          c.fileId
        ]
      );
    } else if (effectiveEpisodeFilter !== 'all' && typeof effectiveEpisodeFilter === 'number') {
      list = list.filter(c => Number(c.episodeNo) === effectiveEpisodeFilter);
    }

    return list;
  }, [clips, effectiveEpisodeFilter, clipSearchTerm]);

  // Seçili bölüme ait en son eklenen (mükerrerlerden arındırılmış) part'lar ve toplam bölüm süresi
  const activeEpisodeParts = useMemo(() => {
    if (clipSearchTerm.trim() || effectiveEpisodeFilter === 'all') {
      return filteredClips;
    }
    return deduplicateEpisodeClipsNewest(filteredClips, draftItem?.title || '');
  }, [filteredClips, clipSearchTerm, effectiveEpisodeFilter, draftItem?.title]);

  const activeEpisodeTotalSec = useMemo(() => {
    return activeEpisodeParts.reduce((acc, c) => acc + (Number(c.durationSec) || 0), 0);
  }, [activeEpisodeParts]);

  const handleDragStartProgram = useCallback((e) => {
    const durTc = draftItem.durationFormatted || secondsToTimecode((draftItem.duration || 30) * 60);
    const itemData = {
      title: draftItem.title,
      name: draftItem.name || draftItem.title,
      draftId: draftItem.id,
      draftStartTime: draftItem.startTime || null,
      durationTc: durTc,
      durationSec: draftItem.durationSec || ((draftItem.duration || 30) * 60),
      category: draftItem.category || 'Genel',
      categoryColor: draftItem.categoryColor || '#3b82f6',
      episodeNo: draftItem.episode || null,
      partNo: draftItem.part || null,
      note: draftItem.note || 'Taslaktan Eklendi',
      isFromDraft: true,
      type: 'program'
    };
    e.dataTransfer.setData('application/json', JSON.stringify({ item: itemData, source: 'draft_program' }));
    e.dataTransfer.effectAllowed = 'copyMove';
  }, [draftItem]);

  const handleDragStartClip = useCallback((e, clip) => {
    e.stopPropagation();
    const durTc = secondsToTimecode(clip.durationSec || 60);
    const itemData = {
      title: clip.name || clip.fileName || 'Klip',
      name: clip.name || clip.fileName || 'Klip',
      clipName: clip.name || clip.fileName,
      fileId: clip.fileId,
      draftId: draftItem.id,
      draftStartTime: draftItem.startTime || null,
      durationTc: durTc,
      durationSec: clip.durationSec || 60,
      category: clip.categoryName || draftItem.category || 'Genel',
      categoryColor: clip.categoryColor || draftItem.categoryColor || '#14b8a6',
      episodeNo: clip.episodeNo ?? draftItem.episode ?? null,
      partNo: clip.partNo || null,
      unitType: clip.unitType || 'bolum',
      unitLabel: clip.unitLabel || null,
      note: clip.note || `Klip: ${draftItem.title}`,
      isFromDraft: true,
      type: 'clip'
    };
    e.dataTransfer.setData('application/json', JSON.stringify({ item: itemData, source: 'draft_clip' }));
    e.dataTransfer.effectAllowed = 'copyMove';
  }, [draftItem]);

  const programAdded = isDraftSlotAddedToRundown(draftItem, currentRundownPrograms, allDraftPrograms);
  const updateStatus = useMemo(() => {
    return getDraftSlotUpdateStatus(draftItem, currentRundownPrograms, selectedDate || draftItem.dateStr || '');
  }, [draftItem, currentRundownPrograms, selectedDate]);

  const addedAsNotFound = useMemo(() => {
    if (!currentRundownPrograms || currentRundownPrograms.length === 0) return false;
    return currentRundownPrograms.some(
      rp => rp.isNotFound && rp.draftId && draftItem.id && String(rp.draftId) === String(draftItem.id)
    );
  }, [currentRundownPrograms, draftItem.id]);

  const isClipInThisSlot = useCallback((clip) => {
    if (!currentRundownPrograms || currentRundownPrograms.length === 0) return false;
    return currentRundownPrograms.some(rp => {
      const sameClip =
        (clip.fileId && rp.fileId === clip.fileId) ||
        (clip.name && (rp.clipName === clip.name || rp.name === clip.name || rp.title === clip.name));
      if (!sameClip) return false;
      if (rp.draftId && draftItem.id) {
        return String(rp.draftId) === String(draftItem.id);
      }
      return programAdded;
    });
  }, [currentRundownPrograms, draftItem.id, programAdded]);

  const isUpdatedInDraft = useMemo(() => {
    if (!updateStatus?.isUpdatedInDraft) return false;
    if (!updateStatus.titleChanged && activeEpisodeParts.length > 0 && activeEpisodeParts.some(c => isClipInThisSlot(c))) {
      return false;
    }
    return true;
  }, [updateStatus, activeEpisodeParts, isClipInThisSlot]);

  const getClipOtherSlotUsage = useCallback((clip) => {
    if (!currentRundownPrograms || currentRundownPrograms.length === 0) return null;
    return currentRundownPrograms.find(rp => {
      const sameClip =
        (clip.fileId && rp.fileId === clip.fileId) ||
        (clip.name && (rp.clipName === clip.name || rp.name === clip.name || rp.title === clip.name));
      if (!sameClip) return false;
      return rp.draftId && draftItem.id && String(rp.draftId) !== String(draftItem.id);
    });
  }, [currentRundownPrograms, draftItem.id]);

  const durationMin = parseInt(draftItem.duration, 10) || 30;
  const startTimeStr = draftItem.startTime || '00:00';
  const endTimeStr = computeDraftEndTime(startTimeStr, durationMin, draftItem.endTime);
  const isLiveSlot = Boolean(
    draftItem.isLive ||
    (Array.isArray(draftItem.selectedOptions) && draftItem.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
    /\bcanl[ıi]\b/i.test(`${draftItem.rawTitle || ''} ${draftItem.title || ''} ${draftItem.host || ''}`)
  );
  const isFillerSlot = Boolean(
    draftItem.isKisaSlot ||
    normalizeProgramText(draftItem.title || draftItem.name || '').includes('dolgu kusagi')
  );
  const accentColor = isSelectedFromRundown
    ? '#2563eb'
    : isUpdatedInDraft
    ? '#d97706'
    : programAdded
    ? '#10b981'
    : '#ef4444';
  const totalClipCountDisplay = clips.length > 0
    ? clips.length
    : matchedAdminPrograms.reduce((acc, p) => acc + (p.totalClips || 0), 0);

  return (
    <div
      ref={slotRef}
      style={{
        background: isSelectedFromRundown
          ? 'rgba(37, 99, 235, 0.12)'
          : isUpdatedInDraft
          ? 'rgba(245, 158, 11, 0.1)'
          : programAdded
          ? 'rgba(16, 185, 129, 0.08)'
          : 'rgba(239, 68, 68, 0.05)',
        border: isSelectedFromRundown
          ? '2px solid #3b82f6'
          : isUpdatedInDraft
          ? '1.5px solid rgba(245, 158, 11, 0.65)'
          : programAdded
          ? '1.5px solid rgba(16, 185, 129, 0.55)'
          : '1.5px dashed rgba(239, 68, 68, 0.5)',
        borderLeft: `6px solid ${accentColor}`,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: isSelectedFromRundown
          ? '0 0 0 3px rgba(59, 130, 246, 0.28), 0 8px 20px rgba(37, 99, 235, 0.2)'
          : programAdded
          ? '0 4px 14px rgba(16, 185, 129, 0.14)'
          : '0 2px 8px rgba(0, 0, 0, 0.06)',
        flexShrink: 0,
        transition: 'all 0.2s ease'
      }}
    >
      {/* SEÇİLİ KLİP BU TASLAK KUŞAĞINDA İSE ÜST VURGU ŞERİDİ */}
      {isSelectedFromRundown && (
        <div
          style={{
            background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)',
            color: '#ffffff',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <Crosshair size={13} />
            <span style={{ whiteSpace: 'nowrap' }}>SEÇİLİ KLİP TASLAK YERİ:</span>
            <span
              style={{
                fontFamily: 'monospace',
                opacity: 0.95,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {selectedRundownItem?.clipName || selectedRundownItem?.title || ''}
            </span>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              background: 'rgba(255,255,255,0.2)',
              padding: '1px 6px',
              borderRadius: '4px',
              flexShrink: 0
            }}
          >
            {startTimeStr} - {endTimeStr}
          </span>
        </div>
      )}
      {/* Kuşak Ana Kartı: Sol Saat Bloğu + Sağ Program Bilgileri */}
      <div
        draggable
        onDragStart={handleDragStartProgram}
        style={{
          display: 'flex',
          alignItems: 'stretch',
          cursor: 'grab'
        }}
      >
        {/* SOL ZAMAN BLOĞU */}
        <div style={{
          width: '78px',
          minWidth: '78px',
          background: programAdded ? 'rgba(16, 185, 129, 0.1)' : `${accentColor}12`,
          borderRight: '1px solid var(--border-color)',
          padding: '10px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          flexShrink: 0
        }}>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: '900',
            color: programAdded ? '#059669' : accentColor,
            lineHeight: 1.15,
            letterSpacing: '0.2px'
          }} title="Kuşak Başlangıç Saati">
            {startTimeStr}
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: '900',
            color: 'var(--text-primary)',
            lineHeight: 1.15,
            letterSpacing: '0.2px',
            borderTop: '1px dashed var(--border-color)',
            paddingTop: '3px'
          }} title="Kuşak Bitiş Saati">
            {endTimeStr}
          </div>
          <span style={{
            marginTop: '3px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            padding: '2px 7px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '800',
            whiteSpace: 'nowrap'
          }}>
            {durationMin} dk
          </span>
        </div>

        {/* SAĞ PROGRAM İÇERİĞİ */}
        <div style={{
          flex: 1,
          minWidth: 0,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              flex: '1 1 165px',
              minWidth: '155px'
            }}>
              <GripVertical size={15} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: '3px', opacity: 0.7 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '14.5px',
                    fontWeight: '800',
                    color: isLiveSlot ? '#dc2626' : 'var(--text-primary)',
                    lineHeight: '1.35',
                    wordBreak: 'normal',
                    overflowWrap: 'break-word'
                  }} title={draftItem.title}>
                    {draftItem.title}
                  </h4>
                  {isLiveSlot && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      fontWeight: '900',
                      background: '#ef4444',
                      color: '#ffffff',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      letterSpacing: '0.3px',
                      boxShadow: '0 2px 5px rgba(239, 68, 68, 0.35)',
                      whiteSpace: 'nowrap'
                    }}>
                      ● CANLI YAYIN
                    </span>
                  )}
                </div>
                {(draftItem.host || draftItem.topic) && (
                  <div style={{
                    fontSize: '11.5px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.3,
                    fontWeight: '600',
                    wordBreak: 'normal',
                    overflowWrap: 'break-word'
                  }}>
                    {draftItem.host && <span style={{ color: isLiveSlot ? '#b91c1c' : 'var(--text-primary)', fontWeight: '700' }}>{draftItem.host}</span>}
                    {draftItem.host && draftItem.topic && ' • '}
                    {draftItem.topic}
                  </div>
                )}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              marginLeft: 'auto'
            }}>
              {isUpdatedInDraft ? (
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.18)',
                    color: '#d97706',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Taslak Planlamada bu kuşağın bölümü veya programı değiştirildi. Güncelle butonuna tıklayarak İntro ve yeni klipleriyle akışa uygulayabilirsiniz."
                >
                  <RefreshCw size={12} />
                  <span>Güncellendi</span>
                </span>
              ) : addedAsNotFound ? (
                <span
                  style={{
                    background: 'rgba(234, 88, 12, 0.16)',
                    color: '#ea580c',
                    border: '1px solid rgba(234, 88, 12, 0.45)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Program listede korundu ancak arşivde eşleşen klip bulunamadı"
                >
                  <AlertCircle size={12} />
                  <span>Bulunamadı</span>
                </span>
              ) : programAdded ? (
                <span style={{
                  background: '#10b981',
                  color: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                }}>
                  <CheckCircle2 size={12} />
                  <span>Eklendi</span>
                </span>
              ) : (
                <span style={{
                  background: 'rgba(239, 68, 68, 0.16)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  <AlertCircle size={12} />
                  <span>Eklenmedi</span>
                </span>
              )}

              {isUpdatedInDraft && onUpdateProgramInRundown ? (
                <button
                  type="button"
                  onClick={() => onUpdateProgramInRundown(draftItem, activeEpisodeParts)}
                  title="Bu kuşağı İntro + güncel bölüm klipleriyle akıştaki yerinde güncelle (Reklam ve Dolgu kuşaklarınız korunur)"
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
                  }}
                >
                  <RefreshCw size={12} strokeWidth={2.5} />
                  <span>Güncelle</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!isLiveSlot && !isFillerSlot && activeEpisodeParts.length > 0 && onAddAllClips) {
                      onAddAllClips(activeEpisodeParts, draftItem);
                    } else {
                      onAddProgram(draftItem);
                    }
                  }}
                  title={programAdded ? 'Bu program zaten akışta yer alıyor. Tekrar (İntro + Klipleriyle) eklemek için tıklayın.' : (isLiveSlot ? 'Canlı Yayını Akışa Ekle' : 'Kuşağı (İntro + Klipleriyle) Yayına Ekle')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    background: programAdded ? 'rgba(16, 185, 129, 0.15)' : isLiveSlot ? '#ef4444' : 'var(--accent-primary)',
                    border: programAdded ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
                    color: programAdded ? '#10b981' : '#ffffff',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    boxShadow: programAdded ? 'none' : isLiveSlot ? '0 2px 6px rgba(239, 68, 68, 0.3)' : '0 2px 6px rgba(59, 130, 246, 0.25)'
                  }}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>{isLiveSlot ? 'Canlı Ekle' : 'Yayına Ekle'}</span>
                </button>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            borderTop: '1px dashed var(--border-color)',
            paddingTop: '8px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{
                background: `${draftItem.categoryColor || '#3b82f6'}18`,
                color: draftItem.categoryColor || '#3b82f6',
                border: `1px solid ${draftItem.categoryColor || '#3b82f6'}38`,
                padding: '3px 9px',
                borderRadius: '6px',
                fontWeight: '800',
                fontSize: '12px'
              }}>
                {draftItem.category || 'Genel'}
              </span>

              {draftItem.episode && (
                <span style={{
                  background: slotUnitType === 'cuz'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : slotUnitType === 'gun'
                      ? 'rgba(139, 92, 246, 0.15)'
                      : 'rgba(59, 130, 246, 0.14)',
                  color: slotUnitType === 'cuz'
                    ? '#10b981'
                    : slotUnitType === 'gun'
                      ? '#8b5cf6'
                      : 'var(--accent-primary)',
                  border: slotUnitType === 'cuz'
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : slotUnitType === 'gun'
                      ? '1px solid rgba(139, 92, 246, 0.35)'
                      : '1px solid rgba(59, 130, 246, 0.32)',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  fontWeight: '800',
                  fontSize: '12px'
                }}>
                  {formatSlotUnitText(draftItem.episode)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              style={{
                background: isExpanded ? '#0d9488' : 'rgba(13, 148, 136, 0.14)',
                border: '1px solid rgba(13, 148, 136, 0.4)',
                color: isExpanded ? '#ffffff' : '#0d9488',
                padding: '5px 11px',
                borderRadius: '7px',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                transition: 'all 0.15s'
              }}
              title={isExpanded ? 'Klipleri Gizle' : 'Programlar Kategorisindeki Klipleri Göster'}
            >
              {loadingClips ? (
                <Loader2 size={14} className="animate-spin" />
              ) : isExpanded ? (
                <ChevronDown size={15} />
              ) : (
                <ChevronRight size={15} />
              )}
              <span>Klipler ({totalClipCountDisplay})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Programın Klipleri (Sadece Seçili Bölüm Öncelikli + Bölüm Seçici + Canlı Arama) */}
      {isExpanded && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderTop: '1.5px solid var(--border-color)',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            flexWrap: 'wrap'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: 'var(--text-primary)', flexWrap: 'wrap' }}>
              <Film size={15} color="#0d9488" />
              <span>
                {clipSearchTerm.trim()
                  ? `Arama Sonucu (${filteredClips.length} / ${clips.length} Klip)`
                  : effectiveEpisodeFilter !== 'all'
                    ? `${formatSlotUnitText(effectiveEpisodeFilter)} (${activeEpisodeParts.length > 1 ? `${activeEpisodeParts.length} Part • ` : ''}Toplam: ${formatClipDurationReadable(activeEpisodeTotalSec)})`
                    : `Tüm Klipler (${filteredClips.length})`}
              </span>
            </span>

            {activeEpisodeParts.length > 0 && (
              <button
                type="button"
                onClick={() => onAddAllClips(activeEpisodeParts, draftItem)}
                style={{
                  background: 'rgba(13, 148, 136, 0.14)',
                  border: '1px solid rgba(13, 148, 136, 0.4)',
                  borderRadius: '7px',
                  padding: '4px 10px',
                  color: '#0d9488',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '800'
                }}
                title="Bu bölümün en son eklenen kliplerini/partlarını sırayla yayına ekle"
              >
                + Bu Bölümü Yayına Ekle ({activeEpisodeParts.length} Parça • {formatClipDurationReadable(activeEpisodeTotalSec)})
              </button>
            )}
          </div>

          {clips.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Bölüm / Cüz / Gün Seçici (Tüm kliplerin aynı anda açılmasını önler, bölüm odaklı gösterir) */}
              {availableEpisodes.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {slotUnitType === 'cuz' ? 'Cüz Seç:' : slotUnitType === 'gun' ? 'Gün Seç:' : 'Bölüm Seç:'}
                  </span>

                  <select
                    value={effectiveEpisodeFilter === 'all' ? 'all' : String(effectiveEpisodeFilter)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedEpisode(val === 'all' ? 'all' : parseInt(val, 10));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      border: '1.5px solid var(--accent-primary)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {availableEpisodes.map(epNum => {
                      const epCount = clips.filter(c => Number(c.episodeNo) === epNum).length;
                      const isTarget = targetEpisodeNum === epNum;
                      return (
                        <option key={epNum} value={String(epNum)}>
                          {formatSlotUnitText(epNum)} ({epCount} Klip){isTarget ? ' • Taslak Bölümü' : ''}
                        </option>
                      );
                    })}
                    <option value="all">Tüm Klipleri Göster ({clips.length} Klip)</option>
                  </select>

                  {effectiveEpisodeFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEpisode('all');
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      title="Tüm bölümlerin kliplerini listele"
                    >
                      Tümünü Gör ({clips.length})
                    </button>
                  )}
                  {effectiveEpisodeFilter === 'all' && availableEpisodes.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEpisode(targetEpisodeNum && availableEpisodes.includes(targetEpisodeNum) ? targetEpisodeNum : availableEpisodes[0]);
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--accent-primary)',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--accent-primary)',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Sadece Bölümü Göster
                    </button>
                  )}
                </div>
              )}

              {/* Arama Kutusu */}
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Search size={15} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={clipSearchTerm}
                  onChange={(e) => setClipSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Bu programın tüm kliplerinde bölüm, part veya konu ara..."
                  style={{
                    width: '100%',
                    padding: '8px 30px 8px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: '600',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {clipSearchTerm && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClipSearchTerm('');
                    }}
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
                    title="Aramayı Temizle"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {loadingClips ? (
            <div style={{
              padding: '16px 10px',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <Loader2 size={16} className="animate-spin" color="#0d9488" />
              <span>Programlar kategorisinden klipler yükleniyor...</span>
            </div>
          ) : filteredClips.length === 0 ? (
            <div style={{
              padding: '14px 10px',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>
              {clips.length === 0
                ? 'Bu program için Programlar kategorisinde aktif klip bulunamadı.'
                : 'Arama kriterine uygun klip bulunamadı.'}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '420px',
              overflowY: 'auto',
              paddingRight: '3px'
            }}>
              {filteredClips.map((clip, cIdx) => {
                const isAdded = isClipInThisSlot(clip);
                const otherSlotUsage = !isAdded ? getClipOtherSlotUsage(clip) : null;
                const isSelectedClip = Boolean(
                  selectedRundownItem &&
                    ((clip.fileId && Number(selectedRundownItem.fileId) === Number(clip.fileId)) ||
                      (clip.name &&
                        (selectedRundownItem.clipName === clip.name ||
                          selectedRundownItem.title === clip.name ||
                          selectedRundownItem.name === clip.name)))
                );

                return (
                  <DraftSlotClipCard
                    key={clip.fileId || cIdx}
                    clip={clip}
                    cIdx={cIdx}
                    draftItem={draftItem}
                    targetEpisodeNum={targetEpisodeNum}
                    isAdded={isAdded}
                    isSelectedClip={isSelectedClip}
                    otherSlotUsage={otherSlotUsage}
                    onDragStartClip={handleDragStartClip}
                    onAddClip={onAddClip}
                    onViewClipInfo={setViewingClip}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Klip Detay, Metadata ve Video İzleme Modalı */}
      {viewingClip && (
        <ClipDetailMetadataModal
          isOpen={!!viewingClip}
          onClose={() => setViewingClip(null)}
          clip={viewingClip}
          program={{ title: draftItem.title }}
        />
      )}
    </div>
  );
});

export default DraftProgramSlotItem;
