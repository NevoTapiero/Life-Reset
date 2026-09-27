"use client";

import type { CharacterKey } from "@/lib/game";

// Real anime bust portraits generated with FLUX.1 Krea (public/chars/*.webp),
// one per character, each on its own themed gradient backdrop.
// The colored ring matches the character's accent unless ringColor overrides it
// (the board uses that for gold/silver/bronze podium rings).

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
}: {
  character?: CharacterKey | null;
  size?: number;
  ring?: boolean;
  ringColor?: string;
}) {
  const key: CharacterKey = character && character in GLOW ? character : "warrior";
  const c = ringColor ?? GLOW[key];
  const rim = Math.max(2, Math.round(size * 0.032));

  return (
    <span
      className="inline-block rounded-full flex-none"
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
        src={`/chars/${key}.webp`}
        alt={`${key} avatar`}
        width={size}
        height={size}
        draggable={false}
        className="rounded-full object-cover w-full h-full select-none"
      />
    </span>
  );
}
