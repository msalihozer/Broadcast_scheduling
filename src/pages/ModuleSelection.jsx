/**
 * @file src/pages/ModuleSelection.jsx
 * @description Sistemin ana giriş portalı (/).
 * Kullanıcının tanımlı yetkilerine (allowedModules ve allowedAdminTabs) göre
 * Taslak Planlama, Yayın Planlama, Reklam Rezervasyon, Yayın Liste Kontrol ve Admin Paneli modüllerini sunar.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MonitorPlay, ShieldCheck, LogOut } from 'lucide-react';
import useAuthStore from '../store/authStore';
import useResponsive from '../hooks/useResponsive';

const ModuleCard = ({ title, description, icon: Icon, color, onClick, isReady, isMobile }) => (
  <div 
    onClick={onClick}
    style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: isMobile ? '18px' : '24px',
      padding: isMobile ? '20px 18px' : '32px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: isMobile ? '12px' : '16px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      height: '100%',
      opacity: isReady ? 1 : 0.7,
      boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-8px)';
      e.currentTarget.style.borderColor = color;
      e.currentTarget.style.boxShadow = `0 20px 40px ${color}22`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = 'var(--border-color)';
      e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
    }}
  >
    <div style={{
      width: isMobile ? '48px' : '64px',
      height: isMobile ? '48px' : '64px',
      borderRadius: isMobile ? '12px' : '16px',
      background: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Icon size={isMobile ? 24 : 32} color={color} />
    </div>
    
    <div>
      <h3 style={{ fontSize: isMobile ? '17px' : '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
        {title}
      </h3>
      <p style={{ fontSize: isMobile ? '13px' : '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        {description}
      </p>
    </div>

    {!isReady && (
      <div style={{
        position: 'absolute',
        top: '24px',
        right: '24px',
        background: 'var(--bg-tertiary)',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: 'var(--text-muted)'
      }}>
        YAKINDA
      </div>
    )}
  </div>
);

const ALL_MODULE_CARDS = [
  {
    id: 'draft',
    title: 'Taslak Planla',
    description: 'Gelecek haftaların yayın akışını serbestçe planlayın, taslaklar oluşturun ve zamanlamaları ayarlayın.',
    icon: Calendar,
    color: '#3b82f6',
    path: '/draft'
  },
  {
    id: 'ready',
    title: 'Yayın Planlama (Ready)',
    description: 'Yayına hazır taslakları kontrol edin ve reklam birimine yönlendirin.',
    icon: MonitorPlay,
    color: '#3b82f6',
    path: '/ready'
  },
  {
    id: 'ads',
    title: 'Reklam Rezervasyon',
    description: 'Reklam kuşaklarını, sponsorlukları ve müşteri rezervasyonlarını organize edin.',
    icon: Calendar,
    color: '#10b981',
    path: '/ads'
  },
  {
    id: 'list-control',
    title: 'Yayın Liste Kontrol',
    description: 'Reklam Rezervasyon birimi tarafından onaylanıp gönderilmiş kesinleşmiş yayın akışlarını ve reklam listelerini inceleyin.',
    icon: ShieldCheck,
    color: '#f59e0b',
    path: '/list-control'
  }
];

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
  const displayUser = user?.name || (displayEmail.includes('@') ? displayEmail.split('@')[0] : displayEmail);

  return (
    <div style={{
      minHeight: '100dvh',
      height: '100vh',
      overflowY: 'auto',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-tertiary) 100%)',
      padding: isMobile ? '20px 14px 36px 14px' : '48px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      
      {/* Navbar-like actions */}
      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', justifyContent: 'flex-end', marginBottom: isMobile ? '20px' : '40px' }}>
         <button 
            onClick={() => signOut()}
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: isMobile ? '8px 12px' : '10px 16px', borderRadius: '12px', fontSize: isMobile ? '12.5px' : '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          >
            <LogOut size={15} /> Çıkış Yap
          </button>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? '28px' : '64px', maxWidth: '600px', padding: isMobile ? '0 6px' : 0 }}>
        <div style={{ 
          width: isMobile ? '54px' : '72px', height: isMobile ? '54px' : '72px', background: 'var(--accent-primary)', 
          borderRadius: isMobile ? '16px' : '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          margin: isMobile ? '0 auto 14px auto' : '0 auto 24px auto', boxShadow: '0 12px 36px var(--accent-primary)' 
        }}>
          <ShieldCheck size={isMobile ? 28 : 40} color="white" />
        </div>
        <h1 style={{ fontSize: isMobile ? '24px' : '36px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: isMobile ? '8px' : '16px', letterSpacing: '-0.8px' }}>
          Yayın Planlama Sistemi
        </h1>
        <p style={{ fontSize: isMobile ? '13.5px' : '16px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          Hoş geldiniz, <span style={{ color: 'var(--accent-primary)', fontWeight: '600', textTransform: 'capitalize' }}>{displayUser}</span>. Lütfen çalışmak istediğiniz modülü seçin.
        </p>
      </div>

      {/* Modules Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: isMobile ? '14px' : '32px',
        width: '100%',
        maxWidth: '1100px'
      }}>
        {visibleModuleCards.map(card => (
          <ModuleCard
            key={card.id}
            title={card.title}
            description={card.description}
            icon={card.icon}
            color={card.color}
            isReady={true}
            isMobile={isMobile}
            onClick={() => navigate(card.path)}
          />
        ))}
      </div>

      {/* Admin Button at the very bottom */}
      {canAccessAdminPanel && (
        <div style={{ marginTop: 'auto', paddingTop: isMobile ? '28px' : '64px' }}>
          <button 
            onClick={() => navigate('/admin')}
            style={{ 
              background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
              padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          >
            <ShieldCheck size={16} /> Admin Paneli
          </button>
        </div>
      )}

    </div>
  );
};

export default ModuleSelection;
