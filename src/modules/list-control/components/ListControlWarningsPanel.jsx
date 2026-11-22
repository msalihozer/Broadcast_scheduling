/**
 * @file src/modules/list-control/components/ListControlWarningsPanel.jsx
 * @description Yayın Liste Kontrol Modülü — 3 Aşamalı Kontrol Özeti (Taslak • Yayın Planlama • Reklamlar),
 * Teknik Sağlık Özeti (DB • Dosya Yolu • Bozukluk) ve Hatalar / Sorunlar / Uyarılar Alanı.
 */
import React, { useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Info, Database, FolderCheck, ShieldAlert,
  Megaphone, Layers, ChevronDown, ChevronUp, Plus, Send, Crosshair, RefreshCw
} from 'lucide-react';
import { formatSecondsReadable } from '../utils/listControlVerificationEngine';

export default function ListControlWarningsPanel({
  stageAnalysis,
  healthMap = {},
  programs = [],
  issues = [],
  verifyingHealth = false,
  onRunDeepHealthCheck,
  onFocusRow,
  onAddMissingDraftSlot,
  onRequestRevision,
  activeFilterCategory,
  onSelectFilterCategory
}) {
  const [expandedPanel, setExpandedPanel] = useState(null); // 'issues' | 'draft_compare' | 'broadcast_diff' | null

  // Teknik sağlık istatistikleri (Hem klipler hem reklamlar için)
  const totalItems = programs.length;
  let dbOkCount = 0;
  let fileOkCount = 0;
  let healthyCount = 0;
  let missingOrCorruptCount = 0;

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
    if (!h.isCorrupted && h.inDatabase && h.fileExists) {
      healthyCount++;
    } else {
      missingOrCorruptCount++;
    }
  });

  const errorIssues = issues.filter(i => i.severity === 'error');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  const infoIssues = issues.filter(i => i.severity === 'info');

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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      padding: '12px 16px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-color)',
      flexShrink: 0
    }}>
      {/* 1. 4'LÜ KONTROL KARTLARI (TASLAK • YAYIN PLANLAMA • REKLAM • TEKNİK DB/DOSYA/BOZUKLUK) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
        gap: '10px'
      }}>
        {/* KART 1: TASLAK PLANLAMA KONTROLÜ */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'draft_compare' ? null : 'draft_compare'))}
          style={{
            padding: '10px 13px',
            borderRadius: '12px',
            background: missingDraftCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.08)',
            border: missingDraftCount > 0 ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: missingDraftCount > 0 ? '#d97706' : '#059669', textTransform: 'uppercase' }}>
              1. Taslak Planlama Kontrolü
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '999px',
              background: missingDraftCount > 0 ? '#d97706' : '#10b981',
              color: '#ffffff'
            }}>
              {matchedDraft} / {totalDraft} Mevcut
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {totalDraft === 0
              ? 'Bu gün için kayıtlı taslak kuşağı yok'
              : missingDraftCount === 0
              ? '✓ Taslak listesindeki tüm programlar yayında var'
              : `⚠️ Taslaktaki ${missingDraftCount} program listede eksik!`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Detaylı Taslak Karşılaştırması</span>
            {expandedPanel === 'draft_compare' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>

        {/* KART 2: YAYIN PLANLAMA TAKİBİ (DEĞİŞTİRİLEN & EKLENENLER) */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'broadcast_diff' ? null : 'broadcast_diff'))}
          style={{
            padding: '10px 13px',
            borderRadius: '12px',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>
              2. Yayın Planlama Takibi
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(37, 99, 235, 0.16)',
              color: '#2563eb'
            }}>
              {modifiedByBroadcastCount} Değişim • {addedByBroadcastCount} Ek
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            🔄 {modifiedByBroadcastCount} Bölüm Değişti • ➕ {addedByBroadcastCount} Yayın Planlama Ekledi
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Taslaktan farklı / yeni eklenenleri gör</span>
            {expandedPanel === 'broadcast_diff' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>

        {/* KART 3: REKLAM REZERVASYON KONTROLÜ */}
        <div
          onClick={() => onSelectFilterCategory(activeFilterCategory === 'ads' ? 'all' : 'ads')}
          style={{
            padding: '10px 13px',
            borderRadius: '12px',
            background: adsSummary.emptyAdBreaksCount > 0 ? 'rgba(220, 38, 38, 0.09)' : 'rgba(217, 119, 6, 0.09)',
            border: adsSummary.emptyAdBreaksCount > 0 ? '1.5px solid rgba(220, 38, 38, 0.4)' : '1px solid rgba(217, 119, 6, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>
              3. Reklamlar & Kuşaklar
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '999px',
              background: adsSummary.emptyAdBreaksCount > 0 ? '#dc2626' : '#d97706',
              color: '#ffffff'
            }}>
              {adsSummary.commercialSpotsCount} Spot + {adsSummary.bumperSpotsCount} RTÜK
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Toplam Reklam Süresi: {formatSecondsReadable(adsSummary.totalAdDurationSec)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {adsSummary.emptyAdBreaksCount > 0
                ? `⚠️ ${adsSummary.emptyAdBreaksCount} boş kuşak var!`
                : 'Sadece reklamları filtrelemek için tıklayın'}
            </span>
            <Megaphone size={13} color="#d97706" />
          </div>
        </div>

        {/* KART 4: KLİP & REKLAM TEKNİK SAĞLIK (DB • DOSYA YOLU • BOZUKLUK) */}
        <div
          onClick={() => setExpandedPanel(prev => (prev === 'issues' ? null : 'issues'))}
          style={{
            padding: '10px 13px',
            borderRadius: '12px',
            background: missingOrCorruptCount > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(16, 185, 129, 0.09)',
            border: missingOrCorruptCount > 0 ? '1.5px solid rgba(220, 38, 38, 0.45)' : '1px solid rgba(16, 185, 129, 0.35)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              color: missingOrCorruptCount > 0 ? '#dc2626' : '#059669',
              textTransform: 'uppercase'
            }}>
              4. DB • Dosya Yolu • Bozukluk
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRunDeepHealthCheck();
              }}
              style={{
                padding: '2px 8px',
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
              title="Tüm klipleri ve reklamları veritabanı, dosya yolu ve bozukluk açısından yeniden tara"
            >
              <RefreshCw size={11} className={verifyingHealth ? 'animate-spin' : ''} />
              <span>{verifyingHealth ? 'Taranıyor...' : 'Kontrol Et'}</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 800, flexWrap: 'wrap' }}>
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
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              {missingOrCorruptCount > 0
                ? `🔴 ${missingOrCorruptCount} klip/reklamda hata var!`
                : '✓ Tüm klip ve reklamlar sağlam'}
            </span>
            {expandedPanel === 'issues' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </div>

      {/* 2. HATALAR, SORUNLAR VE UYARILAR ŞERİDİ (HER ZAMAN GÖRÜNÜR ÖZET + AÇILIR DETAY) */}
      {(errorIssues.length > 0 || warningIssues.length > 0) && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '10px',
          background: errorIssues.length > 0 ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: errorIssues.length > 0 ? '1px solid rgba(220, 38, 38, 0.38)' : '1px solid rgba(245, 158, 11, 0.38)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '12px' }}>
            <AlertTriangle size={16} color={errorIssues.length > 0 ? '#dc2626' : '#d97706'} />
            <strong style={{ color: errorIssues.length > 0 ? '#dc2626' : '#d97706' }}>
              Uyarı & Sorunlar Alanı:
            </strong>
            {errorIssues.length > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800
              }}>
                {errorIssues.length} Kritik Hata (DB / Dosya / Bozuk Klip)
              </span>
            )}
            {warningIssues.length > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#d97706',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800
              }}>
                {warningIssues.length} Uyarı (Eksik Taslak / Revize)
              </span>
            )}
            {infoIssues.length > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(37, 99, 235, 0.15)',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 800
              }}>
                {infoIssues.length} Yayın Planlama Değişikliği
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
              {activeFilterCategory === 'errors_only' ? 'Tüm Listeyi Göster' : 'Sadece Hatalı Satırları Filtrele'}
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
              <span>{expandedPanel === 'issues' ? 'Sorun Listesini Gizle' : `Tüm Sorunları Aç (${issues.length})`}</span>
              {expandedPanel === 'issues' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* AÇILIR PANEL A: TÜM HATALAR, SORUNLAR VE UYARILAR DETAY LİSTESİ */}
      {expandedPanel === 'issues' && (
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
          {issues.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#059669', fontSize: '12.5px', fontWeight: 700 }}>
              ✓ Bu günün yayın ve reklam listesinde herhangi bir DB, dosya yolu, bozuk klip veya taslak uyumsuzluğu bulunmadı.
            </div>
          ) : (
            issues.map(issue => {
              const isErr = issue.severity === 'error';
              const isWarn = issue.severity === 'warning';
              const color = isErr ? '#dc2626' : isWarn ? '#d97706' : '#2563eb';
              const bg = isErr ? 'rgba(220, 38, 38, 0.08)' : isWarn ? 'rgba(245, 158, 11, 0.08)' : 'rgba(37, 99, 235, 0.08)';
              return (
                <div
                  key={issue.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '9px',
                    background: bg,
                    border: `1px solid ${color}33`,
                    borderLeft: `4px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: '5px',
                        background: color,
                        color: '#ffffff',
                        textTransform: 'uppercase'
                      }}>
                        {issue.categoryLabel}
                      </span>
                      <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                        {issue.title}
                      </strong>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {issue.description}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {issue.draftSlot && !issue.instanceId && (
                      <button
                        type="button"
                        onClick={() => onAddMissingDraftSlot(issue.draftSlot)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '7px',
                          border: '1px solid rgba(16, 185, 129, 0.45)',
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#059669',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Plus size={12} />
                        <span>Listeye Ekle</span>
                      </button>
                    )}

                    {issue.instanceId && (
                      <button
                        type="button"
                        onClick={() => onFocusRow(issue.instanceId)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: '7px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Crosshair size={12} />
                        <span>Satıra Git</span>
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
                          borderRadius: '7px',
                          border: `1px solid ${color}66`,
                          background: 'var(--bg-primary)',
                          color,
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Send size={11} />
                        <span>Revize İste</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* AÇILIR PANEL B: TASLAK PLANLAMA LİSTESİNDEKİ PROGRAMLAR VAR MI YOK MU TABLOSU */}
      {expandedPanel === 'draft_compare' && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          maxHeight: '230px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
            Taslak Planlama Listesi Karşılaştırması ({matchedDraft}/{totalDraft} Kuşak Yayında Mevcut)
          </div>
          {(stageAnalysis?.draftSlotComparison || []).length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px' }}>
              Bu gün için Taslak Planlama verisi bulunamadı.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {stageAnalysis.draftSlotComparison.map((slot) => (
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
                        <button
                          type="button"
                          onClick={() =>
                            onRequestRevision({
                              title: slot.title,
                              code: slot.slotId,
                              durationSec: (slot.draftDurationMin || 30) * 60,
                              isAdClip: false
                            })
                          }
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(217, 119, 6, 0.45)',
                            background: 'rgba(217, 119, 6, 0.14)',
                            color: '#d97706',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Revize İste
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AÇILIR PANEL C: YAYIN PLANLAMA TARAFINDAN DEĞİŞTİRİLEN VEYA TASLAK DIŞI EKLENENLER */}
      {expandedPanel === 'broadcast_diff' && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          maxHeight: '230px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Yayın Planlama Tarafından Değiştirilen ({modifiedByBroadcastCount}) ve Taslak Dışı Eklenen ({addedByBroadcastCount}) Klipler
          </div>
          {modifiedByBroadcastCount === 0 && addedByBroadcastCount === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px' }}>
              Yayın Planlama tarafından değiştirilen veya taslak dışı eklenen klip bulunmuyor.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
      )}
    </div>
  );
}
