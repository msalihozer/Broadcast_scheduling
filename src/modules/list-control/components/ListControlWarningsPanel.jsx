/**
 * @file src/modules/list-control/components/ListControlWarningsPanel.jsx
 * @description Yayın Liste Kontrol Modülü — Sadeleştirilmiş 4'lü Kontrol Özeti (Taslak • Yayın Planlama • Reklamlar • DB/Dosya/Format),
 * Ayarlanabilir Medya Formatları (.mxf varsayılan + ek format ekleme) ve
 * Aynı Klipleri Tek Satırda Gruplayan (Yanında Satır No & Saat Rozetli) Hata / Uyarı Merkezi.
 */
import React, { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Info, Megaphone, ChevronDown, ChevronUp,
  Plus, Send, Crosshair, RefreshCw, Settings, X
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

  // Teknik sağlık istatistikleri (Hem klipler hem reklamlar için)
  const totalItems = programs.length;
  let dbOkCount = 0;
  let fileOkCount = 0;
  let healthyCount = 0;
  let problematicRowsCount = 0;

  programs.forEach(p => {
    const h = healthMap[p.instanceId];
    if (!h) {
      dbOkCount++;
      fileOkCount++;
      healthyCount++;
      return;
    }
    if (h.inDatabase) dbOkCount++;
    if (h.fileExists) fileOkCount++;
    if (!h.isCorrupted && h.inDatabase && h.fileExists && !p.isEmptyAdBreak) {
      healthyCount++;
    } else {
      problematicRowsCount++;
    }
  });

  const errorGroups = issues.filter(i => i.severity === 'error');
  const warningGroups = issues.filter(i => i.severity === 'warning');
  const infoGroups = issues.filter(i => i.severity === 'info');

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
      if (allowedFormats.length <= 1) return; // En az 1 format (.mxf) aktif kalmalı
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
      gap: '10px',
      padding: '12px 16px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)'
    }}>
      {/* 1. KOMPAKT 4'LÜ DURUM ÖZETİ + FORMAT AYARLARI BUTONU */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {/* KART 1: TASLAK PLANLAMA KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'draft_compare' ? null : 'draft_compare'))}
          style={{
            flex: '1 1 210px',
            padding: '9px 12px',
            borderRadius: '11px',
            background: missingDraftCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.08)',
            border: missingDraftCount > 0 ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.32)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: missingDraftCount > 0 ? '#d97706' : '#059669' }}>
              1. TASLAK KONTROLÜ
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 900,
              padding: '1px 7px',
              borderRadius: '999px',
              background: missingDraftCount > 0 ? '#d97706' : '#10b981',
              color: '#ffffff'
            }}>
              {matchedDraft}/{totalDraft} Mevcut
            </span>
          </div>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {totalDraft === 0
                ? 'Kayıtlı taslak yok'
                : missingDraftCount === 0
                ? '✓ Taslak programları tam'
                : `⚠️ ${missingDraftCount} taslak programı eksik`}
            </span>
            {expandedPanel === 'draft_compare' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>

        {/* KART 2: YAYIN PLANLAMA TAKİBİ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'broadcast_diff' ? null : 'broadcast_diff'))}
          style={{
            flex: '1 1 210px',
            padding: '9px 12px',
            borderRadius: '11px',
            background: 'rgba(37, 99, 235, 0.07)',
            border: '1px solid rgba(37, 99, 235, 0.28)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb' }}>
              2. YAYIN PLANLAMA FARKI
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 800,
              padding: '1px 7px',
              borderRadius: '999px',
              background: 'rgba(37, 99, 235, 0.15)',
              color: '#2563eb'
            }}>
              {modifiedByBroadcastCount} Değişim • {addedByBroadcastCount} Ek
            </span>
          </div>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Taslaktan farklı / yeni eklenenler</span>
            {expandedPanel === 'broadcast_diff' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>

        {/* KART 3: REKLAM KUŞAKLARI & SPOTLAR */}
        <div
          onClick={() => onSelectFilterCategory(activeFilterCategory === 'ads' ? 'all' : 'ads')}
          style={{
            flex: '1 1 210px',
            padding: '9px 12px',
            borderRadius: '11px',
            background: adsSummary.emptyAdBreaksCount > 0 ? 'rgba(220, 38, 38, 0.09)' : 'rgba(217, 119, 6, 0.08)',
            border: adsSummary.emptyAdBreaksCount > 0 ? '1.5px solid rgba(220, 38, 38, 0.4)' : '1px solid rgba(217, 119, 6, 0.32)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>
              3. REKLAM KONTROLÜ
            </span>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 900,
              padding: '1px 7px',
              borderRadius: '999px',
              background: adsSummary.emptyAdBreaksCount > 0 ? '#dc2626' : '#d97706',
              color: '#ffffff'
            }}>
              {adsSummary.commercialSpotsCount} Spot + {adsSummary.bumperSpotsCount} RTÜK
            </span>
          </div>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Toplam: {formatSecondsReadable(adsSummary.totalAdDurationSec)}</span>
            <Megaphone size={13} color="#d97706" />
          </div>
        </div>

        {/* KART 4: DB • DOSYA YOLU (.MXF) • BÜTÜNLÜK KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'issues' ? null : 'issues'))}
          style={{
            flex: '1.3 1 275px',
            padding: '9px 12px',
            borderRadius: '11px',
            background: problematicRowsCount > 0 ? 'rgba(220, 38, 38, 0.09)' : 'rgba(16, 185, 129, 0.08)',
            border: problematicRowsCount > 0 ? '1.5px solid rgba(220, 38, 38, 0.42)' : '1px solid rgba(16, 185, 129, 0.32)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              color: problematicRowsCount > 0 ? '#dc2626' : '#059669'
            }}>
              4. DB • DOSYA YOLU ({allowedFormats.map(f => `.${f.toUpperCase()}`).join('/')})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedPanel(prev => (prev === 'format_settings' ? null : 'format_settings'));
                }}
                style={{
                  padding: '2px 7px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="Dosya Formatı Ayarları (.mxf varsayılan, ek format ekle/çıkar)"
              >
                <Settings size={11} />
                <span>Format</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunDeepHealthCheck();
                }}
                style={{
                  padding: '2px 7px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title="Video oynatıcı dosya yolu üzerinden tüm klip ve reklamları yeniden kontrol et"
              >
                <RefreshCw size={11} className={verifyingHealth ? 'animate-spin' : ''} />
                <span>{verifyingHealth ? 'Taranıyor' : 'Denetle'}</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 800 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: dbOkCount === totalItems ? '#059669' : '#dc2626' }}>
                DB: {dbOkCount}/{totalItems}
              </span>
              <span>•</span>
              <span style={{ color: fileOkCount === totalItems ? '#059669' : '#dc2626' }}>
                Dosya: {fileOkCount}/{totalItems}
              </span>
              <span>•</span>
              <span style={{ color: healthyCount === totalItems ? '#059669' : '#dc2626' }}>
                Sağlam: {healthyCount}/{totalItems}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: problematicRowsCount > 0 ? '#dc2626' : '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {problematicRowsCount > 0 ? `${errorGroups.length} Klipte Hata` : 'Tümü Sağlam'}
              {expandedPanel === 'issues' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
        </div>
      </div>

      {/* AÇILIR PANEL 0: FORMAT & KONTROL AYARLARI (.MXF VARSAYILAN + EK FORMAT EKLEME) */}
      {expandedPanel === 'format_settings' && (
        <div style={{
          padding: '12px 14px',
          borderRadius: '12px',
          background: 'var(--bg-primary)',
          border: '1.5px solid var(--accent-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                ⚙️ Yayın & Arşiv Dosya Formatı Kontrol Ayarları
              </strong>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Dosyalar genel itibarıyla <strong>.MXF</strong> formatındadır. Geçerli kabul edilecek dosya formatlarını aşağıdan seçebilir veya yeni format ekleyebilirsiniz.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExpandedPanel(null)}
              style={{
                padding: '4px 8px',
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {Array.from(new Set([...COMMON_BROADCAST_FORMATS, ...allowedFormats])).map(fmt => {
                const isActive = allowedFormats.includes(fmt);
                const isPrimaryMxf = fmt === 'mxf';
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleToggleFormat(fmt)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '8px',
                      border: isActive ? '1.5px solid #2563eb' : '1px solid var(--border-color)',
                      background: isActive ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-secondary)',
                      color: isActive ? '#2563eb' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>.{fmt.toUpperCase()}</span>
                    {isPrimaryMxf && (
                      <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', background: '#2563eb', color: '#fff' }}>
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
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  width: '140px',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '5px 11px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#ffffff',
                  fontSize: '11.5px',
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

      {/* 2. KOMPAKT UYARI & HATA ÖZET ÇUBUĞU (TEK SATIRDA GRUPLANMIŞ KLİP HATALARI) */}
      {(errorGroups.length > 0 || warningGroups.length > 0) && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '10px',
          background: errorGroups.length > 0 ? 'rgba(220, 38, 38, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: errorGroups.length > 0 ? '1px solid rgba(220, 38, 38, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
            <AlertTriangle size={15} color={errorGroups.length > 0 ? '#dc2626' : '#d97706'} />
            <strong style={{ color: errorGroups.length > 0 ? '#dc2626' : '#d97706' }}>
              Tespit Edilen Sorunlar (Tekil Klip Bazında Gruplanmış):
            </strong>
            {errorGroups.length > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800
              }}>
                {errorGroups.length} Klipte Teknik Hata (Toplam {problematicRowsCount} Satır)
              </span>
            )}
            {warningGroups.length > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#d97706',
                color: '#ffffff',
                fontSize: '11px',
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
                padding: '4px 10px',
                borderRadius: '7px',
                border: '1px solid rgba(220, 38, 38, 0.4)',
                background: activeFilterCategory === 'errors_only' ? '#dc2626' : 'var(--bg-primary)',
                color: activeFilterCategory === 'errors_only' ? '#ffffff' : '#dc2626',
                fontSize: '11px',
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
                padding: '4px 10px',
                borderRadius: '7px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>{expandedPanel === 'issues' ? 'Hata Tablosunu Gizle' : `Gruplanmış Hata Listesini Aç (${issues.length})`}</span>
              {expandedPanel === 'issues' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* AÇILIR PANEL A: AYNI KLİPLERİ TEK SATIRDA GRUPLAYAN VE YANINDA SATIR/SAAT ROZETLERİNİ GÖSTEREN HATA TABLOSU */}
      {expandedPanel === 'issues' && (
        <div style={{
          borderRadius: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--text-secondary)'
          }}>
            <span>KLİP / REKLAM ADI & DETAYLI HATA AÇIKLAMASI</span>
            <span>GEÇTİĞİ SATIRLAR VE YAYIN SAATLERİ (TIKLAYINCA SATIRA GİDER)</span>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {issues.length === 0 ? (
              <div style={{ padding: '14px', textAlign: 'center', color: '#059669', fontSize: '12.5px', fontWeight: 700 }}>
                ✓ Tüm klip ve reklamlar DB, dosya yolu ({allowedFormats.map(f => `.${f}`).join(', ')}) ve bütünlük kontrolünden başarıyla geçti.
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
                      padding: '9px 12px',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: `4px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Sol: Klip Adı, Kodu ve Açıklamalı Hata Sebebi */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1.4 1 320px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '5px',
                          background: color,
                          color: '#ffffff'
                        }}>
                          {issue.categoryLabel}
                        </span>
                        <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                          {issue.title}
                        </strong>
                        {issue.code && (
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 700 }}>
                            ({issue.code})
                          </span>
                        )}
                        {occurrences.length > 1 && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: 900,
                            padding: '1px 7px',
                            borderRadius: '999px',
                            background: 'rgba(220, 38, 38, 0.14)',
                            color: '#dc2626'
                          }}>
                            {occurrences.length} Yerde Tekrar Ediyor
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {issue.description}
                      </div>
                    </div>

                    {/* Sağ: Aynı Klibin Bulunduğu Tüm Satır ve Saatler + Revize Butonu */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: '1 1 260px' }}>
                      {occurrences.map((occ, oIdx) => (
                        <button
                          key={`${occ.instanceId || oIdx}`}
                          type="button"
                          onClick={() => occ.instanceId && onFocusRow(occ.instanceId)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${color}55`,
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
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
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: '1px solid rgba(16, 185, 129, 0.45)',
                            background: 'rgba(16, 185, 129, 0.14)',
                            color: '#059669',
                            fontSize: '11px',
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
                            padding: '4px 9px',
                            borderRadius: '6px',
                            border: `1px solid ${color}66`,
                            background: `${color}14`,
                            color,
                            fontSize: '11px',
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
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
            Taslak Planlama Listesi Kontrolü ({matchedDraft}/{totalDraft} Program Yayında Mevcut)
          </div>
          {(stageAnalysis?.draftSlotComparison || []).map((slot) => (
            <div
              key={slot.slotId}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                background: slot.isPresentInList ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.12)',
                border: slot.isPresentInList ? '1px solid rgba(16, 185, 129, 0.28)' : '1px solid rgba(245, 158, 11, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-secondary)' }}>
                  {slot.startTime}
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{slot.title}</strong>
                {slot.draftEpisode && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    (Taslak Bl.{slot.draftEpisode})
                  </span>
                )}
                {slot.modificationDetail && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '5px',
                    background: 'rgba(37, 99, 235, 0.14)',
                    color: '#2563eb'
                  }}>
                    🔄 {slot.modificationDetail}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {slot.isPresentInList ? (
                  <>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669' }}>
                      ✓ Listede Var ({slot.matchedItemsCount} Parça)
                    </span>
                    {slot.primaryMatchInstanceId && (
                      <button
                        type="button"
                        onClick={() => onFocusRow(slot.primaryMatchInstanceId)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '10.5px',
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
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706' }}>
                      ⚠️ Listede Eksik!
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddMissingDraftSlot(slot)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(16, 185, 129, 0.45)',
                        background: 'rgba(16, 185, 129, 0.14)',
                        color: '#059669',
                        fontSize: '11px',
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
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          maxHeight: '220px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Yayın Planlama Tarafından Değiştirilen ({modifiedByBroadcastCount}) ve Taslak Dışı Eklenen ({addedByBroadcastCount}) Klipler
          </div>
          {[...(stageAnalysis?.modifiedByBroadcastItems || []), ...(stageAnalysis?.addedByBroadcastItems || [])].map(({ item, info }) => (
            <div
              key={item.instanceId}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                background: info.badgeBg,
                border: `1px solid ${info.badgeColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: info.badgeColor,
                  color: '#ffffff'
                }}>
                  {info.badgeLabel}
                </span>
                <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {info.detailText}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onFocusRow(item.instanceId)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '11px',
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
