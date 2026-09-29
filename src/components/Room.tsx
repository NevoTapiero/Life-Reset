"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import { sourceInfo, type Pending } from "@/lib/collect";
import HouseCanvas from "@/components/HouseCanvas";
import type { HouseState } from "@/game/HouseScene";
import type { CharacterKey } from "@/lib/game";
import { NEED_KEYS, NEED_LABEL, moodOf, type Action, type Needs, type Spot } from "@/lib/needs";

// The "Sims" view: mood, the Phaser house where your character acts out what
// you just did, and his needs. Art is Kenney CC0 placeholder (public/game).

export default function Room({
  character,
  needs,
  action,
  busy,
  boost,
  pending,
  onCollect,
  onCollectAll,
  available = [],
  onTapSpot,
}: {
  character: CharacterKey | null;
  needs: Needs;
  action: Action;
  busy: boolean; // a quest was just checked: he is doing it right now
  boost: { id: number; text: string } | null; // what just went up, floated in the house
  pending: Pending[]; // earned while you were away, waiting to be tapped
  onCollect: (p: Pending) => void;
  onCollectAll: () => void;
  available?: Spot[]; // spots with a quest left to do today
  onTapSpot?: (spot: Spot) => void; // tapping furniture logs the quest that lives there
}) {
  const mood = moodOf(needs);
  const tired = needs.CON < 30;
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const pop = (p: Pending) => {
    if (popping.has(p.id)) return;
    setPopping((prev) => new Set(prev).add(p.id));
    setTimeout(() => {
      onCollect(p);
      setPopping((prev) => {
        const n = new Set(prev);
        n.delete(p.id);
        return n;
      });
    }, 240);
  };
  const house = useMemo<HouseState>(
    () => ({
      hero: character,
      spot: action.spot,
      label: action.label,
      busy,
      tired,
      boost,
      available,
    }),
    [character, action.spot, action.label, busy, tired, boost, available],
  );

  return (
    <div className="scene p-4 pt-3.5">
      {/* mood header */}
      <div className="flex items-baseline justify-between">
        <span className="hud-label">Mood</span>
        <span className="display text-[15px]" style={{ color: mood.low ? "var(--danger)" : "var(--accent)" }}>
          {mood.label} · {mood.score}
        </span>
      </div>

      {/* the house: a real scene, he walks over and does what you just did */}
      <div className="mt-3 relative">
        <HouseCanvas state={house} onTap={onTapSpot} />
        {/* the tray: what the connected apps paid while you were away */}
        {pending.map((p, i) => {
          const info = sourceInfo(p);
          const bad = p.xp < 0;
          return (
            <button
              key={p.id}
              onClick={() => pop(p)}
              aria-label={`Collect ${p.xp} XP from ${info.label}`}
              className={`collect-bubble ${popping.has(p.id) ? "collect-pop" : ""}`}
              style={{
                // four slots per row across the top of the house, so bubbles never stack
                left: `${6 + (i % 4) * 24}%`,
                top: `${6 + Math.floor(i / 4) * 34}%`,
                animationDelay: `${(i % 5) * 0.45}s`,
                color: bad ? "var(--danger)" : "var(--accent)",
                borderColor: bad ? "rgb(255 93 115 / 0.7)" : "rgb(var(--accent-rgb) / 0.7)",
                boxShadow: bad ? "0 0 18px rgb(255 93 115 / 0.45)" : "0 0 18px rgb(var(--accent-rgb) / 0.5)",
              }}
            >
              <Icon name={info.icon} size={13} strokeWidth={2.2} />
              <span className="display text-[12px]">
                {bad ? "" : "+"}
                {p.xp}
              </span>
            </button>
          );
        })}
        {pending.length > 3 && (
          <button onClick={onCollectAll} className="hud-label absolute right-2 bottom-2 px-2.5 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.6)", color: "var(--accent)", border: "1px solid var(--line-strong)" }}>
            Collect all · {pending.length}
          </button>
        )}
      </div>

      {/* needs */}
      <div className="grid grid-cols-5 gap-2 mt-4">
        {NEED_KEYS.map((k) => {
          const v = needs[k];
          const low = v < 30;
          return (
            <div key={k} className="relative">
              <div className="hud-label !text-[8px] !tracking-normal" style={{ color: low ? "var(--danger)" : undefined }}>{NEED_LABEL[k]}</div>
              <div className="mt-1 h-[7px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${v}%`,
                    background: low ? "var(--danger)" : "linear-gradient(90deg, var(--accent-2), var(--accent))",
                    transition: "width 700ms var(--ease-strong), background 300ms",
                  }}
                />
              </div>
              <div className="display text-[12px] mt-1" style={{ color: low ? "var(--danger)" : undefined }}>{v}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
