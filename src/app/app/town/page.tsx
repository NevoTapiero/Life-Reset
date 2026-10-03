"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { rankForXp } from "@/lib/game";
import type { Resident } from "@/lib/legoWorld";
import { energyFrom, todayKey, type LedgerMeta } from "@/lib/energy";
import type { Visit } from "@/components/LegoWorld";
import { useStations } from "@/lib/useStations";
import { brickSound } from "@/lib/brickSound";
import TownLoader from "@/components/TownLoader";
import BrickWall, { JUMP_FLAG } from "@/components/BrickWall";

type Row = { username: string; archetype: string | null; xp: number; streak_current: number; is_me: boolean };
const toResident = (r: Row): Resident => ({
  name: r.username,
  level: rankForXp(r.xp).tierIndex + 1,
  rank: rankForXp(r.xp).tierIndex * 3 + rankForXp(r.xp).stageIndex,
  streak: r.streak_current,
  me: r.is_me,
  character: r.archetype,
});
const visitIn = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("visit"));

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
  // whose town you're in (?visit=<username>: a friend's; none: yours), and everyone on your friends list
  const [visit, setVisit] = useState(visitIn);
  const [rows, setRows] = useState<Row[] | null>(null);
  const me = useMemo(() => rows?.filter((r) => r.is_me).map(toResident)[0] ?? null, [rows]);
  const friends = useMemo(() => rows?.filter((r) => !r.is_me).map(toResident) ?? [], [rows]);
  // your town is yours alone; a friend's town is theirs (you come along as a guest)
  // (a name that isn't on your friends list opens your own town)
  const host = visit ? friends.find((f) => f.name === visit) : undefined;
  const residents = useMemo(() => (rows ? (host ? [host] : me ? [me] : []) : null), [rows, host, me]);
  // the browser's back and forward buttons step between the towns you've been to
  useEffect(() => {
    const back = () => setVisit(visitIn());
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
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
  }, []);
  const [visits, setVisits] = useState<Record<string, Visit>>({});
  // your friend code, for the invite link (/join/<code>: whoever opens it becomes your friend)
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (uid)
        supabase
          .from("profiles")
          .select("friend_code")
          .eq("id", uid)
          .single()
          .then(({ data: p }) => setCode((p as { friend_code?: string } | null)?.friend_code ?? null));
    });
  }, []);
  const invite = async () => {
    if (!code) return "No friend code yet";
    const url = `${window.location.origin}/join/${code}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Solo Leveling", text: "Come and see my LEGO town!", url });
        return "Invite sent";
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      return "Link copied: send it to a friend";
    } catch {
      return url;
    }
  };
  const [atDoor, setAtDoor] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // the brick wall: jumped in from World, it's still up here and comes down brick by brick; going to a
  // friend's town (or home) it goes up, the town changes behind it, and it comes down again
  const [wall, setWall] = useState<"in" | "out" | null>(() => (typeof window !== "undefined" && sessionStorage.getItem(JUMP_FLAG) === "1" ? "out" : null));
  useEffect(() => sessionStorage.removeItem(JUMP_FLAG), []);
  const [goingTo, setGoingTo] = useState<string | null>(null);
  const goTo = (name: string | null) => {
    if (wall) return;
    brickSound.wipe();
    setGoingTo(name);
    setWall("in");
  };
  const bricks = wall && (
    <BrickWall
      key={wall}
      phase={wall}
      className="fixed inset-0 z-[80]"
      onDone={() => {
        if (wall === "out") return setWall(null);
        setVisit(goingTo);
        window.history.pushState(null, "", goingTo ? `/app/town?visit=${encodeURIComponent(goingTo)}` : "/app/town");
        setWall("out");
      }}
    />
  );
  const { stations, complete, chest, gold, collect, prices, owned, buy, garden, place } = useStations();
  const router = useRouter();

  useEffect(() => {
    supabase.rpc("get_leaderboard").then(({ data, error }) => {
      if (error) return setError(error.message);
      setRows((data ?? []) as Row[]);
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
        <span className="hud-label">{host ? `Visiting ${host.name}` : "Your town"}</span>
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
        key={host?.name ?? "home"}
        residents={residents}
        friends={friends}
        onVisit={goTo}
        tour
        onInvite={invite}
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
        visit={host?.name}
        guest={host && me ? me : undefined}
        backLabel={host ? "My town" : "World"}
        energy={energy}
        garden={garden}
        onPlace={place}
        onBack={() => (host ? goTo(null) : router.push("/app/world"))}
        className={TOWN_BOX} />

      {!host && (
        <p className="text-muted text-sm mt-3 text-center">
          This town is yours: rank up to fill the spots round your house. Tap Friends to visit theirs, or <Link href="/app/world" className="underline">add a friend</Link>.
        </p>
      )}
      {visit && !host && <p className="text-muted text-sm mt-3 text-center">{visit} isn&apos;t on your friends list yet, so here&apos;s your own town. Add them on the World page first.</p>}
    </div>
  );
}
