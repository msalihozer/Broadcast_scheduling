/**
 * @file src/components/Ads/reservation/CompanySelectorCard.jsx
 * @description Reklam Rezervasyon Formu 1. Bölümü: Yazılabilir & Aranabilir Reklamveren Firma Seçici (Combobox) ve Kampanya Başlığı Kartı.
 *
 * Kullanıcı bu kart üzerinden 800+ reklamveren firma arasında anlık metin araması yaparak firma seçebilir
 * ve isteğe bağlı genel bir kampanya/plan başlığı tanımlayabilir.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, Search, X, ChevronDown } from 'lucide-react';

const CompanySelectorCard = ({
  companies = [],
  selectedCompanyId,
  selectedCompanyObj,
  companyProductsCount = 0,
  companyMaterialsCount = 0,
  campaignName = '',
  onChangeCampaignName,
  onSelectCompany
}) => {
  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  const [companySearchQuery, setCompanySearchQuery] = useState(
    () => selectedCompanyObj?.name || ''
  );
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyComboboxRef = useRef(null);

  useEffect(() => {
    if (selectedCompanyObj && !isCompanyDropdownOpen) {
      setCompanySearchQuery(selectedCompanyObj.name);
    }
  }, [selectedCompanyObj, isCompanyDropdownOpen]);

  // Dışarı tıklandığında firma arama listesini kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (companyComboboxRef.current && !companyComboboxRef.current.contains(e.target)) {
        setIsCompanyDropdownOpen(false);
        if (selectedCompanyObj) {
          setCompanySearchQuery(selectedCompanyObj.name);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedCompanyObj]);

  const filteredCompaniesForCombobox = useMemo(() => {
    const q = String(companySearchQuery || '').trim().toLocaleLowerCase('tr-TR');
    if (
      !q ||
      (selectedCompanyObj && q === String(selectedCompanyObj.name || '').toLocaleLowerCase('tr-TR'))
    ) {
      return sortedCompanies.slice(0, 120);
    }
    return sortedCompanies
      .filter(c => (c.name || '').toLocaleLowerCase('tr-TR').includes(q))
      .slice(0, 120);
  }, [sortedCompanies, companySearchQuery, selectedCompanyObj]);

  const handleChoose = (companyId) => {
    const chosen = companies.find(c => String(c.id) === String(companyId));
    if (chosen) {
      setCompanySearchQuery(chosen.name);
    }
    setIsCompanyDropdownOpen(false);
    onSelectCompany(companyId);
  };

  return (
    <div className="ads-saas-card" style={{ padding: '18px', gap: '14px', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={17} color="var(--ads-brand)" />
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            1. Reklamveren Firma &amp; Öncelik Bilgisi
          </span>
        </div>
        {selectedCompanyObj && (
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            {companyProductsCount} Kayıtlı Ürün • {companyMaterialsCount} Klip Bulundu
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '14px' }}>
        {/* YAZILABİLİR / ARANABİLİR FİRMA SEÇİM ALANI (COMBOBOX) */}
        <div ref={companyComboboxRef} style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '6px' }}>
            Reklamveren Firma Seçimi (Yazarak Arayın veya Seçin) *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={15}
              color="var(--ads-brand)"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
            />
            <input
              type="text"
              value={companySearchQuery}
              onFocus={() => setIsCompanyDropdownOpen(true)}
              onChange={e => {
                setCompanySearchQuery(e.target.value);
                setIsCompanyDropdownOpen(true);
              }}
              placeholder="Firma adı yazarak arayın (Örn: Kavaköy, Semerkand, Montex...)"
              className="ads-saas-input"
              style={{
                width: '100%',
                height: '40px',
                paddingLeft: '36px',
                paddingRight: '64px',
                fontWeight: '800',
                fontSize: '13px',
                borderColor: isCompanyDropdownOpen ? 'var(--ads-brand)' : undefined
              }}
            />

            <div
              style={{
                position: 'absolute',
                right: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {companySearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setCompanySearchQuery('');
                    setIsCompanyDropdownOpen(true);
                  }}
                  title="Aramayı Temizle ve Tüm Firmaları Gör"
                  style={{
                    background: 'var(--ads-pill-bar-bg)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '22px',
                    height: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--ads-text-muted)'
                  }}
                >
                  <X size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCompanyDropdownOpen(prev => !prev)}
                title="Firma Listesini Aç / Kapat"
                style={{
                  background: 'transparent',
                  border: 'none',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--ads-text-sub)'
                }}
              >
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {isCompanyDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                maxHeight: '280px',
                overflowY: 'auto',
                background: 'var(--ads-card-bg)',
                border: '1.5px solid var(--ads-brand)',
                borderRadius: '12px',
                boxShadow: '0 16px 36px rgba(15, 23, 42, 0.22)',
                zIndex: 50,
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}
            >
              <div
                style={{
                  padding: '4px 10px 6px 10px',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  color: 'var(--ads-text-muted)',
                  borderBottom: '1px solid var(--ads-border)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>FİRMA SEÇİN ({sortedCompanies.length} Toplam Firma)</span>
                <span>Yazarak filtreleyebilirsiniz</span>
              </div>

              {filteredCompaniesForCombobox.length === 0 ? (
                <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--ads-text-muted)' }}>
                  &quot;{companySearchQuery}&quot; aramasına uygun firma bulunamadı.
                </div>
              ) : (
                filteredCompaniesForCombobox.map(c => {
                  const isCurrent = String(c.id) === String(selectedCompanyId);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleChoose(c.id)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isCurrent ? 'var(--ads-brand-soft)' : 'transparent',
                        color: isCurrent ? 'var(--ads-brand)' : 'var(--ads-text-main)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        fontSize: '12.5px',
                        fontWeight: isCurrent ? '800' : '600'
                      }}
                    >
                      <span>{c.name}</span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: '700',
                          color: isCurrent ? 'var(--ads-brand)' : 'var(--ads-text-muted)',
                          background: 'var(--ads-pill-bar-bg)',
                          padding: '2px 7px',
                          borderRadius: '999px'
                        }}
                      >
                        {c.productCount || 1} Ürün • {c.materialCount || 1} Klip
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '6px' }}>
            Kampanya / Plan Başlığı (İsteğe Bağlı)
          </label>
          <input
            type="text"
            value={campaignName}
            onChange={e => onChangeCampaignName(e.target.value)}
            placeholder="Örn: Kış Dönemi Çoklu Ürün & Sponsorluk Planı"
            className="ads-saas-input"
            style={{ width: '100%', height: '40px' }}
          />
        </div>
      </div>
    </div>
  );
};

export default CompanySelectorCard;

