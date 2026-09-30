"use client";

import { MinifigHead } from "@/components/PlayerAvatar";

// A flat LEGO picture of your town for the World screen's door: sky, clouds,
// a green baseplate and one brick house per resident (you in the middle), each
// house as tall as its owner's level. The real 3D town is one tap away; this
// is the postcard.

type Resident = { name: string; level: number; character: string | null; me: boolean; photo?: string | null };

const WALLS = ["var(--lego-red)", "var(--lego-yellow)", "var(--lego-blue)", "var(--lego-orange)", "var(--lego-green)"];
const ROOFS = ["var(--lego-black)", "var(--lego-red)", "var(--lego-dark-grey)", "var(--lego-blue)", "var(--lego-red-edge)"];

export default function TownArt({ residents, className }: { residents: Resident[]; className?: string }) {
  // you in the middle, friends either side, at most 5 houses in the picture
  const others = residents.filter((r) => !r.me).slice(0, 4);
  const me = residents.find((r) => r.me);
  const row = [...others.slice(0, 2), ...(me ? [me] : []), ...others.slice(2, 4)];
  const n = Math.max(row.length, 1);
  const W = 360;
  const slot = W / (n + 0.6);
  const ground = 168;

  return (
    <svg viewBox={`0 0 ${W} 210`} className={className} role="img" aria-label="Your LEGO town">
      <defs>
        <linearGradient id="ta-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--bg-top)" />
          <stop offset="1" stopColor="var(--lego-light-blue)" />
        </linearGradient>
        <pattern id="ta-studs" width="12" height="9" patternUnits="userSpaceOnUse">
          <ellipse cx="6" cy="4.5" rx="3.6" ry="2.2" fill="var(--lego-green-edge)" opacity="0.35" />
          <ellipse cx="6" cy="3.6" rx="3.6" ry="2.2" fill="var(--lego-green)" />
        </pattern>
      </defs>
      <rect width={W} height="210" fill="url(#ta-sky)" />
      {/* sun and clouds */}
      <circle cx={W - 26} cy="22" r="15" fill="var(--lego-yellow)" />
      <g fill="#fff" opacity="0.95" className="ta-cloud">
        <rect x="30" y="30" width="54" height="14" rx="7" />
        <rect x="44" y="21" width="30" height="14" rx="7" />
      </g>
      <g fill="#fff" opacity="0.85" className="ta-cloud ta-cloud-2">
        <rect x="170" y="52" width="46" height="12" rx="6" />
        <rect x="182" y="44" width="24" height="12" rx="6" />
      </g>
      {/* hills */}
      <ellipse cx="70" cy={ground + 8} rx="120" ry="44" fill="var(--lego-green)" opacity="0.55" />
      <ellipse cx={W - 60} cy={ground + 10} rx="140" ry="50" fill="var(--lego-green)" opacity="0.45" />

      {row.map((r, i) => {
        const cx = slot * (i + 0.8);
        const lvl = Math.min(5, Math.max(1, r.level));
        const w = r.me ? 62 : 50;
        const h = 30 + lvl * 11;
        const x = cx - w / 2;
        const y = ground - h;
        const wall = WALLS[i % WALLS.length];
        const roof = ROOFS[i % ROOFS.length];
        return (
          <g key={r.name}>
            {/* wall: stacked bricks */}
            <rect x={x} y={y} width={w} height={h} rx="3" fill={wall} />
            {Array.from({ length: Math.floor(h / 10) }, (_, k) => (
              <line key={k} x1={x} x2={x + w} y1={ground - (k + 1) * 10} y2={ground - (k + 1) * 10} stroke="rgb(0 0 0 / 0.14)" strokeWidth="1.2" />
            ))}
            {/* roof */}
            <path d={`M${x - 6} ${y + 2} L${cx} ${y - 22 - lvl * 2} L${x + w + 6} ${y + 2} Z`} fill={roof} />
            {/* door and window */}
            <rect x={cx - 7} y={ground - 20} width="14" height="20" rx="2" fill="var(--lego-tan)" />
            <rect x={x + 7} y={y + 9} width="12" height="10" rx="1.5" fill="#fff" opacity="0.9" />
            {w > 55 && <rect x={x + w - 19} y={y + 9} width="12" height="10" rx="1.5" fill="#fff" opacity="0.9" />}
            {/* the owner above the roof: their photo, or their minifig head */}
            <g transform={`translate(${cx - (r.me ? 17 : 13)} ${y - 58 - lvl * 2})`}>
              {r.photo ? (
                <>
                  <clipPath id={`ta-clip-${i}`}>
                    <circle cx={r.me ? 17 : 13} cy={r.me ? 17 : 13} r={r.me ? 17 : 13} />
                  </clipPath>
                  <circle cx={r.me ? 17 : 13} cy={r.me ? 17 : 13} r={(r.me ? 17 : 13) + 2} fill="#fff" />
                  <image href={r.photo} width={r.me ? 34 : 26} height={r.me ? 34 : 26} clipPath={`url(#ta-clip-${i})`} preserveAspectRatio="xMidYMid slice" />
                </>
              ) : (
                <MinifigHead character={r.character} size={r.me ? 34 : 26} />
              )}
            </g>
          </g>
        );
      })}

      {/* baseplate */}
      <rect x="0" y={ground} width={W} height={210 - ground} fill="var(--lego-green)" />
      <rect x="0" y={ground} width={W} height={210 - ground} fill="url(#ta-studs)" />
      <rect x="0" y={ground} width={W} height="4" fill="var(--lego-green-edge)" opacity="0.35" />
    </svg>
  );
}
