import React, { useState } from 'react';
import { UserLocation } from '../types';
import { PRESET_OBSERVATORIES, searchLocationsOnline, getCurrentGpsPosition } from '../services/geocoding';
import { Search, MapPin, Navigation, X, Check, Globe } from 'lucide-react';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (loc: UserLocation) => void;
  currentLocation: UserLocation;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  currentLocation,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Manual Coordinates
  const [manualLat, setManualLat] = useState(currentLocation.latitude.toString());
  const [manualLon, setManualLon] = useState(currentLocation.longitude.toString());
  const [manualName, setManualName] = useState(currentLocation.name);

  if (!isOpen) return null;

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    const results = await searchLocationsOnline(query);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleGpsClick = async () => {
    setIsGpsLoading(true);
    try {
      const pos = await getCurrentGpsPosition();
      onSelectLocation(pos);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Errore nella rilevazione GPS. Assicurati di aver dato il permesso al browser.');
    } finally {
      setIsGpsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      alert('Inserisci coordinate valide (Latitudine -90° a +90°, Longitudine -180° a +180°).');
      return;
    }
    onSelectLocation({
      name: manualName || `Coordinate Custom (${lat}°, ${lon}°)`,
      latitude: lat,
      longitude: lon,
      elevation: 50,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-lg max-w-2xl w-full p-6 text-neutral-100 overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-neutral-200" />
            <h2 className="text-lg font-semibold">Luogo di osservazione</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6 pt-4 pr-1">
          {/* Automatic Geospatial Search */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-2">
              Cerca una città, un luogo o un osservatorio
            </label>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Es. Roma, Firenze, Pic du Midi, Mauna Kea..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-md pl-9 pr-4 py-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2.5 bg-accent hover:bg-accent-soft text-ink font-semibold rounded-md text-xs transition-colors disabled:opacity-50"
              >
                {isSearching ? 'Cerca...' : 'Cerca'}
              </button>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 bg-neutral-950 border border-neutral-800 rounded-md divide-y divide-neutral-800/80 max-h-48 overflow-y-auto">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectLocation(res);
                      onClose();
                    }}
                    className="w-full text-left p-3 hover:bg-neutral-800/60 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-neutral-200 group-hover:text-neutral-100">
                        {res.name}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Lat: {res.latitude.toFixed(4)}°, Lon: {res.longitude.toFixed(4)}°
                        {res.elevation ? ` • Elev: ${res.elevation}m` : ''}
                      </div>
                    </div>
                    <MapPin className="w-4 h-4 text-neutral-500 group-hover:text-neutral-200" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GPS Location Button */}
          <div className="bg-neutral-900/40 border border-neutral-700 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-neutral-50 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-neutral-200" />
                Posizione dal GPS
              </div>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                Usa la posizione precisa fornita dal tuo dispositivo
              </div>
            </div>
            <button
              onClick={handleGpsClick}
              disabled={isGpsLoading}
              className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-950 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
              {isGpsLoading ? 'Rilevamento...' : 'Usa il GPS'}
            </button>
          </div>

          {/* Preset Locations */}
          <div>
            <div className="text-xs font-semibold text-neutral-300 mb-2">
              Osservatori e città
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_OBSERVATORIES.map((loc, idx) => {
                const isSelected = currentLocation.name === loc.name;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectLocation(loc);
                      onClose();
                    }}
                    className={`text-left p-2.5 rounded-md border text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-white/[0.04] border-neutral-400 text-white'
                        : 'bg-neutral-950/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-medium truncate">{loc.name}</div>
                      <div className="text-[10px] text-neutral-500">
                        {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-neutral-200 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual Lat/Lon Entry */}
          <div className="border-t border-neutral-800 pt-4">
            <div className="text-xs font-semibold text-neutral-300 mb-2">
              Coordinate manuali
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Nome del luogo (opzionale)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    Latitudine (° Nord/Sud)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    Longitudine (° Est/Ovest)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg transition"
              >
                Imposta le coordinate
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
