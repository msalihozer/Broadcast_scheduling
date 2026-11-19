/**
 * @file DraftSeriesQuotaModal.jsx
 * @description Haftalık dizi dağılım kotalarını ve aktif yayın akışındaki gerçekleşme durumlarını gösteren modal.
 */
import React, { useMemo } from 'react';
import { Layers, X, CheckCircle2, AlertCircle, Calendar, Film } from 'lucide-react';
import { SERIES_QUOTAS } from '../constants/draftConstants';

const DraftSeriesQuotaModal = ({
  isOpen,
  onClose,
  scheduleData,
  dateRangeLabel
}) => {
  // Aktif akıştaki her dizi için kaç gün planlandığını ve hangi günlerde olduğunu analiz et
  const quotaAnalysis = useMemo(() => {
    if (!scheduleData) return [];

    const dayEntries = Object.entries(scheduleData);

    return SERIES_QUOTAS.map(quota => {
      const qLower = quota.name.toLowerCase().trim();
      const matchedDays = [];
      let totalSlots = 0;

      dayEntries.forEach(([dateKey, dayObj]) => {
        const progs = dayObj?.programs || [];
        const hasSeries = progs.some(p => {
          const title = (p.title || '').toLowerCase();
          const raw = (p.rawTitle || '').toLowerCase();
          return title.includes(qLower) || raw.includes(qLower);
        });

        if (hasSeries) {
          const shortDay = (dayObj.dayName || '').slice(0, 3);
          matchedDays.push({
            dateKey,
            dayName: dayObj.dayName,
            shortDay
          });
          const matchCount = progs.filter(p => {
            const title = (p.title || '').toLowerCase();
            const raw = (p.rawTitle || '').toLowerCase();
            return title.includes(qLower) || raw.includes(qLower);
          }).length;
          totalSlots += matchCount;
        }
      });

      const actualCount = matchedDays.length;
      const targetCount = quota.count;
      const isCompleted = actualCount >= targetCount;
      const percent = Math.min(100, Math.round((actualCount / targetCount) * 100));

      return {
        ...quota,
        actualCount,
        targetCount,
        matchedDays,
        totalSlots,
        isCompleted,
        percent
      };
    });
  }, [scheduleData]);

  // Özet İstatistikler
  const summaryStats = useMemo(() => {
    const totalTarget = quotaAnalysis.reduce((acc, q) => acc + q.targetCount, 0);
    const totalActual = quotaAnalysis.reduce((acc, q) => acc + q.actualCount, 0);
    const completedCount = quotaAnalysis.filter(q => q.isCompleted).length;
    const overallPercent = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

    return {
      totalTarget,
      totalActual,
      completedCount,
      totalSeries: quotaAnalysis.length,
      overallPercent
    };
  }, [quotaAnalysis]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInModal 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Haftalık Dizi Dağılımı ve Kotaları
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} />
                <span>{dateRangeLabel || 'Haftalık Yayın Akışı'}</span>
                <span>•</span>
                <span>Hedef Kota ve Gerçekleşme Analizi</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Özet Metrik Kartları */}
        <div style={{
          padding: '16px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)'
        }}>
          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOPLAM HEDEF</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {summaryStats.totalTarget} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>gün/hf</span>
            </div>
          </div>

          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>PLANLANAN</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '2px' }}>
              {summaryStats.totalActual} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>gün/hf</span>
            </div>
          </div>

          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TAMAMLANAN SERİ</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
              {summaryStats.completedCount} / {summaryStats.totalSeries}
            </div>
          </div>

          <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>UYUM ORANI</div>
            <div style={{
              fontSize: '18px',
              fontWeight: 800,
              color: summaryStats.overallPercent >= 90 ? '#10b981' : (summaryStats.overallPercent >= 70 ? '#f59e0b' : '#ef4444'),
              marginTop: '2px'
            }}>
              %{summaryStats.overallPercent}
            </div>
          </div>
        </div>

        {/* Dizi Kotaları Listesi (Scrollable) */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {quotaAnalysis.map(q => (
            <div
              key={q.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = q.color;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {/* Sol: İsim ve Gün Rozetleri */}
              <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: q.color,
                    flexShrink: 0
                  }} />
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--text-primary)'
                  }}>
                    {q.name}
                  </span>
                  {q.isCompleted ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      <CheckCircle2 size={12} /> Kota Tamam
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#f59e0b',
                      background: 'rgba(245, 158, 11, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      <AlertCircle size={12} /> {q.targetCount - q.actualCount} gün eksik
                    </span>
                  )}
                </div>

                {/* Yayın Günleri */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Yayın Günleri:</span>
                  {q.matchedDays.length > 0 ? (
                    q.matchedDays.map(d => (
                      <span
                        key={d.dateKey}
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${q.color}15`,
                          color: q.color,
                          border: `1px solid ${q.color}30`
                        }}
                      >
                        {d.shortDay}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Henüz akışta planlanmadı
                    </span>
                  )}
                </div>
              </div>

              {/* Sağ: İlerleme Çubuğu ve Sayısal Değer */}
              <div style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Hedef: <strong>{q.targetCount} gün</strong></span>
                  <span style={{ fontWeight: 800, color: q.isCompleted ? '#10b981' : 'var(--text-primary)' }}>
                    {q.actualCount} / {q.targetCount} gün
                  </span>
                </div>
                {/* Progress Track */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'var(--bg-tertiary)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${q.percent}%`,
                    height: '100%',
                    borderRadius: '4px',
                    background: q.isCompleted ? '#10b981' : q.color,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            * Dizi kotaları haftalık yayın akışının dengeli dağıtılması için referans hedeflerdir.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
            }}
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraftSeriesQuotaModal);
