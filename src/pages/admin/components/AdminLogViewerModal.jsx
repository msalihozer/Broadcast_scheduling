/**
 * @file src/pages/admin/components/AdminLogViewerModal.jsx
 * @description Admin paneli işlem geçmişi (audit logs) hızlı görüntüleme ve denetim modalı.
 * Tüm kategorileri (Günlük Listeler, Programlar, Reklamlar, Kullanıcılar, Güvenlik, MAM Arşiv, Sistem) destekler.
 */
import React, { useState, useMemo } from 'react';
import { 
  X, ClipboardList, Trash2, Search, 
  CheckCircle2, AlertTriangle, AlertCircle, Clock, Download, User as UserIcon
} from 'lucide-react';
import useAdminLogStore, { LOG_CATEGORIES } from '../../../store/adminLogStore';

export default function AdminLogViewerModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const { logs, clearLogs } = useAdminLogStore();
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const cat = log.category || log.panel || 'system';
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const hay = `${log.action || ''} ${log.details || ''} ${log.user || ''} ${log.module || ''}`.toLocaleLowerCase('tr-TR');
        return hay.includes(q);
      }
      return true;
    });
  }, [logs, categoryFilter, statusFilter, searchTerm]);

  const handleClear = () => {
    if (window.confirm('Seçili işlem log geçmişini silmek istediğinize emin misiniz?')) {
      clearLogs(categoryFilter);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `admin_logs_${categoryFilter}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatTimestamp = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (e) {
      return iso;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '940px',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Kategorize İşlem Geçmişi ve Güvenlik Logları
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Günlük listeler, yayın akışları, programlar, reklamlar, kullanıcılar ve güvenlik işlemlerinin denetim kaydı
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleExport}
              disabled={filteredLogs.length === 0}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Logları JSON olarak indir"
            >
              <Download size={13} />
              <span>Dışa Aktar</span>
            </button>

            <button
              onClick={handleClear}
              disabled={filteredLogs.length === 0}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Trash2 size={13} />
              <span>Temizle</span>
            </button>

            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          {/* Kategori Filtreleri */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {Object.values(LOG_CATEGORIES).map(tab => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${categoryFilter === tab.id ? tab.color : 'var(--border-color)'}`,
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: categoryFilter === tab.id ? tab.color : 'var(--bg-secondary)',
                  color: categoryFilter === tab.id ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s'
                }}
              >
                {tab.shortLabel}
              </button>
            ))}
          </div>

          {/* Arama */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '4px 10px',
            width: '240px'
          }}>
            <Search size={14} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Loglarda ara..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Logs List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{
              padding: '50px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ClipboardList size={36} color="var(--border-color)" />
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Seçili kategoride işlem logu bulunmuyor
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Günlük listelerde, programlarda ve sistem panellerinde yaptığınız işlemler otomatik olarak buraya kaydedilir.
              </div>
            </div>
          ) : (
            filteredLogs.map(log => {
              const isError = log.status === 'error';
              const isWarning = log.status === 'warning';
              const catKey = log.category || log.panel || 'system';
              const catMeta = LOG_CATEGORIES[catKey] || LOG_CATEGORIES.system;

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div style={{
                      marginTop: '2px',
                      color: isError ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981',
                      flexShrink: 0
                    }}>
                      {isError ? (
                        <AlertCircle size={16} />
                      ) : isWarning ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: `${catMeta.color}18`,
                          color: catMeta.color,
                          border: `1px solid ${catMeta.color}35`
                        }}>
                          {catMeta.shortLabel}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
                          {log.action}
                        </span>
                        {log.count !== null && log.count !== undefined && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-secondary)'
                          }}>
                            {log.count} Öğe
                          </span>
                        )}
                      </div>

                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {log.details}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      <UserIcon size={11} color="var(--accent-primary)" />
                      <span>{log.user || 'admin@yayin.local'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      <Clock size={11} />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <span>Gösterilen: <strong>{filteredLogs.length}</strong> / Toplam <strong>{logs.length}</strong> log kaydı</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
