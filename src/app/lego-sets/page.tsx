"use client";

// ponytail: temporary comparison page (our built house vs official sets); delete once we pick
import dynamic from "next/dynamic";
import { useState } from "react";

const LegoWorld = dynamic(() => import("@/components/LegoWorld"), { ssr: false });

const OPTIONS: { label: string; level: number; set?: { file: string; turn: number } }[] = [
  { label: "Ours, level 1", level: 1 },
  { label: "Ours, level 5", level: 5 },
  { label: "Small Cottage (31009)", level: 1, set: { file: "31009-1.mpd", turn: 3 } },
  { label: "Holiday Home (1472)", level: 3, set: { file: "1472-1.mpd", turn: 2 } },
  { label: "Mountain Hut (31025)", level: 3, set: { file: "31025-1.mpd", turn: 0 } },
  { label: "Lakeside Lodge (31048)", level: 5, set: { file: "31048-1.mpd", turn: 3 } },
];

export default function LegoSets() {
  const [i, setI] = useState(2);
  const [extra, setExtra] = useState(0); // extra quarter turns, to check which way a set faces
  const o = OPTIONS[i];
  return (
    <main className="min-h-screen p-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {OPTIONS.map((opt, j) => (
          <button key={opt.label} onClick={() => {
              setI(j);
              setExtra(0);
            }} className={`px-3 py-1.5 rounded border text-sm ${j === i ? "bg-white text-black" : ""}`}>
            {opt.label}
          </button>
        ))}
        {o.set && (
          <button onClick={() => setExtra((e) => e + 1)} className="px-3 py-1.5 rounded border text-sm">
            Turn ↻
          </button>
        )}
      </div>
      <LegoWorld houseLevel={o.level} streak={12} set={o.set && { file: o.set.file, turn: o.set.turn + extra }} className="w-full h-[75vh] rounded overflow-hidden" />
    </main>
  );
}
