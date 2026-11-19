/**
 * @file src/modules/draft/constants/draftPresets.js
 * @description Taslak Planlama modülünde hızlı yüklenebilir resmi haftalık yayın şablonları (Presets) ve kanal tanımları.
 */
import weeklyScheduleData from '../../../data/defaultWeeklySchedule.json';
import schedule2025 from '../../../data/schedule_2025_10_27.json';
import schedule2026 from '../../../data/schedule_2026_10_12.json';

export const AVAILABLE_PRESETS = [
  {
    id: 'preset_2025_10_27',
    label: '27 Ekim - 2 Kasım 2025',
    start: '2025-10-27',
    end: '2025-11-02',
    channel: 'Semerkand TV',
    totalProgs: 172,
    data: schedule2025
  },
  {
    id: 'preset_2026_10_12',
    label: '12 - 18 Ekim 2026',
    start: '2026-10-12',
    end: '2026-10-18',
    channel: 'Semerkand TV',
    totalProgs: 161,
    data: schedule2026
  }
];

export const CHANNELS = [
  { id: 'ch_hd', name: 'Semerkand HD' },
  { id: 'ch_way', name: 'Semerkand WAY' }
];
