"use client";

// ponytail: temporary comparison page (our built house vs official sets); delete once we pick
import dynamic from "next/dynamic";
import { useState } from "react";

const LegoWorld = dynamic(() => import("@/components/LegoWorld"), {
  ssr: false,
});
const LegoTown = dynamic(
  () => import("@/components/LegoWorld").then((m) => m.LegoTown),
  { ssr: false },
);

// a sample street for the preview (the real one is /app/town, from your friends list)
const DEMO_TOWN = [
  { name: "nevo", level: 3, streak: 6 },
  { name: "dana", level: 1, streak: 2 },
  { name: "ifti", level: 5, streak: 12, me: true },
  { name: "omer", level: 2, streak: 0 },
  { name: "maya", level: 4, streak: 30 },
];

const OPTIONS: {
  label: string;
  level: number;
  set?: { file: string; turn: number };
}[] = [
  { label: "Ours, level 1", level: 1 },
  { label: "Ours, level 5", level: 5 },
  {
    label: "Small Cottage (31009)",
    level: 1,
    set: { file: "31009-1.mpd", turn: 3 },
  },
  {
    label: "Holiday Home (1472)",
    level: 3,
    set: { file: "1472-1.mpd", turn: 2 },
  },
  {
    label: "Mountain Hut (31025)",
    level: 3,
    set: { file: "31025-1.mpd", turn: 0 },
  },
  {
    label: "Lakeside Lodge (31048)",
    level: 5,
    set: { file: "31048-1.mpd", turn: 3 },
  },
];

export default function LegoSets() {
  const [i, setI] = useState(2);
  const [town, setTown] = useState(false);
  const [extra, setExtra] = useState(0); // extra quarter turns, to check which way a set faces
  const o = OPTIONS[i];
  return (
    <main className="min-h-screen p-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {OPTIONS.map((opt, j) => (
          <button
            key={opt.label}
            onClick={() => {
              setI(j);
              setExtra(0);
              setTown(false);
            }}
            className={`px-3 py-1.5 rounded border text-sm ${j === i ? "bg-white text-black" : ""}`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => setTown(true)}
          className={`px-3 py-1.5 rounded border text-sm ${town ? "bg-white text-black" : ""}`}
        >
          Town (demo)
        </button>
        {o.set && !town && (
          <button
            onClick={() => setExtra((e) => e + 1)}
            className="px-3 py-1.5 rounded border text-sm"
          >
            Turn ↻
          </button>
        )}
      </div>
      {town ? (
        <LegoTown
          residents={DEMO_TOWN}
          className="w-full h-[75vh] rounded overflow-hidden"
        />
      ) : (
        <LegoWorld
          houseLevel={o.level}
          streak={12}
          set={o.set && { file: o.set.file, turn: o.set.turn + extra }}
          className="w-full h-[75vh] rounded overflow-hidden"
        />
      )}
    </main>
  );
}
