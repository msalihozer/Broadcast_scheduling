/**
 * @file src/modules/list-control/components/ListControlRundownRow.jsx
 * @description Yayın Liste Kontrol Modülü — Hizalı Flexbox Tablo Satırı (Sürükle-Bırak Sıralama & Kütüphaneden Bırakma Destekli).
 *
 * Özellikler:
 * 1. Flexbox Tablo Sütunları:
 *    - Sıra & Sürükle Tutamacı (⋮⋮ #1)
 *    - Yayın Saati (Giriş → Çıkış)
 *    - Klip / Reklam Adı & Dosya Kodu (.mxf)
 *    - Aşama Kaynağı (Taslak ✓ / Yayın Planlama / Reklam)
 *    - Teknik Kontrol & Açıklamalı Durum (DB • Dosya Yolu (.mxf) • Açıklamalı Bütünlük Bilgisi)
 *    - Düzenlenebilir Süre (Dakika + Saniye)
 *    - İşlemler (ⓘ İzle, Revize İste, ↑/↓, Sil)
 * 2. Sürükle-Bırak (Drag & Drop):
 *    - Tablo içindeki satırları sürükleyerek sırasını değiştirme.
 *    - Sol paneldeki Medya veya Reklam kütüphanesinden sürüklenen klibi/reklamı satırın üstüne bırakarak ekleme veya değiştirme.
 */
import React, { useState, useEffect } from 'react';
import {
  Info, Clock, Edit3, Trash2, ArrowUp, ArrowDown,
  Send, Check, X, AlertTriangle, GripVertical, ArrowLeftRight
} from 'lucide-react';
import {
  formatMinuteToClock,
  formatSecondsReadable
} from '../utils/listControlVerificationEngine';

export default function ListControlRundownRow({
  item,
  index,
  totalCount,
  isSelected,
  isSameClipHighlighted,
  isDragOver,
  health,
  stageInfo,
  rowRef,
  onSelectRow,
  onUpdateDurationSec,
  onMoveUp,
  onMoveDown,
  onDeleteRow,
  onOpenClipPreview,
  onRequestRevision,
  onRowDragStart,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop
}) {
  const isAd = Boolean(item.isAdClip || item.isFromAds || item.type === 'ad_break' || item.type === 'ad_spot');
  const durSec = Math.max(1, Math.round(Number(item.durationSec) || (Number(item.duration) || 0) * 60));
  const startClock = formatMinuteToClock(item.startMinute || 0);
  const endClock = formatMinuteToClock((Number(item.startMinute) || 0) + durSec / 60);

  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editMin, setEditMin] = useState(Math.floor(durSec / 60));
  const [editSec, setEditSec] = useState(durSec % 60);

  useEffect(() => {
    setEditMin(Math.floor(durSec / 60));
    setEditSec(durSec % 60);
  }, [durSec]);

  const handleSaveDuration = (e) => {
    e.stopPropagation();
    const totalNewSec = Math.max(1, (parseInt(editMin, 10) || 0) * 60 + (parseInt(editSec, 10) || 0));
    onUpdateDurationSec(item.instanceId, totalNewSec);
    setIsEditingDuration(false);
  };

  const h = health || {
    inDatabase: true,
    fileExists: true,
    isFormatValid: true,
    detectedFormat: 'mxf',
    isCorrupted: false,
    status: 'healthy',
    dbStatusText: 'DB Kayıtlı',
    fileStatusText: 'Dosya Mevcut (.MXF)',
    integrityStatusText: 'Sağlam (.MXF • Oynatılabilir)'
  };
  const hasHealthError = !h.inDatabase || !h.fileExists || h.isCorrupted || Boolean(item.isEmptyAdBreak);

  const leftBorderColor = hasHealthError
    ? '#dc2626'
    : item.revisionRequested
    ? '#d97706'
    : isAd
    ? item.isSponsor
      ? '#7c3aed'
      : '#d97706'
    : item.categoryColor || '#2563eb';

  const displayCode = h.fileName || item.code || item.fileName || (item.id ? `${item.id}.mxf` : '-');

  return (
    <div
      ref={rowRef}
      draggable={!isEditingDuration}
      onDragStart={(e) => onRowDragStart && onRowDragStart(e, index, item)}
      onDragOver={(e) => onRowDragOver && onRowDragOver(e, index)}
      onDragLeave={(e) => onRowDragLeave && onRowDragLeave(e, index)}
      onDrop={(e) => onRowDrop && onRowDrop(e, index, item)}
      onClick={() => onSelectRow(item, index)}
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        background: isDragOver
          ? 'rgba(37, 99, 235, 0.18)'
          : isSelected
          ? isAd
            ? 'rgba(217, 119, 6, 0.13)'
            : 'rgba(37, 99, 235, 0.12)'
          : hasHealthError
          ? 'rgba(220, 38, 38, 0.05)'
          : isAd
          ? 'rgba(217, 119, 6, 0.035)'
          : 'var(--bg-secondary)',
        outline: isDragOver
          ? '2px dashed #2563eb'
          : isSelected
          ? `2px solid ${isAd ? '#d97706' : '#2563eb'}`
          : isSameClipHighlighted
          ? '2px dashed #f59e0b'
          : 'none',
        outlineOffset: '-2px',
        borderLeft: `4px solid ${leftBorderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
        transition: 'background-color 0.12s ease'
      }}
    >
      {/* SÜTUN 1: SÜRÜKLE TUTAMACI & SIRA NO (64px) */}
      <div
        style={{
          width: '64px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Sürükleyerek satır sırasını değiştirin"
      >
        <GripVertical size={15} color="var(--text-muted)" style={{ cursor: 'grab', flexShrink: 0 }} />
        <span style={{
          fontSize: '12px',
          fontWeight: 900,
          fontFamily: 'monospace',
          color: isAd ? '#d97706' : 'var(--text-primary)'
        }}>
          #{index + 1}
        </span>
      </div>

      {/* SÜTUN 2: GİRİŞ - ÇIKIŞ SAATİ (142px) */}
      <div style={{
        width: '142px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontWeight: 800,
        color: 'var(--text-primary)'
      }}>
        <span>{startClock}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '10.5px' }}>→</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>{endClock}</span>
      </div>

      {/* SÜTUN 3: KLİP / REKLAM ADI & DOSYA KODU (.MXF) (flex: 2, minWidth: 210px) */}
      <div style={{
        flex: '2 1 210px',
        minWidth: '180px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            wordBreak: 'break-word'
          }}>
            {item.title}
          </span>
          {item.episodeNo != null && (
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '5px',
              background: 'rgba(37, 99, 235, 0.14)',
              color: '#2563eb'
            }}>
              Bl.{item.episodeNo}
            </span>
          )}
          {item.partNo != null && (
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '5px',
              background: 'rgba(124, 58, 237, 0.14)',
              color: '#7c3aed'
            }}>
              P.{item.partNo}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)' }}>
            {displayCode}
          </span>
          {item.companyName && (
            <strong style={{ color: '#d97706' }}>• {item.companyName}</strong>
          )}
          {item.modifiedInListControl && item.previousItemSnapshot?.title && (
            <span style={{ color: '#0284c7', fontWeight: 700 }}>
              (Eski: {item.previousItemSnapshot.title})
            </span>
          )}
        </div>

        {item.revisionRequested && (
          <div style={{
            fontSize: '10.5px',
            fontWeight: 800,
            color: '#b45309',
            background: 'rgba(245, 158, 11, 0.14)',
            padding: '2px 6px',
            borderRadius: '5px',
            alignSelf: 'flex-start',
            marginTop: '2px'
          }}>
            ⚠️ Revize ({item.revisionTargetLabel}): {item.revisionReason}
          </div>
        )}
      </div>

      {/* SÜTUN 4: AŞAMA & KAYNAK (155px) */}
      <div style={{
        width: '155px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}>
        {stageInfo && (
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: '6px',
              background: stageInfo.badgeBg,
              color: stageInfo.badgeColor,
              alignSelf: 'flex-start'
            }}
            title={stageInfo.detailText}
          >
            {stageInfo.badgeLabel}
          </span>
        )}
        {isAd && item.parentBreakTitle && (
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            {item.parentBreakTitle}
          </span>
        )}
      </div>

      {/* SÜTUN 5: TEKNİK KONTROL & AÇIKLAMALI DURUM (DB • DOSYA YOLU • DETAYLI BÜTÜNLÜK AÇIKLAMASI) (flex: 1.5, minWidth: 250px) */}
      <div
        style={{
          flex: '1.5 1 250px',
          minWidth: '230px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}
        title={h.resolvedPath ? `Tam Dosya Yolu: ${h.resolvedPath}` : h.integrityStatusText}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            padding: '1.5px 6px',
            borderRadius: '5px',
            background: h.inDatabase ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
            color: h.inDatabase ? '#059669' : '#dc2626'
          }}>
            {h.inDatabase ? 'DB: Kayıtlı ✓' : 'DB: Yok ✗'}
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 800,
            padding: '1.5px 6px',
            borderRadius: '5px',
            background: h.fileExists ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
            color: h.fileExists ? '#059669' : '#dc2626'
          }}>
            {h.fileExists ? `Dosya: .${(h.detectedFormat || 'mxf').toUpperCase()} ✓` : 'Dosya Yolu: Yok ✗'}
          </span>
        </div>

        {/* Açıklamalı Bütünlük / Hata Detayı (Sadece "Bozuk" yazmaz, nedenini açıklar!) */}
        <div style={{
          fontSize: '11px',
          fontWeight: 700,
          color: hasHealthError ? '#dc2626' : '#059669',
          lineHeight: 1.3
        }}>
          {hasHealthError
            ? (Array.isArray(h.issues) && h.issues.length > 0
                ? h.issues.join(' • ')
                : h.integrityStatusText || 'Dosya yolu veya veritabanı kaydı eksik')
            : (h.integrityStatusText || `Sağlam (.${(h.detectedFormat || 'mxf').toUpperCase()} • Oynatılabilir)`)}
        </div>
      </div>

      {/* SÜTUN 6: DÜZENLENEBİLİR SÜRE (118px) */}
      <div style={{ width: '118px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
        {isEditingDuration ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '3px 5px',
              borderRadius: '7px',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--accent-primary)'
            }}
          >
            <input
              type="number"
              min="0"
              max="360"
              value={editMin}
              onChange={(e) => setEditMin(e.target.value)}
              style={{
                width: '36px',
                padding: '2px 3px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              title="Dakika"
            />
            <span style={{ fontSize: '10px' }}>dk</span>
            <input
              type="number"
              min="0"
              max="59"
              value={editSec}
              onChange={(e) => setEditSec(e.target.value)}
              style={{
                width: '36px',
                padding: '2px 3px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                fontSize: '11px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              title="Saniye"
            />
            <button
              type="button"
              onClick={handleSaveDuration}
              style={{
                padding: '2px 5px',
                borderRadius: '4px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <Check size={11} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingDuration(false);
              }}
              style={{
                padding: '2px 4px',
                borderRadius: '4px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingDuration(true);
            }}
            style={{
              padding: '4px 9px',
              borderRadius: '7px',
              border: item.durationModifiedInListControl
                ? '1.5px solid #0284c7'
                : '1px solid var(--border-color)',
              background: item.durationModifiedInListControl
                ? 'rgba(2, 132, 199, 0.12)'
                : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '11.5px',
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Süreyi düzenlemek için tıklayın"
          >
            <Clock size={11} color="var(--accent-primary)" />
            <span>{formatSecondsReadable(durSec)}</span>
          </button>
        )}
      </div>

      {/* SÜTUN 7: İŞLEMLER (210px) */}
      <div style={{
        width: '210px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '5px'
      }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClipPreview({
              fileId: h.dbFileId || item.fileId || null,
              name: item.clipName || item.title,
              title: item.title,
              fileName: h.fileName || item.code || item.fileName,
              durationSec: durSec,
              categoryName: isAd ? 'Reklam' : item.categoryName
            });
          }}
          style={{
            padding: '4px 8px',
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
          title="Klibi İzle & Veritabanı Künyesini Gör"
        >
          <Info size={12} color="#2563eb" />
          <span>İzle</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestRevision(item);
          }}
          style={{
            padding: '4px 8px',
            borderRadius: '7px',
            border: isAd ? '1px solid rgba(217, 119, 6, 0.45)' : '1px solid rgba(37, 99, 235, 0.4)',
            background: isAd ? 'rgba(217, 119, 6, 0.12)' : 'rgba(37, 99, 235, 0.1)',
            color: isAd ? '#d97706' : '#2563eb',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title={isAd ? 'Reklam Rezervasyona Revize Gönder' : 'Taslak veya Yayın Planlamaya Revize Gönder'}
        >
          <Send size={11} />
          <span>Revize</span>
        </button>

        <button
          type="button"
          disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp(item.instanceId);
          }}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            opacity: index === 0 ? 0.35 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: index === 0 ? 'default' : 'pointer'
          }}
          title="Yukarı Taşı"
        >
          <ArrowUp size={12} />
        </button>

        <button
          type="button"
          disabled={index >= totalCount - 1}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(item.instanceId);
          }}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            opacity: index >= totalCount - 1 ? 0.35 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: index >= totalCount - 1 ? 'default' : 'pointer'
          }}
          title="Aşağı Taşı"
        >
          <ArrowDown size={12} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRow(item);
          }}
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            border: '1px solid rgba(220, 38, 38, 0.35)',
            background: 'rgba(220, 38, 38, 0.08)',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Satırı Sil"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
