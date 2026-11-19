/**
 * @file GlobalDialog.jsx
 * @description Kurumsal SaaS (Radix UI / Linear / SweetAlert2) tasarımlı, türüne göre
 * (success, error, warning, info, confirm) dinamik renklenen, çift katmanlı ikon halkalı,
 * ortalanmış başlık ve modern butonlara sahip merkezi pop-up & uyarı bileşeni.
 */
import React, { useEffect, useMemo } from 'react';
import useDialogStore from '../store/dialogStore';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Sparkles,
  Check,
  ShieldAlert
} from 'lucide-react';

const GlobalDialog = () => {
  const {
    isOpen,
    title,
    message,
    type = 'info',
    confirmText,
    cancelText,
    isDestructive,
    closeDialog
  } = useDialogStore();

  // Klavye kontrolü: Enter onayla, Escape vazgeç
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDialog(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        closeDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDialog]);

  // Türe göre modern SaaS tema yapılandırması
  const theme = useMemo(() => {
    switch (type) {
      case 'success':
        return {
          primaryColor: '#10b981',
          gradientBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          headerGlow: 'radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.16) 0%, transparent 72%)',
          outerRingBg: 'rgba(16, 185, 129, 0.10)',
          innerRingBg: 'rgba(16, 185, 129, 0.18)',
          ringBorder: 'rgba(16, 185, 129, 0.35)',
          badgeBg: 'rgba(16, 185, 129, 0.12)',
          badgeText: '#059669',
          buttonShadow: '0 6px 18px rgba(16, 185, 129, 0.32)',
          label: 'İşlem Başarılı',
          icon: <CheckCircle2 size={28} color="#10b981" strokeWidth={2.3} />
        };
      case 'error':
        return {
          primaryColor: '#ef4444',
          gradientBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          headerGlow: 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.16) 0%, transparent 72%)',
          outerRingBg: 'rgba(239, 68, 68, 0.10)',
          innerRingBg: 'rgba(239, 68, 68, 0.18)',
          ringBorder: 'rgba(239, 68, 68, 0.35)',
          badgeBg: 'rgba(239, 68, 68, 0.12)',
          badgeText: '#dc2626',
          buttonShadow: '0 6px 18px rgba(239, 68, 68, 0.32)',
          label: 'Hata Bildirimi',
          icon: <AlertCircle size={28} color="#ef4444" strokeWidth={2.3} />
        };
      case 'warning':
        return {
          primaryColor: '#f59e0b',
          gradientBg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          headerGlow: 'radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.16) 0%, transparent 72%)',
          outerRingBg: 'rgba(245, 158, 11, 0.10)',
          innerRingBg: 'rgba(245, 158, 11, 0.18)',
          ringBorder: 'rgba(245, 158, 11, 0.35)',
          badgeBg: 'rgba(245, 158, 11, 0.14)',
          badgeText: '#d97706',
          buttonShadow: '0 6px 18px rgba(245, 158, 11, 0.30)',
          label: 'Dikkat & Uyarı',
          icon: <AlertTriangle size={28} color="#f59e0b" strokeWidth={2.3} />
        };
      case 'confirm':
        return {
          primaryColor: isDestructive ? '#ef4444' : '#0066ff',
          gradientBg: isDestructive
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #2563eb 0%, #0052cc 100%)',
          headerGlow: isDestructive
            ? 'radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.16) 0%, transparent 72%)'
            : 'radial-gradient(circle at 50% 0%, rgba(0, 102, 255, 0.15) 0%, transparent 72%)',
          outerRingBg: isDestructive ? 'rgba(239, 68, 68, 0.10)' : 'rgba(0, 102, 255, 0.10)',
          innerRingBg: isDestructive ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0, 102, 255, 0.18)',
          ringBorder: isDestructive ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 102, 255, 0.35)',
          badgeBg: isDestructive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 102, 255, 0.12)',
          badgeText: isDestructive ? '#dc2626' : '#0066ff',
          buttonShadow: isDestructive
            ? '0 6px 18px rgba(239, 68, 68, 0.32)'
            : '0 6px 18px rgba(0, 102, 255, 0.32)',
          label: isDestructive ? 'Kritik İşlem Onayı' : 'İşlem Onayı',
          icon: isDestructive ? (
            <ShieldAlert size={28} color="#ef4444" strokeWidth={2.3} />
          ) : (
            <CheckCircle2 size={28} color="#0066ff" strokeWidth={2.3} />
          )
        };
      case 'info':
      default:
        return {
          primaryColor: '#0066ff',
          gradientBg: 'linear-gradient(135deg, #2563eb 0%, #0052cc 100%)',
          headerGlow: 'radial-gradient(circle at 50% 0%, rgba(0, 102, 255, 0.15) 0%, transparent 72%)',
          outerRingBg: 'rgba(0, 102, 255, 0.10)',
          innerRingBg: 'rgba(0, 102, 255, 0.18)',
          ringBorder: 'rgba(0, 102, 255, 0.35)',
          badgeBg: 'rgba(0, 102, 255, 0.12)',
          badgeText: '#0066ff',
          buttonShadow: '0 6px 18px rgba(0, 102, 255, 0.30)',
          label: 'Sistem Bilgilendirmesi',
          icon: <Info size={28} color="#0066ff" strokeWidth={2.3} />
        };
    }
  }, [type, isDestructive]);

  // Mesaj içeriğini akıllıca ayrıştırma (Başlık, Anahtar: Değer çiftleri, Bilgi notları)
  const parsedContent = useMemo(() => {
    if (!message) return { intro: '', items: [], note: '' };

    const lines = message.split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    let intro = '';
    let note = '';

    lines.forEach((line) => {
      const cleanedBullet = line.replace(/^[•*-]\s*/, '');
      if (
        line.startsWith('* Bilgi:') ||
        line.startsWith('* Not:') ||
        line.startsWith('Not:') ||
        line.startsWith('Bilgi:')
      ) {
        note = line.replace(/^\*\s*/, '');
      } else if (cleanedBullet.includes(':') && !cleanedBullet.startsWith('http') && cleanedBullet.length < 120) {
        const colonIdx = cleanedBullet.indexOf(':');
        const key = cleanedBullet.substring(0, colonIdx).trim();
        const value = cleanedBullet.substring(colonIdx + 1).trim();
        if (key && value) {
          items.push({ key, value });
        } else {
          if (!intro) intro = line;
          else intro += '\n' + line;
        }
      } else {
        if (!intro) intro = line;
        else intro += '\n' + line;
      }
    });

    return { intro, items, note };
  }, [message]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.62)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        animation: 'saasBackdropFadeIn 0.18s ease-out',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
      onClick={() => closeDialog(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--ads-canvas-bg, #ffffff)',
          backgroundImage: theme.headerGlow,
          border: '1px solid var(--ads-border-strong, #cbd5e1)',
          borderRadius: '22px',
          width: '100%',
          maxWidth: parsedContent.items.length > 0 ? '480px' : '430px',
          padding: '28px 26px 24px 26px',
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          animation: 'saasDialogPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          overflow: 'hidden'
        }}
      >
        {/* Üst Vurgu Şeridi */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: theme.gradientBg
          }}
        />

        {/* Kapatma Butonu (Sağ Üst) */}
        <button
          onClick={() => closeDialog(false)}
          title="Kapat (Esc)"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'var(--ads-card-subtle, #f8fafd)',
            border: '1px solid var(--ads-border, #e2e8f0)',
            borderRadius: '10px',
            width: '32px',
            height: '32px',
            color: 'var(--ads-text-muted, #64748b)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <X size={16} />
        </button>

        {/* Çift Halkalı Ortalanmış İkon Rozeti */}
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '999px',
            background: theme.outerRingBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px'
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '999px',
              background: theme.innerRingBg,
              border: `1.5px solid ${theme.ringBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 16px -4px ${theme.primaryColor}40`
            }}
          >
            {theme.icon}
          </div>
        </div>

        {/* Kategori Etiketi */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: '3px 10px',
            borderRadius: '999px',
            background: theme.badgeBg,
            color: theme.badgeText,
            marginBottom: '8px'
          }}
        >
          {theme.label}
        </span>

        {/* Başlık */}
        <h3
          style={{
            margin: '0 0 10px 0',
            fontSize: '18.5px',
            fontWeight: 800,
            color: 'var(--ads-text-main, #0f172a)',
            letterSpacing: '-0.02em',
            lineHeight: 1.3
          }}
        >
          {title || (type === 'confirm' ? 'İşlem Onayı' : 'Bilgilendirme')}
        </h3>

        {/* Ana Açıklama Metni */}
        {parsedContent.intro && (
          <div
            style={{
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: 'var(--ads-text-sub, #334155)',
              marginBottom: parsedContent.items.length > 0 ? '14px' : '20px',
              whiteSpace: 'pre-wrap',
              maxWidth: '390px'
            }}
          >
            {parsedContent.intro}
          </div>
        )}

        {/* Yapılandırılmış Detay Kartları */}
        {parsedContent.items.length > 0 && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
              background: 'var(--ads-card-subtle, #f8fafd)',
              border: '1px solid var(--ads-border, #e2e8f0)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '18px',
              textAlign: 'left'
            }}
          >
            {parsedContent.items.map((it, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  fontSize: '12.5px',
                  lineHeight: 1.4
                }}
              >
                <span style={{ color: 'var(--ads-text-muted, #64748b)', fontWeight: 600 }}>
                  {it.key}
                </span>
                <span
                  style={{
                    color: 'var(--ads-text-main, #0f172a)',
                    fontWeight: 800,
                    textAlign: 'right',
                    background: 'var(--ads-pill-bar-bg, #f1f5f9)',
                    border: '1px solid var(--ads-border, #e2e8f0)',
                    padding: '2px 9px',
                    borderRadius: '6px'
                  }}
                >
                  {it.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Dipnot / Bilgi Kutucuğu */}
        {parsedContent.note && (
          <div
            style={{
              width: '100%',
              fontSize: '12px',
              lineHeight: 1.5,
              color: theme.badgeText,
              background: theme.badgeBg,
              border: `1px solid ${theme.ringBorder}`,
              borderRadius: '10px',
              padding: '8px 12px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              fontWeight: 600
            }}
          >
            <Sparkles size={14} color={theme.primaryColor} style={{ flexShrink: 0 }} />
            <span>{parsedContent.note}</span>
          </div>
        )}

        {/* Alt Aksiyon Butonları (Ortalanmış ve Dengeli) */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '4px'
          }}
        >
          {type === 'confirm' && (
            <button
              type="button"
              onClick={() => closeDialog(false)}
              className="ads-saas-btn"
              style={{
                flex: 1,
                padding: '10.5px 18px',
                borderRadius: '11px',
                fontSize: '13px',
                fontWeight: 700
              }}
            >
              {cancelText || 'Vazgeç'}
            </button>
          )}

          <button
            type="button"
            autoFocus
            onClick={() => closeDialog(true)}
            style={{
              flex: 1,
              maxWidth: type === 'confirm' ? undefined : '220px',
              padding: '10.5px 22px',
              borderRadius: '11px',
              background: theme.gradientBg,
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              boxShadow: theme.buttonShadow,
              transition: 'all 0.16s ease'
            }}
          >
            <Check size={15} strokeWidth={2.5} />
            <span>{confirmText || (type === 'confirm' ? 'Onayla' : 'Tamam, Anlaşıldı')}</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes saasBackdropFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes saasDialogPopIn {
          0% { opacity: 0; transform: scale(0.93) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default GlobalDialog;
