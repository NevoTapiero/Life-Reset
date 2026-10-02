"use client";

import { useEffect, useRef, useState } from "react";
import s from "./BrickWall.module.css";

// A wall of LEGO bricks seen from above, 2x4s laid in a running bond, studs up: "in" presses them onto the
// screen row by row from the bottom (each drops in from above, lands, and clicks home), covering it; "out"
// pulls them off from the top, each lifting away with a little twist, to show what's behind. The same screen
// size gives the same bricks in the same colours, so a wall that covers one page and one that leaves the next
// line up exactly (the jump into the town).
const COLOURS = ["#d01012", "#0055bf", "#f5cd2f", "#4b9f4a", "#fe8a18", "#ffffff", "#a0a5a9", "#582a12"];
const STUD = 24; // px
const BRICK = [STUD * 4, STUD * 2]; // a 2x4, long side across
const IN = { rows: 380, cols: 60, jitter: 40, brick: 260 }; // ms: the sweep up the rows, along a row, a brick's wobble, its drop
const OUT = { rows: 320, cols: 40, jitter: 60, brick: 360 };
export const WALL_IN = IN.rows + IN.cols + IN.jitter + IN.brick; // ms until the wall is complete
// set by the page the wall covers when the next page should open behind it and take it down
export const JUMP_FLAG = "sl-brick-wall";
export const WALL_OUT = OUT.rows + OUT.cols + OUT.jitter + OUT.brick; // ms until it's all gone
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export default function BrickWall({ phase, onDone, className = "" }: { phase: "in" | "out"; onDone?: () => void; className?: string }) {
  const [[cols, rows]] = useState(() => [Math.ceil(window.innerWidth / BRICK[0]) + 1, Math.ceil(window.innerHeight / BRICK[1])]);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => done.current?.(), phase === "in" ? WALL_IN : WALL_OUT);
    return () => clearTimeout(t);
  }, [phase]);
  const t = phase === "in" ? IN : OUT;
  return (
    <div className={`${s.wall} ${phase === "in" ? s.in : s.out} ${className}`} aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={s.row} style={{ height: BRICK[1], marginLeft: r % 2 ? -BRICK[0] / 2 : 0 }}>
          {Array.from({ length: cols }, (_, c) => {
            const k = r * 97 + c;
            const up = phase === "in" ? (rows - 1 - r) / Math.max(1, rows - 1) : r / Math.max(1, rows - 1); // in: bottom first; out: top first
            return (
              <span
                key={c}
                className={s.brick}
                style={
                  {
                    width: BRICK[0],
                    "--c": COLOURS[Math.floor(hash(k + 7) * COLOURS.length)],
                    "--twist": `${(hash(k + 3) - 0.5) * 30}deg`,
                    backgroundSize: `${STUD}px ${STUD}px`,
                    animationDuration: `${t.brick}ms`,
                    animationDelay: `${up * t.rows + (c / cols) * t.cols + hash(k) * t.jitter}ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
