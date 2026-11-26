import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { Sparkles, Info, Layers, Eye } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';
import { loadM51Photo, M51_CREDIT, M51_HEIGHT, M51_WIDTH } from '../services/m51Photo';

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
    color: '#262626',
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

// Aspect ratio of the bundled photo, so the canvas frames it without cropping.
const PHOTO_ASPECT = M51_HEIGHT / M51_WIDTH;

// Display level (0-1) that stands for TARGET_SIGNAL: roughly the brightness of
// the faint outer arms in the photo. Everything brighter carries more signal,
// everything darker less, in proportion.
const TARGET_LEVEL = 0.22;

// Display stretch assumed for the photo: display = TARGET_LEVEL * (signal /
// TARGET_SIGNAL)^(1 / STRETCH_GAMMA). A plain gamma, the simplest stand-in
// for the curves an astrophotographer applies to a linear stack.
const STRETCH_GAMMA = 2.2;

// Darkest relative level considered: keeps the stretch slope finite in the
// pure-black background, where it would otherwise blow up.
const SIGNAL_FLOOR = 0.3;

/**
 * Renders the stacked result: the clean photo as the "truth", the
 * light-pollution glow, and shot noise computed pixel by pixel.
 *
 * Noise is not uniform. Each pixel carries a signal proportional to its
 * brightness (TARGET_LEVEL = one TARGET_SIGNAL) on top of the sky background,
 * and after averaging N subs its noise is sqrt(signal + sky) / sqrt(N), the
 * same formula as the SNR readout. So with few subs the faint outer arms
 * dissolve first while the core holds up, exactly as in a real stack.
 */
function renderStack(
  ctx: CanvasRenderingContext2D,
  base: ImageData,
  w: number,
  h: number,
  subs: number,
  bortle: BortleClass
) {
  const sky = backgroundFlux(bortle.skyMag);
  const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
  const data = out.data;
  const rootN = Math.sqrt(subs);
  // Above this the frame is pure static and carries no more information.
  const maxSigma = 0.6;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // The photo is already stretched. Undo the stretch to get the linear
    // signal (the core really holds tens of times more light than the outer
    // arms), take the shot noise there, and map it back through the slope of
    // the stretch: that slope is steep in the faint parts and gentle in the
    // bright ones, which is why a stack shows its grain in the background
    // and the arms long after the core looks clean.
    const rel = Math.max(SIGNAL_FLOOR, lum / TARGET_LEVEL);
    const signal = Math.pow(rel, STRETCH_GAMMA) * TARGET_SIGNAL;
    const slope = (TARGET_LEVEL / (STRETCH_GAMMA * TARGET_SIGNAL)) * Math.pow(rel, 1 - STRETCH_GAMMA);
    const sigma = Math.min(maxSigma, (slope * Math.sqrt(signal + sky)) / rootN);

    // Box-Muller: one gaussian sample shared by the three channels (luminance
    // noise) plus a smaller independent part per channel (chroma noise).
    const u1 = Math.random() || 1e-6;
    const u2 = Math.random();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma * 255;
    const c = sigma * 255 * 0.6;
    data[i] = data[i] + n + (Math.random() - 0.5) * c;
    data[i + 1] = data[i + 1] + n + (Math.random() - 0.5) * c;
    data[i + 2] = data[i + 2] + n + (Math.random() - 0.5) * c;
  }
  ctx.putImageData(out, 0, 0);

  // Sky glow left after a basic background subtraction: a warm gradient
  // rising from the horizon, stronger in bright skies.
  const glowStrength = Math.min(0.45, Math.max(0, (21.85 - bortle.skyMag) / 11));
  if (glowStrength > 0.01) {
    const glow = ctx.createLinearGradient(0, h, 0, 0);
    glow.addColorStop(0, `rgba(150, 96, 48, ${glowStrength})`);
    glow.addColorStop(0.6, `rgba(96, 78, 70, ${glowStrength * 0.45})`);
    glow.addColorStop(1, `rgba(60, 62, 78, ${glowStrength * 0.2})`);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
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
      setSize({ w: width, h: Math.round(width * PHOTO_ASPECT) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The clean photo, scaled to the canvas once per size: every slider move
  // then only re-runs the noise on a copy of it.
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const baseRef = useRef<{ key: string; data: ImageData } | null>(null);

  useEffect(() => {
    let alive = true;
    loadM51Photo().then((img) => alive && setPhoto(img), () => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const pw = Math.round(size.w * dpr);
    const ph = Math.round(size.h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }

    const key = `${pw}x${ph}`;
    if (baseRef.current?.key !== key) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photo, 0, 0, pw, ph);
      baseRef.current = { key, data: ctx.getImageData(0, 0, pw, ph) };
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderStack(ctx, baseRef.current.data, pw, ph, subs, bortle);
  }, [size, subs, bortle, photo]);

  const qualityLabel =
    snr >= 8 ? 'Immagine pulita' : snr >= 4 ? 'Rumore ancora visibile' : snr >= 2 ? 'Molto rumorosa' : 'Sepolta nel rumore';
  const qualityClass =
    snr >= 8 ? 'text-neutral-200' : snr >= 4 ? 'text-neutral-200' : snr >= 2 ? 'text-neutral-200' : 'text-warn';

  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Simulatore 04 / 10</div>
          <h2 className="page-title">Segnale, rumore e stacking</h2>
          <p className="lead">
            Somma le pose e guarda il rumore mediarsi via. Scoprirai che il guadagno non è lineare: le prime dieci
            pose cambiano tutto, dalla centesima in poi si fatica a vedere la differenza. E che sotto un cielo
            cittadino servono decine di volte più ore per arrivare allo stesso risultato di un cielo buio.
          </p>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="section-title">
            M51, galassia Vortice · {subs} {subs === 1 ? 'posa' : 'pose'} da {SUB_EXPOSURE_MIN} minuti
          </h3>
        </div>

        <SimulatorStage
          readouts={
            <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Rapporto Segnale/Rumore</div>
            <div className={`text-xl font-medium ${qualityClass}`}>{snr.toFixed(1)}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">{qualityLabel}</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Integrazione Totale</div>
            <div className="text-xl font-medium text-neutral-200">
              {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)} h` : `${totalMinutes} min`}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {subs} × {SUB_EXPOSURE_MIN} min
            </div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Da un Cielo Bortle 2</div>
            <div className="text-xl font-medium text-neutral-200">{Math.max(1, Math.round(subsFromDarkSite))}</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">pose per lo stesso risultato</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Per Eguagliare 1 h Bortle 2</div>
            <div className="text-xl font-medium text-warn">
              {(subsToMatchOneHour * SUB_EXPOSURE_MIN / 60).toFixed(1)} h
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">dal tuo cielo Bortle {bortle.level}</div>
          </div>
        </div>
          }
          view={
            <div ref={containerRef} className="relative w-full overflow-hidden rounded-md bg-neutral-950">
              <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
              <div className="absolute top-3 left-3 text-[11px] text-neutral-300 bg-neutral-950/75 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                <span className="font-semibold" style={{ color: bortle.color === '#262626' ? '#a3a3a3' : undefined }}>
                  Bortle {bortle.level}
                </span>{' '}
                · integrazione{' '}
                <span className="text-neutral-100 font-semibold">
                  {totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)} h` : `${totalMinutes} min`}
                </span>{' '}
                · SNR <span className={`font-semibold ${qualityClass}`}>{snr.toFixed(1)}</span>
              </div>
              <div className="absolute bottom-2 right-3 text-[9px] text-neutral-500">
                {M51_CREDIT}
              </div>
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Numero di Pose: <strong className="text-neutral-200">{subs}</strong>
                  </span>
                  <span className="text-[10px] text-neutral-500">SNR cresce con la radice quadrata</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={300}
                  step={1}
                  value={subs}
                  onChange={(e) => setSubs(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[1, 10, 25, 50, 100, 200, 300].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSubs(n)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                        subs === n
                          ? 'bg-neutral-100 text-neutral-950 border-neutral-100'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-300 mb-1">Inquinamento luminoso (scala di Bortle)</label>
                <select
                  value={bortleLevel}
                  onChange={(e) => setBortleLevel(Number(e.target.value))}
                  className="w-full max-w-md bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-semibold text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-600 cursor-pointer"
                >
                  {BORTLE_SCALE.map((b) => (
                    <option key={b.level} value={b.level}>
                      Classe {b.level} — {b.name} ({b.sqm} mag/arcsec²)
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-neutral-400 leading-relaxed">{bortle.description}</p>
              </div>
            </>
          }
        >

        {/* SNR growth chart */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-semibold text-neutral-100">Il guadagno rallenta: SNR in funzione del numero di pose</h4>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="subs"
                  type="number"
                  domain={[1, 300]}
                  ticks={[1, 25, 50, 100, 150, 200, 250, 300]}
                  stroke="#404040" tick={{ fill: "#8a8a8a" }}
                  fontSize={11}
                />
                <YAxis stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-neutral-950 border border-neutral-700 p-2.5 rounded-lg text-xs space-y-1">
                          <div className="font-semibold text-neutral-100">{label} pose</div>
                          {payload.map((p) => (
                            <div key={String(p.dataKey)}>
                              {p.name}: <span className="font-semibold text-white">{p.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8a8a8a" }} iconType="plainline" />
                <Line
                  type="monotone"
                  dataKey="bortle2"
                  name="Cielo buio (Bortle 2)"
                  stroke="#e5e5e5"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="tuo"
                  name={`Il tuo cielo (Bortle ${bortle.level})`}
                  stroke="#b89a6a"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <ReferenceDot x={subs} y={Number(snr.toFixed(2))} r={5} fill="#b89a6a" stroke="#171717" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            La curva è ripidissima all'inizio e poi si appiattisce: per raddoppiare il rapporto segnale/rumore devi{' '}
            <strong className="text-neutral-300">quadruplicare</strong> il numero di pose.
          </p>
        </div>

        {/* Bortle reference */}
        <div>
          <button
            type="button"
            onClick={() => setShowScale((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-neutral-100 border border-neutral-700 hover:bg-neutral-800 transition"
          >
            {showScale ? 'Nascondi' : 'Mostra'} la scala di Bortle completa e come stimarla
          </button>

          {showScale && (
            <div className="mt-4 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-neutral-500">
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
                        className={`cursor-pointer border-t border-neutral-800/80 transition-colors ${
                          b.level === bortleLevel ? 'bg-white/[0.03]' : 'hover:bg-neutral-800/40'
                        }`}
                      >
                        <td className="px-3 py-2.5 align-top">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-sm shrink-0 border border-neutral-700"
                              style={{ backgroundColor: b.color }}
                            />
                            <span
                              className={`font-semibold whitespace-nowrap ${
                                b.level === bortleLevel ? 'text-neutral-100' : 'text-neutral-100'
                              }`}
                            >
                              {b.level}. {b.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 align-top text-neutral-100 font-semibold whitespace-nowrap">{b.sqm}</td>
                        <td className="px-3 py-2.5 align-top text-neutral-300 whitespace-nowrap">mag {b.nelm}</td>
                        <td className="px-3 py-2.5 align-top text-neutral-400 leading-relaxed">{b.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-md p-4 text-xs text-neutral-300 leading-relaxed space-y-3">
                <div className="font-semibold text-neutral-100 text-sm">Come stimare a occhio il Bortle del tuo cielo</div>
                <p>
                  Servono almeno <strong className="text-neutral-100">20-30 minuti di adattamento al buio</strong>, niente
                  telefono acceso, Luna sotto l'orizzonte e osservazione allo zenit (l'orizzonte è sempre più chiaro).
                  Poi procedi per indizi, dal più grossolano al più fine:
                </p>
                <ul className="space-y-1.5 list-disc pl-4">
                  <li>
                    <strong className="text-neutral-100">La Via Lattea.</strong> Ricca di venature scure e ramificazioni,
                    tanto da proiettare ombre: <strong>1-2</strong>. Ben strutturata ma senza ombre:{' '}
                    <strong>3</strong>. Riconoscibile ma slavata allo zenit: <strong>4-5</strong>. Solo un accenno
                    sopra la testa: <strong>6</strong>. Invisibile: <strong>7 o peggio</strong>.
                  </li>
                  <li>
                    <strong className="text-neutral-100">M33 (Galassia del Triangolo).</strong> È il test più severo:
                    visibile a occhio nudo in visione diretta significa <strong>1-2</strong>; visibile solo in visione
                    distolta <strong>3-4</strong>; invisibile <strong>5 o peggio</strong>.
                  </li>
                  <li>
                    <strong className="text-neutral-100">M31 (Andromeda).</strong> Evidente e allungata fino a{' '}
                    <strong>4</strong>; percepibile con difficoltà fino a <strong>6</strong>; invisibile a occhio nudo
                    da <strong>7</strong> in su.
                  </li>
                  <li>
                    <strong className="text-neutral-100">Le nubi.</strong> Se passano nuvole, guarda il contrasto: nere
                    come buchi nel cielo stellato indicano <strong>1-4</strong>; più chiare del cielo circostante{' '}
                    <strong>6-9</strong>. È l'indizio più rapido e affidabile in assoluto.
                  </li>
                  <li>
                    <strong className="text-neutral-100">Le tue mani e il paesaggio.</strong> Se non vedi le tue mani sei
                    a <strong>1-2</strong>; se distingui le sagome degli alberi <strong>3-4</strong>; se leggi l'ora
                    sull'orologio o riconosci i colori degli oggetti sei a <strong>7-9</strong>.
                  </li>
                  <li>
                    <strong className="text-neutral-100">La luce zodiacale.</strong> Quel cono di luce lungo l'eclittica
                    dopo il crepuscolo astronomico (primavera a ovest, autunno a est): vivido e colorato{' '}
                    <strong>1-2</strong>, visibile <strong>3-4</strong>, assente <strong>5+</strong>.
                  </li>
                  <li>
                    <strong className="text-neutral-100">Conta le stelle.</strong> Un metodo ripetibile: conta quante
                    stelle vedi dentro il quadrilatero dell'Orsa Minore, oppure quante ne distingui nel Trapezio di
                    Orione a occhio nudo. Più stelle deboli conti, più bassa è la classe. In alternativa usa un{' '}
                    <strong className="text-neutral-100">SQM</strong> (Sky Quality Meter) o una delle mappe online
                    dell'inquinamento luminoso per una misura oggettiva in mag/arcsec².
                  </li>
                </ul>
                <p className="text-neutral-400">
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
          icon={<Info className="w-5 h-5 text-neutral-200 shrink-0 mt-0.5" />}
          className="bg-neutral-900/40 border border-neutral-700 rounded-md p-4 flex items-start gap-3 text-xs text-neutral-300"
        >
          <span className="font-semibold text-neutral-50">Perché sommare le pose funziona (ma sempre meno)</span>
          <p className="mt-1 leading-relaxed">
            Il segnale della galassia è sempre lo stesso in ogni posa e si somma in modo{' '}
            <strong className="text-neutral-100">coerente</strong>: raddoppiando le pose raddoppia. Il rumore invece è
            casuale e si somma <strong className="text-neutral-100">in quadratura</strong>: cresce solo con la radice
            quadrata. Il risultato è che il rapporto segnale/rumore migliora come{' '}
            <strong className="text-neutral-100">√N</strong>. Da 1 a 10 pose guadagni un fattore 3,2; da 100 a 110
            appena il 5%. Per raddoppiare la qualità servono quattro volte le pose, per triplicarla nove volte.
            L'inquinamento luminoso agisce da un'altra parte: aggiunge un fondo cielo luminosissimo che porta con sé
            il proprio rumore fotonico. Ogni magnitudine di cielo persa significa{' '}
            <strong className="text-warn">2,5 volte più flusso di fondo</strong>, e siccome per compensare devi
            recuperare in √N, il tempo richiesto cresce in proporzione diretta al fondo: con i valori usati qui,
            passare da Bortle 2 a Bortle 8 significa quasi{' '}
            <strong className="text-warn">venti volte</strong> il tempo di integrazione per la stessa pulizia
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
