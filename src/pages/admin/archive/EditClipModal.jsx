/**
 * @file src/pages/admin/archive/EditClipModal.jsx
 * @description Tekil bir MAM arşiv klibinin adını, bölüm numarasını (episodeNo), parça numarasını (partNo)
 * ve özel notunu güncelleme (/api/archive/clip/:fileId) modalı.
 */
import React, { useState, useEffect } from 'react';
import { X, Edit3, Check, AlertCircle, RefreshCw, Database, Tag } from 'lucide-react';
import { formatTimecode } from '../../../utils/formatTimecode';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORY_IDS } from '../../../utils/categoryColors';

const EditClipModal = ({
  isOpen,
  onClose,
  clip,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [episodeNo, setEpisodeNo] = useState('');
  const [partNo, setPartNo] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (clip && isOpen) {
      setName(clip.name || '');
      setEpisodeNo(clip.episodeNo !== null && clip.episodeNo !== undefined ? String(clip.episodeNo) : '');
      setPartNo(clip.partNo !== null && clip.partNo !== undefined ? String(clip.partNo) : '');
      setNote(clip.note || '');
      setCategoryId(clip.categoryId || clip.mamCategoryId || 4);
      setErrorMsg(null);
    }
  }, [clip, isOpen]);

  if (!isOpen || !clip) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/archive/clip/${clip.fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          episodeNo: episodeNo !== '' ? parseInt(episodeNo, 10) : null,
          partNo: partNo !== '' ? parseInt(partNo, 10) : null,
          note: note.trim(),
          categoryId: categoryId ? parseInt(categoryId, 10) : null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Klip güncellenirken hata oluştu.');
      }

      if (onSuccess) {
        onSuccess(data.clip);
      }
      onClose();
    } catch (err) {
      console.error('Klip güncelleme hatası:', err);
      setErrorMsg(err.message || 'Güncelleme başarısız oldu.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        maxWidth: '480px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden'
      }}>
        {/* Başlık */}
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
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Edit3 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                Klip Bilgilerini Düzenle
              </h3>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                MAM ID: #{clip.fileId} • Süre: {formatTimecode(clip.durationSec)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {errorMsg && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={16} flexShrink={0} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              MAM Klip Adı:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Bölüm No:
              </label>
              <input
                type="number"
                min="0"
                placeholder="Ör: 1, 2, 61..."
                value={episodeNo}
                onChange={(e) => setEpisodeNo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Parça (Part) No:
              </label>
              <input
                type="number"
                min="1"
                placeholder="Ör: 1, 2..."
                value={partNo}
                onChange={(e) => setPartNo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Özel Not / Alt Başlık:
            </label>
            <input
              type="text"
              placeholder="Ör: Mevlid Özel, Tecvid 3. Bölüm..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px'
              }}
            />
          </div>

          {/* İki Katmanlı Kategori Bilgisi: TV MAM DB Kategorisi vs Bizim Kategorimiz */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '10px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)'
          }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                <Database size={12} /> TV MAM DB Kategorisi (Kaynak):
              </label>
              <div style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: '700',
                color: 'var(--text-secondary)'
              }}>
                #{clip.mamCategoryId || clip.categoryId || 4} {clip.mamCategoryName || MSSQL_CATEGORIES[clip.mamCategoryId || clip.categoryId]?.name || 'Dini'}
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: 'var(--accent-primary)', marginBottom: '6px' }}>
                <Tag size={12} /> Bizim Kategorimiz (Planlama):
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--accent-primary)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {BROADCAST_CATEGORY_IDS.map((cid) => (
                  <option key={cid} value={cid}>
                    #{cid} {MSSQL_CATEGORIES[cid]?.name || `Kategori ${cid}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Değişiklikleri Kaydet</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClipModal;
