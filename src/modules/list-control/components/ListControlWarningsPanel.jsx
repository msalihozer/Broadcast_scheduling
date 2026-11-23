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
      gap: '8px',
      padding: '10px 14px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)'
    }}>
      {/* 1. KOMPAKT 4'LÜ DURUM ÖZETİ: TASLAK (#0C617C) • PROGRAM KLİPLERİ (#468625) • REKLAMLAR (#E8B44C) • DB & HIGHRES (#142A44) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '10px'
      }}>
        {/* KART 1: TASLAK PLANLAMA KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'draft_compare' ? null : 'draft_compare'))}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderTop: '4px solid var(--m-taslak, #0C617C)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted, #6A7C88)', letterSpacing: '0.06em' }}>
              1. TASLAK PLANLAMA
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '2px',
              background: missingDraftCount > 0 ? '#FBEFD6' : '#E3EFDB',
              color: missingDraftCount > 0 ? '#80632A' : '#3C721F'
            }}>
              {matchedDraft}/{totalDraft} Kuşak
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #0A101D)' }}>
            {totalDraft === 0
              ? 'Kayıtlı taslak yok'
              : missingDraftCount === 0
              ? 'Taslak programları tam'
              : `${missingDraftCount} taslak programı eksik`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #4B6478)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Taslak karşılaştırma tablosu</span>
            {expandedPanel === 'draft_compare' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </div>

        {/* KART 2: PROGRAM KLİPLERİ KONTROLÜ */}
        <div
          onClick={() => onSelectFilterCategory(activeFilterCategory === 'clips' ? 'all' : 'clips')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderTop: '4px solid var(--m-ready, #468625)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted, #6A7C88)', letterSpacing: '0.06em' }}>
              2. PROGRAM KLİPLERİ
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '2px',
              background: '#E3EFDB',
              color: '#3C721F'
            }}>
              {mainProgramClipItems} Klip + {introClipItems} İntro
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #0A101D)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Süre: {formatSecondsReadable(totalClipDurationSec)}</span>
            <span style={{ color: healthyClipItems === totalClipItems ? '#3C721F' : '#DD1C40', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              Sağlam: {healthyClipItems}/{totalClipItems}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #4B6478)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setExpandedPanel(prev => (prev === 'broadcast_diff' ? null : 'broadcast_diff'));
              }}
              style={{ textDecoration: 'underline', fontWeight: 600, color: 'var(--turkuaz, #0C617C)' }}
            >
              {modifiedByBroadcastCount} Değişim • +{addedByBroadcastCount} Yayın Planlama Ek
            </span>
            <Film size={12} color="var(--m-ready, #468625)" />
          </div>
        </div>

        {/* KART 3: REKLAM KUŞAKLARI & SPOTLAR KONTROLÜ */}
        <div
          onClick={() => onSelectFilterCategory(activeFilterCategory === 'ads' ? 'all' : 'ads')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderTop: '4px solid var(--m-reklam, #E8B44C)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted, #6A7C88)', letterSpacing: '0.06em' }}>
              3. REKLAM SPOTLARI
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '2px',
              background: '#FBEFD6',
              color: '#80632A'
            }}>
              {adsSummary.commercialSpotsCount} Spot + {adsSummary.bumperSpotsCount} RTÜK
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary, #0A101D)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Süre: {formatSecondsReadable(adsSummary.totalAdDurationSec)}</span>
            <span style={{ color: healthyAdItems === totalAdItems ? '#3C721F' : '#DD1C40', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              Sağlam: {healthyAdItems}/{totalAdItems}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #4B6478)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {adsSummary.emptyAdBreaksCount > 0
                ? `${adsSummary.emptyAdBreaksCount} boş kuşak var`
                : 'Sadece reklamları filtrele'}
            </span>
            <Megaphone size={12} color="#80632A" />
          </div>
        </div>

        {/* KART 4: BİZİM DB • MAM DB • HIGHRES (.MXF) DOSYA YOLU KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'issues' ? null : 'issues'))}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: '#FFFFFF',
            border: '1px solid var(--border-color, #DCE5E9)',
            borderTop: '4px solid var(--m-kontrol, #142A44)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: 'var(--text-muted, #6A7C88)',
              letterSpacing: '0.06em'
            }}>
              4. DB & HIGHRES ({allowedFormats.map(f => `.${f.toUpperCase()}`).join('/')})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPanel(prev => (prev === 'format_settings' ? null : 'format_settings'));
                }}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #DCE5E9)',
                  background: '#FFFFFF',
                  color: 'var(--text-primary, #0A101D)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Settings size={10} />
                <span>Format</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunDeepHealthCheck();
                }}
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #DCE5E9)',
                  background: '#FFFFFF',
                  color: 'var(--text-primary, #0A101D)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <RefreshCw size={10} className={verifyingHealth ? 'animate-spin' : ''} />
                <span>{verifyingHealth ? 'Taranıyor' : 'Denetle'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
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

          <div style={{ fontSize: '11px', color: 'var(--text-secondary, #4B6478)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {problematicRowsCount > 0 ? `${errorGroups.length} klipte sorun var` : 'Tüm klipler ve reklamlar sağlam'}
            </span>
            {expandedPanel === 'issues' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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

      {/* 2. KOMPAKT UYARI & HATA ÖZET ÇUBUĞU */}
      {(errorGroups.length > 0 || warningGroups.length > 0) && (
        <div style={{
          padding: '7px 11px',
          borderRadius: '9px',
          background: errorGroups.length > 0 ? 'rgba(220, 38, 38, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: errorGroups.length > 0 ? '1px solid rgba(220, 38, 38, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px' }}>
            <AlertTriangle size={14} color={errorGroups.length > 0 ? '#dc2626' : '#d97706'} />
            <strong style={{ color: errorGroups.length > 0 ? '#dc2626' : '#d97706' }}>
              Kontrol Uyarıları (Tekil Klip & Reklam Bazında Gruplu):
            </strong>
            {errorGroups.length > 0 && (
              <span style={{
                padding: '1.5px 7px',
                borderRadius: '5px',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 800
              }}>
                {errorGroups.length} Klipte/Reklamda Teknik Hata ({problematicRowsCount} Satır)
              </span>
            )}
            {warningGroups.length > 0 && (
              <span style={{
                padding: '1.5px 7px',
                borderRadius: '5px',
                background: '#d97706',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 800
              }}>
                {warningGroups.length} Taslak / Revize Uyarısı
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => onSelectFilterCategory(activeFilterCategory === 'errors_only' ? 'all' : 'errors_only')}
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                border: '1px solid rgba(220, 38, 38, 0.4)',
                background: activeFilterCategory === 'errors_only' ? '#dc2626' : 'var(--bg-primary)',
                color: activeFilterCategory === 'errors_only' ? '#ffffff' : '#dc2626',
                fontSize: '10.5px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {activeFilterCategory === 'errors_only' ? 'Tüm Listeyi Göster' : 'Tabloda Sadece Hatalıları Filtrele'}
            </button>

            <button
              type="button"
              onClick={() => setExpandedPanel(prev => (prev === 'issues' ? null : 'issues'))}
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '10.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{expandedPanel === 'issues' ? 'Hata Listesini Gizle' : `Gruplu Hata Listesini Aç (${issues.length})`}</span>
              {expandedPanel === 'issues' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* AÇILIR PANEL A: AYNI KLİPLERİ VE REKLAMLARI TEK SATIRDA GRUPLAYAN HATA TABLOSU */}
      {expandedPanel === 'issues' && (
        <div style={{
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '7px 12px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10.5px',
            fontWeight: 800,
            color: 'var(--text-secondary)'
          }}>
            <span>TÜR (KLİP / REKLAM) • KLİP ADI, ID & DETAYLI HATA AÇIKLAMASI</span>
            <span>GEÇTİĞİ SATIRLAR VE YAYIN SAATLERİ (TIKLAYINCA SATIRA GİDER)</span>
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {issues.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#059669', fontSize: '12px', fontWeight: 700 }}>
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
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1.4 1 300px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: issue.isAd ? '#d97706' : '#2563eb',
                          color: '#ffffff'
                        }}>
                          {issue.isAd ? '📢 REKLAM' : '🎬 PROGRAM KLİBİ'}
                        </span>
                        <span style={{
                          fontSize: '9.5px',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: color,
                          color: '#ffffff'
                        }}>
                          {issue.categoryLabel}
                        </span>
                        <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                          {issue.title}
                        </strong>
                        {issue.code && (
                          <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            ({issue.code})
                          </span>
                        )}
                        {occurrences.length > 1 && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 900,
                            padding: '1px 6px',
                            borderRadius: '999px',
                            background: 'rgba(220, 38, 38, 0.14)',
                            color: '#dc2626'
                          }}>
                            {occurrences.length} Yerde Tekrar Ediyor
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {issue.description}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 240px' }}>
                      {occurrences.map((occ, oIdx) => (
                        <button
                          key={`${occ.instanceId || oIdx}`}
                          type="button"
                          onClick={() => occ.instanceId && onFocusRow(occ.instanceId)}
                          style={{
                            padding: '2px 7px',
                            borderRadius: '5px',
                            border: `1px solid ${color}55`,
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            cursor: occ.instanceId ? 'pointer' : 'default',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
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
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: '1px solid rgba(16, 185, 129, 0.45)',
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#059669',
                            fontSize: '10.5px',
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
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: `1px solid ${color}66`,
                            background: `${color}14`,
                            color,
                            fontSize: '10.5px',
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
          padding: '8px 10px',
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          maxHeight: '200px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Taslak Planlama Listesi Kontrolü ({matchedDraft}/{totalDraft} Program Yayında Mevcut)
          </div>
          {(stageAnalysis?.draftSlotComparison || []).map((slot) => (
            <div
              key={slot.slotId}
              style={{
                padding: '5px 9px',
                borderRadius: '7px',
                background: slot.isPresentInList ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.12)',
                border: slot.isPresentInList ? '1px solid rgba(16, 185, 129, 0.28)' : '1px solid rgba(245, 158, 11, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                fontSize: '11.5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  {slot.startTime}
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{slot.title}</strong>
                {slot.draftEpisode && (
                  <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                    (Taslak Bl.{slot.draftEpisode})
                  </span>
                )}
                {slot.modificationDetail && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(37, 99, 235, 0.14)',
                    color: '#2563eb'
                  }}>
                    🔄 {slot.modificationDetail}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {slot.isPresentInList ? (
                  <>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669' }}>
                      ✓ Listede Var ({slot.matchedItemsCount} Parça)
                    </span>
                    {slot.primaryMatchInstanceId && (
                      <button
                        type="button"
                        onClick={() => onFocusRow(slot.primaryMatchInstanceId)}
                        style={{
                          padding: '2px 7px',
                          borderRadius: '5px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '10px',
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
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#d97706' }}>
                      ⚠️ Listede Eksik!
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddMissingDraftSlot(slot)}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '5px',
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#059669',
                        fontSize: '10.5px',
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
          padding: '8px 10px',
          borderRadius: '10px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          maxHeight: '200px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Yayın Planlama Tarafından Değiştirilen ({modifiedByBroadcastCount}) ve Taslak Dışı Eklenen ({addedByBroadcastCount}) Program Klipleri
          </div>
          {[...(stageAnalysis?.modifiedByBroadcastItems || []), ...(stageAnalysis?.addedByBroadcastItems || [])].map(({ item, info }) => (
            <div
              key={item.instanceId}
              style={{
                padding: '5px 9px',
                borderRadius: '7px',
                background: info.badgeBg,
                border: `1px solid ${info.badgeColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                fontSize: '11.5px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: info.badgeColor,
                  color: '#ffffff'
                }}>
                  {info.badgeLabel}
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong>
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                  {info.detailText}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onFocusRow(item.instanceId)}
                style={{
                  padding: '2px 7px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '10.5px',
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
