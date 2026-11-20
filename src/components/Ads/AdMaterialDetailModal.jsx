/**
 * @file src/components/Ads/AdMaterialDetailModal.jsx
 * @description Reklam Planlama ve Materyal ekranlarında "ⓘ" (Bilgi & Önizleme) butonuna tıklandığında açılan;
 * - İleri-Geri Sarılabilir Canlı Video Oynatıcı (-5sn, -1sn, -1 Kare, +1 Kare, +1sn, +5sn)
 * - Hassas Süre (Saniye + Milisaniye + Kare/Frame), SMPTE Timecode ve 25 / 30 / 50 FPS Kare Hızı Analizi
 * - Bağlı Reklamveren Firma, Ürün/Kampanya, Sponsorluk, Kuşak Sırası ve Rezervasyon Künyesi
 * bilgilerini tek ekranda sunan kapsamlı bilgi modalı.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Info,
  Building2,
  Package,
  Film,
  Clock,
  Award,
  Layers,
  Calendar,
  Tv,
  Hash,
  Gauge,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import AdVideoPlayer, { computeSmpteTimecode } from './AdVideoPlayer';

function formatTurkishDate(dateStr = '') {
  if (!dateStr) return '-';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

const InfoRow = ({ label, value, mono = false, highlightColor = null, badge = false }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '148px 1fr',
      gap: '10px',
      padding: '7px 12px',
      borderBottom: '1px solid var(--ads-border, rgba(148, 163, 184, 0.18))',
      alignItems: 'center',
      fontSize: '12px'
    }}
  >
    <span style={{ color: 'var(--ads-text-muted, #64748b)', fontWeight: '700' }}>{label}</span>
    <span
      style={{
        color: highlightColor || 'var(--ads-text-main, #0f172a)',
        fontWeight: highlightColor || badge ? '800' : '700',
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-word'
      }}
    >
      {value !== null && value !== undefined && value !== '' ? value : '-'}
    </span>
  </div>
);

const AdMaterialDetailModal = ({
  material,
  onClose,
  companies = [],
  products = [],
  materials = [],
  reservations = [],
  adPlacements = {},
  selectedDayInfo = null
}) => {
  const [mediaInfo, setMediaInfo] = useState(null);
  const [loadingProbe, setLoadingProbe] = useState(false);

  // Tıklanan öğe bir kuşak içi reklam (placedAd), rezervasyon havuzu öğesi veya doğrudan materyal olabilir
  const resolvedContext = useMemo(() => {
    if (!material) return null;

    const matId = material.materialId || material.id || material.clipId;
    const catalogMat =
      materials.find(
        m =>
          String(m.id) === String(matId) ||
          String(m.clipId) === String(matId) ||
          (material.code && String(m.code).toLowerCase() === String(material.code).toLowerCase())
      ) || material;

    const compId = material.companyId || catalogMat?.companyId;
    const prodId = material.productId || catalogMat?.productId;

    const companyObj =
      companies.find(c => String(c.id) === String(compId)) ||
      companies.find(
        c =>
          c.name &&
          (c.name.toLocaleUpperCase('tr-TR') === String(material.companyName || catalogMat?.companyName || '').toLocaleUpperCase('tr-TR'))
      ) ||
      null;

    const productObj =
      products.find(p => String(p.id) === String(prodId)) ||
      products.find(
        p =>
          p.name &&
          (p.name.toLocaleLowerCase('tr-TR') === String(material.productName || catalogMat?.productName || '').toLocaleLowerCase('tr-TR'))
      ) ||
      null;

    const reservationObj =
      reservations.find(r => String(r.id) === String(material.reservationId)) ||
      reservations.find(
        r =>
          String(r.materialId) === String(catalogMat?.id) ||
          (Array.isArray(r.items) && r.items.some(it => String(it.materialId) === String(catalogMat?.id)))
      ) ||
      null;

    const resItemObj =
      reservationObj && Array.isArray(reservationObj.items)
        ? reservationObj.items.find(it => String(it.materialId) === String(catalogMat?.id)) || null
        : null;

    const isSponsor = Boolean(
      material.isSponsor ||
        material.isSponsorSpot ||
        material.lockOrder ||
        resItemObj?.isSponsor ||
        reservationObj?.isSponsor
    );

    const sponsorProgramTitle =
      material.sponsorProgramTitle ||
      resItemObj?.sponsorProgramTitle ||
      reservationObj?.sponsorProgramTitle ||
      null;

    const sponsorTagLabel =
      material.sponsorTag ||
      (isSponsor ? (sponsorProgramTitle ? 'Program Sponsoru' : 'Kuşak Sponsoru') : null);

    // Katalogda bu firmaya ait toplam klip sayısı
    const companyMaterialCount = companyObj
      ? materials.filter(m => String(m.companyId) === String(companyObj.id)).length
      : 1;

    // Tüm yayın planında ve seçili günde bu materyalin kaç kez yer aldığı
    let totalBroadcastSpots = 0;
    let todayBroadcastSpots = 0;
    const todayBreaks = [];

    Object.entries(adPlacements || {}).forEach(([dayKey, blocks]) => {
      if (!Array.isArray(blocks)) return;
      const isSelectedDay =
        selectedDayInfo &&
        (dayKey === selectedDayInfo.dayKey || dayKey.startsWith(`${selectedDayInfo.channelId}-${selectedDayInfo.date}`));

      blocks.forEach(b => {
        (b.ads || []).forEach((ad, idx) => {
          if (String(ad.materialId) === String(catalogMat?.id || matId)) {
            totalBroadcastSpots += 1;
            if (isSelectedDay) {
              todayBroadcastSpots += 1;
              todayBreaks.push(`${b.time} (${idx + 1}. sıra)`);
            }
          }
        });
      });
    });

    const rawDurMs =
      Number(catalogMat?.durationMs) > 600
        ? Number(catalogMat.durationMs)
        : Number(catalogMat?.duration) > 600
        ? Number(catalogMat.duration)
        : Number(material?.durationMs) > 600
        ? Number(material.durationMs)
        : Math.round((Number(catalogMat?.duration || material?.durationSec || material?.duration || 30)) * 1000);

    const durationSec = Math.max(1, Math.round(rawDurMs / 1000));

    return {
      clipId: catalogMat?.clipId || catalogMat?.id || matId || '-',
      materialId: catalogMat?.id || matId || '-',
      title: catalogMat?.name || material?.materialName || material?.title || material?.name || 'Reklam Spotu',
      clipName: catalogMat?.clipName || catalogMat?.name || material?.clipName || material?.name || '',
      code: catalogMat?.code || material?.code || material?.fileName || `${catalogMat?.clipId || matId}.mxf`,
      durationSec,
      durationMs: rawDurMs,
      uploadDate: catalogMat?.uploadDate || material?.uploadDate || '',
      description: catalogMat?.description || material?.description || '',
      companyName: companyObj?.name || catalogMat?.companyName || material?.companyName || 'GENEL REKLAMVEREN',
      companyId: companyObj?.id || compId || '-',
      companyContact: companyObj?.contactPerson || '',
      companyPhone: companyObj?.phone || '',
      companyEmail: companyObj?.email || '',
      companyMaterialCount,
      productName: productObj?.name || catalogMat?.productName || material?.productName || 'Genel Kampanya',
      productId: productObj?.id || prodId || '-',
      isSponsor,
      sponsorProgramTitle,
      sponsorTagLabel,
      breakContext: material.breakTime
        ? {
            breakTime: material.breakTime,
            breakName: material.breakName || `${material.breakTime} Reklam Kuşağı`,
            orderInBreak: material.orderInBreak || null,
            prevProgramTitle: material.prevProgramTitle || null,
            nextProgramTitle: material.nextProgramTitle || null
          }
        : null,
      reservationObj,
      resItemObj,
      totalBroadcastSpots,
      todayBroadcastSpots,
      todayBreaks,
      playerMaterial: {
        ...catalogMat,
        id: catalogMat?.id || matId,
        clipId: catalogMat?.clipId || catalogMat?.id || matId,
        name: catalogMat?.name || material?.materialName || material?.title || material?.name,
        clipName: catalogMat?.clipName || catalogMat?.name || material?.name,
        code: catalogMat?.code || material?.code || material?.fileName,
        duration: durationSec,
        durationMs: rawDurMs
      }
    };
  }, [material, materials, companies, products, reservations, adPlacements, selectedDayInfo]);

  useEffect(() => {
    if (!resolvedContext) return;
    let isMounted = true;
    setLoadingProbe(true);

    const params = new URLSearchParams();
    if (resolvedContext.clipId) params.set('id', String(resolvedContext.clipId));
    if (resolvedContext.code) params.set('code', String(resolvedContext.code));
    if (resolvedContext.code) params.set('fileName', String(resolvedContext.code));
    if (resolvedContext.clipName) params.set('clipName', String(resolvedContext.clipName));
    if (resolvedContext.durationMs) params.set('durationMs', String(resolvedContext.durationMs));

    fetch(`/api/media-info?${params.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (isMounted && data?.success) {
          setMediaInfo(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingProbe(false);
      });

    return () => {
      isMounted = false;
    };
  }, [resolvedContext]);

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!material || !resolvedContext) return null;

  // Aktif FPS ve Süre / Kare Hesaplamaları (25, 30 ve 50 FPS karşılaştırmalı)
  const detectedFps = Number(mediaInfo?.fps) > 0 ? Number(mediaInfo.fps) : 25;
  const roundedFps = Math.round(detectedFps);
  const exactDurationMs = Number(mediaInfo?.durationMs) > 0 ? Number(mediaInfo.durationMs) : resolvedContext.durationMs;
  const exactDurationSec = Number((exactDurationMs / 1000).toFixed(2));

  const mainTc = computeSmpteTimecode(exactDurationMs / 1000, detectedFps);
  const tc25 = computeSmpteTimecode(exactDurationMs / 1000, 25);
  const tc30 = computeSmpteTimecode(exactDurationMs / 1000, 30);
  const tc50 = computeSmpteTimecode(exactDurationMs / 1000, 50);

  const fpsBadgeText =
    roundedFps === 25
      ? '25 Kare / sn (25 FPS • PAL Yayın Standardı)'
      : roundedFps === 50
      ? '50 Kare / sn (50 FPS • PAL Progressive)'
      : roundedFps === 30
      ? `${detectedFps} Kare / sn (30 FPS • NTSC)`
      : `${detectedFps} Kare / sn (${detectedFps} FPS)`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10080,
        padding: '18px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          background: 'var(--ads-card-bg, #ffffff)',
          border: resolvedContext.isSponsor
            ? '2px solid rgba(147, 51, 234, 0.55)'
            : '1px solid var(--ads-border, #e2e8f0)',
          borderRadius: '18px',
          boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* ÜST BAŞLIK BARI */}
        <div
          style={{
            padding: '14px 20px',
            background: resolvedContext.isSponsor
              ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.14) 0%, rgba(245, 158, 11, 0.1) 100%)'
              : 'var(--ads-card-subtle, #f8fafc)',
            borderBottom: '1px solid var(--ads-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: resolvedContext.isSponsor
                  ? 'linear-gradient(135deg, #9333ea 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)'
              }}
            >
              <Info size={22} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '900',
                    color: resolvedContext.isSponsor ? '#6b21a8' : 'var(--ads-text-main, #0f172a)'
                  }}
                >
                  {resolvedContext.title}
                </h3>

                {resolvedContext.isSponsor ? (
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '6px',
                      background: 'linear-gradient(135deg, #9333ea, #7e22ce)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: '900'
                    }}
                  >
                    🏆 SPONSOR • {resolvedContext.sponsorTagLabel}
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#2563eb',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                  >
                    Spot Reklam
                  </span>
                )}

                <span
                  style={{
                    padding: '3px 9px',
                    borderRadius: '6px',
                    background: 'rgba(15, 23, 42, 0.08)',
                    color: 'var(--ads-text-main, #0f172a)',
                    fontSize: '11px',
                    fontWeight: '800',
                    fontFamily: 'monospace'
                  }}
                >
                  #{resolvedContext.clipId} • {resolvedContext.code}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '4px',
                  flexWrap: 'wrap',
                  fontSize: '12px',
                  color: 'var(--ads-text-muted, #64748b)',
                  fontWeight: '700'
                }}
              >
                <span>
                  Firma: <strong style={{ color: 'var(--ads-brand, #2563eb)' }}>{resolvedContext.companyName}</strong>
                </span>
                <span>•</span>
                <span>
                  Ürün: <strong style={{ color: 'var(--ads-text-main, #0f172a)' }}>{resolvedContext.productName}</strong>
                </span>
                <span>•</span>
                <span>
                  Süre &amp; Kare:{' '}
                  <strong style={{ color: '#059669', fontFamily: 'monospace' }}>
                    {mainTc.wholeSeconds} sn {mainTc.extraFrames} kare ({mainTc.totalFrames} Kare • {roundedFps} FPS)
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              border: '1px solid var(--ads-border, #cbd5e1)',
              background: 'var(--ads-card-bg, #fff)',
              color: 'var(--ads-text-main, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Kapat (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ANA GÖVDE: SOL (VİDEO OYNATICI + FPS/FRAME TABLOSU) | SAĞ (FİRMA, SPONSORLUK & TEKNİK DETAYLAR) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(430px, 1fr))',
            gap: '18px',
            alignItems: 'start'
          }}
        >
          {/* SOL SÜTUN: İLERİ-GERİ SARILABİLİR VİDEO OYNATICI + SÜRE & KARE (25/30/50 FPS) ANALİZİ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <AdVideoPlayer
              material={resolvedContext.playerMaterial}
              autoPlay={true}
              mediaInfo={mediaInfo}
            />

            {/* SÜRE, FRAME (KARE) VE FPS (25 / 30 / 50 KARE) DETAY KARTI */}
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--ads-border, #e2e8f0)',
                background: 'var(--ads-card-subtle, #f8fafc)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(37, 99, 235, 0.08)',
                  borderBottom: '1px solid var(--ads-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: '900', color: 'var(--ads-text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Gauge size={15} color="#2563eb" />
                  Süre, Frame (Kare) &amp; FPS (25 / 30 / 50 Kare) Analizi
                </span>
                {loadingProbe ? (
                  <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={11} className="spin" /> Teknik Künye Okunuyor...
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: '#059669',
                      color: '#fff',
                      fontSize: '10.5px',
                      fontWeight: '900'
                    }}
                  >
                    Aktif: {roundedFps} Kare / sn ({roundedFps} FPS)
                  </span>
                )}
              </div>

              {/* 4'lü Özet Kutu */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  padding: '12px'
                }}
              >
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '9px',
                    background: 'var(--ads-card-bg, #fff)',
                    border: '1px solid var(--ads-border, #e2e8f0)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted, #64748b)' }}>SANİYE + KARE</div>
                  <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#059669', marginTop: '3px', fontFamily: 'monospace' }}>
                    {mainTc.wholeSeconds} sn {mainTc.extraFrames} kare
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted, #64748b)', marginTop: '1px' }}>
                    ({exactDurationSec} sn / {exactDurationMs} ms)
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '9px',
                    background: 'var(--ads-card-bg, #fff)',
                    border: '1px solid var(--ads-border, #e2e8f0)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted, #64748b)' }}>KARE HIZI (FPS)</div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#2563eb', marginTop: '3px', fontFamily: 'monospace' }}>
                    {roundedFps} Kare/sn
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted, #64748b)', marginTop: '1px' }}>
                    {roundedFps === 25 ? 'PAL TV (25 FPS)' : roundedFps === 50 ? '50 FPS HD' : `${detectedFps} FPS`}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '9px',
                    background: 'var(--ads-card-bg, #fff)',
                    border: '1px solid var(--ads-border, #e2e8f0)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted, #64748b)' }}>TOPLAM KARE</div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#7c3aed', marginTop: '3px', fontFamily: 'monospace' }}>
                    {mainTc.totalFrames} Kare
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted, #64748b)', marginTop: '1px' }}>
                    Toplam Frame
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '9px',
                    background: 'var(--ads-card-bg, #fff)',
                    border: '1px solid var(--ads-border, #e2e8f0)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted, #64748b)' }}>TIMECODE</div>
                  <div style={{ fontSize: '13.5px', fontWeight: '900', color: '#d97706', marginTop: '3px', fontFamily: 'monospace' }}>
                    {mainTc.timecode}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ads-text-muted, #64748b)', marginTop: '1px' }}>
                    SS:DD:SN:FF
                  </div>
                </div>
              </div>

              {/* 25 / 30 / 50 Kare (FPS) Karşılaştırma Tablosu */}
              <div style={{ padding: '0 12px 12px 12px' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '11.5px',
                    background: 'var(--ads-card-bg, #fff)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--ads-border, #e2e8f0)'
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.05)', color: 'var(--ads-text-muted, #64748b)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px', fontWeight: '800' }}>Kare Standardı</th>
                      <th style={{ padding: '6px 10px', fontWeight: '800' }}>Saniye + Kare</th>
                      <th style={{ padding: '6px 10px', fontWeight: '800' }}>Toplam Frame</th>
                      <th style={{ padding: '6px 10px', fontWeight: '800' }}>Timecode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { fps: 25, label: '25 Kare (PAL TV Yayın)', data: tc25 },
                      { fps: 30, label: '30 Kare (NTSC / Dijital)', data: tc30 },
                      { fps: 50, label: '50 Kare (50p Broadcast)', data: tc50 }
                    ].map(row => {
                      const isActiveFps = roundedFps === row.fps;
                      return (
                        <tr
                          key={row.fps}
                          style={{
                            borderTop: '1px solid var(--ads-border, #e2e8f0)',
                            background: isActiveFps ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                            fontWeight: isActiveFps ? '800' : '600'
                          }}
                        >
                          <td style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isActiveFps && <CheckCircle2 size={13} color="#059669" />}
                            <span style={{ color: isActiveFps ? '#059669' : 'var(--ads-text-main, #0f172a)' }}>
                              {row.label}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                            {row.data.wholeSeconds} sn + {row.data.extraFrames} kare
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: '#2563eb' }}>
                            {row.data.totalFrames} kare
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                            {row.data.timecode}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SAĞ SÜTUN: FİRMA, ÜRÜN, SPONSORLUK, KUŞAK VE FİZİKSEL DOSYA KÜNYESİ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 1. REKLAMVEREN FİRMA & ÜRÜN BİLGİLERİ */}
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--ads-border, #e2e8f0)',
                background: 'var(--ads-card-bg, #fff)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--ads-card-subtle, #f8fafc)',
                  borderBottom: '1px solid var(--ads-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: '900',
                  color: 'var(--ads-text-main, #0f172a)'
                }}
              >
                <Building2 size={15} color="#2563eb" />
                <span>Reklamveren Firma &amp; Kampanya Künyesi</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <InfoRow label="Reklamveren Firma" value={resolvedContext.companyName} highlightColor="#2563eb" />
                <InfoRow label="Firma Katalog Kodu" value={`${resolvedContext.companyId} (${resolvedContext.companyMaterialCount} Kayıtlı Klip)`} mono />
                <InfoRow label="Bağlı Ürün / Kampanya" value={resolvedContext.productName} highlightColor="#0f172a" />
                {resolvedContext.companyContact && (
                  <InfoRow label="Firma Yetkilisi" value={resolvedContext.companyContact} />
                )}
                {resolvedContext.companyPhone && (
                  <InfoRow label="Firma Telefon" value={resolvedContext.companyPhone} mono />
                )}
                {resolvedContext.companyEmail && (
                  <InfoRow label="Firma E-Posta" value={resolvedContext.companyEmail} />
                )}
                <InfoRow
                  label="Yayın Türü"
                  value={
                    resolvedContext.isSponsor
                      ? `🏆 SPONSOR REKLAMI (${resolvedContext.sponsorTagLabel})`
                      : 'Standart Ticari Spot Reklam'
                  }
                  highlightColor={resolvedContext.isSponsor ? '#9333ea' : '#0284c7'}
                />
                {resolvedContext.sponsorProgramTitle && (
                  <InfoRow
                    label="Sponsorlu Program"
                    value={`📺 ${resolvedContext.sponsorProgramTitle}`}
                    highlightColor="#9333ea"
                  />
                )}
              </div>
            </div>

            {/* 2. KUŞAK YERLEŞİM & REZERVASYON DURUMU */}
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--ads-border, #e2e8f0)',
                background: 'var(--ads-card-bg, #fff)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--ads-card-subtle, #f8fafc)',
                  borderBottom: '1px solid var(--ads-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: '900',
                  color: 'var(--ads-text-main, #0f172a)'
                }}
              >
                <Tv size={15} color="#9333ea" />
                <span>Yayın Planı, Kuşak &amp; Rezervasyon Detayı</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {resolvedContext.breakContext && (
                  <>
                    <InfoRow
                      label="Seçili Kuşak & Sıra"
                      value={`${resolvedContext.breakContext.breakTime} Kuşağı${
                        resolvedContext.breakContext.orderInBreak ? ` • #${resolvedContext.breakContext.orderInBreak}. Sırada` : ''
                      }`}
                      highlightColor="#059669"
                      mono
                    />
                    {(resolvedContext.breakContext.prevProgramTitle || resolvedContext.breakContext.nextProgramTitle) && (
                      <InfoRow
                        label="Komşu Programlar"
                        value={`${resolvedContext.breakContext.prevProgramTitle || 'Başlangıç'}  ➔  [KUŞAK]  ➔  ${
                          resolvedContext.breakContext.nextProgramTitle || 'Bitiş'
                        }`}
                      />
                    )}
                  </>
                )}

                <InfoRow
                  label="Seçili Günde Yayın"
                  value={
                    resolvedContext.todayBroadcastSpots > 0
                      ? `${resolvedContext.todayBroadcastSpots} Defa (${resolvedContext.todayBreaks.join(', ')})`
                      : 'Seçili günde henüz kuşağa eklenmedi'
                  }
                  highlightColor={resolvedContext.todayBroadcastSpots > 0 ? '#059669' : '#64748b'}
                />
                <InfoRow
                  label="Toplam Planlanan Yayın"
                  value={`${resolvedContext.totalBroadcastSpots} Spot (${resolvedContext.totalBroadcastSpots * resolvedContext.durationSec} sn)`}
                  mono
                />

                {resolvedContext.reservationObj && (
                  <>
                    <InfoRow
                      label="Rezervasyon Tarihleri"
                      value={`${formatTurkishDate(resolvedContext.reservationObj.startDate)} – ${formatTurkishDate(
                        resolvedContext.reservationObj.endDate
                      )}`}
                      mono
                    />
                    <InfoRow
                      label="Günlük Min / Max Kota"
                      value={`Min: ${
                        resolvedContext.resItemObj?.dailyMinSpots ?? resolvedContext.reservationObj.dailyMinSpots ?? 1
                      } Spot / Max: ${
                        resolvedContext.resItemObj?.dailyMaxSpots ?? resolvedContext.reservationObj.dailyMaxSpots ?? 4
                      } Spot`}
                    />
                    <InfoRow
                      label="Öncelik Puanı"
                      value={`${resolvedContext.resItemObj?.priority || resolvedContext.reservationObj.priority || 700} Puan`}
                      mono
                    />
                  </>
                )}
              </div>
            </div>

            {/* 3. FİZİKSEL MEDYA DOSYASI & TEKNİK YAYIN KÜNYESİ */}
            <div
              style={{
                borderRadius: '12px',
                border: '1px solid var(--ads-border, #e2e8f0)',
                background: 'var(--ads-card-bg, #fff)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--ads-card-subtle, #f8fafc)',
                  borderBottom: '1px solid var(--ads-border, #e2e8f0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: '900',
                  color: 'var(--ads-text-main, #0f172a)'
                }}
              >
                <Film size={15} color="#059669" />
                <span>Fiziksel Medya &amp; Teknik Yayın Künyesi</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <InfoRow label="MAM Klip ID" value={`#${resolvedContext.clipId}`} mono />
                <InfoRow label="MAM Klip Adı" value={resolvedContext.clipName} mono />
                <InfoRow label="Fiziksel Dosya Kodu" value={resolvedContext.code} mono highlightColor="#2563eb" />
                <InfoRow label="Kare Hızı Standardı" value={fpsBadgeText} highlightColor="#059669" />
                <InfoRow
                  label="Hassas Süre & Kare"
                  value={`${mainTc.wholeSeconds} sn + ${mainTc.extraFrames} kare (${exactDurationSec} sn • ${mainTc.totalFrames} Frame)`}
                  mono
                />
                <InfoRow
                  label="Çözünürlük & Oran"
                  value={`${mediaInfo?.video?.resolution || '1920x1080 (Full HD)'} • ${mediaInfo?.video?.aspectRatio || '16:9'}`}
                  mono
                />
                <InfoRow
                  label="Video / Ses Formatı"
                  value={`${mediaInfo?.video?.codec || 'MXF / MPEG-2 HD'} • ${mediaInfo?.audio?.codec || 'PCM'} (${
                    mediaInfo?.audio?.sampleRate || '48000 Hz'
                  })`}
                  mono
                />
                <InfoRow label="Arşiv Yükleme Tarihi" value={formatTurkishDate(resolvedContext.uploadDate)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AdMaterialDetailModal);
