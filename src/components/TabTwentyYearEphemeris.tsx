import React, { useState, useMemo } from 'react';
import { UserLocation, EphemerisEvent20Y, SolarCycleYearInfo, PlanetKey } from '../types';
import { PLANETS_INFO } from '../services/astroEngine';
import { useAstroWorkerData } from '../hooks/useAstroWorkerData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { Calendar, Sun, Filter, Star, Sparkles, ChevronRight, Loader2 } from 'lucide-react';
import { ApexIcon } from './ApexIcon';

interface TabTwentyYearEphemerisProps {
  location: UserLocation;
}

interface Ephemeris100Result {
  events: EphemerisEvent20Y[];
  solarCycle: SolarCycleYearInfo[];
}

export const TabTwentyYearEphemeris: React.FC<TabTwentyYearEphemerisProps> = ({ location }) => {
  const [filterPlanet, setFilterPlanet] = useState<string>('ALL');

  // Compute 100-year ephemeris + solar cycle off the main thread
  const { data, isLoading } = useAstroWorkerData<Ephemeris100Result>('ephemeris100', location);
  const ephemerisEvents = data?.events ?? [];
  const solarCycleData = data?.solarCycle ?? [];

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filterPlanet === 'ALL') return ephemerisEvents;
    return ephemerisEvents.filter((e) => e.planetKey === filterPlanet);
  }, [ephemerisEvents, filterPlanet]);

  // Chart data: Opposition altitudes over 2026 - 2125 for Mars, Jupiter, Saturn
  const oppositionAltitudesChartData = useMemo(() => {
    const years = Array.from({ length: 100 }, (_, i) => 2026 + i);
    return years.map((yr) => {
      const marsOpp = ephemerisEvents.find((e) => e.year === yr && e.planetKey === 'Mars');
      const jupOpp = ephemerisEvents.find((e) => e.year === yr && e.planetKey === 'Jupiter');
      const satOpp = ephemerisEvents.find((e) => e.year === yr && e.planetKey === 'Saturn');

      return {
        year: yr,
        Marte: marsOpp ? marsOpp.maxAltitude : null,
        Giove: jupOpp ? jupOpp.maxAltitude : null,
        Saturno: satOpp ? satOpp.maxAltitude : null,
      };
    });
  }, [ephemerisEvents]);

  return (
    <div className="space-y-8 text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-0 p-2 opacity-10 pointer-events-none">
          <ApexIcon className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Calendar className="w-4 h-4" />
            Previsioni Astronomiche
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
            Opposizioni, Elongazioni & Cicli Solari
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Calcolo delle finestre d'osservazione ottimali per un intero secolo. Scorri i grafici per esplorare in quali anni i pianeti raggiungono la massima altezza al meridiano di {location.name} ({location.latitude.toFixed(2)}° N/S).
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          Calcolo delle effemeridi su 100 anni in corso...
        </div>
      )}

      {!isLoading && (
      <>
      {/* 100-Year Opposition Culmination Curve Chart */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2 text-amber-300">
            <Sparkles className="w-4 h-4" />
            Evoluzione Altezze alle Opposizioni (2026 - 2125)
          </h3>
          <p className="text-xs text-slate-400">
            Altezza massima sull'orizzonte di Marte, Giove e Saturno all'opposizione annuale
          </p>
        </div>

        {/* Scrollable Container for 100-Year Chart */}
        <div className="overflow-x-auto scrollbar-thin touch-pan-x border border-slate-800 rounded-xl p-2 bg-slate-950">
          <div className="h-64 sm:h-72 min-w-[2200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={oppositionAltitudesChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} interval={1} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 90]} unit="°" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-xs space-y-1 shadow-2xl">
                          <div className="font-bold text-amber-300 mb-1">Anno {label}</div>
                          {payload.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-slate-300">{p.name}:</span>
                              <span className="font-bold text-white">
                                {p.value !== null ? `${p.value}°` : 'Nessuna opposizione'}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="Giove"
                  name="Giove"
                  stroke={PLANETS_INFO.Jupiter.color}
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 2.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="Marte"
                  name="Marte"
                  stroke={PLANETS_INFO.Mars.color}
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 2.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="Saturno"
                  name="Saturno"
                  stroke={PLANETS_INFO.Saturn.color}
                  strokeWidth={2.5}
                  connectNulls
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Solar Cycles 100-Year Activity Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 text-amber-400">
              <Sun className="w-5 h-5 text-amber-400" />
              Cicli di Attività Solare per 100 Anni (2026 - 2125)
            </h3>
            <p className="text-xs text-slate-400">
              Evoluzione dell'indice di attività elio-fisica e macchie solari sui cicli dal 25 al 34
            </p>
          </div>
          <span className="text-xs text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-lg flex items-center gap-1.5 self-start sm:self-auto">
            ↔️ Scorri o trascina per esplorare 100 anni
          </span>
        </div>

        {/* Scrollable Container for Solar Cycle Area Chart */}
        <div className="overflow-x-auto scrollbar-thin touch-pan-x border border-slate-800 rounded-xl p-2 bg-slate-950">
          <div className="h-48 sm:h-56 min-w-[2200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={solarCycleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={11} interval={1} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-3 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-amber-400">
                            Anno {data.year} - Ciclo {data.cycleNumber} ({data.phase})
                          </div>
                          <div>Indice Attività: <span className="font-bold text-white">{data.activityIndex} / 100</span></div>
                          <p className="text-[11px] text-slate-300 mt-1 max-w-xs">{data.recommendationIt}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="activityIndex"
                  name="Attività Solare"
                  stroke="#f59e0b"
                  fillOpacity={1}
                  fill="url(#solarGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ephemeris Timeline & Filterable List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200">Filtra per Oggetto Celeste:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'ALL', label: 'Tutti' },
              { key: 'Mars', label: 'Marte' },
              { key: 'Jupiter', label: 'Giove' },
              { key: 'Saturn', label: 'Saturno' },
              { key: 'Venus', label: 'Venere' },
              { key: 'Mercury', label: 'Mercurio' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilterPlanet(btn.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  filterPlanet === btn.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Ephemeris Events */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((ev, idx) => {
            const pInfo = PLANETS_INFO[ev.planetKey];
            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-base"
                        style={{ backgroundColor: `${pInfo.color}25`, color: pInfo.color }}
                      >
                        {pInfo.symbol}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-400 block">
                          Anno {ev.year} • {ev.monthName}
                        </span>
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-300">
                          {ev.planetNameIt} ({ev.eventType})
                        </h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-amber-400">{ev.maxAltitude}°</div>
                      <div className="text-[10px] text-slate-500">Altezza Max</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl text-center border border-slate-800/80 text-[11px]">
                    <div>
                      <div className="text-slate-500">Mag. Apparente</div>
                      <div className="font-bold text-slate-200">{ev.magnitude}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Diam. Angolare</div>
                      <div className="font-bold text-slate-200">{ev.angularSizeArcsec}"</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Punteggio</div>
                      <div className="font-bold text-indigo-400">{ev.score}/100</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                    {ev.detailsIt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
};
