import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Info, Focus, Shuffle, Minus, Plus } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

// Focus error range, in arbitrary "focuser steps". Zero is perfect focus.
const FOCUS_RANGE = 120;

// Tilt of the two oblique groups of slots, which is also the half-angle of the
// X they produce. The same value drives the mask diagram and the star pattern.
const SPIKE_HALF_ANGLE = 35;

// How far the central spike slides sideways per step of focus error.
const SHIFT_PER_STEP = 0.42;

// Below this error the three spikes look symmetric to the eye.
const PERFECT_THRESHOLD = 2;

/** Draws one diffraction spike, offset perpendicular to its own direction. */
function drawSpike(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angleDeg: number,
  length: number,
  perpOffset: number,
  intensity: number,
  color: string
) {
  const a = (angleDeg * Math.PI) / 180;
  // Shift perpendicular to the spike axis; a positive offset moves it right.
  const ox = Math.cos(a - Math.PI / 2) * perpOffset;
  const oy = Math.sin(a - Math.PI / 2) * perpOffset;

  ctx.save();
  ctx.translate(cx + ox, cy + oy);
  ctx.rotate(a);
  ctx.globalCompositeOperation = 'lighter';

  // Three passes: broad glow, mid body, thin bright core.
  const passes = [
    { w: 9, alpha: 0.1 },
    { w: 3.2, alpha: 0.28 },
    { w: 1.15, alpha: 0.85 },
  ];
  for (const p of passes) {
    const grad = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
    grad.addColorStop(0, `rgba(${color}, 0)`);
    grad.addColorStop(0.18, `rgba(${color}, ${p.alpha * intensity * 0.35})`);
    grad.addColorStop(0.5, `rgba(${color}, ${p.alpha * intensity})`);
    grad.addColorStop(0.82, `rgba(${color}, ${p.alpha * intensity * 0.35})`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(-length / 2, -p.w / 2, length, p.w);
  }
  ctx.restore();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  focus: number,
  maskOn: boolean
) {
  const cx = w / 2;
  const cy = h / 2;
  const err = Math.abs(focus);

  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#03050c';
  ctx.fillRect(0, 0, w, h);

  // A few faint field stars for context
  ctx.globalCompositeOperation = 'lighter';
  const faint: [number, number, number][] = [
    [0.16, 0.22, 1.1],
    [0.82, 0.18, 0.9],
    [0.74, 0.79, 1.3],
    [0.24, 0.83, 0.8],
    [0.55, 0.12, 0.7],
  ];
  for (const [fx, fy, fr] of faint) {
    const r = fr * (1 + err * 0.045);
    const g = ctx.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, r * 4);
    g.addColorStop(0, 'rgba(200, 220, 255, 0.75)');
    g.addColorStop(1, 'rgba(200, 220, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(fx * w, fy * h, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const spikeLength = Math.min(w, h) * 0.82;

  if (maskOn) {
    // Defocus softens the whole pattern, so a badly focused mask is harder to read.
    ctx.filter = err > 1 ? `blur(${Math.min(3.5, err * 0.035).toFixed(2)}px)` : 'none';

    const intensity = Math.max(0.35, 1 - err / 260);

    // The two arms of the X stay put: they are produced by the fixed V slots.
    drawSpike(ctx, cx, cy, 90 - SPIKE_HALF_ANGLE, spikeLength, 0, intensity, '190, 214, 255');
    drawSpike(ctx, cx, cy, 90 + SPIKE_HALF_ANGLE, spikeLength, 0, intensity, '190, 214, 255');

    // The central spike slides sideways in proportion to the focus error.
    drawSpike(ctx, cx, cy, 90, spikeLength, focus * SHIFT_PER_STEP, intensity, '255, 236, 200');

    // Bright core where everything overlaps
    const coreR = 4 + err * 0.05;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 4);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    core.addColorStop(0.35, 'rgba(220, 235, 255, 0.5)');
    core.addColorStop(1, 'rgba(180, 210, 255, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // No mask: just a star that swells into a disc as you defocus. Near focus
    // it is very hard to judge which side you are on - that is the whole point.
    ctx.filter = 'none';
    const radius = 2.4 + err * 0.24;

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.6);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    halo.addColorStop(0.28, 'rgba(215, 232, 255, 0.55)');
    halo.addColorStop(1, 'rgba(150, 190, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Well out of focus a reflector shows the shadow of the secondary mirror.
    if (err > 28) {
      const hole = Math.min(radius * 0.55, (err - 28) * 0.12);
      ctx.globalCompositeOperation = 'destination-out';
      const h2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, hole);
      h2.addColorStop(0, 'rgba(0,0,0,0.85)');
      h2.addColorStop(0.7, 'rgba(0,0,0,0.6)');
      h2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = h2;
      ctx.beginPath();
      ctx.arc(cx, cy, hole, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    }
  }

  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
}

/** Small diagram of the physical mask, drawn after a real Bahtinov mask. */
const MaskDiagram: React.FC = () => {
  // Parallel bars, repeated identically across each of the three sectors.
  const bars = [-44, -36, -28, -20, -12, -4, 4, 12, 20, 28, 36, 44];
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" role="img" aria-label="Schema della maschera di Bahtinov">
      <defs>
        <clipPath id="bahtinov-disc">
          <circle cx="60" cy="60" r="46" />
        </clipPath>
        <clipPath id="bahtinov-top">
          <rect x="0" y="0" width="120" height="60" />
        </clipPath>
        <clipPath id="bahtinov-left">
          <rect x="0" y="60" width="60" height="60" />
        </clipPath>
        <clipPath id="bahtinov-right">
          <rect x="60" y="60" width="60" height="60" />
        </clipPath>
      </defs>

      {/* Mounting tabs around the rim */}
      {[-55, 55, 180].map((a) => (
        <g key={a} transform={`rotate(${a} 60 60)`}>
          <rect x="54.5" y="2" width="11" height="12" rx="2.5" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <line x1="60" y1="5" x2="60" y2="11" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}

      {/* Body of the mask */}
      <circle cx="60" cy="60" r="51" fill="#0f172a" stroke="#334155" strokeWidth="2" />

      <g clipPath="url(#bahtinov-disc)" stroke="#64748b" strokeWidth="3.2" strokeLinecap="butt">
        {/* Upper half: bars running straight up and down */}
        <g clipPath="url(#bahtinov-top)">
          {bars.map((d) => (
            <line key={`t${d}`} x1={60 + d} y1={-20} x2={60 + d} y2={140} />
          ))}
        </g>
        {/* Lower-left quadrant: bars tilted so the two lower groups splay apart
            towards the bottom. The clip must sit on an outer group, otherwise
            the transform would rotate the clipping region along with the bars. */}
        <g clipPath="url(#bahtinov-left)">
          <g transform={`rotate(${SPIKE_HALF_ANGLE} 60 60)`}>
            {bars.map((d) => (
              <line key={`l${d}`} x1={60 + d} y1={-90} x2={60 + d} y2={210} />
            ))}
          </g>
        </g>
        {/* Lower-right quadrant: mirrored, so the two form a chevron */}
        <g clipPath="url(#bahtinov-right)">
          <g transform={`rotate(${-SPIKE_HALF_ANGLE} 60 60)`}>
            {bars.map((d) => (
              <line key={`r${d}`} x1={60 + d} y1={-90} x2={60 + d} y2={210} />
            ))}
          </g>
        </g>
      </g>
    </svg>
  );
};

export const TabSimulatorBahtinov: React.FC = () => {
  const [focus, setFocus] = useState<number>(45);
  const [maskOn, setMaskOn] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 640, h: 440 });

  const err = Math.abs(focus);
  const isPerfect = err <= PERFECT_THRESHOLD;
  const shiftPx = Math.abs(focus * SHIFT_PER_STEP);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(300, entry.contentRect.width);
      setSize({ w: width, h: Math.max(300, Math.round(width * 0.72)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, size.w, size.h, focus, maskOn);
  }, [size, focus, maskOn]);

  const clamp = (v: number) => Math.max(-FOCUS_RANGE, Math.min(FOCUS_RANGE, v));
  const nudge = (delta: number) => setFocus((f) => clamp(f + delta));

  const randomize = () => {
    const sign = Math.random() < 0.5 ? -1 : 1;
    setFocus(sign * Math.round(25 + Math.random() * 85));
  };

  const statusText = !maskOn
    ? 'Maschera non inserita'
    : isPerfect
      ? 'Fuoco perfetto: i tre spike sono simmetrici'
      : focus > 0
        ? 'Spike centrale spostato a destra'
        : 'Spike centrale spostato a sinistra';

  const statusClass = !maskOn
    ? 'text-slate-400'
    : isPerfect
      ? 'text-emerald-400'
      : err < 12
        ? 'text-amber-400'
        : 'text-rose-400';

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
            Maschera di Bahtinov
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Prova a mettere a fuoco una stella guardando solo il suo disco: è quasi impossibile capire da che parte
            sbagli. Poi inserisci la maschera di Bahtinov e trova il punto in cui lo spike centrale passa esattamente
            per il centro della X. È così che si mette a fuoco in astrofotografia.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Focus className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
              Vista al Sensore
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setMaskOn((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              maskOn
                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${maskOn ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {maskOn ? 'Maschera inserita' : 'Applica Bahtinov'}
          </button>
        </div>

        {/* Star view */}
        <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950">
          <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
          <div className="absolute top-3 left-3 text-[11px] bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <span className={`font-bold ${statusClass}`}>{statusText}</span>
          </div>
          {maskOn && isPerfect && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 rounded-lg px-3 py-1.5">
              A fuoco — puoi iniziare a riprendere
            </div>
          )}
        </div>

        {/* Focus controls, right under the view they act on */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>
                Manopola del Fuoco:{' '}
                <strong className={isPerfect ? 'text-emerald-400' : 'text-amber-400'}>
                  {focus > 0 ? '+' : ''}
                  {focus}
                </strong>
              </span>
              <span className="text-[10px] text-slate-500">intra-focale ← 0 → extra-focale</span>
            </div>
            <input
              type="range"
              min={-FOCUS_RANGE}
              max={FOCUS_RANGE}
              step={1}
              value={focus}
              onChange={(e) => setFocus(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 mr-1">Grossolana</span>
            <button
              type="button"
              onClick={() => nudge(-10)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
            >
              <Minus className="w-3.5 h-3.5" />
              10
            </button>
            <button
              type="button"
              onClick={() => nudge(10)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              10
            </button>

            <span className="text-[11px] text-slate-400 ml-3 mr-1">Fine</span>
            <button
              type="button"
              onClick={() => nudge(-1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
            >
              <Minus className="w-3.5 h-3.5" />1
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />1
            </button>

            <button
              type="button"
              onClick={randomize}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-amber-300 border border-slate-700 hover:bg-slate-800 transition ml-auto"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Sfoca a caso e riprova
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Prova prima senza maschera: attorno allo zero il disco cambia così poco che non capisci da che parte
            stai sbagliando. Con la maschera inserita, invece, lo spostamento dello spike centrale te lo dice subito,
            e ti dice anche <em>in che verso</em> correggere.
          </p>
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Errore di Fuoco</div>
            <div className={`text-xl font-extrabold ${isPerfect ? 'text-emerald-400' : 'text-amber-400'}`}>
              {focus > 0 ? '+' : ''}
              {focus}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">passi del focheggiatore</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Scostamento Spike</div>
            <div className={`text-xl font-extrabold ${isPerfect ? 'text-emerald-400' : 'text-cyan-300'}`}>
              {shiftPx.toFixed(1)} px
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {maskOn ? 'rispetto al centro della X' : 'visibile solo con la maschera'}
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Diametro Stella</div>
            <div className="text-xl font-extrabold text-slate-200">{(2.4 + err * 0.24).toFixed(1)} px</div>
            <div className="text-[10px] text-slate-500 mt-0.5">senza maschera</div>
          </div>
        </div>

        <DismissibleInfoPanel
          id="sim-bahtinov-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Come funziona davvero la maschera di Bahtinov</span>
          <p className="mt-1 leading-relaxed">
            La maschera è un disco forato che si appoggia davanti all'obiettivo del telescopio e sfrutta la{' '}
            <strong className="text-slate-100">diffrazione</strong>: ogni gruppo di fessure parallele trasforma la
            luce di una stella in una lunga riga luminosa perpendicolare alle fessure stesse. I due gruppi inclinati
            (a circa ±{SPIKE_HALF_ANGLE}°) producono i due bracci della <strong className="text-slate-100">X</strong>
            , il gruppo dritto produce lo <strong className="text-amber-300">spike centrale</strong>. Quando il piano
            focale è esattamente sul sensore, i tre spike si incontrano nello stesso punto e la figura è
            perfettamente simmetrica. Appena sposti il fuoco, il fascio che genera lo spike centrale arriva al
            sensore con un angolo leggermente diverso rispetto agli altri due, e la sua riga{' '}
            <strong className="text-slate-100">trasla lateralmente</strong> rispetto all'incrocio della X: da che
            parte si sposta ti dice se sei <em>intra-focale</em> o <em>extra-focale</em>, e di quanto. Il punto
            di forza è la sensibilità: l'occhio riconosce un disallineamento tra due linee molto meglio di quanto
            sappia giudicare se un disco è "un po' più piccolo" — ecco perché con la maschera si mette a fuoco in
            pochi secondi e con una precisione altrimenti irraggiungibile. Usala su una stella luminosa (magnitudine
            1-3), a ingrandimento pieno sullo schermo, e ricordati di{' '}
            <strong className="text-rose-300">toglierla prima di iniziare a riprendere</strong>: lasciata su, taglia
            gran parte della luce e riempie l'immagine di spike. Rifai il fuoco durante la notte, perché il
            raffreddamento del tubo lo fa migrare.
          </p>
        </DismissibleInfoPanel>

        {/* Mask diagram */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
          <div className="text-sm font-bold text-slate-100 mb-3">La maschera</div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-40 h-40 shrink-0">
              <MaskDiagram />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tre gruppi di fessure parallele ricavate in un unico disco. Il gruppo dritto genera lo spike centrale,
              i due gruppi inclinati di ±{SPIKE_HALF_ANGLE}° formano i bracci della X. Ogni gruppo produce una riga
              luminosa <strong className="text-slate-200">perpendicolare</strong> alle proprie fessure. La maschera si
              appoggia davanti all'apertura del telescopio e si può montare con qualsiasi rotazione: gli spike ruotano
              insieme a lei, quindi conta solo la loro simmetria, non il loro orientamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
