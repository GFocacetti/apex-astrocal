import React from 'react';

interface SimulatorStageProps {
  /** The simulation itself: canvas, SVG, or a side-by-side comparison. */
  view: React.ReactNode;
  /** Everything that drives it: sliders, selectors, knobs, action buttons. */
  controls: React.ReactNode;
  /** Live numeric readouts: under the controls, in the same column. */
  readouts?: React.ReactNode;
  /** Charts and didactic panels — always rendered after the controls. */
  children?: React.ReactNode;
}

/**
 * Shared layout for every simulator tab, present and future.
 *
 * Three rules about where things sit relative to the view:
 *
 * 1. The controls sit immediately after the view they drive, ahead of every
 *    readout and every line of explanation. Stacked the other way round, on a
 *    narrow screen the sliders land a full screenful below the thing they
 *    move, and the simulation can't be operated at all.
 * 2. Held sideways (`sim-split`, defined in index.css as landscape on a touch
 *    device) the viewport is wide but too short to stack them, so the view and
 *    the controls each take half the width and stay visible together.
 * 3. On a desktop-wide screen (`lg`) the controls and the readouts move to a
 *    narrow column on the right, so the view no longer runs the full page
 *    width and pushes its own sliders below the fold. On a phone the same
 *    column simply stacks: view, controls, readouts.
 *
 * The view is passed as a prop rather than as children so that neither rule
 * can be broken by accident when a new simulator is added.
 */
export const SimulatorStage: React.FC<SimulatorStageProps> = ({ view, controls, readouts, children }) => (
  <div className="space-y-6">
    <div className="flex flex-col gap-6 sim-split:grid sim-split:grid-cols-2 sim-split:gap-4 sim-split:items-start lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-8 lg:items-start">
      <div className="min-w-0">{view}</div>
      <div className="min-w-0 space-y-4 sim-split:max-h-[78vh] sim-split:overflow-y-auto sim-split:pr-1 lg:border-l lg:border-neutral-800 lg:pl-8">
        {controls}
        {readouts && <div className="pt-2">{readouts}</div>}
      </div>
    </div>
    {children}
  </div>
);
