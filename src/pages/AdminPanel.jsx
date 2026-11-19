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
  Settings, List, PlaySquare, Tv, Film, ClipboardList, Palette, Activity
} from 'lucide-react';
import useAuthStore from '../store/authStore';
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

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      display: 'flex'
    }}>
      {/* Sidebar */}
      <div style={{ width: '280px', flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Admin Paneli</h1>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Yayın Planlama Sistemi</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
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

      {/* Content */}
      <div
        id="admin-panel-scroll-container"
        ref={contentScrollRef}
        style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', minHeight: 0, minWidth: 0 }}
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
