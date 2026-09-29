"use client";
// TEMPORARY: unauthenticated preview of the Room + collect tray. Delete me.
import { useState } from "react";
import Room from "@/components/Room";
import { actionFor, idleFor } from "@/lib/needs";
import type { Pending } from "@/lib/collect";
import Icon from "@/components/Icon";
import LootTray from "@/components/LootTray";
import SidePanel from "@/components/SidePanel";
import type { TownRow } from "@/lib/town";

const TIRED = { CON: 22, STR: 41, FOC: 38, WIS: 55, DIS: 47 };
const READ = { id: "read-books", title: "Read 10 pages", pillar: "Wisdom" as const };
const DEMO: Pending[] = [
  { id: "a", source: "whoop_sleep", ref: "1", xp: 16, reason: "Sleep 82%", created_at: "2026-09-29T05:00:00Z" },
  { id: "b", source: "whoop_recovery", ref: "2", xp: -6, reason: "Recovery 21% · in the red", created_at: "2026-09-29T05:01:00Z" },
  { id: "c", source: "google_tasks", ref: "3", xp: 8, reason: "Send the invoice", created_at: "2026-09-29T08:00:00Z" },
  { id: "d", source: "health_steps", ref: "4", xp: 11, reason: "11,204 steps", created_at: "2026-09-29T09:00:00Z" },
];

export default function DevRoom() {
  const [pending, setPending] = useState(DEMO);
  const [boost, setBoost] = useState<{ id: number; text: string } | null>(null);
  const [needs, setNeeds] = useState(TIRED);
  const [acting, setActing] = useState(false);
  const [tapped, setTapped] = useState<string>("");
  const [view, setView] = useState<"house" | "town">("house");
  const [panel, setPanel] = useState<null | "missions" | "loot">(null);
  const rows: TownRow[] = [
    { username: "ifti", archetype: "warrior", xp: 420, streak_current: 6, is_me: true, today_xp: 65, weekly_xp: null, last_quest: null, last_done_at: null },
    { username: "nevo", archetype: "shadow", xp: 5200, streak_current: 21, is_me: false, today_xp: 142, weekly_xp: null, last_quest: { id: "read-books", title: "Read 10 pages", pillar: "Wisdom" }, last_done_at: new Date().toISOString() },
  ];
  const collect = (p: Pending) => {
    setPending((prev) => prev.filter((x) => x.id !== p.id));
    setNeeds((n) => ({ ...n, CON: Math.min(100, n.CON + Math.max(0, p.xp)) }));
    setBoost({ id: Date.now() + Math.random(), text: `${p.xp > 0 ? "+" : ""}${p.xp} ${p.source.split("_")[1]}` });
  };
  return (
    <main className="p-4 w-full max-w-md mx-auto">
      <div className="hud-label mb-2 flex gap-3">
        <span>tap bubbles or furniture{tapped ? ` · tapped: ${tapped}` : ""}</span>
        <button className="underline" onClick={() => { setActing(true); setTimeout(() => setActing(false), 2600); }}>simulate: read</button>
      </div>
      {panel === "missions" && <SidePanel title="Missions" onClose={() => setPanel(null)}><p className="hud-label">the quest list renders here on the real page</p></SidePanel>}
      {panel === "loot" && <SidePanel title="Loot" onClose={() => setPanel(null)}><LootTray pending={pending} onCollect={collect} onCollectAll={() => pending.forEach((p, i) => setTimeout(() => collect(p), i * 140))} /></SidePanel>}
      <Room
        view={view}
        town={{ state: { hero: "warrior", rows }, onHouse: (h) => (h.row.is_me ? setView("house") : setTapped("visit " + h.row.username)) }}
        overlay={
          <>
            <button className="world-btn" onClick={() => setView(view === "house" ? "town" : "house")}>
              <Icon name={view === "house" ? "users" : "flame"} size={14} strokeWidth={2.2} />
              {view === "house" ? "Town" : "Home"}
            </button>
            <button className="world-btn" onClick={() => setPanel("missions")}>
              <Icon name="tasks" size={14} strokeWidth={2.2} />
              Missions<span className="world-count">3</span>
            </button>
            <button className="world-btn pulse-glow" style={{ color: "var(--gold)", borderColor: "var(--gold)" }} onClick={() => setPanel("loot")}>
              <Icon name="sparkle" size={14} strokeWidth={2.2} />
              Loot<span className="world-count" style={{ background: "var(--gold)" }}>{pending.length}</span>
            </button>
          </>
        }
        character="warrior"
        needs={needs}
        action={acting ? actionFor(READ) : idleFor(needs)}
        busy={acting}
        boost={boost}
        available={["bed", "desk"]}
        onTapSpot={(spot) => {
          setTapped(spot);
          if (spot === "desk") {
            setActing(true);
            setTimeout(() => setActing(false), 2600);
            setPending((prev) => [...prev, { id: "q" + Date.now(), source: "quest", ref: "read", xp: 15, gold: 30, reason: "Read 10 pages", created_at: new Date().toISOString(), stat: "WIS", icon: "book", label: "Mind" }]);
          }
        }}
      />
    </main>
  );
}
