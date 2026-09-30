"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rankForXp } from "@/lib/game";
import type { Resident } from "@/lib/legoWorld";
import type { Visit } from "@/components/LegoWorld";
import { useStations } from "@/lib/useStations";

const LegoTown = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoTown), { ssr: false });
const LegoRoom = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoRoom), { ssr: false });

// ponytail: nearest 9 plots by rank order; page the street when friend lists get long
const MAX_PLOTS = 9;

type VisitRow = { username: string; knocked_by_me: boolean; allowed: boolean };

// Your town: your plot in the middle of the street, your friends' either side.
// Each house is built from that player's rank, each garden from their streak.
// Knock on a friend's door to be let in; answer the people at yours.
export default function TownPage() {
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [visits, setVisits] = useState<Record<string, Visit>>({});
  const [atDoor, setAtDoor] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { stations, complete, chest, gold, collect, prices, owned, buy } = useStations();

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
      const street: Resident[] = people.filter((p) => p.me);
      people.filter((p) => !p.me).forEach((p, i) => (i % 2 ? street.push(p) : street.unshift(p)));
      setResidents(street);
    });
    supabase.rpc("my_visits").then(({ data, error }) => {
      if (error) return; // visits need the house-visits migration; the town works without it
      const rows = (data ?? []) as VisitRow[];
      setVisits(Object.fromEntries(rows.filter((v) => v.knocked_by_me).map((v) => [v.username, v.allowed ? "allowed" : "knocked"])));
      setAtDoor(rows.filter((v) => !v.knocked_by_me && !v.allowed).map((v) => v.username));
    });
  }, []);

  async function knock(name: string) {
    setError(null);
    const { error } = await supabase.rpc("knock", { p_host: name });
    if (error) return setError(error.message);
    setVisits((v) => ({ ...v, [name]: "knocked" }));
  }

  async function answer(name: string, allow: boolean) {
    const { error } = await supabase.rpc("answer_knock", { p_visitor: name, p_allow: allow });
    if (error) return setError(error.message);
    setAtDoor((d) => d.filter((n) => n !== name));
  }

  if (!residents) {
    return error ? (
      <p className="text-danger text-sm py-10 text-center">{error}</p>
    ) : (
      <div className="hud-label pulse-glow text-center py-20">Walking into town…</div>
    );
  }

  return (
    <div className="slide-in">
      <div className="flex items-center justify-between mb-3">
        <h1 className="display text-[19px]">Town</h1>
        <span className="hud-label">{residents.length === 1 ? "Just you so far" : `${residents.length} houses`}</span>
      </div>

      {atDoor.map((name) => (
        <div key={name} className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 mb-3" style={{ borderColor: "var(--line)" }}>
          <span className="text-sm">
            <b>{name}</b> is knocking on your door
          </span>
          <span className="flex gap-2 flex-none">
            <button onClick={() => answer(name, false)} className="px-3 py-1.5 rounded-full text-sm text-muted">
              Not now
            </button>
            <button onClick={() => answer(name, true)} className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#fff" }}>
              Let in
            </button>
          </span>
        </div>
      ))}
      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      <LegoTown
        residents={residents}
        visits={visits}
        onKnock={knock}
        room={(leave) => (
          <LegoRoom
            stations={stations ?? []}
            onTap={complete}
            chest={chest}
            gold={gold}
            onCollect={async () => (await collect())?.xp ?? null}
            prices={prices}
            owned={owned}
            onBuy={buy}
            onLeave={leave}
            className="w-full h-full"
          />
        )}
        className="rounded-2xl overflow-hidden h-[68vh] min-h-[380px]" />

      {residents.length === 1 && (
        <p className="text-muted text-sm mt-3 text-center">
          Your street is empty. <Link href="/app/leaderboard" className="underline">Add friends</Link> and their houses move in next door.
        </p>
      )}
    </div>
  );
}
