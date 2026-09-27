"use client";

import { useId } from "react";
import { STAGES, TIERS } from "@/lib/game";

// Angular rank emblems in the spirit of tactical-shooter rank badges.
// 18 distinct designs: one emblem per tier, and the badge itself evolves
// with the stage — I: clean shield · II: adds war-wings · III: adds a
// crest and an aura glow. Original artwork.

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function Emblem({ tierIndex, color }: { tierIndex: number; color: string }) {
  const lit = { fill: color };
  switch (tierIndex) {
    case 0: // Bronze: single chevron
      return <path d="M24 14 34 24l-4.2 4.2L24 22.4l-5.8 5.8L14 24Z" {...lit} />;
    case 1: // Silver: double chevron
      return (
        <>
          <path d="M24 11.5 32.5 20l-3.6 3.6-4.9-4.9-4.9 4.9L15.5 20Z" {...lit} />
          <path d="M24 21 32.5 29.5l-3.6 3.6-4.9-4.9-4.9 4.9-3.6-3.6Z" {...lit} opacity={0.55} />
        </>
      );
    case 2: // Gold: crown of three points
      return (
        <>
          <path d="M14 30.5 15.8 17l5 5.4L24 14l3.2 8.4 5-5.4L34 30.5Z" {...lit} />
          <path d="M15.5 33h17v2.6h-17Z" {...lit} opacity={0.7} />
        </>
      );
    case 3: // Platinum: winged chevron
      return (
        <>
          <path d="M24 13.5 31.5 21l-3.4 3.4L24 20.3l-4.1 4.1L16.5 21Z" {...lit} />
          <path d="M10.5 22.5 18 30l-3.2 3.2-7.5-7.5ZM37.5 22.5 30 30l3.2 3.2 7.5-7.5Z" {...lit} opacity={0.6} />
          <path d="M24 23.5l4.5 4.5-4.5 4.5-4.5-4.5Z" {...lit} />
        </>
      );
    case 4: // Diamond: cut gem
      return (
        <>
          <path d="M24 12.5 34.5 22 24 35.5 13.5 22Z" fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
          <path d="M24 12.5v23M13.5 22h21M24 12.5 18 22l6 13.5M24 12.5 30 22l-6 13.5" stroke={color} strokeWidth={1.1} opacity={0.65} fill="none" />
        </>
      );
    default: // Champion: star over crown arc
      return (
        <>
          <path d="M24 10.5l3 6.6 7.2.8-5.4 4.9 1.5 7.1L24 26.3l-6.3 3.6 1.5-7.1-5.4-4.9 7.2-.8Z" {...lit} />
          <path d="M13 32.5c3.4 2.4 7.1 3.6 11 3.6s7.6-1.2 11-3.6" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        </>
      );
  }
}

export default function RankBadge({
  tierIndex,
  stageIndex,
  size = 56,
  showPips = true,
}: {
  tierIndex: number;
  stageIndex: number;
  size?: number;
  showPips?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tier = TIERS[Math.min(tierIndex, TIERS.length - 1)];
  const color = tier.color;
  const hi = shade(color, 1.25);
  const lo = shade(color, 0.55);

  return (
    <svg
      width={size}
      height={size * (66 / 60)}
      viewBox="-6 -8 60 66"
      role="img"
      aria-label={`${tier.name} ${STAGES[stageIndex]}`}
    >
      <defs>
        <linearGradient id={`rim${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hi} />
          <stop offset="100%" stopColor={lo} />
        </linearGradient>
        <linearGradient id={`face${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#26262b" />
          <stop offset="100%" stopColor="#121215" />
        </linearGradient>
        <radialGradient id={`aura${uid}`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="70%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* stage III: aura glow behind everything */}
      {stageIndex >= 2 && <ellipse cx="24" cy="24" rx="30" ry="31" fill={`url(#aura${uid})`} />}

      {/* stage II+: war-wings flanking the shield */}
      {stageIndex >= 1 && (
        <g fill={`url(#rim${uid})`}>
          <path d="M4.5 10 -5.5 15.5 1 20l-4.5 4L3 30l-4 4.5 7 4.5c-2.2-9.5-2.6-19.2-1.5-29Z" />
          <path d="M43.5 10 53.5 15.5 47 20l4.5 4L45 30l4 4.5-7 4.5c2.2-9.5 2.6-19.2 1.5-29Z" />
          <path d="M4.5 10 -5.5 15.5 1 20l-4.5 4L3 30l-4 4.5 7 4.5c-2.2-9.5-2.6-19.2-1.5-29ZM43.5 10 53.5 15.5 47 20l4.5 4L45 30l4 4.5-7 4.5c2.2-9.5 2.6-19.2 1.5-29Z" fill="#0c0c0e" opacity="0.25" />
        </g>
      )}

      {/* stage III: crest spikes above the shield */}
      {stageIndex >= 2 && (
        <g fill={`url(#rim${uid})`}>
          <path d="M24 -7.5 27.5 1h-7Z" />
          <path d="M13.5 -3.5 18 3.5l-6.8 1.2Z" />
          <path d="M34.5 -3.5 30 3.5l6.8 1.2Z" />
        </g>
      )}

      {/* angular shield */}
      <path
        d="M24 1.5 42.5 8v17.5c0 9.8-7 16.6-18.5 21C12.5 42.1 5.5 35.3 5.5 25.5V8Z"
        fill={`url(#face${uid})`}
        stroke={`url(#rim${uid})`}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path
        d="M24 5.2 39 10.6v14.6c0 7.9-5.6 13.6-15 17.5-9.4-3.9-15-9.6-15-17.5V10.6Z"
        fill="none"
        stroke={color}
        strokeOpacity={stageIndex >= 2 ? 0.5 : 0.28}
        strokeWidth={1}
        strokeLinejoin="round"
      />

      <Emblem tierIndex={tierIndex} color={color} />

      {/* stage pips */}
      {showPips && (
        <g>
          {[0, 1, 2].map((i) => {
            const x = 24 + (i - 1) * 8;
            const on = i <= stageIndex;
            return (
              <path
                key={i}
                d={`M${x} 46.2l2.6 2.6-2.6 2.6-2.6-2.6Z`}
                fill={on ? color : "none"}
                stroke={color}
                strokeOpacity={on ? 1 : 0.35}
                strokeWidth={1.1}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
