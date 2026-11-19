/**
 * @file DraftExcelImportModal.jsx
 * @description Excel yayın akışını yüklerken hedef kanalları (tekli veya çoklu),
 * hedef yayın haftasını (7 günün tamamı) veya belirli bir tek günü (gün bazlı)
 * seçmeyi sağlayan kapsamlı içe aktarma modalı.
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Upload,
  X,
  FileSpreadsheet,
  Tv,
  Calendar,
  CalendarDays,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Layers,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, parseISO, addDays, getISOWeek, getDay, addWeeks, subWeeks, eachDayOfInterval } from 'date-fns';
import { tr } from 'date-fns/locale';

const DAY_OPTIONS = [
  { index: 0, name: 'Pazartesi', short: 'Pzt' },
  { index: 1, name: 'Salı', short: 'Sal' },
  { index: 2, name: 'Çarşamba', short: 'Çar' },
  { index: 3, name: 'Perşembe', short: 'Per' },
  { index: 4, name: 'Cuma', short: 'Cum' },
  { index: 5, name: 'Cumartesi', short: 'Cmt' },
  { index: 6, name: 'Pazar', short: 'Paz' }
];

const DraftExcelImportModal = ({
  isOpen,
  onClose,
  channels = [],
  activeChannelId = 'ch_hd',
  currentWeekStartDate,
  onExecuteImport,
  isImporting = false
}) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedChannelIds, setSelectedChannelIds] = useState([activeChannelId]);

  // İçe Aktarma Modu:
  // 'week' = Belirli bir haftanın tamamına uygula (Pazartesi-Pazar 7 gün)
  // 'single_day' = Sadece tek bir güne yükle (gün bazlı akış)
  // 'original' = Excel'deki orijinal tarihleri kullan
  const [dateMode, setDateMode] = useState('week');

  // Hafta Modu için seçilen referans tarih (herhangi bir gün seçilebilir, haftayı belirler)
  const [customStartDate, setCustomStartDate] = useState(
    currentWeekStartDate || format(new Date(), 'yyyy-MM-dd')
  );

  // Tek Gün Modu için hedef tarih ve kaynak gün
  const [singleDayDate, setSingleDayDate] = useState(
    currentWeekStartDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [singleDaySourceIndex, setSingleDaySourceIndex] = useState(0);
  const [isSourceDayManual, setIsSourceDayManual] = useState(false);

  // Modal her açıldığında aktif kanalı varsayılan olarak seçili yap
  useEffect(() => {
    if (isOpen) {
      if (!selectedChannelIds.includes(activeChannelId)) {
        setSelectedChannelIds([activeChannelId]);
      }
      if (currentWeekStartDate) {
        setCustomStartDate(currentWeekStartDate);
        setSingleDayDate(currentWeekStartDate);
        try {
          const parsed = parseISO(currentWeekStartDate);
          const dIdx = (getDay(parsed) + 6) % 7;
          setSingleDaySourceIndex(dIdx);
        } catch (e) {}
      }
    }
  }, [isOpen, activeChannelId, currentWeekStartDate]);

  // Tek gün tarihi değiştiğinde kaynak günü otomatik eşle (kullanıcı elle değiştirmediyse)
  const handleSingleDayDateChange = (newDateStr) => {
    setSingleDayDate(newDateStr);
    if (!isSourceDayManual) {
      try {
        const parsed = parseISO(newDateStr);
        const dIdx = (getDay(parsed) + 6) % 7;
        setSingleDaySourceIndex(dIdx);
      } catch (e) {}
    }
  };

  // Kanal seçme / kaldırma
  const handleToggleChannel = (channelId) => {
    setSelectedChannelIds(prev => {
      if (prev.includes(channelId)) {
        if (prev.length === 1) return prev; // En az 1 kanal kalmalı
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  // Tüm Kanalları Seç
  const handleSelectAllChannels = () => {
    if (selectedChannelIds.length === channels.length) {
      setSelectedChannelIds([activeChannelId]);
    } else {
      setSelectedChannelIds(channels.map(c => c.id));
    }
  };

  // Dosya Seçimi
  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    e.target.value = '';
  };

  // Özel seçilen tarihin ait olduğu haftayı detaylı hesapla (Pazartesi - Pazar)
  const customWeekDetails = useMemo(() => {
    try {
      const parsed = parseISO(customStartDate);
      const monday = startOfWeek(parsed, { weekStartsOn: 1 });
      const sunday = endOfWeek(monday, { weekStartsOn: 1 });
      const weekNum = getISOWeek(monday);
      const selectedDayName = format(parsed, 'EEEE', { locale: tr });
      const selectedDayFormatted = format(parsed, 'd MMMM yyyy', { locale: tr });
      const mondayFormatted = format(monday, 'd MMMM', { locale: tr });
      const sundayFormatted = format(sunday, 'd MMMM yyyy', { locale: tr });

      return {
        mondayKey: format(monday, 'yyyy-MM-dd'),
        sundayKey: format(sunday, 'yyyy-MM-dd'),
        selectedDayFormatted,
        selectedDayName,
        weekNum,
        weekLabel: `${mondayFormatted} - ${sundayFormatted} (${weekNum}. Hafta)`
      };
    } catch (e) {
      return {
        mondayKey: customStartDate,
        sundayKey: customStartDate,
        selectedDayFormatted: customStartDate,
        selectedDayName: '',
        weekNum: 1,
        weekLabel: customStartDate
      };
    }
  }, [customStartDate]);

  // Seçili haftanın 7 gününün ayrıntılı dökümü (Görsel hafta şeridi için)
  const customWeekDays = useMemo(() => {
    try {
      const parsed = parseISO(customStartDate);
      const monday = startOfWeek(parsed, { weekStartsOn: 1 });
      const sunday = endOfWeek(monday, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: monday, end: sunday });
      return days.map(d => ({
        dateKey: format(d, 'yyyy-MM-dd'),
        dayNameShort: format(d, 'EEE', { locale: tr }),
        dayNameFull: format(d, 'EEEE', { locale: tr }),
        dayNumber: format(d, 'd'),
        monthName: format(d, 'MMMM', { locale: tr }),
        formatted: format(d, 'd MMMM yyyy', { locale: tr })
      }));
    } catch (e) {
      return [];
    }
  }, [customStartDate]);

  // Hafta değiştirme yardımcıları
  const handlePrevWeek = (e) => {
    e?.stopPropagation();
    try {
      const parsed = parseISO(customStartDate);
      const prevWeek = subWeeks(parsed, 1);
      setCustomStartDate(format(prevWeek, 'yyyy-MM-dd'));
    } catch (err) {}
  };

  const handleNextWeek = (e) => {
    e?.stopPropagation();
    try {
      const parsed = parseISO(customStartDate);
      const nextWeek = addWeeks(parsed, 1);
      setCustomStartDate(format(nextWeek, 'yyyy-MM-dd'));
    } catch (err) {}
  };

  // Tek Gün Detayları
  const singleDayDetails = useMemo(() => {
    try {
      const parsed = parseISO(singleDayDate);
      const targetDayName = format(parsed, 'EEEE', { locale: tr });
      const targetDateFormatted = format(parsed, 'd MMMM yyyy', { locale: tr });
      const sourceDayName = DAY_OPTIONS[singleDaySourceIndex]?.name || 'Pazartesi';
      const isDayMatched = (getDay(parsed) + 6) % 7 === singleDaySourceIndex;

      return {
        targetDateFormatted,
        targetDayName,
        sourceDayName,
        isDayMatched
      };
    } catch (e) {
      return {
        targetDateFormatted: singleDayDate,
        targetDayName: '',
        sourceDayName: 'Pazartesi',
        isDayMatched: true
      };
    }
  }, [singleDayDate, singleDaySourceIndex]);

  // İçe Aktarma İşlemini Başlat
  const handleSubmit = () => {
    if (!selectedFile || selectedChannelIds.length === 0 || isImporting) return;

    onExecuteImport({
      file: selectedFile,
      channelIds: selectedChannelIds,
      dateMode,
      targetStartDate: dateMode === 'week' ? customWeekDetails.mondayKey : null,
      singleDayConfig: dateMode === 'single_day' ? {
        targetDate: singleDayDate,
        sourceDayIndex: singleDaySourceIndex,
        sourceDayName: DAY_OPTIONS[singleDaySourceIndex]?.name || 'Pazartesi'
      } : null
    });
  };

  if (!isOpen) return null;

  const isAllChannelsSelected = selectedChannelIds.length === channels.length;

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
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInModal 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Başlığı */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Excel Yayın Akışı İçe Aktarma
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Haftalık akış Excel dosyasını seçin, hedef kanalları ve yayın haftasını veya gününü belirleyin.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isImporting}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              borderRadius: '8px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Gövdesi */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* 1. ADIM: Dosya Seçimi */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'block', marginBottom: '8px' }}>
              1. Excel Dosyası (.xlsx, .xls)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  background: 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'var(--bg-primary)';
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Excel dosyasını buraya sürükleyin veya dosya seçmek için tıklayın
                  </span>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Desteklenen formatlar: .xlsx, .xls (7 Günlük Matris veya Kuşak Akışı)
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '10px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                background: 'rgba(16, 185, 129, 0.06)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ color: '#10b981' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB • Hazır
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedFile(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                  title="Farklı dosya seç"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {/* 2. ADIM: Hedef Kanal(lar) Seçimi */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                2. Hedef Kanal(lar)
              </label>

              <button
                type="button"
                onClick={handleSelectAllChannels}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 6px'
                }}
              >
                {isAllChannelsSelected ? 'Tek Kanal Seç' : 'Tüm Kanalları Seç'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {channels.map(ch => {
                const isSelected = selectedChannelIds.includes(ch.id);
                return (
                  <div
                    key={ch.id}
                    onClick={() => handleToggleChannel(ch.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-color)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                      {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {ch.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {ch.id === 'ch_hd' ? 'Ana HD Yayın Kanalı' : 'Tematik Yayın Kanalı'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              * İki kanalı da seçerseniz akış her iki kanala da aktarılır. Sadece birini seçerseniz diğeri kesinlikle değişmez.
            </div>
          </div>

          {/* 3. ADIM: Hedef Yayın Haftası / Gün Seçimi */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                3. Hedef Yayın Kapsamı (Hafta veya Gün)
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* MOD 1: TÜM HAFTA (7 GÜNLÜK AKIŞ) */}
              <div
                onClick={() => setDateMode('week')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: dateMode === 'week' ? 'var(--accent-primary)' : 'var(--border-color)',
                  background: dateMode === 'week' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="radio"
                    name="importDateMode"
                    checked={dateMode === 'week'}
                    onChange={() => setDateMode('week')}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarDays size={16} style={{ color: dateMode === 'week' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Tüm Haftaya Uygula (7 Günlük Tam Akış)
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Takvimden seçeceğiniz herhangi bir tarihin ait olduğu tüm haftayı (Pazartesi - Pazar) Excel'den oluşturur.
                    </div>

                    {dateMode === 'week' && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          marginTop: '12px',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          background: 'var(--bg-secondary)',
                          border: '1.5px solid rgba(59, 130, 246, 0.35)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)'
                        }}
                      >
                        {/* 1. Hafta Gezgin Çubuğu (Önceki Hafta, Başlık, Sonraki Hafta) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(59, 130, 246, 0.08)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          borderRadius: '10px',
                          padding: '8px 12px'
                        }}>
                          <button
                            type="button"
                            onClick={handlePrevWeek}
                            title="Önceki Haftaya Git"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              background: 'var(--bg-primary)',
                              color: 'var(--accent-primary)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <ChevronLeft size={14} />
                            <span>Önceki Hafta</span>
                          </button>

                          <div style={{ textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              fontWeight: 800,
                              color: 'var(--text-primary)'
                            }}>
                              <span style={{
                                background: 'var(--accent-primary)',
                                color: '#ffffff',
                                padding: '2px 7px',
                                borderRadius: '5px',
                                fontSize: '11px',
                                fontWeight: 800
                              }}>
                                {customWeekDetails.weekNum}. HAFTA
                              </span>
                              <span>{customWeekDetails.weekLabel}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 700, marginTop: '2px' }}>
                              ✓ 7 GÜNLÜK TAM YAYIN AKIŞI SEÇİLİ
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleNextWeek}
                            title="Sonraki Haftaya Git"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              background: 'var(--bg-primary)',
                              color: 'var(--accent-primary)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>Sonraki Hafta</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>

                        {/* 2. 7 Günlük Görsel Hafta Şeridi (Tüm günlerin seçildiğini açıkça kanıtlayan şerit) */}
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>SEÇİLEN HAFTANIN 7 GÜNÜ (PAZARTESİ - PAZAR TAM BLOK):</span>
                            <span style={{ color: '#10b981', fontWeight: 700, textTransform: 'none' }}>
                              ✓ 7 Günün Tamamı Excel ile Doldurulacak
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                            {customWeekDays.map(day => (
                              <div
                                key={day.dateKey}
                                style={{
                                  background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0.04) 100%)',
                                  border: '1px solid rgba(59, 130, 246, 0.35)',
                                  borderRadius: '8px',
                                  padding: '8px 4px',
                                  textAlign: 'center',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '2px',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                }}
                              >
                                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                                  {day.dayNameShort}
                                </span>
                                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {day.dayNumber}
                                </span>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                                  {day.monthName}
                                </span>
                                <div style={{
                                  marginTop: '3px',
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: '#059669',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  padding: '1px 4px',
                                  borderRadius: '4px'
                                }}>
                                  ✓ Dahil
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. Başka Bir Haftaya Atla (Tarih Seçici & Hızlı Kısayollar) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '10px',
                          paddingTop: '6px',
                          borderTop: '1px dashed var(--border-color)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                              Başka Bir Haftaya Git (Tarih Seçin):
                            </span>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={e => setCustomStartDate(e.target.value)}
                              style={{
                                padding: '5px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontWeight: 700,
                                outline: 'none'
                              }}
                            />
                          </div>

                          {/* Hızlı Hafta Kısayolları */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Hızlı Seç:</span>
                            <button
                              type="button"
                              onClick={() => setCustomStartDate('2025-10-27')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-secondary)',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              27 Eki 2025
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomStartDate('2026-10-12')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-secondary)',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              12 Eki 2026
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomStartDate(format(new Date(), 'yyyy-MM-dd'))}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--accent-primary)',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Bu Hafta
                            </button>
                          </div>
                        </div>

                        {/* Bilgi Güvencesi */}
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          background: 'rgba(59, 130, 246, 0.05)',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                          <span>
                            <strong>Tam Hafta Kapsamı:</strong> Excel'deki Pazartesi, Salı, Çarşamba, Perşembe, Cuma, Cumartesi ve Pazar kuşaklarının tümü (7 × 1440 dk) yukarıda seçili olan haftaya aktarılacaktır.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MOD 2: TEK BİR GÜNE YÜKLE (GÜN BAZLI AKIŞ) */}
              <div
                onClick={() => setDateMode('single_day')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: dateMode === 'single_day' ? '#10b981' : 'var(--border-color)',
                  background: dateMode === 'single_day' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="radio"
                    name="importDateMode"
                    checked={dateMode === 'single_day'}
                    onChange={() => setDateMode('single_day')}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={16} style={{ color: dateMode === 'single_day' ? '#10b981' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Sadece Tek Bir Güne Yükle (Gün Bazlı Akış)
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981'
                      }}>
                        Diğer Günler Korunur
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Excel'deki belirli bir günün akışını hedeflediğiniz tek bir güne yükler. Haftanın diğer günleri KESİNLİKLE BOZULMAZ.
                    </div>

                    {dateMode === 'single_day' && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          marginTop: '12px',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Hedef Tarih Seçimi */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Hedef Gün / Tarih:
                            </span>
                            <input
                              type="date"
                              value={singleDayDate}
                              onChange={e => handleSingleDayDateChange(e.target.value)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                fontWeight: 700,
                                outline: 'none'
                              }}
                            />
                          </div>

                          <div style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#059669',
                            fontSize: '11px',
                            fontWeight: 700
                          }}>
                            {singleDayDetails.targetDateFormatted} ({singleDayDetails.targetDayName})
                          </div>
                        </div>

                        {/* Excel'deki Kaynak Gün Seçimi */}
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>Excel'den Hangi Günün Akışı Alınsın?</span>
                            <span style={{ fontSize: '10px', color: singleDayDetails.isDayMatched ? '#059669' : 'var(--text-muted)' }}>
                              {singleDayDetails.isDayMatched ? '✓ Hedef günle otomatik eşleşti' : 'Özel kaynak gün seçildi'}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                            {DAY_OPTIONS.map(opt => {
                              const isSelected = singleDaySourceIndex === opt.index;
                              return (
                                <button
                                  key={opt.index}
                                  type="button"
                                  onClick={() => {
                                    setSingleDaySourceIndex(opt.index);
                                    setIsSourceDayManual(true);
                                  }}
                                  style={{
                                    padding: '6px 4px',
                                    borderRadius: '6px',
                                    border: '1px solid',
                                    borderColor: isSelected ? '#10b981' : 'var(--border-color)',
                                    background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
                                    color: isSelected ? '#059669' : 'var(--text-secondary)',
                                    fontSize: '11px',
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    textAlign: 'center'
                                  }}
                                >
                                  <div>{opt.short}</div>
                                  <div style={{ fontSize: '9px', opacity: 0.8 }}>{opt.name.substring(0, 3)}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Güvenli Koruma Bilgisi */}
                        <div style={{
                          fontSize: '11px',
                          color: '#059669',
                          background: 'rgba(16, 185, 129, 0.08)',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Check size={14} style={{ flexShrink: 0 }} />
                          <span>
                            Sadece <strong>{singleDayDetails.targetDateFormatted} ({singleDayDetails.targetDayName})</strong> gününe Excel'deki <strong>{singleDayDetails.sourceDayName}</strong> kuşağı yüklenecektir. Kanalın diğer 6 günündeki mevcut akışları korunacaktır.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* MOD 3: EXCEL ORİJİNAL TARİHLERİ */}
              <div
                onClick={() => setDateMode('original')}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: dateMode === 'original' ? 'var(--accent-primary)' : 'var(--border-color)',
                  background: dateMode === 'original' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="radio"
                    name="importDateMode"
                    checked={dateMode === 'original'}
                    onChange={() => setDateMode('original')}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} style={{ color: dateMode === 'original' ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Excel Dosyası İçindeki Orijinal Tarihleri Kullan
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Excel dosyasının 2. satırında tanımlı olan 7 günün tarihleri (örn: 27 Ekim - 2 Kasım 2025) doğrudan kullanılır.
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Modal Alt Çubuk: Özet ve İşlem Butonları */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary)'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Hedef: <strong style={{ color: 'var(--text-primary)' }}>{selectedChannelIds.length} Kanal</strong> ({channels.filter(c => selectedChannelIds.includes(c.id)).map(c => c.name).join(', ')})
            {dateMode === 'week' && (
              <span> • Hafta: <strong style={{ color: 'var(--accent-primary)' }}>{customWeekDetails.weekLabel}</strong></span>
            )}
            {dateMode === 'single_day' && (
              <span> • Tek Gün: <strong style={{ color: '#10b981' }}>{singleDayDetails.targetDateFormatted} ({singleDayDetails.sourceDayName})</strong></span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onClose}
              disabled={isImporting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isImporting ? 'not-allowed' : 'pointer'
              }}
            >
              İptal
            </button>

            <button
              onClick={handleSubmit}
              disabled={!selectedFile || selectedChannelIds.length === 0 || isImporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '8px',
                background: (!selectedFile || selectedChannelIds.length === 0 || isImporting)
                  ? 'var(--bg-tertiary)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontSize: '12px',
                fontWeight: 700,
                cursor: (!selectedFile || selectedChannelIds.length === 0 || isImporting) ? 'not-allowed' : 'pointer',
                opacity: (!selectedFile || selectedChannelIds.length === 0) ? 0.6 : 1,
                boxShadow: (!selectedFile || selectedChannelIds.length === 0) ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Upload size={14} />
              <span>
                {isImporting
                  ? 'Ayrıştırılıyor ve Yerleştiriliyor...'
                  : dateMode === 'single_day'
                  ? 'Seçili Günü İçe Aktar ve Yerleştir'
                  : 'Tüm Haftayı İçe Aktar ve Yerleştir'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DraftExcelImportModal);
