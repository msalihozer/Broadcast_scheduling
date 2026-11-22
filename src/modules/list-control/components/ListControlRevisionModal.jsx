/**
 * @file src/modules/list-control/components/ListControlRevisionModal.jsx
 * @description Yayın Liste Kontrol Modülü Akıllı Revize İsteme Modalı (Satır Bazlı + Bütün Günü Revizeye Gönderme).
 *
 * Kurallar:
 * 1. Bütün Günü Revizeye Gönderme: Operatör bütün günü **Taslak Planlama**, **Yayın Planlama**, **Reklam Rezervasyon**
 *    veya **Tüm Birimlere** revizeye gönderebilir.
 * 2. Satır Bazlı Revize:
 *    - Program / Klip ise: **Taslak Planlama**, **Yayın Planlama** veya her ikisine gönderilir.
 *    - Reklam ise: Doğrudan **Reklam Rezervasyon** birimine gönderilir.
 * 3. **AÇIKLAMA ZORUNLUDUR**: Açıklama yazılmadan revize gönderilemez.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Send, AlertTriangle, Film, Megaphone, Layers, CheckCircle2, Calendar
} from 'lucide-react';
import { formatMinuteToClock, formatSecondsReadable } from '../utils/listControlVerificationEngine';

const FULL_DAY_REVISION_PRESETS = [
  'Günlük yayın akışı ve reklam kuşakları genel revize gerektiriyor',
  'Taslak planlama ile yayın planlama saatleri/bölümleri uyuşmuyor, gün yeniden kontrol edilmeli',
  'Reklam kuşakları ve spot yerleşimleri günlük akışla uyumsuz, yeniden düzenlenmeli',
  'Listedeki birden fazla klipte dosya yolu veya süre hatası mevcut, gün revize edilmeli'
];

const CLIP_REVISION_PRESETS = [
  'Yanlış bölüm / part seçilmiş, düzeltilmesi gerekiyor',
  'Klip dosyası sunucuda bulunamadı veya bozuk',
  'Klip süresi taslak / yayın akışı ile uyuşmuyor',
  'Taslakta planlanan program akışta eksik',
  'Program sırası veya yayın kuşağı saati hatalı'
];

const AD_REVISION_PRESETS = [
  'Reklam materyali (klip) sunucuda yok veya bozuk',
  'Reklam kuşağı süresi veya spot sırası hatalı',
  'RTÜK reklam giriş / çıkış jeneriği eksik veya yanlış kategoride',
  'Program sponsoru eksik veya yanlış kuşağa yerleştirilmiş',
  'Boş kalan reklam kuşağının doldurulması gerekiyor'
];

export default function ListControlRevisionModal({
  isOpen,
  onClose,
  item = null,
  channelName = 'Semerkand HD',
  selectedDate = '',
  onSubmitRevision
}) {
  const isFullDay = Boolean(!item || item.isFullDayRevision);
  const isAd = !isFullDay && Boolean(item?.isAdClip || item?.isFromAds || item?.type === 'ad_break' || item?.type === 'ad_spot');

  const [targetStage, setTargetStage] = useState(isAd ? 'ads' : 'broadcast');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (isFullDay) {
        setTargetStage(item?.defaultTargetStage || 'broadcast');
      } else {
        setTargetStage(isAd ? 'ads' : 'broadcast');
      }
      setReason(item?.revisionReason || '');
      setValidationError('');
    }
  }, [isOpen, item, isAd, isFullDay]);

  if (!isOpen) return null;

  const presets = isFullDay
    ? FULL_DAY_REVISION_PRESETS
    : isAd
    ? AD_REVISION_PRESETS
    : CLIP_REVISION_PRESETS;
  const startClock = item && !isFullDay ? formatMinuteToClock(item.startMinute || 0) : '';
  const durSec = item ? (Number(item.durationSec) || Math.round((Number(item.duration) || 0) * 60)) : 0;

  const handleConfirm = (e) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setValidationError('Revize açıklaması zorunludur! Lütfen revize nedenini detaylı olarak yazınız veya yukarıdaki hızlı sebeplerden birini seçiniz.');
      return;
    }
    setValidationError('');
    onSubmitRevision({
      item: isFullDay
        ? {
            ...(item || {}),
            isFullDayRevision: true,
            title: item?.title || `${channelName} (${selectedDate}) Tüm Gün Yayın & Reklam Listesi`
          }
        : item,
      targetStage: isAd ? 'ads' : targetStage,
      reason: cleanReason,
      isFullDayRevision: isFullDay
    });
    onClose();
  };

  const stageOptions = isFullDay
    ? [
        {
          id: 'draft',
          title: '📋 Taslak Planlama',
          desc: 'Bütün günü Taslak Planlama birimine revizeye gönder',
          color: '#0284c7',
          bg: 'rgba(2, 132, 199, 0.12)'
        },
        {
          id: 'broadcast',
          title: '🎬 Yayın Planlama',
          desc: 'Bütün günü Yayın Planlama birimine revizeye gönder',
          color: '#2563eb',
          bg: 'rgba(37, 99, 235, 0.12)'
        },
        {
          id: 'ads',
          title: '📢 Reklam Rezervasyon',
          desc: 'Bütün günü Reklam Rezervasyon birimine revizeye gönder',
          color: '#d97706',
          bg: 'rgba(217, 119, 6, 0.12)'
        },
        {
          id: 'all',
          title: '🌐 Tüm Birimlere Gönder',
          desc: 'Taslak, Yayın Planlama ve Reklam birimlerinin tamamına bildir',
          color: '#dc2626',
          bg: 'rgba(220, 38, 38, 0.12)'
        }
      ]
    : [
        {
          id: 'draft',
          title: '📋 Taslak Planlama',
          desc: 'Program / kuşak planlaması taslak aşamasında düzeltilsin',
          color: '#0284c7',
          bg: 'rgba(2, 132, 199, 0.12)'
        },
        {
          id: 'broadcast',
          title: '🎬 Yayın Planlama',
          desc: 'Bölüm, klip seçimi veya süre Yayın Planlamada düzeltilsin',
          color: '#2563eb',
          bg: 'rgba(37, 99, 235, 0.12)'
        },
        {
          id: 'both',
          title: '🔄 Her İkisine Birden',
          desc: 'Hem Taslak hem Yayın Planlama birimine bildirilsin',
          color: '#7c3aed',
          bg: 'rgba(124, 58, 237, 0.12)'
        }
      ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.74)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100005,
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '650px',
          background: 'var(--bg-secondary)',
          border: '1.5px solid var(--border-color)',
          borderRadius: '18px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Üst Başlık */}
        <div style={{
          padding: '16px 20px',
          background: isFullDay
            ? 'linear-gradient(135deg, rgba(220, 38, 38, 0.14) 0%, rgba(217, 119, 6, 0.1) 100%)'
            : isAd
            ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.14) 0%, rgba(234, 88, 12, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(37, 99, 235, 0.14) 0%, rgba(124, 58, 237, 0.08) 100%)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: isFullDay ? '#dc2626' : isAd ? '#d97706' : '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isFullDay
                ? '0 6px 16px rgba(220, 38, 38, 0.35)'
                : isAd
                ? '0 6px 16px rgba(217, 119, 6, 0.35)'
                : '0 6px 16px rgba(37, 99, 235, 0.35)',
              flexShrink: 0
            }}>
              {isFullDay ? <Calendar size={20} /> : isAd ? <Megaphone size={20} /> : <Film size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                {isFullDay
                  ? 'Bütün Günü Revizeye Gönder'
                  : isAd
                  ? 'Reklam Satırı Revize Talebi Gönder'
                  : 'Program / Klip Revize Talebi Gönder'}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 700 }}>
                {channelName} • {selectedDate} • Açıklama Zorunlu
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleConfirm} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Seçili Gün veya Öğe Bilgisi */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '6px',
                background: isFullDay
                  ? 'rgba(220, 38, 38, 0.15)'
                  : isAd
                  ? 'rgba(217, 119, 6, 0.16)'
                  : 'rgba(37, 99, 235, 0.16)',
                color: isFullDay ? '#dc2626' : isAd ? '#d97706' : '#2563eb'
              }}>
                {isFullDay ? '📅 TÜM GÜN YAYIN & REKLAM LİSTESİ' : isAd ? '📢 REKLAM / KUŞAK ÖĞESİ' : '🎬 PROGRAM / KLİP ÖĞESİ'}
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {isFullDay
                  ? `Tarih: ${selectedDate}${durSec > 0 ? ` • Toplam: ${formatSecondsReadable(durSec)}` : ''}`
                  : `Saat: ${startClock} • Süre: ${formatSecondsReadable(durSec)}`}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isFullDay
                ? `${channelName} — ${selectedDate} Tam Gün Listesi`
                : item?.title}
            </div>
            {!isFullDay && item && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Kod / ID: {item.code || item.fileName || item.id || '-'}
                {item.parentBreakTitle ? ` • Kuşak: ${item.parentBreakTitle}` : ''}
                {item.companyName ? ` • Firma: ${item.companyName}` : ''}
              </div>
            )}
          </div>

          {/* Hedef Birim Seçimi */}
          {isAd && !isFullDay ? (
            <div style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'rgba(217, 119, 6, 0.1)',
              border: '1.5px solid rgba(217, 119, 6, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Megaphone size={18} color="#d97706" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                <strong>Hedef Birim: Reklam Rezervasyon Aşaması</strong>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Seçilen öğe bir reklam olduğu için revize bildirimi doğrudan <strong>Reklam Rezervasyon</strong> modülüne iletilecektir.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isFullDay ? 'Bütün Gün Hangi Birime Revizeye Gönderilsin?' : 'Revize Hangi Aşamaya Gönderilsin?'}{' '}
                <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isFullDay ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '10px'
              }}>
                {stageOptions.map(opt => {
                  const active = targetStage === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTargetStage(opt.id)}
                      style={{
                        padding: '11px 12px',
                        borderRadius: '12px',
                        border: active ? `2px solid ${opt.color}` : '1px solid var(--border-color)',
                        background: active ? opt.bg : 'var(--bg-primary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: active ? opt.color : 'var(--text-primary)' }}>
                          {opt.title}
                        </span>
                        {active && <CheckCircle2 size={15} color={opt.color} />}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hızlı Revize Nedeni Şablonları */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Hızlı Revize Sebebi Seçin (Tıklayınca Açıklamaya Eklenir):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setReason(preset);
                    setValidationError('');
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: reason === preset ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: reason === preset ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-primary)',
                    color: reason === preset ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Açıklama Alanı (ZORUNLU) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Revize Açıklaması / Operatör Notu <span style={{ color: '#ef4444' }}>* (Zorunlu)</span>
              </label>
              <span style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '1px 7px',
                borderRadius: '999px',
                background: reason.trim() ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                color: reason.trim() ? '#059669' : '#dc2626'
              }}>
                {reason.trim() ? '✓ Açıklama Girildi' : '⚠️ Açıklama Zorunlu'}
              </span>
            </div>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError && e.target.value.trim()) setValidationError('');
              }}
              placeholder={
                isFullDay
                  ? 'Bütün günün neden revizeye gönderildiğini detaylı olarak yazınız (Zorunlu)...'
                  : isAd
                  ? 'Reklam Rezervasyon birimine iletilecek revize nedenini yazınız (Zorunlu)...'
                  : 'Taslak veya Yayın Planlama birimine iletilecek revize nedenini yazınız (Zorunlu)...'
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: validationError
                  ? '2px solid #dc2626'
                  : reason.trim()
                  ? '1.5px solid #10b981'
                  : '1.5px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {validationError && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(220, 38, 38, 0.12)',
                border: '1px solid rgba(220, 38, 38, 0.35)',
                color: '#dc2626',
                fontSize: '11.5px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Alt Butonlar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                background: isFullDay
                  ? 'linear-gradient(135deg, #dc2626 0%, #ea580c 100%)'
                  : isAd
                  ? 'linear-gradient(135deg, #d97706 0%, #ea580c 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)'
              }}
            >
              <Send size={14} />
              <span>
                {isFullDay
                  ? targetStage === 'ads'
                    ? 'Bütün Günü Reklam Rezervasyona Revizeye Gönder'
                    : targetStage === 'draft'
                    ? 'Bütün Günü Taslak Planlamaya Revizeye Gönder'
                    : targetStage === 'all'
                    ? 'Bütün Günü Tüm Birimlere Revizeye Gönder'
                    : 'Bütün Günü Yayın Planlamaya Revizeye Gönder'
                  : isAd
                  ? 'Reklam Rezervasyona Revize Gönder'
                  : targetStage === 'draft'
                  ? 'Taslak Planlamaya Revize Gönder'
                  : targetStage === 'both'
                  ? 'Taslak & Yayın Planlamaya Revize Gönder'
                  : 'Yayın Planlamaya Revize Gönder'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
