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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold">Seleziona Luogo di Osservazione</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-6 pt-4 pr-1">
          {/* Automatic Geospatial Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Ricerca Geospatiale Automatizzata (Città, Luogo, Osservatorio)
            </label>
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Es. Roma, Firenze, Pic du Midi, Mauna Kea..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50"
              >
                {isSearching ? 'Cerca...' : 'Cerca'}
              </button>
            </form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 max-h-48 overflow-y-auto">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      onSelectLocation(res);
                      onClose();
                    }}
                    className="w-full text-left p-3 hover:bg-slate-800/60 transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-300">
                        {res.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Lat: {res.latitude.toFixed(4)}°, Lon: {res.longitude.toFixed(4)}°
                        {res.elevation ? ` • Elev: ${res.elevation}m` : ''}
                      </div>
                    </div>
                    <MapPin className="w-4 h-4 text-slate-500 group-hover:text-amber-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* GPS Location Button */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-indigo-200 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-amber-400" />
                Rilevamento GPS Automatico dal Browser
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Usa la posizione precisa fornita dal tuo dispositivo
              </div>
            </div>
            <button
              onClick={handleGpsClick}
              disabled={isGpsLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shadow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
              {isGpsLoading ? 'Rilevamento...' : 'Usa Posizione GPS'}
            </button>
          </div>

          {/* Preset Locations */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Osservatori & Citta Predefinite
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
                    className={`text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="truncate">
                      <div className="font-medium truncate">{loc.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manual Lat/Lon Entry */}
          <div className="border-t border-slate-800 pt-4">
            <div className="text-xs font-semibold text-slate-300 mb-2">
              Inserimento Manuale Coordinate
            </div>
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Nome del luogo (opzionale)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Latitudine (° Nord/Sud)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Longitudine (° Est/Ovest)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
              >
                Imposta Coordinate Manuali
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
