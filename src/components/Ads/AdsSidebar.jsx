/**
 * @file src/components/Ads/AdsSidebar.jsx
 * @description TailAdmin (free-react-tailwind-admin-dashboard v2) Tasarım Sistemine Uygun Yan Menü (Sidebar).
 *
 * Özellikler:
 * - TailAdmin imzalı Royal Blue (#465FFF) marka ikonu ve başlığı
 * - Kategorize edilmiş menü grupları: "ANA MENÜ", "PLANLAMA & REZERVASYON", "ANALİTİK & RAPORLAMA"
 * - Aktif öğede TailAdmin #ECF3FF (`var(--ads-brand-soft)`) arka plan ve #465FFF (`var(--ads-brand)`) vurgu
 * - Sabitlenebilir veya daraltılabilir (260px <-> 76px) akıcı geçiş
 */
import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Package,
  Megaphone,
  CalendarCheck,
  Film,
  PlayCircle,
  Clock,
  FileBarChart2,
  FileText,
  RefreshCw,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Award,
  BarChart3,
  Sparkles
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';

const AdsSidebar = ({ activeTab, setActiveTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const reservations = usePlanningStore(state => state.reservations || []);
  const adBreakBumperRules = usePlanningStore(state => state.adBreakBumperRules || []);
  const adsSyncInfo = usePlanningStore(state => state.adsSyncInfo || {});
  const syncAdsCatalogFromArchive = usePlanningStore(state => state.syncAdsCatalogFromArchive);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);

  const handleTabSelect = (tabId) => {
    if (['companies', 'products', 'materials', 'media'].includes(tabId) && setAdFilters) {
      setAdFilters({ companyId: '', productId: '' });
    }
    setActiveTab(tabId);
  };

  const menuGroups = [
    {
      title: 'MENU',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, badge: 'Canlı' },
        { id: 'reservations', label: 'Rezervasyonlar', icon: <Megaphone size={18} />, count: reservations.length },
        { id: 'sponsorships', label: 'Sponsorluklar', icon: <Award size={18} />, count: reservations.filter(r => r.isSponsor).length },
        { id: 'planning', label: 'Yayın Planlama', icon: <CalendarCheck size={18} /> },
        { id: 'ad-bumpers', label: 'Reklam Giriş & Çıkışları', icon: <Sparkles size={18} />, count: adBreakBumperRules.length }
      ]
    },
    {
      title: 'KATALOG & ENVANTER',
      items: [
        { id: 'companies', label: 'Firmalar', icon: <Building2 size={18} />, count: companies.length },
        { id: 'products', label: 'Ürünler & Kampanyalar', icon: <Package size={18} />, count: products.length },
        { id: 'materials', label: 'Materyaller (Spot)', icon: <Film size={18} />, count: materials.length },
        { id: 'media', label: 'Medya Kütüphanesi', icon: <PlayCircle size={18} /> },
        { id: 'time-blocks', label: 'Yayın Kuşakları', icon: <Clock size={18} /> }
      ]
    },
    {
      title: 'ANALİTİK & RAPORLAR',
      items: [
        { id: 'reports', label: 'Analitik Raporlar', icon: <FileBarChart2 size={18} /> },
        { id: 'company-details', label: 'Firma Detay Karnesi', icon: <FileText size={18} /> },
        { id: 'completed-flows', label: 'Tamamlanan Akışlar', icon: <ListChecks size={18} /> }
      ]
    }
  ];

  return (
    <aside
      style={{
        width: isCollapsed ? '78px' : '265px',
        background: 'var(--ta-sidebar-bg)',
        borderRight: '1px solid var(--ta-sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isCollapsed ? '18px 12px' : '20px 18px',
        flexShrink: 0,
        transition: 'width 0.25s cubic-bezier(0.22, 1, 0.36, 1), padding 0.25s ease',
        userSelect: 'none',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}
    >
      {/* ÜST LOGO VE DARALTMA BAŞLIĞI (TailAdmin Brand Header) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: '10px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--ads-border)'
          }}
        >
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#465fff',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(70, 95, 255, 0.28)',
                  flexShrink: 0
                }}
              >
                <BarChart3 size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: 'var(--ads-text-main)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15
                  }}
                >
                  ReklamAdmin
                </div>
                <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--ads-text-muted)' }}>
                  TailAdmin Analytics
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            title={isCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1px solid var(--ads-border)',
              background: 'var(--ads-card-subtle)',
              color: 'var(--ads-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* MENÜ GRUPLARI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {menuGroups.map(group => (
            <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {!isCollapsed && (
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: 'var(--ads-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '0 10px 4px'
                  }}
                >
                  {group.title}
                </div>
              )}

              {group.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabSelect(item.id)}
                    title={item.label}
                    style={{
                      height: '40px',
                      borderRadius: '10px',
                      border: 'none',
                      background: isActive ? 'var(--ads-brand-soft)' : 'transparent',
                      color: isActive ? 'var(--ads-brand)' : 'var(--ads-text-sub)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '0' : '0 12px',
                      cursor: 'pointer',
                      fontWeight: isActive ? '700' : '600',
                      fontSize: '13.5px',
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      transition: 'all 0.16s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isActive ? 'var(--ads-brand)' : 'var(--ads-text-muted)',
                          flexShrink: 0
                        }}
                      >
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '999px',
                          background: 'var(--ta-success-bg)',
                          color: 'var(--ta-success-text)'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}

                    {!isCollapsed && item.count !== undefined && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '1px 8px',
                          borderRadius: '999px',
                          background: isActive ? 'rgba(70, 95, 255, 0.16)' : 'var(--ads-pill-bar-bg)',
                          color: isActive ? 'var(--ads-brand)' : 'var(--ads-text-muted)'
                        }}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ALT VERİTABANI SENKRONİZASYON KARTI (TailAdmin Promo Box Stili) */}
      <div
        style={{
          marginTop: '20px',
          padding: isCollapsed ? '8px 0' : '14px',
          borderRadius: '14px',
          background: isCollapsed ? 'transparent' : 'var(--ads-card-subtle)',
          border: isCollapsed ? 'none' : '1px solid var(--ads-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {!isCollapsed && (
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--ads-text-main)' }}>
              MAM Katalog
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
              {companies.length} Firma • {materials.length} Klip Senkronize
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => syncAdsCatalogFromArchive && syncAdsCatalogFromArchive({ showNotification: true })}
          disabled={adsSyncInfo.isSyncing}
          className="ads-saas-btn primary"
          style={{
            width: '100%',
            padding: isCollapsed ? '10px 0' : '9px 12px',
            fontSize: '12.5px'
          }}
          title="MAM Veritabanından Şimdi Yenile"
        >
          <RefreshCw size={15} className={adsSyncInfo.isSyncing ? 'spin' : ''} />
          {!isCollapsed && <span>{adsSyncInfo.isSyncing ? 'Senkronize Ediliyor...' : "DB'den Güncelle"}</span>}
        </button>
      </div>
    </aside>
  );
};

export default React.memo(AdsSidebar);
