"use client";

import { useId } from "react";
import type { CharacterKey } from "@/lib/game";

// Modern anime bust portraits, one skin per character, drawn as inline SVG.
// Style guide: clean uniform line art, 2D cel shading with hard-edged bang
// shadows, large expressive eyes with double highlights, sharp jaw, dark
// streetwear jacket with a neon collar trim, vivid gradient backdrop.
// Gear: warrior (metal headband), mentalist (hood), wizard (pointed hat),
// guardian (bandana + armored collar), shadow (black spikes, glowing eyes, aura).

type Skin = {
  bg1: string;
  bg2: string;
  hairHi: string;
  hairMid: string;
  hairLo: string;
  hairShadow: string;
  iris1: string;
  iris2: string;
  trim: string;
  glow: string;
  gear: "headband" | "hood" | "hat" | "bandana" | "aura";
};

const SKINS: Record<CharacterKey, Skin> = {
  warrior: {
    bg1: "#155a70", bg2: "#0a2a38",
    hairHi: "#ffc46e", hairMid: "#ff8b1f", hairLo: "#dd5c00", hairShadow: "#a94800",
    iris1: "#ffb054", iris2: "#8a4a00", trim: "#ff7a00", glow: "#ff6b00", gear: "headband",
  },
  mentalist: {
    bg1: "#43308c", bg2: "#191036",
    hairHi: "#d8ccff", hairMid: "#a78bfa", hairLo: "#7451e0", hairShadow: "#5636bd",
    iris1: "#c9b4ff", iris2: "#5d3fd1", trim: "#a78bfa", glow: "#8b6cf5", gear: "hood",
  },
  wizard: {
    bg1: "#1e4c8f", bg2: "#0c1d3c",
    hairHi: "#f4f7fc", hairMid: "#c2d0e4", hairLo: "#8ba2c2", hairShadow: "#7089ab",
    iris1: "#8ec9ff", iris2: "#1e56b0", trim: "#5aa7ff", glow: "#5aa7ff", gear: "hat",
  },
  guardian: {
    bg1: "#0f5c44", bg2: "#06251b",
    hairHi: "#8df0c6", hairMid: "#34d399", hairLo: "#0d9d6d", hairShadow: "#0a7a55",
    iris1: "#7defbf", iris2: "#0c7a54", trim: "#34d399", glow: "#2bd598", gear: "bandana",
  },
  shadow: {
    bg1: "#241a45", bg2: "#0a0716",
    hairHi: "#4a5570", hairMid: "#262e42", hairLo: "#161c2c", hairShadow: "#0d1220",
    iris1: "#a5f3ff", iris2: "#0891b2", trim: "#22d3ee", glow: "#22d3ee", gear: "aura",
  },
};

const SKIN_TONE = "#f6c9a0";
const SKIN_SHADE = "#dfa273";
const LINE = "#241309";

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
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const key = character ?? "warrior";
  const s = SKINS[key] ?? SKINS.warrior;
  const hooded = s.gear === "hood";

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label={`${key} avatar`} role="img">
      <defs>
        <clipPath id={`clip${uid}`}>
          <circle cx="60" cy="60" r="52" />
        </clipPath>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={s.bg1} />
          <stop offset="100%" stopColor={s.bg2} />
        </linearGradient>
        <linearGradient id={`hair${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.hairHi} />
          <stop offset="48%" stopColor={s.hairMid} />
          <stop offset="100%" stopColor={s.hairLo} />
        </linearGradient>
        <linearGradient id={`jacket${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c2d33" />
          <stop offset="100%" stopColor="#121216" />
        </linearGradient>
        <radialGradient id={`iris${uid}`} cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor={s.iris1} />
          <stop offset="100%" stopColor={s.iris2} />
        </radialGradient>
        <linearGradient id={`ring${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ringColor ?? s.glow} />
          <stop offset="100%" stopColor={ringColor ?? s.hairLo} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#clip${uid})`}>
        {/* vivid backdrop with glow + sparkles */}
        <rect width="120" height="120" fill={`url(#bg${uid})`} />
        <circle cx="60" cy="42" r="34" fill={s.glow} opacity="0.24" />
        <path d="M8 118 88 8h14L20 118Z" fill="#ffffff" opacity="0.05" />
        <circle cx="24" cy="30" r="1.6" fill="#fff" opacity="0.55" />
        <circle cx="98" cy="24" r="1.2" fill="#fff" opacity="0.4" />
        <circle cx="90" cy="88" r="1.4" fill="#fff" opacity="0.3" />
        <circle cx="17" cy="76" r="1.1" fill="#fff" opacity="0.35" />

        {s.gear === "aura" && (
          <g opacity="0.8">
            <path d="M22 96c-4-12-2-22 5-31-1 10 1 17 6 22" fill="none" stroke={s.glow} strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
            <path d="M98 98c5-13 3-24-4-33 1 10-1 18-6 23" fill="none" stroke={s.glow} strokeWidth="2.4" strokeLinecap="round" opacity="0.45" />
            <path d="M14 70c-2-9 0-16 5-22-1 7 0 12 3 16" fill="none" stroke="#8b6cf5" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <circle cx="27" cy="52" r="1.6" fill={s.glow} opacity="0.8" />
            <circle cx="95" cy="58" r="1.8" fill={s.glow} opacity="0.7" />
            <circle cx="102" cy="44" r="1.2" fill="#8b6cf5" opacity="0.7" />
          </g>
        )}

        {/* jacket: high collar streetwear with neon trim */}
        <path d="M12 122c2-24 16-36 48-36s46 12 48 36Z" fill={`url(#jacket${uid})`} stroke="#000" strokeWidth="1" strokeOpacity="0.35" />
        <path d="M41 94 52 86l8 7 8-7 11 8-6 28H47Z" fill="#1b1c21" />
        <path d="M52 86l8 7 8-7" fill="none" stroke={s.trim} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M43 93l9-7M77 93l-9-7" fill="none" stroke="#3a3b42" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M60 93v29" stroke="#08080a" strokeWidth="2.2" />
        <path d="M60 93v29" stroke={s.trim} strokeWidth="0.9" opacity="0.75" />
        <path d="M24 108c4-7 10-12 18-15M96 108c-4-7-10-12-18-15" fill="none" stroke="#3a3b42" strokeWidth="1.6" strokeLinecap="round" />
        {s.gear === "bandana" && (
          <g>
            <path d="M34 101c7-6 16-9 26-9s19 3 26 9l-4 6c-6-5-13-7-22-7s-16 2-22 7Z" fill="#20302a" stroke={s.trim} strokeWidth="1.4" />
            <path d="M46 95l4 9M60 92v10M74 95l-4 9" stroke={s.trim} strokeWidth="1.3" opacity="0.7" />
          </g>
        )}

        {/* neck with cel shadow */}
        <path d="M52 76h16v15c-2.6 2.6-5.3 3.9-8 3.9s-5.4-1.3-8-3.9Z" fill={SKIN_TONE} stroke={LINE} strokeWidth="0.8" strokeOpacity="0.5" />
        <path d="M52 76h16v6.5c-2.7 2.1-5.4 3.1-8 3.1s-5.3-1-8-3.1Z" fill={SKIN_SHADE} />

        {/* back hair spikes */}
        {!hooded && (
          <path
            d="M60 14c-7 0-13 2-18 6l-4-3 1 7c-4 4-7 9-8 15l-5-2 4 6c-1 5-1 10 1 15l-4 1 6 3c1 4 3 7 5 10l3-8c-2-6-3-12-2-18 1-8 5-15 11-19l3 5 3-7c2-1 3-1 4-1s2 0 4 1l3 7 3-5c6 4 10 11 11 19 1 6 0 12-2 18l3 8c2-3 4-6 5-10l6-3-4-1c2-5 2-10 1-15l4-6-5 2c-1-6-4-11-8-15l1-7-4 3c-5-4-11-6-18-6Z"
            fill={`url(#hair${uid})`}
            stroke={s.hairShadow}
            strokeWidth="1"
          />
        )}

        {/* face: sharp anime jaw */}
        <path
          d="M37 46c0-17 10-26 23-26s23 9 23 26c0 8-2.1 14.2-5.8 19.6C73.6 71 67.6 81 60 81s-13.6-10-17.2-15.4C39.1 60.2 37 54 37 46Z"
          fill={SKIN_TONE}
          stroke={LINE}
          strokeWidth="1.1"
          strokeOpacity="0.55"
        />
        {/* ears */}
        <path d="M35.8 51c-3-.8-4.8 1.3-4.2 4.4.6 2.7 2.8 4.4 5.4 3.8Z" fill={SKIN_TONE} stroke={LINE} strokeWidth="0.8" strokeOpacity="0.4" />
        <path d="M84.2 51c3-.8 4.8 1.3 4.2 4.4-.6 2.7-2.8 4.4-5.4 3.8Z" fill={SKIN_TONE} stroke={LINE} strokeWidth="0.8" strokeOpacity="0.4" />
        {/* hard-edged bang shadow across the forehead */}
        <path d="M39 45l5 5 5-6 6 6 5-7 6 7 5-6 5 6 4-5c-.5 4-1.5 6.5-3 9H43c-2-2.6-3.3-5.6-4-9Z" fill={SKIN_SHADE} opacity="0.55" />
        {/* jaw cel shade */}
        <path d="M48 74c3.6 3.4 7.6 5.1 12 5.1s8.4-1.7 12-5.1c-3 5-7 9-12 9s-9-4-12-9Z" fill={SKIN_SHADE} opacity="0.5" />

        {/* brows: bold, determined */}
        <path d="M40.5 50.5l11.5-2.6" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M79.5 50.5l-11.5-2.6" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />

        {/* eyes: big, sharp lashes, double highlight */}
        <g>
          <ellipse cx="47" cy="60.5" rx="6" ry="7" fill="#ffffff" stroke={LINE} strokeWidth="0.7" strokeOpacity="0.35" />
          <ellipse cx="47.7" cy="61" rx="4.3" ry="5.7" fill={`url(#iris${uid})`} />
          <ellipse cx="47.7" cy="61.4" rx="2" ry="3" fill="#0d0805" />
          <circle cx="45.7" cy="58.3" r="1.8" fill="#fff" />
          <circle cx="49.6" cy="63.6" r="0.9" fill="#fff" opacity="0.85" />
          <path d="M39.8 55.5c3.2-3 8.4-3.6 13.4-1.6" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
          <path d="M40 56.5l-2 2.4" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M42 67.5c2.6 1.2 5.4 1.4 8.2.7" fill="none" stroke={SKIN_SHADE} strokeWidth="1.3" strokeLinecap="round" />
        </g>
        <g>
          <ellipse cx="73" cy="60.5" rx="6" ry="7" fill="#ffffff" stroke={LINE} strokeWidth="0.7" strokeOpacity="0.35" />
          <ellipse cx="72.3" cy="61" rx="4.3" ry="5.7" fill={`url(#iris${uid})`} />
          <ellipse cx="72.3" cy="61.4" rx="2" ry="3" fill="#0d0805" />
          <circle cx="70.3" cy="58.3" r="1.8" fill="#fff" />
          <circle cx="74.2" cy="63.6" r="0.9" fill="#fff" opacity="0.85" />
          <path d="M80.2 55.5c-3.2-3-8.4-3.6-13.4-1.6" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" />
          <path d="M80 56.5l2 2.4" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M78 67.5c-2.6 1.2-5.4 1.4-8.2.7" fill="none" stroke={SKIN_SHADE} strokeWidth="1.3" strokeLinecap="round" />
        </g>
        {s.gear === "aura" && (
          <g>
            <ellipse cx="47" cy="60.5" rx="7.6" ry="8.6" fill={s.glow} opacity="0.22" />
            <ellipse cx="73" cy="60.5" rx="7.6" ry="8.6" fill={s.glow} opacity="0.22" />
          </g>
        )}

        {/* nose + mouth */}
        <path d="M60.5 63.5l1.6 5.2-2.6.4" fill="none" stroke={SKIN_SHADE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M55 74c3.2 2 7.2 1.9 10-.4" fill="none" stroke="#7c4024" strokeWidth="2" strokeLinecap="round" />
        <path d="M57.5 77.6c1.7.8 3.4.8 5 .1" fill="none" stroke={SKIN_SHADE} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

        {/* front bangs: spiky, cel-shaded, clean outline */}
        {!hooded && (
          <>
            <path
              d="M36 50c-1-5-1-10 1-14 2-5 6-9 11-11l-1 8 7-10 3 8 4-9 4 9 3-8 7 10-1-8c5 2 9 6 11 11 2 4 2 9 1 14l-6-9 1 9-7-9v8l-8-9-2 8-5-9-5 9-2-8-8 9v-8l-7 9 1-9Z"
              fill={`url(#hair${uid})`}
              stroke={s.hairShadow}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path d="M43 33c4.5-4.5 10.2-6.8 17-6.8s12.5 2.3 17 6.8c-5-2.8-10.6-4.2-17-4.2s-12 1.4-17 4.2Z" fill="#ffffff" opacity="0.28" />
          </>
        )}

        {/* gear */}
        {s.gear === "headband" && (
          <g>
            <path d="M35 42.5c8-4.4 42-4.4 50 0l-.7 6c-9-3.9-39.6-3.9-48.6 0Z" fill="#232326" stroke="#000" strokeWidth="0.8" strokeOpacity="0.4" />
            <path d="M35.6 45.4c8.5-3.5 40.3-3.5 48.8 0" fill="none" stroke={s.trim} strokeWidth="2.2" strokeLinecap="round" />
            <rect x="54" y="40.2" width="12" height="7" rx="1.6" fill="#3a3b42" stroke="#0c0c0e" strokeWidth="0.9" />
            <path d="M56 42h8" stroke={s.trim} strokeWidth="1.4" strokeLinecap="round" />
          </g>
        )}
        {s.gear === "bandana" && (
          <g>
            <path d="M35 42c8-4.4 42-4.4 50 0l-.7 6.5c-9-3.9-39.6-3.9-48.6 0Z" fill="#20302a" stroke="#000" strokeWidth="0.8" strokeOpacity="0.4" />
            <path d="M35.6 45.2c8.5-3.5 40.3-3.5 48.8 0" fill="none" stroke={s.trim} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M84 44l8 6-4.5 3-6-6M88 50l6 8-5 1.5-4.5-7" fill="#20302a" stroke={s.trim} strokeWidth="1" />
          </g>
        )}
        {s.gear === "hat" && (
          <g>
            <path d="M20 46c11-3.6 69-3.6 80 0l-2.2 5.6c-23-4.6-52.6-4.6-75.6 0Z" fill="#1c2947" stroke="#000" strokeWidth="0.9" strokeOpacity="0.4" />
            <path d="M34 44.5C36.5 25 46 12 62 7.5c-2.8 5.2-3.8 10-3 14.2 4.8-6.8 10.9-10.9 18.3-12.3-4.1 5.9-6.1 11.2-6 16 4-2.3 8.3-3.1 12.9-2.5-7 5.1-10.1 12.8-9.4 23Z" fill="#243459" stroke="#111a30" strokeWidth="1" />
            <path d="M34 44.5c15-3.1 33.8-3.1 40.8 0" fill="none" stroke={s.trim} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M60.5 18l2.3 5 5 2.3-5 2.3-2.3 5-2.3-5-5-2.3 5-2.3Z" fill={s.trim} opacity="0.95" />
          </g>
        )}
        {hooded && (
          <g>
            <path
              d="M25 64C22 36 37 18 60 18s38 18 35 46c-1.7-2.8-3.6-4.9-5.7-6.3.9-19-10.4-30-29.3-30S29.8 38.7 30.7 57.7c-2.1 1.4-4 3.5-5.7 6.3Z"
              fill={`url(#hair${uid})`}
              stroke={s.hairShadow}
              strokeWidth="1.1"
            />
            <path d="M30.7 57.7C29.8 38.7 41.1 27.7 60 27.7s30.2 11 29.3 30c-2.9-2.3-6.2-3.6-10-4-5.8-.7-32.8-.7-38.6 0-3.8.4-7.1 1.7-10 4Z" fill={s.hairShadow} opacity="0.55" />
            <path d="M40.4 53.4c5.6-.6 33.6-.6 39.2 0" fill="none" stroke={s.trim} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            <path d="M42 53c3.4-5.4 7.8-8.2 13.2-8.4-2 2.2-3.2 4.5-3.6 7M78 53c-3.4-5.4-7.8-8.2-13.2-8.4 2 2.2 3.2 4.5 3.6 7" fill="none" stroke={s.hairLo} strokeWidth="2.6" strokeLinecap="round" />
          </g>
        )}
        {s.gear === "aura" && (
          <path d="M40 30l4-8 3 6 5-9 4 7 4-10 4 10 4-7 5 9 3-6 4 8" fill="none" stroke={s.hairHi} strokeWidth="1.2" opacity="0.5" />
        )}
      </g>

      {ring && (
        <>
          <circle cx="60" cy="60" r="52" fill="none" stroke={`url(#ring${uid})`} strokeWidth="3.5" />
          <circle cx="60" cy="60" r="56.5" fill="none" stroke={ringColor ?? s.glow} strokeWidth="1" opacity="0.35" />
        </>
      )}
    </svg>
  );
}
