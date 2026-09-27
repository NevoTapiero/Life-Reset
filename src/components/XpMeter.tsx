"use client";

import { Rank } from "@/lib/game";

// Arcade XP meter: segmented tick bar with rank labels, total XP at right.
export default function XpMeter({ rank, xp }: { rank: Rank; xp: number }) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="hud-label whitespace-nowrap" style={{ color: rank.color }}>{rank.label}</span>
          <span className="hud-label whitespace-nowrap">
            {rank.atMax ? "MAX" : `${rank.xpIntoStage}/${rank.xpForStage}`}
          </span>
        </div>
        <div className="bar-seg">
          <i style={{ width: `${Math.min(rank.progress, 1) * 100}%` }} />
          <b />
        </div>
        <div className="hud-label text-center mt-1.5 whitespace-nowrap">
          {rank.atMax ? "Top of the ladder" : `${rank.xpForStage - rank.xpIntoStage} XP to ${nextLabel(rank)}`}
        </div>
      </div>
      <div className="flex flex-col items-end flex-none">
        <span className="display text-[19px] leading-none">{xp.toLocaleString()}</span>
        <span className="hud-label mt-1">XP</span>
      </div>
    </div>
  );
}

function nextLabel(rank: Rank): string {
  const stages = ["I", "II", "III"];
  const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion"];
  if (rank.stageIndex < 2) return `${tiers[rank.tierIndex]} ${stages[rank.stageIndex + 1]}`;
  if (rank.tierIndex < tiers.length - 1) return `${tiers[rank.tierIndex + 1]} I`;
  return "Champion III";
}
