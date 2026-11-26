import React, { useState, useMemo, useEffect, useRef } from 'react';
import { UserLocation, SaturnYearData } from '../types';
import { useAstroWorkerData } from '../hooks/useAstroWorkerData';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Sparkles, Compass, Award, Sliders, Info, Eye, Loader2 } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';

interface TabSaturnRingsProps {
  location: UserLocation;
}

export const TabSaturnRings: React.FC<TabSaturnRingsProps> = ({ location }) => {
  const { data, isLoading } = useAstroWorkerData<SaturnYearData[]>('saturn100', location);
  const saturn20Years = data ?? [];

  // Selected year data for Saturn detail
  const [selectedYear, setSelectedYear] = useState<number>(2032); // 2032 is near max ring opening!
  const [interactiveTilt, setInteractiveTilt] = useState<number>(22);

  const selectedData = useMemo(() => {
    return saturn20Years.find((d) => d.year === selectedYear) || saturn20Years[0];
  }, [saturn20Years, selectedYear]);

  // Sync slider tilt with selected year's calculated ring tilt
  useEffect(() => {
    if (selectedData) {
      setInteractiveTilt(selectedData.ringTiltDeg);
    }
  }, [selectedData]);

  // Rank years by composite score to find "Golden Years"
  const rankedGoldenYears = useMemo(() => {
    return [...saturn20Years].sort((a, b) => b.score - a.score);
  }, [saturn20Years]);

  // Canvas Ref for rendering 2D Saturn with exact ring tilt
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const globeRadius = 38;

    // Convert tilt degrees to radians and scale ring ellipse vertical radius
    const tiltRad = (interactiveTilt * Math.PI) / 180;
    const ringMajorX = 95;
    const ringMinorY = Math.max(3, Math.abs(Math.sin(tiltRad)) * ringMajorX);

    const isSouthernTilt = interactiveTilt < 0;

    // Helper to draw Saturn globe
    const drawSaturnGlobe = () => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);

      // Saturn atmospheric bands gradient
      const grad = ctx.createLinearGradient(centerX, centerY - globeRadius, centerX, centerY + globeRadius);
      grad.addColorStop(0, '#a8926a'); // Polar haze
      grad.addColorStop(0.2, '#ece2c8'); // Bright pale band
      grad.addColorStop(0.4, '#cdb98e'); // Belt
      grad.addColorStop(0.7, '#b49e72'); // Equator
      grad.addColorStop(1, '#5e5039'); // Dark polar region
      ctx.fillStyle = grad;
      ctx.fill();

      // Shadow overlay for 3D realism
      const shadowGrad = ctx.createRadialGradient(
        centerX - globeRadius * 0.3,
        centerY - globeRadius * 0.3,
        globeRadius * 0.2,
        centerX,
        centerY,
        globeRadius
      );
      shadowGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
      shadowGrad.addColorStop(0.8, 'rgba(0,0,0,0.4)');
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = shadowGrad;
      ctx.fill();

      ctx.restore();
    };

    // Helper to draw Saturn ring system
    const drawRings = (isBackHalf: boolean) => {
      ctx.save();
      ctx.beginPath();

      // Back half vs Front half clipping
      if (isBackHalf) {
        if (isSouthernTilt) {
          ctx.rect(0, 0, width, centerY); // top half is back when tilt < 0
        } else {
          ctx.rect(0, 0, width, centerY); // top half is back when tilt > 0
        }
      } else {
        if (isSouthernTilt) {
          ctx.rect(0, centerY, width, height); // bottom half is front
        } else {
          ctx.rect(0, centerY, width, height); // bottom half is front
        }
      }
      ctx.clip();

      // Outer Ring A
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ringMajorX, ringMinorY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(214, 200, 166, 0.7)';
      ctx.lineWidth = 10;
      ctx.stroke();

      // Cassini Division (Dark gap)
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ringMajorX - 8, ringMinorY * 0.9, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(23,23,23, 0.95)'; // Slate 900 gap
      ctx.lineWidth = 3;
      ctx.stroke();

      // Main Ring B (Brightest)
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ringMajorX - 16, ringMinorY * 0.82, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(236, 226, 200, 0.95)'; // Ring B, the brightest
      ctx.lineWidth = 14;
      ctx.stroke();

      // Inner Crepe Ring C (Faint)
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ringMajorX - 28, ringMinorY * 0.7, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150, 132, 98, 0.4)';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.restore();
    };

    // Render sequence depending on tilt angle
    if (isSouthernTilt) {
      drawRings(true); // Back rings
      drawSaturnGlobe(); // Globe in front
      drawRings(false); // Front rings
    } else {
      drawRings(true); // Back rings
      drawSaturnGlobe(); // Globe
      drawRings(false); // Front rings
    }
  }, [interactiveTilt]);

  return (
    <div className="space-y-10">
      {/* Header Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Effemeridi</div>
          <h2 className="page-title">Inclinazione degli anelli di Saturno</h2>
          <p className="lead">
            Nel 2025 gli anelli di Saturno si sono trovati quasi perfettamente di taglio (0°). Nei prossimi anni (2026 - 2035) gli anelli si riapriranno gradualmente fino a raggiungere un'inclinazione spettacolare di quasi 27°!
          </p>
        </div>
      </div>

      {/* Interactive 2D Saturn Ring Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
        <div className="lg:col-span-6 flex flex-col items-center justify-center bg-neutral-950 border border-neutral-800 rounded-lg p-6 relative min-h-[300px]">
          <div className="text-xs font-semibold text-neutral-200 mb-2 flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            Inclinazione degli anelli (Inclinazione: {interactiveTilt.toFixed(1)}°)
          </div>

          <canvas
            ref={canvasRef}
            width={340}
            height={220}
            className="my-2 drop-shadow-[0_0_20px_rgba(234,179,8,0.2)]"
          />

          {/* Interactive Controls for Year & Tilt */}
          <div className="w-full max-w-sm mt-4 space-y-3 bg-neutral-950 p-3 rounded-md border border-neutral-800">
            {/* Year-by-Year Selector Slider */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span className="text-neutral-400">Anno simulato:</span>
                <span className="text-neutral-100 text-sm font-semibold">Anno {selectedYear}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedYear(Math.max(2026, selectedYear - 1))}
                  disabled={selectedYear <= 2026}
                  className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 text-xs font-semibold disabled:opacity-30"
                >
                  -1 Anno
                </button>
                <input
                  type="range"
                  min={2026}
                  max={2125}
                  step={1}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="w-full cursor-pointer"
                />
                <button
                  onClick={() => setSelectedYear(Math.min(2125, selectedYear + 1))}
                  disabled={selectedYear >= 2125}
                  className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 text-xs font-semibold disabled:opacity-30"
                >
                  +1 Anno
                </button>
              </div>
            </div>

            {/* Manual Tilt Fine-tuning */}
            <div>
              <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                <span>Di taglio (0°)</span>
                <span className="font-semibold text-neutral-100">Inclinazione: {interactiveTilt.toFixed(1)}°</span>
                <span>Apertura Max (27°)</span>
              </div>
              <input
                type="range"
                min={-27}
                max={27}
                step={0.5}
                value={interactiveTilt}
                onChange={(e) => setInteractiveTilt(parseFloat(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Selected Year Info & Analysis */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          {isLoading || !selectedData ? (
            <div className="flex items-center justify-center gap-3 text-sm text-neutral-300 py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-200" />
              Calcolo di 100 anni di dati su Saturno in corso...
            </div>
          ) : (
          <>
          <div>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
                Saturno nel {selectedYear}
              </h3>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-700 text-xs font-semibold text-neutral-100 rounded-lg px-2.5 py-1 focus:outline-none max-w-[140px]"
              >
                {saturn20Years.map((d) => (
                  <option key={d.year} value={d.year}>
                    Anno {d.year}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="bg-neutral-950 p-3 rounded-md border border-neutral-800">
                <div className="text-[10px] text-neutral-400">Inclinazione Anelli</div>
                <div className="text-lg font-medium text-neutral-200">{selectedData.ringTiltDeg}°</div>
              </div>
              <div className="bg-neutral-950 p-3 rounded-md border border-neutral-800">
                <div className="text-[10px] text-neutral-400">Altezza Max (GPS)</div>
                <div className="text-lg font-medium text-neutral-200">{selectedData.maxAltitude}°</div>
              </div>
              <div className="bg-neutral-950 p-3 rounded-md border border-neutral-800">
                <div className="text-[10px] text-neutral-400">Punteggio Anno</div>
                <div className="text-lg font-medium text-neutral-200">{selectedData.score}/100</div>
              </div>
            </div>

            <div className="mt-4 bg-neutral-900/40 border border-neutral-700 rounded-md p-4 text-xs text-neutral-200 leading-relaxed">
              <span className="font-semibold text-neutral-100 block mb-1">Consigli di Osservazione per {selectedYear}:</span>
              {selectedData.recommendation}
            </div>
          </div>

          <DismissibleInfoPanel
            id="saturn-ring-brightness-note"
            icon={<Info className="w-4 h-4 text-neutral-200 shrink-0" />}
            className="bg-neutral-950 border border-neutral-800 rounded-md p-3 text-[11px] text-neutral-400 flex items-center gap-2"
          >
            L'apertura degli anelli aumenta notevolmente la luminosità complessiva del pianeta da magnitudine +0.9 (di taglio) fino a -0.55 (apertura massima).
          </DismissibleInfoPanel>
          </>
          )}
        </div>
      </div>

      {/* 100-Year Chart: Ring Tilt Angle vs Culmination Height */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
              Inclinazione degli anelli e altezza massima a {location.name} (100 Anni: 2026 - 2125)
            </h3>
            <p className="text-xs text-neutral-400">
              Monitoraggio dell'inclinazione degli anelli e dell'altezza sopra l'orizzonte
            </p>
          </div>
          <span className="text-xs text-neutral-100 bg-neutral-900/50 border border-neutral-700 px-3 py-1 rounded-lg flex items-center gap-1.5 self-start sm:self-auto">
            Scorri o trascina per esplorare 100 anni
          </span>
        </div>

        <div className="overflow-x-auto scrollbar-thin touch-pan-x border border-neutral-800 rounded-md p-2 bg-neutral-950">
          <div className="h-64 sm:h-72 min-w-[2200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={saturn20Years} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#222222" vertical={false} />
                <XAxis dataKey="year" stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} interval={1} />
                <YAxis stroke="#404040" tick={{ fill: "#8a8a8a" }} fontSize={11} domain={[0, 90]} unit="°" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as SaturnYearData;
                      return (
                        <div className="bg-neutral-950 border border-neutral-700 p-3 rounded-md text-xs space-y-1">
                          <div className="font-semibold text-neutral-200">Saturno Anno {d.year}</div>
                          <div>Inclinazione Anelli: <span className="font-semibold text-neutral-100">{d.ringTiltDeg}°</span></div>
                          <div>Altezza Max da GPS: <span className="font-semibold text-neutral-100">{d.maxAltitude}°</span></div>
                          <div>Punteggio Complessivo: <span className="font-semibold text-neutral-200">{d.score} / 100</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="ringTiltAbs"
                  name="Inclinazione Anelli |B| (°)"
                  stroke="#b89a6a"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="maxAltitude"
                  name="Altezza Culmine (°)"
                  stroke="#a3a3a3"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Golden Years Ranking Table */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-neutral-200" />
          <div>
            <h3 className="text-base font-semibold text-neutral-100">
              Classifica degli anni migliori per Saturno (2026–2125)
            </h3>
            <p className="text-xs text-neutral-400">
              Classificazione combinata basata su apertura degli anelli + altezza dal meridiano + magnitudine
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase text-[10px]">
                <th className="py-3 px-3">Pos.</th>
                <th className="py-3 px-3">Anno</th>
                <th className="py-3 px-3">Inclinazione Anelli</th>
                <th className="py-3 px-3">Altezza Max GPS</th>
                <th className="py-3 px-3">Mag. Apparente</th>
                <th className="py-3 px-3">Punteggio</th>
                <th className="py-3 px-3">Valutazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {rankedGoldenYears.slice(0, 10).map((row, idx) => (
                <tr
                  key={row.year}
                  onClick={() => setSelectedYear(row.year)}
                  className={`hover:bg-neutral-800/50 cursor-pointer transition ${
                    row.year === selectedYear ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <td className="py-3 px-3 font-semibold text-neutral-200">#{idx + 1}</td>
                  <td className="py-3 px-3 font-semibold text-neutral-100">Anno {row.year}</td>
                  <td className="py-3 px-3 text-neutral-300 font-medium">{row.ringTiltDeg}°</td>
                  <td className="py-3 px-3 text-neutral-100 font-medium">{row.maxAltitude}°</td>
                  <td className="py-3 px-3 text-neutral-300">{row.magnitude}</td>
                  <td className="py-3 px-3 font-medium text-neutral-200">{row.score} / 100</td>
                  <td className="py-3 px-3 text-neutral-300 max-w-xs truncate">{row.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
