/**
 * @file src/pages/admin/ThemesTab.jsx
 * @description Admin Paneli — Temalar, Kategori Renkleri, Kategoriye Göre İsim Yazı Rengi,
 * Kutu Yapısı, Kutu Boyutları, Gölgelendirmeler, Gün Renkleri, Kuşak Renkleri, Reklam Kuşağı Rengi,
 * Yazı Fontu ve Saat/Timecode Fontu Ekleme Merkezi.
 * Not: Ayrı "Genel" sekmesi kaldırılmış olup, tüm detaylı özelleştirmeler 4 ana modülün
 * (1. Taslak Planlama, 2. Yayına Hazır, 3. Reklam Rezervasyon, 4. Yayın Kontrol) kendi detay alanında düzenlenir.
 */
import React, { useState } from 'react';
import {
  Palette,
  Type,
  Calendar,
  Clock,
  Megaphone,
  Layers,
  RotateCcw,
  CheckCircle2,
  Sun,
  Moon,
  Sparkles,
  Film,
  CheckSquare,
  Plus,
  Trash2,
  Box,
  Copy,
  Save
} from 'lucide-react';
import useThemeStore, {
  getAllSansFonts,
  getAllMonoFonts,
  BOX_RADIUS_OPTIONS,
  BOX_SIZE_OPTIONS,
  BOX_SHADOW_OPTIONS,
  DAY_PALETTE_PRESETS,
  hexToRgba
} from '../../store/themeStore';
import usePlanningStore from '../../store/planningStore';
import useAdminLogStore from '../../store/adminLogStore';
import { dialog } from '../../store/dialogStore';

// "Genel" sekmesi kaldırıldı — tüm ayarlar 4 ana modül detaylarında yer alır
const MODULE_TABS = [
  {
    id: 'draft',
    label: '1. Taslak Planlama',
    desc: 'Haftalık matris kutu yapısı, kutu boyutu, gölgelendirme, kategori/isim renkleri, gün çizgileri, saat ve timecode fontu',
    icon: <Calendar size={16} />
  },
  {
    id: 'ready',
    label: '2. Yayına Hazır',
    desc: 'Kesin yayın akışı (Rundown) kutu yapısı, boyut, gölge, kategori/isim renkleri, kuşaklar, reklam kuşağı ve timecode fontu',
    icon: <Film size={16} />
  },
  {
    id: 'ads',
    label: '3. Reklam Rezervasyon',
    desc: 'Reklam planlama kutu yapısı, boyutlar, gölgelendirme, boş/dolu kuşak renkleri, spot rozetleri ve timecode fontu',
    icon: <Megaphone size={16} />
  },
  {
    id: 'list-control',
    label: '4. Yayın Kontrol',
    desc: 'Nihai yayın kontrol listesi kutu yapısı, boyutlar, gölge, reklam bloğu, kategori/isim renkleri ve saat/timecode fontu',
    icon: <CheckSquare size={16} />
  }
];

const QUICK_PASTEL_SWATCHES = [
  { label: 'Gökyüzü Mavisi', line: '#7dd3fc', timeBg: '#e0f2fe', headerBg: '#f0f9ff', textAccent: '#0284c7' },
  { label: 'Açık Lavanta', line: '#c4b5fd', timeBg: '#ede9fe', headerBg: '#f5f3ff', textAccent: '#7c3aed' },
  { label: 'Açık Turkuaz', line: '#67e8f9', timeBg: '#cffafe', headerBg: '#ecfeff', textAccent: '#0891b2' },
  { label: 'Nane Yeşili', line: '#86efac', timeBg: '#dcfce7', headerBg: '#f0fdf4', textAccent: '#16a34a' },
  { label: 'Şeftali / Kehribar', line: '#fcd34d', timeBg: '#fef3c7', headerBg: '#fffbeb', textAccent: '#d97706' },
  { label: 'Gül Kurusu', line: '#fda4af', timeBg: '#ffe4e6', headerBg: '#fff1f2', textAccent: '#e11d48' },
  { label: 'Açık İndigo', line: '#a5b4fc', timeBg: '#e0e7ff', headerBg: '#eef2ff', textAccent: '#4f46e5' },
  { label: 'Kurumsal Gri', line: '#cbd5e1', timeBg: '#f1f5f9', headerBg: '#f8fafc', textAccent: '#334155' }
];

const ThemesTab = () => {
  const [activeScope, setActiveScope] = useState('draft');
  const [savedNotice, setSavedNotice] = useState('');
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  // Özel Font & Saat/Timecode Fontu Ekleme Formu
  const [newFontType, setNewFontType] = useState('sans'); // 'sans' | 'mono'
  const [newFontName, setNewFontName] = useState('');
  const [newFontFamily, setNewFontFamily] = useState('');
  const [newFontUrl, setNewFontUrl] = useState('');

  const config = useThemeStore(state => state.config);
  const updateTypography = useThemeStore(state => state.updateTypography);
  const addCustomFont = useThemeStore(state => state.addCustomFont);
  const removeCustomFont = useThemeStore(state => state.removeCustomFont);
  const updateCategoryColor = useThemeStore(state => state.updateCategoryColor);
  const updateDayColor = useThemeStore(state => state.updateDayColor);
  const applyDayPalettePreset = useThemeStore(state => state.applyDayPalettePreset);
  const updatePeriodColor = useThemeStore(state => state.updatePeriodColor);
  const updateSpecialColors = useThemeStore(state => state.updateSpecialColors);
  const updateModuleTheme = useThemeStore(state => state.updateModuleTheme);
  const copyModuleBoxStyleToAll = useThemeStore(state => state.copyModuleBoxStyleToAll);
  const resetThemeToDefaults = useThemeStore(state => state.resetThemeToDefaults);
  const saveAndApplyThemeNow = useThemeStore(state => state.saveAndApplyThemeNow);

  const theme = usePlanningStore(state => state.theme);
  const setTheme = usePlanningStore(state => state.setTheme);
  const addLog = useAdminLogStore(state => state.addLog);

  const allSansFonts = getAllSansFonts(config);
  const allMonoFonts = getAllMonoFonts(config);
  const currentMod = config.modules?.[activeScope] || config.modules.draft;
  const activeTabMeta = MODULE_TABS.find(m => m.id === activeScope) || MODULE_TABS[0];

  const triggerSavedToast = (msg) => {
    setSavedNotice(msg || 'Değişiklikler anında kaydedildi ve ilgili modüle uygulandı.');
    setTimeout(() => {
      setSavedNotice('');
    }, 3200);
  };

  const handleSaveAndApplyAll = async () => {
    setIsSavingTheme(true);
    try {
      const ok = await saveAndApplyThemeNow();
      addLog({
        category: 'system',
        panel: 'system',
        module: 'Temalar & Renkler',
        action: 'Tema ve Renk Ayarları Kaydedildi & Uygulandı',
        details: `${activeTabMeta.label} ve tüm sistem tema/renk ayarları sunucu veritabanına kaydedildi ve aktif edildi.`,
        status: 'success'
      });
      triggerSavedToast(
        ok
          ? '✓ Tüm tema, renk, kutu ve font değişiklikleri sunucu veritabanına kaydedildi ve tüm modüllere uygulandı!'
          : '✓ Tüm tema ve renk değişiklikleri kaydedildi ve modüllere uygulandı!'
      );
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleAddCustomFont = (e) => {
    e.preventDefault();
    if (!newFontName.trim() || !newFontFamily.trim()) {
      dialog.alert('Eksik Bilgi', 'Lütfen eklenecek fontun görünen adını ve CSS Font Ailesi adını girin.');
      return;
    }
    const created = addCustomFont({
      type: newFontType,
      name: newFontName,
      fontFamily: newFontFamily,
      googleFontUrl: newFontUrl
    });
    if (created) {
      if (newFontType === 'mono') {
        updateModuleTheme(activeScope, { fontMonoId: created.id });
      } else {
        updateModuleTheme(activeScope, { fontSansId: created.id });
      }
      addLog({
        category: 'system',
        panel: 'system',
        module: 'Temalar & Fontlar',
        action: newFontType === 'mono' ? 'Yeni Saat & Timecode Fontu Eklendi' : 'Yeni Yazı Fontu Eklendi',
        details: `"${created.label}" (${activeTabMeta.label}) modülüne eklendi ve aktif edildi.`,
        status: 'success'
      });
      setNewFontName('');
      setNewFontFamily('');
      setNewFontUrl('');
      triggerSavedToast(`"${created.label}" başarıyla eklendi ve ${activeTabMeta.label} için seçildi.`);
    }
  };

  const handleResetAll = async () => {
    const ok = await dialog.confirm(
      'Varsayılan Temaya Sıfırla',
      'Tüm modüllerin kutu yapısı, boyutları, gölgelendirmeleri, kategori renkleri, isim yazı renkleri, gün renkleri, kuşak renkleri ve font ayarları varsayılan değerlerine döndürülsün mü?',
      { confirmText: 'Evet, Sıfırla', isDestructive: true }
    );
    if (ok) {
      resetThemeToDefaults();
      addLog({
        category: 'system',
        panel: 'system',
        module: 'Temalar & Renkler',
        action: 'Tema Ayarları Sıfırlandı',
        details: 'Tüm modül kutu yapıları, kategori, isim, gün ve kuşak renkleri varsayılan ayarlara döndürüldü.',
        status: 'warning'
      });
      triggerSavedToast('Tüm tema ve görünüm ayarları varsayılana sıfırlandı.');
    }
  };

  const cardStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '22px 24px',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  };

  const colorInputWrapStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px 4px 6px',
    borderRadius: '8px',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-primary)'
  };

  // Canlı Kutu Önizlemesi için aktif modülün stil hesaplaması
  const activeShadowObj = BOX_SHADOW_OPTIONS.find(s => s.id === currentMod.boxShadow) || BOX_SHADOW_OPTIONS[1];
  const activeSansObj = allSansFonts.find(f => f.id === (currentMod.fontSansId || config.typography.fontSansId)) || allSansFonts[0];
  const activeMonoObj = allMonoFonts.find(f => f.id === (currentMod.fontMonoId || config.typography.fontMonoId)) || allMonoFonts[0];
  const previewTint = Math.max(0.04, Math.min(0.30, (Number(currentMod.cardTintOpacity) || 11) / 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ÜST BAŞLIK & AÇIK/KOYU MOD & SIFIRLAMA */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}>
            <Palette size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Modül Bazlı Detaylı Tema, Kutu Yapısı, Renk &amp; Saat/Timecode Font Merkezi
            </h2>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Her modül için kutu yapısı, kutu boyutları, gölgelendirmeler, kategori rengi, kategoriye göre isim yazı rengi, yazı fontu ve saat/timecode fontunu detaylıca özelleştirin.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            background: 'var(--bg-tertiary)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              type="button"
              onClick={() => {
                setTheme('light');
                triggerSavedToast('Açık (Light) sistem teması aktif edildi.');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '12.5px',
                background: theme === 'light' ? 'var(--bg-secondary)' : 'transparent',
                color: theme === 'light' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <Sun size={15} /> Açık Tema
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme('dark');
                triggerSavedToast('Koyu (Dark) sistem teması aktif edildi.');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '12.5px',
                background: theme === 'dark' ? 'var(--bg-secondary)' : 'transparent',
                color: theme === 'dark' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <Moon size={15} /> Koyu Tema
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveAndApplyAll}
            disabled={isSavingTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: isSavingTheme ? 'wait' : 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Save size={16} />
            <span>{isSavingTheme ? 'Kaydediliyor...' : 'Kaydet ve Uygula'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              copyModuleBoxStyleToAll(activeScope);
              triggerSavedToast(`${activeTabMeta.label} kutu, boyut, gölge ve font ayarları 4 modülün tamamına kopyalandı.`);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              background: 'rgba(37, 99, 235, 0.08)',
              color: '#2563eb',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Copy size={14} /> Bu Kutu/Font Ayarını Tüm Modüllere Uygula
          </button>

          <button
            type="button"
            onClick={handleResetAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '9px 15px',
              borderRadius: '10px',
              border: '1px solid rgba(225, 29, 72, 0.3)',
              background: 'rgba(225, 29, 72, 0.08)',
              color: '#e11d48',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} /> Varsayılana Sıfırla
          </button>
        </div>
      </div>

      {/* CANLI KAYIT BİLDİRİMİ */}
      {savedNotice && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid rgba(16, 185, 129, 0.35)',
          color: '#047857',
          fontSize: '13px',
          fontWeight: 700
        }}>
          <CheckCircle2 size={18} />
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 4 MODÜL SEKMESİ (Genel kaldırıldı, 4 modül doğrudan seçilir) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '12px'
      }}>
        {MODULE_TABS.map(tab => {
          const isActive = activeScope === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveScope(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '6px',
                padding: '15px 18px',
                borderRadius: '14px',
                border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 6px 16px rgba(37, 99, 235, 0.14)' : 'var(--shadow-sm)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                fontWeight: 800,
                fontSize: '14px'
              }}>
                {tab.icon}
                <span>{tab.label}</span>
              </div>
              <span style={{
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
                lineHeight: 1.4
              }}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 1: KUTU YAPISI, KUTU BOYUTLARI, GÖLGELENDİRME & CANLI ÖNİZLEME */}
      {/* =================================================================== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Box size={20} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {activeTabMeta.label} — Kutu Yapısı, Kutu Boyutları ve Gölgelendirmeler
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Program ve kuşak kutularının köşe yuvarlaklığı, iç boşluk/boyut yapısı, çerçeve kalınlığı, sol kategori şeridi ve 3B gölge derinliği.
              </p>
            </div>
          </div>

          <div style={colorInputWrapStyle}>
            <input
              type="color"
              value={currentMod.accentColor || '#2563eb'}
              onChange={(e) => {
                updateModuleTheme(activeScope, { accentColor: e.target.value });
                triggerSavedToast(`${activeTabMeta.label} ana vurgu rengi güncellendi.`);
              }}
              style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Modül Ana Vurgu: {currentMod.accentColor}
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {/* 1. Kutu Köşe Yapısı (Border Radius) */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Kutu Köşe Yapısı (Yuvarlaklık)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {BOX_RADIUS_OPTIONS.map(opt => {
                const selected = (currentMod.boxRadius || '8px') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      updateModuleTheme(activeScope, { boxRadius: opt.id });
                      triggerSavedToast(`Kutu köşe yapısı "${opt.label}" olarak güncellendi.`);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: opt.value,
                      border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: selected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-secondary)',
                      color: selected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Kutu Boyutları (Kompakt / Standart / Ferah / Büyük) */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Kutu Boyutları &amp; İç Boşluk (Padding)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {BOX_SIZE_OPTIONS.map(opt => {
                const selected = (currentMod.boxSize || 'standard') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      updateModuleTheme(activeScope, { boxSize: opt.id });
                      triggerSavedToast(`Kutu boyutu "${opt.label}" olarak güncellendi.`);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: selected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-secondary)',
                      color: selected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {opt.label.split(' (')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Gölgelendirme Seçenekleri */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Kutu Gölgelendirme (Box Shadow)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {BOX_SHADOW_OPTIONS.map(opt => {
                const selected = (currentMod.boxShadow || 'subtle') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      updateModuleTheme(activeScope, { boxShadow: opt.id });
                      triggerSavedToast(`Gölgelendirme "${opt.label}" olarak güncellendi.`);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: selected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-secondary)',
                      color: selected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: opt.value
                    }}
                  >
                    {opt.label.split(' (')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Çerçeve Kalınlığı, Sol Kategori Şeridi ve Arka Plan Yoğunluğu */}
          <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Sol Kategori Şeridi: {currentMod.leftAccentWidth || 3.5}px
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                Renk Dolgusu: %{currentMod.cardTintOpacity || 11}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={7}
              step={0.5}
              value={currentMod.leftAccentWidth || 3.5}
              onChange={(e) => updateModuleTheme(activeScope, { leftAccentWidth: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <input
              type="range"
              min={4}
              max={28}
              step={1}
              value={currentMod.cardTintOpacity || 11}
              onChange={(e) => updateModuleTheme(activeScope, { cardTintOpacity: Number(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* CANLI KUTU YAPISI & SAAT/TIMECODE ÖNİZLEME ALANI */}
        <div style={{
          padding: '16px 20px',
          borderRadius: '14px',
          background: 'var(--bg-primary)',
          border: '1px dashed var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CANLI KUTU YAPISI, KATEGORİ İSİM YAZI RENGİ VE SAAT / TIMECODE ÖNİZLEMESİ ({activeTabMeta.label})
            </span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={currentMod.useCategoryTitleColor !== false}
                onChange={(e) => {
                  updateModuleTheme(activeScope, { useCategoryTitleColor: e.target.checked });
                  triggerSavedToast('Kategoriye göre isim yazı rengi tercihi güncellendi.');
                }}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              Kategoriye Göre Program İsim Yazı Rengini Kutu Başlığında Kullan
            </label>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '12px'
          }}>
            {[config.categoryColors[4], config.categoryColors[9], config.categoryColors[6]].map((cat, idx) => {
              if (!cat) return null;
              const sampleTimes = ['09:00:00:00', '14:30:00:00', '20:45:15:12'];
              const sampleTitles = ['İlim Dersleri - Tecvid (Bölüm 42)', 'Semerkand Sohbetleri (Yeni Bölüm)', 'Prime-Time Reklam Kuşağı (T1 - 6 Spot)'];
              return (
                <div
                  key={cat.id}
                  style={{
                    borderRadius: currentMod.boxRadius || '8px',
                    padding: currentMod.cardPadding || '8px 10px',
                    border: `${currentMod.borderWidth || 1}px solid ${hexToRgba(cat.color, 0.38)}`,
                    borderLeft: `${currentMod.leftAccentWidth || 3.5}px solid ${cat.color}`,
                    background: `linear-gradient(135deg, ${hexToRgba(cat.color, previewTint)} 0%, ${hexToRgba(cat.color, previewTint * 0.35)} 100%), var(--bg-secondary)`,
                    boxShadow: activeShadowObj.value,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{
                      fontFamily: activeMonoObj.value,
                      fontSize: `${Math.round(11.5 * ((config.typography.timecodeScale || 100) / 100))}px`,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '5px',
                      background: hexToRgba(cat.color, 0.16),
                      color: cat.badgeTextColor || cat.color
                    }}>
                      {sampleTimes[idx]}
                    </span>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      background: cat.color,
                      color: '#ffffff'
                    }}>
                      {cat.name}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: activeSansObj.value,
                    fontSize: `${Math.round(13.5 * ((config.typography.fontScale || 100) / 100))}px`,
                    fontWeight: 800,
                    color: currentMod.useCategoryTitleColor !== false ? (cat.titleTextColor || 'var(--text-primary)') : 'var(--text-primary)'
                  }}>
                    {sampleTitles[idx]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 2: YAZI FONTU & SAAT / TIMECODE FONTU SEÇİMİ + YENİ FONT EKLEME */}
      {/* =================================================================== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Type size={20} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Yazı Fontu ve Saat / Timecode Fontu Yönetimi (+ Yeni Font Ekleme)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Program isimleri için metin fontunu, yayın saatleri ve `00:00:00:00` timecode alanları için özel Saat &amp; Timecode fontunu seçin veya sisteme yeni font ekleyin.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px'
        }}>
          {/* Program & Arayüz Yazı Fontu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Program İsimleri &amp; Arayüz Yazı Fontu
            </label>
            <select
              value={currentMod.fontSansId || config.typography.fontSansId}
              onChange={(e) => {
                updateTypography({ fontSansId: e.target.value });
                updateModuleTheme(activeScope, { fontSansId: e.target.value });
                triggerSavedToast('Yazı fontu güncellendi.');
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {allSansFonts.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Saat ve Timecode Fontu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Saat &amp; Timecode Fontu (`00:00:00:00` / Süre / Bölüm)
            </label>
            <select
              value={currentMod.fontMonoId || config.typography.fontMonoId}
              onChange={(e) => {
                updateTypography({ fontMonoId: e.target.value });
                updateModuleTheme(activeScope, { fontMonoId: e.target.value });
                triggerSavedToast('Saat ve Timecode fontu güncellendi.');
              }}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              {allMonoFonts.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Yazı ve Saat/Timecode Boyut Ölçeği */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
              <span>Yazı Ölçeği: %{config.typography.fontScale || 100}</span>
              <span style={{ color: 'var(--accent-primary)' }}>Saat &amp; Timecode Ölçeği: %{config.typography.timecodeScale || 100}</span>
            </div>
            <input
              type="range"
              min={90}
              max={118}
              step={2}
              value={config.typography.fontScale || 100}
              onChange={(e) => updateTypography({ fontScale: Number(e.target.value) })}
              title="Genel Yazı Boyutu"
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <input
              type="range"
              min={90}
              max={124}
              step={2}
              value={config.typography.timecodeScale || 100}
              onChange={(e) => updateTypography({ timecodeScale: Number(e.target.value) })}
              title="Saat ve Timecode Boyutu"
              style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* YENİ FONT & SAAT/TIMECODE FONTU EKLEME FORMU */}
        <form
          onSubmit={handleAddCustomFont}
          style={{
            padding: '16px 18px',
            borderRadius: '12px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} style={{ color: 'var(--accent-primary)' }} />
              Sisteme Yeni Yazı Fontu veya Saat / Timecode Fontu Ekle
            </span>
            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Bilgisayarınızda yüklü bir font adını (Örn: ` Din Pro `, ` Share Tech Mono `, ` Orbitron `) veya Google Fonts bağlantısını ekleyebilirsiniz.
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '10px',
            alignItems: 'end'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Font Kullanım Türü
              </label>
              <select
                value={newFontType}
                onChange={(e) => setNewFontType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: 700
                }}
              >
                <option value="sans">Program &amp; Metin Yazı Fontu</option>
                <option value="mono">Saat &amp; Timecode Fontu (00:00:00)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Görünen Font Adı
              </label>
              <input
                type="text"
                placeholder="Örn: Share Tech Timecode"
                value={newFontName}
                onChange={(e) => setNewFontName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                CSS Font-Family Karşılığı
              </label>
              <input
                type="text"
                placeholder="Örn: Share Tech Mono"
                value={newFontFamily}
                onChange={(e) => setNewFontFamily(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Google Fonts URL (İsteğe Bağlı)
              </label>
              <input
                type="text"
                placeholder="https://fonts.googleapis.com/css2?family=..."
                value={newFontUrl}
                onChange={(e) => setNewFontUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Plus size={15} /> Fontu Ekle ve Uygula
            </button>
          </div>

          {/* Eklenen Özel Fontlar Listesi */}
          {((config.typography.customSansFonts?.length || 0) > 0 || (config.typography.customMonoFonts?.length || 0) > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '6px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Eklenen Özel Fontlar:</span>
              {[...(config.typography.customSansFonts || []), ...(config.typography.customMonoFonts || [])].map(cf => (
                <span
                  key={cf.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}
                >
                  {cf.label}
                  <button
                    type="button"
                    onClick={() => {
                      removeCustomFont(cf.id);
                      triggerSavedToast('Özel font kaldırıldı.');
                    }}
                    style={{ border: 'none', background: 'none', color: '#e11d48', cursor: 'pointer', padding: 0, display: 'flex' }}
                    title="Bu özel fontu sil"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 3: KATEGORİ RENGİ & KATEGORİYE GÖRE İSİM YAZI RENGİ (11 KATEGORİ) */}
      {/* =================================================================== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers size={20} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Kategori Rengi &amp; Kategoriye Göre Program İsim Yazı Rengi (11 Ana Kategori)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Her kategorinin kutu/şerit rengini (`Kategori Rengi`), kutu içindeki program başlığı yazı rengini (`İsim Yazı Rengi`) ve saat/etiket rengini ayrı ayrı belirleyin.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px'
        }}>
          {Object.values(config.categoryColors).map(cat => (
            <div
              key={cat.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '13px 15px',
                borderRadius: currentMod.boxRadius || '12px',
                background: `linear-gradient(135deg, ${hexToRgba(cat.color, 0.12)} 0%, ${hexToRgba(cat.color, 0.03)} 100%), var(--bg-primary)`,
                border: `1px solid ${hexToRgba(cat.color, 0.35)}`,
                borderLeft: `${currentMod.leftAccentWidth || 4}px solid ${cat.color}`,
                boxShadow: activeShadowObj.value
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{
                    fontSize: '13.5px',
                    fontWeight: 800,
                    color: cat.titleTextColor || 'var(--text-primary)',
                    fontFamily: activeSansObj.value
                  }}>
                    {cat.name} Programı Örneği
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontFamily: activeMonoObj.value,
                    color: cat.badgeTextColor || cat.color,
                    fontWeight: 700
                  }}>
                    Kat #{cat.id} • 12:30:00:00
                  </div>
                </div>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: cat.color,
                  color: '#ffffff'
                }}>
                  {cat.badge}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                {/* Kategori / Kutu Rengi */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="color"
                    value={cat.color}
                    onChange={(e) => {
                      updateCategoryColor(cat.id, { color: e.target.value });
                      triggerSavedToast(`"${cat.name}" kategori kutu rengi güncellendi.`);
                    }}
                    style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                  <span>Kutu: <b style={{ fontFamily: 'var(--font-mono)' }}>{cat.color}</b></span>
                </label>

                {/* Kategoriye Göre İsim Yazı Rengi */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="color"
                    value={cat.titleTextColor || '#1e293b'}
                    onChange={(e) => {
                      updateCategoryColor(cat.id, { titleTextColor: e.target.value, badgeTextColor: e.target.value });
                      triggerSavedToast(`"${cat.name}" isim yazı rengi güncellendi.`);
                    }}
                    style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer' }}
                  />
                  <span>İsim Yazı: <b style={{ fontFamily: 'var(--font-mono)' }}>{cat.titleTextColor || '#1e293b'}</b></span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 4: REKLAM KUŞAĞI, KUŞAKLAR (GECE/SABAH/GÜNDÜZ/AKŞAM) VE GÜNLER */}
      {/* =================================================================== */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Megaphone size={20} style={{ color: '#f59e0b' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {activeTabMeta.label} — Reklam Kuşağı, Dolgu, Canlı Yayın ve 4 Ana Zaman Kuşağı Renkleri
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              Akış içerisindeki reklam kuşakları, boş/dolu reklam blokları, dolgu kuşakları, canlı yayınlar ve Gece/Sabah/Gündüz/Akşam kuşak başlıkları.
            </p>
          </div>
        </div>

        {/* Reklam Kuşağı & Özel Satır Renkleri */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(235px, 1fr))',
          gap: '12px'
        }}>
          {[
            { key: 'adBreakColor', label: 'Reklam Kuşağı Ana Rengi', desc: 'Yayın akışı ve kontrol reklam satırı' },
            { key: 'adBreakEmptyColor', label: 'Boş Reklam Kuşağı (Spot Yok)', desc: 'Henüz spot atanmamış kuşak uyarısı' },
            { key: 'adBreakFilledColor', label: 'Dolu Reklam Kuşağı (Spotlu)', desc: 'Spot yerleştirilmiş onaylı kuşak' },
            { key: 'fillerSlotColor', label: 'Dolgu Kuşağı Rengi', desc: 'Kısa program / dolgu kuşağı rengi' },
            { key: 'liveColor', label: 'Canlı Yayın Vurgu Rengi', desc: 'CANLI rozeti ve canlı yayın satırı' },
            { key: 'introColor', label: 'İntro / Jenerik Rengi', desc: 'Program başı otomatik jenerik satırı' }
          ].map(item => {
            const val = config.specialColors?.[item.key] || '#f59e0b';
            return (
              <div
                key={item.key}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-primary)',
                  border: `1.5px solid ${hexToRgba(val, 0.35)}`,
                  borderLeft: `4px solid ${val}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.desc}</div>
                </div>
                <input
                  type="color"
                  value={val}
                  onChange={(e) => {
                    updateSpecialColors({ [item.key]: e.target.value });
                    triggerSavedToast(`${item.label} güncellendi.`);
                  }}
                  style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>
            );
          })}
        </div>

        {/* 4 Ana Yayın Kuşağı (Gece / Sabah / Gündüz / Akşam) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-color)'
        }}>
          {Object.values(config.periodColors).map(period => (
            <div
              key={period.id}
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: hexToRgba(period.color, 0.1),
                border: `1.5px solid ${hexToRgba(period.color, 0.35)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {period.icon} {period.label}
                </div>
                <div style={{ fontSize: '11px', fontFamily: activeMonoObj.value, color: period.color, fontWeight: 700 }}>
                  {period.range}
                </div>
              </div>
              <input
                type="color"
                value={period.color}
                onChange={(e) => {
                  updatePeriodColor(period.id, { color: e.target.value, bg: hexToRgba(e.target.value, 0.08) });
                  triggerSavedToast(`${period.label} rengi güncellendi.`);
                }}
                style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* BÖLÜM 5: HAFTANIN 7 GÜNÜ RENK PALETİ (PAZARTESİ - PAZAR) */}
      {/* =================================================================== */}
      <div style={cardStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                Haftalık Gün Renkleri (Pazartesi – Pazar Çizgi, Saat Sütunu &amp; Başlık Renkleri)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                Gün sütunlarının ayırıcı çizgilerini, saat sütunu arka planını ve gün başlığı yazı renklerini özelleştirin.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {Object.entries(DAY_PALETTE_PRESETS).map(([presetKey, preset]) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => {
                  applyDayPalettePreset(presetKey);
                  triggerSavedToast(`"${preset.label}" gün paleti uygulandı.`);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={12} style={{ marginRight: '5px', color: 'var(--accent-primary)', verticalAlign: 'middle' }} />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
          gap: '12px'
        }}>
          {Object.entries(config.dayColors).map(([dayName, dayTheme]) => (
            <div
              key={dayName}
              style={{
                borderRadius: '12px',
                border: `2px solid ${dayTheme.line}`,
                background: 'var(--bg-primary)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                padding: '10px 14px',
                background: dayTheme.headerBg,
                borderBottom: `1.5px solid ${dayTheme.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: dayTheme.textAccent }}>
                  {dayName}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontFamily: activeMonoObj.value,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '5px',
                  background: dayTheme.timeBg,
                  color: dayTheme.textAccent
                }}>
                  08:00
                </span>
              </div>

              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Çizgi / Saat / Yazı:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="color"
                      title="Çizgi Rengi"
                      value={dayTheme.line}
                      onChange={(e) => updateDayColor(dayName, { line: e.target.value, border: e.target.value })}
                      style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="color"
                      title="Saat Sütunu Rengi"
                      value={dayTheme.timeBg}
                      onChange={(e) => updateDayColor(dayName, { timeBg: e.target.value, subHeaderBg: e.target.value })}
                      style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="color"
                      title="Gün Başlık Yazı Rengi"
                      value={dayTheme.textAccent}
                      onChange={(e) => updateDayColor(dayName, { textAccent: e.target.value })}
                      style={{ width: '22px', height: '22px', border: 'none', background: 'none', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  {QUICK_PASTEL_SWATCHES.map(sw => (
                    <button
                      key={sw.label}
                      type="button"
                      title={`${dayName} -> ${sw.label}`}
                      onClick={() => {
                        updateDayColor(dayName, {
                          line: sw.line,
                          border: sw.line,
                          timeBg: sw.timeBg,
                          headerBg: sw.headerBg,
                          subHeaderBg: sw.timeBg,
                          textAccent: sw.textAccent
                        });
                        triggerSavedToast(`${dayName} günü "${sw.label}" olarak ayarlandı.`);
                      }}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '5px',
                        border: `1.5px solid ${sw.textAccent}`,
                        background: sw.timeBg,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ALT SABİT KAYDET VE UYGULA ÇUBUĞU */}
      <div style={{
        position: 'sticky',
        bottom: '12px',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '14px 22px',
        borderRadius: '14px',
        background: 'var(--bg-secondary)',
        border: '1.5px solid rgba(16, 185, 129, 0.45)',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.18)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} style={{ color: '#10b981', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
              Tema, Renk, Kutu Boyutu ve Font Ayarlarını Onayla
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Yaptığınız değişiklikleri sunucu veritabanına kalıcı olarak kaydetmek ve 4 modülün tamamına uygulamak için tıklayın.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              copyModuleBoxStyleToAll(activeScope);
              handleSaveAndApplyAll();
            }}
            disabled={isSavingTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(37, 99, 235, 0.35)',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: isSavingTheme ? 'wait' : 'pointer'
            }}
          >
            <Copy size={15} />
            <span>Tüm Modüllere Eşitle ve Kaydet</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndApplyAll}
            disabled={isSavingTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: isSavingTheme ? 'wait' : 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Save size={16} />
            <span>{isSavingTheme ? 'Kaydediliyor...' : 'Kaydet ve Uygula'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemesTab;
