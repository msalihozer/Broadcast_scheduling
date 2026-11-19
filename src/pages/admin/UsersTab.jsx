/**
 * @file src/pages/admin/UsersTab.jsx
 * @description Admin Paneli - Kullanıcı Yönetimi, Temel Rol Şablonları Ekleme/Düzenleme,
 * Modül Erişim Yetkileri ve Admin Paneli Sekme Yetkilendirme ekranı.
 */
import React, { useState } from 'react';
import {
  Trash2, Edit, Plus, Shield, User as UserIcon, CheckSquare, Square,
  LayoutGrid, Lock, RotateCcw, Check, X, Layers
} from 'lucide-react';
import useAuthStore, {
  SYSTEM_MODULES,
  ADMIN_PANEL_TABS,
  ROLE_DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_TEMPLATES
} from '../../store/authStore';
import useDialogStore from '../../store/dialogStore';

export default function UsersTab() {
  const managedUsers = useAuthStore(state => state.managedUsers || []);
  const roleTemplates = useAuthStore(state => state.roleTemplates || DEFAULT_ROLE_TEMPLATES);
  const addManagedUser = useAuthStore(state => state.addManagedUser);
  const updateManagedUser = useAuthStore(state => state.updateManagedUser);
  const deleteManagedUser = useAuthStore(state => state.deleteManagedUser);
  const addRoleTemplate = useAuthStore(state => state.addRoleTemplate);
  const updateRoleTemplate = useAuthStore(state => state.updateRoleTemplate);
  const deleteRoleTemplate = useAuthStore(state => state.deleteRoleTemplate);

  // Kullanıcı Modalı
  const [modalMode, setModalMode] = useState(null); // 'add' | 'edit' | null
  const [formUser, setFormUser] = useState({
    id: null,
    name: '',
    email: '',
    password: '',
    role: 'yonetmen',
    allowedModules: ['draft', 'ready', 'list-control'],
    allowedAdminTabs: []
  });

  // Temel Rol Şablonu Modalı
  const [roleModalMode, setRoleModalMode] = useState(null); // 'add' | 'edit' | null
  const [formRole, setFormRole] = useState({
    id: '',
    label: '',
    description: '',
    color: '#3b82f6',
    isSystem: false,
    allowedModules: ['list-control'],
    allowedAdminTabs: []
  });

  const getRoleMeta = (roleId) => {
    const found = roleTemplates.find(t => t.id === roleId);
    if (found) {
      return {
        label: found.label,
        color: found.color || '#3b82f6',
        bg: `${found.color || '#3b82f6'}1F`,
        allowedModules: found.allowedModules || [],
        allowedAdminTabs: found.allowedAdminTabs || []
      };
    }
    return {
      label: roleId || 'Kullanıcı',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      allowedModules: ROLE_DEFAULT_PERMISSIONS[roleId]?.allowedModules || ['list-control'],
      allowedAdminTabs: ROLE_DEFAULT_PERMISSIONS[roleId]?.allowedAdminTabs || []
    };
  };

  // --- TEMEL ROL ŞABLONU İŞLEMLERİ ---
  const openAddRoleModal = () => {
    setFormRole({
      id: '',
      label: '',
      description: '',
      color: '#0ea5e9',
      isSystem: false,
      allowedModules: ['draft', 'ready', 'list-control'],
      allowedAdminTabs: ['overview', 'lists']
    });
    setRoleModalMode('add');
  };

  const openEditRoleModal = (tpl) => {
    setFormRole({
      id: tpl.id,
      label: tpl.label || tpl.id,
      description: tpl.description || '',
      color: tpl.color || '#3b82f6',
      isSystem: Boolean(tpl.isSystem),
      allowedModules: [...(tpl.allowedModules || [])],
      allowedAdminTabs: [...(tpl.allowedAdminTabs || [])]
    });
    setRoleModalMode('edit');
  };

  const toggleRoleFormModule = (moduleId) => {
    setFormRole(prev => {
      const exists = prev.allowedModules.includes(moduleId);
      let nextModules = exists
        ? prev.allowedModules.filter(m => m !== moduleId)
        : [...prev.allowedModules, moduleId];
      let nextTabs = [...prev.allowedAdminTabs];
      if (moduleId === 'admin' && exists) nextTabs = [];
      else if (moduleId === 'admin' && !exists && nextTabs.length === 0) nextTabs = ['overview'];
      return { ...prev, allowedModules: nextModules, allowedAdminTabs: nextTabs };
    });
  };

  const toggleRoleFormAdminTab = (tabId) => {
    setFormRole(prev => {
      const exists = prev.allowedAdminTabs.includes(tabId);
      const nextTabs = exists
        ? prev.allowedAdminTabs.filter(t => t !== tabId)
        : [...prev.allowedAdminTabs, tabId];
      let nextModules = [...prev.allowedModules];
      if (nextTabs.length > 0 && !nextModules.includes('admin')) nextModules.push('admin');
      else if (nextTabs.length === 0 && nextModules.includes('admin')) nextModules = nextModules.filter(m => m !== 'admin');
      return { ...prev, allowedModules: nextModules, allowedAdminTabs: nextTabs };
    });
  };

  const handleSaveRoleTemplate = () => {
    if (!formRole.label.trim()) {
      useDialogStore.getState().showAlert('Eksik Bilgi', 'Lütfen rol şablonu adını girin (Örn: Baş Yönetmen, Arşiv Sorumlusu).');
      return;
    }
    if (roleModalMode === 'add') {
      const created = addRoleTemplate({
        id: formRole.id.trim() || formRole.label.trim(),
        label: formRole.label.trim(),
        description: formRole.description.trim(),
        color: formRole.color,
        allowedModules: formRole.allowedModules,
        allowedAdminTabs: formRole.allowedAdminTabs
      });
      useDialogStore.getState().showAlert('Rol Şablonu Eklendi', `"${created.label}" temel rol şablonu oluşturuldu.`);
    } else if (roleModalMode === 'edit') {
      updateRoleTemplate(formRole.id, {
        label: formRole.label.trim(),
        description: formRole.description.trim(),
        color: formRole.color,
        allowedModules: formRole.allowedModules,
        allowedAdminTabs: formRole.allowedAdminTabs
      });
      useDialogStore.getState().showAlert('Güncellendi', `"${formRole.label}" rol şablonu güncellendi.`);
    }
    setRoleModalMode(null);
  };

  const handleDeleteRoleTemplate = (tpl) => {
    if (tpl.isSystem) {
      useDialogStore.getState().showAlert('Sistem Rolü', 'Sistemin çekirdek yönetici rolleri silinemez, ancak yetkilerini düzenleyebilirsiniz.');
      return;
    }
    useDialogStore.getState().showConfirm(
      'Rol Şablonunu Sil',
      `"${tpl.label}" rol şablonunu silmek istediğinize emin misiniz?`,
      () => {
        deleteRoleTemplate(tpl.id);
      }
    );
  };

  // --- KULLANICI İŞLEMLERİ ---
  const openAddModal = () => {
    const def = getRoleMeta('yonetmen');
    setFormUser({
      id: null,
      name: '',
      email: '',
      password: '',
      role: 'yonetmen',
      allowedModules: [...def.allowedModules],
      allowedAdminTabs: [...def.allowedAdminTabs]
    });
    setModalMode('add');
  };

  const openEditModal = (user) => {
    setFormUser({
      id: user.id,
      name: user.name || '',
      email: user.username || user.email || '',
      password: '',
      role: user.role || 'yonetmen',
      allowedModules: [...(user.allowedModules || [])],
      allowedAdminTabs: [...(user.allowedAdminTabs || [])]
    });
    setModalMode('edit');
  };

  const handleRoleChangeInModal = (newRole) => {
    const def = getRoleMeta(newRole);
    setFormUser(prev => ({
      ...prev,
      role: newRole,
      allowedModules: [...def.allowedModules],
      allowedAdminTabs: [...def.allowedAdminTabs]
    }));
  };

  const toggleFormModule = (moduleId) => {
    setFormUser(prev => {
      const exists = prev.allowedModules.includes(moduleId);
      let nextModules = exists
        ? prev.allowedModules.filter(m => m !== moduleId)
        : [...prev.allowedModules, moduleId];

      let nextAdminTabs = [...prev.allowedAdminTabs];
      if (moduleId === 'admin' && exists) {
        nextAdminTabs = [];
      } else if (moduleId === 'admin' && !exists && nextAdminTabs.length === 0) {
        nextAdminTabs = ['overview', 'programs'];
      }
      return {
        ...prev,
        allowedModules: nextModules,
        allowedAdminTabs: nextAdminTabs
      };
    });
  };

  const toggleFormAdminTab = (tabId) => {
    setFormUser(prev => {
      const exists = prev.allowedAdminTabs.includes(tabId);
      const nextAdminTabs = exists
        ? prev.allowedAdminTabs.filter(t => t !== tabId)
        : [...prev.allowedAdminTabs, tabId];

      let nextModules = [...prev.allowedModules];
      if (nextAdminTabs.length > 0 && !nextModules.includes('admin')) {
        nextModules.push('admin');
      } else if (nextAdminTabs.length === 0 && nextModules.includes('admin')) {
        nextModules = nextModules.filter(m => m !== 'admin');
      }

      return {
        ...prev,
        allowedModules: nextModules,
        allowedAdminTabs: nextAdminTabs
      };
    });
  };

  const handleQuickToggleModule = (user, moduleId) => {
    const currentModules = user.allowedModules || [];
    const exists = currentModules.includes(moduleId);
    let nextModules = exists
      ? currentModules.filter(m => m !== moduleId)
      : [...currentModules, moduleId];

    let nextAdminTabs = [...(user.allowedAdminTabs || [])];
    if (moduleId === 'admin' && exists) {
      nextAdminTabs = [];
    } else if (moduleId === 'admin' && !exists && nextAdminTabs.length === 0) {
      nextAdminTabs = ['overview', 'programs'];
    }

    updateManagedUser(user.id, {
      allowedModules: nextModules,
      allowedAdminTabs: nextAdminTabs
    });
  };

  const handleQuickToggleAdminTab = (user, tabId) => {
    const currentTabs = user.allowedAdminTabs || [];
    const exists = currentTabs.includes(tabId);
    const nextAdminTabs = exists
      ? currentTabs.filter(t => t !== tabId)
      : [...currentTabs, tabId];

    let nextModules = [...(user.allowedModules || [])];
    if (nextAdminTabs.length > 0 && !nextModules.includes('admin')) {
      nextModules.push('admin');
    } else if (nextAdminTabs.length === 0 && nextModules.includes('admin')) {
      nextModules = nextModules.filter(m => m !== 'admin');
    }

    updateManagedUser(user.id, {
      allowedModules: nextModules,
      allowedAdminTabs: nextAdminTabs
    });
  };

  const handleResetToRoleDefaults = (user) => {
    const def = getRoleMeta(user.role);
    updateManagedUser(user.id, {
      allowedModules: [...def.allowedModules],
      allowedAdminTabs: [...def.allowedAdminTabs]
    });
  };

  const handleSaveModal = () => {
    if (!formUser.name.trim() || !formUser.email.trim()) {
      useDialogStore.getState().showAlert('Eksik Bilgi', 'Lütfen kullanıcının Ad Soyad ve Kullanıcı Adı / E-posta bilgilerini girin.');
      return;
    }
    if (modalMode === 'add' && !String(formUser.password || '').trim()) {
      useDialogStore.getState().showAlert('Şifre Gerekli', 'Lütfen yeni kullanıcı için bir giriş şifresi belirleyin.');
      return;
    }

    if (modalMode === 'add') {
      addManagedUser({
        name: formUser.name.trim(),
        email: formUser.email.trim(),
        password: String(formUser.password || '').trim(),
        role: formUser.role,
        allowedModules: formUser.allowedModules,
        allowedAdminTabs: formUser.allowedAdminTabs
      });
      useDialogStore.getState().showAlert('Başarılı', `${formUser.name} kullanıcısı, şifresi ve erişim yetkileri kaydedildi.`);
    } else if (modalMode === 'edit') {
      const updates = {
        name: formUser.name.trim(),
        email: formUser.email.trim().includes('@') ? formUser.email.trim().toLowerCase() : `${formUser.email.trim().toLowerCase()}@plan.com`,
        username: formUser.email.trim().split('@')[0].toLowerCase(),
        role: formUser.role,
        allowedModules: formUser.allowedModules,
        allowedAdminTabs: formUser.allowedAdminTabs
      };
      if (String(formUser.password || '').trim()) {
        updates.password = String(formUser.password || '').trim();
      }
      updateManagedUser(formUser.id, updates);
      useDialogStore.getState().showAlert('Güncellendi', `${formUser.name} kullanıcısının bilgileri ve yetkileri güncellendi.`);
    }
    setModalMode(null);
  };

  const handleDelete = (user) => {
    if (user.id === 'usr_admin' || user.username === 'admin' || user.email === 'admin@plan.com') {
      useDialogStore.getState().showAlert('İşlem Engellendi', 'Ana Sistem Yöneticisi (admin) hesabı silinemez.');
      return;
    }
    useDialogStore.getState().showConfirm(
      'Kullanıcıyı Sil',
      `"${user.name}" (${user.email}) kullanıcısını sistemden silmek istediğinize emin misiniz?`,
      () => {
        deleteManagedUser(user.id);
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Üst Başlık */}
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
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Kullanıcılar, Temel Rol Şablonları &amp; Yetki Yönetimi
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            Temel rol şablonlarını görüntüleyin, yeni rol şablonu ekleyin/düzenleyin ve kullanıcıların modül/admin sekmesi yetkilerini yönetin.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={openAddRoleModal}
            style={{
              background: 'rgba(139, 92, 246, 0.14)',
              color: '#8b5cf6',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              padding: '10px 16px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: '800',
              fontSize: '13px'
            }}
          >
            <Plus size={16} /> Yeni Rol Şablonu Ekle
          </button>

          <button
            onClick={openAddModal}
            style={{
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '13px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
            }}
          >
            <Plus size={16} /> Yeni Kullanıcı Tanımla
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 1: TEMEL ROL ŞABLONLARI (GÖRÜNTÜLEME, EKLEME, DÜZENLEME, SİLME) */}
      {/* =================================================================== */}
      <div style={{
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={19} style={{ color: '#8b5cf6' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Temel Rol Şablonları ({roleTemplates.length} Şablon)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Yeni kullanıcı açarken seçilen hazır rol şablonları. Her şablonun hangi modüllere ve admin sekmelerine varsayılan erişimi olduğunu düzenleyebilirsiniz.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAddRoleModal}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8b5cf6',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={14} /> + Rol Şablonu Oluştur
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '14px'
        }}>
          {roleTemplates.map(tpl => {
            const modCount = (tpl.allowedModules || []).length;
            const tabCount = (tpl.allowedAdminTabs || []).length;
            return (
              <div
                key={tpl.id}
                style={{
                  borderRadius: '14px',
                  border: `1.5px solid ${tpl.color || '#3b82f6'}45`,
                  borderLeft: `4px solid ${tpl.color || '#3b82f6'}`,
                  background: 'var(--bg-primary)',
                  padding: '15px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 800,
                      color: 'var(--text-primary)'
                    }}>
                      {tpl.label}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: `${tpl.color || '#3b82f6'}1F`,
                      color: tpl.color || '#3b82f6'
                    }}>
                      Kod: {tpl.id}
                    </span>
                  </div>

                  {tpl.description && (
                    <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {tpl.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(37, 99, 235, 0.12)',
                      color: '#2563eb'
                    }}>
                      {modCount} / {SYSTEM_MODULES.length} Ana Modül
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(139, 92, 246, 0.12)',
                      color: '#8b5cf6'
                    }}>
                      {tabCount} / {ADMIN_PANEL_TABS.length} Admin Sekmesi
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => openEditRoleModal(tpl)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: '7px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Edit size={12} /> Şablonu Düzenle
                  </button>

                  {!tpl.isSystem && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRoleTemplate(tpl)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: '7px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                      title="Rol Şablonunu Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 2: KULLANICI KARTLARI LİSTESİ */}
      {/* =================================================================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {managedUsers.map(user => {
          const roleMeta = getRoleMeta(user.role);
          const userModules = user.allowedModules || [];
          const userAdminTabs = user.allowedAdminTabs || [];
          const hasAdminAccess = userModules.includes('admin') || userAdminTabs.length > 0;

          return (
            <div
              key={user.id}
              className="glass"
              style={{
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                background: 'var(--bg-secondary)'
              }}
            >
              {/* Üst Satır: Kullanıcı Bilgisi ve İşlem Butonları */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: roleMeta.bg,
                    color: roleMeta.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800'
                  }}>
                    <UserIcon size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        {user.name}
                      </span>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: '800',
                        background: roleMeta.bg,
                        color: roleMeta.color,
                        border: `1px solid ${roleMeta.color}33`
                      }}>
                        {roleMeta.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {user.email}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleResetToRoleDefaults(user)}
                    title="Rol şablonunun varsayılan yetkilerine sıfırla"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <RotateCcw size={13} /> Şablon Yetkisine Sıfırla
                  </button>

                  <button
                    onClick={() => openEditModal(user)}
                    style={{
                      background: 'rgba(59, 130, 246, 0.12)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: 'var(--accent-primary)',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Edit size={14} /> Düzenle
                  </button>

                  <button
                    onClick={() => handleDelete(user)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Kullanıcıyı Sil"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Orta Satır: Görebileceği Ana Modüller */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <LayoutGrid size={14} color="var(--accent-primary)" />
                  <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    Görebileceği Ana Modüller ({userModules.length} / {SYSTEM_MODULES.length})
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    — Tıklayarak anında açıp kapatabilirsiniz
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {SYSTEM_MODULES.map(mod => {
                    const isAllowed = userModules.includes(mod.id);
                    const modColor = mod.color || '#2563eb';
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleQuickToggleModule(user, mod.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: `1.5px solid ${isAllowed ? modColor : 'var(--border-color)'}`,
                          background: isAllowed ? `${modColor}18` : 'var(--bg-tertiary)',
                          color: isAllowed ? modColor : 'var(--text-secondary)',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          opacity: isAllowed ? 1 : 0.6,
                          transition: 'all 0.15s'
                        }}
                      >
                        {isAllowed ? <CheckSquare size={14} /> : <Square size={14} />}
                        <span>{mod.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alt Satır: Admin Panelinde Görebileceği Alanlar / Sekmeler */}
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '12px',
                padding: '14px 16px',
                border: `1px solid ${hasAdminAccess ? 'rgba(139, 92, 246, 0.35)' : 'var(--border-color)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={14} color="#8b5cf6" />
                    <span style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                      Admin Panelinde Görebileceği Alanlar ({userAdminTabs.length} / {ADMIN_PANEL_TABS.length})
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      — Seçtiğiniz sekmeler kullanıcıya Admin Panelinde açılır
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => updateManagedUser(user.id, {
                        allowedModules: Array.from(new Set([...userModules, 'admin'])),
                        allowedAdminTabs: ADMIN_PANEL_TABS.map(t => t.id)
                      })}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Tüm Sekmeleri Aç
                    </button>
                    <button
                      type="button"
                      onClick={() => updateManagedUser(user.id, {
                        allowedModules: userModules.filter(m => m !== 'admin'),
                        allowedAdminTabs: []
                      })}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Admin Erişimini Kapat
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                  {ADMIN_PANEL_TABS.map(tab => {
                    const isTabAllowed = userAdminTabs.includes(tab.id);
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleQuickToggleAdminTab(user, tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          borderRadius: '7px',
                          border: `1px solid ${isTabAllowed ? '#8b5cf6' : 'var(--border-color)'}`,
                          background: isTabAllowed ? 'rgba(139, 92, 246, 0.16)' : 'var(--bg-secondary)',
                          color: isTabAllowed ? '#a78bfa' : 'var(--text-secondary)',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          opacity: isTabAllowed ? 1 : 0.65,
                          transition: 'all 0.15s'
                        }}
                      >
                        {isTabAllowed ? <Check size={13} /> : <Lock size={12} />}
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: KULLANICI EKLEME / DÜZENLEME MODALI */}
      {/* =================================================================== */}
      {modalMode && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '26px',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {modalMode === 'add' ? 'Yeni Kullanıcı ve Yetki Tanımla' : 'Kullanıcı Yetkilerini Düzenle'}
              </h3>
              <button
                onClick={() => setModalMode(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    value={formUser.name}
                    onChange={e => setFormUser({ ...formUser, name: e.target.value })}
                    placeholder="Örn: Ahmet Yılmaz"
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '8px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Kullanıcı Adı / E-posta
                  </label>
                  <input
                    type="text"
                    value={formUser.email}
                    onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                    placeholder="Örn: ahmet"
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '8px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Giriş Şifresi {modalMode === 'edit' && '(Değiştirmek için girin)'}
                  </label>
                  <input
                    type="text"
                    value={formUser.password || ''}
                    onChange={e => setFormUser({ ...formUser, password: e.target.value })}
                    placeholder={modalMode === 'edit' ? 'Boş bırakılırsa korur' : 'Örn: Sifre123!'}
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '8px', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Temel Rol Şablonu Seçin
                </label>
                <select
                  value={formUser.role}
                  onChange={e => handleRoleChangeInModal(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}
                >
                  {roleTemplates.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.label} ({tpl.allowedModules?.length || 0} Modül / {tpl.allowedAdminTabs?.length || 0} Admin Sekmesi)
                    </option>
                  ))}
                </select>
              </div>

              {/* Modül Seçimi */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Erişebileceği Ana Modüller
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '8px' }}>
                  {SYSTEM_MODULES.map(mod => {
                    const checked = formUser.allowedModules.includes(mod.id);
                    const modColor = mod.color || '#2563eb';
                    return (
                      <label
                        key={mod.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${checked ? modColor : 'var(--border-color)'}`,
                          background: checked ? `${modColor}18` : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: checked ? modColor : 'var(--text-secondary)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFormModule(mod.id)}
                          style={{ accentColor: modColor, cursor: 'pointer' }}
                        />
                        <span>{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Admin Paneli Sekme Seçimi */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Admin Panelinde Görebileceği Sekmeler
                </label>
                <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  Kullanıcının Admin Paneline girdiğinde yalnızca seçtiğiniz alanları görmesini sağlar.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '8px' }}>
                  {ADMIN_PANEL_TABS.map(tab => {
                    const checked = formUser.allowedAdminTabs.includes(tab.id);
                    return (
                      <label
                        key={tab.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${checked ? '#8b5cf6' : 'var(--border-color)'}`,
                          background: checked ? 'rgba(139, 92, 246, 0.16)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: checked ? '#a78bfa' : 'var(--text-secondary)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFormAdminTab(tab.id)}
                          style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
                        />
                        <span>{tab.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  onClick={handleSaveModal}
                  style={{ flex: 1, background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '13.5px' }}
                >
                  {modalMode === 'add' ? 'Kullanıcıyı ve Yetkileri Oluştur' : 'Değişiklikleri Kaydet'}
                </button>
                <button
                  onClick={() => setModalMode(null)}
                  style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '13.5px' }}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: TEMEL ROL ŞABLONU EKLEME / DÜZENLEME MODALI */}
      {/* =================================================================== */}
      {roleModalMode && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100001,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '26px',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {roleModalMode === 'add' ? 'Yeni Temel Rol Şablonu Oluştur' : `Rol Şablonunu Düzenle: ${formRole.label}`}
              </h3>
              <button
                onClick={() => setRoleModalMode(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Rol Şablonu Görünen Adı
                  </label>
                  <input
                    type="text"
                    value={formRole.label}
                    onChange={e => setFormRole({ ...formRole, label: e.target.value })}
                    placeholder="Örn: Baş Yönetmen / Arşiv Uzmanı"
                    style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '8px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Rozet Rengi
                  </label>
                  <input
                    type="color"
                    value={formRole.color || '#3b82f6'}
                    onChange={e => setFormRole({ ...formRole, color: e.target.value })}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', background: 'var(--bg-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Rol Şablonu Açıklaması
                </label>
                <input
                  type="text"
                  value={formRole.description}
                  onChange={e => setFormRole({ ...formRole, description: e.target.value })}
                  placeholder="Bu rolün görev tanımı ve yetki kapsamı..."
                  style={{ width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 12px', borderRadius: '8px', outline: 'none' }}
                />
              </div>

              {/* Şablon Varsayılan Modülleri */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Şablonun Varsayılan Ana Modülleri
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '8px' }}>
                  {SYSTEM_MODULES.map(mod => {
                    const checked = formRole.allowedModules.includes(mod.id);
                    const modColor = mod.color || '#2563eb';
                    return (
                      <label
                        key={mod.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${checked ? modColor : 'var(--border-color)'}`,
                          background: checked ? `${modColor}18` : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: checked ? modColor : 'var(--text-secondary)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRoleFormModule(mod.id)}
                          style={{ accentColor: modColor, cursor: 'pointer' }}
                        />
                        <span>{mod.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Şablon Varsayılan Admin Sekmeleri */}
              <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '10px' }}>
                  Şablonun Varsayılan Admin Paneli Sekmeleri
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '8px' }}>
                  {ADMIN_PANEL_TABS.map(tab => {
                    const checked = formRole.allowedAdminTabs.includes(tab.id);
                    return (
                      <label
                        key={tab.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: `1px solid ${checked ? '#8b5cf6' : 'var(--border-color)'}`,
                          background: checked ? 'rgba(139, 92, 246, 0.16)' : 'var(--bg-secondary)',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: checked ? '#a78bfa' : 'var(--text-secondary)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRoleFormAdminTab(tab.id)}
                          style={{ accentColor: '#8b5cf6', cursor: 'pointer' }}
                        />
                        <span>{tab.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  onClick={handleSaveRoleTemplate}
                  style={{ flex: 1, background: '#8b5cf6', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', fontSize: '13.5px' }}
                >
                  {roleModalMode === 'add' ? 'Rol Şablonunu Kaydet' : 'Şablon Değişikliklerini Kaydet'}
                </button>
                <button
                  onClick={() => setRoleModalMode(null)}
                  style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '13.5px' }}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
