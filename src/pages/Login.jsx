/**
 * @file src/pages/Login.jsx
 * @description Kullanıcı kimlik doğrulama (Giriş) sayfası (/login).
 * Semerkand TV Kurumsal Kimlik 2026 - 01_Giris.png tasarımına birebir uyumlu 2 sütunlu karşılama + sade giriş formu.
 */
import React, { useState } from 'react';
import useAuthStore from '../store/authStore';
import useResponsive from '../hooks/useResponsive';
import Ikon from '../components/Ikon';

const WORKFLOW_STEPS = [
  { id: 'taslak', label: 'Taslak', icon: 'taslak' },
  { id: 'hazir', label: 'Yayına Hazır', icon: 'hazir' },
  { id: 'reklam', label: 'Reklam', icon: 'reklam' },
  { id: 'kontrol', label: 'Yayın Kontrol', icon: 'kontrol' }
];

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [botTrap, setBotTrap] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focusedField, setFocusedField] = useState('username');

  const { isMobile } = useResponsive();
  const signIn = useAuthStore(state => state.signIn);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const loginEmail = username.includes('@') ? username : `${username}@plan.com`;
      await signIn(loginEmail, password, rememberMe, botTrap);
      localStorage.setItem('yayin_remember_me', rememberMe ? 'true' : 'false');
      if (!rememberMe) {
        sessionStorage.setItem('yayin_session_active', 'true');
      }
    } catch (err) {
      setError(err.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      minHeight: '100dvh',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '56% 44%',
      background: '#FFFFFF',
      color: 'var(--text-primary, #0A101D)',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Sol Sütun: Derin Turkuaz (#0C617C) Kurumsal Marka Yüzü (01_Giris.png) */}
      <div style={{
        position: 'relative',
        background: '#0C617C',
        color: '#FFFFFF',
        padding: isMobile ? '44px 28px 36px' : '64px 72px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Büyük Ürün Çizgi İkonu (Başlıkla aynı sol hizada, başlığın üstünde) */}
        <div style={{
          position: isMobile ? 'relative' : 'absolute',
          left: isMobile ? '-12px' : '2px',
          top: isMobile ? '0px' : '110px',
          width: isMobile ? '240px' : '560px',
          height: isMobile ? '240px' : '560px',
          color: 'rgba(255, 255, 255, 0.22)',
          pointerEvents: 'none'
        }}>
          <Ikon
            ad="plan"
            size={isMobile ? 240 : 560}
            strokeWidth={0.32}
            color="rgba(255, 255, 255, 0.22)"
          />
        </div>

        {/* Ana Başlık: Alt kısımda, biraz daha büyük ve aşağıda (Light 300 + Bold 700) */}
        <h1 style={{
          position: 'relative',
          zIndex: 1,
          margin: isMobile ? '16px 0 0 0' : 'auto 0 0 0',
          fontSize: isMobile ? '52px' : '84px',
          lineHeight: 1.02,
          fontWeight: 300,
          letterSpacing: '-0.015em',
          color: '#FFFFFF'
        }}>
          Yayın
          <b style={{ fontWeight: 700, display: 'block' }}>Planlama</b>
        </h1>

        {/* Alt 4 Akış Aşaması (Çizgisiz, Beyaz İkonlarla) */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          gap: isMobile ? '16px 22px' : '28px',
          marginTop: isMobile ? '24px' : '36px',
          fontSize: '14px',
          fontWeight: 400,
          color: 'rgba(255, 255, 255, 0.88)'
        }}>
          {WORKFLOW_STEPS.map(step => (
            <span
              key={step.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Ikon ad={step.icon} size={20} color="rgba(255, 255, 255, 0.9)" />
              <span>{step.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Sağ Sütun: Sade Giriş Formu (01_Giris.png) */}
      <div style={{
        background: '#FFFFFF',
        display: 'grid',
        placeItems: 'center',
        padding: isMobile ? '36px 24px 48px' : '64px'
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: '400px',
            display: 'grid',
            gap: '22px'
          }}
        >
          {/* Otomatik Bot / Robot Tuzağı (Honeypot) */}
          <input
            type="text"
            name="website_url_trap"
            value={botTrap}
            onChange={(e) => setBotTrap(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
          />

          <p style={{
            fontSize: '20px',
            fontWeight: 300,
            lineHeight: 1.45,
            color: '#0A101D',
            margin: '0 0 6px 0'
          }}>
            Sisteme giriş yapmak için bilgilerinizi girin.
          </p>

          {error && (
            <div style={{
              background: 'var(--danger-bg, #FCE8EC)',
              border: '1px solid rgba(221, 28, 64, 0.35)',
              color: 'var(--danger, #DD1C40)',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Ikon ad="uyari" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* KULLANICI ADI */}
          <div style={{ display: 'grid', gap: '7px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#4B6478'
            }}>
              KULLANICI ADI
            </label>
            <div style={{
              height: '48px',
              border: focusedField === 'username' ? '1px solid #0C617C' : '1px solid #DCE5E9',
              boxShadow: focusedField === 'username' ? '0 0 0 3px #E7F0F3' : 'none',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 14px',
              background: '#FFFFFF',
              color: focusedField === 'username' ? '#0A101D' : '#6A7C88',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }}>
              <Ikon
                ad="kullanici"
                size={18}
                color={focusedField === 'username' ? '#0A101D' : '#6A7C88'}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                required
                placeholder="Örn: admin"
                style={{
                  border: 0,
                  outline: 0,
                  width: '100%',
                  height: '100%',
                  font: 'inherit',
                  fontSize: '15px',
                  color: '#0A101D',
                  background: 'transparent',
                  padding: 0
                }}
              />
            </div>
          </div>

          {/* ŞİFRE */}
          <div style={{ display: 'grid', gap: '7px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#4B6478'
            }}>
              ŞİFRE
            </label>
            <div style={{
              height: '48px',
              border: focusedField === 'password' ? '1px solid #0C617C' : '1px solid #DCE5E9',
              boxShadow: focusedField === 'password' ? '0 0 0 3px #E7F0F3' : 'none',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '0 14px',
              background: '#FFFFFF',
              color: focusedField === 'password' ? '#0A101D' : '#6A7C88',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            }}>
              <Ikon
                ad="kilit"
                size={18}
                color={focusedField === 'password' ? '#0A101D' : '#6A7C88'}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
                placeholder="••••••••"
                style={{
                  border: 0,
                  outline: 0,
                  width: '100%',
                  height: '100%',
                  font: 'inherit',
                  fontSize: '15px',
                  color: '#0A101D',
                  background: 'transparent',
                  padding: 0
                }}
              />
            </div>
          </div>

          {/* Beni Hatırla (Özel 18x18px Kurumsal Turkuaz Onay Kutusu + tamam ikonu) */}
          <label
            onClick={() => setRememberMe(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              color: '#4B6478',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span style={{
              width: '18px',
              height: '18px',
              border: '1.5px solid #0C617C',
              borderRadius: '2px',
              display: 'grid',
              placeItems: 'center',
              background: rememberMe ? '#0C617C' : '#FFFFFF',
              flexShrink: 0,
              transition: 'background 0.12s ease'
            }}>
              {rememberMe && <Ikon ad="tamam" size={14} color="#FFFFFF" />}
            </span>
            <span>Beni Hatırla (Oturum açık kalsın)</span>
          </label>

          {/* Giriş Yap Ana Düğmesi */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '50px',
              background: '#0C617C',
              color: '#FFFFFF',
              border: '1px solid #0C617C',
              borderRadius: '4px',
              font: 'inherit',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#094B60')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#0C617C')}
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
