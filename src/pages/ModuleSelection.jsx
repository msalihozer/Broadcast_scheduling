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

const ModuleCard = ({ title, description, icon: Icon, color, onClick, isReady }) => (
  <div 
    onClick={onClick}
    style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '24px',
      padding: '32px',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
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
      width: '64px',
      height: '64px',
      borderRadius: '16px',
      background: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Icon size={32} color={color} />
    </div>
    
    <div>
      <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
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
      height: '100vh',
      overflowY: 'auto',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-tertiary) 100%)',
      padding: '48px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      
      {/* Navbar-like actions */}
      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
         <button 
            onClick={() => signOut()}
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          >
            <LogOut size={16} /> Çıkış Yap
          </button>
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px', maxWidth: '600px' }}>
        <div style={{ 
          width: '72px', height: '72px', background: 'var(--accent-primary)', 
          borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          margin: '0 auto 24px auto', boxShadow: '0 12px 36px var(--accent-primary)' 
        }}>
          <ShieldCheck size={40} color="white" />
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-1px' }}>
          Yayın Planlama Sistemi
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Hoş geldiniz, <span style={{ color: 'var(--accent-primary)', fontWeight: '600', textTransform: 'capitalize' }}>{displayUser}</span>. Lütfen çalışmak istediğiniz modülü seçin.
        </p>
      </div>

      {/* Modules Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '32px',
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
            onClick={() => navigate(card.path)}
          />
        ))}
      </div>

      {/* Admin Button at the very bottom */}
      {canAccessAdminPanel && (
        <div style={{ marginTop: 'auto', paddingTop: '64px' }}>
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
