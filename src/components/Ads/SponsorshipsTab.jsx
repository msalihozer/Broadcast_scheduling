/**
 * @file src/components/Ads/SponsorshipsTab.jsx
 * @description Program Sponsorlukları Yönetim Sekmesi.
 * Yayındaki programlara (İlim Dersleri - Tecvid, Çerçeve, Semerkand Sohbetleri vb.) bağlı sponsorlukları
 * listeler; "Program Öncesi", "Program Arası (Partlar Arası)" ve "Program Sonrası" yerleşimlerini
 * tek tıkla değiştirmeye, yeni sponsorluk eklemeye ve düzenlemeye olanak tanır.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Plus,
  Tv,
  Building2,
  Package,
  Film,
  Calendar,
  Edit2,
  Trash2,
  Search,
  Check,
  Play,
  X
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import useDialogStore from '../../store/dialogStore';
import AdVideoPlayer from './AdVideoPlayer';
import AdsReservationForm, {
  SPONSOR_POSITIONS,
  SPONSOR_FLOW_POSITIONS,
  SPONSOR_BUMPER_ROLES,
  FALLBACK_BROADCAST_PROGRAMS
} from './AdsReservationForm';

const formatTrDate = (dateStr) => {
  if (!dateStr) return '-';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
};

const SponsorshipsTab = ({ setActiveTab }) => {
  const {
    reservations = [],
    companies = [],
    products = [],
    materials = [],
    channels = [],
    hiddenCategoryIds = [],
    updateReservation,
    removeReservation
  } = usePlanningStore();

  const [usedPrograms, setUsedPrograms] = useState(FALLBACK_BROADCAST_PROGRAMS);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRes, setEditingRes] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/archive/used-programs')
      .then(res => res.json())
      .then(data => {
        if (!mounted) return;
        const list = Array.isArray(data?.programs) ? data.programs : Array.isArray(data) ? data : [];
        const hiddenSet = new Set((hiddenCategoryIds || []).map(Number));
        const visible = list.filter(p => !hiddenSet.has(Number(p.categoryId)));
        if (visible.length > 0) {
          const existingTitles = new Set(visible.map(p => (p.title || '').toLocaleLowerCase('tr-TR')));
          const merged = [
            ...visible,
            ...FALLBACK_BROADCAST_PROGRAMS.filter(
              fb => !hiddenSet.has(Number(fb.categoryId)) && !existingTitles.has(fb.title.toLocaleLowerCase('tr-TR'))
            )
          ];
          setUsedPrograms(merged);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [hiddenCategoryIds]);

  const sponsorReservations = useMemo(() => {
    return reservations
      .filter(r => r.isSponsor || r.isRamadanSpecial || (Array.isArray(r.items) && r.items.some(it => it.isSponsor || it.isRamadanSpecial)))
      .map(res => {
        const items =
          Array.isArray(res.items) && res.items.length > 0
            ? res.items
            : [
                {
                  companyId: res.companyId,
                  productId: res.productId,
                  materialId: res.materialId,
                  startDate: res.startDate,
                  endDate: res.endDate,
                  plannedSpots: res.totalPlannedSpots
                }
              ];
        const firstItem = items[0] || {};
        const company = companies.find(c => String(c.id) === String(res.companyId || firstItem.companyId));
        const isRamadan = Boolean(res.isRamadanSpecial || items.some(it => it.isRamadanSpecial));
        const ramadanTarget = res.ramadanTarget || firstItem.ramadanTarget || 'iftar';
        const ramadanProgLabel = ramadanTarget === 'sahur'
          ? 'Ramazan Sahur Programı'
          : ramadanTarget === 'both'
          ? 'Ramazan Sahur & İftar Programları'
          : 'Ramazan İftar Programı';

        return {
          ...res,
          items,
          company,
          companyName: company?.name || '-',
          isRamadanSpecial: isRamadan,
          programTitle: res.sponsorProgramTitle || (isRamadan ? ramadanProgLabel : 'İlim Dersleri- Tecvid'),
          positions:
            Array.isArray(res.sponsorPositions) && res.sponsorPositions.length > 0
              ? res.sponsorPositions
              : Array.isArray(res.ramadanPositions) && res.ramadanPositions.length > 0
              ? res.ramadanPositions
              : ['before', 'after']
        };
      });
  }, [reservations, companies]);

  // Filtrelenmiş sponsorluklar
  const filteredSponsorships = useMemo(() => {
    return sponsorReservations.filter(sp => {
      if (selectedProgramFilter !== 'all' && sp.programTitle !== selectedProgramFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLocaleLowerCase('tr-TR');
        const hay = `${sp.programTitle} ${sp.companyName} ${sp.name || ''}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sponsorReservations, selectedProgramFilter, searchTerm]);

  // Tablo üzerinden tek tıkla "Program Öncesi / Part Arası / Program Sonrası" konum değiştirme
  const handleQuickTogglePosition = (sp, posId) => {
    const current = sp.positions || [];
    const exists = current.includes(posId);
    if (exists && current.length <= 1) {
      return; // En az 1 konum seçili kalsın
    }
    const nextPositions = exists ? current.filter(p => p !== posId) : [...current, posId];
    updateReservation(sp.id, { sponsorPositions: nextPositions });
  };

  // Tablo üzerinden hızlı program değiştirme
  const handleQuickProgramChange = (sp, newProgramTitle) => {
    const progObj = usedPrograms.find(p => p.title === newProgramTitle);
    updateReservation(sp.id, {
      sponsorProgramTitle: newProgramTitle,
      sponsorProgramId: progObj?.id || newProgramTitle
    });
  };

  const handleDelete = (id) => {
    useDialogStore
      .getState()
      .showConfirm(
        'Program Sponsorluğunu Sil',
        'Bu program sponsorluğu kaydını silmek istediğinize emin misiniz?',
        () => removeReservation(id)
      );
  };

  const uniqueSponsoredPrograms = useMemo(() => {
    const set = new Set(sponsorReservations.map(s => s.programTitle).filter(Boolean));
    return Array.from(set);
  }, [sponsorReservations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ÜST ÖZET VE PROGRAM FİLTRE ÇUBUĞU */}
      <div className="ads-saas-toolbar" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'rgba(147, 51, 234, 0.14)',
              color: '#9333ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Award size={18} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
              Program Sponsorlukları Yönetimi
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)' }}>
              Yayındaki programlara (İlim Dersleri - Tecvid, Çerçeve vb.) bağlı <strong>Program Öncesi</strong>, <strong>Part Arası</strong> ve <strong>Program Sonrası</strong> sponsorlukları yönetin.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--ads-text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Program veya firma ara..."
              className="ads-saas-input"
              style={{ paddingLeft: '30px', width: '220px' }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingRes(null);
              setIsFormOpen(true);
            }}
            className="ads-saas-btn ads-saas-btn-primary"
            style={{ background: '#9333ea' }}
          >
            <Plus size={14} /> Yeni Program Sponsorluğu Ekle
          </button>
        </div>
      </div>

      {/* PROGRAM FİLTRE PİLLERİ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-muted)', marginRight: '4px' }}>
          Programa Göre Filtrele:
        </span>
        <button
          type="button"
          onClick={() => setSelectedProgramFilter('all')}
          className={`ads-saas-chip ${selectedProgramFilter === 'all' ? 'active' : ''}`}
        >
          Tüm Sponsorluklar ({sponsorReservations.length})
        </button>
        {uniqueSponsoredPrograms.map(progTitle => {
          const count = sponsorReservations.filter(s => s.programTitle === progTitle).length;
          return (
            <button
              key={progTitle}
              type="button"
              onClick={() => setSelectedProgramFilter(progTitle)}
              className={`ads-saas-chip ${selectedProgramFilter === progTitle ? 'active' : ''}`}
            >
              <Tv size={11} /> {progTitle} ({count})
            </button>
          );
        })}
      </div>

      {/* SPONSORLUK TABLOSU */}
      <div className="ads-saas-table-wrap" style={{ flex: 1 }}>
        <div className="ads-saas-table-scroll">
          <table className="ads-saas-table" style={{ minWidth: '1080px' }}>
            <thead>
              <tr>
                <th>Sponsor Olunan Program</th>
                <th>Sponsor Firma</th>
                <th>Ürünler &amp; Sponsorluk Spotları</th>
                <th>Sponsorluk Konumu (Tıklayarak Değiştirin)</th>
                <th>Tarih Aralığı &amp; Kanal</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredSponsorships.map(sp => (
                <tr key={sp.id}>
                  {/* Program Seçici (Doğrudan tablo üzerinden de değiştirilebilir) */}
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Tv size={15} color="#9333ea" />
                      <select
                        value={sp.programTitle}
                        onChange={e => handleQuickProgramChange(sp, e.target.value)}
                        className="ads-saas-select"
                        style={{ fontWeight: '800', fontSize: '12.5px', minWidth: '195px' }}
                      >
                        {usedPrograms.map(prog => (
                          <option key={prog.id || prog.title} value={prog.title}>
                            {prog.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>

                  {/* Firma */}
                  <td>
                    <div
                      onClick={() => {
                        if (sp.company && setActiveTab) {
                          usePlanningStore.getState().setSelectedCompanyDetailId(sp.company.id);
                          setActiveTab('company-details');
                        }
                      }}
                      style={{ color: 'var(--ads-brand)', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                    >
                      {sp.companyName}
                    </div>
                  </td>

                  {/* Ürünler ve Materyaller */}
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {sp.items.map((it, idx) => {
                        const p = products.find(x => String(x.id) === String(it.productId));
                        const m = materials.find(x => String(x.id) === String(it.materialId));
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                            <Package size={13} color="var(--ads-orange)" />
                            <span style={{ fontWeight: '700', color: 'var(--ads-text-main)' }}>{p?.name || 'Ürün'}</span>
                            <span style={{ color: 'var(--ads-text-muted)' }}>•</span>
                            <Film size={12} color="var(--ads-teal)" />
                            <span style={{ color: 'var(--ads-text-sub)', fontWeight: '600', wordBreak: 'break-word' }}>
                              {m ? `${m.clipName || m.name} (${m.duration}sn)` : '-'}
                            </span>
                            {m && (
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setPreviewMaterial(m);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  fontWeight: '800',
                                  background: 'var(--ads-brand-soft)',
                                  color: 'var(--ads-brand)',
                                  border: '1px solid rgba(0, 102, 255, 0.28)',
                                  cursor: 'pointer'
                                }}
                                title="Sponsorluk klibini izle"
                              >
                                <Play size={10} fill="currentColor" /> İzle
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>

                  {/* Hızlı Konum Değiştirici: 1. Kısım (Part Öncesi/Arası/Sonrası) + 2. Kısım (Sunar/Devam Edecek/Devam Ediyor/Sundu) */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                      {/* 1. Kısım: Çoklu Kuşak İçi */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {SPONSOR_FLOW_POSITIONS.map(pos => {
                          const isActive = sp.positions.includes(pos.id);
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => handleQuickTogglePosition(sp, pos.id)}
                              title={pos.desc}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '7px',
                                border: `1.5px solid ${isActive ? pos.color : 'var(--ads-border)'}`,
                                background: isActive ? pos.bg : 'var(--ads-card-subtle)',
                                color: isActive ? pos.color : 'var(--ads-text-muted)',
                                fontSize: '10.5px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                opacity: isActive ? 1 : 0.65,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isActive && <Check size={10} />}
                              {pos.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                      {/* 2. Kısım: Tekil Özel Sunum Bantları */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {SPONSOR_BUMPER_ROLES.map(pos => {
                          const isActive = sp.positions.includes(pos.id);
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => handleQuickTogglePosition(sp, pos.id)}
                              title={pos.desc}
                              style={{
                                padding: '3px 7px',
                                borderRadius: '6px',
                                border: `1.5px solid ${isActive ? pos.color : 'var(--ads-border)'}`,
                                background: isActive ? pos.bg : 'var(--ads-card-subtle)',
                                color: isActive ? pos.color : 'var(--ads-text-muted)',
                                fontSize: '10px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                opacity: isActive ? 1 : 0.6,
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isActive && <Check size={10} />}
                              {pos.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </td>

                  {/* Tarih ve Kanal */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: 'var(--ads-pill-bar-bg)',
                          border: '1px solid var(--ads-border-strong)',
                          color: 'var(--ads-text-main)',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Calendar size={11} color="var(--ads-brand)" />
                        {formatTrDate(sp.startDate || sp.items?.[0]?.startDate)} &ndash; {formatTrDate(sp.endDate || sp.items?.[0]?.endDate)}
                      </span>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {(sp.channelIds || ['ch_hd']).map(cid => (
                          <span
                            key={cid}
                            style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              background: 'var(--ads-brand-soft)',
                              color: 'var(--ads-brand)'
                            }}
                          >
                            {channels.find(c => c.id === cid)?.name || cid}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* İşlemler */}
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRes(sp);
                          setIsFormOpen(true);
                        }}
                        className="ads-saas-btn ads-saas-btn-sm"
                        title="Sponsorluğu Düzenle"
                      >
                        <Edit2 size={13} /> Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sp.id)}
                        className="ads-saas-btn ads-saas-btn-sm"
                        style={{ color: '#ef4444' }}
                        title="Sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredSponsorships.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '44px', color: 'var(--ads-text-muted)' }}>
                    Henüz tanımlı program sponsorluğu bulunmuyor. &quot;Yeni Program Sponsorluğu Ekle&quot; butonuyla hemen oluşturabilirsiniz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <AdsReservationForm
          onClose={() => {
            setIsFormOpen(false);
            setEditingRes(null);
          }}
          existingData={editingRes}
          defaultSponsorMode={true}
        />
      )}

      {/* KLİP ÖNİZLEME MODALI */}
      {previewMaterial && (
        <div
          onClick={() => setPreviewMaterial(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              background: 'var(--ads-card-bg)',
              borderRadius: '16px',
              border: '1px solid var(--ads-border-strong)',
              boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--ads-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Film size={16} color="var(--ads-brand)" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--ads-text-main)', wordBreak: 'break-word' }}>
                    {previewMaterial.clipName || previewMaterial.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                    {previewMaterial.name} • Kod: {previewMaterial.code || previewMaterial.id} • Süre: {previewMaterial.duration || 0} sn
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMaterial(null)}
                className="ads-saas-btn ads-saas-btn-sm"
              >
                <X size={15} /> Kapat
              </button>
            </div>
            <div style={{ padding: '18px' }}>
              <AdVideoPlayer material={previewMaterial} autoPlay={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SponsorshipsTab);

