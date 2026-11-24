/**
 * @file src/pages/admin/LogsTab.jsx
 * @description Admin Paneli - Kullanıcı Bazlı ve Kategori Bazlı Detaylı Sistem, Liste, Program,
 * Reklam, Kullanıcı ve Güvenlik Denetim Log Kayıtları sekmesi.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Search, Trash2, Download, CheckCircle2, AlertTriangle,
  AlertCircle, Clock, Shield, Users, List, Tv, PlaySquare, Film, Settings,
  User as UserIcon, Filter, X, RefreshCw, Calendar, Eye
} from 'lucide-react';
import useAdminLogStore, { LOG_CATEGORIES } from '../../store/adminLogStore';
import useAuthStore from '../../store/authStore';
import useDialogStore from '../../store/dialogStore';

const CATEGORY_MAP = LOG_CATEGORIES.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const CATEGORY_ICON_MAP = {
  all: <ClipboardList size={15} />,
  lists: <List size={15} />,
  programs: <Tv size={15} />,
  ads: <PlaySquare size={15} />,
  users: <Users size={15} />,
  security: <Shield size={15} />,
  mam: <Film size={15} />,
  system: <Settings size={15} />
};

export default function LogsTab() {
  const logs = useAdminLogStore(state => state.logs || []);
  const clearLogs = useAdminLogStore(state => state.clearLogs);
  const fetchLogsFromServer = useAdminLogStore(state => state.fetchLogsFromServer);
  const managedUsers = useAuthStore(state => state.managedUsers || []);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLogModal, setSelectedLogModal] = useState(null);

  useEffect(() => {
    if (typeof fetchLogsFromServer === 'function') {
      fetchLogsFromServer();
    }
  }, [fetchLogsFromServer]);

  // Kategori bazlı sayaçlar
  const categoryCounts = useMemo(() => {
    const counts = { all: logs.length };
    LOG_CATEGORIES.forEach(c => {
      if (c.id !== 'all') counts[c.id] = 0;
    });
    logs.forEach(log => {
      const cat = log.category || log.panel || 'system';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [logs]);

  // Kullanıcı bazlı özet istatistik kartları (Her kullanıcının kaç işlemi var, son işlemi ne zaman)
  const userSummaryCards = useMemo(() => {
    const byUser = new Map();
    managedUsers.forEach(u => {
      byUser.set(u.email, {
        email: u.email,
        name: u.name || u.username || u.email,
        role: u.role || 'user',
        total: 0,
        success: 0,
        warning: 0,
        error: 0,
        lastTimestamp: null,
        lastAction: 'Henüz kayıt yok'
      });
    });

    logs.forEach(l => {
      const email = l.user || 'admin@plan.com';
      if (!byUser.has(email)) {
        byUser.set(email, {
          email,
          name: l.userName || email.split('@')[0],
          role: l.role || 'user',
          total: 0,
          success: 0,
          warning: 0,
          error: 0,
          lastTimestamp: null,
          lastAction: ''
        });
      }
      const entry = byUser.get(email);
      entry.total += 1;
      if (l.status === 'error') entry.error += 1;
      else if (l.status === 'warning') entry.warning += 1;
      else entry.success += 1;

      if (!entry.lastTimestamp || new Date(l.timestamp) > new Date(entry.lastTimestamp)) {
        entry.lastTimestamp = l.timestamp;
        entry.lastAction = l.action || '';
      }
    });

    return Array.from(byUser.values()).sort((a, b) => b.total - a.total);
  }, [logs, managedUsers]);

  // Filtrelenmiş log listesi
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const cat = log.category || log.panel || 'system';
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (userFilter !== 'all' && log.user !== userFilter) return false;
      if (dateFilter && String(log.timestamp || '').slice(0, 10) !== dateFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const hay = `${log.action || ''} ${log.details || ''} ${log.user || ''} ${log.userName || ''} ${log.module || ''} ${log.target || ''} ${log.ip || ''}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, categoryFilter, statusFilter, userFilter, dateFilter, searchTerm]);

  const handleClearLogs = () => {
    const catMeta = CATEGORY_MAP[categoryFilter];
    useDialogStore.getState().showConfirm(
      'Log Kayıtlarını Temizle',
      categoryFilter === 'all'
        ? 'Tüm sistem ve kullanıcı denetim log geçmişini kalıcı olarak temizlemek istediğinize emin misiniz?'
        : `Yalnızca "${catMeta?.label || categoryFilter}" kategorisindeki log kayıtlarını temizlemek istediğinize emin misiniz?`,
      () => {
        clearLogs(categoryFilter);
      }
    );
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `sistem_loglari_${userFilter}_${categoryFilter}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportCsv = () => {
    const headers = ['Tarih/Saat', 'Kategori', 'Modül', 'Kullanıcı E-Posta', 'Kullanıcı Adı', 'Rol', 'Hedef/IP', 'İşlem', 'Detay', 'Adet', 'Durum'];
    const rows = filteredLogs.map(l => [
      l.timestamp || '',
      CATEGORY_MAP[l.category || l.panel]?.shortLabel || l.category || '',
      l.module || '',
      l.user || '',
      l.userName || '',
      l.role || '',
      l.target || l.ip || '',
      (l.action || '').replace(/"/g, '""'),
      (l.details || '').replace(/"/g, '""'),
      l.count ?? '',
      l.status || 'success'
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `sistem_loglari_${userFilter}_${categoryFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Üst Başlık ve Aksiyonlar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '18px 22px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Merkezi &amp; Kullanıcı Bazlı Denetim Log Kayıtları
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Tüm kullanıcıların yaptığı yayın listesi, program, reklam, MAM arşiv, yetki ve güvenlik işlemleri kullanıcı bazlı olarak kaydedilir.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchLogsFromServer && fetchLogsFromServer()}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 13px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} /> Sunucudan Yenile
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 13px',
              borderRadius: '8px',
              cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> CSV İndir
          </button>

          <button
            onClick={handleExportJson}
            disabled={filteredLogs.length === 0}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 13px',
              borderRadius: '8px',
              cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} /> JSON İndir
          </button>

          <button
            onClick={handleClearLogs}
            disabled={filteredLogs.length === 0}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Trash2 size={14} /> {categoryFilter === 'all' ? 'Tümünü Temizle' : 'Kategoriyi Temizle'}
          </button>
        </div>
      </div>

      {/* KULLANICI BAZLI LOG TAKİP KARTLARI */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Users size={17} style={{ color: 'var(--accent-primary)' }} />
            <span>Kullanıcı Bazlı İşlem Özeti (Kullanıcıya tıklayarak yalnızca o kullanıcının loglarını inceleyin)</span>
          </div>
          {userFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setUserFilter('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                background: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--accent-primary)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Tüm Kullanıcıları Göster ({logs.length})
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '10px'
        }}>
          {userSummaryCards.map(u => {
            const isSelected = userFilter === u.email;
            return (
              <button
                key={u.email}
                type="button"
                onClick={() => setUserFilter(isSelected ? 'all' : u.email)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'rgba(37, 99, 235, 0.14)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '12px',
                      flexShrink: 0
                    }}>
                      {String(u.name || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.email}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}>
                    {u.total} işlem
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{u.success}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>{u.warning}</span>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>X {u.error}</span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    {u.lastTimestamp ? formatTimestamp(u.lastTimestamp).slice(0, 16) : 'Kayıt yok'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kategori Sekmeleri */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '10px'
      }}>
        {LOG_CATEGORIES.map(cat => {
          const isSelected = categoryFilter === cat.id;
          const count = categoryCounts[cat.id] || 0;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 13px',
                borderRadius: '12px',
                border: `1.5px solid ${isSelected ? cat.color : 'var(--border-color)'}`,
                background: isSelected ? `${cat.color}18` : 'var(--bg-secondary)',
                color: isSelected ? cat.color : 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: `${cat.color}20`,
                  color: cat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {CATEGORY_ICON_MAP[cat.id]}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.shortLabel}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                    {count} kayıt
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Arama ve Alt Filtre Çubuğu */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '8px 12px',
          flex: '1 1 260px',
          maxWidth: '460px'
        }}>
          <Search size={15} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="İşlem, detay, kullanıcı, kanal, tarih veya program ara..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '13px',
              width: '100%'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Tarih Filtresi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="var(--text-secondary)" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600
              }}
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
              >
                Sıfırla
              </button>
            )}
          </div>

          {/* Kullanıcı Seçimi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserIcon size={14} color="var(--text-secondary)" />
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '7px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tüm Kullanıcılar ({userSummaryCards.length})</option>
              {userSummaryCards.map(u => (
                <option key={u.email} value={u.email}>{u.name} ({u.email}) — {u.total} kayıt</option>
              ))}
            </select>
          </div>

          {/* Durum Seçimi */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-secondary)" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '7px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tüm Durumlar</option>
              <option value="success">Başarılı</option>
              <option value="warning">Uyarı / Kritik</option>
              <option value="error">Hata</option>
            </select>
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Gösterilen: <strong>{filteredLogs.length}</strong> / {logs.length}
          </span>
        </div>
      </div>

      {/* Log Listesi */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <ClipboardList size={42} color="var(--border-color)" style={{ marginBottom: '10px' }} />
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Seçili kriterlere uygun log kaydı bulunamadı
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Filtreleri temizleyebilir veya farklı bir kullanıcı/kategori seçebilirsiniz.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLogs.map((log, idx) => {
              const catKey = log.category || log.panel || 'system';
              const catMeta = CATEGORY_MAP[catKey] || CATEGORY_MAP.system || LOG_CATEGORIES[0];
              const isError = log.status === 'error';
              const isWarning = log.status === 'warning';

              return (
                <div
                  key={log.id || idx}
                  onClick={() => setSelectedLogModal(log)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '16px',
                    padding: '14px 18px',
                    borderBottom: idx === filteredLogs.length - 1 ? 'none' : '1px solid var(--border-color)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      marginTop: '2px',
                      color: isError ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981',
                      flexShrink: 0
                    }}>
                      {isError ? <AlertCircle size={18} /> : isWarning ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: `${catMeta.color}18`,
                          color: catMeta.color,
                          border: `1px solid ${catMeta.color}35`
                        }}>
                          {catMeta.shortLabel}
                        </span>

                        {log.module && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)'
                          }}>
                            {log.module}
                          </span>
                        )}

                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {log.action}
                        </span>

                        {log.count !== null && log.count !== undefined && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            padding: '1px 7px',
                            borderRadius: '999px',
                            background: 'rgba(59, 130, 246, 0.14)',
                            color: '#3b82f6'
                          }}>
                            {log.count} öğe
                          </span>
                        )}
                      </div>

                      {log.details && (
                        <div style={{
                          fontSize: '12.5px',
                          color: 'var(--text-secondary)',
                          marginTop: '5px',
                          lineHeight: 1.45,
                          wordBreak: 'break-word'
                        }}>
                          {log.details}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sağ Taraf: Kullanıcı & Zaman */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '4px',
                    flexShrink: 0
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-tertiary)',
                      padding: '2px 9px',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <UserIcon size={11} color="var(--accent-primary)" />
                      <span>{log.userName ? `${log.userName} (${log.user})` : (log.user || 'Sistem')}</span>
                      {log.role && (
                        <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 800 }}>
                          • {String(log.role).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      <Clock size={11} />
                      <span>{formatTimestamp(log.timestamp)}</span>
                      <Eye size={12} style={{ marginLeft: '4px', color: 'var(--accent-primary)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LOG DETAY İNCELEME MODALI */}
      {selectedLogModal && (
        <div
          onClick={() => setSelectedLogModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '580px',
              borderRadius: '16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              padding: '22px 24px',
              boxShadow: '0 20px 45px rgba(15, 23, 42, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Log Kaydı Detayı
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLogModal(null)}
                style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr',
              gap: '8px 12px',
              fontSize: '12.5px',
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)'
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Kayıt ID:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedLogModal.id}</span>

              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Tarih / Saat:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatTimestamp(selectedLogModal.timestamp)}</span>

              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Kullanıcı:</span>
              <span style={{ fontWeight: 800 }}>{selectedLogModal.userName || ''} ({selectedLogModal.user || 'admin@plan.com'})</span>

              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Kullanıcı Rolü:</span>
              <span>{String(selectedLogModal.role || 'admin').toUpperCase()}</span>

              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Kategori / Modül:</span>
              <span>{CATEGORY_MAP[selectedLogModal.category || selectedLogModal.panel]?.label || selectedLogModal.category} — {selectedLogModal.module}</span>

              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>İşlem Başlığı:</span>
              <span style={{ fontWeight: 800 }}>{selectedLogModal.action}</span>

              {selectedLogModal.target && (
                <>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Hedef / Kaynak:</span>
                  <span>{selectedLogModal.target}</span>
                </>
              )}

              {selectedLogModal.ip && (
                <>
                  <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>İstemci IP:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedLogModal.ip}</span>
                </>
              )}

              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Açıklama / Detay:</span>
              <span style={{ lineHeight: 1.5 }}>{selectedLogModal.details}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setUserFilter(selectedLogModal.user || 'all');
                  setSelectedLogModal(null);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-primary)',
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--accent-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Bu Kullanıcının Tüm Loglarını Filtrele
              </button>
              <button
                type="button"
                onClick={() => setSelectedLogModal(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
