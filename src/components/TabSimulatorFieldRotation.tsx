import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserLocation } from '../types';
import { Sparkles, Info, Camera } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { ApexIcon } from './ApexIcon';

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

export const TabSimulatorFieldRotation: React.FC<TabSimulatorFieldRotationProps> = ({ location }) => {
  const [hours, setHours] = useState<number>(0);
  const [mount, setMount] = useState<'altaz' | 'equatorial'>('altaz');
  const [longExposure, setLongExposure] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skyRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 720, h: 440 });

  const start = useMemo(() => skyPosition(START_HOUR_ANGLE, location.latitude), [location.latitude]);
  const now = useMemo(
    () => skyPosition(START_HOUR_ANGLE + hours, location.latitude),
    [hours, location.latitude]
  );

  // Field rotation is simply how much the parallactic angle has changed; an
  // equatorial mount follows that rotation mechanically, so its field is fixed.
  let rotationDeg = now.parallactic - start.parallactic;
  if (rotationDeg > 180) rotationDeg -= 360;
  if (rotationDeg < -180) rotationDeg += 360;
  const appliedRotation = mount === 'altaz' ? rotationDeg : 0;

  // Trailing suffered by a star at the corner of the frame.
  const halfDiagonalDeg = Math.hypot(FIELD_WIDTH_DEG, FIELD_HEIGHT_DEG) / 2;
  const trailArcmin = Math.abs(appliedRotation) * DEG * halfDiagonalDeg * 60;

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

    if (longExposure && Math.abs(appliedRotation) > 0.05) {
      // Stack the whole tracked sequence: stars smear into arcs exactly as they
      // would on a single long sub-exposure.
      const steps = 90;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i <= steps; i++) {
        drawAt((appliedRotation * i) / steps, 0.055);
      }
      ctx.globalCompositeOperation = 'source-over';
      drawAt(appliedRotation, 0.85);
    } else {
      drawAt(appliedRotation, 1);
    }

    ctx.restore();

    // Sensor frame
    ctx.strokeStyle = mount === 'altaz' ? 'rgba(244, 63, 94, 0.75)' : 'rgba(52, 211, 153, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    // Corner ticks, to make the rotation of the frame contents obvious
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
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
  }, [size, rect, skySide, appliedRotation, longExposure, mount]);

  const belowHorizon = now.altitude < 0;

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
            Rotazione di Campo: Alt-Az vs Equatoriale
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Entrambe le montature inseguono l'oggetto e lo tengono al centro dell'inquadratura. Ma con
            un'altazimutale il campo ruota lentamente su sé stesso, ora dopo ora: fai scorrere il tempo e confronta
            le due modalità per capire perché la lunga posa deep-sky richiede una montatura equatoriale.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Camera className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
            {TARGET_NAME} da {location.name}
          </h3>
          <span className="text-[11px] text-slate-500">
            campo {FIELD_WIDTH_DEG}° × {FIELD_HEIGHT_DEG}° · latitudine {location.latitude.toFixed(1)}°
          </span>
        </div>

        {/* Mount selector */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMount('altaz')}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              mount === 'altaz'
                ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/30'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`text-sm font-bold ${mount === 'altaz' ? 'text-rose-300' : 'text-slate-200'}`}>
              Alt-Azimutale
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Due assi: altezza e azimut</div>
          </button>
          <button
            type="button"
            onClick={() => setMount('equatorial')}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              mount === 'equatorial'
                ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className={`text-sm font-bold ${mount === 'equatorial' ? 'text-emerald-300' : 'text-slate-200'}`}>
              Equatoriale
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Un asse allineato al polo celeste</div>
          </button>
        </div>

        {/* Simulated frame */}
        <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-slate-950">
          <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
          <div className="absolute top-3 left-3 text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5">
            Dopo <span className="text-amber-300 font-bold">{hours.toFixed(1)} h</span> ·{' '}
            {mount === 'altaz' ? (
              <>
                rotazione campo{' '}
                <span className="text-rose-300 font-bold">{Math.abs(rotationDeg).toFixed(1)}°</span>
              </>
            ) : (
              <span className="text-emerald-300 font-bold">campo fermo (0,0°)</span>
            )}
          </div>
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Tempo Trascorso</div>
            <div className="text-xl font-extrabold text-slate-200">{hours.toFixed(1)} h</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Inseguimento continuo</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Rotazione di Campo</div>
            <div
              className={`text-xl font-extrabold ${mount === 'altaz' ? 'text-rose-400' : 'text-emerald-400'}`}
            >
              {Math.abs(appliedRotation).toFixed(1)}°
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {mount === 'altaz' ? 'Il campo ruota' : 'Compensata dalla montatura'}
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Trascinamento ai Bordi</div>
            <div className={`text-xl font-extrabold ${trailArcmin > 0.5 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {trailArcmin.toFixed(1)}′
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stelle all'angolo del sensore</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Posizione in Cielo</div>
            <div className="text-xl font-extrabold text-cyan-300">{now.altitude.toFixed(0)}°</div>
            <div className="text-[10px] text-slate-500 mt-0.5">azimut {now.azimuth.toFixed(0)}°</div>
          </div>
        </div>

        {belowHorizon && (
          <p className="text-[11px] text-amber-400">
            Alla tua latitudine, in questo momento della sequenza M31 sarebbe sotto l'orizzonte: i valori restano
            validi come dimostrazione geometrica.
          </p>
        )}

        {/* Controls */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>
                Tempo Trascorso: <strong className="text-amber-400">{hours.toFixed(1)} ore</strong>
              </span>
              <span className="text-[10px] text-slate-500">l'oggetto attraversa il meridiano</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              step={0.1}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => setLongExposure((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              longExposure
                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${longExposure ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            {longExposure ? 'Posa unica cumulativa: attiva' : 'Simula una posa unica di tutta la sequenza'}
          </button>
          <p className="text-[11px] text-slate-500">
            Con la posa cumulativa attiva vedi il risultato di un'unica esposizione lunga quanto tutta la sequenza:
            le stelle si trasformano in archi concentrici invece che in punti.
          </p>
        </div>

        <DismissibleInfoPanel
          id="sim-field-rotation-note"
          icon={<Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}
          className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300"
        >
          <span className="font-bold text-indigo-200">Perché il campo ruota su una montatura altazimutale</span>
          <p className="mt-1 leading-relaxed">
            Una montatura <strong className="text-rose-300">altazimutale</strong> muove il telescopio su e giù e
            destra-sinistra: riesce benissimo a tenere l'oggetto centrato, ma non a mantenerne l'orientamento,
            perché il cielo ruota attorno al polo celeste e non attorno allo zenit. L'angolo tra la verticale locale
            e la direzione del polo — l'<strong className="text-slate-100">angolo parallattico</strong> — cambia di
            continuo, e con esso ruota l'immagine nel sensore. Una montatura{' '}
            <strong className="text-emerald-300">equatoriale</strong> ha invece un asse già allineato al polo
            celeste: ruotandolo alla velocità siderale riproduce esattamente il moto del cielo, orientamento
            compreso, e il campo resta fermo. La rotazione è tanto più rapida quanto più l'oggetto passa vicino allo{' '}
            <strong className="text-slate-100">zenit</strong>: alle latitudini italiane M31 culmina quasi allo zenit,
            ed è per questo che la rotazione qui è così violenta. Per il visuale è irrilevante (l'occhio non
            integra), ma in fotografia a lunga posa trasforma le stelle in archi. Le alternative sono un{' '}
            <strong className="text-slate-100">derotatore di campo</strong> motorizzato, oppure moltissime pose
            brevi ruotate e riallineate in fase di elaborazione — al prezzo di perdere i bordi dell'inquadratura.
          </p>
        </DismissibleInfoPanel>
      </div>
    </div>
  );
};
