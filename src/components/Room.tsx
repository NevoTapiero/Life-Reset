"use client";

import { useMemo, type ReactNode } from "react";
import HouseCanvas from "@/components/HouseCanvas";
import TownCanvas from "@/components/TownCanvas";
import type { HouseState } from "@/game/HouseScene";
import type { TownState } from "@/game/TownScene";
import type { CharacterKey } from "@/lib/game";
import type { Action, Needs, Spot } from "@/lib/needs";
import type { TownHouse } from "@/lib/town";

// The world: your house, or the town outside. Just the scene and the HUD the
// page puts over it; every number lives in a tab.

export default function Room({
  character,
  needs,
  action,
  busy,
  boost,
  available = [],
  onTapSpot,
  view = "house",
  town,
  overlay,
}: {
  character: CharacterKey | null;
  needs: Needs;
  action: Action;
  busy: boolean; // a quest was just checked: he is doing it right now
  boost: { id: number; text: string } | null; // what just landed, floated over the scene
  available?: Spot[]; // spots with a quest left to do today
  onTapSpot?: (spot: Spot) => void; // tapping furniture logs the quest that lives there
  view?: "house" | "town";
  town?: { state: TownState; onHouse: (h: TownHouse) => void };
  overlay?: ReactNode; // HUD buttons drawn over the scene
}) {
  const tired = needs.CON < 30;
  const house = useMemo<HouseState>(
    () => ({ hero: character, spot: action.spot, label: action.label, busy, tired, boost, available }),
    [character, action.spot, action.label, busy, tired, boost, available],
  );

  return (
    <div className="relative overflow-hidden -mx-4 -mt-5" style={{ height: "calc(100dvh - 118px)" }}>
      {view === "house" || !town ? <HouseCanvas state={house} onTap={onTapSpot} /> : <TownCanvas state={town.state} onHouse={town.onHouse} />}
      {overlay && <div className="absolute top-2 left-2 right-2 z-10 flex gap-2 overflow-x-auto no-scrollbar">{overlay}</div>}
      {view === "house" && (
        <div className="absolute left-2 bottom-2 z-10 flex flex-col items-start gap-1">
          {boost && (
            // keyed by id: a new boost restarts the float; the animation ends invisible
            <span key={boost.id} className="xp-float display text-[13px] px-2" style={{ color: boost.text.startsWith("-") ? "var(--danger)" : "var(--gold)" }}>
              {boost.text}
            </span>
          )}
          <span className="world-btn" style={{ color: tired && !busy ? "var(--danger)" : "var(--ink)" }}>
            {action.label}
            {busy ? "…" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
