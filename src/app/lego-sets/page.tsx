"use client";

// ponytail: temporary preview page (the app's own screens need a login); delete before main
import dynamic from "next/dynamic";
import { useState } from "react";
import HOUSES from "@/lib/legoHouses.json";
import type { Visit } from "@/components/LegoWorld";

const LegoWorld = dynamic(() => import("@/components/LegoWorld"), { ssr: false });
const LegoTown = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoTown), { ssr: false });
const LegoRoom = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoRoom), { ssr: false });

// sample missions for your room
const DEMO_STATIONS = [
  { id: "gym", title: "Workout", pillar: "Strength", xp: 40, done: false },
  { id: "deep", title: "Deep work 1h", pillar: "Focus", xp: 30, done: true },
  { id: "water", title: "Drink 2L", pillar: "Constitution", xp: 15, done: false },
  { id: "bed", title: "In bed by 23:00", pillar: "Discipline", xp: 25, done: false },
  { id: "read", title: "Read 20 pages", pillar: "Wisdom", xp: 20, done: false },
  { id: "run", title: "Run 5k", pillar: "Strength", xp: 50, done: false },
  { id: "phone", title: "No phone 1h", pillar: "Discipline", xp: 25, done: false },
  { id: "learn", title: "Course lesson", pillar: "Wisdom", xp: 30, done: false },
];

// a sample street (the real one is /app/town, from your friends list)
const DEMO_TOWN = [
  { name: "nevo", level: 3, streak: 6 },
  { name: "dana", level: 1, streak: 2 },
  { name: "ifti", level: 5, streak: 12, me: true },
  { name: "omer", level: 2, streak: 0 },
  { name: "maya", level: 4, streak: 30 },
];

export default function LegoPreview() {
  const [level, setLevel] = useState<number | null>(null); // null = the town
  // nevo already let you in, omer hasn't answered; a new knock is answered after a moment
  const [visits, setVisits] = useState<Record<string, Visit>>({ nevo: "allowed", omer: "knocked" });
  const knock = (name: string) => {
    setVisits((v) => ({ ...v, [name]: "knocked" }));
    setTimeout(() => setVisits((v) => ({ ...v, [name]: "allowed" })), 1500);
  };
  const [stations, setStations] = useState(DEMO_STATIONS);
  // what the watch earned overnight, waiting in the chest
  const [chest, setChest] = useState(64);
  const [gold, setGold] = useState(120);
  const collect = async () => {
    await new Promise((r) => setTimeout(r, 300));
    const xp = chest;
    setGold((g) => g + xp);
    setChest(0);
    return xp;
  };
  const tap = async (id: string) => {
    await new Promise((r) => setTimeout(r, 300));
    setStations((all) => all.map((st) => (st.id === id ? { ...st, done: true } : st)));
    setGold((g) => g + (stations.find((st) => st.id === id)?.xp ?? 0));
    return stations.find((st) => st.id === id)?.xp ?? null;
  };
  const button = (active: boolean) => `px-3 py-1.5 rounded border text-sm ${active ? "bg-white text-black" : ""}`;
  return (
    <main className="min-h-screen p-4">
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setLevel(null)} className={button(level === null)}>
          Town (demo)
        </button>
        {HOUSES.map((h, i) => (
          <button key={h.id} onClick={() => setLevel(i + 1)} className={button(level === i + 1)}>
            Level {i + 1}: {h.name}
          </button>
        ))}
      </div>
      {level === null ? (
        <LegoTown
          residents={DEMO_TOWN}
          visits={visits}
          onKnock={knock}
          room={(leave) => (
            <LegoRoom stations={stations} onTap={tap} chest={chest} gold={gold} onCollect={collect} onLeave={leave} className="w-full h-full" />
          )}
          className="w-full h-[75vh] rounded overflow-hidden" />
      ) : (
        <LegoWorld houseLevel={level} streak={12} className="w-full h-[75vh] rounded overflow-hidden" />
      )}
    </main>
  );
}
