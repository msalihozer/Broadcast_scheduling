/**
 * @file src/modules/list-control/components/ListControlRevisionModal.jsx
 * @description Yayın Liste Kontrol Modülü Akıllı Revize İsteme Modalı.
 *
 * Kural:
 * - Eğer seçilen satır bir Program / Klip ise: Operatör revizenin **Taslak Planlama** aşamasına mı,
 *   **Yayın Planlama** aşamasına mı (veya her ikisine birden mi) gideceğini seçer.
 * - Eğer seçilen satır bir Reklam / Reklam Kuşağı ise: Revize doğrudan **Reklam Rezervasyon** aşamasına gider.
 */
import React, { useState, useEffect } from 'react';
import {
  X, Send, AlertTriangle, Film, Megaphone, Layers, CheckCircle2, FileText
} from 'lucide-react';
import { formatMinuteToClock, formatSecondsReadable } from '../utils/listControlVerificationEngine';

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
  const isAd = Boolean(item?.isAdClip || item?.isFromAds || item?.type === 'ad_break' || item?.type === 'ad_spot');

  const [targetStage, setTargetStage] = useState(isAd ? 'ads' : 'broadcast');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTargetStage(isAd ? 'ads' : 'broadcast');
      setReason(item?.revisionReason || '');
    }
  }, [isOpen, item, isAd]);

  if (!isOpen) return null;

  const presets = isAd ? AD_REVISION_PRESETS : CLIP_REVISION_PRESETS;
  const startClock = item ? formatMinuteToClock(item.startMinute || 0) : '';
  const durSec = item ? (Number(item.durationSec) || Math.round((Number(item.duration) || 0) * 60)) : 0;

  const handleConfirm = (e) => {
    e.preventDefault();
    const finalReason = reason.trim() || (isAd
      ? 'Reklam yerleşimi / materyali için Liste Kontrol tarafından revize talep edildi.'
      : 'Program / klip için Liste Kontrol tarafından revize talep edildi.');
    onSubmitRevision({
      item,
      targetStage: isAd ? 'ads' : targetStage,
      reason: finalReason
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
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
          maxWidth: '620px',
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
          background: isAd
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
              background: isAd ? '#d97706' : '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isAd ? '0 6px 16px rgba(217, 119, 6, 0.35)' : '0 6px 16px rgba(37, 99, 235, 0.35)',
              flexShrink: 0
            }}>
              {isAd ? <Megaphone size={20} /> : <Film size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isAd ? 'Reklam Revize Talebi Gönder' : 'Program / Klip Revize Talebi Gönder'}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', fontWeight: 600 }}>
                {channelName} • {selectedDate}
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
          {/* Seçili Öğe Bilgisi */}
          {item && (
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
                  background: isAd ? 'rgba(217, 119, 6, 0.16)' : 'rgba(37, 99, 235, 0.16)',
                  color: isAd ? '#d97706' : '#2563eb'
                }}>
                  {isAd ? '📢 REKLAM / KUŞAK ÖĞESİ' : '🎬 PROGRAM / KLİP ÖĞESİ'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  Saat: {startClock} • Süre: {formatSecondsReadable(durSec)}
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                Kod / ID: {item.code || item.fileName || item.id || '-'}
                {item.parentBreakTitle ? ` • Kuşak: ${item.parentBreakTitle}` : ''}
                {item.companyName ? ` • Firma: ${item.companyName}` : ''}
              </div>
            </div>
          )}

          {/* Hedef Aşama Seçimi */}
          {isAd ? (
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
                Revize Hangi Aşamaya Gönderilsin? <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
                {[
                  {
                    id: 'draft',
                    title: 'Taslak Planlama',
                    desc: 'Program / kuşak planlaması taslak aşamasında düzeltilsin',
                    color: '#0284c7',
                    bg: 'rgba(2, 132, 199, 0.12)'
                  },
                  {
                    id: 'broadcast',
                    title: 'Yayın Planlama',
                    desc: 'Bölüm, klip seçimi veya süre Yayın Planlamada düzeltilsin',
                    color: '#2563eb',
                    bg: 'rgba(37, 99, 235, 0.12)'
                  },
                  {
                    id: 'both',
                    title: 'Her İkisine Birden',
                    desc: 'Hem Taslak hem Yayın Planlama birimine bildirilsin',
                    color: '#7c3aed',
                    bg: 'rgba(124, 58, 237, 0.12)'
                  }
                ].map(opt => {
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
              Hızlı Revize Sebebi Seçin (İsteğe Bağlı):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(preset)}
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

          {/* Açıklama Alanı */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Revize Açıklaması / Operatör Notu
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isAd
                  ? 'Reklam Rezervasyon birimine iletilecek revize detayını yazınız...'
                  : 'Taslak veya Yayın Planlama birimine iletilecek revize detayını yazınız...'
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                fontWeight: 500,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
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
                background: isAd
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
                {isAd
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
