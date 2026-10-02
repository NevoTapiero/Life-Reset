"use client";

// ponytail: temporary preview page (the app's own screens need a login); delete before main
import dynamic from "next/dynamic";
import { useState } from "react";
import HOUSES from "@/lib/legoHouses.json";
import type { Visit } from "@/components/LegoWorld";
import { SEASONS, GARDEN, type Placed, type Season } from "@/lib/legoWorld";

const LegoWorld = dynamic(() => import("@/components/LegoWorld"), {
  ssr: false,
});
const LegoTown = dynamic(
  () => import("@/components/LegoWorld").then((m) => m.LegoTown),
  { ssr: false },
);
const LegoRoom = dynamic(
  () => import("@/components/LegoWorld").then((m) => m.LegoRoom),
  { ssr: false },
);

// the shop's prices (the real ones are in shop_items)
const DEMO_PRICES: Record<string, number> = {
  "floor-lamp": 50,
  "coffee-table": 60,
  cat: 80,
  "indoor-trees": 100,
  sofa: 150,
  tv: 200,
  aquarium: 250,
  trophy: 300,
  ...Object.fromEntries(GARDEN.map((g) => [g.id, g.price])),
};

// sample missions for your room
const DEMO_STATIONS = [
  { id: "gym", title: "Workout", pillar: "Strength", xp: 40, done: false },
  { id: "deep", title: "Deep work 1h", pillar: "Focus", xp: 30, done: true },
  {
    id: "water",
    title: "Drink 2L",
    pillar: "Constitution",
    xp: 15,
    done: false,
  },
  {
    id: "bed",
    title: "In bed by 23:00",
    pillar: "Discipline",
    xp: 25,
    done: false,
  },
  { id: "read", title: "Read 20 pages", pillar: "Wisdom", xp: 20, done: false },
  { id: "run", title: "Run 5k", pillar: "Strength", xp: 50, done: false },
  {
    id: "phone",
    title: "No phone 1h",
    pillar: "Discipline",
    xp: 25,
    done: false,
  },
  {
    id: "learn",
    title: "Course lesson",
    pillar: "Wisdom",
    xp: 30,
    done: false,
  },
];

// a sample street (the real one is /app/town, from your friends list)
const DEMO_TOWN = [
  { name: "ifti", level: 5, streak: 24, me: true, character: "warrior", rank: 13 },
  { name: "nevo", level: 3, streak: 6, character: "wizard", rank: 7 },
  { name: "dana", level: 1, streak: 2, character: "mentalist" },
  { name: "omer", level: 2, streak: 0, character: "guardian" },
  { name: "maya", level: 4, streak: 30, character: "shadow" },
  { name: "tal", level: 1, streak: 9, character: "wizard" },
  { name: "noa", level: 2, streak: 4, character: "guardian" },
  { name: "ben", level: 3, streak: 1, character: "mentalist" },
];

export default function LegoPreview() {
  const [house, setHouse] = useState<string | null>(null); // null = the town
  const [spin, setSpin] = useState(0); // previews: turn the house to find its front
  const [time, setTime] = useState<string | undefined>(undefined); // undefined = your clock
  const [hero, setHero] = useState(5); // your level: what you wear in your room
  const [season, setSeason] = useState<Season | undefined>(undefined); // undefined = the date
  const [friends, setFriends] = useState(5); // how many friends live in the demo town (the old shared street)
  const [visiting, setVisiting] = useState<string | null>(null); // a friend's own town, you as a guest
  // nevo already let you in, omer hasn't answered; a new knock is answered after a moment
  const [visits, setVisits] = useState<Record<string, Visit>>({
    nevo: "allowed",
    omer: "knocked",
  });
  const knock = (name: string) => {
    setVisits((v) => ({ ...v, [name]: "knocked" }));
    setTimeout(() => setVisits((v) => ({ ...v, [name]: "allowed" })), 1500);
  };
  const [stations, setStations] = useState(DEMO_STATIONS);
  // what the watch earned overnight, waiting in the chest
  const [chest, setChest] = useState(64);
  const [gold, setGold] = useState(400);
  const [owned, setOwned] = useState<string[]>([]);
  const [garden, setGarden] = useState<Placed[]>([]);
  const buy = async (id: string) => {
    const price = DEMO_PRICES[id];
    if (gold < price) return "not enough gold";
    await new Promise((r) => setTimeout(r, 300));
    setGold((g) => g - price);
    setOwned((o) => [...o, id]);
    return null;
  };
  const collect = async () => {
    await new Promise((r) => setTimeout(r, 300));
    const xp = chest;
    setGold((g) => g + xp);
    setChest(0);
    return xp;
  };
  const tap = async (id: string) => {
    await new Promise((r) => setTimeout(r, 300));
    setStations((all) =>
      all.map((st) => (st.id === id ? { ...st, done: true } : st)),
    );
    setGold((g) => g + (stations.find((st) => st.id === id)?.xp ?? 0));
    return stations.find((st) => st.id === id)?.xp ?? null;
  };
  const button = (active: boolean) =>
    `px-3 py-1.5 rounded border text-sm ${active ? "bg-white text-black" : ""}`;
  // the demo's switches live in a drawer, so the game has the whole screen
  const [drawer, setDrawer] = useState(false);
  return (
    <main className="fixed inset-0 overflow-hidden">
      <button
        onClick={() => setDrawer((d) => !d)}
        className="lego lego-sm lego-dark absolute left-1/2 -translate-x-1/2 top-2 z-30"
        aria-expanded={drawer}
      >
        {drawer ? "Close demo settings" : "Demo settings"}
      </button>
      <div
        className={`absolute inset-x-0 top-0 z-20 p-3 pt-12 flex flex-wrap gap-2 max-h-[70%] overflow-y-auto ${drawer ? "" : "hidden"}`}
        style={{ background: "rgba(20,18,16,0.9)", color: "#fff" }}
      >
        <button
          onClick={() => setHouse(null)}
          className={button(house === null)}
        >
          Town (demo)
        </button>
        {[0, 2, 5, 7].map((n) => (
          <button
            key={n}
            onClick={() => {
              setFriends(n);
              setVisiting(null);
            }}
            className={button(friends === n && !visiting)}
          >
            {n} friends
          </button>
        ))}
        <button onClick={() => setVisiting((v) => (v ? null : "nevo"))} className={button(!!visiting)}>
          Visit nevo
        </button>
        {["day", "golden", "dusk", "night"].map((t) => (
          <button
            key={t}
            onClick={() => setTime(time === t ? undefined : t)}
            className={button(time === t)}
          >
            {t}
          </button>
        ))}
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={`hero-${n}`}
            onClick={() => setHero(n)}
            className={button(hero === n)}
          >
            Hero L{n}
          </button>
        ))}
        {SEASONS.map((t) => (
          <button
            key={t}
            onClick={() => setSeason(season === t ? undefined : t)}
            className={button(season === t)}
          >
            {t}
          </button>
        ))}
        {house && (
          <button
            onClick={() => setSpin((s) => (s + 1) % 4)}
            className={button(false)}
          >
            Turn house ({spin})
          </button>
        )}
        {HOUSES.map((h) => (
          <button
            key={h.id}
            onClick={() => setHouse(h.id)}
            className={button(house === h.id)}
          >
            L{h.level} {h.name}
          </button>
        ))}
      </div>
      <div className="absolute inset-0">
        {house === null ? (
          <LegoTown
            key={visiting ?? "home"}
            residents={visiting ? DEMO_TOWN.filter((r) => r.name === visiting) : DEMO_TOWN.slice(0, friends + 1)}
            guest={visiting ? DEMO_TOWN[0] : undefined}
            visit={visiting ?? undefined}
            friends={DEMO_TOWN.slice(1)}
            onVisit={setVisiting}
            backLabel={visiting ? "My town" : "World"}
            onBack={visiting ? () => setVisiting(null) : undefined}
            visits={visits}
            onKnock={knock}
            stations={stations}
            onTap={tap}
            room={(leave, mood) => (
              <LegoRoom
                mood={mood}
                chest={chest}
                gold={gold}
                onCollect={collect}
                owned={owned}
                onLeave={leave}
                level={hero}
                name="ifti"
                className="w-full h-full"
              />
            )}
            gold={gold}
            prices={DEMO_PRICES}
            owned={owned}
            onBuy={buy}
            time={time}
            season={season}
            energy={40}
            garden={garden}
            onPlace={async (p) => {
              setGarden((g) => [...g, p]);
              return null;
            }}
            className="w-full h-full"
          />
        ) : (
          <LegoWorld
            houseLevel={HOUSES.find((h) => h.id === house)?.level}
            house={house}
            spin={spin}
            streak={30}
            className="w-full h-full"
          />
        )}
      </div>
    </main>
  );
}
