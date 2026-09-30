"use client";

import Minifig from "@/components/Minifig";
import { legoLevel, levelTitle } from "@/lib/brick";
import { STAGES, TIERS, rankForXp } from "@/lib/game";

// The road to level 5: your minifig at every LEGO level, the XP each level
// starts at, you marked where you stand. Future levels are shown dimmed so
// you can see the gear coming.

// XP at which each rank tier starts (a tier is STAGES.length stages of its cost)
function tierStarts(): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const t of TIERS) {
    starts.push(at);
    at += t.divXp * STAGES.length;
  }
  return starts;
}

export default function LevelRoad({ character, xp }: { character: string | null; xp: number }) {
  const starts = tierStarts();
  const now = legoLevel(rankForXp(xp).tierIndex);
  const levels = [1, 2, 3, 4, 5];
  // how far along the road (0..1): whole levels plus progress to the next
  const nextStart = now < 5 ? starts[now] : null;
  const curStart = starts[now - 1];
  const part = nextStart ? Math.min(1, (xp - curStart) / (nextStart - curStart)) : 0;
  const along = now >= 5 ? 1 : (now - 1 + part) / 4;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <span className="display text-[18px]">Road to level 5</span>
        <span className="chip chip-blue">{now < 5 ? `${(nextStart! - xp).toLocaleString()} XP to level ${now + 1}` : "Fully built"}</span>
      </div>
      <div className="relative mt-3">
        {/* the road: a grey plate with the green part you've built */}
        <div className="road-track" aria-hidden>
          <span style={{ width: `${Math.round(along * 100)}%` }} />
        </div>
        <div className="grid grid-cols-5 relative">
          {levels.map((l) => (
            <div key={l} className={`flex flex-col items-center ${l > now ? "opacity-45 grayscale-[0.5]" : ""}`}>
              <div className="h-[88px] flex items-end relative z-10">
                <Minifig character={character} level={l} size={l === now ? 84 : 70} />
              </div>
              <span className={`mt-1 chip !text-[10.5px] !py-0 ${l === now ? "chip-blue" : l < now ? "chip-green" : ""}`}>Lv {l}</span>
              <span className="text-[10px] font-extrabold text-muted mt-0.5 text-center leading-tight">{levelTitle(character, l - 1)}</span>
              <span className="text-[10px] font-bold text-muted">{starts[l - 1].toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
