export interface UserLocation {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number; // in meters
  country?: string;
}

export type PlanetKey =
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Moon'
  | 'Sun';

export interface PlanetInfo {
  key: PlanetKey;
  nameIt: string;
  symbol: string;
  color: string;
  type: 'planet_inner' | 'planet_outer' | 'star' | 'satellite';
}

export interface AltitudeDataPoint {
  dateStr: string; // e.g. "2026-03-15"
  timestamp: number;
  maxAltitude: number; // in degrees
  transitTimeStr: string;
  azimuth: number;
  magnitude: number;
  distAu: number;
}

export interface AnnualPlanetSummary {
  planetKey: PlanetKey;
  nameIt: string;
  color: string;
  peakAltitude: number; // highest altitude reached in the year
  peakDate: string; // ISO or formatted date
  peakTransitTime: string; // e.g. "22:15"
  quality: 'Eccellente' | 'Buono' | 'Discreto' | 'Basso / Difficile';
  monthlyData: { monthName: string; altitude: number }[];
  description: string;
  // True for outer planets/Mars when at least one month's dark-hour window
  // could not be determined (midnight sun / polar night at this latitude),
  // meaning that month's value fell back to the raw (unfiltered) transit altitude.
  nightDataUnavailable?: boolean;
  // Apparent (angular) diameter of the disc at peakDate, in arcseconds.
  // Only present for planets (not Sun/Moon, whose diameter varies on a different basis).
  angularDiameterArcsec?: number;
  // Typical maximum apparent diameter reachable: at opposition for outer
  // planets, at inferior conjunction for Mercury/Venus. Reference ceiling to
  // compare angularDiameterArcsec against.
  angularDiameterMaxArcsec?: number;
}

/**
 * One day's twilight-time visibility data for an inner planet (Mercury or
 * Venus), used to render a daily favorability profile since their apparition
 * cycles change too fast for monthly sampling to capture accurately.
 */
export interface InnerPlanetDayPoint {
  dateStr: string; // e.g. "2026-03-15"
  dayIndex: number; // 0-based day-of-year, for chart x-axis positioning
  elongation: number; // angular separation from the Sun, in degrees
  visibility: 'morning' | 'evening'; // which twilight this apparition favors
  altitudeAtTwilight: number; // altitude at the relevant dusk/dawn moment, degrees (can be negative if below horizon)
  twilightTimeStr: string | null; // formatted UTC time of that dusk/dawn moment, or null if not found
  favorable: boolean; // true when both altitude and elongation clear the visibility thresholds
  angularDiameterArcsec?: number; // apparent diameter of the disc that day, in arcseconds
}

export interface InnerPlanetVisibilityYear {
  planetKey: PlanetKey;
  year: number;
  points: InnerPlanetDayPoint[];
  bestPoint: InnerPlanetDayPoint | null;
}

export interface EphemerisEvent20Y {
  year: number;
  planetKey: PlanetKey;
  planetNameIt: string;
  eventType: 'Opposizione' | 'Elongazione Max' | 'Massimo Solare' | 'Minimo Solare' | 'Superluna' | 'Lunastizio';
  dateStr: string;
  monthName: string;
  maxAltitude: number;
  magnitude: number;
  distanceAu: number;
  angularSizeArcsec: number;
  detailsIt: string;
  score: number; // 0 - 100 rating
}

export interface SaturnYearData {
  year: number;
  datePeakStr: string;
  ringTiltDeg: number; // B angle in degrees (-27 to +27)
  ringTiltAbs: number;
  maxAltitude: number;
  magnitude: number;
  score: number; // Combined rating 0-100
  recommendation: string;
}

export interface EclipseEvent {
  id: string;
  type: 'solar_total' | 'solar_annular' | 'solar_partial' | 'lunar_total' | 'lunar_partial' | 'lunar_penumbral';
  typeIt: string;
  isSolar: boolean;
  peakTime: string; // UTC ISO string
  peakTimeLocal: string;
  year: number;
  obscurationPercent: number; // 0 to 100%
  bodyAltitudeAtPeak: number; // Sun or Moon altitude at user location
  isVisibleLocally: boolean;
  detailsIt: string;
}

export interface SolarCycleYearInfo {
  year: number;
  cycleNumber: number;
  phase: 'Massimo' | 'Crescita' | 'Minimo' | 'Decadimento';
  activityIndex: number; // 0 to 100 relative index (estimated sunspot number)
  recommendationIt: string;
}

export type LibrationDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface LunarLibrationEvent {
  dateStr: string;
  timestamp: number;
  elon: number; // optical libration in longitude, degrees (positive = East limb exposed)
  elat: number; // optical libration in latitude, degrees (positive = North limb exposed)
  totalLibration: number; // combined magnitude in degrees
  direction: LibrationDirection;
  moonIlluminationPercent: number; // illuminated fraction of the disc, 0-100
  quality: 'Eccezionale' | 'Ottima' | 'Buona';
  favorableFeatures: string;
}

export interface LibrationSnapshot {
  elon: number;
  elat: number;
  magnitude: number;
  direction: LibrationDirection;
  illuminationPercent: number;
}
