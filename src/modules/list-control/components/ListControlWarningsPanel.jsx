/**
 * @file src/modules/list-control/components/ListControlWarningsPanel.jsx
 * @description Yayın Liste Kontrol Modülü — 4'lü Kontrol Özeti:
 * 1. Taslak Planlama Kontrolü
 * 2. Program Klipleri Kontrolü (Klip Sayısı, İntro, Süre, Sağlam Klip, Yayın Planlama Değişim/Ek)
 * 3. Reklam Spotları Kontrolü (Spot Sayısı, RTÜK Jenerik, Süre, Sağlam Reklam)
 * 4. Bizim DB • MAM DB • HighRes (.MXF) Dosya Yolu & Format Kontrolü
 * Ayrıca Tekrar Eden Klipleri Tek Satırda Gruplayan (Yanında Satır No & Saat Rozetli) Hata / Uyarı Merkezi.
 */
import React, { useState } from 'react';
import {
  AlertTriangle, Megaphone, Film, ChevronDown, ChevronUp,
  Plus, RefreshCw, Settings
} from 'lucide-react';
import { formatSecondsReadable } from '../utils/listControlVerificationEngine';

const COMMON_BROADCAST_FORMATS = ['mxf', 'mp4', 'mov', 'avi', 'ts', 'mpg', 'mkv'];

export default function ListControlWarningsPanel({
  stageAnalysis,
  healthMap = {},
  programs = [],
  issues = [],
  verifyingHealth = false,
  fontScale = 1,
  allowedFormats = ['mxf'],
  onUpdateAllowedFormats,
  onRunDeepHealthCheck,
  onFocusRow,
  onAddMissingDraftSlot,
  onRequestRevision,
  activeFilterCategory,
  onSelectFilterCategory
}) {
  const [expandedPanel, setExpandedPanel] = useState(null); // 'issues' | 'draft_compare' | 'broadcast_diff' | 'format_settings' | null
  const [customFormatInput, setCustomFormatInput] = useState('');
  const scale = Number(fontScale) > 0 ? Number(fontScale) : 1;
  const px = (base) => `${Math.round(base * scale * 10) / 10}px`;

  // Klip ve Reklam Ayrı Ayrı İstatistikler ("reklamları belirttiğin gibi klipleri de belirt")
  const totalItems = programs.length;
  let dbOkCount = 0;
  let fileOkCount = 0;
  let healthyCount = 0;
  let problematicRowsCount = 0;

  let totalClipItems = 0;
  let introClipItems = 0;
  let mainProgramClipItems = 0;
  let totalClipDurationSec = 0;
  let healthyClipItems = 0;

  let totalAdItems = 0;
  let healthyAdItems = 0;

  programs.forEach(p => {
    const isAd = Boolean(p.isAdClip || p.isFromAds || p.type === 'ad_break' || p.type === 'ad_spot');
    const durSec = Number(p.durationSec) || Math.round((Number(p.duration) || 0) * 60);
    const h = healthMap[p.instanceId];
    const isRowHealthy = !h ? !p.isEmptyAdBreak : (!h.isCorrupted && h.inDatabase && h.fileExists && !p.isEmptyAdBreak);

    if (isAd) {
      totalAdItems++;
      if (isRowHealthy) healthyAdItems++;
    } else {
      totalClipItems++;
      totalClipDurationSec += durSec;
      const isIntro = Boolean(p.isIntroClip || p.unitType === 'intro' || String(p.categoryName || p.category || '').toLowerCase().includes('jenerik'));
      if (isIntro) introClipItems++;
      else mainProgramClipItems++;
      if (isRowHealthy) healthyClipItems++;
    }

    if (!h) {
      dbOkCount++;
      fileOkCount++;
      healthyCount++;
      return;
    }
    if (h.inDatabase) dbOkCount++;
    if (h.fileExists) fileOkCount++;
    if (isRowHealthy) {
      healthyCount++;
    } else {
      problematicRowsCount++;
    }
  });

  const errorGroups = issues.filter(i => i.severity === 'error');
  const warningGroups = issues.filter(i => i.severity === 'warning');

  const totalDraft = stageAnalysis?.totalDraftSlots || 0;
  const matchedDraft = stageAnalysis?.matchedDraftCount || 0;
  const missingDraftCount = stageAnalysis?.missingDraftSlots?.length || 0;
  const addedByBroadcastCount = stageAnalysis?.addedByBroadcastItems?.length || 0;
  const modifiedByBroadcastCount = stageAnalysis?.modifiedByBroadcastItems?.length || 0;
  const adsSummary = stageAnalysis?.adsSummary || {
    totalAdItems: 0,
    commercialSpotsCount: 0,
    bumperSpotsCount: 0,
    emptyAdBreaksCount: 0,
    totalAdDurationSec: 0
  };

  const handleToggleFormat = (fmt) => {
    const clean = String(fmt || '').toLowerCase().replace(/^\./, '');
    if (!clean) return;
    const exists = allowedFormats.includes(clean);
    let next;
    if (exists) {
      if (allowedFormats.length <= 1) return;
      next = allowedFormats.filter(f => f !== clean);
    } else {
      next = [...allowedFormats, clean];
    }
    onUpdateAllowedFormats(next);
  };

  const handleAddCustomFormat = (e) => {
    e.preventDefault();
    const clean = customFormatInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return;
    if (!allowedFormats.includes(clean)) {
      onUpdateAllowedFormats([...allowedFormats, clean]);
    }
    setCustomFormatInput('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '14px 18px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)'
    }}>
      {/* 1. FERAH 4'LÜ DURUM ÖZETİ: TASLAK (#0C617C) • PROGRAM KLİPLERİ (#468625) • REKLAMLAR (#E8B44C) • DB & HIGHRES (#142A44) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '14px'
      }}>
        {/* KART 1: TASLAK PLANLAMA KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'draft_compare' ? null : 'draft_compare'))}
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            background: '#FFFFFF',
            border: expandedPanel === 'draft_compare'
              ? '1.5px solid var(--m-taslak, #0C617C)'
              : '1px solid var(--border-color, #DCE5E9)',
            borderTop: '5px solid var(--m-taslak, #0C617C)',
            boxShadow: '0 2px 8px rgba(10, 16, 29, 0.04)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: px(12.5), fontWeight: 800, color: 'var(--m-taslak, #0C617C)', letterSpacing: '0.04em' }}>
              1. TASLAK PLANLAMA
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: px(12.5),
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '4px',
              background: missingDraftCount > 0 ? '#FBEFD6' : '#E3EFDB',
              color: missingDraftCount > 0 ? '#80632A' : '#3C721F',
              border: missingDraftCount > 0 ? '1px solid rgba(232, 180, 76, 0.45)' : '1px solid rgba(70, 134, 37, 0.3)'
            }}>
              {matchedDraft}/{totalDraft} Kuşak
            </span>
          </div>
          <div style={{ fontSize: px(15.5), fontWeight: 800, color: missingDraftCount > 0 ? '#B45309' : 'var(--text-primary, #0A101D)' }}>
            {totalDraft === 0
              ? 'Kayıtlı taslak yok'
              : missingDraftCount === 0
              ? '✓ Taslak programları tam'
              : `${missingDraftCount} taslak programı eksik`}
          </div>
          <div style={{
            fontSize: px(12.5),
            fontWeight: 600,
            color: 'var(--text-secondary, #4B6478)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '4px',
            borderTop: '1px solid rgba(220, 229, 233, 0.65)'
          }}>
            <span>Taslak karşılaştırma tablosunu {expandedPanel === 'draft_compare' ? 'kapat' : 'aç'}</span>
            {expandedPanel === 'draft_compare' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* KART 2: PROGRAM KLİPLERİ KONTROLÜ */}
        <div
          onClick={() => onSelectFilterCategory(activeFilterCategory === 'clips' ? 'all' : 'clips')}
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            background: activeFilterCategory === 'clips' ? '#F3F8F0' : '#FFFFFF',
            border: activeFilterCategory === 'clips'
              ? '1.5px solid var(--m-ready, #468625)'
              : '1px solid var(--border-color, #DCE5E9)',
            borderTop: '5px solid var(--m-ready, #468625)',
            boxShadow: '0 2px 8px rgba(10, 16, 29, 0.04)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: px(12.5), fontWeight: 800, color: '#3C721F', letterSpacing: '0.04em' }}>
              2. PROGRAM KLİPLERİ
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: px(12.5),
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '4px',
              background: '#E3EFDB',
              color: '#3C721F',
              border: '1px solid rgba(70, 134, 37, 0.3)'
            }}>
              {mainProgramClipItems} Klip + {introClipItems} İntro
            </span>
          </div>
          <div style={{ fontSize: px(15), fontWeight: 800, color: 'var(--text-primary, #0A101D)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span>Süre: {formatSecondsReadable(totalClipDurationSec)}</span>
            <span style={{
              color: healthyClipItems === totalClipItems ? '#3C721F' : '#DD1C40',
              fontSize: px(13),
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: healthyClipItems === totalClipItems ? 'rgba(70, 134, 37, 0.1)' : 'rgba(221, 28, 64, 0.1)'
            }}>
              Sağlam: {healthyClipItems}/{totalClipItems}
            </span>
          </div>
          <div style={{
            fontSize: px(12.5),
            color: 'var(--text-secondary, #4B6478)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '4px',
            borderTop: '1px solid rgba(220, 229, 233, 0.65)'
          }}>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setExpandedPanel(prev => (prev === 'broadcast_diff' ? null : 'broadcast_diff'));
              }}
              style={{ textDecoration: 'underline', fontWeight: 700, color: 'var(--turkuaz, #0C617C)' }}
            >
              {modifiedByBroadcastCount} Değişim • +{addedByBroadcastCount} Yayın Planlama Ek
            </span>
            <Film size={15} color="var(--m-ready, #468625)" />
          </div>
        </div>

        {/* KART 3: REKLAM KUŞAKLARI & SPOTLAR KONTROLÜ */}
        <div
          onClick={() => onSelectFilterCategory(activeFilterCategory === 'ads' ? 'all' : 'ads')}
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            background: activeFilterCategory === 'ads' ? '#FDF8EC' : '#FFFFFF',
            border: activeFilterCategory === 'ads'
              ? '1.5px solid var(--m-reklam, #E8B44C)'
              : '1px solid var(--border-color, #DCE5E9)',
            borderTop: '5px solid var(--m-reklam, #E8B44C)',
            boxShadow: '0 2px 8px rgba(10, 16, 29, 0.04)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: px(12.5), fontWeight: 800, color: '#80632A', letterSpacing: '0.04em' }}>
              3. REKLAM SPOTLARI
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: px(12.5),
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '4px',
              background: '#FBEFD6',
              color: '#80632A',
              border: '1px solid rgba(232, 180, 76, 0.45)'
            }}>
              {adsSummary.commercialSpotsCount} Spot + {adsSummary.bumperSpotsCount} RTÜK
            </span>
          </div>
          <div style={{ fontSize: px(15), fontWeight: 800, color: 'var(--text-primary, #0A101D)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span>Süre: {formatSecondsReadable(adsSummary.totalAdDurationSec)}</span>
            <span style={{
              color: healthyAdItems === totalAdItems ? '#3C721F' : '#DD1C40',
              fontSize: px(13),
              fontFamily: 'var(--font-mono)',
              padding: '2px 8px',
              borderRadius: '4px',
              background: healthyAdItems === totalAdItems ? 'rgba(70, 134, 37, 0.1)' : 'rgba(221, 28, 64, 0.1)'
            }}>
              Sağlam: {healthyAdItems}/{totalAdItems}
            </span>
          </div>
          <div style={{
            fontSize: px(12.5),
            fontWeight: 600,
            color: 'var(--text-secondary, #4B6478)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '4px',
            borderTop: '1px solid rgba(220, 229, 233, 0.65)'
          }}>
            <span>
              {adsSummary.emptyAdBreaksCount > 0
                ? `${adsSummary.emptyAdBreaksCount} boş kuşak var`
                : activeFilterCategory === 'ads'
                ? '✓ Sadece reklamlar filtreleniyor'
                : 'Sadece reklamları filtrele'}
            </span>
            <Megaphone size={15} color="#80632A" />
          </div>
        </div>

        {/* KART 4: BİZİM DB • MAM DB • HIGHRES (.MXF) DOSYA YOLU KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'issues' ? null : 'issues'))}
          style={{
            padding: '14px 16px',
            borderRadius: '8px',
            background: '#FFFFFF',
            border: expandedPanel === 'issues'
              ? '1.5px solid var(--m-kontrol, #142A44)'
              : '1px solid var(--border-color, #DCE5E9)',
            borderTop: '5px solid var(--m-kontrol, #142A44)',
            boxShadow: '0 2px 8px rgba(10, 16, 29, 0.04)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{
              fontSize: px(12.5),
              fontWeight: 800,
              color: 'var(--m-kontrol, #142A44)',
              letterSpacing: '0.04em'
            }}>
              4. DB & HIGHRES ({allowedFormats.map(f => `.${f.toUpperCase()}`).join('/')})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPanel(prev => (prev === 'format_settings' ? null : 'format_settings'));
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color, #DCE5E9)',
                  background: 'var(--bg-primary, #F5F7F6)',
                  color: 'var(--text-primary, #0A101D)',
                  fontSize: px(11.5),
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Settings size={12} />
                <span>Format</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunDeepHealthCheck();
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '5px',
                  border: '1px solid var(--turkuaz-100, #CFE1E7)',
                  background: 'var(--turkuaz-50, #E7F0F3)',
                  color: 'var(--turkuaz, #0C617C)',
                  fontSize: px(11.5),
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} className={verifyingHealth ? 'animate-spin' : ''} />
                <span>{verifyingHealth ? 'Taranıyor' : 'Denetle'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: px(13.5), fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: dbOkCount === totalItems ? '#3C721F' : '#DD1C40' }}>
              DB: {dbOkCount}/{totalItems}
            </span>
            <span style={{ color: fileOkCount === totalItems ? '#3C721F' : '#DD1C40' }}>
              HighRes: {fileOkCount}/{totalItems}
            </span>
            <span style={{ color: healthyCount === totalItems ? '#3C721F' : '#DD1C40' }}>
              Sağlam: {healthyCount}/{totalItems}
            </span>
          </div>

          <div style={{
            fontSize: px(12.5),
            fontWeight: 600,
            color: problematicRowsCount > 0 ? '#DD1C40' : 'var(--text-secondary, #4B6478)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '4px',
            borderTop: '1px solid rgba(220, 229, 233, 0.65)'
          }}>
            <span>
              {problematicRowsCount > 0 ? `${errorGroups.length} klipte teknik sorun var` : '✓ Tüm klipler ve reklamlar sağlam'}
            </span>
            {expandedPanel === 'issues' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* AÇILIR PANEL 0: FORMAT & KONTROL AYARLARI (.MXF VARSAYILAN + EK FORMAT EKLEME) */}
      {expandedPanel === 'format_settings' && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--accent-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                ⚙️ Yayın & Arşiv Dosya Formatı Kontrol Ayarları
              </strong>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Dosyalar genel itibarıyla <strong>.MXF</strong> formatındadır. Geçerli kabul edilecek formatları seçebilir veya yeni format ekleyebilirsiniz.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpandedPanel(null)}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Kapat
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
              {Array.from(new Set([...COMMON_BROADCAST_FORMATS, ...allowedFormats])).map(fmt => {
                const isActive = allowedFormats.includes(fmt);
                const isPrimaryMxf = fmt === 'mxf';
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleToggleFormat(fmt)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '7px',
                      border: isActive ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                      background: isActive ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-secondary)',
                      color: isActive ? '#2563eb' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>.{fmt.toUpperCase()}</span>
                    {isPrimaryMxf && (
                      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '4px', background: '#2563eb', color: '#fff' }}>
                        Varsayılan
                      </span>
                    )}
                    {isActive && <span>✓</span>}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAddCustomFormat} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                value={customFormatInput}
                onChange={(e) => setCustomFormatInput(e.target.value)}
                placeholder="Özel format (örn: m2ts)"
                style={{
                  padding: '4px 8px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  width: '135px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '4px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                + Format Ekle
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. BELİRGİN & OKUNAKLI UYARI / HATA ÖZET ÇUBUĞU */}
      {(errorGroups.length > 0 || warningGroups.length > 0) && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: errorGroups.length > 0 ? 'rgba(220, 38, 38, 0.09)' : 'rgba(237, 137, 30, 0.11)',
          border: errorGroups.length > 0 ? '1.5px solid rgba(220, 38, 38, 0.45)' : '1.5px solid rgba(237, 137, 30, 0.45)',
          borderLeft: errorGroups.length > 0 ? '6px solid #dc2626' : '6px solid #d97706',
          boxShadow: '0 2px 10px rgba(10, 16, 29, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: errorGroups.length > 0 ? 'rgba(220, 38, 38, 0.16)' : 'rgba(217, 119, 6, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={19} color={errorGroups.length > 0 ? '#dc2626' : '#b45309'} />
            </div>

            <strong style={{
              fontSize: px(14),
              fontWeight: 800,
              color: errorGroups.length > 0 ? '#b91c1c' : '#92400e'
            }}>
              Kontrol Uyarıları (Tekil Klip & Reklam Bazında Gruplu):
            </strong>

            {errorGroups.length > 0 && (
              <span style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: px(12.5),
                fontWeight: 800,
                boxShadow: '0 1px 4px rgba(220, 38, 38, 0.25)'
              }}>
                {errorGroups.length} Klipte/Reklamda Teknik Hata ({problematicRowsCount} Satır)
              </span>
            )}

            {warningGroups.length > 0 && (
              <span style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: '#d97706',
                color: '#ffffff',
                fontSize: px(12.5),
                fontWeight: 800,
                boxShadow: '0 1px 4px rgba(217, 119, 6, 0.25)'
              }}>
                {warningGroups.length} Taslak / Revize Uyarısı
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onSelectFilterCategory(activeFilterCategory === 'errors_only' ? 'all' : 'errors_only')}
              style={{
                padding: '7px 14px',
                borderRadius: '7px',
                border: '1.5px solid rgba(220, 38, 38, 0.5)',
                background: activeFilterCategory === 'errors_only' ? '#dc2626' : '#FFFFFF',
                color: activeFilterCategory === 'errors_only' ? '#ffffff' : '#dc2626',
                fontSize: px(12.5),
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {activeFilterCategory === 'errors_only' ? 'Tüm Listeyi Göster' : 'Tabloda Sadece Hatalıları Filtrele'}
            </button>

            <button
              type="button"
              onClick={() => setExpandedPanel(prev => (prev === 'issues' ? null : 'issues'))}
              style={{
                padding: '7px 14px',
                borderRadius: '7px',
                border: expandedPanel === 'issues' ? '1.5px solid var(--turkuaz, #0C617C)' : '1.5px solid var(--border-color, #DCE5E9)',
                background: expandedPanel === 'issues' ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
                color: expandedPanel === 'issues' ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
                fontSize: px(12.5),
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{expandedPanel === 'issues' ? 'Hata Listesini Gizle' : `Gruplu Hata Listesini Aç (${issues.length})`}</span>
              {expandedPanel === 'issues' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* AÇILIR PANEL A: AYNI KLİPLERİ VE REKLAMLARI TEK SATIRDA GRUPLAYAN HATA TABLOSU */}
      {expandedPanel === 'issues' && (
        <div style={{
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 4px 14px rgba(10, 16, 29, 0.06)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '10px 16px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: px(12),
            fontWeight: 800,
            color: 'var(--text-secondary)'
          }}>
            <span>TÜR (KLİP / REKLAM) • KLİP ADI, ID & DETAYLI HATA AÇIKLAMASI</span>
            <span>GEÇTİĞİ SATIRLAR VE YAYIN SAATLERİ (TIKLAYINCA SATIRA GİDER)</span>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {issues.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#059669', fontSize: px(13.5), fontWeight: 700 }}>
                ✓ Tüm program klipleri ve reklamlar Bizim DB, MAM DB ve HighRes dosya yolu ({allowedFormats.map(f => `.${f}`).join(', ')}) kontrolünden başarıyla geçti.
              </div>
            ) : (
              issues.map(issue => {
                const isErr = issue.severity === 'error';
                const isWarn = issue.severity === 'warning';
                const color = isErr ? '#dc2626' : isWarn ? '#d97706' : '#2563eb';
                const occurrences = Array.isArray(issue.occurrences) ? issue.occurrences : [];

                return (
                  <div
                    key={issue.id}
                    style={{
                      padding: '11px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: `5px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      background: '#FFFFFF'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1.4 1 320px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: px(11),
                          fontWeight: 800,
                          padding: '2.5px 8px',
                          borderRadius: '4px',
                          background: issue.isAd ? '#d97706' : '#0C617C',
                          color: '#ffffff'
                        }}>
                          {issue.isAd ? '📢 REKLAM' : '🎬 PROGRAM KLİBİ'}
                        </span>
                        <span style={{
                          fontSize: px(11),
                          fontWeight: 800,
                          padding: '2.5px 8px',
                          borderRadius: '4px',
                          background: color,
                          color: '#ffffff'
                        }}>
                          {issue.categoryLabel}
                        </span>
                        <strong style={{ fontSize: px(14), color: 'var(--text-primary)' }}>
                          {issue.title}
                        </strong>
                        {issue.code && (
                          <span style={{ fontSize: px(12), fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            ({issue.code})
                          </span>
                        )}
                        {occurrences.length > 1 && (
                          <span style={{
                            fontSize: px(11.5),
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: 'rgba(220, 38, 38, 0.14)',
                            color: '#dc2626'
                          }}>
                            {occurrences.length} Yerde Tekrar Ediyor
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: px(12.5), color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {issue.description}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 260px' }}>
                      {occurrences.map((occ, oIdx) => (
                        <button
                          key={`${occ.instanceId || oIdx}`}
                          type="button"
                          onClick={() => occ.instanceId && onFocusRow(occ.instanceId)}
                          style={{
                            padding: '4px 9px',
                            borderRadius: '5px',
                            border: `1px solid ${color}55`,
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: px(12),
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            cursor: occ.instanceId ? 'pointer' : 'default',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title={occ.rowIndex ? `${occ.rowIndex}. satıra (${occ.clockStr}) git` : occ.clockStr}
                        >
                          {occ.rowIndex ? (
                            <>
                              <strong style={{ color }}>#{occ.rowIndex}</strong>
                              <span>• {occ.clockStr}</span>
                            </>
                          ) : (
                            <span>{occ.label}</span>
                          )}
                        </button>
                      ))}

                      {issue.draftSlot && !issue.instanceId && (
                        <button
                          type="button"
                          onClick={() => onAddMissingDraftSlot(issue.draftSlot)}
                          style={{
                            padding: '5px 11px',
                            borderRadius: '6px',
                            border: '1px solid rgba(16, 185, 129, 0.45)',
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#059669',
                            fontSize: px(12),
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          + Listeye Ekle
                        </button>
                      )}

                      {(issue.item || issue.draftSlot) && (
                        <button
                          type="button"
                          onClick={() =>
                            onRequestRevision(
                              issue.item || {
                                title: issue.draftSlot?.title,
                                code: issue.draftSlot?.slotId,
                                durationSec: (issue.draftSlot?.draftDurationMin || 30) * 60,
                                isAdClip: false
                              }
                            )
                          }
                          style={{
                            padding: '5px 11px',
                            borderRadius: '6px',
                            border: `1px solid ${color}66`,
                            background: `${color}14`,
                            color,
                            fontSize: px(12),
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Revize İste
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* AÇILIR PANEL B: TASLAK PLANLAMA LİSTESİ KARŞILAŞTIRMASI */}
      {expandedPanel === 'draft_compare' && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 4px 14px rgba(10, 16, 29, 0.06)',
          maxHeight: '280px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontSize: px(13.5), fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
            Taslak Planlama Listesi Kontrolü ({matchedDraft}/{totalDraft} Program Yayında Mevcut)
          </div>
          {(stageAnalysis?.draftSlotComparison || []).map((slot) => (
            <div
              key={slot.slotId}
              style={{
                padding: '8px 12px',
                borderRadius: '7px',
                background: slot.isPresentInList ? 'rgba(16, 185, 129, 0.07)' : 'rgba(245, 158, 11, 0.12)',
                border: slot.isPresentInList ? '1px solid rgba(16, 185, 129, 0.32)' : '1px solid rgba(245, 158, 11, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                fontSize: px(13)
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  {slot.startTime}
                </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: px(13.5) }}>{slot.title}</strong>
                {slot.draftEpisode && (
                  <span style={{ fontSize: px(12), color: 'var(--text-secondary)', fontWeight: 600 }}>
                    (Taslak Bl.{slot.draftEpisode})
                  </span>
                )}
                {slot.modificationDetail && (
                  <span style={{
                    fontSize: px(11.5),
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'rgba(37, 99, 235, 0.14)',
                    color: '#2563eb'
                  }}>
                    🔄 {slot.modificationDetail}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {slot.isPresentInList ? (
                  <>
                    <span style={{ fontSize: px(12), fontWeight: 800, color: '#059669' }}>
                      ✓ Listede Var ({slot.matchedItemsCount} Parça)
                    </span>
                    {slot.primaryMatchInstanceId && (
                      <button
                        type="button"
                        onClick={() => onFocusRow(slot.primaryMatchInstanceId)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '5px',
                          border: '1px solid var(--border-color)',
                          background: '#FFFFFF',
                          color: 'var(--text-primary)',
                          fontSize: px(11.5),
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Göster
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: px(12), fontWeight: 800, color: '#d97706' }}>
                      ⚠️ Listede Eksik!
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddMissingDraftSlot(slot)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '5px',
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#059669',
                        fontSize: px(12),
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      + Listeye Ekle
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AÇILIR PANEL C: YAYIN PLANLAMA DEĞİŞİKLİKLERİ */}
      {expandedPanel === 'broadcast_diff' && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 4px 14px rgba(10, 16, 29, 0.06)',
          maxHeight: '280px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontSize: px(13.5), fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
            Yayın Planlama Tarafından Değiştirilen ({modifiedByBroadcastCount}) ve Taslak Dışı Eklenen ({addedByBroadcastCount}) Program Klipleri
          </div>
          {[...(stageAnalysis?.modifiedByBroadcastItems || []), ...(stageAnalysis?.addedByBroadcastItems || [])].map(({ item, info }) => (
            <div
              key={item.instanceId}
              style={{
                padding: '8px 12px',
                borderRadius: '7px',
                background: info.badgeBg,
                border: `1px solid ${info.badgeColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                fontSize: px(13)
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: px(11.5),
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: info.badgeColor,
                  color: '#ffffff'
                }}>
                  {info.badgeLabel}
                </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: px(13.5) }}>{item.title}</strong>
                <span style={{ fontSize: px(12), color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {info.detailText}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onFocusRow(item.instanceId)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  background: '#FFFFFF',
                  color: 'var(--text-primary)',
                  fontSize: px(12),
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Satıra Git
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
