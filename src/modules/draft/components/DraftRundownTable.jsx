/**
 * @file DraftRundownTable.jsx
 * @description Taslak Planlama günlük ve haftalık sıralı yayın akışı tablosu (Rundown Table View).
 * Sürükle-bırak (Drag & Drop), çoklu seçim (Checkbox), satır kopyalama ve silme işlemlerini destekler.
 */
import React, { useState } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Edit3,
  Copy,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle2,
  Send
} from 'lucide-react';
import { OPTION_ICONS } from '../constants/draftConstants';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';
import { getProgramColor } from './library/constants';

const DAY_THEMES = {
  Pazartesi: { color: '#2563eb', order: '1. GÜN' },
  Salı:      { color: '#7c3aed', order: '2. GÜN' },
  Çarşamba:  { color: '#0891b2', order: '3. GÜN' },
  Perşembe:  { color: '#059669', order: '4. GÜN' },
  Cuma:      { color: '#d97706', order: '5. GÜN' },
  Cumartesi: { color: '#e11d48', order: '6. GÜN' },
  Pazar:     { color: '#4f46e5', order: '7. GÜN' }
};

const DraftRundownTable = ({
  activeDaysKeys,
  scheduleData,
  filterProgram,
  searchQuery = '',
  selectedProgramIds = [],
  onSelectProgram,
  onToggleOption,
  onToggleSelect,
  onSelectAllDay,
  onReorderPrograms,
  onMoveProgramOrder,
  onDuplicateProgram,
  onDeleteProgram,
  onAddLibraryProgram,
  onSendDayToBroadcast
}) => {
  const [dragOverInfo, setDragOverInfo] = useState(null); // { dateKey, pIdx }

  const handleDragStart = (e, info) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(info));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e, info) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragOverInfo || dragOverInfo.dateKey !== info.dateKey || dragOverInfo.pIdx !== info.pIdx) {
      setDragOverInfo(info);
    }
  };

  const handleDrop = (e, targetInfo) => {
    e.preventDefault();
    setDragOverInfo(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const source = JSON.parse(dataStr);

      if (source && source.isLibraryItem && source.programData) {
        onAddLibraryProgram && onAddLibraryProgram({
          programData: source.programData,
          targetDays: [targetInfo.dateKey],
          targetProgIndex: targetInfo.pIdx
        });
        return;
      }

      if (source && source.instanceId) {
        onReorderPrograms && onReorderPrograms(
          source.dateKey,
          source.instanceId,
          targetInfo.dateKey,
          targetInfo.pIdx
        );
      }
    } catch (err) {
      console.error('Table drop error:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '1000px', overflowX: 'auto', paddingBottom: '30px' }}>
      {activeDaysKeys.map(dateKey => {
        const day = scheduleData[dateKey];
        if (!day) return null;
        const filteredProgs = searchQuery.trim()
          ? filterAndSortBySearchPriority(
              day.programs || [],
              searchQuery,
              (p) => p.title || p.name || '',
              (p) => [p.episode ? `Bölüm ${p.episode}` : '', p.host, p.topic, p.category, p.startTime]
            )
          : (day.programs || []).filter(filterProgram);

        const dayProgIds = (day.programs || []).map(p => p.instanceId);
        const isAllDaySelected = dayProgIds.length > 0 && dayProgIds.every(id => selectedProgramIds.includes(id));
        const totalMinutes = (day.programs || []).reduce((acc, p) => acc + (p.duration || 0), 0);
        const hours = (totalMinutes / 60).toFixed(totalMinutes % 60 === 0 ? 0 : 1);
        const dayTheme = DAY_THEMES[day.dayName] || DAY_THEMES.Pazartesi;

        return (
          <div
            key={dateKey}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              borderTop: '3.5px solid #3b82f6',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Tablo Kartı Başlığı */}
            <div style={{
              padding: '14px 20px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {dayProgIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectAllDay && onSelectAllDay(dateKey)}
                    title={isAllDaySelected ? "Günün seçimini kaldır" : "Bu günün tüm programlarını seç"}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '2px',
                      cursor: 'pointer',
                      color: isAllDaySelected ? 'var(--accent-primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {isAllDaySelected ? <CheckSquare size={17} /> : <Square size={17} />}
                  </button>
                )}
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {day.dayName}
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {day.date}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Toplam: <strong style={{ color: 'var(--text-primary)' }}>{day.programs.length} Kuşak</strong>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Süre: <strong style={{ color: 'var(--accent-primary)' }}>{totalMinutes} dk ({hours} Sa)</strong>
                </span>
                {day.programs.length > 0 && onSendDayToBroadcast && (
                  <button
                    type="button"
                    onClick={() => onSendDayToBroadcast(dateKey)}
                    title={`${day.dayName} taslağını Yayın Planlama modülüne aktar`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '7px',
                      fontSize: '11px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(14, 165, 233, 0.35)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <Send size={12} />
                    <span>Yayına Gönder</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tablo */}
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px', width: '40px', textAlign: 'center' }}>Seç</th>
                  <th style={{ padding: '10px 14px', width: '50px' }}>Sıra</th>
                  <th style={{ padding: '10px 14px', width: '120px' }}>Yayın Saati</th>
                  <th style={{ padding: '10px 14px', width: '70px' }}>Süre</th>
                  <th style={{ padding: '10px 14px', width: '120px' }}>Kategori</th>
                  <th style={{ padding: '10px 14px' }}>Program / Kuşak Adı</th>
                  <th style={{ padding: '10px 14px', width: '70px' }}>Bölüm</th>
                  <th style={{ padding: '10px 14px', minWidth: '180px' }}>Seçenekler / Sunucu</th>
                  <th style={{ padding: '10px 14px' }}>Bölüm Konusu / Şehir</th>
                  <th style={{ padding: '10px 14px', width: '80px', textAlign: 'center' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredProgs.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {day.programs.length === 0 ? 'Bu güne ait planlanmış yayın akışı bulunmuyor.' : 'Aramaya uygun program bulunamadı.'}
                    </td>
                  </tr>
                ) : (
                  filteredProgs.map((prog, pIdx) => {
                    const isKisa = prog.isKisaSlot;
                    const isLive = Boolean(
                      prog.isLive ||
                      (Array.isArray(prog.selectedOptions) && prog.selectedOptions.includes('Canlı')) ||
                      /\bcanl[ıi]\b/i.test(`${prog.rawTitle || ''} ${prog.title || ''} ${prog.host || ''}`)
                    );
                    const rowAccentColor = getProgramColor(prog);
                    const isSelected = selectedProgramIds.includes(prog.instanceId);
                    const isOver = dragOverInfo && dragOverInfo.dateKey === dateKey && dragOverInfo.pIdx === pIdx;

                    return (
                      <tr
                        key={prog.instanceId}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, { dateKey, instanceId: prog.instanceId, pIdx })}
                        onDragOver={(e) => handleDragOver(e, { dateKey, pIdx })}
                        onDrop={(e) => handleDrop(e, { dateKey, pIdx })}
                        onDragEnd={() => setDragOverInfo(null)}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            onToggleSelect && onToggleSelect(dateKey, prog.instanceId, e);
                          } else {
                            onSelectProgram && onSelectProgram({ ...prog, dateKey });
                          }
                        }}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          borderTop: isOver ? '2px solid var(--accent-primary)' : 'none',
                          borderLeft: `4px solid ${rowAccentColor}`,
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(59, 130, 246, 0.16)'
                            : isOver
                            ? 'rgba(59, 130, 246, 0.20)'
                            : `linear-gradient(90deg, ${rowAccentColor}18 0%, ${rowAccentColor}05 45%, transparent 100%)`,
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Seçim Checkbox */}
                        <td
                          onClick={e => {
                            e.stopPropagation();
                            onToggleSelect && onToggleSelect(dateKey, prog.instanceId, e);
                          }}
                          style={{ padding: '10px 14px', textAlign: 'center', cursor: 'pointer' }}
                        >
                          {isSelected ? (
                            <CheckSquare size={16} style={{ color: 'var(--accent-primary)' }} />
                          ) : (
                            <Square size={16} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                          )}
                        </td>

                        {/* Sıra ve Sürükleme Tutamacı */}
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <GripVertical size={13} style={{ cursor: 'grab', color: 'var(--text-muted)' }} />
                            <span>{prog.order || pIdx + 1}</span>
                          </div>
                        </td>

                        {/* Saat Aralığı */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isKisa ? '#0891b2' : 'var(--accent-primary)',
                            background: isKisa ? 'rgba(6, 182, 212, 0.12)' : 'rgba(59, 130, 246, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {prog.startTime} - {prog.endTime}
                          </span>
                        </td>

                        {/* Süre */}
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: prog.episodeDurationFormatted ? '#047857' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          <div>{prog.episodeDurationFormatted || `${prog.duration} dk`}</div>
                          {prog.partsCount > 1 && (
                            <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 800 }}>
                              {prog.partsCount} Part Toplamı
                            </div>
                          )}
                        </td>

                        {/* Kategori Rozeti */}
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isKisa ? 'rgba(6, 182, 212, 0.12)' : `${prog.categoryColor || '#2563eb'}22`,
                            color: isKisa ? '#0891b2' : (prog.categoryColor || '#2563eb')
                          }}>
                            {isKisa ? 'Dolgu Kuşağı' : (prog.categoryBadge || prog.category || 'Genel')}
                          </span>
                        </td>

                        {/* Program Başlığı */}
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: isKisa ? '#0891b2' : isLive ? '#dc2626' : 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '999px',
                              background: rowAccentColor,
                              flexShrink: 0
                            }} />
                            <span>{prog.title}</span>
                            {isLive && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '9.5px',
                                fontWeight: 900,
                                background: '#ef4444',
                                color: '#ffffff',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                letterSpacing: '0.3px',
                                boxShadow: '0 1px 4px rgba(239, 68, 68, 0.35)',
                                whiteSpace: 'nowrap'
                              }}>
                                ● CANLI YAYIN
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Bölüm */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {prog.episode ? (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              background: 'var(--bg-tertiary)',
                              color: 'var(--warning)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              Bölüm {prog.episode}
                            </span>
                          ) : '-'}
                        </td>

                        {/* Opsiyonlar / Sunucu */}
                        <td style={{ padding: '10px 14px' }}>
                          {isKisa ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(prog.availableOptions || []).map(opt => {
                                const isSelectedOption = (prog.selectedOptions || []).includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleOption(dateKey, prog.instanceId, opt, e);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid',
                                      borderColor: isSelectedOption ? '#0891b2' : 'var(--border-color)',
                                      background: isSelectedOption ? '#e0f2fe' : 'var(--bg-secondary)',
                                      color: isSelectedOption ? '#0369a1' : 'var(--text-secondary)',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {OPTION_ICONS[opt] || <CheckCircle2 size={10} />}
                                    <span>{opt}</span>
                                    {isSelectedOption && <span style={{ fontSize: '8px' }}>✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{prog.host || '-'}</span>
                          )}
                        </td>

                        {/* Konu / Şehir */}
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {prog.topic || '-'}
                        </td>

                        {/* İşlemler (Üste/Alta Taşı, Düzenle, Kopyala, Sil) */}
                        <td
                          onClick={e => e.stopPropagation()}
                          style={{ padding: '10px 14px', textAlign: 'center' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {onMoveProgramOrder && (
                              <>
                                <button
                                  type="button"
                                  disabled={pIdx === 0}
                                  onClick={() => pIdx > 0 && onMoveProgramOrder(dateKey, prog.instanceId, 'up')}
                                  title="Programı Bir Üste Taşı"
                                  style={{
                                    background: pIdx > 0 ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                    border: 'none',
                                    color: pIdx > 0 ? '#059669' : 'var(--text-muted)',
                                    opacity: pIdx > 0 ? 1 : 0.35,
                                    cursor: pIdx > 0 ? 'pointer' : 'not-allowed',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={pIdx >= filteredProgs.length - 1}
                                  onClick={() => pIdx < filteredProgs.length - 1 && onMoveProgramOrder(dateKey, prog.instanceId, 'down')}
                                  title="Programı Bir Alta Taşı"
                                  style={{
                                    background: pIdx < filteredProgs.length - 1 ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                    border: 'none',
                                    color: pIdx < filteredProgs.length - 1 ? '#059669' : 'var(--text-muted)',
                                    opacity: pIdx < filteredProgs.length - 1 ? 1 : 0.35,
                                    cursor: pIdx < filteredProgs.length - 1 ? 'pointer' : 'not-allowed',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                >
                                  <ArrowDown size={13} />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => onSelectProgram && onSelectProgram(prog, dateKey)}
                              title="Programı Düzenle (Form ve Detaylar)"
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                color: 'var(--accent-primary)',
                                cursor: 'pointer',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                fontWeight: 600
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                            >
                              <Edit3 size={12} />
                              <span>Düzenle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDuplicateProgram && onDuplicateProgram(dateKey, prog.instanceId)}
                              title="Bu kuşağı bir alt sıraya kopyala"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '3px'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                              <Copy size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteProgram && onDeleteProgram(dateKey, prog.instanceId)}
                              title="Kuşağı sil"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '3px'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(DraftRundownTable);
