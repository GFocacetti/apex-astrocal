import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Info, Ruler, Shuffle } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

// Almost every refractor flattener and reducer is designed for 55 mm of back
// focus, measured from its rear shoulder to the sensor surface.
const TARGET_MM = 55;
const MIN_MM = 45;
const MAX_MM = 65;

// Below this the corner stars are round enough that the eye cannot tell.
const TOLERANCE_MM = 0.6;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STARS = (() => {
  const rand = mulberry32(8123);
  return Array.from({ length: 190 }, () => ({
    x: rand(),
    y: rand(),
    size: 0.9 + rand() * rand() * 3.4,
    bright: 0.45 + rand() * 0.55,
    warm: rand(),
  }));
})();

/**
 * Renders the frame. Wrong back focus leaves the centre of the field sharp and
 * smears the stars more and more towards the corners: that gradient is the
 * signature that tells it apart from plain defocus or from tilt.
 */
function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, errorMm: number) {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);

  ctx.fillStyle = '#04060e';
  ctx.fillRect(0, 0, w, h);

  // Faint nebulosity, so the frame does not look like a bare test chart
  const neb = ctx.createRadialGradient(cx * 0.7, cy * 1.2, 0, cx * 0.7, cy * 1.2, maxR * 0.8);
  neb.addColorStop(0, 'rgba(70, 60, 130, 0.16)');
  neb.addColorStop(1, 'rgba(20, 20, 60, 0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, w, h);

  const absErr = Math.abs(errorMm);

  for (const s of STARS) {
    const px = s.x * w;
    const py = s.y * h;
    const dx = px - cx;
    const dy = py - cy;
    const r = Math.hypot(dx, dy) / maxR; // 0 at centre, 1 at the corners

    // Aberration grows with the distance from the optical axis, squared: the
    // corners suffer far more than the middle of the field.
    const elong = 1 + absErr * 0.55 * r * r;

    // Too far from the corrector smears the stars radially, too close smears
    // them tangentially. Which way round it goes depends on the corrector, so
    // the reliable clue is the corners degrading while the centre stays sharp.
    const radialAngle = Math.atan2(dy, dx);
    const angle = errorMm > 0 ? radialAngle : radialAngle + Math.PI / 2;

    const base = s.size * (1 + absErr * 0.02);
    const tint = s.warm < 0.3 ? [255, 226, 200] : s.warm < 0.7 ? [232, 240, 255] : [200, 220, 255];

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    // Stretch along the aberration axis while keeping the total light constant
    ctx.scale(elong, 1 / Math.sqrt(elong));
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, base * 2.6);
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${s.bright})`);
    g.addColorStop(0.45, `rgba(${tint[0]},${tint[1]},${tint[2]},${s.bright * 0.4})`);
    g.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, base * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const TabSimulatorBackfocus: React.FC = () => {
  const [spacing, setSpacing] = useState<number>(59);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cornerRefs = [
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLCanvasElement>(null),
  ];
  const [size, setSize] = useState({ w: 640, h: 420 });

  const errorMm = spacing - TARGET_MM;
  const absErr = Math.abs(errorMm);
  const isGood = absErr <= TOLERANCE_MM;

  const verdict = isGood
    ? 'Spaziatura corretta: stelle puntiformi fino agli angoli'
    : errorMm > 0
      ? 'Sensore troppo lontano: allungamento radiale agli angoli'
      : 'Sensore troppo vicino: allungamento tangenziale agli angoli';

  const verdictClass = isGood ? 'text-emerald-400' : absErr < 2 ? 'text-amber-400' : 'text-rose-400';

  // Elongation suffered by a star right in the corner, as a percentage.
  const cornerElong = useMemo(() => absErr * 0.55 * 100, [absErr]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width);
      setSize({ w: Math.round(width), h: Math.round(width * 0.66) });
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
    drawFrame(ctx, size.w, size.h, errorMm);

    // Magnified corner crops, the way you actually inspect a sub-exposure
    const crop = Math.min(size.w, size.h) * 0.26;
    const corners: [number, number][] = [
      [0, 0],
      [size.w - crop, 0],
      [0, size.h - crop],
      [size.w - crop, size.h - crop],
    ];
    cornerRefs.forEach((ref, i) => {
      const c = ref.current;
      if (!c) return;
      const cctx = c.getContext('2d');
      if (!cctx) return;
      const side = 128;
      c.width = side * dpr;
      c.height = side * dpr;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cctx.imageSmoothingEnabled = true;
      cctx.fillStyle = '#04060e';
      cctx.fillRect(0, 0, side, side);
      cctx.drawImage(canvas, corners[i][0] * dpr, corners[i][1] * dpr, crop * dpr, crop * dpr, 0, 0, side, side);
    });
  }, [size, errorMm]);

  const randomize = () => {
    const sign = Math.random() < 0.5 ? -1 : 1;
    setSpacing(Number((TARGET_MM + sign * (2 + Math.random() * 7)).toFixed(1)));
  };

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
            Il Rompicapo del Backfocus
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Lo spianatore di campo funziona solo a una distanza precisa dal sensore. Sbagliala di pochi millimetri e
            il centro resta perfetto mentre gli angoli si riempiono di stelle allungate. Muovi il cursore e impara a
            riconoscere il difetto — e da che parte correggerlo.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Ruler className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Spaziatura {spacing.toFixed(1)} mm · richiesti {TARGET_MM} mm
          </h3>
        </div>

        {/* Full frame */}
        <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950">
          <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
          <div className="absolute top-3 left-3 text-[11px] bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <span className={`font-bold ${verdictClass}`}>{verdict}</span>
          </div>
          <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1">
            il centro resta sempre a fuoco
          </div>
        </div>

        {/* Magnified corners */}
        <div>
          <div className="text-[11px] text-slate-400 mb-2">
            Angoli ingranditi — è qui che si giudica, non al centro
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['in alto a sinistra', 'in alto a destra', 'in basso a sinistra', 'in basso a destra'].map((label, i) => (
              <div key={label} className="bg-slate-950 border border-slate-800 rounded-xl p-2">
                <canvas
                  ref={cornerRefs[i]}
                  style={{ width: 128, height: 128 }}
                  className="block w-full rounded-lg"
                />
                <div className="text-[10px] text-slate-500 mt-1.5 text-center">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Errore di Spaziatura</div>
            <div className={`text-xl font-extrabold ${verdictClass}`}>
              {errorMm > 0 ? '+' : ''}
              {errorMm.toFixed(1)} mm
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">rispetto ai {TARGET_MM} mm richiesti</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Allungamento agli Angoli</div>
            <div className={`text-xl font-extrabold ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
              {cornerElong.toFixed(0)}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">rispetto a una stella tonda</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Direzione</div>
            <div className="text-xl font-extrabold text-cyan-300">
              {isGood ? '—' : errorMm > 0 ? 'Radiale' : 'Tangenziale'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isGood ? 'stelle tonde' : errorMm > 0 ? 'puntano verso il centro' : 'archi attorno al centro'}
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Correzione</div>
            <div className="text-xl font-extrabold text-amber-400">
              {isGood ? 'nessuna' : `${errorMm > 0 ? 'togli' : 'aggiungi'} ${absErr.toFixed(1)}`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{isGood ? 'sei in tolleranza' : 'mm di spessori'}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>
                Distanza spianatore-sensore:{' '}
                <strong className={isGood ? 'text-emerald-400' : 'text-amber-400'}>{spacing.toFixed(1)} mm</strong>
              </span>
              <span className="text-[10px] text-slate-500">troppo vicino ← {TARGET_MM} mm → troppo lontano</span>
            </div>
            <input
              type="range"
              min={MIN_MM}
              max={MAX_MM}
              step={0.5}
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-400 mr-1">Spessori comuni</span>
            {[-5, -2, -0.5, 0.5, 2, 5].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSpacing((s) => Math.max(MIN_MM, Math.min(MAX_MM, Number((s + d).toFixed(1)))))}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-950 text-slate-300 border border-slate-700 hover:bg-slate-800 transition"
              >
                {d > 0 ? '+' : ''}
                {d} mm
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSpacing(TARGET_MM)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25 transition"
            >
              Esattamente {TARGET_MM} mm
            </button>
            <button
              type="button"
              onClick={randomize}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-950 text-amber-300 border border-slate-700 hover:bg-slate-800 transition ml-auto"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Sbaglia a caso
            </button>
          </div>
        </div>

        <DismissibleInfoPanel
          id="sim-backfocus-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Che cos'è il backfocus e come si diagnostica</span>
          <p className="mt-1 leading-relaxed">
            Uno <strong className="text-slate-100">spianatore di campo</strong> (o un riduttore, o un correttore di
            coma) è calcolato per lavorare a una distanza ben precisa dal piano del sensore: quasi sempre{' '}
            <strong className="text-amber-300">55 mm</strong> misurati dalla sua battuta posteriore. In quella
            distanza rientra tutto ciò che sta in mezzo — anello adattatore, ruota portafiltri, tiraggio della
            camera, spessore del filtro — ed è per questo che i costruttori dichiarano il backfocus della camera
            fino alla superficie del sensore. Da notare che un filtro nel percorso ottico{' '}
            <strong className="text-slate-100">allunga</strong> il cammino di circa un terzo del proprio spessore:
            un filtro da 3 mm sposta il fuoco di circa 1 mm, e va messo in conto.
            <br />
            <br />
            <strong className="text-slate-100">Come si riconosce.</strong> Il segno distintivo non è la forma delle
            stelle, ma <em>dove</em> si deformano: con il backfocus sbagliato il centro del campo resta perfetto e
            il degrado cresce verso i bordi, in modo simmetrico nei quattro angoli. Se invece un angolo è molto
            peggiore di quello opposto non è backfocus ma{' '}
            <strong className="text-slate-100">tilt</strong>, cioè il sensore non è perpendicolare all'asse ottico.
            Se sono sgranate anche le stelle al centro, il problema è semplicemente la messa a fuoco, o
            l'inseguimento.
            <br />
            <br />
            <strong className="text-slate-100">In che verso correggere.</strong> Si dice comunemente che una
            distanza eccessiva produca allungamenti <em>radiali</em> (le stelle puntano verso il centro) e una
            distanza insufficiente allungamenti <em>tangenziali</em> (archi concentrici), ed è la convenzione usata
            in questo simulatore. Attenzione però: il verso dipende dallo schema ottico del correttore, e su alcuni
            modelli è invertito. Il metodo davvero affidabile è empirico: cambia la spaziatura di{' '}
            <strong className="text-slate-100">2-3 mm in una direzione</strong> e scatta di nuovo. Se gli angoli
            migliorano prosegui in quel verso, se peggiorano torna indietro e vai dall'altra parte. Bastano pochi
            tentativi per convergere, e conviene farli su un campo stellare ricco, a fuoco perfetto e con
            l'inseguimento in ordine, altrimenti si finisce per inseguire il problema sbagliato.
          </p>
        </DismissibleInfoPanel>
      </div>
    </div>
  );
};
