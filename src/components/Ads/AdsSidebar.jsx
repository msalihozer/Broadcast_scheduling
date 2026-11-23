/**
 * @file src/components/Ads/AdsSidebar.jsx
 * @description TailAdmin v2 Yan Menü (Sidebar) — Fare Üzerine Geldiğinde (Hover) Yumuşak Açılır / Otomatik Kapanır Mimari.
 *
 * Özellikler:
 * - Varsayılan olarak daraltılmış (`74px`) ikon şeridi olarak durur; çalışma alanına maksimum genişlik sağlar.
 * - Fareyle üzerine gelindiğinde (`onMouseEnter`) yumuşak bir animasyonla (`0.32s cubic-bezier`) `260px` genişliğe açılır,
 *   fare ayrıldığında (`onMouseLeave`) veya bir sekme seçildiğinde otomatik kapanır.
 * - İstenirse sağ üstteki zarif sabitleme (pin) ikonuyla sabit açık da tutulabilir.
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
  Pin,
  PinOff,
  Award,
  BarChart3,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useResponsive from '../../hooks/useResponsive';

const AdsSidebar = ({ activeTab, setActiveTab }) => {
  const { isCompact } = useResponsive();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isCollapsed = !isCompact && !isPinned && !isHovered;

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
    if (!isPinned) {
      setIsHovered(false);
    }
    if (isCompact) {
      setMobileDrawerOpen(false);
    }
  };

  const menuGroups = [
    {
      title: 'ANA MENÜ',
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
        { id: 'products', label: 'Ürünler', icon: <Package size={18} />, count: products.length },
        { id: 'materials', label: 'Materyaller', icon: <Film size={18} />, count: materials.length },
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

  const allItemsFlat = menuGroups.flatMap(g => g.items);

  if (isCompact) {
    return (
      <>
        {/* Mobil / Tablet Üst Yatay Kaydırılabilir Hızlı Sekme Çubuğu */}
        <div style={{
          flexShrink: 0,
          background: 'var(--ta-sidebar-bg)',
          borderBottom: '1px solid var(--ta-sidebar-border)',
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 40
        }}>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(prev => !prev)}
            style={{
              background: mobileDrawerOpen ? 'var(--ads-brand)' : 'var(--ads-card-subtle)',
              color: mobileDrawerOpen ? '#ffffff' : 'var(--ads-text-main)',
              border: '1px solid var(--ads-border)',
              borderRadius: '9px',
              padding: '7px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {mobileDrawerOpen ? <X size={15} /> : <Menu size={15} />}
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
            {allItemsFlat.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabSelect(item.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 11px',
                    borderRadius: '999px',
                    border: isActive ? '1px solid var(--ads-brand)' : '1px solid var(--ads-border)',
                    background: isActive ? 'var(--ads-brand)' : 'var(--ads-card-bg)',
                    color: isActive ? '#ffffff' : 'var(--ads-text-sub)',
                    fontSize: '12px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--ads-pill-bar-bg)',
                      color: isActive ? '#ffffff' : 'var(--ads-text-muted)'
                    }}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobil Açılır Tam Menü Drawer */}
        {mobileDrawerOpen && (
          <>
            <div
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.55)',
                zIndex: 1150
              }}
            />
            <aside
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '270px',
                maxWidth: '86vw',
                background: 'var(--ta-sidebar-bg)',
                borderRight: '1px solid var(--ta-sidebar-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 14px',
                zIndex: 1200,
                overflowY: 'auto',
                boxShadow: '12px 0 32px rgba(0,0,0,0.35)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--ads-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #465fff 0%, #3641f5 100%)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <BarChart3 size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--ads-text-main)' }}>Reklam Yönetimi</div>
                      <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>Medya & Planlama</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    style={{
                      background: 'var(--ads-card-subtle)',
                      border: '1px solid var(--ads-border)',
                      color: 'var(--ads-text-main)',
                      borderRadius: '8px',
                      padding: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {menuGroups.map(group => (
                  <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      color: 'var(--ads-text-muted)',
                      textTransform: 'uppercase',
                      padding: '0 8px 4px'
                    }}>
                      {group.title}
                    </div>
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleTabSelect(item.id)}
                          style={{
                            height: '38px',
                            borderRadius: '9px',
                            border: isActive ? '1px solid rgba(70, 95, 255, 0.25)' : '1px solid transparent',
                            background: isActive ? 'var(--ads-brand-soft)' : 'transparent',
                            color: isActive ? 'var(--ads-brand)' : 'var(--ads-text-sub)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0 10px',
                            cursor: 'pointer',
                            fontWeight: isActive ? 800 : 600,
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
                          {item.count !== undefined && (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background: isActive ? 'rgba(70, 95, 255, 0.16)' : 'var(--ads-pill-bar-bg)',
                              color: isActive ? 'var(--ads-brand)' : 'var(--ads-text-muted)'
                            }}>
                              {item.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div style={{
                marginTop: '16px',
                padding: '10px',
                borderRadius: '10px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
                  MAM Katalog ({companies.length} Firma • {materials.length} Klip)
                </div>
                <button
                  type="button"
                  onClick={() => syncAdsCatalogFromArchive && syncAdsCatalogFromArchive(true)}
                  disabled={adsSyncInfo.isSyncing}
                  className="ads-saas-btn ads-saas-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '7px 10px', fontSize: '12px' }}
                >
                  <RefreshCw size={13} className={adsSyncInfo.isSyncing ? 'animate-spin' : ''} />
                  <span>{adsSyncInfo.isSyncing ? 'Eşitleniyor...' : 'Kataloğu Eşitle'}</span>
                </button>
              </div>
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: isCollapsed ? '74px' : '256px',
        background: 'var(--ta-sidebar-bg)',
        borderRight: '1px solid var(--ta-sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isCollapsed ? '16px 10px' : '18px 16px',
        flexShrink: 0,
        transition: 'width 0.32s cubic-bezier(0.22, 1, 0.36, 1), padding 0.28s ease, box-shadow 0.28s ease',
        boxShadow: !isCollapsed && !isPinned ? '8px 0 28px -6px rgba(16, 24, 40, 0.12)' : 'none',
        userSelect: 'none',
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 30
      }}
    >
      {/* ÜST LOGO VE SABİTLEME BAŞLIĞI */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: '8px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--ads-border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #465fff 0%, #3641f5 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(70, 95, 255, 0.3)',
                flexShrink: 0
              }}
              title="Reklam & Sponsorluk Yönetimi (Üzerine gelince açılır)"
            >
              <BarChart3 size={20} />
            </div>

            {!isCollapsed && (
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: '800',
                    color: 'var(--ads-text-main)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  Reklam Yönetimi
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: 'var(--ads-text-muted)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Medya &amp; Planlama
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsPinned(prev => !prev)}
              title={isPinned ? 'Sabitlemeyi Kaldır (Otomatik Kapansın)' : 'Menüyü Açık Sabitle'}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                border: isPinned ? '1.5px solid var(--ads-brand)' : '1px solid var(--ads-border)',
                background: isPinned ? 'var(--ads-brand-soft)' : 'var(--ads-card-subtle)',
                color: isPinned ? 'var(--ads-brand)' : 'var(--ads-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
          )}
        </div>

        {/* MENÜ GRUPLARI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {menuGroups.map(group => (
            <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {!isCollapsed && (
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    color: 'var(--ads-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    padding: '0 10px 4px',
                    whiteSpace: 'nowrap'
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
                      border: isActive ? '1px solid rgba(70, 95, 255, 0.25)' : '1px solid transparent',
                      background: isActive ? 'var(--ads-brand-soft)' : 'transparent',
                      color: isActive ? 'var(--ads-brand)' : 'var(--ads-text-sub)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'space-between',
                      padding: isCollapsed ? '0' : '0 11px',
                      cursor: 'pointer',
                      fontWeight: isActive ? '800' : '600',
                      fontSize: '13px',
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
                          fontSize: '10px',
                          fontWeight: '800',
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

      {/* ALT VERİTABANI SENKRONİZASYON KARTI */}
      <div
        style={{
          marginTop: '18px',
          padding: isCollapsed ? '8px 0' : '12px',
          borderRadius: '12px',
          background: isCollapsed ? 'transparent' : 'var(--ads-card-subtle)',
          border: isCollapsed ? 'none' : '1px solid var(--ads-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {!isCollapsed && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
              MAM Katalog
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
              {companies.length} Firma • {materials.length} Klip
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => syncAdsCatalogFromArchive && syncAdsCatalogFromArchive(true)}
          disabled={adsSyncInfo.isSyncing}
          className="ads-saas-btn ads-saas-btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: isCollapsed ? '9px' : '8px 12px',
            fontSize: '12px'
          }}
          title="MAM Arşivi ile Senkronize Et"
        >
          <RefreshCw size={14} className={adsSyncInfo.isSyncing ? 'animate-spin' : ''} />
          {!isCollapsed && <span>{adsSyncInfo.isSyncing ? 'Eşitleniyor...' : 'Kataloğu Eşitle'}</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdsSidebar;
