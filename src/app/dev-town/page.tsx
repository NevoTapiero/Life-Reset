"use client";
// TEMPORARY: unauthenticated preview of the town with fake friends. Delete me.
import { useState } from "react";
import TownCanvas from "@/components/TownCanvas";
import type { TownHouse, TownRow } from "@/lib/town";
import { statusFor } from "@/lib/town";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ROWS: TownRow[] = [
  { username: "ifti", archetype: "warrior", xp: 420, streak_current: 6, is_me: true, today_xp: 65, weekly_xp: null, last_quest: null, last_done_at: null },
  { username: "nevo", archetype: "shadow", xp: 5200, streak_current: 21, is_me: false, today_xp: 142, weekly_xp: null, last_quest: { id: "read-books", title: "Read 10 pages", pillar: "Wisdom" }, last_done_at: ago(20) },
  { username: "dana", archetype: "wizard", xp: 1600, streak_current: 3, is_me: false, today_xp: 30, weekly_xp: null, last_quest: { id: "workout", title: "Train your body", pillar: "Strength" }, last_done_at: ago(300) },
  { username: "omer", archetype: "guardian", xp: 90, streak_current: 0, is_me: false, today_xp: 0, weekly_xp: null, last_quest: null, last_done_at: null },
  { username: "maya", archetype: "mentalist", xp: 2400, streak_current: 12, is_me: false, today_xp: 88, weekly_xp: null, last_quest: { id: "meditate", title: "Meditate", pillar: "Focus" }, last_done_at: ago(5) },
];

export default function DevTown() {
  const [visiting, setVisiting] = useState<TownHouse | null>(null);
  return (
    <main className="p-4 w-full max-w-md mx-auto">
      <div className="hud-label mb-2">town demo{visiting ? ` · visiting ${visiting.row.username}: ${statusFor(visiting.row)}` : ""}</div>
      <TownCanvas state={{ hero: "warrior", rows: ROWS }} onHouse={setVisiting} />
    </main>
  );
}
