import { UserLocation } from '../types';

export const PRESET_OBSERVATORIES: UserLocation[] = [
  { name: 'Roma, Italia', latitude: 41.9028, longitude: 12.4964, elevation: 52, country: 'Italia' },
  { name: 'Milano, Italia', latitude: 45.4642, longitude: 9.19, elevation: 120, country: 'Italia' },
  { name: 'Napoli, Italia', latitude: 40.8518, longitude: 14.2681, elevation: 17, country: 'Italia' },
  { name: 'Palermo, Italia', latitude: 38.1157, longitude: 13.3615, elevation: 14, country: 'Italia' },
  { name: 'Osservatorio del Paranal (Atacama, Cile)', latitude: -24.6275, longitude: -70.4044, elevation: 2635, country: 'Cile' },
  { name: 'Mauna Kea Observatory (Hawaii)', latitude: 19.8207, longitude: -155.4681, elevation: 4207, country: 'USA' },
  { name: 'Parigi, Francia', latitude: 48.8566, longitude: 2.3522, elevation: 35, country: 'Francia' },
  { name: 'New York, USA', latitude: 40.7128, longitude: -74.006, elevation: 10, country: 'USA' },
  { name: 'Tokyo, Giappone', latitude: 35.6762, longitude: 139.6503, elevation: 40, country: 'Giappone' },
];

/**
 * Search locations using Open-Meteo Geocoding API
 */
export async function searchLocationsOnline(query: string): Promise<UserLocation[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=8&language=it&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch geocoding data');

    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((item: any) => {
      const parts = [item.name];
      if (item.admin1) parts.push(item.admin1);
      if (item.country) parts.push(item.country);

      return {
        name: parts.join(', '),
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        elevation: Number(item.elevation || 0),
        country: item.country || '',
      };
    });
  } catch (err) {
    console.warn('Open-Meteo Geocoding fallback to Nominatim:', err);
    return searchNominatimFallback(query);
  }
}

async function searchNominatimFallback(query: string): Promise<UserLocation[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=6&accept-language=it`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AstroCalApp/1.0' },
    });
    if (!res.ok) return [];

    const data = await res.json();
    return data.map((item: any) => ({
      name: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      elevation: 50,
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Get user location from browser GPS
 */
export function getCurrentGpsPosition(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalizzazione GPS non supportata dal browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        resolve({
          name: `Posizione GPS (${lat}°, ${lon}°)`,
          latitude: lat,
          longitude: lon,
          elevation: 50,
        });
      },
      (err) => {
        reject(err);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}
