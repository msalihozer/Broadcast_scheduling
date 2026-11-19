/**
 * @file src/components/Ads/TimeBlockForm.jsx
 * @description Saatlik/günlük reklam kuşak şablonu (Sabah, Öğle, Prime Time vb.) oluşturma ve düzenleme formu.
 */
import React, { useState, useEffect } from 'react';
import { X, Save, Clock } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import { dialog } from '../../store/dialogStore';

const DAYS = [
  { id: 1, label: 'Pazartesi' },
  { id: 2, label: 'Salı' },
  { id: 3, label: 'Çarşamba' },
  { id: 4, label: 'Perşembe' },
  { id: 5, label: 'Cuma' },
  { id: 6, label: 'Cumartesi' },
  { id: 0, label: 'Pazar' }
];

const TimeBlockForm = ({ onClose, existingData = null }) => {
  const addTimeBlock = usePlanningStore(state => state.addTimeBlock);
  const updateTimeBlock = usePlanningStore(state => state.updateTimeBlock);

  const [formData, setFormData] = useState({
    name: '',
    startTime: '08:00',
    endTime: '12:00',
    days: [1, 2, 3, 4, 5],
    isActive: true
  });

  useEffect(() => {
    if (existingData) {
      setFormData(existingData);
    }
  }, [existingData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleDayToggle = (dayId) => {
    setFormData(prev => {
      const currentDays = prev.days;
      if (currentDays.includes(dayId)) {
        return { ...prev, days: currentDays.filter(d => d !== dayId) };
      } else {
        return { ...prev, days: [...currentDays, dayId] };
      }
    });
  };

  const setDaysQuick = (type) => {
    switch (type) {
      case 'weekdays':
        setFormData(prev => ({ ...prev, days: [1, 2, 3, 4, 5] }));
        break;
      case 'weekend':
        setFormData(prev => ({ ...prev, days: [6, 0] }));
        break;
      case 'all':
        setFormData(prev => ({ ...prev, days: [1, 2, 3, 4, 5, 6, 0] }));
        break;
      case 'clear':
        setFormData(prev => ({ ...prev, days: [] }));
        break;
      default:
        break;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.days.length === 0) {
      dialog.warning("Lütfen en az bir gün seçiniz.");
      return;
    }
    
    // Basit saat kontrolü (Örn: startTime < endTime kontrolü, eğer gece yarısını geçmiyorsa)
    if (existingData) {
      updateTimeBlock(existingData.id, formData);
    } else {
      addTimeBlock(formData);
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="glass" style={{ background: 'var(--bg-primary)', width: '480px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--accent-primary)" />
            {existingData ? 'Kuşak Düzenle' : 'Yeni Kuşak Ekle'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Kuşak Adı (Örn: Sabah Kuşağı)</label>
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
              placeholder="Örn: Prime Time"
              style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Başlangıç Saati</label>
              <input 
                type="time" 
                name="startTime" 
                value={formData.startTime} 
                onChange={handleChange} 
                required 
                style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Bitiş Saati</label>
              <input 
                type="time" 
                name="endTime" 
                value={formData.endTime} 
                onChange={handleChange} 
                required 
                style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', outline: 'none', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Geçerli Günler</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setDaysQuick('weekdays')} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}>Hafta İçi</button>
                <button type="button" onClick={() => setDaysQuick('weekend')} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}>Hafta Sonu</button>
                <button type="button" onClick={() => setDaysQuick('all')} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer' }}>Tümü</button>
                <button type="button" onClick={() => setDaysQuick('clear')} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}>Temizle</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {DAYS.map(day => {
                const isSelected = formData.days.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => handleDayToggle(day.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-secondary)',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <input 
              type="checkbox" 
              id="isActive" 
              name="isActive" 
              checked={formData.isActive} 
              onChange={handleChange} 
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="isActive" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 'bold' }}>Bu kuşak aktif olarak kullanılsın</label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontWeight: 'bold', cursor: 'pointer' }}>İptal</button>
            <button type="submit" style={{ flex: 2, padding: '12px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={18} /> {existingData ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeBlockForm;
