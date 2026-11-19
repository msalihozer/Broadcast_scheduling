/**
 * @file src/pages/Login.jsx
 * @description Kullanıcı kimlik doğrulama (Giriş) sayfası (/login).
 * Supabase Auth ve yerel oturum hatırlama (rememberMe) mekanizması ile entegre çalışır.
 */
import React, { useState } from 'react';
import useAuthStore from '../store/authStore';
import { Mail, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [botTrap, setBotTrap] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
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
      // Başarılı girişte authStore state değişecek ve App.jsx bizi otomatik olarak dashboard'a atacak
    } catch (err) {
      setError(err.message || "Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-tertiary) 100%)',
      color: 'var(--text-primary)', padding: '24px', overflowY: 'auto', boxSizing: 'border-box'
    }}>
      
      <div className="glass" style={{
        padding: '48px', borderRadius: '24px', width: '100%', maxWidth: '420px',
        display: 'flex', flexDirection: 'column', gap: '24px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <div style={{ 
            width: '64px', height: '64px', background: 'var(--accent-primary)', 
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 20px auto', boxShadow: '0 8px 32px var(--accent-primary)' 
          }}>
            <ShieldCheck size={36} color="white" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>
            Yayın Planlama
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
            Sisteme giriş yapmak için bilgilerinizi girin.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)',
            padding: '12px 16px', borderRadius: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Otomatik Bot / Robot Tuzağı (Honeypot) - İnsan kullanıcılar görmez, botlar doldurursa engellenir */}
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
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kullanıcı Adı</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Mail size={18} />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: '100%', padding: '14px 16px 14px 44px', borderRadius: '12px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: '15px', outline: 'none', transition: 'border 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                placeholder="Örn: admin"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Şifre</label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '14px 16px 14px 44px', borderRadius: '12px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', fontSize: '15px', outline: 'none', transition: 'border 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                placeholder="••••••••"
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
            <input 
              type="checkbox" 
              id="rememberMe" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="rememberMe" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
              Beni Hatırla (Oturum açık kalsın)
            </label>
          </div>

          <button 
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px', width: '100%', padding: '16px', borderRadius: '12px',
              background: 'var(--accent-primary)', color: 'white', fontWeight: 700, fontSize: '16px',
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, transform 0.1s', opacity: loading ? 0.7 : 1,
              display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}
            onMouseOver={(e) => !loading && (e.target.style.background = 'var(--accent-hover)')}
            onMouseOut={(e) => !loading && (e.target.style.background = 'var(--accent-primary)')}
            onMouseDown={(e) => !loading && (e.target.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => !loading && (e.target.style.transform = 'scale(1)')}
          >
            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
          </button>
          
        </form>
      </div>
    </div>
  );
};

export default Login;
