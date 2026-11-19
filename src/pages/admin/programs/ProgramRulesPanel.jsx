/**
 * @file src/pages/admin/programs/ProgramRulesPanel.jsx
 * @description Admin Paneli - Program Eşleştirme, İsimlendirme ve Birim (Bölüm / Cüz / Gün) Kuralları Yönetim Paneli.
 * Hatm-i Şerif (Cüz, Mukabele ayrı), Beş Vakit Bir Şehir (5vakit1sehir - Metadatadan), Son İnci (s_inci - İsimden),
 * Delailü'l-Hayrat (Gün - İsimden), Tefsiri Mevakib (Cüz - Metadatadan) gibi özel ayrıştırma kurallarını listeler;
 * yeni kural ekleme, düzenleme, çıkarma/silme ve kuralları arşive anında uygulama işlevlerini sunar.
 */
import React, { useState, useEffect } from 'react';
import {
  Sliders, Plus, Edit2, Trash2, Check, X, RefreshCw,
  BookOpen, Calendar, Hash, FileText, Database, Layers, Sparkles, AlertCircle
} from 'lucide-react';
import { MSSQL_CATEGORIES } from '../../../utils/categoryColors';
import { useAdminLogStore } from '../../../store/adminLogStore';

const UNIT_TYPE_OPTIONS = [
  { value: 'bolum', label: 'Bölüm (Bölüm 1, Bölüm 2...)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Hash },
  { value: 'cuz', label: 'Cüz (1. Cüz, 2. Cüz... 30. Cüz)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: BookOpen },
  { value: 'gun', label: 'Gün (Pazartesi Günü, Salı Günü...)', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', icon: Calendar }
];

const EXTRACT_SOURCE_OPTIONS = [
  { value: 'filename', label: 'Dosya İsminden Çek', shortLabel: 'Dosya İsminden', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: FileText },
  { value: 'metadata', label: 'Metadatadan Çek (DB)', shortLabel: 'Metadatadan', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', icon: Database },
  { value: 'both', label: 'İsim + Metadata (Her İkisi)', shortLabel: 'İsim + Metadata', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: Layers }
];

const BROADCAST_CATEGORIES = Object.entries(MSSQL_CATEGORIES)
  .map(([id, meta]) => ({ id: parseInt(id, 10), ...meta }))
  .filter(c => c.id !== 6 && c.id !== 11);

const emptyForm = {
  programTitle: '',
  categoryId: 4,
  matchPatterns: '',
  excludePatterns: '',
  unitType: 'bolum',
  extractSource: 'both',
  description: ''
};

export default function ProgramRulesPanel({ onRulesApplied }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null); // null | 'new' | rule.id
  const [formData, setFormData] = useState(emptyForm);
  const [feedback, setFeedback] = useState(null);

  const addLog = useAdminLogStore(state => state.addLog);

  const showNotice = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/archive/rules');
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Kurallar alınamadı:', err);
      showNotice('Kurallar sunucudan alınamadı.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleStartAdd = () => {
    setEditingRuleId('new');
    setFormData(emptyForm);
  };

  const handleStartEdit = (rule) => {
    setEditingRuleId(rule.id);
    setFormData({
      programTitle: rule.programTitle || '',
      categoryId: rule.categoryId || 4,
      matchPatterns: rule.matchPatterns || '',
      excludePatterns: rule.excludePatterns || '',
      unitType: rule.unitType || 'bolum',
      extractSource: rule.extractSource || 'both',
      description: rule.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setFormData(emptyForm);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!formData.programTitle.trim()) {
      showNotice('Program adı boş bırakılamaz.', 'error');
      return;
    }
    if (!formData.matchPatterns.trim()) {
      showNotice('En az bir dosya isim kalıbı (ör: s_inci, hatmi_serif) girilmelidir.', 'error');
      return;
    }

    try {
      setSaving(true);
      const isNew = editingRuleId === 'new';
      const url = isNew ? '/api/archive/rules' : `/api/archive/rules/${editingRuleId}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kural kaydedilemedi.');
      }

      setRules(data.rules || []);
      setEditingRuleId(null);
      setFormData(emptyForm);

      const updatedClips = data.applyResult?.updatedClipsCount ?? 0;
      showNotice(
        isNew
          ? `✅ "${formData.programTitle}" kuralı eklendi ve arşivdeki kliplere uygulandı (${updatedClips} klip güncellendi).`
          : `✅ "${formData.programTitle}" kuralı güncellendi ve arşive uygulandı (${updatedClips} klip güncellendi).`
      );

      addLog({
        panel: 'programs',
        action: isNew ? 'Yeni Program Ayrıştırma Kuralı Eklendi' : 'Program Ayrıştırma Kuralı Güncellendi',
        details: `${formData.programTitle} [Birim: ${formData.unitType.toUpperCase()}, Kaynak: ${formData.extractSource}] (${formData.matchPatterns})`,
        status: 'success'
      });

      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`"${rule.programTitle}" ayrıştırma kuralını silmek/çıkarmak istediğinize emin misiniz?`)) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/archive/rules/${rule.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kural silinemedi.');
      }

      setRules(data.rules || []);
      showNotice(`🗑️ "${rule.programTitle}" kuralı çıkarıldı ve arşiv güncellendi.`);

      addLog({
        panel: 'programs',
        action: 'Program Ayrıştırma Kuralı Silindi',
        details: `"${rule.programTitle}" kuralı listeden çıkarıldı.`,
        status: 'warning'
      });

      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyRulesNow = async () => {
    try {
      setApplying(true);
      const res = await fetch('/api/archive/rules/apply', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kurallar uygulanamadı.');
      }
      if (data.rules) setRules(data.rules);
      showNotice(`⚡ Tüm kurallar (${data.rulesCount || rules.length} kural) arşive uygulandı; ${data.updatedClipsCount || 0} klip güncellendi.`);
      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      showNotice(err.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px',
      padding: '18px 20px',
      marginBottom: '20px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
    }}>
      {/* Üst Başlık ve Aksiyon Butonları */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexWrap: 'wrap',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}>
            <Sliders size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Program İsimlendirme & Birim (Bölüm / Cüz / Gün) Kuralları
              </h3>
              <span style={{
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: '800'
              }}>
                {rules.length} Aktif Kural
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              MAM kliplerinin hangi programa ait olduğunu, biriminin <strong>Bölüm / Cüz / Gün</strong> olarak nasıl tutulacağını ve verinin <strong>Dosya İsminden mi yoksa Metadatadan mı</strong> çekileceğini buradan yönetebilirsiniz.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleApplyRulesNow}
            disabled={applying || saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 13px',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: '800',
              cursor: applying ? 'not-allowed' : 'pointer'
            }}
            title="Listedeki tüm kuralları mevcut arşiv kliplerine yeniden uygula"
          >
            <RefreshCw size={14} style={{ animation: applying ? 'spin 1s linear infinite' : 'none' }} />
            <span>{applying ? 'Uygulanıyor...' : 'Kuralları Şimdi Uygula'}</span>
          </button>

          {editingRuleId !== 'new' && (
            <button
              type="button"
              onClick={handleStartAdd}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
            >
              <Plus size={15} />
              <span>Yeni Kural Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* Bildirim Bandı */}
      {feedback && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: feedback.type === 'error' ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.14)',
          border: `1px solid ${feedback.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
          color: feedback.type === 'error' ? '#ef4444' : '#10b981',
          fontSize: '12.5px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span>{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Kural Ekleme / Düzenleme Formu */}
      {editingRuleId !== null && (
        <form
          onSubmit={handleSaveRule}
          style={{
            marginTop: '14px',
            padding: '16px',
            borderRadius: '12px',
            background: 'var(--bg-primary)',
            border: '1.5px solid #8b5cf6',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} />
              <span>{editingRuleId === 'new' ? 'Yeni Program Eşleştirme & Birim Kuralı Ekle' : `Kuralı Düzenle: ${formData.programTitle}`}</span>
            </span>
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Hedef Program Adı *
              </label>
              <input
                type="text"
                placeholder="Örn: Tefsiri Mevakib, Son İnci..."
                value={formData.programTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, programTitle: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Kategori *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData(prev => ({ ...prev, categoryId: parseInt(e.target.value, 10) }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  boxSizing: 'border-box'
                }}
              >
                {BROADCAST_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    #{cat.id} — {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Birim Türü (Bölüm / Cüz / Gün) *
              </label>
              <select
                value={formData.unitType}
                onChange={(e) => setFormData(prev => ({ ...prev, unitType: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  boxSizing: 'border-box'
                }}
              >
                {UNIT_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Birim Bilgisinin Çekileceği Kaynak *
              </label>
              <select
                value={formData.extractSource}
                onChange={(e) => setFormData(prev => ({ ...prev, extractSource: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  boxSizing: 'border-box'
                }}
              >
                {EXTRACT_SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Eşleşecek Dosya İsim Kalıpları (Virgülle ayırın) *
              </label>
              <input
                type="text"
                placeholder="Örn: s_inci, son_inci veya 5vakit1sehir, 5v_1s"
                value={formData.matchPatterns}
                onChange={(e) => setFormData(prev => ({ ...prev, matchPatterns: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Hariç Tutulacak Kelimeler (İsteğe bağlı, virgülle ayırın)
              </label>
              <input
                type="text"
                placeholder="Örn: mukabele, tnt_, jenerik"
                value={formData.excludePatterns}
                onChange={(e) => setFormData(prev => ({ ...prev, excludePatterns: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Kural Açıklaması / Not
              </label>
              <input
                type="text"
                placeholder="Örn: Cüz bilgisini metadatadan çeker..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleCancelEdit}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '800',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              <Check size={14} />
              <span>{saving ? 'Kaydediliyor ve Uygulanıyor...' : 'Kuralı Kaydet ve Uygula'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Kurallar Tablosu */}
      <div style={{
        marginTop: '14px',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        overflowX: 'auto',
        background: 'var(--bg-primary)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Program Adı & Kategori</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Dosya İsim Kalıpları</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Hariç Tutulanlar</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '130px' }}>Birim Türü</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '150px' }}>Veri Kaynağı</th>
              <th style={{ padding: '10px 12px', fontWeight: '700' }}>Açıklama</th>
              <th style={{ padding: '10px 12px', fontWeight: '700', width: '140px', textAlign: 'center' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {loading && rules.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Kurallar yükleniyor...
                </td>
              </tr>
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Henüz tanımlı kural bulunmuyor. "Yeni Kural Ekle" butonuyla kural ekleyebilirsiniz.
                </td>
              </tr>
            ) : (
              rules.map(rule => {
                const catMeta = MSSQL_CATEGORIES[rule.categoryId] || { name: `Kategori ${rule.categoryId}`, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
                const unitMeta = UNIT_TYPE_OPTIONS.find(u => u.value === rule.unitType) || UNIT_TYPE_OPTIONS[0];
                const sourceMeta = EXTRACT_SOURCE_OPTIONS.find(s => s.value === rule.extractSource) || EXTRACT_SOURCE_OPTIONS[2];
                const UnitIcon = unitMeta.icon;
                const SourceIcon = sourceMeta.icon;

                return (
                  <tr
                    key={rule.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: editingRuleId === rule.id ? 'rgba(139, 92, 246, 0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '13px' }}>
                        {rule.programTitle}
                      </div>
                      <span style={{
                        display: 'inline-block',
                        marginTop: '3px',
                        background: catMeta.bg,
                        color: catMeta.color,
                        padding: '1px 7px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '700'
                      }}>
                        #{rule.categoryId} {catMeta.name}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {String(rule.matchPatterns || '').split(',').filter(Boolean).map((pat, i) => (
                          <span
                            key={i}
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              fontFamily: 'monospace',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                          >
                            {pat.trim()}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      {rule.excludePatterns ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {String(rule.excludePatterns).split(',').filter(Boolean).map((ex, i) => (
                            <span
                              key={i}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                padding: '2px 6px',
                                borderRadius: '5px',
                                fontFamily: 'monospace',
                                fontSize: '10.5px',
                                fontWeight: '700'
                              }}
                            >
                              !{ex.trim()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: unitMeta.bg,
                        color: unitMeta.color,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}>
                        <UnitIcon size={12} />
                        <span>{rule.unitType === 'cuz' ? 'Cüz' : rule.unitType === 'gun' ? 'Gün' : 'Bölüm'}</span>
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: sourceMeta.bg,
                        color: sourceMeta.color,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}>
                        <SourceIcon size={12} />
                        <span>{sourceMeta.shortLabel}</span>
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '11.5px', lineHeight: '1.4' }}>
                      {rule.description || '-'}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(rule)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          title="Kuralı Düzenle"
                        >
                          <Edit2 size={12} />
                          <span>Düzenle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                          title="Kuralı Çıkar / Sil"
                        >
                          <Trash2 size={12} />
                          <span>Çıkar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

