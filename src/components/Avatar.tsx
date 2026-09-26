"use client";

import { useId } from "react";
import type { CharacterKey } from "@/lib/game";

// Anime-style challenger portraits, one skin per character, drawn as inline
// SVG. Shared face rig with per-character palette and headgear:
// warrior (headband), mentalist (violet hood), wizard (pointed hat),
// guardian (bandana + armored collar), shadow (dark hood, glowing eyes).

type Skin = {
  hairHi: string;
  hairMid: string;
  hairLo: string;
  hairShadow: string;
  iris: string;
  trim: string;
  glow: string;
  gear: "headband" | "hood" | "hat" | "bandana";
};

const SKINS: Record<CharacterKey, Skin> = {
  warrior: {
    hairHi: "#ffb14d", hairMid: "#ff8b1f", hairLo: "#e85f00", hairShadow: "#c95400",
    iris: "#b35309", trim: "#ff7a00", glow: "#ff6b00", gear: "headband",
  },
  mentalist: {
    hairHi: "#c9bcff", hairMid: "#a78bfa", hairLo: "#7c5ce8", hairShadow: "#6647c9",
    iris: "#7c5ce8", trim: "#a78bfa", glow: "#8b6cf5", gear: "hood",
  },
  wizard: {
    hairHi: "#eef3fa", hairMid: "#c2d0e4", hairLo: "#93a9c6", hairShadow: "#7e94b3",
    iris: "#3f7fd6", trim: "#5aa7ff", glow: "#5aa7ff", gear: "hat",
  },
  guardian: {
    hairHi: "#7fe9bd", hairMid: "#34d399", hairLo: "#0ea371", hairShadow: "#0b8a60",
    iris: "#0e9f70", trim: "#34d399", glow: "#2bd598", gear: "bandana",
  },
  shadow: {
    hairHi: "#3d4a63", hairMid: "#2a3448", hairLo: "#1b2333", hairShadow: "#141a28",
    iris: "#22d3ee", trim: "#22d3ee", glow: "#22d3ee", gear: "hood",
  },
};

export default function Avatar({
  character = "warrior",
  size = 96,
  ring = true,
}: {
  character?: CharacterKey | null;
  size?: number;
  ring?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const s = SKINS[character ?? "warrior"] ?? SKINS.warrior;
  const hooded = s.gear === "hood";

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label={`${character ?? "warrior"} avatar`} role="img">
      <defs>
        <clipPath id={`clip${uid}`}>
          <circle cx="60" cy="60" r="52" />
        </clipPath>
        <radialGradient id={`bg${uid}`} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor={s.hairShadow} stopOpacity="0.55" />
          <stop offset="55%" stopColor="#191512" />
          <stop offset="100%" stopColor="#0d0c0a" />
        </radialGradient>
        <linearGradient id={`hair${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={s.hairHi} />
          <stop offset="55%" stopColor={s.hairMid} />
          <stop offset="100%" stopColor={s.hairLo} />
        </linearGradient>
        <linearGradient id={`jacket${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e2e33" />
          <stop offset="100%" stopColor="#141417" />
        </linearGradient>
        <linearGradient id={`ring${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={s.glow} />
          <stop offset="100%" stopColor={s.hairLo} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#clip${uid})`}>
        <rect width="120" height="120" fill={`url(#bg${uid})`} />
        <circle cx="60" cy="26" r="30" fill={s.glow} opacity="0.13" />

        {/* jacket / shoulders */}
        <path d="M14 122c3-25 17-36 46-36s43 11 46 36Z" fill={`url(#jacket${uid})`} />
        <path d="M45 90l15 14 15-14" fill="none" stroke={s.trim} strokeWidth="3" strokeLinecap="round" />
        <path d="M23 112c8-9 21-13 37-13s29 4 37 13" fill="none" stroke="#3c3c42" strokeWidth="2" />
        {s.gear === "bandana" && (
          <path d="M30 103c9-6 20-9 30-9s21 3 30 9" fill="none" stroke={s.trim} strokeWidth="2.4" opacity="0.8" />
        )}

        {/* neck */}
        <path d="M52 78h16v16c-2.6 2.8-5.3 4.2-8 4.2s-5.4-1.4-8-4.2Z" fill="#e8b088" />
        <path d="M52 78h16v7c-2.7 2.2-5.4 3.3-8 3.3s-5.3-1.1-8-3.3Z" fill="#c98d63" />

        {/* face */}
        <path d="M35 47c0-16 11-25 25-25s25 9 25 25c0 7-1.6 13.8-5 19-3.9 6-11 12.5-20 12.5S43.9 72 40 66c-3.4-5.2-5-12-5-19Z" fill="#f4c9a2" />
        <path d="M34.5 52c-3.4-.6-5 1.8-4.2 5 .7 2.8 3 4.6 5.8 4.1Z" fill="#f4c9a2" />
        <path d="M85.5 52c3.4-.6 5 1.8 4.2 5-.7 2.8-3 4.6-5.8 4.1Z" fill="#f4c9a2" />

        {/* eyes */}
        <path d="M40 54.5c3.4-2.6 8.2-2.9 12-1" fill="none" stroke="#20140c" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M68 53.5c3.8-1.9 8.6-1.6 12 1" fill="none" stroke="#20140c" strokeWidth="2.8" strokeLinecap="round" />
        <g>
          <ellipse cx="46.5" cy="60.5" rx="4.6" ry="5.6" fill="#ffffff" />
          <ellipse cx="47.2" cy="61" rx="3.1" ry="4.2" fill={s.iris} />
          <ellipse cx="47.2" cy="61" rx="1.7" ry="2.6" fill="#120b06" />
          <circle cx="45.9" cy="59" r="1.1" fill="#ffffff" />
        </g>
        <g>
          <ellipse cx="73.5" cy="60.5" rx="4.6" ry="5.6" fill="#ffffff" />
          <ellipse cx="72.8" cy="61" rx="3.1" ry="4.2" fill={s.iris} />
          <ellipse cx="72.8" cy="61" rx="1.7" ry="2.6" fill="#120b06" />
          <circle cx="71.5" cy="59" r="1.1" fill="#ffffff" />
        </g>
        {character === "shadow" && (
          <>
            <ellipse cx="47" cy="61" rx="5.5" ry="6.5" fill={s.iris} opacity="0.18" />
            <ellipse cx="73" cy="61" rx="5.5" ry="6.5" fill={s.iris} opacity="0.18" />
          </>
        )}

        {/* nose + mouth + cheeks */}
        <path d="M60 64.5v4.5" stroke="#d19a6e" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M55.5 74.5c2.8 1.8 6.2 1.8 9 0" fill="none" stroke="#8a4a2c" strokeWidth="2" strokeLinecap="round" />
        <path d="M41 66c1.8 1 3.4 1.2 5 .8M74 66.8c1.6.4 3.2.2 5-.8" stroke="#e5a877" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />

        {/* hair */}
        {!hooded && (
          <>
            <path
              d="M28 52c-2-14 3-24 11-29-1 3-1 5.5 0 7.5 2-6 6-10 12-12-1.5 2.8-2 5.2-1.5 7.2 3.5-4.5 8-7 14-7.5-2 2.5-3 5-3 7.5 4-3 8.5-4.2 13.5-3.5-2.4 1.8-4 3.8-4.8 6 5-1.5 9.6-.7 14 2.5-2.8.6-5 1.6-6.5 3 6 1 9.8 4.3 11.5 10-2.6-1.3-5-1.9-7.4-1.7 3.4 3.4 4.6 8 3.7 13.5l-5.5-7c.3 2.8-.2 5.3-1.5 7.5-1.6-6.3-4.4-10.6-8.5-13-8.6-5-25.4-5-33.4 1-3 2.3-5 6.2-6.1 11.5-1.4-2.7-2-5.3-1.7-8l-5.3 6c-.6-5.2.8-9.4 4-12.7-2.3-.1-4.5.5-6.7 1.7 1.8-5.4 4.5-8.6 8.2-9.5Z"
              fill={`url(#hair${uid})`}
            />
            <path
              d="M36 49c2.5-5.5 7-8.7 13.5-9.7-1.5 1.9-2.3 3.8-2.5 5.7 3.4-3.4 7.6-5.2 12.6-5.5-1.3 1.8-2 3.6-2.1 5.5 3.8-2.6 8-3.4 12.5-2.4-1.9 1.3-3.2 2.8-4 4.4 4.4-.6 8.2.6 11.5 3.6-9-3.6-32.6-3.6-41.5 0Z"
              fill={s.hairShadow}
              opacity="0.55"
            />
          </>
        )}

        {/* gear */}
        {s.gear === "headband" && (
          <>
            <path d="M33.5 45c8-4.5 45-4.5 53 0l-.8 6c-9-4-42.4-4-51.4 0Z" fill="#232326" />
            <path d="M34.2 47.8c8.5-3.6 43.1-3.6 51.6 0" fill="none" stroke={s.trim} strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}
        {s.gear === "bandana" && (
          <>
            <path d="M33.5 44.5c8-4.5 45-4.5 53 0l-.8 6.5c-9-4-42.4-4-51.4 0Z" fill="#1a2b24" />
            <path d="M34.2 47.6c8.5-3.6 43.1-3.6 51.6 0" fill="none" stroke={s.trim} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M85 46l7 7-4 2.5-5.5-6.5" fill="#1a2b24" stroke={s.trim} strokeWidth="1" />
          </>
        )}
        {s.gear === "hat" && (
          <>
            <path d="M22 47c10-3.4 66-3.4 76 0l-2 5.5c-22-4.5-50-4.5-72 0Z" fill="#1e2a4a" />
            <path d="M35 45.5C38 26 47 13.5 62 9c-2.5 5-3.4 9.5-2.8 13.5 4.6-6.5 10.4-10.4 17.3-11.7-3.9 5.6-5.8 10.7-5.7 15.2 3.8-2.2 7.9-3 12.2-2.4-6.6 4.9-9.6 12.2-9 21.9Z" fill="#243459" />
            <path d="M35 45.5c14-3 32-3 39.9 0" fill="none" stroke={s.trim} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M60.5 20.5l2.2 4.8 4.8 2.2-4.8 2.2-2.2 4.8-2.2-4.8-4.8-2.2 4.8-2.2Z" fill={s.trim} opacity="0.9" />
          </>
        )}
        {hooded && (
          <>
            <path
              d="M26 62C24 36 38 20 60 20s36 16 34 42c-1.6-2.6-3.4-4.6-5.4-6 .8-18-10-28.5-28.6-28.5S30.6 38 31.4 56c-2 1.4-3.8 3.4-5.4 6Z"
              fill={`url(#hair${uid})`}
            />
            <path d="M31.4 56C30.6 38 41.4 27.5 60 27.5S89.4 38 88.6 56c-2.8-2.2-6-3.4-9.6-3.8-5.6-.7-32.4-.7-38 0-3.6.4-6.8 1.6-9.6 3.8Z" fill={s.hairShadow} opacity="0.6" />
            <path d="M40.6 52c5.4-.6 33.4-.6 38.8 0" fill="none" stroke={s.trim} strokeWidth="2" strokeLinecap="round" opacity="0.9" />
            {/* hair peeking out of the hood */}
            <path d="M42 52c4-4.5 8.5-6.7 13.5-6.5-2 1.9-3.2 3.9-3.6 6M78 52c-4-4.5-8.5-6.7-13.5-6.5 2 1.9 3.2 3.9 3.6 6" fill="none" stroke={s.hairLo} strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
      </g>

      {ring && (
        <>
          <circle cx="60" cy="60" r="52" fill="none" stroke={`url(#ring${uid})`} strokeWidth="3.5" />
          <circle cx="60" cy="60" r="56.5" fill="none" stroke={s.glow} strokeWidth="1" opacity="0.35" />
        </>
      )}
    </svg>
  );
}
