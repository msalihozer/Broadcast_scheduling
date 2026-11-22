/**
 * @file src/modules/list-control/components/ListControlRundownRow.jsx
 * @description Yayın Liste Kontrol Modülü — Tekil Klip veya Reklam Flexbox Satırı.
 *
 * Özellikler:
 * - Tıklandığında satırı seçer ve sol panelde o programın tüm bölümlerini (veya reklam katalogunu) açar.
 * - Satır üzerinde doğrudan Süre Düzenleme (Dakika + Saniye), ⓘ İzle & Bilgi, Revize İste, Yukarı/Aşağı Taşı ve Sil butonları bulunur.
 * - Hem klipler hem reklamlar için DB, Dosya Yolu ve Bozukluk rozetlerini gösterir.
 * - Taslak / Yayın Planlama / Reklam Rezervasyon aşama izleme rozetini gösterir.
 */
import React, { useState, useEffect } from 'react';
import {
  Film, Megaphone, Info, Clock, Edit3, Trash2, ArrowUp, ArrowDown,
  Send, Check, X, AlertTriangle, CheckCircle2, ArrowLeftRight
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
  health,
  stageInfo,
  rowRef,
  onSelectRow,
  onUpdateDurationSec,
  onMoveUp,
  onMoveDown,
  onDeleteRow,
  onOpenClipPreview,
  onRequestRevision
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

  const h = health || { inDatabase: true, fileExists: true, isCorrupted: false, status: 'healthy' };
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

  return (
    <div
      ref={rowRef}
      onClick={() => onSelectRow(item, index)}
      style={{
        padding: '10px 14px',
        borderRadius: '12px',
        background: isSelected
          ? isAd
            ? 'rgba(217, 119, 6, 0.13)'
            : 'rgba(37, 99, 235, 0.12)'
          : hasHealthError
          ? 'rgba(220, 38, 38, 0.06)'
          : isAd
          ? 'rgba(217, 119, 6, 0.04)'
          : 'var(--bg-secondary)',
        border: isSelected
          ? `2px solid ${isAd ? '#d97706' : '#2563eb'}`
          : isSameClipHighlighted
          ? '2px dashed #f59e0b'
          : hasHealthError
          ? '1.5px solid rgba(220, 38, 38, 0.45)'
          : '1px solid var(--border-color)',
        borderLeft: `5px solid ${leftBorderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        cursor: 'pointer',
        transition: 'all 0.14s ease',
        boxShadow: isSelected ? '0 6px 18px rgba(0, 0, 0, 0.12)' : 'none'
      }}
    >
      {/* SOL BÖLÜM: SIRA NO + SAAT ARALIĞI + BAŞLIK & ROZETLER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
        {/* Sıra Numarası & Tür İkonu */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '38px',
          height: '38px',
          borderRadius: '10px',
          background: isAd ? 'rgba(217, 119, 6, 0.15)' : 'var(--bg-tertiary)',
          color: isAd ? '#d97706' : 'var(--text-primary)',
          fontWeight: 900,
          fontSize: '12px',
          fontFamily: 'monospace',
          flexShrink: 0
        }}>
          <span>#{index + 1}</span>
        </div>

        {/* Başlangıç - Bitiş Saati */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '4px 9px',
          borderRadius: '8px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          fontFamily: 'monospace',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '12.5px', fontWeight: 900, color: 'var(--text-primary)' }}>
            {startClock}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
            → {endClock}
          </span>
        </div>

        {/* Ana Başlık, Kod, Aşama Kaynağı ve Revize Bilgisi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* Aşama Kaynağı Rozeti (Taslak / Yayın Planlama / Reklam Rezervasyon) */}
            {stageInfo && (
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: stageInfo.badgeBg,
                  color: stageInfo.badgeColor
                }}
                title={stageInfo.detailText}
              >
                {stageInfo.badgeLabel}
              </span>
            )}

            {/* Bölüm / Part Rozeti */}
            {item.episodeNo != null && (
              <span style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(37, 99, 235, 0.14)',
                color: '#2563eb'
              }}>
                Bölüm {item.episodeNo}
              </span>
            )}
            {item.partNo != null && (
              <span style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(124, 58, 237, 0.14)',
                color: '#7c3aed'
              }}>
                Part {item.partNo}
              </span>
            )}

            {/* Reklam Firma / Kuşak Rozeti */}
            {isAd && item.parentBreakTitle && (
              <span style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: '6px',
                background: 'rgba(217, 119, 6, 0.12)',
                color: '#b45309'
              }}>
                {item.parentBreakTitle}
                {item.adOrderInBreak ? ` (${item.adOrderInBreak}/${item.adTotalInBreak})` : ''}
              </span>
            )}
          </div>

          <div style={{
            fontSize: '13.5px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            wordBreak: 'break-word',
            lineHeight: 1.3
          }}>
            {item.title}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
              Kod: {item.code || item.fileName || item.id || '-'}
            </span>
            {item.companyName && (
              <>
                <span>•</span>
                <strong style={{ color: '#d97706' }}>{item.companyName}</strong>
              </>
            )}
            {item.logo && (
              <>
                <span>•</span>
                <span style={{ fontFamily: 'monospace', color: '#10b981' }}>Logo: {item.logo}</span>
              </>
            )}
            {item.modifiedInListControl && item.previousItemSnapshot?.title && (
              <span style={{ color: '#0284c7', fontWeight: 700 }}>
                (Önceki: {item.previousItemSnapshot.title})
              </span>
            )}
          </div>

          {/* Eğer revize istendiyse veya hata varsa satır içi uyarı */}
          {item.revisionRequested && (
            <div style={{
              marginTop: '2px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              color: '#b45309',
              fontSize: '11px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'flex-start'
            }}>
              <AlertTriangle size={12} />
              <span>Revize İstendi ({item.revisionTargetLabel || 'İlgili Birim'}): {item.revisionReason}</span>
            </div>
          )}

          {hasHealthError && Array.isArray(h.issues) && h.issues.length > 0 && (
            <div style={{
              marginTop: '2px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(220, 38, 38, 0.12)',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              alignSelf: 'flex-start'
            }}>
              <AlertTriangle size={12} />
              <span>{h.issues.join(' • ')}</span>
            </div>
          )}
        </div>
      </div>

      {/* SAĞ BÖLÜM: TEKNİK KONTROL ROZETLERİ (DB • DOSYA • BOZUKLUK) + SÜRE BELİRLEME + AKSİYONLAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* 1. DB / Dosya Yolu / Bozukluk Kontrol Rozetleri (Hem Klipler Hem Reklamlar İçin) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 7px',
            borderRadius: '8px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)'
          }}
          title={
            h.resolvedPath
              ? `Dosya Yolu: ${h.resolvedPath} (${h.dbSource || 'MAM DB'})`
              : 'Veritabanı ve Fiziksel Dosya Yolu Durumu'
          }
        >
          <span style={{
            fontSize: '10.5px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '5px',
            background: h.inDatabase ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.16)',
            color: h.inDatabase ? '#059669' : '#dc2626'
          }}>
            {h.inDatabase ? 'DB ✓' : 'DB ✗'}
          </span>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '5px',
            background: h.fileExists ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.16)',
            color: h.fileExists ? '#059669' : '#dc2626'
          }}>
            {h.fileExists ? 'Dosya ✓' : 'Dosya ✗'}
          </span>
          <span style={{
            fontSize: '10.5px',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '5px',
            background: !h.isCorrupted ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.16)',
            color: !h.isCorrupted ? '#059669' : '#dc2626'
          }}>
            {!h.isCorrupted ? 'Sağlam ✓' : 'Bozuk ⚠️'}
          </span>
        </div>

        {/* 2. Klip / Reklam Süresi Belirleme Alanı */}
        {isEditingDuration ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '8px',
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
                width: '44px',
                padding: '3px 5px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              title="Dakika"
            />
            <span style={{ fontSize: '11px', fontWeight: 700 }}>dk</span>
            <input
              type="number"
              min="0"
              max="59"
              value={editSec}
              onChange={(e) => setEditSec(e.target.value)}
              style={{
                width: '44px',
                padding: '3px 5px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              title="Saniye"
            />
            <span style={{ fontSize: '11px', fontWeight: 700 }}>sn</span>
            <button
              type="button"
              onClick={handleSaveDuration}
              style={{
                padding: '3px 7px',
                borderRadius: '5px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
              title="Süreyi Kaydet"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingDuration(false);
              }}
              style={{
                padding: '3px 6px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <X size={12} />
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
              padding: '5px 10px',
              borderRadius: '8px',
              border: item.durationModifiedInListControl
                ? '1.5px solid #0284c7'
                : '1px solid var(--border-color)',
              background: item.durationModifiedInListControl
                ? 'rgba(2, 132, 199, 0.12)'
                : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Süreyi değiştirmek için tıklayın"
          >
            <Clock size={12} color="var(--accent-primary)" />
            <span>{formatSecondsReadable(durSec)}</span>
            <Edit3 size={11} color="var(--text-muted)" />
          </button>
        )}

        {/* 3. ⓘ İzle & Bilgi Butonu */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClipPreview({
              fileId: item.fileId || String(item.id || '').replace(/\D+/g, ''),
              name: item.title,
              fileName: item.code || item.fileName,
              durationSec: durSec,
              categoryName: isAd ? 'Reklam' : item.categoryName
            });
          }}
          style={{
            padding: '5px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title="Klibi / Reklamı İzle ve Teknik Veritabanı Künyesini Gör"
        >
          <Info size={13} color="#2563eb" />
          <span>İzle & Bilgi</span>
        </button>

        {/* 4. Revize İste Butonu (Klip ise Taslak/Yayın Planlama seçtirir, Reklam ise Reklam Rezervasyona gider) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestRevision(item);
          }}
          style={{
            padding: '5px 10px',
            borderRadius: '8px',
            border: isAd
              ? '1px solid rgba(217, 119, 6, 0.45)'
              : '1px solid rgba(37, 99, 235, 0.4)',
            background: isAd
              ? 'rgba(217, 119, 6, 0.12)'
              : 'rgba(37, 99, 235, 0.1)',
            color: isAd ? '#d97706' : '#2563eb',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
          title={
            isAd
              ? 'Bu reklam için Reklam Rezervasyon birimine revize gönder'
              : 'Bu klip için Taslak Planlama veya Yayın Planlama aşamasına revize gönder'
          }
        >
          <Send size={12} />
          <span>Revize İste</span>
        </button>

        {/* 5. Yukarı / Aşağı Taşı & Sil Butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp(item.instanceId);
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: index === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: index === 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: index === 0 ? 'default' : 'pointer'
            }}
            title="Yukarı Taşı"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            disabled={index >= totalCount - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown(item.instanceId);
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: index >= totalCount - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: index >= totalCount - 1 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: index >= totalCount - 1 ? 'default' : 'pointer'
            }}
            title="Aşağı Taşı"
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRow(item);
            }}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              border: '1px solid rgba(220, 38, 38, 0.35)',
              background: 'rgba(220, 38, 38, 0.08)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title={isAd ? 'Reklamı Listeden Sil' : 'Klibi Listeden Sil'}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
