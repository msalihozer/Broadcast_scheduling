/**
 * @file src/components/Ads/ProductForm.jsx
 * @description Reklamveren firmaya ait ürün/marka tanımlama ve düzenleme modal formu.
 */
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useDialogStore from '../../store/dialogStore';

const ProductForm = ({ onClose, existingData = null, companyId = null, setActiveTab }) => {
  const addProduct = usePlanningStore(state => state.addProduct);
  const updateProduct = usePlanningStore(state => state.updateProduct);
  const setAdFilters = usePlanningStore(state => state.setAdFilters);
  const setPendingMaterialProductId = usePlanningStore(state => state.setPendingMaterialProductId);
  const companies = usePlanningStore(state => state.companies || []);
  const showConfirm = useDialogStore(state => state.showConfirm);

  const [formData, setFormData] = useState({
    name: '',
    companyId: companyId || ''
  });

  useEffect(() => {
    if (existingData) setFormData({ name: existingData.name, companyId: existingData.companyId });
  }, [existingData]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { name: formData.name, companyId: formData.companyId };
    
    let createdProductId = existingData?.id;

    if (existingData) {
      updateProduct(existingData.id, payload);
      onClose();
    } else {
      createdProductId = `p-${Date.now()}`;
      addProduct({ ...payload, id: createdProductId });
      
      onClose();

      showConfirm(
        'Ürün Başarıyla Eklendi',
        'Bu ürüne hemen bir materyal (klip) eklemek ister misiniz? Materyal ekleme ekranı, kütüphaneden arama yaparak detaylı seçim yapmanızı sağlar.',
        () => {
          setAdFilters({ companyId: formData.companyId, productId: createdProductId });
          setPendingMaterialProductId(createdProductId);
          if (setActiveTab) setActiveTab('materials');
        }
      );
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="glass" style={{ background: 'var(--bg-primary)', width: '450px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-primary)' }}>{existingData ? 'Ürün Düzenle' : 'Yeni Ürün Ekle'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Firma Seçimi</label>
            <select name="companyId" value={formData.companyId} onChange={handleChange} required style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }}>
              <option value="" disabled>Firma Seçiniz</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Ürün Adı (Marka/Kampanya)</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', outline: 'none' }} placeholder="Örn: Yaz Kampanyası" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>İptal</button>
            <button type="submit" style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> {existingData ? 'Kaydet' : 'Oluştur ve Devam Et'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
