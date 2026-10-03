"use client";

import { useEffect } from "react";
import { brickSound } from "@/lib/brickSound";

const COLORS = ["var(--lego-red)", "var(--lego-yellow)", "var(--lego-blue)", "var(--lego-green)", "var(--lego-orange)", "var(--lego-azure)"];
const COLS = 6;
const ROWS = 12;

// A wall of bricks dropping in, row by row from the bottom, to cover the
// screen before the 3D world opens (onCovered fires when it's full).
export default function BrickWipe({ onCovered }: { onCovered: () => void }) {
  useEffect(() => {
    brickSound.wipe();
    const t = setTimeout(onCovered, 720);
    return () => clearTimeout(t);
  }, [onCovered]);
  return (
    <div className="brick-wipe" aria-hidden>
      {Array.from({ length: ROWS }, (_, r) => (
        <div key={r} className="brick-wipe-row" style={{ marginLeft: r % 2 ? "-8%" : 0 }}>
          {Array.from({ length: COLS + 1 }, (_, c) => (
            <span
              key={c}
              style={{
                "--c": COLORS[(r * 3 + c * 2) % COLORS.length],
                animationDelay: `${(ROWS - 1 - r) * 38 + ((c * 37) % 60)}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
