import React from 'react';
import { UserLocation } from '../types';
import { MapPin, Navigation, Search, Calendar } from 'lucide-react';
import { ApexLogo } from './ApexLogo';

interface TabNode {
  id: string;
  label: string;
  children?: TabNode[];
}

interface NavbarProps {
  location: UserLocation;
  selectedYear: number;
  setSelectedYear: (yr: number) => void;
  onOpenLocationModal: () => void;
  onQuickGps: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isGpsLoading?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  location,
  selectedYear,
  setSelectedYear,
  onOpenLocationModal,
  onQuickGps,
  activeTab,
  setActiveTab,
  isGpsLoading,
}) => {
  const effemeridiSubTabs: TabNode[] = [
    { id: 'annual', label: 'Quando osservare' },
    { id: 'ephemeris20', label: 'Cicli di lungo periodo' },
    { id: 'saturn', label: 'Speciale Saturno' },
    { id: 'libration', label: 'Librazioni Lunari' },
    { id: 'eclipses', label: 'Eclissi' },
  ];

  const guideSubTabs: TabNode[] = [
    { id: 'guideVisual', label: 'Osservazione Visuale' },
    { id: 'guideImaging', label: 'Riprese Deep e Planetarie' },
  ];

  const guidesSimulatorsSubTabs: TabNode[] = [
    {
      id: 'simulators',
      label: 'Simulatori',
      children: [
        { id: 'simEyepiece', label: 'Campo Apparente Oculare' },
        { id: 'simSeeingAdc', label: 'Seeing & Dispersione (ADC)' },
        { id: 'simFieldRotation', label: 'Rotazione di Campo' },
        { id: 'simSnrStacking', label: 'SNR & Stacking' },
        { id: 'simBahtinov', label: 'Maschera di Bahtinov' },
        { id: 'simLrgbOsc', label: 'LRGB vs OSC' },
        { id: 'simCollimation', label: 'Collimazione' },
        { id: 'simBackfocus', label: 'Backfocus' },
        { id: 'simPolarAlign', label: 'Allineamento Polare' },
        { id: 'simGuiding', label: 'Autoguida' },
      ],
    },
    {
      id: 'filters',
      label: 'Guide (coming soon)',
      children: [
        { id: 'filtersVisual', label: 'Filtri per visuale' },
        { id: 'filtersImaging', label: 'Filtri per deep e planetario' },
      ],
    },
  ];

  const parentTabs: TabNode[] = [
    { id: 'effemeridi', label: 'Effemeridi', children: effemeridiSubTabs },
    { id: 'guide', label: 'Calcolatori per il Telescopio', children: guideSubTabs },
    { id: 'guides', label: 'Guide & Simulatori', children: guidesSimulatorsSubTabs },
  ];

  // Resolve which branch of the tab tree the active leaf belongs to, so each
  // navigation row can highlight its own ancestor of the current selection.
  const containsLeaf = (node: TabNode, leafId: string): boolean =>
    node.id === leafId || (node.children?.some((c) => containsLeaf(c, leafId)) ?? false);

  const firstLeafId = (node: TabNode): string =>
    node.children?.length ? firstLeafId(node.children[0]) : node.id;

  const activeParentTab = parentTabs.find((p) => containsLeaf(p, activeTab)) ?? parentTabs[0];
  const subTabs = activeParentTab.children ?? [];
  const activeSubTab = subTabs.find((t) => containsLeaf(t, activeTab));
  const subSubTabs = activeSubTab?.children ?? [];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Top Row: Title + Location Bar + Year */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col items-start gap-1">
            <ApexLogo className="h-16 sm:h-24 w-auto shrink-0" />
            <div>
              <p className="text-[11px] sm:text-xs font-semibold tracking-wide text-slate-300">
                Astronomical Planning &amp; EXploration
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Effemeridi e strumenti di calcolo per il setup visuale e fotografico
              </p>
            </div>
          </div>

          {/* Location & Year Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* GPS Quick Button */}
            <button
              onClick={onQuickGps}
              disabled={isGpsLoading}
              title="Rileva posizione con GPS"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition shadow-sm disabled:opacity-50"
            >
              <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">GPS Ora</span>
            </button>

            {/* Location Selector Button */}
            <button
              onClick={onOpenLocationModal}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-slate-200 border border-indigo-500/40 transition shadow-sm max-w-[220px] sm:max-w-xs truncate"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{location.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0 hidden lg:inline">
                ({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°)
              </span>
              <Search className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            {/* Year Selector (100 Years: 2026 - 2125) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer pr-1"
              >
                {Array.from({ length: 100 }, (_, i) => 2026 + i).map((yr) => (
                  <option key={yr} value={yr} className="bg-slate-900 text-slate-100">
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Parent Navigation Tabs */}
        <nav className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-thin whitespace-nowrap flex-wrap sm:flex-nowrap pb-1.5 touch-pan-x">
          {parentTabs.map((tab) => {
            const isActive = activeParentTab.id === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(firstLeafId(tab))}
                className={`whitespace-nowrap px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Sub Navigation Tabs (current parent group) */}
        <nav className="pt-2 flex items-center gap-2 overflow-x-auto scrollbar-thin whitespace-nowrap flex-wrap sm:flex-nowrap pb-1.5 touch-pan-x">
          {subTabs.map((tab) => {
            const isActive = activeSubTab?.id === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(firstLeafId(tab))}
                className={`whitespace-nowrap px-3 py-1 text-[11px] font-medium rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-amber-300 border border-slate-700'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                {tab.id === 'saturn' && (
                  <span className="text-[11px] leading-none" role="img" aria-label="Saturno">
                    🪐
                  </span>
                )}
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Third-level Tabs (only where the active sub-tab has children) */}
        {subSubTabs.length > 0 && (
          <nav className="pt-1 pl-3 flex items-center gap-2 overflow-x-auto scrollbar-thin whitespace-nowrap flex-wrap sm:flex-nowrap pb-1.5 touch-pan-x">
            {subSubTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap px-2.5 py-0.5 text-[11px] font-medium rounded-md transition-all shrink-0 border-l-2 ${
                    isActive
                      ? 'border-amber-500/60 text-amber-300 bg-slate-800/60'
                      : 'border-slate-700/60 text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};
