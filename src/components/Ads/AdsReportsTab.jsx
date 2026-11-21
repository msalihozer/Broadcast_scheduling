/**
 * @file src/components/Ads/AdsReportsTab.jsx
 * @description Profesyonel Reklam Rezervasyon Raporları Sekmesi.
 * Hangi reklam (materyal) kaç defa, toplam kaç saniye/dakika, günde ortalama/min/maks kaç defa,
 * hangi saatlerde ve hangi kuşaklarda (Sabah, Öğle, Akşam Prime Time, Gece) yayınlandığını
 * detaylı tablolar, grafiksel barlar ve Excel/CSV çıktısı ile sunar.
 */
import React, { useState, useMemo } from 'react';
import {
  FileBarChart2,
  Search,
  Download,
  RotateCcw,
  Film,
  Building2,
  Clock,
  Calendar,
  TrendingUp,
  Layers,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Filter,
  FileText,
  FileSpreadsheet,
  Package,
  Wallet
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import { computeAdsAnalyticsReport } from '../../modules/ads/utils/adsAutoSyncEngine';
import {
  exportToCSV,
  exportToExcel,
  exportToPresentationPDF,
  formatSecondsToHoursMin
} from '../../utils/reportExportUtils';

const KUŞAK_BADGE_STYLES = {
  'Sabah Kuşağı': { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.35)', color: '#fbbf24' },
  'Öğle Kuşağı': { bg: 'rgba(59, 130, 246, 0.14)', border: 'rgba(59, 130, 246, 0.35)', color: '#60a5fa' },
  'Akşam (Prime Time)': { bg: 'rgba(139, 92, 246, 0.18)', border: 'rgba(139, 92, 246, 0.45)', color: '#c084fc' },
  'Gece Kuşağı': { bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', color: '#34d399' }
};

function formatDurationReadable(totalSec = 0) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  if (sec < 60) return `${sec} sn`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) {
    return s > 0 ? `${sec} sn (${m} dk ${s} sn)` : `${sec} sn (${m} dk)`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${sec.toLocaleString('tr-TR')} sn (${h} sa ${remM} dk)`;
}

const AdsReportsTab = ({ setActiveTab }) => {
  const companies = usePlanningStore(state => state.companies || []);
  const products = usePlanningStore(state => state.products || []);
  const materials = usePlanningStore(state => state.materials || []);
  const reservations = usePlanningStore(state => state.reservations || []);
  const adPlacements = usePlanningStore(state => state.adPlacements || {});
  const adsPricingConfig = usePlanningStore(state => state.adsPricingConfig || {});
  const updateReservation = usePlanningStore(state => state.updateReservation);
  const channels = usePlanningStore(state => state.channels || []);
  const timeBlocks = usePlanningStore(state => state.timeBlocks || []);
  const setSelectedCompanyDetailId = usePlanningStore(state => state.setSelectedCompanyDetailId);
  const setSelectedMaterialDetailId = usePlanningStore(state => state.setSelectedMaterialDetailId);
  const regenerateSampleAdPlacements = usePlanningStore(state => state.regenerateSampleAdPlacements);

  // 'material' | 'product' | 'company' | 'plans' | 'periods' | 'daily' | 'timeblocks' | 'logs'
  const [reportView, setReportView] = useState('material');
  const [filters, setFilters] = useState({
    companyId: '',
    productId: '',
    materialId: '',
    channelId: '',
    timeBlockId: '',
    startDate: '',
    endDate: '',
    searchQuery: ''
  });

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  const filteredProducts = useMemo(() => {
    const list = filters.companyId
      ? products.filter(p => String(p.companyId) === String(filters.companyId))
      : products;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  }, [products, filters.companyId]);

  const filteredMaterialsList = useMemo(() => {
    let list = materials;
    if (filters.companyId) {
      list = list.filter(m => String(m.companyId) === String(filters.companyId));
    }
    if (filters.productId) {
      list = list.filter(m => String(m.productId) === String(filters.productId));
    }
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  }, [materials, filters.companyId, filters.productId]);

  const reportData = useMemo(
    () =>
      computeAdsAnalyticsReport({
        companies,
        products,
        materials,
        reservations,
        adPlacements,
        channels,
        timeBlocks,
        adsPricingConfig,
        filters
      }),
    [companies, products, materials, reservations, adPlacements, channels, timeBlocks, adsPricingConfig, filters]
  );

  const {
    summary,
    materialReports = [],
    productReports = [],
    companyReports = [],
    planReports = [],
    periodReports = { weekly: [], monthly: [], yearly: [] },
    dailyReports = [],
    timeBlockReports = [],
    hourlyReports = [],
    spotLogs = []
  } = reportData;

  const resetFilters = () => {
    setFilters({
      companyId: '',
      productId: '',
      materialId: '',
      channelId: '',
      timeBlockId: '',
      startDate: '',
      endDate: '',
      searchQuery: ''
    });
  };

  const openMaterialAndCompanyDetail = (companyId, materialId = null) => {
    if (companyId) setSelectedCompanyDetailId(companyId);
    if (materialId) setSelectedMaterialDetailId(materialId);
    if (setActiveTab) setActiveTab('company-details');
  };

  const selectedCompanyObj = useMemo(
    () => companies.find(c => String(c.id) === String(filters.companyId)),
    [companies, filters.companyId]
  );
  const selectedProductObj = useMemo(
    () => products.find(p => String(p.id) === String(filters.productId)),
    [products, filters.productId]
  );
  const selectedMaterialObj = useMemo(
    () => materials.find(m => String(m.id) === String(filters.materialId)),
    [materials, filters.materialId]
  );

  const getScopeTitle = () => {
    const parts = [];
    if (selectedCompanyObj) parts.push(`Firma: ${selectedCompanyObj.name}`);
    if (selectedProductObj) parts.push(`Ürün: ${selectedProductObj.name}`);
    if (selectedMaterialObj) parts.push(`Materyal: ${selectedMaterialObj.name}`);
    if (filters.startDate || filters.endDate) {
      parts.push(`Tarih: ${filters.startDate || '*'} – ${filters.endDate || '*'}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'Tüm Firmalar, Ürünler ve Materyaller (Genel Rapor)';
  };

  const handleExportCSV = () => {
    const scopeSuffix = selectedMaterialObj
      ? `_${selectedMaterialObj.name}`
      : selectedProductObj
      ? `_${selectedProductObj.name}`
      : selectedCompanyObj
      ? `_${selectedCompanyObj.name}`
      : '';

    if (reportView === 'company') {
      exportToCSV({
        filename: `Reklam_Firma_Bazli_Rapor${scopeSuffix}`,
        headers: [
          'Firma Adı',
          'Ürün Sayısı',
          'Materyal Sayısı',
          'Toplam Yayın (Spot)',
          'Toplam Süre (sn)',
          'Toplam Süre (Saat)',
          'Hangi Gün Kaç Defa Yayınlandı',
          'Haftalık Yayın',
          'Aylık Yayın',
          'Yıllık Yayın',
          'Toplam Tutar (₺)'
        ],
        rows: companyReports.map(c => [
          c.companyName,
          c.productsCount,
          c.materialsCount,
          c.totalSpots,
          c.totalDurationSec,
          formatSecondsToHoursMin(c.totalDurationSec),
          c.dayOfWeekBreakdown,
          c.weeksBreakdown,
          c.monthsBreakdown,
          c.yearsBreakdown,
          c.totalRevenue > 0 ? `${c.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
        ])
      });
      return;
    }

    if (reportView === 'product') {
      exportToCSV({
        filename: `Reklam_Urun_Bazli_Rapor${scopeSuffix}`,
        headers: [
          'Ürün / Kampanya Adı',
          'Firma',
          'Materyal Sayısı',
          'Toplam Yayın (Spot)',
          'Toplam Süre (sn)',
          'Hangi Gün Kaç Defa',
          'Haftalık Dağılım',
          'Aylık Dağılım',
          'Yıllık Dağılım',
          'Toplam Tutar (₺)'
        ],
        rows: productReports.map(p => [
          p.productName,
          p.companyName,
          p.materialsCount,
          p.totalSpots,
          p.totalDurationSec,
          p.dayOfWeekBreakdown,
          p.weeksBreakdown,
          p.monthsBreakdown,
          p.yearsBreakdown,
          p.totalRevenue > 0 ? `${p.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
        ])
      });
      return;
    }

    if (reportView === 'plans') {
      exportToCSV({
        filename: `Reklam_Spot_ve_Ucretlendirme_Raporu${scopeSuffix}`,
        headers: [
          'Plan / Kampanya Adı',
          'Firma',
          'Başlangıç - Bitiş',
          'Planlanan Spot',
          'Gerçekleşen Spot',
          'Fark / Aşım (-)',
          'Kullanım Oranı (%)',
          'Birim Spot Fiyatı (₺)',
          'Planlanan Bütçe (₺)',
          'Gerçekleşen Tutar (₺)',
          'Tahsil Edilen (₺)',
          'Kalan Alacak (₺)'
        ],
        rows: planReports.map(pr => [
          pr.name,
          pr.companyName,
          `${pr.startDate} - ${pr.endDate}`,
          pr.plannedSpots,
          pr.realizedSpots,
          pr.spotDiff,
          `%${pr.usagePct}`,
          pr.unitPrice,
          pr.plannedBudget,
          pr.realizedBudget,
          pr.collectedAmount || 0,
          pr.remainingReceivable || 0
        ])
      });
      return;
    }

    exportToCSV({
      filename: `Reklam_Materyal_Bazli_Rapor${scopeSuffix}`,
      headers: [
        'Reklam Materyali',
        'Klip Kodu',
        'Klip ID',
        'Firma',
        'Ürün / Kampanya',
        'Birim Süre (sn)',
        'Toplam Yayın (Kaç Defa)',
        'Toplam Süre (Saniye)',
        'Hangi Gün Kaç Defa Yayınlandı',
        'Haftalık Yayın',
        'Aylık Yayın',
        'Yıllık Yayın',
        'Birim Spot Ücreti (₺)',
        'Toplam Tutar (₺)',
        'Yayınlandığı Kuşaklar',
        'Yayınlandığı Saatler'
      ],
      rows: materialReports.map(m => [
        m.materialName,
        m.clipName,
        `#${m.clipId}`,
        m.companyName,
        m.productName,
        m.unitDurationSec,
        m.totalSpots,
        m.totalDurationSec,
        m.dayOfWeekBreakdown,
        m.weeksBreakdown,
        m.monthsBreakdown,
        m.yearsBreakdown,
        m.unitPrice > 0 ? `${m.unitPrice} ₺` : '-',
        m.totalRevenue > 0 ? `${m.totalRevenue.toLocaleString('tr-TR')} ₺` : '-',
        m.timeBlocksBreakdown.map(tb => `${tb.name} (${tb.count})`).join(' | '),
        m.sortedHours.join(', ')
      ])
    });
  };

  const handleExportExcel = () => {
    const scopeSuffix = selectedMaterialObj
      ? `_${selectedMaterialObj.name}`
      : selectedProductObj
      ? `_${selectedProductObj.name}`
      : selectedCompanyObj
      ? `_${selectedCompanyObj.name}`
      : '';

    exportToExcel({
      filename: `Reklam_Rezervasyon_Detayli_Rapor${scopeSuffix}`,
      title: `REKLAM REZERVASYON & MEDYA TAKİP DETAYLI RAPORU`,
      subtitle: getScopeTitle(),
      kpis: [
        { label: 'Toplam Yayınlanan Spot', value: `${summary.totalSpotsCount} Spot` },
        { label: 'Toplam Yayın Süresi', value: `${summary.totalBroadcastSec.toLocaleString('tr-TR')} sn (${formatSecondsToHoursMin(summary.totalBroadcastSec)})` },
        { label: 'Aktif Firma & Ürün', value: `${summary.activeCompaniesCount} Firma / ${summary.activeProductsCount} Ürün` },
        { label: 'Aktif Materyal (Spot)', value: `${summary.activeMaterialsCount} Klip` },
        { label: 'Hesaplanan Yayın Tutarı', value: summary.totalRevenue > 0 ? `${summary.totalRevenue.toLocaleString('tr-TR')} ₺` : 'Spot Bazlı' }
      ],
      sections: [
        {
          title: '1. MATERYAL (SPOT KLİP) BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK YAYINLANMA RAPORU',
          headers: [
            'Materyal Adı',
            'Klip Kodu',
            'Firma',
            'Ürün',
            'Süre (sn)',
            'Kaç Defa Yayınlandı',
            'Toplam Süre',
            'Hangi Gün Kaç Defa',
            'Haftalık / Aylık / Yıllık Dağılım',
            'Birim Fiyat / Toplam Tutar',
            'Kuşaklar'
          ],
          rows: materialReports.map(m => [
            m.materialName,
            m.clipName,
            m.companyName,
            m.productName,
            `${m.unitDurationSec} sn`,
            `${m.totalSpots} Defa`,
            formatSecondsToHoursMin(m.totalDurationSec),
            m.dayOfWeekBreakdown,
            `Hafta: ${m.weeksBreakdown} | Ay: ${m.monthsBreakdown} | Yıl: ${m.yearsBreakdown}`,
            m.totalRevenue > 0 ? `${m.unitPrice} ₺ / ${m.totalRevenue.toLocaleString('tr-TR')} ₺` : '-',
            m.timeBlocksBreakdown.map(tb => `${tb.name}: ${tb.count}`).join(', ')
          ])
        },
        {
          title: '2. FİRMA BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK YAYINLANMA RAPORU',
          headers: ['Firma Adı', 'Ürün / Materyal', 'Toplam Spot', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Haftalık', 'Aylık', 'Yıllık', 'Toplam Tutar (₺)'],
          rows: companyReports.map(c => [
            c.companyName,
            `${c.productsCount} Ürün / ${c.materialsCount} Spot`,
            `${c.totalSpots} Defa`,
            formatSecondsToHoursMin(c.totalDurationSec),
            c.dayOfWeekBreakdown,
            c.weeksBreakdown,
            c.monthsBreakdown,
            c.yearsBreakdown,
            c.totalRevenue > 0 ? `${c.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
          ])
        },
        {
          title: '3. ÜRÜN / KAMPANYA BAZLI YAYINLANMA RAPORU',
          headers: ['Ürün Adı', 'Firma', 'Materyal Sayısı', 'Toplam Spot', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Haftalık / Aylık / Yıllık', 'Toplam Tutar (₺)'],
          rows: productReports.map(p => [
            p.productName,
            p.companyName,
            `${p.materialsCount} Materyal`,
            `${p.totalSpots} Defa`,
            formatSecondsToHoursMin(p.totalDurationSec),
            p.dayOfWeekBreakdown,
            `${p.weeksBreakdown} | ${p.monthsBreakdown} | ${p.yearsBreakdown}`,
            p.totalRevenue > 0 ? `${p.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
          ])
        },
        {
          title: '4. YAYIN PLANI, SPOT KULLANIMI VE ÜCRETLENDİRME / TAHSİLAT RAPORU',
          headers: ['Plan Adı', 'Firma', 'Tarih Aralığı', 'Planlanan Spot', 'Gerçekleşen Spot', 'Kalan / Aşım (-)', 'Kullanım %', 'Birim Spot Ücreti', 'Planlanan Bütçe', 'Gerçekleşen Tutar', 'Tahsil Edilen', 'Kalan Alacak'],
          rows: planReports.map(pr => [
            pr.name,
            pr.companyName,
            `${pr.startDate} – ${pr.endDate}`,
            `${pr.plannedSpots} Spot`,
            `${pr.realizedSpots} Spot`,
            `${pr.spotDiff} Spot`,
            `%${pr.usagePct}`,
            pr.unitPrice > 0 ? `${pr.unitPrice.toLocaleString('tr-TR')} ₺` : '-',
            pr.plannedBudget > 0 ? `${pr.plannedBudget.toLocaleString('tr-TR')} ₺` : '-',
            pr.realizedBudget > 0 ? `${pr.realizedBudget.toLocaleString('tr-TR')} ₺` : '-',
            (pr.collectedAmount || 0) > 0 ? `${(pr.collectedAmount || 0).toLocaleString('tr-TR')} ₺` : '0 ₺',
            (pr.remainingReceivable || 0) > 0 ? `${(pr.remainingReceivable || 0).toLocaleString('tr-TR')} ₺` : '0 ₺'
          ])
        }
      ]
    });
  };

  const handleExportPDF = () => {
    exportToPresentationPDF({
      title: selectedCompanyObj
        ? `${selectedCompanyObj.name} — KURUMSAL REKLAM & MEDYA TAKİP SUNUMU`
        : `REKLAM REZERVASYON & MEDYA TAKİP YÖNETİM SUNUMU`,
      subtitle: getScopeTitle(),
      badgeText: 'REKLAM REZERVASYON & MEDYA ANALİTİK MERKEZİ',
      accentColor: '#0066ff',
      kpis: [
        { label: 'Toplam Yayınlanan Spot', value: `${summary.totalSpotsCount} Spot`, sub: `${summary.totalBroadcastDays} Yayın Günü` },
        { label: 'Toplam Yayın Süresi', value: formatSecondsToHoursMin(summary.totalBroadcastSec), sub: `${summary.totalBroadcastSec.toLocaleString('tr-TR')} Saniye`, color: '#0d9488' },
        { label: 'Aktif Firma & Ürün', value: `${summary.activeCompaniesCount} Firma`, sub: `${summary.activeProductsCount} Ürün • ${summary.activeMaterialsCount} Materyal`, color: '#8b5cf6' },
        { label: 'Günlük Ortalama Yayın', value: `${summary.avgSpotsPerDay} Spot/Gün`, sub: `${summary.avgSecPerDay} sn/gün`, color: '#d97706' },
        { label: 'Hesaplanan Yayın Tutarı', value: summary.totalRevenue > 0 ? `${summary.totalRevenue.toLocaleString('tr-TR')} ₺` : 'Spot Kotası', sub: 'Plan & Birim Ücret Bazlı', color: '#059669' }
      ],
      highlightCards: [
        {
          title: 'Dönemsel (Haftalık / Aylık / Yıllık) Yayın Özeti',
          body:
            `Haftalık: ${periodReports.weekly.map(w => `${w.label} (${w.spots} spot)`).join(', ') || '-'} | ` +
            `Aylık: ${periodReports.monthly.map(m => `${m.label} (${m.spots} spot)`).join(', ') || '-'} | ` +
            `Yıllık: ${periodReports.yearly.map(y => `${y.label} (${y.spots} spot)`).join(', ') || '-'}`
        },
        {
          title: 'Kuşak Dağılım Özeti',
          body: timeBlockReports.map(tb => `${tb.timeBlockName}: ${tb.totalSpots} Spot (%${tb.sharePercentage})`).join(' • ') || '-'
        }
      ],
      sections: [
        {
          title: '1. Materyal (Reklam Spotu) Bazlı Günlük, Haftalık, Aylık ve Yıllık Yayın Raporu',
          description: 'Hangi reklamın hangi gün, hafta, ay ve yılda kaçar defa yayınlandığı, süre ve fiyat özeti.',
          headers: ['Materyal & Kod', 'Firma & Ürün', 'Toplam Spot', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Hafta / Ay / Yıl Dağılımı', 'Tutar (₺)'],
          rows: materialReports.map(m => [
            `${m.materialName} (${m.clipName})`,
            `${m.companyName} • ${m.productName}`,
            `${m.totalSpots} Defa`,
            formatSecondsToHoursMin(m.totalDurationSec),
            m.dayOfWeekBreakdown,
            `H: ${m.weeksBreakdown} | A: ${m.monthsBreakdown} | Y: ${m.yearsBreakdown}`,
            m.totalRevenue > 0 ? `${m.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
          ])
        },
        {
          title: '2. Firma Bazlı Yayınlanma Raporu',
          headers: ['Firma Adı', 'Ürün / Materyal', 'Toplam Spot', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Aylık / Yıllık', 'Toplam Tutar (₺)'],
          rows: companyReports.map(c => [
            c.companyName,
            `${c.productsCount} Ürün / ${c.materialsCount} Materyal`,
            `${c.totalSpots} Defa`,
            formatSecondsToHoursMin(c.totalDurationSec),
            c.dayOfWeekBreakdown,
            `${c.monthsBreakdown} | ${c.yearsBreakdown}`,
            c.totalRevenue > 0 ? `${c.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
          ])
        },
        {
          title: '3. Ürün Bazlı Yayınlanma Raporu',
          headers: ['Ürün Adı', 'Firma', 'Materyal', 'Toplam Spot', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Toplam Tutar (₺)'],
          rows: productReports.map(p => [
            p.productName,
            p.companyName,
            `${p.materialsCount} Klip`,
            `${p.totalSpots} Defa`,
            formatSecondsToHoursMin(p.totalDurationSec),
            p.dayOfWeekBreakdown,
            p.totalRevenue > 0 ? `${p.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
          ])
        },
        {
          title: '4. Yayın Planı, Spot Kullanımı ve Ücretlendirme / Tahsilat Raporu',
          headers: ['Plan Adı', 'Firma', 'Tarih Aralığı', 'Planlanan', 'Gerçekleşen', 'Fark / Aşım (-)', 'Birim Ücret', 'Planlanan Bütçe', 'Gerçekleşen Tutar', 'Tahsilat / Kalan'],
          rows: planReports.map(pr => [
            pr.name,
            pr.companyName,
            `${pr.startDate} – ${pr.endDate}`,
            `${pr.plannedSpots} Spot`,
            `${pr.realizedSpots} Spot`,
            `${pr.spotDiff} Spot (%${pr.usagePct})`,
            pr.unitPrice > 0 ? `${pr.unitPrice.toLocaleString('tr-TR')} ₺` : '-',
            pr.plannedBudget > 0 ? `${pr.plannedBudget.toLocaleString('tr-TR')} ₺` : '-',
            pr.realizedBudget > 0 ? `${pr.realizedBudget.toLocaleString('tr-TR')} ₺` : '-',
            `Tahsil: ${(pr.collectedAmount || 0).toLocaleString('tr-TR')} ₺ / Kalan: ${(pr.remainingReceivable || 0).toLocaleString('tr-TR')} ₺`
          ])
        }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* KOMPAKT SaaS ANALİTİK TOOLBAR */}
      <div className="ads-saas-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(0,102,255,0.1)', color: '#0066ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileBarChart2 size={16} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text)' }}>Medya Takip Raporları</span>
          </div>

          <div className="ads-saas-search">
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Spot, klip kodu, firma, saat ara..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            />
          </div>

          <select
            className="ads-saas-select"
            value={filters.companyId}
            onChange={e => setFilters(prev => ({ ...prev, companyId: e.target.value, productId: '', materialId: '' }))}
          >
            <option value="">Tüm Firmalar ({companies.length})</option>
            {sortedCompanies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="ads-saas-select"
            value={filters.productId}
            onChange={e => setFilters(prev => ({ ...prev, productId: e.target.value, materialId: '' }))}
          >
            <option value="">Tüm Ürünler ({filteredProducts.length})</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className="ads-saas-select"
            value={filters.materialId}
            onChange={e => setFilters(prev => ({ ...prev, materialId: e.target.value }))}
          >
            <option value="">Tüm Materyaller ({filteredMaterialsList.length})</option>
            {filteredMaterialsList.map(m => (
              <option key={m.id} value={m.id}>{m.name} (#{m.clipId})</option>
            ))}
          </select>

          <select
            className="ads-saas-select"
            value={filters.timeBlockId}
            onChange={e => setFilters(prev => ({ ...prev, timeBlockId: e.target.value }))}
          >
            <option value="">Tüm Kuşaklar</option>
            <option value="Sabah Kuşağı">Sabah Kuşağı (06-12)</option>
            <option value="Öğle Kuşağı">Öğle Kuşağı (12-18)</option>
            <option value="Akşam (Prime Time)">Prime Time (18-24)</option>
            <option value="Gece Kuşağı">Gece Kuşağı (00-06)</option>
          </select>

          <input
            type="date"
            className="ads-saas-select"
            value={filters.startDate}
            onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            title="Başlangıç Tarihi"
          />
          <input
            type="date"
            className="ads-saas-select"
            value={filters.endDate}
            onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            title="Bitiş Tarihi"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={resetFilters} className="ads-saas-btn">
            <RotateCcw size={13} /> Sıfırla
          </button>
          <button
            onClick={handleExportPDF}
            className="ads-saas-btn"
            style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c', fontWeight: 800 }}
            title="Seçili Firma / Ürün / Materyal veya Genel Rapor için PDF Sunum Çıktısı"
          >
            <FileText size={14} /> PDF (Sunum)
          </button>
          <button
            onClick={handleExportExcel}
            className="ads-saas-btn"
            style={{ background: '#059669', color: '#fff', borderColor: '#047857', fontWeight: 800 }}
            title="Seçili Firma / Ürün / Materyal veya Genel Rapor için Excel (.xls) Çıktısı"
          >
            <FileSpreadsheet size={14} /> Excel (.xls)
          </button>
          <button
            onClick={handleExportCSV}
            className="ads-saas-btn primary"
            title="Aktif Sekme ve Filtreye Özel CSV Çıktısı"
          >
            <Download size={14} /> CSV İndir
          </button>
        </div>
      </div>

      {/* 6 PROFESYONEL KPI ÖZET KARTI (SPOT & ÜCRETLENDİRME DAHİL) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
          gap: '10px',
          flexShrink: 0
        }}
      >
        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Yayın</span>
            <CheckCircle2 size={15} color="#0066ff" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ads-text)' }}>
            {summary.totalSpotsCount.toLocaleString('tr-TR')} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot ({summary.totalBroadcastDays} gün)</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Süre</span>
            <Clock size={15} color="#0d9488" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0d9488' }}>
            {summary.totalBroadcastSec.toLocaleString('tr-TR')} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>sn ({summary.totalBroadcastMin} dk)</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Günlük Ortalama</span>
            <Calendar size={15} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b' }}>
            {summary.avgSpotsPerDay} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot/Gün</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Aktif Spot & Firma</span>
            <Film size={15} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#8b5cf6' }}>
            {summary.activeMaterialsCount} <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--ads-text-muted)' }}>Spot • {summary.activeCompaniesCount} Firma</span>
          </div>
        </div>

        <div
          className="ads-saas-card"
          onClick={() => setReportView('plans')}
          style={{
            padding: '12px 14px',
            gap: '4px',
            cursor: 'pointer',
            border: '1.5px solid rgba(5, 150, 105, 0.45)',
            background: 'rgba(16, 185, 129, 0.06)'
          }}
          title="Spot & Ücretlendirme Detay Tablosunu Aç"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#059669' }}>💰 Spot &amp; Ücretlendirme</span>
            <Wallet size={15} color="#059669" />
          </div>
          <div style={{ fontSize: '17px', fontWeight: '900', color: '#059669' }}>
            ₺{(summary.totalPlannedBudget || summary.totalRevenue || 0).toLocaleString('tr-TR')}
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
            Gerçekleşen: ₺{(summary.totalRealizedBudget || 0).toLocaleString('tr-TR')} • Tahsil: ₺{(summary.totalCollectedAmount || 0).toLocaleString('tr-TR')}
          </div>
        </div>

        <div className="ads-saas-card" style={{ padding: '12px 14px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>En Yoğun Kuşak</span>
            <TrendingUp size={15} color="#ec4899" />
          </div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#ec4899', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary.topTimeBlock ? `${summary.topTimeBlock.timeBlockName} (%${summary.topTimeBlock.sharePercentage})` : '-'}
          </div>
        </div>
      </div>

      {/* RAPOR GÖRÜNÜM SEKMELERİ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: '8px' }}>
        <div className="ads-saas-pill-group" style={{ flexWrap: 'wrap' }}>
          {[
            { id: 'material', label: `1. Materyal / Spot Bazlı (${materialReports.length})` },
            { id: 'company', label: `2. Firma Bazlı (${companyReports.length})` },
            { id: 'product', label: `3. Ürün Bazlı (${productReports.length})` },
            { id: 'plans', label: `4. Yayın Planı, Spot & Ücretlendirme (${planReports.length})` },
            { id: 'periods', label: '5. Haftalık / Aylık / Yıllık Analiz' },
            { id: 'daily', label: `6. Günlük & Saat (${dailyReports.length})` },
            { id: 'timeblocks', label: '7. Kuşak & Saat Yoğunluğu' },
            { id: 'logs', label: `8. Tüm Spot Kayıtları (${spotLogs.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setReportView(tab.id)}
              className={`ads-saas-pill-btn ${reportView === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. REKLAM (MATERYAL) BAZLI PROFESYONEL RAPOR */}
      {reportView === 'material' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1250px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Reklam Materyali (Spot) & Klip Kodu
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Firma & Ürün
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Spot Süresi
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Kaç Defa Yayınlandı
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Toplam Kaç Saniye
                  </th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Günde / Haftada / Ayda / Yılda
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Hangi Gün Kaç Defa Yayınlandı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Hangi Kuşaklarda Yayınlandı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Hangi Saatlerde Yayınlandı
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Detay
                  </th>
                </tr>
              </thead>
              <tbody>
                {materialReports.map(m => (
                  <tr
                    key={m.materialId}
                    onClick={() => openMaterialAndCompanyDetail(m.companyId, m.materialId)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139, 92, 246, 0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Materyal Adı & Kodu */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#a78bfa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <Film size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13.5px' }}>
                            {m.materialName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                            #{m.clipId} • {m.clipName || 'Klip Kodu Yok'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Firma & Ürün */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#60a5fa', fontSize: '13px' }}>{m.companyName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{m.productName}</div>
                    </td>

                    {/* Birim Spot Süresi */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: '700',
                          fontSize: '12px',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {m.unitDurationSec} sn
                      </span>
                    </td>

                    {/* Kaç Defa Yayınlandı */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          background: 'rgba(59, 130, 246, 0.14)',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          padding: '6px 14px',
                          borderRadius: '8px'
                        }}
                      >
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#60a5fa' }}>
                          {m.totalSpots} Defa
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {m.activeDaysCount} günde
                        </span>
                      </div>
                    </td>

                    {/* Toplam Kaç Saniye */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', color: '#34d399', fontSize: '14px' }}>
                        {m.totalDurationSec.toLocaleString('tr-TR')} sn
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ({(m.totalDurationSec / 60).toFixed(1)} dk)
                      </div>
                    </td>

                    {/* Günde / Haftada / Ayda / Yılda */}
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', color: '#fbbf24', fontSize: '13px' }}>
                        Günde {m.avgDailySpots} kez
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Hafta: <strong>{m.avgWeeklySpots}</strong> • Ay: <strong>~{m.estMonthlySpots}</strong> • Yıl: <strong>~{m.estYearlySpots}</strong>
                      </div>
                      {m.totalRevenue > 0 && (
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                          {m.totalRevenue.toLocaleString('tr-TR')} ₺
                        </div>
                      )}
                    </td>

                    {/* Hangi Gün Kaç Defa Yayınlandı */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                        {Object.entries(m.dayOfWeekCounts || {}).map(([dName, cnt]) => (
                          <span
                            key={dName}
                            style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#60a5fa'
                            }}
                          >
                            {dName}: <strong>{cnt}</strong>
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Hangi Kuşaklarda Yayınlandı */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {m.timeBlocksBreakdown.map(tb => {
                          const st = KUŞAK_BADGE_STYLES[tb.name] || {
                            bg: 'var(--bg-tertiary)',
                            border: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          };
                          return (
                            <span
                              key={tb.name}
                              style={{
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.color,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {tb.name}: {tb.count} kez
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Hangi Saatlerde Yayınlandı */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxWidth: '280px' }}>
                        {m.sortedHours.map(h => {
                          const countAtHour = m.hoursCountMap[h] || 1;
                          return (
                            <span
                              key={h}
                              style={{
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                color: '#e2e8f0',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                fontSize: '11px',
                                fontFamily: 'monospace',
                                fontWeight: '600'
                              }}
                              title={`${h} saatinde toplam ${countAtHour} defa yayınlandı`}
                            >
                              {h} {countAtHour > 1 ? `(x${countAtHour})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Detay Butonu */}
                    <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openMaterialAndCompanyDetail(m.companyId, m.materialId);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 10px',
                          borderRadius: '7px',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#c084fc',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        İncele <ExternalLink size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {materialReports.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Seçilen kriterlere uygun reklam yayın kaydı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. GÜNLÜK YAYIN DAĞILIM RAPORU (GÜNDE KAÇ DEFA & HANGİ SAATLERDE) */}
      {reportView === 'daily' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Tarih & Kanal</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Reklam Materyali</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma & Ürün</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    O Gün Kaç Defa Yayınlandı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    O Günkü Toplam Süre
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    O Gün Yayınlandığı Kuşaklar
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    O Gün Yayınlandığı Saatler (HH:MM)
                  </th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map(d => (
                  <tr
                    key={d.key}
                    onClick={() => openMaterialAndCompanyDetail(d.companyId, d.materialId)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '13.5px' }}>{d.date}</div>
                      <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: '600' }}>
                        {d.channelName}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{d.materialName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        #{d.clipId} ({d.unitDurationSec} sn)
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#60a5fa', fontSize: '13px' }}>{d.companyName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.productName}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.16)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          color: '#fbbf24',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontWeight: '800',
                          fontSize: '14px'
                        }}
                      >
                        {d.dailySpotCount} Defa
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '800', color: '#34d399' }}>
                      {formatDurationReadable(d.dailyTotalSec)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {d.timeBlocksList.map(tb => {
                          const st = KUŞAK_BADGE_STYLES[tb] || {
                            bg: 'var(--bg-tertiary)',
                            border: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          };
                          return (
                            <span
                              key={tb}
                              style={{
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.color,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {tb}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {d.broadcastTimes.map((t, idx) => (
                          <span
                            key={`${t}-${idx}`}
                            style={{
                              background: 'rgba(59, 130, 246, 0.14)',
                              border: '1px solid rgba(59, 130, 246, 0.35)',
                              color: '#93c5fd',
                              padding: '3px 8px',
                              borderRadius: '5px',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              fontWeight: '700'
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. FİRMA BAZLI RAPOR */}
      {reportView === 'company' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1050px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma Adı</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Aktif Ürün & Spot
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Toplam Yayın (Kaç Defa)
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Toplam Süre (Kaç Saniye)
                  </th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Günde / Haftada / Ayda / Yılda
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Hangi Gün Kaç Defa Yayınlandı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
                    Kuşak Dağılımı
                  </th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Firma Detay & Rapor
                  </th>
                </tr>
              </thead>
              <tbody>
                {companyReports.map(c => (
                  <tr
                    key={c.companyId}
                    onClick={() => openMaterialAndCompanyDetail(c.companyId)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.14)',
                            color: '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Building2 size={16} />
                        </div>
                        <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '14px' }}>
                          {c.companyName}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {c.productsCount} Ürün / {c.materialsCount} Materyal
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '800', color: '#60a5fa', fontSize: '15px' }}>
                      {c.totalSpots} Defa
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '800', color: '#34d399', fontSize: '14px' }}>
                      {formatDurationReadable(c.totalDurationSec)}
                    </td>
                    <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '700', color: '#fbbf24' }}>
                      <div>{c.avgDailySpots} spot/gün ({c.activeDaysCount} gün)</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Hafta: {c.avgWeeklySpots} • Ay: ~{c.estMonthlySpots} • Yıl: ~{c.estYearlySpots}
                      </div>
                      {c.totalRevenue > 0 && (
                        <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                          {c.totalRevenue.toLocaleString('tr-TR')} ₺
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                        {Object.entries(c.dayOfWeekCounts || {}).map(([dName, cnt]) => (
                          <span
                            key={dName}
                            style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#60a5fa'
                            }}
                          >
                            {dName}: <strong>{cnt}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {c.timeBlocksBreakdown.map(tb => {
                          const st = KUŞAK_BADGE_STYLES[tb.name] || {
                            bg: 'var(--bg-tertiary)',
                            border: 'var(--border-color)',
                            color: 'var(--text-primary)'
                          };
                          return (
                            <span
                              key={tb.name}
                              style={{
                                background: st.bg,
                                border: `1px solid ${st.border}`,
                                color: st.color,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700'
                              }}
                            >
                              {tb.name}: {tb.count}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          openMaterialAndCompanyDetail(c.companyId);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Firma Raporuna Git
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3B. ÜRÜN / KAMPANYA BAZLI RAPOR */}
      {reportView === 'product' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1050px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase'
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Ürün / Kampanya Adı</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Materyal Sayısı</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Kaç Defa Yayınlandı</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Toplam Süre</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Hangi Gün Kaç Defa Yayınlandı</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Haftalık / Aylık / Yıllık</th>
                </tr>
              </thead>
              <tbody>
                {productReports.map(p => (
                  <tr
                    key={p.productId}
                    onClick={() => openMaterialAndCompanyDetail(p.companyId)}
                    style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '13px 16px', fontWeight: '800', color: 'var(--text-primary)' }}>{p.productName}</td>
                    <td style={{ padding: '13px 16px', fontWeight: '700', color: '#60a5fa' }}>{p.companyName}</td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: '700' }}>{p.materialsCount} Spot</td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: '900', color: '#60a5fa' }}>{p.totalSpots} Defa</td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontWeight: '800', color: '#34d399' }}>
                      {formatDurationReadable(p.totalDurationSec)}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Object.entries(p.dayOfWeekCounts || {}).map(([d, cnt]) => (
                          <span
                            key={d}
                            style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: '#60a5fa'
                            }}
                          >
                            {d}: <strong>{cnt}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      <div>Hafta: <strong>{p.avgWeeklySpots}</strong> • Ay: <strong>~{p.estMonthlySpots}</strong> • Yıl: <strong>~{p.estYearlySpots}</strong></div>
                      {p.totalRevenue > 0 && (
                        <div style={{ fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                          {p.totalRevenue.toLocaleString('tr-TR')} ₺
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3C. YAYIN PLANI, SPOT KULLANIMI VE ÜCRETLENDİRME / TAHSİLAT RAPORU */}
      {reportView === 'plans' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Üst Finansal & Spot Özeti Şeridi */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '900', color: 'var(--text-primary)' }}>
                💰 Yayın Planı, Spot Kotası ve Ücretlendirme / Tahsilat Raporu ({planReports.length} Rezervasyon)
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Planlanan spot, gerçekleşen spot, birim spot ücreti, toplam bütçe ve tahsilat verilerini bu tablodan da doğrudan güncelleyebilir ve PDF/Excel olarak indirebilirsiniz.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: '800' }}>
              <span style={{ color: '#059669' }}>
                Planlanan Bütçe: <strong>₺{(summary.totalPlannedBudget || 0).toLocaleString('tr-TR')}</strong>
              </span>
              <span style={{ color: '#0284c7' }}>
                Gerçekleşen Yayın Tutarı: <strong>₺{(summary.totalRealizedBudget || 0).toLocaleString('tr-TR')}</strong>
              </span>
              <span style={{ color: '#10b981' }}>
                Tahsil Edilen: <strong>₺{(summary.totalCollectedAmount || 0).toLocaleString('tr-TR')}</strong>
              </span>
              <span style={{ color: '#d97706' }}>
                Kalan Alacak: <strong>₺{(summary.totalRemainingReceivable || 0).toLocaleString('tr-TR')}</strong>
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1220px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase'
                }}
              >
                <tr>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Plan / Kampanya Adı</th>
                  <th style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma</th>
                  <th style={{ padding: '14px 14px', borderBottom: '1px solid var(--border-color)' }}>Tarih Aralığı</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Planlanan Spot</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Gerçekleşen Spot</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Kalan / Aşım (- Fark)</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Birim Spot Ücreti (₺)</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Planlanan Bütçe (₺)</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Gerçekleşen Tutar (₺)</th>
                  <th style={{ padding: '14px 12px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Tahsil Edilen &amp; Kalan</th>
                </tr>
              </thead>
              <tbody>
                {planReports.map(pr => (
                  <tr
                    key={pr.id}
                    style={{ borderBottom: '1px solid var(--border-color)' }}
                  >
                    <td
                      onClick={() => openMaterialAndCompanyDetail(pr.companyId)}
                      style={{ padding: '13px 16px', fontWeight: '800', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      {pr.name}
                      {pr.isRamadanSpecial && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: '#d97706', color: '#fff', fontWeight: 900 }}>
                          🌙 Ramazan
                        </span>
                      )}
                      {pr.isSponsor && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: 'rgba(147,51,234,0.16)', color: '#c084fc', fontWeight: 800 }}>
                          Sponsor
                        </span>
                      )}
                    </td>
                    <td
                      onClick={() => openMaterialAndCompanyDetail(pr.companyId)}
                      style={{ padding: '13px 16px', fontWeight: '700', color: '#60a5fa', cursor: 'pointer' }}
                    >
                      {pr.companyName}
                    </td>
                    <td style={{ padding: '13px 14px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {pr.startDate} – {pr.endDate}
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        value={pr.plannedSpots ?? ''}
                        onChange={e => {
                          const nextPlanned = Math.max(1, Number(e.target.value) || 1);
                          const nextBudget = pr.unitPrice > 0 ? Math.round(nextPlanned * pr.unitPrice) : pr.plannedBudget;
                          updateReservation &&
                            updateReservation(pr.id, {
                              totalPlannedSpots: nextPlanned,
                              totalBudget: nextBudget,
                              totalAmount: nextBudget,
                              toplamTutar: nextBudget
                            });
                        }}
                        className="ads-saas-input"
                        style={{ width: '85px', fontWeight: '800', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center', fontWeight: '900', color: pr.spotDiff < 0 ? '#ef4444' : '#34d399' }}>
                      {pr.realizedSpots} Spot (%{pr.usagePct})
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: '900',
                          fontSize: '12px',
                          background: pr.spotDiff < 0 ? 'rgba(239, 68, 68, 0.16)' : 'rgba(16, 185, 129, 0.14)',
                          color: pr.spotDiff < 0 ? '#ef4444' : '#34d399'
                        }}
                      >
                        {pr.spotDiff < 0 ? `${pr.spotDiff} Spot Aşım` : `${pr.spotDiff} Kalan`}
                      </span>
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={pr.unitPrice || ''}
                        onChange={e => {
                          const nextUnit = Math.max(0, Number(e.target.value) || 0);
                          const nextBudget = Math.round((pr.plannedSpots || 1) * nextUnit);
                          updateReservation &&
                            updateReservation(pr.id, {
                              spotPrice: nextUnit,
                              totalBudget: nextBudget,
                              totalAmount: nextBudget,
                              toplamTutar: nextBudget
                            });
                        }}
                        placeholder="0 ₺"
                        className="ads-saas-input"
                        style={{ width: '105px', fontWeight: '800', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={pr.plannedBudget || ''}
                        onChange={e => {
                          const nextBudget = Math.max(0, Number(e.target.value) || 0);
                          const nextUnit = (pr.plannedSpots || 1) > 0 ? Math.round(nextBudget / (pr.plannedSpots || 1)) : 0;
                          updateReservation &&
                            updateReservation(pr.id, {
                              spotPrice: nextUnit,
                              totalBudget: nextBudget,
                              totalAmount: nextBudget,
                              toplamTutar: nextBudget
                            });
                        }}
                        placeholder="0 ₺"
                        className="ads-saas-input"
                        style={{ width: '115px', fontWeight: '800', color: '#059669', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center', fontWeight: '800', color: '#0284c7', fontFamily: 'monospace' }}>
                      ₺{(pr.realizedBudget || 0).toLocaleString('tr-TR')}
                    </td>
                    <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={pr.collectedAmount || ''}
                          onChange={e => {
                            const nextCol = Math.max(0, Number(e.target.value) || 0);
                            updateReservation &&
                              updateReservation(pr.id, {
                                collectedAmount: nextCol,
                                paymentStatus: nextCol >= pr.plannedBudget && pr.plannedBudget > 0 ? 'paid' : nextCol > 0 ? 'partial' : 'unpaid'
                              });
                          }}
                          placeholder="Tahsil: 0 ₺"
                          className="ads-saas-input"
                          style={{ width: '115px', fontWeight: '800', textAlign: 'center' }}
                        />
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: pr.remainingReceivable > 0 ? '#d97706' : '#10b981' }}>
                          {pr.remainingReceivable > 0
                            ? `Kalan: ₺${pr.remainingReceivable.toLocaleString('tr-TR')}`
                            : pr.plannedBudget > 0
                            ? '✓ Tahsil Edildi'
                            : '-'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3D. HAFTALIK / AYLIK / YILLIK DÖNEMSEL YAYIN ANALİZİ */}
      {reportView === 'periods' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', fontWeight: '800', fontSize: '13px' }}>
              📅 Haftalık Yayınlanma Raporu
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 12px' }}>Hafta</th>
                  <th style={{ padding: '9px 12px' }}>Toplam Spot</th>
                  <th style={{ padding: '9px 12px' }}>Süre &amp; Firma</th>
                </tr>
              </thead>
              <tbody>
                {periodReports.weekly.map(w => (
                  <tr key={w.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: '700' }}>{w.label}</td>
                    <td style={{ padding: '9px 12px', fontWeight: '900', color: '#60a5fa' }}>{w.spots} Spot</td>
                    <td style={{ padding: '9px 12px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {formatSecondsToHoursMin(w.durationSec)} • {w.companiesCount} Firma
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', fontWeight: '800', fontSize: '13px' }}>
              🗓️ Aylık Yayınlanma Raporu
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 12px' }}>Ay</th>
                  <th style={{ padding: '9px 12px' }}>Toplam Spot</th>
                  <th style={{ padding: '9px 12px' }}>Süre &amp; Firma</th>
                </tr>
              </thead>
              <tbody>
                {periodReports.monthly.map(m => (
                  <tr key={m.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: '700' }}>{m.label}</td>
                    <td style={{ padding: '9px 12px', fontWeight: '900', color: '#60a5fa' }}>{m.spots} Spot</td>
                    <td style={{ padding: '9px 12px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {formatSecondsToHoursMin(m.durationSec)} • {m.companiesCount} Firma
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', fontWeight: '800', fontSize: '13px' }}>
              📊 Yıllık Yayınlanma Raporu
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '9px 12px' }}>Yıl</th>
                  <th style={{ padding: '9px 12px' }}>Toplam Spot</th>
                  <th style={{ padding: '9px 12px' }}>Süre &amp; Firma</th>
                </tr>
              </thead>
              <tbody>
                {periodReports.yearly.map(y => (
                  <tr key={y.key} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '9px 12px', fontWeight: '700' }}>{y.label}</td>
                    <td style={{ padding: '9px 12px', fontWeight: '900', color: '#60a5fa' }}>{y.spots} Spot</td>
                    <td style={{ padding: '9px 12px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      {formatSecondsToHoursMin(y.durationSec)} • {y.companiesCount} Firma
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. KUŞAK & SAAT DİLİMİ ANALİZİ */}
      {reportView === 'timeblocks' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Sol: Kuşak Bazlı Kartlar */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Yayın Kuşaklarına Göre Reklam Dağılımı
            </h3>
            {timeBlockReports.map(tb => {
              const st = KUŞAK_BADGE_STYLES[tb.timeBlockName] || {
                bg: 'rgba(139, 92, 246, 0.14)',
                border: 'rgba(139, 92, 246, 0.35)',
                color: '#c084fc'
              };
              return (
                <div
                  key={tb.timeBlockName}
                  style={{
                    background: 'var(--bg-primary)',
                    border: `1px solid ${st.border}`,
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px', color: st.color }}>{tb.timeBlockName}</span>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {tb.totalSpots} Spot ({formatDurationReadable(tb.totalDurationSec)}) • %{tb.sharePercentage}
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '999px',
                      background: 'var(--bg-tertiary)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, tb.sharePercentage)}%`,
                        height: '100%',
                        background: st.color,
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>
                      {tb.uniqueCompaniesCount} Firma • {tb.uniqueMaterialsCount} Farklı Reklam Spotu
                    </span>
                    <span>Yayın Saatleri: {tb.hoursList.join(', ')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sağ: Saat Dilimi Yoğunluğu */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Saat Dilimlerine Göre Yayın Yoğunluğu
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hourlyReports.map(hr => {
                const maxSpots = Math.max(...hourlyReports.map(x => x.totalSpots), 1);
                const pct = Math.round((hr.totalSpots / maxSpots) * 100);
                return (
                  <div
                    key={hr.hourBucket}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 160px 1fr 130px',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'var(--bg-primary)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#60a5fa', fontSize: '14px' }}>
                      {hr.hourBucket}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {hr.timeBlockName}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        borderRadius: '999px',
                        background: 'var(--bg-tertiary)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                          borderRadius: '999px'
                        }}
                      />
                    </div>
                    <span style={{ textAlign: 'right', fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)' }}>
                      {hr.totalSpots} Spot ({hr.totalDurationSec} sn)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. TÜM SPOT YAYIN KAYITLARI (AS-RUN / PLAN LOG) */}
      {reportView === 'logs' && (
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
              <thead
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}
              >
                <tr>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Tarih</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Yayın Saati</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Kuşak</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Kanal</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Firma</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Ürün</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>Reklam Spotu</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                    Süre (sn)
                  </th>
                </tr>
              </thead>
              <tbody>
                {spotLogs.map(log => {
                  const st = KUŞAK_BADGE_STYLES[log.timeBlockName] || {
                    bg: 'var(--bg-tertiary)',
                    border: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  };
                  return (
                    <tr
                      key={log.id}
                      onClick={() => openMaterialAndCompanyDetail(log.companyId, log.materialId)}
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>{log.date}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: '800', color: '#60a5fa' }}>
                        {log.time}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            background: st.bg,
                            border: `1px solid ${st.border}`,
                            color: st.color,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}
                        >
                          {log.timeBlockName}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {log.channelName}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#60a5fa' }}>{log.companyName}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{log.productName}</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {log.materialName}{' '}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          (#{log.clipId})
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: '#34d399' }}>
                        {log.durationSec} sn
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsReportsTab;

