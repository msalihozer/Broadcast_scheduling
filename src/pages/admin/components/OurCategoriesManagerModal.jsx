/**
 * @file src/pages/admin/components/OurCategoriesManagerModal.jsx
 * @description Bizim DB (Yerel PostgreSQL) Planlama Kategorilerini Yönetme (Listeleme, Yeni Kategori Ekleme,
 * İsim/Renk Düzenleme ve Kategori Çıkarma/Silme) Modalı.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Tag, Plus, Edit2, Trash2, Check, RefreshCw, AlertCircle, Film, Layers
} from 'lucide-react';

const PRESET_COLORS = [
  '#10b981', // Zümrüt Yeşili
  '#3b82f6', // Mavi
  '#06b6d4', // Camgöbeği
  '#8b5cf6', // Mor
  '#ec4899', // Pembe
  '#f59e0b', // Kehribar Turuncu
  '#ef4444', // Kırmızı
  '#14b8a6', // Turkuaz
  '#6366f1', // İndigo
  '#84cc16'  // Limon Yeşili
];

const OurCategoriesManagerModal = ({
  isOpen,
  onClose,
  onCategoriesUpdated
}) => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Yeni kategori ekleme state
  const [newName, setNewName] = useState('');
  const [newBadge, setNewBadge] = useState('');
  const [newColor, setNewColor] = useState('#06b6d4');
  const [isCreating, setIsCreating] = useState(false);

  // Satır içi düzenleme state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const fetchOurCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/archive/our-categories');
      const data = await res.json();
      if (res.ok && data.categories) {
        setCategories(data.categories);
      } else {
        setErrorMsg(data.error || 'Kategoriler alınamadı.');
      }
    } catch (err) {
      setErrorMsg('Sunucu bağlantı hatası: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOurCategories();
    }
  }, [isOpen, fetchOurCategories]);

  if (!isOpen) return null;

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setIsCreating(true);
      setErrorMsg(null);
      const res = await fetch('/api/archive/our-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          badge: (newBadge || newName).trim(),
          color: newColor
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kategori eklenemedi.');
      }
      setNewName('');
      setNewBadge('');
      showSuccess(`"✅ #${data.category.id} ${data.category.name}" kategorisi Bizim DB'ye eklendi.`);
      await fetchOurCategories();
      if (onCategoriesUpdated) onCategoriesUpdated();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name || '');
    setEditBadge(cat.badge || cat.name || '');
    setEditColor(cat.color || '#3b82f6');
  };

  const handleSaveEdit = async (id) => {
    if (!editName.trim()) return;
    try {
      setIsSavingEdit(true);
      setErrorMsg(null);
      const res = await fetch(`/api/archive/our-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          badge: (editBadge || editName).trim(),
          color: editColor
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kategori güncellenemedi.');
      }
      setEditingId(null);
      showSuccess(`"✅ #${id} ${data.category.name}" kategorisi güncellendi.`);
      await fetchOurCategories();
      if (onCategoriesUpdated) onCategoriesUpdated();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const confirmMsg = cat.programsCount > 0
      ? `"#${cat.id} ${cat.name}" kategorisini Bizim DB'den çıkarmak istediğinize emin misiniz?\n\nİçerisinde bulunan ${cat.programsCount} program (${cat.clipsCount} klip) silinmeyecek, kendi kaynak kategorilerine aktarılacaktır.`
      : `"#${cat.id} ${cat.name}" kategorisini Bizim DB'den silmek istediğinize emin misiniz?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingId(cat.id);
      setErrorMsg(null);
      const res = await fetch(`/api/archive/our-categories/${cat.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Kategori silinemedi.');
      }
      showSuccess(
        `🗑️ "#${cat.id} ${cat.name}" kategorisi çıkarıldı${data.movedProgramsCount > 0 ? ` (${data.movedProgramsCount} program korundu)` : ''}.`
      );
      await fetchOurCategories();
      if (onCategoriesUpdated) onCategoriesUpdated();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '760px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Üst Başlık */}
        <div style={{
          padding: '18px 22px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.16)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Tag size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Bizim DB Planlama Kategorileri Yönetimi
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Yayın ve taslak planlamada kullandığımız kategorileri ekleyin, düzenleyin veya çıkarın (TV MAM kaynak kategorileri etkilenmez)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* İçerik Gövdesi */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#ef4444',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {successMsg}
            </div>
          )}

          {/* Yeni Kategori Ekleme Formu */}
          <form
            onSubmit={handleCreateCategory}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} color="#10b981" />
              <span>Bizim DB'ye Yeni Kategori Ekle</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Kategori Adı (Örn: Kısa Programlar, Sohbet, Belgesel...)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={{
                  flex: '1 1 220px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '600'
                }}
              />

              <input
                type="text"
                placeholder="Kısa Etiket (Opsiyonel)"
                value={newBadge}
                onChange={(e) => setNewBadge(e.target.value)}
                style={{
                  width: '150px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px'
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {PRESET_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      background: c,
                      border: newColor === c ? '2px solid #fff' : '1px solid transparent',
                      boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none',
                      cursor: 'pointer'
                    }}
                    title={`Renk: ${c}`}
                  />
                ))}
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  style={{
                    width: '26px',
                    height: '26px',
                    padding: 0,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: 'transparent'
                  }}
                  title="Özel Renk Seç"
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || !newName.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isCreating ? 'wait' : 'pointer'
                }}
              >
                <Plus size={15} />
                <span>{isCreating ? 'Ekleniyor...' : 'Kategori Ekle'}</span>
              </button>
            </div>
          </form>

          {/* Mevcut Bizim DB Kategorileri Tablosu */}
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            overflow: 'hidden',
            background: 'var(--bg-primary)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 14px', width: '70px' }}>ID</th>
                  <th style={{ padding: '10px 14px' }}>Bizim Kategori Adı & Renk</th>
                  <th style={{ padding: '10px 14px', width: '120px' }}>Kısa Etiket</th>
                  <th style={{ padding: '10px 14px', width: '170px' }}>Bağlı Program & Klip</th>
                  <th style={{ padding: '10px 14px', width: '165px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Henüz tanımlı kategori bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const isEditing = editingId === cat.id;
                    return (
                      <tr key={cat.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '800', color: 'var(--text-secondary)' }}>
                          #{cat.id}
                        </td>

                        <td style={{ padding: '10px 14px' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="color"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                style={{ width: '26px', height: '26px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                              />
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--accent-primary)',
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--text-primary)',
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  width: '100%'
                                }}
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '4px',
                                background: cat.color || '#3b82f6',
                                display: 'inline-block',
                                flexShrink: 0
                              }} />
                              <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)' }}>
                                {cat.name}
                              </span>
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px' }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editBadge}
                              onChange={(e) => setEditBadge(e.target.value)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '11.5px',
                                width: '100%'
                              }}
                            />
                          ) : (
                            <span style={{
                              background: `${cat.color || '#3b82f6'}22`,
                              color: cat.color || '#3b82f6',
                              border: `1px solid ${cat.color || '#3b82f6'}55`,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              {cat.badge || cat.name}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Layers size={12} /> <strong>{cat.programsCount || 0}</strong> prog.
                            </span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Film size={12} /> <strong>{Number(cat.clipsCount || 0).toLocaleString('tr-TR')}</strong> klip
                            </span>
                          </div>
                        </td>

                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {isEditing ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(cat.id)}
                                disabled={isSavingEdit}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#10b981',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                <Check size={13} /> Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-tertiary)',
                                  color: 'var(--text-secondary)',
                                  fontSize: '11px',
                                  cursor: 'pointer'
                                }}
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(cat)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-tertiary)',
                                  color: 'var(--text-primary)',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                                title="Kategori Adını ve Rengini Düzenle"
                              >
                                <Edit2 size={12} /> Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                disabled={deletingId === cat.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: deletingId === cat.id ? 'wait' : 'pointer'
                                }}
                                title="Kategoriyi Çıkar / Sil"
                              >
                                <Trash2 size={12} /> Sil
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OurCategoriesManagerModal;

