/**
 * @file ProgramLibrary.jsx
 * @description Medya ve Program Kütüphanesi Kenar Çubuğu (Sidebar).
 * 
 * Temel Sorumluluklar:
 * 1. MSSQL MAM veritabanından kategorilere göre program ve klipleri listeleme
 * 2. Türkçe karakter toleranslı gerçek zamanlı metin araması (server-side & client-side)
 * 3. @dnd-kit useDraggable ile akış çizelgesine doğrudan sürükle-bırak (Drag & Drop) desteği
 * 4. Çift monitör kütüphane penceresi desteği (isPopout & BroadcastChannel ile ana akışa ekleme)
 * 5. Program Eşleştirme Modalı (ProgramMappingModal) tetikleyicisi
 */
import React, { useState, useEffect, useMemo } from 'react';
import usePlanningStore from '../../store/planningStore';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { 
  Folder, 
  Search,
  Hash,
  Clock,
  X,
  ExternalLink,
  Plus,
  Settings,
  ChevronDown
} from 'lucide-react';
import { getCategoryDetails } from '../../utils/categoryColors';
import ProgramMappingModal from '../Mapping/ProgramMappingModal';

import { formatExactTime } from '../../utils/timeFormat';

const LibraryItem = ({ program, isPopout, isSpecialTemplate, onAdd }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lib-${program.id}`,
    data: {
      type: 'library_item',
      program
    },
    disabled: isPopout
  });

  const cat = getCategoryDetails(program.categoryId, program.categoryName);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isPopout ? 'pointer' : 'grab',
    padding: isSpecialTemplate ? '12px 14px' : '10px 12px',
    background: isSpecialTemplate ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
    borderLeft: isSpecialTemplate ? `6px dashed ${cat.bg}` : `4px solid ${cat.bg}`,
    marginBottom: '8px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: isDragging ? '0 8px 16px rgba(0,0,0,0.5)' : (isSpecialTemplate ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'),
    position: 'relative',
    textTransform: isSpecialTemplate ? 'uppercase' : 'none',
    letterSpacing: isSpecialTemplate ? '0.5px' : 'normal'
  };

  const handlePopoutAdd = () => {
    const bc = new BroadcastChannel('yayin-otomasyon-channel');
    bc.postMessage({ type: 'ADD_PROGRAM_FROM_POPOUT', program });
    bc.close();
    
    // Görsel geribildirim için ufak bir bildirim gösterilebilir
    const el = document.getElementById(`add-feedback-${program.id}`);
    if (el) {
      el.style.opacity = 1;
      setTimeout(() => el.style.opacity = 0, 1000);
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...(!isPopout ? listeners : {})} 
      {...(!isPopout ? attributes : {})}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(program));
      }}
      onDoubleClick={isPopout ? handlePopoutAdd : () => onAdd && onAdd(program)}
      title={isPopout ? "Çift tıklayarak listeye ekleyebilirsiniz" : "Sürükleyebilir veya çift tıklayarak ekleyebilirsiniz"}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', lineHeight: '1.4', wordBreak: 'break-word', paddingRight: isPopout ? '24px' : '0' }}>
          {program.title}
        </div>
        {isPopout && (
          <button 
            onClick={(e) => { e.stopPropagation(); handlePopoutAdd(); }}
            style={{ position: 'absolute', right: '8px', top: '8px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Listeye Ekle"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Hash size={12}/> ID: {program.id}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12}/> {formatExactTime(program.duration)}
        </span>
        <span style={{ 
          fontSize: '10px', 
          padding: '2px 4px', 
          borderRadius: '4px', 
          background: cat.bg, 
          color: cat.color, 
          fontWeight: '600' 
        }}>
          {cat.name}
        </span>
      </div>
      <div id={`add-feedback-${program.id}`} style={{ position: 'absolute', inset: 0, background: 'rgba(34, 197, 94, 0.2)', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.3s', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', fontWeight: 'bold' }}>
        Eklendi!
      </div>
    </div>
  );
};

const SidebarSection = ({ title, children, onClose, onPopout }) => (
  <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', marginBottom: '8px' }}>
      <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', margin: 0, letterSpacing: '0.5px' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', gap: '8px' }}>
        {onPopout && <ExternalLink size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onPopout} />}
        {onClose && <X size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onClose} />}
      </div>
    </div>
    {children}
  </div>
);

const CategoryPill = ({ label, color, isActive, onClick }) => (
  <button 
    onClick={onClick}
    style={{
      background: isActive ? (color || 'var(--accent-primary)') : 'transparent',
      color: isActive ? '#fff' : 'var(--text-secondary)',
      border: `1px solid ${isActive ? (color || 'var(--accent-primary)') : 'var(--border-color)'}`,
      padding: '4px 10px',
      borderRadius: '16px',
      fontSize: '11px',
      fontWeight: '600',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.2s'
    }}
  >
    {label}
  </button>
);

const ALL_SPECIAL_TEMPLATES = [
  { id: 'tpl-1', title: 'Kısa Program Eklenecek', duration: 10, categoryName: 'Kısa Program' },
  { id: 'tpl-2', title: 'İLAHİ EKLENECEK', duration: 10, categoryName: 'Dini' },
  { id: 'tpl-3', title: 'REKLAM KUŞAĞI', duration: 10, categoryName: 'Reklam' },
  { id: 'tpl-4', title: 'BOŞ KUŞAK', duration: 10, categoryName: 'Jenerik' },
];

const ProgramLibrary = ({ isPopout = false }) => {
  const [categories, setCategories] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [specialTemplatesHeight, setSpecialTemplatesHeight] = useState(350);

  // Template Builder States
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappedPrograms, setMappedPrograms] = useState([]);
  const [selectedTemplateDbName, setSelectedTemplateDbName] = useState('');
  const [templateEpisode, setTemplateEpisode] = useState('');

  // Sadece Kullanılan (Aktif) Programlar Filtresi
  const [onlyUsedPrograms, setOnlyUsedPrograms] = useState(true);
  const [usedProgramKeywords, setUsedProgramKeywords] = useState([]);

  useEffect(() => {
    fetch('/api/archive/used-programs')
      .then(res => res.json())
      .then(data => {
        if (data.programs) {
          const kws = data.programs.map(p => {
            return (p.title || '').toLowerCase()
              .replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ş/g, 's')
              .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o')
              .replace(/\(.*?\)/g, '')
              .replace(/[-_]/g, ' ')
              .trim();
          }).filter(Boolean);
          setUsedProgramKeywords(kws);
        }
      })
      .catch(err => console.error('Kullanılan programlar alınamadı:', err));
  }, []);

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/programMappings');
      if (res.ok) {
        const data = await res.json();
        setMappedPrograms(data);
        if (data.length > 0 && !selectedTemplateDbName) {
          setSelectedTemplateDbName(data[0].dbName);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, [showMappingModal]); // Yeniden kapandığında güncellenmesi için

  const storeShowMediaLibrary = usePlanningStore(state => state.showMediaLibrary);
  const storeShowSpecialTemplates = usePlanningStore(state => state.showSpecialTemplates);
  
  const showMediaLibrary = isPopout ? true : storeShowMediaLibrary;
  let showSpecialTemplates = isPopout ? true : storeShowSpecialTemplates;
  
  const currentMode = usePlanningStore(state => state.currentMode);
  
  if (currentMode === 'list-control') {
    showSpecialTemplates = false;
  }
  
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds);
  
  const setPanelsVisibility = usePlanningStore(state => state.setPanelsVisibility);
  
  const addProgramToDay = usePlanningStore(state => state.addProgramToDay);
  const selectedChannel = usePlanningStore(state => state.selectedChannel);
  const selectedDate = usePlanningStore(state => state.selectedDate);
  const days = usePlanningStore(state => state.days);

  const SPECIAL_TEMPLATES = currentMode === 'ready' 
    ? ALL_SPECIAL_TEMPLATES.filter(t => t.id === 'tpl-3') // Sadece Reklam Kuşağı
    : ALL_SPECIAL_TEMPLATES;

  const handleLocalAdd = (program) => {
    const key = `${currentMode || 'draft'}-${selectedChannel}-${selectedDate}`;
    const targetDay = days[key];
    if (targetDay && !targetDay.isLockedForStage1) {
      addProgramToDay(selectedChannel, selectedDate, targetDay.activeVariant, program, -1);
      
      const el = document.getElementById(`add-feedback-${program.id}`);
      if (el) {
        el.style.opacity = 1;
        setTimeout(() => el.style.opacity = 0, 1000);
      }
    }
  };

  const handleAddTemplate = () => {
    if (!selectedTemplateDbName) return;
    const mapping = mappedPrograms.find(m => m.dbName === selectedTemplateDbName);
    if (!mapping) return;

    let title = mapping.displayName;
    if (templateEpisode) {
      title += ` - ${templateEpisode}. Bölüm`;
    }

    const templateProgram = {
      id: `TPL-DYN-${Date.now()}`,
      title: title,
      duration: 1800000, // Varsayılan 30 dk
      categoryId: 9, // Diğer
      categoryName: 'DİĞER',
      dbName: selectedTemplateDbName,
      episode: templateEpisode
    };

    handleLocalAdd(templateProgram);
    setTemplateEpisode('');
  };

  const sidebarWidth = usePlanningStore(state => state.sidebarWidth || 320);
  const setSidebarWidth = usePlanningStore(state => state.setSidebarWidth);

  const startHorizontalResizing = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (mouseMoveEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      setSidebarWidth(Math.max(250, Math.min(startWidth + deltaX, 800)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Resize handler
  const startResizing = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startY = mouseDownEvent.clientY;
    const startHeight = specialTemplatesHeight;

    const onMouseMove = (mouseMoveEvent) => {
      const deltaY = startY - mouseMoveEvent.clientY;
      setSpecialTemplatesHeight(Math.max(100, Math.min(startHeight + deltaY, window.innerHeight - 200)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  // Arama metni için gecikme (debounce)
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  // Kategorileri sadece ilk açılışta ve hiddenCategoryIds değiştiğinde getir ve filtrele
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        // Gizli kategorileri filtrele
        const filteredCategories = data.filter(cat => !hiddenCategoryIds.includes(cat.categoryId));
        setCategories(filteredCategories);
      })
      .catch(err => console.error("Kategoriler alınamadı", err));
  }, [hiddenCategoryIds]);

  // Kategori veya Arama değiştiğinde programları getir
  useEffect(() => {
    let url = '/api/programs?';
    
    if (selectedCategoryId) {
      url += `categoryId=${selectedCategoryId}&`;
    }
    if (debouncedSearchTerm) {
      url += `search=${encodeURIComponent(debouncedSearchTerm)}&`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        // Gizli kategorilere ait programları gizle
        let filteredData = data.filter(p => !hiddenCategoryIds.includes(p.categoryId));
        const sorted = filteredData.sort((a, b) => new Date(b.fileCreateTime) - new Date(a.fileCreateTime));
        setPrograms(sorted);
      })
      .catch(err => {
        console.error("Programlar alınamadı:", err);
      });
  }, [selectedCategoryId, debouncedSearchTerm, hiddenCategoryIds]);

  const filteredPrograms = useMemo(() => {
    if (!onlyUsedPrograms || usedProgramKeywords.length === 0) return programs;
    return programs.filter(p => {
      const pName = (p.name || p.title || '').toLowerCase()
        .replace(/ı/g, 'i').replace(/ç/g, 'c').replace(/ş/g, 's')
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o');
      return usedProgramKeywords.some(kw => kw && pName.includes(kw));
    });
  }, [programs, onlyUsedPrograms, usedProgramKeywords]);

  if (!showMediaLibrary && !showSpecialTemplates) {
    return (
      <div style={{ width: '40px', background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px' }}>
         <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '2px', whiteSpace: 'nowrap' }}>
           PANELLER KAPALI
         </div>
      </div>
    );
  }

  return (
    <div style={{ 
      width: isPopout ? '100%' : `${sidebarWidth}px`, 
      minWidth: isPopout ? 'none' : `${sidebarWidth}px`, 
      background: 'var(--bg-sidebar)', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      borderRight: '1px solid var(--border-color)',
      position: 'relative'
    }}>
      <div style={{ padding: '16px 0', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        
        {/* MEDYA ÜSTE GETİRİLDİ */}
        {showMediaLibrary && (
        <SidebarSection 
          title="MEDYA KÜTÜPHANESİ"
          onClose={() => setPanelsVisibility({ showMediaLibrary: false })}
          onPopout={() => {
            setPanelsVisibility({ showMediaLibrary: false });
            window.open('/library-popout', '_blank', 'width=400,height=800,menubar=no,toolbar=no,location=no,status=no');
          }}
        >
          
          {/* Search Box */}
          <div style={{ padding: '0 16px 12px 16px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'var(--bg-primary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '4px', 
              padding: '8px 12px', 
              gap: '8px' 
            }}>
              <Search size={14} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Program Ara..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-primary)', 
                  outline: 'none', 
                  width: '100%', 
                  fontSize: '13px' 
                }} 
              />
            </div>
          </div>

          {/* Categories as Dropdown */}
          <div style={{ padding: '0 16px 12px 16px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'var(--bg-primary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '4px', 
              padding: '6px 10px',
              position: 'relative'
            }}>
              <select
                value={selectedCategoryId || ''}
                onChange={(e) => setSelectedCategoryId(e.target.value ? parseInt(e.target.value) : null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  width: '100%',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none', // Ok simgesini gizleyip özel ok eklemek isterseniz
                }}
              >
                <option value="" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                  Tümü (Filtresiz)
                </option>
                {categories.map((c, i) => {
                  const id = c.categoryId || c.id;
                  const name = c.categoryName || c.name;
                  return (
                    <option key={id || i} value={id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      {name}
                    </option>
                  );
                })}
              </select>
              {/* Özel aşağı ok simgesi eklemek için (Lucide) */}
              <div style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Sadece Kullanılanlar (Aktif) Filtresi */}
          <div style={{ padding: '0 16px 10px 16px' }}>
            <button
              onClick={() => setOnlyUsedPrograms(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                background: onlyUsedPrograms ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-primary)',
                border: onlyUsedPrograms ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                color: onlyUsedPrograms ? '#10b981' : 'var(--text-secondary)',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                transition: 'all 0.15s'
              }}
              title={onlyUsedPrograms ? 'Tüm arşivi görmek için tıklayın' : 'Sadece kullanılan programları görmek için tıklayın'}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: onlyUsedPrograms ? '#10b981' : '#64748b'
              }} />
              <span>{onlyUsedPrograms ? 'Sadece Kullanılanlar (Aktif)' : 'Tüm Arşiv (Filtresiz)'}</span>
            </button>
          </div>


          {/* Program List */}
          <div style={{ padding: '0 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {filteredPrograms.length > 0 ? (
              filteredPrograms.map(p => (
                <LibraryItem key={p.id} program={p} isPopout={isPopout} onAdd={handleLocalAdd} />
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                Program bulunamadı.
              </div>
            )}
          </div>
        </SidebarSection>
        )}

        {/* RESIZER (AYIRICI ÇİZGİ) */}
        {showMediaLibrary && showSpecialTemplates && (
          <div 
            onMouseDown={startResizing}
            style={{
              height: '8px',
              background: 'var(--bg-tertiary)',
              cursor: 'row-resize',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              borderTop: '1px solid var(--border-color)',
              borderBottom: '1px solid var(--border-color)',
              flexShrink: 0
            }}
          >
            <div style={{ width: '30px', height: '2px', background: 'var(--text-muted)', borderRadius: '2px', opacity: 0.5 }}></div>
          </div>
        )}

        {/* ÖZEL ALANLAR ALTA ALINDI */}
        {showSpecialTemplates && (
        <div style={{ flexShrink: 0, paddingTop: '16px', height: showMediaLibrary ? `${specialTemplatesHeight}px` : '100%', display: 'flex', flexDirection: 'column' }}>
          <SidebarSection 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>ŞABLONLAR VE TASLAK OLUŞTURMA</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowMappingModal(true); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Program Eşleştirme Ayarları"
                >
                  <Settings size={14} />
                </button>
              </div>
            }
            onClose={() => setPanelsVisibility({ showSpecialTemplates: false })}
          >
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              
              {/* TASLAK ŞABLON OLUŞTURUCU */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Dinamik Taslak Ekle</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Program Seçin</label>
                  <select
                    value={selectedTemplateDbName}
                    onChange={(e) => setSelectedTemplateDbName(e.target.value)}
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                  >
                    {mappedPrograms.length === 0 && <option value="">Önce ayarlar'dan eşleştirme ekleyin</option>}
                    {mappedPrograms.map(m => (
                      <option key={m.dbName} value={m.dbName}>{m.displayName}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bölüm No (Opsiyonel)</label>
                    <input 
                      type="text" 
                      value={templateEpisode}
                      onChange={e => setTemplateEpisode(e.target.value)}
                      placeholder="Örn: 34" 
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px', borderRadius: '4px', fontSize: '12px', outline: 'none' }}
                    />
                  </div>
                  <button 
                    onClick={handleAddTemplate}
                    disabled={!selectedTemplateDbName}
                    style={{ alignSelf: 'flex-end', padding: '6px 12px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedTemplateDbName ? 'pointer' : 'default', opacity: selectedTemplateDbName ? 1 : 0.5, fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', height: '28px' }}
                  >
                    <Plus size={12} /> Ekle
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', margin: '4px 0' }}>SABİT ŞABLONLAR</div>

              {SPECIAL_TEMPLATES.map(p => (
                <LibraryItem key={p.id} program={p} isPopout={isPopout} isSpecialTemplate={true} onAdd={handleLocalAdd} />
              ))}
            </div>
          </SidebarSection>
        </div>
        )}

      </div>
      
      {!isPopout && (
        <div 
          onMouseDown={startHorizontalResizing}
          style={{
            position: 'absolute',
            top: 0,
            right: -3,
            width: '6px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 50,
            background: 'transparent'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-primary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        />
      )}

      {showMappingModal && <ProgramMappingModal onClose={() => setShowMappingModal(false)} />}
    </div>
  );
};

export default ProgramLibrary;
