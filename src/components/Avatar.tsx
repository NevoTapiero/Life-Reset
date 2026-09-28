"use client";

import { TIERS, avatarSrc, type CharacterKey } from "@/lib/game";

// Real anime bust portraits generated with FLUX.1 Krea (public/chars/*.webp),
// one per character, each on its own themed gradient backdrop.
// The colored ring matches the character's accent unless ringColor overrides it
// (the board uses that for gold/silver/bronze podium rings).
// Pass tierIndex to add the rank decoration: each full tier earns a richer frame.

const GLOW: Record<CharacterKey, string> = {
  warrior: "#ff6b00",
  mentalist: "#a78bfa",
  wizard: "#5aa7ff",
  guardian: "#34d399",
  shadow: "#22d3ee",
};

export default function Avatar({
  character = "warrior",
  size = 96,
  ring = true,
  ringColor,
  tierIndex,
}: {
  character?: CharacterKey | null;
  size?: number;
  ring?: boolean;
  ringColor?: string;
  tierIndex?: number;
}) {
  const key: CharacterKey = character && character in GLOW ? character : "warrior";
  const c = ringColor ?? GLOW[key];
  const rim = Math.max(2, Math.round(size * 0.032));

  return (
    <span
      className="relative inline-block rounded-full flex-none"
      style={{
        width: size,
        height: size,
        boxShadow: ring
          ? `0 0 0 ${rim}px ${c}, 0 0 ${Math.round(size * 0.18)}px ${c}55`
          : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarSrc(key, tierIndex)}
        alt={`${key} avatar`}
        width={size}
        height={size}
        draggable={false}
        className="rounded-full object-cover w-full h-full select-none"
      />
      {typeof tierIndex === "number" && <RankDeco tierIndex={tierIndex} />}
    </span>
  );
}

// Decorative frame layered over the avatar ring. The portrait circle spans
// 25..125 in this viewBox, so ornaments sit just outside its edge.
function RankDeco({ tierIndex }: { tierIndex: number }) {
  const t = Math.min(Math.max(tierIndex, 0), TIERS.length - 1);
  const color = TIERS[t].color;
  return (
    <svg
      aria-hidden
      viewBox="0 0 150 150"
      className="absolute pointer-events-none"
      style={{
        left: "-25%",
        top: "-25%",
        width: "150%",
        height: "150%",
        filter: `drop-shadow(0 0 4px ${color}88)`,
      }}
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bronze: four studs on the diagonals */}
      {t === 0 && (
        <g fill={color} stroke="none">
          {[45, 135, 225, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            return <circle key={deg} cx={75 + Math.cos(a) * 54} cy={75 + Math.sin(a) * 54} r="4" />;
          })}
        </g>
      )}
      {/* Silver: twin side brackets */}
      {t === 1 && (
        <>
          <path d="M25 55a54 54 0 0 0 0 40" />
          <path d="M125 55a54 54 0 0 1 0 40" />
          <path d="M18 60a61 61 0 0 0 0 30" strokeWidth="2" opacity="0.6" />
          <path d="M132 60a61 61 0 0 1 0 30" strokeWidth="2" opacity="0.6" />
        </>
      )}
      {/* Gold: laurel branches cupping the bottom */}
      {t === 2 && (
        <>
          <path d="M32 100a52 52 0 0 0 43 29" />
          <path d="M118 100a52 52 0 0 1-43 29" />
          {[
            [36, 108, -55], [45, 117, -40], [56, 124, -25], [68, 128, -10],
            [114, 108, 235], [105, 117, 220], [94, 124, 205], [82, 128, 190],
          ].map(([x, y, r], i) => (
            <path key={i} d="M0 0Q5 -7 12 -6Q7 1 0 0Z" fill={color} stroke="none" transform={`translate(${x} ${y}) rotate(${r})`} />
          ))}
        </>
      )}
      {/* Platinum: angular wing blades at the sides */}
      {t === 3 && (
        <>
          <path d="M24 75 8 60l7 15-7 15Z" fill={color} stroke="none" />
          <path d="M126 75l16-15-7 15 7 15Z" fill={color} stroke="none" />
          <path d="M27 55 15 42M27 95l-12 13M123 55l12-13M123 95l12 13" />
          <path d="M25 55a54 54 0 0 0 0 40M125 55a54 54 0 0 1 0 40" strokeWidth="2" opacity="0.7" />
        </>
      )}
      {/* Diamond: crystal spikes crowning the top half */}
      {t === 4 && (
        <>
          {[-64, -38, -12, 12, 38, 64].map((deg, i) => {
            const a = ((deg - 90) * Math.PI) / 180;
            const big = i === 2 || i === 3;
            const r1 = 52;
            const r2 = big ? 74 : 66;
            const x1 = 75 + Math.cos(a) * r1;
            const y1 = 75 + Math.sin(a) * r1;
            const x2 = 75 + Math.cos(a) * r2;
            const y2 = 75 + Math.sin(a) * r2;
            const px = Math.cos(a + Math.PI / 2) * 4;
            const py = Math.sin(a + Math.PI / 2) * 4;
            return (
              <path
                key={deg}
                d={`M${x1 - px} ${y1 - py} L${x2} ${y2} L${x1 + px} ${y1 + py} Z`}
                fill={color}
                stroke="none"
                opacity={big ? 1 : 0.85}
              />
            );
          })}
          <path d="M28 95a54 54 0 0 0 94 0" strokeWidth="2" opacity="0.6" />
        </>
      )}
      {/* Champion: the crown and a full blazing ring */}
      {t === 5 && (
        <>
          <circle cx="75" cy="75" r="56" strokeWidth="2.5" opacity="0.8" />
          <circle cx="75" cy="75" r="62" strokeWidth="1.5" opacity="0.4" />
          <path
            d="M55 22 58 6l9 8 8-13 8 13 9-8 3 16c-6-3-12-4.5-20-4.5S61 19 55 22Z"
            fill={color}
            stroke="none"
          />
          <circle cx="75" cy="4" r="2.5" fill={color} stroke="none" />
          <path d="M22 55l-8-4M128 55l8-4M22 95l-8 4M128 95l8 4" strokeWidth="2.5" />
        </>
      )}
    </svg>
  );
}
