/**
 * @file src/components/Ads/DashboardTab.jsx
 * @description Reklam & Rezervasyon Modülü 8 Bölümlü + Canlı Operasyon Konsollu Ana Dashboard Koordinatörü.
 *
 * Modüler Alt Bileşenleri (`src/components/Ads/dashboard/`):
 * - `./dashboard/dashboardAnalyticsEngine.js`: Tüm filtrelerle (Platform/Kanal, Dönem: Bugün/7G/30G/3Ay/1Yıl,
 *   Durum: Onay Bekleyen/Aktif/Makegood/Biten/İptal, Sektör, Firma, Arama) entegre analitik ve 7/15/30 gün tahmin motoru.
 * - `./dashboard/DashboardFilterBar.jsx`: Üst global filtreleme ve hızlı aksiyon çubuğu.
 * - `./dashboard/DashboardTopKpiSections.jsx`:
 *   1. Rezervasyon Özeti (Toplam, Aktif, Bekleyen, Tamamlanan, İptal Edilen)
 *   2. Kampanya Yönetimi (Aktif, Başlayacak ve Bitecek Kampanyalar)
 *   3. Yayın Performansı & Makegood (Planlanan 100 spotun kaçının yayınlandığı, Eksik yayın, Telafi/Makegood adedi)
 *   4. Gelir Analizi & Gelir Tahmini (Planlanan/Gerçekleşen gelir, Tahsilat, Kalan alacak, 7/15/30 gün gelir tahmini)
 * - `./dashboard/DashboardMiddleGridSections.jsx`:
 *   5. Reklam Envanteri & 7/15/30 Günlük Doluluk Tahmini (Boş kuşaklar, doluluk oranı, kalan kapasite)
 *   6. Firma, Ürün ve Sektör Analizi (En çok reklam veren firmalar, ürünler, sektörler)
 *   7. Materyal Kontrolü & Geçerliliği (Eksik, onay bekleyen, süresi dolan, teknik hatalı materyaller)
 *   8. Operasyon, Reklam Çakışması ve Uyarılar (Kapasite üzeri çakışan kuşaklar, yaklaşan ve eksik yayınlar)
 * - `./dashboard/DashboardOperationsTable.jsx`: Alt bölümde operasyon ekibinin doğrudan durum değiştirme,
 *   Makegood (telafi yayını) tanımlama, tahsilat girişi ve materyal teknik onayı yapabileceği canlı tablo.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import usePlanningStore from '../../store/planningStore';
import useDialogStore from '../../store/dialogStore';
import AdsReservationForm from './AdsReservationForm';
import AdVideoPlayer from './AdVideoPlayer';
import { computeDashboardAnalytics } from './dashboard/dashboardAnalyticsEngine';
import DashboardFilterBar from './dashboard/DashboardFilterBar';
import DashboardTopKpiSections from './dashboard/DashboardTopKpiSections';
import DashboardMiddleGridSections from './dashboard/DashboardMiddleGridSections';
import DashboardOperationsTable from './dashboard/DashboardOperationsTable';
import DashboardPricingPanel from './dashboard/DashboardPricingPanel';

const INITIAL_FILTERS = {
  channelFilter: 'all',
  periodFilter: '30d',
  statusFilter: 'all',
  sectorFilter: 'all',
  companyFilter: 'all',
  searchQuery: ''
};

const DashboardTab = ({ setActiveTab }) => {
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const reservations = usePlanningStore(state => state.reservations || []);
  const timeBlocks = usePlanningStore(state => state.timeBlocks || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const adsPricingConfig = usePlanningStore(state => state.adsPricingConfig || {});
  const updateAdsPricingConfig = usePlanningStore(state => state.updateAdsPricingConfig);
  const applyPricingTariffToReservations = usePlanningStore(state => state.applyPricingTariffToReservations);
  const syncAdsStoreWithServer = usePlanningStore(state => state.syncAdsStoreWithServer);
  const updateReservation = usePlanningStore(state => state.updateReservation);
  const removeReservation = usePlanningStore(state => state.removeReservation);
  const updateMaterial = usePlanningStore(state => state.updateMaterial);
  const autoPlanAdsForDay = usePlanningStore(state => state.autoPlanAdsForDay);
  const autoPlanAdsForWeek = usePlanningStore(state => state.autoPlanAdsForWeek);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);

  useEffect(() => {
    if (typeof syncAdsStoreWithServer === 'function') {
      syncAdsStoreWithServer();
    }
  }, [syncAdsStoreWithServer]);

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const opsTableRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleUpdateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.channelFilter !== 'all') count++;
    if (filters.periodFilter !== '30d') count++;
    if (filters.statusFilter !== 'all') count++;
    if (filters.sectorFilter !== 'all') count++;
    if (filters.companyFilter !== 'all') count++;
    if (filters.searchQuery.trim() !== '') count++;
    return count;
  }, [filters]);

  // Tüm 8 bölümün ve 6 ek özelliğin filtrelerle senkronize hesaplanması
  const analytics = useMemo(() => {
    return computeDashboardAnalytics({
      reservations,
      companies,
      products,
      materials,
      timeBlocks,
      adPlacements,
      adsPricingConfig,
      filters
    });
  }, [reservations, companies, products, materials, timeBlocks, adPlacements, adsPricingConfig, filters]);

  // Operasyon Tablosuna Kaydır
  const handleScrollToOpsTable = () => {
    if (opsTableRef.current) {
      opsTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Doğrudan Makegood (Telafi Yayını) Planlama
  const handleScheduleMakegood = (res, missingCount) => {
    if (!res || missingCount <= 0) return;
    const prevMakegood = Number(res.makegoodSpots) || 0;
    const nextMakegood = prevMakegood + missingCount;
    const nextRealized = (Number(res.realizedSpots) || res.effectiveRealized || 0) + missingCount;

    if (updateReservation) {
      updateReservation(res.id, {
        makegoodSpots: nextMakegood,
        realizedSpots: nextRealized,
        status: 'active'
      });
    }
    const targetChannel = (res.allChannelIds && res.allChannelIds[0]) || 'ch_hd';
    if (autoPlanAdsForWeek) {
      autoPlanAdsForWeek(targetChannel, res.startDate || analytics.todayStr);
    }
    showToast(`🔄 "${res.companyName}" için +${missingCount} adet Makegood (Telafi Spotu) tanımlandı ve kuşaklara dağıtıldı.`);
  };

  // Rezervasyonu Haftalık Kuşaklara Otomatik Dağıt
  const handleAutoDistributeReservation = (res) => {
    if (!res) return;
    const targetChannel = (res.allChannelIds && res.allChannelIds[0]) || 'ch_hd';
    if (autoPlanAdsForWeek) {
      autoPlanAdsForWeek(targetChannel, res.startDate || analytics.todayStr);
    }
    showToast(`⚡ "${res.companyName}" rezervasyonu ${targetChannel === 'ch_way' ? 'Semerkand WAY' : 'Semerkand HD'} kuşaklarına dağıtıldı.`);
  };

  // Çakışan Kuşağı Otomatik Dengele
  const handleQuickFixConflict = (conflict) => {
    if (!conflict) return;
    if (autoPlanAdsForDay) {
      autoPlanAdsForDay(conflict.channelId || 'ch_hd', conflict.date);
    }
    showToast(`🛠️ ${conflict.channelLabel} (${conflict.date} • ${conflict.time}) kuşağı 6 aşamalı algoritma ile yeniden dengelendi.`);
  };

  // Materyal Hızlı Onay
  const handleQuickApproveMaterial = (matId) => {
    if (!matId || !updateMaterial) return;
    updateMaterial(matId, {
      validityStatus: 'approved',
      approvalStatus: 'approved',
      technicalStatus: 'ok'
    });
    showToast('✅ Materyal teknik kontrol ve yayın onayı tamamlandı.');
  };

  // Rezervasyon Silme Onayı
  const handleDeleteReservation = (resId) => {
    useDialogStore
      .getState()
      .showConfirm(
        'Rezervasyonu Sil',
        'Bu rezervasyonu ve bağlı reklam kuşağı spotlarını silmek istediğinize emin misiniz?',
        () => {
          if (removeReservation) removeReservation(resId);
          showToast('🗑️ Rezervasyon silindi.');
        }
      );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '24px' }}>
      {/* Canlı Operasyon Bildirimi (Toast) */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
            fontSize: '12.5px',
            fontWeight: '700',
            zIndex: 9999
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* ÜST GLOBAL FİLTRE ÇUBUĞU (Platform/Kanal, Dönem: Bugün/7G/30G/3Ay/1Yıl, Durumlar, Sektör, Firma, Arama) */}
      <DashboardFilterBar
        filters={filters}
        onUpdateFilter={handleUpdateFilter}
        onResetFilters={handleResetFilters}
        companies={companies}
        sectors={analytics.allAvailableSectors}
        activeFiltersCount={activeFiltersCount}
        onNavigateTab={setActiveTab}
        onOpenNewReservation={() => {
          setEditingReservation(null);
          setIsFormOpen(true);
        }}
      />

      {/* BÖLÜM 1, 2, 3 VE 4: REZERVASYON ÖZETİ, KAMPANYA YÖNETİMİ, YAYIN PERFORMANSI (+MAKEGOOD) VE GELİR ANALİZİ */}
      <DashboardTopKpiSections
        reservationSummary={analytics.reservationSummary}
        campaignSummary={analytics.campaignSummary}
        broadcastPerformance={analytics.broadcastPerformance}
        revenueAnalytics={analytics.revenueAnalytics}
        statusFilter={filters.statusFilter}
        onSelectStatusFilter={st => handleUpdateFilter('statusFilter', st)}
        onNavigateTab={setActiveTab}
        onScrollToOpsTable={handleScrollToOpsTable}
      />

      {/* DOĞRUDAN SPOT ADEDİ, BİRİM ÜCRET, BÜTÇE VE TAHSİLAT VERİ GİRİŞ PANELİ */}
      <DashboardPricingPanel
        reservations={analytics.filteredReservations}
        adsPricingConfig={adsPricingConfig}
        onUpdatePricingConfig={updateAdsPricingConfig}
        onApplyTariffToReservations={applyPricingTariffToReservations}
        onUpdateReservation={(id, patch) => {
          if (updateReservation) updateReservation(id, patch);
        }}
        onSyncWithServer={syncAdsStoreWithServer}
        onNavigateReports={setActiveTab}
        onShowToast={showToast}
      />

      {/* BÖLÜM 5, 6, 7 VE 8: REKLAM ENVANTERİ (7/15/30G TAHMİN), FİRMA/ÜRÜN/SEKTÖR, MATERYAL KONTROLÜ VE OPERASYON UYARILARI */}
      <DashboardMiddleGridSections
        inventoryAnalytics={analytics.inventoryAnalytics}
        companyProductSectorAnalytics={analytics.companyProductSectorAnalytics}
        materialControlAnalytics={analytics.materialControlAnalytics}
        operationsAlertsAnalytics={analytics.operationsAlertsAnalytics}
        onNavigateTab={setActiveTab}
        onSelectCompanyDetail={compId => {
          if (setSelectedCompanyDetailId) setSelectedCompanyDetailId(compId);
          if (setActiveTab) setActiveTab('company-details');
        }}
        onQuickApproveMaterial={handleQuickApproveMaterial}
        onQuickFixConflict={handleQuickFixConflict}
        onSelectSectorFilter={sec =>
          handleUpdateFilter('sectorFilter', filters.sectorFilter === sec ? 'all' : sec)
        }
      />

      {/* ALT BÖLÜM: OPERASYON EKİBİNİN DOĞRUDAN İŞLEM YAPABİLECEĞİ CANLI TABLO */}
      <div ref={opsTableRef}>
        <DashboardOperationsTable
          reservations={analytics.filteredReservations}
          materials={analytics.materialControlAnalytics.attentionMaterials}
          onUpdateReservation={(id, patch) => {
            if (updateReservation) updateReservation(id, patch);
            showToast('✅ Rezervasyon durumu güncellendi.');
          }}
          onDeleteReservation={handleDeleteReservation}
          onEditReservation={res => {
            setEditingReservation(res);
            setIsFormOpen(true);
          }}
          onScheduleMakegood={handleScheduleMakegood}
          onAutoDistributeReservation={handleAutoDistributeReservation}
          onUpdateMaterial={(id, patch) => {
            if (updateMaterial) updateMaterial(id, patch);
            showToast('✅ Materyal geçerlilik ve teknik onay durumu güncellendi.');
          }}
          onPreviewMaterial={mat => setPreviewMaterial(mat)}
          onOpenNewReservation={() => {
            setEditingReservation(null);
            setIsFormOpen(true);
          }}
        />
      </div>

      {/* Yeni / Düzenle Rezervasyon Formu Modalı */}
      {isFormOpen && (
        <AdsReservationForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingReservation(null);
          }}
          editingReservation={editingReservation}
        />
      )}

      {/* Reklam Klibi Video Önizleme Modalı */}
      {previewMaterial && (
        <AdVideoPlayer
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
        />
      )}
    </div>
  );
};

export default DashboardTab;
