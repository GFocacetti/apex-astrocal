import React, { useEffect, useState } from 'react';
import { UserLocation } from '../types';
import { MapPin, Navigation, Search, Calendar, Menu, X, ChevronDown } from 'lucide-react';
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
  const activeParentTab = parentTabs.find((p) => containsLeaf(p, activeTab)) ?? parentTabs[0];
  const subTabs = activeParentTab.children ?? [];
  const activeSubTab = subTabs.find((t) => containsLeaf(t, activeTab));
  const subSubTabs = activeSubTab?.children ?? [];

  // Small screens get a compact bar plus a drawer instead of the three stacked
  // tab rows: pinned, those rows swallowed most of the viewport.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const openMenu = () => {
    // Unfold only the branch holding the current selection, so the ten
    // simulators don't push everything else out of reach on open.
    setExpandedIds([activeParentTab.id, activeSubTab?.id].filter((id): id is string => !!id));
    setIsMenuOpen(true);
  };

  const toggleExpanded = (id: string) =>
    setExpandedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const selectFromMenu = (id: string) => {
    setActiveTab(id);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  const renderMenuNodes = (nodes: TabNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = !!node.children?.length;
      const isOnActiveBranch = containsLeaf(node, activeTab);
      const isExpanded = expandedIds.includes(node.id);
      const sizeClass = depth === 0 ? 'text-sm font-semibold' : 'text-[13px] font-medium';

      return (
        <li key={node.id}>
          {hasChildren ? (
            <>
              <button
                onClick={() => toggleExpanded(node.id)}
                aria-expanded={isExpanded}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg transition-colors ${sizeClass} ${
                  isOnActiveBranch
                    ? 'text-amber-300 bg-slate-900'
                    : 'text-slate-300 hover:bg-slate-900/70'
                }`}
              >
                <span>{node.label}</span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isExpanded && (
                <ul className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1">
                  {renderMenuNodes(node.children!, depth + 1)}
                </ul>
              )}
            </>
          ) : (
            <button
              onClick={() => selectFromMenu(node.id)}
              aria-current={isOnActiveBranch ? 'page' : undefined}
              className={`w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-lg transition-colors ${sizeClass} ${
                isOnActiveBranch
                  ? 'text-amber-300 bg-slate-800 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/70 border border-transparent'
              }`}
            >
              {node.id === 'saturn' && (
                <span className="text-[13px] leading-none" role="img" aria-label="Saturno">
                  🪐
                </span>
              )}
              {node.label}
            </button>
          )}
        </li>
      );
    });

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
        {/* Compact bar (small screens): logo and hamburger only */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 py-2">
          <ApexLogo className="h-9 w-auto shrink-0" />
          <button
            onClick={openMenu}
            aria-label="Apri il menu"
            aria-expanded={isMenuOpen}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Full header (large screens) */}
        <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {/* Top Row: Title + Location Bar + Year */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col items-start gap-1">
              <ApexLogo className="h-24 w-auto shrink-0" />
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-300">
                  Astronomical Planning &amp; EXploration
                </p>
                <p className="text-xs text-slate-400">
                  Effemeridi e strumenti di calcolo per il setup visuale e fotografico
                </p>
              </div>
            </div>

            {/* Location & Year Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* GPS Quick Button */}
              <button
                onClick={onQuickGps}
                disabled={isGpsLoading}
                title="Rileva posizione con GPS"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition shadow-sm disabled:opacity-50"
              >
                <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
                <span>GPS Ora</span>
              </button>

              {/* Location Selector Button */}
              <button
                onClick={onOpenLocationModal}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-slate-200 border border-indigo-500/40 transition shadow-sm max-w-xs truncate"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{location.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">
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
          <nav className="mt-3 pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-thin whitespace-nowrap flex-nowrap pb-1.5 touch-pan-x">
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
          <nav className="pt-2 flex items-center gap-2 overflow-x-auto scrollbar-thin whitespace-nowrap flex-nowrap pb-1.5 touch-pan-x">
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
            <nav className="pt-1 pl-3 flex items-center gap-2 overflow-x-auto scrollbar-thin whitespace-nowrap flex-nowrap pb-1.5 touch-pan-x">
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

      {/* Drawer. Kept outside <header> on purpose: the header's backdrop-blur
          makes it a containing block, which would anchor a fixed child to the
          header box instead of the viewport. */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu di navigazione"
            className="absolute inset-y-0 right-0 w-[86%] max-w-sm flex flex-col bg-slate-950 border-l border-slate-800 shadow-2xl text-slate-100"
          >
            <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-slate-800">
              <ApexLogo className="h-9 w-auto shrink-0" />
              <button
                onClick={() => setIsMenuOpen(false)}
                aria-label="Chiudi il menu"
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-5">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-300">
                  Astronomical Planning &amp; EXploration
                </p>
                <p className="text-[11px] text-slate-400">
                  Effemeridi e strumenti di calcolo per il setup visuale e fotografico
                </p>
              </div>

              {/* Location & Year Controls */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenLocationModal();
                  }}
                  className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-slate-200 border border-indigo-500/40 transition shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{location.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-auto">
                    ({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°)
                  </span>
                  <Search className="w-3 h-3 text-slate-400 shrink-0" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onQuickGps();
                    }}
                    disabled={isGpsLoading}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition shadow-sm disabled:opacity-50"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
                    <span>GPS Ora</span>
                  </button>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      aria-label="Anno di riferimento"
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

              <nav className="border-t border-slate-800/80 pt-4">
                <ul className="space-y-1">{renderMenuNodes(parentTabs, 0)}</ul>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
