import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Info, Camera, ZoomIn } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';
import { ApexIcon } from './ApexIcon';

// A mono sensor with no colour filter collects roughly three times the photons
// of a single colour channel, which is why the luminance frame carries the detail.
const UNFILTERED_GAIN = 3;

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
  const rand = mulberry32(31337);
  return Array.from({ length: 260 }, () => ({
    x: rand(),
    y: rand(),
    r: 0.35 + rand() * rand() * 1.9,
    hue: rand(),
    a: 0.4 + rand() * 0.6,
  }));
})();

/**
 * The "truth": what the sky really looks like, before any sensor samples it.
 * Deliberately full of fine detail - thin filaments and small stars - because
 * that is exactly what a Bayer matrix struggles to reproduce.
 */
function drawTruth(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.45;

  ctx.fillStyle = '#04060e';
  ctx.fillRect(0, 0, w, h);

  // Emission nebula body
  const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  body.addColorStop(0, 'rgba(226, 96, 118, 0.55)');
  body.addColorStop(0.45, 'rgba(150, 60, 120, 0.3)');
  body.addColorStop(1, 'rgba(40, 40, 110, 0)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R, R * 0.72, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Teal core
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.3);
  core.addColorStop(0, 'rgba(150, 240, 225, 0.5)');
  core.addColorStop(1, 'rgba(60, 160, 170, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Fine filaments: thin, high-contrast structure at the resolution limit
  const rand = mulberry32(4242);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a0 = rand() * Math.PI * 2;
    const rr = R * (0.18 + rand() * 0.7);
    ctx.beginPath();
    let px = cx + Math.cos(a0) * rr;
    let py = cy + Math.sin(a0) * rr * 0.72;
    ctx.moveTo(px, py);
    let ang = a0 + Math.PI / 2 + (rand() - 0.5);
    const steps = 8 + Math.floor(rand() * 10);
    for (let s = 0; s < steps; s++) {
      ang += (rand() - 0.5) * 0.5;
      px += Math.cos(ang) * (R * 0.055);
      py += Math.sin(ang) * (R * 0.055);
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = rand() > 0.45 ? 'rgba(255, 170, 180, 0.55)' : 'rgba(120, 210, 235, 0.45)';
    ctx.lineWidth = 0.8 + rand() * 0.9;
    ctx.stroke();
  }

  // Dark dust lanes
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    const a0 = rand() * Math.PI * 2;
    const rr = R * (0.25 + rand() * 0.6);
    ctx.ellipse(cx + Math.cos(a0) * rr * 0.6, cy + Math.sin(a0) * rr * 0.4, R * 0.3, R * 0.035, a0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 6, 16, 0.5)';
    ctx.fill();
  }

  // Stars: the sharpest thing in the frame, and where Bayer artefacts show most
  for (const s of STARS) {
    const px = s.x * w;
    const py = s.y * h;
    const tint =
      s.hue < 0.33 ? [255, 214, 190] : s.hue < 0.66 ? [235, 240, 255] : [190, 214, 255];
    const g = ctx.createRadialGradient(px, py, 0, px, py, Math.max(1, s.r * 2.4));
    g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${s.a})`);
    g.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, s.r * 2.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function gaussian(): number {
  const u1 = Math.random() || 1e-6;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * One-shot colour: every photosite sits under a single R, G or B filter of the
 * RGGB Bayer matrix, so two thirds of the colour information at each pixel has
 * to be interpolated from the neighbours. That interpolation is what softens
 * fine detail and paints false colour onto small stars.
 */
function renderOsc(src: ImageData, w: number, h: number, noise: number): ImageData {
  const out = new ImageData(w, h);
  const s = src.data;
  const o = out.data;

  // Which channel each photosite actually measures (RGGB)
  const channelAt = (x: number, y: number) => (y % 2 === 0 ? (x % 2 === 0 ? 0 : 1) : x % 2 === 0 ? 1 : 2);

  // Sample: keep only the measured channel, and add that pixel's read/shot noise
  const sample = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const c = channelAt(x, y);
      sample[y * w + x] = s[i + c] + gaussian() * noise;
    }
  }

  // Debayer by averaging the nearest samples of each channel (bilinear-like)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0];
      const cnt = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const c = channelAt(xx, yy);
          acc[c] += sample[yy * w + xx];
          cnt[c]++;
        }
      }
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        o[i + c] = Math.max(0, Math.min(255, cnt[c] ? acc[c] / cnt[c] : 0));
      }
      o[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Mono sensor with LRGB filters: the luminance frame is unfiltered and keeps
 * every pixel at full resolution, while the colour frames only need to carry
 * low-resolution chrominance - which is how the eye works too.
 */
function renderLrgb(src: ImageData, w: number, h: number, lumNoise: number, colNoise: number): ImageData {
  const out = new ImageData(w, h);
  const s = src.data;
  const o = out.data;

  // Colour at reduced resolution: binned 2x2, the usual way RGB frames are shot
  const cw = Math.ceil(w / 2);
  const ch = Math.ceil(h / 2);
  const cr = new Float32Array(cw * ch);
  const cg = new Float32Array(cw * ch);
  const cb = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const yy = y * 2 + dy;
          const xx = x * 2 + dx;
          if (yy >= h || xx >= w) continue;
          const i = (yy * w + xx) * 4;
          r += s[i];
          g += s[i + 1];
          b += s[i + 2];
          n++;
        }
      }
      const k = y * cw + x;
      cr[k] = r / n + gaussian() * colNoise;
      cg[k] = g / n + gaussian() * colNoise;
      cb[k] = b / n + gaussian() * colNoise;
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Unfiltered luminance, full resolution, low noise
      const lum = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2] + gaussian() * lumNoise;

      const k = Math.min(ch - 1, y >> 1) * cw + Math.min(cw - 1, x >> 1);
      const cl = 0.299 * cr[k] + 0.587 * cg[k] + 0.114 * cb[k];
      // Re-apply the measured colour ratios on top of the sharp luminance
      const scale = cl > 2 ? lum / cl : 0;
      o[i] = Math.max(0, Math.min(255, cr[k] * scale));
      o[i + 1] = Math.max(0, Math.min(255, cg[k] * scale));
      o[i + 2] = Math.max(0, Math.min(255, cb[k] * scale));
      o[i + 3] = 255;
    }
  }
  return out;
}

export const TabSimulatorLrgbOsc: React.FC = () => {
  const [hours, setHours] = useState<number>(6);
  const [lShare, setLShare] = useState<number>(50);
  const [zoom, setZoom] = useState<number>(3);

  const containerRef = useRef<HTMLDivElement>(null);
  const oscRef = useRef<HTMLCanvasElement>(null);
  const monoRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 360, h: 260 });

  // Photon budget. OSC spends all its time collecting through the Bayer filters
  // at once; the mono rig splits the same clock between L and the RGB frames.
  const oscLumSignal = hours;
  const monoLumSignal = hours * (lShare / 100) * UNFILTERED_GAIN;
  const monoColSignal = hours * (1 - lShare / 100);

  const oscNoise = 26 / Math.sqrt(Math.max(0.05, oscLumSignal));
  const monoLumNoise = 26 / Math.sqrt(Math.max(0.05, monoLumSignal));
  // Colour frames are binned 2x2, which buys back a factor of two in noise
  const monoColNoise = (26 / Math.sqrt(Math.max(0.05, monoColSignal))) * 0.5;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const total = Math.max(320, entry.contentRect.width);
      const each = total >= 700 ? (total - 12) / 2 : total;
      setSize({ w: Math.round(each), h: Math.round(each * 0.72) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const oscCanvas = oscRef.current;
    const monoCanvas = monoRef.current;
    if (!oscCanvas || !monoCanvas) return;

    // Work at the sensor's own pixel scale, then magnify with nearest-neighbour
    // so that pixel-level artefacts stay visible instead of being smoothed away.
    const ww = Math.max(40, Math.round(size.w / zoom));
    const hh = Math.max(40, Math.round(size.h / zoom));

    const truth = document.createElement('canvas');
    truth.width = ww;
    truth.height = hh;
    const tctx = truth.getContext('2d', { willReadFrequently: true });
    if (!tctx) return;
    drawTruth(tctx, ww, hh);
    const src = tctx.getImageData(0, 0, ww, hh);

    const paint = (canvas: HTMLCanvasElement, data: ImageData) => {
      const tmp = document.createElement('canvas');
      tmp.width = ww;
      tmp.height = hh;
      tmp.getContext('2d')!.putImageData(data, 0, 0);

      canvas.width = size.w;
      canvas.height = size.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size.w, size.h);
      ctx.drawImage(tmp, 0, 0, size.w, size.h);
    };

    paint(oscCanvas, renderOsc(src, ww, hh, oscNoise));
    paint(monoCanvas, renderLrgb(src, ww, hh, monoLumNoise, monoColNoise));
  }, [size, zoom, oscNoise, monoLumNoise, monoColNoise]);

  const monoAdvantage = Math.sqrt(monoLumSignal / Math.max(0.001, oscLumSignal));

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
            LRGB (Mono) vs OSC (Colore)
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Stesso soggetto, stesso tempo totale, due sensori diversi. La camera a colori mette un filtro rosso,
            verde o blu su ogni singolo pixel e deve indovinare gli altri due; la monocromatica riprende la
            luminanza senza filtri a piena risoluzione e ci "dipinge sopra" il colore. Ingrandisci al livello del
            pixel per vedere la differenza.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Camera className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Confronto a parità di {hours} ore di integrazione
          </h3>
        </div>

        <SimulatorStage
          view={
            <div ref={containerRef} className="w-full">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-rose-300 mb-1.5">
                    OSC — sensore a colori con matrice di Bayer
                  </div>
                  <canvas
                    ref={oscRef}
                    style={{ width: size.w, height: size.h }}
                    className="block rounded-xl border border-rose-500/30 bg-slate-950"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-emerald-300 mb-1.5">
                    Mono + filtri LRGB — luminanza a piena risoluzione
                  </div>
                  <canvas
                    ref={monoRef}
                    style={{ width: size.w, height: size.h }}
                    className="block rounded-xl border border-emerald-500/30 bg-slate-950"
                  />
                </div>
              </div>
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>
                    Integrazione Totale: <strong className="text-amber-400">{hours} ore</strong>
                  </span>
                  <span className="text-[10px] text-slate-500">identica per entrambi i sensori</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={24}
                  step={1}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span>
                    Quota su Luminanza (solo mono): <strong className="text-cyan-400">{lShare}%</strong>
                  </span>
                  <span className="text-[10px] text-slate-500">il resto va su R, G e B</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={lShare}
                  onChange={(e) => setLShare(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5" />
                  Ingrandimento
                </span>
                {[1, 2, 3, 5].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoom(z)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                      zoom === z
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {z}×
                  </button>
                ))}
                <span className="text-[10px] text-slate-500 ml-1">
                  a 3× e 5× si vedono i pixel: guarda le stelline piccole e i filamenti sottili
                </span>
              </div>
            </>
          }
        >
        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Risoluzione Effettiva</div>
            <div className="text-xl font-extrabold text-emerald-400">100%</div>
            <div className="text-[10px] text-slate-500 mt-0.5">mono · OSC circa 60-70%</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Vantaggio SNR Mono</div>
            <div className="text-xl font-extrabold text-amber-400">{monoAdvantage.toFixed(2)}×</div>
            <div className="text-[10px] text-slate-500 mt-0.5">sulla luminanza</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Tempo su Luminanza</div>
            <div className="text-xl font-extrabold text-cyan-300">
              {((hours * lShare) / 100).toFixed(1)} h
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {(hours * (1 - lShare / 100)).toFixed(1)} h divise su R, G e B
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Complessità</div>
            <div className="text-xl font-extrabold text-slate-200">4 vs 1</div>
            <div className="text-[10px] text-slate-500 mt-0.5">riprese separate contro una sola</div>
          </div>
        </div>

        <DismissibleInfoPanel
          id="sim-lrgb-osc-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Perché il mono è più nitido (e perché l'OSC resta ottimo)</span>
          <p className="mt-1 leading-relaxed">
            Un sensore <strong className="text-rose-300">OSC</strong> ha davanti una{' '}
            <strong className="text-slate-100">matrice di Bayer</strong>: i pixel sono coperti a scacchiera da
            filtrini rossi, verdi e blu nello schema RGGB. Ogni pixel misura quindi <em>un solo</em> colore, e gli
            altri due vengono ricostruiti per interpolazione dai vicini (demosaicizzazione). Il risultato è che la
            risoluzione reale sul colore scende a circa un mezzo per il verde e un quarto per rosso e blu, e le
            strutture al limite del campionamento — le stelle piccole, i filamenti sottili — si ammorbidiscono e
            possono prendere false dominanti. Un sensore <strong className="text-emerald-300">monocromatico</strong>{' '}
            non ha filtri sui pixel: la posa di <strong className="text-slate-100">luminanza</strong> usa tutti i
            fotoni di tutte le lunghezze d'onda su tutti i pixel, quindi raccoglie circa tre volte il segnale di un
            singolo canale colorato e mantiene la piena risoluzione. Il colore si riprende a parte con i filtri R, G
            e B, spesso in binning 2×2 perché l'occhio è molto meno sensibile ai dettagli cromatici che a quelli di
            luminosità: è lo stesso principio della compressione JPEG e del segnale televisivo. In post-produzione
            la crominanza a bassa risoluzione viene "dipinta" sopra la luminanza nitida.
            <br />
            <br />
            Il rovescio della medaglia: il mono richiede una <strong className="text-slate-100">ruota
            portafiltri</strong>, quattro serie di pose invece di una, e quindi quattro volte le occasioni di cielo
            sereno per completare un soggetto — oltre a rifare il fuoco a ogni cambio filtro. L'OSC prende tutto in
            una notte sola ed è imbattibile su soggetti che richiedono poco tempo o quando le notti buone sono
            rare. La differenza si ribalta però nel{' '}
            <strong className="text-amber-300">narrowband</strong>: con un filtro H-alfa su un OSC solo un pixel su
            quattro (quelli rossi) raccoglie davvero il segnale, mentre il mono lo raccoglie con tutti — ed è per
            questo che chi riprende in banda stretta da cieli inquinati passa quasi sempre al monocromatico.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
