/**
 * @file src/components/Ads/MaterialForm.jsx
 * @description Reklam video materyali (Spot / Klip) ekleme ve düzenleme modal formu.
 * Firma, Ürün, Materyal Adı, Klip Kodu, Süre (sn) ve Yükleme Tarihi düzenlenebilir.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Search, CheckCircle, Film } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import adsMedia from '../../data/adsMedia.json';
import { dialog } from '../../store/dialogStore';
import { normalizeAdDurationSeconds, extractUploadDateFromClip } from '../../modules/ads/utils/adsAutoSyncEngine';

const MaterialForm = ({ onClose, existingData = null, defaultCompanyId = '', defaultProductId = '' }) => {
  const addMaterial = usePlanningStore(state => state.addMaterial);
  const updateMaterial = usePlanningStore(state => state.updateMaterial);
  const products = usePlanningStore(state => state.products || []);
  const companies = usePlanningStore(state => state.companies || []);
  const materials = usePlanningStore(state => state.materials || []);

  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId || '');
  const [formData, setFormData] = useState({
    productId: defaultProductId || '',
    name: '',
    clipId: '',
    clipName: '',
    code: '',
    duration: 30,
    uploadDate: new Date().toISOString().split('T')[0],
    description: ''
  });

  const [mediaSearch, setMediaSearch] = useState('');

  useEffect(() => {
    if (existingData) {
      const prod = products.find(p => String(p.id) === String(existingData.productId));
      const resolvedCompanyId = existingData.companyId || prod?.companyId || '';
      setSelectedCompanyId(String(resolvedCompanyId));
      setFormData({
        productId: String(existingData.productId || ''),
        name: existingData.name || '',
        clipId: String(existingData.clipId || existingData.id || ''),
        clipName: existingData.clipName || existingData.code || '',
        code: existingData.code || existingData.clipName || '',
        duration: normalizeAdDurationSeconds(existingData.duration, existingData.clipName),
        uploadDate: existingData.uploadDate || extractUploadDateFromClip(existingData.clipName),
        description: existingData.description || ''
      });
    }
  }, [existingData, products]);

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  const availableProducts = useMemo(
    () =>
      products
        .filter(p => String(p.companyId) === String(selectedCompanyId))
        .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [products, selectedCompanyId]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const searchableClips = useMemo(() => {
    const map = new Map();
    materials.forEach(m => {
      const idStr = String(m.clipId || m.id);
      map.set(idStr, {
        id: idStr,
        name: m.clipName || m.name,
        title: m.name,
        code: m.code || m.clipName,
        duration: normalizeAdDurationSeconds(m.duration, m.clipName),
        uploadDate: m.uploadDate || extractUploadDateFromClip(m.clipName)
      });
    });
    (adsMedia || []).forEach(m => {
      if (m.category && !String(m.category).toLowerCase().includes('reklam') && !/^r[_-]/i.test(m.name || '')) return;
      const idStr = String(m.id);
      if (!map.has(idStr)) {
        map.set(idStr, {
          id: idStr,
          name: m.name,
          title: m.name,
          code: m.code || `${idStr}.mxf`,
          duration: normalizeAdDurationSeconds(m.duration, m.name),
          uploadDate: extractUploadDateFromClip(m.name)
        });
      }
    });
    return Array.from(map.values());
  }, [materials]);

  const filteredMedia = useMemo(() => {
    if (!mediaSearch.trim()) return searchableClips.slice(0, 80);
    const term = mediaSearch.toLocaleLowerCase('tr-TR').trim();
    return searchableClips
      .filter(m => {
        const hay = `${m.id} ${m.name} ${m.title} ${m.code}`.toLocaleLowerCase('tr-TR');
        return hay.includes(term);
      })
      .slice(0, 100);
  }, [searchableClips, mediaSearch]);

  const handleSelectMedia = (media) => {
    setFormData(prev => ({
      ...prev,
      clipId: String(media.id),
      clipName: media.name || media.code,
      code: media.code || media.name,
      duration: media.duration,
      uploadDate: media.uploadDate || prev.uploadDate,
      name: prev.name || media.title || media.name
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedCompanyId) {
      dialog.warning('Eksik Bilgi', 'Lütfen bir firma seçin.');
      return;
    }
    if (!formData.productId) {
      dialog.warning('Eksik Bilgi', 'Lütfen bağlı ürünü seçin.');
      return;
    }
    if (!formData.name.trim()) {
      dialog.warning('Eksik Bilgi', 'Lütfen materyal adını girin.');
      return;
    }

    const payload = {
      ...formData,
      companyId: selectedCompanyId,
      duration: normalizeAdDurationSeconds(formData.duration, formData.clipName)
    };

    if (existingData) {
      updateMaterial(existingData.id, payload);
    } else {
      addMaterial(payload);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        className="glass"
        style={{
          background: 'var(--bg-primary)',
          width: '620px',
          maxWidth: '94vw',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Film size={20} color="#8b5cf6" />
            {existingData ? 'Materyal / Klip Düzenle' : 'Yeni Materyal (Klip) Ekle'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>Firma</label>
              <select
                value={selectedCompanyId}
                onChange={e => {
                  const newCompId = e.target.value;
                  setSelectedCompanyId(newCompId);
                  const firstProd = products.find(p => String(p.companyId) === String(newCompId));
                  setFormData(prev => ({ ...prev, productId: firstProd ? String(firstProd.id) : '' }));
                }}
                required
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              >
                <option value="">-- Firma Seçiniz --</option>
                {sortedCompanies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Bağlı Ürün / Kampanya
              </label>
              <select
                name="productId"
                value={formData.productId}
                onChange={handleChange}
                required
                disabled={!selectedCompanyId}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '10px',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              >
                <option value="">-- Ürün Seçiniz --</option>
                {availableProducts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              Materyal (Spot) Görünen Adı
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Örn: Semerşah Tur 2026 Hac Kampanyası"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 12px',
                borderRadius: '8px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Klip ID</label>
              <input
                type="text"
                name="clipId"
                value={formData.clipId}
                onChange={handleChange}
                placeholder="Örn: 28783"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Süre (Saniye)</label>
              <input
                type="number"
                name="duration"
                min="1"
                max="600"
                value={formData.duration}
                onChange={handleChange}
                required
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                Yükleme Tarihi
              </label>
              <input
                type="date"
                name="uploadDate"
                value={formData.uploadDate}
                onChange={handleChange}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
              Dosya / Klip Kodu (MAM Dosya Adı)
            </label>
            <input
              type="text"
              name="clipName"
              value={formData.clipName}
              onChange={handleChange}
              placeholder="Örn: r_montex_auto_care_31sn_211026"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '9px 12px',
                borderRadius: '8px',
                fontFamily: 'monospace',
                outline: 'none'
              }}
            />
          </div>

          {/* Kütüphaneden Hızlı Seçim */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>
              Veya Medya Kütüphanesinden Klip Seçin (İsteğe Bağlı)
            </label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Arşiv kliplerinde ara (Klip adı, ID veya kod)..."
                value={mediaSearch}
                onChange={e => setMediaSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px 9px 32px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            <div
              style={{
                maxHeight: '150px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                background: 'var(--bg-secondary)'
              }}
            >
              {filteredMedia.map(m => {
                const isPicked = String(formData.clipId) === String(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMedia(m)}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isPicked ? 'rgba(59, 130, 246, 0.14)' : 'transparent'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', color: isPicked ? '#60a5fa' : 'var(--text-primary)', fontSize: '12.5px' }}>
                        #{m.id} — {m.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {m.code} • {m.uploadDate}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: '700',
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.12)',
                          padding: '2px 7px',
                          borderRadius: '4px'
                        }}
                      >
                        {m.duration} sn
                      </span>
                      {isPicked && <CheckCircle size={16} color="#60a5fa" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                border: 'none',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Save size={16} /> Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialForm;
