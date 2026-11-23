/**
 * @file src/modules/list-control/components/ListControlRundownRow.jsx
 * @description Yayın Liste Kontrol Modülü — Ekrana Tam Sığan (Responsive Flexbox) Tablo Satırı.
 *
 * 7 Hizalı Flexbox Sütunu:
 * 1. Sıra & Sürükle Tutamacı (⋮⋮ #1) -> 50px
 * 2. Yayın Saati (Giriş / Çıkış) -> 76px (2 satırlı kompakt saat)
 * 3. Tür (🎬 KLİP / 📢 REKLAM), Başlık, Klip ID (#21673) & Fiziksel Dosya Kodu (4SDR4VPM.mxf) -> flex: 2.2 1 170px, minWidth: 0
 * 4. Logo Bilgisi (📺 Yayın Logosu / 📢 Reklam Logosu) -> flex: 1.1 1 125px, minWidth: 0
 * 5. Aşama & Teknik Kontrol (Bizim DB • MAM DB • HighRes .MXF • Detaylı Açıklama) -> flex: 2 1 185px, minWidth: 0
 * 6. Düzenlenebilir Süre -> 78px
 * 7. İşlemler (ⓘ İzle, Revize, ↑, ↓, Sil) -> 144px
 */
import React, { useState, useEffect } from 'react';
import {
  Info, Clock, Trash2, ArrowUp, ArrowDown,
  Send, Check, X, GripVertical, Tv, Megaphone, Film
} from 'lucide-react';
import {
  formatMinuteToClock,
  formatSecondsReadable
} from '../utils/listControlVerificationEngine';
import useThemeStore, { hexToRgba, BOX_SHADOW_OPTIONS } from '../../../store/themeStore';
import { getCategoryColor, getCategoryTitleTextColor } from '../../draft/components/library/constants';

export default function ListControlRundownRow({
  item,
  index,
  totalCount,
  isSelected,
  isSameClipHighlighted,
  isDragOver,
  health,
  stageInfo,
  defaultBroadcastLogo = 'Semerkand_Tv_Logo_Corner',
  defaultAdLogo = 'Semerkand_HD_Reklam_Logo',
  fontScale = 1,
  rowRef,
  onSelectRow,
  onUpdateDurationSec,
  onUpdateLogoEvent,
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
  const isIntro = !isAd && Boolean(item.isIntroClip || item.unitType === 'intro' || String(item.categoryName || item.category || '').toLowerCase().includes('jenerik'));
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

  const themeConfig = useThemeStore(state => state.config);
  const lcMod = themeConfig?.modules?.['list-control'] || {};
  const sp = themeConfig?.specialColors || {};
  const adBlockColor = lcMod.adBlockColor || sp.adBreakColor || '#E8B44C';
  const introBlockColor = sp.introColor || '#0A101D';
  const catColor = getCategoryColor(item.categoryName || item.category) || item.categoryColor || lcMod.programBlockColor || '#0C617C';
  const catTitleColor = lcMod.useCategoryTitleColor !== false
    ? getCategoryTitleTextColor(item.categoryName || item.category)
    : null;
  const lcLeftAccent = Number(lcMod.leftAccentWidth) || 5;
  const lcTintAlpha = Math.max(0.02, Math.min(0.25, (Number(lcMod.cardTintOpacity) || 8) / 100));
  const lcShadowObj = BOX_SHADOW_OPTIONS.find(s => s.id === lcMod.boxShadow) || BOX_SHADOW_OPTIONS[0];

  const leftBorderColor = hasHealthError
    ? '#DD1C40'
    : item.revisionRequested
    ? '#E8B44C'
    : isAd
    ? item.isSponsor
      ? '#ED891E'
      : adBlockColor
    : isIntro
    ? introBlockColor
    : catColor;

  const resolvedClipId = h.dbFileId || item.fileId || item.clipId || (String(item.id || '').match(/^\d+$/) ? item.id : null);
  const resolvedArchiveClipName = h.archiveClipName || item.clipName || (h.fileName && !/^[A-Z0-9]{8}\.mxf$/i.test(h.fileName) && !/^\d+\.mxf$/i.test(h.fileName) ? h.fileName : null) || item.title || '-';
  const highResIdFileLabel = resolvedClipId ? `${resolvedClipId}.mxf` : (h.highResFileName || '-');
  const archiveNameFileLabel = resolvedArchiveClipName !== '-'
    ? (/\.[a-z0-9]{2,4}$/i.test(resolvedArchiveClipName) ? resolvedArchiveClipName : `${resolvedArchiveClipName}.mxf`)
    : (h.fileName || item.code || '-');
  const displayFileCode = archiveNameFileLabel !== '-' ? archiveNameFileLabel : highResIdFileLabel;

  // Logo YALNIZCA Giriş noktalarında gösterilir:
  // 1) Reklam Girişinde -> Reklam Logosu Girer (reklam_giris)
  // 2) Reklam Çıkıştan Sonra / Programa Girerken -> Yayın Logosu Girer (yayin_giris)
  const logoEvent = item.logoEvent || 'none';
  const hasLogoTrigger = logoEvent === 'reklam_giris' || logoEvent === 'yayin_giris';
  const isAdLogoEvent = logoEvent === 'reklam_giris';
  const activeLogoName = hasLogoTrigger
    ? (item.logo || (isAdLogoEvent ? defaultAdLogo : defaultBroadcastLogo))
    : '';

  const fs = (px) => `${(px * (Number(fontScale) || 1)).toFixed(1)}px`;
  const sColWidth = Math.round(54 * (Number(fontScale) || 1));
  const timeColWidth = Math.round(84 * (Number(fontScale) || 1));
  const durColWidth = Math.round(126 * (Number(fontScale) || 1));
  const actColWidth = Math.round(156 * (Number(fontScale) || 1));

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
        padding: lcMod.cardPadding || '8px 12px',
        borderBottom: '1px solid var(--border-color)',
        background: isDragOver
          ? 'rgba(37, 99, 235, 0.18)'
          : isSelected
          ? isAd
            ? hexToRgba(adBlockColor, 0.16)
            : 'rgba(37, 99, 235, 0.12)'
          : hasHealthError
          ? 'rgba(220, 38, 38, 0.05)'
          : isAd
          ? hexToRgba(adBlockColor, lcTintAlpha)
          : `linear-gradient(90deg, ${hexToRgba(leftBorderColor, lcTintAlpha * 0.75)} 0%, var(--bg-secondary) 70%)`,
        outline: isDragOver
          ? '2px dashed #2563eb'
          : isSelected
          ? `2px solid ${isAd ? adBlockColor : '#2563eb'}`
          : isSameClipHighlighted
          ? '2px dashed #f59e0b'
          : 'none',
        outlineOffset: '-2px',
        borderLeft: `${lcLeftAccent}px solid ${leftBorderColor}`,
        boxShadow: lcShadowObj.value,
        fontFamily: 'var(--lc-font-sans, var(--font-sans))',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'background-color 0.12s ease'
      }}
    >
      {/* SÜTUN 1: SÜRÜKLE TUTAMACI & SIRA NO */}
      <div
        style={{
          width: `${sColWidth}px`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '3px'
        }}
        title="Sürükleyerek satır sırasını değiştirin"
      >
        <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab', flexShrink: 0 }} />
        <span style={{
          fontSize: fs(12),
          fontWeight: 900,
          fontFamily: 'monospace',
          color: isAd ? '#d97706' : 'var(--text-primary)'
        }}>
          #{index + 1}
        </span>
      </div>

      {/* SÜTUN 2: YAYIN SAATİ (GİRİŞ / ÇIKIŞ) */}
      <div style={{
        width: `${timeColWidth}px`,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        lineHeight: 1.25
      }}>
        <span style={{ fontSize: fs(12), fontWeight: 900, color: 'var(--text-primary)' }}>
          {startClock}
        </span>
        <span style={{ fontSize: fs(10.5), fontWeight: 700, color: 'var(--text-muted)' }}>
          → {endClock}
        </span>
      </div>

      {/* SÜTUN 3: TÜR (KLİP / REKLAM) • BAŞLIK • KLİP ID & DOSYA KODU (.MXF) */}
      <div style={{
        flex: '2.2 1 170px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {/* Açık Tür Rozeti: Klip mi Reklam mı */}
          <span style={{
            fontSize: fs(10),
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: '2px',
            background: isAd
              ? item.isBumperAd
                ? '#468625'
                : item.isSponsor
                ? '#ED891E'
                : '#E8B44C'
              : isIntro
              ? '#0A101D'
              : '#0C617C',
            color: isAd && !item.isBumperAd && !item.isSponsor ? '#0A101D' : '#ffffff',
            flexShrink: 0,
            letterSpacing: '0.03em'
          }}>
            {isAd
              ? item.isBumperAd
                ? `RTÜK ${item.bumperType === 'intro' ? 'GİRİŞ' : 'ÇIKIŞ'}`
                : item.isSponsor
                ? 'SPONSOR REKLAM'
                : 'REKLAM'
              : isIntro
              ? 'İNTRO KLİP'
              : 'PROGRAM KLİBİ'}
          </span>

          <span style={{
            fontSize: fs(13),
            fontWeight: 800,
            color: !isAd && catTitleColor ? catTitleColor : 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={item.title}>
            {item.title}
          </span>

          {item.episodeNo != null && (
            <span style={{
              fontSize: fs(10),
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'rgba(37, 99, 235, 0.14)',
              color: '#2563eb',
              flexShrink: 0
            }}>
              Bl.{item.episodeNo}
            </span>
          )}
          {item.partNo != null && (
            <span style={{
              fontSize: fs(10),
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'rgba(124, 58, 237, 0.14)',
              color: '#7c3aed',
              flexShrink: 0
            }}>
              P.{item.partNo}
            </span>
          )}
        </div>

        {/* Alt Bilgi Satırı: HighRes ID (<id>.mxf) + Yayın Arşiv Klip İsmi (<isim>.mxf) + Firma / Kategori */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'wrap',
          fontSize: fs(11),
          color: 'var(--text-secondary)'
        }}>
          {resolvedClipId && (
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                color: isAd ? '#b45309' : '#1d4ed8',
                background: isAd ? 'rgba(217, 119, 6, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                padding: '0 5px',
                borderRadius: '4px'
              }}
              title={`HighRes Dizini ID Dosyası: ${highResIdFileLabel}`}
            >
              HighRes ID: #{resolvedClipId} ({highResIdFileLabel})
            </span>
          )}
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              padding: '0 5px',
              borderRadius: '4px'
            }}
            title={`Yayın Arşiv Dizini Klip İsmi: ${archiveNameFileLabel}`}
          >
            Arşiv İsmi: {archiveNameFileLabel}
          </span>
          {isAd && item.companyName && (
            <strong style={{ color: '#d97706' }}>• {item.companyName}</strong>
          )}
          {!isAd && (item.categoryName || item.category) && (
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
              • {item.categoryName || item.category}
            </span>
          )}
          {item.modifiedInListControl && item.previousItemSnapshot?.title && (
            <span style={{ color: '#0284c7', fontWeight: 700 }}>
              (Eski: {item.previousItemSnapshot.title})
            </span>
          )}
        </div>

        {item.revisionRequested && (
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            color: '#b45309',
            background: 'rgba(245, 158, 11, 0.14)',
            padding: '1.5px 6px',
            borderRadius: '4px',
            alignSelf: 'flex-start'
          }}>
            ⚠️ Revize ({item.revisionTargetLabel}): {item.revisionReason}
          </div>
        )}
      </div>

      {/* SÜTUN 4: LOGO GİRİŞİ (Reklam Girişte Reklam Logosu Girer • Reklam Çıkıştan Sonra Programa Girerken Yayın Logosu Girer) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: '1.15 1 130px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          overflow: 'hidden'
        }}
        title={
          hasLogoTrigger
            ? `${item.logoEventLabel || 'Logo Girişi'} → ${activeLogoName}`
            : 'Bu satırda yeni logo girişi yok (mevcut logo devam ediyor).'
        }
      >
        {hasLogoTrigger ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <span style={{
                fontSize: '9.5px',
                fontWeight: 900,
                padding: '1px 5px',
                borderRadius: '4px',
                background: isAdLogoEvent
                  ? 'rgba(217, 119, 6, 0.16)'
                  : 'rgba(16, 185, 129, 0.16)',
                color: isAdLogoEvent
                  ? '#d97706'
                  : '#059669',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
              }}>
                {isAdLogoEvent ? 'REKLAM LOGOSU GİRİŞ' : 'YAYIN LOGOSU GİRİŞ'}
              </span>

              {onUpdateLogoEvent && (
                <select
                  value={item.manualLogoEvent || 'auto'}
                  onChange={(e) => onUpdateLogoEvent(item.instanceId, e.target.value)}
                  style={{
                    fontSize: '9.5px',
                    padding: '0 2px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    maxWidth: '52px'
                  }}
                  title="Logo Girişini Değiştir"
                >
                  <option value="auto">Oto</option>
                  <option value="yayin_giris">📺 Yayın Logosu Giriş</option>
                  <option value="reklam_giris">📢 Reklam Logosu Giriş</option>
                  <option value="none">— Kaldır</option>
                </select>
              )}
            </div>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 800,
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              background: isAdLogoEvent
                ? 'rgba(217, 119, 6, 0.1)'
                : 'rgba(16, 185, 129, 0.1)',
              border: isAdLogoEvent
                ? '1px solid rgba(217, 119, 6, 0.3)'
                : '1px solid rgba(16, 185, 129, 0.3)',
              padding: '2px 6px',
              borderRadius: '5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {activeLogoName}
            </span>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'monospace'
            }}>
              —
            </span>
            {onUpdateLogoEvent && (
              <select
                value={item.manualLogoEvent || 'auto'}
                onChange={(e) => onUpdateLogoEvent(item.instanceId, e.target.value)}
                style={{
                  fontSize: '9.5px',
                  padding: '1px 4px',
                  borderRadius: '4px',
                  border: '1px dashed var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  maxWidth: '92px'
                }}
                title="Bu satıra manuel Logo Girişi ekle"
              >
                <option value="auto">+ Logo Giriş</option>
                <option value="yayin_giris">📺 Yayın Logosu Giriş</option>
                <option value="reklam_giris">📢 Reklam Logosu Giriş</option>
                <option value="none">— Yok</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* SÜTUN 5: AŞAMA & TEKNİK KONTROL (BİZİM DB • MAM DB • HIGHRES .MXF — Hata yazısı kesilmeden tam okunur!) */}
      <div
        style={{
          flex: '2.1 1 195px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}
        title={h.resolvedPath ? `Tam Dosya Yolu: ${h.resolvedPath} (${h.dbSource || 'MAM DB'})` : h.integrityStatusText}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {stageInfo && (
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 800,
                padding: '1px 5px',
                borderRadius: '4px',
                background: stageInfo.badgeBg,
                color: stageInfo.badgeColor
              }}
              title={stageInfo.detailText}
            >
              {stageInfo.badgeLabel}
            </span>
          )}
          <span style={{
            fontSize: '9.5px',
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: '4px',
            background: h.inDatabase ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
            color: h.inDatabase ? '#059669' : '#dc2626'
          }}>
            {h.inDatabase ? 'DB ✓' : 'DB ✗'}
          </span>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: '4px',
            background: h.fileExists ? 'rgba(16, 185, 129, 0.14)' : 'rgba(220, 38, 38, 0.15)',
            color: h.fileExists ? '#059669' : '#dc2626'
          }}>
            {h.fileExists
              ? (h.matchedInHighRes && h.matchedInArsiv
                  ? `HighRes(ID) & Arşiv(İsim) .${(h.detectedFormat || 'mxf').toUpperCase()} ✓`
                  : h.matchedInHighRes
                  ? `HighRes (ID) .${(h.detectedFormat || 'mxf').toUpperCase()} ✓`
                  : h.matchedInArsiv
                  ? `Yayın Arşiv (İsim) .${(h.detectedFormat || 'mxf').toUpperCase()} ✓`
                  : `HighRes/Arşiv .${(h.detectedFormat || 'mxf').toUpperCase()} ✓`)
              : 'Dosya Yolu ✗'}
          </span>
        </div>

        <div style={{
          fontSize: fs(11),
          fontWeight: 700,
          color: hasHealthError ? '#dc2626' : '#059669',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          lineHeight: 1.35
        }}>
          {hasHealthError
            ? (Array.isArray(h.issues) && h.issues.length > 0
                ? h.issues.join(' • ')
                : h.integrityStatusText || 'Dosya yolu veya veritabanı kaydı eksik')
            : (h.integrityStatusText || `Sağlam (.${(h.detectedFormat || 'mxf').toUpperCase()} • Oynatılabilir)`)}
        </div>
      </div>

      {/* SÜTUN 6: DÜZENLENEBİLİR SÜRE (Taşma ve üst üste binme önlendi!) */}
      <div style={{
        width: `${durColWidth}px`,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {isEditingDuration ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 4px',
              borderRadius: '6px',
              background: 'var(--bg-primary)',
              border: '1.5px solid var(--accent-primary)',
              zIndex: 10
            }}
          >
            <input
              type="number"
              min="0"
              max="360"
              value={editMin}
              onChange={(e) => setEditMin(e.target.value)}
              style={{
                width: '30px',
                padding: '1px 2px',
                borderRadius: '3px',
                border: '1px solid var(--border-color)',
                fontSize: '10.5px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              title="Dakika"
            />
            <span style={{ fontSize: '9px' }}>d</span>
            <input
              type="number"
              min="0"
              max="59"
              value={editSec}
              onChange={(e) => setEditSec(e.target.value)}
              style={{
                width: '30px',
                padding: '1px 2px',
                borderRadius: '3px',
                border: '1px solid var(--border-color)',
                fontSize: '10.5px',
                fontWeight: 800,
                textAlign: 'center'
              }}
              title="Saniye"
            />
            <button
              type="button"
              onClick={handleSaveDuration}
              style={{
                padding: '2px 4px',
                borderRadius: '3px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              <Check size={10} />
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
              padding: '4px 8px',
              borderRadius: '6px',
              border: item.durationModifiedInListControl
                ? '1.5px solid #0284c7'
                : '1px solid var(--border-color)',
              background: item.durationModifiedInListControl
                ? 'rgba(2, 132, 199, 0.12)'
                : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: fs(11),
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              maxWidth: '100%'
            }}
            title="Süreyi düzenlemek için tıklayın"
          >
            <Clock size={11} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span>{formatSecondsReadable(durSec)}</span>
          </button>
        )}
      </div>

      {/* SÜTUN 7: İŞLEMLER (ⓘ Bilgi Popup + Revize + Sıralama + Sil) */}
      <div style={{
        width: `${actColWidth}px`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '4px'
      }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClipPreview({
              fileId: resolvedClipId || null,
              name: item.clipName || item.title,
              title: item.title,
              fileName: displayFileCode,
              durationSec: durSec,
              categoryName: isAd ? 'Reklam' : item.categoryName
            });
          }}
          style={{
            width: '25px',
            height: '25px',
            borderRadius: '6px',
            border: '1.5px solid rgba(37, 99, 235, 0.45)',
            background: 'rgba(37, 99, 235, 0.1)',
            color: '#2563eb',
            fontSize: '12px',
            fontWeight: 900,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
          title="Klip / Reklam Detayları, Veritabanı Künyesi ve Video Önizleme (Information ⓘ)"
        >
          <Info size={14} color="#2563eb" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestRevision(item);
          }}
          style={{
            padding: '3px 6px',
            borderRadius: '6px',
            border: isAd ? '1px solid rgba(217, 119, 6, 0.45)' : '1px solid rgba(37, 99, 235, 0.4)',
            background: isAd ? 'rgba(217, 119, 6, 0.12)' : 'rgba(37, 99, 235, 0.1)',
            color: isAd ? '#d97706' : '#2563eb',
            fontSize: '10.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}
          title={isAd ? 'Reklam Rezervasyona Revize Gönder' : 'Taslak veya Yayın Planlamaya Revize Gönder'}
        >
          <Send size={10} />
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
            width: '22px',
            height: '22px',
            borderRadius: '5px',
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
          <ArrowUp size={11} />
        </button>

        <button
          type="button"
          disabled={index >= totalCount - 1}
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown(item.instanceId);
          }}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '5px',
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
          <ArrowDown size={11} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRow(item);
          }}
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '5px',
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
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
