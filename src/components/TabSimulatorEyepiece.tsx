import React, { useState, useRef, useEffect } from 'react';
import { Telescope, Info, Sparkles } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';
import { ApexIcon } from './ApexIcon';

// Apparent field: the upper bound is the widest eyepiece ever sold, the Explore
// Scientific 9mm 120°. The lower bound sits below anything currently in
// production (a Vixen HR planetary is 42°, a Plössl 50-52°) so that the old
// narrow Huygens and Ramsden designs are still representable.
const AFOV_MIN = 25;
const AFOV_MAX = 120;

// Eyepiece focal lengths actually on the market: the shortest is the Vixen HR
// 1.6mm, the longest the 3"-barrel Masuyama/APM 80mm. The common 1.25"/2"
// range everyone owns sits between roughly 3.5mm and 56mm.
const EYEPIECE_MIN = 1.6;
const EYEPIECE_MAX = 80;

// Deterministic star field so the background stays fixed while the sliders move.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star {
  dx: number; // offset from the centre of the field, in degrees
  dy: number;
  r: number; // radius on screen, in pixels: a star is a point source, so it
  alpha: number; // does not grow when you magnify it
  hue: number;
}

// The star field is built as nested patches, each half the angular size of the
// one above it and carrying the same number of stars. Whichever patch is
// closest in size to the field currently framed fills it at full density, so
// the eyepiece stays populated edge to edge whether it frames 96° of sky or a
// hundredth of a degree. A single flat list cannot do that: spread wide enough
// for the rich-field view it leaves the high-power view empty, and packed
// tight enough for high power it collapses into a knot when you zoom out.
const STAR_LEVELS = 15;
const STARS_PER_LEVEL = 300;
const TOP_PATCH_HALF_DEG = 90;

const patchHalfDeg = (level: number) => TOP_PATCH_HALF_DEG / 2 ** level;

const STAR_FIELD: Star[][] = Array.from({ length: STAR_LEVELS }, (_, level) => {
  const rand = mulberry32(20260807 + level * 7919);
  const half = patchHalfDeg(level);
  return Array.from({ length: STARS_PER_LEVEL }, () => ({
    dx: (rand() * 2 - 1) * half,
    dy: (rand() * 2 - 1) * half,
    r: 0.4 + rand() * rand() * 1.9,
    alpha: 0.3 + rand() * 0.7,
    hue: 200 + rand() * 60,
  }));
});

// M42 spans roughly 85' x 60'; the Trapezium sits inside the brightest knot,
// its four components a handful of arcseconds apart.
const M42_WIDTH_DEG = 1.4;
const TRAPEZIUM_ARCSEC: { dx: number; dy: number; r: number }[] = [
  { dx: -9, dy: 2, r: 1.5 },
  { dx: -4, dy: -8, r: 1.3 },
  { dx: 4, dy: 3, r: 1.8 },
  { dx: 8, dy: -4, r: 1.4 },
];

interface Puff {
  x: number; // degrees from the Trapezium, +x east, +y south
  y: number;
  rx: number;
  ry: number;
  rot: number;
  a: number;
  c: [number, number, number];
}

// Emission colours: the core burns close to white, O-III gives the inner body
// its teal cast, H-alpha the pink of the outer wings and halo.
const C_CORE: [number, number, number] = [232, 244, 230];
const C_INNER: [number, number, number] = [125, 214, 194];
const C_MID: [number, number, number] = [172, 148, 210];
const C_OUTER: [number, number, number] = [212, 108, 142];
const C_M43: [number, number, number] = [206, 168, 192];
const C_RUNNING: [number, number, number] = [138, 164, 222];

// Single exposure control for the whole nebula. The per-puff alphas below are
// relative weights; this is the one number that sets how bright it burns.
const M42_GAIN = 2.6;

/**
 * M42 as a cloud of soft overlapping puffs rather than a handful of smooth
 * ellipses. Laying them along curves and stacking them additively is what
 * produces the mottled, filamentary look of a real emission nebula — a few
 * clean gradients only ever read as a blob.
 *
 * Positions are in degrees from the Trapezium, so every structure keeps its
 * true angular size: the wings span about a degree, the Fish's Mouth is a few
 * arcminutes across, the Trapezium itself a few arcseconds.
 */
const M42_PUFFS: Puff[] = (() => {
  const rand = mulberry32(19700101);
  const puffs: Puff[] = [];

  /** Chain of puffs along a quadratic Bezier, tapering in width and brightness. */
  const ridge = (
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    n: number,
    w0: number,
    w1: number,
    a0: number,
    a1: number,
    c: [number, number, number],
    jitter: number,
  ) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      const mt = 1 - t;
      const x = mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0];
      const y = mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1];
      const dx = 2 * mt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * mt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const w = w0 + (w1 - w0) * t;
      puffs.push({
        x: x + (rand() - 0.5) * jitter,
        y: y + (rand() - 0.5) * jitter,
        rx: w * (0.75 + rand() * 0.9),
        ry: w * (0.32 + rand() * 0.5),
        rot: Math.atan2(dy, dx) + (rand() - 0.5) * 0.8,
        a: (a0 + (a1 - a0) * t) * (0.55 + rand() * 0.9),
        c,
      });
    }
  };

  /** Scattered blob, for haloes and the rounder pieces. */
  const cloud = (
    x: number,
    y: number,
    spread: number,
    n: number,
    w: number,
    a: number,
    c: [number, number, number],
  ) => {
    for (let i = 0; i < n; i++) {
      const ang = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * spread;
      puffs.push({
        x: x + Math.cos(ang) * rr,
        y: y + Math.sin(ang) * rr * 0.78,
        rx: w * (0.6 + rand() * 1.1),
        ry: w * (0.45 + rand() * 0.8),
        rot: rand() * Math.PI,
        a: a * (0.5 + rand()),
        c,
      });
    }
  };

  // Broad H-alpha halo. Deliberately built from large overlapping puffs: small
  // ones scattered over a wide radius pile up at the rim and read as a ring.
  cloud(-0.01, 0.1, 0.32, 80, 0.2, 0.0055, C_OUTER);
  cloud(-0.02, 0.08, 0.19, 70, 0.13, 0.007, C_MID);

  // The body: a filled fan opening south from the Trapezium, brightest on the
  // south-western side, which is what gives M42 its lopsided look.
  cloud(-0.03, 0.075, 0.15, 120, 0.09, 0.009, C_MID);
  cloud(-0.04, 0.06, 0.1, 110, 0.065, 0.013, C_INNER);
  cloud(-0.02, 0.04, 0.062, 100, 0.042, 0.019, C_INNER);

  // The two wings. Thick lobes, not thin arcs — drawn narrow they close into a
  // bracket and the whole thing reads as a smile rather than a nebula.
  ridge([-0.04, 0.04], [-0.24, 0.06], [-0.3, 0.2], 70, 0.13, 0.07, 0.011, 0.005, C_MID, 0.05);
  ridge([-0.04, 0.04], [-0.19, 0.05], [-0.23, 0.16], 60, 0.08, 0.048, 0.015, 0.007, C_INNER, 0.035);
  ridge([0.05, 0.03], [0.24, 0.04], [0.28, 0.19], 70, 0.12, 0.065, 0.01, 0.0045, C_MID, 0.05);
  ridge([0.05, 0.03], [0.19, 0.035], [0.22, 0.15], 60, 0.075, 0.045, 0.013, 0.0065, C_INNER, 0.035);

  // Filaments: thin, higher-contrast streaks laid across the body. Without
  // them the stacked puffs average out into a smooth, flat haze.
  ridge([-0.16, 0.02], [-0.09, 0.075], [-0.02, 0.11], 34, 0.016, 0.011, 0.03, 0.02, C_INNER, 0.014);
  ridge([-0.13, 0.11], [-0.05, 0.13], [0.04, 0.15], 32, 0.014, 0.01, 0.025, 0.015, C_MID, 0.014);
  ridge([0.16, 0.04], [0.09, 0.09], [0.02, 0.13], 32, 0.014, 0.01, 0.026, 0.016, C_INNER, 0.014);
  ridge([-0.07, 0.16], [0.0, 0.19], [0.09, 0.17], 28, 0.013, 0.009, 0.02, 0.012, C_MID, 0.014);
  ridge([-0.1, -0.02], [-0.05, 0.0], [0.0, 0.005], 24, 0.011, 0.008, 0.035, 0.02, C_INNER, 0.008);

  // The bright bar running south-west of the Trapezium: the sharpest edge in
  // the whole nebula, and the thing that makes the core recognisable.
  ridge([0.04, 0.05], [-0.02, 0.042], [-0.08, 0.07], 46, 0.024, 0.018, 0.055, 0.03, C_CORE, 0.01);
  ridge([0.028, 0.014], [-0.01, 0.012], [-0.05, 0.028], 40, 0.018, 0.014, 0.07, 0.035, C_CORE, 0.008);

  // Brightest knot, wrapped tightly around the Trapezium.
  cloud(-0.005, 0.012, 0.028, 70, 0.016, 0.038, C_CORE);
  cloud(0, 0.006, 0.012, 45, 0.008, 0.07, C_CORE);

  // M43, its own little round nebula north of the dark lane, lit by one star.
  cloud(0.055, -0.19, 0.045, 60, 0.038, 0.016, C_M43);
  cloud(0.05, -0.195, 0.018, 30, 0.019, 0.03, C_M43);

  // NGC 1977, the Running Man: bluer, because it is reflection, not emission.
  // Kept very faint — it is half a degree away and only shows in a wide field.
  cloud(0.0, -0.47, 0.17, 60, 0.1, 0.004, C_RUNNING);

  return puffs;
})();

/** Dark dust lanes, painted over the emission in the sky background colour. */
const M42_LANES: { x: number; y: number; rx: number; ry: number; rot: number; a: number }[] = [
  // The Fish's Mouth: the wedge of dust pushing south into the bright core,
  // stopping just short of the Trapezium. It has to overlap the emission to
  // read as a notch — placed above it, there is nothing there to carve.
  { x: 0.075, y: -0.075, rx: 0.062, ry: 0.045, rot: -0.4, a: 0.95 },
  { x: 0.05, y: -0.032, rx: 0.045, ry: 0.03, rot: -0.55, a: 0.95 },
  { x: 0.032, y: -0.002, rx: 0.03, ry: 0.019, rot: -0.7, a: 0.9 },
  { x: 0.022, y: 0.018, rx: 0.019, ry: 0.012, rot: -0.8, a: 0.7 },
  // The gap that separates M42 from M43.
  { x: 0.09, y: -0.14, rx: 0.1, ry: 0.028, rot: 0.15, a: 0.8 },
  { x: -0.03, y: -0.135, rx: 0.09, ry: 0.024, rot: -0.1, a: 0.7 },
  // Lanes cutting into the wings and the southern body.
  { x: -0.2, y: 0.05, rx: 0.09, ry: 0.022, rot: 0.3, a: 0.45 },
  { x: 0.19, y: 0.055, rx: 0.08, ry: 0.02, rot: -0.28, a: 0.4 },
  { x: -0.02, y: 0.215, rx: 0.13, ry: 0.03, rot: 0.06, a: 0.4 },
];

function drawOrionNebula(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, cy: number, pxPerDeg: number) {
  const ellipse = (p: { x: number; y: number; rx: number; ry: number; rot: number }, color: (stop: number) => string) => {
    const px = cx + p.x * pxPerDeg;
    const py = cy + p.y * pxPerDeg;
    const rx = p.rx * pxPerDeg;
    const ry = p.ry * pxPerDeg;
    const reach = Math.max(rx, ry);
    if (px + reach < 0 || px - reach > w || py + reach < 0 || py - reach > h) return;
    if (reach < 0.35) return;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.rot);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, color(0));
    g.addColorStop(0.55, color(0.55));
    g.addColorStop(1, color(1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Emission stacks additively, the way overlapping gas actually brightens.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of M42_PUFFS) {
    ellipse(p, (stop) => `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${p.a * M42_GAIN * (1 - stop) ** 1.6})`);
  }
  ctx.restore();

  for (const l of M42_LANES) {
    ellipse(l, (stop) => `rgba(3, 6, 15, ${l.a * (1 - stop) ** 1.3})`);
  }
}

function drawTrapezium(ctx: CanvasRenderingContext2D, cx: number, cy: number, pxPerDeg: number) {
  for (const s of TRAPEZIUM_ARCSEC) {
    const x = cx + (s.dx / 3600) * pxPerDeg;
    const y = cy + (s.dy / 3600) * pxPerDeg;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, s.r * 4);
    halo.addColorStop(0, 'rgba(255, 246, 224, 0.55)');
    halo.addColorStop(1, 'rgba(255, 246, 224, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, s.r * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draws the sky in angular coordinates: `pxPerDeg` is fixed by the eyepiece
 * field stop, so one degree of sky always occupies the same fraction of the
 * hole no matter which combination of sliders produced it.
 */
function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, realFov: number, pxPerDeg: number) {
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = '#03060f';
  ctx.fillRect(0, 0, w, h);

  drawOrionNebula(ctx, w, h, cx, cy, pxPerDeg);

  const halfFov = realFov / 2;
  for (let level = 0; level < STAR_LEVELS; level++) {
    // A patch much smaller than the framed field would bunch all its stars into
    // a knot in the middle, so it fades out once the field grows past it.
    const ratio = patchHalfDeg(level) / halfFov;
    const weight = ratio >= 1 ? 1 : ratio <= 0.5 ? 0 : (ratio - 0.5) * 2;
    if (weight <= 0) continue;

    for (const s of STAR_FIELD[level]) {
      const px = cx + s.dx * pxPerDeg;
      const py = cy + s.dy * pxPerDeg;
      if (px < -5 || px > w + 5 || py < -5 || py > h + 5) continue;
      ctx.fillStyle = `hsla(${s.hue}, 70%, 88%, ${s.alpha * weight})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTrapezium(ctx, cx, cy, pxPerDeg);
}

export const TabSimulatorEyepiece: React.FC = () => {
  const [afov, setAfov] = useState<number>(50);
  const [focalLength, setFocalLength] = useState<number>(10);
  const [telescopeFocal, setTelescopeFocal] = useState<number>(1000);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  const magnification = telescopeFocal / focalLength;
  const realFov = afov / magnification;

  // The eyepiece window scales strictly with AFOV, independently of
  // magnification. Kept in pixels rather than percentages so the field stop
  // ring, the mask and the sky scale all agree on where the edge is.
  const afovFraction = (afov - AFOV_MIN) / (AFOV_MAX - AFOV_MIN);
  const holeRadiusPx = ((14 + afovFraction * 34) / 100) * Math.min(size.w, size.h);

  // The hole shows exactly `realFov` degrees across its diameter — that is what
  // the field stop of an eyepiece does. Anchoring the sky to it is what keeps
  // the view filled to the edge at every combination of the three sliders,
  // instead of collapsing into a speck when the magnification drops to 1x.
  const pxPerDeg = (2 * holeRadiusPx) / realFov;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setSize({ w: Math.max(320, width), h: Math.max(320, Math.round(width * 0.62)) });
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

    drawSky(ctx, size.w, size.h, realFov, pxPerDeg);
  }, [size, realFov, pxPerDeg]);

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
            Campo Apparente dell'Oculare
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Sposta i cursori per capire la differenza tra campo apparente e ingrandimento: l'oblò che vedi
            all'oculare cambia dimensione solo con il campo apparente, mentre l'ingrandimento avvicina il soggetto
            senza allargare la finestra.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2">
          <Telescope className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Simulazione della Vista all'Oculare
          </h3>
        </div>

        <SimulatorStage
          view={
            <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950">
              <canvas
                ref={canvasRef}
                style={{ width: size.w, height: size.h }}
                className="block"
              />
              {/* Black mask with a circular cutout whose size depends only on AFOV */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(circle ${holeRadiusPx}px at 50% 50%, rgba(0,0,0,0) 99.4%, rgba(0,0,0,0.97) 100%)`,
                }}
              />
              {/* Eyepiece field stop ring */}
              <div
                className="absolute left-1/2 top-1/2 rounded-full pointer-events-none border border-slate-500/40"
                style={{
                  width: holeRadiusPx * 2,
                  height: holeRadiusPx * 2,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9)',
                }}
              />
              <div className="absolute bottom-3 left-3 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
                Campo Apparente <span className="text-cyan-300 font-bold">{afov}°</span> · Ingrandimento{' '}
                <span className="text-amber-300 font-bold">{Math.round(magnification)}×</span>
              </div>
              <div className="absolute top-3 left-3 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="text-slate-200 font-bold">M42</span> · Nebulosa di Orione ·{' '}
                <span className="text-slate-300">{M42_WIDTH_DEG.toFixed(1).replace('.', ',')}°</span>
              </div>
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>
                    Campo Apparente (AFOV): <strong className="text-cyan-400">{afov}°</strong>
                  </span>
                </div>
                <input
                  type="range"
                  min={AFOV_MIN}
                  max={AFOV_MAX}
                  step={1}
                  value={afov}
                  onChange={(e) => setAfov(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>
                    Focale Oculare:{' '}
                    <strong className="text-indigo-300">
                      {focalLength.toFixed(1).replace(/\.0$/, '')} mm
                    </strong>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {EYEPIECE_MIN} mm ← in commercio → {EYEPIECE_MAX} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={EYEPIECE_MIN}
                  max={EYEPIECE_MAX}
                  step={0.1}
                  value={focalLength}
                  onChange={(e) => setFocalLength(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[1.6, 3.5, 6, 10, 17, 25, 40, 56, 80].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFocalLength(f)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                        focalLength === f
                          ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>
                    Lunghezza focale: <strong className="text-amber-400">{telescopeFocal} mm</strong>
                  </span>
                  <span className="text-[10px] text-slate-500">del telescopio</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={4000}
                  step={10}
                  value={telescopeFocal}
                  onChange={(e) => setTelescopeFocal(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </>
          }
        >
          {/* Readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Ingrandimento</div>
              <div className="text-xl font-extrabold text-amber-400">{Math.round(magnification)}×</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {telescopeFocal} mm / {focalLength} mm
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Campo Reale Inquadrato</div>
              <div className="text-xl font-extrabold text-cyan-300">{realFov.toFixed(2)}°</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {(realFov * 60).toFixed(1)}′ · {afov}° / {Math.round(magnification)}×
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div className="text-[11px] text-slate-400">Lune Piene Affiancate</div>
              <div className="text-xl font-extrabold text-slate-200">{(realFov / 0.52).toFixed(1)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">La Luna misura circa 0,52°</div>
            </div>
          </div>

          <DismissibleInfoPanel
          id="sim-eyepiece-afov-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
            <span className="font-bold text-indigo-200">Campo apparente e ingrandimento non sono la stessa cosa</span>
            <p className="mt-1 leading-relaxed">
              Il <strong className="text-cyan-300">campo apparente</strong> è una caratteristica costruttiva
              dell'oculare: determina quanto è ampio l'oblò attraverso cui guardi, e non cambia se modifichi il
              telescopio. L'<strong className="text-amber-300">ingrandimento</strong> (focale del telescopio divisa
              per la focale dell'oculare) avvicina il soggetto, ma non allarga la finestra: anzi, più ingrandisci e
              meno cielo entra nel campo. Il <strong className="text-slate-100">campo reale</strong> che inquadri
              davvero è il campo apparente diviso l'ingrandimento. Per questo un oculare grandangolare a forte
              ingrandimento offre una vista molto più immersiva di un oculare stretto, pur mostrando la stessa
              porzione di cielo.
            </p>
          </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
