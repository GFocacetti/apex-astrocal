import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts';
import { Sparkles, Info, Activity, Play, Pause } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';

// Periodic error of the worm gear: the dominant real tracking error on most
// mounts, and the thing guiding actually exists to remove.
const PE_AMPLITUDE = 3.0; // arcsec
const PE_PERIOD = 480; // seconds, a typical worm period
const DRIFT_RATE = 0.006; // arcsec/s, residual polar misalignment

// Centroid measurement error scales with the seeing and averages down with the
// square root of the exposure: a longer guide frame gives a steadier centroid.
const CENTROID_K = 0.3;

function gauss(): number {
  const u1 = Math.random() || 1e-6;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function measurementNoise(seeing: number, exposure: number): number {
  return (seeing * CENTROID_K) / Math.sqrt(exposure);
}

/**
 * Runs the guide loop and returns the RMS of the *real* pointing error, which
 * is what smears the image - not the number the guiding software prints.
 * Each step measures the star, then applies a fraction of that measurement as
 * a correction, so any seeing noise in the measurement gets pushed straight
 * into the mount.
 */
function simulateRms(aggr: number, exposure: number, seeing: number, steps = 1400): number {
  const sigma = measurementNoise(seeing, exposure);
  let corrections = 0;
  let sumSq = 0;
  let t = 0;
  const warmup = 200;
  for (let i = 0; i < steps + warmup; i++) {
    t += exposure;
    const signal = DRIFT_RATE * t + PE_AMPLITUDE * Math.sin((2 * Math.PI * t) / PE_PERIOD);
    const err = signal - corrections;
    const measured = err + gauss() * sigma;
    if (i >= warmup) sumSq += err * err;
    corrections += aggr * measured;
  }
  return Math.sqrt(sumSq / steps);
}

interface Sample {
  err: number;
  measured: number;
}

export const TabSimulatorGuiding: React.FC = () => {
  const [exposure, setExposure] = useState<number>(2);
  const [aggr, setAggr] = useState<number>(0.7);
  const [seeing, setSeeing] = useState<number>(2.5);
  const [running, setRunning] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 720, h: 260 });

  // Live loop state, kept in refs so the animation never restarts mid-run.
  const stateRef = useRef({ t: 0, corrections: 0, samples: [] as Sample[] });
  const paramsRef = useRef({ exposure, aggr, seeing });
  paramsRef.current = { exposure, aggr, seeing };

  const [rmsLive, setRmsLive] = useState<number>(0);
  const [peakLive, setPeakLive] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.max(320, entry.contentRect.width);
      setSize({ w: Math.round(w), h: Math.max(200, Math.round(w * 0.34)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One guide step every 90 ms, so a whole night's worth of loop is watchable.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const { exposure: exp, aggr: ag, seeing: se } = paramsRef.current;
      const st = stateRef.current;
      st.t += exp;
      const signal = DRIFT_RATE * st.t + PE_AMPLITUDE * Math.sin((2 * Math.PI * st.t) / PE_PERIOD);
      const err = signal - st.corrections;
      const measured = err + gauss() * measurementNoise(se, exp);
      st.corrections += ag * measured;
      st.samples.push({ err, measured });
      if (st.samples.length > 160) st.samples.shift();

      const recent = st.samples.slice(-120);
      const rms = Math.sqrt(recent.reduce((a, s) => a + s.err * s.err, 0) / recent.length);
      setRmsLive(rms);
      setPeakLive(Math.max(...recent.map((s) => Math.abs(s.err))));
    }, 90);
    return () => window.clearInterval(id);
  }, [running]);

  // Draw the strip chart
  useEffect(() => {
    let raf = 0;
    const render = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          if (canvas.width !== size.w * dpr) {
            canvas.width = size.w * dpr;
            canvas.height = size.h * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const { w, h } = size;
          const mid = h / 2;
          const scale = h / 2 / 6; // +/- 6 arcsec full scale

          ctx.fillStyle = '#04060e';
          ctx.fillRect(0, 0, w, h);

          // Grid at every arcsecond, with the +/- 2" band highlighted
          ctx.fillStyle = 'rgba(229,229,229, 0.06)';
          ctx.fillRect(0, mid - 2 * scale, w, 4 * scale);
          for (let a = -6; a <= 6; a++) {
            ctx.strokeStyle = a === 0 ? 'rgba(163,163,163,0.6)' : 'rgba(64,64,64,0.7)';
            ctx.lineWidth = a === 0 ? 1.4 : 1;
            ctx.beginPath();
            ctx.moveTo(0, mid - a * scale);
            ctx.lineTo(w, mid - a * scale);
            ctx.stroke();
            if (a !== 0 && a % 2 === 0) {
              ctx.fillStyle = 'rgba(115,115,115,0.9)';
              ctx.font = '10px sans-serif';
              ctx.fillText(`${a}"`, 4, mid - a * scale - 3);
            }
          }

          const samples = stateRef.current.samples;
          const step = w / 160;

          // What the guide camera measured, seeing noise included
          ctx.strokeStyle = 'rgba(163,163,163, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          samples.forEach((s, i) => {
            const x = i * step;
            const y = mid - s.measured * scale;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.stroke();

          // Where the mount really is: the curve that decides the picture
          ctx.strokeStyle = '#b89a6a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          samples.forEach((s, i) => {
            const x = i * step;
            const y = mid - s.err * scale;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  // RMS as a function of aggressiveness, obtained by running the same loop.
  const curve = useMemo(() => {
    const pts: { aggr: number; rms: number }[] = [];
    for (let a = 0.05; a <= 1.35; a += 0.05) {
      pts.push({ aggr: Number(a.toFixed(2)), rms: Number(simulateRms(a, exposure, seeing).toFixed(3)) });
    }
    return pts;
  }, [exposure, seeing]);

  const best = useMemo(() => curve.reduce((m, p) => (p.rms < m.rms ? p : m), curve[0]), [curve]);
  const currentRms = useMemo(() => simulateRms(aggr, exposure, seeing), [aggr, exposure, seeing]);

  const verdict =
    currentRms <= best.rms * 1.25
      ? 'Impostazioni vicine all’ottimo'
      : aggr > best.aggr
        ? 'Stai inseguendo il seeing: correzioni troppo aggressive'
        : 'Correzioni troppo blande: la montatura resta indietro';
  const verdictClass =
    currentRms <= best.rms * 1.25 ? 'text-neutral-200' : aggr > best.aggr ? 'text-warn' : 'text-neutral-200';

  const reset = () => {
    stateRef.current = { t: 0, corrections: 0, samples: [] };
  };

  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Simulatore 10 / 10</div>
          <h2 className="page-title">Autoguida e inseguimento del seeing</h2>
          <p className="lead">
            L'autoguida deve correggere gli errori veri della montatura, non il tremolio dell'atmosfera. Alza troppo
            l'aggressività o accorcia troppo la posa di guida e comincerai a rincorrere il seeing, peggiorando
            proprio ciò che volevi migliorare.
          </p>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="section-title">Grafico di guida</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-neutral-200 border border-neutral-700 hover:bg-neutral-800 transition"
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Pausa' : 'Riprendi'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-neutral-100 border border-neutral-700 hover:bg-neutral-800 transition"
            >
              Riavvia
            </button>
          </div>
        </div>

        <SimulatorStage
          readouts={
            <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">RMS Reale (live)</div>
            <div className={`text-xl font-medium ${verdictClass}`}>{rmsLive.toFixed(2)}″</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">errore vero di inseguimento</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Picco Recente</div>
            <div className="text-xl font-medium text-neutral-200">{peakLive.toFixed(2)}″</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">escursione massima</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Miglior Aggressività</div>
            <div className="text-xl font-medium text-neutral-200">{(best.aggr * 100).toFixed(0)}%</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">per {exposure}s e seeing {seeing}″</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Rumore di Misura</div>
            <div className="text-xl font-medium text-neutral-100">
              {measurementNoise(seeing, exposure).toFixed(2)}″
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">incertezza sul centroide</div>
          </div>
        </div>
          }
          view={
            <div className="space-y-2">
              <div ref={containerRef} className="relative w-full overflow-hidden rounded-md bg-neutral-950">
                <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-accent">— posizione reale della montatura</span>
                  <span className="text-neutral-400">— misura della camera di guida</span>
                </div>
                <span className={`font-semibold ${verdictClass}`}>{verdict}</span>
              </div>
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Aggressività: <strong className="text-neutral-200">{(aggr * 100).toFixed(0)}%</strong>
                  </span>
                  <span className="text-[10px] text-neutral-500">quanta parte dell'errore misurato viene corretta</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1.35}
                  step={0.05}
                  value={aggr}
                  onChange={(e) => setAggr(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Posa di Guida: <strong className="text-neutral-200">{exposure}s</strong>
                  </span>
                  <span className="text-[10px] text-neutral-500">pose lunghe mediano il seeing</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.5}
                  value={exposure}
                  onChange={(e) => setExposure(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Turbolenza (seeing): <strong className="text-neutral-100">{seeing.toFixed(1)}″</strong>
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.1}
                  value={seeing}
                  onChange={(e) => setSeeing(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>
            </>
          }
        >

        {/* RMS versus aggressiveness */}
        <div>
          <h4 className="text-sm font-semibold text-neutral-100 mb-2">
            Esiste un ottimo: RMS in funzione dell'aggressività
          </h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis
                  dataKey="aggr"
                  type="number"
                  domain={[0, 1.35]}
                  ticks={[0.2, 0.4, 0.6, 0.8, 1.0, 1.2]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  stroke="#a3a3a3"
                  fontSize={11}
                />
                <YAxis stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} unit="″" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-neutral-950 border border-neutral-700 p-2.5 rounded-lg text-xs">
                          <div className="font-semibold text-neutral-100">
                            Aggressività {Math.round(Number(label) * 100)}%
                          </div>
                          <div>
                            RMS: <span className="font-semibold text-white">{payload[0].value}″</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="rms" stroke="#b89a6a" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <ReferenceDot x={best.aggr} y={best.rms} r={5} fill="#e5e5e5" stroke="#171717" />
                <ReferenceDot x={aggr} y={Number(currentRms.toFixed(3))} r={5} fill="#d16a5f" stroke="#171717" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            Punto <span className="text-neutral-200 font-semibold">bianco</span>: l'aggressività migliore per queste
            condizioni. Punto <span className="text-warn font-semibold">rosso</span>: dove sei adesso. La curva
            viene ricalcolata facendo girare davvero il loop di guida, non con una formula approssimata.
          </p>
        </div>

        <DismissibleInfoPanel
          id="sim-guiding-note"
          icon={<Info className="w-5 h-5 text-neutral-200 shrink-0 mt-0.5" />}
          className="bg-neutral-900/40 border border-neutral-700 rounded-md p-4 flex items-start gap-3 text-xs text-neutral-300"
        >
          <span className="font-semibold text-neutral-50">Perché correggere di più può peggiorare le cose</span>
          <p className="mt-1 leading-relaxed">
            La camera di guida non misura l'errore della montatura: misura{' '}
            <strong className="text-neutral-100">l'errore della montatura più il tremolio dell'atmosfera</strong>. Il
            primo è un segnale vero e lento — soprattutto l'errore periodico della vite senza fine, qui simulato con
            un'ampiezza di {PE_AMPLITUDE}″ e un periodo di {PE_PERIOD / 60} minuti — mentre il secondo è rumore
            casuale che cambia da un fotogramma all'altro e che, mediato nel tempo, vale zero. Ogni volta che
            correggi stai applicando alla montatura anche una parte di quel rumore: se l'aggressività è al 100%
            inietti nella meccanica <em>tutto</em> l'errore di misura, e la posizione reale peggiora invece di
            migliorare. È il fenomeno che gli anglosassoni chiamano{' '}
            <strong className="text-warn">chasing the seeing</strong>.
            <br />
            <br />
            Il compromesso ha due leve. La{' '}
            <strong className="text-neutral-100">posa di guida</strong> più lunga fa mediare la turbolenza dentro il
            singolo fotogramma, e il rumore sul centroide cala come la radice quadrata del tempo: con una posa di 4
            secondi l'incertezza è la metà che con una da 1 secondo. Ma non si può allungare all'infinito, perché
            fra una correzione e l'altra l'errore periodico continua ad accumularsi indisturbato. L'
            <strong className="text-neutral-100">aggressività</strong> regola invece quanta parte della misura viene
            applicata: bassa filtra il rumore ma lascia la montatura indietro rispetto all'errore periodico, alta
            insegue tutto, rumore compreso. Fra i due estremi c'è un minimo netto, ed è quello che vedi nel grafico
            qui sopra.
            <br />
            <br />
            <strong className="text-neutral-100">In pratica.</strong> Si parte da pose di 2-4 secondi e
            un'aggressività attorno al 60-70%, poi si guarda il grafico: se è un'onda lenta che oscilla attorno allo
            zero la guida è pigra e conviene alzare l'aggressività o accorciare la posa; se invece è un tremolio
            nervoso e a scatti stai rincorrendo il seeing e devi fare l'opposto. Attenzione anche a non farsi
            ingannare dal numero che il software dichiara: quello è l'RMS di ciò che ha{' '}
            <em>misurato</em>, che con correzioni aggressive può sembrare migliore di quanto la montatura stia
            realmente facendo. In questo simulatore la curva color bronzo è la posizione vera e quella grigia la
            misura: prova a portare l'aggressività oltre il 100% e osserva come si separano.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
