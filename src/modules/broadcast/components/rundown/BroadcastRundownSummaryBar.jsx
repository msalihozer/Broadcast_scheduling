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
import { Zap, Save, Send, Loader2, RefreshCw } from 'lucide-react';
import { FRAMES_PER_DAY } from '../../utils/timecodeUtils';
import { isDraftSlotAddedToRundown } from '../DraftProgramSlotItem';
import SummaryDurationBadges from './summary/SummaryDurationBadges';
import SummaryActionToolbar from './summary/SummaryActionToolbar';
import SummaryClipboardAndAlerts from './summary/SummaryClipboardAndAlerts';

const BroadcastRundownSummaryBar = memo(function BroadcastRundownSummaryBar({
  programs = [],
  draftSlotsForToday = [],
  unaddedDraftSlots = [],
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
  onSendToAdReservation,
  onGoToNextDay,
  onUpdateAdBreakDefaultSettings,
  onQuickAddAdBreak,
  onQuickAddFillerSlot,
  onOpenAddModal,
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
  const [savedSignature, setSavedSignature] = useState(null);

  // Mevcut listenin parmak izi: Liste değiştiğinde (ekleme/silme/süre değişimi) tekrar "Kaydet" moduna döner
  const currentSignature = useMemo(() => {
    if (!programs.length) return '';
    return `${selectedDate}_${activeList}_${programs
      .map(p => `${p.instanceId}:${p.durationFrames}:${p.title}`)
      .join('|')}`;
  }, [programs, selectedDate, activeList]);

  // Ctrl+S veya Kaydet butonu ile kaydedildiğinde imzayı senkronize et
  useEffect(() => {
    if (lastSavedAt && currentSignature) {
      setSavedSignature(currentSignature);
    }
  }, [lastSavedAt]);

  const isCurrentStateSaved = Boolean(
    programs.length > 0 && savedSignature && savedSignature === currentSignature
  );

  const handleSaveClick = () => {
    if (onSaveSchedule) {
      onSaveSchedule();
    }
    setSavedSignature(currentSignature);
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
      const isAdded = isDraftSlotAddedToRundown(slot, programs, draftSlotsForToday);
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
  }, [draftSlotsForToday, programs]);

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

        {/* SAĞ: Taslak Uygula + Kontrol Et + Kaydet (Kaydedildiğinde Reklama İlet'e dönüşür) */}
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

          {onSyncAndFillMissingDrafts && (programs.length > 0 || draftSlotsForToday.length > 0) && (
            <button
              type="button"
              disabled={isSyncingDraftAndArchive || isApplyingDraft}
              onClick={onSyncAndFillMissingDrafts}
              title="Taslak Planlamadaki güncellemeleri ve MAM Arşivdeki yeni/eksik programları kontrol eder; eklenmeyen veya yeni yüklenen programları otomatik ekler"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: (draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0)
                  ? '1.5px solid rgba(245, 158, 11, 0.65)'
                  : '1.5px solid rgba(59, 130, 246, 0.45)',
                background: (draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0)
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.18) 100%)'
                  : 'rgba(59, 130, 246, 0.12)',
                color: (draftControlSummary.missingSlots.length > 0 || notFoundPrograms.length > 0)
                  ? '#d97706'
                  : 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: '800',
                cursor: (isSyncingDraftAndArchive || isApplyingDraft) ? 'wait' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <RefreshCw
                size={13}
                style={{ animation: isSyncingDraftAndArchive ? 'spin 1s linear infinite' : 'none' }}
              />
              <span>
                {isSyncingDraftAndArchive
                  ? 'Taranıyor...'
                  : (draftControlSummary.missingSlots.length + notFoundPrograms.length) > 0
                  ? `Kontrol Et (${draftControlSummary.missingSlots.length + notFoundPrograms.length})`
                  : 'Kontrol Et'}
              </span>
            </button>
          )}

          {!isCurrentStateSaved ? (
            <button
              type="button"
              onClick={handleSaveClick}
              title="Mevcut yayın listesini kaydet (Kısayol: Ctrl+S)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1.5px solid rgba(16, 185, 129, 0.5)',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
              }}
            >
              <Save size={14} />
              <span>Kaydet</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSendToAdReservation}
              title="Kaydedilen yayın akışını Reklam Rezervasyon modülüne ilet (Kısayol: Ctrl+Shift+S veya Ctrl+Enter)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 11px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 10px rgba(234, 88, 12, 0.3)'
              }}
            >
              <Send size={13} />
              <span>
                Reklama İlet {adBreaksCount > 0 ? `(${adBreaksCount})` : ''}
              </span>
            </button>
          )}
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
