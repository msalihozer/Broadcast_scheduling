/**
 * @file src/pages/admin/programs/UsedProgramsTable.jsx
 * @description Admin Paneli -> Programlar Sekmesi Aktif Kullanılan Programlar Tablosu (Spreadsheet/Excel Stili).
 * Çoklu seçim (Shift+Click), satır içi başlık düzenleme, Bizim Kategori seçici + TV MAM DB kaynak kategori rozeti,
 * Bölüm/Cüz/Gün rozeti, kullanım durumu (Açık/Kapalı) anahtarı ve satır içi açılır `ArchiveClipsTable` yönetimini içerir.
 */
import React from 'react';
import {
  RefreshCw, AlertCircle, Check, X, Edit2, FileVideo,
  Clock, Plus, ChevronUp, ChevronDown, Trash2, ArrowRight
} from 'lucide-react';
import { MSSQL_CATEGORIES, BROADCAST_CATEGORY_IDS } from '../../../utils/categoryColors';
import { formatTimecode } from '../../../utils/formatTimecode';
import ArchiveClipsTable from '../archive/ArchiveClipsTable';

const UsedProgramsTable = ({
  isLoading,
  filteredPrograms,
  ourCategories,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  isSelected,
  onItemSelect,
  expandedClips,
  loadingClipsForProg,
  editingProgramId,
  editTitle,
  isUpdatingTitle,
  togglingProgramId,
  deletingProgramId,
  onStartEdit,
  onEditTitleChange,
  onSaveTitle,
  onCancelEdit,
  onChangeProgramCategory,
  onToggleStatus,
  onAddClipsToProgram,
  onToggleClips,
  onRefreshClips,
  onDeleteProgram,
  onNavigateToArchive,
  onRefreshUsedPrograms
}) => {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: '16px',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
    }}>
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
          <div>Programlar yükleniyor...</div>
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <AlertCircle size={32} style={{ marginBottom: '12px' }} />
          <div style={{ fontSize: '15px', fontWeight: '700' }}>Kriterlere uygun program bulunamadı</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Arama filtresini temizleyebilir veya yukarıdaki arama kutusundan arşivdeki programları kullanıma açabilirsiniz.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{
                background: 'var(--bg-tertiary)',
                borderBottom: '2px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {/* Tümünü Seç / Kaldır Checkbox */}
                <th style={{ padding: '14px 12px', width: '44px', textAlign: 'center', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={isAllSelected ? onDeselectAll : onSelectAll}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      accentColor: 'var(--accent-primary)'
                    }}
                    title={isAllSelected ? 'Seçimi Kaldır (Esc)' : 'Tümünü Seç (Ctrl+A)'}
                  />
                </th>
                <th style={{ padding: '14px 16px', width: '50px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '14px 16px', fontWeight: '700' }}>Program Adı (Kullanılan Seri)</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', width: '140px' }}>Kategori</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', width: '125px' }}>Bölüm / Cüz / Gün</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', width: '110px' }}>Klip Sayısı</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', width: '130px' }}>Toplam Süre</th>
                <th style={{ padding: '14px 16px', fontWeight: '700', width: '190px', textAlign: 'center' }}>
                  Kullanım Durumu
                </th>
                <th style={{ padding: '14px 16px', fontWeight: '700', width: '280px', textAlign: 'center' }}>
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPrograms.map((prog, index) => {
                const dynCat = (ourCategories || []).find(c => Number(c.id) === Number(prog.categoryId));
                const catColor = dynCat?.color || prog.categoryColor || MSSQL_CATEGORIES[prog.categoryId]?.color || '#64748b';
                const catMeta = {
                  color: catColor,
                  bg: `${catColor}24`
                };
                const isRowExpanded = !!expandedClips[prog.id];
                const isLoadingClips = !!loadingClipsForProg[prog.id];
                const isEditing = editingProgramId === prog.id;
                const itemIsSelected = isSelected(prog.id);

                return (
                  <React.Fragment key={prog.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: isRowExpanded
                          ? 'var(--bg-tertiary)'
                          : itemIsSelected
                            ? 'rgba(59, 130, 246, 0.08)'
                            : 'transparent',
                        transition: 'background 0.15s',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={(e) => {
                        if (e.target.closest('button, input, a, select')) return;
                        onItemSelect(prog, index, e);
                      }}
                      onMouseEnter={(e) => {
                        if (!isRowExpanded && !itemIsSelected) e.currentTarget.style.background = 'var(--bg-primary)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isRowExpanded && !itemIsSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Çoklu Seçim Kutusu (Shift + Tık destekli) */}
                      <td
                        style={{ padding: '14px 12px', textAlign: 'center', userSelect: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemSelect(prog, index, e);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={itemIsSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            onItemSelect(prog, index, e);
                          }}
                          onChange={() => {}}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: 'var(--accent-primary)'
                          }}
                          title="Shift + Tık ile aralık seçebilirsiniz"
                        />
                      </td>

                      {/* Sıra No */}
                      <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '700' }}>
                        {index + 1}
                      </td>

                      {/* Program Başlığı (İsim Düzenlenebilir) */}
                      <td style={{ padding: '14px 16px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => onEditTitleChange(e.target.value)}
                              style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--accent-primary)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                fontWeight: '700',
                                width: '260px'
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => onSaveTitle(prog.id)}
                              disabled={isUpdatingTitle}
                              style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer' }}
                              title="Kaydet"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={onCancelEdit}
                              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer' }}
                              title="İptal"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                              {prog.title}
                            </span>
                            <button
                              onClick={() => onStartEdit(prog)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                padding: '3px',
                                borderRadius: '4px',
                                opacity: 0.6
                              }}
                              title="Başlığı Düzenle"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Kategori Rozeti (Bizim Kategorimiz Seçici + TV MAM DB Kaynak Kategorisi) */}
                      <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <div style={{
                            background: catMeta.bg,
                            color: catMeta.color,
                            border: `1px solid ${catMeta.color}50`,
                            padding: '3px 8px',
                            borderRadius: '7px',
                            fontSize: '11px',
                            fontWeight: '800',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }} title="Bizim Planlama Kategorimiz (Değiştirmek için tıklayın)">
                            <span></span>
                            <select
                              value={prog.categoryId}
                              onChange={(e) => {
                                const nextCatId = parseInt(e.target.value, 10);
                                if (!nextCatId || nextCatId === prog.categoryId) return;
                                onChangeProgramCategory(prog, nextCatId);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: catMeta.color,
                                fontSize: '11px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              {((ourCategories || []).length > 0
                                ? ourCategories
                                : BROADCAST_CATEGORY_IDS.map(cid => ({ id: cid, name: MSSQL_CATEGORIES[cid]?.name || `Kategori ${cid}` }))
                              ).map(c => (
                                <option key={c.id} value={c.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                  #{c.id} {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '700',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            padding: '1px 6px',
                            borderRadius: '5px'
                          }} title="TV MAM Veritabanından Çekilen Orijinal Kategori">
                            MAM DB: #{prog.mamCategoryId || prog.categoryId} {prog.mamCategoryName || prog.categoryName}
                          </span>
                        </div>
                      </td>

                      {/* Bölüm / Cüz / Gün Sayısı */}
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {prog.totalEpisodes > 0 ? (
                          <span style={{
                            background: prog.unitType === 'cuz'
                              ? 'rgba(16, 185, 129, 0.14)'
                              : prog.unitType === 'gun'
                                ? 'rgba(168, 85, 247, 0.14)'
                                : 'rgba(59, 130, 246, 0.1)',
                            color: prog.unitType === 'cuz'
                              ? '#10b981'
                              : prog.unitType === 'gun'
                                ? '#c084fc'
                                : '#3b82f6',
                            border: prog.unitType === 'cuz'
                              ? '1px solid rgba(16, 185, 129, 0.35)'
                              : prog.unitType === 'gun'
                                ? '1px solid rgba(168, 85, 247, 0.35)'
                                : 'none',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            {prog.totalEpisodes} {prog.unitType === 'cuz' ? 'Cüz' : prog.unitType === 'gun' ? 'Gün' : 'Bölüm'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Kuşak / Tekil</span>
                        )}
                      </td>

                      {/* Klip Sayısı */}
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileVideo size={13} color="var(--text-secondary)" />
                          {prog.totalClips} Klip
                        </span>
                      </td>

                      {/* Toplam Süre */}
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#10b981' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} />
                          <span style={{ fontFamily: 'monospace' }}>{formatTimecode(prog.totalDurationSec)}</span>
                        </span>
                      </td>

                      {/* Kullanım Durumu (Aç/Kapa Switch) */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => onToggleStatus(prog.id, true, prog.title)}
                          disabled={togglingProgramId === prog.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#10b981',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '700',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)'
                          }}
                          title="Tıklayarak kullanımdan kaldırabilirsiniz"
                        >
                          {togglingProgramId === prog.id ? (
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#10b981',
                                display: 'inline-block'
                              }} />
                              <span>Kullanımda (Açık)</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* İşlemler (Klip Ekle / Klipleri Aç / Sil / Kategoriye Git) */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            onClick={() => onAddClipsToProgram(prog)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                            title="Bu programa MAM arşivinden yeni klip ekle"
                          >
                            <Plus size={12} />
                            <span>Klip Ekle</span>
                          </button>

                          <button
                            onClick={() => onToggleClips(prog.id)}
                            disabled={isLoadingClips}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: isRowExpanded ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                              color: isRowExpanded ? '#fff' : 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}
                            title="Klipleri ve bölümleri aç (Klip silme ve çıkarma işlemleri)"
                          >
                            {isLoadingClips ? (
                              <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : isRowExpanded ? (
                              <>Kapat <ChevronUp size={12} /></>
                            ) : (
                              <>Klipler ({prog.totalClips}) <ChevronDown size={12} /></>
                            )}
                          </button>

                          <button
                            onClick={() => onDeleteProgram(prog)}
                            disabled={deletingProgramId === prog.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '6px 9px',
                              borderRadius: '8px',
                              cursor: deletingProgramId === prog.id ? 'not-allowed' : 'pointer',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}
                            title="Programı Sil (Klipler Genel Arşiv'e aktarılır)"
                          >
                            {deletingProgramId === prog.id ? (
                              <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <>
                                <Trash2 size={12} />
                                <span>Sil</span>
                              </>
                            )}
                          </button>

                          {onNavigateToArchive && (
                            <button
                              onClick={() => onNavigateToArchive(prog.categoryId, prog.title)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border-color)',
                                padding: '6px',
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                              title="MAM Arşiv analizinde görüntüle"
                            >
                              <ArrowRight size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Açılır Klipler Detay Satırı */}
                    {isRowExpanded && (
                      <tr style={{ background: 'var(--bg-primary)' }}>
                        <td colSpan="9" style={{ padding: '16px 24px' }}>
                          <div style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            background: 'var(--bg-secondary)',
                            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)'
                          }}>
                            <div style={{
                              padding: '12px 18px',
                              background: 'var(--bg-tertiary)',
                              borderBottom: '1px solid var(--border-color)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '13px',
                              fontWeight: '700',
                              color: 'var(--text-primary)'
                            }}>
                              <span>"{prog.title}" Programına Ait Klipler ({expandedClips[prog.id]?.length || 0})</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>MAM Bölüm & Süre Yönetimi</span>
                            </div>

                            <ArchiveClipsTable
                              clips={expandedClips[prog.id] || []}
                              catMeta={catMeta}
                              program={prog}
                              onClipsChange={() => {
                                onRefreshClips(prog.id);
                                onRefreshUsedPrograms();
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsedProgramsTable;

