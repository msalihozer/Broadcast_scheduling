/**
 * @file TopNavbar.jsx
 * @description Üst Kontrol ve Gezinme Çubuğu.
 * 
 * Temel Sorumluluklar:
 * 1. Aktif panel başlığı (Taslak Planlama, Yayın Planlama, vb.) ve modül seçimine dönüş
 * 2. Canlı saat ve yayın göstergesi
 * 3. Kütüphane paneli açma/kapama, görünüm modu (grid/rundown) kontrolü
 * 4. Taslak kaydetme, şablon açma ve oturumu sonlandırma (Sign Out)
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, Check, ExternalLink, Save, Trash2, FolderOpen, LogOut, User, Keyboard, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useNavigate, useLocation } from 'react-router-dom';
import useDialogStore from '../../store/dialogStore';
import usePlanningStore from '../../store/planningStore';
import useAuthStore from '../../store/authStore';
import useResponsive from '../../hooks/useResponsive';

const TopNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, isCompact } = useResponsive();
  const [time, setTime] = useState(new Date());
  const showMediaLibrary = usePlanningStore(state => state.showMediaLibrary);
  const showSpecialTemplates = usePlanningStore(state => state.showSpecialTemplates);
  const setPanelsVisibility = usePlanningStore(state => state.setPanelsVisibility);
  
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);
  
  const currentMode = usePlanningStore(state => state.currentMode) || 'draft';
  const drafts = usePlanningStore(state => (state.drafts || []).filter(d => (d.mode || 'draft') === currentMode));
  const saveDraft = usePlanningStore(state => state.saveDraft);
  const applyDraft = usePlanningStore(state => state.applyDraft);
  const deleteDraft = usePlanningStore(state => state.deleteDraft);
  
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [draftMenuOpen, setDraftMenuOpen] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);
  const [newDraftName, setNewDraftName] = useState('');
  const [showShortcutsMenu, setShowShortcutsMenu] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isDraftPage = location.pathname === '/draft';
  const isReadyPage = location.pathname === '/ready';
  const isAdsPage = location.pathname.startsWith('/ads');
  const isListControlPage = location.pathname === '/list-control';

  // Hangi panelde ise o başlığı göster
  const getPageTitle = () => {
    if (isDraftPage) return 'Taslak Planlama';
    if (isReadyPage) return 'Yayın Planlama';
    if (isAdsPage) return 'Reklam Rezervasyon';
    if (isListControlPage) return 'Yayın Liste Kontrol';
    return 'Yayın Planlama Sistemi';
  };

  return (
    <header style={{
      minHeight: isMobile ? '48px' : 'var(--header-height)',
      height: isCompact ? 'auto' : 'var(--header-height)',
      background: 'var(--bg-topbar)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: isCompact ? 'wrap' : 'nowrap',
      padding: isMobile ? '6px 10px' : isCompact ? '8px 14px' : '0 24px',
      borderBottom: '1px solid var(--border-color)',
      color: 'var(--text-primary)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      flexShrink: 0,
      zIndex: 1000,
      position: 'sticky',
      top: 0,
      gap: isMobile ? '8px' : '16px'
    }}>
      {/* Sol: Geri Dönüş ve Panel Başlığı */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/')}
          title="Modül Seçim Ekranına Dön"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '8px',
            padding: isMobile ? '6px 9px' : '7px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: isMobile ? '11.5px' : '12px',
            fontWeight: '600',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--accent-primary)';
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.background = 'var(--bg-primary)';
          }}
        >
          <ArrowLeft size={15} /> {!isMobile && 'Modüller'}
        </button>

        <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }}></div>

        {/* Panel İsmi (Taslak planlamada ise sadece 'Taslak Planlama' yazar) */}
        <h1 style={{
          fontSize: isMobile ? '14.5px' : '18px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.3px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap'
        }}>
          {getPageTitle()}
        </h1>
      </div>

      {/* Orta: Sadece mevcut panele ait fonksiyonel kontroller (Panel geçiş butonları tamamen kaldırıldı) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: isCompact ? '0 1 auto' : 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        {(isDraftPage || isReadyPage) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', flexWrap: 'wrap' }}>
            {/* Görünüm Menüsü */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setViewMenuOpen(!viewMenuOpen)}
                onBlur={() => setTimeout(() => setViewMenuOpen(false), 200)}
                style={{
                  background: viewMenuOpen ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: isMobile ? '6px 9px' : '7px 14px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '11.5px' : '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Eye size={14} color="var(--accent-primary)" /> {!isMobile && 'Görünüm'}
              </button>
              {viewMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px',
                  zIndex: 1000,
                  minWidth: '200px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                }}>
                  <div 
                    onClick={() => setPanelsVisibility({ showMediaLibrary: !showMediaLibrary })}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: '16px' }}>{showMediaLibrary && <Check size={14} color="var(--accent-primary)"/>}</div>
                    Medya Kütüphanesi
                  </div>
                  <div 
                    onClick={() => setPanelsVisibility({ showSpecialTemplates: !showSpecialTemplates })}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: '16px' }}>{showSpecialTemplates && <Check size={14} color="var(--accent-primary)"/>}</div>
                    Özel Alanlar
                  </div>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>
                  <div 
                    onClick={() => window.open('/library-popout', '_blank', 'width=400,height=800,menubar=no,toolbar=no,location=no,status=no')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: 'var(--accent-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <ExternalLink size={14} /> Yeni Pencerede Aç
                  </div>
                </div>
              )}
            </div>

            {/* Taslaklar Menüsü (Yalnızca Taslak Sayfasında) */}
            {isDraftPage && (
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => {
                    setDraftMenuOpen(!draftMenuOpen);
                    setViewMenuOpen(false);
                    setIsPrompting(false);
                  }}
                  style={{
                    background: draftMenuOpen ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    padding: isMobile ? '6px 9px' : '7px 14px',
                    borderRadius: '8px',
                    fontSize: isMobile ? '11.5px' : '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <FolderOpen size={14} color="var(--accent-primary)" /> {!isMobile && 'Taslaklar'}
                </button>
                {draftMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px',
                    zIndex: 1000,
                    minWidth: '240px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }}>
                    {!isPrompting ? (
                      <div 
                        onClick={() => setIsPrompting(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '13px', color: 'var(--accent-primary)', fontWeight: '600' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Save size={14} /> Mevcut Akışı Taslak Yap
                      </div>
                    ) : (
                      <div style={{ padding: '8px 12px', display: 'flex', gap: '6px' }}>
                        <input 
                          type="text" 
                          placeholder="Taslak İsmi" 
                          value={newDraftName}
                          onChange={e => setNewDraftName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newDraftName.trim()) {
                              saveDraft(newDraftName.trim());
                              setNewDraftName('');
                              setIsPrompting(false);
                            }
                          }}
                          autoFocus
                          style={{ flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none' }}
                        />
                        <button 
                          onClick={() => {
                            if (newDraftName.trim()) {
                              saveDraft(newDraftName.trim());
                              setNewDraftName('');
                              setIsPrompting(false);
                            }
                          }}
                          style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Kaydet
                        </button>
                      </div>
                    )}
                    
                    {drafts.length > 0 && (
                      <>
                        <div style={{ height: '1px', background: 'var(--border-color)', margin: '6px 0' }}></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 12px 4px 12px', textTransform: 'uppercase', fontWeight: 600 }}>Kayıtlı Taslaklar ({drafts.length}/10)</div>
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          {drafts.map(draft => (
                            <div key={draft.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <div 
                                style={{ flex: 1, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '4px', color: 'var(--text-primary)' }}
                                onClick={() => {
                                  useDialogStore.getState().showConfirm('Taslağı Uygula', `"${draft.name}" taslağını uygulamak istiyor musunuz? (Mevcut akışın üzerine yazılır)`, () => {
                                    applyDraft(draft.id);
                                    setDraftMenuOpen(false);
                                  });
                                }}
                              >
                                {draft.name}
                              </div>
                              <div 
                                onClick={(e) => { e.stopPropagation(); deleteDraft(draft.id); }}
                                style={{ padding: '4px', color: 'var(--danger)', opacity: 0.7 }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                                title="Taslağı Sil"
                              >
                                <Trash2 size={14} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Kısayollar Rehberi */}
            {!isMobile && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => {
                  if (isDraftPage) {
                    window.dispatchEvent(new CustomEvent('draft:open-shortcuts'));
                  } else {
                    setShowShortcutsMenu(!showShortcutsMenu);
                  }
                }}
                onBlur={() => setTimeout(() => setShowShortcutsMenu(false), 200)}
                style={{
                  background: showShortcutsMenu ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Keyboard size={15} color="var(--accent-primary)" /> Kısayollar
              </button>
              {showShortcutsMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  zIndex: 1000,
                  width: '320px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ fontWeight: '700', marginBottom: '12px', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', color: 'var(--text-primary)' }}>
                    Sistem Kısayolları ve Rehber
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-primary)', minWidth: '70px' }}>Ctrl + C</span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Seçili programları kopyalar.</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-primary)', minWidth: '70px' }}>Ctrl + V</span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Hafızadaki programları listeye ekler.</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-primary)', minWidth: '70px' }}>Ctrl + Z</span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Son işlemi geri alır.</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-primary)', minWidth: '70px' }}>Shift + Tık</span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Aralıktaki programları topluca seçer.</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: '700', color: 'var(--accent-primary)', minWidth: '70px' }}>Delete</span>
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>Seçili programları akıştan siler.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Raporlar Butonu (Header Alanında Kısayollar Yanında) */}
            {isDraftPage && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('draft:open-reports'))}
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: isMobile ? '6px 9px' : '7px 14px',
                  borderRadius: '8px',
                  fontSize: isMobile ? '11.5px' : '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <BarChart3 size={14} color="var(--accent-primary)" /> {!isMobile && 'Raporlar'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sağ: Saat, Canlı Yayında Rozeti ve Kullanıcı Alanı */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '14px', flexShrink: 0 }}>
        {/* Saat & Tarih - Tek Satır, Net ve Ferah */}
        {!isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-primary)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '12px'
          }}>
            <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>
              {format(time, 'HH:mm:ss')}
            </span>
            {!isCompact && (
              <>
                <span style={{ color: 'var(--border-color)' }}>•</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                  {format(time, 'd MMMM yyyy, EEEE', { locale: tr })}
                </span>
              </>
            )}
          </div>
        )}

        {/* Canlı Yayın Rozeti */}
        {!isCompact && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--success)',
            background: 'rgba(22, 163, 74, 0.1)',
            border: '1px solid rgba(22, 163, 74, 0.25)',
            padding: '5px 10px',
            borderRadius: '16px'
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
            YAYINDA
          </div>
        )}

        {/* Kullanıcı Bilgisi ve Çıkış Butonu */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '5px' : '8px', paddingLeft: isMobile ? '0' : '10px', borderLeft: isMobile ? 'none' : '1px solid var(--border-color)' }}>
            {!isMobile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: '600',
                background: 'var(--bg-primary)',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <User size={14} color="var(--accent-primary)" />
                <span style={{ textTransform: 'capitalize' }}>
                  {user.email.includes('@') ? user.email.split('@')[0] : user.email}
                </span>
              </div>
            )}

            <button 
              onClick={() => signOut()}
              style={{
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: isMobile ? '6px 9px' : '6px 12px',
                borderRadius: '8px',
                fontSize: isMobile ? '11.5px' : '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--danger)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--danger-bg)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
              title="Oturumu Sonlandır"
            >
              <LogOut size={14} /> {!isMobile && 'Çıkış'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default TopNavbar;
