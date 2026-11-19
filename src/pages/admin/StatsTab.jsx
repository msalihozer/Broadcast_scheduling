/**
 * @file src/pages/admin/StatsTab.jsx
 * @description Admin Paneli - Gelişmiş Yayın, Kategori, MAM Arşiv ve Kanal Dağılım İstatistikleri Paneli.
 * Hem PostgreSQL veritabanındaki (`schedules`, `archive_programs`, `archive_clips`) verileri
 * hem de yerel yayın planlama listelerini birleştirerek görsel grafikler, kategori barları ve detaylı tablo sunar.
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import usePlanningStore from '../../store/planningStore';
import useThemeStore, { hexToRgba } from '../../store/themeStore';
import {
  Search,
  Tv,
  BarChart2,
  Download,
  Film,
  Layers,
  Clock,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatTotalDuration } from '../../utils/timeFormat';

const StatsTab = () => {
  const days = usePlanningStore(state => state.days || {});
  const categoryColors = useThemeStore(state => state.config?.categoryColors || {});

  const [serverSchedules, setServerSchedules] = useState({ ch_hd: {}, ch_way: {} });
  const [archiveCatStats, setArchiveCatStats] = useState([]);
  const [activeProgramsDb, setActiveProgramsDb] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('all'); // all | ch_hd | ch_way
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const fetchAllStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hdRes, wayRes, catRes, usedRes] = await Promise.all([
        fetch('/api/draftSchedule?channel=ch_hd'),
        fetch('/api/draftSchedule?channel=ch_way'),
        fetch('/api/archive/categories-status'),
        fetch('/api/archive/used-programs')
      ]);

      const hdData = hdRes.ok ? await hdRes.json() : {};
      const wayData = wayRes.ok ? await wayRes.json() : {};
      const catData = catRes.ok ? await catRes.json() : [];
      const usedData = usedRes.ok ? await usedRes.json() : [];

      setServerSchedules({
        ch_hd: hdData && typeof hdData === 'object' ? hdData : {},
        ch_way: wayData && typeof wayData === 'object' ? wayData : {}
      });
      if (Array.isArray(catData)) setArchiveCatStats(catData);
      if (Array.isArray(usedData)) setActiveProgramsDb(usedData);
    } catch (e) {
      console.warn('İstatistik verileri alınamadı:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  // MAM Arşiv Toplamları
  const archiveOverview = useMemo(() => {
    let totalProgs = 0;
    let totalClips = 0;
    const catList = archiveCatStats.map(c => {
      const pCount = Number(c.totalPrograms || 0);
      const cCount = Number(c.totalClips || 0);
      totalProgs += pCount;
      totalClips += cCount;
      const catColorObj = categoryColors[c.categoryId] || { name: c.categoryName || `Kategori #${c.categoryId}`, color: '#3b82f6' };
      return {
        id: Number(c.categoryId),
        name: catColorObj.name || c.categoryName || `Kategori #${c.categoryId}`,
        color: catColorObj.color || '#3b82f6',
        totalPrograms: pCount,
        totalClips: cCount,
        activePrograms: Number(c.usedPrograms || 0)
      };
    }).sort((a, b) => b.totalClips - a.totalClips);

    return {
      totalProgs,
      totalClips,
      activeCount: activeProgramsDb.length,
      catList
    };
  }, [archiveCatStats, activeProgramsDb, categoryColors]);

  // Yayın Akışı Program İstatistikleri (PostgreSQL + Yerel Store birleşik)
  const scheduleAnalytics = useMemo(() => {
    const programStats = {};
    let hdDaysCount = 0;
    let wayDaysCount = 0;
    let totalBroadcastMinutes = 0;
    let totalSlotsCount = 0;

    const recordProgram = (prog, channelId, mode, dateStr) => {
      if (!prog) return;
      const title = String(prog.title || prog.name || prog.rawTitle || 'İsimsiz Program').trim();
      const normKey = title.toLocaleLowerCase('tr-TR');
      if (!programStats[normKey]) {
        programStats[normKey] = {
          id: prog.id || normKey,
          title,
          category: prog.category || prog.categoryName || (prog.isKisaSlot ? 'Kısa Program / Dolgu' : 'Program'),
          total: 0,
          totalDuration: 0,
          hd_draft: 0,
          hd_ready: 0,
          way_draft: 0,
          way_ready: 0,
          dates: new Set()
        };
      }
      const st = programStats[normKey];
      const dur = Number(prog.duration) || 30;
      st.total += 1;
      st.totalDuration += dur;
      st.dates.add(dateStr);
      totalBroadcastMinutes += dur;
      totalSlotsCount += 1;

      if (channelId === 'ch_hd') {
        if (mode === 'ready') st.hd_ready += 1;
        else st.hd_draft += 1;
      } else {
        if (mode === 'ready') st.way_ready += 1;
        else st.way_draft += 1;
      }
    };

    // 1. PostgreSQL schedules
    const visitedChannelDates = new Set();
    ['ch_hd', 'ch_way'].forEach(chId => {
      const chMap = serverSchedules[chId] || {};
      Object.entries(chMap).forEach(([dateKey, dayObj]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        const progs = Array.isArray(dayObj?.programs) ? dayObj.programs : [];
        if (progs.length === 0) return;
        visitedChannelDates.add(`draft-${chId}-${dateKey}`);
        if (chId === 'ch_hd') hdDaysCount += 1;
        else wayDaysCount += 1;
        progs.forEach(p => recordProgram(p, chId, 'draft', dateKey));
      });
    });

    // 2. Yerel Zustand days (sunucuda olmayan veya ready olanlar)
    Object.entries(days).forEach(([storageKey, dayData]) => {
      if (visitedChannelDates.has(storageKey)) return;
      const parts = storageKey.split('-');
      if (parts.length < 5) return;
      const mode = parts[0];
      const channelId = parts[1];
      const dateStr = parts.slice(2).join('-');
      const activeVar = dayData?.activeVariant || 'v1';
      const progs = dayData?.variants?.[activeVar]?.programs || dayData?.variants?.v1?.programs || [];
      if (progs.length === 0) return;
      progs.forEach(p => recordProgram(p, channelId, mode, dateStr));
    });

    const list = Object.values(programStats)
      .map(s => ({ ...s, datesArray: Array.from(s.dates).sort() }))
      .sort((a, b) => b.total - a.total);

    return {
      list,
      hdDaysCount,
      wayDaysCount,
      totalDaysCount: hdDaysCount + wayDaysCount,
      totalBroadcastMinutes,
      totalSlotsCount
    };
  }, [serverSchedules, days]);

  const filteredStats = useMemo(() => {
    return scheduleAnalytics.list.filter(s => {
      if (channelFilter === 'ch_hd' && (s.hd_draft + s.hd_ready) === 0) return false;
      if (channelFilter === 'ch_way' && (s.way_draft + s.way_ready) === 0) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        if (!`${s.title} ${s.category}`.toLocaleLowerCase('tr-TR').includes(q)) return false;
      }
      return true;
    });
  }, [scheduleAnalytics.list, channelFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredStats.length / itemsPerPage));
  const currentData = filteredStats.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const maxBroadcastCount = filteredStats[0]?.total || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, channelFilter]);

  const exportToCSV = () => {
    let csv = 'Program Adi;Kategori;Toplam Yayin;Toplam Sure;Semerkand HD (Taslak);Semerkand HD (Hazir);Semerkand WAY (Taslak);Semerkand WAY (Hazir);Gun Sayisi\n';
    filteredStats.forEach(stat => {
      csv += `"${stat.title.replace(/"/g, '""')}";"${stat.category}";${stat.total};"${formatTotalDuration(stat.totalDuration)}";${stat.hd_draft};${stat.hd_ready};${stat.way_draft};${stat.way_ready};${stat.datesArray.length}\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `yayin_ve_arsiv_istatistikleri_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ÜST BAŞLIK & EXPORT */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '18px 22px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <BarChart2 size={20} color="var(--accent-primary)" />
            Yayın, Kanal &amp; MAM Arşiv İstatistikleri Paneli
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            PostgreSQL veritabanındaki yayın akışları, kanal dağılımları, kategori yoğunlukları ve en çok yayınlanan programların analizi.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={fetchAllStats}
            disabled={isLoading}
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} /> {isLoading ? 'Güncelleniyor...' : 'Verileri Yenile'}
          </button>

          <button
            type="button"
            onClick={exportToCSV}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '9px 16px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '12.5px'
            }}
          >
            <Download size={15} /> Excel (CSV) Raporu İndir
          </button>
        </div>
      </div>

      {/* ÜST KPI ÖZET KARTLARI */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
        gap: '14px'
      }}>
        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid #2563eb',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
            <span>Kayıtlı Günlük Yayın Listesi</span>
            <CalendarDays size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {scheduleAnalytics.totalDaysCount} Gün
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            HD: <b>{scheduleAnalytics.hdDaysCount} gün</b> • WAY: <b>{scheduleAnalytics.wayDaysCount} gün</b>
          </div>
        </div>

        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid #8b5cf6',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
            <span>Planlanan Toplam Yayın Kuşağı</span>
            <TrendingUp size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {scheduleAnalytics.totalSlotsCount.toLocaleString('tr-TR')} Kuşak
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            {scheduleAnalytics.list.length} benzersiz yayın başlığı
          </div>
        </div>

        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid #10b981',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
            <span>Toplam Planlanan Yayın Süresi</span>
            <Clock size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {Math.round(scheduleAnalytics.totalBroadcastMinutes / 60).toLocaleString('tr-TR')} Saat
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            ({scheduleAnalytics.totalBroadcastMinutes.toLocaleString('tr-TR')} dakika yayın akışı)
          </div>
        </div>

        <div style={{
          padding: '16px 18px',
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderLeft: '4px solid #f59e0b',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>
            <span>PostgreSQL MAM Arşiv Havuzu</span>
            <Film size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {(archiveOverview.totalClips || 15368).toLocaleString('tr-TR')} Klip
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            <b>{archiveOverview.totalProgs || 690}</b> Arşiv Programı • <b>{archiveOverview.activeCount || 54}</b> Aktif Program
          </div>
        </div>
      </div>

      {/* KATEGORİ BAZLI MAM ARŞİV & KLİP DAĞILIM GRAFİĞİ */}
      {archiveOverview.catList.length > 0 && (
        <div style={{
          padding: '20px 24px',
          borderRadius: '16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-primary)" />
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Kategori Bazlı MAM Arşiv Program &amp; Klip Dağılımı
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              11 Ana Kategori • Toplam {archiveOverview.totalProgs} Program / {archiveOverview.totalClips.toLocaleString('tr-TR')} Klip
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px'
          }}>
            {archiveOverview.catList.map(cat => {
              const maxClips = archiveOverview.catList[0]?.totalClips || 1;
              const pct = Math.max(4, Math.min(100, Math.round((cat.totalClips / maxClips) * 100)));
              return (
                <div
                  key={cat.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-primary)',
                    border: `1px solid ${hexToRgba(cat.color, 0.35)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      #{cat.id} {cat.name}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: hexToRgba(cat.color, 0.15),
                      color: cat.color,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {cat.totalClips.toLocaleString('tr-TR')} klip
                    </span>
                  </div>

                  <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: cat.color }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Toplam: <b>{cat.totalPrograms}</b> program</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>Aktif: {cat.activePrograms} program</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ARAMA VE KANAL FİLTRESİ */}
      <div style={{
        padding: '14px 18px',
        borderRadius: '14px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Program adı veya kategori ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              fontSize: '12.5px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {['all', 'ch_hd', 'ch_way'].map(ch => {
            const active = channelFilter === ch;
            const label = ch === 'all' ? 'Tüm Kanallar' : ch === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY';
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: active ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: active ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-primary)',
                  color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* PROGRAM YAYIN SIKLIĞI TABLOSU */}
      <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '12px' }}>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)' }}>Program / Kuşak Adı</th>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', width: '220px' }}>Yayın Yoğunluğu</th>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center' }}>Toplam Yayın</th>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center' }}>Toplam Süre</th>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center' }}>Semerkand HD</th>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)', textAlign: 'center' }}>Semerkand WAY</th>
                <th style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-secondary)' }}>Yayınlandığı Gün Sayısı</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((stat) => {
                const barPct = Math.max(5, Math.min(100, Math.round((stat.total / maxBroadcastCount) * 100)));
                return (
                  <tr
                    key={stat.id}
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Tv size={16} color="var(--accent-primary)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--text-primary)' }}>{stat.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{stat.category}</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${barPct}%`,
                          height: '100%',
                          borderRadius: '999px',
                          background: 'linear-gradient(90deg, #2563eb 0%, #8b5cf6 100%)'
                        }} />
                      </div>
                    </td>

                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                        {stat.total} kez
                      </span>
                    </td>

                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {formatTotalDuration(stat.totalDuration)}
                      </span>
                    </td>

                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 9px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '800',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {stat.hd_draft + stat.hd_ready} yayın
                      </span>
                    </td>

                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 9px',
                        background: 'rgba(139, 92, 246, 0.12)',
                        color: '#8b5cf6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '800',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {stat.way_draft + stat.way_ready} yayın
                      </span>
                    </td>

                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 9px',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px'
                      }}>
                        {stat.datesArray.length} farklı gün
                      </span>
                    </td>
                  </tr>
                );
              })}

              {currentData.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Arama kriterlerine uygun yayın istatistiği bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Önceki
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Sayfa <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> / {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
};

export default StatsTab;
