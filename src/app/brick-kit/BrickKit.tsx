"use client";

import LegoIcon, { BrickColor } from "@/components/LegoIcon";
import { MinifigHead } from "@/components/PlayerAvatar";
import Minifig from "@/components/Minifig";
import TownArt from "@/components/TownArt";
import RankUp from "@/components/RankUp";
import { useState } from "react";
import { rankForXp } from "@/lib/game";

// The brick theme's parts on one page (like /lego-sets for the 3D world), to
// look at every piece side by side while designing. Not linked from the app.

const ICONS = ["home", "globe", "user", "check", "plus", "flame", "trophy", "calendar", "plug", "mail", "camera", "chart", "users", "sparkle", "link", "play", "logout", "stat-str", "stat-foc", "stat-con", "stat-dis", "stat-wis"];
const COLORS: BrickColor[] = ["red", "blue", "yellow", "green", "orange", "azure", "white", "grey", "black", "purple"];
const CHARS = ["warrior", "mentalist", "wizard", "guardian", "shadow"];

export default function BrickKit() {
  const [demo, setDemo] = useState<"level" | "rank" | null>(null);
  return (
    <main className="py-8 flex flex-col gap-6">
      <h1 className="display text-[28px]">Brick kit</h1>
      <div className="flex gap-2">
        <button className="btn-primary brick-yellow px-4 py-2" onClick={() => setDemo("level")}>Show level up</button>
        <button className="btn-ghost px-4 py-2" onClick={() => setDemo("rank")}>Show rank up</button>
      </div>
      {demo && <RankUp rank={rankForXp(demo === "level" ? 1500 : 700)} previousTier={demo === "level" ? 1 : 1} character="warrior" onClose={() => setDemo(null)} />}

      <section className="card p-4">
        <h2 className="section-title mb-3">Icons</h2>
        <div className="grid grid-cols-6 gap-3">
          {ICONS.map((n, i) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <LegoIcon name={n} color={COLORS[i % COLORS.length]} size={40} />
              <span className="text-[9px] font-bold text-muted">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Colours</h2>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <LegoIcon key={c} name="home" color={c} size={34} />
          ))}
          <LegoIcon name="check" color="green" size={34} studs={1} />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Minifig heads</h2>
        <div className="flex gap-2">
          {CHARS.map((c) => (
            <span key={c} className="rounded-full overflow-hidden">
              <MinifigHead character={c} size={56} />
            </span>
          ))}
        </div>
      </section>
      <section className="scene">
        <TownArt className="w-full h-auto block" residents={[1, 2, 3, 4, 5].map((l, i) => ({ name: String(l), level: l, character: CHARS[i], me: l === 3 }))} />
      </section>
      <section className="card p-4">
        <h2 className="section-title mb-3">Minifigs by level</h2>
        {CHARS.map((c) => (
          <div key={c} className="flex items-end gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((l) => (
              <Minifig key={l} character={c} level={l} size={96} />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
