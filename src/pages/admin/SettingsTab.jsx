/**
 * @file src/pages/admin/SettingsTab.jsx
 * @description Admin Paneli - Sistem Ayarları sekmesi (Karanlık/Aydınlık tema, gizlenen MAM kategorileri,
 * kanal bazlı reklam bumper ayarları ve canlı sistem logları).
 */
import React, { useState, useEffect, useMemo } from 'react';
import usePlanningStore from '../../store/planningStore';
import useAdminLogStore, { LOG_CATEGORIES } from '../../store/adminLogStore';
import { BROADCAST_CATEGORIES } from '../../utils/categoryColors';
import { isRamadanFeatureWindowOpen } from '../../components/Ads/reservation/reservationConstants';
import { Filter, Sun, Moon, Clock, Terminal, Plus, Trash2, CheckSquare, Square, Eye, EyeOff, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

const SettingsTab = () => {
  const hiddenCategoryIds = usePlanningStore(state => state.hiddenCategoryIds || []);
  const setHiddenCategoryIds = usePlanningStore(state => state.setHiddenCategoryIds);
  const theme = usePlanningStore(state => state.theme);
  const setTheme = usePlanningStore(state => state.setTheme);
  const ramadanConfig = usePlanningStore(state => state.ramadanConfig || {
    enabled: true, startDate: '', endDate: '', leadDays: 14, forceShow: false
  });
  const setRamadanConfig = usePlanningStore(state => state.setRamadanConfig);
  const adSettings = usePlanningStore(state => state.adSettings || {
    ch_hd: { broadcastLogoName: 'Semerkand_Tv_Logo_Corner', adLogoName: 'Semerkand_HD_Reklam_Logo', bumpers: [] },
    ch_way: { broadcastLogoName: 'Semerkand_Way_Logo_Corner', adLogoName: 'Semerkand_WAY_Reklam_Logo', bumpers: [] }
  });
  const updateChannelPrimaryLogo = usePlanningStore(state => state.updateChannelPrimaryLogo);
  const addBumper = usePlanningStore(state => state.addBumper);
  const updateBumper = usePlanningStore(state => state.updateBumper);
  const removeBumper = usePlanningStore(state => state.removeBumper);
  const resetChannelLogoSettingsToDefault = usePlanningStore(state => state.resetChannelLogoSettingsToDefault);

  const logs = useAdminLogStore(state => state.logs || []);
  const addLog = useAdminLogStore(state => state.addLog);

  const [categoryStatsMap, setCategoryStatsMap] = useState({});

  useEffect(() => {
    fetch('/api/archive/categories-status')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(item => {
            map[Number(item.categoryId)] = item;
          });
          setCategoryStatsMap(map);
        }
      })
      .catch(err => console.error('Kategori istatistik hatası:', err));
  }, []);

  const categories = useMemo(() => {
    return Object.values(BROADCAST_CATEGORIES).map(cat => {
      const stat = categoryStatsMap[Number(cat.id)];
      return {
        id: Number(cat.id),
        name: cat.name,
        color: cat.color,
        bgColor: cat.bgColor,
        borderColor: cat.borderColor,
        totalPrograms: stat?.totalPrograms ?? null,
        totalClips: stat?.totalClips ?? null
      };
    });
  }, [categoryStatsMap]);

  const hiddenSet = useMemo(() => new Set((hiddenCategoryIds || []).map(Number)), [hiddenCategoryIds]);

  const toggleCategory = (cat) => {
    const catId = Number(cat.id);
    const currentIds = (hiddenCategoryIds || []).map(Number);
    const isCurrentlyHidden = currentIds.includes(catId);
    const nextIds = isCurrentlyHidden
      ? currentIds.filter(id => id !== catId)
      : [...currentIds, catId];

    setHiddenCategoryIds(nextIds);
    addLog({
      category: 'system',
      panel: 'system',
      module: 'Sistem Ayarları',
      action: isCurrentlyHidden ? 'Kategori Arama ve Listelerde Açıldı' : 'Kategori Arama ve Listelerde Gizlendi',
      details: `[${cat.id}] ${cat.name} kategorisi Programlar, Günün Taslağı ve Yayın Planlama aramalarında ${isCurrentlyHidden ? 'aktif edildi' : 'gizlendi'}.`,
      target: `${cat.id} - ${cat.name}`,
      status: isCurrentlyHidden ? 'success' : 'warning'
    });
  };

  const handleShowAllCategories = () => {
    setHiddenCategoryIds([]);
    addLog({
      category: 'system',
      panel: 'system',
      module: 'Sistem Ayarları',
      action: 'Tüm Kategoriler Görünür Yapıldı',
      details: 'Medya Kütüphanesi kategori filtresindeki tüm kategoriler aramalara ve listelere açıldı.',
      count: categories.length,
      status: 'success'
    });
  };

  const handleHideAllCategories = () => {
    const allIds = categories.map(c => Number(c.id));
    setHiddenCategoryIds(allIds);
    addLog({
      category: 'system',
      panel: 'system',
      module: 'Sistem Ayarları',
      action: 'Tüm Kategoriler Gizlendi',
      details: 'Medya Kütüphanesi kategori filtresindeki tüm kategoriler gizlendi.',
      count: allIds.length,
      status: 'warning'
    });
  };

  const activeCategoryCount = categories.length - hiddenSet.size;

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleString('tr-TR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Tema Ayarları */}
      <section>
        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Görünüm Ayarları</h3>
        <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Sistem Teması</h4>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px' }}>Arayüzün renk şemasını değiştirin.</p>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px' }}>
            <button 
              onClick={() => {
                setTheme('light');
                addLog({ category: 'system', panel: 'system', module: 'Sistem Ayarları', action: 'Tema Değiştirildi', details: 'Aydınlık (Light) tema seçildi.', status: 'success' });
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', background: theme === 'light' ? 'var(--bg-primary)' : 'transparent', color: theme === 'light' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: theme === 'light' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
            >
              <Sun size={16} /> Açık
            </button>
            <button 
              onClick={() => {
                setTheme('dark');
                addLog({ category: 'system', panel: 'system', module: 'Sistem Ayarları', action: 'Tema Değiştirildi', details: 'Koyu (Dark) tema seçildi.', status: 'success' });
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', background: theme === 'dark' ? 'var(--bg-primary)' : 'transparent', color: theme === 'dark' ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: theme === 'dark' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}
            >
              <Moon size={16} /> Koyu
            </button>
          </div>
        </div>
      </section>

      {/* 🌙 Ramazan Ayı Takvimi ve 2 Hafta Öncesi Otomatik Gösterim Ayarı */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} color="#d97706" />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              🌙 Ramazan Özel Planlama Tarihleri &amp; Otomatik Gösterim Ayarları
            </h3>
          </div>
          {isRamadanFeatureWindowOpen(ramadanConfig) ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              fontSize: '12px',
              fontWeight: '800'
            }}>
              <CheckCircle2 size={14} /> Şu An Yayın Planlama &amp; Reklamlarda Aktif (Görünür)
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(148, 163, 184, 0.14)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontWeight: '800'
            }}>
              <AlertCircle size={14} /> Şu An Gizli (Ramazan Başlangıcına {ramadanConfig?.leadDays || 14} Gün Kala Otomatik Açılır)
            </span>
          )}
        </div>

        <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1.5px solid rgba(217, 119, 6, 0.35)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5 }}>
            Burada girdiğiniz <strong>Ramazan Başlangıç ve Bitiş Tarihi</strong> baz alınarak; Yayın Planlama ve Reklam Rezervasyon ekranlarındaki{' '}
            <strong>&quot;🌙 Ramazan Özel (Sahur / İftar)&quot;</strong> işaretleme alanları normal zamanda gizli tutulur ve{' '}
            <strong>Ramazan başlamadan 2 hafta ({ramadanConfig?.leadDays || 14} gün) öncesinde</strong> otomatik olarak aktif hale gelir.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Ramazan Başlangıç Tarihi:
              </label>
              <input
                type="date"
                value={ramadanConfig?.startDate || ''}
                onChange={e => {
                  const val = e.target.value;
                  setRamadanConfig({ startDate: val, enabled: true });
                  addLog({
                    category: 'system',
                    panel: 'system',
                    module: 'Sistem Ayarları',
                    action: 'Ramazan Başlangıç Tarihi Güncellendi',
                    details: `Ramazan başlangıç tarihi ${val || 'Boş'} olarak ayarlandı.`,
                    status: 'success'
                  });
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  fontWeight: '700'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Ramazan Bitiş Tarihi:
              </label>
              <input
                type="date"
                value={ramadanConfig?.endDate || ''}
                onChange={e => {
                  const val = e.target.value;
                  setRamadanConfig({ endDate: val, enabled: true });
                  addLog({
                    category: 'system',
                    panel: 'system',
                    module: 'Sistem Ayarları',
                    action: 'Ramazan Bitiş Tarihi Güncellendi',
                    details: `Ramazan bitiş tarihi ${val || 'Boş'} olarak ayarlandı.`,
                    status: 'success'
                  });
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13.5px',
                  fontWeight: '700'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '6px' }}>
                Kaç Gün Önceden Gösterilsin? (Varsayılan: 14 Gün / 2 Hafta):
              </label>
              <input
                type="number"
                min="1"
                max="90"
                value={ramadanConfig?.leadDays ?? 14}
                onChange={e => setRamadanConfig({ leadDays: Math.max(1, parseInt(e.target.value, 10) || 14) })}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: '#d97706',
                  fontSize: '13.5px',
                  fontWeight: '800'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {(ramadanConfig?.startDate || ramadanConfig?.endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setRamadanConfig({ startDate: '', endDate: '', forceShow: false });
                    addLog({
                      category: 'system',
                      panel: 'system',
                      module: 'Sistem Ayarları',
                      action: 'Ramazan Tarihleri Temizlendi',
                      details: 'Ramazan Özel işaretleme alanları gizlendi.',
                      status: 'warning'
                    });
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Tarihleri Temizle (Gizle)
                </button>
              )}
            </div>
          </div>

          {ramadanConfig?.startDate && ramadanConfig?.endDate && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.3)',
              fontSize: '12.5px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                📅 <strong>Ramazan Dönemi:</strong> {ramadanConfig.startDate} – {ramadanConfig.endDate} •{' '}
                <strong>Otomatik Açılış Tarihi ({ramadanConfig.leadDays || 14} gün önce):</strong>{' '}
                <span style={{ color: '#d97706', fontWeight: '800' }}>
                  {(() => {
                    const s = new Date(`${ramadanConfig.startDate}T00:00:00`);
                    if (Number.isNaN(s.getTime())) return '-';
                    const openD = new Date(s.getTime() - (Number(ramadanConfig.leadDays) || 14) * 86400000);
                    return openD.toISOString().split('T')[0];
                  })()}
                </span>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#d97706' }}>
                <input
                  type="checkbox"
                  checked={Boolean(ramadanConfig?.forceShow)}
                  onChange={e => setRamadanConfig({ forceShow: e.target.checked })}
                />
                <span>Tarihi Beklemeden Şimdi Test İçin Göster</span>
              </label>
            </div>
          )}
        </div>
      </section>

      {/* Kategori Filtreleme */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Filter size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Medya Kütüphanesi Kategori Filtreleme</h3>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              padding: '3px 10px',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(59, 130, 246, 0.25)'
            }}>
              {activeCategoryCount} / {categories.length} Kategori Açık
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleShowAllCategories}
              disabled={hiddenSet.size === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: hiddenSet.size === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: '12px', fontWeight: '700',
                cursor: hiddenSet.size === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Eye size={14} /> Tümünü Aç
            </button>
            <button
              onClick={handleHideAllCategories}
              disabled={hiddenSet.size === categories.length}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: hiddenSet.size === categories.length ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontSize: '12px', fontWeight: '700',
                cursor: hiddenSet.size === categories.length ? 'not-allowed' : 'pointer'
              }}
            >
              <EyeOff size={14} /> Tümünü Gizle
            </button>
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: '0 0 18px 0', lineHeight: 1.5 }}>
            Burada işaretini kaldırdığınız (gizlediğiniz) yayın kategorileri; <strong>Programlar sekmesi aramalarında</strong>, <strong>program ekleme/çıkarma pencerelerinde</strong> ve <strong>Yayın Planlama (Günün Taslağı ve Klip Arama)</strong> alanlarında listelenmez.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' }}>
            {categories.map(cat => {
              const isHidden = hiddenSet.has(Number(cat.id));
              return (
                <label
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '12px 14px',
                    background: isHidden ? 'var(--bg-tertiary)' : cat.bgColor,
                    border: `1.5px solid ${isHidden ? 'var(--border-color)' : cat.color}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    opacity: isHidden ? 0.55 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggleCategory(cat)}
                      style={{ cursor: 'pointer', accentColor: cat.color, width: '16px', height: '16px' }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '1px 6px',
                          borderRadius: '5px',
                          background: isHidden ? 'var(--bg-secondary)' : cat.color,
                          color: isHidden ? 'var(--text-muted)' : '#fff'
                        }}>
                          #{cat.id}
                        </span>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: isHidden ? 'var(--text-secondary)' : 'var(--text-primary)',
                          textDecoration: isHidden ? 'line-through' : 'none'
                        }}>
                          {cat.name}
                        </span>
                      </div>
                      {cat.totalPrograms !== null && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                          {cat.totalPrograms} Program • {cat.totalClips} Klip
                        </div>
                      )}
                    </div>
                  </div>

                  <span style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: isHidden ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.14)',
                    color: isHidden ? '#ef4444' : '#10b981',
                    flexShrink: 0
                  }}>
                    {isHidden ? 'GİZLİ' : 'AÇIK'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Kanal Bazlı Yayın ve Reklam Logo Ayarları (Yayın Liste Kontrol Entegrasyonlu) */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              Kanal Bazlı Yayın ve Reklam Logo Ayarları (Yayın Liste Kontrol)
            </h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Her kanal için <strong>Yayına Girerken Girecek Logo</strong> ve <strong>Reklama Girerken Girecek Logo</strong> isimlerini tanımlayın (Dosya yükleme yoktur, yalnızca logo ismi girilir). Bu logo isimleri <strong>Yayın Liste Kontrol</strong> aşamasında listeye otomatik işlenir.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof resetChannelLogoSettingsToDefault === 'function') {
                resetChannelLogoSettingsToDefault();
                addLog({
                  category: 'system',
                  panel: 'system',
                  module: 'Sistem Ayarları',
                  action: 'Varsayılan Kanal Logo Ayarları Yüklendi',
                  details: 'Semerkand HD ve Semerkand WAY yayın/reklam logo isimleri ve jenerik logo eşleştirmeleri varsayılana döndürüldü.',
                  status: 'success'
                });
              }
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Varsayılan Logo İsimlerini Yükle
          </button>
        </div>

        <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '24px' }}>
            {[
              { id: 'ch_hd', name: 'Semerkand HD', color: '#3b82f6', defaultBroadcastLogo: 'Semerkand_Tv_Logo_Corner', defaultAdLogo: 'Semerkand_HD_Reklam_Logo' },
              { id: 'ch_way', name: 'Semerkand WAY', color: '#8b5cf6', defaultBroadcastLogo: 'Semerkand_Way_Logo_Corner', defaultAdLogo: 'Semerkand_WAY_Reklam_Logo' }
            ].map(ch => {
              const chData = adSettings?.[ch.id] || {};
              const broadcastLogoVal = chData.broadcastLogoName ?? ch.defaultBroadcastLogo;
              const adLogoVal = chData.adLogoName ?? ch.defaultAdLogo;
              const bumpersList = Array.isArray(chData.bumpers) ? chData.bumpers : [];

              return (
                <div
                  key={ch.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    padding: '22px',
                    borderRadius: '14px',
                    border: `1.5px solid ${ch.color}44`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                  }}
                >
                  {/* Kanal Başlığı */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <h4 style={{ margin: 0, color: ch.color, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: ch.color }}></span>
                      {ch.name} — Logo İsim Ayarları
                    </h4>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => addBumper(ch.id, 'broadcast_in')}
                        style={{
                          background: 'rgba(16, 185, 129, 0.14)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          padding: '6px 11px',
                          borderRadius: '7px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={13} /> Yayına Giriş Logosu Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => addBumper(ch.id, 'ad_in')}
                        style={{
                          background: 'rgba(245, 158, 11, 0.14)',
                          color: '#d97706',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          padding: '6px 11px',
                          borderRadius: '7px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={13} /> Reklama Giriş Logosu Ekle
                      </button>
                    </div>
                  </div>

                  {/* ANA KANAL LOGO İSİMLERİ: 1) Yayına Girerken Girecek Logo 2) Reklama Girerken Girecek Logo */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      padding: '14px',
                      borderRadius: '11px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {/* 1. Yayına Girerken Girecek Logo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        📺 Yayına Girerken Girecek Logo İsmi:
                      </label>
                      <input
                        type="text"
                        value={broadcastLogoVal}
                        onChange={e =>
                          typeof updateChannelPrimaryLogo === 'function' &&
                          updateChannelPrimaryLogo(ch.id, 'broadcastLogoName', e.target.value, true)
                        }
                        placeholder="Örn: Semerkand_Tv_Logo_Corner"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'var(--bg-primary)',
                          border: '1.5px solid rgba(16, 185, 129, 0.45)',
                          color: 'var(--text-primary)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          fontFamily: 'monospace'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Programlara, canlı yayınlara, introlara ve reklam çıkışına girerken listeye yazılır.
                      </span>
                    </div>

                    {/* 2. Reklama Girerken Girecek Logo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '800', color: '#d97706', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        📢 Reklama Girerken Girecek Logo İsmi:
                      </label>
                      <input
                        type="text"
                        value={adLogoVal}
                        onChange={e =>
                          typeof updateChannelPrimaryLogo === 'function' &&
                          updateChannelPrimaryLogo(ch.id, 'adLogoName', e.target.value, true)
                        }
                        placeholder="Örn: Semerkand_HD_Reklam_Logo"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'var(--bg-primary)',
                          border: '1.5px solid rgba(245, 158, 11, 0.45)',
                          color: 'var(--text-primary)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: '700',
                          fontFamily: 'monospace'
                        }}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Reklam giriş jeneriğinde ve reklam kuşağı spotlarında listeye yazılır.
                      </span>
                    </div>
                  </div>

                  {/* Jenerik / Program Bazlı Özel Giriş-Çıkış Logo Eşleştirmeleri */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)' }}>
                        Jenerik &amp; Program Bazlı Logo İsim Eşleştirmeleri ({bumpersList.length} Kayıt)
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Jenerik / Program Adı &rarr; Geçiş Türü &rarr; Logo İsmi
                      </span>
                    </div>

                    {bumpersList.length > 0 ? (
                      bumpersList.map(bumper => {
                        const normalizedType =
                          bumper.type === 'in'
                            ? 'ad_in'
                            : bumper.type === 'out'
                            ? 'broadcast_in'
                            : bumper.type || 'broadcast_in';
                        const isAdLogoRow = normalizedType === 'ad_in';

                        return (
                          <div
                            key={bumper.id}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1.35fr 185px 1.25fr 36px',
                              gap: '8px',
                              alignItems: 'center',
                              background: 'var(--bg-secondary)',
                              padding: '10px 12px',
                              borderRadius: '9px',
                              border: `1px solid ${isAdLogoRow ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`
                            }}
                          >
                            <input
                              type="text"
                              value={bumper.name || ''}
                              onChange={e => updateBumper(ch.id, bumper.id, 'name', e.target.value)}
                              placeholder="Jenerik veya Program Adı (Örn: reklam_dini_giris_2014)"
                              style={{
                                width: '100%',
                                padding: '7px 10px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                fontFamily: 'monospace'
                              }}
                            />

                            <select
                              value={normalizedType}
                              onChange={e => updateBumper(ch.id, bumper.id, 'type', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '7px 8px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: isAdLogoRow ? '#d97706' : '#10b981',
                                fontWeight: '800',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                            >
                              <option value="broadcast_in">📺 Yayına Girerken Logo</option>
                              <option value="ad_in">📢 Reklama Girerken Logo</option>
                            </select>

                            <input
                              type="text"
                              value={bumper.logoName || ''}
                              onChange={e => updateBumper(ch.id, bumper.id, 'logoName', e.target.value)}
                              placeholder="Logo İsmi (Örn: Semerkand_Tv_Logo_Corner)"
                              style={{
                                width: '100%',
                                padding: '7px 10px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                borderRadius: '6px',
                                fontSize: '12.5px',
                                fontWeight: '700',
                                fontFamily: 'monospace'
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => removeBumper(ch.id, bumper.id)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                padding: '7px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                        Özel jenerik logo kuralı yok. Üstteki ana Yayın ve Reklam logo isimleri tüm satırlara otomatik uygulanır.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sistem Logları Özeti */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Son Sistem Kayıtları (Canlı Denetim Akışı)</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Toplam {logs.length} kayıt</span>
        </div>
        <div style={{ background: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', overflow: 'hidden', padding: '16px', fontFamily: 'monospace' }}>
          {logs.slice(0, 12).map((log, i, arr) => {
            const catMeta = LOG_CATEGORIES.find(c => c.id === (log.category || log.panel)) || LOG_CATEGORIES[LOG_CATEGORIES.length - 1];
            return (
              <div key={log.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: i === arr.length - 1 ? 'none' : '1px solid #1e293b', color: '#94a3b8', fontSize: '12.5px', flexWrap: 'wrap' }}>
                <span style={{ color: '#38bdf8', flexShrink: 0 }}>[{formatTime(log.timestamp)}]</span>
                <span style={{
                  padding: '1px 7px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  background: `${catMeta.color}22`,
                  color: catMeta.color,
                  border: `1px solid ${catMeta.color}44`,
                  minWidth: '115px',
                  textAlign: 'center',
                  flexShrink: 0
                }}>
                  {catMeta.shortLabel}
                </span>
                <span style={{ color: '#10b981', minWidth: '140px', flexShrink: 0 }}>{log.userName ? `${log.userName} (${log.user})` : log.user}</span>
                <span style={{ color: '#f8fafc', fontWeight: 'bold' }}>{log.action}:</span>
                <span style={{ color: '#cbd5e1', flex: 1 }}>{log.details}</span>
              </div>
            );
          })}
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px' }}>
            <Terminal size={14} /> Canlı log akışı izleniyor... Tüm detaylı logları ve filtreleri &quot;Log Kayıtları&quot; sekmesinden inceleyebilirsiniz.
          </div>
        </div>
      </section>

    </div>
  );
};

export default SettingsTab;
