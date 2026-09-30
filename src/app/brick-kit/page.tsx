"use client";

import LegoIcon, { BrickColor } from "@/components/LegoIcon";
import { MinifigHead } from "@/components/PlayerAvatar";

// The brick theme's parts on one page (like /lego-sets for the 3D world), to
// look at every piece side by side while designing. Not linked from the app.

const ICONS = ["home", "globe", "user", "check", "plus", "flame", "trophy", "calendar", "plug", "mail", "camera", "chart", "users", "sparkle", "link", "play", "logout", "stat-str", "stat-foc", "stat-con", "stat-dis", "stat-wis"];
const COLORS: BrickColor[] = ["red", "blue", "yellow", "green", "orange", "azure", "white", "grey", "black", "purple"];
const CHARS = ["warrior", "mentalist", "wizard", "guardian", "shadow"];

export default function BrickKit() {
  return (
    <main className="py-8 flex flex-col gap-6">
      <h1 className="display text-[28px]">Brick kit</h1>

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
    </main>
  );
}
