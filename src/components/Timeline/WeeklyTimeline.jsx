/**
 * @file WeeklyTimeline.jsx
 * @description 7 Günlük Haftalık Yayın Akışı Matris Görünümü.
 * 
 * Temel Sorumluluklar:
 * 1. 24 saatlik zaman dilimlerini (5'er dakikalık slotlar) Pazartesi-Pazar olarak listeleme
 * 2. Excel haftalık akış dosyasını içe aktarma (/api/importWeeklyFlow)
 * 3. Günler arası sürükle-bırak veya doğrudan slot seçimiyle program yerleştirme
 * 4. Haftalık yayın dengesini ve doluluk oranlarını görselleştirme
 */
import React, { useState, useEffect, useRef } from 'react';
import usePlanningStore from '../../store/planningStore';
import useThemeStore, { hexToRgba } from '../../store/themeStore';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { dialog } from '../../store/dialogStore';
import { 
  Calendar, 
  Upload, 
  Trash2, 
  Clock, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Plus,
  Save,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import CustomDatePicker from '../CustomDatePicker';

const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

const WeeklyTimeline = ({ date }) => {
  const themeConfig = useThemeStore(state => state.config);
  const lcMod = themeConfig?.modules?.['list-control'] || {};
  const adBlockColor = lcMod.adBlockColor || themeConfig?.specialColors?.adBreakColor || '#f59e0b';
  const progBlockColor = lcMod.programBlockColor || 'var(--accent-primary)';
  const {
    weeklyFlow,
    initializeWeeklyFlowForWeek,
    importWeeklyFlowData,
    updateFlowSlot,
    assignProgramToSlot,
    assignReklamToSlot,
    clearSlotBlock,
    clearWeeklyFlow,
    selectedChannel
  } = usePlanningStore();

  const safeDate = date || format(new Date(), 'yyyy-MM-dd');
  const baseDate = parseISO(safeDate);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  // Time Range Filter for easy navigation in the 288-row grid
  const [timeRange, setTimeRange] = useState('all'); // all, night, morning, afternoon, evening
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { dateStr, timeStr, slotData }
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const fileInputRef = useRef(null);

  // Initialize slots for the week if they do not exist
  useEffect(() => {
    initializeWeeklyFlowForWeek(weekStartStr);
  }, [weekStartStr, initializeWeeklyFlowForWeek]);

  // Generate 7 days of the week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const currentDate = addDays(weekStart, i);
    return {
      date: currentDate,
      dateStr: format(currentDate, 'yyyy-MM-dd'),
      dayName: format(currentDate, 'EEEE', { locale: tr }),
      shortDate: format(currentDate, 'dd.MM')
    };
  });

  // Filter slots based on selected time range
  const filteredSlots = TIME_SLOTS.filter(timeStr => {
    if (timeRange === 'all') return true;
    const hour = parseInt(timeStr.split(':')[0]);
    if (timeRange === 'night') return hour >= 0 && hour < 6;
    if (timeRange === 'morning') return hour >= 6 && hour < 12;
    if (timeRange === 'afternoon') return hour >= 12 && hour < 18;
    if (timeRange === 'evening') return hour >= 18 && hour < 24;
    return true;
  });

  // Handle Drag over slot
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Handle Drop on slot
  const handleDrop = (e, dateStr, timeStr) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      
      const program = JSON.parse(dataStr);
      // Ask user for duration or default to 30 mins
      const durationStr = prompt(`${program.title} için yayın süresi girin (Dakika cinsinden):`, '30');
      const duration = parseInt(durationStr);
      
      if (!isNaN(duration) && duration > 0) {
        assignProgramToSlot(dateStr, timeStr, program, duration);
      }
    } catch (err) {
      console.error('Drop handling failed:', err);
    }
  };

  // Trigger Excel Import
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Parse and upload Excel file
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target.result.split(',')[1];
        const res = await fetch('/api/importWeeklyFlow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileBase64: base64 })
        });
        
        if (res.ok) {
          const parsedData = await res.json();
          importWeeklyFlowData(parsedData);
          dialog.success('Haftalık Akış Yüklendi', 'Haftalık akış başarıyla Excel\'den aktarıldı!');
        } else {
          const errMsg = await res.text();
          dialog.error('Akış Aktarma Hatası', errMsg);
        }
      } catch (err) {
        dialog.error('İthalat Hatası', err.message);
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsDataURL(file);
  };

  // Open Edit Modal
  const openEditModal = (dateStr, timeStr, slotData) => {
    let targetSlot = slotData;
    let targetTime = timeStr;
    if (slotData.isMerged && slotData.parentTime) {
      targetTime = slotData.parentTime;
      const daySlots = weeklyFlow[dateStr] || [];
      const parentIdx = Math.floor((parseInt(targetTime.split(':')[0]) * 60 + parseInt(targetTime.split(':')[1])) / 5);
      targetSlot = daySlots[parentIdx] || slotData;
    }
    
    setSelectedSlot({
      dateStr,
      timeStr: targetTime,
      type: targetSlot.type,
      programName: targetSlot.programName || '',
      episodeNo: targetSlot.episodeNo || '',
      presenter: targetSlot.presenter || '',
      subject: targetSlot.subject || '',
      duration: targetSlot.duration || 5,
      note: targetSlot.note || ''
    });
    setIsEditModalOpen(true);
  };

  // Save changes from Edit Modal
  const handleSaveModal = () => {
    if (!selectedSlot) return;
    const { dateStr, timeStr, type, programName, episodeNo, presenter, subject, duration, note } = selectedSlot;
    
    if (type === 'empty') {
      clearSlotBlock(dateStr, timeStr);
    } else if (type === 'reklam') {
      assignReklamToSlot(dateStr, timeStr, duration, note);
    } else {
      const mockProgram = { title: programName, episodeNo, presenter, subject };
      assignProgramToSlot(dateStr, timeStr, mockProgram, duration);
    }
    setIsEditModalOpen(false);
    setSelectedSlot(null);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      
      {/* Top Controller Bar */}
      <div style={{ padding: '24px 24px 16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', gap: '16px', flexShrink: 0 }}>
        
        {/* Navigation & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'var(--accent-primary)', color: 'white', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ChevronLeft 
                size={20} 
                color="var(--text-secondary)" 
                style={{ cursor: 'pointer' }}
                onClick={() => usePlanningStore.getState().setSelectedDate(format(addDays(weekStart, -7), 'yyyy-MM-dd'))} 
              />
              <CustomDatePicker selectedDate={safeDate} onDateChange={(newDate) => usePlanningStore.getState().setSelectedDate(newDate)}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, cursor: 'pointer' }}>
                  HAFTALIK AKIŞ ({format(weekStart, 'd MMMM', { locale: tr })} - {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: tr })})
                </h2>
              </CustomDatePicker>
              <ChevronRight 
                size={20} 
                color="var(--text-secondary)" 
                style={{ cursor: 'pointer' }}
                onClick={() => usePlanningStore.getState().setSelectedDate(format(addDays(weekStart, 7), 'yyyy-MM-dd'))} 
              />
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>5 Dakikalık Sabit Grid Planlama Modülü</span>
          </div>
        </div>

        {/* Filters and Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          {/* Time Filter Tabs */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {[
              { id: 'all', label: 'Tümü' },
              { id: 'night', label: 'Gece (00-06)' },
              { id: 'morning', label: 'Sabah (06-12)' },
              { id: 'afternoon', label: 'Öğle (12-18)' },
              { id: 'evening', label: 'Akşam (18-24)' }
            ].map(range => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: timeRange === range.id ? 'var(--accent-primary)' : 'transparent',
                  color: timeRange === range.id ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', background: 'var(--border-color)', height: '24px' }}></div>

          {/* Import / Clear Actions */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx" 
            style={{ display: 'none' }} 
          />
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              opacity: isImporting ? 0.6 : 1
            }}
          >
            <Upload size={16} />
            {isImporting ? 'Yükleniyor...' : 'Akış Yükle (Excel)'}
          </button>
          
          <button
            onClick={async () => {
              const ok = await dialog.confirm('Haftayı Temizle', 'Bu haftaya ait tüm hücreleri temizlemek istediğinize emin misiniz?', {
                confirmText: 'Evet, Temizle',
                isDestructive: true
              });
              if (ok) {
                clearWeeklyFlow(weekStartStr);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={16} />
            Haftayı Temizle
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto', padding: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-primary)', fontFamily: 'var(--lc-font-sans, var(--font-sans))' }}>
          
          {/* Table Header */}
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '12px 8px', width: '80px', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 10, textAlign: 'center', fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)' }}>Saat</th>
              {weekDays.map(day => {
                const dayTheme = themeConfig?.dayColors?.[day.dayName];
                return (
                  <th
                    key={day.dateStr}
                    style={{
                      padding: '12px',
                      minWidth: '150px',
                      textAlign: 'center',
                      borderRight: '1px solid var(--border-color)',
                      borderLeft: dayTheme ? `2.5px solid ${dayTheme.line}` : 'none',
                      borderTop: dayTheme ? `3.5px solid ${dayTheme.line}` : 'none',
                      background: dayTheme?.headerBg || 'var(--bg-secondary)'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '800', color: dayTheme?.textAccent || 'var(--text-primary)' }}>{day.dayName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{day.shortDate}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {filteredSlots.map(timeStr => {
              return (
                <tr key={timeStr} style={{ borderBottom: '1px solid var(--border-color)', height: '40px' }}>
                  
                  {/* Time Slot Header */}
                  <td style={{ 
                    padding: '8px', 
                    textAlign: 'center', 
                    fontWeight: 'bold', 
                    fontSize: '12px', 
                    background: 'var(--bg-secondary)', 
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 2, 
                    borderRight: '2px solid var(--border-color)', 
                    color: 'var(--text-secondary)',
                    boxShadow: '2px 0 5px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <Clock size={12} color="var(--text-muted)" />
                      {timeStr}
                    </div>
                  </td>

                  {/* Day Cells */}
                  {weekDays.map(day => {
                    const daySlots = weeklyFlow[day.dateStr] || [];
                    const slotIdx = TIME_SLOTS.indexOf(timeStr);
                    const slot = daySlots[slotIdx];

                    if (!slot) {
                      return <td key={day.dateStr} style={{ borderRight: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}></td>;
                    }

                    // Skip merged cells (since they are merged with the cell above)
                    if (slot.isMerged) {
                      return null;
                    }

                    let cellStyle = {
                      padding: '8px 12px',
                      borderRight: '1px solid var(--border-color)',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      position: 'relative',
                      verticalAlign: 'top'
                    };

                    if (slot.type === 'program') {
                      cellStyle.background = hexToRgba(progBlockColor, 0.12);
                      cellStyle.borderLeft = `4px solid ${progBlockColor}`;
                    } else if (slot.type === 'reklam') {
                      cellStyle.background = hexToRgba(adBlockColor, 0.16);
                      cellStyle.borderLeft = `4px solid ${adBlockColor}`;
                    } else {
                      cellStyle.background = 'transparent';
                    }

                    return (
                      <td
                        key={day.dateStr}
                        rowSpan={slot.slots_count || 1}
                        style={cellStyle}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, day.dateStr, timeStr)}
                        onClick={() => openEditModal(day.dateStr, timeStr, slot)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = slot.type === 'empty' ? 'var(--bg-tertiary)' : undefined}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = slot.type === 'empty' ? 'transparent' : undefined}
                      >
                        {slot.type === 'program' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                {slot.programName}
                              </span>
                              {slot.episodeNo && (
                                <span style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  Bölüm {slot.episodeNo}
                                </span>
                              )}
                            </div>
                            
                            {slot.presenter && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Sunucu:</span> {slot.presenter}
                              </div>
                            )}
                            
                            {slot.subject && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', wordBreak: 'break-word' }}>
                                {slot.subject}
                              </div>
                            )}

                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', alignSelf: 'flex-end', fontWeight: 'bold' }}>
                              {slot.duration} dk
                            </div>
                          </div>
                        )}

                        {slot.type === 'reklam' && (
                          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                            <div style={{ fontWeight: 'bold', color: '#d97706', fontSize: '13px' }}>
                              Reklam Kuşağı
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0' }}>
                              {slot.note || `${slot.duration} dk`}
                            </div>
                            <div style={{ fontSize: '10px', color: '#d97706', alignSelf: 'flex-end', fontWeight: 'bold' }}>
                              {slot.duration} dk
                            </div>
                          </div>
                        )}

                        {slot.type === 'empty' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px', minHeight: '24px', opacity: 0.3 }}>
                            <Plus size={14} style={{ marginRight: '4px' }} /> Boş Hücre
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modern Dialog/Modal for editing cell properties */}
      {isEditModalOpen && selectedSlot && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass" style={{
            width: '450px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                Hücre Düzenle ({selectedSlot.timeStr})
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedSlot.dateStr}</span>
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Hücre Tipi</label>
              <select
                value={selectedSlot.type}
                onChange={(e) => setSelectedSlot({ ...selectedSlot, type: e.target.value })}
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              >
                <option value="empty">Boş Hücre</option>
                <option value="program">Program</option>
                <option value="reklam">Reklam</option>
              </select>
            </div>

            {selectedSlot.type === 'program' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Program Adı</label>
                  <input
                    type="text"
                    value={selectedSlot.programName}
                    onChange={(e) => setSelectedSlot({ ...selectedSlot, programName: e.target.value })}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Bölüm No</label>
                    <input
                      type="text"
                      value={selectedSlot.episodeNo}
                      onChange={(e) => setSelectedSlot({ ...selectedSlot, episodeNo: e.target.value })}
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Süre (Dakika)</label>
                    <input
                      type="number"
                      step="5"
                      value={selectedSlot.duration}
                      onChange={(e) => setSelectedSlot({ ...selectedSlot, duration: Math.max(5, parseInt(e.target.value) || 5) })}
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Sunucu / Konuk</label>
                  <input
                    type="text"
                    value={selectedSlot.presenter}
                    onChange={(e) => setSelectedSlot({ ...selectedSlot, presenter: e.target.value })}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Konu / Açıklama</label>
                  <input
                    type="text"
                    value={selectedSlot.subject}
                    onChange={(e) => setSelectedSlot({ ...selectedSlot, subject: e.target.value })}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </>
            )}

            {selectedSlot.type === 'reklam' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Reklam Süresi (Dk)</label>
                    <input
                      type="number"
                      step="5"
                      value={selectedSlot.duration}
                      onChange={(e) => setSelectedSlot({ ...selectedSlot, duration: Math.max(5, parseInt(e.target.value) || 5) })}
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Reklam Notu</label>
                    <input
                      type="text"
                      placeholder="Örn: Reklam-6 dk"
                      value={selectedSlot.note}
                      onChange={(e) => setSelectedSlot({ ...selectedSlot, note: e.target.value })}
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                onClick={() => { setIsEditModalOpen(false); setSelectedSlot(null); }}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveModal}
                style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyTimeline;
