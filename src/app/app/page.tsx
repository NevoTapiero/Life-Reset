"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  PLAN_DAYS,
  Profile,
  Quest,
  dayOfPlan,
  finishDate,
  formatDate,
  rankForXp,
} from "@/lib/game";

type UserQuestRow = { quest_id: string; quests: Quest };

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [today, setToday] = useState<string>("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [xpFloat, setXpFloat] = useState<{ id: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const [{ data: prof }, { data: uq }, { data: todayData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("user_quests").select("quest_id, quests(*)").eq("user_id", uid).eq("active", true),
      supabase.rpc("app_today"),
    ]);
    const todayStr = String(todayData);
    const { data: comps } = await supabase
      .from("quest_completions")
      .select("quest_id")
      .eq("user_id", uid)
      .eq("completed_on", todayStr);
    setProfile(prof as Profile);
    const list = ((uq as unknown as UserQuestRow[]) ?? [])
      .map((r) => r.quests)
      .filter(Boolean)
      .sort((a, b) => a.sort - b.sort);
    setQuests(list);
    setDoneToday(new Set((comps ?? []).map((c: { quest_id: string }) => c.quest_id)));
    setToday(todayStr);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(q: Quest) {
    if (pendingId) return;
    setPendingId(q.id);
    setError(null);
    const isDone = doneToday.has(q.id);
    // optimistic
    setDoneToday((prev) => {
      const nextSet = new Set(prev);
      if (isDone) nextSet.delete(q.id);
      else nextSet.add(q.id);
      return nextSet;
    });
    if (!isDone) setXpFloat({ id: q.id, amount: q.xp });
    const { data, error: rpcError } = await supabase.rpc(isDone ? "uncomplete_quest" : "complete_quest", {
      p_quest_id: q.id,
    });
    if (rpcError) {
      // revert
      setDoneToday((prev) => {
        const nextSet = new Set(prev);
        if (isDone) nextSet.add(q.id);
        else nextSet.delete(q.id);
        return nextSet;
      });
      setError(rpcError.message);
    } else if (data) {
      setProfile(data as Profile);
    }
    setPendingId(null);
    setTimeout(() => setXpFloat(null), 1100);
  }

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Syncing quests…</div>;
  }

  const rank = rankForXp(profile.xp);
  const day = dayOfPlan(profile.plan_started_on, today || new Date().toISOString().slice(0, 10));
  const clearedAll = quests.length > 0 && quests.every((q) => doneToday.has(q.id));
  const streakPct = Math.min(profile.streak_current / Math.max(profile.streak_commitment, 1), 1);

  return (
    <div className="rise">
      <div className="flex items-center justify-between">
        <div>
          <div className="hud-label">Campaign 1 · Day {day} of {PLAN_DAYS}</div>
          <h1 className="text-2xl font-bold mt-1">
            {clearedAll ? "All quests cleared." : `Today's quests, ${profile.username}`}
          </h1>
        </div>
        <div className="text-right">
          <div className="font-mono font-bold" style={{ color: rank.color }}>
            {rank.label}
          </div>
          <div className="hud-label mt-0.5">{profile.xp.toLocaleString()} XP</div>
        </div>
      </div>

      <div className="card p-4 mt-5">
        <div className="flex justify-between items-center">
          <span className="hud-label">Rank progress</span>
          <span className="hud-label">
            {rank.atMax ? "Max rank" : `${rank.xpIntoDivision}/${rank.xpForDivision} XP`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-panel2 overflow-hidden mt-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${rank.progress * 100}%`, background: rank.color }}
          />
        </div>
        <div className="flex justify-between items-center mt-4">
          <span className="hud-label">
            🔥 Streak {profile.streak_current} / {profile.streak_commitment} committed
          </span>
          <span className="hud-label">Best {profile.streak_best}</span>
        </div>
        <div className="h-2 rounded-full bg-panel2 overflow-hidden mt-2">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${streakPct * 100}%` }}
          />
        </div>
      </div>

      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      <div className="flex flex-col gap-2.5 mt-5">
        {quests.map((q) => {
          const done = doneToday.has(q.id);
          return (
            <button
              key={q.id}
              onClick={() => toggle(q)}
              disabled={pendingId === q.id}
              className={`option-row px-4 py-3.5 flex items-center gap-3 relative ${done ? "selected" : ""}`}
            >
              <span className="text-2xl" aria-hidden>{q.icon}</span>
              <span className="flex-1 text-left">
                <span className={`block ${done ? "line-through text-muted" : ""}`}>{q.title}</span>
                <span className="hud-label mt-0.5">{q.pillar} · +{q.xp} XP</span>
              </span>
              <span
                className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm ${
                  done ? "bg-accent border-accent text-[#04110d]" : "border-line text-transparent"
                }`}
                aria-hidden
              >
                ✓
              </span>
              {xpFloat?.id === q.id && (
                <span className="xp-float absolute right-4 -top-1 text-accent font-mono font-bold text-sm">
                  +{xpFloat.amount} XP
                </span>
              )}
            </button>
          );
        })}
        {quests.length === 0 && (
          <div className="card p-6 text-center text-muted">
            No active quests yet. Finish onboarding to generate your plan.
          </div>
        )}
      </div>

      {clearedAll && (
        <div className="card p-5 mt-5 text-center border-l-2 border-l-[var(--accent)]">
          <div className="text-3xl" aria-hidden>🏁</div>
          <p className="mt-2 font-semibold">Day {day} cleared, challenger.</p>
          <p className="text-sm text-muted mt-1">
            Campaign 1 ends {formatDate(finishDate(profile.plan_started_on))}. See you tomorrow.
          </p>
        </div>
      )}
    </div>
  );
}
