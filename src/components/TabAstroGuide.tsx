import React, { useState } from 'react';
import { UserLocation } from '../types';
import { Sliders, Eye, BookOpen, Telescope, Camera, Aperture, Timer, Crosshair, Info } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';
import { CameraSelect } from './CameraSelect';
import { ApexIcon } from './ApexIcon';

interface TabAstroGuideProps {
  location: UserLocation;
  selectedYear: number;
  section: 'visual' | 'imaging';
}

interface CameraPreset {
  label: string;
  pixelPitch: number;
}

const ASTRO_CAMERAS: CameraPreset[] = [
  { label: 'ZWO ASI 6200', pixelPitch: 3.76 },
  { label: 'ZWO ASI 2600', pixelPitch: 3.76 },
  { label: 'ZWO ASI 2400', pixelPitch: 5.94 },
  { label: 'ZWO ASI 128', pixelPitch: 5.97 },
  { label: 'ZWO ASI 094', pixelPitch: 4.88 },
  { label: 'ZWO ASI 071', pixelPitch: 4.78 },
  { label: 'ZWO ASI 1600', pixelPitch: 3.8 },
  { label: 'ZWO ASI 294', pixelPitch: 4.63 },
  { label: 'ZWO ASI 533', pixelPitch: 3.76 },
  { label: 'ZWO ASI 183', pixelPitch: 2.4 },
  { label: 'ZWO ASI 174', pixelPitch: 5.86 },
  { label: 'ZWO ASI 178', pixelPitch: 2.4 },
  { label: 'ZWO ASI 385', pixelPitch: 3.75 },
  { label: 'ZWO ASI 290', pixelPitch: 2.9 },
  { label: 'ZWO ASI 224', pixelPitch: 3.75 },
  { label: 'ZWO ASI 120', pixelPitch: 3.75 },
  { label: 'ZWO ASI 120 mini', pixelPitch: 3.75 },
  { label: 'ZWO ASI 034', pixelPitch: 5.6 },
  { label: 'ZWO ASI 462', pixelPitch: 2.9 },
  { label: 'QHYCCD 600M/C', pixelPitch: 3.76 },
  { label: 'QHYCCD 294 Pro', pixelPitch: 4.63 },
  { label: 'QHYCCD 410C', pixelPitch: 5.94 },
  { label: 'QHYCCD 268C', pixelPitch: 3.76 },
  { label: 'QHYCCD 367C Pro', pixelPitch: 4.88 },
  { label: 'QHYCCD 183M/C', pixelPitch: 2.4 },
  { label: 'QHYCCD 163M/C', pixelPitch: 3.8 },
  { label: 'QHYCCD 128C', pixelPitch: 5.97 },
  { label: 'QHYCCD 247C', pixelPitch: 3.91 },
  { label: 'QHYCCD 168C', pixelPitch: 4.78 },
  { label: 'QHYCCD 550M/C/P', pixelPitch: 3.45 },
  { label: 'QHYCCD 174/GPS', pixelPitch: 5.86 },
  { label: 'QHYCCD 178M/C', pixelPitch: 2.4 },
  { label: 'QHYCCD 290M/C', pixelPitch: 2.9 },
  { label: 'QHYCCD 224C', pixelPitch: 3.75 },
  { label: 'QHY16200A Serie', pixelPitch: 6 },
  { label: 'QHY695A Serie', pixelPitch: 4.54 },
  { label: 'QHY90A Serie', pixelPitch: 5.4 },
  { label: 'QHY16803A Serie', pixelPitch: 9 },
  { label: 'QHY09000A Serie', pixelPitch: 12 },
  { label: 'QHY814A Serie', pixelPitch: 3.69 },
  { label: 'QHY9', pixelPitch: 5.4 },
  { label: 'QHY11', pixelPitch: 9 },
  { label: 'IMG2PRO', pixelPitch: 6.45 },
  { label: 'QHY21/22 (ICX674/694)', pixelPitch: 4.54 },
  { label: 'QHY23 (ICX814)', pixelPitch: 3.69 },
  { label: 'QHY27/29', pixelPitch: 5.5 },
  { label: 'QHY28', pixelPitch: 7.4 },
  { label: 'QHY5III178', pixelPitch: 2.4 },
  { label: 'QHY5III224', pixelPitch: 3.75 },
  { label: 'QHY5III290', pixelPitch: 2.9 },
  { label: 'QHY5P-II', pixelPitch: 2.2 },
  { label: 'QHY5L-II', pixelPitch: 3.75 },
  { label: 'Player One Mars-M/C', pixelPitch: 2.9 },
  { label: 'Player One Uranus-C', pixelPitch: 2.9 },
  { label: 'Player One Neptune-M', pixelPitch: 2.9 },
  { label: 'Player One Poseidon-M Pro', pixelPitch: 3.76 },
  { label: 'Player One Apollo-M', pixelPitch: 5.86 },
  { label: 'Altair Hypercam 183M/C', pixelPitch: 2.4 },
  { label: 'Altair Hypercam 585C', pixelPitch: 2.9 },
  { label: 'SBIG STF-8300', pixelPitch: 5.4 },
  { label: 'SBIG STT-8300', pixelPitch: 5.4 },
  { label: 'SBIG STF-3200', pixelPitch: 6.8 },
  { label: 'SBIG STX-16803', pixelPitch: 9 },
  { label: 'Canon EOS Ra', pixelPitch: 5.36 },
  { label: 'Canon EOS 6D Mark II', pixelPitch: 5.7 },
  { label: 'Nikon Z6', pixelPitch: 5.94 },
  { label: 'Sony A7 III', pixelPitch: 5.94 },
];

interface SeeingTier {
  label: string;
  fwhmMin: number;
  fwhmMax: number;
}

const SEEING_TIERS: SeeingTier[] = [
  { label: 'Ottimo (FWHM 0,5" - 1")', fwhmMin: 0.5, fwhmMax: 1 },
  { label: 'Buono (FWHM 1" - 2")', fwhmMin: 1, fwhmMax: 2 },
  { label: 'Medio (FWHM 2" - 4")', fwhmMin: 2, fwhmMax: 4 },
  { label: 'Scarso (FWHM 4" - 5")', fwhmMin: 4, fwhmMax: 5 },
  { label: 'Pessimo (FWHM 5" - 6")', fwhmMin: 5, fwhmMax: 6 },
];

const REDUCER_OPTIONS = [1, 0.85, 0.8, 0.73, 0.72, 0.7, 0.67, 0.63, 0.5, 0.4, 0.33];
const VISUAL_BARLOW_OPTIONS = [1, 1.15, 1.5, 1.6, 2.0, 2.25, 2.5, 2.75, 3.0, 4.0, 5.0];
const PLANETARY_BARLOW_OPTIONS = [1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 4.0, 5.0];

const WAVELENGTH_PRESETS = [
  { label: 'Verde (510 nm)', nm: 510 },
  { label: 'Rosso (650 nm)', nm: 650 },
  { label: 'Blu (475 nm)', nm: 475 },
  { label: 'H-Alpha (656,3 nm)', nm: 656.281 },
];

const selectClass =
  'bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none w-full';
const numberInputClass =
  'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none';

function getSamplingBadgeClass(rating: 'Sottocampionato' | 'Ottimale' | 'Sovracampionato'): string {
  switch (rating) {
    case 'Ottimale':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Sottocampionato':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    default:
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  }
}

function classifySampling(scale: number, rangeMin: number, rangeMax: number): 'Sottocampionato' | 'Ottimale' | 'Sovracampionato' {
  if (scale < rangeMin) return 'Sovracampionato';
  if (scale <= rangeMax) return 'Ottimale';
  return 'Sottocampionato';
}

export const TabAstroGuide: React.FC<TabAstroGuideProps> = ({ section }) => {
  // Calcolatore Ottiche & Ingrandimenti (F-ratio, magnification, exit pupil,
  // Dawes resolving power, true FOV, limiting magnitude)
  const [opticsFocalLength, setOpticsFocalLength] = useState<number>(1000);
  const [opticsAperture, setOpticsAperture] = useState<number>(200);
  const [opticsEyepieceFocal, setOpticsEyepieceFocal] = useState<number>(10);
  const [opticsAfov, setOpticsAfov] = useState<number>(50);
  const [opticsReducer, setOpticsReducer] = useState<number>(1);
  const [opticsBarlow, setOpticsBarlow] = useState<number>(1);

  const effectiveFocalLength = opticsFocalLength * opticsReducer * opticsBarlow;
  const focalRatio = Number((effectiveFocalLength / Math.max(1, opticsAperture)).toFixed(2));
  const magnification = Math.round(effectiveFocalLength / Math.max(1, opticsEyepieceFocal));
  const exitPupil = Number((opticsAperture / Math.max(1, magnification)).toFixed(2));
  const maxUsefulMag = Math.round(opticsAperture * 2);
  const dawesLimit = Number((115.8 / Math.max(1, opticsAperture)).toFixed(2));
  const trueFovDeg = magnification > 0 ? Number((opticsAfov / magnification).toFixed(2)) : 0;
  const limitingMagnitude = Number((2 + 5 * Math.log10(Math.max(1, opticsAperture))).toFixed(1));

  // Risoluzione Angolare (Rayleigh, dipendente dalla lunghezza d'onda)
  const [rayleighAperture, setRayleighAperture] = useState<number>(200);
  const [rayleighWavelength, setRayleighWavelength] = useState<number>(510);

  const rayleighRad = (1.22 * (rayleighWavelength * 1e-9)) / (Math.max(1, rayleighAperture) * 1e-3);
  const rayleighArcsec = Number((rayleighRad * (180 / Math.PI) * 3600).toFixed(3));

  // Campo Reale Oculare (standalone)
  const [fovFocalLength, setFovFocalLength] = useState<number>(1000);
  const [fovEyepieceFocal, setFovEyepieceFocal] = useState<number>(10);
  const [fovAfov, setFovAfov] = useState<number>(50);

  const fovMagnification = fovFocalLength / Math.max(1, fovEyepieceFocal);
  const fovTrueFov = fovMagnification > 0 ? Number((fovAfov / fovMagnification).toFixed(2)) : 0;

  // Campionamento Deep Sky
  const [deepFocalLength, setDeepFocalLength] = useState<number>(1000);
  const [deepBinning, setDeepBinning] = useState<number>(1);
  const [deepPixelPitch, setDeepPixelPitch] = useState<number>(3.76);
  const [deepCameraIndex, setDeepCameraIndex] = useState<number>(-1);
  const [deepSeeingIndex, setDeepSeeingIndex] = useState<number>(2);

  const deepEffectivePixel = deepCameraIndex >= 0 ? ASTRO_CAMERAS[deepCameraIndex].pixelPitch : deepPixelPitch;
  const deepScale = Number(((deepEffectivePixel / Math.max(1, deepFocalLength)) * 206.265 * deepBinning).toFixed(2));
  const deepSeeing = SEEING_TIERS[deepSeeingIndex];
  const deepRangeMin = Number((deepSeeing.fwhmMin / 3).toFixed(2));
  const deepRangeMax = Number((deepSeeing.fwhmMax / 2).toFixed(2));
  const deepRating = classifySampling(deepScale, deepRangeMin, deepRangeMax);

  const [guideFocalLength, setGuideFocalLength] = useState<number>(400);
  const [guideBinning, setGuideBinning] = useState<number>(1);
  const [guidePixelPitch, setGuidePixelPitch] = useState<number>(3.75);
  const [guideCameraIndex, setGuideCameraIndex] = useState<number>(-1);

  const guideEffectivePixel = guideCameraIndex >= 0 ? ASTRO_CAMERAS[guideCameraIndex].pixelPitch : guidePixelPitch;
  const guideScale = Number(((guideEffectivePixel / Math.max(1, guideFocalLength)) * 206.265 * guideBinning).toFixed(2));
  const guideRatioRaw = guideScale / Math.max(0.01, deepScale);
  const guideComparisonText =
    guideRatioRaw >= 1
      ? `Il campionamento del tuo sistema di imaging è ${guideRatioRaw.toFixed(2)}x inferiore (più fine) di quello di guida.`
      : `Il campionamento del tuo sistema di imaging è ${(1 / guideRatioRaw).toFixed(2)}x superiore (più grossolano) di quello di guida.`;

  // Campionamento Imaging Planetario
  const [planWavelength, setPlanWavelength] = useState<number>(550);
  const [planAperture, setPlanAperture] = useState<number>(200);
  const [planPixelSize, setPlanPixelSize] = useState<number>(3.75);
  const [planNativeFocalLength, setPlanNativeFocalLength] = useState<number>(1000);
  const [planBarlow, setPlanBarlow] = useState<number>(PLANETARY_BARLOW_OPTIONS[1]);

  const planIdealFocalLength = Math.round(
    ((planAperture * planPixelSize) / (1.22 * planWavelength)) * 3000
  );
  const planIdealFocalRatio = Number((planIdealFocalLength / Math.max(1, planAperture)).toFixed(1));
  const planBarlowResultFocalLength = Math.round(planNativeFocalLength * planBarlow);

  // Esposizione via Regola NPF
  const [npfFocalLength, setNpfFocalLength] = useState<number>(24);
  const [npfFNumber, setNpfFNumber] = useState<number>(2.8);
  const [npfPixelPitch, setNpfPixelPitch] = useState<number>(3.76);
  const [npfSensorWidth, setNpfSensorWidth] = useState<number>(35.9);
  const [npfImageWidthPx, setNpfImageWidthPx] = useState<number>(8256);

  const npfExposure = Number(((35 * npfFNumber + 30 * npfPixelPitch) / Math.max(1, npfFocalLength)).toFixed(2));
  const npfHelperPixelPitch = Number(((npfSensorWidth / Math.max(1, npfImageWidthPx)) * 1000).toFixed(2));

  return (
    <div className="space-y-8 text-slate-100">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-1/2 -translate-y-1/2 right-0 p-2 opacity-10 pointer-events-none">
          <ApexIcon className="w-32 h-32" />
        </div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
            <BookOpen className="w-4 h-4" />
            Guide e utility per la Strumentazione
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-100 sm:text-3xl">
            Calcolatore Telescopio & Guida Varie
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Ottimizza le tue sessioni osservative con questi strumenti di calcolo per osservazione e fotografie.
          </p>
        </div>
      </div>

      {section === 'visual' && (
      <>
      {/* Section: Visual Observation Tools */}
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
          Strumenti di Osservazione Visuale
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Combined Optics & Magnification Calculator */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              Calcolatore Ottiche & Ingrandimenti
            </h3>
          </div>

          <DismissibleInfoPanel
            id="guide-optics-calculator-note"
            icon={<Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed"
          >
            Riassume tutti i parametri ottici della coppia telescopio + oculare (con riduttore o Barlow opzionali).
            <strong className="text-slate-300"> Rapporto Focale</strong>: più basso vuol dire immagini più luminose ma
            minor ingrandimento. <strong className="text-slate-300">Pupilla d'Uscita</strong>: oltre 6-7 mm supera la
            pupilla dilatata dell'occhio (luce sprecata), sotto 0,5 mm l'immagine diventa scura.{' '}
            <strong className="text-slate-300">Max Utile Teorico</strong>: oltre questo ingrandimento l'immagine si
            sfoca senza mostrare più dettagli. <strong className="text-slate-300">Potere Risolutivo</strong> (Limite
            di Dawes): minima separazione angolare tra due stelle doppie che riesci a distinguere.{' '}
            <strong className="text-slate-300">Campo Reale</strong>: quanto cielo inquadri nell'oculare.
          </DismissibleInfoPanel>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Lunghezza Focale Telescopio: <strong className="text-amber-400">{opticsFocalLength} mm</strong></span>
              </div>
              <input
                type="range"
                min={400}
                max={3000}
                step={50}
                value={opticsFocalLength}
                onChange={(e) => setOpticsFocalLength(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Apertura (Diametro Obiettivo): <strong className="text-cyan-400">{opticsAperture} mm</strong></span>
              </div>
              <input
                type="range"
                min={60}
                max={500}
                step={10}
                value={opticsAperture}
                onChange={(e) => setOpticsAperture(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Focale dell'Oculare: <strong className="text-indigo-300">{opticsEyepieceFocal} mm</strong></span>
              </div>
              <input
                type="range"
                min={2.5}
                max={40}
                step={0.5}
                value={opticsEyepieceFocal}
                onChange={(e) => setOpticsEyepieceFocal(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Campo Apparente Oculare: <strong className="text-indigo-300">{opticsAfov}°</strong></span>
              </div>
              <input
                type="range"
                min={40}
                max={100}
                step={1}
                value={opticsAfov}
                onChange={(e) => setOpticsAfov(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-300 mb-1">Riduttore di Focale</div>
                <select value={opticsReducer} onChange={(e) => setOpticsReducer(Number(e.target.value))} className={selectClass}>
                  {REDUCER_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 1 ? 'Nessun riduttore' : `Riduttore ${r}x`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-slate-300 mb-1">Lente di Barlow</div>
                <select value={opticsBarlow} onChange={(e) => setOpticsBarlow(Number(e.target.value))} className={selectClass}>
                  {VISUAL_BARLOW_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b === 1 ? 'Nessuna Barlow' : `Barlow ${b}x`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div>
              <div className="text-[10px] text-slate-400">Rapporto Focale</div>
              <div className="text-lg font-black text-amber-400">f/{focalRatio}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Ingrandimento</div>
              <div className="text-lg font-black text-amber-400">{magnification}x</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Pupilla Uscita</div>
              <div className="text-lg font-black text-cyan-300">{exitPupil} mm</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Max Utile Teorico</div>
              <div className="text-lg font-black text-indigo-300">{maxUsefulMag}x</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Potere Risolutivo</div>
              <div className="text-lg font-black text-cyan-300">{dawesLimit}"</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Campo Reale</div>
              <div className="text-lg font-black text-indigo-300">{trueFovDeg}°</div>
            </div>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-xs text-slate-300">
            Magnitudine stellare limite osservabile: <strong className="text-emerald-400">{limitingMagnitude} m</strong>
          </div>
        </div>

        {/* Angular Resolution (Rayleigh) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Aperture className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">
              Risoluzione Angolare
            </h3>
          </div>

          <DismissibleInfoPanel
            id="guide-rayleigh-calculator-note"
            icon={<Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed"
          >
            Calcola, con il criterio di Rayleigh (1.22 λ/D), la minima separazione angolare tra due dettagli (o due
            stelle doppie) che il tuo telescopio può teoricamente distinguere a una data lunghezza d'onda. Valori più
            bassi indicano maggior potere risolutivo; a parità di apertura il rosso si risolve peggio del blu.
          </DismissibleInfoPanel>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Diametro / Apertura: <strong className="text-cyan-400">{rayleighAperture} mm</strong></span>
            </div>
            <input
              type="range"
              min={60}
              max={500}
              step={10}
              value={rayleighAperture}
              onChange={(e) => setRayleighAperture(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-300 mb-1">Lunghezza d'Onda</div>
              <select
                value={rayleighWavelength}
                onChange={(e) => setRayleighWavelength(Number(e.target.value))}
                className={selectClass}
              >
                {WAVELENGTH_PRESETS.map((w) => (
                  <option key={w.label} value={w.nm}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-300 mb-1">Personalizzata (nm)</div>
              <input
                type="number"
                value={rayleighWavelength}
                onChange={(e) => setRayleighWavelength(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400">Risoluzione Angolare</div>
            <div className="text-2xl font-black text-cyan-300">{rayleighArcsec}"</div>
          </div>
        </div>

        {/* True Field of View (standalone) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Telescope className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">
              Campo Reale Oculare
            </h3>
          </div>

          <DismissibleInfoPanel
            id="guide-true-fov-calculator-note"
            icon={<Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed"
          >
            Calcola quanta porzione di cielo (in gradi) inquadri realmente con un dato oculare sul tuo telescopio,
            utile per capire se un oggetto esteso (ammasso, nebulosa, galassia) entrerà per intero nel campo visivo.
          </DismissibleInfoPanel>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Focale Telescopio: <strong className="text-amber-400">{fovFocalLength} mm</strong></span>
            </div>
            <input
              type="range"
              min={400}
              max={3000}
              step={50}
              value={fovFocalLength}
              onChange={(e) => setFovFocalLength(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Focale Oculare: <strong className="text-indigo-300">{fovEyepieceFocal} mm</strong></span>
            </div>
            <input
              type="range"
              min={2.5}
              max={40}
              step={0.5}
              value={fovEyepieceFocal}
              onChange={(e) => setFovEyepieceFocal(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Campo Apparente Oculare: <strong className="text-indigo-300">{fovAfov}°</strong></span>
            </div>
            <input
              type="range"
              min={40}
              max={100}
              step={1}
              value={fovAfov}
              onChange={(e) => setFovAfov(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div>
              <div className="text-[10px] text-slate-400">Ingrandimento</div>
              <div className="text-xl font-black text-amber-400">{Math.round(fovMagnification)}x</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Campo Reale</div>
              <div className="text-xl font-black text-indigo-300">{fovTrueFov}°</div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {section === 'imaging' && (
      <>
      {/* Section: Deep Sky and Planetary Imaging Tools */}
      <div className="flex items-center gap-2 pt-2">
        <Camera className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
          Strumenti per Fotografia Deep e Riprese Planetarie
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Deep Sky Sampling */}
        <div className="lg:col-span-12 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Camera className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-slate-100">
              Campionamento Deep Sky
            </h3>
          </div>

          <DismissibleInfoPanel
            id="guide-deep-sky-sampling-note"
            icon={<Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed"
          >
            Calcola la scala immagine del tuo sistema di ripresa (secondi d'arco per pixel) e la confronta con il
            seeing tipico del tuo cielo: <strong className="text-amber-400">Sottocampionato</strong> significa
            immagine sfocata/pixelosa con dettaglio perso; <strong className="text-rose-400">Sovracampionato</strong>{' '}
            significa rumore inutile e guida più critica senza vantaggi reali; <strong className="text-emerald-400">
            Ottimale</strong> è il range consigliato per il tuo seeing. A destra trovi lo stesso calcolo per il
            sistema di guida, per verificare che la sua risoluzione sia adeguata rispetto all'imaging principale.
          </DismissibleInfoPanel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Imaging setup */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Sistema di Ripresa</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Focale (mm)</div>
                  <input
                    type="number"
                    value={deepFocalLength}
                    onChange={(e) => setDeepFocalLength(Number(e.target.value))}
                    className={numberInputClass}
                  />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Binning</div>
                  <select value={deepBinning} onChange={(e) => setDeepBinning(Number(e.target.value))} className={selectClass}>
                    {[1, 2, 3, 4].map((b) => (
                      <option key={b} value={b}>{b}x{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">Pixel Pitch Manuale (µm)</div>
                <input
                  type="number"
                  step="0.01"
                  value={deepPixelPitch}
                  onChange={(e) => setDeepPixelPitch(Number(e.target.value))}
                  disabled={deepCameraIndex >= 0}
                  className={`${numberInputClass} disabled:opacity-40`}
                />
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">Oppure Scegli una Camera (ha priorità)</div>
                <CameraSelect cameras={ASTRO_CAMERAS} value={deepCameraIndex} onChange={setDeepCameraIndex} />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400">Scala Immagine (ignora il seeing)</div>
                <div className="text-xl font-black text-amber-400">{deepScale}"/px</div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">Seleziona il tuo Seeing</div>
                <select
                  value={deepSeeingIndex}
                  onChange={(e) => setDeepSeeingIndex(Number(e.target.value))}
                  className={selectClass}
                >
                  {SEEING_TIERS.map((s, idx) => (
                    <option key={s.label} value={idx}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400">Range Suggerito</div>
                  <div className="font-bold text-slate-200">{deepRangeMin}" - {deepRangeMax}"/px</div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSamplingBadgeClass(deepRating)}`}>
                  {deepRating}
                </span>
              </div>
            </div>

            {/* Guide system comparison */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Sistema di Guida (confronto)</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Focale Guida (mm)</div>
                  <input
                    type="number"
                    value={guideFocalLength}
                    onChange={(e) => setGuideFocalLength(Number(e.target.value))}
                    className={numberInputClass}
                  />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Binning Guida</div>
                  <select value={guideBinning} onChange={(e) => setGuideBinning(Number(e.target.value))} className={selectClass}>
                    {[1, 2, 3, 4].map((b) => (
                      <option key={b} value={b}>{b}x{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">Pixel Pitch Manuale Guida (µm)</div>
                <input
                  type="number"
                  step="0.01"
                  value={guidePixelPitch}
                  onChange={(e) => setGuidePixelPitch(Number(e.target.value))}
                  disabled={guideCameraIndex >= 0}
                  className={`${numberInputClass} disabled:opacity-40`}
                />
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1">Oppure Scegli una Camera di Guida</div>
                <CameraSelect cameras={ASTRO_CAMERAS} value={guideCameraIndex} onChange={setGuideCameraIndex} />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400">Scala Immagine Guida</div>
                <div className="text-xl font-black text-cyan-300">{guideScale}"/px</div>
              </div>

              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 text-xs text-slate-200 leading-relaxed">
                {guideComparisonText}
              </div>
            </div>
          </div>
        </div>

        {/* Planetary Sampling */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Crosshair className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">
              Campionamento Imaging Planetario
            </h3>
          </div>

          <DismissibleInfoPanel
            id="guide-planetary-sampling-note"
            icon={<Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed"
          >
            Calcola la lunghezza focale e il rapporto focale ideali per sfruttare al meglio il potere risolutivo del
            telescopio nelle riprese planetarie, dove si lavora molto più ingranditi rispetto al deep sky. Più in
            basso trovi un calcolatore per stimare la focale risultante aggiungendo una Barlow alla focale nativa del
            tuo telescopio, così puoi scegliere quella più vicina alla focale ideale calcolata sopra.
          </DismissibleInfoPanel>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[11px] text-slate-400 mb-1">λ Filtro (nm)</div>
              <input
                type="number"
                value={planWavelength}
                onChange={(e) => setPlanWavelength(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-1">Diametro (mm)</div>
              <input
                type="number"
                value={planAperture}
                onChange={(e) => setPlanAperture(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-1">Pixel (µm)</div>
              <input
                type="number"
                step="0.01"
                value={planPixelSize}
                onChange={(e) => setPlanPixelSize(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div>
              <div className="text-[10px] text-slate-400">Focale Risultante Ideale</div>
              <div className="text-lg font-black text-cyan-300">{planIdealFocalLength} mm</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Rapporto Focale Ideale</div>
              <div className="text-lg font-black text-cyan-300">f/{planIdealFocalRatio}</div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">Quale Barlow ti serve?</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Focale Nativa (mm)</div>
                <input
                  type="number"
                  value={planNativeFocalLength}
                  onChange={(e) => setPlanNativeFocalLength(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Lente di Barlow</div>
                <select value={planBarlow} onChange={(e) => setPlanBarlow(Number(e.target.value))} className={selectClass}>
                  {PLANETARY_BARLOW_OPTIONS.map((b) => (
                    <option key={b} value={b}>Barlow {b}x</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400">Focale Risultante con Barlow</div>
              <div className="text-lg font-black text-amber-400">{planBarlowResultFocalLength} mm</div>
            </div>
          </div>
        </div>

        {/* NPF Rule Exposure */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Timer className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">
              Esposizione via Regola NPF
            </h3>
          </div>

          <DismissibleInfoPanel
            id="guide-npf-exposure-note"
            icon={<Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
            className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed"
          >
            Calcola il tempo di posa massimo (in secondi) oltre il quale le stelle iniziano a comparire come tratti
            (star trailing) invece che come punti, tenendo conto di focale, apertura e dimensione del pixel: è più
            preciso della semplice regola del 500. Più in basso trovi un aiuto per calcolare il pixel pitch del
            sensore se non lo conosci, partendo dalla larghezza fisica del sensore e dalla risoluzione in pixel.
          </DismissibleInfoPanel>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[11px] text-slate-400 mb-1">Focale (mm)</div>
              <input
                type="number"
                value={npfFocalLength}
                onChange={(e) => setNpfFocalLength(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-1">Apertura (f/)</div>
              <input
                type="number"
                step="0.1"
                value={npfFNumber}
                onChange={(e) => setNpfFNumber(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 mb-1">Pixel Pitch (µm)</div>
              <input
                type="number"
                step="0.01"
                value={npfPixelPitch}
                onChange={(e) => setNpfPixelPitch(Number(e.target.value))}
                className={numberInputClass}
              />
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div className="text-[10px] text-slate-400">Tempo Massimo di Esposizione</div>
            <div className="text-2xl font-black text-indigo-300">{npfExposure}s</div>
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wide">
              Non conosci il Pixel Pitch? Calcolalo
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Lato Lungo Sensore (mm)</div>
                <input
                  type="number"
                  step="0.1"
                  value={npfSensorWidth}
                  onChange={(e) => setNpfSensorWidth(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Lato Lungo Immagine (px)</div>
                <input
                  type="number"
                  value={npfImageWidthPx}
                  onChange={(e) => setNpfImageWidthPx(Number(e.target.value))}
                  className={numberInputClass}
                />
              </div>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-xs">
              Pixel Pitch calcolato: <strong className="text-emerald-400">{npfHelperPixelPitch} µm</strong>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
