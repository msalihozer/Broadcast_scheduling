/**
 * @file src/modules/draft/components/DraftSendToBroadcastModal.jsx
 * @description Taslak Planlama modülünde hazırlanan günlük veya haftalık taslak akışını
 * doğrudan Yayın Planlama (Ready) modülüne gönderme ve aktarma modalı.
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Send,
  Radio,
  Tv,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  X,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import useBroadcastStore, { BROADCAST_CHANNELS } from '../../broadcast/store/broadcastStore';
import { updateLiveDraftSchedule } from '../../broadcast/utils/draftDataLoader';
import useAdminLogStore from '../../../store/adminLogStore';

export default function DraftSendToBroadcastModal({
  isOpen,
  onClose,
  selectedChannel = 'ch_hd',
  channels = [],
  currentChannel,
  scheduleData = {},
  selectedDayKey = 'all',
  allDaysKeys = [],
  dateRangeLabel = '',
  preselectedDayKey = null,
  preselectedPrograms = null,
  onSaveSchedule,
  showToast,
  navigate
}) {
  // Gönderim Kapsamı: 'selected_day' | 'full_week' | 'custom_selection'
  const initialScope = useMemo(() => {
    if (preselectedPrograms && preselectedPrograms.length > 0) return 'custom_selection';
    if (preselectedDayKey && preselectedDayKey !== 'all') return 'selected_day';
    if (selectedDayKey && selectedDayKey !== 'all') return 'selected_day';
    return 'selected_day';
  }, [preselectedPrograms, preselectedDayKey, selectedDayKey]);

  const [scope, setScope] = useState(initialScope);
  const [targetList, setTargetList] = useState('A'); // 'A' | 'B'
  const [destinationMode, setDestinationMode] = useState('draft_panel'); // 'draft_panel' | 'direct_rundown'
  const [overwrite, setOverwrite] = useState(true);
  
  // Hedef Gün (Tek gün gönderilirken) - Eğer seçili gün boşsa programı olan ilk günü seç
  const [targetDayKey, setTargetDayKey] = useState(() => {
    if (preselectedDayKey && preselectedDayKey !== 'all') return preselectedDayKey;
    if (selectedDayKey && selectedDayKey !== 'all') return selectedDayKey;
    const dayWithPrograms = allDaysKeys.find(k => (scheduleData[k]?.programs?.length || 0) > 0);
    if (dayWithPrograms) return dayWithPrograms;
    return allDaysKeys[0] || '';
  });

  useEffect(() => {
    if (preselectedDayKey && preselectedDayKey !== 'all') {
      setTargetDayKey(preselectedDayKey);
      setScope('selected_day');
    } else if (selectedDayKey && selectedDayKey !== 'all') {
      setTargetDayKey(selectedDayKey);
      setScope('selected_day');
    } else if (allDaysKeys.length > 0) {
      const dayWithPrograms = allDaysKeys.find(k => (scheduleData[k]?.programs?.length || 0) > 0);
      if (dayWithPrograms) setTargetDayKey(dayWithPrograms);
    }
  }, [preselectedDayKey, selectedDayKey, allDaysKeys, scheduleData]);

  const [isSending, setIsSending] = useState(false);
  const [sentResult, setSentResult] = useState(null);

  // Modal kapandığında resetleme
  const handleClose = () => {
    setIsSending(false);
    setSentResult(null);
    onClose();
  };

  // Aktif kanal nesnesi
  const channelObj = currentChannel || channels.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0];

  // Gönderilecek programların tespiti
  const selectedDayData = scheduleData[targetDayKey] || { dayName: 'Gün', date: targetDayKey, programs: [] };
  const singleDayPrograms = selectedDayData.programs || [];

  // Haftalık toplam program sayısı
  const weeklyTotalProgramsCount = useMemo(() => {
    return Object.values(scheduleData).reduce((acc, d) => acc + (d.programs?.length || 0), 0);
  }, [scheduleData]);

  // Önizleme yapılacak program listesi
  const previewPrograms = useMemo(() => {
    if (scope === 'custom_selection' && preselectedPrograms) {
      return preselectedPrograms;
    }
    if (scope === 'selected_day') {
      return singleDayPrograms;
    }
    // full_week için ilk günün programları
    const firstDay = scheduleData[allDaysKeys[0]];
    return firstDay?.programs || [];
  }, [scope, preselectedPrograms, singleDayPrograms, scheduleData, allDaysKeys]);

  // Toplam süre hesaplama
  const previewTotalDurationMin = useMemo(() => {
    return previewPrograms.reduce((acc, p) => acc + (parseInt(p.duration, 10) || 30), 0);
  }, [previewPrograms]);

  // GÖNDERME EYLEMİ
  const handleExecuteSend = async () => {
    setIsSending(true);

    try {
      // 1. Önce mevcut taslak akışını kaydet
      if (onSaveSchedule) {
        try {
          await onSaveSchedule();
        } catch (e) {
          console.warn('Otomatik taslak kaydı hatası (gönderime devam ediliyor):', e);
        }
      }

      const broadcastStore = useBroadcastStore.getState();
      const adminLog = useAdminLogStore.getState();

      let resultInfo = {
        scope,
        channelName: channelObj?.name || 'Kanal',
        targetList,
        destinationMode,
        count: 0,
        dayOrWeekLabel: ''
      };

      // Her iki modda da önce Günün Taslağı önbelleğini ve sunucuyu senkronize et
      const storageKey = `draft_schedule_${selectedChannel}`;
      let savedSchedule = {};
      try {
        const existing = localStorage.getItem(storageKey);
        if (existing) savedSchedule = JSON.parse(existing);
      } catch (e) {}

      let count = 0;
      let dayOrWeekLabel = '';

      if (scope === 'selected_day') {
        savedSchedule[targetDayKey] = {
          dayName: selectedDayData.dayName,
          date: targetDayKey,
          programs: singleDayPrograms
        };
        count = singleDayPrograms.length;
        dayOrWeekLabel = `${selectedDayData.dayName} (${selectedDayData.date})`;
      } else if (scope === 'full_week') {
        allDaysKeys.forEach(dKey => {
          if (scheduleData[dKey]) {
            savedSchedule[dKey] = {
              dayName: scheduleData[dKey].dayName || 'Gün',
              date: dKey,
              programs: scheduleData[dKey].programs || []
            };
            count += (scheduleData[dKey].programs?.length || 0);
          }
        });
        dayOrWeekLabel = `Tüm Hafta (${dateRangeLabel || '7 Gün'})`;
      } else if (scope === 'custom_selection' && preselectedPrograms) {
        savedSchedule[targetDayKey] = {
          dayName: selectedDayData.dayName,
          date: targetDayKey,
          programs: preselectedPrograms
        };
        count = preselectedPrograms.length;
        dayOrWeekLabel = `${preselectedPrograms.length} Özel Seçili Program`;
      }

      updateLiveDraftSchedule(selectedChannel, savedSchedule);
      try {
        await fetch('/api/saveDraftSchedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: selectedChannel, schedule: savedSchedule })
        });
      } catch (e) {}
      broadcastStore.notifyDraftUpdated(selectedChannel);

      // 1. SOL PANELE (GÜNÜN TASLAĞI) AKTARIM MODU (VARSAYILAN / KULLANICI İSTEĞİ)
      if (destinationMode === 'draft_panel') {
        broadcastStore.setSelectedChannel(selectedChannel);
        broadcastStore.setSelectedDate(scope === 'full_week' ? (allDaysKeys[0] || targetDayKey) : targetDayKey);
        broadcastStore.setDraftSidebarOpen(true);
        broadcastStore.setActiveSidebarTab('draft');

        adminLog.addLog({
          panel: 'system',
          action: 'Taslak Günün Taslağı Paneline Aktarıldı',
          details: `${channelObj?.name} - ${dayOrWeekLabel} taslağı Yayın Planlama sol paneline aktarıldı (Sağ akışa doğrudan uygulanmadı).`,
          count,
          status: 'success'
        });

        resultInfo.count = count;
        resultInfo.dayOrWeekLabel = dayOrWeekLabel;
        resultInfo.destinationMode = 'draft_panel';

        setSentResult(resultInfo);
        if (showToast) {
          showToast(`✓ Taslak sol paneldeki 'Günün Taslağı' alanına aktarıldı! (${count} Kuşak)`, 'success', 3500);
        }
        return;
      }

      // 2. DOĞRUDAN SAĞ AKIŞA UYGULAMA MODU (İSTEĞE BAĞLI)
      if (scope === 'selected_day') {
        const res = broadcastStore.receiveDraftFromPlanner({
          channelId: selectedChannel,
          dateStr: targetDayKey,
          programs: singleDayPrograms,
          targetList,
          overwrite
        });

        resultInfo.count = res.count;
        resultInfo.dayOrWeekLabel = `${selectedDayData.dayName} (${selectedDayData.date})`;

        adminLog.addLog({
          panel: 'system',
          action: 'Taslak Yayına Gönderildi',
          details: `${channelObj?.name} - ${resultInfo.dayOrWeekLabel} taslağı Yayın Planlama (Liste ${targetList}) akışına aktarıldı.`,
          count: res.count,
          status: 'success'
        });
      } else if (scope === 'full_week') {
        const weekSchedule = {};
        allDaysKeys.forEach(dKey => {
          if (scheduleData[dKey]) {
            weekSchedule[dKey] = scheduleData[dKey].programs || [];
          }
        });

        const res = broadcastStore.receiveDraftWeekFromPlanner({
          channelId: selectedChannel,
          weekSchedule,
          targetList,
          overwrite,
          initialDateStr: allDaysKeys[0]
        });

        resultInfo.count = res.count;
        resultInfo.dayOrWeekLabel = `Tüm Hafta (${dateRangeLabel || '7 Gün'})`;

        adminLog.addLog({
          panel: 'system',
          action: 'Taslak Yayına Gönderildi (Haftalık)',
          details: `${channelObj?.name} - ${dateRangeLabel} haftalık taslağı Yayın Planlama (Liste ${targetList}) akışına aktarıldı.`,
          count: res.count,
          status: 'success'
        });
      } else if (scope === 'custom_selection' && preselectedPrograms) {
        const res = broadcastStore.receiveDraftFromPlanner({
          channelId: selectedChannel,
          dateStr: targetDayKey,
          programs: preselectedPrograms,
          targetList,
          overwrite: false
        });

        resultInfo.count = res.count;
        resultInfo.dayOrWeekLabel = `${preselectedPrograms.length} Özel Seçili Program`;

        adminLog.addLog({
          panel: 'system',
          action: 'Seçili Taslak Programları Yayına Gönderildi',
          details: `${channelObj?.name} - ${res.count} program Yayın Planlama (Liste ${targetList}) akışına aktarıldı.`,
          count: res.count,
          status: 'success'
        });
      }

      setSentResult(resultInfo);
      if (showToast) {
        showToast(`✓ Taslak akışı doğrudan Yayın Planlama tablosuna aktarıldı! (${resultInfo.count} Program)`, 'success', 3500);
      }
    } catch (err) {
      console.error('Yayına gönderme hatası:', err);
      if (showToast) {
        showToast(`Gönderme sırasında hata oluştu: ${err.message}`, 'error', 4000);
      }
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
        overflow: 'hidden'
      }}>

        {/* MODAL BAŞLIĞI */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.35)'
            }}>
              <Send size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Taslağı Yayına Gönder
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Hazırlanan taslak akışını Yayın Planlama (Ready) ekranına aktarın
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* İÇERİK ALANI */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* BAŞARILI GÖNDERİM EKRANI (SUCCESS STATE) */}
          {sentResult ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '20px 10px',
              gap: '16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 24px rgba(16, 185, 129, 0.25)'
              }}>
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  {sentResult.destinationMode === 'draft_panel' 
                    ? 'Taslak Sol Panele Başarıyla Aktarıldı!' 
                    : 'Taslak Yayına Başarıyla Gönderildi!'}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '460px', margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--accent-primary)' }}>{sentResult.channelName}</strong> kanalının{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{sentResult.dayOrWeekLabel}</strong> taslağı{' '}
                  ({sentResult.count} Program/Kuşak){' '}
                  {sentResult.destinationMode === 'draft_panel' ? (
                    <span>
                      Yayın Planlama'daki <strong>Günün Taslağı (Sol Panel)</strong> listesine aktarıldı. Sağdaki yayın akışına doğrudan uygulanmadı; sol panelden istediğiniz programları ve en yeni klipleri akışa ekleyebilirsiniz.
                    </span>
                  ) : (
                    <span>Yayın Planlama (Liste {sentResult.targetList}) akışına doğrudan aktarıldı.</span>
                  )}
                </p>
              </div>

              {/* Hızlı Eylem Kartı */}
              <div style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px',
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Hedef Alan:</span>
                  <span style={{ fontWeight: 700, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Radio size={13} /> {sentResult.destinationMode === 'draft_panel' ? 'Yayın Planlama • Sol Panel (Günün Taslağı)' : `Yayın Akışı • Liste ${sentResult.targetList}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Toplam Program/Kuşak:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sentResult.count} Kuşak</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sol Panel Durumu:</span>
                  <span style={{ fontWeight: 800, color: '#10b981' }}>Otomatik Açık ve Hazır</span>
                </div>
              </div>

              {/* Butonlar */}
              <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '11px 16px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Taslakta Kal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    if (navigate) navigate('/ready');
                  }}
                  style={{
                    flex: 1.5,
                    padding: '11px 16px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)'
                  }}
                >
                  <span>Yayın Planlama Ekranına Git</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* KANAL VE HEDEF GÖSTERGESİ */}
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: 'var(--accent-primary)',
                    fontSize: '13px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Tv size={14} />
                    <span>{channelObj?.name || 'Semerkand HD'}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Kaynak: Taslak</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '12px' }}>aktarılıyor</span>
                  <ArrowRight size={14} color="var(--accent-primary)" />
                </div>

                <div style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Radio size={14} />
                  <span>Yayın Planlama</span>
                </div>
              </div>

              {/* 1. GÖNDERİM KAPSAMI SEÇİMİ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  1. Gönderim Kapsamı
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: preselectedPrograms ? '1fr 1fr 1fr' : '1fr 1fr', gap: '10px' }}>
                  {/* Seçili Gün */}
                  <div
                    onClick={() => setScope('selected_day')}
                    style={{
                      border: '2px solid',
                      borderColor: scope === 'selected_day' ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: scope === 'selected_day' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Seçili Gün
                      </span>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: scope === 'selected_day' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        background: scope === 'selected_day' ? 'var(--accent-primary)' : 'transparent'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {selectedDayData.dayName} ({singleDayPrograms.length} Kuşak)
                    </div>
                  </div>

                  {/* Tüm Hafta */}
                  <div
                    onClick={() => setScope('full_week')}
                    style={{
                      border: '2px solid',
                      borderColor: scope === 'full_week' ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: scope === 'full_week' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Tüm Hafta (7 Gün)
                      </span>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: scope === 'full_week' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        background: scope === 'full_week' ? 'var(--accent-primary)' : 'transparent'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      7 Gün Toplamı ({weeklyTotalProgramsCount} Kuşak)
                    </div>
                  </div>

                  {/* Özel Seçim (Varsa) */}
                  {preselectedPrograms && (
                    <div
                      onClick={() => setScope('custom_selection')}
                      style={{
                        border: '2px solid',
                        borderColor: scope === 'custom_selection' ? 'var(--accent-primary)' : 'var(--border-color)',
                        background: scope === 'custom_selection' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Seçili Programlar
                        </span>
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: '2px solid',
                          borderColor: scope === 'custom_selection' ? 'var(--accent-primary)' : 'var(--text-muted)',
                          background: scope === 'custom_selection' ? 'var(--accent-primary)' : 'transparent'
                        }} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {preselectedPrograms.length} Özel Seçim
                      </div>
                    </div>
                  )}
                </div>

                {/* Eğer Seçili Gün seçildiyse gün değiştirme seçeneği */}
                {scope === 'selected_day' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Gönderilecek Gün:</span>
                    <select
                      value={targetDayKey}
                      onChange={(e) => setTargetDayKey(e.target.value)}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '5px 10px',
                        borderRadius: '7px',
                        fontSize: '12px',
                        fontWeight: 700,
                        outline: 'none'
                      }}
                    >
                      {allDaysKeys.map(dKey => {
                        const d = scheduleData[dKey] || { dayName: 'Gün', date: dKey, programs: [] };
                        return (
                          <option key={dKey} value={dKey}>
                            {d.dayName} - {d.date} ({d.programs?.length || 0} Kuşak)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* 2. GÖNDERİM HEDEFİ VE UYGULAMA ŞEKLİ (KULLANICI TALEBİ) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  2. Gönderim Hedefi ve Uygulama Şekli
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {/* Sol Panele Aktar (Günün Taslağı) - Önerilen */}
                  <div
                    onClick={() => setDestinationMode('draft_panel')}
                    style={{
                      border: '2px solid',
                      borderColor: destinationMode === 'draft_panel' ? '#10b981' : 'var(--border-color)',
                      background: destinationMode === 'draft_panel' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: destinationMode === 'draft_panel' ? '#10b981' : 'var(--text-primary)' }}>
                        Sol Panele Aktar (Günün Taslağı)
                      </span>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: destinationMode === 'draft_panel' ? '#10b981' : 'var(--text-muted)',
                        background: destinationMode === 'draft_panel' ? '#10b981' : 'transparent'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      <strong style={{ color: '#10b981' }}>Önerilen:</strong> Yayın akışına doğrudan uygulanmaz. Sol panelde görünür; program ve klipleri oradan seçerek eklersiniz.
                    </div>
                  </div>

                  {/* Doğrudan Yayın Akışına Uygula */}
                  <div
                    onClick={() => setDestinationMode('direct_rundown')}
                    style={{
                      border: '2px solid',
                      borderColor: destinationMode === 'direct_rundown' ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: destinationMode === 'direct_rundown' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Doğrudan Akışa Uygula
                      </span>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: destinationMode === 'direct_rundown' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        background: destinationMode === 'direct_rundown' ? 'var(--accent-primary)' : 'transparent'
                      }} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Sağdaki yayın akışı tablosuna doğrudan Liste A veya Liste B olarak yazar.
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. DOĞRUDAN UYGULAMA AYARLARI (Yalnızca doğrudan akışa seçildiğinde) */}
              {destinationMode === 'direct_rundown' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    3. Hedef Yayın Listesi
                  </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setTargetList('A')}
                    style={{
                      border: '2px solid',
                      borderColor: targetList === 'A' ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: targetList === 'A' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Liste A <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700 }}>(Önerilen)</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Ana yayın akış listesi
                      </div>
                    </div>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: targetList === 'A' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      background: targetList === 'A' ? 'var(--accent-primary)' : 'transparent'
                    }} />
                  </div>

                  <div
                    onClick={() => setTargetList('B')}
                    style={{
                      border: '2px solid',
                      borderColor: targetList === 'B' ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: targetList === 'B' ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Liste B
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Alternatif / Yedek yayın akışı
                      </div>
                    </div>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: targetList === 'B' ? 'var(--accent-primary)' : 'var(--text-muted)',
                      background: targetList === 'B' ? 'var(--accent-primary)' : 'transparent'
                    }} />
                  </div>
                </div>

                {/* AKTARIM SEÇENEKLERİ */}
                <div style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginTop: '10px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Mevcut Yayın Akışının Üzerine Yaz (Temiz Aktarım)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Hedef günün yayın akışını temizleyip taslaktaki programları sıfırdan 00:00:00.00 olarak başlatır.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              )}

              {/* ÖNİZLEME KUTUSU */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Aktarılacak Program Önizlemesi ({previewPrograms.length} Kuşak • {previewTotalDurationMin} dk)
                  </span>
                </div>

                <div style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  {previewPrograms.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Bu gün için henüz program eklenmemiş.
                    </div>
                  ) : (
                    previewPrograms.slice(0, 6).map((p, idx) => {
                      const isLive = Boolean(
                        p.isLive ||
                        (Array.isArray(p.selectedOptions) && p.selectedOptions.includes('Canlı')) ||
                        /\bcanl[ıi]\b/i.test(`${p.rawTitle || ''} ${p.title || ''} ${p.host || ''}`)
                      );
                      return (
                        <div
                          key={p.instanceId || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            borderBottom: idx < 5 ? '1px solid var(--border-light)' : 'none',
                            paddingBottom: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)', width: '20px' }}>
                              #{idx + 1}
                            </span>
                            <span style={{ fontWeight: 700, color: isLive ? '#dc2626' : 'var(--text-primary)' }}>
                              {p.title || p.name}
                            </span>
                            {p.episode && (
                              <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.14)', color: '#d97706', fontWeight: 800 }}>
                                B.{p.episode}
                              </span>
                            )}
                            {isLive && (
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: '#ef4444',
                                color: '#ffffff',
                                fontWeight: 900
                              }}>
                                ● CANLI YAYIN
                              </span>
                            )}
                            {p.category && (
                              <span style={{
                                fontSize: '9px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent-primary)',
                                fontWeight: 700
                              }}>
                                {p.category}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
                              {p.duration || 30} dk
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {previewPrograms.length > 5 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '4px' }}>
                      ve {previewPrograms.length - 5} kuşak daha...
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* MODAL AKSİYONLARI (SABİT ALT BAR) */}
        {!sentResult && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSending}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Vazgeç
            </button>

            <button
              type="button"
              onClick={handleExecuteSend}
              disabled={isSending || previewPrograms.length === 0}
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                background: previewPrograms.length === 0
                  ? 'var(--bg-tertiary)'
                  : destinationMode === 'draft_panel'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                border: 'none',
                color: previewPrograms.length === 0 ? 'var(--text-muted)' : '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: previewPrograms.length === 0 ? 'not-allowed' : (isSending ? 'wait' : 'pointer'),
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: previewPrograms.length === 0 
                  ? 'none' 
                  : destinationMode === 'draft_panel' 
                  ? '0 4px 14px rgba(16, 185, 129, 0.4)' 
                  : '0 4px 14px rgba(14, 165, 233, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              {isSending ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Aktarılıyor...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>{destinationMode === 'draft_panel' ? 'Sol Panele Aktar (Günün Taslağı)' : 'Yayına Gönder'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
