/**
 * @file src/components/Ads/CompanyForm.jsx
 * @description Yeni reklamveren firma ekleme ve mevcut firma bilgilerini güncelleme modal formu.
 */
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';

const CompanyForm = ({ onClose, existingData = null }) => {
  const addCompany = usePlanningStore(state => state.addCompany);
  const updateCompany = usePlanningStore(state => state.updateCompany);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    phone2: '',
    email: '',
    website: '',
    fax: '',
    address: ''
  });

  useEffect(() => {
    if (existingData) setFormData(existingData);
  }, [existingData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (existingData) updateCompany(existingData.id, formData);
    else addCompany(formData);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="glass" style={{ background: 'var(--bg-primary)', width: '600px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>{existingData ? 'Firma Düzenle' : 'Yeni Firma Ekle'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Firma Adı</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Yetkili Kişi</label>
              <input type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>E-Posta</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Telefon 1</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Telefon 2 (Opsiyonel)</label>
              <input type="text" name="phone2" value={formData.phone2} onChange={handleChange} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Adres</label>
            <textarea name="address" value={formData.address} onChange={handleChange} rows={3} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none', resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>İptal</button>
            <button type="submit" style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyForm;
