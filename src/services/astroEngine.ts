import * as Astronomy from 'astronomy-engine';
import {
  UserLocation,
  PlanetKey,
  PlanetInfo,
  AnnualPlanetSummary,
  EphemerisEvent20Y,
  SaturnYearData,
  EclipseEvent,
  SolarCycleYearInfo,
  LibrationDirection,
  LunarLibrationEvent,
  LibrationSnapshot,
  InnerPlanetDayPoint,
  InnerPlanetVisibilityYear,
} from '../types';

export const PLANETS_INFO: Record<PlanetKey, PlanetInfo> = {
  Sun: {
    key: 'Sun',
    nameIt: 'Sole',
    symbol: '☉',
    color: '#f59e0b', // Amber-500
    type: 'star',
  },
  Moon: {
    key: 'Moon',
    nameIt: 'Luna',
    symbol: '☾',
    color: '#e2e8f0', // Slate-200
    type: 'satellite',
  },
  Mercury: {
    key: 'Mercury',
    nameIt: 'Mercurio',
    symbol: '☿',
    color: '#94a3b8', // Slate-400
    type: 'planet_inner',
  },
  Venus: {
    key: 'Venus',
    nameIt: 'Venere',
    symbol: '♀',
    color: '#fef08a', // Yellow-200
    type: 'planet_inner',
  },
  Mars: {
    key: 'Mars',
    nameIt: 'Marte',
    symbol: '♂',
    color: '#ef4444', // Red-500
    type: 'planet_outer',
  },
  Jupiter: {
    key: 'Jupiter',
    nameIt: 'Giove',
    symbol: '♃',
    color: '#fb923c', // Orange-400
    type: 'planet_outer',
  },
  Saturn: {
    key: 'Saturn',
    nameIt: 'Saturno',
    symbol: '♄',
    color: '#eab308', // Yellow-500
    type: 'planet_outer',
  },
  Uranus: {
    key: 'Uranus',
    nameIt: 'Urano',
    symbol: '♅',
    color: '#06b6d4', // Cyan-500
    type: 'planet_outer',
  },
  Neptune: {
    key: 'Neptune',
    nameIt: 'Nettuno',
    symbol: '♆',
    color: '#3b82f6', // Blue-500
    type: 'planet_outer',
  },
};

export const MONTH_NAMES_IT = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/**
 * Creates an Astronomy.Observer instance from location coordinates
 */
export function createObserver(loc: UserLocation): Astronomy.Observer {
  return new Astronomy.Observer(loc.latitude, loc.longitude, loc.elevation || 0);
}

/**
 * Calculate meridian culmination altitude for a body on a given date
 */
export function getCulminationAltitude(
  body: Astronomy.Body,
  date: Date,
  observer: Astronomy.Observer
): { maxAltitude: number; transitTime: Date; azimuth: number } {
  try {
    const astroTime = Astronomy.MakeTime(date);
    // Search for Hour Angle = 0 (Meridian Transit)
    const hourAngleInfo = Astronomy.SearchHourAngle(body, observer, 0, astroTime);
    const timeToUse = hourAngleInfo ? hourAngleInfo.time : astroTime;
    
    const equator = Astronomy.Equator(body, timeToUse, observer, true, true);
    const horizon = Astronomy.Horizon(timeToUse, observer, equator.ra, equator.dec, 'normal');
    
    return {
      maxAltitude: Math.max(0, Number(horizon.altitude.toFixed(1))),
      transitTime: timeToUse.date,
      azimuth: Math.round(horizon.azimuth),
    };
  } catch (err) {
    const astroTime = Astronomy.MakeTime(date);
    const equator = Astronomy.Equator(body, astroTime, observer, true, true);
    const horizon = Astronomy.Horizon(astroTime, observer, equator.ra, equator.dec, 'normal');
    return {
      maxAltitude: Math.max(0, Number(horizon.altitude.toFixed(1))),
      transitTime: date,
      azimuth: Math.round(horizon.azimuth),
    };
  }
}

// Sun altitude below which the sky is considered dark enough for planetary
// observation (civil twilight). Used both to exclude daytime transits from
// outer-planet culmination data and to locate the dusk/dawn moments used to
// judge Mercury/Venus visibility.
const TWILIGHT_ALTITUDE_DEG = -6;

interface NightWindow {
  dusk: Astronomy.AstroTime;
  dawn: Astronomy.AstroTime;
}

/**
 * Finds the dark-hour window (Sun below the twilight altitude) covering the
 * night that starts on the evening of `referenceNoon`'s calendar date and
 * ends the following morning. Returns null if no such window can be found
 * within a few days - this happens near the polar circles, where the Sun may
 * never cross the twilight altitude for weeks at a time (midnight sun or
 * polar night), and must not be mistaken for a computation error.
 */
function findNightWindow(observer: Astronomy.Observer, referenceNoon: Astronomy.AstroTime): NightWindow | null {
  try {
    const dusk = Astronomy.SearchAltitude('Sun' as Astronomy.Body, observer, -1, referenceNoon, 3, TWILIGHT_ALTITUDE_DEG);
    if (!dusk) return null;
    const dawn = Astronomy.SearchAltitude('Sun' as Astronomy.Body, observer, 1, dusk, 3, TWILIGHT_ALTITUDE_DEG);
    if (!dawn) return null;
    return { dusk, dawn };
  } catch {
    return null;
  }
}

/**
 * Highest altitude a body actually reaches while the sky is dark on the
 * night of `sampleDate`, rather than its raw meridian-transit altitude. For
 * outer planets and Mars, the geometric transit can occur in broad daylight
 * (typically near solar conjunction); reporting that raw value as "peak
 * altitude" overstates how observable the body really is that month. Falls
 * back to the raw transit when no dark window is found (extreme latitudes).
 */
function getBestNightAltitude(
  body: Astronomy.Body,
  sampleDate: Date,
  observer: Astronomy.Observer
): { maxAltitude: number; transitTime: Date; azimuth: number; isPolarEdgeCase: boolean } {
  const noon = Astronomy.MakeTime(sampleDate);
  const window = findNightWindow(observer, noon);

  if (!window) {
    const fallback = getCulminationAltitude(body, sampleDate, observer);
    return { ...fallback, isPolarEdgeCase: true };
  }

  const { dusk, dawn } = window;
  const durationHours = (dawn.ut - dusk.ut) * 24;
  const steps = Math.max(6, Math.min(60, Math.round(durationHours * 3)));

  let bestAlt = -90;
  let bestTime = dusk.date;
  let bestAz = 0;

  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const t = Astronomy.MakeTime(dusk.ut + frac * (dawn.ut - dusk.ut));
    const equator = Astronomy.Equator(body, t, observer, true, true);
    const horizon = Astronomy.Horizon(t, observer, equator.ra, equator.dec, 'normal');
    if (horizon.altitude > bestAlt) {
      bestAlt = horizon.altitude;
      bestTime = t.date;
      bestAz = Math.round(horizon.azimuth);
    }
  }

  return {
    maxAltitude: Math.max(0, Number(bestAlt.toFixed(1))),
    transitTime: bestTime,
    azimuth: bestAz,
    isPolarEdgeCase: false,
  };
}

const INNER_PLANET_FAVORABLE_MIN_ALTITUDE_DEG = 5;
const INNER_PLANET_FAVORABLE_MIN_ELONGATION_DEG = 15;

/**
 * Daily elongation and twilight-altitude visibility profile for Mercury or
 * Venus across a given year. Unlike the outer planets, an inner planet's
 * apparitions (and which twilight favors it) can shift meaningfully within a
 * single month, so this samples every day rather than once a month. A day is
 * "favorable" when the planet both clears a minimum altitude at its relevant
 * twilight (dusk for an evening apparition, dawn for a morning one) and is
 * far enough from the Sun not to be lost in glare.
 */
export function calculateInnerPlanetVisibility(
  planetKey: 'Mercury' | 'Venus',
  year: number,
  location: UserLocation
): InnerPlanetVisibilityYear {
  const observer = createObserver(location);
  const body = planetKey as Astronomy.Body;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  const points: InnerPlanetDayPoint[] = [];
  let bestPoint: InnerPlanetDayPoint | null = null;

  for (let d = 0; d < daysInYear; d++) {
    const date = new Date(Date.UTC(year, 0, 1, 12, 0, 0) + d * 86400 * 1000);
    const t = Astronomy.MakeTime(date);
    const elong = Astronomy.Elongation(body, t);
    const visibility: 'morning' | 'evening' = elong.visibility === 'morning' ? 'morning' : 'evening';

    // Evening apparitions are judged at dusk that same evening; morning
    // apparitions at dawn the following morning - together these treat each
    // day index as covering "the night of" that calendar date.
    const direction = visibility === 'evening' ? -1 : 1;
    let altitudeAtTwilight = -90;
    let twilightTimeStr: string | null = null;

    try {
      const twilightTime = Astronomy.SearchAltitude(
        'Sun' as Astronomy.Body,
        observer,
        direction,
        t,
        2,
        TWILIGHT_ALTITUDE_DEG
      );
      if (twilightTime) {
        const eq = Astronomy.Equator(body, twilightTime, observer, true, true);
        const hz = Astronomy.Horizon(twilightTime, observer, eq.ra, eq.dec, 'normal');
        altitudeAtTwilight = hz.altitude;
        twilightTimeStr = formatUtcTime(twilightTime.date);
      }
    } catch {
      // No twilight crossing found nearby (extreme latitude) - leave as unfavorable
    }

    const favorable =
      altitudeAtTwilight >= INNER_PLANET_FAVORABLE_MIN_ALTITUDE_DEG &&
      elong.elongation >= INNER_PLANET_FAVORABLE_MIN_ELONGATION_DEG;

    const point: InnerPlanetDayPoint = {
      dateStr: date.toISOString().split('T')[0],
      dayIndex: d,
      elongation: Number(elong.elongation.toFixed(1)),
      visibility,
      altitudeAtTwilight: Number(altitudeAtTwilight.toFixed(1)),
      twilightTimeStr,
      favorable,
    };
    points.push(point);

    if (!bestPoint || point.altitudeAtTwilight > bestPoint.altitudeAtTwilight) {
      bestPoint = point;
    }
  }

  return { planetKey, year, points, bestPoint };
}

/**
 * Tab 1: Calculate annual altitude profiles for all planets in a given year
 */
export function calculateAnnualPlanetSummaries(
  year: number,
  location: UserLocation
): AnnualPlanetSummary[] {
  const observer = createObserver(location);
  const planetKeys: PlanetKey[] = [
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Moon',
    'Sun',
  ];

  return planetKeys.map((key) => {
    const info = PLANETS_INFO[key];
    const astroBody = key as Astronomy.Body;

    // Mercury and Venus: derive peak/quality from the daily twilight-visibility
    // profile (their meridian transit happens in broad daylight and is not a
    // meaningful measure of real-world visibility).
    if (key === 'Mercury' || key === 'Venus') {
      const visYear = calculateInnerPlanetVisibility(key, year, location);
      const monthlyBest = new Array(12).fill(-90);
      for (const p of visYear.points) {
        const month = new Date(p.dateStr + 'T12:00:00Z').getUTCMonth();
        if (p.altitudeAtTwilight > monthlyBest[month]) monthlyBest[month] = p.altitudeAtTwilight;
      }
      const monthlyData = monthlyBest.map((alt, month) => ({
        monthName: MONTH_NAMES_IT[month].slice(0, 3),
        altitude: Math.max(0, Number(alt.toFixed(1))),
      }));

      const best = visYear.bestPoint;
      const peakAltitude = best ? Math.max(0, best.altitudeAtTwilight) : 0;
      const peakDate = best ? best.dateStr : `${year}-01-01`;
      const peakTransitTime = best?.twilightTimeStr ?? '—';

      let quality: AnnualPlanetSummary['quality'] = 'Basso / Difficile';
      if (peakAltitude >= 20) quality = 'Eccellente';
      else if (peakAltitude >= 10) quality = 'Buono';
      else if (peakAltitude >= 5) quality = 'Discreto';

      const description = best
        ? `Miglior finestra il ${best.dateStr}: ${peakAltitude}° al ${
            best.visibility === 'evening' ? 'crepuscolo serale' : 'crepuscolo mattutino'
          }, con elongazione di ${best.elongation}° dal Sole. Vedi il profilo giornaliero per l'intero anno.`
        : `Pianeta interno: visibile principalmente al crepuscolo o all'alba alle massime elongazioni.`;

      return {
        planetKey: key,
        nameIt: info.nameIt,
        color: info.color,
        peakAltitude,
        peakDate,
        peakTransitTime,
        quality,
        monthlyData,
        description,
      };
    }

    const isOuterPlanet = info.type === 'planet_outer';

    let peakAltitude = -90;
    let peakDate = `${year}-01-01`;
    let peakTransitTime = '12:00';
    let nightDataUnavailable = false;
    const monthlyData: { monthName: string; altitude: number }[] = [];

    // Calculate monthly altitudes (15th of each month). For outer planets and
    // Mars this is the best altitude reached while the sky is actually dark
    // that night; for the Sun and Moon (always relevant regardless of the
    // time of day) it remains the raw meridian-transit altitude.
    for (let month = 0; month < 12; month++) {
      const sampleDate = new Date(Date.UTC(year, month, 15, 12, 0, 0));
      let culmin: { maxAltitude: number; transitTime: Date; azimuth: number };
      if (isOuterPlanet) {
        const nightResult = getBestNightAltitude(astroBody, sampleDate, observer);
        if (nightResult.isPolarEdgeCase) nightDataUnavailable = true;
        culmin = nightResult;
      } else {
        culmin = getCulminationAltitude(astroBody, sampleDate, observer);
      }

      monthlyData.push({
        monthName: MONTH_NAMES_IT[month].slice(0, 3),
        altitude: culmin.maxAltitude,
      });

      if (culmin.maxAltitude > peakAltitude) {
        peakAltitude = culmin.maxAltitude;
        peakDate = sampleDate.toISOString().split('T')[0];
        const hours = culmin.transitTime.getUTCHours().toString().padStart(2, '0');
        const mins = culmin.transitTime.getUTCMinutes().toString().padStart(2, '0');
        peakTransitTime = `${hours}:${mins} UTC`;
      }
    }

    // Determine observation quality category based on zenith clearance
    let quality: AnnualPlanetSummary['quality'] = 'Basso / Difficile';
    if (peakAltitude >= 45) {
      quality = 'Eccellente';
    } else if (peakAltitude >= 30) {
      quality = 'Buono';
    } else if (peakAltitude >= 15) {
      quality = 'Discreto';
    }

    // Specific descriptive text in Italian
    let description = '';
    if (key === 'Saturn') {
      description = `Altezza massima ${peakAltitude}° a cielo scuro, a ${location.name}. Valuta anche l'inclinazione degli anelli nella sezione dedicata.`;
    } else if (key === 'Jupiter') {
      description = `Culmina fino a ${peakAltitude}° sopra l'orizzonte durante le ore di buio. Eccellente per osservare la Macchia Rossa e le lune medicee.`;
    } else if (key === 'Mars') {
      description = `Raggiunge ${peakAltitude}° a cielo scuro sul meridiano locale. Dettagli superficiali ben visibili nelle fasi prossime all'opposizione.`;
    } else if (key === 'Sun') {
      description = `Inclinazione solare massima a ${peakAltitude}° durante il solstizio estivo.`;
    } else if (key === 'Moon') {
      description = `Culminazione massima mensile della Luna a ${peakAltitude}°.`;
    } else {
      description = `Raggiunge un'altezza di culmine di ${peakAltitude}° dall'osservatorio, durante le ore di buio.`;
    }

    return {
      planetKey: key,
      nameIt: info.nameIt,
      color: info.color,
      peakAltitude,
      peakDate,
      peakTransitTime,
      quality,
      monthlyData,
      description,
      ...(nightDataUnavailable ? { nightDataUnavailable: true } : {}),
    };
  });
}

/**
 * Tab 2: Calculate 20-Year Ephemeris & Best Observation Windows (2026 - 2045)
 */
export function calculate20YearEphemeris(
  startYear: number,
  location: UserLocation,
  yearsCount: number = 100
): EphemerisEvent20Y[] {
  const observer = createObserver(location);
  const events: EphemerisEvent20Y[] = [];

  const outerPlanets: { key: PlanetKey; nameIt: string }[] = [
    { key: 'Mars', nameIt: 'Marte' },
    { key: 'Jupiter', nameIt: 'Giove' },
    { key: 'Saturn', nameIt: 'Saturno' },
    { key: 'Uranus', nameIt: 'Urano' },
    { key: 'Neptune', nameIt: 'Nettuno' },
  ];

  for (let yr = startYear; yr < startYear + yearsCount; yr++) {
    // 1. Calculate Oppositions for Outer Planets in year `yr`
    for (const p of outerPlanets) {
      try {
        const body = p.key as Astronomy.Body;
        const searchTime = Astronomy.MakeTime(new Date(Date.UTC(yr, 0, 1)));
        // Opposition of a superior planet occurs at relative ecliptic longitude 0°
        const oppTime = Astronomy.SearchRelativeLongitude(body, 0, searchTime);

        if (oppTime && oppTime.date.getUTCFullYear() === yr) {
          const oppDate = oppTime.date;
          const monthIdx = oppDate.getUTCMonth();
          const monthName = MONTH_NAMES_IT[monthIdx];
          const dateStr = oppDate.toISOString().split('T')[0];

          // Culmination altitude at opposition
          const culmin = getCulminationAltitude(body, oppDate, observer);

          // Illumination and magnitude
          let mag = -2.0;
          let distAu = 4.0;
          let angularSize = 40;

          try {
            const illum = Astronomy.Illumination(body, oppTime);
            mag = Number(illum.mag.toFixed(1));
            distAu = Number(illum.geo_dist.toFixed(3));
            if (p.key === 'Jupiter') angularSize = Math.round(197 / distAu);
            else if (p.key === 'Mars') angularSize = Math.round(9.3 / distAu);
            else if (p.key === 'Saturn') angularSize = Math.round(165 / distAu);
            else angularSize = 4;
          } catch (e) {
            // Fallback estimation
          }

          // Rating score based on altitude and brightness
          const score = Math.min(100, Math.max(10, Math.round(culmin.maxAltitude * 1.1 - mag * 10)));

          events.push({
            year: yr,
            planetKey: p.key,
            planetNameIt: p.nameIt,
            eventType: 'Opposizione',
            dateStr,
            monthName,
            maxAltitude: culmin.maxAltitude,
            magnitude: mag,
            distanceAu: distAu,
            angularSizeArcsec: angularSize,
            detailsIt: `Opposizione di ${p.nameIt} nel mese di ${monthName} ${yr}. Culmina a ${culmin.maxAltitude}° sopra l'orizzonte di ${location.name}.`,
            score,
          });
        }
      } catch (e) {
        // Skip if opposition calculation for particular year is outside engine bounds
      }
    }

    // 2. Inner Planets Greatest Elongations (Venus & Mercury)
    for (const pKey of ['Venus', 'Mercury'] as PlanetKey[]) {
      try {
        const body = pKey as Astronomy.Body;
        const searchTime = Astronomy.MakeTime(new Date(Date.UTC(yr, 0, 1)));
        const elong = Astronomy.SearchMaxElongation(body, searchTime);

        if (elong && elong.time.date.getUTCFullYear() === yr) {
          const eDate = elong.time.date;
          const monthName = MONTH_NAMES_IT[eDate.getUTCMonth()];
          const culmin = getCulminationAltitude(body, eDate, observer);
          const pName = PLANETS_INFO[pKey].nameIt;

          events.push({
            year: yr,
            planetKey: pKey,
            planetNameIt: pName,
            eventType: 'Elongazione Max',
            dateStr: eDate.toISOString().split('T')[0],
            monthName,
            maxAltitude: culmin.maxAltitude,
            magnitude: pKey === 'Venus' ? -4.2 : -0.2,
            distanceAu: pKey === 'Venus' ? 0.7 : 0.9,
            angularSizeArcsec: pKey === 'Venus' ? 24 : 8,
            detailsIt: `Massima elongazione di ${pName} (${elong.elongation.toFixed(1)}° dal Sole) a ${monthName} ${yr}. Altezza max al crepuscolo: ${culmin.maxAltitude}°.`,
            score: Math.min(100, Math.max(20, Math.round(culmin.maxAltitude * 1.3 + elong.elongation))),
          });
        }
      } catch (e) {}
    }
  }

  // Sort chronologically
  return events.sort((a, b) => a.year - b.year);
}

/**
 * Solar Cycles Data generator (2026 - 2125, 100 Years)
 */
export function get20YearSolarCycleData(startYear: number = 2026, count: number = 100): SolarCycleYearInfo[] {
  const cycles: SolarCycleYearInfo[] = [];

  for (let yr = startYear; yr < startYear + count; yr++) {
    // Standard ~11 year solar cycle modeling starting cycle 25
    const yearsSince2020 = yr - 2020;
    const cycleOffset = Math.floor(yearsSince2020 / 11);
    const cycleNumber = 25 + cycleOffset;
    const yearInCycle = (yearsSince2020 % 11); // 0 to 10

    let activityIndex = 50;
    let phase: SolarCycleYearInfo['phase'] = 'Crescita';
    let recommendationIt = '';

    if (yearInCycle >= 3 && yearInCycle <= 5) {
      phase = 'Massimo';
      activityIndex = yearInCycle === 4 ? 98 : 88;
      recommendationIt = `Fase del Massimo Solare (Ciclo ${cycleNumber}): Elevata densita di macchie solari e protuberanze in banda H-Alfa.`;
    } else if (yearInCycle >= 6 && yearInCycle <= 8) {
      phase = 'Decadimento';
      activityIndex = Math.max(20, 80 - (yearInCycle - 5) * 20);
      recommendationIt = `Fase di decadimento del Ciclo ${cycleNumber}: Progressiva diminuzione delle macchie solari.`;
    } else if (yearInCycle >= 9 || yearInCycle === 0) {
      phase = 'Minimo';
      activityIndex = 10 + (yearInCycle === 0 ? 5 : 0);
      recommendationIt = `Minimo Solare transitorio del Ciclo ${cycleNumber}: Disco solare prevalentemente quieto.`;
    } else {
      phase = 'Crescita';
      activityIndex = 30 + yearInCycle * 25;
      recommendationIt = `Inizio della fase ascensionale del Ciclo ${cycleNumber}: Nuovi gruppi di macchie solari.`;
    }

    cycles.push({
      year: yr,
      cycleNumber,
      phase,
      activityIndex,
      recommendationIt,
    });
  }

  return cycles;
}

/**
 * Tab 3: Saturn Ring Opening Inclination & Golden Years Ranking (2026 - 2125, 100 Years)
 */
export function calculateSaturn20YearRings(
  startYear: number = 2026,
  location: UserLocation,
  yearsCount: number = 100
): SaturnYearData[] {
  const observer = createObserver(location);
  const results: SaturnYearData[] = [];

  for (let yr = startYear; yr < startYear + yearsCount; yr++) {
    // Opposition date or peak mid-year date for Saturn in `yr`
    let sampleDate = new Date(Date.UTC(yr, 8, 1, 0, 0, 0)); // Mid September default
    try {
      const searchTime = Astronomy.MakeTime(new Date(Date.UTC(yr, 0, 1)));
      const oppTime = Astronomy.SearchRelativeLongitude('Saturn' as Astronomy.Body, 0, searchTime);
      if (oppTime && oppTime.date.getUTCFullYear() === yr) {
        sampleDate = oppTime.date;
      }
    } catch (e) {}

    const astroTime = Astronomy.MakeTime(sampleDate);

    // Calculate Saturn's ring opening angle B (in degrees) and apparent magnitude
    let ringTiltDeg = 0;
    let magnitude = 0.8;
    try {
      const illum = Astronomy.Illumination('Saturn' as Astronomy.Body, astroTime);
      ringTiltDeg = Number((illum.ring_tilt ?? 0).toFixed(1));
      magnitude = Number(illum.mag.toFixed(1));
    } catch (e) {
      // Numerical approximation formula for Saturn ring tilt (period = 29.4 years)
      const dYears = yr - 2025;
      ringTiltDeg = Number((Math.sin((dYears / 29.4) * 2 * Math.PI) * 26.7).toFixed(1));
      magnitude = Number((0.8 - (Math.abs(ringTiltDeg) / 26.7) * 0.9).toFixed(1));
    }

    const ringTiltAbs = Math.abs(ringTiltDeg);

    // Culmination height at user latitude
    const culmin = getCulminationAltitude('Saturn' as Astronomy.Body, sampleDate, observer);
    const maxAltitude = culmin.maxAltitude;

    // Composite Rating Score (0 to 100) combining Ring Tilt + Meridian Altitude
    const altitudeComponent = Math.min(1, maxAltitude / 60) * 50; // up to 50 pts
    const tiltComponent = (ringTiltAbs / 27) * 50; // up to 50 pts
    const score = Math.min(100, Math.max(10, Math.round(altitudeComponent + tiltComponent)));

    let recommendation = '';
    if (ringTiltAbs < 3) {
      recommendation = 'Anelli quasi di taglio ("Edge-On"). Prospettiva unica per osservare i satelliti maggiori e l\'ombra sottile sul globo!';
    } else if (ringTiltAbs < 12) {
      recommendation = 'Anelli in fase di riapertura. Divisione di Cassini visibile agli estremi (anse).';
    } else if (ringTiltAbs < 20) {
      recommendation = 'Ottima inclinazione! La Divisione di Cassini e scolpita nettamente e l\'Anello C e osservabile con buon seeing.';
    } else {
      recommendation = 'ANNO D\'ORO! Inclinazione massima degli anelli (~25°-27°). Dettagli mozzafiato del sistema di anelli e delle strutture atmosferiche!';
    }

    results.push({
      year: yr,
      datePeakStr: sampleDate.toISOString().split('T')[0],
      ringTiltDeg,
      ringTiltAbs,
      maxAltitude,
      magnitude,
      score,
      recommendation,
    });
  }

  return results;
}

/**
 * Formats a peak eclipse instant in UTC using an Italian date format, so the
 * displayed date and time are the same for every viewer.
 */
function formatEclipsePeakUtc(date: Date): string {
  const dateStr = date.toLocaleDateString('it-IT', {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  return `${dateStr}, ${hh}:${mm} UTC`;
}

/**
 * Tab 4: Calculate Solar & Lunar Eclipses visible at user location (2026 - 2045)
 */
export function calculateEclipsesForLocation(
  startYear: number = 2026,
  endYear: number = 2125,
  location: UserLocation
): EclipseEvent[] {
  const observer = createObserver(location);
  const list: EclipseEvent[] = [];
  const seenIds = new Set<string>();

  const stopDate = new Date(Date.UTC(endYear + 1, 0, 1));

  // 1. Solar Eclipses search loop - computes local circumstances (obscuration,
  // altitude, visibility) directly for the observer's coordinates.
  try {
    let loopTime = Astronomy.MakeTime(new Date(Date.UTC(startYear, 0, 1)));
    for (let i = 0; i < 400; i++) {
      const eclipse = Astronomy.SearchLocalSolarEclipse(loopTime, observer);
      if (!eclipse) break;
      const peakDate = eclipse.peak.time.date;
      if (peakDate > stopDate) break;

      const yr = peakDate.getUTCFullYear();
      const dateStr = peakDate.toISOString().split('T')[0];
      const id = `${dateStr}-solar`;

      if (yr >= startYear && yr <= endYear && !seenIds.has(id)) {
        seenIds.add(id);

        const bodyAlt = Math.round(eclipse.peak.altitude);
        const obscuration = Math.round(eclipse.obscuration * 100);
        const isVisibleLocally = bodyAlt > 0;

        let localType: EclipseEvent['type'] = 'solar_partial';
        if (eclipse.kind === Astronomy.EclipseKind.Total) localType = 'solar_total';
        else if (eclipse.kind === Astronomy.EclipseKind.Annular) localType = 'solar_annular';

        let typeIt = 'Eclisse Solare Parziale';
        if (localType === 'solar_total') typeIt = 'Eclisse Solare Totale';
        else if (localType === 'solar_annular') typeIt = 'Eclisse Solare Anulare';

        const detailsIt = isVisibleLocally
          ? `Visibile dalle tue coordinate (${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°)! Oscuramento locale: ${obscuration}%, altezza del Sole al culmine: ${bodyAlt}° sopra l'orizzonte.`
          : `Non visibile direttamente dalle tue coordinate (il Sole si trova sotto l'orizzonte a ${bodyAlt}° durante la fase massima).`;

        list.push({
          id,
          type: localType,
          typeIt,
          isSolar: true,
          peakTime: peakDate.toISOString(),
          peakTimeLocal: formatEclipsePeakUtc(peakDate),
          year: yr,
          obscurationPercent: obscuration,
          bodyAltitudeAtPeak: bodyAlt,
          isVisibleLocally,
          detailsIt,
        });
      }

      // advance 20 days past this local event before searching for the next one
      loopTime = Astronomy.MakeTime(new Date(peakDate.getTime() + 20 * 86400 * 1000));
    }
  } catch (e) {
    // Skip if search reaches engine limits
  }

  // 2. Lunar Eclipses search loop - obscuration is the same for every
  // observer who can see the Moon; only visibility and altitude are local.
  try {
    let loopTime = Astronomy.MakeTime(new Date(Date.UTC(startYear, 0, 1)));
    for (let i = 0; i < 250; i++) {
      const eclipse = Astronomy.SearchLunarEclipse(loopTime);
      if (!eclipse || eclipse.peak.date > stopDate) break;

      const peakDate = eclipse.peak.date;
      const yr = peakDate.getUTCFullYear();
      const dateStr = peakDate.toISOString().split('T')[0];
      const id = `${dateStr}-lunar`;

      if (yr >= startYear && yr <= endYear && !seenIds.has(id)) {
        seenIds.add(id);

        const astroTime = Astronomy.MakeTime(peakDate);
        const equator = Astronomy.Equator('Moon' as Astronomy.Body, astroTime, observer, true, true);
        const horiz = Astronomy.Horizon(astroTime, observer, equator.ra, equator.dec, 'normal');
        const bodyAlt = Math.round(horiz.altitude);

        let localType: EclipseEvent['type'] = 'lunar_partial';
        if (eclipse.kind === Astronomy.EclipseKind.Total) localType = 'lunar_total';
        else if (eclipse.kind === Astronomy.EclipseKind.Penumbral) localType = 'lunar_penumbral';

        const isVisibleLocally = bodyAlt > -10;
        const obscuration = isVisibleLocally ? Math.round(eclipse.obscuration * 100) : 0;

        let typeIt = 'Eclisse Lunare Parziale';
        if (localType === 'lunar_total') typeIt = 'Eclisse Lunare Totale';
        else if (localType === 'lunar_penumbral') typeIt = 'Eclisse Lunare Penombrale';

        const detailsIt = isVisibleLocally
          ? `Visibile dalle tue coordinate! Altezza della Luna alla fase massima: ${bodyAlt}° sopra l'orizzonte.`
          : `Sotto l'orizzonte locale (${bodyAlt}°) al momento della fase massima.`;

        list.push({
          id,
          type: localType,
          typeIt,
          isSolar: false,
          peakTime: peakDate.toISOString(),
          peakTimeLocal: formatEclipsePeakUtc(peakDate),
          year: yr,
          obscurationPercent: obscuration,
          bodyAltitudeAtPeak: bodyAlt,
          isVisibleLocally,
          detailsIt,
        });
      }

      // advance 20 days
      loopTime = Astronomy.MakeTime(new Date(peakDate.getTime() + 20 * 86400 * 1000));
    }
  } catch (e) {
    // Skip if search reaches engine limits
  }

  return list.sort((a, b) => new Date(a.peakTime).getTime() - new Date(b.peakTime).getTime());
}

export const LIBRATION_DIRECTION_LABELS: Record<LibrationDirection, string> = {
  N: 'Nord',
  NE: 'Nord-Est',
  E: 'Est',
  SE: 'Sud-Est',
  S: 'Sud',
  SW: 'Sud-Ovest',
  W: 'Ovest',
  NW: 'Nord-Ovest',
};

export const LIBRATION_FEATURES: Record<LibrationDirection, string> = {
  E: 'Mare Marginis, Mare Smythii',
  W: 'Mare Orientale, cratere Grimaldi',
  N: 'Mare Frigoris, crateri polari Byrd e Peary',
  S: 'Mare Australe, bordo del bacino Aitken',
  NE: 'Mare Humboldtianum',
  NW: 'Sinus Roris, crateri Pythagoras e Xenophanes',
  SE: 'Crateri Furnerius e Petavius',
  SW: 'Crateri Bailly, Schickard e Hausen',
};

/**
 * Classifies a libration offset into one of eight compass sectors, using
 * the optical libration convention where positive longitude exposes the
 * eastern limb and positive latitude exposes the northern limb.
 */
function classifyLibrationDirection(elon: number, elat: number): LibrationDirection {
  const angleDeg = (Math.atan2(elat, elon) * 180) / Math.PI;
  const normalized = (angleDeg + 360) % 360;
  const sectors: LibrationDirection[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  return sectors[Math.round(normalized / 45) % 8];
}

// Approximate selenographic longitude of each direction's exposed limb,
// derived from its compass angle projected onto the 90 degree limb circle.
const LIMB_LONGITUDE_DEG: Record<LibrationDirection, number> = {
  E: 90,
  NE: 64,
  N: 0,
  NW: -64,
  W: -90,
  SW: -64,
  S: 0,
  SE: 64,
};

function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

/**
 * Whether a given limb direction is on the sunlit side of the Moon at a
 * given date. The Sun's selenographic colongitude is derived from the
 * Moon's phase angle (subsolar longitude = 180 - phase, in the same
 * +East/-West convention as optical libration); a point is illuminated
 * when it lies within 90 degrees of that colongitude. Latitude is ignored,
 * since the Moon's ~1.5 degree axial tilt makes it negligible for this check.
 */
function isLimbIlluminated(direction: LibrationDirection, date: Date): boolean {
  const phaseAngle = Astronomy.MoonPhase(date);
  const subsolarLon = normalizeAngleDeg(180 - phaseAngle);
  const separation = Math.abs(normalizeAngleDeg(LIMB_LONGITUDE_DEG[direction] - subsolarLon));
  return separation < 90;
}

/**
 * Tab 6: Identify favorable lunar libration events for edge/limb observation
 * across a given year, starting from today (past dates in the current year
 * are excluded; future years are returned in full). Events where the
 * favorable limb is on the Moon's night side at the time of peak libration
 * are dropped, since the exposed terrain would not actually be visible.
 * Libration is a geocentric phenomenon (the same for every observer on
 * Earth, aside from a negligible parallax correction), so this does not
 * depend on the user's location.
 */
export function calculateLunarLibrationEvents(year: number): LunarLibrationEvent[] {
  const startOfYear = Date.UTC(year, 0, 1, 12, 0, 0);
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;

  const samples: { date: Date; elon: number; elat: number; magnitude: number }[] = [];
  for (let d = 0; d < daysInYear; d++) {
    const date = new Date(startOfYear + d * 86400 * 1000);
    const libration = Astronomy.Libration(date);
    const magnitude = Math.sqrt(libration.elon * libration.elon + libration.elat * libration.elat);
    samples.push({ date, elon: libration.elon, elat: libration.elat, magnitude });
  }

  const MIN_MAGNITUDE_DEG = 6.0;
  const PEAK_WINDOW_DAYS = 4;
  const todayStartMs = new Date().setUTCHours(0, 0, 0, 0);
  const events: LunarLibrationEvent[] = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample.date.getTime() < todayStartMs) continue;
    if (sample.magnitude < MIN_MAGNITUDE_DEG) continue;

    let isLocalPeak = true;
    for (let j = Math.max(0, i - PEAK_WINDOW_DAYS); j <= Math.min(samples.length - 1, i + PEAK_WINDOW_DAYS); j++) {
      if (j !== i && samples[j].magnitude > sample.magnitude) {
        isLocalPeak = false;
        break;
      }
    }
    if (!isLocalPeak) continue;

    const direction = classifyLibrationDirection(sample.elon, sample.elat);
    if (!isLimbIlluminated(direction, sample.date)) continue;

    const illum = Astronomy.Illumination('Moon' as Astronomy.Body, Astronomy.MakeTime(sample.date));

    let quality: LunarLibrationEvent['quality'] = 'Buona';
    if (sample.magnitude >= 9) quality = 'Eccezionale';
    else if (sample.magnitude >= 7.5) quality = 'Ottima';

    events.push({
      dateStr: sample.date.toISOString().split('T')[0],
      timestamp: sample.date.getTime(),
      elon: Number(sample.elon.toFixed(1)),
      elat: Number(sample.elat.toFixed(1)),
      totalLibration: Number(sample.magnitude.toFixed(1)),
      direction,
      moonIlluminationPercent: Math.round(illum.phase_fraction * 100),
      quality,
      favorableFeatures: LIBRATION_FEATURES[direction],
    });
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Computes the Moon's libration state for a single instant, used to drive
 * the interactive libration visualizer independently of the yearly event list.
 */
export function getMoonLibrationSnapshot(date: Date): LibrationSnapshot {
  const libration = Astronomy.Libration(date);
  const magnitude = Math.sqrt(libration.elon * libration.elon + libration.elat * libration.elat);
  const illum = Astronomy.Illumination('Moon' as Astronomy.Body, Astronomy.MakeTime(date));

  return {
    elon: Number(libration.elon.toFixed(1)),
    elat: Number(libration.elat.toFixed(1)),
    magnitude: Number(magnitude.toFixed(1)),
    direction: classifyLibrationDirection(libration.elon, libration.elat),
    illuminationPercent: Math.round(illum.phase_fraction * 100),
  };
}

/**
 * Best local viewing window for the Moon on a given calendar date, for
 * pairing a favorable libration event with the observer's own coordinates.
 */
export function getMoonCulminationForDate(
  date: Date,
  location: UserLocation
): { maxAltitude: number; transitTimeStr: string; azimuth: number } {
  const observer = createObserver(location);
  const culmin = getCulminationAltitude('Moon' as Astronomy.Body, date, observer);
  return {
    maxAltitude: culmin.maxAltitude,
    transitTimeStr: formatUtcTime(culmin.transitTime),
    azimuth: culmin.azimuth,
  };
}

function formatUtcTime(date: Date): string {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const mins = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${mins} UTC`;
}

/**
 * Moonrise, meridian transit and moonset times for the observer's location
 * on a given calendar date (UTC day boundaries). Rise or set may be absent
 * on a given day since the Moon's rise/set times drift by roughly 50
 * minutes later each day.
 */
export function getMoonRiseTransitSetForDate(
  date: Date,
  location: UserLocation
): { riseStr: string | null; transitStr: string; setStr: string | null } {
  const observer = createObserver(location);
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));

  const riseTime = Astronomy.SearchRiseSet('Moon' as Astronomy.Body, observer, 1, dayStart, 1);
  const setTime = Astronomy.SearchRiseSet('Moon' as Astronomy.Body, observer, -1, dayStart, 1);
  const culmin = getCulminationAltitude('Moon' as Astronomy.Body, date, observer);

  return {
    riseStr: riseTime ? formatUtcTime(riseTime.date) : null,
    transitStr: formatUtcTime(culmin.transitTime),
    setStr: setTime ? formatUtcTime(setTime.date) : null,
  };
}
