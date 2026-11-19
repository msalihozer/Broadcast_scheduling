/**
 * @file authStore.js
 * @description Kullanıcı Kimlik Doğrulama, Rol ve Modül/Admin Sekmesi Yetki Yönetimi Deposu (Zustand).
 * 
 * Temel Sorumluluklar:
 * 1. Supabase Auth veya Yerel Oturum başlatma, takip etme ve sonlandırma
 * 2. Kullanıcı bazlı Modül Erişim Yetkileri (`allowedModules`) ve Admin Paneli Sekme Yetkileri (`allowedAdminTabs`) yönetimi
 * 3. Güvenlik ve kullanıcı yönetim işlemlerini merkezi denetim loguna (`useAdminLogStore`) kaydetme
 */
import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAdminLogStore } from './adminLogStore';

export const SYSTEM_MODULES = [
  { id: 'draft', label: 'Taslak Planla', color: '#2563eb', description: 'Haftalık ve aylık şablon yayın akışı planlama' },
  { id: 'ready', label: 'Yayın Planlama', color: '#0ea5e9', description: 'Günlük yayın akış listesi hazırlama ve MAM klip atama' },
  { id: 'ads', label: 'Reklam Rezervasyon', color: '#d97706', description: 'Firma, marka, materyal ve reklam kuşağı rezervasyonu' },
  { id: 'list-control', label: 'Yayın Liste Kontrol', color: '#10b981', description: 'Salt-okunur günlük/haftalık yayın akış izleme ve PDF çıktı' },
  { id: 'admin', label: 'Admin Paneli', color: '#8b5cf6', description: 'Sistem yönetimi (erişilecek alt sekmeler ayrıca seçilir)' },
];

export const ADMIN_PANEL_TABS = [
  { id: 'overview', label: 'Genel Bakış', description: 'Sistem özet kartları ve hızlı durum' },
  { id: 'server-monitor', label: 'Sunucu & Docker Takip', description: 'Uygulama sunucusu, Docker PostgreSQL, Watchdog ve uzaktan restart yönetimi' },
  { id: 'programs', label: 'Programlar & Kurallar', description: 'Aktif yayın programları ve ayrıştırma kuralları' },
  { id: 'archive-analysis', label: 'MAM Arşiv & Bölümler', description: 'MSSQL Libero MAM kategori ve klip yönetimi' },
  { id: 'users', label: 'Kullanıcı & Yetki Yönetimi', description: 'Kullanıcı hesapları, modül ve admin sekmesi yetkileri' },
  { id: 'lists', label: 'Listeler', description: 'Kayıtlı yayın listeleri yönetimi' },
  { id: 'stats', label: 'İstatistikler', description: 'Yayın ve kategori dağılım istatistikleri' },
  { id: 'ads', label: 'Reklam Yönetimi', description: 'MAM Kategori 6 reklam arşivi senkronizasyonu' },
  { id: 'logs', label: 'Log Kayıtları', description: 'Güvenlik, kullanıcı, liste, reklam ve sistem denetim logları' },
  { id: 'themes', label: 'Temalar & Renkler', description: 'Kategori, gün, kuşak, reklam kuşağı renkleri ve yazı fontu özelleştirme' },
  { id: 'settings', label: 'Sistem Ayarları', description: 'Medya kütüphanesi kategori filtreleme, jenerik ve tema ayarları' },
];

export const ALL_MODULE_IDS = SYSTEM_MODULES.map(m => m.id);
export const ALL_ADMIN_TAB_IDS = ADMIN_PANEL_TABS.map(t => t.id);

export const ROLE_DEFAULT_PERMISSIONS = {
  'base admin': {
    allowedModules: [...ALL_MODULE_IDS],
    allowedAdminTabs: [...ALL_ADMIN_TAB_IDS]
  },
  'admin': {
    allowedModules: [...ALL_MODULE_IDS],
    allowedAdminTabs: [...ALL_ADMIN_TAB_IDS]
  },
  'yonetmen': {
    allowedModules: ['draft', 'ready', 'list-control', 'admin'],
    allowedAdminTabs: ['overview', 'programs', 'archive-analysis', 'lists', 'stats']
  },
  'reklam': {
    allowedModules: ['ads', 'list-control', 'admin'],
    allowedAdminTabs: ['overview', 'ads', 'stats']
  },
  'user': {
    allowedModules: ['list-control'],
    allowedAdminTabs: []
  }
};

export const DEFAULT_ROLE_TEMPLATES = [
  {
    id: 'base admin',
    label: 'Base Admin (Tam Yetkili Kurucu)',
    description: 'Tüm modüller, sunucu yönetimi, veritabanı ve güvenlik ayarlarına tam erişim.',
    color: '#ef4444',
    isSystem: true,
    allowedModules: [...ALL_MODULE_IDS],
    allowedAdminTabs: [...ALL_ADMIN_TAB_IDS]
  },
  {
    id: 'admin',
    label: 'Sistem Yöneticisi (Admin)',
    description: 'Tüm yayın planlama modülleri ve yönetim paneli sekmelerine tam erişim.',
    color: '#6366f1',
    isSystem: true,
    allowedModules: [...ALL_MODULE_IDS],
    allowedAdminTabs: [...ALL_ADMIN_TAB_IDS]
  },
  {
    id: 'yonetmen',
    label: 'Yayın Yönetmeni',
    description: 'Taslak planlama, yayına hazır liste hazırlama, MAM arşiv ve program yönetimi.',
    color: '#10b981',
    isSystem: false,
    allowedModules: ['draft', 'ready', 'list-control', 'admin'],
    allowedAdminTabs: ['overview', 'programs', 'archive-analysis', 'lists', 'stats']
  },
  {
    id: 'reklam',
    label: 'Reklam & Rezervasyon Sorumlusu',
    description: 'Reklam kuşakları, spot yerleştirme, firma/marka rezervasyon ve yayın kontrolü.',
    color: '#f59e0b',
    isSystem: false,
    allowedModules: ['ads', 'list-control', 'admin'],
    allowedAdminTabs: ['overview', 'ads', 'stats']
  },
  {
    id: 'user',
    label: 'Standart Kullanıcı (İzleyici / MCR)',
    description: 'Yalnızca Yayın Kontrol (salt-okunur günlük/haftalık yayın akışı ve PDF çıktı) ekranı.',
    color: '#64748b',
    isSystem: false,
    allowedModules: ['list-control'],
    allowedAdminTabs: []
  }
];

const ROLE_TEMPLATES_STORAGE_KEY = 'yayin_role_templates_v1';

const loadRoleTemplates = () => {
  try {
    const raw = localStorage.getItem(ROLE_TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return DEFAULT_ROLE_TEMPLATES;
};

const saveRoleTemplates = (templates) => {
  try {
    localStorage.setItem(ROLE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (_) {}
  if (typeof fetch === 'function') {
    fetch('/api/roleTemplates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templates)
    }).catch(() => {});
  }
};

const DEFAULT_MANAGED_USERS = [
  {
    id: 'usr_admin',
    name: 'Sistem Yöneticisi',
    username: 'admin',
    email: 'admin@plan.com',
    hasPassword: true,
    role: 'base admin',
    isActive: true,
    allowedModules: [...ALL_MODULE_IDS],
    allowedAdminTabs: [...ALL_ADMIN_TAB_IDS],
    updatedAt: '2026-11-19T12:00:00.000Z'
  }
];

const MANAGED_USERS_STORAGE_KEY = 'yayin_managed_users_v3';

const normalizeUserList = (list) => {
  if (!Array.isArray(list) || list.length === 0) return DEFAULT_MANAGED_USERS;
  return list.map(u => {
    const def = ROLE_DEFAULT_PERMISSIONS[u.role] || ROLE_DEFAULT_PERMISSIONS.user;
    const rawEmail = String(u.email || u.username || 'admin@plan.com').toLowerCase().trim();
    const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@plan.com`;
    const username = String(u.username || email.split('@')[0]).toLowerCase().trim();
    const { password, ...safeUser } = u;
    return {
      ...safeUser,
      username,
      email,
      hasPassword: true,
      isActive: u.isActive !== false,
      allowedModules: Array.isArray(u.allowedModules) ? u.allowedModules : [...def.allowedModules],
      allowedAdminTabs: Array.isArray(u.allowedAdminTabs) ? u.allowedAdminTabs : [...def.allowedAdminTabs]
    };
  });
};

const loadManagedUsers = () => {
  try {
    const raw = localStorage.getItem(MANAGED_USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeUserList(parsed);
      }
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_MANAGED_USERS;
};

const saveManagedUsers = (users) => {
  const safeForLocalStorage = normalizeUserList(users);
  try {
    localStorage.setItem(MANAGED_USERS_STORAGE_KEY, JSON.stringify(safeForLocalStorage));
  } catch (e) {
    // ignore
  }
  // Sunucu (PostgreSQL / Backend) ile senkronize et (Sunucu yeni şifreleri Scrypt ile hashler)
  if (typeof fetch === 'function') {
    fetch('/api/managedUsers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users)
    }).catch(() => {});
  }
};

const clearSupabaseTokens = () => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    // ignore
  }
};

const determineRole = (email, managedUsers = []) => {
  if (!email) return 'user';
  const normalizedEmail = email.includes('@') ? email.toLowerCase().trim() : `${email.toLowerCase().trim()}@plan.com`;
  const foundUser = managedUsers.find(u => String(u.email || '').toLowerCase().trim() === normalizedEmail);
  if (foundUser && foundUser.role) {
    return foundUser.role;
  }
  const username = email.split('@')[0].toLowerCase().trim();
  if (username === 'admin') return 'admin';
  if (username === 'base admin' || username === 'baseadmin') return 'base admin';
  if (username === 'yonetmen') return 'yonetmen';
  if (username === 'reklam') return 'reklam';
  return 'user';
};

const getSavedLocalSession = () => {
  try {
    const isRemembered = localStorage.getItem('yayin_remember_me') !== 'false';
    const raw = isRemembered 
      ? (localStorage.getItem('yayin_local_session') || sessionStorage.getItem('yayin_local_session'))
      : sessionStorage.getItem('yayin_local_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

const useAuthStore = create((set, get) => ({
  user: null,
  role: null,
  session: null,
  isLoading: true,
  managedUsers: loadManagedUsers(),
  roleTemplates: loadRoleTemplates(),

  /**
   * Rol şablonunu ID ile bulur.
   */
  getRoleTemplate: (roleId) => {
    const templates = get().roleTemplates || DEFAULT_ROLE_TEMPLATES;
    return templates.find(t => t.id === roleId) || ROLE_DEFAULT_PERMISSIONS[roleId] || ROLE_DEFAULT_PERMISSIONS.user;
  },

  /**
   * Yeni Temel Rol Şablonu ekler.
   */
  addRoleTemplate: (tplData) => {
    const current = get().roleTemplates || DEFAULT_ROLE_TEMPLATES;
    const rawId = String(tplData.id || tplData.label || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9_-]/g, '_') || `rol_${Date.now()}`;
    const id = current.some(t => t.id === rawId) ? `${rawId}_${Date.now().toString().slice(-4)}` : rawId;
    const allowedAdminTabs = Array.isArray(tplData.allowedAdminTabs) ? tplData.allowedAdminTabs : [];
    const modSet = new Set(Array.isArray(tplData.allowedModules) ? tplData.allowedModules : ['list-control']);
    if (allowedAdminTabs.length > 0) modSet.add('admin');

    const newTpl = {
      id,
      label: String(tplData.label || id).trim(),
      description: String(tplData.description || '').trim(),
      color: tplData.color || '#3b82f6',
      isSystem: false,
      allowedModules: Array.from(modSet),
      allowedAdminTabs
    };
    const updated = [...current, newTpl];
    saveRoleTemplates(updated);
    set({ roleTemplates: updated });
    useAdminLogStore.getState().addLog({
      category: 'users',
      module: 'Temel Rol Şablonları',
      action: 'Yeni Rol Şablonu Oluşturuldu',
      details: `"${newTpl.label}" (${newTpl.id}) rol şablonu eklendi. Modüller: [${newTpl.allowedModules.join(', ')}]`,
      status: 'success'
    });
    return newTpl;
  },

  /**
   * Mevcut Temel Rol Şablonunu günceller.
   */
  updateRoleTemplate: (roleId, updates) => {
    const current = get().roleTemplates || DEFAULT_ROLE_TEMPLATES;
    let target = null;
    const updated = current.map(t => {
      if (t.id !== roleId) return t;
      const nextTabs = Array.isArray(updates.allowedAdminTabs) ? updates.allowedAdminTabs : t.allowedAdminTabs;
      const modSet = new Set(Array.isArray(updates.allowedModules) ? updates.allowedModules : t.allowedModules);
      if (nextTabs.length > 0) modSet.add('admin');
      target = {
        ...t,
        ...updates,
        allowedModules: Array.from(modSet),
        allowedAdminTabs: nextTabs
      };
      return target;
    });
    saveRoleTemplates(updated);
    set({ roleTemplates: updated });
    if (target) {
      useAdminLogStore.getState().addLog({
        category: 'users',
        module: 'Temel Rol Şablonları',
        action: 'Rol Şablonu Güncellendi',
        details: `"${target.label}" rol şablonunun varsayılan modül (${target.allowedModules.length}) ve admin sekmesi (${target.allowedAdminTabs.length}) yetkileri güncellendi.`,
        status: 'success'
      });
    }
    return target;
  },

  /**
   * Özel eklenen bir Rol Şablonunu siler.
   */
  deleteRoleTemplate: (roleId) => {
    const current = get().roleTemplates || DEFAULT_ROLE_TEMPLATES;
    const target = current.find(t => t.id === roleId);
    if (!target || target.isSystem) return false;
    const updated = current.filter(t => t.id !== roleId);
    saveRoleTemplates(updated);
    set({ roleTemplates: updated });
    useAdminLogStore.getState().addLog({
      category: 'users',
      module: 'Temel Rol Şablonları',
      action: 'Rol Şablonu Silindi',
      details: `"${target.label}" rol şablonu kaldırıldı.`,
      status: 'warning'
    });
    return true;
  },

  /**
   * Oturum açmış kullanıcının erişebileceği modülleri ve admin paneli sekmelerini döndürür.
   */
  getCurrentUserPermissions: () => {
    const { user, role, managedUsers } = get();
    const email = String(user?.email || '').toLowerCase().trim();
    const matched = managedUsers.find(u => String(u.email || '').toLowerCase().trim() === email);

    if (matched) {
      const hasAdminTabs = Array.isArray(matched.allowedAdminTabs) && matched.allowedAdminTabs.length > 0;
      const modules = new Set(Array.isArray(matched.allowedModules) ? matched.allowedModules : []);
      if (hasAdminTabs) modules.add('admin');
      return {
        userRecord: matched,
        role: matched.role || role || 'user',
        allowedModules: Array.from(modules),
        allowedAdminTabs: Array.isArray(matched.allowedAdminTabs) ? matched.allowedAdminTabs : []
      };
    }

    const effectiveRole = role || determineRole(email, managedUsers);
    const defaults = ROLE_DEFAULT_PERMISSIONS[effectiveRole] || ROLE_DEFAULT_PERMISSIONS.user;
    return {
      userRecord: null,
      role: effectiveRole,
      allowedModules: [...defaults.allowedModules],
      allowedAdminTabs: [...defaults.allowedAdminTabs]
    };
  },

  /**
   * Yeni kullanıcı ekler ve yetkilerini kaydeder.
   */
  addManagedUser: (userData) => {
    const currentUsers = get().managedUsers;
    const rawEmail = String(userData.email || '').trim().toLowerCase();
    const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@plan.com`;
    const role = userData.role || 'user';
    const roleDef = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.user;

    const allowedAdminTabs = Array.isArray(userData.allowedAdminTabs)
      ? userData.allowedAdminTabs
      : [...roleDef.allowedAdminTabs];

    const modulesSet = new Set(
      Array.isArray(userData.allowedModules) ? userData.allowedModules : [...roleDef.allowedModules]
    );
    if (allowedAdminTabs.length > 0) {
      modulesSet.add('admin');
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name: String(userData.name || email.split('@')[0]).trim(),
      username: email.split('@')[0].toLowerCase().trim(),
      email,
      password: String(userData.password || '').trim(),
      role,
      isActive: userData.isActive !== false,
      allowedModules: Array.from(modulesSet),
      allowedAdminTabs,
      updatedAt: new Date().toISOString()
    };

    const updated = [...currentUsers, newUser];
    saveManagedUsers(updated);
    set({ managedUsers: updated });

    useAdminLogStore.getState().addLog({
      category: 'users',
      module: 'Kullanıcı Yönetimi',
      action: 'Yeni Kullanıcı Oluşturuldu',
      details: `${newUser.name} (${newUser.email}) — Rol: ${newUser.role.toUpperCase()}, Modüller: [${newUser.allowedModules.join(', ')}], Admin Sekmeleri: [${newUser.allowedAdminTabs.join(', ')}]`,
      count: 1,
      status: 'success'
    });

    return newUser;
  },

  /**
   * Mevcut kullanıcının bilgilerini, modül ve admin sekmesi yetkilerini günceller.
   */
  updateManagedUser: (userId, updates) => {
    const currentUsers = get().managedUsers;
    let updatedTarget = null;

    const updated = currentUsers.map(u => {
      if (u.id !== userId) return u;
      const nextAdminTabs = Array.isArray(updates.allowedAdminTabs)
        ? updates.allowedAdminTabs
        : u.allowedAdminTabs;
      const nextModulesSet = new Set(
        Array.isArray(updates.allowedModules) ? updates.allowedModules : u.allowedModules
      );
      if (nextAdminTabs.length > 0) {
        nextModulesSet.add('admin');
      } else if (updates.allowedAdminTabs && updates.allowedAdminTabs.length === 0 && !updates.keepAdminModule) {
        // Eğer tüm admin sekmeleri kaldırıldıysa ve açıkça admin modülü bırakılmadıysa
      }

      updatedTarget = {
        ...u,
        ...updates,
        allowedModules: Array.from(nextModulesSet),
        allowedAdminTabs: nextAdminTabs,
        updatedAt: new Date().toISOString()
      };
      return updatedTarget;
    });

    saveManagedUsers(updated);

    // Eğer güncellenen kullanıcı şu anki oturum kullanıcısıysa rolünü de senkronize et
    const currentSessionUser = get().user;
    if (
      updatedTarget &&
      currentSessionUser &&
      String(currentSessionUser.email || '').toLowerCase() === String(updatedTarget.email || '').toLowerCase()
    ) {
      set({ managedUsers: updated, role: updatedTarget.role });
    } else {
      set({ managedUsers: updated });
    }

    if (updatedTarget) {
      useAdminLogStore.getState().addLog({
        category: 'users',
        module: 'Kullanıcı & Yetki Yönetimi',
        action: 'Kullanıcı Yetkileri Güncellendi',
        details: `${updatedTarget.name} (${updatedTarget.email}) — Rol: ${updatedTarget.role.toUpperCase()} | Modüller (${updatedTarget.allowedModules.length}): ${updatedTarget.allowedModules.join(', ')} | Admin Sekmeleri (${updatedTarget.allowedAdminTabs.length}): ${updatedTarget.allowedAdminTabs.join(', ') || 'Yok'}`,
        count: 1,
        status: 'success'
      });
    }

    return updatedTarget;
  },

  /**
   * Kullanıcıyı siler.
   */
  deleteManagedUser: (userId) => {
    const currentUsers = get().managedUsers;
    const target = currentUsers.find(u => u.id === userId);
    if (!target) return false;

    const updated = currentUsers.filter(u => u.id !== userId);
    saveManagedUsers(updated);
    set({ managedUsers: updated });

    useAdminLogStore.getState().addLog({
      category: 'users',
      module: 'Kullanıcı Yönetimi',
      action: 'Kullanıcı Silindi',
      details: `${target.name} (${target.email}) kullanıcı hesabı sistemden kaldırıldı.`,
      count: 1,
      status: 'warning'
    });

    return true;
  },

  initialize: async () => {
    try {
      let managedUsers = loadManagedUsers();
      set({ managedUsers });

      // Sunucudan güncel kullanıcı listesini ve temel rol şablonlarını çek
      try {
        const [res, tplRes] = await Promise.all([
          fetch('/api/managedUsers'),
          fetch('/api/roleTemplates')
        ]);
        if (res.ok) {
          const serverUsers = await res.json();
          if (Array.isArray(serverUsers) && serverUsers.length > 0) {
            managedUsers = normalizeUserList(serverUsers);
            localStorage.setItem(MANAGED_USERS_STORAGE_KEY, JSON.stringify(managedUsers));
            set({ managedUsers });
          }
        }
        if (tplRes && tplRes.ok) {
          const serverTemplates = await tplRes.json();
          if (Array.isArray(serverTemplates) && serverTemplates.length > 0) {
            localStorage.setItem(ROLE_TEMPLATES_STORAGE_KEY, JSON.stringify(serverTemplates));
            set({ roleTemplates: serverTemplates });
          }
        }
      } catch (_) {}

      // 1. Önce kayıtlı yerel oturum var mı kontrol et
      const localSession = getSavedLocalSession();
      if (localSession) {
        const email = String(localSession.user?.email || '').toLowerCase().trim();
        const validUser = managedUsers.find(u => u.email === email && u.isActive !== false);
        if (!validUser) {
          localStorage.removeItem('yayin_local_session');
          sessionStorage.removeItem('yayin_local_session');
          set({ session: null, user: null, role: null, isLoading: false });
          return;
        }
        const resolvedRole = validUser.role || determineRole(email, managedUsers);
        set({
          session: localSession.session || localSession,
          user: localSession.user,
          role: resolvedRole,
          isLoading: false
        });
        return;
      }

      // 2. Beni Hatırla kontrolü
      const rememberMe = localStorage.getItem('yayin_remember_me') !== 'false';
      if (!rememberMe && !sessionStorage.getItem('yayin_session_active')) {
        clearSupabaseTokens();
        set({ session: null, user: null, role: null, isLoading: false });
        return;
      }

      // 3. Supabase yapılandırılmamışsa doğrudan yüklemeyi bitir
      if (!isSupabaseConfigured) {
        set({ session: null, user: null, role: null, isLoading: false });
        return;
      }

      // 4. Supabase oturumunu zaman aşımı (1.5 saniye) ile sorgula
      let session = null;
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase timeout')), 1500)
        );
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise
        ]);
        if (!error && data?.session) {
          session = data.session;
        }
      } catch (err) {
        console.warn('[AUTH] Supabase oturumu okunamadı veya sunucu kapalı:', err?.message || err);
        clearSupabaseTokens();
      }

      if (session) {
        const user = session.user;
        let role = determineRole(user.email, managedUsers);

        try {
          const roleTimeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Role timeout')), 1000)
          );
          const { data: roleData } = await Promise.race([
            supabase.from('user_roles').select('role').eq('id', user.id).single(),
            roleTimeoutPromise
          ]);
          if (roleData?.role) role = roleData.role;
        } catch (e) {
          // fallback to role determined by email
        }

        set({ session, user, role, isLoading: false });
      } else {
        set({ session: null, user: null, role: null, isLoading: false });
      }
    } catch (criticalErr) {
      console.error('[AUTH] initialize hatası:', criticalErr);
      set({ session: null, user: null, role: null, isLoading: false });
    } finally {
      set(state => ({ ...state, isLoading: false }));
    }
  },
  
  signIn: async (email, password, rememberMe = true, botTrap = '') => {
    // Sunucu taraflı güvenli Scrypt şifre doğrulaması + Brute-Force (5 deneme / 15dk kilit) + Bot Honeypot kontrolü
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernameOrEmail: email,
        password,
        botTrap
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      useAdminLogStore.getState().addLog({
        category: 'security',
        module: 'Kimlik Doğrulama',
        action: res.status === 429 ? 'Brute-Force Kilidi Tetiklendi' : 'Hatalı Giriş Denemesi Engellendi',
        details: data.error || `"${email}" için giriş reddedildi (HTTP ${res.status}).`,
        status: 'error',
        user: String(email || '')
      });
      throw new Error(data.error || 'Kullanıcı adı veya şifre hatalı.');
    }

    const matchedManaged = data.user;
    const role = matchedManaged.role || 'user';

    // Güncel kullanıcı listesini senkronize et
    try {
      const usersRes = await fetch('/api/managedUsers');
      if (usersRes.ok) {
        const serverUsers = await usersRes.json();
        if (Array.isArray(serverUsers) && serverUsers.length > 0) {
          const normalized = normalizeUserList(serverUsers);
          localStorage.setItem(MANAGED_USERS_STORAGE_KEY, JSON.stringify(normalized));
          set({ managedUsers: normalized });
        }
      }
    } catch (_) {}

    const mockUser = {
      id: matchedManaged.id,
      email: matchedManaged.email,
      user_metadata: {
        name: matchedManaged.name || matchedManaged.username
      }
    };

    const mockSession = {
      access_token: data.token || `local_tok_${Date.now()}`,
      user: mockUser
    };

    const sessionState = {
      session: mockSession,
      user: mockUser,
      role
    };

    if (rememberMe) {
      localStorage.setItem('yayin_local_session', JSON.stringify(sessionState));
      localStorage.setItem('yayin_remember_me', 'true');
    } else {
      sessionStorage.setItem('yayin_local_session', JSON.stringify(sessionState));
      localStorage.setItem('yayin_remember_me', 'false');
      sessionStorage.setItem('yayin_session_active', 'true');
    }

    set({ ...sessionState, isLoading: false });

    useAdminLogStore.getState().addLog({
      category: 'security',
      module: 'Kimlik Doğrulama',
      action: 'Kullanıcı Girişi Başarılı',
      details: `${mockUser.email} (${role.toUpperCase()}) Scrypt + HMAC imzalı oturum ile giriş yaptı.`,
      status: 'success',
      user: mockUser.email
    });

    return sessionState;
  },
  
  signOut: async () => {
    const currentEmail = get().user?.email || 'Bilinmeyen Kullanıcı';
    try {
      if (isSupabaseConfigured) {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
        ]);
      }
    } catch (e) {
      // ignore
    }
    clearSupabaseTokens();
    localStorage.removeItem('yayin_local_session');
    sessionStorage.removeItem('yayin_local_session');
    sessionStorage.removeItem('yayin_session_active');
    set({ user: null, session: null, role: null, isLoading: false });

    useAdminLogStore.getState().addLog({
      category: 'security',
      module: 'Kimlik Doğrulama',
      action: 'Oturum Kapatıldı',
      details: `${currentEmail} sistemden güvenli çıkış yaptı.`,
      status: 'success',
      user: currentEmail
    });
  }
}));

export default useAuthStore;
