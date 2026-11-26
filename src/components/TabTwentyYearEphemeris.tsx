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
    <div className="space-y-10">
      {/* Header Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Effemeridi</div>
          <h2 className="page-title">Opposizioni, elongazioni e cicli solari</h2>
          <p className="lead">
            Calcolo delle finestre d'osservazione ottimali per un intero secolo. Scorri i grafici per esplorare in quali anni i pianeti raggiungono la massima altezza al meridiano di {location.name} ({location.latitude.toFixed(2)}° N/S).
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-sm text-neutral-300">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-200" />
          Calcolo delle effemeridi su 100 anni in corso...
        </div>
      )}

      {!isLoading && (
      <>
      {/* 100-Year Opposition Culmination Curve Chart */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2 text-neutral-100">
            Altezza alle opposizioni (2026–2125)
          </h3>
          <p className="text-xs text-neutral-400">
            Altezza massima sull'orizzonte di Marte, Giove e Saturno all'opposizione annuale
          </p>
        </div>

        {/* Scrollable Container for 100-Year Chart */}
        <div className="overflow-x-auto scrollbar-thin touch-pan-x border border-neutral-800 rounded-md p-2 bg-neutral-950">
          <div className="h-64 sm:h-72 min-w-[2200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={oppositionAltitudesChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="year" stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} interval={1} />
                <YAxis stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} domain={[0, 90]} unit="°" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-neutral-950 border border-neutral-700 p-3 rounded-md text-xs space-y-1">
                          <div className="font-semibold text-neutral-100 mb-1">Anno {label}</div>
                          {payload.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-neutral-300">{p.name}:</span>
                              <span className="font-semibold text-white">
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
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2 text-neutral-200">
              Cicli di attività solare (2026–2125)
            </h3>
            <p className="text-xs text-neutral-400">
              Evoluzione dell'indice di attività elio-fisica e macchie solari sui cicli dal 25 al 34
            </p>
          </div>
          <span className="text-xs text-neutral-100 bg-neutral-900/50 border border-neutral-700 px-3 py-1 rounded-lg flex items-center gap-1.5 self-start sm:self-auto">
            Scorri o trascina per esplorare 100 anni
          </span>
        </div>

        {/* Scrollable Container for Solar Cycle Area Chart */}
        <div className="overflow-x-auto scrollbar-thin touch-pan-x border border-neutral-800 rounded-md p-2 bg-neutral-950">
          <div className="h-48 sm:h-56 min-w-[2200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={solarCycleData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b89a6a" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#b89a6a" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="year" stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} interval={1} />
                <YAxis stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} domain={[0, 100]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-neutral-950 border border-neutral-700 p-3 rounded-md text-xs space-y-1">
                          <div className="font-semibold text-neutral-200">
                            Anno {data.year} - Ciclo {data.cycleNumber} ({data.phase})
                          </div>
                          <div>Indice Attività: <span className="font-semibold text-white">{data.activityIndex} / 100</span></div>
                          <p className="text-[11px] text-neutral-300 mt-1 max-w-xs">{data.recommendationIt}</p>
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
                  stroke="#b89a6a"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-4 rounded-md">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-200" />
            <span className="text-xs font-semibold text-neutral-200">Filtra per Oggetto Celeste:</span>
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
                    ? 'bg-neutral-100 text-neutral-950 '
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
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
                className="bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 rounded-lg p-5 flex flex-col justify-between transition group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-base"
                        style={{ backgroundColor: `${pInfo.color}25`, color: pInfo.color }}
                      >
                        {pInfo.symbol}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-neutral-200 block">
                          Anno {ev.year} • {ev.monthName}
                        </span>
                        <h4 className="font-semibold text-sm text-neutral-100 group-hover:text-neutral-100">
                          {ev.planetNameIt} ({ev.eventType})
                        </h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-neutral-200">{ev.maxAltitude}°</div>
                      <div className="text-[10px] text-neutral-500">Altezza Max</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 bg-neutral-950 p-2.5 rounded-md text-center border border-neutral-800/80 text-[11px]">
                    <div>
                      <div className="text-neutral-500">Mag. Apparente</div>
                      <div className="font-semibold text-neutral-200">{ev.magnitude}</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Diam. Angolare</div>
                      <div className="font-semibold text-neutral-200">{ev.angularSizeArcsec}"</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Punteggio</div>
                      <div className="font-semibold text-neutral-200">{ev.score}/100</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-neutral-300 leading-relaxed">
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
