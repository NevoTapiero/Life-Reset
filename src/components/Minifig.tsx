"use client";

import { useId } from "react";

// A whole LEGO minifig, front view, as SVG: stud, head, torso with its print,
// arms with C-shaped hands, hips, legs, standing on a black 3x4 stand plate.
// Dressed by character; gear unlocks by LEGO level:
//   L2 the character's item in the right hand, L3 a gold belt, L4 a cape,
//   L5 a gold crown.

type Outfit = {
  hair: string;
  torso: string;
  torsoEdge: string;
  legs: string;
  hips: string;
  print: string; // torso print colour
  head: "hair" | "hood" | "hat" | "bandana" | "spikes";
  item: "sword" | "book" | "staff" | "spear" | "katana";
  cape: string;
  extra?: string;
};

const OUTFITS: Record<string, Outfit> = {
  warrior: { hair: "#a95500", torso: "#c91a09", torsoEdge: "#8a1206", legs: "#1b2a34", hips: "#05131d", print: "#e4cd9e", head: "hair", item: "sword", cape: "#0055bf" },
  mentalist: { hair: "#81007b", torso: "#8e5bb0", torsoEdge: "#5d3a78", legs: "#5d3a78", hips: "#3f2553", print: "#e4cdf0", head: "hood", item: "book", cape: "#81007b" },
  wizard: { hair: "#0a3463", torso: "#0a3463", torsoEdge: "#05213f", legs: "#0a3463", hips: "#05213f", print: "#f2cd37", head: "hat", item: "staff", cape: "#5a93db", extra: "#f2cd37" },
  guardian: { hair: "#237841", torso: "#237841", torsoEdge: "#16502b", legs: "#958a73", hips: "#6b6150", print: "#a0a5a9", head: "bandana", item: "spear", cape: "#4b9f4a" },
  shadow: { hair: "#1b2a34", torso: "#1b2a34", torsoEdge: "#05131d", legs: "#1b2a34", hips: "#05131d", print: "#0055bf", head: "spikes", item: "katana", cape: "#0055bf", extra: "#0055bf" },
};

const SKIN = "#f2cd37";
const SKIN_SHADE = "#d9b320";
const GOLD = "#f2cd37";

export default function Minifig({
  character,
  level = 1,
  size = 180,
  className,
  alive = false,
  sleepy = false,
}: {
  character?: string | null;
  level?: number;
  /** height in px */
  size?: number;
  className?: string;
  /** idle life: blinks, breathes, the item arm sways */
  alive?: boolean;
  /** eyes shut and z's floating up (bedtime) */
  sleepy?: boolean;
}) {
  const o = OUTFITS[character ?? "warrior"] ?? OUTFITS.warrior;
  const id = useId().replace(/:/g, "");
  const shade = `url(#${id}-shade)`;
  return (
    <svg viewBox="0 0 120 170" height={size} width={(size * 120) / 170} className={[className, alive ? "mf-alive" : ""].filter(Boolean).join(" ") || undefined} aria-hidden style={{ display: "block", overflow: "visible" }}>
      <defs>
        {/* one cylinder shade for every part: lit left, darker right */}
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <linearGradient id={`${id}-blade`} x1="0" x2="1">
          <stop offset="0" stopColor="#e8eef3" />
          <stop offset="1" stopColor="#a0a5a9" />
        </linearGradient>
      </defs>

      {/* cape, behind everything (level 4+) */}
      {level >= 4 && <path d="M40 58h40l10 96H30Z" fill={o.cape} />}
      {level >= 4 && <path d="M40 58h40l10 96H30Z" fill="#000" opacity="0.18" />}

      {/* stand: a black 3x4 plate */}
      <ellipse cx="60" cy="164" rx="40" ry="4.5" fill="#000" opacity="0.18" />
      <rect x="22" y="153" width="76" height="9" rx="2.5" fill="#1b2a34" />
      <rect x="22" y="153" width="76" height="3" rx="1.5" fill="#3d4e5a" />

      {/* each part is its own group, so it can fall off and snap back */}
      <g className="mf-legs">
      {/* legs */}
      <rect x="36" y="112" width="23" height="36" rx="2" fill={o.legs} />
      <rect x="61" y="112" width="23" height="36" rx="2" fill={o.legs} />
      <rect x="34" y="144" width="26" height="10" rx="2.5" fill={o.legs} />
      <rect x="60" y="144" width="26" height="10" rx="2.5" fill={o.legs} />
      <rect x="36" y="112" width="48" height="42" fill={shade} />
      {/* hips */}
      <rect x="35" y="103" width="50" height="11" rx="2" fill={o.hips} />
      <rect x="57" y="106" width="6" height="8" rx="1" fill="#000" opacity="0.25" />
      </g>

      <g className="mf-torso">
      {/* neck */}
      <rect x="52" y="52" width="16" height="8" rx="2" fill={SKIN_SHADE} />
      {/* torso: a trapezoid, wider at the hips */}
      <path d="M44 58h32l10 46H34Z" fill={o.torso} />
      <path d="M44 58h32l10 46H34Z" fill={shade} />
      <path d="M34 104h52v-3H35Z" fill={o.torsoEdge} />
      {/* torso print: V neck + the character's emblem */}
      <path d="M53 58l7 10 7-10" fill="none" stroke={o.print} strokeWidth="2.2" strokeLinejoin="round" />
      <Emblem character={character} color={o.print} />
      {/* gold belt (level 3+) */}
      {level >= 3 && (
        <>
          <rect x="35.5" y="96" width="49" height="5" rx="1" fill={GOLD} />
          <rect x="56.5" y="95" width="7" height="7" rx="1.5" fill="#b88a06" />
        </>
      )}
      </g>

      {/* arms: from the shoulders, angled out, yellow C-clip hands; the
          right hand (the viewer's left) holds the item from level 2 */}
      <g className="mf-arm-l">
        <path d="M44 60c-6 1-9 4-11 10l-5 20 9 3 5-18c1-5 2-9 2-15Z" fill={o.torso} />
        <path d="M44 60c-6 1-9 4-11 10l-5 20 9 3 5-18c1-5 2-9 2-15Z" fill="#fff" opacity="0.14" />
        <Hand x={31} y={96} />
        {level >= 2 && <Item kind={o.item} extra={o.extra} blade={`url(#${id}-blade)`} />}
      </g>
      <g className="mf-arm-r">
        <path d="M76 60c6 1 9 4 11 10l5 20-9 3-5-18c-1-5-2-9-2-15Z" fill={o.torso} />
        <path d="M76 60c6 1 9 4 11 10l5 20-9 3-5-18c-1-5-2-9-2-15Z" fill="#000" opacity="0.14" />
        <Hand x={89} y={96} flip />
      </g>

      <g className="mf-head">
      {/* head: stud + rounded cylinder */}
      <rect x="51" y="8" width="18" height="8" rx="2.5" fill={SKIN_SHADE} />
      <rect x="41" y="14" width="38" height="40" rx="11" fill={SKIN} />
      <rect x="41" y="14" width="38" height="40" rx="11" fill={shade} />
      {/* face: a two-sided head, like real minifigs. The calm side shows;
          the shocked side flashes while the minifig falls apart. */}
      <g className="mf-calm">
        {sleepy ? (
          <path d="M49.5 31.5c2 2.2 5 2.2 7 0M63.5 31.5c2 2.2 5 2.2 7 0" fill="none" stroke="#1b2a34" strokeWidth="2.2" strokeLinecap="round" />
        ) : (
          <g className="mf-eyes">
            <ellipse cx="53" cy="32" rx="2.8" ry="3.4" fill="#1b2a34" />
            <ellipse cx="67" cy="32" rx="2.8" ry="3.4" fill="#1b2a34" />
            <circle cx="54" cy="30.8" r="1" fill="#fff" />
            <circle cx="68" cy="30.8" r="1" fill="#fff" />
          </g>
        )}
        <FacePrint character={character} />
      </g>
      <g className="mf-shock" style={{ display: "none" }}>
        <circle cx="53" cy="31" r="4.4" fill="#fff" stroke="#1b2a34" strokeWidth="1.6" />
        <circle cx="67" cy="31" r="4.4" fill="#fff" stroke="#1b2a34" strokeWidth="1.6" />
        <circle cx="53" cy="31.5" r="1.7" fill="#1b2a34" />
        <circle cx="67" cy="31.5" r="1.7" fill="#1b2a34" />
        <path d="M49 24.5l6-2M71 24.5l-6-2" stroke="#1b2a34" strokeWidth="1.8" strokeLinecap="round" />
        <ellipse cx="60" cy="43" rx="4" ry="4.6" fill="#1b2a34" />
        <ellipse cx="60" cy="44.6" rx="2.4" ry="2" fill="#c91a09" />
      </g>
      <HeadGear o={o} />

      {/* gold crown (level 5) */}
      {level >= 5 && (
        <path d="M44 6l5 7 5-9 6 9 6-9 5 9 5-7-2 12H46Z" fill={GOLD} stroke="#b88a06" strokeWidth="1.2" strokeLinejoin="round" transform={o.head === "hat" ? "translate(0 -10)" : o.head === "spikes" ? "translate(0 -6)" : undefined} />
      )}
      </g>
      {sleepy && (
        <g className="mf-zzz" fill="#0055bf" stroke="#fff" strokeWidth="3" paintOrder="stroke" fontFamily="var(--font-brick), sans-serif" fontWeight="700">
          <text x="80" y="38" fontSize="26">z</text>
          <text x="96" y="20" fontSize="20">z</text>
          <text x="108" y="6" fontSize="15">z</text>
        </g>
      )}
    </svg>
  );
}

// each character's printed face: brows, lashes, a beard, and the mouth
export function FacePrint({ character }: { character?: string | null }) {
  const ink = { fill: "none", stroke: "#1b2a34", strokeLinecap: "round" as const };
  switch (character ?? "warrior") {
    case "wizard":
      // a white beard hides the mouth; bushy brows
      return (
        <>
          <path d="M48.5 26.5c2.5-1.6 5-1.8 7.5-.8M71.5 26.5c-2.5-1.6-5-1.8-7.5-.8" {...ink} strokeWidth="2.2" />
          <path d="M45 37c4 2.6 9 3.2 15 3.2s11-.6 15-3.2c1.5 11-3.5 23-15 29-11.5-6-16.5-18-15-29Z" fill="#f4f4f0" />
          <path d="M60 44v18M54 43.5c.5 6 2 11 4 15M66 43.5c-.5 6-2 11-4 15" stroke="#d6d6cf" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M50.5 38.5c3.2-1.8 6.4-1.6 9.5.6 3.1-2.2 6.3-2.4 9.5-.6-2 3-6 3.6-9.5 1.4-3.5 2.2-7.5 1.6-9.5-1.4Z" fill="#e0e0da" />
        </>
      );
    case "mentalist":
      // lashes and a calm smile
      return (
        <>
          <path d="M49.5 29.5l-2-1.6M50.8 28.4l-1-2M70.5 29.5l2-1.6M69.2 28.4l1-2" {...ink} strokeWidth="1.2" />
          <path d="M53 40.5c4.4 3.2 9.6 3.2 14 0" {...ink} strokeWidth="2.3" />
          <circle cx="49" cy="37.5" r="2.2" fill="#ff9e8a" opacity="0.55" />
          <circle cx="71" cy="37.5" r="2.2" fill="#ff9e8a" opacity="0.55" />
        </>
      );
    case "guardian":
      // thick level brows, a small scar, a firm half smile
      return (
        <>
          <path d="M49 26.5h7.5M63.5 26.5H71" {...ink} strokeWidth="2.6" />
          <path d="M71.5 33l2.5 5" stroke="#c99a06" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M53 41c3.6 1.8 9 1.8 13-1.6" {...ink} strokeWidth="2.5" />
        </>
      );
    case "shadow":
      // under the mask: just the grin
      return <path d="M51.5 40c5 4.6 12 4.6 17 0" {...ink} strokeWidth="2.6" />;
    default:
      // warrior: brows angled in, determined grin with teeth
      return (
        <>
          <path d="M48.5 25.5l7.5 2.2M71.5 25.5 64 27.7" {...ink} strokeWidth="2.4" />
          <path d="M51 39.5c5.5 5.5 12.5 5.5 18 0Z" fill="#1b2a34" stroke="#1b2a34" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M53 40.4c4.5 1.6 9.5 1.6 14 0" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

function Hand({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})${flip ? " scale(-1 1)" : ""}`}>
      <circle cx="0" cy="0" r="6" fill={SKIN} />
      <circle cx="1.5" cy="1.5" r="2.6" fill={SKIN_SHADE} />
      <path d="M0 0l7 5" stroke={SKIN} strokeWidth="3.5" />
    </g>
  );
}

function Emblem({ character, color }: { character?: string | null; color: string }) {
  const c = character ?? "warrior";
  const common = { fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (c === "wizard")
    return <path d="m60 76 2 4.3 4.7.6-3.4 3.2.9 4.6-4.2-2.3-4.2 2.3.9-4.6-3.4-3.2 4.7-.6Z" fill={color} />;
  if (c === "mentalist")
    return (
      <>
        <path d="M49 82c3-5 7-7.5 11-7.5s8 2.5 11 7.5c-3 5-7 7.5-11 7.5s-8-2.5-11-7.5Z" {...common} />
        <circle cx="60" cy="82" r="2.6" fill={color} />
      </>
    );
  if (c === "guardian") return <path d="M60 73l-9 3.5v6c0 5 3.5 8.5 9 10.5 5.5-2 9-5.5 9-10.5v-6Z" {...common} />;
  if (c === "shadow") return <path d="M52 76l16 14M68 76 52 90" {...common} />;
  // warrior: chest plate
  return (
    <>
      <path d="M48 72c4 3 8 4 12 4s8-1 12-4l2 14c-4 3-9 5-14 5s-10-2-14-5Z" {...common} />
      <path d="M60 76v14" {...common} />
    </>
  );
}

function HeadGear({ o }: { o: Outfit }) {
  switch (o.head) {
    case "hood":
      return <path d="M36 56V30c0-15 10-24 24-24s24 9 24 24v26h-6V33c0-8-7-14-18-14s-18 6-18 14v23Z" fill={o.hair} />;
    case "hat":
      return (
        <>
          <path d="M61 -12c-4 6-11 17-17 26h32C71 5 66 -4 61 -12Z" fill={o.hair} />
          <ellipse cx="60" cy="15" rx="25" ry="5" fill={o.hair} />
          <path d="m60.5 0 1.4 3 3.3.4-2.4 2.3.6 3.3-2.9-1.6-2.9 1.6.6-3.3-2.4-2.3 3.3-.4Z" fill={o.extra} />
        </>
      );
    case "bandana":
      return (
        <>
          <path d="M40 26c0-11 9-18 20-18s20 7 20 18v2H40Z" fill={o.hair} />
          <path d="M78 22l11-4-2 10Z" fill={o.hair} />
        </>
      );
    case "spikes":
      return (
        <>
          <path d="M39 28 42 7l6 8 5-13 7 11 6-12 5 12 6-8 3 22Z" fill={o.hair} />
          <rect x="41" y="27" width="38" height="10" rx="4" fill={o.extra} />
          <ellipse cx="53" cy="32" rx="3" ry="2.4" fill="#fff" />
          <ellipse cx="67" cy="32" rx="3" ry="2.4" fill="#fff" />
          <circle cx="53.5" cy="32" r="1.3" fill="#1b2a34" />
          <circle cx="67.5" cy="32" r="1.3" fill="#1b2a34" />
        </>
      );
    default:
      return <path d="M39 31C37 15 47 6 60 6s23 9 21 25c-2.5-6-6-9.5-10.5-11-4.5 4-13.5 5.3-22.5 3-4 1.2-7 4.2-9 8Z" fill={o.hair} />;
  }
}

// the level-2 item, held in the right hand (the viewer's left)
function Item({ kind, extra, blade }: { kind: Outfit["item"]; extra?: string; blade: string }) {
  switch (kind) {
    case "sword":
      return (
        <g transform="translate(31 96) rotate(-20)">
          <rect x="-1.8" y="-44" width="3.6" height="40" rx="1.5" fill={blade} />
          <rect x="-7" y="-5" width="14" height="3" rx="1.2" fill="#a0a5a9" />
          <rect x="-1.5" y="-2" width="3" height="9" rx="1" fill="#5c3d1f" />
        </g>
      );
    case "katana":
      return (
        <g transform="translate(31 96) rotate(-28)">
          <path d="M-1.5 -4c0-14 1-28 4-40 1 12 0 26-1 40Z" fill={extra ?? blade} opacity="0.95" />
          <rect x="-4.5" y="-5" width="9" height="2.6" rx="1" fill="#1b2a34" />
          <rect x="-1.4" y="-2.4" width="2.8" height="10" rx="1" fill="#1b2a34" />
        </g>
      );
    case "staff":
      return (
        <g transform="translate(31 96)">
          <rect x="-1.6" y="-62" width="3.2" height="76" rx="1.4" fill="#7c4a1d" />
          <circle cx="0" cy="-64" r="6" fill={extra ?? "#f2cd37"} />
          <circle cx="-1.6" cy="-66" r="2" fill="#fff" opacity="0.7" />
        </g>
      );
    case "spear":
      return (
        <g transform="translate(31 96)">
          <rect x="-1.4" y="-58" width="2.8" height="74" rx="1.2" fill="#6c6e68" />
          <path d="M0 -70l5 12H-5Z" fill="#a0a5a9" />
        </g>
      );
    case "book":
      return (
        <g transform="translate(24 88) rotate(-10)">
          <rect x="-8" y="-6" width="16" height="12" rx="1.5" fill="#5d3a78" />
          <rect x="-7" y="-5" width="14" height="10" rx="1" fill="#f4f4f0" />
          <path d="M0 -5v10" stroke="#5d3a78" strokeWidth="1.4" />
        </g>
      );
  }
}
