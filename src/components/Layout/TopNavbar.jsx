/**
 * @file TopNavbar.jsx
 * @description Semerkand TV Kurumsal Kimlik 2026 - 60px Derin Turkuaz Üst Bar.
 * Sol: Ürün işareti + Yayın Planlama (tıklandığında / portalına döner).
 * Orta: 4 ana modül sekmesi (aktif sekmenin altında 3px Hardal #E8B44C çizgi).
 * Sağ: Canlı saat (Roboto Mono) + kırmızı YAYINDA rozeti + kullanıcı ve çıkış butonları.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import useResponsive from '../../hooks/useResponsive';
import Ikon from '../Ikon';

const MODULE_TABS = [
  { id: 'draft', label: 'Taslak Planla', shortLabel: 'Taslak', icon: 'taslak', path: '/draft' },
  { id: 'ready', label: 'Yayın Planlama (Ready)', shortLabel: 'Ready', icon: 'hazir', path: '/ready' },
  { id: 'ads', label: 'Reklam Rezervasyon', shortLabel: 'Reklam', icon: 'reklam', path: '/ads' },
  { id: 'list-control', label: 'Yayın Liste Kontrol', shortLabel: 'Kontrol', icon: 'kontrol', path: '/list-control' }
];

const TopNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isCompact } = useResponsive();
  const [time, setTime] = useState(new Date());

  const user = useAuthStore(state => state.user);
  const role = useAuthStore(state => state.role);
  const managedUsers = useAuthStore(state => state.managedUsers);
  const getCurrentUserPermissions = useAuthStore(state => state.getCurrentUserPermissions);
  const signOut = useAuthStore(state => state.signOut);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const permissions = useMemo(() => {
    return getCurrentUserPermissions ? getCurrentUserPermissions() : { allowedModules: ['draft', 'ready', 'ads', 'list-control'] };
  }, [getCurrentUserPermissions, user, role, managedUsers]);

  const allowedModules = permissions?.allowedModules || ['draft', 'ready', 'ads', 'list-control'];

  const visibleTabs = useMemo(() => {
    return MODULE_TABS.filter(tab => allowedModules.includes(tab.id));
  }, [allowedModules]);

  const isTabActive = (tabPath) => {
    if (tabPath === '/ads') return location.pathname.startsWith('/ads');
    return location.pathname === tabPath;
  };

  const displayEmail = user?.email || '';
  const matchedManagedUser = useMemo(() => {
    const emailLow = String(displayEmail).toLowerCase().trim();
    return (managedUsers || []).find(
      u => String(u.email || '').toLowerCase().trim() === emailLow || String(u.id || '') === String(user?.id || '')
    );
  }, [managedUsers, displayEmail, user]);
  const displayUser =
    matchedManagedUser?.name ||
    user?.name ||
    user?.user_metadata?.name ||
    (displayEmail.includes('@') ? displayEmail.split('@')[0] : displayEmail);

  return (
    <header style={{
      minHeight: isMobile ? '52px' : '60px',
      height: isCompact ? 'auto' : '60px',
      background: 'var(--bg-topbar, #0C617C)',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: isCompact ? 'wrap' : 'nowrap',
      padding: isMobile ? '6px 12px' : '0 24px',
      gap: isMobile ? '8px' : '20px',
      flexShrink: 0,
      zIndex: 1000,
      position: 'sticky',
      top: 0
    }}>
      {/* Sol: Ürün İşareti + Başlık + Modül Sekmeleri */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '10px' : '20px',
        height: isCompact ? '44px' : '100%',
        overflowX: 'auto',
        flex: 1,
        minWidth: 0
      }}>
        {/* Marka / Modül Seçimine Dön */}
        <div
          onClick={() => navigate('/')}
          title="Modül Seçim Ekranına Dön"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            color: '#FFFFFF',
            flexShrink: 0
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            border: '1.5px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '4px',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <Ikon ad="plan" size={19} />
          </div>
          {!isMobile && <span>Yayın Planlama</span>}
        </div>

        {/* Ayırıcı */}
        <div style={{
          width: '1px',
          height: '22px',
          background: 'rgba(255, 255, 255, 0.22)',
          flexShrink: 0
        }} />

        {/* Modül Sekmeleri */}
        <nav style={{
          display: 'flex',
          alignItems: 'stretch',
          height: isCompact ? '44px' : '60px',
          gap: '2px',
          overflowX: 'auto'
        }}>
          {visibleTabs.map(tab => {
            const active = isTabActive(tab.path);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '6px' : '8px',
                  padding: isMobile ? '0 10px' : '0 16px',
                  fontSize: isMobile ? '12px' : '13px',
                  fontWeight: active ? 700 : 500,
                  color: active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.78)',
                  background: 'transparent',
                  border: 0,
                  borderRadius: 0,
                  position: 'relative',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <Ikon ad={tab.icon} size={17} />
                <span>{isMobile ? tab.shortLabel : tab.label}</span>
                {active && (
                  <span style={{
                    position: 'absolute',
                    left: isMobile ? '8px' : '12px',
                    right: isMobile ? '8px' : '12px',
                    bottom: 0,
                    height: '3px',
                    background: 'var(--hardal, #E8B44C)'
                  }} />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sağ: Saat, YAYINDA rozeti, Kullanıcı ve Çıkış */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '6px' : '10px',
        flexShrink: 0
      }}>
        {/* Saat + Tarih */}
        {!isMobile && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontVariantNumeric: 'tabular-nums',
            color: 'rgba(255, 255, 255, 0.9)',
            padding: '6px 10px',
            background: 'rgba(10, 16, 29, 0.24)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <b style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
              {format(time, 'HH:mm:ss')}
            </b>
            {!isCompact && (
              <span>{format(time, 'd MMMM yyyy, EEEE', { locale: tr })}</span>
            )}
          </div>
        )}

        {/* YAYINDA Rozeti */}
        {!isCompact && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 9px',
            background: 'var(--canli, #DD1C40)',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            borderRadius: '2px',
            whiteSpace: 'nowrap'
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#FFFFFF',
              display: 'inline-block'
            }} />
            YAYINDA
          </div>
        )}

        {/* Kullanıcı ve Çıkış İkon Butonları */}
        {user && (
          <>
            <button
              type="button"
              onClick={() => navigate('/admin')}
              title={displayUser}
              style={{
                height: '32px',
                padding: isCompact ? '0 8px' : '0 10px',
                border: '1px solid rgba(255, 255, 255, 0.24)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Ikon ad="kullanici" size={16} />
              {!isCompact && <span style={{ textTransform: 'capitalize' }}>{displayUser}</span>}
            </button>

            <button
              type="button"
              onClick={() => signOut()}
              title="Çıkış"
              style={{
                height: '32px',
                padding: '0 10px',
                border: '1px solid rgba(255, 255, 255, 0.24)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#FFFFFF',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Ikon ad="cikis" size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default TopNavbar;
