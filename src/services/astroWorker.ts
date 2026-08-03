import { UserLocation } from '../types';
import {
  calculate20YearEphemeris,
  get20YearSolarCycleData,
  calculateSaturn20YearRings,
  calculateEclipsesForLocation,
} from './astroEngine';

export type AstroWorkerRequestType = 'ephemeris100' | 'saturn100' | 'eclipses100';

export interface AstroWorkerRequest {
  id: number;
  type: AstroWorkerRequestType;
  location: UserLocation;
}

export interface AstroWorkerResponse {
  id: number;
  type: AstroWorkerRequestType;
  result: unknown;
}

// Cast avoids pulling in the "webworker" lib (which conflicts with the
// project-wide "DOM" lib already required by the React app).
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<AstroWorkerRequest>) => void) | null;
  postMessage: (message: AstroWorkerResponse) => void;
};

ctx.onmessage = (event) => {
  const { id, type, location } = event.data;
  let result: unknown;

  switch (type) {
    case 'ephemeris100':
      result = {
        events: calculate20YearEphemeris(2026, location, 100),
        solarCycle: get20YearSolarCycleData(2026, 100),
      };
      break;
    case 'saturn100':
      result = calculateSaturn20YearRings(2026, location, 100);
      break;
    case 'eclipses100':
      result = calculateEclipsesForLocation(2026, 2125, location);
      break;
  }

  ctx.postMessage({ id, type, result });
};
