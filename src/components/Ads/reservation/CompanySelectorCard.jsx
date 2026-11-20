/**
 * @file src/components/Ads/reservation/CompanySelectorCard.jsx
 * @description Reklam Rezervasyon Formu 1. Bölümü: İlk Harften Başlayan Öncelikli (Prefix-First)
 * ve Sınırsız Liste Destekli Reklamveren Firma Seçici (Combobox) & Kampanya Başlığı Kartı.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, Search, X, ChevronDown, Check } from 'lucide-react';
import { filterAndSortPrefixFirst } from './reservationConstants';

const TR_ALPHABET_LETTERS = [
  'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H', 'I', 'İ',
  'J', 'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş',
  'T', 'U', 'Ü', 'V', 'Y', 'Z'
];

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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('ALL');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyComboboxRef = useRef(null);
  const searchInputRef = useRef(null);

  // Dışarı tıklandığında firma arama listesini kapat ve arama metnini sıfırla
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (companyComboboxRef.current && !companyComboboxRef.current.contains(e.target)) {
        setIsCompanyDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // İlk harften başlayan öncelikli ve sınırsız firma filtreleme algoritması
  const filteredCompaniesForCombobox = useMemo(() => {
    const q = String(searchQuery || '').trim();

    if (q) {
      return filterAndSortPrefixFirst(
        sortedCompanies,
        q,
        c => c?.name || '',
        c => c?.contactPerson || ''
      );
    }

    if (selectedLetter !== 'ALL') {
      return filterAndSortPrefixFirst(
        sortedCompanies,
        selectedLetter,
        c => c?.name || ''
      );
    }

    return sortedCompanies;
  }, [sortedCompanies, searchQuery, selectedLetter]);

  const handleChoose = (companyId) => {
    setSearchQuery('');
    setSelectedLetter('ALL');
    setIsCompanyDropdownOpen(false);
    onSelectCompany(companyId);
  };

  const displayInputValue = isCompanyDropdownOpen
    ? searchQuery
    : (selectedCompanyObj?.name || '');

  return (
    <div className="ads-saas-card" style={{ padding: '18px', gap: '14px', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Building2 size={17} color="var(--ads-brand)" />
          <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            1. Reklamveren Firma &amp; Öncelik Bilgisi
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--ads-text-muted)',
              background: 'var(--ads-pill-bar-bg)',
              padding: '2px 8px',
              borderRadius: '999px'
            }}
          >
            Toplam {sortedCompanies.length} Kayıtlı Firma
          </span>
        </div>
        {selectedCompanyObj && (
          <span className="ads-saas-chip active" style={{ cursor: 'default' }}>
            Seçili: {selectedCompanyObj.name} • {companyProductsCount} Kayıtlı Ürün • {companyMaterialsCount} Klip Bulundu
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '14px' }}>
        {/* YAZILABİLİR / ARANABİLİR FİRMA SEÇİM ALANI (İLK HARFTEN BAŞLAYAN ÖNCELİKLİ COMBOBOX) */}
        <div ref={companyComboboxRef} style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '6px' }}>
            Reklamveren Firma Seçimi (İlk Harften Yazarak Arayın veya Listeden Seçin) *
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={15}
              color="var(--ads-brand)"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={displayInputValue}
              onFocus={() => {
                setIsCompanyDropdownOpen(true);
                setSearchQuery('');
              }}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedLetter('ALL');
                setIsCompanyDropdownOpen(true);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsCompanyDropdownOpen(false);
                  setSearchQuery('');
                } else if (e.key === 'Enter' && isCompanyDropdownOpen && filteredCompaniesForCombobox.length > 0) {
                  e.preventDefault();
                  handleChoose(filteredCompaniesForCombobox[0].id);
                }
              }}
              placeholder={
                selectedCompanyObj
                  ? `${selectedCompanyObj.name} (İlk harften yazarak arayın: S, Semerkand, Beşir...)`
                  : 'Firma adını ilk harften yazarak arayın (Örn: S, Semerkand, Beşir, Nakış...)'
              }
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
              {(searchQuery || isCompanyDropdownOpen) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLetter('ALL');
                    setIsCompanyDropdownOpen(true);
                    searchInputRef.current?.focus();
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
                onClick={() => {
                  setIsCompanyDropdownOpen(prev => {
                    const next = !prev;
                    if (next) {
                      setSearchQuery('');
                      setTimeout(() => searchInputRef.current?.focus(), 10);
                    }
                    return next;
                  });
                }}
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
                maxHeight: '380px',
                background: 'var(--ads-card-bg)',
                border: '1.5px solid var(--ads-brand)',
                borderRadius: '12px',
                boxShadow: '0 16px 36px rgba(15, 23, 42, 0.25)',
                zIndex: 80,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              {/* Üst Bilgi ve Eşleşen Firma Sayısı */}
              <div
                style={{
                  padding: '2px 8px 6px 8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'var(--ads-text-muted)',
                  borderBottom: '1px solid var(--ads-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}
              >
                <span style={{ color: 'var(--ads-brand)' }}>
                  {searchQuery
                    ? `"${searchQuery}" İLE BAŞLAYAN / EŞLEŞEN: ${filteredCompaniesForCombobox.length} FİRMA`
                    : selectedLetter !== 'ALL'
                    ? `"${selectedLetter}" HARFİ İLE BAŞLAYAN: ${filteredCompaniesForCombobox.length} FİRMA`
                    : `TÜM FİRMALAR LİSTELENİYOR (${sortedCompanies.length} FİRMA — SINIRSIZ)`}
                </span>
                <span>İlk harften yazın veya harf seçin</span>
              </div>

              {/* A-Z Hızlı Harf Filtresi */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '3px',
                  padding: '2px 4px 6px 4px',
                  borderBottom: '1px solid var(--ads-border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLetter('ALL');
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    border: 'none',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    background: selectedLetter === 'ALL' && !searchQuery ? 'var(--ads-brand)' : 'var(--ads-pill-bar-bg)',
                    color: selectedLetter === 'ALL' && !searchQuery ? '#fff' : 'var(--ads-text-sub)'
                  }}
                >
                  Tümü ({sortedCompanies.length})
                </button>
                {TR_ALPHABET_LETTERS.map(letter => {
                  const isActive =
                    (selectedLetter === letter && !searchQuery) ||
                    (searchQuery.trim().toLocaleUpperCase('tr-TR') === letter);
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => {
                        setSelectedLetter(letter);
                        setSearchQuery('');
                      }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '5px',
                        border: 'none',
                        fontSize: '10.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        background: isActive ? 'var(--ads-brand)' : 'var(--ads-pill-bar-bg)',
                        color: isActive ? '#fff' : 'var(--ads-text-sub)'
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Kaydırılabilir Tam Firma Listesi (Hiçbir Sınır Yok) */}
              <div
                style={{
                  overflowY: 'auto',
                  maxHeight: '275px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  paddingRight: '2px'
                }}
              >
                {filteredCompaniesForCombobox.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--ads-text-muted)' }}>
                    &quot;{searchQuery || selectedLetter}&quot; ile başlayan veya eşleşen firma bulunamadı.
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
                          fontWeight: isCurrent ? '800' : '600',
                          flexShrink: 0
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isCurrent && <Check size={13} color="var(--ads-brand)" />}
                          <span>{c.name}</span>
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            color: isCurrent ? 'var(--ads-brand)' : 'var(--ads-text-muted)',
                            background: 'var(--ads-pill-bar-bg)',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            flexShrink: 0
                          }}
                        >
                          {c.productCount || 1} Ürün • {c.materialCount || 0} Klip
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
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
