"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { rankForXp } from "@/lib/game";
import type { Resident } from "@/lib/legoWorld";
import { energyFrom, todayKey, type LedgerMeta } from "@/lib/energy";
import type { Visit } from "@/components/LegoWorld";
import { useStations } from "@/lib/useStations";
import TownLoader from "@/components/TownLoader";
import BrickWall, { JUMP_FLAG } from "@/components/BrickWall";

// the same LEGO loading screen from the tap until the town has built: while friends load, while the 3D
// code downloads (here), and inside the town while it builds itself (LegoTown)
const TOWN_BOX = "rounded-2xl overflow-hidden h-[68vh] min-h-[380px]";
const LegoTown = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoTown), { ssr: false, loading: () => <TownLoader className={TOWN_BOX} /> });
const LegoRoom = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoRoom), { ssr: false });

type VisitRow = { username: string; knocked_by_me: boolean; allowed: boolean };

// Your own town (Clash of Clans style, Iftach + Nevo, 2 Oct): your house in the middle, the spots round it
// yours to fill as you level up; your house is built from your rank, your garden from your streak.
// /app/town?visit=<username> opens that friend's town instead, with you walking round it as a guest.
export default function TownPage() {
  const [visit] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("visit")));
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [me, setMe] = useState<Resident | null>(null);
  // /app/town?visit=<username>: open on that friend's house
  // your energy today: last night's sleep and today's steps, from the ledger's watch rows
  const [energy, setEnergy] = useState<number | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
      supabase
        .from("xp_ledger")
        .select("meta")
        .eq("user_id", uid)
        .gte("created_at", since)
        .then(({ data: rows }) => setEnergy(energyFrom((rows ?? []).map((r) => r.meta as LedgerMeta), todayKey())));
    });
  }, [visit]);
  const [visits, setVisits] = useState<Record<string, Visit>>({});
  const [atDoor, setAtDoor] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // jumped in from World: the brick wall that covered it is still up here, and comes down brick by brick
  const [wall, setWall] = useState(() => typeof window !== "undefined" && sessionStorage.getItem(JUMP_FLAG) === "1");
  useEffect(() => sessionStorage.removeItem(JUMP_FLAG), []);
  const bricks = wall && <BrickWall phase="out" className="fixed inset-0 z-[80]" onDone={() => setWall(false)} />;
  const { stations, complete, chest, gold, collect, prices, owned, buy, garden, place } = useStations();
  const router = useRouter();

  useEffect(() => {
    supabase.rpc("get_leaderboard").then(({ data, error }) => {
      if (error) return setError(error.message);
      const rows = (data ?? []) as { username: string; archetype: string | null; xp: number; streak_current: number; is_me: boolean }[];
      const toResident = (r: (typeof rows)[number]) => ({
        name: r.username,
        level: rankForXp(r.xp).tierIndex + 1,
        streak: r.streak_current,
        me: r.is_me,
        character: r.archetype,
      });
      // your town is yours alone; a friend's town is theirs (you come along as a guest)
      const me = rows.filter((r) => r.is_me).map(toResident);
      const host = visit ? rows.filter((r) => r.username === visit).map(toResident) : [];
      setMe(me[0] ?? null);
      setResidents(visit ? host : me);
    });
    supabase.rpc("my_visits").then(({ data, error }) => {
      if (error) return; // visits need the house-visits migration; the town works without it
      const rows = (data ?? []) as VisitRow[];
      setVisits(Object.fromEntries(rows.filter((v) => v.knocked_by_me).map((v) => [v.username, v.allowed ? "allowed" : "knocked"])));
      setAtDoor(rows.filter((v) => !v.knocked_by_me && !v.allowed).map((v) => v.username));
    });
  }, [visit]);

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
      <div className="slide-in">
        {bricks}
        <div className="flex items-center justify-between mb-3">
          <h1 className="display text-[19px]">Town</h1>
        </div>
        <TownLoader className={TOWN_BOX} />
      </div>
    );
  }

  return (
    <div className="slide-in">
      {bricks}
      <div className="flex items-center justify-between mb-3">
        <h1 className="display text-[19px]">Town</h1>
        <span className="hud-label">{visit ? `Visiting ${visit}` : "Your town"}</span>
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
        stations={stations ?? []}
        onTap={async (id) => (await complete(id))?.xp ?? null}
        room={(leave, mood) => (
          <LegoRoom
            mood={mood}
            chest={chest}
            gold={gold}
            onCollect={async () => (await collect())?.xp ?? null}
            owned={owned}
            onLeave={leave}
            level={residents.find((r) => r.me)?.level}
            character={residents.find((r) => r.me)?.character}
            name={residents.find((r) => r.me)?.name}
            className="w-full h-full"
          />
        )}
        gold={gold}
        prices={prices}
        owned={owned}
        onBuy={buy}
        visit={visit}
        guest={visit && me ? me : undefined}
        backLabel={visit ? "My town" : "World"}
        energy={energy}
        garden={garden}
        onPlace={place}
        onBack={() => router.push(visit ? "/app/town" : "/app/world")}
        className={TOWN_BOX} />

      {!visit && (
        <p className="text-muted text-sm mt-3 text-center">
          This town is yours. Level up to fill the spots round your house, and <Link href="/app/world" className="underline">visit your friends&apos; towns</Link>.
        </p>
      )}
      {visit && residents.length === 0 && <p className="text-muted text-sm mt-3 text-center">{visit} isn&apos;t in your town yet. Add them as a friend first.</p>}
    </div>
  );
}
