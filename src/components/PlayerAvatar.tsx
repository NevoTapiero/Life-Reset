"use client";

import { useId } from "react";

// A player's picture in the brick theme: their own photo if they uploaded one,
// otherwise a LEGO minifig head dressed as their character (copper hair for the
// Warrior, a star hat for the Wizard...). Drawn as SVG so a leaderboard of
// twenty players costs nothing to render.

type Look = { bg: string; ring: string; draw: "hair" | "hat" | "hood" | "bandana" | "spikes"; hair: string; extra?: string };

const LOOKS: Record<string, Look> = {
  warrior: { bg: "#fe8a18", ring: "#b35a00", draw: "hair", hair: "#a95500" },
  mentalist: { bg: "#b48fd6", ring: "#6b4a8e", draw: "hood", hair: "#81007b" },
  wizard: { bg: "#5a93db", ring: "#0a3463", draw: "hat", hair: "#0a3463", extra: "#f2cd37" },
  guardian: { bg: "#4b9f4a", ring: "#256a2b", draw: "bandana", hair: "#237841" },
  shadow: { bg: "#6c6e68", ring: "#1b2a34", draw: "spikes", hair: "#1b2a34", extra: "#0055bf" },
};

const SKIN = "#f2cd37";
const SKIN_SHADE = "#d9b320";

export function MinifigHead({ character, size = 48 }: { character?: string | null; size?: number }) {
  const look = LOOKS[character ?? "warrior"] ?? LOOKS.warrior;
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ display: "block" }}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* the head is a cylinder: lit from the left, shaded on the right */}
        <linearGradient id={`${id}-skin`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="0.45" stopColor={SKIN} />
          <stop offset="1" stopColor={SKIN_SHADE} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={look.bg} />
      <circle cx="32" cy="32" r="32" fill={`url(#${id}-bg)`} />
      {/* torso top */}
      <path d="M12 64c1-9 9-13.5 20-13.5S51 55 52 64Z" fill={look.ring} />
      <rect x="26" y="45" width="12" height="7" rx="2" fill={SKIN_SHADE} />
      {/* stud on top of the head (under hair and hats) */}
      <rect x="25.5" y="9" width="13" height="7" rx="2.5" fill={SKIN_SHADE} />
      {/* head */}
      <rect x="15" y="14" width="34" height="33" rx="10" fill={`url(#${id}-skin)`} />
      {/* face */}
      <ellipse cx="25.5" cy="29.5" rx="2.5" ry="3" fill="#1b2a34" />
      <ellipse cx="38.5" cy="29.5" rx="2.5" ry="3" fill="#1b2a34" />
      <circle cx="26.4" cy="28.4" r="0.85" fill="#fff" />
      <circle cx="39.4" cy="28.4" r="0.85" fill="#fff" />
      <path d="M24.5 36c4.3 4.2 10.7 4.2 15 0" fill="none" stroke="#1b2a34" strokeWidth="2.3" strokeLinecap="round" />
      {look.draw === "hair" && (
        <path d="M13 28C11 13.5 20 6 32 6s21 7.5 19 22c-2-5-5-8-9-9.2-4 3.4-12 4.6-20 2.6-3.6 1-6.6 3.6-9 6.6Z" fill={look.hair} />
      )}
      {look.draw === "hood" && (
        <path d="M10 47V26C10 13 20 5 32 5s22 8 22 21v21h-6V28c0-7-6.5-12-16-12s-16 5-16 12v19Z" fill={look.hair} />
      )}
      {look.draw === "hat" && (
        <>
          <path d="M33 0c-4 6-10 14-15 21h28C42 14 37 7 33 0Z" fill={look.hair} />
          <ellipse cx="32" cy="21" rx="21" ry="4.5" fill={look.hair} />
          <path d="m32.5 8 1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4Z" fill={look.extra} />
        </>
      )}
      {look.draw === "bandana" && (
        <>
          <path d="M14 24c0-10 8-16 18-16s18 6 18 16v1.5H14Z" fill={look.hair} />
          <path d="M48.5 20.5 58 17l-2 9Z" fill={look.hair} />
          <path d="M14 24.5h36" stroke="rgb(0 0 0 / 0.18)" strokeWidth="2" />
        </>
      )}
      {look.draw === "spikes" && (
        <>
          <path d="M13 25 15.5 8l5.5 6.5L25 3.5l5.5 8.5 5-9.5 4.5 9.5 5.5-6.5 3.5 19Z" fill={look.hair} />
          <rect x="15" y="25" width="34" height="8.5" rx="3.5" fill={look.extra} />
          <ellipse cx="25.5" cy="29.5" rx="2.5" ry="2" fill="#fff" />
          <ellipse cx="38.5" cy="29.5" rx="2.5" ry="2" fill="#fff" />
          <circle cx="26" cy="29.5" r="1.1" fill="#1b2a34" />
          <circle cx="39" cy="29.5" r="1.1" fill="#1b2a34" />
        </>
      )}
    </svg>
  );
}

// Round avatar with a thick plastic rim. `photo` wins when present.
export default function PlayerAvatar({
  photo,
  character,
  size = 48,
  rim,
}: {
  photo?: string | null;
  character?: string | null;
  size?: number;
  rim?: string;
}) {
  const look = LOOKS[character ?? "warrior"] ?? LOOKS.warrior;
  const w = Math.max(2, Math.round(size * 0.06));
  return (
    <span
      className="relative inline-block rounded-full flex-none overflow-hidden"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 0 ${w}px ${rim ?? "#fff"}, 0 ${w + 2}px 0 ${w}px ${rim ? "rgb(27 42 52 / 0.25)" : look.ring}`,
        background: look.bg,
      }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" width={size} height={size} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <MinifigHead character={character} size={size} />
      )}
    </span>
  );
}
