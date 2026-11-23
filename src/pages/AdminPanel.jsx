/**
 * @file src/pages/AdminPanel.jsx
 * @description Semerkand TV Kurumsal Kimlik 2026 - Sistem Yönetimi (Admin Panel) ana kapsayıcı sayfası.
 * Üstte 60px Derin Turkuaz TopNavbar, solda 236px beyaz yan menü (.anav) ve aktif sekmede Gece (#0A101D) 3px sol çizgi.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useResponsive from '../hooks/useResponsive';
import TopNavbar from '../components/Layout/TopNavbar';
import Ikon from '../components/Ikon';
import OverviewTab from './admin/OverviewTab';
import UsersTab from './admin/UsersTab';
import StatsTab from './admin/StatsTab';
import ListsTab from './admin/ListsTab';
import AdsTab from './admin/AdsTab';
import SettingsTab from './admin/SettingsTab';
import ProgramsTab from './admin/ProgramsTab';
import ArchiveAnalysisTab from './admin/ArchiveAnalysisTab';
import LogsTab from './admin/LogsTab';
import ThemesTab from './admin/ThemesTab';
import ServerMonitorTab from './admin/ServerMonitorTab';

const ALL_NAV_ITEMS = [
  { id: 'overview', label: 'Genel Bakış', icon: 'rapor' },
  { id: 'server-monitor', label: 'Sunucu & Docker Takip', icon: 'sunucu' },
  { id: 'programs', label: 'Programlar', icon: 'kanal' },
  { id: 'archive-analysis', label: 'MAM Arşiv & Bölümler', icon: 'arsiv' },
  { id: 'users', label: 'Kullanıcı Yönetimi', icon: 'kullanici' },
  { id: 'lists', label: 'Listeler', icon: 'tablo' },
  { id: 'stats', label: 'İstatistikler', icon: 'rapor' },
  { id: 'ads', label: 'Reklam Yönetimi', icon: 'reklam' },
  { id: 'logs', label: 'Log Kayıtları', icon: 'log' },
  { id: 'themes', label: 'Temalar & Renkler', icon: 'tema' },
  { id: 'settings', label: 'Sistem Ayarları', icon: 'admin' }
];

const AdminPanel = () => {
  const navigate = useNavigate();
  const { isMobile, isCompact } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = useAuthStore(state => state.role);
  const user = useAuthStore(state => state.user);
  const managedUsers = useAuthStore(state => state.managedUsers);
  const getCurrentUserPermissions = useAuthStore(state => state.getCurrentUserPermissions);

  const permissions = useMemo(() => {
    return getCurrentUserPermissions();
  }, [getCurrentUserPermissions, role, user, managedUsers]);

  const allowedAdminTabs = permissions?.allowedAdminTabs || [];
  const allowedModules = permissions?.allowedModules || [];

  const navItems = useMemo(() => {
    if (permissions?.userRecord) {
      return ALL_NAV_ITEMS.filter(item => allowedAdminTabs.includes(item.id));
    }
    if (role === 'admin' || role === 'base admin') {
      if (allowedAdminTabs.length > 0) {
        return ALL_NAV_ITEMS.filter(item => allowedAdminTabs.includes(item.id));
      }
      return ALL_NAV_ITEMS;
    }
    return ALL_NAV_ITEMS.filter(item => allowedAdminTabs.includes(item.id));
  }, [role, allowedAdminTabs, permissions]);

  const [activeTab, setActiveTab] = useState('overview');
  const [archiveInitial, setArchiveInitial] = useState({ catId: 4, search: '' });
  const contentScrollRef = useRef(null);

  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some(item => item.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navItems, activeTab]);

  const hasAdminAccess =
    role === 'admin' ||
    role === 'base admin' ||
    allowedModules.includes('admin') ||
    navItems.length > 0;

  if (!hasAdminAccess || navItems.length === 0) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary, #F5F7F6)',
        color: 'var(--text-primary, #0A101D)'
      }}>
        <Ikon ad="uyari" size={56} color="var(--danger, #DD1C40)" />
        <h1 style={{ fontSize: '22px', margin: '18px 0 8px' }}>Yetkisiz Erişim</h1>
        <p style={{ color: 'var(--text-secondary, #4B6478)', marginBottom: '24px' }}>
          Bu sayfayı görüntülemek için tanımlanmış Admin Paneli sekme yetkiniz bulunmuyor.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'var(--turkuaz, #0C617C)',
            color: '#FFFFFF',
            border: 0,
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 700
          }}
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--bg-primary, #F5F7F6)',
      color: 'var(--text-primary, #0A101D)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* 60px Derin Turkuaz Üst Bar */}
      <TopNavbar />

      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        overflow: 'hidden'
      }}>
        {/* Mobil / Tablet Üst Hızlı Sekme Şeridi */}
        {isCompact && (
          <div style={{
            flexShrink: 0,
            background: '#FFFFFF',
            borderBottom: '1px solid var(--border-color, #DCE5E9)',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 40
          }}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              style={{
                background: mobileMenuOpen ? 'var(--gece, #0A101D)' : '#FFFFFF',
                color: mobileMenuOpen ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
                border: '1px solid var(--border-color, #DCE5E9)',
                padding: '6px 10px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Ikon ad="menu" size={15} />
              <span>Menü</span>
            </button>

            <div
              className="mobile-scroll-x"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                overflowX: 'auto',
                flex: 1
              }}
            >
              {navItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: isActive ? '1px solid var(--gece, #0A101D)' : '1px solid var(--border-color, #DCE5E9)',
                      background: isActive ? 'color-mix(in srgb, var(--gece, #0A101D) 10%, #FFFFFF)' : '#FFFFFF',
                      color: isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 500,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Ikon ad={item.icon} size={15} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isCompact && mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10, 16, 29, 0.45)',
              zIndex: 1200
            }}
          />
        )}

        {/* 236px Beyaz Yan Menü (.anav) */}
        {(!isCompact || mobileMenuOpen) && (
          <aside style={isCompact ? {
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: '250px',
            maxWidth: '85vw',
            zIndex: 1250,
            overflowY: 'auto',
            borderRight: '1px solid var(--border-color, #DCE5E9)',
            background: '#FFFFFF',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          } : {
            width: '236px',
            minWidth: '236px',
            flexShrink: 0,
            overflowY: 'auto',
            borderRight: '1px solid var(--border-color, #DCE5E9)',
            background: '#FFFFFF',
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {navItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      if (isCompact) setMobileMenuOpen(false);
                    }}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '4px',
                      border: 0,
                      background: isActive
                        ? 'color-mix(in srgb, var(--gece, #0A101D) 8%, #FFFFFF)'
                        : 'transparent',
                      color: isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)',
                      boxShadow: isActive ? 'inset 3px 0 0 var(--gece, #0A101D)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isActive ? 700 : 500,
                      textAlign: 'left',
                      fontFamily: 'inherit'
                    }}
                  >
                    <Ikon
                      ad={item.icon}
                      size={17}
                      color={isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)'}
                    />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div style={{
              marginTop: '14px',
              padding: '10px 12px',
              borderRadius: '4px',
              background: 'var(--bg-primary, #F5F7F6)',
              border: '1px solid var(--border-color, #DCE5E9)',
              fontSize: '11.5px',
              color: 'var(--text-secondary, #4B6478)'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary, #0A101D)', marginBottom: '2px' }}>
                {permissions?.userRecord?.name || user?.name || user?.user_metadata?.name || user?.email || 'Aktif Kullanıcı'}
              </div>
              <div>Yetkili Sekme: {navItems.length} / {ALL_NAV_ITEMS.length}</div>
            </div>
          </aside>
        )}

        {/* Ana İçerik Alanı */}
        <div
          id="admin-panel-scroll-container"
          ref={contentScrollRef}
          style={{
            flex: 1,
            padding: isMobile ? '14px 12px 32px' : isCompact ? '18px 16px 36px' : '24px 32px 40px',
            overflowY: 'auto',
            minHeight: 0,
            minWidth: 0
          }}
        >
          <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
            {activeTab === 'overview' && (
              <OverviewTab
                onNavigateTab={(tabId) => {
                  if (navItems.some(n => n.id === tabId)) {
                    setActiveTab(tabId);
                  }
                }}
              />
            )}
            {activeTab === 'server-monitor' && <ServerMonitorTab />}
            {activeTab === 'programs' && (
              <ProgramsTab
                onNavigateToArchive={(catId, search) => {
                  setArchiveInitial({ catId, search });
                  if (navItems.some(n => n.id === 'archive-analysis')) {
                    setActiveTab('archive-analysis');
                  }
                }}
              />
            )}
            {activeTab === 'archive-analysis' && (
              <ArchiveAnalysisTab
                initialCategoryId={archiveInitial.catId}
                initialSearch={archiveInitial.search}
              />
            )}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'lists' && <ListsTab />}
            {activeTab === 'stats' && <StatsTab />}
            {activeTab === 'ads' && <AdsTab />}
            {activeTab === 'logs' && <LogsTab />}
            {activeTab === 'themes' && <ThemesTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
