/**
 * @file src/pages/ModuleSelection.jsx
 * @description Sistemin ana giriş portalı (/).
 * Semerkand TV Kurumsal Kimlik 2026 - 4 modül kimlik rengi ve Admin Paneli satırı.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useResponsive from '../hooks/useResponsive';
import Ikon from '../components/Ikon';

const ALL_MODULE_CARDS = [
  {
    id: 'draft',
    title: 'Taslak Planla',
    description: 'Gelecek haftaların yayın akışını serbestçe planlayın, taslaklar oluşturun ve zamanlamaları ayarlayın.',
    iconName: 'taslak',
    color: 'var(--m-taslak, #0C617C)',
    headerTextColor: '#FFFFFF',
    arrowColor: 'var(--m-taslak, #0C617C)',
    path: '/draft'
  },
  {
    id: 'ready',
    title: 'Yayın Planlama (Ready)',
    description: 'Yayına hazır taslakları kontrol edin ve reklam birimine yönlendirin.',
    iconName: 'hazir',
    color: 'var(--m-ready, #468625)',
    headerTextColor: '#FFFFFF',
    arrowColor: 'var(--m-ready, #468625)',
    path: '/ready'
  },
  {
    id: 'ads',
    title: 'Reklam Rezervasyon',
    description: 'Reklam kuşaklarını, sponsorlukları ve müşteri rezervasyonlarını organize edin.',
    iconName: 'reklam',
    color: 'var(--m-reklam, #E8B44C)',
    headerTextColor: 'var(--gece, #0A101D)',
    arrowColor: '#80632A',
    path: '/ads'
  },
  {
    id: 'list-control',
    title: 'Yayın Liste Kontrol',
    description: 'Reklam Rezervasyon birimi tarafından onaylanıp gönderilmiş kesinleşmiş yayın akışlarını ve reklam listelerini inceleyin.',
    iconName: 'kontrol',
    color: 'var(--m-kontrol, #142A44)',
    headerTextColor: '#FFFFFF',
    arrowColor: 'var(--m-kontrol, #142A44)',
    path: '/list-control'
  }
];

const ModuleCard = ({ card, onClick, isMobile }) => (
  <div
    onClick={onClick}
    style={{
      background: '#FFFFFF',
      border: '1px solid var(--border-color, #DCE5E9)',
      borderRadius: '6px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      cursor: 'pointer',
      transition: 'border-color 0.15s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = card.arrowColor;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--border-color, #DCE5E9)';
    }}
  >
    {/* Modül Kimlik Rengi Başlığı */}
    <div style={{
      height: isMobile ? '136px' : '170px',
      padding: isMobile ? '20px' : '26px',
      background: card.color,
      color: card.headerTextColor,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Sağ Alt Filigran İkon */}
      <div style={{
        position: 'absolute',
        right: '-18px',
        bottom: '-24px',
        width: '150px',
        height: '150px',
        opacity: card.id === 'ads' ? 0.10 : 0.13,
        color: card.headerTextColor,
        pointerEvents: 'none'
      }}>
        <Ikon ad={card.iconName} size={150} strokeWidth={1.35} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Ikon ad={card.iconName} size={isMobile ? 36 : 44} color={card.headerTextColor} />
      </div>

      <h3 style={{
        fontSize: isMobile ? '19px' : '22px',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.015em',
        margin: 0,
        color: card.headerTextColor,
        position: 'relative',
        zIndex: 1
      }}>
        {card.title}
      </h3>
    </div>

    {/* Beyaz Gövde */}
    <div style={{
      padding: isMobile ? '18px 20px' : '24px 26px 26px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      flex: 1,
      minHeight: isMobile ? '130px' : '180px'
    }}>
      <p style={{
        fontSize: '14px',
        lineHeight: 1.55,
        color: 'var(--text-secondary, #4B6478)',
        margin: 0
      }}>
        {card.description}
      </p>

      <div style={{
        width: '36px',
        height: '36px',
        border: `1.5px solid ${card.arrowColor}`,
        color: card.arrowColor,
        borderRadius: '4px',
        display: 'grid',
        placeItems: 'center',
        alignSelf: 'flex-end',
        marginTop: '18px'
      }}>
        <Ikon ad="sag" size={18} />
      </div>
    </div>
  </div>
);

const ModuleSelection = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const user = useAuthStore(state => state.user);
  const role = useAuthStore(state => state.role);
  const managedUsers = useAuthStore(state => state.managedUsers);
  const getCurrentUserPermissions = useAuthStore(state => state.getCurrentUserPermissions);
  const signOut = useAuthStore(state => state.signOut);

  const permissions = useMemo(() => {
    return getCurrentUserPermissions();
  }, [getCurrentUserPermissions, user, role, managedUsers]);

  const allowedModules = permissions?.allowedModules || [];
  const allowedAdminTabs = permissions?.allowedAdminTabs || [];

  const visibleModuleCards = useMemo(() => {
    return ALL_MODULE_CARDS.filter(card => allowedModules.includes(card.id));
  }, [allowedModules]);

  const canAccessAdminPanel =
    allowedModules.includes('admin') ||
    allowedAdminTabs.length > 0 ||
    role === 'admin' ||
    role === 'base admin';

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
    <div style={{
      minHeight: '100dvh',
      height: '100vh',
      overflowY: 'auto',
      background: 'var(--bg-primary, #F5F7F6)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Üst Kurumsal Bar (Derin Turkuaz 60px) */}
      <header style={{
        height: '60px',
        minHeight: '60px',
        background: 'var(--turkuaz, #0C617C)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 14px' : '0 24px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, fontSize: '15px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '1.5px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '4px',
            display: 'grid',
            placeItems: 'center'
          }}>
            <Ikon ad="plan" size={19} />
          </div>
          <span>Yayın Planlama Sistemi</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!isMobile && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: 'rgba(255, 255, 255, 0.88)',
              fontSize: '13px',
              marginRight: '4px'
            }}>
              <Ikon ad="kullanici" size={16} />
              <span style={{ textTransform: 'capitalize' }}>{displayUser}</span>
            </span>
          )}
          <button
            onClick={() => signOut()}
            style={{
              height: '32px',
              padding: '0 12px',
              border: '1px solid rgba(255, 255, 255, 0.28)',
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
            <Ikon ad="cikis" size={15} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </header>

      {/* Gövde */}
      <main style={{
        flex: 1,
        maxWidth: '1480px',
        width: '100%',
        margin: '0 auto',
        padding: isMobile ? '24px 16px 36px' : '48px 56px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box'
      }}>
        {/* Karşılama */}
        <div>
          <h1 style={{
            fontSize: isMobile ? '28px' : '40px',
            fontWeight: 300,
            color: 'var(--text-primary, #0A101D)',
            letterSpacing: '-0.02em',
            margin: '0 0 8px 0'
          }}>
            Yayın Planlama <b style={{ fontWeight: 700, color: 'var(--turkuaz, #0C617C)' }}>Sistemi</b>
          </h1>
          <p style={{
            fontSize: isMobile ? '14px' : '16px',
            color: 'var(--text-secondary, #4B6478)',
            margin: 0
          }}>
            Hoş geldiniz, <b style={{ color: 'var(--turkuaz, #0C617C)', fontWeight: 700 }}>{displayUser}</b>. Lütfen çalışmak istediğiniz modülü seçin.
          </p>
        </div>

        {/* 4 Modül Kartı */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? '16px' : '22px',
          margin: isMobile ? '24px 0' : '32px 0'
        }}>
          {visibleModuleCards.map(card => (
            <ModuleCard
              key={card.id}
              card={card}
              isMobile={isMobile}
              onClick={() => navigate(card.path)}
            />
          ))}
        </div>

        {/* Admin Paneli Satırı */}
        {canAccessAdminPanel && (
          <div
            onClick={() => navigate('/admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFFFF',
              border: '1px solid var(--border-color, #DCE5E9)',
              borderRadius: '6px',
              padding: isMobile ? '14px 16px' : '16px 24px',
              color: 'var(--text-primary, #0A101D)',
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--gece, #0A101D)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color, #DCE5E9)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '1.5px solid var(--gece, #0A101D)',
                borderRadius: '4px',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--gece, #0A101D)'
              }}>
                <Ikon ad="admin" size={22} />
              </div>
              <span>Admin Paneli</span>
            </div>
            <Ikon ad="sag" size={20} />
          </div>
        )}
      </main>
    </div>
  );
};

export default ModuleSelection;
