"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

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
      <span className="eyebrow hud-label !text-ink">System · Live board</span>
      <h1 className="display text-2xl mt-3">THIS WEEK</h1>
      <p className="text-muted text-sm mt-1.5">
        Weekly XP resets every Monday. Every quest you clear moves you up.
      </p>

      {myIndex >= 0 && (
        <div className="hud-frame p-4 mt-5 flex items-center gap-4">
          <span className="display text-3xl" style={{ color: "var(--accent)" }}>
            #{myIndex + 1}
          </span>
          <span className="flex-1">
            <span className="block font-semibold text-[15px]">Your position</span>
            <span className="hud-label">{rows[myIndex].weekly_xp.toLocaleString()} XP this week</span>
          </span>
          <span className="flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
            <Icon name="flame" size={18} />
            <span className="font-mono text-sm">{rows[myIndex].streak_current}</span>
          </span>
        </div>
      )}

      <div className="card mt-5 divide-y divide-[var(--line)] overflow-hidden stagger">
        {rows.map((r, i) => (
          <div
            key={`${r.username}-${i}`}
            className="px-4 py-3 flex items-center gap-3"
            style={r.is_me ? { background: "rgba(255,107,0,0.07)" } : undefined}
          >
            <span className="w-8 flex justify-center flex-none">
              {i === 0 ? (
                <Icon name="crown" size={19} className="text-accent" strokeWidth={1.8} />
              ) : (
                <span className="hud-label" style={i < 3 ? { color: "var(--bronze)" } : undefined}>
                  #{i + 1}
                </span>
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span
                className="block font-mono text-sm truncate"
                style={r.is_me ? { color: "var(--accent)" } : undefined}
              >
                {r.username}
                {r.is_me ? " (you)" : ""}
              </span>
              {r.archetype && <span className="hud-label">{r.archetype}</span>}
            </span>
            <span className="text-right flex-none">
              <span className="block font-mono text-sm" style={{ color: "var(--accent)" }}>
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
