import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserLocation, LunarLibrationEvent, LibrationDirection } from '../types';
import {
  calculateLunarLibrationEvents,
  getMoonLibrationSnapshot,
  getMoonCulminationForDate,
  getMoonRiseTransitSetForDate,
  LIBRATION_DIRECTION_LABELS,
  LIBRATION_FEATURES,
} from '../services/astroEngine';
import { Compass, Sparkles, Eye, Info, ChevronLeft, ChevronRight, Telescope } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

interface TabLunarLibrationProps {
  location: UserLocation;
  selectedYear: number;
}

// Rotation for the direction arrow icon, following the naked-eye lunar
// convention used in the canvas visualizer below (East on the left).
const DIRECTION_ARROW_ROTATION_DEG: Record<LibrationDirection, number> = {
  N: 0,
  NE: 315,
  E: 270,
  SE: 225,
  S: 180,
  SW: 135,
  W: 90,
  NW: 45,
};

function getQualityBadgeClass(quality: LunarLibrationEvent['quality']): string {
  switch (quality) {
    case 'Eccezionale':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Ottima':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
}

export const TabLunarLibration: React.FC<TabLunarLibrationProps> = ({ location, selectedYear }) => {
  const events = useMemo(() => calculateLunarLibrationEvents(selectedYear), [selectedYear]);

  // Moonrise/transit/moonset for each event, at the observer's coordinates
  const eventMoonTimes = useMemo(
    () => events.map((ev) => getMoonRiseTransitSetForDate(new Date(ev.timestamp), location)),
    [events, location]
  );

  // The slider steps directly through the filtered event list (one position
  // per event) rather than through calendar days, so its range always
  // matches the number of events actually available to browse.
  const [eventIndex, setEventIndex] = useState<number>(0);

  useEffect(() => {
    setEventIndex(0);
  }, [selectedYear]);

  const selectedEvent = events[eventIndex] ?? null;
  const selectedDate = useMemo(
    () => (selectedEvent ? new Date(selectedEvent.timestamp) : new Date()),
    [selectedEvent]
  );
  const snapshot = useMemo(() => getMoonLibrationSnapshot(selectedDate), [selectedDate]);
  const moonView = useMemo(() => getMoonCulminationForDate(selectedDate, location), [selectedDate, location]);

  const goToEvent = (offset: number) => {
    if (events.length === 0) return;
    setEventIndex((prev) => Math.max(0, Math.min(events.length - 1, prev + offset)));
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 92;

    // Naked-eye/telescope orientation: North up, East to the left (the
    // traditional lunar-map convention, opposite of a terrestrial map).
    const scale = (radius * 0.4) / 10;
    const offsetX = -snapshot.elon * scale;
    const offsetY = -snapshot.elat * scale;

    // Reference circle: the mean visible hemisphere with no libration
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Actual visible disc, displaced by the current libration offset
    const moonGrad = ctx.createRadialGradient(
      centerX + offsetX - radius * 0.3,
      centerY + offsetY - radius * 0.3,
      radius * 0.1,
      centerX + offsetX,
      centerY + offsetY,
      radius
    );
    moonGrad.addColorStop(0, '#f1f5f9');
    moonGrad.addColorStop(0.55, '#cbd5e1');
    moonGrad.addColorStop(1, '#64748b');
    ctx.beginPath();
    ctx.arc(centerX + offsetX, centerY + offsetY, radius, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Mark the newly-exposed limb with a highlighted arc on the reference circle
    if (snapshot.magnitude > 0.3) {
      const dirAngle = Math.atan2(-offsetY, offsetX);
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, dirAngle - 0.5, dirAngle + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Compass labels, following the lunar-map convention above
    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', centerX, centerY - radius - 14);
    ctx.fillText('S', centerX, centerY + radius + 14);
    ctx.fillText('E', centerX - radius - 14, centerY);
    ctx.fillText('W', centerX + radius + 14, centerY);
    ctx.restore();
  }, [snapshot]);

  return (
    <div className="space-y-8 text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-0 p-2 opacity-10 pointer-events-none">
          <ApexIcon className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            Librazioni Lunari Favorevoli {selectedYear}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
            Osservazione del Bordo Lunare & Librazioni
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            La librazione è un lieve dondolio della Luna che, in momenti favorevoli, rivela una sottile fascia di terreno normalmente nascosta oltre il bordo del disco visibile. Qui sotto trovi i momenti favorevoli ancora da venire nel {selectedYear}, già filtrati per mostrare solo i casi in cui quel lato del disco è effettivamente illuminato dal Sole.
          </p>
        </div>
      </div>

      {/* Interactive Libration Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="lg:col-span-6 flex flex-col items-center justify-center bg-slate-950 border border-slate-800 rounded-2xl p-6 relative min-h-[300px]">
          <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            Simulazione Librazione ({selectedDate.toISOString().split('T')[0]})
          </div>

          <canvas ref={canvasRef} width={280} height={260} className="my-2 drop-shadow-[0_0_18px_rgba(148,163,184,0.15)]" />

          <div className="text-[11px] text-slate-400 text-center mt-1">
            Vista ad occhio nudo/binocolo, Nord in alto. Con Newton o Schmidt-Cassegrain l'immagine nell'oculare può risultare capovolta o specchiata.
          </div>

          {/* Slider stepping through the filtered events, one position each */}
          <div className="w-full max-w-sm mt-4 space-y-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-xs font-semibold mb-1">
              <span className="text-slate-400">
                {events.length > 0 ? `Evento ${eventIndex + 1} di ${events.length}` : 'Nessun evento rimanente'}
              </span>
              <span className="text-cyan-300 text-sm font-bold">
                {selectedDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, events.length - 1)}
              step={1}
              value={eventIndex}
              disabled={events.length === 0}
              onChange={(e) => setEventIndex(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            />

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => goToEvent(-1)}
                disabled={events.length === 0 || eventIndex === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700/60 text-[11px] font-semibold transition disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Evento Prec.
              </button>
              <button
                onClick={() => goToEvent(1)}
                disabled={events.length === 0 || eventIndex === events.length - 1}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700/60 text-[11px] font-semibold transition disabled:opacity-30"
              >
                Evento Succ.
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Current Snapshot Readout */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                Direzione Favorevole
              </h3>
              <div
                className="w-9 h-9 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center"
                style={{ transform: `rotate(${DIRECTION_ARROW_ROTATION_DEG[snapshot.direction]}deg)` }}
              >
                <span className="text-amber-400 text-lg leading-none">↑</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Lato Favorevole</div>
                <div className="text-lg font-extrabold text-amber-400">{LIBRATION_DIRECTION_LABELS[snapshot.direction]}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Ampiezza Totale</div>
                <div className="text-lg font-extrabold text-cyan-400">{snapshot.magnitude}°</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400">Fase Illuminata</div>
                <div className="text-lg font-extrabold text-emerald-400">{snapshot.illuminationPercent}%</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                <div className="text-slate-500">Librazione Longitudine</div>
                <div className="font-bold text-slate-200">{snapshot.elon > 0 ? '+' : ''}{snapshot.elon}° ({snapshot.elon >= 0 ? 'Est' : 'Ovest'})</div>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-[11px]">
                <div className="text-slate-500">Librazione Latitudine</div>
                <div className="font-bold text-slate-200">{snapshot.elat > 0 ? '+' : ''}{snapshot.elat}° ({snapshot.elat >= 0 ? 'Nord' : 'Sud'})</div>
              </div>
            </div>

            <div className="mt-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 text-xs text-slate-200 leading-relaxed">
              <span className="font-bold text-indigo-300 block mb-1 flex items-center gap-1.5">
                <Telescope className="w-3.5 h-3.5" />
                Formazioni ben esposte in questa data:
              </span>
              {LIBRATION_FEATURES[snapshot.direction]}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            Altezza della Luna a {location.name} in questa data: {moonView.maxAltitude}° al culmine (transito circa alle {moonView.transitTimeStr}).
          </div>
        </div>
      </div>

      {/* Explainer */}
      <DismissibleInfoPanel
        id="libration-explainer-note"
        icon={<Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}
        className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
      >
        <span className="font-bold text-indigo-200">Cos'è la librazione lunare?</span>
        <p className="mt-1 leading-relaxed">
          Sebbene la Luna mostri sempre la stessa faccia alla Terra, la combinazione tra la velocità di rotazione costante e la velocità orbitale variabile (orbita ellittica) fa sì che, nel tempo, sia visibile fino al 59% della superficie lunare invece del 50% teorico. Questo dondolio si chiama librazione: quando raggiunge un massimo verso un lato, una sottile fascia di terreno normalmente nascosta oltre il bordo diventa osservabile. Un bordo geometricamente favorevole non basta però da solo: deve anche trovarsi sul lato illuminato dal Sole in quel momento, altrimenti resta nell'ombra. Gli eventi qui sotto sono già stati verificati anche per questo aspetto.
        </p>
      </DismissibleInfoPanel>

      {/* Favorable Events List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Prossime Librazioni Favorevoli del {selectedYear}
          </h3>
          <span className="text-xs text-slate-400">{events.length} eventi</span>
        </div>

        <DismissibleInfoPanel
          id="libration-selection-criteria-note"
          icon={<Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
          className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-amber-200">Perché non sono tutte le librazioni dell'anno</span>
          <p className="mt-1 leading-relaxed">
            La Luna oscilla in librazione ogni giorno, quindi eventi di ampiezza rilevante verso un bordo o l'altro
            sono in realtà molto più numerosi di quelli elencati qui. Questa lista mostra solo i picchi in cui,
            oltre a un'ampiezza significativa, il lato esposto dalla librazione è anche illuminato dal Sole in
            quel momento: solo in quel caso i crateri e i mari normalmente nascosti oltre il bordo diventano
            davvero osservabili, invece di restare in ombra.
          </p>
        </DismissibleInfoPanel>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((ev, idx) => {
            const isSelected = idx === eventIndex;
            return (
              <div
                key={ev.dateStr}
                onClick={() => setEventIndex(idx)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900/90 border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center"
                        style={{ transform: `rotate(${DIRECTION_ARROW_ROTATION_DEG[ev.direction]}deg)` }}
                      >
                        <span className="text-amber-400 text-sm leading-none">↑</span>
                      </div>
                      <span className="text-xs font-bold text-slate-200">Lato {LIBRATION_DIRECTION_LABELS[ev.direction]}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getQualityBadgeClass(ev.quality)}`}>
                      {ev.quality}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-cyan-300">
                    {new Date(ev.timestamp).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-[11px]">
                    <div>
                      <div className="text-slate-500">Ampiezza</div>
                      <div className="font-bold text-slate-100">{ev.totalLibration}°</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Fase Luna</div>
                      <div className="font-bold text-cyan-300">{ev.moonIlluminationPercent}%</div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-center text-[11px]">
                    <div>
                      <div className="text-slate-500">Alba</div>
                      <div className="font-bold text-slate-100">{eventMoonTimes[idx].riseStr ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Culmine</div>
                      <div className="font-bold text-amber-300">{eventMoonTimes[idx].transitStr}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Tramonto</div>
                      <div className="font-bold text-slate-100">{eventMoonTimes[idx].setStr ?? '—'}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                    Formazioni favorite: {ev.favorableFeatures}
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
