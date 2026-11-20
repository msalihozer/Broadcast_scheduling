/**
 * @file src/modules/broadcast/hooks/useSmartDraftApplier.js
 * @description "⚡ Taslak Uygula" butonuna tıklandığında çalışan Akıllı Taslak Uygulama özel kancası (Custom Hook).
 * Tüm onay, başarı, eksik kuşak uyarısı ve hata mesajlarını `dialog` (merkezi pop-up) üzerinden türe göre renkli gösterir.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { dialog } from '../../../store/dialogStore';
import useBroadcastStore from '../store/broadcastStore';
import {
  getDraftProgramsForDay,
  fetchAndSyncDraftSchedule
} from '../utils/draftDataLoader';
import {
  normalizeProgramText,
  findMatchingAdminPrograms,
  fetchProgramClipsCached,
  fetchIntroClipForBroadcast,
  resolveDraftSlotTarget,
  selectSmartClipsForDraftSlot,
  isDraftSlotAddedToRundown,
  getDraftSlotUpdateStatus,
  doesDraftSlotMatchRundownItem,
  clearBroadcastArchiveCaches
} from '../utils/draftSlotMatcher';
import {
  BROADCAST_FPS,
  timecodeToFrames,
  secondsToTimecode
} from '../utils/timecodeUtils';

export default function useSmartDraftApplier({
  draftSlotsForToday = [],
  programsCount = 0,
  selectedChannel,
  selectedDate,
  activeList,
  setDayPrograms,
  onSyncBanner = null
}) {
  const [isApplyingDraft, setIsApplyingDraft] = useState(false);
  const [isSyncingDraftAndArchive, setIsSyncingDraftAndArchive] = useState(false);
  const syncInFlightRef = useRef(false);

  const handleApplySmartDraft = useCallback(async () => {
    if (!draftSlotsForToday || draftSlotsForToday.length === 0) {
      await dialog.warning(
        'Taslak Akışı Bulunamadı',
        `${selectedDate} tarihi için Taslak Planlama modülünde kayıtlı bir taslak akışı bulunamadı.\n* Bilgi: Sol panelden taslağı hazır olan bir güne geçebilir veya Taslak Planlama modülünden akış oluşturabilirsiniz.`
      );
      return;
    }

    if (programsCount > 0) {
      const ok = await dialog.confirm(
        'Taslak Uygulama Onayı',
        `Mevcut listede ${programsCount} öğe bulunuyor.\nTaslak Kuşak Sayısı: ${draftSlotsForToday.length} Kuşak\nHedef Liste: Liste ${activeList} (${selectedDate})\n* Not: "Taslak Uygula" işlemi taslaktaki programların kliplerini, tüm partlarını, İntroları ve Dolgu Kuşaklarını listeye yerleştirecektir.`,
        {
          confirmText: 'Evet, Taslağı Uygula',
          cancelText: 'Vazgeç'
        }
      );
      if (!ok) return;
    }

    setIsApplyingDraft(true);

    try {
      clearBroadcastArchiveCaches();
      await fetchAndSyncDraftSchedule(selectedChannel);
      const progRes = await fetch('/api/archive/used-programs');
      const progJson = progRes.ok ? await progRes.json() : null;
      const usedPrograms = Array.isArray(progJson)
        ? progJson
        : (Array.isArray(progJson?.programs) ? progJson.programs : []);

      // Varsayılan İntro Ayarlarını Store'dan oku (Otomatik İntro Açık/Kapalı ve Seçili İntro Klibi)
      const introSettings = useBroadcastStore.getState().introDefaultSettings || {
        autoInsertIntro: true,
        fileId: 725,
        name: 'SEMERKAND_intro_v3_2014',
        durationSec: 26,
        durationTc: '00.00.26.00',
        category: 'Jenerik / İntro'
      };
      const shouldInsertIntros = introSettings.autoInsertIntro !== false;

      // Eğer kullanıcı özel bir intro seçtiyse onu kullan, yoksa arşivdeki varsayılan introyu çek
      let introClip = null;
      if (shouldInsertIntros) {
        if (introSettings.name && introSettings.fileId) {
          introClip = {
            fileId: introSettings.fileId,
            name: introSettings.name,
            durationSec: introSettings.durationSec || 26,
            durationFormatted: introSettings.durationTc || secondsToTimecode(introSettings.durationSec || 26)
          };
        } else {
          introClip = await fetchIntroClipForBroadcast(usedPrograms);
        }
      }

      const createIntroItem = (slot, idx) => {
        const introSec = introClip?.durationSec || 26;
        const introTc = introClip?.durationFormatted || secondsToTimecode(introSec);
        const introFrames = timecodeToFrames(introTc);
        const introName = introClip?.name || 'SEMERKAND_intro_v3_2014';
        return {
          id: `intro_${introClip?.fileId || 725}_${Date.now()}_${idx}`,
          instanceId: `inst_intro_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
          draftId: slot.id || null,
          draftStartTime: slot.startTime || null,
          type: 'clip',
          isIntroClip: true,
          title: introName,
          name: introName,
          clipName: introName,
          fileId: introClip?.fileId || 725,
          durationTc: introTc,
          durationFrames: introFrames,
          durationSec: Math.floor(introFrames / BROADCAST_FPS),
          category: 'Jenerik / İntro',
          categoryColor: '#6366f1',
          episodeNo: null,
          partNo: null,
          unitType: 'intro',
          unitLabel: 'İntro',
          note: `İntro • ${slot.title || slot.name || ''}`,
          isFromDraft: true,
          addedAt: Date.now()
        };
      };

      const existingPrograms = [
        ...(useBroadcastStore.getState().getRawDayPrograms(selectedChannel, selectedDate, activeList) || [])
      ];

      // Mevcut listede kullanıcının doldurduğu Dolgu Kuşağı kliplerini (isFillerClip) grupla ki Taslak Uygula dediğinde silinmesin
      const existingFilledFillerGroups = [];
      const fillerGroupMap = new Map();
      existingPrograms.forEach((p, idx) => {
        const isFillerClipItem = Boolean(
          p.isFillerClip ||
          (p.type !== 'filler_slot' &&
            (p.category === 'Dolgu Kuşağı' || (p.note && String(p.note).startsWith('Dolgu Kuşağı'))))
        );
        if (!isFillerClipItem) return;
        const gKey = p.fillerGroupId || (p.draftId ? `draft_${p.draftId}` : `fclip_${idx}`);
        if (!fillerGroupMap.has(gKey)) {
          const groupObj = {
            groupKey: gKey,
            draftId: p.draftId || null,
            draftStartTime: p.draftStartTime || null,
            used: false,
            items: [p]
          };
          fillerGroupMap.set(gKey, groupObj);
          existingFilledFillerGroups.push(groupObj);
        } else {
          fillerGroupMap.get(gKey).items.push(p);
        }
      });

      // Mevcut listede kullanıcının eklediği Reklam Kuşaklarını (ad_break) kendinden önceki program/kuşak bilgisiyle kaydet
      const existingAdBreaksWithAnchors = [];
      existingPrograms.forEach((p, idx) => {
        if (p.type !== 'ad_break') return;
        let prevAnchor = null;
        for (let backIdx = idx - 1; backIdx >= 0; backIdx--) {
          const prevItem = existingPrograms[backIdx];
          if (prevItem && prevItem.type !== 'ad_break') {
            prevAnchor = {
              draftId: prevItem.draftId || null,
              draftStartTime: prevItem.draftStartTime || null,
              title: prevItem.title || prevItem.name || '',
              partNo: prevItem.partNo || null,
              isFillerClip: Boolean(prevItem.isFillerClip)
            };
            break;
          }
        }
        existingAdBreaksWithAnchors.push({
          adItem: { ...p },
          prevAnchor,
          relativeRatio: existingPrograms.length > 0 ? idx / existingPrograms.length : 1
        });
      });

      const newRundownItems = [];
      const unaddedList = [];
      let addedClipsCount = 0;
      let addedIntroCount = 0;
      let addedLiveCount = 0;
      let addedFillerCount = 0;
      let fillerSlotCounter = 0;

      for (let idx = 0; idx < draftSlotsForToday.length; idx++) {
        const slot = draftSlotsForToday[idx];
        const rawTitle = slot.title || slot.name || 'İsimsiz Kuşak';
        const normTitle = normalizeProgramText(rawTitle);

        const isFillerSlot = Boolean(
          slot.isKisaSlot ||
          normTitle.includes('dolgu kusagi') ||
          normTitle === 'dolgu'
        );

        const isLiveSlot = Boolean(
          slot.isLive ||
          (Array.isArray(slot.selectedOptions) && slot.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
          /\bcanl[ıi]\b/i.test(`${slot.rawTitle || ''} ${rawTitle} ${slot.host || ''}`)
        );

        // 1. Dolgu Kuşağı ise: Eğer kullanıcı bu Dolgu Kuşağını zaten kliplerle doldurduysa (isFillerClip), doldurduğu klipleri koru!
        if (isFillerSlot) {
          const currentFillerOrder = fillerSlotCounter;
          fillerSlotCounter++;

          const matchedFilledGroup =
            existingFilledFillerGroups.find(
              g => !g.used && g.draftId && slot.id && String(g.draftId) === String(slot.id)
            ) ||
            existingFilledFillerGroups.find(
              g => !g.used && g.draftStartTime && slot.startTime && g.draftStartTime === slot.startTime
            ) ||
            (existingFilledFillerGroups[currentFillerOrder] && !existingFilledFillerGroups[currentFillerOrder].used
              ? existingFilledFillerGroups[currentFillerOrder]
              : null);

          if (matchedFilledGroup && matchedFilledGroup.items.length > 0) {
            matchedFilledGroup.used = true;
            matchedFilledGroup.items.forEach(fClip => {
              newRundownItems.push({
                ...fClip,
                draftId: slot.id || fClip.draftId || null,
                draftStartTime: slot.startTime || fClip.draftStartTime || null
              });
            });
            addedFillerCount++;
            continue;
          }

          const durationSec = slot.durationSec || ((parseInt(slot.duration, 10) || 15) * 60);
          const durationTc = slot.durationFormatted || secondsToTimecode(durationSec);
          const durationFrames = timecodeToFrames(durationTc);

          const fillerInstId = `inst_filler_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
          const computedDurSec = Math.floor(durationFrames / BROADCAST_FPS);
          newRundownItems.push({
            id: `filler_${slot.id || idx}_${Date.now()}`,
            instanceId: fillerInstId,
            fillerGroupId: fillerInstId,
            fillerTargetSec: computedDurSec,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'filler_slot',
            isKisaSlot: true,
            title: rawTitle || 'Dolgu Kuşağı',
            name: rawTitle || 'Dolgu Kuşağı',
            durationTc,
            durationFrames,
            durationSec: computedDurSec,
            category: slot.category || 'Dolgu Kuşağı',
            categoryColor: '#8b5cf6',
            note: 'Klip Seç ve Doldur butonuna tıklayarak klip seçin',
            isFromDraft: true,
            addedAt: Date.now()
          });
          addedFillerCount++;
          continue;
        }

        // 2. Canlı Yayın Kuşağı ise arşivde klip aramadan doğrudan düz Canlı Yayın olarak ekle (Öncesine İntro koy)
        if (isLiveSlot) {
          if (introClip) {
            newRundownItems.push(createIntroItem(slot, idx));
            addedIntroCount++;
          }

          const liveDurationSec = slot.durationSec || ((parseInt(slot.duration, 10) || 60) * 60);
          const liveDurationTc = slot.durationFormatted || secondsToTimecode(liveDurationSec);
          const liveDurationFrames = timecodeToFrames(liveDurationTc);
          const liveDetailParts = [slot.host, slot.topic].filter(Boolean);
          const liveDetailText = liveDetailParts.join(' • ') || slot.note || '';
          const matchedLiveArchiveProgs = findMatchingAdminPrograms(slot, usedPrograms);
          const archiveLiveCat = matchedLiveArchiveProgs[0]?.categoryName || '';
          const archiveLiveCatId = matchedLiveArchiveProgs[0]?.categoryId || null;
          const resolvedLiveCat =
            slot.category && !/^(canl[ıi]|özel|ozel|genel)/i.test(String(slot.category).trim())
              ? slot.category
              : archiveLiveCat || slot.category || 'Canlı Yayın';

          newRundownItems.push({
            id: `live_${slot.id || idx}_${Date.now()}`,
            instanceId: `inst_live_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'live',
            isLive: true,
            title: rawTitle,
            name: rawTitle,
            clipName: `${rawTitle}${slot.episode ? ` - Bölüm ${slot.episode}` : ''}${liveDetailText ? ` (${liveDetailText})` : ''}`,
            durationTc: liveDurationTc,
            durationFrames: liveDurationFrames,
            durationSec: Math.floor(liveDurationFrames / BROADCAST_FPS),
            category: resolvedLiveCat,
            categoryName: resolvedLiveCat,
            categoryId: slot.categoryId || archiveLiveCatId || null,
            categoryColor: '#ef4444',
            episodeNo: slot.episodeNo ?? (slot.episode ? Number(slot.episode) || slot.episode : null),
            partNo: null,
            unitType: slot.unitType || 'bolum',
            unitLabel: slot.unitLabel || (slot.episode ? `Bölüm ${slot.episode}` : null),
            host: slot.host || '',
            topic: slot.topic || '',
            note: liveDetailText || 'Canlı Yayın',
            isFromDraft: true,
            addedAt: Date.now()
          });
          addedLiveCount++;
          continue;
        }

        // 3. Normal Program Kuşağı -> Programlar listesinden eşleştir ve kliplerini çek
        const targetInfo = resolveDraftSlotTarget(slot, selectedDate);
        const matchedProgs = findMatchingAdminPrograms(slot, usedPrograms);
        let selectedClips = [];

        if (matchedProgs.length > 0) {
          const clipArrays = await Promise.all(
            matchedProgs.map(p => fetchProgramClipsCached(p.id))
          );
          const allMatchedClips = clipArrays.flat();
          selectedClips = selectSmartClipsForDraftSlot(slot, allMatchedClips, selectedDate);
        }

        // Program veya klip arşivde bulunamadığında listeden KALDIRMA; kendi sırasına ekleyip "Bulunamadı" olarak işaretle
        if (matchedProgs.length === 0 || selectedClips.length === 0) {
          const notFoundReason = matchedProgs.length === 0
            ? 'Programlar listesinde eşleşen program bulunamadı'
            : (targetInfo.targetLabel
                ? `${targetInfo.targetLabel} için arşivde eşleşen klip bulunamadı`
                : 'Programın içinde aktif klip bulunamadı');

          unaddedList.push({
            id: slot.id,
            startTime: slot.startTime,
            title: rawTitle,
            episode: targetInfo.targetLabel || slot.episode || null,
            category: slot.category,
            categoryColor: slot.categoryColor,
            reason: notFoundReason
          });

          if (introClip) {
            newRundownItems.push(createIntroItem(slot, idx));
            addedIntroCount++;
          }

          const fallbackSec = slot.durationSec || ((parseInt(slot.duration, 10) || 30) * 60);
          const fallbackTc = slot.durationFormatted || secondsToTimecode(fallbackSec);
          const fallbackFrames = timecodeToFrames(fallbackTc);

          newRundownItems.push({
            id: `notfound_${slot.id || idx}_${Date.now()}`,
            instanceId: `inst_notfound_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'program',
            isNotFound: true,
            notFoundReason,
            title: rawTitle,
            name: rawTitle,
            clipName: null,
            fileId: null,
            durationTc: fallbackTc,
            durationFrames: fallbackFrames,
            durationSec: Math.floor(fallbackFrames / BROADCAST_FPS),
            category: slot.category || 'Programlar',
            categoryColor: '#f97316',
            episodeNo: targetInfo.targetNo ?? slot.episodeNo ?? (slot.episode ? Number(slot.episode) || slot.episode : null),
            partNo: slot.partNo || slot.part || null,
            unitType: targetInfo.unitType || slot.unitType || 'bolum',
            unitLabel: targetInfo.targetLabel || slot.unitLabel || (slot.episode ? `Bölüm ${slot.episode}` : null),
            host: slot.host || '',
            topic: slot.topic || '',
            note: `Bulunamadı • ${notFoundReason}`,
            isFromDraft: true,
            addedAt: Date.now()
          });
          continue;
        }

        // Her programdan önce (1. parttan önce, sadece 1 kez) İntro klibi girer
        if (introClip) {
          newRundownItems.push(createIntroItem(slot, idx));
          addedIntroCount++;
        }

        const primaryProg = matchedProgs[0];
        selectedClips.forEach((clip, partIdx) => {
          const clipSec = clip.durationSec || clip.duration || slot.durationSec || 1800;
          const durTc = clip.durationFormatted || secondsToTimecode(clipSec);
          const durFrames = timecodeToFrames(durTc);

          newRundownItems.push({
            id: `clip_${clip.fileId || idx}_${Date.now()}_${partIdx}`,
            instanceId: `inst_clip_${Date.now()}_${idx}_${partIdx}_${Math.random().toString(36).substr(2, 5)}`,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'clip',
            title: clip.name,
            name: clip.name,
            clipName: clip.name,
            fileId: clip.fileId,
            durationTc: durTc,
            durationFrames: durFrames,
            durationSec: Math.floor(durFrames / BROADCAST_FPS),
            category: slot.category || primaryProg?.categoryName || 'Programlar',
            categoryColor: slot.categoryColor || '#0d9488',
            episodeNo: clip.episodeNo ?? targetInfo.targetNo ?? null,
            partNo: clip.partNo ?? null,
            unitType: clip.unitType || 'bolum',
            unitLabel: clip.unitLabel || null,
            appliedDraftTitle: rawTitle,
            appliedDraftEpisode: targetInfo.targetNo ?? slot.episode ?? slot.episodeNo ?? null,
            note: `Program: ${primaryProg?.title || rawTitle}${clip.topic ? ` • ${clip.topic}` : ''}`,
            isFromDraft: true,
            addedAt: Date.now()
          });
          addedClipsCount++;
        });
      }

      // Eğer kullanıcının daha önce doldurduğu ancak taslakta eşleşmeyen ekstra Dolgu Kuşağı klipleri varsa onları da koru
      existingFilledFillerGroups.forEach(group => {
        if (!group.used && group.items.length > 0) {
          newRundownItems.push(...group.items);
        }
      });

      // Mevcut listedeki Reklam Kuşaklarını (ad_break) kendi referans programlarının hemen altına geri yerleştir
      if (existingAdBreaksWithAnchors.length > 0) {
        existingAdBreaksWithAnchors.forEach(({ adItem, prevAnchor, relativeRatio }) => {
          if (!prevAnchor) {
            newRundownItems.unshift(adItem);
            return;
          }

          let insertAt = -1;
          if (prevAnchor.draftId) {
            for (let i = newRundownItems.length - 1; i >= 0; i--) {
              const cand = newRundownItems[i];
              if (cand.draftId && String(cand.draftId) === String(prevAnchor.draftId)) {
                if (prevAnchor.partNo && cand.partNo && Number(cand.partNo) === Number(prevAnchor.partNo)) {
                  insertAt = i + 1;
                  break;
                }
                if (insertAt === -1) {
                  insertAt = i + 1;
                }
              }
            }
          }

          if (insertAt === -1 && prevAnchor.title) {
            const normAnchor = normalizeProgramText(prevAnchor.title);
            for (let i = newRundownItems.length - 1; i >= 0; i--) {
              const cand = newRundownItems[i];
              const normCand = normalizeProgramText(cand.title || cand.name || '');
              if (normAnchor.length >= 3 && normCand === normAnchor) {
                insertAt = i + 1;
                break;
              }
            }
          }

          if (insertAt === -1) {
            insertAt = Math.min(
              newRundownItems.length,
              Math.max(0, Math.round(relativeRatio * newRundownItems.length))
            );
          }

          newRundownItems.splice(insertAt, 0, adItem);
        });
      }

      setDayPrograms(selectedChannel, selectedDate, activeList, newRundownItems, {
        lastDraftAppliedAt: Date.now(),
        unaddedDraftSlots: unaddedList
      });

      if (unaddedList.length > 0) {
        await dialog.warning(
          'Taslak Uygulandı (Bulunamayan Programlar İşaretlendi)',
          `Taslak akışı yayın listesine yerleştirildi. Arşivde eşleşen klibi/programı bulunamayan kuşaklar listeden kaldırılmadı; kendi sırasıyla listede korunup "Bulunamadı" olarak işaretlendi.\nEklenen Klip / Part: ${addedClipsCount} Adet\nEklenen İntro: ${addedIntroCount} Adet\nCanlı Yayın: ${addedLiveCount} Adet\nDolgu Kuşağı: ${addedFillerCount} Adet\nBulunamayan Kuşak (Listede Korundu): ${unaddedList.length} Adet\n* Bilgi: Bulunamayan programlar yayın listesinde turuncu/kırmızı "Bulunamadı" rozetiyle gösterilmektedir.`
        );
      } else {
        await dialog.success(
          'Taslak Başarıyla Uygulandı',
          `Günün tüm taslak kuşakları yayın listesine eksiksiz yerleştirildi.\nEklenen Klip / Part: ${addedClipsCount} Adet\nEklenen İntro: ${addedIntroCount} Adet\nCanlı Yayın: ${addedLiveCount} Adet\nDolgu Kuşağı: ${addedFillerCount} Adet`
        );
      }
    } catch (err) {
      console.error('Akıllı taslak uygulama hatası:', err);
      await dialog.error(
        'Taslak Uygulama Hatası',
        'Taslak uygulanırken beklenmeyen bir hata oluştu. Lütfen sunucu bağlantısını kontrol edin.'
      );
    } finally {
      setIsApplyingDraft(false);
    }
  }, [draftSlotsForToday, programsCount, setDayPrograms, selectedChannel, selectedDate, activeList]);

  /**
   * Taslak Planlamada güncelleme geldiğinde veya arşivde olmayan bir program sonradan yüklendiğinde/açıldığında:
   * 1. Önbellekleri temizleyip en güncel Taslak Planlama verisini ve Admin Panel -> Programlar / MAM Arşiv verisini çeker.
   * 2. Yayın listesinde "Bulunamadı" (`isNotFound`) olarak bekleyen programları tekrar kontrol eder; arşivde artık varsa kliplerini otomatik yerleştirir.
   * 3. Taslak Planlamada bölümü, cüzü veya adı değişen kuşakları tespit edip yayın listesinde otomatik günceller.
   * 4. Taslakta olup yayın listesinde henüz yer almayan (eklenmeyen veya yeni eklenen) kuşakları otomatik tarar ve kendi saat sırasına ekler.
   */
  const handleSyncAndFillMissingDrafts = useCallback(async ({
    silentIfNoChanges = false,
    autoTriggered = false
  } = {}) => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setIsSyncingDraftAndArchive(true);

    try {
      // 1. Önbellekleri temizle ve sunucudan en güncel taslak + arşiv programlarını çek
      clearBroadcastArchiveCaches();
      await fetchAndSyncDraftSchedule(selectedChannel);
      useBroadcastStore.getState().notifyDraftUpdated(selectedChannel);

      const liveDraftSlots = getDraftProgramsForDay(selectedChannel, selectedDate) || [];
      const currentPrograms = [
        ...(useBroadcastStore.getState().getRawDayPrograms(selectedChannel, selectedDate, activeList) || [])
      ];

      // Eğer yayın listesi tamamen boşsa ve kullanıcı manuel tıkladıysa doğrudan Taslak Uygula çalıştır
      if (currentPrograms.length === 0) {
        if (!autoTriggered && liveDraftSlots.length > 0) {
          syncInFlightRef.current = false;
          setIsSyncingDraftAndArchive(false);
          await handleApplySmartDraft();
          return;
        }
        if (!silentIfNoChanges && liveDraftSlots.length === 0) {
          await dialog.info(
            'Taslak Bulunamadı',
            `${selectedDate} tarihi için Taslak Planlama modülünde kayıtlı kuşak bulunmuyor.`
          );
        }
        return;
      }

      const progRes = await fetch('/api/archive/used-programs');
      const progJson = progRes.ok ? await progRes.json() : null;
      const usedPrograms = Array.isArray(progJson)
        ? progJson
        : (Array.isArray(progJson?.programs) ? progJson.programs : []);

      const introSettings = useBroadcastStore.getState().introDefaultSettings || {
        autoInsertIntro: true,
        fileId: 725,
        name: 'SEMERKAND_intro_v3_2014',
        durationSec: 26,
        durationTc: '00.00.26.00',
        category: 'Jenerik / İntro'
      };
      const shouldInsertIntros = introSettings.autoInsertIntro !== false;
      let introClip = null;
      if (shouldInsertIntros) {
        if (introSettings.name && introSettings.fileId) {
          introClip = {
            fileId: introSettings.fileId,
            name: introSettings.name,
            durationSec: introSettings.durationSec || 26,
            durationFormatted: introSettings.durationTc || secondsToTimecode(introSettings.durationSec || 26)
          };
        } else {
          introClip = await fetchIntroClipForBroadcast(usedPrograms);
        }
      }

      const createIntroForSlot = (slot, tagIdx = 0) => {
        const introSec = introClip?.durationSec || 26;
        const introTc = introClip?.durationFormatted || secondsToTimecode(introSec);
        const introFrames = timecodeToFrames(introTc);
        const introName = introClip?.name || 'SEMERKAND_intro_v3_2014';
        return {
          id: `intro_${introClip?.fileId || 725}_${Date.now()}_${tagIdx}`,
          instanceId: `inst_intro_${Date.now()}_${tagIdx}_${Math.random().toString(36).substr(2, 5)}`,
          draftId: slot.id || null,
          draftStartTime: slot.startTime || null,
          type: 'clip',
          isIntroClip: true,
          title: introName,
          name: introName,
          clipName: introName,
          fileId: introClip?.fileId || 725,
          durationTc: introTc,
          durationFrames: introFrames,
          durationSec: Math.floor(introFrames / BROADCAST_FPS),
          category: 'Jenerik / İntro',
          categoryColor: '#6366f1',
          episodeNo: null,
          partNo: null,
          unitType: 'intro',
          unitLabel: 'İntro',
          note: `İntro • ${slot.title || slot.name || ''}`,
          isFromDraft: true,
          addedAt: Date.now()
        };
      };

      const buildItemsForDraftSlot = async (slot, slotIdx, includeIntro = true) => {
        const rawTitle = slot.title || slot.name || 'İsimsiz Kuşak';
        const normTitle = normalizeProgramText(rawTitle);
        const isFillerSlot = Boolean(
          slot.isKisaSlot ||
          normTitle.includes('dolgu kusagi') ||
          normTitle === 'dolgu'
        );
        const isLiveSlot = Boolean(
          slot.isLive ||
          (Array.isArray(slot.selectedOptions) && slot.selectedOptions.some(o => /canl[ıi]/i.test(String(o)))) ||
          /\bcanl[ıi]\b/i.test(`${slot.rawTitle || ''} ${rawTitle} ${slot.host || ''}`)
        );

        if (isFillerSlot) {
          const durationSec = slot.durationSec || ((parseInt(slot.duration, 10) || 15) * 60);
          const durationTc = slot.durationFormatted || secondsToTimecode(durationSec);
          const durationFrames = timecodeToFrames(durationTc);
          const fillerInstId = `inst_filler_${Date.now()}_${slotIdx}_${Math.random().toString(36).substr(2, 5)}`;
          const computedDurSec = Math.floor(durationFrames / BROADCAST_FPS);
          return {
            foundInArchive: true,
            items: [{
              id: `filler_${slot.id || slotIdx}_${Date.now()}`,
              instanceId: fillerInstId,
              fillerGroupId: fillerInstId,
              fillerTargetSec: computedDurSec,
              draftId: slot.id || null,
              draftStartTime: slot.startTime || null,
              type: 'filler_slot',
              isKisaSlot: true,
              title: rawTitle || 'Dolgu Kuşağı',
              name: rawTitle || 'Dolgu Kuşağı',
              durationTc,
              durationFrames,
              durationSec: computedDurSec,
              category: slot.category || 'Dolgu Kuşağı',
              categoryColor: '#8b5cf6',
              note: 'Klip Seç ve Doldur butonuna tıklayarak klip seçin',
              isFromDraft: true,
              addedAt: Date.now()
            }]
          };
        }

        if (isLiveSlot) {
          const built = [];
          if (includeIntro && introClip) {
            built.push(createIntroForSlot(slot, slotIdx));
          }
          const liveDurationSec = slot.durationSec || ((parseInt(slot.duration, 10) || 60) * 60);
          const liveDurationTc = slot.durationFormatted || secondsToTimecode(liveDurationSec);
          const liveDurationFrames = timecodeToFrames(liveDurationTc);
          const liveDetailText = [slot.host, slot.topic].filter(Boolean).join(' • ') || slot.note || '';
          const matchedLiveArchiveProgs = findMatchingAdminPrograms(slot, usedPrograms);
          const archiveLiveCat = matchedLiveArchiveProgs[0]?.categoryName || '';
          const archiveLiveCatId = matchedLiveArchiveProgs[0]?.categoryId || null;
          const resolvedLiveCat =
            slot.category && !/^(canl[ıi]|özel|ozel|genel)/i.test(String(slot.category).trim())
              ? slot.category
              : archiveLiveCat || slot.category || 'Canlı Yayın';
          built.push({
            id: `live_${slot.id || slotIdx}_${Date.now()}`,
            instanceId: `inst_live_${Date.now()}_${slotIdx}_${Math.random().toString(36).substr(2, 5)}`,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'live',
            isLive: true,
            title: rawTitle,
            name: rawTitle,
            clipName: `${rawTitle}${slot.episode ? ` - Bölüm ${slot.episode}` : ''}${liveDetailText ? ` (${liveDetailText})` : ''}`,
            durationTc: liveDurationTc,
            durationFrames: liveDurationFrames,
            durationSec: Math.floor(liveDurationFrames / BROADCAST_FPS),
            category: resolvedLiveCat,
            categoryName: resolvedLiveCat,
            categoryId: slot.categoryId || archiveLiveCatId || null,
            categoryColor: '#ef4444',
            episodeNo: slot.episodeNo ?? (slot.episode ? Number(slot.episode) || slot.episode : null),
            partNo: null,
            unitType: slot.unitType || 'bolum',
            unitLabel: slot.unitLabel || (slot.episode ? `Bölüm ${slot.episode}` : null),
            host: slot.host || '',
            topic: slot.topic || '',
            note: liveDetailText || 'Canlı Yayın',
            isFromDraft: true,
            addedAt: Date.now()
          });
          return { foundInArchive: true, items: built };
        }

        const targetInfo = resolveDraftSlotTarget(slot, selectedDate);
        const matchedProgs = findMatchingAdminPrograms(slot, usedPrograms);
        let selectedClips = [];
        if (matchedProgs.length > 0) {
          const clipArrays = await Promise.all(matchedProgs.map(p => fetchProgramClipsCached(p.id)));
          const allMatchedClips = clipArrays.flat();
          selectedClips = selectSmartClipsForDraftSlot(slot, allMatchedClips, selectedDate);
        }

        if (matchedProgs.length === 0 || selectedClips.length === 0) {
          const notFoundReason = matchedProgs.length === 0
            ? 'Programlar listesinde eşleşen program bulunamadı'
            : (targetInfo.targetLabel
                ? `${targetInfo.targetLabel} için arşivde eşleşen klip bulunamadı`
                : 'Programın içinde aktif klip bulunamadı');
          const built = [];
          if (includeIntro && introClip) {
            built.push(createIntroForSlot(slot, slotIdx));
          }
          const fallbackSec = slot.durationSec || ((parseInt(slot.duration, 10) || 30) * 60);
          const fallbackTc = slot.durationFormatted || secondsToTimecode(fallbackSec);
          const fallbackFrames = timecodeToFrames(fallbackTc);
          built.push({
            id: `notfound_${slot.id || slotIdx}_${Date.now()}`,
            instanceId: `inst_notfound_${Date.now()}_${slotIdx}_${Math.random().toString(36).substr(2, 5)}`,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'program',
            isNotFound: true,
            notFoundReason,
            title: rawTitle,
            name: rawTitle,
            clipName: null,
            fileId: null,
            durationTc: fallbackTc,
            durationFrames: fallbackFrames,
            durationSec: Math.floor(fallbackFrames / BROADCAST_FPS),
            category: slot.category || 'Programlar',
            categoryColor: '#f97316',
            episodeNo: targetInfo.targetNo ?? slot.episodeNo ?? (slot.episode ? Number(slot.episode) || slot.episode : null),
            partNo: slot.partNo || slot.part || null,
            unitType: targetInfo.unitType || slot.unitType || 'bolum',
            unitLabel: targetInfo.targetLabel || slot.unitLabel || (slot.episode ? `Bölüm ${slot.episode}` : null),
            host: slot.host || '',
            topic: slot.topic || '',
            note: `Bulunamadı • ${notFoundReason}`,
            isFromDraft: true,
            addedAt: Date.now()
          });
          return { foundInArchive: false, notFoundReason, items: built };
        }

        const built = [];
        if (includeIntro && introClip) {
          built.push(createIntroForSlot(slot, slotIdx));
        }
        const primaryProg = matchedProgs[0];
        selectedClips.forEach((clip, partIdx) => {
          const clipSec = clip.durationSec || clip.duration || slot.durationSec || 1800;
          const durTc = clip.durationFormatted || secondsToTimecode(clipSec);
          const durFrames = timecodeToFrames(durTc);
          built.push({
            id: `clip_${clip.fileId || slotIdx}_${Date.now()}_${partIdx}`,
            instanceId: `inst_clip_${Date.now()}_${slotIdx}_${partIdx}_${Math.random().toString(36).substr(2, 5)}`,
            draftId: slot.id || null,
            draftStartTime: slot.startTime || null,
            type: 'clip',
            title: clip.name,
            name: clip.name,
            clipName: clip.name,
            fileId: clip.fileId,
            durationTc: durTc,
            durationFrames: durFrames,
            durationSec: Math.floor(durFrames / BROADCAST_FPS),
            category: slot.category || primaryProg?.categoryName || 'Programlar',
            categoryColor: slot.categoryColor || '#0d9488',
            episodeNo: clip.episodeNo ?? targetInfo.targetNo ?? null,
            partNo: clip.partNo ?? null,
            unitType: clip.unitType || 'bolum',
            unitLabel: clip.unitLabel || null,
            appliedDraftTitle: rawTitle,
            appliedDraftEpisode: targetInfo.targetNo ?? slot.episode ?? slot.episodeNo ?? null,
            note: `Program: ${primaryProg?.title || rawTitle}${clip.topic ? ` • ${clip.topic}` : ''}`,
            isFromDraft: true,
            addedAt: Date.now()
          });
        });

        return { foundInArchive: true, items: built };
      };

      let workingPrograms = [...currentPrograms];
      let resolvedNotFoundCount = 0;
      let updatedSlotsCount = 0;
      let addedMissingSlotsCount = 0;
      const resolvedTitles = [];
      const updatedTitles = [];
      const addedTitles = [];

      // A. Listede "Bulunamadı" (isNotFound) olan satırları tekrar kontrol et; arşivde artık varsa İntro + kliplerini yerleştir
      for (let i = 0; i < workingPrograms.length; i++) {
        const item = workingPrograms[i];
        if (!item || !item.isNotFound) continue;

        const matchedDraftSlot = liveDraftSlots.find(
          s => (item.draftId && String(s.id) === String(item.draftId)) ||
               (item.draftStartTime && s.startTime === item.draftStartTime && normalizeProgramText(s.title) === normalizeProgramText(item.title))
        );

        const slotSpec = matchedDraftSlot || {
          id: item.draftId,
          startTime: item.draftStartTime,
          title: item.title,
          name: item.name || item.title,
          episode: item.episodeNo,
          episodeNo: item.episodeNo,
          unitType: item.unitType,
          unitLabel: item.unitLabel,
          host: item.host,
          topic: item.topic,
          note: item.note,
          category: item.category
        };

        const hasPrecedingIntro = i > 0 && Boolean(workingPrograms[i - 1]?.isIntroClip);
        const builtRes = await buildItemsForDraftSlot(slotSpec, i, !hasPrecedingIntro);
        if (builtRes.foundInArchive && builtRes.items.length > 0) {
          workingPrograms.splice(i, 1, ...builtRes.items);
          i += builtRes.items.length - 1;
          resolvedNotFoundCount++;
          resolvedTitles.push(slotSpec.title || item.title);
        }
      }

      // B. Taslak Planlamada güncellenen (başlığı veya bölüm numarası değişen) kuşakları kontrol et ve güncelle (İntro + Partlar ile, Reklam ve Dolgu kuşaklarına dokunmadan)
      for (let sIdx = 0; sIdx < liveDraftSlots.length; sIdx++) {
        const slot = liveDraftSlots[sIdx];
        if (!slot.id) continue;

        const updateCheck = getDraftSlotUpdateStatus(slot, workingPrograms, selectedDate);
        if (!updateCheck.isUpdatedInDraft) continue;

        const existingIndices = [];
        workingPrograms.forEach((p, pIdx) => {
          if (
            p.draftId &&
            String(p.draftId) === String(slot.id) &&
            !p.isIntroClip &&
            !p.isFillerClip &&
            p.type !== 'filler_slot' &&
            p.type !== 'ad_break' &&
            p.category !== 'Dolgu Kuşağı'
          ) {
            existingIndices.push(pIdx);
          }
        });

        if (existingIndices.length === 0) continue;
        const firstIdx = existingIndices[0];
        const hasPrecedingIntro = firstIdx > 0 && Boolean(workingPrograms[firstIdx - 1]?.isIntroClip);

        const builtRes = await buildItemsForDraftSlot(slot, sIdx, !hasPrecedingIntro);
        if (builtRes.items.length > 0) {
          if (hasPrecedingIntro && workingPrograms[firstIdx - 1]) {
            workingPrograms[firstIdx - 1] = {
              ...workingPrograms[firstIdx - 1],
              draftId: slot.id || workingPrograms[firstIdx - 1].draftId,
              draftStartTime: slot.startTime || workingPrograms[firstIdx - 1].draftStartTime,
              note: `İntro • ${slot.title || slot.name || ''}`
            };
          }
          const toRemoveSet = new Set(existingIndices.map(idx => workingPrograms[idx]?.instanceId));
          workingPrograms = workingPrograms.filter(p => !toRemoveSet.has(p.instanceId));
          const insertAt = Math.min(firstIdx, workingPrograms.length);
          workingPrograms.splice(insertAt, 0, ...builtRes.items);
          updatedSlotsCount++;
          updatedTitles.push(slot.title || slot.name);
        }
      }

      // C. Taslakta olup yayın listesinde henüz olmayan (eklenmeyen / yeni eklenen) kuşakları bul ve sırasına İntro + Klipleriyle ekle
      for (let sIdx = 0; sIdx < liveDraftSlots.length; sIdx++) {
        const slot = liveDraftSlots[sIdx];
        const isAdded = isDraftSlotAddedToRundown(slot, workingPrograms, liveDraftSlots);
        if (isAdded) continue;

        const builtRes = await buildItemsForDraftSlot(slot, sIdx, true);
        if (builtRes.items.length === 0) continue;

        // Kuşağın ekleneceği doğru sırayı bul (kendinden önceki taslak kuşağının son öğesinin hemen altı)
        let insertIndex = workingPrograms.length;
        if (sIdx === 0) {
          insertIndex = 0;
        } else {
          let foundAnchor = false;
          for (let prevIdx = sIdx - 1; prevIdx >= 0; prevIdx--) {
            const prevSlot = liveDraftSlots[prevIdx];
            for (let wIdx = workingPrograms.length - 1; wIdx >= 0; wIdx--) {
              if (doesDraftSlotMatchRundownItem(prevSlot, workingPrograms[wIdx])) {
                insertIndex = wIdx + 1;
                foundAnchor = true;
                break;
              }
            }
            if (foundAnchor) break;
          }
        }

        workingPrograms.splice(insertIndex, 0, ...builtRes.items);
        addedMissingSlotsCount++;
        addedTitles.push(slot.title || slot.name);
      }

      const totalChanges = resolvedNotFoundCount + updatedSlotsCount + addedMissingSlotsCount;

      if (totalChanges > 0) {
        const remainingUnadded = workingPrograms
          .filter(p => p.isNotFound)
          .map(p => ({
            id: p.draftId || p.id,
            startTime: p.draftStartTime || '',
            title: p.title,
            episode: p.unitLabel || p.episodeNo || null,
            category: p.category,
            categoryColor: p.categoryColor,
            reason: p.notFoundReason || 'Programlar listesinde eşleşen klip bulunamadı'
          }));

        setDayPrograms(selectedChannel, selectedDate, activeList, workingPrograms, {
          lastDraftAppliedAt: Date.now(),
          unaddedDraftSlots: remainingUnadded
        });

        const summaryParts = [];
        if (addedMissingSlotsCount > 0) {
          summaryParts.push(`${addedMissingSlotsCount} eksik/yeni taslak kuşağı eklendi (${addedTitles.slice(0, 3).join(', ')})`);
        }
        if (resolvedNotFoundCount > 0) {
          summaryParts.push(`${resolvedNotFoundCount} bulunamayan program arşivden tamamlandı (${resolvedTitles.slice(0, 3).join(', ')})`);
        }
        if (updatedSlotsCount > 0) {
          summaryParts.push(`${updatedSlotsCount} güncellenen taslak kuşağı yenilendi (${updatedTitles.slice(0, 3).join(', ')})`);
        }

        const bannerMsg = `✓ Senkronizasyon Tamamlandı: ${summaryParts.join(' • ')}`;
        if (onSyncBanner) {
          onSyncBanner({
            type: 'success',
            message: bannerMsg
          });
        }

        if (!autoTriggered) {
          await dialog.success(
            'Taslak & Arşiv Eksikleri Tamamlandı',
            `Yayın akışı güncel Taslak Planlama ve MAM Arşiv verileriyle senkronize edildi (Reklam ve Dolgu kuşaklarınız korundu).\n${summaryParts.map(s => `• ${s}`).join('\n')}`
          );
        }
      } else if (!silentIfNoChanges) {
        const stillNotFound = workingPrograms.filter(p => p.isNotFound);
        if (stillNotFound.length > 0) {
          await dialog.warning(
            'Kontrol Tamamlandı (Bazı Programlar Henüz Arşivde Yok)',
            `Taslak ve arşiv tarandı; eklenmemiş taslak kuşağı bulunmuyor ancak listedeki ${stillNotFound.length} program için arşivde hâlâ aktif klip bulunamadı:\n${stillNotFound.map(p => `• ${p.title} (${p.notFoundReason || 'Klip yok'})`).join('\n')}\n* Bilgi: Admin Panel > Programlar veya MAM Arşiv ekranından ilgili programı kullanıma açıp tekrar "Yenile & Eksikleri Kontrol Et" butonuna basabilirsiniz.`
          );
        } else {
          if (onSyncBanner) {
            onSyncBanner({
              type: 'success',
              message: '✓ Taslak ve arşiv kontrol edildi: Tüm kuşaklar ve klipler güncel, eksik program yok.'
            });
          }
          await dialog.success(
            'Tüm Kuşaklar Güncel',
            'Taslak Planlama ve MAM Arşiv kontrol edildi. Yayın listesinde eksik veya güncellenmemiş kuşak bulunmuyor.'
          );
        }
      }
    } catch (err) {
      console.error('Taslak ve eksik kontrolü hatası:', err);
      if (!silentIfNoChanges) {
        await dialog.error(
          'Senkronizasyon Hatası',
          'Taslak ve arşiv kontrol edilirken bir hata oluştu.'
        );
      }
    } finally {
      syncInFlightRef.current = false;
      setIsSyncingDraftAndArchive(false);
    }
  }, [selectedChannel, selectedDate, activeList, setDayPrograms, handleApplySmartDraft, onSyncBanner]);

  // Taslak Planlamada bir değişiklik olduğunda OTOMATİK UYGULAMA YAPMAZ!
  // Yalnızca değişikliği tespit edip üst bildirim şeridinde ve Sol Panelde kullanıcıya bildirir; kullanıcı isterse Sol Panelden "Ekle / Güncelle" veya üstten "Kontrol Et" butonuna basar.
  useEffect(() => {
    const checkDraftUpdatesWithoutApplying = (e) => {
      const updatedCh = e?.detail?.channelId;
      if (updatedCh && updatedCh !== selectedChannel) return;

      const currentProgs = useBroadcastStore.getState().getRawDayPrograms(selectedChannel, selectedDate, activeList) || [];
      if (currentProgs.length === 0) return;

      const liveDraftSlots = getDraftProgramsForDay(selectedChannel, selectedDate) || [];
      if (liveDraftSlots.length === 0) return;

      const missingTitles = [];
      const updatedTitles = [];

      liveDraftSlots.forEach(slot => {
        const isAdded = isDraftSlotAddedToRundown(slot, currentProgs, liveDraftSlots);
        if (!isAdded) {
          missingTitles.push(slot.title || slot.name || 'Kuşak');
        } else {
          const upd = getDraftSlotUpdateStatus(slot, currentProgs, selectedDate);
          if (upd.isUpdatedInDraft) {
            updatedTitles.push(
              `${slot.title || slot.name}${upd.newEpisodeNo ? ` (Bölüm ${upd.newEpisodeNo})` : ''}`
            );
          }
        }
      });

      if ((missingTitles.length > 0 || updatedTitles.length > 0) && onSyncBanner) {
        const parts = [];
        if (updatedTitles.length > 0) {
          parts.push(`${updatedTitles.length} güncellenen kuşak (${updatedTitles.slice(0, 3).join(', ')})`);
        }
        if (missingTitles.length > 0) {
          parts.push(`${missingTitles.length} eklenmemiş/yeni kuşak (${missingTitles.slice(0, 3).join(', ')})`);
        }
        onSyncBanner({
          type: 'warning',
          message: `🔔 Taslak Planlamada değişiklik algılandı: ${parts.join(' • ')}. Sol panelden istediğiniz kuşağı ekleyebilir/güncelleyebilir veya "Eksikleri & Taslağı Kontrol Et" butonuna tıklayabilirsiniz.`
        });
      } else if (onSyncBanner) {
        onSyncBanner(prev => (prev?.type === 'warning' ? null : prev));
      }
    };

    window.addEventListener('draft-schedule-updated', checkDraftUpdatesWithoutApplying);
    return () => window.removeEventListener('draft-schedule-updated', checkDraftUpdatesWithoutApplying);
  }, [selectedChannel, selectedDate, activeList, onSyncBanner]);

  return {
    isApplyingDraft,
    isSyncingDraftAndArchive,
    handleApplySmartDraft,
    handleSyncAndFillMissingDrafts
  };
}
