"use client";

import { useId } from "react";

// LEGO icons: every icon is a real brick seen from the front, two studs on
// top, a darker plastic edge along the bottom and a shine along the top, with
// the symbol printed on its face in white (like a printed LEGO tile). The
// symbol is drawn on the same 24px grid as Icon.tsx.

const PRINTS: Record<string, React.ReactNode> = {
  home: <path d="M4.5 11.5 12 5l7.5 6.5M6.8 10v8.5h10.4V10M10.2 18.5v-4.3h3.6v4.3" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="7.2" />
      <path d="M4.8 12h14.4M12 4.8c2 2.1 3 4.5 3 7.2s-1 5.1-3 7.2c-2-2.1-3-4.5-3-7.2s1-5.1 3-7.2Z" />
    </>
  ),
  user: (
    <>
      <path d="M10.2 4.2h3.6" />
      <rect x="6.5" y="6" width="11" height="11.5" rx="3.4" />
      <path d="M10 10.4v.1M14 10.4v.1M9.6 13.6c1.4 1.3 3.4 1.3 4.8 0" />
      <path d="M9.2 20.2h5.6" />
    </>
  ),
  check: <path d="M6 12.5l3.8 3.8L18 8" />,
  plus: <path d="M12 6.5v11M6.5 12h11" />,
  flame: <path d="M12 4c.6 2.6 3.8 4.2 3.8 8a3.8 3.8 0 0 1-7.6 0c0-1.6.7-2.6 1.6-3.4.1 1.3.7 2 1.4 2.3C11 9.1 11.3 6.3 12 4Z" />,
  trophy: (
    <>
      <path d="M8 5h8v4.5a4 4 0 0 1-8 0Z" />
      <path d="M8 7H5.8a2.3 2.3 0 0 0 2.4 3.3M16 7h2.2a2.3 2.3 0 0 1-2.4 3.3M12 13.5V16M9 19h6M10 16h4v3h-4Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="5" y="6.5" width="14" height="12" rx="2" />
      <path d="M5 10.5h14M9 4.8v3.4M15 4.8v3.4" />
    </>
  ),
  plug: <path d="M9 4.5v3.5M15 4.5v3.5M7 8h10v3a5 5 0 0 1-10 0ZM12 16v3.5" />,
  mail: (
    <>
      <rect x="5" y="7" width="14" height="10" rx="1.8" />
      <path d="m5.6 7.8 6.4 5 6.4-5" />
    </>
  ),
  camera: (
    <>
      <path d="M5 9a1.4 1.4 0 0 1 1.4-1.4h2l1.3-1.8h4.6l1.3 1.8h2A1.4 1.4 0 0 1 19 9v7.6a1.4 1.4 0 0 1-1.4 1.4H6.4A1.4 1.4 0 0 1 5 16.6Z" />
      <circle cx="12" cy="12.6" r="2.8" />
    </>
  ),
  chart: <path d="M6 18.5V12M10 18.5V8M14 18.5v-5M18 18.5V6M4.5 18.5h15" />,
  users: (
    <>
      <circle cx="9.5" cy="9" r="2.8" />
      <circle cx="16" cy="10" r="2.2" />
      <path d="M4.8 18c.6-2.7 2.4-4.1 4.7-4.1s4.1 1.4 4.7 4.1M14.6 14.3c2.3-.3 4 .9 4.6 3.4" />
    </>
  ),
  sparkle: <path d="M12 4.5l1.8 5.7 5.7 1.8-5.7 1.8-1.8 5.7-1.8-5.7-5.7-1.8 5.7-1.8Z" />,
  link: (
    <>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l2.3-2.3a3.5 3.5 0 0 0-5-5l-.8.8" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-2.3 2.3a3.5 3.5 0 0 0 5 5l.8-.8" />
    </>
  ),
  play: <path d="M9 6.5v11l8.5-5.5Z" fill="currentColor" />,
  logout: <path d="M13.5 5.5H8A2.5 2.5 0 0 0 5.5 8v8A2.5 2.5 0 0 0 8 18.5h5.5M10.5 12h8M15.5 8.5 19 12l-3.5 3.5" />,
  stud: (
    <>
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <path d="m12 4.8 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7Z" />,
  // the five pillars
  "stat-str": <path d="M7 8v8M4.5 9.8v4.4M17 8v8M19.5 9.8v4.4M7 12h10" />,
  "stat-foc": (
    <>
      <path d="M3.8 12c2-3.6 4.8-5.4 8.2-5.4s6.2 1.8 8.2 5.4c-2 3.6-4.8 5.4-8.2 5.4S5.8 15.6 3.8 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  "stat-con": <path d="M12 18.5c-4.2-2.8-6.8-5.4-6.8-8.5 0-2.3 1.6-3.9 3.7-3.9 1.3 0 2.3.6 3.1 1.7.8-1.1 1.8-1.7 3.1-1.7 2.1 0 3.7 1.6 3.7 3.9 0 3.1-2.6 5.7-6.8 8.5Z" />,
  "stat-dis": (
    <>
      <path d="M12 4.5 6 6.7v4.7c0 3.6 2.3 6.3 6 7.8 3.7-1.5 6-4.2 6-7.8V6.7Z" />
      <path d="m9.4 12 1.8 1.8 3.6-3.7" />
    </>
  ),
  "stat-wis": (
    <>
      <path d="M12 7.5c-1.8-1.3-4-1.7-6.6-1.5v10.4c2.6-.2 4.8.2 6.6 1.5 1.8-1.3 4-1.7 6.6-1.5V6c-2.6-.2-4.8.2-6.6 1.5Z" />
      <path d="M12 7.5v10.4" />
    </>
  ),
};

// brick colour -> [body, bottom edge, top shine]
const BRICKS: Record<string, [string, string, string]> = {
  red: ["#c91a09", "#8a1206", "#e6533f"],
  blue: ["#0055bf", "#003a85", "#3c86e0"],
  yellow: ["#f2cd37", "#b88a06", "#fbe38a"],
  green: ["#4b9f4a", "#256a2b", "#7cc57b"],
  orange: ["#fe8a18", "#b35a00", "#ffb15c"],
  azure: ["#078bc9", "#05618c", "#46b3e6"],
  white: ["#ffffff", "#c6d1dc", "#ffffff"],
  grey: ["#a0a5a9", "#6c6e68", "#c9cdd0"],
  black: ["#1b2a34", "#05131d", "#3d4e5a"],
  purple: ["#8e5bb0", "#5d3a78", "#b791d1"],
};

export type BrickColor = keyof typeof BRICKS;

export default function LegoIcon({
  name,
  color = "blue",
  size = 32,
  studs = 2,
  className,
  title,
}: {
  name: string;
  color?: BrickColor;
  size?: number;
  /** studs on top: 1 (a 1x1 brick), 2 (a 1x2) */
  studs?: 1 | 2;
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const [body, edge, shine] = BRICKS[color] ?? BRICKS.blue;
  const ink = color === "yellow" || color === "white" ? "#1b2a34" : "#ffffff";
  const studX = studs === 1 ? [16] : [9.5, 22.5];
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flex: "none" }}
    >
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shine} />
          <stop offset="0.35" stopColor={body} />
          <stop offset="1" stopColor={body} />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shine} />
          <stop offset="0.6" stopColor={body} />
          <stop offset="1" stopColor={edge} />
        </linearGradient>
      </defs>
      {/* studs */}
      {studX.map((x) => (
        <g key={x}>
          <rect x={x - 4.6} y="2.6" width="9.2" height="5" rx="1.6" fill={edge} />
          <rect x={x - 4.6} y="1.8" width="9.2" height="4.6" rx="1.6" fill={`url(#${id}-s)`} />
        </g>
      ))}
      {/* the brick */}
      <rect x="1.5" y="6" width="29" height="24.5" rx="4" fill={edge} />
      <rect x="1.5" y="6" width="29" height="22" rx="4" fill={`url(#${id}-b)`} />
      <rect x="4" y="7.3" width="24" height="1.4" rx="0.7" fill="#fff" opacity="0.28" />
      {/* the print, centred on the face */}
      <g
        transform="translate(6.4 8.2) scale(0.8)"
        fill="none"
        stroke={ink}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PRINTS[name] ?? PRINTS.sparkle}
      </g>
    </svg>
  );
}

// the pillar colours as bricks
export const PILLAR_BRICK_COLOR: Record<string, BrickColor> = {
  Strength: "red",
  Focus: "azure",
  Constitution: "green",
  Discipline: "blue",
  Wisdom: "orange",
};
