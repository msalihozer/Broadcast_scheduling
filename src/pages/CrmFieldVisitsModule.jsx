/**
 * @file src/pages/CrmFieldVisitsModule.jsx
 * @description Kurumsal Satış, Saha Ziyaretleri & Firma Görüşmeleri (CRM) Modülü.
 * Reklam rezervasyonu öncesinde firmalarla yapılan yüz yüze / saha görüşmeleri,
 * randevu takibi, teklif yönetimi ve medya satış hattı için "Yapım Aşamasında" tanıtım ekranı.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarCheck2,
  FileSpreadsheet,
  Handshake,
  MapPin,
  PhoneCall,
  Briefcase,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import TopNavbar from '../components/Layout/TopNavbar';
import Ikon from '../components/Ikon';

const CRM_PLANNED_CAPABILITIES = [
  {
    id: 'field-visits',
    icon: MapPin,
    title: 'Saha Ziyaretleri & Firma Görüşme Planı',
    desc: 'Reklam veren firmalara yapılacak saha ziyaretlerini, görüşme adreslerini, katılımcıları ve ziyaret takvimini bölgesel olarak planlama.'
  },
  {
    id: 'meeting-notes',
    icon: Handshake,
    title: 'Müşteri Görüşme Tutanakları & Talepler',
    desc: 'Firma yetkilileriyle yapılan görüşme notları, talep edilen kuşaklar (Sabah / Prime Time / Sponsorluk), bütçe beklentileri ve takip hatırlatıcıları.'
  },
  {
    id: 'proposals',
    icon: FileSpreadsheet,
    title: 'Medya Planlama Teklifi & Sözleşme Hattı',
    desc: 'Görüşme sonrası firmaya sunulan spot paketi teklifleri, revize geçmişi ve onaylanan teklifin tek tıkla Reklam Rezervasyon modülüne aktarımı.'
  },
  {
    id: 'portfolio',
    icon: Building2,
    title: 'Reklamveren Portföy & Ajans İlişkileri (CRM)',
    desc: 'Aktif, potansiyel ve geçmiş reklamveren firmaların iletişim kişileri, sektörel dağılımları ve yıllık kampanya sadakat analizleri.'
  },
  {
    id: 'appointments',
    icon: CalendarCheck2,
    title: 'Satış Temsilcisi Randevu & Görev Takvimi',
    desc: 'Kurumsal satış ekibinin günlük/haftalık firma ziyareti ajandası, telefon/online toplantı kayıtları ve geri dönüş bildirimleri.'
  },
  {
    id: 'call-logs',
    icon: PhoneCall,
    title: 'Görüşme Durum & Dönüşüm Raporları',
    desc: 'İlk temastan sözleşme onayına ve yayına geçişe kadar satış hunisi (pipeline) dönüşüm oranları ve temsilci performans özetleri.'
  }
];

export default function CrmFieldVisitsModule() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100dvh',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary, #F5F7F6)',
        color: 'var(--text-primary, #0A101D)',
        overflow: 'hidden'
      }}
    >
      <TopNavbar />

      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 24px 48px',
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px'
        }}
      >
        {/* ÜST BREADCRUMB & HIZLI GEÇİŞ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={() => navigate('/')}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #DCE5E9)',
              background: '#FFFFFF',
              color: 'var(--text-primary, #0A101D)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <ArrowLeft size={15} />
            <span>Ana Portala Dön</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/ads')}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              border: '1px solid #0C617C',
              background: '#0C617C',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px'
            }}
          >
            <span>Reklam Rezervasyon Modülüne Geç</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* ANA TANITIM KARTI — YAPIM AŞAMASINDA */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1.5px solid var(--border-color, #DCE5E9)',
            borderRadius: '14px',
            padding: '28px',
            boxShadow: '0 8px 24px rgba(10, 16, 29, 0.05)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', maxWidth: '780px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  background: '#6D28D9',
                  color: '#FFFFFF',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: '0 8px 18px rgba(109, 40, 217, 0.25)'
                }}
              >
                <Briefcase size={28} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h1
                    style={{
                      margin: 0,
                      fontSize: '23px',
                      fontWeight: 800,
                      color: 'var(--text-primary, #0A101D)',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    Kurumsal Satış & Firma Görüşmeleri (CRM)
                  </h1>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 11px',
                      borderRadius: '999px',
                      background: '#FEF3C7',
                      color: '#B45309',
                      border: '1px solid #F59E0B',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      letterSpacing: '0.03em'
                    }}
                  >
                    <Clock size={13} />
                    YAPIM AŞAMASINDA
                  </span>
                </div>

                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary, #4B6478)'
                  }}
                >
                  Reklam rezervasyonu öncesinde firmalarla ve medya ajanslarıyla yapılan saha ziyaretlerini,
                  müşteri görüşme notlarını, sponsorluk/spot paketi tekliflerini ve sözleşme onay süreçlerini
                  uçtan uca yönetecek <b>Kurumsal Satış & Saha Ziyaretleri (CRM)</b> modülü şu anda yapım aşamasındadır.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '14px 18px',
                borderRadius: '10px',
                background: '#F5F3FF',
                border: '1px solid #DDD6FE',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: '230px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase' }}>
                MODÜL ENTEGRASYONU
              </span>
              <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1E1B4B' }}>
                Saha Görüşmesi → Teklif → Rezervasyon
              </span>
              <span style={{ fontSize: '11.5px', color: '#5B21B6' }}>
                Onaylanan görüşmeler doğrudan Reklam Rezervasyon modülüne aktarılacaktır.
              </span>
            </div>
          </div>
        </div>

        {/* PLANLANAN ALT BİLEŞENLER (6 KART) */}
        <div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 800,
              color: 'var(--text-secondary, #4B6478)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px'
            }}
          >
            Modül Kapsamında Yer Alacak Özellikler
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '14px'
            }}
          >
            {CRM_PLANNED_CAPABILITIES.map(item => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid var(--border-color, #DCE5E9)',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: '#F5F3FF',
                      color: '#6D28D9',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}
                  >
                    <IconComp size={20} />
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 800,
                        color: 'var(--text-primary, #0A101D)',
                        marginBottom: '5px'
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-secondary, #4B6478)',
                        lineHeight: 1.55
                      }}
                    >
                      {item.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ALT BİLGİ ŞERİDİ */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '10px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={18} color="#059669" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#065F46' }}>
              Mevcut firma, marka ve ürün kayıtlarınızı şu anda Reklam Rezervasyon modülündeki &ldquo;Firmalar&rdquo; ve &ldquo;Marka / Ürün&rdquo; sekmelerinden yönetebilirsiniz.
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/ads')}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #059669',
              background: '#059669',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Firmalar & Rezervasyonlara Git
          </button>
        </div>
      </main>
    </div>
  );
}
