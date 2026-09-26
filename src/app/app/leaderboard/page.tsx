"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = {
  username: string;
  archetype: string | null;
  xp: number;
  streak_current: number;
  weekly_xp: number;
  is_me: boolean;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_leaderboard").then(({ data, error }) => {
      if (error) setError(error.message);
      else setRows((data as Row[]) ?? []);
    });
  }, []);

  if (error) return <p className="text-danger text-sm py-10">{error}</p>;
  if (!rows) return <div className="hud-label pulse-glow text-center py-20">Ranking challengers…</div>;

  const myIndex = rows.findIndex((r) => r.is_me);

  return (
    <div className="rise">
      <div className="hud-label">This week</div>
      <h1 className="text-2xl font-bold mt-1">Live board</h1>
      <p className="text-muted text-sm mt-1">
        Weekly XP resets every Monday. Every quest you clear moves you up.
      </p>
      {myIndex >= 0 && (
        <div className="card p-4 mt-4 flex items-center gap-3 border-l-2 border-l-[var(--accent)]">
          <span className="text-2xl font-bold text-accent">#{myIndex + 1}</span>
          <span className="flex-1">
            <span className="block font-semibold">Your position</span>
            <span className="hud-label">{rows[myIndex].weekly_xp.toLocaleString()} XP this week</span>
          </span>
          <span aria-hidden>🔥 {rows[myIndex].streak_current}</span>
        </div>
      )}
      <div className="card mt-5 divide-y divide-[var(--line)]">
        {rows.map((r, i) => (
          <div
            key={`${r.username}-${i}`}
            className={`px-4 py-3 flex items-center gap-3 ${r.is_me ? "bg-panel2" : ""}`}
          >
            <span className={`hud-label w-7 ${i < 3 ? "!text-gold" : ""}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </span>
            <span className="flex-1">
              <span className={`block font-mono text-sm ${r.is_me ? "text-accent" : ""}`}>
                {r.username}
                {r.is_me ? " (you)" : ""}
              </span>
              {r.archetype && <span className="hud-label">{r.archetype}</span>}
            </span>
            <span className="text-right">
              <span className="block font-mono text-sm text-accent">
                {r.weekly_xp.toLocaleString()}
              </span>
              <span className="hud-label">weekly XP</span>
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-6 text-center text-muted text-sm">
            The board is empty. Clear a quest to claim first place.
          </div>
        )}
      </div>
    </div>
  );
}
