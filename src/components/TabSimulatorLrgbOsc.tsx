import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Info, Camera, ZoomIn } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';
import { loadM51Photo, M51_CREDIT, M51_HEIGHT, M51_WIDTH } from '../services/m51Photo';

// A mono sensor with no colour filter collects roughly three times the photons
// of a single colour channel, which is why the luminance frame carries the detail.
const UNFILTERED_GAIN = 3;

// Point of the photo the zoom closes in on: a stretch of the inner arms full
// of small pink HII regions and faint stars, the finest coloured detail in the
// frame and exactly where a Bayer matrix shows its limits.
const FOCUS_X = 0.31;
const FOCUS_Y = 0.4;

/**
 * The "truth": the sky as the optics deliver it, sampled at the sensor's own
 * pixel scale. The sensor's resolution on the sky is fixed; zooming only
 * crops a smaller patch around FOCUS and magnifies it, so pixel-level
 * artefacts become visible.
 */
function drawTruth(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, w: number, h: number, zoom: number) {
  const aspect = h / w;
  const fullW = Math.min(M51_WIDTH, M51_HEIGHT / aspect);
  const sw = fullW / zoom;
  const sh = sw * aspect;
  const sx = Math.max(0, Math.min(M51_WIDTH - sw, FOCUS_X * M51_WIDTH - sw / 2));
  const sy = Math.max(0, Math.min(M51_HEIGHT - sh, FOCUS_Y * M51_HEIGHT - sh / 2));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, w, h);
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
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let alive = true;
    loadM51Photo().then((img) => alive && setPhoto(img), () => undefined);
    return () => {
      alive = false;
    };
  }, []);

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
    if (!oscCanvas || !monoCanvas || !photo) return;

    // Work at the sensor's own pixel scale, then magnify with nearest-neighbour
    // so that pixel-level artefacts stay visible instead of being smoothed away.
    const ww = Math.max(40, Math.round(size.w / zoom));
    const hh = Math.max(40, Math.round(size.h / zoom));

    const truth = document.createElement('canvas');
    truth.width = ww;
    truth.height = hh;
    const tctx = truth.getContext('2d', { willReadFrequently: true });
    if (!tctx) return;
    drawTruth(tctx, photo, ww, hh, zoom);
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
  }, [size, zoom, oscNoise, monoLumNoise, monoColNoise, photo]);

  const monoAdvantage = Math.sqrt(monoLumSignal / Math.max(0.001, oscLumSignal));

  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Simulatore 06 / 10</div>
          <h2 className="page-title">LRGB in mono o OSC a colori</h2>
          <p className="lead">
            Stesso soggetto, stesso tempo totale, due sensori diversi. La camera a colori mette un filtro rosso,
            verde o blu su ogni singolo pixel e deve indovinare gli altri due; la monocromatica riprende la
            luminanza senza filtri a piena risoluzione e ci "dipinge sopra" il colore. Ingrandisci al livello del
            pixel per vedere la differenza.
          </p>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="section-title">
            Confronto a parità di {hours} ore di integrazione
          </h3>
        </div>

        <SimulatorStage
          readouts={
            <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Risoluzione Effettiva</div>
            <div className="text-xl font-medium text-neutral-200">100%</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">mono · OSC circa 60-70%</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Vantaggio SNR Mono</div>
            <div className="text-xl font-medium text-neutral-200">{monoAdvantage.toFixed(2)}×</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">sulla luminanza</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Tempo su Luminanza</div>
            <div className="text-xl font-medium text-neutral-100">
              {((hours * lShare) / 100).toFixed(1)} h
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {(hours * (1 - lShare / 100)).toFixed(1)} h divise su R, G e B
            </div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Complessità</div>
            <div className="text-xl font-medium text-neutral-200">4 vs 1</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">riprese separate contro una sola</div>
          </div>
        </div>
          }
          view={
            <div ref={containerRef} className="w-full">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-neutral-300 mb-1.5">
                    OSC — sensore a colori con matrice di Bayer
                  </div>
                  <canvas
                    ref={oscRef}
                    style={{ width: size.w, height: size.h }}
                    className="block rounded-md border border-neutral-700 bg-neutral-950"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-neutral-100 mb-1.5">
                    Mono + filtri LRGB — luminanza a piena risoluzione
                  </div>
                  <canvas
                    ref={monoRef}
                    style={{ width: size.w, height: size.h }}
                    className="block rounded-md border border-neutral-700 bg-neutral-950"
                  />
                </div>
              </div>
              <div className="mt-1.5 text-right text-[9px] text-neutral-500">{M51_CREDIT}</div>
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Integrazione Totale: <strong className="text-neutral-200">{hours} ore</strong>
                  </span>
                  <span className="text-[10px] text-neutral-500">identica per entrambi i sensori</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={24}
                  step={1}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Quota su Luminanza (solo mono): <strong className="text-neutral-200">{lShare}%</strong>
                  </span>
                  <span className="text-[10px] text-neutral-500">il resto va su R, G e B</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={lShare}
                  onChange={(e) => setLShare(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-neutral-400 inline-flex items-center gap-1.5">
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
                        ? 'bg-neutral-100 text-neutral-950 border-neutral-100'
                        : 'bg-neutral-950 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    {z}×
                  </button>
                ))}
                <span className="text-[10px] text-neutral-500 ml-1">
                  a 3× e 5× si vedono i pixel: guarda le stelline e le piccole regioni HII rosa nei bracci
                </span>
              </div>
            </>
          }
        >

        <DismissibleInfoPanel
          id="sim-lrgb-osc-note"
          icon={<Info className="w-5 h-5 text-neutral-200 shrink-0 mt-0.5" />}
          className="bg-neutral-900/40 border border-neutral-700 rounded-md p-4 flex items-start gap-3 text-xs text-neutral-300"
        >
          <span className="font-semibold text-neutral-50">Perché il mono è più nitido (e perché l'OSC resta ottimo)</span>
          <p className="mt-1 leading-relaxed">
            Un sensore <strong className="text-neutral-100">OSC</strong> ha davanti una{' '}
            <strong className="text-neutral-100">matrice di Bayer</strong>: i pixel sono coperti a scacchiera da
            filtrini rossi, verdi e blu nello schema RGGB. Ogni pixel misura quindi <em>un solo</em> colore, e gli
            altri due vengono ricostruiti per interpolazione dai vicini (demosaicizzazione). Il risultato è che la
            risoluzione reale sul colore scende a circa un mezzo per il verde e un quarto per rosso e blu, e le
            strutture al limite del campionamento — le stelle piccole, le regioni HII rosa nei bracci — si ammorbidiscono e
            possono prendere false dominanti. Un sensore <strong className="text-neutral-100">monocromatico</strong>{' '}
            non ha filtri sui pixel: la posa di <strong className="text-neutral-100">luminanza</strong> usa tutti i
            fotoni di tutte le lunghezze d'onda su tutti i pixel, quindi raccoglie circa tre volte il segnale di un
            singolo canale colorato e mantiene la piena risoluzione. Il colore si riprende a parte con i filtri R, G
            e B, spesso in binning 2×2 perché l'occhio è molto meno sensibile ai dettagli cromatici che a quelli di
            luminosità: è lo stesso principio della compressione JPEG e del segnale televisivo. In post-produzione
            la crominanza a bassa risoluzione viene "dipinta" sopra la luminanza nitida.
            <br />
            <br />
            Il rovescio della medaglia: il mono richiede una <strong className="text-neutral-100">ruota
            portafiltri</strong>, quattro serie di pose invece di una, e quindi quattro volte le occasioni di cielo
            sereno per completare un soggetto — oltre a rifare il fuoco a ogni cambio filtro. L'OSC prende tutto in
            una notte sola ed è imbattibile su soggetti che richiedono poco tempo o quando le notti buone sono
            rare. La differenza si ribalta però nel{' '}
            <strong className="text-neutral-100">narrowband</strong>: con un filtro H-alfa su un OSC solo un pixel su
            quattro (quelli rossi) raccoglie davvero il segnale, mentre il mono lo raccoglie con tutti — ed è per
            questo che chi riprende in banda stretta da cieli inquinati passa quasi sempre al monocromatico.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
