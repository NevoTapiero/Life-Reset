"use client";

import { useEffect, useState } from "react";
import s from "./TownLoader.module.css";

// The town's loading screen, the same from the tap until the town has built: on a green baseplate a
// little LEGO house builds itself brick by brick (walls, windows and a door, the roof, a chimney),
// over and over, with studs lighting up and a tip about playing. [x, bottom, width, colour] in px;
// each brick drops in a moment after the one before.
const WHITE = "#f4f4f0";
const BRICKS: [number, number, number, string][] = [
  [20, 14, 40, WHITE],
  [60, 14, 40, WHITE],
  [100, 14, 28, "#7c4f2a"], // the door
  [128, 14, 52, WHITE],
  [20, 30, 30, WHITE],
  [50, 30, 30, "#5aa9e6"], // a window
  [80, 30, 20, WHITE],
  [100, 30, 28, "#7c4f2a"],
  [128, 30, 22, WHITE],
  [150, 30, 30, "#5aa9e6"],
  [20, 46, 40, "#f5cd2f"],
  [60, 46, 40, "#f5cd2f"],
  [100, 46, 40, "#f5cd2f"],
  [140, 46, 40, "#f5cd2f"],
];
const ROOF = "#d01012";
const TIPS = [
  "Hold Shift to run, or tap Run",
  "Tap a place on the map to teleport there",
  "Walk up to the townsfolk and tap Talk",
  "Space jumps. Press it again in the air for a double jump",
  "Hold A or D to run round in a circle",
  "Your real-life missions earn XP and gold here",
];

export default function TownLoader({ label = "Building your town", className = "", style }: { label?: string; className?: string; style?: React.CSSProperties }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const delay = (k: number) => ({ animationDelay: `${k * 0.12}s` });
  return (
    <div className={`${s.screen} ${className}`} style={style} role="status" aria-label={label}>
      <div className={s.stage} aria-hidden>
        <div className={s.plate} />
        {BRICKS.map(([x, b, w, c], k) => (
          <span key={k} className={s.brick} style={{ left: x, bottom: b, width: w, "--c": c, ...delay(k) } as React.CSSProperties} />
        ))}
        <span className={`${s.slope} ${s.left}`} style={{ left: 14, bottom: 62, width: 86, "--c": ROOF, ...delay(BRICKS.length) } as React.CSSProperties} />
        <span className={`${s.slope} ${s.right}`} style={{ left: 100, bottom: 62, width: 86, "--c": ROOF, ...delay(BRICKS.length + 1) } as React.CSSProperties} />
        <span className={s.brick} style={{ left: 146, bottom: 70, width: 14, "--c": ROOF, ...delay(BRICKS.length + 2) } as React.CSSProperties} />
      </div>
      <span className={s.title}>{label}…</span>
      <span className={s.studs} aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </span>
      <span className={s.tip}>Tip: {TIPS[tip]}</span>
    </div>
  );
}
