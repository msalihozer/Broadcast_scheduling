/**
 * @file src/pages/admin/archive/ArchiveProgramCard.jsx
 * @description Tek bir arşiv programının başlık düzenleme, bölüm/klip/süre istatistikleri,
 * aktif/pasif kullanım durumu değiştirme (toggle) ve açılır klip tablosunu (ArchiveClipsTable) barındıran kart bileşeni.
 */
import React, { useState } from 'react';
import { 
  Film, Edit2, Check, X, Hash, FileVideo, Clock, 
  Calendar, RefreshCw, ChevronUp, ChevronDown, Plus, Trash2, Database, Tag 
} from 'lucide-react';
import { formatTimecode } from '../../../utils/formatTimecode';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORY_IDS } from '../../../utils/categoryColors';
import ArchiveClipsTable from './ArchiveClipsTable';
import AddClipsModal from './AddClipsModal';

const ArchiveProgramCard = ({
  prog,
  catMeta,
  availableCategories = [],
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  isToggling,
  onSaveTitle,
  onChangeCategory,
  isChangingCategory,
  onDeleteProgram,
  isDeleting,
  onClipsChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(prog.title);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isAddClipsOpen, setIsAddClipsOpen] = useState(false);

  const isActive = !!prog.isActive;
  const mamCatId = prog.mamCategoryId || prog.categoryId || 4;
  const ourCatId = prog.categoryId || mamCatId;
  const dynamicOurCat = (availableCategories || []).find(c => Number(c.categoryId || c.id) === Number(ourCatId));
  const mamCatMeta = MSSQL_CATEGORIES[mamCatId] || catMeta;
  const ourColor = dynamicOurCat?.color || prog.categoryColor || MSSQL_CATEGORIES[ourCatId]?.color || catMeta.color || '#3b82f6';
  const ourCatMeta = {
    name: dynamicOurCat?.categoryName || dynamicOurCat?.name || prog.categoryName || MSSQL_CATEGORIES[ourCatId]?.name || `Kategori ${ourCatId}`,
    color: ourColor,
    bg: `${ourColor}24`,
    border: `${ourColor}66`
  };
  const isCustomCat = Number(ourCatId) !== Number(mamCatId) || Boolean(prog.isCustomCategory);

  const categoryOptions = (availableCategories && availableCategories.length > 0)
    ? availableCategories
        .filter(c => Number(c.categoryId || c.id) !== 6 && Number(c.categoryId || c.id) !== 11)
        .map(c => ({ id: Number(c.categoryId || c.id), name: c.categoryName || c.name }))
    : BROADCAST_CATEGORY_IDS.map(cid => ({ id: cid, name: MSSQL_CATEGORIES[cid]?.name || `Kategori ${cid}` }));

  const handleSave = async (e) => {
    e?.stopPropagation();
    if (!editTitle || !editTitle.trim()) return;
    setIsSavingTitle(true);
    await onSaveTitle(prog.id, editTitle.trim());
    setIsSavingTitle(false);
    setIsEditing(false);
  };

  const handleCancel = (e) => {
    e?.stopPropagation();
    setEditTitle(prog.title);
    setIsEditing(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const formatHourMin = (sec) => {
    if (!sec || isNaN(sec)) return '0 dk';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h} sa ${m} dk ${s > 0 ? `${s} sn` : ''}`.trim();
    if (m > 0) return `${m} dk ${s > 0 ? `${s} sn` : ''}`.trim();
    return `${s} sn`;
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: '14px',
        border: isExpanded ? `1px solid ${catMeta.color}80` : '1px solid var(--border-color)',
        overflow: 'hidden',
        transition: 'all 0.2s',
        boxShadow: isExpanded ? '0 6px 20px rgba(0,0,0,0.12)' : '0 2px 6px rgba(0,0,0,0.04)'
      }}
    >
      {/* Program Header */}
      <div
        style={{
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          background: isExpanded ? 'var(--bg-tertiary)' : 'transparent',
          cursor: 'pointer'
        }}
        onClick={onToggleExpand}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
          <div style={{
            background: catMeta.bg,
            color: catMeta.color,
            border: `1px solid ${catMeta.border}`,
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Film size={20} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    fontWeight: '700'
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={isSavingTitle}
                  style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}
                  title="Kaydet"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancel}
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' }}
                  title="İptal"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                  {prog.title}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  title="Program Başlığını Düzenle"
                >
                  <Edit2 size={13} />
                </button>

                {/* 1. TV MAM DB Kategorisi Rozeti (Kaynak) */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)'
                  }}
                  title="TV MAM Veritabanından Çekilen Orijinal Kategori"
                >
                  <Database size={11} />
                  <span>TV MAM DB: #{mamCatId} {prog.mamCategoryName || mamCatMeta.name}</span>
                </span>

                {/* 2. Bizim Kategorimiz (Planlama Kategorisi Seçici) */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: ourCatMeta.bg || 'rgba(59, 130, 246, 0.14)',
                    border: `1px solid ${isCustomCat ? (ourCatMeta.color || '#3b82f6') : (ourCatMeta.border || 'rgba(59,130,246,0.35)')}`,
                    color: ourCatMeta.color || '#3b82f6'
                  }}
                  title="Bizim Planlama Sisteminde Kullandığımız Kategori (Değiştirmek için tıklayın)"
                >
                  <Tag size={11} />
                  <span style={{ fontSize: '11px', fontWeight: '800' }}>Bizim Kategori:</span>
                  {onChangeCategory ? (
                    <select
                      value={ourCatId}
                      disabled={isChangingCategory}
                      onChange={(e) => {
                        const nextCatId = parseInt(e.target.value, 10);
                        if (nextCatId && nextCatId !== ourCatId) {
                          onChangeCategory(prog, nextCatId);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: ourCatMeta.color || '#3b82f6',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: isChangingCategory ? 'wait' : 'pointer',
                        padding: 0
                      }}
                    >
                      {categoryOptions.map((opt) => (
                        <option
                          key={opt.id}
                          value={opt.id}
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                          #{opt.id} {opt.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: '800' }}>
                      #{ourCatId} {prog.categoryName || ourCatMeta.name}
                    </span>
                  )}
                </div>

                {prog.mamTitle && prog.mamTitle !== prog.title && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-muted)',
                      background: 'var(--bg-primary)',
                      padding: '2px 6px',
                      borderRadius: '5px',
                      border: '1px dashed var(--border-color)'
                    }}
                    title="TV MAM Veritabanındaki Orijinal Program Başlığı"
                  >
                    MAM Adı: {prog.mamTitle}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Hash size={13} /> <strong>{prog.totalEpisodes || 0}</strong> {prog.unitType === 'cuz' ? 'Cüz' : prog.unitType === 'gun' ? 'Gün' : 'Bölüm'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileVideo size={13} /> <strong>{prog.totalClips || 0}</strong> Klip/Parça
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} /> Toplam: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{formatTimecode(prog.totalDurationSec)}</strong>
              </span>
              {prog.lastDate && (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} /> Son Kayıt: {formatDate(prog.lastDate)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sağ: Klip Ekle, Kullanım Durumu (Aç/Kapa Butonu), Sil ve Bölümler */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setIsAddClipsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(16, 185, 129, 0.14)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: '#10b981',
              padding: '7px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700'
            }}
            title="Bu programa arşivden yeni klip ekle"
          >
            <Plus size={14} />
            <span>Klip Ekle</span>
          </button>

          <button
            onClick={() => onToggleStatus(prog.id, isActive, prog.title)}
            disabled={isToggling}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
              border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
              color: isActive ? '#10b981' : 'var(--text-secondary)',
              padding: '7px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              transition: 'all 0.2s'
            }}
            title={isActive ? 'Kullanıma açık (Tıklayarak kapat)' : 'Arşivde kapalı (Tıklayarak aç)'}
          >
            {isToggling ? (
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isActive ? '#10b981' : '#64748b',
                  display: 'inline-block'
                }} />
                <span>{isActive ? 'Kullanımda (Açık)' : 'Arşivde (Kapalı)'}</span>
              </>
            )}
          </button>

          {onDeleteProgram && (
            <button
              onClick={() => onDeleteProgram(prog)}
              disabled={isDeleting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '7px 10px',
                borderRadius: '8px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '700'
              }}
              title="Programı Sil (Klipler Genel Arşiv'e aktarılır)"
            >
              {isDeleting ? (
                <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>Sil</span>
                </>
              )}
            </button>
          )}

          <div
            onClick={onToggleExpand}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 12px',
              borderRadius: '8px',
              background: isExpanded ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <span>{isExpanded ? 'Gizle' : 'Bölümler'}</span>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>
      </div>

      {/* Açılır Klip Tablosu */}
      {isExpanded && (
        <ArchiveClipsTable 
          clips={prog.clips} 
          catMeta={catMeta} 
          program={prog}
          onClipsChange={onClipsChange}
        />
      )}

      {/* Hızlı Klip Ekleme Modalı */}
      {isAddClipsOpen && (
        <AddClipsModal
          isOpen={isAddClipsOpen}
          onClose={() => setIsAddClipsOpen(false)}
          targetProgram={prog}
          program={prog}
          onSuccess={() => {
            setIsAddClipsOpen(false);
            if (onClipsChange) onClipsChange();
          }}
        />
      )}
    </div>
  );
};

export default ArchiveProgramCard;
