import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserLocation } from '../types';
import { Sparkles, Info, Camera } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { SimulatorStage } from './SimulatorStage';

// The Andromeda Galaxy (M31) is the reference target: large, elongated, and
// the classic first deep-sky subject. Its high declination also means that at
// mid-northern latitudes it culminates close to the zenith, where an alt-az
// mount's field rotation becomes dramatic.
const TARGET_DEC = 41.27; // degrees
const TARGET_NAME = 'Galassia di Andromeda (M31)';

// The simulated sequence starts two hours east of the meridian, so the four
// hours of tracking carry the target across the meridian - where an alt-az
// mount rotates the field fastest.
const START_HOUR_ANGLE = -2;

// Assumed framing of the simulated camera, used to turn the field rotation
// into a concrete amount of trailing at the edge of the frame. M31 spans just
// over 3 degrees, so this is a typical widefield setup for it.
const FIELD_WIDTH_DEG = 3.5;
const FIELD_HEIGHT_DEG = 2.33;

const DEG = Math.PI / 180;

// The time slider and the sampled rotation path share the same grid, so the
// value under the slider is always one of the samples.
const MAX_HOURS = 4;
const SAMPLE_STEP_H = 0.02;
const SAMPLE_COUNT = Math.round(MAX_HOURS / SAMPLE_STEP_H) + 1;

interface SkyPosition {
  altitude: number;
  azimuth: number;
  parallactic: number;
}

/** Alt/az and parallactic angle of the target for a given hour angle. */
function skyPosition(hourAngleHours: number, latitude: number): SkyPosition {
  const H = hourAngleHours * 15 * DEG;
  const dec = TARGET_DEC * DEG;
  const lat = latitude * DEG;

  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;

  const azimuth =
    (Math.atan2(
      -Math.cos(dec) * Math.sin(H),
      Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H)
    ) /
      DEG +
      360) %
    360;

  // Parallactic angle: the tilt between the celestial pole and the local
  // vertical. Its change over time is exactly the field rotation an alt-az
  // mount produces.
  const parallactic =
    Math.atan2(Math.sin(H), Math.tan(lat) * Math.cos(dec) - Math.sin(dec) * Math.cos(H)) / DEG;

  return { altitude, azimuth, parallactic };
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

const FIELD_STARS = (() => {
  const rand = mulberry32(42042);
  return Array.from({ length: 220 }, () => ({
    x: rand() * 2 - 1,
    y: rand() * 2 - 1,
    r: 0.0015 + rand() * rand() * 0.009,
    a: 0.3 + rand() * 0.7,
  }));
})();

/** Draws one elliptical galaxy blob, flattened and tilted around its centre. */
function drawEllipticalGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  flatten: number,
  tilt: number,
  stops: [number, string][]
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.scale(1, flatten);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws a stylised Andromeda Galaxy plus a star field into a square canvas. */
function drawSkyLayer(canvas: HTMLCanvasElement, side: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = side * dpr;
  canvas.height = side * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, side, side);

  const c = side / 2;
  const s = side;
  const tilt = -0.62; // M31 sits at a steep angle in the sky

  // Faint outer halo
  drawEllipticalGlow(ctx, c, c, s * 0.38, 0.3, tilt, [
    [0, 'rgba(120, 140, 200, 0.22)'],
    [0.6, 'rgba(80, 100, 170, 0.1)'],
    [1, 'rgba(40, 50, 110, 0)'],
  ]);

  // Bluish spiral disc
  drawEllipticalGlow(ctx, c, c, s * 0.3, 0.27, tilt, [
    [0, 'rgba(200, 215, 245, 0.55)'],
    [0.4, 'rgba(150, 175, 230, 0.35)'],
    [1, 'rgba(70, 95, 170, 0)'],
  ]);

  // Dust lanes carved into the near side of the disc
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(tilt);
  ctx.scale(1, 0.27);
  ctx.strokeStyle = 'rgba(6, 8, 20, 0.55)';
  ctx.lineWidth = s * 0.045;
  ctx.beginPath();
  ctx.arc(0, s * 0.16, s * 0.29, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();
  ctx.lineWidth = s * 0.032;
  ctx.beginPath();
  ctx.arc(0, s * 0.1, s * 0.205, Math.PI * 0.16, Math.PI * 0.84);
  ctx.stroke();
  ctx.restore();

  // Warm central bulge, rounder and much brighter than the disc
  drawEllipticalGlow(ctx, c, c, s * 0.115, 0.55, tilt, [
    [0, 'rgba(255, 248, 225, 0.95)'],
    [0.25, 'rgba(250, 226, 175, 0.7)'],
    [0.6, 'rgba(215, 180, 140, 0.32)'],
    [1, 'rgba(150, 120, 100, 0)'],
  ]);

  // Satellite galaxies: M32 (compact, south) and M110 (elongated, north-west)
  drawEllipticalGlow(ctx, c + s * 0.075, c + s * 0.085, s * 0.026, 0.85, 0, [
    [0, 'rgba(255, 245, 220, 0.9)'],
    [0.35, 'rgba(235, 215, 180, 0.5)'],
    [1, 'rgba(180, 160, 130, 0)'],
  ]);
  drawEllipticalGlow(ctx, c - s * 0.115, c - s * 0.105, s * 0.045, 0.5, -0.5, [
    [0, 'rgba(230, 228, 215, 0.55)'],
    [0.4, 'rgba(200, 200, 190, 0.28)'],
    [1, 'rgba(150, 150, 150, 0)'],
  ]);

  // Background stars
  for (const st of FIELD_STARS) {
    const px = c + st.x * c;
    const py = c + st.y * c;
    ctx.fillStyle = `rgba(226, 236, 255, ${st.a})`;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, st.r * s), 0, Math.PI * 2);
    ctx.fill();
  }
}

interface TabSimulatorFieldRotationProps {
  location: UserLocation;
}

interface RotationChartProps {
  rotation: number[];
  hours: number;
  reversals: number[];
  dimmed: boolean;
}

/** Field rotation over the whole sequence, with the slider position marked. */
const RotationChart: React.FC<RotationChartProps> = ({ rotation, hours, reversals, dimmed }) => {
  const W = 600;
  const H = 96;
  const PAD_L = 34;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 18;
  const min = Math.min(0, ...rotation);
  const max = Math.max(0, ...rotation);
  const span = Math.max(1, max - min);
  const x = (h: number) => PAD_L + (h / MAX_HOURS) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - min) / span) * (H - PAD_T - PAD_B);
  const d = rotation
    .map((v, i) => `${i ? 'L' : 'M'}${x(i * SAMPLE_STEP_H).toFixed(1)},${y(v).toFixed(1)}`)
    .join('');
  const current = rotation[Math.min(rotation.length - 1, Math.round(hours / SAMPLE_STEP_H))];

  return (
    <figure className={dimmed ? 'opacity-40' : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Rotazione del campo nel tempo">
        <line x1={PAD_L} x2={W - PAD_R} y1={y(0)} y2={y(0)} stroke="#262626" />
        <text x={PAD_L - 6} y={y(max) + 3} textAnchor="end" fontSize="9" fill="#737373">
          {max.toFixed(0)}°
        </text>
        <text x={PAD_L - 6} y={y(0) + 3} textAnchor="end" fontSize="9" fill="#737373">
          0°
        </text>
        {min < -10 && (
          <text x={PAD_L - 6} y={y(min) + 3} textAnchor="end" fontSize="9" fill="#737373">
            {min.toFixed(0)}°
          </text>
        )}
        {[0, 1, 2, 3, 4].map((h) => (
          <text key={h} x={x(h)} y={H - 4} textAnchor="middle" fontSize="9" fill="#737373">
            {h} h
          </text>
        ))}
        {reversals.map((r) => (
          <line key={r} x1={x(r)} x2={x(r)} y1={PAD_T} y2={H - PAD_B} stroke="#525252" strokeDasharray="2 3" />
        ))}
        <path d={d} fill="none" stroke="#b89a6a" strokeWidth="1.5" />
        <line x1={x(hours)} x2={x(hours)} y1={PAD_T} y2={H - PAD_B} stroke="#a3a3a3" />
        <circle cx={x(hours)} cy={y(current)} r="3" fill="#f5f5f5" />
      </svg>
      <figcaption className="text-[10px] text-neutral-500 mt-1">
        Rotazione del campo in alt-az lungo le 4 ore. Le linee tratteggiate segnano dove cambia verso.
      </figcaption>
    </figure>
  );
};

export const TabSimulatorFieldRotation: React.FC<TabSimulatorFieldRotationProps> = ({ location }) => {
  const [hours, setHours] = useState<number>(0);
  const [mount, setMount] = useState<'altaz' | 'equatorial'>('altaz');
  const [longExposure, setLongExposure] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 720, h: 440 });

  const now = useMemo(
    () => skyPosition(START_HOUR_ANGLE + hours, location.latitude),
    [hours, location.latitude]
  );

  // Field rotation is how much the parallactic angle has changed since the
  // start. It is sampled along the whole sequence and unwrapped, because it is
  // not monotonic: its rate goes as cos(azimuth)/cos(altitude), so it stops and
  // reverses each time the target crosses due east or due west, and it races
  // through nearly 180 degrees when the target passes close to the zenith.
  // A plain "now minus start" would hide both and could even jump by 360.
  const path = useMemo(() => {
    const rotation: number[] = [];
    const altitude: number[] = [];
    let prev = skyPosition(START_HOUR_ANGLE, location.latitude).parallactic;
    let acc = 0;
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const p = skyPosition(START_HOUR_ANGLE + i * SAMPLE_STEP_H, location.latitude);
      let d = p.parallactic - prev;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      acc += d;
      prev = p.parallactic;
      rotation.push(acc);
      altitude.push(p.altitude);
    }
    return { rotation, altitude, maxAltitude: Math.max(...altitude) };
  }, [location.latitude]);

  const sampleIndex = Math.min(SAMPLE_COUNT - 1, Math.round(hours / SAMPLE_STEP_H));
  const rotationDeg = path.rotation[sampleIndex];
  const appliedRotation = mount === 'altaz' ? rotationDeg : 0;

  // Angle actually swept so far, back-and-forth included: that, not the net
  // rotation, is the length of the arc a star draws in a single long exposure.
  let sweptDeg = 0;
  for (let i = 1; i <= sampleIndex; i++) sweptDeg += Math.abs(path.rotation[i] - path.rotation[i - 1]);
  const appliedSwept = mount === 'altaz' ? sweptDeg : 0;

  // Reversal points (rotation rate changes sign) inside the window.
  const reversals = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i < SAMPLE_COUNT - 1; i++) {
      const a = path.rotation[i] - path.rotation[i - 1];
      const b = path.rotation[i + 1] - path.rotation[i];
      if (a * b < 0) out.push(i * SAMPLE_STEP_H);
    }
    return out;
  }, [path]);

  // Fastest rotation in the window, in degrees per minute.
  const peakRate = useMemo(() => {
    let max = 0;
    for (let i = 1; i < SAMPLE_COUNT; i++) {
      max = Math.max(max, Math.abs(path.rotation[i] - path.rotation[i - 1]) / (SAMPLE_STEP_H * 60));
    }
    return max;
  }, [path]);

  // Trailing suffered by a star at the corner of the frame.
  const halfDiagonalDeg = Math.hypot(FIELD_WIDTH_DEG, FIELD_HEIGHT_DEG) / 2;
  const trailArcmin = appliedSwept * DEG * halfDiagonalDeg * 60;

  const rect = useMemo(() => {
    const w = size.w * 0.62;
    const h = w * (FIELD_HEIGHT_DEG / FIELD_WIDTH_DEG);
    return { w, h, x: (size.w - w) / 2, y: (size.h - h) / 2 };
  }, [size]);

  const skySide = Math.hypot(rect.w, rect.h) * 1.04;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(320, entry.contentRect.width);
      setSize({ w: width, h: Math.max(280, Math.round(width * 0.56)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const c = document.createElement('canvas');
    drawSkyLayer(c, skySide);
    skyRef.current = c;
  }, [skySide]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sky = skyRef.current;
    if (!canvas || !sky) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, size.w, size.h);

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    ctx.fillStyle = '#05070f';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const drawAt = (angleDeg: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angleDeg * DEG);
      ctx.drawImage(sky, -skySide / 2, -skySide / 2, skySide, skySide);
      ctx.restore();
    };

    if (longExposure && mount === 'altaz' && sampleIndex > 0) {
      // Stack the tracked sequence along its real path: stars smear into arcs
      // exactly as on a single long exposure, back-and-forth included. Each
      // frame gets the same share of the exposure, so where the field races
      // (near the zenith) the arc is fainter, as it is on a real sensor.
      const alpha = Math.min(0.5, 5 / (sampleIndex + 1));
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i <= sampleIndex; i++) {
        drawAt(path.rotation[i], alpha);
      }
      ctx.globalCompositeOperation = 'source-over';
      drawAt(appliedRotation, 0.85);
    } else {
      drawAt(appliedRotation, 1);
    }

    ctx.restore();

    // Sensor frame
    ctx.strokeStyle = mount === 'altaz' ? 'rgba(209,106,95, 0.75)' : 'rgba(229,229,229, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // Corner ticks, to make the rotation of the frame contents obvious
    ctx.strokeStyle = 'rgba(163,163,163, 0.5)';
    ctx.lineWidth = 1;
    const tick = Math.min(rect.w, rect.h) * 0.06;
    const corners = [
      [rect.x, rect.y, 1, 1],
      [rect.x + rect.w, rect.y, -1, 1],
      [rect.x, rect.y + rect.h, 1, -1],
      [rect.x + rect.w, rect.y + rect.h, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x, y + sy * tick);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * tick, y);
      ctx.stroke();
    }
  }, [size, rect, skySide, appliedRotation, longExposure, mount, path, sampleIndex]);

  const belowHorizon = now.altitude < 0;

  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Simulatore 03 / 10</div>
          <h2 className="page-title">Rotazione di campo: alt-az o equatoriale</h2>
          <p className="lead">
            Entrambe le montature inseguono l'oggetto e lo tengono al centro dell'inquadratura. Ma con
            un'altazimutale il campo ruota lentamente su sé stesso, ora dopo ora: fai scorrere il tempo e confronta
            le due modalità per capire perché la lunga posa deep-sky richiede una montatura equatoriale.
          </p>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="section-title">
            {TARGET_NAME} da {location.name}
          </h3>
          <span className="text-[11px] text-neutral-500">
            campo {FIELD_WIDTH_DEG}° × {FIELD_HEIGHT_DEG}° · latitudine {location.latitude.toFixed(1)}°
          </span>
        </div>

        <SimulatorStage
          readouts={
            <div className="grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2">
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Tempo trascorso</div>
            <div className="text-xl font-medium text-neutral-200">{hours.toFixed(1)} h</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">Inseguimento continuo</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Rotazione del campo</div>
            <div
              className={`text-xl font-medium ${mount === 'altaz' ? 'text-warn' : 'text-neutral-200'}`}
            >
              {appliedRotation > 0.05 ? '+' : ''}
              {appliedRotation.toFixed(1)}°
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              {mount === 'altaz'
                ? `rispetto all'inizio · percorsi ${sweptDeg.toFixed(1)}°`
                : 'Compensata dalla montatura'}
            </div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Arco agli angoli</div>
            <div className={`text-xl font-medium ${trailArcmin > 0.5 ? 'text-warn' : 'text-neutral-200'}`}>
              {trailArcmin.toFixed(1)}′
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">in una posa unica di {hours.toFixed(1)} h</div>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 rounded-md p-3">
            <div className="text-[11px] text-neutral-400">Altezza</div>
            <div className="text-xl font-medium text-neutral-100">{now.altitude.toFixed(0)}°</div>
            <div className="text-[10px] text-neutral-500 mt-0.5">azimut {now.azimuth.toFixed(0)}°</div>
          </div>
        </div>
          }
          view={
            <div className="space-y-3">
            <div ref={containerRef} className="relative w-full overflow-hidden rounded-md bg-neutral-950">
              <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
              <div className="absolute top-3 left-3 text-[11px] text-neutral-400 bg-neutral-950/70 border border-neutral-800 rounded-lg px-2.5 py-1.5">
                Dopo <span className="text-neutral-100 font-semibold">{hours.toFixed(1)} h</span> ·{' '}
                {mount === 'altaz' ? (
                  <>
                    rotazione campo{' '}
                    <span className="text-warn font-semibold">
                      {rotationDeg > 0.05 ? '+' : ''}
                      {rotationDeg.toFixed(1)}°
                    </span>
                  </>
                ) : (
                  <span className="text-neutral-100 font-semibold">campo fermo (0,0°)</span>
                )}
              </div>
            </div>
            <RotationChart
              rotation={path.rotation}
              hours={hours}
              reversals={reversals}
              dimmed={mount !== 'altaz'}
            />
            </div>
          }
          controls={
            <>
              <div>
                <div className="flex justify-between text-xs text-neutral-300 mb-1">
                  <span>
                    Tempo Trascorso: <strong className="text-neutral-200">{hours.toFixed(1)} ore</strong>
                  </span>
                  <span className="text-[10px] text-neutral-500">l'oggetto attraversa il meridiano</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_HOURS}
                  step={0.1}
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="w-full cursor-pointer"
                />
              </div>

              {/* Mount selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMount('altaz')}
                  className={`rounded-md border px-4 py-3 text-left transition ${
                    mount === 'altaz'
                      ? 'bg-white/[0.04] border-neutral-400'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className={`text-sm font-semibold ${mount === 'altaz' ? 'text-white' : 'text-neutral-300'}`}>
                    Alt-Azimutale
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Due assi: altezza e azimut</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMount('equatorial')}
                  className={`rounded-md border px-4 py-3 text-left transition ${
                    mount === 'equatorial'
                      ? 'bg-white/[0.04] border-neutral-400'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className={`text-sm font-semibold ${mount === 'equatorial' ? 'text-white' : 'text-neutral-300'}`}>
                    Equatoriale
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">Un asse allineato al polo celeste</div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLongExposure((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  longExposure
                    ? 'bg-neutral-100 text-neutral-950 border-neutral-100'
                    : 'bg-neutral-950 text-neutral-400 border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${longExposure ? 'bg-accent' : 'bg-neutral-700'}`} />
                {longExposure ? 'Posa unica cumulativa: attiva' : 'Simula una posa unica di tutta la sequenza'}
              </button>
              <p className="text-[11px] text-neutral-500">
                Con la posa cumulativa attiva vedi il risultato di un'unica esposizione lunga quanto tutta la sequenza:
                le stelle si trasformano in archi concentrici invece che in punti.
              </p>
            </>
          }
        >

        {belowHorizon && (
          <p className="text-[11px] text-neutral-200">
            Alla tua latitudine, in questo momento della sequenza M31 sarebbe sotto l'orizzonte: i valori restano
            validi come dimostrazione geometrica.
          </p>
        )}

        {(reversals.length > 0 || path.maxAltitude > 80) && (
          <div className="border-l-2 border-accent pl-4 py-1 text-xs text-neutral-300 leading-relaxed max-w-3xl">
            <span className="font-semibold text-neutral-100">
              Perché il campo si ferma, torna indietro e poi gira di scatto.
            </span>{' '}
            La velocità di rotazione è proporzionale al coseno dell'azimut diviso il coseno dell'altezza. Quando
            l'oggetto attraversa l'est o l'ovest esatti (azimut 90° o 270°) il coseno si annulla: la rotazione si
            ferma e cambia verso
            {reversals.length > 0 && (
              <> — qui succede dopo {reversals.map((r) => `${r.toFixed(1).replace('.', ',')} h`).join(' e dopo ')}</>
            )}
            .{' '}
            {path.maxAltitude > 80 && (
              <>
                Vicino allo zenit, invece, il coseno dell'altezza tende a zero e la rotazione accelera bruscamente: da{' '}
                {location.name} M31 culmina a {path.maxAltitude.toFixed(1).replace('.', ',')}° e il campo arriva a
                girare di {peakRate.toFixed(1).replace('.', ',')}° al minuto. Nella pratica nessuna montatura
                altazimutale riesce a seguirlo: anche l'asse dell'azimut dovrebbe compiere mezzo giro in pochi
                minuti. È la «zona cieca dello zenit», e chi riprende in alt-az aspetta che l'oggetto ne esca.
              </>
            )}
          </div>
        )}

        <DismissibleInfoPanel
          id="sim-field-rotation-note"
          icon={<Info className="w-5 h-5 text-neutral-200 shrink-0 mt-0.5" />}
          className="bg-neutral-900/40 border border-neutral-700 rounded-md p-4 flex items-start gap-3 text-xs text-neutral-300"
        >
          <span className="font-semibold text-neutral-50">Perché il campo ruota su una montatura altazimutale</span>
          <p className="mt-1 leading-relaxed">
            Una montatura <strong className="text-warn">altazimutale</strong> muove il telescopio su e giù e
            destra-sinistra: riesce benissimo a tenere l'oggetto centrato, ma non a mantenerne l'orientamento,
            perché il cielo ruota attorno al polo celeste e non attorno allo zenit. L'angolo tra la verticale locale
            e la direzione del polo — l'<strong className="text-neutral-100">angolo parallattico</strong> — cambia di
            continuo, e con esso ruota l'immagine nel sensore. Una montatura{' '}
            <strong className="text-neutral-100">equatoriale</strong> ha invece un asse già allineato al polo
            celeste: ruotandolo alla velocità siderale riproduce esattamente il moto del cielo, orientamento
            compreso, e il campo resta fermo. La rotazione è tanto più rapida quanto più l'oggetto passa vicino allo{' '}
            <strong className="text-neutral-100">zenit</strong>: alle latitudini italiane M31 culmina quasi allo zenit,
            ed è per questo che la rotazione qui è così violenta. Per il visuale è irrilevante (l'occhio non
            integra), ma in fotografia a lunga posa trasforma le stelle in archi. Le alternative sono un{' '}
            <strong className="text-neutral-100">derotatore di campo</strong> motorizzato, oppure moltissime pose
            brevi ruotate e riallineate in fase di elaborazione — al prezzo di perdere i bordi dell'inquadratura.
          </p>
        </DismissibleInfoPanel>
        </SimulatorStage>
      </div>
    </div>
  );
};
