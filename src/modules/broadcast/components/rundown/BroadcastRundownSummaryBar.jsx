/**
 * @file src/modules/broadcast/components/rundown/BroadcastRundownSummaryBar.jsx
 * @description Yayın akışı tablosunun üstünde yer alan sadeleştirilmiş kontrol ve özet çubuğu.
 *
 * Yerleşim Düzeni:
 * - Sol: Ekleme Konumu (Üst | Seçili Altı | Alt) + "+ Ekle" Açılır Menüsü (Program, Dolgu, Reklam) + Geri/İleri Al
 * - Orta: Yayın Liste Doluluk Oranı, Toplam Süre ve Sarkma/Eksik Süre Özeti
 * - Sağ: Taslak Uygula + Kaydet (Kaydedildiğinde "Reklam Rezervasyona İlet" butonuna dönüşür)
 */
import React, { useState, useEffect, useMemo, memo } from 'react';
import { Zap, Save, Send, Loader2, RefreshCw, Trash2, CheckCircle2, Cpu, Lock } from 'lucide-react';
import { dialog } from '../../../../store/dialogStore';
import { FRAMES_PER_DAY } from '../../utils/timecodeUtils';
import { isDraftSlotAddedToRundown } from '../DraftProgramSlotItem';
import SummaryDurationBadges from './summary/SummaryDurationBadges';
import SummaryActionToolbar from './summary/SummaryActionToolbar';
import SummaryClipboardAndAlerts from './summary/SummaryClipboardAndAlerts';

const BroadcastRundownSummaryBar = memo(function BroadcastRundownSummaryBar({
  programs = [],
  draftSlotsForToday = [],
  unaddedDraftSlots = [],
  manuallyMarkedDraftSlotIds = [],
  prevOverflowFrames = 0,
  nextOverflowFrames = 0,
  activeList = 'A',
  selectedDate = '',
  adBreakDefaultSettings,
  isApplyingDraft = false,
  isSyncingDraftAndArchive = false,
  lastDraftAppliedAt = null,
  lastSavedAt = null,
  statusBanner = null,
  historyPastCount = 0,
  historyFutureCount = 0,
  undo,
  redo,
  onClearStatusBanner,
  onApplySmartDraft,
  onSyncAndFillMissingDrafts,
  onSaveSchedule,
  onPlaceAdsInBroadcast,
  isAdsPlacedForCurrentState = false,
  isDayLockedReadOnly = false,
  onSendToAdReservation,
  onGoToNextDay,
  onUpdateAdBreakDefaultSettings,
  onQuickAddAdBreak,
  onQuickAddFillerSlot,
  onOpenAddModal,
  onClearList,
  clipboardCount = 0,
  clipboardMeta = null,
  onPasteClipboard,
  onClearClipboard,
  insertPosition = 'after_selected',
  setInsertPosition,
  selectedInstanceId = null,
  selectedProgram = null,
  onInspectClip,
  onQuickAddMissingDraftSlot,
  onQuickAddAllMissingDraftSlots
}) {
  const [checkedSignature, setCheckedSignature] = useState(null);
  const [savedSignature, setSavedSignature] = useState(null);
  const [adsPlacedSignature, setAdsPlacedSignature] = useState(null);

  // Mevcut listenin parmak izi: Liste değiştiğinde (ekleme/silme/süre değişimi) tekrar Kontrol Et ve Kaydet moduna döner
  const currentSignature = useMemo(() => {
    if (!programs.length) return '';
    return `${selectedDate}_${activeList}_${programs
      .map(p => `${p.instanceId}:${p.durationFrames}:${p.title}:${p.isPinnedTime ? p.pinnedStartTime : ''}`)
      .join('|')}`;
  }, [programs, selectedDate, activeList]);

  // Ctrl+S veya Kaydet butonu ile kaydedildiğinde imzayı senkronize et
  useEffect(() => {
    if (lastSavedAt && currentSignature) {
      setSavedSignature(currentSignature);
    }
  }, [lastSavedAt]);

  useEffect(() => {
    if (isAdsPlacedForCurrentState && currentSignature) {
      setAdsPlacedSignature(currentSignature);
    }
  }, [isAdsPlacedForCurrentState, currentSignature]);

  const isCurrentStateChecked = Boolean(
    programs.length > 0 && checkedSignature && checkedSignature === currentSignature
  );

  const isCurrentStateSaved = Boolean(
    programs.length > 0 && savedSignature && savedSignature === currentSignature
  );

  const isCurrentStateAdsPlaced = Boolean(
    programs.length > 0 && (isAdsPlacedForCurrentState || (adsPlacedSignature && adsPlacedSignature === currentSignature))
  );

  const canPlaceAds = Boolean(isCurrentStateChecked && isCurrentStateSaved && !isDayLockedReadOnly);
  const canSendToAds = Boolean(isCurrentStateChecked && isCurrentStateSaved && isCurrentStateAdsPlaced && !isDayLockedReadOnly);

  const handleCheckClick = () => {
    if (isDayLockedReadOnly) {
      dialog.info('Onaylanmış Geçmiş Gün (Salt Okunur)', 'Bu günün yayın listesi Yayın Liste Kontrol aşamasında onaylanmış ve yayın tarihi geçmiş olduğu için değişikliğe kapalıdır.');
      return;
    }
    if (onSyncAndFillMissingDrafts) {
      onSyncAndFillMissingDrafts();
    }
    setCheckedSignature(currentSignature);
  };

  const handleSaveClick = () => {
    if (isDayLockedReadOnly) {
      dialog.info('Onaylanmış Geçmiş Gün (Salt Okunur)', 'Bu günün yayın listesi Yayın Liste Kontrol aşamasında onaylanmış ve yayın tarihi geçmiş olduğu için değişikliğe kapalıdır.');
      return;
    }
    if (!isCurrentStateChecked) {
      dialog.warning(
        'Önce Listeyi Kontrol Edin',
        'Yayın listesini kaydetmeden önce "Kontrol Et" butonuna tıklayarak taslak ve arşiv kontrolünü tamamlamalısınız.'
      );
      return;
    }
    if (onSaveSchedule) {
      onSaveSchedule();
    }
    setSavedSignature(currentSignature);
  };

  const handlePlaceAdsClick = () => {
    if (isDayLockedReadOnly) {
      dialog.info('Onaylanmış Geçmiş Gün (Salt Okunur)', 'Bu günün yayın listesi Yayın Liste Kontrol aşamasında onaylanmış ve yayın tarihi geçmiş olduğu için değişikliğe kapalıdır.');
      return;
    }
    if (!isCurrentStateChecked || !isCurrentStateSaved) {
      dialog.warning(
        'Önce Kontrol Et ve Kaydet Gerekli',
        'Reklamları yerleştirmeden önce sırasıyla:\n1. "Kontrol Et" butonuna tıklayın,\n2. "Kaydet" butonuna tıklayarak listeyi kaydedin.'
      );
      return;
    }
    if (onPlaceAdsInBroadcast) {
      onPlaceAdsInBroadcast();
    }
    setAdsPlacedSignature(currentSignature);
  };

  const handleSendToAdsClick = () => {
    if (isDayLockedReadOnly) {
      dialog.info('Onaylanmış Geçmiş Gün (Salt Okunur)', 'Bu günün yayın listesi Yayın Liste Kontrol aşamasında onaylanmış ve yayın tarihi geçmiş olduğu için değişikliğe kapalıdır.');
      return;
    }
    if (!isCurrentStateChecked || !isCurrentStateSaved || !isCurrentStateAdsPlaced) {
      dialog.warning(
        'Reklamları Yerleştir Adımı Gerekli',
        'Yayın akışını Reklam Rezervasyona iletebilmek için önce sırasıyla:\n1. "Kontrol Et" butonuna tıklayarak listeyi doğrulayın,\n2. "Kaydet" butonuna tıklayarak listeyi kaydedin,\n3. "Reklamları Yerleştir" butonuna tıklayarak rezervasyon ve algoritma kurallarına göre reklamları yerleştirin.'
      );
      return;
    }
    if (onSendToAdReservation) {
      onSendToAdReservation();
    }
  };

  const programsFrames = useMemo(() => {
    return programs.reduce((acc, p) => acc + (p.durationFrames || 0), 0);
  }, [programs]);

  const totalDayUsageFrames = prevOverflowFrames + programsFrames;
  const fillPercentage = Math.min(100, (totalDayUsageFrames / FRAMES_PER_DAY) * 100);
  const remainingFrames = Math.max(0, FRAMES_PER_DAY - totalDayUsageFrames);

  const isDraftAlreadyApplied = useMemo(() => {
    return programs.length > 0 && (Boolean(lastDraftAppliedAt) || programs.some(p => p.isFromDraft));
  }, [programs, lastDraftAppliedAt]);

  const draftControlSummary = useMemo(() => {
    if (!Array.isArray(draftSlotsForToday) || draftSlotsForToday.length === 0) {
      return { total: 0, addedCount: 0, missingSlots: [] };
    }
    const missingSlots = [];
    let addedCount = 0;

    draftSlotsForToday.forEach(slot => {
      const isAdded = isDraftSlotAddedToRundown(slot, programs, draftSlotsForToday, manuallyMarkedDraftSlotIds);
      if (isAdded) {
        addedCount++;
      } else {
        missingSlots.push(slot);
      }
    });

    return {
      total: draftSlotsForToday.length,
      addedCount,
      missingSlots
    };
  }, [draftSlotsForToday, programs, manuallyMarkedDraftSlotIds]);

  const unaddedReasonsMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(unaddedDraftSlots)) {
      unaddedDraftSlots.forEach(u => {
        const key = u.id || `${u.startTime}_${u.title}`;
        map.set(key, u.reason || 'Programlar listesinde eşleşen klip bulunamadı');
      });
    }
    return map;
  }, [unaddedDraftSlots]);

  const adBreaksCount = useMemo(
    () => programs.filter(p => p.type === 'ad_break').length,
    [programs]
  );

  const notFoundPrograms = useMemo(
    () => programs.filter(p => p.isNotFound),
    [programs]
  );

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {/* ANA KONTROL SATIRI: SOL (Konum + Ekle) | ORTA (Doluluk Oranı & Süre) | SAĞ (Kaydet -> Reklama İlet) */}
      <div
        style={{
          padding: '7px 12px',
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          minWidth: 0,
          overflowX: 'auto'
        }}
      >
        {/* SOL: Üst / Seçili Altı / Alt + "+ Ekle" Menüsü */}
        <SummaryActionToolbar
          adBreakDefaultSettings={adBreakDefaultSettings}
          insertPosition={insertPosition}
          setInsertPosition={setInsertPosition}
          onUpdateAdBreakDefaultSettings={onUpdateAdBreakDefaultSettings}
          onQuickAddAdBreak={onQuickAddAdBreak}
          onQuickAddFillerSlot={onQuickAddFillerSlot}
          onOpenAddModal={onOpenAddModal}
        />

        {/* ORTA: Yayın Liste Doluluk Oranı ve Süre Özeti */}
        <div style={{ display: 'flex', justifyContent: 'center', flex: '1 1 auto', minWidth: 0 }}>
          <SummaryDurationBadges
            programsCount={programs.length}
            fillPercentage={fillPercentage}
            totalDayUsageFrames={totalDayUsageFrames}
            prevOverflowFrames={prevOverflowFrames}
            nextOverflowFrames={nextOverflowFrames}
            remainingFrames={remainingFrames}
            onGoToNextDay={onGoToNextDay}
          />
        </div>

        {/* SAĞ: Listeyi Sil + Taslak Uygula + Kontrol Et + Kaydet + Reklama İlet */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', flexWrap: 'nowrap', flexShrink: 0 }}>
          {!isDraftAlreadyApplied && draftSlotsForToday.length > 0 && (
            <button
              type="button"
              disabled={isApplyingDraft}
              onClick={onApplySmartDraft}
              title="Taslaktaki programları ve klipleri otomatik uygula"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: isApplyingDraft ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
              }}
            >
              {isApplyingDraft ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
              <span>Taslak Uygula ({draftSlotsForToday.length})</span>
            </button>
          )}

          {/* KONTROL ET'İN SOLUNDA LİSTEYİ SİL BUTONU */}
          {onClearList && programs.length > 0 && (
            <button
              type="button"
              onClick={onClearList}
              title="Bu günün yayın listesini onay alarak temizle / sil"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1.5px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Trash2 size={13} />
              <span>Listeyi Sil</span>
            </button>
          )}

          {/* 1. ADIM: KONTROL ET */}
          {onSyncAndFillMissingDrafts && (programs.length > 0 || draftSlotsForToday.length > 0) && (
            <button
              type="button"
              disabled={isSyncingDraftAndArchive || isApplyingDraft}
              onClick={handleCheckClick}
              title="1. Adım: Taslak Planlamadaki güncellemeleri ve MAM Arşivdeki yeni/eksik programları kontrol eder"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: isCurrentStateChecked
                  ? '1.5px solid rgba(16, 185, 129, 0.55)'
                  : (draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0)
                  ? '1.5px solid rgba(245, 158, 11, 0.65)'
                  : '1.5px solid rgba(59, 130, 246, 0.45)',
                background: isCurrentStateChecked
                  ? 'rgba(16, 185, 129, 0.12)'
                  : (draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0)
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.18) 100%)'
                  : 'rgba(59, 130, 246, 0.12)',
                color: isCurrentStateChecked
                  ? '#15803d'
                  : (draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0)
                  ? '#d97706'
                  : 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: '800',
                cursor: (isSyncingDraftAndArchive || isApplyingDraft) ? 'wait' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {isCurrentStateChecked && !isSyncingDraftAndArchive ? (
                <CheckCircle2 size={13} />
              ) : (
                <RefreshCw
                  size={13}
                  style={{ animation: isSyncingDraftAndArchive ? 'spin 1s linear infinite' : 'none' }}
                />
              )}
              <span>
                {isSyncingDraftAndArchive
                  ? 'Taranıyor...'
                  : isCurrentStateChecked
                  ? 'Kontrol Edildi'
                  : (draftControlSummary.missingSlots.length + notFoundPrograms.length) > 0
                  ? `Kontrol Et (${draftControlSummary.missingSlots.length + notFoundPrograms.length})`
                  : 'Kontrol Et'}
              </span>
            </button>
          )}

          {/* 2. ADIM: KAYDET */}
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={programs.length === 0 || isDayLockedReadOnly}
            title={
              isDayLockedReadOnly
                ? 'Onaylanmış geçmiş gün listesi değişikliğe kapalıdır'
                : !isCurrentStateChecked
                ? 'Kaydetmeden önce "Kontrol Et" butonuna tıklayın'
                : '2. Adım: Mevcut yayın listesini kaydet (Kısayol: Ctrl+S)'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: isCurrentStateSaved
                ? '1.5px solid rgba(16, 185, 129, 0.5)'
                : isCurrentStateChecked
                ? '1.5px solid rgba(16, 185, 129, 0.5)'
                : '1.5px solid var(--border-color)',
              background: isCurrentStateSaved
                ? 'rgba(16, 185, 129, 0.14)'
                : isCurrentStateChecked
                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                : 'var(--bg-primary)',
              color: isCurrentStateSaved
                ? '#15803d'
                : isCurrentStateChecked
                ? '#ffffff'
                : 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '800',
              cursor: (programs.length === 0 || isDayLockedReadOnly) ? 'not-allowed' : 'pointer',
              opacity: (programs.length === 0 || isDayLockedReadOnly) ? 0.5 : 1,
              whiteSpace: 'nowrap',
              boxShadow: isCurrentStateChecked && !isCurrentStateSaved ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none'
            }}
          >
            {isCurrentStateSaved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            <span>{isCurrentStateSaved ? 'Kaydedildi' : 'Kaydet'}</span>
          </button>

          {/* 3. ADIM: REKLAMLARI YERLEŞTİR (Kontrol Et + Kaydet sonrası aktifleşir, Reklama İlet'ten önce zorunlu adım) */}
          <button
            type="button"
            onClick={handlePlaceAdsClick}
            disabled={programs.length === 0 || isDayLockedReadOnly}
            title={
              canPlaceAds
                ? '3. Adım: Reklam Rezervasyon algoritması ve kurallarına göre kuşaklara reklamları yerleştir'
                : 'Reklamları yerleştirmek için önce "Kontrol Et" ve "Kaydet" adımlarını tamamlayın'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              borderRadius: '8px',
              border: isCurrentStateAdsPlaced
                ? '1.5px solid rgba(12, 97, 124, 0.55)'
                : canPlaceAds
                ? 'none'
                : '1.5px solid var(--border-color)',
              background: isCurrentStateAdsPlaced
                ? 'rgba(12, 97, 124, 0.14)'
                : canPlaceAds
                ? 'linear-gradient(135deg, #0C617C 0%, #142A44 100%)'
                : 'var(--bg-primary)',
              color: isCurrentStateAdsPlaced
                ? 'var(--turkuaz, #0C617C)'
                : canPlaceAds
                ? '#ffffff'
                : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '800',
              cursor: canPlaceAds ? 'pointer' : 'not-allowed',
              opacity: canPlaceAds || isCurrentStateAdsPlaced ? 1 : 0.65,
              whiteSpace: 'nowrap',
              boxShadow: canPlaceAds && !isCurrentStateAdsPlaced ? '0 2px 8px rgba(12, 97, 124, 0.28)' : 'none'
            }}
          >
            {isCurrentStateAdsPlaced ? <CheckCircle2 size={13} /> : <Cpu size={13} />}
            <span>
              {isCurrentStateAdsPlaced
                ? `Reklamlar Yerleşti (${adBreaksCount})`
                : `Reklamları Yerleştir ${adBreaksCount > 0 ? `(${adBreaksCount})` : ''}`}
            </span>
          </button>

          {/* 4. ADIM: REKLAMA İLET (Sadece Kontrol Et + Kaydet + Reklamları Yerleştir yapıldıktan sonra aktifleşir) */}
          <button
            type="button"
            onClick={handleSendToAdsClick}
            disabled={programs.length === 0 || isDayLockedReadOnly}
            title={
              canSendToAds
                ? '4. Adım: Reklamları yerleştirilen yayın akışını Reklam Rezervasyon modülüne ilet'
                : 'Reklama iletmek için önce "Kontrol Et", "Kaydet" ve "Reklamları Yerleştir" adımlarını tamamlamalısınız'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 11px',
              borderRadius: '8px',
              border: canSendToAds ? 'none' : '1.5px solid var(--border-color)',
              background: canSendToAds
                ? 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)'
                : 'var(--bg-primary)',
              color: canSendToAds ? '#ffffff' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '800',
              cursor: canSendToAds ? 'pointer' : 'not-allowed',
              opacity: canSendToAds ? 1 : 0.65,
              whiteSpace: 'nowrap',
              boxShadow: canSendToAds ? '0 3px 10px rgba(234, 88, 12, 0.3)' : 'none'
            }}
          >
            <Send size={13} />
            <span>
              Reklama İlet {adBreaksCount > 0 ? `(${adBreaksCount})` : ''}
            </span>
          </button>
        </div>
      </div>

      {/* İNCE 24 SAAT DOLULUK ÇİZGİSİ */}
      <div
        style={{
          width: '100%',
          height: '3px',
          background: 'var(--bg-tertiary)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${fillPercentage}%`,
            height: '100%',
            background:
              nextOverflowFrames > 0
                ? '#ef4444'
                : fillPercentage >= 99.5
                ? '#10b981'
                : 'var(--accent-primary)',
            transition: 'width 0.3s ease'
          }}
        />
      </div>

      {/* SADECE EKSİK TASLAK VEYA UYARI VARSA BELİREN KOMPAKT ŞERİT */}
      <div
        style={{
          padding:
            statusBanner || draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0
              ? '4px 18px 6px'
              : 0
        }}
      >
        <SummaryClipboardAndAlerts
          statusBanner={statusBanner}
          onClearStatusBanner={onClearStatusBanner}
          draftControlSummary={draftControlSummary}
          notFoundPrograms={notFoundPrograms}
          unaddedReasonsMap={unaddedReasonsMap}
          isSyncingDraftAndArchive={isSyncingDraftAndArchive}
          onSyncAndFillMissingDrafts={onSyncAndFillMissingDrafts}
          onQuickAddMissingDraftSlot={onQuickAddMissingDraftSlot}
          onQuickAddAllMissingDraftSlots={onQuickAddAllMissingDraftSlots}
        />
      </div>
    </div>
  );
});

export default BroadcastRundownSummaryBar;
