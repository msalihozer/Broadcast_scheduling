/**
 * @file src/pages/AdminPanel.jsx
 * @description Sistem Yönetimi (Admin Panel) ana kapsayıcı sayfası.
 * Kullanıcının yetkisine (allowedAdminTabs) göre Genel Bakış, Programlar, MAM Arşiv & Bölümler,
 * Kullanıcı Yönetimi, Listeler, İstatistikler, Reklam Yönetimi, Log Kayıtları ve Sistem Ayarları sekmelerini sunar.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, ArrowLeft, LayoutDashboard, Users, BarChart2,
  Settings, List, PlaySquare, Tv, Film, ClipboardList, Palette, Activity, Menu, X
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useResponsive from '../hooks/useResponsive';
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
  { id: 'overview', label: 'Genel Bakış', icon: <LayoutDashboard size={18} /> },
  { id: 'server-monitor', label: 'Sunucu & Docker Takip', icon: <Activity size={18} /> },
  { id: 'programs', label: 'Programlar', icon: <Tv size={18} /> },
  { id: 'archive-analysis', label: 'MAM Arşiv & Bölümler', icon: <Film size={18} /> },
  { id: 'users', label: 'Kullanıcı Yönetimi', icon: <Users size={18} /> },
  { id: 'lists', label: 'Listeler', icon: <List size={18} /> },
  { id: 'stats', label: 'İstatistikler', icon: <BarChart2 size={18} /> },
  { id: 'ads', label: 'Reklam Yönetimi', icon: <PlaySquare size={18} /> },
  { id: 'logs', label: 'Log Kayıtları', icon: <ClipboardList size={18} /> },
  { id: 'themes', label: 'Temalar & Renkler', icon: <Palette size={18} /> },
  { id: 'settings', label: 'Sistem Ayarları', icon: <Settings size={18} /> },
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
    // Kullanıcı Yönetimi listesinde tanımlı bir kullanıcıysa yalnızca kendisine yetki verilen sekmeleri göster
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

  // Sekme değiştiğinde içerik alanını en üste kaydır
  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeTab]);

  // Aktif sekme yetkili sekmeler arasında değilse ilk yetkili sekmeye geç
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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <ShieldAlert size={64} color="var(--danger)" style={{ marginBottom: '24px' }} />
        <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Yetkisiz Erişim</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Bu sayfayı görüntülemek için tanımlanmış Admin Paneli sekme yetkiniz bulunmuyor.</p>
        <button 
          onClick={() => navigate('/')}
          style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  const activeNavItem = useMemo(
    () => navItems.find(item => item.id === activeTab) || navItems[0],
    [navItems, activeTab]
  );

  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      display: 'flex',
      flexDirection: isCompact ? 'column' : 'row',
      position: 'relative'
    }}>
      {/* Mobil / Tablet Üst Başlık ve Yatay Sekme Çubuğu */}
      {isCompact && (
        <div style={{
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1100
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => navigate('/')}
                title="Modüllere Dön"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={16} /> {!isMobile && 'Modüller'}
              </button>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, lineHeight: 1.2 }}>Admin Paneli</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {activeNavItem?.label || 'Yönetim'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(prev => !prev)}
              style={{
                background: mobileMenuOpen ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: mobileMenuOpen ? '#fff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '7px 11px',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
              Menü
            </button>
          </div>

          {/* Yatay Kaydırılabilir Hızlı Sekme Şeridi */}
          <div
            className="mobile-scroll-x"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 12px 10px 12px',
              overflowX: 'auto'
            }}
          >
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    background: isActive ? 'var(--accent-primary)' : 'var(--bg-primary)',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  {item.icon} {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobil Açılır Drawer Backdrop */}
      {isCompact && mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            zIndex: 1200
          }}
        />
      )}

      {/* Sidebar (Masaüstünde sabit, Mobil/Tablette Slide-over Drawer) */}
      {(!isCompact || mobileMenuOpen) && (
        <div style={isCompact ? {
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '85vw',
          zIndex: 1250,
          overflowY: 'auto',
          borderRight: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '24px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '12px 0 32px rgba(0,0,0,0.35)'
        } : {
          width: '280px',
          flexShrink: 0,
          overflowY: 'auto',
          borderRight: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowLeft size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Admin Paneli</h1>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Yayın Planlama Sistemi</span>
              </div>
            </div>
            {isCompact && (
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (isCompact) setMobileMenuOpen(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', border: 'none', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s',
                  background: activeTab === item.id ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === item.id ? '#fff' : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => { if (activeTab !== item.id) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { if (activeTab !== item.id) e.currentTarget.style.background = 'transparent'; }}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </nav>

          <div style={{
            marginTop: '20px',
            padding: '12px',
            borderRadius: '10px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontWeight: '800', color: 'var(--text-primary)', marginBottom: '2px' }}>
              {user?.name || user?.email || 'Aktif Kullanıcı'}
            </div>
            <div>Yetkili Sekme: {navItems.length} / {ALL_NAV_ITEMS.length}</div>
          </div>
        </div>
      )}

      {/* Content */}
      <div
        id="admin-panel-scroll-container"
        ref={contentScrollRef}
        style={{
          flex: 1,
          padding: isMobile ? '14px 12px 32px 12px' : isCompact ? '20px 18px 36px 18px' : '40px 48px',
          overflowY: 'auto',
          minHeight: 0,
          minWidth: 0
        }}
      >
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
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
  );
};

export default AdminPanel;
