"use client";

import TapFig from "@/components/TapFig";

// The five characters in full level-5 gear, lined up on a green baseplate:
// what a new player can grow into. Each one bobs a little, out of step, and
// falls apart when tapped.
const LINEUP = ["mentalist", "guardian", "warrior", "wizard", "shadow"];

export default function HeroLineup() {
  return (
    <div className="scene relative pt-6 pb-0">
      <div className="absolute left-3 top-3 chip chip-yellow">Level 5 looks · tap one</div>
      <div className="flex items-end justify-center gap-0 relative z-10 px-2">
        {LINEUP.map((c, i) => (
          <span key={c} className="lineup-fig" style={{ animationDelay: `${i * 0.35}s`, marginBottom: -6, marginInline: -3 }}>
            <TapFig character={c} level={5} size={c === "warrior" ? 128 : 98} phase={i * 1.3 + 0.4} />
          </span>
        ))}
      </div>
      <div className="lineup-plate" aria-hidden />
    </div>
  );
}
