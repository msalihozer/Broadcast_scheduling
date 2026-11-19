/**
 * @file src/store/adminLogStore.js
 * @description Sistem genelinde (Güvenlik, Kullanıcılar & Yetkiler, Günlük Listeler & Akışlar,
 * Reklamlar, Programlar, MAM Arşivi ve Sistem Ayarları) yapılan tüm işlemlerin
 * KULLANICI BAZLI olarak kategorize edilip detaylıca loglanmasını, sunucu (/api/systemLogs) ile
 * senkronize edilmesini ve denetlenmesini sağlayan merkezi Zustand store.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const LOG_CATEGORIES = [
  { id: 'all', label: 'Tüm Kayıtlar', shortLabel: 'Tümü', color: '#3b82f6' },
  { id: 'lists', label: 'Günlük Listeler & Akışlar', shortLabel: 'Listeler & Akış', color: '#0ea5e9' },
  { id: 'programs', label: 'Programlar & Kurallar', shortLabel: 'Programlar', color: '#8b5cf6' },
  { id: 'ads', label: 'Reklamlar & Rezervasyon', shortLabel: 'Reklamlar', color: '#f59e0b' },
  { id: 'users', label: 'Kullanıcılar & Yetkiler', shortLabel: 'Kullanıcılar', color: '#10b981' },
  { id: 'security', label: 'Güvenlik & Oturum', shortLabel: 'Güvenlik', color: '#ef4444' },
  { id: 'mam', label: 'MAM Arşiv & Klipler', shortLabel: 'MAM Arşiv', color: '#ec4899' },
  { id: 'system', label: 'Sistem & Ayarlar', shortLabel: 'Sistem', color: '#64748b' }
];

const resolveCurrentUserContext = () => {
  try {
    const raw = localStorage.getItem('yayin_local_session') || sessionStorage.getItem('yayin_local_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      const email = parsed?.user?.email || 'admin@plan.com';
      const userName = parsed?.user?.user_metadata?.name || email.split('@')[0];
      const role = parsed?.role || 'base admin';
      return { email, userName, role };
    }
  } catch (e) {
    // ignore
  }
  return { email: 'admin@plan.com', userName: 'Sistem Yöneticisi', role: 'base admin' };
};

const INITIAL_SEED_LOGS = [
  {
    id: 'log_seed_1',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    panel: 'security',
    category: 'security',
    module: 'Kimlik Doğrulama',
    action: 'Güvenli Oturum Açıldı',
    details: 'admin@plan.com (Sistem Yöneticisi) Scrypt + HMAC doğrulaması ile sisteme giriş yaptı.',
    target: 'Uygulama Sunucusu',
    count: null,
    status: 'success',
    user: 'admin@plan.com',
    userName: 'Sistem Yöneticisi',
    role: 'base admin'
  },
  {
    id: 'log_seed_2',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    panel: 'programs',
    category: 'programs',
    module: 'Program Yönetimi',
    action: 'Program Havuzu & PostgreSQL Senkronize Edildi',
    details: '690 arşiv programı (54 aktif yayın programı) ve 15.368 klip PostgreSQL veritabanı ile doğrulandı.',
    target: 'PostgreSQL DB',
    count: 690,
    status: 'success',
    user: 'admin@plan.com',
    userName: 'Sistem Yöneticisi',
    role: 'base admin'
  },
  {
    id: 'log_seed_3',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    panel: 'lists',
    category: 'lists',
    module: 'Yayın Planlama',
    action: 'Günlük Yayın Akış Listesi Kaydedildi',
    details: 'Semerkand HD ve Semerkand WAY yayın akış listeleri PostgreSQL schedules tablosuna kaydedildi.',
    target: 'Semerkand HD / WAY',
    count: 70,
    status: 'success',
    user: 'admin@plan.com',
    userName: 'Sistem Yöneticisi',
    role: 'base admin'
  },
  {
    id: 'log_seed_4',
    timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    panel: 'ads',
    category: 'ads',
    module: 'Reklam Rezervasyon',
    action: 'Reklam Kuşakları Senkronize Edildi',
    details: 'Yayın akışındaki reklam kuşakları Reklam Rezervasyon modülüne iletildi.',
    target: 'Kategori #6 Reklam',
    count: 6,
    status: 'success',
    user: 'admin@plan.com',
    userName: 'Sistem Yöneticisi',
    role: 'base admin'
  }
];

export const useAdminLogStore = create(
  persist(
    (set, get) => ({
      logs: INITIAL_SEED_LOGS,
      isSyncedWithServer: false,

      /**
       * Sunucudan (/api/systemLogs) merkezi log geçmişini çeker ve yerel loglarla birleştirir.
       */
      fetchLogsFromServer: async () => {
        if (typeof fetch !== 'function') return;
        try {
          const res = await fetch('/api/systemLogs');
          if (!res.ok) return;
          const serverLogs = await res.json();
          if (Array.isArray(serverLogs) && serverLogs.length > 0) {
            set(state => {
              const byId = new Map();
              [...serverLogs, ...(state.logs || [])].forEach(item => {
                if (item && item.id) byId.set(item.id, item);
              });
              const merged = Array.from(byId.values()).sort(
                (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
              );
              return { logs: merged.slice(0, 2500), isSyncedWithServer: true };
            });
          }
        } catch (_) {}
      },

      /**
       * Yeni bir işlem log kaydı ekler (Kullanıcı bazlı detaylı kayıt + Sunucu senkronizasyonu).
       */
      addLog: ({
        panel,
        category,
        module = '',
        action,
        details = '',
        target = '',
        count = null,
        status = 'success',
        user = null,
        userName = null,
        role = null
      }) => {
        const resolvedCat = category || panel || 'system';
        const ctx = resolveCurrentUserContext();
        const finalUser = user || ctx.email;
        const finalUserName = userName || ctx.userName || String(finalUser).split('@')[0];
        const finalRole = role || ctx.role || 'user';

        const newLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          timestamp: new Date().toISOString(),
          panel: resolvedCat,
          category: resolvedCat,
          module: module || resolvedCat.toUpperCase(),
          action: action || 'Sistem İşlemi',
          details: details || '',
          target: target || '',
          count,
          status,
          user: finalUser,
          userName: finalUserName,
          role: finalRole
        };

        set(state => ({
          logs: [newLog, ...(state.logs || []).slice(0, 2499)]
        }));

        if (typeof fetch === 'function') {
          fetch('/api/systemLogs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLog)
          }).catch(() => {});
        }
      },

      /**
       * Belirli bir kategorideki veya tüm log kayıtlarını temizler.
       */
      clearLogs: (categoryFilter = 'all') => {
        if (!categoryFilter || categoryFilter === 'all') {
          set({ logs: [] });
        } else {
          set(state => ({
            logs: (state.logs || []).filter(l => (l.category || l.panel) !== categoryFilter)
          }));
        }
        if (typeof fetch === 'function') {
          fetch(`/api/systemLogs?category=${encodeURIComponent(categoryFilter || 'all')}`, {
            method: 'DELETE'
          }).catch(() => {});
        }
      },

      /**
       * Filtrelenmiş logları getirir.
       */
      getFilteredLogs: (panelFilter = 'all', statusFilter = 'all', searchQuery = '', userFilter = 'all') => {
        let list = get().logs || [];
        if (panelFilter !== 'all') {
          list = list.filter(l => (l.category || l.panel) === panelFilter);
        }
        if (statusFilter !== 'all') {
          list = list.filter(l => l.status === statusFilter);
        }
        if (userFilter !== 'all') {
          list = list.filter(l => l.user === userFilter);
        }
        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.toLocaleLowerCase('tr-TR').trim();
          list = list.filter(l =>
            String(l.action || '').toLocaleLowerCase('tr-TR').includes(q) ||
            String(l.details || '').toLocaleLowerCase('tr-TR').includes(q) ||
            String(l.user || '').toLocaleLowerCase('tr-TR').includes(q) ||
            String(l.userName || '').toLocaleLowerCase('tr-TR').includes(q) ||
            String(l.module || '').toLocaleLowerCase('tr-TR').includes(q) ||
            String(l.target || '').toLocaleLowerCase('tr-TR').includes(q)
          );
        }
        return list;
      }
    }),
    {
      name: 'admin_operation_logs_v3',
      partialize: (state) => ({ logs: state.logs })
    }
  )
);

export default useAdminLogStore;
