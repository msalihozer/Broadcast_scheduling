/**
 * @file DraftReportsModal.jsx
 * @description Taslak Planlama modülü haftalık ve günlük yayın akışı analiz & doluluk raporları modalı.
 */
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  X,
  Calendar,
  Clock,
  Radio,
  Sparkles,
  Film,
  Layers,
  CheckCircle2,
  AlertCircle,
  Printer
} from 'lucide-react';

const DraftReportsModal = ({
  isOpen,
  onClose,
  scheduleData,
  currentChannel,
  dateRangeLabel
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'programs' | 'days'

  const reportData = useMemo(() => {
    const dayEntries = Object.entries(scheduleData || {});
    let totalPrograms = 0;
    let totalSeconds = 0;
    let liveCount = 0;
    let liveSeconds = 0;
    let dolguCount = 0;
    let dolguSeconds = 0;
    let bantCount = 0;
    let bantSeconds = 0;

    const categoryMap = {};
    const programStatsMap = {};
    const dailyStats = [];

    dayEntries.forEach(([dateKey, dayObj]) => {
      const progs = dayObj?.programs || [];
      let dayTotalSec = 0;
      let dayLiveCount = 0;
      let dayDolguCount = 0;

      progs.forEach(p => {
        totalPrograms += 1;
        const sec =
          p.episodeTotalSec && p.episodeTotalSec > 0
            ? p.episodeTotalSec
            : (parseInt(p.duration, 10) || 30) * 60;

        totalSeconds += sec;
        dayTotalSec += sec;

        const isDolgu = p.isKisaSlot || p.title === 'Dolgu Kuşağı' || p.category === 'Kısa Program';
        const isLive = Boolean(p.isLive);

        if (isLive) {
          liveCount += 1;
          liveSeconds += sec;
          dayLiveCount += 1;
        } else if (isDolgu) {
          dolguCount += 1;
          dolguSeconds += sec;
          dayDolguCount += 1;
        } else {
          bantCount += 1;
          bantSeconds += sec;
        }

        const cat = isLive
          ? 'Canlı Yayın'
          : isDolgu
          ? 'Dolgu Kuşağı'
          : p.categoryBadge || p.category || 'Genel Program';

        if (!categoryMap[cat]) {
          categoryMap[cat] = { name: cat, count: 0, seconds: 0 };
        }
        categoryMap[cat].count += 1;
        categoryMap[cat].seconds += sec;

        const progTitle = (p.customTitle || p.title || 'İsimsiz Program').trim();
        if (!programStatsMap[progTitle]) {
          programStatsMap[progTitle] = {
            title: progTitle,
            category: cat,
            isLive,
            count: 0,
            seconds: 0,
            days: new Set()
          };
        }
        programStatsMap[progTitle].count += 1;
        programStatsMap[progTitle].seconds += sec;
        if (dayObj?.dayName) {
          programStatsMap[progTitle].days.add(dayObj.dayName.slice(0, 3));
        }
      });

      const dayTotalMin = Math.round(dayTotalSec / 60);
      const fillPct = Math.min(100, Math.round((dayTotalSec / 86400) * 100));
      const emptyPct = Math.max(0, 100 - fillPct);

      dailyStats.push({
        dateKey,
        dayName: dayObj?.dayName || dateKey,
        date: dayObj?.date || dateKey,
        programCount: progs.length,
        totalMin: dayTotalMin,
        emptyMin: Math.max(0, 1440 - dayTotalMin),
        fillPct,
        emptyPct,
        liveCount: dayLiveCount,
        dolguCount: dayDolguCount
      });
    });

    const totalCapacitySec = Math.max(1, dayEntries.length * 86400);
    const weeklyFillPct = Math.min(100, Math.round((totalSeconds / totalCapacitySec) * 100));
    const weeklyEmptyPct = Math.max(0, 100 - weeklyFillPct);

    const categories = Object.values(categoryMap).sort((a, b) => b.seconds - a.seconds);
    const programsList = Object.values(programStatsMap)
      .map(item => ({
        ...item,
        daysList: Array.from(item.days)
      }))
      .sort((a, b) => b.count - a.count || b.seconds - a.seconds);

    return {
      totalPrograms,
      totalMinutes: Math.round(totalSeconds / 60),
      totalHoursFormatted: `${Math.floor(totalSeconds / 3600)} sa ${Math.round((totalSeconds % 3600) / 60)} dk`,
      weeklyFillPct,
      weeklyEmptyPct,
      liveCount,
      liveMinutes: Math.round(liveSeconds / 60),
      dolguCount,
      dolguMinutes: Math.round(dolguSeconds / 60),
      bantCount,
      bantMinutes: Math.round(bantSeconds / 60),
      categories,
      programsList,
      dailyStats
    };
  }, [scheduleData]);

  if (!isOpen) return null;

  const formatMinToHours = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} dk`;
    if (m === 0) return `${h} sa`;
    return `${h} sa ${m} dk`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2100,
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
          maxWidth: '840px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Üst Başlık */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Taslak Yayın Akışı Raporları
              </h2>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {currentChannel?.name || 'Semerkand HD'}
                </span>
                <span>•</span>
                <span>{dateRangeLabel || 'Haftalık Akış'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Printer size={13} />
              <span>Yazdır</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Özet Kartlar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          padding: '16px 24px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>HAFTALIK DOLULUK</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
              %{reportData.weeklyFillPct}
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '6px' }}>
                (Boş: %{reportData.weeklyEmptyPct})
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Toplam {reportData.totalHoursFormatted}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TOPLAM KUŞAK</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              {reportData.totalPrograms} Adet
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Bant: {reportData.bantCount} Kuşak ({formatMinToHours(reportData.bantMinutes)})
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(225, 29, 72, 0.25)'
          }}>
            <div style={{ fontSize: '11px', color: '#e11d48', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Radio size={12} /> CANLI YAYIN
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#be123c', marginTop: '4px' }}>
              {reportData.liveCount} Kuşak
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Toplam {formatMinToHours(reportData.liveMinutes)}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(8, 145, 178, 0.25)'
          }}>
            <div style={{ fontSize: '11px', color: '#0891b2', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} /> DOLGU KUŞAĞI
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0e7490', marginTop: '4px' }}>
              {reportData.dolguCount} Kuşak
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Toplam {formatMinToHours(reportData.dolguMinutes)}
            </div>
          </div>
        </div>

        {/* Sekmeler */}
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)'
        }}>
          {[
            { id: 'overview', label: 'Günlük Doluluk & Kategori Özeti' },
            { id: 'programs', label: `Program Dağılım Listesi (${reportData.programsList.length})` }
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: active ? '1px solid #2563eb' : '1px solid var(--border-color)',
                  background: active ? '#2563eb' : 'var(--bg-secondary)',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* İçerik Gövdesi */}
        <div style={{
          padding: '18px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {activeTab === 'overview' ? (
            <>
              {/* Günlük Doluluk Tablosu */}
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Gün Bazlı Doluluk ve Boşluk Oranları
                </h3>
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '9px 12px', fontWeight: 700 }}>Gün</th>
                        <th style={{ padding: '9px 12px', fontWeight: 700 }}>Kuşak Sayısı</th>
                        <th style={{ padding: '9px 12px', fontWeight: 700 }}>Canlı / Dolgu</th>
                        <th style={{ padding: '9px 12px', fontWeight: 700 }}>Dolu Süre</th>
                        <th style={{ padding: '9px 12px', fontWeight: 700 }}>Boş Süre</th>
                        <th style={{ padding: '9px 12px', fontWeight: 700 }}>Doluluk Oranı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.dailyStats.map(d => (
                        <tr key={d.dateKey} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {d.dayName} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px' }}>({d.date})</span>
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{d.programCount} Kuşak</td>
                          <td style={{ padding: '9px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {d.liveCount > 0 ? `${d.liveCount} Canlı` : '—'} / {d.dolguCount > 0 ? `${d.dolguCount} Dolgu` : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: '#059669' }}>
                            {formatMinToHours(d.totalMin)}
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: d.emptyMin > 0 ? '#d97706' : 'var(--text-muted)' }}>
                            {formatMinToHours(d.emptyMin)}
                          </td>
                          <td style={{ padding: '9px 12px', width: '180px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                flex: 1,
                                height: '7px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '999px',
                                overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${d.fillPct}%`,
                                  height: '100%',
                                  background: d.fillPct >= 95 ? '#10b981' : d.fillPct > 0 ? '#3b82f6' : 'transparent',
                                  borderRadius: '999px'
                                }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 800, minWidth: '68px', textAlign: 'right' }}>
                                %{d.fillPct} / %{d.emptyPct}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Kategori Dağılımı */}
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kategori Bazlı Süre Dağılımı
                </h3>
                {reportData.categories.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Bu haftada henüz planlanmış program bulunmuyor.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                    {reportData.categories.map(cat => {
                      const mins = Math.round(cat.seconds / 60);
                      return (
                        <div
                          key={cat.name}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{cat.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cat.count} Kuşak</div>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                            {formatMinToHours(mins)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Program Dağılım Listesi */
            <div style={{
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '9px 12px', fontWeight: 700 }}>Program Adı</th>
                    <th style={{ padding: '9px 12px', fontWeight: 700 }}>Kategori / Tür</th>
                    <th style={{ padding: '9px 12px', fontWeight: 700 }}>Haftalık Tekrar</th>
                    <th style={{ padding: '9px 12px', fontWeight: 700 }}>Yayın Günleri</th>
                    <th style={{ padding: '9px 12px', fontWeight: 700 }}>Toplam Süre</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.programsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Bu haftada henüz planlanmış program bulunmuyor.
                      </td>
                    </tr>
                  ) : (
                    reportData.programsList.map(prog => (
                      <tr key={prog.title} style={{ borderTop: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {prog.title}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {prog.category}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          {prog.count} Kez
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {prog.daysList.join(', ')}
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>
                          {formatMinToHours(Math.round(prog.seconds / 60))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftReportsModal;

