/**
 * @file src/components/Ads/AdsSidebar.jsx
 * @description Semerkand TV Kurumsal Kimlik 2026 - Reklam Rezervasyon Modülü 236px Yan Menü (.snav).
 * Aktif sekme Hardal (%20 zemin tinti), koyu metin (#0A101D) ve sol 3px Hardal (#E8B44C) çizgi ile vurgulanır.
 */
import React, { useState } from 'react';
import usePlanningStore from '../../store/planningStore';
import useResponsive from '../../hooks/useResponsive';
import Ikon from '../Ikon';

const AdsSidebar = ({ activeTab, setActiveTab }) => {
  const { isCompact } = useResponsive();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
    if (isCompact) {
      setMobileDrawerOpen(false);
    }
  };

  const menuGroups = [
    {
      id: 'group_main',
      items: [
        { id: 'dashboard', label: 'Genel Bakış', icon: 'rapor' },
        { id: 'reservations', label: 'Rezervasyonlar', icon: 'rezervasyon', count: reservations.length },
        { id: 'sponsorships', label: 'Sponsorluklar', icon: 'sponsor', count: reservations.filter(r => r.isSponsor).length },
        { id: 'planning', label: 'Yayın Planlama', icon: 'plan' },
        { id: 'ad-bumpers', label: 'Reklam Giriş & Çıkışları', icon: 'logo', count: adBreakBumperRules.length }
      ]
    },
    {
      id: 'group_catalog',
      items: [
        { id: 'companies', label: 'Firmalar', icon: 'firma', count: companies.length },
        { id: 'products', label: 'Ürünler', icon: 'urun', count: products.length },
        { id: 'materials', label: 'Materyaller', icon: 'materyal', count: materials.length },
        { id: 'media', label: 'Medya Kütüphanesi', icon: 'medya' },
        { id: 'time-blocks', label: 'Yayın Kuşakları', icon: 'kusak' }
      ]
    },
    {
      id: 'group_reports',
      items: [
        { id: 'reports', label: 'Analitik Raporlar', icon: 'rapor' },
        { id: 'company-details', label: 'Firma Detay Karnesi', icon: 'karne' },
        { id: 'completed-flows', label: 'Tamamlanan Akışlar', icon: 'tamamlanan' }
      ]
    }
  ];

  const allItemsFlat = menuGroups.flatMap(g => g.items);

  if (isCompact) {
    return (
      <>
        <div style={{
          flexShrink: 0,
          background: '#FFFFFF',
          borderBottom: '1px solid var(--border-color, #DCE5E9)',
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
              background: mobileDrawerOpen ? 'var(--turkuaz, #0C617C)' : '#FFFFFF',
              color: mobileDrawerOpen ? '#FFFFFF' : 'var(--text-primary, #0A101D)',
              border: '1px solid var(--border-color, #DCE5E9)',
              borderRadius: '4px',
              padding: '6px 10px',
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
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: isActive ? '1px solid var(--hardal, #E8B44C)' : '1px solid var(--border-color, #DCE5E9)',
                    background: isActive ? 'color-mix(in srgb, var(--hardal, #E8B44C) 22%, #FFFFFF)' : '#FFFFFF',
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

        {mobileDrawerOpen && (
          <>
            <div
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(10, 16, 29, 0.45)',
                zIndex: 1150
              }}
            />
            <aside
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                bottom: 0,
                width: '250px',
                maxWidth: '86vw',
                background: '#FFFFFF',
                borderRight: '1px solid var(--border-color, #DCE5E9)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '14px 10px',
                zIndex: 1200,
                overflowY: 'auto'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {menuGroups.map((group, gIdx) => (
                  <React.Fragment key={group.id}>
                    {gIdx > 0 && (
                      <div style={{
                        height: '1px',
                        background: 'var(--border-light, #EBF0F2)',
                        margin: '8px 6px'
                      }} />
                    )}
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleTabSelect(item.id)}
                          style={{
                            height: '38px',
                            padding: '0 12px',
                            borderRadius: '4px',
                            border: 0,
                            background: isActive ? 'color-mix(in srgb, var(--hardal, #E8B44C) 20%, #FFFFFF)' : 'transparent',
                            color: isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)',
                            boxShadow: isActive ? 'inset 3px 0 0 var(--hardal, #E8B44C)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontWeight: isActive ? 700 : 500,
                            fontSize: '13px',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Ikon ad={item.icon} size={17} color={isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)'} />
                            <span>{item.label}</span>
                          </div>
                          {item.count !== undefined && (
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: isActive ? 'var(--gece, #0A101D)' : 'var(--text-muted, #6A7C88)'
                            }}>
                              {item.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              <div style={{
                marginTop: '14px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-light, #EBF0F2)'
              }}>
                <button
                  type="button"
                  onClick={() => syncAdsCatalogFromArchive && syncAdsCatalogFromArchive(true)}
                  disabled={adsSyncInfo.isSyncing}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color, #DCE5E9)',
                    background: 'var(--bg-primary, #F5F7F6)',
                    color: 'var(--text-primary, #0A101D)',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    cursor: 'pointer'
                  }}
                >
                  <Ikon ad="cek" size={14} />
                  <span>{adsSyncInfo.isSyncing ? 'Senkronize Ediliyor...' : 'MAM Arşivi ile Senkronize Et'}</span>
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
      style={{
        width: '236px',
        minWidth: '236px',
        background: '#FFFFFF',
        borderRight: '1px solid var(--border-color, #DCE5E9)',
        padding: '14px 10px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        userSelect: 'none',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {menuGroups.map((group, gIdx) => (
          <React.Fragment key={group.id}>
            {gIdx > 0 && (
              <div style={{
                height: '1px',
                background: 'var(--border-light, #EBF0F2)',
                margin: '8px 6px'
              }} />
            )}
            {group.items.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabSelect(item.id)}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    border: 0,
                    background: isActive
                      ? 'color-mix(in srgb, var(--hardal, #E8B44C) 20%, #FFFFFF)'
                      : 'transparent',
                    color: isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)',
                    boxShadow: isActive ? 'inset 3px 0 0 var(--hardal, #E8B44C)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '13px',
                    textAlign: 'left',
                    fontFamily: 'inherit'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <Ikon
                      ad={item.icon}
                      size={17}
                      color={isActive ? 'var(--gece, #0A101D)' : 'var(--text-secondary, #4B6478)'}
                    />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </span>
                  </div>

                  {item.count !== undefined && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isActive ? 'var(--gece, #0A101D)' : 'var(--text-muted, #6A7C88)'
                    }}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Alt MAM Arşivi Senkronizasyon Butonu */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-light, #EBF0F2)'
      }}>
        <button
          type="button"
          onClick={() => syncAdsCatalogFromArchive && syncAdsCatalogFromArchive(true)}
          disabled={adsSyncInfo.isSyncing}
          style={{
            width: '100%',
            height: '38px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #DCE5E9)',
            background: 'var(--bg-primary, #F5F7F6)',
            color: 'var(--text-primary, #0A101D)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            cursor: 'pointer'
          }}
        >
          <Ikon ad="cek" size={15} />
          <span>{adsSyncInfo.isSyncing ? 'Senkronize Ediliyor...' : 'MAM Arşivi ile Senkronize Et'}</span>
        </button>
      </div>
    </aside>
  );
};

export default AdsSidebar;
