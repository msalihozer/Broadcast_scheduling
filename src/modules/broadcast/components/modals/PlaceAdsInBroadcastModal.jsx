/**
 * @file src/modules/broadcast/components/modals/PlaceAdsInBroadcastModal.jsx
 * @description Yayın Planlama (Ready) aşamasında "Reklama İlet" adımından önce çalışan
 * "Reklamları Yerleştir" Pop-up Modalı.
 * Reklam Rezervasyon modülündeki 6 katmanlı algoritma, kuşak kuralları, RTÜK giriş/çıkış jenerikleri,
 * kuşak bazlı sabit adetler ve rezervasyonlara göre reklamları otomatik yerleştirir ve özetini gösterir.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Megaphone,
  CheckCircle2,
  Cpu,
  Clock,
  Layers,
  Sparkles,
  Send,
  RefreshCw,
  Tv,
  Calendar
} from 'lucide-react';
import usePlanningStore from '../../../../store/planningStore';
import { BROADCAST_CHANNELS } from '../../store/broadcastStore';

export default function PlaceAdsInBroadcastModal({
  isOpen,
  onClose,
  selectedChannel,
  selectedDate,
  activeList = 'A',
  programs = [],
  onSaveScheduleForAds,
  onAdsPlacementComplete,
  onOpenSendToAdsModal
}) {
  const [isPlacing, setIsPlacing] = useState(false);
  const [placementDone, setPlacementDone] = useState(false);

  const reservations = usePlanningStore(state => state.reservations || []);
  const materials = usePlanningStore(state => state.materials || []);
  const companies = usePlanningStore(state => state.companies || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const adsAutoFillSettings = usePlanningStore(state => state.adsAutoFillSettings || {});
  const autoPlanAdsForDay = usePlanningStore(state => state.autoPlanAdsForDay);
  const syncAdsStoreWithServer = usePlanningStore(state => state.syncAdsStoreWithServer);

  const channelObj = useMemo(
    () => BROADCAST_CHANNELS.find(c => c.id === selectedChannel) || BROADCAST_CHANNELS[0],
    [selectedChannel]
  );

  const readyKey = `ready-${selectedChannel}-${selectedDate}`;
  const dayPlacements = adPlacements[readyKey] || [];

  const adBreaksInList = useMemo(
    () => programs.filter(p => p.type === 'ad_break'),
    [programs]
  );

  const runAlgorithmPlacement = async () => {
    setIsPlacing(true);
    try {
      // 1. Önce sunucudaki güncel rezervasyonları ve algoritmayı çek
      if (typeof syncAdsStoreWithServer === 'function') {
        await syncAdsStoreWithServer();
      }
      // 2. Yayın Planlama listesini ready-${channel}-${date} içine kaydet ki algoritma güncel kuşakları görsün
      if (typeof onSaveScheduleForAds === 'function') {
        onSaveScheduleForAds();
      }
      // 3. Kısa animasyon geçişiyle Reklam Rezervasyon algoritmasını çalıştır
      await new Promise(r => setTimeout(r, 450));
      if (typeof autoPlanAdsForDay === 'function') {
        autoPlanAdsForDay(selectedChannel, selectedDate);
      }
      setPlacementDone(true);
      if (typeof onAdsPlacementComplete === 'function') {
        onAdsPlacementComplete();
      }
    } finally {
      setIsPlacing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPlacementDone(false);
      runAlgorithmPlacement();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalPlacedCommercialSpots = dayPlacements.reduce(
    (sum, blk) => sum + (blk?.ads || []).filter(a => !a.isBumperAd).length,
    0
  );
  const totalPlacedBumpers = dayPlacements.reduce(
    (sum, blk) => sum + (blk?.ads || []).filter(a => a.isBumperAd).length,
    0
  );
  const totalPlacedDurationSec = dayPlacements.reduce(
    (sum, blk) => sum + (blk?.ads || []).reduce((s, a) => s + (Number(a.duration) || 0), 0),
    0
  );

  const quotaStrategyLabel =
    adsAutoFillSettings.quotaStrategy === 'up_to_max'
      ? 'Max Spot Sınırına Kadar'
      : adsAutoFillSettings.quotaStrategy === 'min_plus_2min'
      ? 'Min Spot + Kuşak Taban Süresi'
      : 'Akıllı Ortalama Dağılım (Min ≤ Hedef < Max)';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(6, 10, 22, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '16px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          background: 'var(--bg-secondary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* ÜST BAŞLIK */}
        <div
          style={{
            padding: '14px 20px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0C617C 0%, #142A44 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Cpu size={21} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 900, color: 'var(--text-primary)' }}>
                Reklamları Yerleştir — Dinamik Algoritma &amp; Rezervasyon Eşleştirme
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Tv size={13} color="var(--accent-primary)" /> {channelObj.name}
                </span>
                <span>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Calendar size={13} color="var(--accent-primary)" /> {selectedDate} (Liste {activeList})
                </span>
                <span>•</span>
                <span>Strateji: <strong>{quotaStrategyLabel}</strong></span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* GÖVDE */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isPlacing ? (
            <div style={{ padding: '44px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <RefreshCw size={36} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Reklam Rezervasyon Algoritması Kuşakları Dolduruyor...
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '520px' }}>
                RTÜK Giriş/Çıkış jenerikleri, program sponsorlukları, kuşak bazlı sabit spot sayıları ve günlük Min/Max kotaları hesaplanarak {adBreaksInList.length} reklam kuşağına yerleştiriliyor.
              </div>
            </div>
          ) : (
            <>
              {/* ÖZET KARTLARI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>REKLAM KUŞAĞI SAYISI</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {dayPlacements.length} Kuşak
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#047857' }}>YERLEŞEN TİCARİ SPOT</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
                    {totalPlacedCommercialSpots} Reklam Spotu
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(12, 97, 124, 0.1)', border: '1px solid rgba(12, 97, 124, 0.35)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0C617C' }}>RTÜK GİRİŞ / ÇIKIŞ JENERİĞİ</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0C617C', marginTop: '4px' }}>
                    {totalPlacedBumpers} Jenerik
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.35)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>TOPLAM REKLAM SÜRESİ</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
                    {Math.floor(totalPlacedDurationSec / 60)} dk {totalPlacedDurationSec % 60} sn
                  </div>
                </div>
              </div>

              {/* KUŞAK BAZLI YERLEŞİM LİSTESİ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Kuşaklara Yerleştirilen Reklamlar ({dayPlacements.length} Kuşak)
                  </span>
                  <button
                    type="button"
                    onClick={runAlgorithmPlacement}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Algoritmayı Tekrar Çalıştır (Farklı Varyasyon)</span>
                  </button>
                </div>

                {dayPlacements.length === 0 ? (
                  <div style={{ padding: '24px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px dashed var(--border-color)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Bu yayın listesinde henüz Reklam Kuşağı bulunmuyor veya aktif tarihe uygun rezervasyon yok.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                    {dayPlacements.map((blk, bIdx) => {
                      const ads = Array.isArray(blk.ads) ? blk.ads : [];
                      const commercialAds = ads.filter(a => !a.isBumperAd);
                      const usedSec = ads.reduce((s, a) => s + (Number(a.duration) || 0), 0);
                      return (
                        <div
                          key={blk.blockId || bIdx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderLeft: '4px solid #d97706',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', fontWeight: 900, color: '#d97706' }}>
                                #{bIdx + 1} • Saat {blk.time}
                              </span>
                              <span style={{ fontSize: '11.5px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                {blk.timeBlockName || 'Reklam Kuşağı'}
                              </span>
                              {blk.bumperSourceProgram && (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                  (Önceki Program: {blk.bumperSourceProgram} — {blk.detectedPrevCategory})
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#059669' }}>
                              {commercialAds.length} Spot + {ads.length - commercialAds.length} Jenerik ({Math.floor(usedSec / 60)} dk {usedSec % 60} sn)
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {ads.map((ad, aIdx) => {
                              if (ad.isBumperAd) {
                                return (
                                  <span
                                    key={aIdx}
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      background: 'rgba(12, 97, 124, 0.12)',
                                      color: '#0C617C'
                                    }}
                                  >
                                    {ad.bumperType === 'intro' ? 'Giriş:' : 'Çıkış:'} {ad.name} ({ad.duration}sn)
                                  </span>
                                );
                              }
                              const mat = materials.find(m => String(m.id) === String(ad.materialId));
                              const comp = companies.find(c => String(c.id) === String(ad.companyId || mat?.companyId));
                              return (
                                <span
                                  key={aIdx}
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    background: ad.isSponsorSpot ? 'rgba(147, 51, 234, 0.14)' : 'rgba(217, 119, 6, 0.14)',
                                    color: ad.isSponsorSpot ? '#7e22ce' : '#92400e',
                                    border: ad.isSponsorSpot ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(217, 119, 6, 0.3)'
                                  }}
                                >
                                  {aIdx + 1}. {comp?.name ? `${comp.name} — ` : ''}{mat?.name || ad.materialId} ({ad.duration}sn)
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ALT AKSİYON ÇUBUĞU */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--bg-tertiary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Reklamlar yerleştirildi. Şimdi <strong>"Reklam Rezervasyona İlet"</strong> ile listeyi reklamları yerleşmiş halde Reklam Rezervasyon modülüne gönderebilirsiniz.
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Tamam (Listeye Dön)
            </button>

            {placementDone && onOpenSendToAdsModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSendToAdsModal();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(234, 88, 12, 0.3)'
                }}
              >
                <Send size={14} />
                <span>Şimdi Reklam Rezervasyona İlet</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
