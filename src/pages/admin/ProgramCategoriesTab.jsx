/**
 * @file src/pages/admin/ProgramCategoriesTab.jsx
 * @description Admin Paneli - Resmi Excel Kategori Envanteri (&-PROGRAM KATEGORİLERİ- 2026- MART.xls)
 * üzerinden çıkarılan program kataloğunu inceleme ve Python ayrıştırıcısıyla yeniden yükleme sekmesi.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Search, RefreshCw, Layers, Tv, User, 
  FileSpreadsheet, Filter, ArrowUpDown, CheckCircle2, AlertCircle 
} from 'lucide-react';
import initialCatalog from '../../data/program_categories_catalog.json';

const CATEGORY_COLORS = {
  'Dini': { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
  'Kültürel': { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
  'Çocuk': { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
  'Kadın': { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' },
  'Kısa Program': { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', text: '#06b6d4' },
  'Haber': { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
  'Tanıtım': { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', text: '#14b8a6' },
  'Reklam': { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
  'Jenerik': { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', text: '#6366f1' },
  'Detay': { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)', text: '#8b5cf6' },
  'Ham': { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', text: '#64748b' }
};

const ProgramCategoriesTab = () => {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [isLoading, setIsLoading] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [notification, setNotification] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSheet, setSelectedSheet] = useState('all');
  const [sortBy, setSortBy] = useState('episodes-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Sayfa yüklendiğinde backend API'den güncel kataloğu çek
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/programCatalog');
        if (res.ok) {
          const data = await res.json();
          if (data && data.programs) {
            setCatalog(data);
          }
        }
      } catch (err) {
        console.warn('Backend katalog API hatası, yerel veri kullanılıyor:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  // Excel'den yeniden tara
  const handleReloadCatalog = async () => {
    try {
      setIsReloading(true);
      setNotification(null);
      const res = await fetch('/api/programCatalog/reload', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.data) {
          setCatalog(data.data);
        }
        setNotification({
          type: 'success',
          message: `Katalog başarıyla güncellendi! ${data.data?.totalCount || ''} program okundu.`
        });
      } else {
        throw new Error(data.error || 'Katalog yenilenemedi');
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Katalog yenilenirken hata oluştu: ' + err.message
      });
    } finally {
      setIsReloading(false);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  // Benzersiz sayfalar
  const sheets = useMemo(() => {
    if (!catalog?.programs) return [];
    const set = new Set();
    catalog.programs.forEach(p => {
      if (p.sheet) {
        p.sheet.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) set.add(trimmed);
        });
      }
    });
    return Array.from(set);
  }, [catalog]);

  // Filtreleme ve Sıralama
  const filteredPrograms = useMemo(() => {
    if (!catalog?.programs) return [];

    let list = catalog.programs.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (selectedSheet !== 'all') {
        const itemSheets = (p.sheet || '').split(',').map(s => s.trim());
        if (!itemSheets.includes(selectedSheet)) return false;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i');
        const name = (p.name || '').toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i');
        const presenter = (p.presenter || '').toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i');
        const cat = (p.category || '').toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i');
        const sheet = (p.sheet || '').toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i');
        
        return name.includes(query) || presenter.includes(query) || cat.includes(query) || sheet.includes(query);
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'episodes-desc') return (b.episodes || 0) - (a.episodes || 0);
      if (sortBy === 'episodes-asc') return (a.episodes || 0) - (b.episodes || 0);
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name, 'tr');
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name, 'tr');
      if (sortBy === 'category') return a.category.localeCompare(b.category, 'tr');
      return 0;
    });

    return list;
  }, [catalog, selectedCategory, selectedSheet, searchTerm, sortBy]);

  // Filtreler değişince 1. sayfaya dön
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedSheet, sortBy]);

  const totalPages = Math.ceil(filteredPrograms.length / itemsPerPage);
  const currentData = filteredPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const categoryCounts = catalog?.categoryCounts || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <BookOpen size={26} color="var(--accent-primary)" />
            Program Kataloğu & Kategori Arşivi
          </h2>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
            <strong>&-PROGRAM KATEGORİLERİ- 2026- MART.xls</strong> dosyasından derlenen {catalog?.totalCount || 340}+ tekilleştirilmiş TV programı, yayın kategorileri ve arşiv bölüm sayıları.
          </p>
        </div>

        <button
          onClick={handleReloadCatalog}
          disabled={isReloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '600',
            fontSize: '13px',
            cursor: isReloading ? 'not-allowed' : 'pointer',
            opacity: isReloading ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            transition: 'all 0.2s'
          }}
        >
          <RefreshCw size={16} className={isReloading ? 'spin-animation' : ''} />
          {isReloading ? 'Taranıyor...' : "Excel'den Kataloğu Yenile"}
        </button>
      </div>

      {/* Bildirim Alanı */}
      {notification && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: notification.type === 'success' ? '#10b981' : '#ef4444'
        }}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* KPI İstatistik Kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass" style={{ padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Tv size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>Toplam Program</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {(catalog?.totalCount || 0).toLocaleString('tr-TR')}
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>Toplam Bölüm Arşivi</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {(catalog?.totalEpisodes || 0).toLocaleString('tr-TR')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>bölüm</span>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Filter size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>Kategori Çeşitliliği</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {Object.keys(categoryCounts).length} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>kategori</span>
            </div>
          </div>
        </div>

        <div className="glass" style={{ padding: '20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>Excel Kaynak Dosyası</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px', wordBreak: 'break-all' }}>
              {catalog?.sourceFile || 'PROGRAM KATEGORİLERİ'}
            </div>
          </div>
        </div>
      </div>

      {/* Kategori Filtre Hapları (Pills) */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            border: '1px solid',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            background: selectedCategory === 'all' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
            borderColor: selectedCategory === 'all' ? 'var(--accent-primary)' : 'var(--border-color)',
            color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Tümü ({catalog?.totalCount || 0})
        </button>

        {Object.entries(categoryCounts).map(([cat, count]) => {
          const isSelected = selectedCategory === cat;
          const meta = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Genel Yayın'];
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                border: '1px solid',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                background: isSelected ? meta.text : 'var(--bg-secondary)',
                borderColor: isSelected ? meta.text : meta.border,
                color: isSelected ? '#fff' : meta.text
              }}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtre ve Arama Çubuğu */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Program adı, sunucu, sayfa ara..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              outline: 'none',
              fontSize: '13px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sayfa Filtresi */}
          <select
            value={selectedSheet}
            onChange={e => setSelectedSheet(e.target.value)}
            style={{
              padding: '9px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              outline: 'none',
              fontSize: '13px'
            }}
          >
            <option value="all">Tüm Excel Sayfaları ({sheets.length})</option>
            {sheets.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Sıralama */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={15} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding: '9px 12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                outline: 'none',
                fontSize: '13px'
              }}
            >
              <option value="episodes-desc">Bölüm: Çoktan Aza</option>
              <option value="episodes-asc">Bölüm: Azdan Çoka</option>
              <option value="name-asc">Program Adı: A → Z</option>
              <option value="name-desc">Program Adı: Z → A</option>
              <option value="category">Kategoriye Göre</option>
            </select>
          </div>

          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            <strong>{filteredPrograms.length}</strong> program listelendi
          </span>
        </div>
      </div>

      {/* Tablo */}
      <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', width: '50px' }}>#</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Program Adı</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Kategori</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>Bölüm Sayısı</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Sunucu / Programcı</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '13px' }}>Kaynak Sayfa</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((item, idx) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + idx + 1;
                const meta = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['Genel Yayın'];
                return (
                  <tr 
                    key={item.id || idx}
                    style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {globalIndex}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {item.name}
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: meta.bg,
                        color: meta.text,
                        border: `1px solid ${meta.border}`
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.text }} />
                        {item.category}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: item.episodes > 50 ? 'rgba(16, 185, 129, 0.12)' : (item.episodes > 0 ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-tertiary)'),
                        color: item.episodes > 50 ? '#10b981' : (item.episodes > 0 ? '#3b82f6' : 'var(--text-muted)')
                      }}>
                        {item.episodes > 0 ? `${item.episodes} Bölüm` : '—'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {item.presenter ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} color="var(--text-muted)" />
                          <span>{item.presenter}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {item.sheet}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {currentData.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Aramanıza veya filtre kriterlerinize uygun program bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Toplam <strong>{filteredPrograms.length}</strong> programdan <strong>{((currentPage - 1) * itemsPerPage) + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, filteredPrograms.length)}</strong> arası gösteriliyor
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              style={{
                padding: '8px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              Önceki
            </button>

            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '0 8px' }}>
              Sayfa <strong style={{ color: 'var(--text-primary)' }}>{currentPage}</strong> / {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              style={{
                padding: '8px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramCategoriesTab;
