"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rankForXp } from "@/lib/game";
import type { Resident } from "@/lib/legoWorld";

const LegoTown = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoTown), { ssr: false });

// ponytail: nearest 9 plots by rank order; page the street when friend lists get long
const MAX_PLOTS = 9;

// Your town: your plot in the middle of the street, your friends' either side.
// Each house is built from that player's rank, each garden from their streak.
export default function TownPage() {
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_leaderboard").then(({ data, error }) => {
      if (error) return setError(error.message);
      const rows = (data ?? []) as { username: string; xp: number; streak_current: number; is_me: boolean }[];
      const people = rows.slice(0, MAX_PLOTS).map((r) => ({
        name: r.username,
        level: rankForXp(r.xp).tierIndex + 1,
        streak: r.streak_current,
        me: r.is_me,
      }));
      // you in the middle, friends alternating either side
      const me = people.filter((p) => p.me);
      const others = people.filter((p) => !p.me);
      const street: Resident[] = [...me];
      others.forEach((p, i) => (i % 2 ? street.push(p) : street.unshift(p)));
      setResidents(street);
    });
  }, []);

  if (error) return <p className="text-danger text-sm py-10 text-center">{error}</p>;
  if (!residents) return <div className="hud-label pulse-glow text-center py-20">Walking into town…</div>;

  return (
    <div className="slide-in">
      <div className="flex items-center justify-between mb-3">
        <h1 className="display text-[19px]">Town</h1>
        <span className="hud-label">{residents.length === 1 ? "Just you so far" : `${residents.length} houses`}</span>
      </div>
      <div className="relative rounded-2xl overflow-hidden" style={{ height: "68vh", minHeight: 380 }}>
        <LegoTown residents={residents} className="absolute inset-0" />
      </div>
      {residents.length === 1 && (
        <p className="text-muted text-sm mt-3 text-center">
          Your street is empty. <Link href="/app/leaderboard" className="underline">Add friends</Link> and their houses move in next door.
        </p>
      )}
    </div>
  );
}
