/**
 * @file src/components/Ads/reservation/ClipReservationCard.jsx
 * @description Tekil Reklam / Klip Planı Kartı (`Reklam / Klip Planı #1, #2...`).
 *
 * Her klip kartı tamamen bağımsız bir reklam rezervasyonu gibi çalışır ve şu bölümleri barındırır:
 * 1. Ürün / Marka ve Reklam Materyali (Spot Klip) seçimi + Tam Klip Adı gösterimi ve "Klibi İzle" butonu.
 * 2. Bu klip için Yayın Öncelik Seviyesi (Zorunlu 1000, Yüksek 700, Normal 400, Dolgu 100).
 * 3. Başlangıç Tarihi, Bitiş Tarihi, Günlük Minimum ve Maksimum Spot sınırları.
 * 4. 3 Seçenekli Esnek Spot & Fiyatlandırma Hesaplayıcısı (Sadece Spot Adedi / Spot Ücreti İle / Toplam Tutar İle).
 * 5. Bu klip için Yayınlanacağı Kanal (`Semerkand HD`, `Semerkand WAY`) ve Yayın Kuşakları (`Sabah`, `Öğle`, `Akşam`, `Gece`).
 * 6. Bu klip için 2 Kısımlı Program Sponsorluğu Yapılandırması:
 *    - 1. Kısım: `Program Öncesi`, `Program Arası`, `Program Sonrası` (Çoklu Olabilir)
 *    - 2. Kısım: `Program Öncesi (Sunar)`, `Program Arası (Devam Edecek)`, `Program Arası (Devam Ediyor)`, `Program Sonrası (Sundu)` (Tekil & İlk/Son Sıra Kilitli)
 */
import React from 'react';
import {
  Trash2,
  Clock,
  Tv,
  Award,
  Search,
  Wallet,
  Check,
  Play,
  Film
} from 'lucide-react';
import {
  SPONSOR_FLOW_POSITIONS,
  SPONSOR_BUMPER_ROLES,
  PRIORITY_OPTIONS,
  PRICING_MODES,
  getFullMaterialDisplayName,
  getBlockTheme,
  calculateRowPricing
} from './reservationConstants';

const ClipReservationCard = ({
  item,
  index,
  totalItemsCount,
  selectedCompanyObj,
  companyProducts = [],
  materials = [],
  channels = [],
  activeTimeBlocks = [],
  usedPrograms = [],
  rowBumperHolders = {},
  onItemChange,
  onToggleChannel,
  onToggleTimeBlock,
  onSelectAllTimeBlocks,
  onToggleSponsorPosition,
  onRemoveRow,
  onPreviewMaterial
}) => {
  const rowMaterials = item.productId
    ? materials.filter(m => String(m.productId) === String(item.productId))
    : materials.filter(m => String(m.companyId) === String(selectedCompanyObj?.id || item.companyId));
  const selectedMatObj = materials.find(m => String(m.id) === String(item.materialId));
  const rowCalc = calculateRowPricing(item);
  const mode = item.pricingMode || 'spots_only';
  const rowProgramSearch = String(item.programSearch || '').trim().toLocaleLowerCase('tr-TR');
  const rowFilteredPrograms = rowProgramSearch
    ? usedPrograms.filter(
        p =>
          (p.title || '').toLocaleLowerCase('tr-TR').includes(rowProgramSearch) ||
          (p.categoryName || '').toLocaleLowerCase('tr-TR').includes(rowProgramSearch)
      )
    : usedPrograms;

  return (
    <div
      style={{
        background: 'var(--ads-card-subtle)',
        border: item.isSponsor
          ? '2px solid rgba(147, 51, 234, 0.55)'
          : '1.5px solid var(--ads-border-strong)',
        borderRadius: '16px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)'
      }}
    >
      {/* Satır Üst Başlığı */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--ads-border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '8px',
              background: item.isSponsor ? '#9333ea' : 'var(--ads-brand)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '800'
            }}
          >
            Reklam / Klip Planı #{index + 1}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
            {selectedCompanyObj?.name || 'Firma Seçilmedi'}
          </span>
          {item.isSponsor && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '3px 9px',
                borderRadius: '999px',
                background: 'rgba(147, 51, 234, 0.14)',
                color: '#9333ea',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Award size={12} />
              {item.sponsorProgramTitle ? `${item.sponsorProgramTitle} Sponsoru` : 'Program Sponsorluğu Aktif'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: '800',
              padding: '3px 10px',
              borderRadius: '999px',
              background:
                mode !== 'spots_only' && rowCalc.effectiveTotalBudget > 0
                  ? 'rgba(13, 148, 136, 0.14)'
                  : 'var(--ads-brand-soft)',
              color:
                mode !== 'spots_only' && rowCalc.effectiveTotalBudget > 0
                  ? '#0d9488'
                  : 'var(--ads-brand)'
            }}
          >
            {rowCalc.effectiveSpots} Spot
            {mode !== 'spots_only' && rowCalc.effectiveTotalBudget > 0
              ? ` • ${rowCalc.effectiveTotalBudget.toLocaleString('tr-TR')} ₺`
              : ''}
          </span>
          {totalItemsCount > 1 && (
            <button
              type="button"
              onClick={() => onRemoveRow(index)}
              className="ads-saas-btn ads-saas-btn-danger ads-saas-btn-sm"
            >
              <Trash2 size={12} /> Bu Klip Planını Kaldır
            </button>
          )}
        </div>
      </div>

      {/* 1A. SATIR: Ürün / Marka Seçimi + Reklam Materyali (Tam Klip İsmi) + Klibi İzle Butonu */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr auto', gap: '12px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '5px' }}>
            Ürün / Marka *
          </label>
          <select
            value={item.productId}
            onChange={e => onItemChange(index, 'productId', e.target.value)}
            className="ads-saas-select"
            style={{ width: '100%', height: '38px', fontWeight: '700' }}
          >
            <option value="">Ürün Seçin...</option>
            {companyProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '5px' }}>
            Reklam Materyali (Spot Klip — Tam İsim) *
          </label>
          <select
            value={item.materialId}
            onChange={e => onItemChange(index, 'materialId', e.target.value)}
            className="ads-saas-select"
            style={{ width: '100%', height: '38px', fontWeight: '700' }}
          >
            <option value="">Spot Klip Seçin...</option>
            {rowMaterials.map(m => (
              <option key={m.id} value={m.id}>
                {getFullMaterialDisplayName(m)} ({m.duration} sn)
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            type="button"
            disabled={!selectedMatObj}
            onClick={() => selectedMatObj && onPreviewMaterial(selectedMatObj)}
            className="ads-saas-btn ads-saas-btn-primary"
            style={{
              height: '38px',
              padding: '0 16px',
              opacity: selectedMatObj ? 1 : 0.45,
              cursor: selectedMatObj ? 'pointer' : 'not-allowed'
            }}
            title={selectedMatObj ? `${getFullMaterialDisplayName(selectedMatObj)} klibini izle` : 'Önce bir klip seçin'}
          >
            <Play size={14} fill="#ffffff" /> Klibi İzle
          </button>
        </div>
      </div>

      {/* Seçili Klip Tam İsim & Detay Bilgi Çubuğu (Kesilmeden Tam Görünür) */}
      {selectedMatObj && (
        <div
          style={{
            padding: '9px 13px',
            borderRadius: '10px',
            background: 'var(--ads-card-bg)',
            border: '1px solid rgba(0, 102, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flexWrap: 'wrap' }}>
            <span
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'var(--ads-brand-soft)',
                color: 'var(--ads-brand)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Film size={15} />
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--ads-text-main)', wordBreak: 'break-all' }}>
                Klip Tam Adı: <span style={{ color: 'var(--ads-brand)' }}>{selectedMatObj.clipName || selectedMatObj.name}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                Başlık: <strong>{selectedMatObj.name}</strong> • Dosya Kodu: <strong style={{ fontFamily: 'monospace' }}>{selectedMatObj.code || selectedMatObj.clipId}</strong> • Süre: <strong>{selectedMatObj.duration} saniye</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onPreviewMaterial(selectedMatObj)}
            className="ads-saas-btn ads-saas-btn-teal ads-saas-btn-sm"
          >
            <Play size={12} /> Videoyu Önizle ({selectedMatObj.duration} sn)
          </button>
        </div>
      )}

      {/* BU KLİP İÇİN YAYIN ÖNCELİK SEVİYESİ */}
      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '5px' }}>
          Bu Klip İçin Yayın Öncelik Seviyesi
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {PRIORITY_OPTIONS.map(opt => {
            const isSelected = String(item.priority || '700') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onItemChange(index, 'priority', opt.value)}
                style={{
                  padding: '8px 11px',
                  borderRadius: '9px',
                  border: `1.5px solid ${isSelected ? opt.color : 'var(--ads-border)'}`,
                  background: isSelected ? opt.bg : 'var(--ads-card-bg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? opt.color : 'var(--ads-text-main)' }}>
                    {opt.label}
                  </span>
                  {isSelected && <Check size={13} color={opt.color} />}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)', marginTop: '1px' }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1B. SATIR: Başlangıç Tarihi + Bitiş Tarihi + Günlük Min Spot + Günlük Max Spot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
            Başlangıç Tarihi *
          </label>
          <input
            type="date"
            value={item.startDate}
            onChange={e => onItemChange(index, 'startDate', e.target.value)}
            className="ads-saas-input"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
            Bitiş Tarihi *
          </label>
          <input
            type="date"
            value={item.endDate}
            onChange={e => onItemChange(index, 'endDate', e.target.value)}
            className="ads-saas-input"
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
            Günlük Min Spot
          </label>
          <input
            type="number"
            min="0"
            max={item.dailyMaxSpots || 50}
            value={item.dailyMinSpots}
            onChange={e => onItemChange(index, 'dailyMinSpots', e.target.value)}
            className="ads-saas-input"
            style={{ width: '100%', fontWeight: '700' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
            Günlük Max Spot
          </label>
          <input
            type="number"
            min={item.dailyMinSpots || 1}
            value={item.dailyMaxSpots}
            onChange={e => onItemChange(index, 'dailyMaxSpots', e.target.value)}
            className="ads-saas-input"
            style={{ width: '100%', fontWeight: '700' }}
          />
        </div>
      </div>

      {/* 2. SATIR: ESNEK SPOT & ÜCRET HESAPLAMA ALANI (3 SEÇENEKLİ, ÜCRET ZORUNLU DEĞİL) */}
      <div
        style={{
          background: 'var(--ads-card-bg)',
          border: '1px solid var(--ads-border)',
          borderRadius: '11px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Wallet size={14} color="var(--ads-teal)" />
            Spot &amp; Fiyatlandırma Seçeneği <span style={{ fontWeight: '500', color: 'var(--ads-text-muted)' }}>(Ücret girmek zorunlu değildir)</span>
          </span>

          <div style={{ display: 'inline-flex', background: 'var(--ads-pill-bar-bg)', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            {PRICING_MODES.map(pm => {
              const IconComp = pm.icon;
              const isActive = mode === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => onItemChange(index, 'pricingMode', pm.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isActive ? 'var(--ads-brand)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--ads-text-sub)',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComp size={12} />
                  {pm.label}
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'spots_only' && (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
                Toplam Yayınlanacak Spot Adedi *
              </label>
              <input
                type="number"
                min="1"
                value={item.plannedSpots}
                onChange={e => onItemChange(index, 'plannedSpots', e.target.value)}
                className="ads-saas-input"
                style={{ width: '100%', fontWeight: '800', fontSize: '13px' }}
              />
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', paddingTop: '14px' }}>
              Ücret bilgisi girilmeden yalnızca <strong>{rowCalc.effectiveSpots} spot</strong> üzerinden planlama yapılır.
            </div>
          </div>
        )}

        {mode === 'by_spot_price' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
                Hedef Spot Adedi *
              </label>
              <input
                type="number"
                min="1"
                value={item.plannedSpots}
                onChange={e => onItemChange(index, 'plannedSpots', e.target.value)}
                placeholder="Örn: 100"
                className="ads-saas-input"
                style={{ width: '100%', fontWeight: '800' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
                Birim Spot Ücreti (₺)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={item.spotPrice}
                onChange={e => onItemChange(index, 'spotPrice', e.target.value)}
                placeholder="Örn: 250"
                className="ads-saas-input"
                style={{ width: '100%', fontWeight: '800' }}
              />
            </div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(13, 148, 136, 0.1)',
                border: '1px solid rgba(13, 148, 136, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)' }}>
                Hesaplanan Toplam Tutar:
              </span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0d9488' }}>
                {rowCalc.effectiveTotalBudget.toLocaleString('tr-TR')} ₺
              </span>
            </div>
          </div>
        )}

        {mode === 'by_total_budget' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
                Verilen Toplam Tutar / Bütçe (₺)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={item.totalBudget}
                onChange={e => onItemChange(index, 'totalBudget', e.target.value)}
                placeholder="Örn: 10000"
                className="ads-saas-input"
                style={{ width: '100%', fontWeight: '800' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '4px' }}>
                Birim Spot Ücreti (₺)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={item.spotPrice}
                onChange={e => onItemChange(index, 'spotPrice', e.target.value)}
                placeholder="Örn: 100"
                className="ads-saas-input"
                style={{ width: '100%', fontWeight: '800' }}
              />
            </div>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'var(--ads-brand-soft)',
                border: '1px solid rgba(0, 102, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)' }}>
                Otomatik Hesaplanan Spot:
              </span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-brand)' }}>
                {rowCalc.effectiveSpots} Spot
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. SATIR: BU ÜRÜN / KLİP İÇİN KANAL SEÇİMİ VE YAYIN KUŞAĞI SEÇİMİ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.85fr', gap: '14px', paddingTop: '4px' }}>
        {/* Sol: Bu Ürünün Yayınlanacağı Kanallar */}
        <div
          style={{
            background: 'var(--ads-card-bg)',
            border: '1px solid var(--ads-border)',
            borderRadius: '11px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Tv size={13} color="var(--ads-brand)" />
              Yayınlanacağı Kanal *
            </span>
            <button
              type="button"
              onClick={() => onItemChange(index, 'channelIds', channels.map(c => c.id))}
              style={{ background: 'none', border: 'none', color: 'var(--ads-brand)', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
            >
              Her İki Kanal
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {channels.map(ch => {
              const isSelected = (item.channelIds || []).includes(ch.id);
              const accent = ch.id === 'ch_hd' ? '#0066ff' : '#8b5cf6';
              return (
                <div
                  key={ch.id}
                  onClick={() => onToggleChannel(index, ch.id)}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '9px',
                    border: `1.5px solid ${isSelected ? accent : 'var(--ads-border)'}`,
                    background: isSelected ? `${accent}12` : 'var(--ads-card-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '7px',
                        background: isSelected ? accent : 'var(--ads-pill-bar-bg)',
                        color: isSelected ? '#fff' : 'var(--ads-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Tv size={13} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: isSelected ? accent : 'var(--ads-text-main)' }}>
                        {ch.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--ads-text-muted)' }}>
                        {ch.id === 'ch_hd' ? 'Ana Uydu & Kablo' : 'Avrupa & Dijital'}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: `1.5px solid ${isSelected ? accent : 'var(--ads-border-strong)'}`,
                      background: isSelected ? accent : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isSelected && <Check size={12} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sağ: Bu Ürünün Yayınlanacağı Kuşaklar */}
        <div
          style={{
            background: 'var(--ads-card-bg)',
            border: '1px solid var(--ads-border)',
            borderRadius: '11px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} color="var(--ads-orange)" />
              Yayınlanacağı Kuşaklar * ({(item.timeBlockIds || []).length} Seçili)
            </span>
            <button
              type="button"
              onClick={() => onSelectAllTimeBlocks(index)}
              style={{ background: 'none', border: 'none', color: 'var(--ads-brand)', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}
            >
              {activeTimeBlocks.every(tb => (item.timeBlockIds || []).includes(tb.id))
                ? 'Seçimi Temizle'
                : 'Tüm Kuşakları Seç'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {activeTimeBlocks.map(tb => {
              const isChecked = (item.timeBlockIds || []).includes(tb.id);
              const theme = getBlockTheme(tb.name);
              return (
                <div
                  key={tb.id}
                  onClick={() => onToggleTimeBlock(index, tb.id)}
                  style={{
                    padding: '9px 11px',
                    borderRadius: '9px',
                    border: `1.5px solid ${isChecked ? theme.accent : 'var(--ads-border)'}`,
                    background: isChecked ? theme.softBg : 'var(--ads-card-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: 'var(--ads-card-bg)',
                        border: `1px solid ${isChecked ? theme.accent : 'var(--ads-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {theme.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: '800',
                          color: isChecked ? theme.accent : 'var(--ads-text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {tb.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '700',
                            fontFamily: 'monospace',
                            color: 'var(--ads-text-sub)'
                          }}
                        >
                          {tb.startTime}–{tb.endTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: `1.5px solid ${isChecked ? theme.accent : 'var(--ads-border-strong)'}`,
                      background: isChecked ? theme.accent : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {isChecked && <Check size={12} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. SATIR: BU KLİP İÇİN PROGRAM SPONSORLUĞU YAPILANDIRMASI (HER KLİP KARTINDA BAĞIMSIZ) */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: '12px',
          border: item.isSponsor ? '1.5px solid #9333ea' : '1px solid var(--ads-border)',
          background: item.isSponsor ? 'rgba(147, 51, 234, 0.04)' : 'var(--ads-card-bg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(147, 51, 234, 0.14)',
                color: '#9333ea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Award size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                Bu Klip İçin Program Sponsorluğu Yapılandırması (İsteğe Bağlı)
              </div>
              <div style={{ fontSize: '11px', color: 'var(--ads-text-muted)' }}>
                Bu klibi (Klip #{index + 1}) bir yayın programına Program Öncesi, Program Arası, Program Sonrası veya Sunar / Devam Edecek / Devam Ediyor / Sundu olarak bağlayın.
              </div>
            </div>
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 13px',
              borderRadius: '999px',
              background: item.isSponsor ? '#9333ea' : 'var(--ads-pill-bar-bg)',
              color: item.isSponsor ? '#ffffff' : 'var(--ads-text-sub)',
              fontWeight: '800',
              fontSize: '11.5px',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(item.isSponsor)}
              onChange={e => onItemChange(index, 'isSponsor', e.target.checked)}
              style={{ accentColor: '#fff', cursor: 'pointer' }}
            />
            <span>{item.isSponsor ? 'Sponsorluk Aktif' : 'Bu Klibe Sponsorluk Ekle'}</span>
          </label>
        </div>

        {item.isSponsor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
            {/* Program Arama ve Seçimi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '5px' }}>
                  Program Ara (Programlar Kategorisi)
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--ads-text-muted)' }} />
                  <input
                    type="text"
                    value={item.programSearch || ''}
                    onChange={e => onItemChange(index, 'programSearch', e.target.value)}
                    placeholder="İlim Dersleri, Çerçeve, Sohbet ara..."
                    className="ads-saas-input"
                    style={{ width: '100%', paddingLeft: '32px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-sub)', marginBottom: '5px' }}>
                  Sponsor Olunacak Program *
                </label>
                <select
                  value={item.sponsorProgramTitle || ''}
                  onChange={e => onItemChange(index, 'sponsorProgramTitle', e.target.value)}
                  className="ads-saas-select"
                  style={{ width: '100%', fontWeight: '700' }}
                >
                  <option value="">Yayındaki Programlardan Seçiniz...</option>
                  {rowFilteredPrograms.map(prog => (
                    <option key={prog.id || prog.title} value={prog.title}>
                      {prog.title} ({prog.categoryName || 'Program'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hızlı Program Önerileri */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--ads-text-muted)' }}>Hızlı Seç:</span>
              {usedPrograms.slice(0, 7).map(prog => {
                const isSelected = item.sponsorProgramTitle === prog.title;
                return (
                  <button
                    key={prog.id || prog.title}
                    type="button"
                    onClick={() => onItemChange(index, 'sponsorProgramTitle', prog.title)}
                    className={`ads-saas-chip ${isSelected ? 'active' : ''}`}
                    style={{ fontSize: '11px' }}
                  >
                    <Tv size={11} /> {prog.title}
                  </button>
                );
              })}
            </div>

            {/* 1. KISIM: Standart Program Sponsorluğu */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '11px',
                background: 'var(--ads-card-subtle)',
                border: '1px solid var(--ads-border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                  1. Kısım: Standart Program Sponsorluğu (Program Öncesi • Program Arası • Program Sonrası)
                </label>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(0, 102, 255, 0.12)',
                    color: 'var(--ads-brand)'
                  }}
                >
                  Çoklu Olabilir • Birden Fazla Reklam Sponsor Olabilir
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {SPONSOR_FLOW_POSITIONS.map(pos => {
                  const isChecked = (item.sponsorPositions || []).includes(pos.id);
                  return (
                    <div
                      key={pos.id}
                      onClick={() => onToggleSponsorPosition(index, pos.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1.5px solid ${isChecked ? pos.color : 'var(--ads-border)'}`,
                        background: isChecked ? pos.bg : 'var(--ads-card-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: isChecked ? pos.color : 'var(--ads-text-main)' }}>
                          {pos.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ accentColor: pos.color, width: '15px', height: '15px', pointerEvents: 'none' }}
                        />
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: pos.color }}>
                        {pos.positionBadge}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)' }}>
                        {pos.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. KISIM: Özel Sunum & Geçiş Sponsorlukları */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '11px',
                background: 'var(--ads-card-subtle)',
                border: '1.5px solid rgba(147, 51, 234, 0.28)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                    2. Kısım: Özel Sunum &amp; Geçiş Sponsorlukları: Program Öncesi (Sunar) • Program Arası (Devam Edecek) • Program Arası (Devam Ediyor) • Program Sonrası (Sundu)
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                    Her sunum rolü program başına <strong>tekildir (en fazla 1 reklam)</strong>. Bu klipte seçtiğiniz rol doğrudan bu klibe atanır.
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '800',
                    padding: '2px 9px',
                    borderRadius: '999px',
                    background: 'rgba(225, 29, 72, 0.12)',
                    color: '#e11d48'
                  }}
                >
                  Tekil Sıra Kilitli • İlk / Son Sıra Garantili
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {SPONSOR_BUMPER_ROLES.map(role => {
                  const isChecked = (item.sponsorPositions || []).includes(role.id);
                  const holder = rowBumperHolders[role.id];

                  return (
                    <div
                      key={role.id}
                      onClick={() => onToggleSponsorPosition(index, role.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1.5px solid ${isChecked ? role.color : 'var(--ads-border)'}`,
                        background: isChecked ? role.bg : 'var(--ads-card-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: isChecked ? role.color : 'var(--ads-text-main)' }}>
                          {role.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ accentColor: role.color, width: '15px', height: '15px', pointerEvents: 'none' }}
                        />
                      </div>

                      <span
                        style={{
                          alignSelf: 'flex-start',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '1px 7px',
                          borderRadius: '5px',
                          background: 'rgba(15, 23, 42, 0.08)',
                          color: role.color
                        }}
                      >
                        {role.positionBadge}
                      </span>

                      <div style={{ fontSize: '10.5px', color: 'var(--ads-text-muted)' }}>
                        {role.desc}
                      </div>

                      {holder && (
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(245, 158, 11, 0.14)',
                            color: '#d97706',
                            border: '1px solid rgba(245, 158, 11, 0.35)'
                          }}
                        >
                          {holder.source === 'internal'
                            ? `⚠️ Bu formdaki Klip #${holder.rowNumber} (${holder.materialName}) üzerinde seçili. Tıklarsanız bu klibe geçer.`
                            : `⚠️ Şu an ${holder.companyName} (${holder.materialName}) üzerinde tanımlı. Seçip kaydederseniz bu kliple değiştirilir.`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClipReservationCard;

