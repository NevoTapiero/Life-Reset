"use client";

import { useEffect } from "react";
import Minifig from "@/components/Minifig";
import LegoIcon, { BrickColor } from "@/components/LegoIcon";
import { legoLevel, levelTitle } from "@/lib/brick";
import { brickSound } from "@/lib/brickSound";
import type { Rank } from "@/lib/game";

// each rank tier as a brick colour: Bronze, Silver, Gold, Platinum, Diamond, Champion
const TIER_BRICK: BrickColor[] = ["orange", "grey", "yellow", "azure", "blue", "red"];

const BURST = ["var(--lego-red)", "var(--lego-yellow)", "var(--lego-blue)", "var(--lego-green)", "var(--lego-orange)", "#ffffff"];

// little bricks flying out of the middle (uses the .brick-bit animation)
export function BrickBurst({ count = 22 }: { count?: number }) {
  return (
    <span className="absolute left-1/2 top-1/2 pointer-events-none" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2;
        const r = 70 + ((i * 37) % 60);
        return (
          <span
            key={i}
            className="brick-bit"
            style={
              {
                "--c": BURST[i % BURST.length],
                "--dx": `${Math.cos(a) * r}px`,
                "--dy": `${Math.sin(a) * r - 40}px`,
                "--spin": `${((i * 53) % 540) - 270}deg`,
                animationDelay: `${(i % 5) * 30}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

// Rank up. A new tier is also a new LEGO level (new outfit, bigger house, a
// better ride), so that one gets the minifig and a bigger message.
export default function RankUp({
  rank,
  previousTier,
  character,
  onClose,
}: {
  rank: Rank;
  previousTier: number;
  character: string | null;
  onClose: () => void;
}) {
  const newLevel = legoLevel(rank.tierIndex) > legoLevel(previousTier);
  useEffect(() => {
    brickSound.levelUp(newLevel);
  }, [newLevel]);
  return (
    <div className="rankup-backdrop" onClick={onClose} role="dialog" aria-label={newLevel ? "New level" : "Rank up"}>
      <div className="relative flex items-center justify-center">
        <div className="rankup-ring" />
        <div className="rankup-ring late" />
        <BrickBurst count={newLevel ? 30 : 18} />
        <div className="rankup-badge">
          {newLevel ? (
            <Minifig character={character} level={legoLevel(rank.tierIndex)} size={210} alive className="mf-cheer" />
          ) : (
            <LegoIcon name="star" color={TIER_BRICK[rank.tierIndex] ?? "yellow"} size={130} />
          )}
        </div>
      </div>
      <div className="rankup-title text-center mt-8 px-6">
        <div className="chip chip-yellow !text-[13px]">{newLevel ? `Level ${legoLevel(rank.tierIndex)}` : "Rank up"}</div>
        <div className="display-hero tt-text text-[42px] mt-3">
          {newLevel ? levelTitle(character, rank.tierIndex) : rank.label}
        </div>
        <p className="text-[15px] font-extrabold mt-2 text-white/90">
          {newLevel ? "New gear, a bigger house and a better ride in your world." : "Keep going: the next level is close."}
        </p>
        <p className="text-[12px] font-extrabold mt-5 text-white/70">Tap anywhere</p>
      </div>
    </div>
  );
}
