import React from 'react';

interface SimulatorStageProps {
  /** The simulation itself: canvas, SVG, or a side-by-side comparison. */
  view: React.ReactNode;
  /** Everything that drives it: sliders, selectors, knobs, action buttons. */
  controls: React.ReactNode;
  /** Readouts, charts and didactic panels — always rendered after the controls. */
  children?: React.ReactNode;
}

/**
 * Shared layout for every simulator tab, present and future.
 *
 * Two rules, both of them driven by how these get used on a phone:
 *
 * 1. The controls sit immediately after the view they drive, ahead of every
 *    readout and every line of explanation. Stacked the other way round, on a
 *    narrow screen the sliders land a full screenful below the thing they
 *    move, and the simulation can't be operated at all.
 * 2. Held sideways (`sim-split`, defined in index.css as landscape on a touch
 *    device) the viewport is wide but too short to stack them, so the view and
 *    the controls each take half the width and stay visible together.
 *
 * The view is passed as a prop rather than as children so that neither rule
 * can be broken by accident when a new simulator is added.
 */
export const SimulatorStage: React.FC<SimulatorStageProps> = ({ view, controls, children }) => (
  <div className="space-y-6">
    <div className="flex flex-col gap-6 sim-split:grid sim-split:grid-cols-2 sim-split:gap-4 sim-split:items-start">
      <div className="min-w-0">{view}</div>
      <div className="min-w-0 space-y-3 sim-split:max-h-[78vh] sim-split:overflow-y-auto sim-split:pr-1">
        {controls}
      </div>
    </div>
    {children}
  </div>
);
