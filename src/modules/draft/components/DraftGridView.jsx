/**
 * @file DraftGridView.jsx
 * @description Taslak Planlama haftalık akış ızgarası (Grid View).
 * 
 * Görünüm Modları:
 * 1. Düzenli Saat Satırları Matrisi (Matrix View - Varsayılan):
 *    - Satır ve sütunlarda belirgin saat belirteçleri
 *    - Tüm günlerin aynı saatteki programlarını aynı yatay hizada gösterir
 *    - Gece, Sabah, Öğle, Akşam & Prime Time kuşak ayrımları
 * 2. Kompakt Kart Sütunları (Compact View):
 *    - Gün bazlı bağımsız kart sütunları
 * 
 * Etkileşimler:
 * - Sağa-sola akıcı kaydırma (Grab & Pan Drag-to-Scroll) ve ok butonları
 * - Hızlı saat dilimi filtreleri (Tümü, Gece, Sabah, Öğle, Akşam)
 * - Programları sürükle-bırak (Drag & Drop) ile yeniden sıralama
 */
import React, { useRef, useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  MoveHorizontal, 
  LayoutGrid, 
  Columns,
  Clock,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  ZoomIn,
  ZoomOut,
  Type,
  Info
} from 'lucide-react';
import DraftDayColumn from './DraftDayColumn';
import DraftMatrixView from './DraftMatrixView';
import { filterAndSortBySearchPriority } from '../../../utils/searchRanker';

const TEXT_SCALE_PRESETS = [
  { value: 1, label: '%100', title: 'Standart Boyut (%100)' },
  { value: 1.15, label: '%115', title: 'Büyük Yazı (%115 - Önerilen)' },
  { value: 1.3, label: '%130', title: 'Çok Büyük Yazı (%130)' },
  { value: 1.45, label: '%145', title: 'Maksimum Okunabilirlik (%145)' }
];

const DraftGridView = ({
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
  isLibraryOpen = true,
  onSendDayToBroadcast
}) => {
  const containerRef = useRef(null);
  const [gridMode, setGridMode] = useState('matrix'); // 'matrix' (Düzenli Saat Satırları) | 'compact' (Kompakt Sütunlar)
  const [timePeriodFilter, setTimePeriodFilter] = useState('all'); // 'all', 'night', 'morning', 'afternoon', 'evening'
  const [textScale, setTextScale] = useState(() => {
    try {
      const saved = parseFloat(localStorage.getItem('draft_grid_text_scale'));
      if (!isNaN(saved) && saved >= 0.9 && saved <= 1.6) return saved;
    } catch (e) {}
    return 1.15; // Varsayılan olarak daha okunaklı %115 büyütülmüş görünüm
  });
  const [isPanning, setIsPanning] = useState(false);
  const [isInfoHovered, setIsInfoHovered] = useState(false);

  const handleChangeTextScale = (nextVal) => {
    const clamped = Math.round(Math.max(1, Math.min(1.45, nextVal)) * 100) / 100;
    setTextScale(clamped);
    try {
      localStorage.setItem('draft_grid_text_scale', String(clamped));
    } catch (e) {}
  };
  const panState = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false
  });

  // Sağa - Sola Basılı Tutup Kaydırma (Mouse Drag-to-Scroll / Pan)
  const handleMouseDown = (e) => {
    // Sadece sol tıklamada ve buton/input/kart üzeri hariç
    if (e.button !== 0) return;
    if (e.target.closest('button, input, select, textarea, [draggable="true"]')) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    panState.current.isDown = true;
    panState.current.startX = e.pageX - container.offsetLeft;
    panState.current.scrollLeft = container.scrollLeft;
    panState.current.hasMoved = false;
  };

  const handleMouseMove = (e) => {
    if (!panState.current.isDown) return;
    const container = containerRef.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - panState.current.startX) * 1.6; // Akıcı kaydırma katsayısı

    if (Math.abs(walk) > 4) {
      if (!isPanning) setIsPanning(true);
      panState.current.hasMoved = true;
    }

    container.scrollLeft = panState.current.scrollLeft - walk;
  };

  const handleMouseUpOrLeave = () => {
    panState.current.isDown = false;
    setTimeout(() => setIsPanning(false), 50);
  };

  // Butonla Hızlı Sağa / Sola Kaydırma
  const handleScrollByButton = (direction) => {
    if (!containerRef.current) return;
    const amount = direction === 'left' ? -420 : 420;
    containerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const canScrollHorizontal = activeDaysKeys.length > 1 && (isLibraryOpen || textScale > 1);
  const compactColMinWidth = Math.round(235 * textScale);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      
      {/* ÜST ARAÇ ÇUBUĞU: En Solda Yazı Boyutu | Ortada Sola-Sağa + İpucu (i) | En Sağda Görünüm Seçici */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
      }}>
        {/* EN SOL: YAZI VE KART BOYUTU BÜYÜTME SEÇENEĞİ */}
        <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'start', flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: 'var(--bg-primary)',
            padding: '4px 6px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              padding: '0 4px',
              whiteSpace: 'nowrap'
            }}>
              <Type size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>Yazı Boyutu:</span>
            </span>

            <button
              type="button"
              onClick={() => handleChangeTextScale(textScale - 0.15)}
              disabled={textScale <= 1}
              title="Yazıları Küçült"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: textScale <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                opacity: textScale <= 1 ? 0.45 : 1,
                cursor: textScale <= 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ZoomOut size={13} />
            </button>

            {TEXT_SCALE_PRESETS.map(preset => {
              const isSelectedScale = Math.abs(textScale - preset.value) < 0.05;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handleChangeTextScale(preset.value)}
                  title={preset.title}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '11.5px',
                    fontWeight: isSelectedScale ? 800 : 600,
                    background: isSelectedScale ? 'var(--accent-primary)' : 'transparent',
                    color: isSelectedScale ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleChangeTextScale(textScale + 0.15)}
              disabled={textScale >= 1.45}
              title="Yazıları Büyüt"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: textScale >= 1.45 ? 'var(--text-muted)' : 'var(--text-primary)',
                opacity: textScale >= 1.45 ? 0.45 : 1,
                cursor: textScale >= 1.45 ? 'not-allowed' : 'pointer'
              }}
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>

        {/* ORTA: BÜYÜTÜLMÜŞ SOLA - SAĞA BUTONLARI + YANINDA HOVER İPUCU (i) İKONU */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          justifySelf: 'center',
          gap: '6px',
          flexShrink: 0
        }}>
          {activeDaysKeys.length > 1 && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--bg-primary)',
                padding: '4px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)'
              }}>
                <button
                  type="button"
                  onClick={() => handleScrollByButton('left')}
                  title="Günleri Sola Kaydır"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Sola</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScrollByButton('right')}
                  title="Günleri Sağa Kaydır"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>Sağa</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* İpucu (i) İkonu — Üstüne Gelince Açılır */}
              <div
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                onMouseEnter={() => setIsInfoHovered(true)}
                onMouseLeave={() => setIsInfoHovered(false)}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isInfoHovered ? 'var(--accent-primary)' : 'rgba(37, 99, 235, 0.1)',
                    color: isInfoHovered ? '#ffffff' : 'var(--accent-primary)',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'help',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Info size={15} />
                </div>

                {isInfoHovered && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.22)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    pointerEvents: 'none'
                  }}>
                    <MoveHorizontal size={14} color="#38bdf8" />
                    <span><strong>İpucu:</strong> Boş alana basılı tutarak günleri sağa-sola kaydırabilirsiniz.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* EN SAĞ: GÖRÜNÜM TARZI SEÇİCİ (Matris vs Kompakt - Yeri Sabit) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifySelf: 'end',
          background: 'var(--bg-primary)',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          gap: '3px',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => setGridMode('matrix')}
            title="Saat belirteçleri satır ve sütunlarda düzenli akış"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: gridMode === 'matrix' ? 700 : 500,
              background: gridMode === 'matrix' ? 'var(--accent-primary)' : 'transparent',
              color: gridMode === 'matrix' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: gridMode === 'matrix' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={13} />
            <span>Düzenli Matris (Saat Satırları)</span>
          </button>

          <button
            type="button"
            onClick={() => setGridMode('compact')}
            title="Serbest sütun akışı"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: gridMode === 'compact' ? 700 : 500,
              background: gridMode === 'compact' ? 'var(--accent-primary)' : 'transparent',
              color: gridMode === 'compact' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: gridMode === 'compact' ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Columns size={13} />
            <span>Kompakt Kartlar</span>
          </button>
        </div>
      </div>

      {/* Kaydırılabilir Günler Alanı */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        style={{
          overflowX: canScrollHorizontal ? 'auto' : 'hidden',
          overflowY: 'visible',
          cursor: isPanning ? 'grabbing' : canScrollHorizontal ? 'grab' : 'default',
          userSelect: isPanning ? 'none' : 'auto',
          paddingBottom: '24px'
        }}
      >
        {gridMode === 'matrix' ? (
          /* 1. DÜZENLİ MATRİS GÖRÜNÜMÜ (Satır ve Sütunlarda Saat Belirteçleri) */
          <DraftMatrixView
            activeDaysKeys={activeDaysKeys}
            scheduleData={scheduleData}
            filterProgram={filterProgram}
            selectedProgramIds={selectedProgramIds}
            onSelectProgram={onSelectProgram}
            onToggleOption={onToggleOption}
            onToggleSelect={onToggleSelect}
            onSelectAllDay={onSelectAllDay}
            onReorderPrograms={onReorderPrograms}
            onMoveProgramOrder={onMoveProgramOrder}
            onDuplicateProgram={onDuplicateProgram}
            onDeleteProgram={onDeleteProgram}
            onAddLibraryProgram={onAddLibraryProgram}
            isLibraryOpen={isLibraryOpen}
            timePeriodFilter={timePeriodFilter}
            onSendDayToBroadcast={onSendDayToBroadcast}
            textScale={textScale}
          />
        ) : (
          /* 2. KLASİK KOMPAKT SÜTUNLAR GÖRÜNÜMÜ */
          <div style={{
            display: 'grid',
            gridTemplateColumns: activeDaysKeys.length === 1
              ? '1fr'
              : (isLibraryOpen || textScale > 1)
              ? `repeat(${activeDaysKeys.length}, minmax(${compactColMinWidth}px, 1fr))`
              : `repeat(${activeDaysKeys.length}, minmax(0, 1fr))`,
            gap: isLibraryOpen ? '12px' : '8px',
            alignItems: 'start',
            boxSizing: 'border-box',
            minWidth: activeDaysKeys.length === 1
              ? '100%'
              : (isLibraryOpen || textScale > 1)
              ? `${activeDaysKeys.length * compactColMinWidth + Math.max(0, activeDaysKeys.length - 1) * (isLibraryOpen ? 12 : 8) + 4}px`
              : '100%'
          }}>
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

              return (
                <DraftDayColumn
                  key={dateKey}
                  dateKey={dateKey}
                  day={day}
                  filteredProgs={filteredProgs}
                  selectedProgramIds={selectedProgramIds}
                  onSelectProgram={onSelectProgram}
                  onToggleOption={onToggleOption}
                  onToggleSelect={onToggleSelect}
                  onSelectAllDay={onSelectAllDay}
                  onReorderPrograms={onReorderPrograms}
                  onMoveProgramOrder={onMoveProgramOrder}
                  onDuplicateProgram={onDuplicateProgram}
                  onDeleteProgram={onDeleteProgram}
                  onAddLibraryProgram={onAddLibraryProgram}
                  onSendDayToBroadcast={onSendDayToBroadcast}
                  textScale={textScale}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(DraftGridView);
