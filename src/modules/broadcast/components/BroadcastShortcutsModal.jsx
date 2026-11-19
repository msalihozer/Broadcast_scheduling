/**
 * @file src/modules/broadcast/components/BroadcastShortcutsModal.jsx
 * @description Yayın Planlama klavye kısayolları kılavuz modalı (Vanilla CSS).
 */
import React from 'react';
import { X, Keyboard } from 'lucide-react';

export default function BroadcastShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Akış ve Satır Düzenleme',
      items: [
        { keys: ['Ctrl', 'S'], label: 'Mevcut yayın listesini kaydet' },
        { keys: ['Ctrl', 'Shift', 'S'], label: 'Reklam Rezervasyona İlet (Ön Kontrol)' },
        { keys: ['Ctrl', 'Enter'], label: 'Reklam Rezervasyona İlet (Alternatif)' },
        { keys: ['Delete', '⌫'], label: 'Seçili satırı listeden sil' },
        { keys: ['Alt', '↑ / ↓'], label: 'Seçili satırı yukarı / aşağı taşı' },
        { keys: ['Ctrl', 'Z'], label: 'Son işlemi geri al (Undo)' },
        { keys: ['Ctrl', 'Y'], label: 'İleri al (Redo)' },
        { keys: ['Ctrl', 'A'], label: 'Listedeki tüm öğeleri seç' },
        { keys: ['Ctrl', 'C'], label: 'Seçili satır(lar)ı panoya kopyala' },
        { keys: ['Ctrl', 'V'], label: 'Panodakileri aynı/başka listeye yapıştır' },
        { keys: ['P'], label: 'Program / Klip ekleme penceresini aç' },
        { keys: ['D'], label: 'Dolgu kuşağı ekle (seçili satırın altına / sona)' },
        { keys: ['R'], label: 'Reklam kuşağı ekle' }
      ]
    },
    {
      title: 'Görünüm ve Gezinme',
      items: [
        { keys: ['1'], label: 'Liste A görünümüne geç' },
        { keys: ['2'], label: 'Liste B görünümüne geç' },
        { keys: ['G'], label: 'Günlük Plan görünümü' },
        { keys: ['H'], label: 'Haftalık Matris görünümü' },
        { keys: ['A'], label: 'Aylık Takvim görünümü' },
        { keys: ['T'], label: 'Taslak / Klip yan panelini aç / kapat' },
        { keys: ['S'], label: 'Klip Arama sekmesine odaklan' },
        { keys: ['Esc'], label: 'Seçimi temizle / Pencereleri kapat' },
        { keys: ['?', 'K'], label: 'Bu kısayollar kılavuzunu aç / kapat' }
      ]
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '85vh',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Keyboard size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Klavye Kısayolları
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                Yayın akışı planlarken hızlanmanızı sağlayan tuş kombinasyonları
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '800',
                textTransform: 'uppercase',
                color: 'var(--accent-primary)',
                letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '4px'
              }}>
                {group.title}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-light)'
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '600' }}>
                      {item.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            color: 'var(--text-primary)',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
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

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <span>İpucu: Tablodaki herhangi bir satıra tıklayarak o satırı seçebilirsiniz.</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Kapat (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
