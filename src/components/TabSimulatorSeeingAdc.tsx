import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Info, Wand2 } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

// Jupiter's apparent diameter near opposition, used as the angular reference
// that converts arcseconds into on-screen pixels.
const PLANET_ARCSEC = 45;

// Differential atmospheric refraction between ~400 nm and ~700 nm is very
// nearly proportional to tan(zenith distance); 1.23" at z = 45 deg reproduces
// the standard tabulated values (0.71" at z=30, 2.13" at z=60, 4.59" at z=75).
const DISPERSION_AT_45DEG = 1.23;
const MAX_ZENITH_DISTANCE = 85; // clamp: below ~5 deg altitude nothing is observable anyway

const ADC_MAX_CORRECTION = 6; // arcsec of dispersion the prisms can cancel out

function dispersionArcsec(altitudeDeg: number): number {
  const z = Math.min(MAX_ZENITH_DISTANCE, 90 - altitudeDeg);
  return DISPERSION_AT_45DEG * Math.tan((z * Math.PI) / 180);
}

// Kasten & Young (1989) air mass - stays finite towards the horizon.
function airMass(altitudeDeg: number): number {
  const z = Math.min(89.9, 90 - altitudeDeg);
  const zr = (z * Math.PI) / 180;
  return 1 / (Math.cos(zr) + 0.50572 * Math.pow(96.07995 - z, -1.6364));
}

type Channel = 'r' | 'g' | 'b';

// Jupiter's belts and zones, as fractions of the disc radius (-1 = north limb).
const BANDS: { y0: number; y1: number; c: [number, number, number] }[] = [
  { y0: -1.0, y1: -0.78, c: [188, 170, 152] },
  { y0: -0.78, y1: -0.55, c: [226, 202, 172] },
  { y0: -0.55, y1: -0.38, c: [190, 150, 115] },
  { y0: -0.38, y1: -0.2, c: [236, 213, 181] },
  { y0: -0.2, y1: -0.05, c: [172, 124, 88] },
  { y0: -0.05, y1: 0.1, c: [246, 229, 199] },
  { y0: 0.1, y1: 0.28, c: [178, 130, 95] },
  { y0: 0.28, y1: 0.48, c: [233, 209, 177] },
  { y0: 0.48, y1: 0.68, c: [196, 160, 126] },
  { y0: 0.68, y1: 1.0, c: [186, 166, 146] },
];

// Galilean moons: point sources make the colour fringing obvious too.
const MOONS: { x: number; y: number; r: number }[] = [
  { x: -2.35, y: -0.35, r: 0.055 },
  { x: -1.62, y: 0.12, r: 0.045 },
  { x: 1.78, y: -0.22, r: 0.05 },
  { x: 2.72, y: 0.3, r: 0.042 },
];

function channelColor(c: [number, number, number], chan: Channel): string {
  if (chan === 'r') return `rgb(${c[0]},0,0)`;
  if (chan === 'g') return `rgb(0,${c[1]},0)`;
  return `rgb(0,0,${c[2]})`;
}

/** Renders the planet + moons into one colour channel of an offscreen canvas. */
function drawChannelLayer(canvas: HTMLCanvasElement, w: number, h: number, radius: number, chan: Channel) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Planet disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  for (const band of BANDS) {
    ctx.fillStyle = channelColor(band.c, chan);
    ctx.fillRect(cx - radius, cy + band.y0 * radius, radius * 2, (band.y1 - band.y0) * radius + 0.5);
  }

  // Great Red Spot
  ctx.fillStyle = channelColor([198, 112, 90], chan);
  ctx.beginPath();
  ctx.ellipse(cx - radius * 0.34, cy + radius * 0.19, radius * 0.29, radius * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Limb darkening
  const limb = ctx.createRadialGradient(cx, cy, radius * 0.55, cx, cy, radius);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = limb;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();

  // Moons
  for (const m of MOONS) {
    ctx.fillStyle = channelColor([238, 232, 216], chan);
    ctx.beginPath();
    ctx.arc(cx + m.x * radius, cy + m.y * radius, m.r * radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const TabSimulatorSeeingAdc: React.FC = () => {
  const [altitude, setAltitude] = useState<number>(20);
  const [seeing, setSeeing] = useState<number>(2);
  const [adcEnabled, setAdcEnabled] = useState<boolean>(false);
  const [adcAmount, setAdcAmount] = useState<number>(0); // 0-100 % of prism rotation

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<Record<Channel, HTMLCanvasElement> | null>(null);
  const [size, setSize] = useState({ w: 720, h: 440 });

  const dispersion = dispersionArcsec(altitude);
  const mass = airMass(altitude);
  // Turbulence grows with the amount of air the light crosses.
  const effectiveSeeing = seeing * Math.pow(mass, 0.6);
  const adcCorrection = adcEnabled ? (adcAmount / 100) * ADC_MAX_CORRECTION : 0;
  const residual = dispersion - adcCorrection;

  const radius = Math.min(size.w, size.h) * 0.24;
  const pxPerArcsec = (radius * 2) / PLANET_ARCSEC;

  // Live values read by the animation loop without restarting it.
  const paramsRef = useRef({ offPx: 0, blurPx: 0, jitterPx: 0 });
  paramsRef.current = {
    offPx: (residual / 2) * pxPerArcsec,
    blurPx: Math.max(0, effectiveSeeing * pxPerArcsec * 0.42),
    jitterPx: effectiveSeeing * pxPerArcsec * 0.3,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width);
      setSize({ w: width, h: Math.max(300, Math.round(width * 0.58)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Rebuild the three colour-channel layers whenever the canvas size changes.
  useEffect(() => {
    const make = (chan: Channel) => {
      const c = document.createElement('canvas');
      drawChannelLayer(c, size.w, size.h, radius, chan);
      return c;
    };
    layersRef.current = { r: make('r'), g: make('g'), b: make('b') };
  }, [size, radius]);

  // Animation loop: recombines the channels with the current dispersion offset,
  // seeing blur and a wandering tip-tilt jitter (the "boiling" of bad seeing).
  useEffect(() => {
    let frame = 0;
    let jx = 0;
    let jy = 0;

    const render = () => {
      const canvas = canvasRef.current;
      const layers = layersRef.current;
      if (canvas && layers) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          if (canvas.width !== size.w * dpr || canvas.height !== size.h * dpr) {
            canvas.width = size.w * dpr;
            canvas.height = size.h * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const { offPx, blurPx, jitterPx } = paramsRef.current;
          // Smooth random walk so the image wobbles instead of flickering.
          jx += (Math.random() - 0.5) * jitterPx * 0.9;
          jy += (Math.random() - 0.5) * jitterPx * 0.9;
          jx *= 0.82;
          jy *= 0.82;

          ctx.globalCompositeOperation = 'source-over';
          ctx.filter = 'none';
          ctx.fillStyle = '#04060d';
          ctx.fillRect(0, 0, size.w, size.h);

          ctx.filter = blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : 'none';
          ctx.globalCompositeOperation = 'lighter';
          // Blue is refracted the most, so it lands towards the zenith (up).
          ctx.drawImage(layers.r, jx, jy + offPx, size.w, size.h);
          ctx.drawImage(layers.g, jx, jy, size.w, size.h);
          ctx.drawImage(layers.b, jx, jy - offPx, size.w, size.h);

          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  const perfectAdc = Math.min(100, (dispersion / ADC_MAX_CORRECTION) * 100);

  const residualLabel =
    Math.abs(residual) < 0.15
      ? 'Colori allineati'
      : residual > 0
        ? 'Sotto-corretto'
        : 'Sovra-corretto (fringe invertito)';

  const residualClass =
    Math.abs(residual) < 0.15 ? 'text-emerald-400' : Math.abs(residual) < 1 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="space-y-8 text-slate-100">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-0 p-2 opacity-10 pointer-events-none">
          <ApexIcon className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            Simulatori Interattivi
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
            Seeing & Dispersione Atmosferica (ADC)
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Abbassa il pianeta verso l'orizzonte e guarda cosa succede: l'atmosfera si comporta come un prisma e
            scompone l'immagine in un bordo blu verso l'alto e uno rosso verso il basso, mentre la turbolenza la fa
            ribollire. Attiva il correttore ADC e ruota i prismi per rimettere i colori a registro.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none" role="img" aria-label="Giove">
            🔭
          </span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Giove a {altitude}° sull'orizzonte
          </h3>
        </div>

        {/* Simulated view */}
        <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950">
          <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />

          {/* Zenith / horizon orientation guide */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-slate-500 pointer-events-none">
            ↑ Zenit
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-slate-500 pointer-events-none">
            ↓ Orizzonte
          </div>

          <div className="absolute bottom-3 left-3 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
            Dispersione <span className="text-cyan-300 font-bold">{dispersion.toFixed(2)}″</span>
            {adcEnabled && (
              <>
                {' '}
                · Residuo <span className={`font-bold ${residualClass}`}>{Math.abs(residual).toFixed(2)}″</span>
              </>
            )}
          </div>
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Massa d'Aria</div>
            <div className="text-xl font-extrabold text-slate-200">{mass.toFixed(2)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Allo zenit vale 1,00</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Dispersione Atmosferica</div>
            <div className="text-xl font-extrabold text-cyan-300">{dispersion.toFixed(2)}″</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Distanza blu-rosso</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Residuo dopo ADC</div>
            <div className={`text-xl font-extrabold ${residualClass}`}>{Math.abs(residual).toFixed(2)}″</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{adcEnabled ? residualLabel : 'ADC non inserito'}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Seeing Effettivo</div>
            <div className="text-xl font-extrabold text-amber-400">{effectiveSeeing.toFixed(2)}″</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{seeing.toFixed(1)}″ allo zenit</div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>
                Altezza sull'Orizzonte: <strong className="text-amber-400">{altitude}°</strong>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>
                Turbolenza / Seeing allo Zenit: <strong className="text-cyan-400">{seeing.toFixed(1)}″</strong>
              </span>
              <span className="text-[10px] text-slate-500">
                {seeing <= 1 ? 'Eccellente' : seeing <= 2 ? 'Buono' : seeing <= 3.5 ? 'Mediocre' : 'Pessimo'}
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.1}
              value={seeing}
              onChange={(e) => setSeeing(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>
        </div>

        {/* ADC panel */}
        <div
          className={`rounded-xl border p-4 transition-colors ${
            adcEnabled ? 'bg-indigo-950/30 border-indigo-500/40' : 'bg-slate-950/60 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-bold text-slate-100">Correttore di Dispersione Atmosferica (ADC)</div>
              <div className="text-[11px] text-slate-400">
                Due prismi contrapposti che introducono una dispersione uguale e contraria
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAdcEnabled((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                adcEnabled
                  ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${adcEnabled ? 'bg-emerald-400' : 'bg-slate-600'}`}
              />
              {adcEnabled ? 'ADC inserito' : 'ADC escluso'}
            </button>
          </div>

          {adcEnabled && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>
                  Rotazione Prismi: <strong className="text-indigo-300">{adcAmount}%</strong>
                </span>
                <span className="text-[10px] text-slate-500">
                  correzione {adcCorrection.toFixed(2)}″
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={adcAmount}
                onChange={(e) => setAdcAmount(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setAdcAmount(Math.round(perfectAdc))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-amber-300 border border-slate-700 hover:bg-slate-800 transition"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Regola per questa altezza
              </button>
              {dispersion > ADC_MAX_CORRECTION && (
                <p className="text-[11px] text-rose-400">
                  A questa altezza la dispersione supera la corsa massima dei prismi ({ADC_MAX_CORRECTION}″): nessun
                  ADC riesce a correggerla del tutto.
                </p>
              )}
            </div>
          )}
        </div>

        <DismissibleInfoPanel
          id="sim-seeing-adc-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Perché non conviene riprendere i pianeti troppo bassi</span>
          <p className="mt-1 leading-relaxed">
            L'atmosfera devia la luce di una quantità che dipende dal colore: il blu viene deviato più del rosso, così
            il pianeta si allarga in un piccolo spettro verticale. L'effetto cresce con la{' '}
            <strong className="text-slate-100">tangente della distanza zenitale</strong>: è trascurabile allo zenit,
            vale circa 1,2″ a 45° di altezza e supera 4,5″ a 15°, molto più del dettaglio più fine che il telescopio
            riesce a risolvere. In più, a bassa altezza la luce attraversa molta più aria (la massa d'aria passa da
            1,0 a oltre 3,8 a 15°) e la turbolenza gonfia di conseguenza il{' '}
            <strong className="text-amber-300">seeing</strong>. L'<strong className="text-indigo-300">ADC</strong>{' '}
            interviene solo sul primo problema: due prismi ruotabili introducono una dispersione uguale e opposta a
            quella atmosferica, riportando i colori a registro. Ruotandoli troppo si sovra-corregge e le frange si
            invertono. Il seeing, invece, non si corregge con l'ottica: l'unico rimedio è aspettare che il soggetto
            salga più in alto.
          </p>
        </DismissibleInfoPanel>
      </div>
    </div>
  );
};
