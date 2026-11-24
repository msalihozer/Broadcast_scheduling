/**
 * @file src/components/Ads/AdsReservationForm.jsx
 * @description Modern SaaS Temalı Reklam & Program Sponsorluğu Rezervasyon Oluşturma / Düzenleme Ana Koordinatör Modalı.
 *
 * Modüler Alt Bileşenler (`./reservation/*`):
 * - `reservationConstants.js`: 1. Kısım (`SPONSOR_FLOW_POSITIONS`) ve 2. Kısım (`SPONSOR_BUMPER_ROLES`) sponsorluk rolleri,
 *   öncelik seçenekleri, fiyatlandırma modları ve hesaplama yardımcıları.
 * - `CompanySelectorCard.jsx`: 800+ firma arasında yazarak anında arama yapılabilen Combobox ve kampanya başlığı kartı.
 * - `ClipReservationCard.jsx`: Her eklenen klip (`Reklam / Klip Planı #1, #2...`) için bağımsız Ürün/Klip, Öncelik,
 *   Tarih/Günlük Min-Max, Spot & Ücretlendirme, Kanal & Yayın Kuşağı ve 2 Kısımlı Program Sponsorluğu kartı.
 * - `ReservationSummarySidebar.jsx`: Sağ sütunda yer alan canlı rezervasyon, spot, bütçe ve sponsorluk özeti.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Calendar,
  Package,
  CheckCircle2,
  Copy,
  Award
} from 'lucide-react';
import usePlanningStore from '../../store/planningStore';
import { dialog } from '../../store/dialogStore';
import AdVideoPlayer from './AdVideoPlayer';

import {
  SPONSOR_FLOW_POSITIONS,
  SPONSOR_BUMPER_ROLES,
  SINGULAR_BUMPER_ROLE_IDS,
  SPONSOR_POSITIONS,
  FALLBACK_BROADCAST_PROGRAMS,
  PRIORITY_OPTIONS,
  PRICING_MODES,
  getFullMaterialDisplayName,
  getBlockTheme,
  getTodayIso,
  getPlusDaysIso,
  createEmptyProductPlan,
  calculateRowPricing,
  calculateItemOverageMetrics
} from './reservation/reservationConstants';

import CompanySelectorCard from './reservation/CompanySelectorCard';
import ClipReservationCard from './reservation/ClipReservationCard';
import ReservationSummarySidebar from './reservation/ReservationSummarySidebar';

// Dış bileşenlerin (`SponsorshipsTab.jsx`, `ReservationsTab.jsx` vb.) geriye dönük uyumluluğu için re-exportlar
export {
  SPONSOR_FLOW_POSITIONS,
  SPONSOR_BUMPER_ROLES,
  SINGULAR_BUMPER_ROLE_IDS,
  SPONSOR_POSITIONS,
  FALLBACK_BROADCAST_PROGRAMS,
  PRIORITY_OPTIONS,
  PRICING_MODES,
  getFullMaterialDisplayName,
  getBlockTheme,
  createEmptyProductPlan,
  calculateRowPricing
};

const AdsReservationForm = ({ onClose, existingData = null, defaultSponsorMode = false }) => {
  const {
    companies = [],
    products = [],
    materials = [],
    reservations = [],
    timeBlocks = [],
    channels = [],
    days = {},
    ramadanConfig = { enabled: true, startDate: '2026-02-18', endDate: '2026-03-19' },
    setRamadanConfig,
    hiddenCategoryIds = [],
    addReservation,
    updateReservation
  } = usePlanningStore();

  // Yayın akışı listelerinden (days) Sahur ve İftar programlarının başlangıç saatlerini otomatik çek
  const detectedRamadanPrograms = useMemo(() => {
    let sahurStartTime = '';
    let iftarStartTime = '';
    Object.values(days || {}).forEach(dayObj => {
      if (!dayObj?.variants) return;
      const activeVar = dayObj.activeVariant || 'v1';
      const progs = dayObj.variants[activeVar]?.programs || [];
      let curMin = dayObj.startTime || 0;
      progs.forEach(p => {
        const sMin = p.startMinute !== undefined ? p.startMinute : curMin;
        const dMin = parseFloat(p.duration || 0);
        curMin = sMin + dMin;
        const h = Math.floor(sMin / 60) % 24;
        const m = Math.floor(sMin % 60);
        const tStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const titleStr = `${p.title || ''} ${p.name || ''}`;
        if (!sahurStartTime && (p.ramadanProgramType === 'sahur' || /sahur/i.test(titleStr))) {
          sahurStartTime = `${tStr} (${p.title || 'Sahur Programı'})`;
        }
        if (!iftarStartTime && (p.ramadanProgramType === 'iftar' || /iftar/i.test(titleStr))) {
          iftarStartTime = `${tStr} (${p.title || 'İftar Programı'})`;
        }
      });
    });
    return { sahurStartTime, iftarStartTime };
  }, [days]);

  const [usedPrograms, setUsedPrograms] = useState(FALLBACK_BROADCAST_PROGRAMS);
  const [previewMaterial, setPreviewMaterial] = useState(null);

  // Yayındaki aktif programları çek (hiddenCategoryIds filtresine uyarak)
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

  const sortedCompanies = useMemo(
    () => [...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr')),
    [companies]
  );

  const initialCompanyId =
    existingData?.companyId ||
    existingData?.items?.[0]?.companyId ||
    sortedCompanies[0]?.id ||
    '';

  const [formData, setFormData] = useState(() => {
    if (existingData) {
      const fallbackChannels =
        Array.isArray(existingData.channelIds) && existingData.channelIds.length > 0
          ? existingData.channelIds
          : ['ch_hd'];
      const fallbackBlocks =
        Array.isArray(existingData.timeBlockIds) && existingData.timeBlockIds.length > 0
          ? existingData.timeBlockIds
          : ['tb-2', 'tb-3'];
      const parentBumperMap =
        existingData.sponsorBumperMap && typeof existingData.sponsorBumperMap === 'object'
          ? existingData.sponsorBumperMap
          : {};

      const migratedItems =
        Array.isArray(existingData.items) && existingData.items.length > 0
          ? existingData.items.map((it, idx) => {
              const hasSpotPrice = Number(it.spotPrice) > 0;
              const hasTotalBudget = Number(it.totalBudget) > 0;
              const inferredMode =
                it.pricingMode ||
                (hasTotalBudget && hasSpotPrice
                  ? 'by_spot_price'
                  : hasSpotPrice
                  ? 'by_spot_price'
                  : 'spots_only');

              let itemPositions = [];
              if (Array.isArray(it.sponsorPositions) && it.sponsorPositions.length > 0) {
                itemPositions = [...it.sponsorPositions];
              } else if (Array.isArray(existingData.sponsorPositions) && existingData.sponsorPositions.length > 0) {
                itemPositions = existingData.sponsorPositions.filter(posId => {
                  if (!SINGULAR_BUMPER_ROLE_IDS.includes(posId)) return true;
                  const mappedMat = parentBumperMap[posId];
                  if (mappedMat) return String(mappedMat) === String(it.materialId);
                  return idx === 0;
                });
              } else {
                itemPositions = ['before', 'after'];
              }

              const itemIsSponsor =
                it.isSponsor !== undefined
                  ? Boolean(it.isSponsor)
                  : Boolean(existingData.isSponsor || defaultSponsorMode);

              return {
                id: it.id || `item-${idx}-${Date.now()}`,
                companyId: it.companyId || existingData.companyId || initialCompanyId,
                productId: it.productId || '',
                materialId: it.materialId || '',
                priority: String(it.priority || existingData.priority || (itemIsSponsor ? '1000' : '700')),
                startDate: it.startDate || existingData.startDate || getTodayIso(),
                endDate: it.endDate || existingData.endDate || getPlusDaysIso(6),
                pricingMode:
                  inferredMode === 'by_ spot_price' ? 'by_spot_price' : inferredMode,
                plannedSpots:
                  it.plannedSpots !== undefined
                    ? it.plannedSpots
                    : existingData.totalPlannedSpots || 20,
                dailyMinSpots:
                  it.dailyMinSpots !== undefined
                    ? it.dailyMinSpots
                    : existingData.dailyMinSpots || 1,
                dailyMaxSpots:
                  it.dailyMaxSpots !== undefined
                    ? it.dailyMaxSpots
                    : existingData.dailyMaxSpots || 4,
                spotPrice: it.spotPrice !== undefined && Number(it.spotPrice) > 0 ? it.spotPrice : '',
                totalBudget: it.totalBudget !== undefined && Number(it.totalBudget) > 0 ? it.totalBudget : '',
                channelIds:
                  Array.isArray(it.channelIds) && it.channelIds.length > 0
                    ? it.channelIds
                    : fallbackChannels,
                timeBlockIds:
                  Array.isArray(it.timeBlockIds) && it.timeBlockIds.length > 0
                    ? it.timeBlockIds
                    : fallbackBlocks,
                isSponsor: itemIsSponsor,
                sponsorProgramId: it.sponsorProgramId || existingData.sponsorProgramId || '',
                sponsorProgramTitle: it.sponsorProgramTitle || existingData.sponsorProgramTitle || '',
                sponsorPositions: itemPositions,
                isRamadanSpecial: Boolean(it.isRamadanSpecial ?? existingData.isRamadanSpecial),
                ramadanTarget: it.ramadanTarget || existingData.ramadanTarget || 'iftar',
                ramadanPositions:
                  Array.isArray(it.ramadanPositions) && it.ramadanPositions.length > 0
                    ? it.ramadanPositions
                    : Array.isArray(existingData.ramadanPositions) && existingData.ramadanPositions.length > 0
                    ? existingData.ramadanPositions
                    : ['before', 'middle', 'after'],
                programSearch: ''
              };
            })
          : [
              createEmptyProductPlan(initialCompanyId, {
                priority: String(existingData.priority || (existingData.isSponsor ? '1000' : '700')),
                startDate: existingData.startDate || getTodayIso(),
                endDate: existingData.endDate || getPlusDaysIso(6),
                plannedSpots: existingData.totalPlannedSpots || 20,
                dailyMinSpots: existingData.dailyMinSpots || 1,
                dailyMaxSpots: existingData.dailyMaxSpots || 4,
                spotPrice: existingData.spotPrice || '',
                channelIds: fallbackChannels,
                timeBlockIds: fallbackBlocks,
                isSponsor: Boolean(existingData.isSponsor || defaultSponsorMode),
                sponsorProgramId: existingData.sponsorProgramId || '',
                sponsorProgramTitle: existingData.sponsorProgramTitle || '',
                sponsorPositions: existingData.sponsorPositions || ['before', 'after'],
                isRamadanSpecial: Boolean(existingData.isRamadanSpecial),
                ramadanTarget: existingData.ramadanTarget || 'iftar',
                ramadanPositions: existingData.ramadanPositions || ['before', 'middle', 'after']
              })
            ];

      return {
        name: existingData.name || '',
        description: existingData.description || '',
        companyId: existingData.companyId || migratedItems[0]?.companyId || initialCompanyId,
        items: migratedItems,
        realizedSpots: existingData.realizedSpots || 0
      };
    }

    const initProds = products.filter(p => String(p.companyId) === String(initialCompanyId));
    const firstProd = initProds[0];
    const firstMat = firstProd
      ? materials.find(m => String(m.productId) === String(firstProd.id))
      : materials.find(m => String(m.companyId) === String(initialCompanyId));

    return {
      name: '',
      description: '',
      companyId: initialCompanyId,
      items: [
        createEmptyProductPlan(initialCompanyId, {
          productId: firstProd?.id || '',
          materialId: firstMat?.id || '',
          priority: defaultSponsorMode ? '1000' : '700',
          isSponsor: Boolean(defaultSponsorMode)
        })
      ],
      realizedSpots: 0
    };
  });

  const selectedCompanyObj = useMemo(
    () => companies.find(c => String(c.id) === String(formData.companyId)),
    [companies, formData.companyId]
  );

  const activeTimeBlocks = useMemo(() => timeBlocks.filter(tb => tb.isActive), [timeBlocks]);

  const companyProducts = useMemo(() => {
    if (!formData.companyId) return products;
    return products
      .filter(p => String(p.companyId) === String(formData.companyId))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));
  }, [products, formData.companyId]);

  const handleCompanyChange = (newCompanyId) => {
    const prods = products.filter(p => String(p.companyId) === String(newCompanyId));
    const firstProd = prods[0];
    const firstMat = firstProd
      ? materials.find(m => String(m.productId) === String(firstProd.id))
      : materials.find(m => String(m.companyId) === String(newCompanyId));

    setFormData(prev => ({
      ...prev,
      companyId: newCompanyId,
      items: [
        createEmptyProductPlan(newCompanyId, {
          productId: firstProd?.id || '',
          materialId: firstMat?.id || '',
          priority: prev.items[0]?.priority || '700',
          startDate: prev.items[0]?.startDate || getTodayIso(),
          endDate: prev.items[0]?.endDate || getPlusDaysIso(6),
          channelIds: prev.items[0]?.channelIds || ['ch_hd'],
          timeBlockIds: prev.items[0]?.timeBlockIds || ['tb-2', 'tb-3'],
          isSponsor: Boolean(prev.items[0]?.isSponsor),
          sponsorProgramId: prev.items[0]?.sponsorProgramId || '',
          sponsorProgramTitle: prev.items[0]?.sponsorProgramTitle || '',
          sponsorPositions: prev.items[0]?.sponsorPositions || ['before', 'after']
        })
      ]
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      const current = { ...nextItems[index], [field]: value };

      if (field === 'productId') {
        const prodMats = materials.filter(m => String(m.productId) === String(value));
        current.materialId = prodMats[0]?.id || '';
      }

      if (field === 'isSponsor' && value === true && String(current.priority) !== '1000') {
        current.priority = '1000';
      }

      if (field === 'sponsorProgramTitle') {
        const prog = usedPrograms.find(p => p.title === value);
        current.sponsorProgramId = prog?.id || value;
      }

      if (field === 'pricingMode') {
        if (value === 'by_total_budget' && current.spotPrice && current.plannedSpots && !current.totalBudget) {
          current.totalBudget = Number(current.plannedSpots) * Number(current.spotPrice);
        }
      }

      if (current.pricingMode === 'by_total_budget' && (field === 'totalBudget' || field === 'spotPrice')) {
        const budget = Number(field === 'totalBudget' ? value : current.totalBudget) || 0;
        const unit = Number(field === 'spotPrice' ? value : current.spotPrice) || 0;
        if (unit > 0 && budget > 0) {
          current.plannedSpots = Math.max(1, Math.floor(budget / unit));
        }
      }

      nextItems[index] = current;
      return { ...prev, items: nextItems };
    });
  };

  const handleToggleItemChannel = (index, chId) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      const currentChannels = nextItems[index].channelIds || [];
      const nextChannels = currentChannels.includes(chId)
        ? currentChannels.filter(id => id !== chId)
        : [...currentChannels, chId];
      nextItems[index] = { ...nextItems[index], channelIds: nextChannels };
      return { ...prev, items: nextItems };
    });
  };

  const handleToggleItemTimeBlock = (index, tbId) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      const currentBlocks = nextItems[index].timeBlockIds || [];
      const nextBlocks = currentBlocks.includes(tbId)
        ? currentBlocks.filter(id => id !== tbId)
        : [...currentBlocks, tbId];
      nextItems[index] = { ...nextItems[index], timeBlockIds: nextBlocks };
      return { ...prev, items: nextItems };
    });
  };

  const handleSelectAllItemTimeBlocks = (index) => {
    const allIds = activeTimeBlocks.map(tb => tb.id);
    setFormData(prev => {
      const nextItems = [...prev.items];
      const currentBlocks = nextItems[index].timeBlockIds || [];
      const isAllSelected = allIds.every(id => currentBlocks.includes(id));
      nextItems[index] = {
        ...nextItems[index],
        timeBlockIds: isAllSelected ? [] : allIds
      };
      return { ...prev, items: nextItems };
    });
  };

  const handleItemSponsorPositionToggle = (index, posId) => {
    setFormData(prev => {
      const nextItems = prev.items.map(it => ({ ...it, sponsorPositions: [...(it.sponsorPositions || [])] }));
      const targetItem = nextItems[index];
      const currentPositions = targetItem.sponsorPositions || [];
      const isRemoving = currentPositions.includes(posId);

      if (isRemoving) {
        targetItem.sponsorPositions = currentPositions.filter(p => p !== posId);
      } else {
        targetItem.sponsorPositions = [...currentPositions, posId];
        if (SINGULAR_BUMPER_ROLE_IDS.includes(posId) && targetItem.sponsorProgramTitle) {
          const targetProgNorm = String(targetItem.sponsorProgramTitle).trim().toLocaleLowerCase('tr-TR');
          nextItems.forEach((otherItem, otherIdx) => {
            if (otherIdx === index || !otherItem.isSponsor) return;
            const otherProgNorm = String(otherItem.sponsorProgramTitle || '').trim().toLocaleLowerCase('tr-TR');
            if (otherProgNorm === targetProgNorm) {
              otherItem.sponsorPositions = (otherItem.sponsorPositions || []).filter(p => p !== posId);
            }
          });
        }
      }

      return { ...prev, items: nextItems };
    });
  };

  const handleItemRamadanPositionToggle = (index, posId) => {
    setFormData(prev => {
      const nextItems = prev.items.map(it => ({ ...it, ramadanPositions: [...(it.ramadanPositions || ['before', 'middle', 'after'])] }));
      const targetItem = nextItems[index];
      const currentPositions = targetItem.ramadanPositions || [];
      if (currentPositions.includes(posId)) {
        targetItem.ramadanPositions = currentPositions.filter(p => p !== posId);
      } else {
        targetItem.ramadanPositions = [...currentPositions, posId];
      }
      return { ...prev, items: nextItems };
    });
  };

  const addProductPlanRow = () => {
    const firstItem = formData.items[0] || {};
    const usedMatIds = new Set(formData.items.map(i => String(i.materialId)).filter(Boolean));
    const usedProductIds = new Set(formData.items.map(i => String(i.productId)).filter(Boolean));

    const nextSuggestedProduct =
      companyProducts.find(p => !usedProductIds.has(String(p.id))) || companyProducts[0];
    const nextSuggestedMat =
      (nextSuggestedProduct &&
        materials.find(
          m => String(m.productId) === String(nextSuggestedProduct.id) && !usedMatIds.has(String(m.id))
        )) ||
      materials.find(
        m => String(m.companyId) === String(formData.companyId) && !usedMatIds.has(String(m.id))
      ) ||
      (nextSuggestedProduct && materials.find(m => String(m.productId) === String(nextSuggestedProduct.id))) ||
      null;

    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        createEmptyProductPlan(prev.companyId, {
          productId: nextSuggestedProduct?.id || firstItem.productId || '',
          materialId: nextSuggestedMat?.id || '',
          priority: defaultSponsorMode ? '1000' : '700',
          startDate: firstItem.startDate || getTodayIso(),
          endDate: firstItem.endDate || getPlusDaysIso(6),
          pricingMode: 'spots_only',
          plannedSpots: 20,
          dailyMinSpots: 1,
          dailyMaxSpots: 4,
          spotPrice: '',
          totalBudget: '',
          channelIds: ['ch_hd'],
          timeBlockIds: ['tb-2', 'tb-3'],
          isSponsor: Boolean(defaultSponsorMode),
          sponsorProgramId: '',
          sponsorProgramTitle: '',
          sponsorPositions: ['before', 'after']
        })
      ]
    }));
  };

  const removeProductPlanRow = (index) => {
    setFormData(prev => {
      if (prev.items.length <= 1) return prev;
      const nextItems = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: nextItems };
    });
  };

  const copyFirstRowSettingsToAll = () => {
    const first = formData.items[0];
    if (!first) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((it, idx) =>
        idx === 0
          ? it
          : {
              ...it,
              startDate: first.startDate,
              endDate: first.endDate,
              channelIds: [...(first.channelIds || ['ch_hd'])],
              timeBlockIds: [...(first.timeBlockIds || ['tb-2', 'tb-3'])]
            }
      )
    }));
  };

  const getProgramBumperHoldersForRow = (rowIndex, progTitle) => {
    const map = {};
    const progTitleNorm = String(progTitle || '').trim().toLocaleLowerCase('tr-TR');
    if (!progTitleNorm) return map;

    reservations.forEach(res => {
      if (!res) return;
      if (existingData?.id && String(res.id) === String(existingData.id)) return;
      const comp = companies.find(c => String(c.id) === String(res.companyId));

      const resItems = Array.isArray(res.items) && res.items.length > 0 ? res.items : [res];
      resItems.forEach(rItem => {
        const isSp = rItem.isSponsor !== undefined ? rItem.isSponsor : res.isSponsor;
        const rProg = String(rItem.sponsorProgramTitle || res.sponsorProgramTitle || '').trim().toLocaleLowerCase('tr-TR');
        if (!isSp || rProg !== progTitleNorm) return;

        const positions = Array.isArray(rItem.sponsorPositions)
          ? rItem.sponsorPositions
          : Array.isArray(res.sponsorPositions)
          ? res.sponsorPositions
          : [];

        positions.forEach(posId => {
          if (SINGULAR_BUMPER_ROLE_IDS.includes(posId) && !map[posId]) {
            const assignedMatId =
              res.sponsorBumperMap?.[posId] || rItem.materialId || res.materialId;
            const mat = materials.find(m => String(m.id) === String(assignedMatId));
            map[posId] = {
              source: 'external',
              companyName: comp?.name || 'Başka Firma',
              materialName: mat?.clipName || mat?.name || 'Reklam Klibi'
            };
          }
        });
      });
    });

    formData.items.forEach((otherItem, otherIdx) => {
      if (otherIdx === rowIndex || !otherItem.isSponsor) return;
      const otherProgNorm = String(otherItem.sponsorProgramTitle || '').trim().toLocaleLowerCase('tr-TR');
      if (otherProgNorm !== progTitleNorm) return;

      (otherItem.sponsorPositions || []).forEach(posId => {
        if (SINGULAR_BUMPER_ROLE_IDS.includes(posId)) {
          const mat = materials.find(m => String(m.id) === String(otherItem.materialId));
          map[posId] = {
            source: 'internal',
            rowNumber: otherIdx + 1,
            companyName: selectedCompanyObj?.name || 'Bu Firma',
            materialName: mat?.clipName || mat?.name || `Klip #${otherIdx + 1}`
          };
        }
      });
    });

    return map;
  };

  const summaryStats = useMemo(() => {
    let totalSpots = 0;
    let totalBudget = 0;
    let hasAnyPricing = false;

    formData.items.forEach(it => {
      const calc = calculateRowPricing(it);
      totalSpots += calc.effectiveSpots;
      if (it.pricingMode !== 'spots_only' && calc.effectiveTotalBudget > 0) {
        hasAnyPricing = true;
        totalBudget += calc.effectiveTotalBudget;
      }
    });

    const allDates = formData.items
      .flatMap(it => [it.startDate, it.endDate])
      .filter(Boolean)
      .sort();
    const minStartDate = allDates[0] || '';
    const maxEndDate = allDates[allDates.length - 1] || '';

    const allChannels = Array.from(
      new Set(formData.items.flatMap(it => it.channelIds || []))
    );
    const allTimeBlocks = Array.from(
      new Set(formData.items.flatMap(it => it.timeBlockIds || []))
    );
    const sponsorItems = formData.items.filter(it => it.isSponsor);

    return {
      totalSpots,
      totalBudget,
      hasAnyPricing,
      minStartDate,
      maxEndDate,
      allChannels,
      allTimeBlocks,
      sponsorItems,
      hasAnySponsor: sponsorItems.length > 0
    };
  }, [formData.items]);

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    if (!formData.companyId) {
      dialog.warning('Firma Seçimi Gerekli', 'Lütfen rezervasyon yapılacak firmayı seçin.');
      return;
    }

    const overageWarnings = [];
    let totalOverageSpots = 0;
    let totalOverageDays = 0;
    let totalOverageBudget = 0;

    for (let i = 0; i < formData.items.length; i++) {
      const it = formData.items[i];
      const clipLabel = `Reklam / Klip #${i + 1}`;

      if (!it.productId || !it.materialId || !it.startDate || !it.endDate) {
        dialog.warning(
          `Eksik Bilgi (${clipLabel})`,
          `Lütfen ${clipLabel} için Ürün, Reklam Materyali (Klip) ve Başlangıç/Bitiş tarihlerini seçin.`
        );
        return;
      }

      if (!Array.isArray(it.channelIds) || it.channelIds.length === 0) {
        dialog.warning(
          `Kanal Seçimi Gerekli (${clipLabel})`,
          `Lütfen ${clipLabel} için en az bir yayın kanalı (Semerkand HD veya Semerkand WAY) seçin.`
        );
        return;
      }

      if (!Array.isArray(it.timeBlockIds) || it.timeBlockIds.length === 0) {
        dialog.warning(
          `Yayın Kuşağı Gerekli (${clipLabel})`,
          `Lütfen ${clipLabel} için en az bir yayın kuşağı seçin.`
        );
        return;
      }

      if (it.isSponsor) {
        if (!it.sponsorProgramTitle) {
          dialog.warning(
            `Sponsor Program Seçimi (${clipLabel})`,
            `${clipLabel} için Program Sponsorluğu aktif edildi. Lütfen sponsor olunacak programı seçin.`
          );
          return;
        }
        if (!Array.isArray(it.sponsorPositions) || it.sponsorPositions.length === 0) {
          dialog.warning(
            `Sponsorluk Konumu Gerekli (${clipLabel})`,
            `Lütfen ${clipLabel} için 1. Kısımdan (Program Öncesi / Program Arası / Program Sonrası) veya 2. Kısımdan (Sunar / Devam Edecek / Devam Ediyor / Sundu) en az bir sponsorluk konumu seçin.`
          );
          return;
        }
      }

      // Spot sayısı, gün süresi veya fiyat/bütçe aşımı (- eksi fark) kontrolü
      const metrics = calculateItemOverageMetrics(it, existingData?.realizedSpots || 0, ramadanConfig);
      if (metrics.hasAnyOverage) {
        const parts = [];
        if (metrics.spotNegativeBalance < 0) {
          parts.push(`Spot Aşımı: ${metrics.spotNegativeBalance} Spot (Gereken: ${metrics.minRequiredSpotsForDays}, Planlanan: ${metrics.plannedSpots})`);
          totalOverageSpots += Math.abs(metrics.spotNegativeBalance);
        }
        if (metrics.dayNegativeBalance < 0) {
          parts.push(`Gün Süresi Aşımı: ${metrics.dayNegativeBalance} Gün`);
          totalOverageDays += Math.abs(metrics.dayNegativeBalance);
        }
        if (metrics.budgetNegativeBalance < 0) {
          parts.push(`Fiyat / Bütçe Aşımı: ${metrics.budgetNegativeBalance.toLocaleString('tr-TR')} ₺`);
          totalOverageBudget += Math.abs(metrics.budgetNegativeBalance);
        }
        overageWarnings.push(`• ${clipLabel}: ${parts.join(' | ')}`);
      }
    }

    // Eğer spot sayısı, gün süresi veya fiyat bilgisi aşılmışsa uyarı ver; "Devam Et" denildiğinde devam et ve - bilgisini kaydet!
    if (overageWarnings.length > 0) {
      const confirmed = await dialog.confirm(
        'Spot / Gün Süresi / Fiyat Aşımı Uyarısı',
        `Bu rezervasyonda planlanan kota, gün süresi veya fiyat sınırları aşıldı:\n\n` +
          `${overageWarnings.join('\n')}\n\n` +
          `"Devam Et" butonuna tıklarsanız rezervasyon kaydedilecek ve aşım miktarı eksi (-) bakiye olarak (` +
          `${totalOverageSpots > 0 ? `-${totalOverageSpots} Spot ` : ''}` +
          `${totalOverageDays > 0 ? `-${totalOverageDays} Gün ` : ''}` +
          `${totalOverageBudget > 0 ? `-${totalOverageBudget.toLocaleString('tr-TR')} ₺` : ''}` +
          `) sistemde tutulacaktır. Devam etmek istiyor musunuz?`,
        {
          confirmText: 'Devam Et (Eksi Fark İle Kaydet)',
          cancelText: 'Vazgeç ve Düzenle'
        }
      );
      if (!confirmed) return;
    }

    const normalizedItems = formData.items.map(it => {
      const calc = calculateRowPricing(it);
      const itemMetrics = calculateItemOverageMetrics(it, existingData?.realizedSpots || 0, ramadanConfig);
      return {
        id: it.id,
        companyId: formData.companyId,
        productId: it.productId,
        materialId: it.materialId,
        priority: Number(it.priority) || (it.isSponsor || it.isRamadanSpecial ? 1000 : 700),
        startDate: it.startDate,
        endDate: it.endDate,
        pricingMode: it.pricingMode || 'spots_only',
        plannedSpots: Math.max(1, calc.effectiveSpots || 1),
        dailyMinSpots: Number(it.dailyMinSpots) || 1,
        dailyMaxSpots: Number(it.dailyMaxSpots) || 4,
        spotPrice: calc.effectiveSpotPrice,
        totalBudget: calc.effectiveTotalBudget,
        channelIds: Array.isArray(it.channelIds) && it.channelIds.length > 0 ? it.channelIds : ['ch_hd'],
        timeBlockIds: Array.isArray(it.timeBlockIds) && it.timeBlockIds.length > 0 ? it.timeBlockIds : ['tb-2', 'tb-3'],
        isSponsor: Boolean(it.isSponsor),
        sponsorProgramId: it.isSponsor ? it.sponsorProgramId || it.sponsorProgramTitle : null,
        sponsorProgramTitle: it.isSponsor ? it.sponsorProgramTitle : null,
        sponsorPositions: it.isSponsor ? it.sponsorPositions || [] : [],
        isRamadanSpecial: Boolean(it.isRamadanSpecial),
        ramadanTarget: it.isRamadanSpecial ? (it.ramadanTarget || 'iftar') : null,
        ramadanPositions: it.isRamadanSpecial ? (it.ramadanPositions || ['before', 'middle', 'after']) : [],
        overageSpots: Math.abs(itemMetrics.spotNegativeBalance),
        overageDays: Math.abs(itemMetrics.dayNegativeBalance),
        overageBudget: Math.abs(itemMetrics.budgetNegativeBalance)
      };
    });

    const firstItem = normalizedItems[0];
    const sponsorItems = normalizedItems.filter(it => it.isSponsor && it.sponsorProgramTitle);
    const ramadanItems = normalizedItems.filter(it => it.isRamadanSpecial);
    const hasAnySponsor = sponsorItems.length > 0;
    const hasAnyRamadan = ramadanItems.length > 0;
    const uniqueSponsorPrograms = Array.from(new Set(sponsorItems.map(it => it.sponsorProgramTitle)));
    const allSponsorPositions = Array.from(new Set(sponsorItems.flatMap(it => it.sponsorPositions || [])));
    const allRamadanPositions = Array.from(new Set(ramadanItems.flatMap(it => it.ramadanPositions || [])));

    const finalSponsorBumperMap = {};
    sponsorItems.forEach(it => {
      (it.sponsorPositions || []).forEach(posId => {
        if (SINGULAR_BUMPER_ROLE_IDS.includes(posId)) {
          finalSponsorBumperMap[posId] = it.materialId;
        }
      });
    });

    const highestPriority = Math.max(...normalizedItems.map(it => Number(it.priority) || 700));

    const payload = {
      name:
        formData.name ||
        (hasAnyRamadan
          ? `Ramazan Özel — ${companies.find(c => String(c.id) === String(formData.companyId))?.name || 'Firma'}`
          : hasAnySponsor
          ? `${uniqueSponsorPrograms.join(' & ')} Sponsorluğu`
          : `${companies.find(c => String(c.id) === String(formData.companyId))?.name || 'Firma'} Rezervasyon Planı`),
      description: formData.description || '',
      companyId: formData.companyId,
      productId: firstItem.productId,
      materialId: firstItem.materialId,
      items: normalizedItems,
      startDate: summaryStats.minStartDate,
      endDate: summaryStats.maxEndDate,
      totalPlannedSpots: summaryStats.totalSpots,
      dailyMinSpots: Number(firstItem.dailyMinSpots) || 1,
      dailyMaxSpots: Number(firstItem.dailyMaxSpots) || 4,
      timeBlockIds: summaryStats.allTimeBlocks.length > 0 ? summaryStats.allTimeBlocks : ['tb-2', 'tb-3'],
      channelIds: summaryStats.allChannels.length > 0 ? summaryStats.allChannels : ['ch_hd'],
      priority: highestPriority,
      isSponsor: hasAnySponsor,
      sponsorProgramId: hasAnySponsor ? sponsorItems[0].sponsorProgramId : null,
      sponsorProgramTitle: hasAnySponsor ? uniqueSponsorPrograms.join(' • ') : null,
      sponsorPositions: hasAnySponsor ? allSponsorPositions : [],
      sponsorBumperMap: hasAnySponsor ? finalSponsorBumperMap : {},
      isRamadanSpecial: hasAnyRamadan,
      ramadanTarget: hasAnyRamadan ? (ramadanItems[0].ramadanTarget || 'iftar') : null,
      ramadanPositions: hasAnyRamadan ? allRamadanPositions : [],
      spotPrice: firstItem.spotPrice || 0,
      toplamTutar: summaryStats.hasAnyPricing ? summaryStats.totalBudget : 0,
      overageSpots: totalOverageSpots,
      overageDays: totalOverageDays,
      overageBudget: totalOverageBudget,
      durum: 'Onaylandı',
      realizedSpots: existingData?.realizedSpots || 0
    };

    if (existingData?.id) {
      updateReservation(existingData.id, payload);
    } else {
      addReservation(payload);
    }

    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1320px',
          maxHeight: '94vh',
          background: 'var(--ads-canvas-bg)',
          border: '1px solid var(--ads-border)',
          borderRadius: '18px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.38)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* ÜST BAŞLIK ÇUBUĞU */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--ads-border)',
            background: 'var(--ads-card-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                background: summaryStats.hasAnySponsor ? 'rgba(147, 51, 234, 0.15)' : 'var(--ads-brand-soft)',
                color: summaryStats.hasAnySponsor ? '#9333ea' : 'var(--ads-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {summaryStats.hasAnySponsor ? <Award size={20} /> : <Calendar size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                {existingData
                  ? 'Rezervasyon ve Sponsorluk Planını Düzenle'
                  : 'Yeni Reklam Rezervasyonu & Program Sponsorluğu Planla'}
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                Her klip için ayrı kanal, kuşak, öncelik, spot/ücretlendirme ve program sponsorluğu belirleyin.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" onClick={onClose} className="ads-saas-btn">
              İptal
            </button>
            <button type="button" onClick={handleSubmit} className="ads-saas-btn ads-saas-btn-primary">
              <CheckCircle2 size={15} />
              {existingData ? 'Değişiklikleri Kaydet' : 'Rezervasyonu Oluştur'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--ads-text-muted)', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ANA GÖVDE: SOL (FORM ALANLARI) + SAĞ (CANLI ÖZET KARTI) */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 350px',
            gap: '20px',
            alignItems: 'start'
          }}
        >
          {/* SOL SÜTUN: ANA PLANLAMA BÖLÜMLERİ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* BÖLÜM 1: FİRMA SEÇİCİ VE KAMPANYA BAŞLIĞI */}
            <CompanySelectorCard
              companies={companies}
              selectedCompanyId={formData.companyId}
              selectedCompanyObj={selectedCompanyObj}
              companyProductsCount={companyProducts.length}
              companyMaterialsCount={materials.filter(m => String(m.companyId) === String(selectedCompanyObj?.id)).length}
              campaignName={formData.name}
              onChangeCampaignName={val => setFormData(prev => ({ ...prev, name: val }))}
              onSelectCompany={handleCompanyChange}
            />

            {/* BÖLÜM 2: HER KLİP İÇİN TAM BAĞIMSIZ REZERVASYON KARTLARI */}
            <div className="ads-saas-card" style={{ padding: '18px', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={17} color="var(--ads-orange)" />
                    <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                      2. Reklam / Klip Planları ({formData.items.length} Bağımsız Klip Planı)
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px' }}>
                    Eklediğiniz her klip kendi <strong>kanal, kuşak, öncelik, spot/ücretlendirme ve program sponsorluğu</strong> ayarlarına sahip bağımsız bir rezervasyon gibi çalışır.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={copyFirstRowSettingsToAll}
                      className="ads-saas-btn ads-saas-btn-sm"
                      title="1. klibin tarih, kanal ve kuşak seçimlerini diğer tüm kliplere uygula"
                    >
                      <Copy size={13} /> 1. Klibin Tarih / Kanal / Kuşağını Tümüne Uygula
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addProductPlanRow}
                    className="ads-saas-btn ads-saas-btn-primary ads-saas-btn-sm"
                  >
                    <Plus size={14} /> Firmadan Başka Reklam / Klip Ekle
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {formData.items.map((item, idx) => (
                  <ClipReservationCard
                    key={item.id}
                    item={item}
                    index={idx}
                    totalItemsCount={formData.items.length}
                    selectedCompanyObj={selectedCompanyObj}
                    companyProducts={companyProducts}
                    materials={materials}
                    channels={channels}
                    activeTimeBlocks={activeTimeBlocks}
                    usedPrograms={usedPrograms}
                    rowBumperHolders={
                      item.isSponsor ? getProgramBumperHoldersForRow(idx, item.sponsorProgramTitle) : {}
                    }
                    ramadanConfig={ramadanConfig}
                    detectedRamadanPrograms={detectedRamadanPrograms}
                    onItemChange={handleItemChange}
                    onToggleChannel={handleToggleItemChannel}
                    onToggleTimeBlock={handleToggleItemTimeBlock}
                    onSelectAllTimeBlocks={handleSelectAllItemTimeBlocks}
                    onToggleSponsorPosition={handleItemSponsorPositionToggle}
                    onToggleRamadanPosition={handleItemRamadanPositionToggle}
                    onRemoveRow={removeProductPlanRow}
                    onPreviewMaterial={setPreviewMaterial}
                  />
                ))}
              </div>

              {/* Alt Kısımda Hızlı Yeni Klip Ekleme Butonu */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={addProductPlanRow}
                  className="ads-saas-btn"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '11px',
                    borderStyle: 'dashed',
                    borderWidth: '1.5px',
                    borderColor: 'var(--ads-brand)',
                    color: 'var(--ads-brand)',
                    fontWeight: '800',
                    background: 'var(--ads-brand-soft)'
                  }}
                >
                  <Plus size={15} /> + Firmadan Başka Reklam / Klip Planı Ekle (Ayrı Kanal, Spot, Ücret ve Sponsorluk İle)
                </button>
              </div>
            </div>
          </div>

          {/* SAĞ SÜTUN: CANLI REZERVASYON & SPONSORLUK ÖZET KARTI */}
          <ReservationSummarySidebar
            selectedCompanyObj={selectedCompanyObj}
            items={formData.items}
            products={products}
            materials={materials}
            timeBlocks={timeBlocks}
            channels={channels}
            summaryStats={summaryStats}
            existingData={existingData}
            onPreviewMaterial={setPreviewMaterial}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      {/* KLİP VİDEO İZLEME / ÖNİZLEME MODALI */}
      {previewMaterial && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 11000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setPreviewMaterial(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              background: 'var(--ads-canvas-bg)',
              border: '1px solid var(--ads-border-strong)',
              borderRadius: '18px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--ads-border)',
                background: 'var(--ads-card-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--ads-text-main)' }}>
                  {previewMaterial.name}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--ads-text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                  Tam Klip Adı: <strong style={{ color: 'var(--ads-brand)' }}>{previewMaterial.clipName || previewMaterial.name}</strong> • Süre: <strong>{previewMaterial.duration} sn</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMaterial(null)}
                className="ads-saas-btn ads-saas-btn-sm"
              >
                <X size={16} /> Kapat
              </button>
            </div>

            <div style={{ padding: '18px 20px' }}>
              <AdVideoPlayer material={previewMaterial} autoPlay={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsReservationForm;
