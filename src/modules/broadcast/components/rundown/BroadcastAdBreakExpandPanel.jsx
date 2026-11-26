/**
 * @file src/modules/broadcast/components/rundown/BroadcastAdBreakExpandPanel.jsx
 * @description Yayın Planlama (Ready) tablosunda "Reklam Kuşağı 1, 2..." satırına tıklandığında
 * satırın hemen altında açılan/kapanan (Accordion) Reklam Klipleri Görünümü ve Düzenleme Paneli.
 *
 * Özellikler:
 * 1. Kuşağa yerleşen RTÜK Giriş, Ticari Reklam Klipleri ve RTÜK Çıkış jeneriklerini gerçek yayın saatleri ve süreleriyle listeler.
 * 2. Kuşak içindeki reklam kliplerinin sırasını Yukarı / Aşağı taşıma, silme ve "+ Bu Kuşağa Reklam Klibi Ekle" ile yeni reklam ekleme imkanı sunar.
 * 3. Yapılan her değişiklikte hem kuşağın toplam süresini (`durationTc` / `durationFrames`) hem de Reklam Rezervasyon (`adPlacements`) verisini anında günceller.
 */
import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Lock,
  Film,
  Building2,
  Clock
} from 'lucide-react';
import {
  BROADCAST_FPS,
  parseClockTimeToFrames,
  framesToClockTime
} from '../../utils/timecodeUtils';
import { parseTimecodeDisplay } from '../../utils/rundownHelpers';

export default function BroadcastAdBreakExpandPanel({
  breakItem,
  placementBlock,
  materials = [],
  companies = [],
  reservations = [],
  selectedChannel,
  selectedDate,
  onMoveAdInBreak,
  onRemoveAdFromBreak,
  onAddAdToBreak,
  isDayLockedReadOnly = false
}) {
  const [selectedAddMaterialId, setSelectedAddMaterialId] = useState('');

  const placedAds = Array.isArray(placementBlock?.ads) ? placementBlock.ads : [];
  const blockKey = placementBlock?.blockId || breakItem?.instanceId || placementBlock?.time;

  // Kuşak başlangıç saatinden itibaren her bir reklam klibinin kendi giriş saatini hesapla
  const adsWithCalculatedTimes = useMemo(() => {
    const startDisp = parseTimecodeDisplay(breakItem?.calculatedStartTime);
    let runningFrames = parseClockTimeToFrames(`${startDisp.hh}:${startDisp.mm}:${startDisp.ss}`) || 0;

    return placedAds.map((ad, idx) => {
      const durSec = Math.max(1, Number(ad.duration) || 20);
      const itemStartClock = framesToClockTime(runningFrames);
      const startParts = parseTimecodeDisplay(itemStartClock);
      runningFrames += durSec * BROADCAST_FPS;

      const mat = materials.find(m => String(m.id) === String(ad.materialId));
      const comp = companies.find(c => String(c.id) === String(ad.companyId || mat?.companyId));

      return {
        ...ad,
        adIndex: idx,
        durSec,
        startClockText: `${startParts.hh}:${startParts.mm}:${startParts.ss}`,
        clipTitle: ad.isBumperAd
          ? (ad.name || (ad.bumperType === 'intro' ? 'RTÜK Reklam Giriş' : 'RTÜK Reklam Çıkış'))
          : (mat?.name || ad.name || ad.title || String(ad.materialId || 'Reklam Klibi')),
        companyName: ad.isBumperAd
          ? 'RTÜK Zorunlu Jenerik'
          : (comp?.name || mat?.companyName || ad.companyName || 'Ticari Reklam')
      };
    });
  }, [placedAds, breakItem?.calculatedStartTime, materials, companies]);

  // Bu kuşağa hızlı eklenebilecek aktif rezervasyon ve katalog reklam klipleri
  const availableAdChoices = useMemo(() => {
    const choices = [];
    const seenMatIds = new Set();

    // 1. Önce aktif rezervasyonlardaki reklam klipleri
    reservations.forEach(res => {
      const items = Array.isArray(res.items) && res.items.length > 0 ? res.items : [res];
      items.forEach(it => {
        const matId = it.materialId || res.materialId;
        if (!matId || seenMatIds.has(String(matId))) return;
        const mat = materials.find(m => String(m.id) === String(matId));
        if (!mat) return;
        const comp = companies.find(c => String(c.id) === String(it.companyId || res.companyId || mat.companyId));
        seenMatIds.add(String(mat.id));
        choices.push({
          materialId: mat.id,
          companyId: comp?.id || mat.companyId,
          reservationId: res.id,
          label: `[Rezervasyon] ${comp?.name ? comp.name + ' — ' : ''}${mat.name} (${mat.duration || 20} sn)`,
          duration: Number(mat.duration) || 20
        });
      });
    });

    // 2. Katalogdaki diğer reklam klipleri
    materials.forEach(mat => {
      if (!mat || !mat.id || seenMatIds.has(String(mat.id))) return;
      const comp = companies.find(c => String(c.id) === String(mat.companyId));
      seenMatIds.add(String(mat.id));
      choices.push({
        materialId: mat.id,
        companyId: comp?.id || mat.companyId,
        reservationId: null,
        label: `${comp?.name ? comp.name + ' — ' : ''}${mat.name} (${mat.duration || 20} sn)`,
        duration: Number(mat.duration) || 20
      });
    });

    return choices;
  }, [reservations, materials, companies]);

  const totalSec = adsWithCalculatedTimes.reduce((s, a) => s + a.durSec, 0);
  const totalMinPart = Math.floor(totalSec / 60);
  const totalSecPart = totalSec % 60;
  const commercialCount = adsWithCalculatedTimes.filter(a => !a.isBumperAd).length;
  const bumperCount = adsWithCalculatedTimes.length - commercialCount;

  const handleQuickAddClick = (e) => {
    e.stopPropagation();
    if (!selectedAddMaterialId || !onAddAdToBreak) return;
    const foundChoice = availableAdChoices.find(c => String(c.materialId) === String(selectedAddMaterialId));
    if (!foundChoice) return;
    onAddAdToBreak(breakItem, placementBlock, foundChoice);
    setSelectedAddMaterialId('');
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        margin: '0 0 6px 0',
        padding: '10px 14px 12px 44px',
        background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.10) 0%, var(--bg-primary) 100%)',
        borderBottom: '2px solid rgba(217, 119, 6, 0.45)',
        borderLeft: '6px solid #d97706',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {/* ÜST ÖZET & HIZLI REKLAM KLİBİ EKLEME ÇUBUĞU */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '6px',
          borderBottom: '1px dashed rgba(217, 119, 6, 0.35)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '6px',
              background: '#d97706',
              color: '#ffffff',
              fontSize: '11.5px',
              fontWeight: 900
            }}
          >
            <Megaphone size={12} />
            <span>{breakItem?.title || 'Reklam Kuşağı'} İçi Klipler</span>
          </span>

          <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            {commercialCount} Ticari Reklam + {bumperCount} RTÜK Jeneriği
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '5px',
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#047857',
              fontSize: '11.5px',
              fontWeight: 900
            }}
          >
            <Clock size={12} />
            <span>
              Hesaplanan Kuşak Süresi: {totalMinPart > 0 ? `${totalMinPart} dk ` : ''}{totalSecPart} sn ({totalSec} sn)
            </span>
          </span>
        </div>

        {/* HIZLI REKLAM EKLEME SEÇİCİSİ */}
        {!isDayLockedReadOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <select
              value={selectedAddMaterialId}
              onChange={e => setSelectedAddMaterialId(e.target.value)}
              style={{
                height: '30px',
                maxWidth: '310px',
                padding: '0 8px',
                borderRadius: '6px',
                border: '1px solid rgba(217, 119, 6, 0.45)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '11.5px',
                fontWeight: 700,
                outline: 'none'
              }}
            >
              <option value="">+ Bu Kuşağa Reklam Klibi Seçin...</option>
              {availableAdChoices.map(ch => (
                <option key={ch.materialId} value={ch.materialId}>
                  {ch.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!selectedAddMaterialId}
              onClick={handleQuickAddClick}
              style={{
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: 'none',
                background: selectedAddMaterialId ? '#059669' : 'var(--bg-tertiary)',
                color: selectedAddMaterialId ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: selectedAddMaterialId ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Plus size={13} />
              <span>Kuşağa Ekle</span>
            </button>
          </div>
        )}
      </div>

      {/* REKLAM KLİPLERİ LİSTESİ */}
      {adsWithCalculatedTimes.length === 0 ? (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--bg-secondary)',
            border: '1px dashed var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center'
          }}
        >
          Bu reklam kuşağına henüz reklam klibi yerleştirilmemiş. Üstteki <strong>"Reklamları Yerleştir"</strong> butonuna basabilir veya sağ üstteki listeden manuel reklam ekleyebilirsiniz.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {adsWithCalculatedTimes.map((ad, idx) => {
            const isBumper = Boolean(ad.isBumperAd);
            const isFirstCommercial = !isBumper && (idx === 0 || Boolean(adsWithCalculatedTimes[idx - 1]?.isBumperAd));
            const isLastCommercial =
              !isBumper &&
              (idx === adsWithCalculatedTimes.length - 1 || Boolean(adsWithCalculatedTimes[idx + 1]?.isBumperAd));

            return (
              <div
                key={`${ad.materialId || ad.name}_${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  background: isBumper
                    ? 'rgba(12, 97, 124, 0.10)'
                    : ad.isSponsorSpot
                    ? 'rgba(147, 51, 234, 0.10)'
                    : 'var(--bg-secondary)',
                  border: isBumper
                    ? '1px solid rgba(12, 97, 124, 0.30)'
                    : ad.isSponsorSpot
                    ? '1px solid rgba(147, 51, 234, 0.30)'
                    : '1px solid var(--border-color)',
                  fontSize: '12.5px'
                }}
              >
                {/* Sol: Sıra + Saat + Süre + Klip Adı + Firma */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 900,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isBumper ? '#0C617C' : '#d97706',
                      color: '#ffffff',
                      flexShrink: 0
                    }}
                  >
                    #{idx + 1}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      flexShrink: 0
                    }}
                  >
                    {ad.startClockText}
                  </span>

                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      color: isBumper ? '#0C617C' : '#b45309',
                      background: isBumper ? 'rgba(12, 97, 124, 0.14)' : 'rgba(245, 158, 11, 0.16)',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      flexShrink: 0
                    }}
                  >
                    {ad.durSec} sn
                  </span>

                  <span
                    style={{
                      fontWeight: 800,
                      color: isBumper ? '#0C617C' : 'var(--text-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      minWidth: 0
                    }}
                  >
                    <Film size={13} color={isBumper ? '#0C617C' : '#d97706'} style={{ flexShrink: 0 }} />
                    <span style={{ wordBreak: 'break-word' }}>{ad.clipTitle}</span>
                  </span>

                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <Building2 size={11} />
                    <span>{ad.companyName}</span>
                  </span>

                  {isBumper && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        color: '#0C617C'
                      }}
                    >
                      <Lock size={11} />
                      <span>{ad.bumperType === 'intro' ? 'RTÜK Giriş' : 'RTÜK Çıkış'}</span>
                    </span>
                  )}
                </div>

                {/* Sağ: Sıra Değiştirme ve Silme Butonları */}
                {!isDayLockedReadOnly && !isBumper && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={isFirstCommercial}
                      onClick={() => onMoveAdInBreak && onMoveAdInBreak(blockKey, idx, -1)}
                      title="Reklamı Yukarı Taşı"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isFirstCommercial ? 'not-allowed' : 'pointer',
                        opacity: isFirstCommercial ? 0.35 : 1
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>

                    <button
                      type="button"
                      disabled={isLastCommercial}
                      onClick={() => onMoveAdInBreak && onMoveAdInBreak(blockKey, idx, 1)}
                      title="Reklamı Aşağı Taşı"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isLastCommercial ? 'not-allowed' : 'pointer',
                        opacity: isLastCommercial ? 0.35 : 1
                      }}
                    >
                      <ArrowDown size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemoveAdFromBreak && onRemoveAdFromBreak(blockKey, idx)}
                      title="Bu Reklam Spotunu Kuşaktan Kaldır"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        background: 'rgba(239, 68, 68, 0.10)',
                        color: '#ef4444',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
