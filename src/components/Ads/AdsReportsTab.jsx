/**
 * @file src/components/Ads/AdsReportsTab.jsx
 * @description Kurumsal Flexbox Mimarili Reklam & Medya Analitik Raporları Sekmesi.
 * Ekrana %100 sığan esnek (Flex) tablo satırları, yan yana akan saat/gün/kuşak rozetleri
 * ve PDF / Excel / CSV dışa aktarım araçlarıyla tüm yayın analitiğini sunar.
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
  ExternalLink,
  CheckCircle2,
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

const KUSAK_BADGE_STYLES = {
  'Sabah Kuşağı': { bg: 'rgba(2, 132, 199, 0.12)', border: 'rgba(2, 132, 199, 0.32)', color: '#0284c7' },
  'Öğle Kuşağı': { bg: 'rgba(217, 119, 6, 0.12)', border: 'rgba(217, 119, 6, 0.32)', color: '#d97706' },
  'Akşam (Prime Time)': { bg: 'rgba(124, 58, 237, 0.14)', border: 'rgba(124, 58, 237, 0.35)', color: '#7c3aed' },
  'Gece Kuşağı': { bg: 'rgba(13, 148, 136, 0.12)', border: 'rgba(13, 148, 136, 0.32)', color: '#0d9488' }
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

  // 'material' | 'product' | 'company' | 'plans' | 'periods' | 'daily' | 'timeblocks' | 'logs'
  const [reportView, setReportView] = useState('material');
  const [expandedHoursByMatId, setExpandedHoursByMatId] = useState({});
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
          'Toplam Yayın',
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
          'Ürün Adı',
          'Firma',
          'Materyal Sayısı',
          'Toplam Yayın',
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
        filename: `Reklam_Plan_ve_Ucretlendirme_Raporu${scopeSuffix}`,
        headers: [
          'Plan Adı',
          'Firma',
          'Başlangıç - Bitiş',
          'Planlanan Spot',
          'Gerçekleşen Spot',
          'Fark / Aşım (-)',
          'Kullanım Oranı (%)',
          'Birim Fiyat (₺)',
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
        'Materyal Adı',
        'Klip Kodu',
        'Klip ID',
        'Firma',
        'Ürün',
        'Birim Süre (sn)',
        'Toplam Yayın (Kaç Defa)',
        'Toplam Süre (Saniye)',
        'Hangi Gün Kaç Defa Yayınlandı',
        'Haftalık Yayın',
        'Aylık Yayın',
        'Yıllık Yayın',
        'Birim Ücret (₺)',
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
        { label: 'Toplam Yayınlanan', value: `${summary.totalSpotsCount} Kez` },
        { label: 'Toplam Yayın Süresi', value: `${summary.totalBroadcastSec.toLocaleString('tr-TR')} sn (${formatSecondsToHoursMin(summary.totalBroadcastSec)})` },
        { label: 'Aktif Firma & Ürün', value: `${summary.activeCompaniesCount} Firma / ${summary.activeProductsCount} Ürün` },
        { label: 'Aktif Materyal', value: `${summary.activeMaterialsCount} Materyal` },
        { label: 'Hesaplanan Yayın Tutarı', value: summary.totalRevenue > 0 ? `${summary.totalRevenue.toLocaleString('tr-TR')} ₺` : 'Kota Bazlı' }
      ],
      sections: [
        {
          title: '1. MATERYAL BAZLI GÜNLÜK, HAFTALIK, AYLIK VE YILLIK YAYINLANMA RAPORU',
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
          headers: ['Firma Adı', 'Ürün / Materyal', 'Toplam Yayın', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Haftalık', 'Aylık', 'Yıllık', 'Toplam Tutar (₺)'],
          rows: companyReports.map(c => [
            c.companyName,
            `${c.productsCount} Ürün / ${c.materialsCount} Materyal`,
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
          title: '3. ÜRÜN BAZLI YAYINLANMA RAPORU',
          headers: ['Ürün Adı', 'Firma', 'Materyal Sayısı', 'Toplam Yayın', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Haftalık / Aylık / Yıllık', 'Toplam Tutar (₺)'],
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
          title: '4. YAYIN PLANI VE ÜCRETLENDİRME / TAHSİLAT RAPORU',
          headers: ['Plan Adı', 'Firma', 'Tarih Aralığı', 'Planlanan', 'Gerçekleşen', 'Kalan / Aşım (-)', 'Kullanım %', 'Birim Ücret', 'Planlanan Bütçe', 'Gerçekleşen Tutar', 'Tahsil Edilen', 'Kalan Alacak'],
          rows: planReports.map(pr => [
            pr.name,
            pr.companyName,
            `${pr.startDate} – ${pr.endDate}`,
            `${pr.plannedSpots}`,
            `${pr.realizedSpots}`,
            `${pr.spotDiff}`,
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
      accentColor: '#465fff',
      kpis: [
        { label: 'Toplam Yayınlanan', value: `${summary.totalSpotsCount} Kez`, sub: `${summary.totalBroadcastDays} Yayın Günü` },
        { label: 'Toplam Yayın Süresi', value: formatSecondsToHoursMin(summary.totalBroadcastSec), sub: `${summary.totalBroadcastSec.toLocaleString('tr-TR')} Saniye`, color: '#0d9488' },
        { label: 'Aktif Firma & Ürün', value: `${summary.activeCompaniesCount} Firma`, sub: `${summary.activeProductsCount} Ürün • ${summary.activeMaterialsCount} Materyal`, color: '#8b5cf6' },
        { label: 'Günlük Ortalama Yayın', value: `${summary.avgSpotsPerDay} / Gün`, sub: `${summary.avgSecPerDay} sn/gün`, color: '#d97706' },
        { label: 'Hesaplanan Yayın Tutarı', value: summary.totalRevenue > 0 ? `${summary.totalRevenue.toLocaleString('tr-TR')} ₺` : 'Kota Bazlı', sub: 'Plan & Birim Ücret Bazlı', color: '#059669' }
      ],
      highlightCards: [
        {
          title: 'Dönemsel (Haftalık / Aylık / Yıllık) Yayın Özeti',
          body:
            `Haftalık: ${periodReports.weekly.map(w => `${w.label} (${w.spots})`).join(', ') || '-'} | ` +
            `Aylık: ${periodReports.monthly.map(m => `${m.label} (${m.spots})`).join(', ') || '-'} | ` +
            `Yıllık: ${periodReports.yearly.map(y => `${y.label} (${y.spots})`).join(', ') || '-'}`
        },
        {
          title: 'Kuşak Dağılım Özeti',
          body: timeBlockReports.map(tb => `${tb.timeBlockName}: ${tb.totalSpots} Kez (%${tb.sharePercentage})`).join(' • ') || '-'
        }
      ],
      sections: [
        {
          title: '1. Materyal Bazlı Günlük, Haftalık, Aylık ve Yıllık Yayın Raporu',
          description: 'Hangi reklamın hangi gün, hafta, ay ve yılda kaçar defa yayınlandığı, süre ve fiyat özeti.',
          headers: ['Materyal & Kod', 'Firma & Ürün', 'Toplam Yayın', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Hafta / Ay / Yıl Dağılımı', 'Tutar (₺)'],
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
          headers: ['Firma Adı', 'Ürün / Materyal', 'Toplam Yayın', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Aylık / Yıllık', 'Toplam Tutar (₺)'],
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
          headers: ['Ürün Adı', 'Firma', 'Materyal', 'Toplam Yayın', 'Toplam Süre', 'Hangi Gün Kaç Defa', 'Toplam Tutar (₺)'],
          rows: productReports.map(p => [
            p.productName,
            p.companyName,
            `${p.materialsCount} Materyal`,
            `${p.totalSpots} Defa`,
            formatSecondsToHoursMin(p.totalDurationSec),
            p.dayOfWeekBreakdown,
            p.totalRevenue > 0 ? `${p.totalRevenue.toLocaleString('tr-TR')} ₺` : '-'
          ])
        },
        {
          title: '4. Yayın Planı ve Ücretlendirme / Tahsilat Raporu',
          headers: ['Plan Adı', 'Firma', 'Tarih Aralığı', 'Planlanan', 'Gerçekleşen', 'Fark / Aşım (-)', 'Birim Ücret', 'Planlanan Bütçe', 'Gerçekleşen Tutar', 'Tahsilat / Kalan'],
          rows: planReports.map(pr => [
            pr.name,
            pr.companyName,
            `${pr.startDate} – ${pr.endDate}`,
            `${pr.plannedSpots}`,
            `${pr.realizedSpots}`,
            `${pr.spotDiff} (%${pr.usagePct})`,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
      {/* 1. KURUMSAL ANALİTİK FİLTRE VE DIŞA AKTARIM TOOLBAR (FLEXBOX) */}
      <div className="ads-saas-toolbar" style={{ padding: '14px 18px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: '1 1 600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: 'var(--ads-brand-soft)',
                color: 'var(--ads-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileBarChart2 size={18} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              Analitik Raporlar
            </span>
          </div>

          <div style={{ position: 'relative', minWidth: '185px', maxWidth: '250px', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ads-text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Materyal, firma, saat ara..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="ads-saas-input"
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          <select
            className="ads-saas-select"
            value={filters.companyId}
            onChange={e => setFilters(prev => ({ ...prev, companyId: e.target.value, productId: '', materialId: '' }))}
            style={{ maxWidth: '185px' }}
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
            style={{ maxWidth: '175px' }}
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
            style={{ maxWidth: '185px' }}
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
          <button type="button" onClick={resetFilters} className="ads-saas-btn">
            <RotateCcw size={13} /> Sıfırla
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="ads-saas-btn"
            style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c', fontWeight: 800 }}
            title="PDF Sunum Çıktısı İndir"
          >
            <FileText size={14} /> PDF (Sunum)
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="ads-saas-btn"
            style={{ background: '#059669', color: '#fff', borderColor: '#047857', fontWeight: 800 }}
            title="Excel (.xls) Çıktısı İndir"
          >
            <FileSpreadsheet size={14} /> Excel (.xls)
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="ads-saas-btn ads-saas-btn-primary"
            title="CSV Çıktısı İndir"
          >
            <Download size={14} /> CSV İndir
          </button>
        </div>
      </div>

      {/* 2. 6'LI ESNEK (FLEXBOX) KPI ÖZET KARTLARI */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        <div className="ads-saas-card" style={{ flex: '1 1 180px', padding: '13px 15px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Yayın</span>
            <CheckCircle2 size={16} color="var(--ads-brand)" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
            {summary.totalSpotsCount.toLocaleString('tr-TR')}{' '}
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              ({summary.totalBroadcastDays} gün)
            </span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ flex: '1 1 180px', padding: '13px 15px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Toplam Süre</span>
            <Clock size={16} color="#0d9488" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#0d9488' }}>
            {summary.totalBroadcastSec.toLocaleString('tr-TR')}{' '}
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              sn ({summary.totalBroadcastMin} dk)
            </span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ flex: '1 1 170px', padding: '13px 15px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Günlük Ortalama</span>
            <Calendar size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#d97706' }}>
            {summary.avgSpotsPerDay}{' '}
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Yayın / Gün</span>
          </div>
        </div>

        <div className="ads-saas-card" style={{ flex: '1 1 190px', padding: '13px 15px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Aktif Materyal &amp; Firma</span>
            <Film size={16} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#7c3aed' }}>
            {summary.activeMaterialsCount}{' '}
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
              Materyal • {summary.activeCompaniesCount} Firma
            </span>
          </div>
        </div>

        <div
          className="ads-saas-card"
          onClick={() => setReportView('plans')}
          style={{
            flex: '1.2 1 210px',
            padding: '13px 15px',
            gap: '4px',
            cursor: 'pointer',
            border: '1.5px solid rgba(5, 150, 105, 0.45)',
            background: 'rgba(16, 185, 129, 0.06)'
          }}
          title="Yayın Planı & Ücretlendirme Detay Tablosunu Aç"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#059669' }}>Ücretlendirme &amp; Bütçe</span>
            <Wallet size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>
            ₺{(summary.totalPlannedBudget || summary.totalRevenue || 0).toLocaleString('tr-TR')}
          </div>
          <div style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
            Gerçekleşen: ₺{(summary.totalRealizedBudget || 0).toLocaleString('tr-TR')} • Tahsil: ₺{(summary.totalCollectedAmount || 0).toLocaleString('tr-TR')}
          </div>
        </div>

        <div className="ads-saas-card" style={{ flex: '1 1 180px', padding: '13px 15px', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>En Yoğun Kuşak</span>
            <TrendingUp size={16} color="#e11d48" />
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: '900', color: '#e11d48', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {summary.topTimeBlock ? `${summary.topTimeBlock.timeBlockName} (%${summary.topTimeBlock.sharePercentage})` : '-'}
          </div>
        </div>
      </div>

      {/* 3. RAPOR GÖRÜNÜM SEKMELERİ */}
      <div className="ads-saas-pill-group" style={{ flexWrap: 'wrap', padding: '5px' }}>
        {[
          { id: 'material', label: `1. Materyal Bazlı (${materialReports.length})` },
          { id: 'company', label: `2. Firma Bazlı (${companyReports.length})` },
          { id: 'product', label: `3. Ürün Bazlı (${productReports.length})` },
          { id: 'plans', label: `4. Yayın Planı & Ücretlendirme (${planReports.length})` },
          { id: 'periods', label: '5. Haftalık / Aylık / Yıllık Analiz' },
          { id: 'daily', label: `6. Günlük & Saat (${dailyReports.length})` },
          { id: 'timeblocks', label: '7. Kuşak & Saat Yoğunluğu' },
          { id: 'logs', label: `8. Tüm Yayın Kayıtları (${spotLogs.length})` }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setReportView(tab.id)}
            className={`ads-saas-pill-btn ${reportView === tab.id ? 'active' : ''}`}
            style={{ padding: '7px 13px', fontSize: '12.5px', fontWeight: '800' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======================================================================
          1. MATERYAL BAZLI RAPOR (EKRANA %100 SIĞAN 2 KATMANLI FLEXBOX MİMARİSİ)
          Saatlerin alt alta yığılmasını önlemek için:
          - Üst satırda: Materyal & Kod | Firma & Ürün | Süre | Kaç Defa | Toplam Süre | Periyot | İncele
          - Alt şeritte: Günler | Kuşaklar | Yayın Saatleri (Tam genişlikte yan yana yatay akar!)
         ====================================================================== */}
      {reportView === 'material' && (
        <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
          {/* Flex Tablo Başlığı */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '13px 18px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1.5px solid var(--ads-border)',
              fontSize: '11.5px',
              fontWeight: '800',
              color: 'var(--ads-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: '2 1 220px', minWidth: '180px' }}>Reklam Materyali &amp; Klip Kodu</div>
            <div style={{ flex: '1.5 1 180px', minWidth: '150px' }}>Firma &amp; Ürün</div>
            <div style={{ width: '90px', textAlign: 'center', flexShrink: 0 }}>Süre</div>
            <div style={{ width: '125px', textAlign: 'center', flexShrink: 0 }}>Kaç Defa Yayınlandı</div>
            <div style={{ width: '135px', textAlign: 'center', flexShrink: 0 }}>Toplam Süre</div>
            <div style={{ flex: '1.3 1 180px', minWidth: '160px', textAlign: 'center' }}>Günde / Haftada / Ayda / Yılda</div>
            <div style={{ width: '95px', textAlign: 'right', flexShrink: 0 }}>Detay</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {materialReports.map(m => {
              const isHoursExpanded = Boolean(expandedHoursByMatId[m.materialId]);
              const maxVisibleHours = 14;
              const visibleHours = isHoursExpanded ? m.sortedHours : m.sortedHours.slice(0, maxVisibleHours);
              const hiddenHoursCount = Math.max(0, m.sortedHours.length - maxVisibleHours);

              return (
                <div
                  key={m.materialId}
                  onClick={() => openMaterialAndCompanyDetail(m.companyId, m.materialId)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '14px 18px',
                    borderBottom: '1px solid var(--ads-border)',
                    cursor: 'pointer',
                    transition: 'background 0.14s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ads-row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* 1. ÜST ANA METRİK SATIRI (FLEXBOX) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Materyal Adı & Klip Kodu */}
                    <div
                      style={{
                        flex: '2 1 220px',
                        minWidth: '180px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '9px',
                          background: 'rgba(124, 58, 237, 0.12)',
                          color: '#7c3aed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <Film size={17} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: '800',
                            color: 'var(--ads-text-main)',
                            fontSize: '13.5px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={m.materialName}
                        >
                          {m.materialName}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--ads-text-muted)',
                            fontFamily: 'monospace',
                            marginTop: '2px'
                          }}
                        >
                          #{m.clipId} • {m.clipName || 'Klip Kodu Yok'}
                        </div>
                      </div>
                    </div>

                    {/* Firma & Ürün */}
                    <div style={{ flex: '1.5 1 180px', minWidth: '150px' }}>
                      <div
                        style={{
                          fontWeight: '800',
                          color: 'var(--ads-brand)',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {m.companyName}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--ads-text-sub)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {m.productName}
                      </div>
                    </div>

                    {/* Birim Süre */}
                    <div style={{ width: '90px', textAlign: 'center', flexShrink: 0 }}>
                      <span
                        style={{
                          background: 'var(--ads-card-subtle)',
                          border: '1px solid var(--ads-border-strong)',
                          padding: '4px 10px',
                          borderRadius: '7px',
                          fontWeight: '800',
                          fontSize: '12px',
                          color: 'var(--ads-text-main)',
                          fontFamily: 'monospace'
                        }}
                      >
                        {m.unitDurationSec} sn
                      </span>
                    </div>

                    {/* Kaç Defa Yayınlandı */}
                    <div style={{ width: '125px', textAlign: 'center', flexShrink: 0 }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          background: 'var(--ads-brand-soft)',
                          border: '1px solid rgba(70, 95, 255, 0.3)',
                          padding: '5px 13px',
                          borderRadius: '8px'
                        }}
                      >
                        <span style={{ fontSize: '14.5px', fontWeight: '900', color: 'var(--ads-brand)' }}>
                          {m.totalSpots} Defa
                        </span>
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
                          {m.activeDaysCount} günde
                        </span>
                      </div>
                    </div>

                    {/* Toplam Kaç Saniye */}
                    <div style={{ width: '135px', textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontWeight: '900', color: '#0d9488', fontSize: '14px' }}>
                        {m.totalDurationSec.toLocaleString('tr-TR')} sn
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                        ({(m.totalDurationSec / 60).toFixed(1)} dk)
                      </div>
                    </div>

                    {/* Günde / Haftada / Ayda / Yılda */}
                    <div style={{ flex: '1.3 1 180px', minWidth: '160px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', color: '#d97706', fontSize: '12.5px' }}>
                        Günde ort. {m.avgDailySpots} kez
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ads-text-sub)', marginTop: '2px' }}>
                        Hafta: <strong>{m.avgWeeklySpots}</strong> • Ay: <strong>~{m.estMonthlySpots}</strong> • Yıl: <strong>~{m.estYearlySpots}</strong>
                      </div>
                      {m.totalRevenue > 0 && (
                        <div style={{ fontSize: '11.5px', fontWeight: '900', color: '#059669', marginTop: '2px' }}>
                          {m.totalRevenue.toLocaleString('tr-TR')} ₺
                        </div>
                      )}
                    </div>

                    {/* Detay Butonu */}
                    <div style={{ width: '95px', textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          openMaterialAndCompanyDetail(m.companyId, m.materialId);
                        }}
                        className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                      >
                        <span>İncele</span>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>

                  {/* 2. ALT YATAY DAĞILIM ŞERİDİ (GÜNLER | KUŞAKLAR | YAYIN SAATLERİ YAN YANA AKAR, ALT ALTA YIĞILMAZ!) */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '9px 14px',
                      borderRadius: '10px',
                      background: 'var(--ads-card-subtle)',
                      border: '1px solid var(--ads-border)'
                    }}
                  >
                    {/* Hangi Gün Kaç Defa */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--ads-text-muted)', textTransform: 'uppercase' }}>
                        Günler:
                      </span>
                      {Object.entries(m.dayOfWeekCounts || {}).map(([dName, cnt]) => (
                        <span
                          key={dName}
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: 'var(--ads-brand-soft)',
                            color: 'var(--ads-brand)'
                          }}
                        >
                          {dName}: <strong>{cnt}</strong>
                        </span>
                      ))}
                    </div>

                    <span style={{ color: 'var(--ads-border-strong)' }}>|</span>

                    {/* Hangi Kuşaklarda */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--ads-text-muted)', textTransform: 'uppercase' }}>
                        Kuşaklar:
                      </span>
                      {m.timeBlocksBreakdown.map(tb => {
                        const st = KUSAK_BADGE_STYLES[tb.name] || {
                          bg: 'var(--ads-pill-bar-bg)',
                          border: 'var(--ads-border)',
                          color: 'var(--ads-text-main)'
                        };
                        return (
                          <span
                            key={tb.name}
                            style={{
                              background: st.bg,
                              border: `1px solid ${st.border}`,
                              color: st.color,
                              padding: '2px 9px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800'
                            }}
                          >
                            {tb.name}: {tb.count} kez
                          </span>
                        );
                      })}
                    </div>

                    <span style={{ color: 'var(--ads-border-strong)' }}>|</span>

                    {/* Hangi Saatlerde Yayınlandı (Tam Genişlikte Yan Yana Yatay Dizilim!) */}
                    <div style={{ flex: '1 1 320px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--ads-text-muted)', textTransform: 'uppercase' }}>
                        Saatler ({m.sortedHours.length}):
                      </span>
                      {visibleHours.map(h => {
                        const countAtHour = m.hoursCountMap[h] || 1;
                        return (
                          <span
                            key={h}
                            style={{
                              background: 'var(--ads-card-bg)',
                              border: '1px solid var(--ads-border-strong)',
                              color: 'var(--ads-text-main)',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              fontWeight: '800'
                            }}
                            title={`${h} saatinde toplam ${countAtHour} defa yayınlandı`}
                          >
                            {h}
                            {countAtHour > 1 && (
                              <span style={{ color: 'var(--ads-brand)', marginLeft: '2px' }}>(x{countAtHour})</span>
                            )}
                          </span>
                        );
                      })}

                      {hiddenHoursCount > 0 && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setExpandedHoursByMatId(prev => ({
                              ...prev,
                              [m.materialId]: !prev[m.materialId]
                            }));
                          }}
                          style={{
                            padding: '2px 9px',
                            borderRadius: '999px',
                            border: '1px solid var(--ads-brand)',
                            background: 'var(--ads-brand-soft)',
                            color: 'var(--ads-brand)',
                            fontSize: '10.5px',
                            fontWeight: '800',
                            cursor: 'pointer'
                          }}
                        >
                          {isHoursExpanded ? 'Daha Az Göster' : `+${hiddenHoursCount} Saat Daha`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {materialReports.length === 0 && (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--ads-text-muted)' }}>
                Seçilen kriterlere uygun reklam yayın kaydı bulunamadı.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================
          2. FİRMA BAZLI RAPOR (FLEXBOX MİMARİSİ)
         ====================================================================== */}
      {reportView === 'company' && (
        <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '13px 18px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1.5px solid var(--ads-border)',
              fontSize: '11.5px',
              fontWeight: '800',
              color: 'var(--ads-text-muted)',
              textTransform: 'uppercase',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: '1.8 1 200px', minWidth: '170px' }}>Firma Adı</div>
            <div style={{ width: '145px', textAlign: 'center', flexShrink: 0 }}>Ürün &amp; Materyal</div>
            <div style={{ width: '115px', textAlign: 'center', flexShrink: 0 }}>Toplam Yayın</div>
            <div style={{ width: '145px', textAlign: 'center', flexShrink: 0 }}>Toplam Süre</div>
            <div style={{ flex: '1.2 1 170px', minWidth: '155px', textAlign: 'center' }}>Günde / Haftada / Ayda / Yılda</div>
            <div style={{ flex: '2 1 260px', minWidth: '220px' }}>Gün &amp; Kuşak Dağılımı</div>
            <div style={{ width: '125px', textAlign: 'right', flexShrink: 0 }}>Detay</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {companyReports.map(c => (
              <div
                key={c.companyId}
                onClick={() => openMaterialAndCompanyDetail(c.companyId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--ads-border)',
                  cursor: 'pointer',
                  flexWrap: 'wrap'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ads-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: '1.8 1 200px', minWidth: '170px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'var(--ads-brand-soft)',
                      color: 'var(--ads-brand)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Building2 size={16} />
                  </div>
                  <span style={{ fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '13.5px' }}>
                    {c.companyName}
                  </span>
                </div>

                <div style={{ width: '145px', textAlign: 'center', color: 'var(--ads-text-sub)', fontWeight: '700', fontSize: '12.5px', flexShrink: 0 }}>
                  {c.productsCount} Ürün / {c.materialsCount} Materyal
                </div>

                <div style={{ width: '115px', textAlign: 'center', fontWeight: '900', color: 'var(--ads-brand)', fontSize: '14.5px', flexShrink: 0 }}>
                  {c.totalSpots} Defa
                </div>

                <div style={{ width: '145px', textAlign: 'center', fontWeight: '800', color: '#0d9488', fontSize: '13px', flexShrink: 0 }}>
                  {formatDurationReadable(c.totalDurationSec)}
                </div>

                <div style={{ flex: '1.2 1 170px', minWidth: '155px', textAlign: 'center' }}>
                  <div style={{ fontWeight: '800', color: '#d97706', fontSize: '12.5px' }}>
                    {c.avgDailySpots} / gün ({c.activeDaysCount} gün)
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-sub)', marginTop: '2px' }}>
                    Hafta: {c.avgWeeklySpots} • Ay: ~{c.estMonthlySpots} • Yıl: ~{c.estYearlySpots}
                  </div>
                  {c.totalRevenue > 0 && (
                    <div style={{ fontSize: '11.5px', fontWeight: '900', color: '#059669', marginTop: '2px' }}>
                      {c.totalRevenue.toLocaleString('tr-TR')} ₺
                    </div>
                  )}
                </div>

                <div style={{ flex: '2 1 260px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {Object.entries(c.dayOfWeekCounts || {}).map(([dName, cnt]) => (
                      <span
                        key={dName}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          background: 'var(--ads-brand-soft)',
                          color: 'var(--ads-brand)'
                        }}
                      >
                        {dName}: <strong>{cnt}</strong>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {c.timeBlocksBreakdown.map(tb => {
                      const st = KUSAK_BADGE_STYLES[tb.name] || {
                        bg: 'var(--ads-pill-bar-bg)',
                        border: 'var(--ads-border)',
                        color: 'var(--ads-text-main)'
                      };
                      return (
                        <span
                          key={tb.name}
                          style={{
                            background: st.bg,
                            border: `1px solid ${st.border}`,
                            color: st.color,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10.5px',
                            fontWeight: '800'
                          }}
                        >
                          {tb.name}: {tb.count}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div style={{ width: '125px', textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      openMaterialAndCompanyDetail(c.companyId);
                    }}
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                  >
                    Firma Karnesi
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          3. ÜRÜN BAZLI RAPOR (FLEXBOX MİMARİSİ)
         ====================================================================== */}
      {reportView === 'product' && (
        <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '13px 18px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1.5px solid var(--ads-border)',
              fontSize: '11.5px',
              fontWeight: '800',
              color: 'var(--ads-text-muted)',
              textTransform: 'uppercase',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ flex: '1.6 1 180px', minWidth: '150px' }}>Ürün Adı</div>
            <div style={{ flex: '1.4 1 160px', minWidth: '140px' }}>Firma</div>
            <div style={{ width: '120px', textAlign: 'center', flexShrink: 0 }}>Materyal Sayısı</div>
            <div style={{ width: '120px', textAlign: 'center', flexShrink: 0 }}>Kaç Defa Yayınlandı</div>
            <div style={{ width: '140px', textAlign: 'center', flexShrink: 0 }}>Toplam Süre</div>
            <div style={{ flex: '1.8 1 220px', minWidth: '190px' }}>Hangi Gün Kaç Defa</div>
            <div style={{ flex: '1.2 1 160px', minWidth: '145px', textAlign: 'center' }}>Haftalık / Aylık / Yıllık</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {productReports.map(p => (
              <div
                key={p.productId}
                onClick={() => openMaterialAndCompanyDetail(p.companyId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--ads-border)',
                  cursor: 'pointer',
                  flexWrap: 'wrap'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ads-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: '1.6 1 180px', minWidth: '150px', fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '13.5px' }}>
                  {p.productName}
                </div>
                <div style={{ flex: '1.4 1 160px', minWidth: '140px', fontWeight: '700', color: 'var(--ads-brand)', fontSize: '13px' }}>
                  {p.companyName}
                </div>
                <div style={{ width: '120px', textAlign: 'center', fontWeight: '700', color: 'var(--ads-text-sub)', flexShrink: 0 }}>
                  {p.materialsCount} Materyal
                </div>
                <div style={{ width: '120px', textAlign: 'center', fontWeight: '900', color: 'var(--ads-brand)', fontSize: '14px', flexShrink: 0 }}>
                  {p.totalSpots} Defa
                </div>
                <div style={{ width: '140px', textAlign: 'center', fontWeight: '800', color: '#0d9488', fontSize: '13px', flexShrink: 0 }}>
                  {formatDurationReadable(p.totalDurationSec)}
                </div>
                <div style={{ flex: '1.8 1 220px', minWidth: '190px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {Object.entries(p.dayOfWeekCounts || {}).map(([d, cnt]) => (
                    <span
                      key={d}
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: 'var(--ads-brand-soft)',
                        color: 'var(--ads-brand)'
                      }}
                    >
                      {d}: <strong>{cnt}</strong>
                    </span>
                  ))}
                </div>
                <div style={{ flex: '1.2 1 160px', minWidth: '145px', textAlign: 'center', fontSize: '11.5px', color: 'var(--ads-text-sub)' }}>
                  <div>Hafta: <strong>{p.avgWeeklySpots}</strong> • Ay: <strong>~{p.estMonthlySpots}</strong> • Yıl: <strong>~{p.estYearlySpots}</strong></div>
                  {p.totalRevenue > 0 && (
                    <div style={{ fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                      {p.totalRevenue.toLocaleString('tr-TR')} ₺
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          4. YAYIN PLANI VE ÜCRETLENDİRME / TAHSİLAT RAPORU (FLEXBOX)
         ====================================================================== */}
      {reportView === 'plans' && (
        <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1px solid var(--ads-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
                Yayın Planı, Kota ve Ücretlendirme / Tahsilat Raporu ({planReports.length} Rezervasyon)
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                Planlanan kota, gerçekleşen yayın, birim ücret, toplam bütçe ve tahsilat verilerini doğrudan güncelleyebilirsiniz.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: '800' }}>
              <span style={{ color: '#059669' }}>
                Planlanan Bütçe: <strong>₺{(summary.totalPlannedBudget || 0).toLocaleString('tr-TR')}</strong>
              </span>
              <span style={{ color: '#0284c7' }}>
                Gerçekleşen Tutar: <strong>₺{(summary.totalRealizedBudget || 0).toLocaleString('tr-TR')}</strong>
              </span>
              <span style={{ color: '#10b981' }}>
                Tahsil Edilen: <strong>₺{(summary.totalCollectedAmount || 0).toLocaleString('tr-TR')}</strong>
              </span>
              <span style={{ color: '#d97706' }}>
                Kalan Alacak: <strong>₺{(summary.totalRemainingReceivable || 0).toLocaleString('tr-TR')}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {planReports.map(pr => (
              <div
                key={pr.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--ads-border)',
                  flexWrap: 'wrap'
                }}
              >
                <div
                  onClick={() => openMaterialAndCompanyDetail(pr.companyId)}
                  style={{ flex: '1.6 1 200px', minWidth: '170px', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{pr.name}</span>
                    {pr.isSponsor && (
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', background: '#9333ea', color: '#fff', fontWeight: 800 }}>
                        Sponsor
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--ads-brand)', marginTop: '2px' }}>
                    {pr.companyName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace', marginTop: '1px' }}>
                    {pr.startDate} – {pr.endDate}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>PLANLANAN</span>
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
                      style={{ width: '80px', fontWeight: '800', textAlign: 'center', padding: '5px 6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '105px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>GERÇEKLEŞEN</span>
                    <span style={{ fontWeight: '900', fontSize: '13.5px', color: pr.spotDiff < 0 ? '#dc2626' : '#059669' }}>
                      {pr.realizedSpots} (%{pr.usagePct})
                    </span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        padding: '1px 7px',
                        borderRadius: '6px',
                        background: pr.spotDiff < 0 ? 'rgba(220, 38, 38, 0.12)' : 'rgba(5, 150, 105, 0.12)',
                        color: pr.spotDiff < 0 ? '#dc2626' : '#059669'
                      }}
                    >
                      {pr.spotDiff < 0 ? `${pr.spotDiff} Aşım` : `${pr.spotDiff} Kalan`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>BİRİM ÜCRET (₺)</span>
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
                      style={{ width: '95px', fontWeight: '800', textAlign: 'center', padding: '5px 6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>PLAN BÜTÇE (₺)</span>
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
                      style={{ width: '108px', fontWeight: '800', color: '#059669', textAlign: 'center', padding: '5px 6px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '100px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>GERÇEKLEŞEN</span>
                    <span style={{ fontWeight: '900', color: '#0284c7', fontFamily: 'monospace', fontSize: '13px' }}>
                      ₺{(pr.realizedBudget || 0).toLocaleString('tr-TR')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--ads-text-muted)' }}>TAHSİL EDİLEN (₺)</span>
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
                      placeholder="0 ₺"
                      className="ads-saas-input"
                      style={{ width: '108px', fontWeight: '800', textAlign: 'center', padding: '5px 6px' }}
                    />
                    <span style={{ fontSize: '10.5px', fontWeight: '800', color: pr.remainingReceivable > 0 ? '#d97706' : '#059669' }}>
                      {pr.remainingReceivable > 0
                        ? `Kalan: ₺${pr.remainingReceivable.toLocaleString('tr-TR')}`
                        : pr.plannedBudget > 0
                        ? 'Tahsil Edildi'
                        : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          5. HAFTALIK / AYLIK / YILLIK DÖNEMSEL YAYIN ANALİZİ (FLEXBOX)
         ====================================================================== */}
      {reportView === 'periods' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {[
            { title: 'Haftalık Yayınlanma Raporu', colLabel: 'Hafta', data: periodReports.weekly },
            { title: 'Aylık Yayınlanma Raporu', colLabel: 'Ay', data: periodReports.monthly },
            { title: 'Yıllık Yayınlanma Raporu', colLabel: 'Yıl', data: periodReports.yearly }
          ].map(sec => (
            <div
              key={sec.title}
              className="ads-saas-table-wrap"
              style={{ flex: '1 1 300px', minWidth: 0, overflow: 'hidden' }}
            >
              <div
                style={{
                  padding: '13px 16px',
                  background: 'var(--ads-card-subtle)',
                  borderBottom: '1px solid var(--ads-border)',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  color: 'var(--ads-text-main)'
                }}
              >
                {sec.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sec.data.map(row => (
                  <div
                    key={row.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '11px 16px',
                      borderBottom: '1px solid var(--ads-border)',
                      fontSize: '12.5px'
                    }}
                  >
                    <span style={{ fontWeight: '800', color: 'var(--ads-text-main)' }}>{row.label}</span>
                    <span style={{ fontWeight: '900', color: 'var(--ads-brand)' }}>{row.spots} Yayın</span>
                    <span style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                      {formatSecondsToHoursMin(row.durationSec)} • {row.companiesCount} Firma
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================================
          6. GÜNLÜK & SAAT DAĞILIM RAPORU (FLEXBOX — SAATLER YATAY YAN YANA)
         ====================================================================== */}
      {reportView === 'daily' && (
        <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '13px 18px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1.5px solid var(--ads-border)',
              fontSize: '11.5px',
              fontWeight: '800',
              color: 'var(--ads-text-muted)',
              textTransform: 'uppercase',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ width: '130px', flexShrink: 0 }}>Tarih &amp; Kanal</div>
            <div style={{ flex: '1.5 1 180px', minWidth: '150px' }}>Materyal</div>
            <div style={{ flex: '1.3 1 160px', minWidth: '140px' }}>Firma &amp; Ürün</div>
            <div style={{ width: '110px', textAlign: 'center', flexShrink: 0 }}>Günlük Yayın</div>
            <div style={{ width: '130px', textAlign: 'center', flexShrink: 0 }}>Toplam Süre</div>
            <div style={{ flex: '2.2 1 280px', minWidth: '240px' }}>Yayınlandığı Kuşaklar &amp; Saatler</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {dailyReports.map(d => (
              <div
                key={d.key}
                onClick={() => openMaterialAndCompanyDetail(d.companyId, d.materialId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--ads-border)',
                  cursor: 'pointer',
                  flexWrap: 'wrap'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ads-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: '130px', flexShrink: 0 }}>
                  <div style={{ fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '13.5px' }}>{d.date}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-brand)', fontWeight: '700' }}>{d.channelName}</div>
                </div>

                <div style={{ flex: '1.5 1 180px', minWidth: '150px' }}>
                  <div style={{ fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '13px' }}>{d.materialName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                    #{d.clipId} ({d.unitDurationSec} sn)
                  </div>
                </div>

                <div style={{ flex: '1.3 1 160px', minWidth: '140px' }}>
                  <div style={{ fontWeight: '800', color: 'var(--ads-brand)', fontSize: '12.5px' }}>{d.companyName}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)' }}>{d.productName}</div>
                </div>

                <div style={{ width: '110px', textAlign: 'center', flexShrink: 0 }}>
                  <span
                    style={{
                      background: 'rgba(217, 119, 6, 0.14)',
                      border: '1px solid rgba(217, 119, 6, 0.35)',
                      color: '#d97706',
                      padding: '4px 11px',
                      borderRadius: '8px',
                      fontWeight: '900',
                      fontSize: '13px'
                    }}
                  >
                    {d.dailySpotCount} Defa
                  </span>
                </div>

                <div style={{ width: '130px', textAlign: 'center', fontWeight: '800', color: '#0d9488', fontSize: '12.5px', flexShrink: 0 }}>
                  {formatDurationReadable(d.dailyTotalSec)}
                </div>

                <div style={{ flex: '2.2 1 280px', minWidth: '240px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  {d.timeBlocksList.map(tb => {
                    const st = KUSAK_BADGE_STYLES[tb] || {
                      bg: 'var(--ads-pill-bar-bg)',
                      border: 'var(--ads-border)',
                      color: 'var(--ads-text-main)'
                    };
                    return (
                      <span
                        key={tb}
                        style={{
                          background: st.bg,
                          border: `1px solid ${st.border}`,
                          color: st.color,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}
                      >
                        {tb}
                      </span>
                    );
                  })}

                  {d.broadcastTimes.map((t, idx) => (
                    <span
                      key={`${t}-${idx}`}
                      style={{
                        background: 'var(--ads-card-subtle)',
                        border: '1px solid var(--ads-border-strong)',
                        color: 'var(--ads-text-main)',
                        padding: '2px 7px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontFamily: 'monospace',
                        fontWeight: '800'
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          7. KUŞAK & SAAT DİLİMİ ANALİZİ (FLEXBOX)
         ====================================================================== */}
      {reportView === 'timeblocks' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {/* Sol: Kuşak Bazlı Kartlar */}
          <div
            className="ta-card"
            style={{
              flex: '1 1 380px',
              minWidth: 0,
              padding: '18px 20px',
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              Yayın Kuşaklarına Göre Reklam Dağılımı
            </h3>
            {timeBlockReports.map(tb => {
              const st = KUSAK_BADGE_STYLES[tb.timeBlockName] || {
                bg: 'var(--ads-brand-soft)',
                border: 'rgba(70, 95, 255, 0.3)',
                color: 'var(--ads-brand)'
              };
              return (
                <div
                  key={tb.timeBlockName}
                  style={{
                    background: 'var(--ads-card-subtle)',
                    border: `1px solid ${st.border}`,
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: '900', fontSize: '14.5px', color: st.color }}>{tb.timeBlockName}</span>
                    <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--ads-text-main)' }}>
                      {tb.totalSpots} Yayın ({formatDurationReadable(tb.totalDurationSec)}) • %{tb.sharePercentage}
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '999px',
                      background: 'var(--ads-pill-bar-bg)',
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '11.5px', color: 'var(--ads-text-muted)', fontWeight: '600' }}>
                    <span>
                      {tb.uniqueCompaniesCount} Firma • {tb.uniqueMaterialsCount} Farklı Materyal
                    </span>
                    <span style={{ fontFamily: 'monospace' }}>Saatler: {tb.hoursList.slice(0, 8).join(', ')}{tb.hoursList.length > 8 ? '...' : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sağ: Saat Dilimi Yoğunluğu */}
          <div
            className="ta-card"
            style={{
              flex: '1 1 380px',
              minWidth: 0,
              padding: '18px 20px',
              gap: '14px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: '900', color: 'var(--ads-text-main)' }}>
              Saat Dilimlerine Göre Yayın Yoğunluğu
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hourlyReports.map(hr => {
                const maxSpots = Math.max(...hourlyReports.map(x => x.totalSpots), 1);
                const pct = Math.round((hr.totalSpots / maxSpots) * 100);
                return (
                  <div
                    key={hr.hourBucket}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'var(--ads-card-subtle)',
                      padding: '9px 13px',
                      borderRadius: '9px',
                      border: '1px solid var(--ads-border)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ width: '65px', fontFamily: 'monospace', fontWeight: '900', color: 'var(--ads-brand)', fontSize: '13.5px', flexShrink: 0 }}>
                      {hr.hourBucket}
                    </span>
                    <span style={{ width: '135px', fontSize: '11.5px', color: 'var(--ads-text-sub)', fontWeight: '700', flexShrink: 0 }}>
                      {hr.timeBlockName}
                    </span>
                    <div
                      style={{
                        flex: '1 1 120px',
                        height: '8px',
                        borderRadius: '999px',
                        background: 'var(--ads-pill-bar-bg)',
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #465fff, #7c3aed)',
                          borderRadius: '999px'
                        }}
                      />
                    </div>
                    <span style={{ minWidth: '115px', textAlign: 'right', fontWeight: '800', fontSize: '12.5px', color: 'var(--ads-text-main)' }}>
                      {hr.totalSpots} ({hr.totalDurationSec} sn)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          8. TÜM YAYIN KAYITLARI (FLEXBOX)
         ====================================================================== */}
      {reportView === 'logs' && (
        <div className="ads-saas-table-wrap" style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '13px 18px',
              background: 'var(--ads-card-subtle)',
              borderBottom: '1.5px solid var(--ads-border)',
              fontSize: '11.5px',
              fontWeight: '800',
              color: 'var(--ads-text-muted)',
              textTransform: 'uppercase',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ width: '105px', flexShrink: 0 }}>Tarih</div>
            <div style={{ width: '85px', flexShrink: 0 }}>Saat</div>
            <div style={{ width: '150px', flexShrink: 0 }}>Kuşak</div>
            <div style={{ width: '130px', flexShrink: 0 }}>Kanal</div>
            <div style={{ flex: '1.3 1 160px', minWidth: '140px' }}>Firma</div>
            <div style={{ flex: '1.2 1 140px', minWidth: '120px' }}>Ürün</div>
            <div style={{ flex: '1.6 1 180px', minWidth: '150px' }}>Materyal</div>
            <div style={{ width: '75px', textAlign: 'right', flexShrink: 0 }}>Süre</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {spotLogs.map(log => {
              const st = KUSAK_BADGE_STYLES[log.timeBlockName] || {
                bg: 'var(--ads-pill-bar-bg)',
                border: 'var(--ads-border)',
                color: 'var(--ads-text-main)'
              };
              return (
                <div
                  key={log.id}
                  onClick={() => openMaterialAndCompanyDetail(log.companyId, log.materialId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '11px 18px',
                    borderBottom: '1px solid var(--ads-border)',
                    cursor: 'pointer',
                    flexWrap: 'wrap'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--ads-row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: '105px', fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '12.5px', flexShrink: 0 }}>
                    {log.date}
                  </div>
                  <div style={{ width: '85px', fontFamily: 'monospace', fontWeight: '900', color: 'var(--ads-brand)', fontSize: '13px', flexShrink: 0 }}>
                    {log.time}
                  </div>
                  <div style={{ width: '150px', flexShrink: 0 }}>
                    <span
                      style={{
                        background: st.bg,
                        border: `1px solid ${st.border}`,
                        color: st.color,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}
                    >
                      {log.timeBlockName}
                    </span>
                  </div>
                  <div style={{ width: '130px', color: 'var(--ads-text-sub)', fontSize: '12.5px', fontWeight: '700', flexShrink: 0 }}>
                    {log.channelName}
                  </div>
                  <div style={{ flex: '1.3 1 160px', minWidth: '140px', fontWeight: '800', color: 'var(--ads-brand)', fontSize: '12.5px' }}>
                    {log.companyName}
                  </div>
                  <div style={{ flex: '1.2 1 140px', minWidth: '120px', color: 'var(--ads-text-sub)', fontSize: '12px', fontWeight: '600' }}>
                    {log.productName}
                  </div>
                  <div style={{ flex: '1.6 1 180px', minWidth: '150px', fontWeight: '800', color: 'var(--ads-text-main)', fontSize: '12.5px' }}>
                    {log.materialName}{' '}
                    <span style={{ fontSize: '11px', color: 'var(--ads-text-muted)', fontFamily: 'monospace' }}>
                      (#{log.clipId})
                    </span>
                  </div>
                  <div style={{ width: '75px', textAlign: 'right', fontWeight: '900', color: '#0d9488', fontSize: '12.5px', fontFamily: 'monospace', flexShrink: 0 }}>
                    {log.durationSec} sn
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsReportsTab;
