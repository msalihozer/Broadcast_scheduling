/**
 * @file src/modules/broadcast/components/rundown/RundownEmptyState.jsx
 * @description Seçili günün yayın akışı listesi henüz boş olduğunda (`programs.length === 0`)
 * gösterilen karşılama ve hızlı başlangıç kartı:
 * - Taslak Uygula
 * - + Program / Klip Ekle
 * - + Dolgu Kuşağı Ekle
 * - Kopyalanan Listeyi Bu Güne Uygula (panoda öğe varsa)
 */
import React, { memo } from 'react';
import { Tv, Zap, Plus, Sparkles, ClipboardPaste } from 'lucide-react';

const RundownEmptyState = memo(function RundownEmptyState({
  selectedDate = '',
  draftSlotsCount = 0,
  isApplyingDraft = false,
  clipboardItems = [],
  clipboardMeta = null,
  onApplySmartDraft,
  onOpenAddModal,
  onQuickAddFillerSlot,
  onPasteClipboard
}) {
  return (
    <div style={{
      minHeight: '340px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '36px',
      border: '2px dashed var(--border-color)',
      borderRadius: '16px',
      background: 'var(--bg-secondary)',
      gap: '14px'
    }}>
      <div style={{
        width: '62px',
        height: '62px',
        borderRadius: '16px',
        background: 'rgba(59, 130, 246, 0.15)',
        color: 'var(--accent-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Tv size={32} />
      </div>
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '900', color: 'var(--text-primary)' }}>
          Bu gün için henüz yayın akışı hazırlanmamış
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '560px', lineHeight: 1.55 }}>
          {draftSlotsCount > 0 ? (
            <>
              Aşağıdaki <strong>"Taslak Uygula"</strong> butonuna tıklayarak bu günün taslağındaki (<strong>{draftSlotsCount} kuşak</strong>) programların kliplerini, <strong>tüm partlarını</strong>, <strong>İntrolarını</strong> ve <strong>Dolgu Kuşaklarını</strong> otomatik olarak yerleştirebilirsiniz.
            </>
          ) : (
            <>
              Bu tarih (<strong>{selectedDate}</strong>) için Taslak Planlama modülünde hazırlanmış bir taslak bulunmuyor. Sol panelden taslağı hazır olan bir güne geçebilir, başka bir günden kopyaladığınız listeyi uygulayabilir veya manuel program/dolgu kuşağı ekleyebilirsiniz.
            </>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
        {draftSlotsCount > 0 && (
          <button
            type="button"
            disabled={isApplyingDraft}
            onClick={onApplySmartDraft}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 22px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '900',
              cursor: isApplyingDraft ? 'wait' : 'pointer',
              boxShadow: '0 6px 18px rgba(37, 99, 235, 0.35)'
            }}
          >
            <Zap size={18} />
            <span>{isApplyingDraft ? 'Taslak Uygulanıyor...' : `Taslak Uygula (${draftSlotsCount} Kuşak)`}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenAddModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1.5px solid var(--border-color)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          <span>+ Program / Klip Ekle</span>
        </button>

        <button
          type="button"
          onClick={onQuickAddFillerSlot}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '12px 18px',
            borderRadius: '10px',
            border: '1.5px solid rgba(139, 92, 246, 0.45)',
            background: 'rgba(139, 92, 246, 0.14)',
            color: '#7c3aed',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={16} />
          <span>+ Dolgu Kuşağı Ekle</span>
        </button>

        {Array.isArray(clipboardItems) && clipboardItems.length > 0 && (
          <button
            type="button"
            onClick={() => onPasteClipboard('replace')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '10px',
              border: '1.5px solid rgba(16, 185, 129, 0.5)',
              background: 'rgba(16, 185, 129, 0.16)',
              color: '#059669',
              fontSize: '14.5px',
              fontWeight: '900',
              cursor: 'pointer'
            }}
          >
            <ClipboardPaste size={17} />
            <span>
              Kopyalanan Listeyi Bu Güne Uygula ({clipboardItems.length} Öğe
              {clipboardMeta?.sourceDate ? ` • ${clipboardMeta.sourceDate}` : ''})
            </span>
          </button>
        )}
      </div>
    </div>
  );
});

export default RundownEmptyState;

