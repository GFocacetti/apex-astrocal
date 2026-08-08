import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserLocation, AnnualPlanetSummary, PlanetKey, InnerPlanetDayPoint } from '../types';
import {
  calculateAnnualPlanetSummaries,
  calculateInnerPlanetVisibility,
  calculateMonthlyAngularDiameters,
  PLANETS_INFO,
  MONTH_NAMES_IT,
} from '../services/astroEngine';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { Eye, Info, Sparkles, ChevronLeft, ChevronRight, ChevronDown, Sunrise, Sunset } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

function isInnerPlanet(key: PlanetKey): key is 'Mercury' | 'Venus' {
  return key === 'Mercury' || key === 'Venus';
}

interface FavorabilityBand {
  start: number;
  end: number;
  favorable: boolean;
}

function buildFavorabilityBands(points: InnerPlanetDayPoint[]): FavorabilityBand[] {
  if (points.length === 0) return [];
  const bands: FavorabilityBand[] = [];
  let segStart = points[0].dayIndex;
  let segFavorable = points[0].favorable;

  for (let i = 1; i < points.length; i++) {
    if (points[i].favorable !== segFavorable) {
      bands.push({ start: segStart, end: points[i - 1].dayIndex, favorable: segFavorable });
      segStart = points[i].dayIndex;
      segFavorable = points[i].favorable;
    }
  }
  bands.push({ start: segStart, end: points[points.length - 1].dayIndex, favorable: segFavorable });
  return bands;
}

interface TabAnnualMaxAltitudeProps {
  location: UserLocation;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
}

export const TabAnnualMaxAltitude: React.FC<TabAnnualMaxAltitudeProps> = ({
  location,
  selectedYear,
  setSelectedYear,
}) => {
  // Calculate annual summaries
  const summaries = useMemo(() => {
    return calculateAnnualPlanetSummaries(selectedYear, location);
  }, [selectedYear, location]);

  const [selectedPlanetKey, setSelectedPlanetKey] = useState<PlanetKey | null>(null);

  const [planetMenuOpen, setPlanetMenuOpen] = useState(false);
  const planetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (planetMenuRef.current && !planetMenuRef.current.contains(e.target as Node)) {
        setPlanetMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSummary = useMemo(() => {
    if (!selectedPlanetKey) return null;
    return summaries.find((s) => s.planetKey === selectedPlanetKey) ?? null;
  }, [summaries, selectedPlanetKey]);

  const innerVisibility = useMemo(() => {
    if (!selectedSummary || !isInnerPlanet(selectedSummary.planetKey)) return null;
    return calculateInnerPlanetVisibility(selectedSummary.planetKey, selectedYear, location);
  }, [selectedSummary, selectedYear, location]);

  const selectedDiamRatio = useMemo(() => {
    if (!selectedSummary?.angularDiameterArcsec || !selectedSummary.angularDiameterMaxArcsec) return null;
    return Math.round((selectedSummary.angularDiameterArcsec / selectedSummary.angularDiameterMaxArcsec) * 100);
  }, [selectedSummary]);

  // Apparent diameter sampled month-by-month, plotted as a second line on the chart.
  const monthlyDiameterData = useMemo(() => {
    if (!selectedSummary) return null;
    return calculateMonthlyAngularDiameters(selectedSummary.planetKey, selectedYear);
  }, [selectedSummary, selectedYear]);

  // Merged altitude + diameter dataset for the monthly (categorical) chart: a
  // single shared `data` array is required so the two Lines land on the same
  // 12 month categories instead of Recharts appending a second set of ticks.
  const monthlyChartData = useMemo(() => {
    if (!selectedSummary) return [];
    return selectedSummary.monthlyData.map((m, idx) => ({
      ...m,
      angularDiameterArcsec: monthlyDiameterData?.[idx]?.angularDiameterArcsec,
    }));
  }, [selectedSummary, monthlyDiameterData]);

  // Position of "today" on the chart, only when browsing the current calendar year.
  const todayMarker = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() !== selectedYear) return null;
    const dayIndex = Math.round(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12) - Date.UTC(selectedYear, 0, 1, 12)) / 86400000
    );
    return { dayIndex, monthName: MONTH_NAMES_IT[now.getMonth()].slice(0, 3) };
  }, [selectedYear]);

  // innerVisibility.points already carries a per-day angularDiameterArcsec, so the
  // altitude and diameter series share this exact same array - required for Recharts
  // to track a single, consistent hover index on the numeric day-axis.
  const dailyChartData = useMemo(() => {
    if (!innerVisibility) return [];
    return innerVisibility.points.map((p) => ({
      ...p,
      altitudeDisplay: Math.max(-25, p.altitudeAtTwilight),
    }));
  }, [innerVisibility]);

  const favorabilityBands = useMemo(() => {
    if (!innerVisibility) return [];
    return buildFavorabilityBands(innerVisibility.points);
  }, [innerVisibility]);

  const monthTicks = useMemo(() => {
    return Array.from({ length: 12 }, (_, month) => {
      const d15 = new Date(Date.UTC(selectedYear, month, 15, 12, 0, 0));
      const dayIndex = Math.round(
        (d15.getTime() - Date.UTC(selectedYear, 0, 1, 12, 0, 0)) / 86400000
      );
      return { value: dayIndex, label: MONTH_NAMES_IT[month].slice(0, 3) };
    });
  }, [selectedYear]);

  const monthTickFormatter = (value: number) => monthTicks.find((t) => t.value === value)?.label ?? '';

  const getQualityBadgeClass = (quality: AnnualPlanetSummary['quality']) => {
    switch (quality) {
      case 'Eccellente':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Buono':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'Discreto':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-0 p-2 opacity-10 pointer-events-none">
          <ApexIcon className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
            Calcola l'altezza massima dei pianeti per le tue osservazioni
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            I pianeti raggiungono la loro massima altezza sull'orizzonte e la migliore nitidezza atmosferica quando attraversano il meridiano del tuo luogo di osservazione (Latitudine {location.latitude.toFixed(2)}°). Minore è la massa d'aria traversata, minore sarà la turbolenza (seeing).
          </p>
        </div>
      </div>

      {/* Solar System Body Selector - placed right below the intro card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <label className="text-base font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <Eye className="w-5 h-5 text-cyan-400" />
          Scegli un corpo del sistema solare
        </label>
        <div className="relative w-full max-w-md" ref={planetMenuRef}>
          <button
            type="button"
            onClick={() => setPlanetMenuOpen((open) => !open)}
            className={`w-full flex items-center justify-between gap-3 pl-2.5 pr-4 py-2.5 rounded-xl border bg-slate-950 transition-all ${
              planetMenuOpen
                ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            {selectedPlanetKey ? (
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner shrink-0"
                  style={{
                    backgroundColor: `${PLANETS_INFO[selectedPlanetKey].color}20`,
                    color: PLANETS_INFO[selectedPlanetKey].color,
                  }}
                >
                  {PLANETS_INFO[selectedPlanetKey].symbol}
                </div>
                <span className="font-bold text-base text-amber-300 truncate">
                  {PLANETS_INFO[selectedPlanetKey].nameIt}
                </span>
              </div>
            ) : (
              <span className="text-slate-400">Seleziona...</span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                planetMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {planetMenuOpen && (
            <div className="absolute z-20 mt-2 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-y-auto max-h-80">
              {summaries.map((s) => {
                const info = PLANETS_INFO[s.planetKey];
                const isSel = s.planetKey === selectedPlanetKey;
                return (
                  <div
                    key={s.planetKey}
                    onClick={() => {
                      setSelectedPlanetKey(s.planetKey);
                      setPlanetMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      isSel ? 'bg-amber-500/10' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner shrink-0"
                      style={{ backgroundColor: `${info.color}20`, color: info.color }}
                    >
                      {info.symbol}
                    </div>
                    <span className={`font-semibold text-sm ${isSel ? 'text-amber-300' : 'text-slate-100'}`}>
                      {s.nameIt}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Year Navigation */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3 text-xs">
        <button
          onClick={() => setSelectedYear(Math.max(2026, selectedYear - 1))}
          disabled={selectedYear <= 2026}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Anno Precedente ({selectedYear - 1})</span>
        </button>

        <span className="text-slate-400 font-medium hidden sm:inline">
          Selezionato: <strong className="text-slate-100">Anno {selectedYear}</strong>
        </span>

        <button
          onClick={() => setSelectedYear(Math.min(2125, selectedYear + 1))}
          disabled={selectedYear >= 2125}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed font-semibold"
        >
          <span>Anno Successivo ({selectedYear + 1})</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Planet Data Table - appears only after a body has been chosen above */}
      {selectedSummary && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              Dati del corpo del sistema solare
            </h3>
            <span className="text-xs text-slate-400">
              {location.name} · Anno {selectedYear}
            </span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-800/80">
                <td className="px-4 py-3 text-slate-400 w-2/5">
                  {innerVisibility ? 'Apex (Migliore Finestra)' : 'Apex (Data e Ora Culmine)'}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-100">
                  {selectedSummary.peakDate}
                  {!innerVisibility && selectedSummary.peakTransitTime ? ` · ${selectedSummary.peakTransitTime}` : ''}
                </td>
              </tr>
              <tr className="border-b border-slate-800/80">
                <td className="px-4 py-3 text-slate-400">Altezza Massima</td>
                <td className="px-4 py-3 font-bold text-amber-400">{selectedSummary.peakAltitude}°</td>
              </tr>
              {selectedSummary.angularDiameterArcsec !== undefined && (
                <tr className="border-b border-slate-800/80">
                  <td className="px-4 py-3 text-slate-400">Diametro Apparente</td>
                  <td className="px-4 py-3 font-semibold text-cyan-300">
                    {selectedSummary.angularDiameterArcsec}″
                    {selectedSummary.angularDiameterMaxArcsec !== undefined && selectedDiamRatio !== null && (
                      <span className="text-slate-400 font-normal">
                        {' '}
                        (massimo {selectedSummary.angularDiameterMaxArcsec}″{' '}
                        {PLANETS_INFO[selectedSummary.planetKey].type === 'planet_inner'
                          ? 'alla congiunzione inferiore'
                          : "all'opposizione"}
                        , {selectedDiamRatio}% del massimo)
                      </span>
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-4 py-3 text-slate-400">Qualità di Osservazione</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getQualityBadgeClass(
                      selectedSummary.quality
                    )}`}
                  >
                    {selectedSummary.quality}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Planet Detail (appears once a body has been chosen above) */}
      {selectedSummary && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-md"
              style={{
                backgroundColor: `${PLANETS_INFO[selectedSummary.planetKey].color}25`,
                color: PLANETS_INFO[selectedSummary.planetKey].color,
              }}
            >
              {PLANETS_INFO[selectedSummary.planetKey].symbol}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {innerVisibility
                  ? `Profilo Giornaliero di Visibilità: ${selectedSummary.nameIt} (${selectedYear})`
                  : `Profilo Mensile Culminazione: ${selectedSummary.nameIt} (${selectedYear})`}
              </h3>
              <p className="text-xs text-slate-400">
                {innerVisibility
                  ? `Altezza al crepuscolo (alba o tramonto) e diametro apparente giorno per giorno da ${location.name}`
                  : `Andamento dell'altezza massima e del diametro apparente mese per mese, a cielo scuro, da ${location.name}`}
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed">
            {selectedSummary.description}
          </p>

          {/* Chart: daily elongation/twilight profile for Mercury & Venus, monthly culmination for everything else */}
          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {innerVisibility ? (
                <LineChart data={dailyChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  {favorabilityBands.map((band, idx) => (
                    <ReferenceArea
                      key={idx}
                      yAxisId="alt"
                      x1={band.start}
                      x2={band.end}
                      stroke="none"
                      fill={band.favorable ? '#22c55e' : '#ef4444'}
                      fillOpacity={0.1}
                    />
                  ))}
                  <ReferenceLine yAxisId="alt" y={0} stroke="#64748b" strokeDasharray="2 2" />
                  {todayMarker && (
                    <ReferenceLine
                      yAxisId="alt"
                      x={todayMarker.dayIndex}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{ value: 'Oggi', position: 'insideTopLeft', fill: '#f43f5e', fontSize: 10 }}
                    />
                  )}
                  <XAxis
                    dataKey="dayIndex"
                    type="number"
                    domain={[0, dailyChartData.length - 1]}
                    ticks={monthTicks.map((t) => t.value)}
                    tickFormatter={monthTickFormatter}
                    stroke="#94a3b8"
                    fontSize={11}
                  />
                  <YAxis yAxisId="alt" stroke="#94a3b8" fontSize={11} domain={[-25, 60]} unit="°" />
                  <YAxis
                    yAxisId="diam"
                    orientation="right"
                    stroke="#22d3ee"
                    fontSize={11}
                    unit="″"
                    domain={[0, (max: number) => Math.ceil(max * 1.2)]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload.find((p) => p.dataKey === 'altitudeDisplay')?.payload as
                          | InnerPlanetDayPoint
                          | undefined;
                        const diam = payload.find((p) => p.dataKey === 'angularDiameterArcsec');
                        if (!d) return null;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1">
                            <div className="font-bold text-amber-300">{d.dateStr}</div>
                            <div className="flex items-center gap-1.5">
                              {d.visibility === 'evening' ? (
                                <Sunset className="w-3.5 h-3.5 text-orange-400" />
                              ) : (
                                <Sunrise className="w-3.5 h-3.5 text-cyan-400" />
                              )}
                              Visibile al {d.visibility === 'evening' ? 'tramonto (sera)' : 'sorgere (mattina)'}
                            </div>
                            <div>
                              Altezza al crepuscolo:{' '}
                              <span className="font-bold text-white">{d.altitudeAtTwilight}°</span>
                              {d.twilightTimeStr ? <span className="text-slate-400"> ({d.twilightTimeStr})</span> : null}
                            </div>
                            <div>
                              Elongazione dal Sole: <span className="font-bold text-white">{d.elongation}°</span>
                            </div>
                            {diam !== undefined && (
                              <div>
                                Diametro apparente:{' '}
                                <span className="font-bold text-cyan-300">{diam.value}″</span>
                              </div>
                            )}
                            <div className={d.favorable ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                              {d.favorable ? 'Periodo favorevole' : 'Poco favorevole / non osservabile'}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    yAxisId="alt"
                    type="monotone"
                    dataKey="altitudeDisplay"
                    name="Altezza al crepuscolo (°)"
                    stroke={PLANETS_INFO[selectedSummary.planetKey].color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  {selectedSummary.angularDiameterArcsec !== undefined && (
                    <Line
                      yAxisId="diam"
                      type="monotone"
                      dataKey="angularDiameterArcsec"
                      name="Diametro Apparente (″)"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              ) : (
                <LineChart data={monthlyChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  {todayMarker && (
                    <ReferenceLine
                      yAxisId="alt"
                      x={todayMarker.monthName}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{ value: 'Oggi', position: 'insideTopLeft', fill: '#f43f5e', fontSize: 10 }}
                    />
                  )}
                  <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={11} />
                  <YAxis yAxisId="alt" stroke="#94a3b8" fontSize={11} domain={[0, 90]} unit="°" />
                  <YAxis
                    yAxisId="diam"
                    orientation="right"
                    stroke="#22d3ee"
                    fontSize={11}
                    unit="″"
                    domain={[0, (max: number) => Math.ceil(max * 1.2)]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const altEntry = payload.find((p) => p.dataKey === 'altitude');
                        const diam = payload.find((p) => p.dataKey === 'angularDiameterArcsec');
                        const monthLabel = (altEntry?.payload ?? diam?.payload)?.monthName;
                        return (
                          <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1">
                            <div className="font-bold text-amber-300">{monthLabel} {selectedYear}</div>
                            {altEntry !== undefined && (
                              <div>Altezza al culmine: <span className="font-bold text-white">{altEntry.value}°</span></div>
                            )}
                            {diam !== undefined && (
                              <div>Diametro apparente: <span className="font-bold text-cyan-300">{diam.value}″</span></div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    yAxisId="alt"
                    type="monotone"
                    dataKey="altitude"
                    name="Altezza al culmine (°)"
                    stroke={PLANETS_INFO[selectedSummary.planetKey].color}
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f59e0b' }}
                    activeDot={{ r: 6 }}
                  />
                  {monthlyDiameterData && (
                    <Line
                      yAxisId="diam"
                      type="monotone"
                      dataKey="angularDiameterArcsec"
                      name="Diametro Apparente (″)"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#22d3ee' }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Educational Note on Atmospheric Extinction */}
          <DismissibleInfoPanel
            id="annual-altitude-extinction-note"
            icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
            className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
          >
            <span className="font-bold text-indigo-200">Perché l'altezza è fondamentale per gli astronomi?</span>
            <p className="mt-1 leading-relaxed">
              A 10° sopra l'orizzonte osservi attraverso circa 5.6 masse d'aria atmosferiche. A 45° la massa d'aria scende a 1.4, e a 90° (Zenit) è esattamente 1.0. Maggiore è l'altezza del pianeta, maggiore è il contrasto dei dettagli planetari e minore è la rifrazione atmosferica.
            </p>
          </DismissibleInfoPanel>

          {innerVisibility && (
            <DismissibleInfoPanel
              id="annual-altitude-inner-visibility-note"
              icon={<Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
            >
              <span className="font-bold text-emerald-200">Come leggere le fasce verdi e rosse</span>
              <p className="mt-1 leading-relaxed">
                {PLANETS_INFO[selectedSummary.planetKey].nameIt} orbita vicino al Sole e non è mai visibile a
                cielo completamente buio: la sua altezza qui è misurata nel momento del crepuscolo civile (Sole a -6°)
                che favorisce l'apparizione del momento, al mattino o alla sera. Le fasce{' '}
                <span className="text-emerald-400 font-semibold">verdi</span> indicano periodi realmente favorevoli
                (pianeta sopra l'orizzonte al crepuscolo e sufficientemente lontano dal bagliore solare, elongazione
                &gt; 15°); le fasce <span className="text-rose-400 font-semibold">rosse</span> indicano periodi
                sfavorevoli o di invisibilità, tipicamente in prossimità della congiunzione con il Sole. L'icona nel
                tooltip mostra se l'apparizione è mattutina (alba) o serale (tramonto). Tutti i valori sono calcolati
                per {location.name}; vicino ai circoli polari le finestre di crepuscolo standard potrebbero non
                essere disponibili per periodi estesi dell'anno.
              </p>
            </DismissibleInfoPanel>
          )}

          {!innerVisibility &&
            (selectedSummary.planetKey === 'Mars' || PLANETS_INFO[selectedSummary.planetKey].type === 'planet_outer') && (
              <DismissibleInfoPanel
                id="annual-altitude-night-correction-note"
                icon={<Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}
                className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
              >
                <span className="font-bold text-cyan-200">Perché questi valori sono "a cielo scuro"</span>
                <p className="mt-1 leading-relaxed">
                  Il passaggio geometrico al meridiano di {selectedSummary.nameIt} può avvenire in pieno giorno,
                  specialmente nei mesi vicini alla congiunzione con il Sole. In quel caso il pianeta non è
                  osservabile, anche se l'altezza geometrica è alta. I valori mostrati qui sono invece la massima
                  altezza realmente raggiunta durante le ore di buio (Sole sotto i -6° a {location.name}), così il
                  grafico riflette la visibilità reale mese per mese.
                  {selectedSummary.nightDataUnavailable && (
                    <>
                      {' '}
                      Alla tua latitudine, in alcuni mesi non è stata trovata una notte astronomica standard
                      (possibile sole di mezzanotte o notte polare): per quei mesi è stato usato il valore geometrico
                      grezzo come stima di riserva.
                    </>
                  )}
                </p>
              </DismissibleInfoPanel>
            )}
        </div>
      )}
    </div>
  );
};
