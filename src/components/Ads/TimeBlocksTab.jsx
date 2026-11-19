/**
 * @file src/components/Ads/TimeBlocksTab.jsx
 * @description Modern SaaS Temalı Yayın Kuşakları (TimeBlocks) Sekmesi.
 */
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import TimeBlockForm from './TimeBlockForm';
import useDialogStore from '../../store/dialogStore';

const DAYS_MAP = {
  1: 'Pzt',
  2: 'Sal',
  3: 'Çar',
  4: 'Per',
  5: 'Cum',
  6: 'Cts',
  0: 'Paz'
};

const TimeBlocksTab = () => {
  const { timeBlocks = [], removeTimeBlock, toggleTimeBlockStatus } = usePlanningStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);

  const handleDelete = (id) => {
    useDialogStore.getState().showConfirm('Kuşak Sil', 'Bu kuşağı silmek istediğinize emin misiniz?', () => {
      removeTimeBlock(id);
    });
  };

  const getDaysString = (daysArr) => {
    if (!daysArr || daysArr.length === 0) return 'Gün Seçilmedi';
    if (daysArr.length === 7) return 'Her Gün';
    if (daysArr.length === 5 && !daysArr.includes(6) && !daysArr.includes(0)) return 'Hafta İçi';
    if (daysArr.length === 2 && daysArr.includes(6) && daysArr.includes(0)) return 'Hafta Sonu';

    const sorted = [...daysArr].sort((a, b) => {
      const aVal = a === 0 ? 7 : a;
      const bVal = b === 0 ? 7 : b;
      return aVal - bVal;
    });
    return sorted.map(d => DAYS_MAP[d]).join(', ');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="ads-saas-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            Yayın Kuşakları
          </span>
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            {timeBlocks.length} Tanımlı Kuşak
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingBlock(null);
            setIsFormOpen(true);
          }}
          className="ads-saas-btn ads-saas-btn-primary"
        >
          <Plus size={14} /> Yeni Kuşak Ekle
        </button>
      </div>

      <div className="ads-saas-table-wrap">
        <div className="ads-saas-table-scroll">
          <table className="ads-saas-table" style={{ minWidth: '720px' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Kuşak Adı</th>
                <th>Saat Aralığı</th>
                <th>Geçerli Günler</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {timeBlocks.map(tb => (
                <tr key={tb.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--ads-text-muted)' }}>
                    #{String(tb.id).substring(0, 8)}
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
                      <Clock size={14} color="var(--ads-brand)" />
                      {tb.name}
                    </div>
                  </td>
                  <td>
                    <span className="ads-saas-chip" style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                      {tb.startTime} – {tb.endTime}
                    </span>
                  </td>
                  <td style={{ fontWeight: '700', color: 'var(--ads-brand)' }}>{getDaysString(tb.days)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleTimeBlockStatus(tb.id)}
                      className="ads-saas-btn ads-saas-btn-sm"
                      style={{
                        color: tb.isActive ? '#0d9488' : '#ef4444',
                        borderColor: tb.isActive ? 'rgba(13, 148, 136, 0.35)' : 'rgba(239, 68, 68, 0.35)'
                      }}
                    >
                      {tb.isActive ? <CheckCircle size={13} /> : <XCircle size={13} />}
                      {tb.isActive ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBlock(tb);
                          setIsFormOpen(true);
                        }}
                        className="ads-saas-btn ads-saas-btn-sm"
                        title="Düzenle"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tb.id)}
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{ color: '#ef4444' }}
                        title="Sil"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {timeBlocks.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', color: 'var(--ads-text-muted)' }}>
                    Hiç kuşak tanımlanmamış. Yeni kuşak ekleyerek başlayın.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <TimeBlockForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingBlock(null);
          }}
          existingData={editingBlock}
        />
      )}
    </div>
  );
};

export default React.memo(TimeBlocksTab);
