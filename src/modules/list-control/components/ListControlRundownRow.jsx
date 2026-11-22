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

  const leftBorderColor = hasHealthError
    ? '#dc2626'
    : item.revisionRequested
    ? '#d97706'
    : isAd
    ? item.isSponsor
      ? '#7c3aed'
      : '#d97706'
    : item.categoryColor || '#2563eb';

  const resolvedClipId = h.dbFileId || item.fileId || item.clipId || (String(item.id || '').match(/^\d+$/) ? item.id : null);
  const resolvedArchiveClipName = h.archiveClipName || item.clipName || (h.fileName && !/^[A-Z0-9]{8}\.mxf$/i.test(h.fileName) && !/^\d+\.mxf$/i.test(h.fileName) ? h.fileName : null) || item.title || '-';
  const highResIdFileLabel = resolvedClipId ? `${resolvedClipId}.mxf` : (h.highResFileName || '-');
  const archiveNameFileLabel = resolvedArchiveClipName !== '-'
    ? (/\.[a-z0-9]{2,4}$/i.test(resolvedArchiveClipName) ? resolvedArchiveClipName : `${resolvedArchiveClipName}.mxf`)
    : (h.fileName || item.code || '-');
  const displayFileCode = archiveNameFileLabel !== '-' ? archiveNameFileLabel : highResIdFileLabel;

  // Logo YALNIZCA Giriş ve Çıkış satırlarında (reklam_giris, reklam_cikis, yayin_giris, yayin_cikis) gösterilir; ara satırlarda tekrarlanmaz!
  const logoEvent = item.logoEvent || 'none';
  const hasLogoTrigger = logoEvent && logoEvent !== 'none';
  const isAdLogoEvent = logoEvent === 'reklam_giris' || logoEvent === 'reklam_cikis';
  const isExitLogoEvent = logoEvent === 'reklam_cikis' || logoEvent === 'yayin_cikis';
  const activeLogoName = hasLogoTrigger
    ? (item.logo || (isAdLogoEvent ? defaultAdLogo : defaultBroadcastLogo))
    : '';

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
        padding: '7px 10px',
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
        gap: '8px',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'background-color 0.12s ease'
      }}
    >
      {/* SÜTUN 1: SÜRÜKLE TUTAMACI & SIRA NO (50px) */}
      <div
        style={{
          width: '50px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}
        title="Sürükleyerek satır sırasını değiştirin"
      >
        <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab', flexShrink: 0 }} />
        <span style={{
          fontSize: '11.5px',
          fontWeight: 900,
          fontFamily: 'monospace',
          color: isAd ? '#d97706' : 'var(--text-primary)'
        }}>
          #{index + 1}
        </span>
      </div>

      {/* SÜTUN 2: YAYIN SAATİ (GİRİŞ / ÇIKIŞ - 76px) */}
      <div style={{
        width: '76px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'monospace',
        lineHeight: 1.25
      }}>
        <span style={{ fontSize: '11.5px', fontWeight: 900, color: 'var(--text-primary)' }}>
          {startClock}
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
          → {endClock}
        </span>
      </div>

      {/* SÜTUN 3: TÜR (KLİP / REKLAM) • BAŞLIK • KLİP ID & DOSYA KODU (.MXF) (flex: 2.2 1 170px, minWidth: 0) */}
      <div style={{
        flex: '2.2 1 170px',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          {/* Açık Tür Rozeti: Klip mi Reklam mı */}
          <span style={{
            fontSize: '9.5px',
            fontWeight: 900,
            padding: '1px 5px',
            borderRadius: '4px',
            background: isAd
              ? item.isBumperAd
                ? '#059669'
                : item.isSponsor
                ? '#7c3aed'
                : '#d97706'
              : isIntro
              ? '#6366f1'
              : '#2563eb',
            color: '#ffffff',
            flexShrink: 0
          }}>
            {isAd
              ? item.isBumperAd
                ? `📢 RTÜK ${item.bumperType === 'intro' ? 'GİRİŞ' : 'ÇIKIŞ'}`
                : item.isSponsor
                ? '🏆 SPONSOR REKLAM'
                : '📢 REKLAM'
              : isIntro
              ? '🎬 İNTRO KLİP'
              : '🎬 PROGRAM KLİBİ'}
          </span>

          <span style={{
            fontSize: '12.5px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }} title={item.title}>
            {item.title}
          </span>

          {item.episodeNo != null && (
            <span style={{
              fontSize: '9.5px',
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
              fontSize: '9.5px',
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
          fontSize: '10.5px',
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

      {/* SÜTUN 4: LOGO GİRİŞ / ÇIKIŞ TETİKLEMESİ (Yalnızca Giriş ve Çıkış satırlarında işaretlenir, ara satırlarda tekrarlanmaz!) */}
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
            ? `${item.logoEventLabel || 'Logo Tetiklemesi'} → ${activeLogoName} (Değiştirmek için seçin)`
            : 'Bu satırda logo değişimi (giriş/çıkış) yok. Manuel Giriş/Çıkış işaretlemek için seçebilirsiniz.'
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
                background: isExitLogoEvent
                  ? 'rgba(220, 38, 38, 0.14)'
                  : isAdLogoEvent
                  ? 'rgba(217, 119, 6, 0.16)'
                  : 'rgba(16, 185, 129, 0.16)',
                color: isExitLogoEvent
                  ? '#dc2626'
                  : isAdLogoEvent
                  ? '#d97706'
                  : '#059669',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
              }}>
                {item.logoEventLabel || (isAdLogoEvent ? '📢 REKLAM GİRİŞ' : '📺 YAYIN GİRİŞ')}
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
                    maxWidth: '54px'
                  }}
                  title="Logo Giriş / Çıkış Tetiklemesini Değiştir"
                >
                  <option value="auto">Oto</option>
                  <option value="yayin_giris">📺 Yayın Giriş</option>
                  <option value="yayin_cikis">📺 Yayın Çıkış</option>
                  <option value="reklam_giris">📢 Reklam Giriş</option>
                  <option value="reklam_cikis">📢 Reklam Çıkış</option>
                  <option value="none">— Kaldır</option>
                </select>
              )}
            </div>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 800,
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              background: isExitLogoEvent
                ? 'rgba(220, 38, 38, 0.08)'
                : isAdLogoEvent
                ? 'rgba(217, 119, 6, 0.1)'
                : 'rgba(16, 185, 129, 0.1)',
              border: isExitLogoEvent
                ? '1px solid rgba(220, 38, 38, 0.3)'
                : isAdLogoEvent
                ? '1px solid rgba(217, 119, 6, 0.3)'
                : '1px solid rgba(16, 185, 129, 0.3)',
              padding: '2px 6px',
              borderRadius: '5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {isExitLogoEvent ? `ÇIKIŞ: ${activeLogoName}` : `GİRİŞ: ${activeLogoName}`}
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
                  maxWidth: '95px'
                }}
                title="Bu satıra Logo Giriş veya Çıkış işareti ekle"
              >
                <option value="auto">+ Giriş/Çıkış</option>
                <option value="yayin_giris">📺 Yayın Giriş</option>
                <option value="yayin_cikis">📺 Yayın Çıkış</option>
                <option value="reklam_giris">📢 Reklam Giriş</option>
                <option value="reklam_cikis">📢 Reklam Çıkış</option>
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
          fontSize: '10.5px',
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

      {/* SÜTUN 6: DÜZENLENEBİLİR SÜRE (78px) */}
      <div style={{ width: '78px', flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
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
              padding: '3px 7px',
              borderRadius: '6px',
              border: item.durationModifiedInListControl
                ? '1.5px solid #0284c7'
                : '1px solid var(--border-color)',
              background: item.durationModifiedInListControl
                ? 'rgba(2, 132, 199, 0.12)'
                : 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 800,
              fontFamily: 'monospace',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              whiteSpace: 'nowrap'
            }}
            title="Süreyi düzenlemek için tıklayın"
          >
            <Clock size={10} color="var(--accent-primary)" />
            <span>{formatSecondsReadable(durSec)}</span>
          </button>
        )}
      </div>

      {/* SÜTUN 7: İŞLEMLER (132px — ⓘ Bilgi Popup + Revize + Sıralama + Sil) */}
      <div style={{
        width: '132px',
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
