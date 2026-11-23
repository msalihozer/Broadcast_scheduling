/**
 * @file src/pages/Login.jsx
 * @description Kullanıcı kimlik doğrulama (Giriş) sayfası (/login).
 * Semerkand TV Kurumsal Kimlik 2026 - 2 sütunlu karşılama + temiz form ekranı.
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
  const [rememberMe, setRememberMe] = useState(false);

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
      background: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Sol Sütun: Derin Turkuaz Kurumsal Marka Yüzü */}
      <div style={{
        background: 'var(--turkuaz, #0C617C)',
        color: '#ffffff',
        padding: isMobile ? '36px 24px 32px' : '72px 84px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Arka Plan Filigran İkon */}
        <div style={{
          position: 'absolute',
          right: isMobile ? '-60px' : '-120px',
          bottom: isMobile ? '-60px' : '-120px',
          width: isMobile ? '280px' : '560px',
          height: isMobile ? '280px' : '560px',
          color: 'rgba(255, 255, 255, 0.055)',
          pointerEvents: 'none'
        }}>
          <Ikon ad="plan" size={isMobile ? 280 : 560} strokeWidth={1.2} />
        </div>

        {/* Üst İkon Kutusu */}
        <div style={{
          width: isMobile ? '44px' : '56px',
          height: isMobile ? '44px' : '56px',
          border: '1.75px solid rgba(255, 255, 255, 0.65)',
          borderRadius: '4px',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <Ikon ad="plan" size={isMobile ? 24 : 30} />
        </div>

        {/* Ana Başlık: Light + Bold */}
        <div style={{ position: 'relative', zIndex: 1, margin: isMobile ? '24px 0' : '0' }}>
          <h1 style={{
            fontSize: isMobile ? '42px' : '76px',
            fontWeight: 300,
            lineHeight: 1.02,
            letterSpacing: '-0.025em',
            margin: 0,
            color: '#ffffff'
          }}>
            Yayın<br />
            <b style={{ fontWeight: 700 }}>Planlama</b>
          </h1>
        </div>

        {/* Alt Akış Adımları */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '12px' : '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.22)',
          paddingTop: isMobile ? '18px' : '24px',
          position: 'relative',
          zIndex: 1
        }}>
          {WORKFLOW_STEPS.map(step => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.92)'
              }}
            >
              <Ikon ad={step.icon} size={22} color="#E8B44C" />
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ Sütun: Temiz Giriş Formu */}
      <div style={{
        background: '#ffffff',
        display: 'grid',
        placeItems: 'center',
        padding: isMobile ? '36px 20px 48px' : '64px'
      }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column'
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

          <div style={{
            width: '48px',
            height: '48px',
            background: 'var(--turkuaz, #0C617C)',
            color: '#ffffff',
            borderRadius: '4px',
            display: 'grid',
            placeItems: 'center',
            marginBottom: '22px'
          }}>
            <Ikon ad="plan" size={26} />
          </div>

          <h2 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text-primary, #0A101D)',
            letterSpacing: '-0.015em',
            margin: '0 0 6px 0'
          }}>
            Yayın Planlama
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #4B6478)',
            margin: '0 0 32px 0'
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
              gap: '8px',
              marginBottom: '20px'
            }}>
              <Ikon ad="uyari" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Kullanıcı Adı */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary, #0A101D)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>
              Kullanıcı Adı
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '48px',
              padding: '0 14px',
              border: '1px solid var(--border-color, #DCE5E9)',
              borderRadius: '4px',
              background: '#ffffff',
              color: 'var(--text-primary, #0A101D)'
            }}>
              <Ikon ad="kullanici" size={18} color="var(--text-muted, #6A7C88)" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Örn: admin"
                style={{
                  border: 0,
                  outline: 0,
                  width: '100%',
                  height: '100%',
                  font: 'inherit',
                  fontSize: '15px',
                  color: 'var(--text-primary, #0A101D)',
                  background: 'transparent',
                  padding: 0
                }}
              />
            </div>
          </div>

          {/* Şifre */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-primary, #0A101D)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '8px'
            }}>
              Şifre
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              height: '48px',
              padding: '0 14px',
              border: '1px solid var(--border-color, #DCE5E9)',
              borderRadius: '4px',
              background: '#ffffff',
              color: 'var(--text-primary, #0A101D)'
            }}>
              <Ikon ad="kilit" size={18} color="var(--text-muted, #6A7C88)" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  border: 0,
                  outline: 0,
                  width: '100%',
                  height: '100%',
                  font: 'inherit',
                  fontSize: '15px',
                  color: 'var(--text-primary, #0A101D)',
                  background: 'transparent',
                  padding: 0
                }}
              />
            </div>
          </div>

          {/* Beni Hatırla */}
          <label
            htmlFor="rememberMe"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: 'var(--text-secondary, #4B6478)',
              margin: '6px 0 26px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '18px',
                height: '18px',
                accentColor: 'var(--turkuaz, #0C617C)',
                cursor: 'pointer',
                margin: 0
              }}
            />
            <span>Beni Hatırla (Oturum açık kalsın)</span>
          </label>

          {/* Giriş Yap Butonu */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '50px',
              background: 'var(--turkuaz, #0C617C)',
              color: '#ffffff',
              border: 0,
              borderRadius: '4px',
              font: 'inherit',
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--turkuaz-koyu, #094B60)')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = 'var(--turkuaz, #0C617C)')}
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
