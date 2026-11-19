/**
 * @file src/pages/DraftPreviewPopout.jsx
 * @description Çoklu monitör (Pop-out) kullanımı için bağımsız Taslak Önizleme penceresi (/draft-preview).
 * BroadcastChannel ('yayin-otomasyon-channel') üzerinden seçili günü veya haftayı ana ekrandaki yayına aktarır.
 */
import React, { useState, useEffect } from 'react';
import usePlanningStore from '../store/planningStore';
import { format, startOfWeek, addDays, parseISO, isSameDay } from 'date-fns';
import { tr } from 'date-fns/locale';
import { X, Calendar, LayoutList, CheckCircle2 } from 'lucide-react';
import { getCategoryDetails } from '../utils/categoryColors';
import { dialog } from '../store/dialogStore';

const formatTotalDuration = (totalMinutes) => {
  if (!totalMinutes) return "00:00:00";
  const totalSeconds = Math.round(totalMinutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatTrimTime = (val) => {
  if (val == null || val === '') return '-';
  if (typeof val === 'number' || !isNaN(Number(val))) {
     const num = Number(val);
     const h = Math.floor(num / 3600);
     const m = Math.floor((num % 3600) / 60);
     const s = Math.floor(num % 60);
     return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return val;
};

const DraftPreviewPopout = () => {
  const [viewMode, setViewMode] = useState('daily');
  
  // URL params'dan kanal ve tarihi al
  const [channelId, setChannelId] = useState('');
  const [baseDate, setBaseDate] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channel = params.get('channel');
    const date = params.get('date');
    if (channel) setChannelId(channel);
    if (date) setBaseDate(date);
    document.title = "Yayın Planı Önizleme";
  }, []);

  const daysStore = usePlanningStore(state => state.days);
  const safeDate = baseDate || format(new Date(), 'yyyy-MM-dd');
  
  let dateObj = new Date();
  try {
    if (baseDate) dateObj = parseISO(safeDate);
  } catch (e) {}

  const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 });

  // Get current day draft
  const draftKey = `draft-${channelId}-${safeDate}`;
  const draftDay = daysStore[draftKey];
  let dailyPrograms = [];
  if (draftDay && draftDay.variants[draftDay.activeVariant]) {
    dailyPrograms = draftDay.variants[draftDay.activeVariant].programs || [];
  }
  const dailyTotalDuration = dailyPrograms.reduce((sum, p) => sum + p.duration, 0);

  // Get week draft data
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const currentDate = addDays(weekStart, i);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dKey = `draft-${channelId}-${dateStr}`;
    const dDay = daysStore[dKey];
    
    let progs = [];
    if (dDay && dDay.variants[dDay.activeVariant]) {
      progs = dDay.variants[dDay.activeVariant].programs || [];
    }
    const totalDuration = progs.reduce((sum, p) => sum + p.duration, 0);
    return {
      date: currentDate,
      dateStr,
      programsCount: progs.length,
      totalDuration,
      isSelected: isSameDay(currentDate, dateObj)
    };
  });

  const handleApplyDay = () => {
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'APPLY_DRAFT_DAY', 
        channelId, 
        date: safeDate 
      }, '*');
      window.close();
    } else {
      dialog.warning("Bağlantı Hatası", "Ana pencere bulunamadı. Lütfen sayfayı yenileyin.");
    }
  };

  const handleApplyWeek = () => {
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'APPLY_DRAFT_WEEK', 
        channelId, 
        date: safeDate 
      }, '*');
      window.close();
    } else {
      dialog.warning("Bağlantı Hatası", "Ana pencere bulunamadı. Lütfen sayfayı yenileyin.");
    }
  };

  const handleClose = () => {
    window.close();
  };

  if (!channelId || !baseDate) {
    return <div style={{ padding: '20px', color: 'var(--text-primary)' }}>Yükleniyor...</div>;
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--bg-primary)', zIndex: 1000,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '8px' }}>
            <Calendar size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>Yayın Planı Önizleme</h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {format(dateObj, 'd MMMM yyyy EEEE', { locale: tr })} - {channelId === 'ch_hd' ? 'Semerkand HD' : 'Semerkand WAY'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setViewMode('daily')}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: viewMode === 'daily' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'daily' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
            >
              <LayoutList size={16} /> Günlük
            </button>
            <button 
              onClick={() => setViewMode('weekly')}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: viewMode === 'weekly' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'weekly' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
            >
              <Calendar size={16} /> Haftalık
            </button>
          </div>
          <button onClick={handleClose} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg-primary)', minHeight: 0, minWidth: 0 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          
          {viewMode === 'daily' ? (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', overflowX: 'auto' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Günlük Özet</h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Program Sayısı: <strong style={{ color: 'var(--text-primary)' }}>{dailyPrograms.length}</strong></span>
                  <span style={{ color: 'var(--text-secondary)' }}>Toplam Süre: <strong style={{ color: 'var(--text-primary)' }}>{formatTotalDuration(dailyTotalDuration)}</strong></span>
                </div>
              </div>
              <div style={{ padding: '0' }}>
                {dailyPrograms.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '50px' }}>No</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '100px' }}>Saat</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '100px' }}>Süre</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500' }}>Program Adı</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '80px' }}>ID</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '100px' }}>Trim In</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '100px' }}>Trim Out</th>
                        <th style={{ padding: '12px 20px', fontWeight: '500', width: '120px' }}>Kategori</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyPrograms.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-primary)', fontWeight: '500' }}>{formatTotalDuration(p.startMinute)}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{formatTotalDuration(p.duration)}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: p.isOverflow ? 'var(--danger)' : getCategoryDetails(p.categoryId, p.categoryName).bg }}></div>
                              <span>{p.title || 'İsimsiz Program'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{p.id || '-'}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{formatTrimTime(p.trimIn)}</td>
                          <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{formatTrimTime(p.trimOut)}</td>
                          <td style={{ padding: '12px 20px' }}>
                            <span style={{
                              background: getCategoryDetails(p.categoryId, p.categoryName).bg,
                              color: getCategoryDetails(p.categoryId, p.categoryName).color,
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}>
                              {getCategoryDetails(p.categoryId, p.categoryName).label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Bu gün için henüz yayın planı oluşturulmamış.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
              {weekDays.map((day, idx) => (
                <div key={idx} style={{ 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '12px', 
                  border: `1px solid ${day.isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    {format(day.date, 'EEEE', { locale: tr })}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: day.isSelected ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: '16px' }}>
                    {format(day.date, 'dd MMM', { locale: tr })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', fontSize: '12px' }}>
                    <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>Program</div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{day.programsCount}</div>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>Süre</div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatTotalDuration(day.totalDuration)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button 
          onClick={handleClose}
          style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500', transition: 'background 0.2s' }}
        >
          Kapat
        </button>
        <button 
          onClick={handleApplyWeek}
          style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
        >
          <CheckCircle2 size={18} /> Tüm Haftayı Uygula
        </button>
        <button 
          onClick={handleApplyDay}
          style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
        >
          <CheckCircle2 size={18} /> Sadece Günü Uygula
        </button>
      </div>

    </div>
  );
};

export default DraftPreviewPopout;
