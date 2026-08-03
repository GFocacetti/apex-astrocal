import React from 'react';

interface ApexIconProps {
  className?: string;
}

/**
 * Icon-only Apex mark (apex_logo_icona.svg): the "A" arrow with its orbit
 * ring, without the wordmark. Not currently wired into any screen - kept
 * ready for future use (e.g. a favicon), but note its icon fill (#f8fafc)
 * is light and won't be visible on a light background without adjustment.
 */
export const ApexIcon: React.FC<ApexIconProps> = ({ className }) => (
  <svg
    className={className}
    style={{ aspectRatio: '1 / 1' }}
    viewBox="0 0 311.81 311.81"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Apex"
  >
    <path
      d="M17.89,235.19c-.9-27.78,56.64-68.67,128.51-91.33,71.88-22.66,130.87-18.5,131.77,9.28"
      fill="none"
      stroke="#f59e0b"
      strokeLinecap="round"
      strokeMiterlimit={4}
      strokeWidth={4}
    />
    <path d="M157.61,43.41l-90,225h60l30.04-107.09,29.96,107.09h60L157.61,43.41Z" fill="#f8fafc" />
    <path
      d="M17.89,235.19c.9,27.78,59.89,31.94,131.77,9.28s129.41-63.54,128.51-91.33"
      fill="none"
      stroke="#f59e0b"
      strokeLinecap="round"
      strokeMiterlimit={4}
      strokeWidth={4}
    />
    <ellipse cx={273.83} cy={139.61} rx={20.1} ry={19.97} fill="#f59e0b" />
  </svg>
);
