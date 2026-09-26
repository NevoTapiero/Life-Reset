"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import {
  CHARACTERS,
  CHARACTER_KEYS,
  CharacterKey,
  Profile,
  Quest,
  characterOf,
  nextStreakMilestone,
  rankForXp,
} from "@/lib/game";

type UserQuestRow = { quest_id: string; quests: Quest };

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
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

  async function chooseCharacter(key: CharacterKey) {
    const { data, error } = await supabase.rpc("set_archetype", { p_key: key });
    if (error) setError(error.message);
    else setProfile(data as Profile);
  }

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Syncing quests…</div>;
  }

  const rank = rankForXp(profile.xp);
  const character = characterOf(profile.archetype);
  const clearedAll = quests.length > 0 && quests.every((q) => doneToday.has(q.id));
  const clearedCount = quests.filter((q) => doneToday.has(q.id)).length;
  const milestone = nextStreakMilestone(profile.streak_current);
  const streakPct = Math.min(profile.streak_current / milestone, 1);

  return (
    <div className="rise">
      {/* hero: challenger card */}
      <div className="bezel">
        <div className="bezel-core p-4">
          <div className="flex items-center gap-4">
            <Avatar size={76} character={profile.archetype} />
            <div className="flex-1 min-w-0">
              <div className="hud-label">{character ? character.name : "Pick your character"}</div>
              <div className="display text-xl mt-0.5 truncate">{profile.username.toUpperCase()}</div>
              <div className="hud-label mt-1">
                <span className="font-mono">{profile.xp.toLocaleString()}</span> XP total
              </div>
            </div>
            <div className="flex flex-col items-center flex-none">
              <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={52} />
              <span className="hud-label mt-1" style={{ color: rank.color }}>
                {rank.label}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="hud-label">
                {rank.atMax ? "Top of the ladder" : `Next: ${nextRankLabel(rank.tierIndex, rank.stageIndex)}`}
              </span>
              <span className="hud-label font-mono">
                {rank.atMax ? "MAX" : `${rank.xpIntoStage}/${rank.xpForStage} XP`}
              </span>
            </div>
            <div className="track">
              <div style={{ width: `${rank.progress * 100}%`, background: rank.color, boxShadow: `0 0 12px ${rank.color}` }} />
            </div>

            <div className="flex justify-between items-center mb-1.5 mt-3.5">
              <span className="hud-label flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                <Icon name="flame" size={13} strokeWidth={2} />
                Streak · <span className="font-mono text-[12px]">{profile.streak_current}</span> {profile.streak_current === 1 ? "day" : "days"}
              </span>
              <span className="hud-label font-mono">
                next {milestone} · best {profile.streak_best}
              </span>
            </div>
            <div className="track track-accent">
              <div style={{ width: `${streakPct * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* first run: choose your character */}
      {!profile.archetype && (
        <div className="hud-frame p-4 mt-5 rise">
          <div className="hud-label mb-1" style={{ color: "var(--accent)" }}>Choose your character</div>
          <p className="text-sm text-muted mb-3.5">Five challengers, five focuses. Pick who you fight as; you can switch later in your profile.</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {CHARACTER_KEYS.map((key) => (
              <button
                key={key}
                className="flex flex-col items-center gap-1.5 flex-none active:scale-95 transition-transform"
                onClick={() => chooseCharacter(key)}
              >
                <Avatar size={64} character={key} />
                <span className="hud-label !text-ink">{CHARACTERS[key].name.replace("The ", "")}</span>
                <span className="hud-label !text-[9px]">{CHARACTERS[key].stat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* quests */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <span className="eyebrow hud-label !text-ink">System · Today&apos;s quests</span>
        <div className="flex items-center gap-3">
          <span className="hud-label font-mono">
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
          <p className="display mt-2">ALL QUESTS CLEARED.</p>
          <p className="text-sm text-muted mt-1">
            The streak holds. See you tomorrow, challenger.
          </p>
        </div>
      )}
    </div>
  );
}

function nextRankLabel(tierIndex: number, stageIndex: number): string {
  const stages = ["I", "II", "III"];
  const tiers = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion"];
  if (stageIndex < 2) return `${tiers[tierIndex]} ${stages[stageIndex + 1]}`;
  if (tierIndex < tiers.length - 1) return `${tiers[tierIndex + 1]} I`;
  return "Champion III";
}
