/**
 * @file useDraftExcelImport.js
 * @description Taslak Planlama modülü Excel'den haftalık veya tek günlük akış içe aktarma hook'u.
 */
import { useState, useCallback } from 'react';
import { format, parseISO, startOfWeek, addDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { dialog } from '../../../store/dialogStore';
import { updateLiveDraftSchedule } from '../../broadcast/utils/draftDataLoader';
import { enrichDraftScheduleWithArchiveDurations } from '../../broadcast/utils/draftSlotMatcher';
import useBroadcastStore from '../../broadcast/store/broadcastStore';

export const useDraftExcelImport = ({
  channels,
  setSchedulesByChannel,
  setSaveStatus,
  createEmptyWeek,
  setSelectedDayKey,
  handleSelectWeek,
  showToast
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Excel'den gelen akışı kullanıcının seçtiği yeni bir yayın haftasına eşleştirme
  const remapScheduleDates = useCallback((originalSchedule, targetStartDate) => {
    const dayKeys = Object.keys(originalSchedule || {});
    if (dayKeys.length === 0) return originalSchedule;

    const monday = startOfWeek(parseISO(targetStartDate), { weekStartsOn: 1 });
    const remapped = {};

    dayKeys.forEach((oldKey, idx) => {
      const targetDay = addDays(monday, idx);
      const newKey = format(targetDay, 'yyyy-MM-dd');
      const dayName = format(targetDay, 'EEEE', { locale: tr });
      const dateFormatted = format(targetDay, 'd MMMM yyyy', { locale: tr });

      const originalDay = originalSchedule[oldKey] || {};
      const remappedPrograms = (originalDay.programs || []).map((prog, pIdx) => ({
        ...prog,
        id: `prog_${newKey}_${String(pIdx + 1).padStart(2, '0')}`,
        instanceId: `inst_${newKey}_${String(pIdx + 1).padStart(2, '0')}`
      }));

      remapped[newKey] = {
        ...originalDay,
        date: dateFormatted,
        dayName: dayName,
        programs: remappedPrograms
      };
    });

    return remapped;
  }, []);

  // Kapsamlı Excel İçe Aktarma İşlemi (Çoklu Kanal, Haftalık veya Gün Bazlı Yükleme)
  const handleExecuteImport = useCallback(async ({ file, channelIds, dateMode, targetStartDate, singleDayConfig }) => {
    if (!file || !channelIds || channelIds.length === 0) return;
    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result.split(',')[1];
          const res = await fetch('/api/importDraftSchedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64,
              autoSave: false,
              channels: channelIds
            })
          });

          if (res.ok) {
            const rawParsedData = await res.json();
            if (rawParsedData.error) {
              dialog.error('Excel Ayrıştırma Hatası', rawParsedData.error);
              return;
            }

            const channelNames = channels.filter(c => channelIds.includes(c.id)).map(c => c.name);

            // 1. TEK GÜN MODU (GÜN BAZLI İÇE AKTARMA)
            if (dateMode === 'single_day' && singleDayConfig) {
              const { targetDate, sourceDayIndex, sourceDayName } = singleDayConfig;
              const parsedDaysList = Object.values(rawParsedData);
              const sourceDayObj = parsedDaysList[sourceDayIndex] || parsedDaysList[0];

              if (!sourceDayObj) {
                dialog.warning('Veri Bulunamadı', 'Excel içinde seçilen kaynak güne ait veri bulunamadı.');
                return;
              }

              const targetParsed = parseISO(targetDate);
              const targetKey = format(targetParsed, 'yyyy-MM-dd');
              const targetDayName = format(targetParsed, 'EEEE', { locale: tr });
              const targetDateFormatted = format(targetParsed, 'd MMMM yyyy', { locale: tr });

              const remappedPrograms = (sourceDayObj.programs || []).map((prog, pIdx) => ({
                ...prog,
                id: `prog_${targetKey}_${String(pIdx + 1).padStart(2, '0')}`,
                instanceId: `inst_${targetKey}_${String(pIdx + 1).padStart(2, '0')}`
              }));

              const rawDayData = {
                ...sourceDayObj,
                date: targetDateFormatted,
                dayName: targetDayName,
                programs: remappedPrograms
              };

              const enrichedSingleMap = await enrichDraftScheduleWithArchiveDurations({
                [targetKey]: rawDayData
              });
              const newDayData = enrichedSingleMap[targetKey] || rawDayData;
              const totalDayMin = (newDayData.programs || []).reduce((acc, p) => acc + (p.duration || 0), 0);

              setSchedulesByChannel(prev => {
                const updatedObj = { ...prev };
                channelIds.forEach(chId => {
                  const currentSchedule = prev[chId] || {};
                  const baseWeek = currentSchedule[targetKey] ? currentSchedule : {
                    ...createEmptyWeek(targetParsed),
                    ...currentSchedule
                  };

                  const finalChannelSchedule = {
                    ...baseWeek,
                    [targetKey]: newDayData
                  };

                  updatedObj[chId] = finalChannelSchedule;
                });
                return updatedObj;
              });

              const targetWeekMonday = format(startOfWeek(targetParsed, { weekStartsOn: 1 }), 'yyyy-MM-dd');
              if (handleSelectWeek) {
                handleSelectWeek([targetWeekMonday]);
              }
              if (setSaveStatus) setSaveStatus('unsaved');
              setSelectedDayKey(targetKey);
              setIsImportModalOpen(false);

              if (showToast) {
                showToast(`Tek günlük akış Excel'den yüklendi ve bölüm süreleri hesaplandı: ${targetDayName}`, 'success', 3000);
              }

              dialog.success(
                'Tek Günlük Akış Başarıyla Yüklendi',
                `Hedef Tarih: ${targetDateFormatted} (${targetDayName})\n` +
                `Kaynak Kuşak: Excel'deki ${sourceDayName} Akışı (${(newDayData.programs || []).length} Program, Toplam ${totalDayMin} dk)\n` +
                `Hedef Kanal(lar): ${channelNames.join(', ')}\n\n` +
                `* Bilgi: Programların arşivdeki en son eklenen bölüm/part toplam süreleri hesaplanmış ve yayın saatleri buna göre yerleştirilmiştir.`
              );

            } else {
              // 2. TÜM HAFTA VEYA ORİJİNAL TARİHLER MODU
              let finalSchedule = rawParsedData;
              if (dateMode === 'week' && targetStartDate) {
                finalSchedule = remapScheduleDates(rawParsedData, targetStartDate);
              }

              // Arşivdeki bölüm ve part toplam sürelerine göre saatleri ve süreleri zenginleştir
              finalSchedule = await enrichDraftScheduleWithArchiveDurations(finalSchedule);

              setSchedulesByChannel(prev => {
                const updatedObj = { ...prev };
                channelIds.forEach(chId => {
                  const merged = { ...(prev[chId] || {}), ...finalSchedule };
                  updatedObj[chId] = merged;
                });
                return updatedObj;
              });

              const importedDateKeys = Object.keys(finalSchedule).sort();
              if (importedDateKeys.length > 0 && handleSelectWeek) {
                const firstImportedMonday = format(
                  startOfWeek(parseISO(importedDateKeys[0]), { weekStartsOn: 1 }),
                  'yyyy-MM-dd'
                );
                handleSelectWeek([firstImportedMonday]);
              }
              if (setSaveStatus) setSaveStatus('unsaved');
              setSelectedDayKey('all');
              setIsImportModalOpen(false);

              const appliedScopeInfo = dateMode === 'week'
                ? `${format(parseISO(targetStartDate), 'd MMMM yyyy', { locale: tr })} haftası (7 Gün Tam Akış)`
                : 'Excel Orijinal Tarihleri (7 Gün)';

              if (showToast) {
                showToast(`Haftalık yayın akışı ve bölüm süreleri Excel'den yüklendi (${channelNames.join(', ')})`, 'success', 3000);
              }

              dialog.success(
                'Haftalık Yayın Akışı Başarıyla Yüklendi',
                `Hedef Kanal(lar): ${channelNames.join(', ')}\n` +
                `Uygulanan Kapsam: ${appliedScopeInfo}\n` +
                `Toplam Gün: ${Object.keys(finalSchedule).length} Gün\n\n` +
                `* Bilgi: Programların arşivdeki en son eklenen bölüm/part toplam süreleri hesaplanmış ve saatler buna göre yerleştirilmiştir.`
              );
            }
          } else {
            const errMsg = await res.text();
            dialog.error('Sunucu Hatası', errMsg);
          }
        } catch (err) {
          dialog.error('Aktarma Hatası', err.message);
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      dialog.error('Dosya Okuma Hatası', err.message);
      setIsImporting(false);
    }
  }, [channels, remapScheduleDates, createEmptyWeek, setSchedulesByChannel, setSelectedDayKey, handleSelectWeek, showToast]);

  return {
    isImportModalOpen,
    setIsImportModalOpen,
    isImporting,
    handleExecuteImport
  };
};
