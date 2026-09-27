"use client";

// The Solo Leveling mark: the angular glowing S from the app icon,
// on a transparent background for in-page use.
export default function Logo({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="94 116 324 324" role="img" aria-label="Solo Leveling">
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
          d="M330 150 H222 a64 64 0 0 0 0 128 h56 a64 64 0 0 1 0 128 H170"
          fill="none"
          stroke="url(#logoS)"
          strokeWidth="78"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <path d="M330 150 H240" fill="none" stroke="#ffd9b0" strokeWidth="18" strokeLinecap="round" opacity="0.35" />
    </svg>
  );
}
