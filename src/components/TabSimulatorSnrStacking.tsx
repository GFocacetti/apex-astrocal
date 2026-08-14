import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { Sparkles, Info, Layers, Eye } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';
import { ApexIcon } from './ApexIcon';

// Each simulated sub-exposure is three minutes long.
const SUB_EXPOSURE_MIN = 3;

// Target signal per sub-exposure, in arbitrary units. The sky background is
// expressed in the same units, so their ratio is what drives the noise.
const TARGET_SIGNAL = 1;

// Sky background of a pristine Bortle 1 site, in the same arbitrary units.
const BASE_BACKGROUND = 0.8;

interface BortleClass {
  level: number;
  name: string;
  sqm: string; // mag/arcsec^2
  nelm: string; // naked-eye limiting magnitude
  skyMag: number; // representative sky brightness used for the physics
  description: string;
  color: string;
}

const BORTLE_SCALE: BortleClass[] = [
  {
    level: 1,
    name: 'Cielo nero eccellente',
    sqm: '21,7 - 22,0',
    nelm: '7,6 - 8,0',
    skyMag: 21.85,
    color: '#1e293b',
    description:
      'La Via Lattea proietta ombre percepibili a terra. La luce zodiacale è vivida e colorata e attraversa tutto il cielo. M33 è un oggetto ovvio a occhio nudo. Il paesaggio intorno è completamente invisibile: non vedi le tue mani.',
  },
  {
    level: 2,
    name: 'Cielo veramente buio',
    sqm: '21,5 - 21,7',
    nelm: '7,1 - 7,5',
    skyMag: 21.6,
    color: '#1e3a5f',
    description:
      'La Via Lattea è ricchissima di struttura e dettagli. La luce zodiacale è ancora evidente. Le nubi appaiono come buchi neri contro il cielo stellato. Le sagome degli oggetti a terra si intuiscono appena.',
  },
  {
    level: 3,
    name: 'Cielo rurale',
    sqm: '21,3 - 21,5',
    nelm: '6,6 - 7,0',
    skyMag: 21.4,
    color: '#1e4d3f',
    description:
      "Qualche alone luminoso all'orizzonte tradisce i paesi lontani. La Via Lattea mostra ancora buona struttura. Le nubi sono illuminate solo vicino all'orizzonte. Gli oggetti vicini si distinguono vagamente.",
  },
  {
    level: 4,
    name: 'Transizione rurale / suburbana',
    sqm: '20,4 - 21,3',
    nelm: '6,1 - 6,5',
    skyMag: 20.85,
    color: '#3f5222',
    description:
      "Le cupole di luce dei centri abitati sono ben visibili in più direzioni. La Via Lattea è ancora riconoscibile sopra la testa ma perde i dettagli fini. La luce zodiacale si intravede nelle notti migliori.",
  },
  {
    level: 5,
    name: 'Cielo suburbano',
    sqm: '19,1 - 20,4',
    nelm: '5,6 - 6,0',
    skyMag: 19.75,
    color: '#5c4a1e',
    description:
      'La Via Lattea è molto pallida o del tutto invisibile vicino all\'orizzonte. Le sorgenti luminose sono evidenti in quasi tutte le direzioni. Le nubi sono nettamente più chiare del cielo.',
  },
  {
    level: 6,
    name: 'Cielo suburbano luminoso',
    sqm: '18,4 - 19,1',
    nelm: '5,1 - 5,5',
    skyMag: 18.75,
    color: '#6b3d1e',
    description:
      "La Via Lattea è visibile solo allo zenit, se lo è. Il cielo entro 35° dall'orizzonte brilla di un grigio biancastro. M31 si scorge a fatica a occhio nudo in una notte limpida.",
  },
  {
    level: 7,
    name: 'Transizione suburbana / urbana',
    sqm: '18,0 - 18,4',
    nelm: '4,6 - 5,0',
    skyMag: 18.2,
    color: '#7a3520',
    description:
      "Tutto il cielo ha un colore grigio-biancastro. Forti sorgenti di luce in ogni direzione. La Via Lattea è invisibile. Le nubi sono decisamente luminose. Leggi facilmente senza torcia.",
  },
  {
    level: 8,
    name: 'Cielo cittadino',
    sqm: '17,5 - 18,0',
    nelm: '4,1 - 4,5',
    skyMag: 17.75,
    color: '#8a2e28',
    description:
      "Il cielo è grigio chiaro o arancione: si legge senza difficoltà. Si distinguono a occhio nudo solo le stelle degli asterismi più noti, e nemmeno tutte. Gli ammassi luminosi sono pallidi anche al telescopio.",
  },
  {
    level: 9,
    name: 'Centro cittadino',
    sqm: 'sotto 17,5',
    nelm: 'sotto 4,0',
    skyMag: 17.2,
    color: '#992424',
    description:
      "L'intero cielo è brillantemente illuminato. Si vedono la Luna, i pianeti e poche decine di stelle in tutto. Anche le Pleiadi sono difficili. Il deep-sky visuale è di fatto impossibile.",
  },
];

/** Sky background flux for a Bortle class, relative to the arbitrary units above. */
function backgroundFlux(skyMag: number): number {
  const reference = BORTLE_SCALE[0].skyMag;
  return BASE_BACKGROUND * Math.pow(10, 0.4 * (reference - skyMag));
}

/** Classic stacking result: single-frame SNR improved by the square root of N. */
function computeSnr(subs: number, skyMag: number): number {
  const bg = backgroundFlux(skyMag);
  return (TARGET_SIGNAL * Math.sqrt(subs)) / Math.sqrt(TARGET_SIGNAL + bg);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BG_STARS = (() => {
  const rand = mulberry32(90210);
  return Array.from({ length: 130 }, () => ({
    x: rand(),
    y: rand(),
    r: 0.4 + rand() * rand() * 2.2,
    a: 0.25 + rand() * 0.6,
  }));
})();

/** Draws a face-on spiral galaxy, the clean "truth" before noise is added. */
function drawGalaxy(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;

  ctx.fillStyle = '#03050c';
  ctx.fillRect(0, 0, w, h);

  // Background stars
  for (const s of BG_STARS) {
    ctx.fillStyle = `rgba(215, 228, 255, ${s.a})`;
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer disc glow
  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  disc.addColorStop(0, 'rgba(180, 200, 245, 0.42)');
  disc.addColorStop(0.45, 'rgba(120, 150, 220, 0.22)');
  disc.addColorStop(1, 'rgba(50, 70, 150, 0)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  // Two logarithmic spiral arms with HII knots along them
  const rand = mulberry32(7);
  for (let arm = 0; arm < 2; arm++) {
    const phase = arm * Math.PI;
    ctx.beginPath();
    for (let t = 0.15; t < 1; t += 0.01) {
      const angle = phase + t * 3.4;
      const rr = R * 0.12 + R * 0.82 * t;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr * 0.82;
      if (t === 0.15) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(178, 205, 255, 0.30)';
    ctx.lineWidth = R * 0.13;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(210, 228, 255, 0.22)';
    ctx.lineWidth = R * 0.05;
    ctx.stroke();

    for (let t = 0.25; t < 0.98; t += 0.09) {
      const angle = phase + t * 3.4;
      const rr = R * 0.12 + R * 0.82 * t;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr * 0.82;
      const kr = R * (0.012 + rand() * 0.02);
      const g = ctx.createRadialGradient(x, y, 0, x, y, kr * 3);
      g.addColorStop(0, 'rgba(255, 170, 190, 0.55)');
      g.addColorStop(1, 'rgba(255, 140, 170, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, kr * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bright core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.24);
  core.addColorStop(0, 'rgba(255, 250, 232, 0.95)');
  core.addColorStop(0.3, 'rgba(252, 232, 186, 0.7)');
  core.addColorStop(1, 'rgba(200, 170, 130, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.24, 0, Math.PI * 2);
  ctx.fill();
}

/** Adds the light-pollution glow and the shot noise left after stacking. */
function applyNoise(ctx: CanvasRenderingContext2D, w: number, h: number, snr: number, bortle: BortleClass) {
  // Sky glow: a warm gradient rising from the horizon, stronger in bright skies.
  const glowStrength = Math.min(0.55, Math.max(0, (21.85 - bortle.skyMag) / 9));
  if (glowStrength > 0.01) {
    const glow = ctx.createLinearGradient(0, h, 0, 0);
    glow.addColorStop(0, `rgba(150, 96, 48, ${glowStrength})`);
    glow.addColorStop(0.6, `rgba(96, 78, 70, ${glowStrength * 0.45})`);
    glow.addColorStop(1, `rgba(60, 62, 78, ${glowStrength * 0.2})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = image.data;
  // Noise amplitude in levels (0-255) is inversely proportional to the SNR.
  // The cap keeps a hopeless single sub from degenerating into pure static.
  const amplitude = Math.min(70, 22 / Math.max(0.05, snr));
  const chroma = amplitude * 0.35;

  for (let i = 0; i < data.length; i += 4) {
    // Box-Muller: one gaussian sample shared by the three channels (luminance
    // noise) plus a smaller independent part (chroma noise).
    const u1 = Math.random() || 1e-6;
    const u2 = Math.random();
    const lum = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * amplitude;
    data[i] = Math.max(0, Math.min(255, data[i] + lum + (Math.random() - 0.5) * chroma));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + lum + (Math.random() - 0.5) * chroma));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + lum + (Math.random() - 0.5) * chroma));
  }
  ctx.putImageData(image, 0, 0);
}

export const TabSimulatorSnrStacking: React.FC = () => {
  const [subs, setSubs] = useState<number>(1);
  const [bortleLevel, setBortleLevel] = useState<number>(5);
  const [showScale, setShowScale] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 720, h: 420 });

  const bortle = BORTLE_SCALE.find((b) => b.level === bortleLevel) ?? BORTLE_SCALE[4];
  const snr = computeSnr(subs, bortle.skyMag);
  const totalMinutes = subs * SUB_EXPOSURE_MIN;

  // How many subs a Bortle 2 site would need for the very same SNR.
  const darkSite = BORTLE_SCALE[1];
  const subsFromDarkSite =
    (subs * (TARGET_SIGNAL + backgroundFlux(darkSite.skyMag))) / (TARGET_SIGNAL + backgroundFlux(bortle.skyMag));

  // ...and the reverse: what this sky needs to match one hour under Bortle 2.
  const oneHourSubs = 60 / SUB_EXPOSURE_MIN;
  const subsToMatchOneHour =
    (oneHourSubs * (TARGET_SIGNAL + backgroundFlux(bortle.skyMag))) / (TARGET_SIGNAL + backgroundFlux(darkSite.skyMag));

  const chartData = useMemo(() => {
    const points: { subs: number; tuo: number; bortle2: number }[] = [];
    for (let n = 1; n <= 300; n += n < 20 ? 1 : 5) {
      points.push({
        subs: n,
        tuo: Number(computeSnr(n, bortle.skyMag).toFixed(2)),
        bortle2: Number(computeSnr(n, darkSite.skyMag).toFixed(2)),
      });
    }
    return points;
  }, [bortle.skyMag, darkSite.skyMag]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width);
      setSize({ w: width, h: Math.max(280, Math.round(width * 0.55)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The DPR transform stays in place: applyNoise draws the sky glow in CSS
    // pixels like everything else, and getImageData/putImageData ignore the
    // transform anyway. Resetting it here left the glow covering only the
    // top-left 1/dpr of the frame.
    drawGalaxy(ctx, size.w, size.h);
    applyNoise(ctx, size.w, size.h, snr, bortle);
  }, [size, snr, bortle]);

  const qualityLabel =
    snr >= 8 ? 'Immagine pulita' : snr >= 4 ? 'Rumore ancora visibile' : snr >= 2 ? 'Molto rumorosa' : 'Sepolta nel rumore';
  const qualityClass =
    snr >= 8 ? 'text-emerald-400' : snr >= 4 ? 'text-cyan-400' : snr >= 2 ? 'text-amber-400' : 'text-rose-400';

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
            Rapporto Segnale/Rumore e Stacking
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Somma le pose e guarda il rumore mediarsi via. Scoprirai che il guadagno non è lineare: le prime dieci
            pose cambiano tutto, dalla centesima in poi si fatica a vedere la differenza. E che sotto un cielo
            cittadino servono decine di volte più ore per arrivare allo stesso risultato di un cielo buio.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Galassia a spirale · {subs} {subs === 1 ? 'posa' : 'pose'} da {SUB_EXPOSURE_MIN} minuti
          </h3>
        </div>

        <SimulatorStage
          view={
            <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950">
              <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
              <div className="absolute top-3 left-3 text-[11px] text-slate-300 bg-slate-950/75 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <span className="font-bold" style={{ color: bortle.color === '#1e293b' ? '#94a3b8' : undefined }}>
                  Bortle {bortle.level}
                </span>{' '}
                · integrazione{' '}
                <span className="text-amber-300 font-bold">
                  {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)} h` : `${totalMinutes} min`}
                </span>{' '}
                · SNR <span className={`font-bold ${qualityClass}`}>{snr.toFixed(1)}</span>
              </div>
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>
                    Numero di Pose: <strong className="text-amber-400">{subs}</strong>
                  </span>
                  <span className="text-[10px] text-slate-500">SNR cresce con la radice quadrata</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={300}
                  step={1}
                  value={subs}
                  onChange={(e) => setSubs(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[1, 10, 25, 50, 100, 200, 300].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSubs(n)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                        subs === n
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Inquinamento Luminoso (Scala di Bortle)</label>
                <select
                  value={bortleLevel}
                  onChange={(e) => setBortleLevel(Number(e.target.value))}
                  className="w-full max-w-md bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 cursor-pointer"
                >
                  {BORTLE_SCALE.map((b) => (
                    <option key={b.level} value={b.level}>
                      Classe {b.level} — {b.name} ({b.sqm} mag/arcsec²)
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">{bortle.description}</p>
              </div>
            </>
          }
        >
        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Rapporto Segnale/Rumore</div>
            <div className={`text-xl font-extrabold ${qualityClass}`}>{snr.toFixed(1)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{qualityLabel}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Integrazione Totale</div>
            <div className="text-xl font-extrabold text-slate-200">
              {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)} h` : `${totalMinutes} min`}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {subs} × {SUB_EXPOSURE_MIN} min
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Da un Cielo Bortle 2</div>
            <div className="text-xl font-extrabold text-emerald-400">{Math.max(1, Math.round(subsFromDarkSite))}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">pose per lo stesso risultato</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Per Eguagliare 1 h Bortle 2</div>
            <div className="text-xl font-extrabold text-rose-400">
              {(subsToMatchOneHour * SUB_EXPOSURE_MIN / 60).toFixed(1)} h
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">dal tuo cielo Bortle {bortle.level}</div>
          </div>
        </div>

        {/* SNR growth chart */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-bold text-slate-100">Il guadagno rallenta: SNR in funzione del numero di pose</h4>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="subs"
                  type="number"
                  domain={[1, 300]}
                  ticks={[1, 25, 50, 100, 150, 200, 250, 300]}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-amber-300">{label} pose</div>
                          {payload.map((p) => (
                            <div key={String(p.dataKey)}>
                              {p.name}: <span className="font-bold text-white">{p.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="bortle2"
                  name="Cielo buio (Bortle 2)"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="tuo"
                  name={`Il tuo cielo (Bortle ${bortle.level})`}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <ReferenceDot x={subs} y={Number(snr.toFixed(2))} r={5} fill="#f59e0b" stroke="#0f172a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            La curva è ripidissima all'inizio e poi si appiattisce: per raddoppiare il rapporto segnale/rumore devi{' '}
            <strong className="text-slate-300">quadruplicare</strong> il numero di pose.
          </p>
        </div>

        {/* Bortle reference */}
        <div>
          <button
            type="button"
            onClick={() => setShowScale((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
          >
            {showScale ? 'Nascondi' : 'Mostra'} la scala di Bortle completa e come stimarla
          </button>

          {showScale && (
            <div className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Classe</th>
                      <th className="px-3 py-2 font-semibold">SQM</th>
                      <th className="px-3 py-2 font-semibold">Stella più debole</th>
                      <th className="px-3 py-2 font-semibold">Come si presenta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BORTLE_SCALE.map((b) => (
                      <tr
                        key={b.level}
                        onClick={() => setBortleLevel(b.level)}
                        className={`cursor-pointer border-t border-slate-800/80 transition-colors ${
                          b.level === bortleLevel ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-3 py-2.5 align-top">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-sm shrink-0 border border-slate-700"
                              style={{ backgroundColor: b.color }}
                            />
                            <span
                              className={`font-bold whitespace-nowrap ${
                                b.level === bortleLevel ? 'text-amber-300' : 'text-slate-100'
                              }`}
                            >
                              {b.level}. {b.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-top text-cyan-300 font-semibold whitespace-nowrap">{b.sqm}</td>
                        <td className="px-3 py-2.5 align-top text-slate-300 whitespace-nowrap">mag {b.nelm}</td>
                        <td className="px-3 py-2.5 align-top text-slate-400 leading-relaxed">{b.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 leading-relaxed space-y-3">
                <div className="font-bold text-cyan-300 text-sm">Come stimare a occhio il Bortle del tuo cielo</div>
                <p>
                  Servono almeno <strong className="text-slate-100">20-30 minuti di adattamento al buio</strong>, niente
                  telefono acceso, Luna sotto l'orizzonte e osservazione allo zenit (l'orizzonte è sempre più chiaro).
                  Poi procedi per indizi, dal più grossolano al più fine:
                </p>
                <ul className="space-y-1.5 list-disc pl-4">
                  <li>
                    <strong className="text-slate-100">La Via Lattea.</strong> Ricca di venature scure e ramificazioni,
                    tanto da proiettare ombre: <strong>1-2</strong>. Ben strutturata ma senza ombre:{' '}
                    <strong>3</strong>. Riconoscibile ma slavata allo zenit: <strong>4-5</strong>. Solo un accenno
                    sopra la testa: <strong>6</strong>. Invisibile: <strong>7 o peggio</strong>.
                  </li>
                  <li>
                    <strong className="text-slate-100">M33 (Galassia del Triangolo).</strong> È il test più severo:
                    visibile a occhio nudo in visione diretta significa <strong>1-2</strong>; visibile solo in visione
                    distolta <strong>3-4</strong>; invisibile <strong>5 o peggio</strong>.
                  </li>
                  <li>
                    <strong className="text-slate-100">M31 (Andromeda).</strong> Evidente e allungata fino a{' '}
                    <strong>4</strong>; percepibile con difficoltà fino a <strong>6</strong>; invisibile a occhio nudo
                    da <strong>7</strong> in su.
                  </li>
                  <li>
                    <strong className="text-slate-100">Le nubi.</strong> Se passano nuvole, guarda il contrasto: nere
                    come buchi nel cielo stellato indicano <strong>1-4</strong>; più chiare del cielo circostante{' '}
                    <strong>6-9</strong>. È l'indizio più rapido e affidabile in assoluto.
                  </li>
                  <li>
                    <strong className="text-slate-100">Le tue mani e il paesaggio.</strong> Se non vedi le tue mani sei
                    a <strong>1-2</strong>; se distingui le sagome degli alberi <strong>3-4</strong>; se leggi l'ora
                    sull'orologio o riconosci i colori degli oggetti sei a <strong>7-9</strong>.
                  </li>
                  <li>
                    <strong className="text-slate-100">La luce zodiacale.</strong> Quel cono di luce lungo l'eclittica
                    dopo il crepuscolo astronomico (primavera a ovest, autunno a est): vivido e colorato{' '}
                    <strong>1-2</strong>, visibile <strong>3-4</strong>, assente <strong>5+</strong>.
                  </li>
                  <li>
                    <strong className="text-slate-100">Conta le stelle.</strong> Un metodo ripetibile: conta quante
                    stelle vedi dentro il quadrilatero dell'Orsa Minore, oppure quante ne distingui nel Trapezio di
                    Orione a occhio nudo. Più stelle deboli conti, più bassa è la classe. In alternativa usa un{' '}
                    <strong className="text-slate-100">SQM</strong> (Sky Quality Meter) o una delle mappe online
                    dell'inquinamento luminoso per una misura oggettiva in mag/arcsec².
                  </li>
                </ul>
                <p className="text-slate-400">
                  Attenzione: il cielo peggiora sensibilmente con l'umidità e il pulviscolo, che diffondono la luce
                  artificiale. Lo stesso sito può valere Bortle 4 in una notte secca e trasparente e Bortle 5-6 in una
                  notte umida.
                </p>
              </div>
            </div>
          )}
        </div>

        <DismissibleInfoPanel
          id="sim-snr-stacking-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Perché sommare le pose funziona (ma sempre meno)</span>
          <p className="mt-1 leading-relaxed">
            Il segnale della galassia è sempre lo stesso in ogni posa e si somma in modo{' '}
            <strong className="text-slate-100">coerente</strong>: raddoppiando le pose raddoppia. Il rumore invece è
            casuale e si somma <strong className="text-slate-100">in quadratura</strong>: cresce solo con la radice
            quadrata. Il risultato è che il rapporto segnale/rumore migliora come{' '}
            <strong className="text-amber-300">√N</strong>. Da 1 a 10 pose guadagni un fattore 3,2; da 100 a 110
            appena il 5%. Per raddoppiare la qualità servono quattro volte le pose, per triplicarla nove volte.
            L'inquinamento luminoso agisce da un'altra parte: aggiunge un fondo cielo luminosissimo che porta con sé
            il proprio rumore fotonico. Ogni magnitudine di cielo persa significa{' '}
            <strong className="text-rose-300">2,5 volte più flusso di fondo</strong>, e siccome per compensare devi
            recuperare in √N, il tempo richiesto cresce in proporzione diretta al fondo: con i valori usati qui,
            passare da Bortle 2 a Bortle 8 significa quasi{' '}
            <strong className="text-rose-300">venti volte</strong> il tempo di integrazione per la stessa pulizia
            (usa il riquadro qui sopra per vedere il conto esatto per la tua classe). Ecco perché una notte
            sotto un cielo buio vale più di un mese di pose dal balcone di casa — e perché i filtri a banda stretta,
            che tagliano gran parte di quel fondo, cambiano radicalmente le carte in tavola in città.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
