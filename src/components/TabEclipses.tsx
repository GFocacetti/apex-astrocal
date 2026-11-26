import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserLocation, EclipseEvent } from '../types';
import { useAstroWorkerData } from '../hooks/useAstroWorkerData';
import { Sun, Moon, Eye, Calendar, Clock, Sparkles, Filter, Globe, AlertTriangle, Loader2 } from 'lucide-react';

interface TabEclipsesProps {
  location: UserLocation;
}

export const TabEclipses: React.FC<TabEclipsesProps> = ({ location }) => {
  const [filterType, setFilterType] = useState<'ALL' | 'SOLAR' | 'LUNAR' | 'VISIBLE'>('VISIBLE');

  // Compute 100-year eclipses list for user coordinates (2026 - 2125), off the main thread
  const { data, isLoading } = useAstroWorkerData<EclipseEvent[]>('eclipses100', location);
  const eclipses = data ?? [];

  // Filtered list
  const filteredEclipses = useMemo(() => {
    return eclipses.filter((e) => {
      if (filterType === 'SOLAR') return e.isSolar;
      if (filterType === 'LUNAR') return !e.isSolar;
      if (filterType === 'VISIBLE') return e.isVisibleLocally;
      return true;
    });
  }, [eclipses, filterType]);

  // Find the next upcoming visible eclipse from current date
  const nextVisibleEclipse = useMemo(() => {
    const now = new Date();
    return (
      eclipses.find(
        (e) => e.isVisibleLocally && new Date(e.peakTime).getTime() > now.getTime()
      ) || eclipses.find((e) => e.isVisibleLocally)
    );
  }, [eclipses]);

  // Selected eclipse for interactive diagram rendering
  const [selectedEclipseId, setSelectedEclipseId] = useState<string>('');

  useEffect(() => {
    if (nextVisibleEclipse && !selectedEclipseId) {
      setSelectedEclipseId(nextVisibleEclipse.id);
    } else if (eclipses.length > 0 && !selectedEclipseId) {
      setSelectedEclipseId(eclipses[0].id);
    }
  }, [nextVisibleEclipse, eclipses, selectedEclipseId]);

  const selectedEclipse = useMemo(() => {
    return (
      eclipses.find((e) => e.id === selectedEclipseId) ||
      nextVisibleEclipse ||
      eclipses[0]
    );
  }, [eclipses, selectedEclipseId, nextVisibleEclipse]);

  // Canvas for eclipse simulation rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedEclipse) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const bodyRadius = 50;

    const obsPct = selectedEclipse.obscurationPercent;
    // Calculate Moon offset relative to Sun based on obscuration
    // 100% => offset 0 (perfect alignment)
    // 0% => offset > 2 * radius (no overlap)
    const moonOffsetX = (1 - obsPct / 100) * (bodyRadius * 1.8);

    if (selectedEclipse.isSolar) {
      // Draw Solar Eclipse
      // 1. Corona / Glow background
      const coronaGrad = ctx.createRadialGradient(centerX, centerY, bodyRadius * 0.8, centerX, centerY, bodyRadius * 2.5);
      coronaGrad.addColorStop(0, 'rgba(243, 234, 216, 0.7)');
      coronaGrad.addColorStop(0.4, 'rgba(184,154,106, 0.4)');
      coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Sun Disc
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#f3ead8'; // Sun disc, warm white
      ctx.fill();

      // 3. Moon Disc blocking Sun
      ctx.beginPath();
      ctx.arc(centerX - moonOffsetX, centerY, bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#171717'; // Dark slate moon 
      ctx.fill();

      // Moon outline edge
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Draw Lunar Eclipse
      // 1. Background sky
      ctx.fillStyle = '#0b0b0c';
      ctx.fillRect(0, 0, width, height);

      // 2. Moon disc, plain grey.
      const moonGrad = ctx.createRadialGradient(
        centerX - bodyRadius * 0.3,
        centerY - bodyRadius * 0.3,
        bodyRadius * 0.1,
        centerX,
        centerY,
        bodyRadius
      );
      moonGrad.addColorStop(0, '#e2e2e2');
      moonGrad.addColorStop(1, '#a6a6a6');
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = moonGrad;
      ctx.fill();

      // 3. Earth's shadow, clipped to the Moon. The umbra (radius 1.4 R) is
      // placed so that it covers exactly the obscured fraction: fully over
      // the disc at 100%, just clear of it at 0%, where only the faint
      // penumbral dimming is left.
      const umbraRadius = bodyRadius * 1.4;
      const umbraX = centerX + bodyRadius * 0.4 + (1 - obsPct / 100) * bodyRadius * 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
      ctx.clip();

      const penumbra = ctx.createRadialGradient(umbraX, centerY, umbraRadius, umbraX, centerY, bodyRadius * 2.8);
      penumbra.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      penumbra.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = penumbra;
      ctx.fillRect(0, 0, width, height);

      ctx.beginPath();
      ctx.arc(umbraX, centerY, umbraRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(96, 52, 40, 0.92)'; // dim copper of the umbra
      ctx.fill();
      ctx.restore();
    }
  }, [selectedEclipse]);

  // Real-time Countdown to Next Visible Eclipse
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; mins: number; secs: number }>({
    days: 0,
    hours: 0,
    mins: 0,
    secs: 0,
  });

  useEffect(() => {
    if (!nextVisibleEclipse) return;

    const timer = setInterval(() => {
      const target = new Date(nextVisibleEclipse.peakTime).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, mins, secs });
    }, 1000);

    return () => clearInterval(timer);
  }, [nextVisibleEclipse]);

  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Effemeridi</div>
          <h2 className="page-title">Eclissi visibili da {location.name}</h2>
          <p className="lead">
            Determinazione rigorosa della visibilità locale, dell'altezza del Sole/Luna sopra l'orizzonte e della percentuale di oscuramento del disco durante la fase massima dell'eclisse, dal 2026 al 2125.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-sm text-neutral-300">
          <Loader2 className="w-5 h-5 animate-spin text-neutral-200" />
          Calcolo delle eclissi su 100 anni per {location.name} in corso...
        </div>
      )}

      {/* Countdown Card for Next Visible Eclipse */}
      {nextVisibleEclipse && (
        <div className="bg-neutral-900/50 via-neutral-900 to-neutral-950 border border-neutral-600 rounded-lg p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] text-neutral-200 border border-neutral-700 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Prossima eclissi visibile
              </div>
              <h3 className="text-xl font-medium text-neutral-100">
                {nextVisibleEclipse.typeIt} • {nextVisibleEclipse.peakTimeLocal}
              </h3>
              <p className="text-xs text-neutral-300 max-w-lg">
                {nextVisibleEclipse.detailsIt}
              </p>
            </div>

            {/* Countdown Display */}
            <div className="bg-neutral-950/80 border border-neutral-800 p-4 rounded-md flex items-center gap-3 sm:gap-4 shrink-0">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-medium text-neutral-200">{timeLeft.days}</div>
                <div className="text-[10px] text-neutral-400 uppercase tracking-[0.14em] font-semibold">Giorni</div>
              </div>
              <div className="text-neutral-600 text-xl font-light">:</div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-medium text-neutral-100">{timeLeft.hours}</div>
                <div className="text-[10px] text-neutral-400 uppercase tracking-[0.14em] font-semibold">Ore</div>
              </div>
              <div className="text-neutral-600 text-xl font-light">:</div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-medium text-neutral-100">{timeLeft.mins}</div>
                <div className="text-[10px] text-neutral-400 uppercase tracking-[0.14em] font-semibold">Min</div>
              </div>
              <div className="text-neutral-600 text-xl font-light">:</div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-medium text-neutral-200">{timeLeft.secs}</div>
                <div className="text-[10px] text-neutral-400 uppercase tracking-[0.14em] font-semibold">Sec</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Eclipse Simulation Diagram */}
      {selectedEclipse && (
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-lg p-6 relative">
            <div className="text-xs font-semibold text-neutral-100 mb-2 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              Simulazione Fase Massima ({selectedEclipse.obscurationPercent}% Oscuramento)
            </div>

            <canvas
              ref={canvasRef}
              width={260}
              height={200}
              className="my-2 rounded-md drop-shadow-[0_0_15px_rgba(184,154,106,0.2)]"
            />

            <div className="text-[11px] text-neutral-400 text-center mt-2">
              Allineamento apparente al culmine locale
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div>
                  <span className="text-xs font-semibold text-neutral-200 block uppercase">
                    {selectedEclipse.isSolar ? 'Eclisse Solare' : 'Eclisse Lunare'}
                  </span>
                  <h3 className="text-lg font-semibold text-neutral-100">{selectedEclipse.typeIt}</h3>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    selectedEclipse.isVisibleLocally
                      ? 'bg-transparent text-neutral-100 border-neutral-500'
                      : 'bg-transparent text-neutral-400 border-neutral-700'
                  }`}
                >
                  {selectedEclipse.isVisibleLocally ? 'Visibile da GPS' : 'Sotto l\'orizzonte'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div className="bg-neutral-950 p-3 rounded-md border border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Oscuramento</div>
                  <div className="text-lg font-medium text-neutral-200">
                    {selectedEclipse.obscurationPercent}%
                  </div>
                </div>
                <div className="bg-neutral-950 p-3 rounded-md border border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Altezza al Picco</div>
                  <div className="text-lg font-medium text-neutral-200">
                    {selectedEclipse.bodyAltitudeAtPeak}°
                  </div>
                </div>
                <div className="bg-neutral-950 p-3 rounded-md border border-neutral-800">
                  <div className="text-[10px] text-neutral-400">Anno</div>
                  <div className="text-lg font-medium text-neutral-200">
                    {selectedEclipse.year}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 p-3 rounded-md border border-neutral-800/80">
                {selectedEclipse.detailsIt}
              </p>
            </div>

            {selectedEclipse.isSolar && selectedEclipse.isVisibleLocally && (
              <div className="bg-white/[0.03] border border-neutral-700 rounded-md p-3 text-xs text-neutral-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-neutral-200 shrink-0" />
                AVVISO SICUREZZA: Non guardare MAI direttamente il Sole durante un'eclisse solare senza appositi filtri solari certificati ISO 12312-2.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filterable Eclipse List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-4 rounded-md">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-200" />
            <span className="text-xs font-semibold text-neutral-200">Filtra eclissi (2026–2125)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'VISIBLE', label: 'Visibili da Posizione GPS' },
              { key: 'SOLAR', label: 'Solari' },
              { key: 'LUNAR', label: 'Lunari' },
              { key: 'ALL', label: 'Tutte (Globali)' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilterType(btn.key as any)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  filterType === btn.key
                    ? 'bg-neutral-100 text-neutral-950 '
                    : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Eclipses Table / List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEclipses.map((e) => {
            const isSelected = e.id === selectedEclipseId;
            return (
              <div
                key={e.id}
                onClick={() => setSelectedEclipseId(e.id)}
                className={`p-5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white/[0.04] border-neutral-400'
                    : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {e.isSolar ? (
                        <Sun className="w-4 h-4 text-neutral-200" />
                      ) : (
                        <Moon className="w-4 h-4 text-neutral-100" />
                      )}
                      <span className="text-xs font-semibold text-neutral-200">{e.typeIt}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        e.isVisibleLocally
                          ? 'bg-transparent text-neutral-100 border-neutral-500'
                          : 'bg-transparent text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {e.isVisibleLocally ? 'Visibile' : 'Sotto Orizzonte'}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-neutral-100">{e.peakTimeLocal}</div>

                  <div className="mt-3 grid grid-cols-2 gap-2 bg-neutral-950 p-2.5 rounded-md border border-neutral-800 text-center text-[11px]">
                    <div>
                      <div className="text-neutral-500">Oscuramento</div>
                      <div className="font-semibold text-neutral-100">{e.obscurationPercent}%</div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Altezza Corp.</div>
                      <div className="font-semibold text-neutral-100">{e.bodyAltitudeAtPeak}°</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                    {e.detailsIt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
