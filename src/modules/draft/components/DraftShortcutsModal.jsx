/**
 * @file DraftShortcutsModal.jsx
 * @description Taslak Planlama Modülü Klavye Kısayolları Kılavuzu Modalı.
 */
import React from 'react';
import { Keyboard, X, Command, Trash2, CheckSquare, Eye, Calendar, Upload, Move, Save, Copy, RotateCcw, MousePointerClick } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    title: 'Kaydetme, Geri Alma ve Düzenleme',
    shortcuts: [
      { keys: ['Ctrl', 'S'], label: 'Tüm değişiklikleri ve akışı veritabanına kaydet', icon: <Save size={14} color="#10b981" /> },
      { keys: ['Ctrl', 'Z'], label: 'Son yapılan işlemi anında geri al (Undo)', icon: <RotateCcw size={14} color="#3b82f6" /> },
      { keys: ['Ctrl', 'C'], label: 'Seçili program kuşaklarını kopyala', icon: <Copy size={14} color="#60a5fa" /> },
      { keys: ['Ctrl', 'V'], label: 'Kopyalananları yapıştır (Seçilenin altına veya gün sonuna)', icon: <Copy size={14} color="#10b981" /> },
      { keys: ['Shift', 'Tıklama'], label: 'İki program arasındaki tüm kuşakları aralık olarak seç', icon: <MousePointerClick size={14} color="#f59e0b" /> },
      { keys: ['Delete', '⌫'], label: 'Seçili program kuşaklarını anında sil', icon: <Trash2 size={14} color="#ef4444" /> },
      { keys: ['Ctrl', 'A'], label: 'Görüntülenen tüm programları toplu seç', icon: <CheckSquare size={14} color="var(--accent-primary)" /> },
      { keys: ['Esc'], label: 'Seçimleri temizle veya açık pencereyi kapat', icon: <X size={14} color="var(--text-muted)" /> },
      { keys: ['Fareyle Tut', 'Sürükle'], label: 'Programların sırasını veya gününü değiştir', icon: <Move size={14} color="#8b5cf6" /> }
    ]
  },
  {
    title: 'Görünüm ve Modlar',
    shortcuts: [
      { keys: ['G'], label: 'Haftalık Izgara (Grid) görünümüne geç', icon: <Eye size={14} color="var(--accent-primary)" /> },
      { keys: ['R'], label: 'Günlük Rundown (Tablo) görünümüne geç', icon: <Eye size={14} color="#10b981" /> },
      { keys: ['Ctrl', 'E'], label: 'Excel akışı yükleme penceresini aç', icon: <Upload size={14} color="#10b981" /> },
      { keys: ['?'], label: 'Bu Kısayollar kılavuzunu aç / kapat', icon: <Keyboard size={14} color="#f59e0b" /> }
    ]
  },
  {
    title: 'Gün Gezintisi (Hızlı Filtreleme)',
    shortcuts: [
      { keys: ['0'], label: 'Tüm haftayı seçili yap (7 Günün Tamamı)', icon: <Calendar size={14} color="var(--accent-primary)" /> },
      { keys: ['1'], label: 'Pazartesi gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> },
      { keys: ['2'], label: 'Salı gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> },
      { keys: ['3'], label: 'Çarşamba gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> },
      { keys: ['4'], label: 'Perşembe gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> },
      { keys: ['5'], label: 'Cuma gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> },
      { keys: ['6'], label: 'Cumartesi gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> },
      { keys: ['7'], label: 'Pazar gününü filtrele', icon: <Calendar size={14} color="var(--text-secondary)" /> }
    ]
  }
];

const DraftShortcutsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-color)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Başlığı */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #1d4ed8 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(59, 130, 246, 0.3)'
            }}>
              <Keyboard size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Klavye Kısayolları ve Hızlı Erişim
              </h2>
              <p style={{ fontSize: '12px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>
                Yayın akışınızı çok daha hızlı ve pratik yönetmek için bu kısayolları kullanabilirsiniz.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Kısayol Grupları */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {SHORTCUT_GROUPS.map((group, gIdx) => (
            <div key={gIdx}>
              <div style={{
                fontSize: '12px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'var(--accent-primary)',
                marginBottom: '10px'
              }}>
                {group.title}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '10px'
              }}>
                {group.shortcuts.map((sc, scIdx) => (
                  <div
                    key={scIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                      <div style={{ flexShrink: 0 }}>{sc.icon}</div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.2 }}>
                        {sc.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderBottom: '2px solid var(--border-color)',
                            borderRadius: '5px',
                            padding: '2px 7px',
                            fontSize: '11px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: 'var(--text-primary)',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Modal Alt Çubuk */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            İpucu: Kısayollar form ve arama kutularına yazı yazarken devre dışı kalır.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftShortcutsModal;
