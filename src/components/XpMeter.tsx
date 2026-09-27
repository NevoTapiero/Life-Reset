"use client";

import { Rank } from "@/lib/game";

// Arcade XP meter: segmented tick bar, stage XP at the right of the bar
// (earned bold, stage total small and gray), next-tier label below.
export default function XpMeter({ rank }: { rank: Rank; xp?: number }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="hud-label whitespace-nowrap" style={{ color: rank.color }}>{rank.label}</span>
        {!rank.atMax && (
          <span className="whitespace-nowrap leading-none">
            <span className="display text-[16px]">{rank.xpIntoStage}</span>
            <span className="hud-label !text-[10px]">/{rank.xpForStage} XP</span>
          </span>
        )}
      </div>
      <div className="bar-seg">
        <i style={{ width: `${Math.min(rank.progress, 1) * 100}%` }} />
        <b />
      </div>
      <div className="hud-label text-center mt-1.5 whitespace-nowrap">
        {rank.atMax ? "Top of the ladder" : `${rank.xpForStage - rank.xpIntoStage} XP to ${nextLabel(rank)}`}
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
