"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import Minifig from "@/components/Minifig";
import { brickSound } from "@/lib/brickSound";
import TapFig from "@/components/TapFig";

// the card behind each character, in LEGO colours: [top, bottom]
export const CARD_COLORS: Record<string, [string, string]> = {
  warrior: ["#fe8a18", "#c91a09"],
  mentalist: ["#b791d1", "#5d3a78"],
  wizard: ["#3c86e0", "#0a3463"],
  guardian: ["#7cc57b", "#237841"],
  shadow: ["#3d4e5a", "#05131d"],
};

// A LEGO collectible minifigure card: the brand tag, the level as the series
// number, the minifig floating on its stand, and a white nameplate (children).
export default function MinifigCard({
  character,
  level,
  children,
  size = 250,
  showLevel = true,
  tap = false,
  back,
}: {
  character: string | null;
  level: number;
  children: React.ReactNode;
  size?: number;
  /** hide the level badge (previews, like the first-run picker) */
  showLevel?: boolean;
  /** the minifig is alive and falls apart when tapped */
  tap?: boolean;
  /** the back of the card (a flip button turns it over) */
  back?: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);
  const [top, bottom] = CARD_COLORS[character ?? "warrior"] ?? CARD_COLORS.warrior;
  return (
    <section className="minifig-card" style={{ "--card": top, "--card-2": bottom } as React.CSSProperties}>
      <div className="relative flex items-start justify-between px-4 pt-4">
        <span className="minifig-card-brand">
          SOLO LEVELING
          <b>MINIFIGURES</b>
        </span>
        {showLevel && (
        <span className="minifig-card-level" aria-label={`Level ${level}`}>
          <small>LV</small>
          {level}
        </span>
        )}
      </div>
      <div className="card-stage relative pt-1 pb-3" data-flipped={flipped ? "true" : undefined}>
        <div className="card-stage-inner">
          <div className="card-stage-front" inert={flipped}>
            <span className="minifig-card-spot" aria-hidden />
            <span className="minifig-float">
              {tap ? <TapFig character={character} level={level} size={size} /> : <Minifig character={character} level={level} size={size} />}
            </span>
          </div>
          {back && (
            <div className="card-stage-back" inert={!flipped}>
              {back}
            </div>
          )}
        </div>
        {back && (
          <button
            type="button"
            className="card-flip"
            aria-label={flipped ? "Show the minifig" : "Turn the card over"}
            aria-pressed={flipped}
            onClick={() => {
              brickSound.tap();
              setFlipped((f) => !f);
            }}
          >
            <Icon name="refresh" size={16} strokeWidth={2.6} />
          </button>
        )}
      </div>
      <div className="relative mx-3 mb-3 rounded-[16px] bg-white px-3.5 py-3 flex items-center gap-3" style={{ boxShadow: "0 4px 0 var(--lip)" }}>
        {children}
      </div>
    </section>
  );
}
