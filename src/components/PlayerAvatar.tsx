"use client";

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
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden style={{ display: "block" }}>
      <circle cx="32" cy="32" r="32" fill={look.bg} />
      <circle cx="32" cy="32" r="32" fill="url(#mh-shine)" />
      <defs>
        <radialGradient id="mh-shine" cx="35%" cy="25%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* neck + torso top */}
      <path d="M14 64c1-9 8-13 18-13s17 4 18 13Z" fill={look.ring} />
      {/* the stud on top of the head (hidden under hair/hats) */}
      <rect x="25" y="9" width="14" height="7" rx="2" fill={SKIN_SHADE} />
      {/* head: a rounded cylinder */}
      <rect x="15" y="14" width="34" height="33" rx="9" fill={SKIN} />
      <rect x="15" y="40" width="34" height="7" rx="4" fill={SKIN_SHADE} />
      {/* face */}
      <ellipse cx="25.5" cy="29" rx="2.4" ry="2.9" fill="#1b2a34" />
      <ellipse cx="38.5" cy="29" rx="2.4" ry="2.9" fill="#1b2a34" />
      <circle cx="26.3" cy="28" r="0.8" fill="#fff" />
      <circle cx="39.3" cy="28" r="0.8" fill="#fff" />
      <path d="M24 35.5c4.5 4.5 11.5 4.5 16 0" fill="none" stroke="#1b2a34" strokeWidth="2.2" strokeLinecap="round" />
      {look.draw === "hair" && (
        <path d="M13 26c-1-12 7-18 19-18 11 0 19 5 19 15l-4-2-3 4-4-5-5 4-4-5-6 5-3-4-4 6Z" fill={look.hair} />
      )}
      {look.draw === "hood" && (
        <path d="M11 44V24C11 12 20 6 32 6s21 6 21 18v20h-5V26c0-5-5-9-16-9s-16 4-16 9v18Z" fill={look.hair} />
      )}
      {look.draw === "hat" && (
        <>
          <path d="M32 0 18 21h28Z" fill={look.hair} />
          <ellipse cx="32" cy="21" rx="21" ry="4.5" fill={look.hair} />
          <path d="m32 8 1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4Z" fill={look.extra} />
        </>
      )}
      {look.draw === "bandana" && (
        <>
          <path d="M14 22c0-9 8-14 18-14s18 5 18 14v2H14Z" fill={look.hair} />
          <path d="M48 20l8 3-7 4Z" fill={look.hair} />
        </>
      )}
      {look.draw === "spikes" && (
        <>
          <path d="M13 24 16 8l5 7 4-11 5 9 5-10 4 10 5-7 3 18Z" fill={look.hair} />
          <rect x="15" y="25" width="34" height="8" rx="3" fill={look.extra} />
          <ellipse cx="25.5" cy="29" rx="2.4" ry="2" fill="#fff" />
          <ellipse cx="38.5" cy="29" rx="2.4" ry="2" fill="#fff" />
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
