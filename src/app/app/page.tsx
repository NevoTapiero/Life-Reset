"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
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
  const clearedCount = quests.filter((q) => doneToday.has(q.id)).length;
  const streakPct = Math.min(profile.streak_current / Math.max(profile.streak_commitment, 1), 1);

  return (
    <div className="rise">
      {/* hero: challenger card */}
      <div className="bezel">
        <div className="bezel-core p-4">
          <div className="flex items-center gap-4">
            <Avatar size={76} />
            <div className="flex-1 min-w-0">
              <div className="hud-label">Campaign 1 · Day {day} / {PLAN_DAYS}</div>
              <div className="display text-xl mt-0.5 truncate">{profile.username.toUpperCase()}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="hud-label" style={{ color: rank.color }}>
                  ◆ {rank.label}
                </span>
                <span className="hud-label">{profile.xp.toLocaleString()} XP</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5 pr-1" style={{ color: "var(--accent)" }}>
              <Icon name="flame" size={26} strokeWidth={1.8} />
              <span className="display text-lg leading-none">{profile.streak_current}</span>
              <span className="hud-label">streak</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="hud-label">Rank progress</span>
              <span className="hud-label">
                {rank.atMax ? "Max rank" : `${rank.xpIntoDivision}/${rank.xpForDivision} XP`}
              </span>
            </div>
            <div className="track">
              <div style={{ width: `${rank.progress * 100}%`, background: rank.color, boxShadow: `0 0 12px ${rank.color}` }} />
            </div>
            <div className="flex justify-between items-center mb-1.5 mt-3">
              <span className="hud-label">Contract · {profile.streak_commitment} day streak</span>
              <span className="hud-label">Best {profile.streak_best}</span>
            </div>
            <div className="track track-accent">
              <div style={{ width: `${streakPct * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* quests */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <span className="eyebrow hud-label !text-ink">System · Today&apos;s quests</span>
        <div className="flex items-center gap-3">
          <span className="hud-label">
            {clearedCount}/{quests.length}
          </span>
          <Link href="/app/quests" aria-label="Manage quests" className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform">
            <Icon name="sliders" size={17} />
          </Link>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      <div className="flex flex-col gap-2.5 stagger">
        {quests.map((q) => {
          const done = doneToday.has(q.id);
          return (
            <button
              key={q.id}
              onClick={() => toggle(q)}
              disabled={pendingId === q.id}
              className={`option-row px-3.5 py-3 flex items-center gap-3 relative ${done ? "selected" : ""}`}
            >
              <span className="icon-tile" style={done ? { color: "var(--accent)", borderColor: "rgba(255,107,0,0.4)" } : undefined}>
                <Icon name={q.icon} size={21} />
              </span>
              <span className="flex-1 text-left min-w-0">
                <span className={`block text-[15px] truncate ${done ? "line-through text-muted" : ""}`}>{q.title}</span>
                <span className="hud-label mt-0.5">{q.pillar} · +{q.xp} XP</span>
              </span>
              <span
                className="w-7 h-7 rounded-full border flex items-center justify-center flex-none transition-colors duration-150"
                style={
                  done
                    ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 14px rgba(255,107,0,0.5)" }
                    : { borderColor: "var(--line-strong)", color: "transparent" }
                }
                aria-hidden
              >
                <Icon name="check" size={14} strokeWidth={2.4} />
              </span>
              {xpFloat?.id === q.id && (
                <span className="xp-float absolute right-4 -top-1 font-mono font-bold text-sm">
                  +{xpFloat.amount} XP
                </span>
              )}
            </button>
          );
        })}
        {quests.length === 0 && (
          <div className="card p-6 text-center text-muted text-sm">
            No active quests. Open the quest manager to build your loadout.
          </div>
        )}
      </div>

      {clearedAll && (
        <div className="hud-frame p-5 mt-6 text-center rise">
          <div className="flex justify-center" style={{ color: "var(--accent)" }}>
            <Icon name="trophy" size={26} strokeWidth={1.8} />
          </div>
          <p className="display mt-2">DAY {day} CLEARED, CHALLENGER.</p>
          <p className="text-sm text-muted mt-1">
            Campaign 1 ends {formatDate(finishDate(profile.plan_started_on))}. See you tomorrow.
          </p>
        </div>
      )}
    </div>
  );
}
