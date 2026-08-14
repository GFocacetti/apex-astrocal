import React, { useState, useMemo } from 'react';
import * as Astronomy from 'astronomy-engine';
import { UserLocation } from '../types';
import { Sparkles, Info, Compass, Shuffle, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';
import { ApexIcon } from './ApexIcon';

// Polaris in 2026: precession has carried it to roughly 3h 00m of right
// ascension and 39 arcminutes from the celestial pole, and it is still closing
// in - it reaches its minimum distance of about 27 arcminutes around 2100.
const POLARIS_RA_HOURS = 3.0;
const POLARIS_POLE_DIST_DEG = 0.65;

// Field of view of a typical polar scope, as a radius in degrees.
const SCOPE_FOV_DEG = 2.5;

// Within this residual the mount tracks well enough for most imaging.
const GOOD_ARCMIN = 3;

const VIEW = 400;
const CENTER = VIEW / 2;
const PX_PER_DEG = (VIEW / 2 - 20) / SCOPE_FOV_DEG;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Faint field stars, positioned relative to the true pole so they drift with it.
const FIELD = (() => {
  const rand = mulberry32(5150);
  return Array.from({ length: 45 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * SCOPE_FOV_DEG * 1.15;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, s: 0.7 + rand() * 1.5, a: 0.25 + rand() * 0.45 };
  });
})();

interface Props {
  location: UserLocation;
}

export const TabSimulatorPolarAlign: React.FC<Props> = ({ location }) => {
  // Where the true celestial pole currently sits relative to the reticle
  // centre, in arcminutes. This is exactly what the two screws move.
  const [errAz, setErrAz] = useState<number>(38);
  const [errAlt, setErrAlt] = useState<number>(-27);
  const [hourOffset, setHourOffset] = useState<number>(0);
  const [showPole, setShowPole] = useState<boolean>(false);

  // Local sidereal time drives where Polaris sits on its circle around the
  // pole: it swings all the way round once per sidereal day, which is why
  // there is no single "correct" spot on the reticle.
  const polarisAngleDeg = useMemo(() => {
    const now = new Date(Date.now() + hourOffset * 3600 * 1000);
    const gast = Astronomy.SiderealTime(now); // apparent sidereal time at Greenwich, in hours
    const lst = (((gast + location.longitude / 15) % 24) + 24) % 24;
    const ha = (((lst - POLARIS_RA_HOURS) % 24) + 24) % 24;
    return ha * 15;
  }, [hourOffset, location.longitude]);

  const errTotal = Math.hypot(errAz, errAlt);
  const isAligned = errTotal <= GOOD_ARCMIN;

  // Where things land on screen
  const poleX = CENTER + (errAz / 60) * PX_PER_DEG;
  const poleY = CENTER + (errAlt / 60) * PX_PER_DEG;

  const a = (polarisAngleDeg * Math.PI) / 180;
  const offX = Math.sin(a) * POLARIS_POLE_DIST_DEG * PX_PER_DEG;
  const offY = -Math.cos(a) * POLARIS_POLE_DIST_DEG * PX_PER_DEG;

  const polarisX = poleX + offX;
  const polarisY = poleY + offY;
  const targetX = CENTER + offX;
  const targetY = CENTER + offY;

  // A misaligned axis makes the sky slide across the sensor. Over a rotation of
  // 15 deg/hour the drift is the alignment error times the angle turned.
  const driftArcsec5min = errTotal * ((15 * (5 / 60) * Math.PI) / 180) * 60;

  const clockPos = ((polarisAngleDeg / 30 + 12) % 12) || 12;

  const nudge = (daz: number, dalt: number) => {
    setErrAz((v) => Number((v + daz).toFixed(1)));
    setErrAlt((v) => Number((v + dalt).toFixed(1)));
  };

  const randomize = () => {
    setErrAz(Number((Math.random() * 90 - 45).toFixed(1)));
    setErrAlt(Number((Math.random() * 90 - 45).toFixed(1)));
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
            Allineamento Polare al Cannocchiale
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            La Polare non è il polo: gli gira attorno a poco più di mezzo grado di distanza. Allineare la montatura
            vuol dire portarla sulla tacca giusta del reticolo agendo sulle due viti di altezza e azimut — e la
            tacca giusta cambia ora dopo ora.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Compass className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            Vista nel cannocchiale polare
          </h3>
          <span className="text-[11px] text-slate-500">
            da {location.name} · latitudine {location.latitude.toFixed(1)}°
          </span>
        </div>

        <SimulatorStage
          view={
            <div className="mx-auto w-full max-w-[400px]">
            <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-full rounded-xl bg-[#04060e] border border-slate-800">
              {/* Faint stars, carried along by the true pole */}
              {FIELD.map((s, i) => (
                <circle
                  key={i}
                  cx={poleX + s.dx * PX_PER_DEG}
                  cy={poleY + s.dy * PX_PER_DEG}
                  r={s.s}
                  fill={`rgba(220,232,255,${s.a})`}
                />
              ))}

              {/* Reticle engraving: the mount's own axis is always the centre */}
              <circle cx={CENTER} cy={CENTER} r={VIEW / 2 - 20} fill="none" stroke="#334155" strokeWidth="1.5" />
              <circle cx={CENTER} cy={CENTER} r={POLARIS_POLE_DIST_DEG * PX_PER_DEG} fill="none" stroke="#475569" strokeWidth="1.5" />
              <line x1={CENTER - 24} y1={CENTER} x2={CENTER + 24} y2={CENTER} stroke="#475569" strokeWidth="1.5" />
              <line x1={CENTER} y1={CENTER - 24} x2={CENTER} y2={CENTER + 24} stroke="#475569" strokeWidth="1.5" />

              {/* Hour marks around the Polaris circle */}
              {Array.from({ length: 12 }, (_, i) => {
                const ang = ((i * 30) * Math.PI) / 180;
                const r0 = POLARIS_POLE_DIST_DEG * PX_PER_DEG;
                const x1 = CENTER + Math.sin(ang) * (r0 - 5);
                const y1 = CENTER - Math.cos(ang) * (r0 - 5);
                const x2 = CENTER + Math.sin(ang) * (r0 + 5);
                const y2 = CENTER - Math.cos(ang) * (r0 + 5);
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth="1" />;
              })}

              {/* Where Polaris has to end up, given the current sidereal time */}
              <circle cx={targetX} cy={targetY} r="11" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="3 3" />
              <text x={targetX} y={targetY - 17} textAnchor="middle" fontSize="10" fill="#34d399" fontWeight="bold">
                obiettivo
              </text>

              {/* The true celestial pole, normally invisible at the eyepiece */}
              {showPole && (
                <g>
                  <circle cx={poleX} cy={poleY} r="5" fill="none" stroke="#f43f5e" strokeWidth="2" />
                  <line x1={poleX - 9} y1={poleY} x2={poleX + 9} y2={poleY} stroke="#f43f5e" strokeWidth="1.5" />
                  <line x1={poleX} y1={poleY - 9} x2={poleX} y2={poleY + 9} stroke="#f43f5e" strokeWidth="1.5" />
                  <text x={poleX} y={poleY + 22} textAnchor="middle" fontSize="10" fill="#f43f5e">
                    polo vero
                  </text>
                </g>
              )}

              {/* Polaris */}
              <circle cx={polarisX} cy={polarisY} r="9" fill="rgba(255,240,210,0.25)" />
              <circle cx={polarisX} cy={polarisY} r="4.5" fill="#fff7e0" />
              <text x={polarisX + 12} y={polarisY + 4} fontSize="11" fill="#fde68a" fontWeight="bold">
                Polaris
              </text>

              {isAligned && (
                <text x={CENTER} y={VIEW - 14} textAnchor="middle" fontSize="12" fill="#34d399" fontWeight="bold">
                  Allineato
                </text>
              )}
            </svg>
            </div>
          }
          controls={
            <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 mb-2">Vite di Altezza</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nudge(0, -6)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    Alza
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(0, 6)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    Abbassa
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => nudge(0, -1)}
                    className="flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    fine ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(0, 1)}
                    className="flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    fine ↓
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                  scarto {errAlt > 0 ? '+' : ''}
                  {errAlt.toFixed(1)}′
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="text-[11px] text-slate-400 mb-2">Vite di Azimut</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => nudge(-6, 0)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Sinistra
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(6, 0)}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    Destra
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => nudge(-1, 0)}
                    className="flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    fine ←
                  </button>
                  <button
                    type="button"
                    onClick={() => nudge(1, 0)}
                    className="flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 text-cyan-300 border border-slate-700 hover:bg-slate-800 transition"
                  >
                    fine →
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-2">
                  scarto {errAz > 0 ? '+' : ''}
                  {errAz.toFixed(1)}′
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={randomize}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 text-amber-300 border border-slate-700 hover:bg-slate-800 transition"
              >
                <Shuffle className="w-3.5 h-3.5" />
                Monta da zero
              </button>
              <button
                type="button"
                onClick={() => setShowPole((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  showPole
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {showPole ? 'Polo vero visibile' : 'Mostra il polo vero'}
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>
                  Sposta l'ora: <strong className="text-amber-400">{hourOffset > 0 ? '+' : ''}{hourOffset} h</strong>
                </span>
                <span className="text-[10px] text-slate-500">la tacca si sposta col tempo siderale</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={hourOffset}
                onChange={(e) => setHourOffset(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
            </>
          }
        >
        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Errore di Allineamento</div>
            <div className={`text-xl font-extrabold ${isAligned ? 'text-emerald-400' : 'text-rose-400'}`}>
              {errTotal.toFixed(1)}′
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {isAligned ? 'buono per la lunga posa' : 'la Polare non è sulla tacca'}
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Deriva in 5 Minuti</div>
            <div className={`text-xl font-extrabold ${driftArcsec5min < 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {driftArcsec5min.toFixed(1)}″
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">fino a, senza autoguida</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Posizione della Polare</div>
            <div className="text-xl font-extrabold text-cyan-300">ore {clockPos.toFixed(1)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">sul quadrante del reticolo</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Distanza dal Polo</div>
            <div className="text-xl font-extrabold text-slate-200">{(POLARIS_POLE_DIST_DEG * 60).toFixed(0)}′</div>
            <div className="text-[10px] text-slate-500 mt-0.5">la Polare nel 2026</div>
          </div>
        </div>

        <DismissibleInfoPanel
          id="sim-polar-align-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Perché non basta "puntare la Polare"</span>
          <p className="mt-1 leading-relaxed">
            Il polo celeste è il punto attorno a cui ruota tutto il cielo, e la{' '}
            <strong className="text-slate-100">Stella Polare non ci sta sopra</strong>: nel 2026 se ne trova a circa{' '}
            <strong className="text-amber-300">39 primi d'arco</strong>, poco più di mezzo grado, e vi gira attorno
            una volta al giorno siderale. Per questo il reticolo del cannocchiale polare ha un cerchietto di quel
            raggio: il tuo compito non è centrare la Polare, ma appoggiarla sulla{' '}
            <strong className="text-slate-100">posizione oraria corretta</strong> di quel cerchio. La posizione
            dipende dall'ora e dalla tua longitudine, ed è quella che qui viene calcolata dal tempo siderale locale:
            prova a muovere il cursore delle ore e guarda l'obiettivo spostarsi lungo il cerchio.
            <br />
            <br />
            <strong className="text-slate-100">Le due viti.</strong> La montatura equatoriale si regola su due assi
            indipendenti: la vite di <strong className="text-slate-100">altezza</strong> alza e abbassa l'asse
            polare e si imposta grossolanamente sulla latitudine del posto, quella di{' '}
            <strong className="text-slate-100">azimut</strong> lo ruota a destra e sinistra verso il nord vero — che
            non è il nord magnetico della bussola. Conviene sempre partire con il treppiede in bolla, altrimenti le
            due regolazioni si influenzano a vicenda e si finisce per inseguire la coda.
            <br />
            <br />
            <strong className="text-slate-100">Quanto deve essere preciso?</strong> Dipende da cosa ci fai. Un
            errore residuo fa scivolare lentamente il campo: la deriva è pari all'errore moltiplicato per l'angolo
            che il cielo percorre, quindi con 10 primi d'arco di scarto si accumulano circa 13 secondi d'arco in
            cinque minuti — enormi, visto che una stella ben messa a fuoco ne misura due o tre. Con l'autoguida la
            deriva viene corretta e qualche primo d'arco è tollerabile, ma resta la{' '}
            <strong className="text-slate-100">rotazione di campo</strong>, che nessuna guida può togliere: è il
            motivo per cui conviene comunque scendere sotto i 2-3 primi. Per il visuale, invece, anche mezzo grado
            non dà alcun fastidio.
            <br />
            <br />
            Un'avvertenza pratica: molti cannocchiali polari mostrano l'immagine{' '}
            <strong className="text-slate-100">capovolta o specchiata</strong>, quindi la posizione oraria da usare
            può risultare ruotata rispetto a quella che leggi su un'app. Fidati del reticolo che hai davanti e, in
            caso di dubbio, verifica con il metodo della deriva o con l'allineamento polare assistito del software
            di acquisizione, che misura l'errore direttamente dalle stelle riprese.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
