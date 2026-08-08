import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserLocation, EclipseEvent } from '../types';
import { useAstroWorkerData } from '../hooks/useAstroWorkerData';
import { Sun, Moon, Eye, Calendar, Clock, Sparkles, Filter, Globe, AlertTriangle, Loader2 } from 'lucide-react';
import { ApexIcon } from './ApexIcon';

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
      coronaGrad.addColorStop(0, 'rgba(253, 224, 71, 0.9)');
      coronaGrad.addColorStop(0.4, 'rgba(245, 158, 11, 0.4)');
      coronaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 2. Sun Disc
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a'; // Bright yellow
      ctx.fill();

      // 3. Moon Disc blocking Sun
      ctx.beginPath();
      ctx.arc(centerX - moonOffsetX, centerY, bodyRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a'; // Dark slate moon shadow
      ctx.fill();

      // Moon outline edge
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Draw Lunar Eclipse
      // 1. Background sky
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // 2. Earth Umbra Shadow (Dark reddish)
      const umbraGrad = ctx.createRadialGradient(
        centerX + moonOffsetX,
        centerY,
        bodyRadius * 0.2,
        centerX + moonOffsetX,
        centerY,
        bodyRadius * 1.5
      );
      umbraGrad.addColorStop(0, 'rgba(153, 27, 27, 0.9)'); // Deep Blood Red
      umbraGrad.addColorStop(0.7, 'rgba(127, 29, 29, 0.6)');
      umbraGrad.addColorStop(1, 'rgba(15, 23, 42, 0.1)');

      ctx.beginPath();
      ctx.arc(centerX + moonOffsetX, centerY, bodyRadius * 1.3, 0, Math.PI * 2);
      ctx.fillStyle = umbraGrad;
      ctx.fill();

      // 3. Moon Disc (Blood Moon or Partial)
      ctx.beginPath();
      ctx.arc(centerX, centerY, bodyRadius, 0, Math.PI * 2);

      // Moon texture gradient
      const moonGrad = ctx.createLinearGradient(centerX - bodyRadius, centerY, centerX + bodyRadius, centerY);
      if (obsPct > 80) {
        moonGrad.addColorStop(0, '#991b1b'); // Blood Red
        moonGrad.addColorStop(1, '#7f1d1d');
      } else {
        moonGrad.addColorStop(0, '#e2e8f0'); // Normal pale moon
        moonGrad.addColorStop(1, '#991b1b'); // Red shadow portion
      }
      ctx.fillStyle = moonGrad;
      ctx.fill();
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
    <div className="space-y-8 text-slate-100">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-0 p-2 opacity-10 pointer-events-none">
          <ApexIcon className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Globe className="w-4 h-4" />
            Calcolo Eclissi Visibili da Posizione GPS
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
            Eclissi Solari e Lunari per {location.name}
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Determinazione rigorosa della visibilità locale, dell'altezza del Sole/Luna sopra l'orizzonte e della percentuale di oscuramento del disco durante la fase massima dell'eclisse (2026 - 2045).
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-sm text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          Calcolo delle eclissi su 100 anni per {location.name} in corso...
        </div>
      )}

      {/* Countdown Card for Next Visible Eclipse */}
      {nextVisibleEclipse && (
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-amber-400 border border-indigo-500/30 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                Prossimo Evento Celeste Visibile
              </div>
              <h3 className="text-xl font-extrabold text-slate-100">
                {nextVisibleEclipse.typeIt} • {nextVisibleEclipse.peakTimeLocal}
              </h3>
              <p className="text-xs text-slate-300 max-w-lg">
                {nextVisibleEclipse.detailsIt}
              </p>
            </div>

            {/* Countdown Display */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl flex items-center gap-3 sm:gap-4 shrink-0 shadow-inner">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-amber-400">{timeLeft.days}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Giorni</div>
              </div>
              <div className="text-slate-600 text-xl font-light">:</div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-indigo-300">{timeLeft.hours}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Ore</div>
              </div>
              <div className="text-slate-600 text-xl font-light">:</div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-cyan-300">{timeLeft.mins}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Min</div>
              </div>
              <div className="text-slate-600 text-xl font-light">:</div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-black text-slate-200">{timeLeft.secs}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Sec</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Eclipse Simulation Diagram */}
      {selectedEclipse && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
            <div className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              Simulazione Fase Massima ({selectedEclipse.obscurationPercent}% Oscuramento)
            </div>

            <canvas
              ref={canvasRef}
              width={260}
              height={200}
              className="my-2 rounded-xl drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            />

            <div className="text-[11px] text-slate-400 text-center mt-2">
              Allineamento apparente al culmine locale
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-xs font-bold text-amber-400 block uppercase">
                    {selectedEclipse.isSolar ? 'Eclisse Solare' : 'Eclisse Lunare'}
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">{selectedEclipse.typeIt}</h3>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    selectedEclipse.isVisibleLocally
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {selectedEclipse.isVisibleLocally ? 'Visibile da GPS' : 'Sotto l\'orizzonte'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Oscuramento</div>
                  <div className="text-lg font-extrabold text-amber-400">
                    {selectedEclipse.obscurationPercent}%
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Altezza al Picco</div>
                  <div className="text-lg font-extrabold text-cyan-400">
                    {selectedEclipse.bodyAltitudeAtPeak}°
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Anno</div>
                  <div className="text-lg font-extrabold text-slate-200">
                    {selectedEclipse.year}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {selectedEclipse.detailsIt}
              </p>
            </div>

            {selectedEclipse.isSolar && selectedEclipse.isVisibleLocally && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                AVVISO SICUREZZA: Non guardare MAI direttamente il Sole durante un'eclisse solare senza appositi filtri solari certificati ISO 12312-2.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filterable Eclipse List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-slate-200">Filtra Eclissi (2026 - 2045):</span>
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
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
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
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900/90 border-amber-500/60 shadow-lg ring-1 ring-amber-500/30'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {e.isSolar ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-indigo-300" />
                      )}
                      <span className="text-xs font-bold text-slate-200">{e.typeIt}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        e.isVisibleLocally
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {e.isVisibleLocally ? 'Visibile' : 'Sotto Orizzonte'}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-amber-300">{e.peakTimeLocal}</div>

                  <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-[11px]">
                    <div>
                      <div className="text-slate-500">Oscuramento</div>
                      <div className="font-bold text-slate-100">{e.obscurationPercent}%</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Altezza Corp.</div>
                      <div className="font-bold text-cyan-300">{e.bodyAltitudeAtPeak}°</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300 line-clamp-2 leading-relaxed">
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
