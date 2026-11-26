/**
 * @file src/components/Ads/AdsAlgorithmTab.jsx
 * @description Reklam Rezervasyon Modülü — Dinamik Reklam Yerleştirme Algoritması Yapılandırma ve Kural Yönetimi Sekmesi.
 */
import React from 'react';
import {
  Cpu,
  Sliders,
  ShieldCheck,
  Clock,
  Layers,
  Shuffle,
  CheckCircle2,
  RotateCcw,
  Award,
  Zap
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import { dialog } from '../../store/dialogStore';
import { DEFAULT_ADS_AUTO_FILL_SETTINGS } from '../../store/slices/ads/adsCatalogHelpers';

const AdsAlgorithmTab = () => {
  const adsAutoFillSettings = usePlanningStore(state => state.adsAutoFillSettings || DEFAULT_ADS_AUTO_FILL_SETTINGS);
  const updateAdsAutoFillSettings = usePlanningStore(state => state.updateAdsAutoFillSettings);
  const reservations = usePlanningStore(state => state.reservations || []);
  const timeBlocks = usePlanningStore(state => state.timeBlocks || []);

  const cfg = {
    ...DEFAULT_ADS_AUTO_FILL_SETTINGS,
    ...adsAutoFillSettings
  };

  const handleUpdate = (updates) => {
    if (typeof updateAdsAutoFillSettings === 'function') {
      updateAdsAutoFillSettings(updates);
    }
  };

  const handleResetDefaults = () => {
    handleUpdate(DEFAULT_ADS_AUTO_FILL_SETTINGS);
    dialog.success(
      'Algoritma Varsayılanlara Döndürüldü',
      'Reklam yerleştirme algoritması tüm dinamik parametreleriyle fabrika ayarlarına sıfırlandı.'
    );
  };

  const fixedBlockResCount = reservations.filter(r => {
    const items = Array.isArray(r?.items) && r.items.length > 0 ? r.items : [r];
    return items.some(it => it?.timeBlockSpotCounts && Object.values(it.timeBlockSpotCounts).some(v => Number(v) > 0));
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      {/* ÜST BAŞLIK KARTI */}
      <div
        className="ads-saas-card"
        style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderLeft: '5px solid var(--turkuaz, #0C617C)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(12, 97, 124, 0.12)',
              color: 'var(--turkuaz, #0C617C)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Cpu size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
              Reklam Yerleştirme Algoritması &amp; Dinamik Kural Motoru
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--ads-text-sub)' }}>
              Hem <strong>Yayın Planlama (Ready)</strong> aşamasındaki <em>"Reklamları Yerleştir"</em> adımında hem de <strong>Reklam Rezervasyon</strong> otomatik planlamasında çalışan dinamik algoritma kurallarını buradan yönetebilirsiniz.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="ads-saas-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
        >
          <RotateCcw size={14} />
          <span>Varsayılan Algoritma Ayarlarına Dön</span>
        </button>
      </div>

      {/* ALGORİTMA ÖNCELİK SIRASI (6 AŞAMALI PİPELİNE ÖZETİ) */}
      <div className="ads-saas-card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Zap size={17} color="#d97706" />
          <span style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
            Algoritma Çalışma Sırası (6 Katmanlı Dinamik Yerleştirme)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {[
            {
              step: '1. Katman',
              title: 'RTÜK Giriş / Çıkış Jenerik Kilidi',
              desc: 'Kuşak önündeki programın kategorisine göre Reklam Giriş (1. sıra) ve Reklam Çıkış (son sıra) jeneriklerini otomatik ayırır.',
              color: '#0C617C'
            },
            {
              step: '2. Katman',
              title: 'Program Sponsorlukları & Tekil Roller',
              desc: 'Sunar (Son Sıra), Devam Edecek (İlk Sıra), Devam Ediyor (Son Sıra), Sundu (İlk Sıra) ve Öncesi/Arası/Sonrası sponsorluklarını yerleştirir.',
              color: '#9333ea'
            },
            {
              step: '3. Katman',
              title: 'Kuşak Bazlı Sabit Spot Adedi Kilidi',
              desc: `Rezervasyonda "Sabah Kuşağı: 2 kez" gibi sabit adet girildiyse Min/Max'ı devre dışı bırakıp ilgili kuşakta tam o sayıda yerleştirir (${fixedBlockResCount} aktif rezervasyon).`,
              color: '#d97706'
            },
            {
              step: '4. Katman',
              title: 'Günlük Minimum Spot Garantisi',
              desc: 'Sabit kuşak sayısı girilmeyen rezervasyonların Günlük Min Spot alt sınırını homojen aralıklarla garanti altına alır.',
              color: '#0284c7'
            },
            {
              step: '5. Katman',
              title: 'Dinamik Kota & Kuşak Taban Süresi',
              desc: 'Seçtiğiniz Kota Dağılım Stratejisine (Akıllı Ortalama / Min+Taban / Max\'a Kadar) göre kuşakları dengeli doldurur.',
              color: '#16a34a'
            },
            {
              step: '6. Katman',
              title: 'Firma Ayrıştırma & Ardışık Kuşak Koruması',
              desc: 'Aynı kuşak içinde aynı firmanın iki reklamının peş peşe gelmesini önler ve kuşaklar arası boşluk kuralını uygular.',
              color: '#dc2626'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                borderLeft: `4px solid ${item.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 900, color: item.color, textTransform: 'uppercase' }}>
                  {item.step}
                </span>
                <CheckCircle2 size={14} color={item.color} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', lineHeight: 1.45 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DİNAMİK ALGORİTMA PARAMETRELERİ GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '18px' }}>
        {/* 1. KOTA VE GÜNLÜK HEDEF STRATEJİSİ */}
        <div className="ads-saas-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={17} color="var(--turkuaz, #0C617C)" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
              1. Günlük Spot &amp; Kota Dağılım Stratejisi
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--ads-text-sub)' }}>
            Kuşak bazlı sabit spot adedi girilmemiş (Min ve Max spot aralığı kullanan) rezervasyonların günlük kaç kez yayınlanacağını belirler:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                id: 'smart_pacing',
                title: 'Akıllı Ortalama Kampanya Dağılımı (Önerilen)',
                desc: 'Kalan toplam spotu kampanya bitiş tarihine kadar kalan günlere ve öncelik seviyesine böler (Min ≤ Hedef < Max). Her reklamı her gün direkt Max spota dayamaz.'
              },
              {
                id: 'min_plus_2min',
                title: 'Önce Günlük Min Spot + Kuşak Taban Süresi Garantisi',
                desc: 'Önce her reklamın Günlük Min Spotunu yerleştirir; yalnızca taban doluluk süresinin altında kalan kuşaklara ek spot atar.'
              },
              {
                id: 'up_to_max',
                title: 'Kuşakları Günlük Max Spot Sınırına Kadar Doldur',
                desc: 'Kuşaklarda süre kapasitesi oldukça rezervasyonları Günlük Max Spot sınırına kadar maksimum yoğunlukta yerleştirir.'
              }
            ].map(opt => {
              const isSelected = cfg.quotaStrategy === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleUpdate({ quotaStrategy: opt.id })}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--turkuaz, #0C617C)' : '1px solid var(--ads-border)',
                    background: isSelected ? 'rgba(12, 97, 124, 0.08)' : 'var(--ads-card-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? 'var(--turkuaz, #0C617C)' : 'var(--ads-text-main)' }}>
                      {opt.title}
                    </span>
                    <input type="radio" checked={isSelected} readOnly style={{ accentColor: 'var(--turkuaz, #0C617C)' }} />
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', lineHeight: 1.4 }}>
                    {opt.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. KUŞAK İÇİ TEKİLLİK VE FİRMA ÇAKIŞMA KURALI */}
        <div className="ads-saas-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={17} color="#16a34a" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
              2. Kuşak İçi Tekrar Önleme &amp; Firma Tekilliği Kuralı
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--ads-text-sub)' }}>
            Tek bir reklam kuşağı içinde aynı klibin veya aynı firmanın birden fazla kez yer alıp alamayacağını belirler:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                id: 'same_clip',
                title: 'Aynı Reklam Klibi Aynı Kuşağa Giremez (Standart)',
                desc: 'Bir reklam klibi aynı reklam kuşağında en fazla 1 kez yayınlanır. Aynı firmanın farklı ürünleri varsa aralarına başka firma girerek yerleşebilir.'
              },
              {
                id: 'same_company',
                title: 'Aynı Firma Aynı Kuşağa Birden Fazla Giremez (Katı Firma Koruması)',
                desc: 'Bir reklam kuşağına aynı firmaya ait (farklı ürün olsa bile) yalnızca 1 adet reklam spotu girebilir.'
              },
              {
                id: 'none',
                title: 'Kuşak İçi Tekrar Kısıtlaması Yok (Esnek)',
                desc: 'Kuşak kapasitesi dolana kadar aynı firma veya klip kısıtlaması uygulanmaz (yine de aynı firma peş peşe getirilmez).'
              }
            ].map(opt => {
              const isSelected = cfg.uniquenessRule === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleUpdate({ uniquenessRule: opt.id })}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #16a34a' : '1px solid var(--ads-border)',
                    background: isSelected ? 'rgba(22, 163, 74, 0.08)' : 'var(--ads-card-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#15803d' : 'var(--ads-text-main)' }}>
                      {opt.title}
                    </span>
                    <input type="radio" checked={isSelected} readOnly style={{ accentColor: '#16a34a' }} />
                  </div>
                  <span style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', lineHeight: 1.4 }}>
                    {opt.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. KUŞAKLAR ARASI BOŞLUK (ARDIŞIK KUŞAK YASAĞI) & TABAN DOLULUK SÜRESİ */}
        <div className="ads-saas-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={17} color="#d97706" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
              3. Ardışık Kuşak Aralığı &amp; Kuşak Taban Süresi
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--ads-text-main)', marginBottom: '6px' }}>
              Aynı Reklam İçin Kuşaklar Arası Minimum Boşluk (Ardışık Kuşak Kuralı):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { val: 0, label: '0 Kuşak (Serbest)', desc: 'Peş peşe kuşaklara girebilir' },
                { val: 1, label: 'En Az 1 Kuşak Ara', desc: 'Ardışık kuşağa giremez' },
                { val: 2, label: 'En Az 2 Kuşak Ara', desc: '2 kuşak boşluk bırakır' },
                { val: 3, label: 'En Az 3 Kuşak Ara', desc: 'Geniş aralıklı yayılım' }
              ].map(g => {
                const isSelected = Number(cfg.minBreakGap ?? 1) === g.val;
                return (
                  <button
                    key={g.val}
                    type="button"
                    onClick={() => handleUpdate({ minBreakGap: g.val })}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '9px',
                      border: isSelected ? '2px solid #d97706' : '1px solid var(--ads-border)',
                      background: isSelected ? 'rgba(217, 119, 6, 0.12)' : 'var(--ads-card-subtle)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800, color: isSelected ? '#b45309' : 'var(--ads-text-main)' }}>
                      {g.label}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--ads-text-muted)' }}>{g.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--ads-text-main)', marginBottom: '6px' }}>
              Kuşak Başına Hedeflenen En Az Taban Doluluk Süresi:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {[
                { sec: 60, label: '1 Dakika (60 sn)' },
                { sec: 120, label: '2 Dakika (120 sn)' },
                { sec: 180, label: '3 Dakika (180 sn)' },
                { sec: 240, label: '4 Dakika (240 sn)' },
                { sec: 300, label: '5 Dakika (300 sn)' }
              ].map(t => {
                const isSelected = Number(cfg.minBreakFillSec ?? 120) === t.sec;
                return (
                  <button
                    key={t.sec}
                    type="button"
                    onClick={() => handleUpdate({ minBreakFillSec: t.sec })}
                    style={{
                      padding: '9px 6px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--turkuaz, #0C617C)' : '1px solid var(--ads-border)',
                      background: isSelected ? 'rgba(12, 97, 124, 0.12)' : 'var(--ads-card-subtle)',
                      color: isSelected ? 'var(--turkuaz, #0C617C)' : 'var(--ads-text-main)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. ZAMAN DİLİMİ KİLİDİ VE ROTASYON / VARYASYON AYARLARI */}
        <div className="ads-saas-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shuffle size={17} color="#7c3aed" />
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
              4. Yayın Kuşağı Sadakati &amp; Dinamik Sıra Rotasyonu
            </span>
          </div>

          <label
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--ads-border)',
              background: 'var(--ads-card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: 'pointer'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
                Katı Yayın Kuşağı Sadakati ({timeBlocks.map(t => t.name).join(', ')})
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', marginTop: '2px' }}>
                Aktif olduğunda reklamlar yalnızca rezervasyon kartında seçilen yayın kuşaklarına girer; seçilmeyen saat dilimine taşmaz.
              </div>
            </div>
            <input
              type="checkbox"
              checked={cfg.strictTimeBlocks !== false}
              onChange={e => handleUpdate({ strictTimeBlocks: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--turkuaz, #0C617C)' }}
            />
          </label>

          <label
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid var(--ads-border)',
              background: 'var(--ads-card-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: 'pointer'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ads-text-main)' }}>
                Kuşaklar ve Günler Arası Dinamik Sıra Rotasyonu
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ads-text-sub)', marginTop: '2px' }}>
                Aynı öncelikteki reklamların her kuşakta birebir aynı sırada dizilmesini önler; adil rotasyon uygular.
              </div>
            </div>
            <input
              type="checkbox"
              checked={cfg.varyOrderAcrossBreaks !== false}
              onChange={e => handleUpdate({ varyOrderAcrossBreaks: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: '#7c3aed' }}
            />
          </label>

          <div
            style={{
              padding: '11px 14px',
              borderRadius: '10px',
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.3)',
              fontSize: '12px',
              color: '#92400e',
              lineHeight: 1.45
            }}
          >
            <strong>Sabit Kuşak Adedi Kuralı:</strong> Rezervasyon oluştururken herhangi bir kuşak için (ör. <em>Sabah Kuşağı: 3 kez</em>) sayı girildiğinde, o reklam için Günlük Min ve Max Spot sınırları devre dışı kalır ve algoritma o reklamı ilgili kuşakta tam girilen sayıda sabit tutar.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdsAlgorithmTab;
