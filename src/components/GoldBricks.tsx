"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { legoLevel, photoOf } from "@/lib/brick";
import { rankForXp, type Profile } from "@/lib/game";

// Gold bricks, like the LEGO games: one for each milestone, gold when earned,
// a grey outline while it's still to get. Worked out from what the app already
// knows (profile, missions done, friends, connected apps), nothing new stored.

type Brick = { id: string; name: string; how: string; got: boolean; progress?: string };

function GoldBrick({ got, size = 44 }: { got: boolean; size?: number }) {
  const [body, edge, shine] = got ? ["#f2cd37", "#b88a06", "#fff3b0"] : ["#dde4eb", "#c3ced9", "#eef2f6"];
  return (
    <svg viewBox="0 0 32 26" width={size} height={(size * 26) / 32} aria-hidden style={{ display: "block" }}>
      {[9.5, 22.5].map((x) => (
        <g key={x}>
          <rect x={x - 4.6} y="1.6" width="9.2" height="4.6" rx="1.6" fill={edge} />
          <rect x={x - 4.6} y="0.8" width="9.2" height="4.2" rx="1.6" fill={body} />
          <rect x={x - 3.4} y="1.4" width="3" height="1.4" rx="0.7" fill={shine} opacity="0.8" />
        </g>
      ))}
      <rect x="1.5" y="5" width="29" height="20" rx="3.5" fill={edge} />
      <rect x="1.5" y="5" width="29" height="17.5" rx="3.5" fill={body} />
      <rect x="4" y="6.6" width="15" height="2" rx="1" fill={shine} opacity={got ? 0.9 : 0.6} />
      {got && <path d="M23 10l1 2.2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3Z" fill="#fff" opacity="0.9" />}
    </svg>
  );
}

export default function GoldBricks({ profile }: { profile: Profile }) {
  const [counts, setCounts] = useState<{ done: number; friends: number; apps: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("quest_completions").select("quest_id", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.rpc("get_leaderboard"),
      supabase.rpc("my_trackers"),
    ]).then(([c, lb, tr]) =>
      setCounts({
        done: c.count ?? 0,
        friends: Math.max(0, ((lb.data as unknown[]) ?? []).length - 1),
        apps: ((tr.data as unknown[]) ?? []).length,
      }),
    );
  }, [profile.id]);

  const level = legoLevel(rankForXp(profile.xp).tierIndex);
  const best = Math.max(profile.streak_best, profile.streak_current);
  const n = counts;
  const bricks: Brick[] = [
    { id: "first", name: "First brick", how: "Check your first mission", got: (n?.done ?? 0) >= 1 },
    { id: "ten", name: "Ten bricks", how: "Check 10 missions", got: (n?.done ?? 0) >= 10, progress: `${Math.min(n?.done ?? 0, 10)}/10` },
    { id: "hundred", name: "Brick pile", how: "Check 100 missions", got: (n?.done ?? 0) >= 100, progress: `${Math.min(n?.done ?? 0, 100)}/100` },
    { id: "week", name: "One week", how: "A 7 day streak", got: best >= 7, progress: `${Math.min(best, 7)}/7` },
    { id: "fortnight", name: "Two weeks", how: "A 14 day streak", got: best >= 14, progress: `${Math.min(best, 14)}/14` },
    { id: "month", name: "A whole month", how: "A 30 day streak", got: best >= 30, progress: `${Math.min(best, 30)}/30` },
    { id: "xp1k", name: "1,000 XP", how: "Earn 1,000 XP", got: profile.xp >= 1000, progress: `${Math.min(profile.xp, 1000)}/1000` },
    { id: "xp5k", name: "5,000 XP", how: "Earn 5,000 XP", got: profile.xp >= 5000, progress: `${Math.min(profile.xp, 5000)}/5000` },
    { id: "lv3", name: "Level 3", how: "Reach LEGO level 3", got: level >= 3 },
    { id: "lv5", name: "Level 5", how: "Reach LEGO level 5, the full outfit", got: level >= 5 },
    { id: "friend", name: "Neighbour", how: "Add a friend to your town", got: (n?.friends ?? 0) >= 1 },
    { id: "town", name: "Full street", how: "Have 4 friends in your town", got: (n?.friends ?? 0) >= 4, progress: `${Math.min(n?.friends ?? 0, 4)}/4` },
    { id: "app", name: "Plugged in", how: "Connect an app that pays XP by itself", got: (n?.apps ?? 0) >= 1 },
    { id: "photo", name: "Say cheese", how: "Add your photo", got: !!photoOf(profile) },
  ];
  const got = bricks.filter((b) => b.got).length;
  const shown = bricks.find((b) => b.id === open);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <span className="display text-[18px]">Gold bricks</span>
        <span className="chip chip-yellow">
          {got} / {bricks.length}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mt-3">
        {bricks.map((b) => (
          <button
            key={b.id}
            className={`flex justify-center py-1 rounded-[10px] transition-transform active:translate-y-[1px] ${open === b.id ? "bg-[var(--panel-2)]" : ""}`}
            aria-label={`${b.name}: ${b.got ? "earned" : b.how}`}
            aria-pressed={open === b.id}
            onClick={() => setOpen(open === b.id ? null : b.id)}
          >
            <GoldBrick got={b.got} size={38} />
          </button>
        ))}
      </div>
      <p className="text-[13px] font-bold mt-2 min-h-[20px]" role="status">
        {shown ? (
          <>
            <b>{shown.name}</b>: {shown.got ? "earned" : shown.how}
            {!shown.got && shown.progress ? ` (${shown.progress})` : ""}
          </>
        ) : (
          <span className="text-muted">Tap a brick to see how to get it.</span>
        )}
      </p>
    </section>
  );
}
