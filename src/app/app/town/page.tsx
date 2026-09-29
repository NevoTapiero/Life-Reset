"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import TownCanvas from "@/components/TownCanvas";
import { rankForXp, type CharacterKey } from "@/lib/game";
import { loadTown, statusFor, type TownHouse, type TownRow } from "@/lib/town";
import type { TownState } from "@/game/TownScene";

// The town replaces the board: your circle as houses on a map. Tap a house
// for the one sentence the street knows, and how their day is going.

export default function TownPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TownRow[]>([]);
  const [hero, setHero] = useState<CharacterKey | null>(null);
  const [visiting, setVisiting] = useState<TownHouse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // state lands in .then callbacks, never synchronously in the effect body
    loadTown()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the town"));
    supabase.auth
      .getUser()
      .then(({ data }) => (data.user ? supabase.from("profiles").select("archetype").eq("id", data.user.id).single() : null))
      .then((r) => setHero((r?.data?.archetype as CharacterKey) ?? null));
  }, []);

  const state = useMemo<TownState>(() => ({ hero, rows }), [hero, rows]);

  return (
    <div className="slide-in">
      <div className="flex items-center justify-between mb-3">
        <h1 className="display text-[19px]">Town</h1>
        <Link href="/app/leaderboard" className="hud-label underline underline-offset-4">
          Board & friends
        </Link>
      </div>

      <TownCanvas state={state} onHouse={setVisiting} />
      <p className="hud-label text-center mt-2">Tap the ground to walk · tap a house to visit · drag to look around</p>
      {error && <p className="text-sm text-danger mt-3">{error}</p>}

      {visiting && (
        <div className="rankup-backdrop" onClick={() => setVisiting(null)}>
          <div className="card p-5 w-[88%] max-w-sm rise text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center">
              <Avatar size={72} character={visiting.row.archetype} tierIndex={rankForXp(visiting.row.xp).tierIndex} />
            </div>
            <div className="display text-[20px] mt-3">{visiting.row.is_me ? "Your house" : visiting.row.username}</div>
            <div className="mt-1" style={{ color: "var(--accent)" }}>{statusFor(visiting.row)}</div>
            <div className="flex justify-center gap-6 mt-4">
              <div>
                <div className="display text-[18px]" style={{ color: "var(--gold)" }}>
                  +{visiting.row.today_xp ?? visiting.row.weekly_xp ?? 0}
                </div>
                <div className="hud-label mt-1">{visiting.row.today_xp !== null ? "XP today" : "XP this week"}</div>
              </div>
              <div>
                <div className="display text-[18px]">{visiting.row.streak_current}</div>
                <div className="hud-label mt-1">day streak</div>
              </div>
              <div>
                <div className="display text-[18px]" style={{ color: rankForXp(visiting.row.xp).color }}>{rankForXp(visiting.row.xp).label}</div>
                <div className="hud-label mt-1">rank</div>
              </div>
            </div>
            {visiting.row.is_me ? (
              <button className="btn-primary w-full py-3.5 mt-5" onClick={() => router.push("/app")}>
                Go inside
              </button>
            ) : (
              <button className="btn-ghost w-full py-3.5 mt-5" onClick={() => router.push(`/app/friend/${encodeURIComponent(visiting.row.username)}`)}>
                See their record
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
