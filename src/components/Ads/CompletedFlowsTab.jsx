/**
 * @file src/components/Ads/CompletedFlowsTab.jsx
 * @description Reklam yerleşimi tamamlanmış ve Liste Kontrol aşamasına aktarılmış yayın akışlarını inceleme ve geri alma sekmesi.
 */
import React, { useState } from 'react';
import usePlanningStore from '../../store/planningStore';
import { CalendarCheck, Search, Filter, RotateCcw, Eye, X } from 'lucide-react';
import useDialogStore, { dialog } from '../../store/dialogStore';

const CompletedFlowsTab = () => {
  const { days, listControlDays, channels, adPlacements, resetAds } = usePlanningStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDayInfo, setSelectedDayInfo] = useState(null);

  const [viewMode, setViewMode] = useState('ads'); // 'ads' or 'full'

  // Filtreleme: Yalnızca adsStatus === 'completed' veya 'sent_to_master' olan list-control günleri getir
  const completedDays = Object.entries(listControlDays || {})
    .filter(([key, dayData]) => key.startsWith('list-control-') && dayData && (dayData.adsStatus === 'completed' || dayData.adsStatus === 'sent_to_master'))
    .map(([key, dayData]) => {
      const parts = key.split('-');
      // format: list-control-ch_hd-2026-07-29
      const channelId = parts[2];
      const dateStr = parts.slice(3).join('-');
      
      const channel = channels.find(c => c.id === channelId);
      const readyKey = `ready-${channelId}-${dateStr}`;
      const placements = adPlacements[readyKey] || [];
      const programs = dayData?.variants[dayData.activeVariant || 'v1']?.programs || [];
      
      let totalAds = 0;
      let totalDurationSec = 0;
      
      placements.forEach(bp => {
        if (bp.ads) {
          totalAds += bp.ads.length;
          totalDurationSec += bp.ads.reduce((acc, ad) => acc + (parseInt(ad.duration) || 0), 0);
        }
      });
      
      return {
        key,
        channelId,
        channelName: channel ? channel.name : channelId,
        date: dateStr,
        placements,
        programs,
        totalAds,
        totalDurationSec,
        updatedAt: dayData.updatedAt
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // En yeniden eskiye

  const filteredDays = completedDays.filter(d => 
    d.channelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.date.includes(searchTerm)
  );

  const handleRevert = async (channelId, dateStr, e) => {
    e.stopPropagation();
    const ok = await dialog.confirm(
      'Taslağa Dönüş Onayı',
      `${dateStr} tarihi için yapılmış olan reklam planlamasını iptal edip taslağa dönmek istediğinize emin misiniz?`,
      {
        confirmText: 'Evet, İptal Et',
        isDestructive: true
      }
    );
    if (ok) {
      resetAds(channelId, dateStr);
      if (selectedDayInfo && selectedDayInfo.key === `ready-${channelId}-${dateStr}`) {
        setSelectedDayInfo(null);
      }
      dialog.success('Başarılı', 'Reklam planlaması iptal edildi ve sıfırlandı.');
    }
  };

  const formatDuration = (sec) => {
    if (!sec) return '0 sn';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m > 0) return `${m} dk ${s > 0 ? s + ' sn' : ''}`;
    return `${s} sn`;
  };

  const formatTimecode = (totalMinutes) => {
    if (totalMinutes == null) return '00.00.00.00';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.floor(totalMinutes % 60);
    const totalSeconds = (totalMinutes % 1) * 60;
    const secs = Math.floor(totalSeconds);
    const frames = Math.round((totalSeconds % 1) * 25);
    return `${hours.toString().padStart(2, '0')}.${mins.toString().padStart(2, '0')}.${secs.toString().padStart(2, '0')}.${frames.toString().padStart(2, '0')}`;
  };

  const renderDetails = () => {
    if (!selectedDayInfo) return null;

    let totalProgramDurationMin = 0;
    const flattenedFlow = [];
    let programCount = 0;
    
    if (selectedDayInfo.programs && selectedDayInfo.programs.length > 0) {
      selectedDayInfo.programs.forEach((prog) => {
        const progDurMin = parseFloat(prog.duration) || 0;
        
        if (!prog.isAdClip) {
          totalProgramDurationMin += progDurMin;
          programCount++;
        }

        if (viewMode === 'full') {
          flattenedFlow.push({
            type: prog.isAdClip ? 'ad' : 'program',
            id: prog.id || '-',
            title: prog.title,
            startTime: prog.startMinute,
            duration: progDurMin,
            instanceId: prog.instanceId,
            isAdBlock: false
          });
        }
      });
    }

    const totalProgramDurationSec = totalProgramDurationMin * 60;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--bg-primary)', width: '90vw', maxHeight: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', minHeight: 0 }}>
          
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '8px', borderRadius: '8px' }}>
                <CalendarCheck size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Reklamlar ve Liste Detayı</h2>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <span>{selectedDayInfo.channelName} • {new Date(selectedDayInfo.date).toLocaleDateString('tr-TR')}</span>
                  {selectedDayInfo.updatedAt && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      (Son Güncelleme: {new Date(selectedDayInfo.updatedAt).toLocaleString('tr-TR', { hour: '2-digit', minute:'2-digit' })})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedDayInfo(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ padding: '0 20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            <div 
              style={{ padding: '12px 0', cursor: 'pointer', color: viewMode === 'ads' ? 'var(--accent-primary)' : 'var(--text-muted)', borderBottom: viewMode === 'ads' ? '2px solid var(--accent-primary)' : '2px solid transparent', fontWeight: viewMode === 'ads' ? 'bold' : 'normal' }}
              onClick={() => setViewMode('ads')}
            >
              Kuşak ve Reklamlar
            </div>
            <div 
              style={{ padding: '12px 0', cursor: 'pointer', color: viewMode === 'full' ? 'var(--accent-primary)' : 'var(--text-muted)', borderBottom: viewMode === 'full' ? '2px solid var(--accent-primary)' : '2px solid transparent', fontWeight: viewMode === 'full' ? 'bold' : 'normal' }}
              onClick={() => setViewMode('full')}
            >
              Tüm Akış
            </div>
          </div>

          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0 }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>Reklam Özet</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {selectedDayInfo.totalAds} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal' }}>spot</span>
                  <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>|</span>
                  <span style={{ fontSize: '16px' }}>{formatTimecode(selectedDayInfo.totalDurationSec / 60)}</span>
                </span>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>Liste Özet (Programlar)</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {programCount} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal' }}>program</span>
                  <span style={{ margin: '0 8px', color: 'var(--border-color)' }}>|</span>
                  <span style={{ fontSize: '16px' }}>{formatTimecode(totalProgramDurationMin)}</span>
                </span>
              </div>
            </div>

            {viewMode === 'ads' && (
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Yerleşimler (Kuşak Bazlı)</h3>
                {selectedDayInfo.placements.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                    Bu gün için yerleştirilmiş herhangi bir reklam bulunmuyor.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedDayInfo.placements.map((bp, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{bp.time}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px' }}>
                            Kuşak: {bp.timeBlockName} ({bp.duration} dk)
                          </span>
                        </div>
                        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-primary)' }}>
                          {bp.ads && bp.ads.map((ad, i) => {
                            const material = usePlanningStore.getState().materials.find(m => String(m.id) === String(ad.materialId));
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: i < bp.ads.length - 1 ? '1px dashed var(--border-color)' : 'none', paddingBottom: i < bp.ads.length - 1 ? '8px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }}></div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{material ? (material.clipName || material.name) : 'Bilinmeyen Materyal'}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ID: {material ? (material.clipId || material.code || material.id) : ad.materialId}</span>
                                  </div>
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>{ad.duration} sn</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {viewMode === 'full' && (
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Tüm Akış</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 85px 85px 1fr 120px', gap: '16px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    <div>Sıra</div>
                    <div>Saat</div>
                    <div>Süre</div>
                    <div>Program / Reklam Klibi</div>
                    <div style={{ textAlign: 'right' }}>ID</div>
                  </div>
                  {flattenedFlow.map((item, idx) => {
                    return (
                      <div key={item.instanceId + '-' + idx} style={{ display: 'grid', gridTemplateColumns: '60px 85px 85px 1fr 120px', gap: '16px', padding: '14px 16px', background: item.type === 'ad' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '15px', alignItems: 'center' }}>
                        <div style={{ color: 'var(--text-muted)' }}>{idx + 1}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatTimecode(item.startTime)}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{formatTimecode(item.duration)}</div>
                        <div style={{ color: item.type === 'ad' ? '#3b82f6' : 'var(--text-primary)', fontWeight: item.type === 'ad' ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: item.type === 'ad' ? '10px' : '0' }}>
                          {item.type === 'ad' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }}></div>}
                          {item.title}
                        </div>
                        <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>{item.id}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>
          
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-secondary)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', flexShrink: 0 }}>
             <button 
                onClick={(e) => handleRevert(selectedDayInfo.channelId, selectedDayInfo.date, e)}
                style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={16} /> Geri Al / İptal Et
              </button>
            <button 
              onClick={() => setSelectedDayInfo(null)}
              style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Kapat
            </button>
          </div>

        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', color: 'var(--text-primary)' }}>Reklamlar ve Liste</h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)' }}>Otomatik veya manuel olarak onaylanmış günlük reklam planlarını görüntüleyin.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Kanal veya tarih ara..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 16px 10px 48px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
        <button style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '500' }}>
          <Filter size={18} /> Filtrele
        </button>
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>Tarih</th>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>Kanal</th>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Spot Sayısı</th>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Toplam Süre</th>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Durum</th>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>Son Güncelleme</th>
                <th style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredDays.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Herhangi bir onaylanmış yayın akışı ve reklam listesi bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredDays.map((dayInfo) => (
                  <tr key={dayInfo.key} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {new Date(dayInfo.date).toLocaleDateString('tr-TR')}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-primary)' }}>
                      {dayInfo.channelName}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                      {dayInfo.totalAds}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>
                      {formatDuration(dayInfo.totalDurationSec)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                       <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                          Onaylandı
                       </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {dayInfo.updatedAt ? new Date(dayInfo.updatedAt).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button 
                          onClick={() => setSelectedDayInfo(dayInfo)}
                          title="Görüntüle"
                          style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={(e) => handleRevert(dayInfo.channelId, dayInfo.date, e)}
                          title="Geri Al"
                          style={{ background: 'transparent', color: '#ef4444', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <RotateCcw size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {renderDetails()}
    </div>
  );
};

export default CompletedFlowsTab;
