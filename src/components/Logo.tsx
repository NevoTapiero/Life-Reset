"use client";

// The Solo Leveling mark: the angular glowing S from the app icon,
// on a transparent background for in-page use.
export default function Logo({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="74 98 352 352" role="img" aria-label="Solo Leveling">
      <defs>
        <radialGradient id="logoGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ff6b00" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#ff6b00" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="logoS" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb35c" />
          <stop offset="45%" stopColor="#ff8800" />
          <stop offset="100%" stopColor="#ff6b00" />
        </linearGradient>
        <filter id="logoSoft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="12" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="252" cy="278" r="160" fill="url(#logoGlow)" />
      <g filter="url(#logoSoft)">
        <path
          d="M330 152 H224 a62 62 0 0 0 0 124 h52 a62 62 0 0 1 0 124 H172"
          fill="none"
          stroke="url(#logoS)"
          strokeWidth="96"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path d="M326 152 H244" fill="none" stroke="#ffd9b0" strokeWidth="20" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
