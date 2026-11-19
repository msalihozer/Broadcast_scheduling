/**
 * @file AdsReservationModule.jsx
 * @description Reklam Rezervasyon & Analitik Modülü Ana Bileşeni (TailAdmin v2 Teması).
 * Sol menü (`AdsSidebar`) üzerinden doğrudan sekme geçişi ve DB katalog senkronizasyonu yönetilir.
 */
import React, { useState, useEffect } from 'react';
import '../../styles/adsSaasTheme.css';
import TopNavbar from '../../components/Layout/TopNavbar';
import AdsSidebar from '../../components/Ads/AdsSidebar';
import DashboardTab from '../../components/Ads/DashboardTab';
import CompaniesTab from '../../components/Ads/CompaniesTab';
import ProductsTab from '../../components/Ads/ProductsTab';
import MaterialsTab from '../../components/Ads/MaterialsTab';
import ReservationsTab from '../../components/Ads/ReservationsTab';
import SponsorshipsTab from '../../components/Ads/SponsorshipsTab';
import AdPlanningTab from '../../components/Ads/AdPlanningTab';
import CompanyDetailsTab from '../../components/Ads/CompanyDetailsTab';
import MediaTab from '../../components/Ads/MediaTab';
import TimeBlocksTab from '../../components/Ads/TimeBlocksTab';
import CompletedFlowsTab from '../../components/Ads/CompletedFlowsTab';
import AdsReportsTab from '../../components/Ads/AdsReportsTab';
import usePlanningStore from '../../store/planningStore';

const AdsReservationModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const companiesCount = usePlanningStore(state => (state.companies || []).length);
  const productsCount = usePlanningStore(state => (state.products || []).length);
  const materialsCount = usePlanningStore(state => (state.materials || []).length);
  const loadAdsData = usePlanningStore(state => state.loadAdsData);
  const syncAdsCatalogFromArchive = usePlanningStore(state => state.syncAdsCatalogFromArchive);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);

  useEffect(() => {
    if (companiesCount === 0 || productsCount === 0 || materialsCount === 0) {
      loadAdsData();
      if (syncAdsCatalogFromArchive) {
        syncAdsCatalogFromArchive();
      }
    }
  }, []);

  const handleSelectTab = (tabId) => {
    if (['companies', 'products', 'materials', 'media'].includes(tabId) && setAdFilters) {
      setAdFilters({ companyId: '', productId: '' });
    }
    setActiveTab(tabId);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ads-shell-bg)' }}>
      <TopNavbar />

      <div className="ads-saas-shell">
        <AdsSidebar activeTab={activeTab} setActiveTab={handleSelectTab} />

        <div className="ads-saas-canvas">
          {/* AKTİF SEKME İÇERİĞİ */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexShrink: 0 }}>
            {activeTab === 'dashboard' && <DashboardTab setActiveTab={handleSelectTab} />}
            {activeTab === 'reservations' && <ReservationsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'sponsorships' && <SponsorshipsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'planning' && <AdPlanningTab />}
            {activeTab === 'companies' && <CompaniesTab setActiveTab={handleSelectTab} />}
            {activeTab === 'products' && <ProductsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'materials' && <MaterialsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'media' && <MediaTab setActiveTab={handleSelectTab} />}
            {activeTab === 'time-blocks' && <TimeBlocksTab />}
            {activeTab === 'reports' && <AdsReportsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'company-details' && <CompanyDetailsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'completed-flows' && <CompletedFlowsTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdsReservationModule;
