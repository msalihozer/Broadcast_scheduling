/**
 * @file AdsReservationModule.jsx
 * @description Reklam Rezervasyon & Analitik Modülü Ana Bileşeni (TailAdmin v2 Teması).
 * Sol menü (`AdsSidebar`) üzerinden doğrudan sekme geçişi ve DB katalog senkronizasyonu yönetilir.
 */
import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
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
import AdBreakBumpersTab from '../../components/Ads/AdBreakBumpersTab';
import usePlanningStore from '../../store/planningStore';

const AdsReservationModule = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);
  const canvasRef = useRef(null);
  const companiesCount = usePlanningStore(state => (state.companies || []).length);
  const productsCount = usePlanningStore(state => (state.products || []).length);
  const materialsCount = usePlanningStore(state => (state.materials || []).length);
  const loadAdsData = usePlanningStore(state => state.loadAdsData);
  const syncAdsCatalogFromArchive = usePlanningStore(state => state.syncAdsCatalogFromArchive);
  const syncAdsStoreWithServer = usePlanningStore(state => state.syncAdsStoreWithServer);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);

  useEffect(() => {
    // Hangi sekmede olursa olsun (.80 veya seyare.semerkand.com) açılır açılmaz sunucu DB ile rezervasyonları eşitle
    if (typeof syncAdsStoreWithServer === 'function') {
      syncAdsStoreWithServer();
    }
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
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCanvasScroll = (e) => {
    const scrollTop = e.currentTarget?.scrollTop || 0;
    if (scrollTop > 180 && !showScrollTopBtn) {
      setShowScrollTopBtn(true);
    } else if (scrollTop <= 180 && showScrollTopBtn) {
      setShowScrollTopBtn(false);
    }
  };

  const handleScrollToTop = () => {
    if (canvasRef.current) {
      canvasRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--ads-shell-bg)', position: 'relative' }}>
      <TopNavbar />

      <div className="ads-saas-shell">
        <AdsSidebar activeTab={activeTab} setActiveTab={handleSelectTab} />

        <div
          ref={canvasRef}
          onScroll={handleCanvasScroll}
          className="ads-saas-canvas"
          style={{ position: 'relative' }}
        >
          {/* AKTİF SEKME İÇERİĞİ */}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexShrink: 0 }}>
            {activeTab === 'dashboard' && <DashboardTab setActiveTab={handleSelectTab} />}
            {activeTab === 'reservations' && <ReservationsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'sponsorships' && <SponsorshipsTab setActiveTab={handleSelectTab} />}
            {activeTab === 'planning' && <AdPlanningTab onScrollToTop={handleScrollToTop} />}
            {activeTab === 'ad-bumpers' && <AdBreakBumpersTab />}
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

      {/* TEK TIK İLE EN ÜSTE ÇIKMA BUTONU */}
      <button
        type="button"
        onClick={handleScrollToTop}
        title="Tek Tıkla Sayfanın En Üstüne Çık"
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '24px',
          zIndex: 999,
          padding: '11px 16px',
          borderRadius: '999px',
          border: '2px solid rgba(255, 255, 255, 0.35)',
          background: 'linear-gradient(135deg, #465fff 0%, #7c3aed 100%)',
          color: '#ffffff',
          boxShadow: '0 8px 24px rgba(70, 95, 255, 0.45)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '12.5px',
          fontWeight: '900',
          cursor: 'pointer',
          opacity: showScrollTopBtn ? 1 : 0.85,
          transform: showScrollTopBtn ? 'translateY(0)' : 'translateY(2px)',
          transition: 'all 0.2s ease'
        }}
      >
        <ArrowUp size={16} />
        <span>En Üste Çık</span>
      </button>
    </div>
  );
};

export default AdsReservationModule;
