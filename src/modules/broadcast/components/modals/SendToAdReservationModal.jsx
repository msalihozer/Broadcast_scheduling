/**
 * @file src/modules/broadcast/components/modals/SendToAdReservationModal.jsx
 * @description Yayın Planlama tamamlandıktan sonra "Reklam Rezervasyona İlet" butonuna basıldığında açılan
 * Ön Kontrol, Zaman/Süre Doğrulama, Liste Kayıt ve Reklam Rezervasyon İletim Pop-up Modalı.
 *
 * Özellikler:
 * 1. Gün başlangıç-bitiş saati, 24 saat doluluk oranı, eksik süre ve ertesi güne sarkma (overflow) kontrolü
 * 2. Otomatik Ön Kontrol Listesi (Checklist): Zaman sürekliliği, reklam kuşağı kontrolü, boş dolgu kuşağı kontrolü, taslak kontrolü
 * 3. Modal içinden çıkmadan tek tıkla "+ Hızlı Reklam Kuşağı Ekle" veya "Listeyi Kaydet" imkanı
 * 4. İletilecek tüm yayın listesinin (veya sadece reklam kuşaklarının) saat, süre, bölüm/part ve tür bilgileriyle tablo önizlemesi
 * 5. Onaylandığında listeyi kaydedip (`saveDaySchedule`) Reklam Rezervasyon modülüne (`sendDayToAdReservation`) liste olarak iletme
 */
import React, { useState, useMemo } from 'react';
import {
  Send, X, CheckCircle2, AlertTriangle, Clock, Megaphone, Film,
  Sparkles, Save, ExternalLink, Search, Plus, Radio, Layers, Calendar, Tv
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BROADCAST_CHANNELS } from '../../store/broadcastStore';
import {
  BROADCAST_FPS,
  FRAMES_PER_DAY,
  framesToTimecode,
  formatFramesHuman
} from '../../utils/timecodeUtils';
import {
  parseTimecodeDisplay,
  resolveItemUnitDisplay
} from '../../utils/rundownHelpers';
import { isDraftSlotAddedToRundown } from '../DraftProgramSlotItem';

export default function SendToAdReservationModal({
  isOpen,
  onClose,
  selectedChannel,
  selectedDate,
  activeList = 'A',
  programs = [],
  draftSlotsForToday = [],
  prevOverflowFrames = 0,
  nextOverflowFrames = 0,
  adBreakDefaultSettings,
  lastSavedAt = null,
  lastSentToAdsAt = null,
  onSaveSchedule,
  onQuickAddAdBreak,
  onConfirmSendToAds
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ads' | 'warnings'
  const [searchQuery, setSearchQuery] = useState('');
  const [sentSuccessInfo, setSentSuccessInfo] = useState(null);

  const channelObj = useMemo(
    () => BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0],
    [selectedChannel]
  );

  // Zaman ve Süre Hesaplamaları
  const timeStats = useMemo(() => {
    const programsFrames = programs.reduce((acc, p) => acc + (p.durationFrames || 0), 0);
    const totalDayUsageFrames = prevOverflowFrames + programsFrames;
    const remainingFrames = Math.max(0, FRAMES_PER_DAY - totalDayUsageFrames);
    const fillPercentage = Math.min(100, (totalDayUsageFrames / FRAMES_PER_DAY) * 100);

    const startTc = programs.length > 0
      ? programs[0].calculatedStartTime
      : framesToTimecode(prevOverflowFrames);
    const endTc = programs.length > 0
      ? programs[programs.length - 1].calculatedEndTime
      : startTc;

    const startDisp = parseTimecodeDisplay(startTc);
    const endDisp = parseTimecodeDisplay(endTc);

    const adBreaks = programs.filter(p => p.type === 'ad_break');
    const totalAdFrames = adBreaks.reduce((acc, p) => acc + (p.durationFrames || 0), 0);
    const totalAdMin = Math.round((totalAdFrames / BROADCAST_FPS) / 60);

    const emptyFillerSlots = programs.filter(p => p.type === 'filler_slot');
    const liveItems = programs.filter(p => p.type === 'live' || p.isLive);
    const introItems = programs.filter(p => p.isIntroClip || p.unitType === 'intro');
    const overflowItems = programs.filter(p => p.isOverflow);

    const missingDraftSlots = (draftSlotsForToday || []).filter(
      slot => !isDraftSlotAddedToRundown(slot, programs, draftSlotsForToday)
    );

    return {
      programsFrames,
      totalDayUsageFrames,
      remainingFrames,
      fillPercentage,
      startClock: startDisp.hhmmss,
      endClock: endDisp.hhmmss,
      adBreaks,
      totalAdFrames,
      totalAdMin,
      emptyFillerSlots,
      liveItems,
      introItems,
      overflowItems,
      missingDraftSlots
    };
  }, [programs, prevOverflowFrames, draftSlotsForToday]);

  // Sekme ve Arama Filtresi
  const filteredRows = useMemo(() => {
    let base = programs;
    if (activeTab === 'ads') {
      base = programs.filter(p => p.type === 'ad_break');
    } else if (activeTab === 'warnings') {
      base = programs.filter(p => p.type === 'filler_slot' || p.isOverflow);
    }

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter(item => {
      const startDisp = parseTimecodeDisplay(item.calculatedStartTime);
      const endDisp = parseTimecodeDisplay(item.calculatedEndTime);
      return (
        (item.clipName || item.title || item.name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        startDisp.hhmmss.includes(q) ||
        endDisp.hhmmss.includes(q) ||
        String(item.order || '').includes(q)
      );
    });
  }, [programs, activeTab, searchQuery]);

  if (!isOpen) return null;

  const warningRowsCount = timeStats.emptyFillerSlots.length + timeStats.overflowItems.length;
  const isDurationHealthy = timeStats.remainingFrames === 0 && nextOverflowFrames === 0;

  const handleCloseModal = () => {
    setSentSuccessInfo(null);
    setActiveTab('all');
    setSearchQuery('');
    onClose();
  };

  const handleConfirmAndSend = () => {
    if (!onConfirmSendToAds) return;
    const res = onConfirmSendToAds();
    if (res?.success) {
      setSentSuccessInfo({
        sentAt: new Date(res.sentToAdsAt || Date.now()).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        totalCount: res.totalCount || programs.length,
        adBreakCount: res.adBreakCount ?? timeStats.adBreaks.length,
        totalAdMin: timeStats.totalAdMin
      });
    }
  };

  return (
    <div
      onClick={handleCloseModal}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 10, 22, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1040px',
          maxHeight: '90vh',
          background: 'var(--bg-secondary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '18px',
          boxShadow: '0 28px 65px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* 1. ÜST BAŞLIK (HEADER) */}
        <div style={{
          padding: '16px 22px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ea580c 0%, #d97706 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(234, 88, 12, 0.35)',
              flexShrink: 0
            }}>
              <Send size={21} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)' }}>
                  Reklam Rezervasyona İlet — Ön Kontrol & Liste Onayı
                </h2>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(234, 88, 12, 0.15)',
                  color: '#ea580c',
                  border: '1px solid rgba(234, 88, 12, 0.35)'
                }}>
                  Liste {activeList}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginTop: '3px',
                flexWrap: 'wrap'
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  <Tv size={13} color="var(--accent-primary)" />
                  {channelObj.name}
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '700', color: 'var(--text-primary)' }}>
                  <Calendar size={13} color="var(--accent-primary)" />
                  {selectedDate}
                </span>
                <span>•</span>
                <span>
                  {lastSavedAt
                    ? `Son Kayıt: ${new Date(lastSavedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Gönderim sırasında otomatik kaydedilecek'}
                </span>
                {lastSentToAdsAt && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#10b981', fontWeight: '700' }}>
                      Daha Önce İletildi ({new Date(lastSentToAdsAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* GÖNDERİM TAMAMLANDIYSA BAŞARI VE YÖNLENDİRME EKRANI */}
        {sentSuccessInfo ? (
          <div style={{
            padding: '36px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '18px'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.16)',
              border: '2px solid rgba(16, 185, 129, 0.45)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 30px rgba(16, 185, 129, 0.25)'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>
                Yayın Listesi Kaydedildi ve Reklam Rezervasyona İletildi!
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                <strong>{channelObj.name}</strong> • <strong>{selectedDate} (Liste {activeList})</strong> akışı kontrol edilerek liste halinde Reklam Rezervasyon modülüne aktarıldı.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))',
              gap: '12px',
              width: '100%',
              maxWidth: '720px',
              marginTop: '4px'
            }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>İLETİLEN LİSTE</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '4px' }}>
                  Liste {activeList} ({sentSuccessInfo.totalCount} Öğe)
                </div>
              </div>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>REKLAM KUŞAKLARI</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#ea580c', marginTop: '4px' }}>
                  {sentSuccessInfo.adBreakCount} Kuşak ({sentSuccessInfo.totalAdMin} dk)
                </div>
              </div>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>ZAMAN ARALIĞI</div>
                <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '4px', fontFamily: 'monospace' }}>
                  {timeStats.startClock} → {timeStats.endClock}
                </div>
              </div>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700' }}>KAYIT & İLETİM SAATİ</div>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#10b981', marginTop: '4px' }}>
                  ✓ {sentSuccessInfo.sentAt}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleCloseModal}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Yayın Planlamada Kal
              </button>

              <button
                type="button"
                onClick={() => {
                  handleCloseModal();
                  navigate('/ads');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #ea580c 0%, #d97706 100%)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(234, 88, 12, 0.35)'
                }}
              >
                <span>Reklam Rezervasyon Modülünü Aç</span>
                <ExternalLink size={15} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 2. ZAMAN, DOLULUK VE KUŞAK ÖN KONTROL KARTLARI */}
            <div style={{
              padding: '16px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-primary)'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: '12px'
              }}>
                {/* Kart 1: Başlangıç & Bitiş Saati */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Zaman Aralığı (Başlangıç → Bitiş)
                  </span>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '900',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Clock size={15} color="var(--accent-primary)" />
                    <span>{timeStats.startClock}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>→</span>
                    <span>{timeStats.endClock}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {prevOverflowFrames > 0
                      ? `Dünden Devir: +${formatFramesHuman(prevOverflowFrames)}`
                      : 'Gün Başlangıcı: 00:00:00'}
                  </span>
                </div>

                {/* Kart 2: 24 Saatlik Doluluk & Toplam Süre */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      24 Saatlik Doluluk
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '900',
                      color: timeStats.fillPercentage >= 99.5 ? '#10b981' : '#3b82f6'
                    }}>
                      %{timeStats.fillPercentage.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: 'var(--text-primary)' }}>
                    {formatFramesHuman(timeStats.totalDayUsageFrames)}{' '}
                    <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                      / 24 sa
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '999px',
                    background: 'var(--bg-tertiary)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${timeStats.fillPercentage}%`,
                      height: '100%',
                      background: nextOverflowFrames > 0
                        ? '#ef4444'
                        : timeStats.fillPercentage >= 99.5
                        ? '#10b981'
                        : '#3b82f6'
                    }} />
                  </div>
                </div>

                {/* Kart 3: Süre & Sarkma Kontrol Durumu */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isDurationHealthy
                    ? 'rgba(16, 185, 129, 0.1)'
                    : nextOverflowFrames > 0
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(245, 158, 11, 0.1)',
                  border: isDurationHealthy
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : nextOverflowFrames > 0
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(245, 158, 11, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Zaman & Süre Kontrolü
                  </span>
                  <div style={{
                    fontSize: '14.5px',
                    fontWeight: '900',
                    color: isDurationHealthy
                      ? '#059669'
                      : nextOverflowFrames > 0
                      ? '#dc2626'
                      : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {isDurationHealthy ? (
                      <>
                        <CheckCircle2 size={15} />
                        <span>24 Saat Tam Dolu</span>
                      </>
                    ) : nextOverflowFrames > 0 ? (
                      <>
                        <AlertTriangle size={15} />
                        <span>Sarkma: +{formatFramesHuman(nextOverflowFrames)}</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={15} />
                        <span>Eksik: {formatFramesHuman(timeStats.remainingFrames)}</span>
                      </>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {isDurationHealthy
                      ? 'Süre kontrolü kusursuz'
                      : nextOverflowFrames > 0
                      ? `${timeStats.overflowItems.length} öğe ertesi güne sarkıyor`
                      : '24 saatin dolması için kalan süre'}
                  </span>
                </div>

                {/* Kart 4: Reklam Kuşakları ve Liste İçeriği */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: timeStats.adBreaks.length > 0
                    ? 'rgba(234, 88, 12, 0.1)'
                    : 'rgba(245, 158, 11, 0.12)',
                  border: timeStats.adBreaks.length > 0
                    ? '1px solid rgba(234, 88, 12, 0.4)'
                    : '1px solid rgba(245, 158, 11, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Reklam & Liste Özeti
                  </span>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: '900',
                    color: '#ea580c',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Megaphone size={15} />
                    <span>{timeStats.adBreaks.length} Reklam Kuşağı ({timeStats.totalAdMin} dk)</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Toplam {programs.length} Öğe • {timeStats.introItems.length} İntro • {timeStats.liveItems.length} Canlı
                  </span>
                </div>
              </div>

              {/* OTOMATİK ÖN KONTROL MADDELERİ (CHECKLIST) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px' }}>
                  {/* 1. Kayıt Kontrolü */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: '700', color: '#059669' }}>
                    <CheckCircle2 size={14} color="#10b981" />
                    Liste Kaydı: Otomatik Kaydedilecek ({programs.length} satır)
                  </span>

                  {/* 2. Reklam Kuşağı Kontrolü */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: '700',
                    color: timeStats.adBreaks.length > 0 ? '#059669' : '#d97706'
                  }}>
                    {timeStats.adBreaks.length > 0 ? (
                      <CheckCircle2 size={14} color="#10b981" />
                    ) : (
                      <AlertTriangle size={14} color="#f59e0b" />
                    )}
                    {timeStats.adBreaks.length > 0
                      ? `${timeStats.adBreaks.length} Reklam Kuşağı Hazır`
                      : 'Listede Reklam Kuşağı Yok'}
                  </span>

                  {/* 3. Boş Dolgu Kuşağı Kontrolü */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: '700',
                    color: timeStats.emptyFillerSlots.length === 0 ? '#059669' : '#d97706'
                  }}>
                    {timeStats.emptyFillerSlots.length === 0 ? (
                      <CheckCircle2 size={14} color="#10b981" />
                    ) : (
                      <AlertTriangle size={14} color="#f59e0b" />
                    )}
                    {timeStats.emptyFillerSlots.length === 0
                      ? 'Boş Dolgu Kuşağı Yok'
                      : `${timeStats.emptyFillerSlots.length} Boş Dolgu Kuşağı Var`}
                  </span>

                  {/* 4. Taslak Kontrolü */}
                  {draftSlotsForToday.length > 0 && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: '700',
                      color: timeStats.missingDraftSlots.length === 0 ? '#059669' : '#d97706'
                    }}>
                      {timeStats.missingDraftSlots.length === 0 ? (
                        <CheckCircle2 size={14} color="#10b981" />
                      ) : (
                        <AlertTriangle size={14} color="#f59e0b" />
                      )}
                      {timeStats.missingDraftSlots.length === 0
                        ? 'Tüm Taslak Kuşakları Eklendi'
                        : `${timeStats.missingDraftSlots.length} Taslak Kuşağı Eklenmedi`}
                    </span>
                  )}
                </div>

                {/* Hızlı Reklam Kuşağı Ekleme Butonu */}
                {onQuickAddAdBreak && (
                  <button
                    type="button"
                    onClick={onQuickAddAdBreak}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 11px',
                      borderRadius: '7px',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      background: 'rgba(245, 158, 11, 0.14)',
                      color: '#d97706',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={13} />
                    <span>+ Reklam Kuşağı Ekle ({adBreakDefaultSettings?.defaultDurationMin || 10}dk)</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. LİSTE SEKMELERİ VE ARAMA ÇUBUĞU */}
            <div style={{
              padding: '10px 22px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: activeTab === 'all' ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: activeTab === 'all' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                    color: activeTab === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  📋 İletilecek Tüm Yayın Listesi ({programs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ads')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: activeTab === 'ads' ? '1.5px solid #ea580c' : '1px solid var(--border-color)',
                    background: activeTab === 'ads' ? 'rgba(234, 88, 12, 0.15)' : 'var(--bg-primary)',
                    color: activeTab === 'ads' ? '#ea580c' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  📢 Sadece Reklam Kuşakları ({timeStats.adBreaks.length})
                </button>

                {warningRowsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('warnings')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: activeTab === 'warnings' ? '1.5px solid #f59e0b' : '1px solid var(--border-color)',
                      background: activeTab === 'warnings' ? 'rgba(245, 158, 11, 0.16)' : 'var(--bg-primary)',
                      color: activeTab === 'warnings' ? '#d97706' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ Dikkat Edilecek Satırlar ({warningRowsCount})
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', width: '240px' }}>
                <Search
                  size={13}
                  color="var(--text-secondary)"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Listede saat veya klip ara..."
                  style={{
                    width: '100%',
                    padding: '6px 26px 6px 28px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 4. İLETİLECEK YAYIN LİSTESİ VE ZAMAN TABLOSU */}
            <div style={{
              flex: 1,
              minHeight: '220px',
              maxHeight: '42vh',
              overflowY: 'auto',
              background: 'var(--bg-primary)'
            }}>
              {/* Tablo Başlığı */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '50px 185px 130px 1fr 140px 120px',
                columnGap: '10px',
                padding: '8px 18px',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: '900',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                position: 'sticky',
                top: 0,
                zIndex: 5
              }}>
                <div>#</div>
                <div>Başlangıç → Bitiş</div>
                <div>Süre</div>
                <div>Klip / Program / Kuşak Adı</div>
                <div>Bölüm / Part</div>
                <div>Tür</div>
              </div>

              {filteredRows.length === 0 ? (
                <div style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}>
                  Bu filtreye uygun yayın satırı bulunamadı.
                </div>
              ) : (
                filteredRows.map((item, idx) => {
                  const startInfo = parseTimecodeDisplay(item.calculatedStartTime);
                  const endInfo = parseTimecodeDisplay(item.calculatedEndTime);
                  const durInfo = parseTimecodeDisplay(item.durationTc);
                  const isAd = item.type === 'ad_break';
                  const isFiller = item.type === 'filler_slot';
                  const isLive = item.type === 'live' || item.isLive;
                  const isIntro = item.isIntroClip || item.unitType === 'intro';
                  const unitInfo = resolveItemUnitDisplay(item);
                  const displayName = item.clipName || item.title || item.name || 'İsimsiz Öğe';

                  return (
                    <div
                      key={item.instanceId || idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '50px 185px 130px 1fr 140px 120px',
                        columnGap: '10px',
                        alignItems: 'center',
                        padding: '8px 18px',
                        borderBottom: '1px solid var(--border-color)',
                        borderLeft: isAd
                          ? '4px solid #ea580c'
                          : isLive
                          ? '4px solid #ef4444'
                          : isFiller
                          ? '4px solid #8b5cf6'
                          : isIntro
                          ? '4px solid #6366f1'
                          : '4px solid #3b82f6',
                        background: isAd
                          ? 'rgba(234, 88, 12, 0.08)'
                          : isFiller
                          ? 'rgba(139, 92, 246, 0.08)'
                          : item.isOverflow
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'transparent',
                        fontSize: '12.5px'
                      }}
                    >
                      {/* 1. Sıra */}
                      <div style={{ fontWeight: '800', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        #{item.order || idx + 1}
                      </div>

                      {/* 2. Başlangıç -> Bitiş Saati */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'monospace', fontWeight: '800' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{startInfo.hhmmss}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>→</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{endInfo.hhmmss}</span>
                        {item.isOverflow && (
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '900',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.16)',
                            color: '#ef4444'
                          }}>
                            SARKMA
                          </span>
                        )}
                      </div>

                      {/* 3. Süre */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontWeight: '800',
                          color: isAd ? '#ea580c' : 'var(--text-primary)'
                        }}>
                          {formatFramesHuman(item.durationFrames || 0)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          ({durInfo.hhmmss})
                        </span>
                      </div>

                      {/* 4. Klip / Program Adı */}
                      <div style={{
                        fontWeight: '800',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={displayName}>
                        {displayName}
                      </div>

                      {/* 5. Bölüm / Part */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {unitInfo.unitLabel && !isIntro && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: 'var(--accent-primary)'
                          }}>
                            {unitInfo.unitLabel}
                          </span>
                        )}
                        {item.partNo && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            borderRadius: '5px',
                            background: 'rgba(139, 92, 246, 0.14)',
                            color: '#7c3aed'
                          }}>
                            Part {item.partNo}
                          </span>
                        )}
                        {!unitInfo.unitLabel && !item.partNo && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>—</span>
                        )}
                      </div>

                      {/* 6. Tür */}
                      <div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isAd
                            ? 'rgba(234, 88, 12, 0.16)'
                            : isLive
                            ? 'rgba(239, 68, 68, 0.16)'
                            : isFiller
                            ? 'rgba(139, 92, 246, 0.16)'
                            : isIntro
                            ? 'rgba(99, 102, 241, 0.16)'
                            : 'rgba(20, 184, 166, 0.14)',
                          color: isAd
                            ? '#ea580c'
                            : isLive
                            ? '#ef4444'
                            : isFiller
                            ? '#7c3aed'
                            : isIntro
                            ? '#6366f1'
                            : '#0d9488'
                        }}>
                          {isAd
                            ? 'Reklam Kuşağı'
                            : isLive
                            ? 'Canlı Yayın'
                            : isFiller
                            ? 'Dolgu Kuşağı'
                            : isIntro
                            ? 'İntro'
                            : item.isFillerClip
                            ? 'Dolgu Klibi'
                            : 'Klip / Program'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 5. ALT ONAY VE AKSİYON ÇUBUĞU (FOOTER) */}
            <div style={{
              padding: '14px 22px',
              background: 'var(--bg-tertiary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Onayladığınızda <strong>Liste {activeList}</strong> yayın akışı kaydedilecek ve <strong>{programs.length} öğelik</strong> tam yayın listesi Reklam Rezervasyon modülüne iletilecektir.
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Vazgeç / Düzenlemeye Dön
                </button>

                {onSaveSchedule && (
                  <button
                    type="button"
                    onClick={onSaveSchedule}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 16px',
                      borderRadius: '10px',
                      border: '1px solid rgba(16, 185, 129, 0.45)',
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#059669',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    <Save size={14} />
                    <span>Sadece Listeyi Kaydet</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleConfirmAndSend}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #ea580c 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: '0 6px 18px rgba(234, 88, 12, 0.35)'
                  }}
                >
                  <Send size={15} />
                  <span>Listeyi Kaydet ve Reklam Rezervasyona İlet ({programs.length} Öğe)</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

