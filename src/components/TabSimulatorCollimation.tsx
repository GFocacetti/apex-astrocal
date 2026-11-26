import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Info, Crosshair, Shuffle, Lightbulb, RotateCcw } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';

type Scope = 'newton' | 'sct';

// The three collimation screws sit 120 degrees apart. Angles are in canvas
// convention (0 = right, 90 = down), so 270 puts the first screw at the top.
const SCREW_ANGLES = [270, 30, 150];

// How far the  shifts, in units of disc radius, per full turn of a screw.
const GAIN = 0.055;

// Below this residual the eye can no longer tell the ring is uneven.
const PERFECT_THRESHOLD = 0.025;

const SCOPES: Record<Scope, { label: string; obstruction: number; spider: boolean; note: string }> = {
  newton: {
    label: 'Newton',
    obstruction: 0.24,
    spider: true,
    note: 'Le tre viti agiscono sullo specchio primario, in fondo al tubo.',
  },
  sct: {
    label: 'Schmidt-Cassegrain',
    obstruction: 0.34,
    spider: false,
    note: 'Le tre viti agiscono sullo specchio secondario, al centro della lastra correttrice.',
  },
};

const deg2rad = (d: number) => (d * Math.PI) / 180;

function screwDir(i: number): [number, number] {
  const a = deg2rad(SCREW_ANGLES[i]);
  return [Math.cos(a), Math.sin(a)];
}

/** Draws the out-of-focus star: a bright ring with the  of the central obstruction. */
function drawDonut(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  errX: number,
  errY: number,
  scope: Scope,
  seeing: number
) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.33;
  const cfg = SCOPES[scope];

  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#04060e';
  ctx.fillRect(0, 0, w, h);

  ctx.filter = seeing > 0.02 ? `blur(${(seeing * 9).toFixed(2)}px)` : 'none';

  // Outer disc of the defocused star, with a few diffraction rings
  const disc = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  disc.addColorStop(0, 'rgba(198, 222, 255, 0.85)');
  disc.addColorStop(0.82, 'rgba(226, 240, 255, 0.95)');
  disc.addColorStop(0.95, 'rgba(255, 255, 255, 1)');
  disc.addColorStop(1, 'rgba(150, 190, 255, 0.15)');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 1; i <= 4; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.16 - i * 0.03})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1 - i * 0.055), 0, Math.PI * 2);
    ctx.stroke();
  }

  // The obstruction : it is its offset from centre that reveals miscollimation
  const sx = cx + errX * R;
  const sy = cy + errY * R;
  const sr = R * cfg.obstruction;

  ctx.globalCompositeOperation = 'destination-out';
  const hole = ctx.createRadialGradient(sx, sy, sr * 0.75, sx, sy, sr);
  hole.addColorStop(0, 'rgba(0,0,0,1)');
  hole.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Spider vanes, and the diffraction spikes they produce
  if (cfg.spider) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = Math.max(1.5, R * 0.022);
    for (let i = 0; i < 4; i++) {
      const a = deg2rad(i * 90 + 45);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * R * 1.1, sy + Math.sin(a) * R * 1.1);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const a = deg2rad(i * 90 + 45);
      const g = ctx.createLinearGradient(
        cx - Math.cos(a) * R * 2,
        cy - Math.sin(a) * R * 2,
        cx + Math.cos(a) * R * 2,
        cy + Math.sin(a) * R * 2
      );
      g.addColorStop(0, 'rgba(190,215,255,0)');
      g.addColorStop(0.5, 'rgba(190,215,255,0.5)');
      g.addColorStop(1, 'rgba(190,215,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * R * 2, cy - Math.sin(a) * R * 2);
      ctx.lineTo(cx + Math.cos(a) * R * 2, cy + Math.sin(a) * R * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.filter = 'none';
}

/** Top-down view of the mirror cell: where the screws are and which way the error points. */
const CellDiagram: React.FC<{ errX: number; errY: number; screws: number[]; hintIndex: number | null }> = ({
  errX,
  errY,
  screws,
  hintIndex,
}) => {
  const c = 60;
  const r = 42;
  const mag = Math.hypot(errX, errY);
  const ax = c + errX * 90;
  const ay = c + errY * 90;

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" role="img" aria-label="Posizione delle viti di collimazione">
      <circle cx={c} cy={c} r={r + 10} fill="#171717" stroke="#404040" strokeWidth="1.5" />
      <circle cx={c} cy={c} r={r} fill="#262626" stroke="#525252" strokeWidth="1" />
      <circle cx={c} cy={c} r={r * 0.3} fill="#171717" stroke="#525252" strokeWidth="1" />

      {/* Error vector: points from the centre towards where the  has drifted */}
      {mag > 0.01 && (
        <>
          <line x1={c} y1={c} x2={ax} y2={ay} stroke="#d16a5f" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={ax} cy={ay} r="3" fill="#d16a5f" />
        </>
      )}
      {mag <= PERFECT_THRESHOLD && <circle cx={c} cy={c} r="4" fill="#e5e5e5" />}

      {SCREW_ANGLES.map((a, i) => {
        const x = c + Math.cos(deg2rad(a)) * r;
        const y = c + Math.sin(deg2rad(a)) * r;
        const active = hintIndex === i;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r="9"
              fill={active ? '#b89a6a' : '#404040'}
              stroke={active ? '#d6c3a1' : '#737373'}
              strokeWidth="1.5"
            />
            <text
              x={x}
              y={y + 3.5}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill={active ? '#171717' : '#e5e5e5'}
            >
              {i + 1}
            </text>
            <text x={x} y={y + 18} textAnchor="middle" fontSize="7" fill="#a3a3a3">
              {screws[i] > 0 ? '+' : ''}
              {screws[i].toFixed(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const TabSimulatorCollimation: React.FC = () => {
  const [scope, setScope] = useState<Scope>('newton');
  const [screws, setScrews] = useState<number[]>([0, 0, 0]);
  const [base, setBase] = useState<[number, number]>([0.26, -0.14]);
  const [seeing, setSeeing] = useState<number>(0.15);
  const [showHint, setShowHint] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 560, h: 400 });

  // Residual miscollimation: the starting error plus whatever the screws have done.
  const [errX, errY] = useMemo(() => {
    let x = base[0];
    let y = base[1];
    for (let i = 0; i < 3; i++) {
      const [dx, dy] = screwDir(i);
      x += screws[i] * dx * GAIN;
      y += screws[i] * dy * GAIN;
    }
    return [x, y];
  }, [base, screws]);

  const magnitude = Math.hypot(errX, errY);
  const isCollimated = magnitude <= PERFECT_THRESHOLD;

  // Exact correction for each screw. The three 120-degree directions satisfy
  // sum(d_i d_i^T) = 1.5 * I, hence the 2/3 factor.
  const suggested = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const [dx, dy] = screwDir(i);
        return (-(2 / 3) * (errX * dx + errY * dy)) / GAIN;
      }),
    [errX, errY]
  );

  const hintIndex = useMemo(() => {
    if (!showHint || isCollimated) return null;
    let best = 0;
    for (let i = 1; i < 3; i++) if (Math.abs(suggested[i]) > Math.abs(suggested[best])) best = i;
    return best;
  }, [showHint, isCollimated, suggested]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(300, entry.contentRect.width);
      setSize({ w: Math.round(width), h: Math.round(width * 0.7) });
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
    drawDonut(ctx, size.w, size.h, errX, errY, scope, seeing);
  }, [size, errX, errY, scope, seeing]);

  const turn = (i: number, amount: number) =>
    setScrews((s) => s.map((v, k) => (k === i ? Number((v + amount).toFixed(2)) : v)));

  const randomize = () => {
    const a = Math.random() * Math.PI * 2;
    const m = 0.18 + Math.random() * 0.22;
    setBase([Math.cos(a) * m, Math.sin(a) * m]);
    setScrews([0, 0, 0]);
  };

  const reset = () => setScrews([0, 0, 0]);

  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Simulatore 07 / 10</div>
          <h2 className="page-title">Collimazione con lo star test</h2>
          <p className="lead">
            Sfoca una stella luminosa a forte ingrandimento e guarda la ciambella: se l'ombra centrale non è
            perfettamente al centro, il telescopio è scollimato. Qui puoi girare le tre viti quante volte vuoi senza
            il rischio di combinare disastri sul telescopio vero.
          </p>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 sm:p-6 space-y-6">
        <SimulatorStage
          readouts={
            <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Errore di Collimazione</div>
            <div className={`text-xl font-medium ${isCollimated ? 'text-neutral-200' : 'text-warn'}`}>
              {(magnitude * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">del raggio della ciambella</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Giri Totali Dati</div>
            <div className="text-xl font-medium text-neutral-200">
              {screws.reduce((a, b) => a + Math.abs(b), 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">somma dei tre movimenti</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Ostruzione Centrale</div>
            <div className="text-xl font-medium text-neutral-100">
              {Math.round(SCOPES[scope].obstruction * 100)}%
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">tipica per {SCOPES[scope].label}</div>
          </div>
        </div>
          }
          view={
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
              {/* Star test view */}
              <div ref={containerRef} className="relative w-full overflow-hidden rounded-md bg-neutral-950">
                <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
                <div className="absolute top-3 left-3 text-[11px] bg-neutral-950/75 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                  <span className={`font-semibold ${isCollimated ? 'text-neutral-200' : 'text-warn'}`}>
                    {isCollimated ? 'Collimato: ombra centrata' : 'Scollimato: ombra decentrata'}
                  </span>
                </div>
                {isCollimated && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-neutral-100 bg-white/5 border border-neutral-600 rounded-lg px-3 py-1.5">
                    Anello uniforme su tutto il giro
                  </div>
                )}
              </div>

              {/* Cell diagram */}
              <div className="w-full lg:w-44 shrink-0 bg-neutral-950 border border-neutral-800 rounded-md p-3">
                <div className="text-[11px] text-neutral-400 mb-1">Vista del cellone</div>
                <div className="w-36 h-36 mx-auto">
                  <CellDiagram errX={errX} errY={errY} screws={screws} hintIndex={hintIndex} />
                </div>
                <p className="text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
                  La freccia rossa indica dove è scappata l'ombra. Diventa un punto bianco quando è centrata.
                </p>
              </div>
            </div>
          }
          controls={
            <>
              {/* Scope selector */}
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(SCOPES) as Scope[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setScope(k)}
                    className={`rounded-md border px-4 py-3 text-left transition ${
                      scope === k
                        ? 'bg-white/[0.04] border-neutral-400'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${scope === k ? 'text-neutral-100' : 'text-neutral-200'}`}>
                      {SCOPES[k].label}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{SCOPES[k].note}</div>
                  </button>
                ))}
              </div>

              {/* Screws */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-3 transition ${
                      hintIndex === i ? 'bg-white/[0.03] border-neutral-600' : 'bg-neutral-950 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-neutral-200">Vite {i + 1}</span>
                      <span className="text-[11px] font-semibold text-neutral-100">
                        {screws[i] > 0 ? '+' : ''}
                        {screws[i].toFixed(2)} giri
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => turn(i, -0.25)}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800 transition"
                      >
                        −¼
                      </button>
                      <button
                        type="button"
                        onClick={() => turn(i, -0.05)}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-neutral-900 text-neutral-400 border border-neutral-700 hover:bg-neutral-800 transition"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => turn(i, 0.05)}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-neutral-900 text-neutral-400 border border-neutral-700 hover:bg-neutral-800 transition"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => turn(i, 0.25)}
                        className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800 transition"
                      >
                        +¼
                      </button>
                    </div>
                    {showHint && !isCollimated && (
                      <p className="mt-2 text-[10px] text-neutral-100">
                        suggerito {suggested[i] > 0 ? '+' : ''}
                        {suggested[i].toFixed(2)} giri
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={randomize}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-neutral-100 border border-neutral-700 hover:bg-neutral-800 transition"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Scollima a caso
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-950 text-neutral-300 border border-neutral-700 hover:bg-neutral-800 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Azzera le viti
                </button>
                <button
                  type="button"
                  onClick={() => setShowHint((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    showHint
                      ? 'bg-neutral-100 text-neutral-950 border-neutral-100'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {showHint ? 'Suggerimenti attivi' : 'Aiutami'}
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <Crosshair className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-[11px] text-neutral-400">Seeing</span>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={seeing}
                    onChange={(e) => setSeeing(Number(e.target.value))}
                    className="w-28 cursor-pointer"
                  />
                </div>
              </div>
            </>
          }
        >

        <DismissibleInfoPanel
          id="sim-collimation-note"
          icon={<Info className="w-5 h-5 text-neutral-200 shrink-0 mt-0.5" />}
          className="bg-neutral-900/40 border border-neutral-700 rounded-md p-4 flex items-start gap-3 text-xs text-neutral-300"
        >
          <span className="font-semibold text-neutral-50">Come si collima davvero, e perché tre viti</span>
          <p className="mt-1 leading-relaxed">
            Uno specchio si inclina attorno a due assi, e per definire un piano servono tre punti di appoggio: ecco
            perché le viti sono <strong className="text-neutral-100">tre, a 120° l'una dall'altra</strong>. Ogni vite
            sposta l'immagine lungo la propria direzione, quindi qualsiasi errore si corregge combinandone due o
            tre. Una conseguenza poco intuitiva ma importante: se giri tutte e tre le viti della stessa quantità lo
            specchio si sposta avanti o indietro senza inclinarsi, e la collimazione non cambia — cambia solo il
            fuoco. Puoi verificarlo qui: dai un quarto di giro a tutte e tre e l'ombra resterà dov'è.
            <br />
            <br />
            <strong className="text-neutral-100">La procedura reale.</strong> Punta una stella luminosa vicino allo
            zenit (dove la turbolenza è minima), usa un forte ingrandimento, sfoca finché non vedi la ciambella e
            guarda da che parte l'anello è più sottile: è lì che l'immagine è scappata. Agisci di poco per volta,
            un ottavo o un quarto di giro, e ricentra la stella dopo ogni ritocco, perché toccando le viti la stella
            si sposta nel campo. Man mano che ti avvicini, riduci lo sfocamento e aumenta l'ingrandimento: alla fine
            la verifica migliore è la figura di diffrazione appena fuori fuoco, con gli anelli concentrici e
            uniformi su tutto il giro. Con un <strong className="text-neutral-100">seeing</strong> mediocre la figura
            ribolle e non riuscirai a rifinire: prova ad alzare il cursore qui sopra per rendertene conto.
            <br />
            <br />
            <strong className="text-neutral-100">Differenze fra i due schemi.</strong> Un{' '}
            <strong className="text-neutral-100">Newton</strong> va collimato spesso, perché il tubo aperto e lo
            specchio primario su cellone si muovono col trasporto e con la temperatura; conviene fare prima
            l'allineamento grossolano del secondario con un Cheshire o un collimatore laser, e solo dopo rifinire il
            primario con lo star test. Uno <strong className="text-neutral-100">Schmidt-Cassegrain</strong> tiene la
            collimazione molto più a lungo, ma è anche molto più sensibile: le viti del secondario muovono
            l'immagine parecchio, quindi si lavora a ottavi di giro. In entrambi i casi non forzare mai una vite
            oltre il contatto, e sui Newton ricordati che i tre pomelli grandi sono spesso accoppiati a tre viti di
            bloccaggio da allentare prima e ristringere dopo.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
