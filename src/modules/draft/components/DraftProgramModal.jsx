/**
 * @file DraftProgramModal.jsx
 * @description Seçili programın künyesini, bölüm detaylarını, kısa kuşak opsiyonlarını yöneten
 * ve doğrudan DÜZENLEME, KOPYALAMA ve SİLME işlemlerini sağlayan modal bileşeni.
 */
import React, { useState, useEffect } from 'react';
import { X, Layers, Edit3, Save, Copy, Trash2, Check, Clock, AlertCircle } from 'lucide-react';
import { OPTION_ICONS } from '../constants/draftConstants';
import { dialog } from '../../../store/dialogStore';

const CATEGORIES = [
  { name: 'Dini', color: '#10b981', badge: 'Dini', id: 4 },
  { name: 'Kültürel', color: '#3b82f6', badge: 'Kültür', id: 8 },
  { name: 'Çocuk', color: '#f59e0b', badge: 'Çocuk', id: 5 },
  { name: 'Kadın', color: '#ec4899', badge: 'Kadın', id: 1 },
  { name: 'Kısa Program', color: '#06b6d4', badge: 'Kısa', id: 10 },
  { name: 'Haber', color: '#ef4444', badge: 'Haber', id: 2 },
  { name: 'Tanıtım', color: '#14b8a6', badge: 'Tanıtım', id: 3 },
  { name: 'Reklam', color: '#eab308', badge: 'Reklam', id: 6 },
  { name: 'Jenerik', color: '#6366f1', badge: 'Jenerik', id: 7 }
];

const DraftProgramModal = ({
  selectedProgram,
  onClose,
  onToggleOption,
  onUpdateProgram,
  onDuplicateProgram,
  onDeleteProgram
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    episode: '',
    duration: 30,
    category: 'Genel Yayın',
    categoryColor: '#6b7280',
    host: '',
    topic: '',
    isLive: false
  });

  useEffect(() => {
    if (selectedProgram) {
      const initialLive = Boolean(
        selectedProgram.isLive ||
        (Array.isArray(selectedProgram.selectedOptions) && selectedProgram.selectedOptions.includes('Canlı')) ||
        /\bcanl[ıi]\b/i.test(`${selectedProgram.rawTitle || ''} ${selectedProgram.title || ''} ${selectedProgram.host || ''}`)
      );
      setFormData({
        title: selectedProgram.title || '',
        episode: selectedProgram.episode || '',
        duration: selectedProgram.duration || 30,
        category: selectedProgram.category || 'Genel Yayın',
        categoryColor: selectedProgram.categoryColor || '#6b7280',
        host: selectedProgram.host || '',
        topic: selectedProgram.topic || '',
        isLive: initialLive
      });
      setIsEditing(false);
    }
  }, [selectedProgram]);

  if (!selectedProgram) return null;

  const isProgramLive = isEditing
    ? formData.isLive
    : Boolean(
        selectedProgram.isLive ||
        (Array.isArray(selectedProgram.selectedOptions) && selectedProgram.selectedOptions.includes('Canlı')) ||
        /\bcanl[ıi]\b/i.test(`${selectedProgram.rawTitle || ''} ${selectedProgram.title || ''} ${selectedProgram.host || ''}`)
      );

  const handleCategoryChange = (catName) => {
    const matched = CATEGORIES.find(c => c.name === catName) || CATEGORIES[5];
    setFormData(prev => ({
      ...prev,
      category: matched.name,
      categoryColor: matched.color,
      categoryBadge: matched.badge
    }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      dialog.warning('Eksik Bilgi', 'Program başlığı boş bırakılamaz.');
      return;
    }
    const updated = {
      ...selectedProgram,
      ...formData,
      isLive: Boolean(formData.isLive),
      selectedOptions: formData.isLive ? ['Canlı'] : ['Bant'],
      duration: parseInt(formData.duration, 10) || selectedProgram.duration || 30
    };
    if (onUpdateProgram) {
      onUpdateProgram(selectedProgram.dateKey, updated);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const ok = await dialog.confirm(
      'Programı Sil',
      `"${selectedProgram.title}" programını akıştan tamamen silmek istediğinize emin misiniz?`,
      { isDestructive: true, confirmText: 'Evet, Sil' }
    );
    if (ok) {
      if (onDeleteProgram) {
        onDeleteProgram(selectedProgram.dateKey, selectedProgram.instanceId);
      }
      onClose();
    }
  };

  const handleDuplicate = () => {
    if (onDuplicateProgram) {
      onDuplicateProgram(selectedProgram.dateKey, selectedProgram.instanceId);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          color: 'var(--text-primary)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '6px',
              background: `${formData.categoryColor || selectedProgram.categoryColor || '#3b82f6'}22`,
              color: formData.categoryColor || selectedProgram.categoryColor || '#3b82f6'
            }}>
              {isEditing ? formData.category : selectedProgram.category}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
              {selectedProgram.startTime} - {selectedProgram.endTime} ({isEditing ? formData.duration : selectedProgram.duration} dk)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Programı Düzenle"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: 'var(--accent-primary)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Edit3 size={13} />
                <span>Düzenle</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                title="Değişiklikleri Kaydet"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: '#10b981',
                  border: 'none',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Save size={13} />
                <span>Kaydet</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Başlık Bölümü */}
          {isEditing ? (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                Program Adı / Kuşak Başlığı
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: selectedProgram.isKisaSlot ? '#0891b2' : isProgramLive ? '#dc2626' : 'var(--text-primary)' }}>
                  {selectedProgram.title}
                </h3>
                {isProgramLive && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 900,
                    background: '#ef4444',
                    color: '#ffffff',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    letterSpacing: '0.3px',
                    boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)'
                  }}>
                    ● CANLI YAYIN
                  </span>
                )}
              </div>
              {selectedProgram.rawTitle && selectedProgram.rawTitle !== selectedProgram.title && (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Excel Orijinal Kaydı: {selectedProgram.rawTitle}
                </div>
              )}
            </div>
          )}

          {/* Düzenleme Modu Form Alanları */}
          {isEditing ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Bölüm No
                </label>
                <input
                  type="text"
                  value={formData.episode}
                  onChange={e => setFormData({ ...formData, episode: e.target.value })}
                  placeholder="örn: 12"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Yayın Süresi (Dakika)
                </label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  step="5"
                  value={formData.duration}
                  onChange={e => setFormData({ ...formData, duration: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  Yayın Türü (Canlı mı / Bant mı?)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isLive: false }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: !formData.isLive ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: !formData.isLive ? 'var(--accent-primary)' : 'var(--bg-primary)',
                      color: !formData.isLive ? '#ffffff' : 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    🎬 Bant Yayın (Kayıt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isLive: true }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: formData.isLive ? '1.5px solid #e11d48' : '1px solid rgba(225, 29, 72, 0.35)',
                      background: formData.isLive ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'rgba(225, 29, 72, 0.08)',
                      color: formData.isLive ? '#ffffff' : '#be123c',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    ● Canlı Yayın (CANLI)
                  </button>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Kategori
                </label>
                <select
                  value={formData.category}
                  onChange={e => handleCategoryChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Sunucu / Katılımcı
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={e => setFormData({ ...formData, host: e.target.value })}
                  placeholder="örn: Kerim Öztürk"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Bölüm Konusu / Şehir / Detay
                </label>
                <textarea
                  rows="3"
                  value={formData.topic}
                  onChange={e => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="Program içeriği veya bölüm açıklaması..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          ) : (
            /* Okuma Modu Detayları */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              background: 'var(--bg-primary)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Bölüm No</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--warning)', marginTop: '2px' }}>
                  {selectedProgram.episode ? `Bölüm ${selectedProgram.episode}` : 'Belirtilmemiş'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Bölüm Toplam Süresi</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '2px' }}>
                  {selectedProgram.episodeDurationFormatted
                    ? `${selectedProgram.episodeDurationFormatted} (${selectedProgram.duration} dk)`
                    : `${selectedProgram.duration} Dakika`}
                </div>
                {selectedProgram.partsCount > 1 && (
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
                    {selectedProgram.partsCount} Part Toplamı
                  </div>
                )}
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sunucu / Katılımcı</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {selectedProgram.host || 'Belirtilmemiş'}
                </div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Bölüm Konusu / Detay</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {selectedProgram.topic || 'Belirtilmemiş'}
                </div>
              </div>
            </div>
          )}

          {/* Kısa Kuşak / Dolgu Seçenekleri */}
          {selectedProgram.isKisaSlot && (
            <div style={{
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '12px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Layers size={18} style={{ color: '#0891b2' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0891b2' }}>
                  Modüler Kısa Kuşak Opsiyonları
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(selectedProgram.availableOptions || []).map(opt => {
                  const isSelected = (selectedProgram.selectedOptions || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={(e) => onToggleOption(selectedProgram.dateKey, selectedProgram.instanceId, opt, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isSelected ? '#0891b2' : 'var(--border-color)',
                        background: isSelected ? '#e0f2fe' : 'var(--bg-secondary)',
                        color: isSelected ? '#0369a1' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {OPTION_ICONS[opt] || <Check size={14} />}
                      <span>{opt}</span>
                      {isSelected && <span style={{ fontSize: '11px', color: '#0369a1' }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Kopyala, Sil, Kaydet, Kapat) */}
        <div style={{
          padding: '16px 24px',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          {/* Sol: Silme ve Kopyalama */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDuplicate}
              title="Bu programı akışta bir alt sıraya kopyala"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Copy size={14} />
              <span>Kuşağı Kopyala</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              title="Bu programı akıştan kaldır"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} />
              <span>Kuşağı Sil</span>
            </button>
          </div>

          {/* Sağ: Kaydet / Kapat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEditing && (
              <button
                type="button"
                onClick={handleSave}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <Save size={14} />
                <span>Kaydet</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraftProgramModal);
