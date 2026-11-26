import React, { useEffect, useState } from 'react';
import { UserLocation } from '../types';
import { Navigation, Menu, X, ChevronDown } from 'lucide-react';
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
  { id: 'saturn', label: 'Anelli di Saturno' },
  { id: 'libration', label: 'Librazioni lunari' },
  { id: 'eclipses', label: 'Eclissi' },
];

const guideSubTabs: TabNode[] = [
  { id: 'guideVisual', label: 'Osservazione visuale' },
  { id: 'guideImaging', label: 'Riprese deep e planetarie' },
];

const guidesSimulatorsSubTabs: TabNode[] = [
  {
    id: 'simulators',
    label: 'Simulatori',
    children: [
      { id: 'simEyepiece', label: 'Campo apparente' },
      { id: 'simSeeingAdc', label: 'Seeing e ADC' },
      { id: 'simFieldRotation', label: 'Rotazione di campo' },
      { id: 'simSnrStacking', label: 'SNR e stacking' },
      { id: 'simBahtinov', label: 'Maschera di Bahtinov' },
      { id: 'simLrgbOsc', label: 'LRGB e OSC' },
      { id: 'simCollimation', label: 'Collimazione' },
      { id: 'simBackfocus', label: 'Backfocus' },
      { id: 'simPolarAlign', label: 'Allineamento polare' },
      { id: 'simGuiding', label: 'Autoguida' },
    ],
  },
  {
    id: 'filters',
    label: 'Guide ai filtri',
    children: [
      { id: 'filtersVisual', label: 'Visuale' },
      { id: 'filtersImaging', label: 'Deep e planetario' },
    ],
  },
];

const parentTabs: TabNode[] = [
  { id: 'effemeridi', label: 'Effemeridi', children: effemeridiSubTabs },
  { id: 'guide', label: 'Calcolatori', children: guideSubTabs },
  { id: 'guides', label: 'Guide e simulatori', children: guidesSimulatorsSubTabs },
];

const YEARS = Array.from({ length: 100 }, (_, i) => 2026 + i);

// Resolve which branch of the tab tree the active leaf belongs to, so each
// navigation row can highlight its own ancestor of the current selection.
const containsLeaf = (node: TabNode, leafId: string): boolean =>
  node.id === leafId || (node.children?.some((c) => containsLeaf(c, leafId)) ?? false);

const firstLeafId = (node: TabNode): string =>
  node.children?.length ? firstLeafId(node.children[0]) : node.id;

const formatCoords = (loc: UserLocation) =>
  `${Math.abs(loc.latitude).toFixed(2)}° ${loc.latitude >= 0 ? 'N' : 'S'}  ${Math.abs(loc.longitude).toFixed(2)}° ${
    loc.longitude >= 0 ? 'E' : 'O'
  }`;

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

  // Small screens get a compact bar plus a drawer instead of the stacked tab
  // rows: pinned, those rows swallowed most of the viewport.
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

  const yearSelect = (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Anno di riferimento</span>
      <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        className="appearance-none bg-transparent pr-5 text-sm tabular text-neutral-200 hover:text-white focus:outline-none cursor-pointer"
      >
        {YEARS.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 w-3.5 h-3.5 text-neutral-500" />
    </label>
  );

  const renderMenuNodes = (nodes: TabNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const hasChildren = !!node.children?.length;
      const isOnActiveBranch = containsLeaf(node, activeTab);
      const isExpanded = expandedIds.includes(node.id);

      if (hasChildren) {
        return (
          <li key={node.id}>
            <button
              onClick={() => toggleExpanded(node.id)}
              aria-expanded={isExpanded}
              className={`w-full flex items-center justify-between gap-2 py-2.5 text-left transition-colors ${
                depth === 0
                  ? 'font-display text-[13px] uppercase tracking-[0.18em]'
                  : 'text-sm'
              } ${isOnActiveBranch ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              <span>{node.label}</span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-neutral-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            {isExpanded && (
              <ul className="mb-2 ml-1 pl-4 border-l border-neutral-800">{renderMenuNodes(node.children!, depth + 1)}</ul>
            )}
          </li>
        );
      }

      return (
        <li key={node.id}>
          <button
            onClick={() => selectFromMenu(node.id)}
            aria-current={isOnActiveBranch ? 'page' : undefined}
            className={`w-full text-left py-2 text-sm transition-colors ${
              isOnActiveBranch ? 'text-accent' : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            {node.label}
          </button>
        </li>
      );
    });

  return (
    <>
      <header className="sticky top-0 z-40 bg-ink/85 backdrop-blur-md border-b border-neutral-900">
        {/* Compact bar (small screens): logo and menu button only */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 h-14">
          <ApexLogo className="h-8 w-auto shrink-0" />
          <button
            onClick={openMenu}
            aria-label="Apri il menu"
            aria-expanded={isMenuOpen}
            className="inline-flex items-center justify-center w-10 h-10 -mr-2 text-neutral-300 hover:text-white transition-colors"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Full header (large screens) */}
        <div className="hidden lg:block max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between gap-8 h-[72px]">
            <ApexLogo className="h-11 w-auto shrink-0" />

            <nav className="flex items-center gap-9" aria-label="Sezioni">
              {parentTabs.map((tab) => {
                const isActive = activeParentTab.id === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(firstLeafId(tab))}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative py-2 font-display text-[12px] uppercase tracking-[0.2em] transition-colors ${
                      isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                    {isActive && <span className="absolute left-0 right-0 -bottom-px h-px bg-accent" />}
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-5 text-sm">
              <button
                onClick={onOpenLocationModal}
                title="Cambia località"
                className="group flex flex-col items-end leading-tight max-w-[16rem]"
              >
                <span className="truncate max-w-full text-neutral-200 group-hover:text-white transition-colors">
                  {location.name}
                </span>
                <span className="text-[11px] tabular text-neutral-500 whitespace-pre">{formatCoords(location)}</span>
              </button>
              <button
                onClick={onQuickGps}
                disabled={isGpsLoading}
                title="Usa la posizione GPS"
                aria-label="Usa la posizione GPS"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors disabled:opacity-50"
              >
                <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
              </button>
              <span className="w-px h-6 bg-neutral-800" aria-hidden="true" />
              {yearSelect}
            </div>
          </div>

          {/* Second level */}
          <nav className="flex items-center gap-7 h-11 border-t border-neutral-900 overflow-x-auto whitespace-nowrap">
            {subTabs.map((tab) => {
              const isActive = activeSubTab?.id === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(firstLeafId(tab))}
                  aria-current={isActive ? 'page' : undefined}
                  className={`shrink-0 text-[13px] transition-colors ${
                    isActive ? 'text-white' : 'text-neutral-500 hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Third level, only where the active second-level entry has children */}
          {subSubTabs.length > 0 && (
            <nav className="flex items-center gap-1 pb-3 overflow-x-auto whitespace-nowrap">
              {subSubTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`shrink-0 px-3 py-1 rounded-full text-[12px] border transition-colors ${
                      isActive
                        ? 'border-neutral-600 text-white'
                        : 'border-transparent text-neutral-500 hover:text-neutral-200'
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
          <div className="absolute inset-0 bg-black/70" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu di navigazione"
            className="absolute inset-y-0 right-0 w-[86%] max-w-sm flex flex-col bg-ink border-l border-neutral-900"
          >
            <div className="shrink-0 flex items-center justify-between gap-3 px-5 h-14 border-b border-neutral-900">
              <ApexLogo className="h-8 w-auto shrink-0" />
              <button
                onClick={() => setIsMenuOpen(false)}
                aria-label="Chiudi il menu"
                className="inline-flex items-center justify-center w-10 h-10 -mr-2 text-neutral-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenLocationModal();
                  }}
                  className="w-full flex flex-col items-start text-left leading-tight"
                >
                  <span className="text-[11px] font-display uppercase tracking-[0.18em] text-neutral-500 mb-1">
                    Località
                  </span>
                  <span className="text-neutral-100">{location.name}</span>
                  <span className="text-[11px] tabular text-neutral-500 whitespace-pre">{formatCoords(location)}</span>
                </button>

                <div className="flex items-center gap-4 text-sm">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onQuickGps();
                    }}
                    disabled={isGpsLoading}
                    className="inline-flex items-center gap-2 text-neutral-300 hover:text-white disabled:opacity-50"
                  >
                    <Navigation className={`w-3.5 h-3.5 ${isGpsLoading ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
                    Usa GPS
                  </button>
                  <span className="w-px h-4 bg-neutral-800" aria-hidden="true" />
                  {yearSelect}
                </div>
              </div>

              <nav className="border-t border-neutral-900 pt-3">
                <ul>{renderMenuNodes(parentTabs, 0)}</ul>
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
