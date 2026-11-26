/**
 * @file src/modules/list-control/components/ListControlRundownRow.jsx
 * @description Yayın Liste Kontrol Modülü — Sadeleştirilmiş, Kurumsal Flexbox Tablo Satırı.
 *
 * 6 Hizalı Flexbox Sütunu:
 * 1. Sıra & Sürükle Tutamacı (#1) -> 54px
 * 2. Yayın Saati (Giriş Saati büyük ortada, Çıkış Saati altında küçük) -> 88px
 * 3. Program / Reklam Adı (Sadece isim; program ve reklam satırları arka plan/kenarlık renk tonuyla ayrışır) -> flex: 2.5 1 220px
 * 4. Süre (İsim sütunundan hemen sonra; düzenlenebilir süre) -> 118px
 * 5. Logo Girişi (Sadeleştirilmiş: Sadece Reklam Giriş veya Yayın Giriş) -> 145px
 * 6. İşlemler & Teknik Kontrol (Renkli Teknik Kontrol Durum Butonu [Kırmızı: Hata, Turuncu: Uyarı, Yeşil: Sağlam -> Tıklanınca Detay Pop-up] + ⓘ İzle + Revize + ↑ + ↓ + Sil) -> 195px
 */
import React, { useState, useEffect } from 'react';
import {
  Info, Clock, Trash2, ArrowUp, ArrowDown,
  Send, Check, GripVertical, ShieldCheck, AlertTriangle, ShieldAlert
} from 'lucide-react';
import {
  formatMinuteToClock,
  formatSecondsReadable
} from '../utils/listControlVerificationEngine';
import useThemeStore, { hexToRgba, BOX_SHADOW_OPTIONS } from '../../../store/themeStore';
import { getCategoryColor, getCategoryTitleTextColor } from '../../draft/components/library/constants';
import { dialog } from '../../../store/dialogStore';

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
  const hasWarning = !hasHealthError && Boolean(
    item.revisionRequested ||
    item.modifiedInListControl ||
    stageInfo?.isAddedByBroadcast ||
    stageInfo?.isModifiedByBroadcast
  );

  const themeConfig = useThemeStore(state => state.config);
  const lcMod = themeConfig?.modules?.['list-control'] || {};
  const sp = themeConfig?.specialColors || {};
  const adBlockColor = lcMod.adBlockColor || sp.adBreakColor || '#E8B44C';
  const introBlockColor = sp.introColor || '#0A101D';
  const catColor = getCategoryColor(item) || item.categoryColor || lcMod.programBlockColor || '#0C617C';
  const catTitleColor = lcMod.useCategoryTitleColor !== false
    ? getCategoryTitleTextColor(item)
    : null;
  const lcLeftAccent = Number(lcMod.leftAccentWidth) || 6;
  const lcTintAlpha = Math.max(0.05, Math.min(0.28, (Number(lcMod.cardTintOpacity) || 10) / 100));
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

  // Logo Girişi: Sadece Reklam Giriş veya Yayın Giriş olarak sadeleştirilmiş gösterim
  const logoEvent = item.logoEvent || 'none';
  const hasLogoTrigger = logoEvent === 'reklam_giris' || logoEvent === 'yayin_giris';
  const isAdLogoEvent = logoEvent === 'reklam_giris';
  const activeLogoName = hasLogoTrigger
    ? (item.logo || (isAdLogoEvent ? defaultAdLogo : defaultBroadcastLogo))
    : '';

  // Başlıktan gereksiz "RTÜK GİRİŞ" vb. ön ekleri temizle, sadece program/reklam adını göster
  const rawDisplayTitle = String(item.title || item.clipName || item.name || 'İsimsiz Öğe').trim();
  const cleanDisplayTitle = rawDisplayTitle
    .replace(/^RTÜK\s*(GİRİŞ|ÇIKIŞ)\s*[-•:]?\s*/i, '')
    .trim() || rawDisplayTitle;

  const fs = (px) => `${(px * (Number(fontScale) || 1)).toFixed(1)}px`;
  const sColWidth = Math.round(54 * (Number(fontScale) || 1));
  const timeColWidth = Math.round(88 * (Number(fontScale) || 1));
  const durColWidth = Math.round(118 * (Number(fontScale) || 1));
  const logoColWidth = Math.round(145 * (Number(fontScale) || 1));
  const actColWidth = Math.round(195 * (Number(fontScale) || 1));

  // Teknik Kontrol Durum Butonu Rengi (Kırmızı: Hata, Turuncu: Uyarı/Revize, Yeşil: Sağlam)
  const techBtnStatus = hasHealthError ? 'error' : hasWarning ? 'warning' : 'healthy';
  const techBtnColor = techBtnStatus === 'error'
    ? '#dc2626'
    : techBtnStatus === 'warning'
    ? '#d97706'
    : '#16a34a';
  const techBtnBg = techBtnStatus === 'error'
    ? 'rgba(220, 38, 38, 0.14)'
    : techBtnStatus === 'warning'
    ? 'rgba(217, 119, 6, 0.14)'
    : 'rgba(22, 163, 74, 0.14)';
  const techBtnBorder = techBtnStatus === 'error'
    ? '1.5px solid rgba(220, 38, 38, 0.45)'
    : techBtnStatus === 'warning'
    ? '1.5px solid rgba(217, 119, 6, 0.45)'
    : '1.5px solid rgba(22, 163, 74, 0.42)';

  const handleOpenTechDetailsModal = (e) => {
    e.stopPropagation();
    const issueLines = Array.isArray(h.issues) && h.issues.length > 0
      ? `\n\nTespit Edilen Sorunlar:\n• ${h.issues.join('\n• ')}`
      : '';
    const revLine = item.revisionRequested
      ? `\n\nRevize Talebi (${item.revisionTargetLabel || 'İlgili Birim'}): ${item.revisionReason || '-'}`
      : '';
    const stageLine = stageInfo?.detailText
      ? `\n• Aşama Durumu: ${stageInfo.badgeLabel || ''} (${stageInfo.detailText})`
      : '';

    const detailMsg =
      `Sıra & Saat: #${index + 1} (${startClock} → ${endClock})\n` +
      `İçerik Adı: ${cleanDisplayTitle}\n` +
      `Tür: ${isAd ? 'Reklam Kuşağı / Spotu' : isIntro ? 'Jenerik / İntro' : (item.categoryName || item.category || 'Program Klibi')}\n` +
      `Süre: ${formatSecondsReadable(durSec)}\n\n` +
      `--- TEKNİK & VERİTABANI KONTROLÜ ---\n` +
      `• Veritabanı Durumu: ${h.inDatabase ? 'Kayıtlı (DB OK)' : 'Veritabanında Bulunamadı!'}\n` +
      `• Fiziksel Dosya (.MXF): ${h.fileExists ? `Mevcut (.${(h.detectedFormat || 'mxf').toUpperCase()})` : 'Fiziksel Dosya Bulunamadı!'}\n` +
      `• HighRes ID Dosyası: ${resolvedClipId ? `#${resolvedClipId} (${highResIdFileLabel})` : '-'}\n` +
      `• Arşiv Dosya Adı: ${archiveNameFileLabel}\n` +
      `• Bütünlük & Oynatma: ${h.integrityStatusText || '-'}` +
      stageLine +
      issueLines +
      revLine;

    if (techBtnStatus === 'error') {
      dialog.error('Teknik Kontrol — Hata Detayı', detailMsg);
    } else if (techBtnStatus === 'warning') {
      dialog.warning('Teknik Kontrol — Uyarı / Değişim Detayı', detailMsg);
    } else {
      dialog.success('Teknik Kontrol — Sağlam', detailMsg);
    }
  };

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
            ? hexToRgba(adBlockColor, 0.22)
            : 'rgba(12, 97, 124, 0.14)'
          : hasHealthError
          ? 'rgba(220, 38, 38, 0.06)'
          : isAd
          ? hexToRgba(adBlockColor, Math.max(0.12, lcTintAlpha * 1.4))
          : `linear-gradient(90deg, ${hexToRgba(leftBorderColor, lcTintAlpha * 0.85)} 0%, var(--bg-secondary) 75%)`,
        outline: isDragOver
          ? '2px dashed #2563eb'
          : isSelected
          ? `2px solid ${isAd ? adBlockColor : 'var(--turkuaz, #0C617C)'}`
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
          fontFamily: 'var(--font-mono)',
          color: isAd ? '#b45309' : 'var(--text-primary)'
        }}>
          #{index + 1}
        </span>
      </div>

      {/* SÜTUN 2: SAAT (Giriş Saati Büyük Ortada, Çıkış Saati Altında Küçük) */}
      <div style={{
        width: `${timeColWidth}px`,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px 6px',
        borderRadius: '6px',
        background: isAd ? 'rgba(232, 180, 76, 0.18)' : 'var(--bg-primary)',
        border: isAd ? '1px solid rgba(217, 119, 6, 0.32)' : '1px solid var(--border-color)',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.15
      }}>
        <span style={{ fontSize: fs(13), fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.2px' }}>
          {startClock}
        </span>
        <span style={{ fontSize: fs(9.5), fontWeight: 700, color: 'var(--text-muted)', marginTop: '1px' }}>
          {endClock}
        </span>
      </div>

      {/* SÜTUN 3: PROGRAM / REKLAM ADI (Sadece İsim — Ekstra Rozet veya Dosya Kodu Karmaşası Yok) */}
      <div style={{
        flex: '2.5 1 220px',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflow: 'hidden'
      }}>
        <span
          style={{
            fontSize: fs(13.5),
            fontWeight: 800,
            color: isAd
              ? '#92400e'
              : (!isAd && catTitleColor ? catTitleColor : 'var(--text-primary)'),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={cleanDisplayTitle}
        >
          {cleanDisplayTitle}
        </span>

        {!isAd && item.episodeNo != null && (
          <span style={{
            fontSize: fs(10.5),
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: '4px',
            background: 'rgba(12, 97, 124, 0.12)',
            color: 'var(--turkuaz, #0C617C)',
            flexShrink: 0
          }}>
            Bölüm {item.episodeNo}
          </span>
        )}
        {!isAd && item.partNo != null && (
          <span style={{
            fontSize: fs(10.5),
            fontWeight: 800,
            padding: '1px 6px',
            borderRadius: '4px',
            background: 'rgba(20, 42, 68, 0.1)',
            color: 'var(--lacivert, #142A44)',
            flexShrink: 0
          }}>
            Part {item.partNo}
          </span>
        )}
      </div>

      {/* SÜTUN 4: SÜRE (İsim Sütunundan Hemen Sonra) */}
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
              padding: '4px 9px',
              borderRadius: '6px',
              border: item.durationModifiedInListControl
                ? '1.5px solid #0284c7'
                : '1px solid var(--border-color)',
              background: item.durationModifiedInListControl
                ? 'rgba(2, 132, 199, 0.12)'
                : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: fs(11.5),
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
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

      {/* SÜTUN 5: SADELEŞTİRİLMİŞ LOGO GİRİŞİ (Sadece Reklam Giriş veya Yayın Giriş) */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `${logoColWidth}px`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '4px',
          overflow: 'hidden'
        }}
        title={
          hasLogoTrigger
            ? `${isAdLogoEvent ? 'Reklam Giriş' : 'Yayın Giriş'} (${activeLogoName})`
            : 'Bu satırda yeni logo girişi yok (mevcut logo devam ediyor).'
        }
      >
        {hasLogoTrigger ? (
          <span style={{
            fontSize: fs(10.5),
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '5px',
            background: isAdLogoEvent
              ? 'rgba(217, 119, 6, 0.16)'
              : 'rgba(16, 185, 129, 0.16)',
            color: isAdLogoEvent
              ? '#b45309'
              : '#047857',
            border: isAdLogoEvent
              ? '1px solid rgba(217, 119, 6, 0.35)'
              : '1px solid rgba(16, 185, 129, 0.35)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {isAdLogoEvent ? 'Reklam Giriş' : 'Yayın Giriş'}
          </span>
        ) : (
          <span style={{
            fontSize: fs(11),
            fontWeight: 700,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            paddingLeft: '4px'
          }}>
            —
          </span>
        )}

        {onUpdateLogoEvent && (
          <select
            value={item.manualLogoEvent || 'auto'}
            onChange={(e) => onUpdateLogoEvent(item.instanceId, e.target.value)}
            style={{
              fontSize: '10px',
              padding: '2px 3px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              maxWidth: '54px',
              flexShrink: 0
            }}
            title="Logo Girişini Değiştir"
          >
            <option value="auto">Oto</option>
            <option value="yayin_giris">Yayın Giriş</option>
            <option value="reklam_giris">Reklam Giriş</option>
            <option value="none">Yok</option>
          </select>
        )}
      </div>

      {/* SÜTUN 6: İŞLEMLER & TEKNİK KONTROL BUTONU */}
      <div style={{
        width: `${actColWidth}px`,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '4px'
      }}>
        {/* Renkli Teknik Kontrol Durum Butonu (Hata: Kırmızı, Uyarı: Turuncu, Sağlam: Yeşil -> Tıklanınca Detay Pop-up) */}
        <button
          type="button"
          onClick={handleOpenTechDetailsModal}
          style={{
            height: '25px',
            padding: '0 7px',
            borderRadius: '6px',
            border: techBtnBorder,
            background: techBtnBg,
            color: techBtnColor,
            fontSize: '10.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0
          }}
          title={
            techBtnStatus === 'error'
              ? 'Teknik Hata Mevcut! Detayları görmek için tıklayın'
              : techBtnStatus === 'warning'
              ? 'Uyarı / Değişim Mevcut! Detayları görmek için tıklayın'
              : 'DB & HighRes .MXF Sağlam — Detaylı teknik bilgi için tıklayın'
          }
        >
          {techBtnStatus === 'error' ? (
            <ShieldAlert size={13} color={techBtnColor} />
          ) : techBtnStatus === 'warning' ? (
            <AlertTriangle size={13} color={techBtnColor} />
          ) : (
            <ShieldCheck size={13} color={techBtnColor} />
          )}
          <span>
            {techBtnStatus === 'error' ? 'Hata' : techBtnStatus === 'warning' ? 'Uyarı' : 'Sağlam'}
          </span>
        </button>

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
          title="Klip / Reklam Detayları, Veritabanı Künyesi ve Video Önizleme (Information)"
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
            gap: '3px',
            flexShrink: 0
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
            cursor: index === 0 ? 'default' : 'pointer',
            flexShrink: 0
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
            cursor: index >= totalCount - 1 ? 'default' : 'pointer',
            flexShrink: 0
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
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="Satırı Sil"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
