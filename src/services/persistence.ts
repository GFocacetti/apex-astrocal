import { UserLocation } from '../types';
import { PRESET_OBSERVATORIES } from './geocoding';

const STORAGE_KEY = 'astrocal:v1';
const VALID_TABS = [
  'annual',
  'ephemeris20',
  'saturn',
  'libration',
  'eclipses',
  'guideVisual',
  'guideImaging',
  'filtersVisual',
  'filtersImaging',
];

export interface PersistedState {
  location: UserLocation;
  selectedYear: number;
  activeTab: string;
}

const DEFAULT_STATE: PersistedState = {
  location: PRESET_OBSERVATORIES[0],
  selectedYear: 2026,
  activeTab: 'annual',
};

function isValidLocation(loc: any): loc is UserLocation {
  return (
    loc &&
    typeof loc.name === 'string' &&
    typeof loc.latitude === 'number' &&
    typeof loc.longitude === 'number' &&
    loc.latitude >= -90 &&
    loc.latitude <= 90 &&
    loc.longitude >= -180 &&
    loc.longitude <= 180
  );
}

/**
 * Reads persisted app state from localStorage, falling back to defaults
 * for any field that is missing or fails validation (e.g. corrupted or
 * hand-edited storage, or a shape from a previous app version).
 */
export function loadPersistedState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);

    return {
      location: isValidLocation(parsed.location) ? parsed.location : DEFAULT_STATE.location,
      selectedYear:
        typeof parsed.selectedYear === 'number' && parsed.selectedYear >= 2026 && parsed.selectedYear <= 2125
          ? parsed.selectedYear
          : DEFAULT_STATE.selectedYear,
      activeTab: VALID_TABS.includes(parsed.activeTab) ? parsed.activeTab : DEFAULT_STATE.activeTab,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePersistedState(state: PersistedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (quota exceeded, private browsing, etc.) - ignore
  }
}
