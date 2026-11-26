/**
 * @file src/components/Ads/AdsBannerAdsTab.jsx
 * @description Reklam Rezervasyon Modülü — Bant Reklamlar (Alt Bant / L-Bant / Şerit Reklam) Sekmesi.
 */
import React from 'react';
import { Layers, Clock, Tv, CheckCircle2 } from 'lucide-react';

const AdsBannerAdsTab = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' }}>
      <div
        className="ads-saas-card"
        style={{
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '16px',
          borderTop: '5px solid var(--hardal, #E8B44C)'
        }}
      >
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '16px',
            background: 'rgba(232, 180, 76, 0.18)',
            border: '1.5px solid rgba(217, 119, 6, 0.35)',
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Layers size={34} />
        </div>

        <span
          style={{
            padding: '4px 14px',
            borderRadius: '999px',
            background: 'rgba(217, 119, 6, 0.14)',
            color: '#b45309',
            fontSize: '12px',
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}
        >
          YAKINDA TAMAMLANACAK
        </span>

        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: 'var(--ads-text-main)' }}>
          Bant Reklamlar &amp; Program İçi Alt Bant Planlama Modülü
        </h2>

        <p style={{ margin: 0, maxWidth: '640px', fontSize: '14px', color: 'var(--ads-text-sub)', lineHeight: 1.6 }}>
          Program akışı devam ederken ekranın alt veya kenar bandında yayınlanacak <strong>Alt Bant, L-Bant ve Sanal Grafikler</strong> için rezervasyon, program içi dakika/saniye tetikleme ve otomatik yerleştirme alanı yapım aşamasındadır. Yakında tamamlanacaktır.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            width: '100%',
            maxWidth: '820px',
            marginTop: '10px',
            textAlign: 'left'
          }}
        >
          {[
            {
              icon: <Tv size={17} color="#0C617C" />,
              title: 'Program İçi Bant Rezervasyonu',
              desc: 'Belirli programların veya canlı yayınların içine hedef dakika aralıklı alt bant reklam tanımlama.'
            },
            {
              icon: <Clock size={17} color="#d97706" />,
              title: 'Otomatik Zamanlama & Frekans',
              desc: 'Program başlangıcından itibaren kaçıncı dakikada ve kaç saniye süreyle ekranda kalacağının planlanması.'
            },
            {
              icon: <CheckCircle2 size={17} color="#16a34a" />,
              title: 'Yayın Liste Kontrol & MCR Entegrasyonu',
              desc: 'Planlanan bant reklamların grafik/CG tetikleme kodlarıyla nihai yayın kontrol listesine aktarılması.'
            }
          ].map((feat, idx) => (
            <div
              key={idx}
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '13px', color: 'var(--ads-text-main)' }}>
                {feat.icon}
                <span>{feat.title}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ads-text-sub)', lineHeight: 1.45 }}>
                {feat.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdsBannerAdsTab;
