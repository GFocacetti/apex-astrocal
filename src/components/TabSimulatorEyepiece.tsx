import React, { useState, useRef, useEffect } from 'react';
import { Telescope, Info, Sparkles } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

const AFOV_MIN = 25;
const AFOV_MAX = 120;

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
  x: number; // -1..1 in sky units, scaled by magnification at draw time
  y: number;
  r: number;
  alpha: number;
  hue: number;
}

const STARS: Star[] = (() => {
  const rand = mulberry32(20260807);
  return Array.from({ length: 900 }, () => ({
    x: rand() * 4 - 2,
    y: rand() * 4 - 2,
    r: 0.4 + rand() * rand() * 2.2,
    alpha: 0.25 + rand() * 0.75,
    hue: 200 + rand() * 60,
  }));
})();

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, magnification: number) {
  const cx = w / 2;
  const cy = h / 2;
  // Reference magnification at which the sky is drawn 1:1; the target and star
  // separations grow linearly with magnification relative to this.
  const zoom = magnification / 100;
  const unit = Math.min(w, h) / 2;

  ctx.fillStyle = '#03060f';
  ctx.fillRect(0, 0, w, h);

  // Nebula in the centre - a layered radial glow that scales with magnification
  const nebulaRadius = unit * 0.28 * zoom;
  if (nebulaRadius > 0.5) {
    const layers: { r: number; color: string }[] = [
      { r: nebulaRadius * 1.6, color: 'rgba(56, 89, 168, 0.20)' },
      { r: nebulaRadius * 1.1, color: 'rgba(120, 74, 178, 0.28)' },
      { r: nebulaRadius * 0.7, color: 'rgba(196, 92, 132, 0.34)' },
      { r: nebulaRadius * 0.34, color: 'rgba(240, 190, 150, 0.45)' },
    ];
    for (const layer of layers) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, layer.r);
      grad.addColorStop(0, layer.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, layer.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bright core
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, nebulaRadius * 0.16);
    core.addColorStop(0, 'rgba(255, 244, 224, 0.9)');
    core.addColorStop(1, 'rgba(255, 244, 224, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, nebulaRadius * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // Star field - positions spread out with magnification, sizes grow slightly
  for (const s of STARS) {
    const px = cx + s.x * unit * zoom;
    const py = cy + s.y * unit * zoom;
    if (px < -5 || px > w + 5 || py < -5 || py > h + 5) continue;
    const radius = s.r * Math.min(2.2, 0.7 + zoom * 0.5);
    ctx.fillStyle = `hsla(${s.hue}, 70%, 88%, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
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

    drawSky(ctx, size.w, size.h, magnification);
  }, [size, magnification]);

  // The eyepiece window scales strictly with AFOV, independently of magnification.
  const afovFraction = (afov - AFOV_MIN) / (AFOV_MAX - AFOV_MIN);
  const holeRadiusPct = 14 + afovFraction * 34; // % of the container's smaller side

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

        {/* Eyepiece view */}
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
              background: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) ${holeRadiusPct}%, rgba(0,0,0,0.97) ${
                holeRadiusPct + 0.6
              }%)`,
            }}
          />
          {/* Eyepiece field stop ring */}
          <div
            className="absolute left-1/2 top-1/2 rounded-full pointer-events-none border border-slate-500/40"
            style={{
              width: `${holeRadiusPct * 2}%`,
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, -50%)',
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.9)',
            }}
          />
          <div className="absolute bottom-3 left-3 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
            Campo Apparente <span className="text-cyan-300 font-bold">{afov}°</span> · Ingrandimento{' '}
            <span className="text-amber-300 font-bold">{Math.round(magnification)}×</span>
          </div>
        </div>

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

        {/* Controls */}
        <div className="space-y-3">
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
                Focale Oculare: <strong className="text-indigo-300">{focalLength} mm</strong>
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={focalLength}
              onChange={(e) => setFocalLength(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>
                Focale Telescopio: <strong className="text-amber-400">{telescopeFocal} mm</strong>
              </span>
            </div>
            <input
              type="range"
              min={400}
              max={3000}
              step={50}
              value={telescopeFocal}
              onChange={(e) => setTelescopeFocal(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
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
      </div>
    </div>
  );
};
