"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import XpMeter from "@/components/XpMeter";
import {
  CHARACTERS,
  CHARACTER_KEYS,
  CharacterKey,
  Profile,
  Quest,
  Rank,
  characterOf,
  nextStreakMilestone,
  questArt,
  rankForXp,
} from "@/lib/game";

type UserQuestRow = { quest_id: string; quests: Quest };

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [doneYesterday, setDoneYesterday] = useState<Set<string>>(new Set());
  const [days, setDays] = useState<{ today: string; yesterday: string } | null>(null);
  const [showYesterday, setShowYesterday] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [xpFloat, setXpFloat] = useState<{ id: string; amount: number } | null>(null);
  const [rankUp, setRankUp] = useState<Rank | null>(null);
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
    const yesterdayStr = new Date(new Date(todayStr + "T00:00:00Z").getTime() - 86400000)
      .toISOString()
      .slice(0, 10);
    const { data: comps } = await supabase
      .from("quest_completions")
      .select("quest_id, completed_on")
      .eq("user_id", uid)
      .in("completed_on", [todayStr, yesterdayStr]);
    setProfile(prof as Profile);
    const list = ((uq as unknown as UserQuestRow[]) ?? [])
      .map((r) => r.quests)
      .filter(Boolean)
      .sort((a, b) => a.sort - b.sort);
    setQuests(list);
    const rows = (comps ?? []) as { quest_id: string; completed_on: string }[];
    setDoneToday(new Set(rows.filter((c) => c.completed_on === todayStr).map((c) => c.quest_id)));
    setDoneYesterday(new Set(rows.filter((c) => c.completed_on === yesterdayStr).map((c) => c.quest_id)));
    setDays({ today: todayStr, yesterday: yesterdayStr });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(q: Quest, day: "today" | "yesterday" = "today") {
    if (pendingId || !days) return;
    setPendingId(q.id);
    setError(null);
    const doneSet = day === "today" ? doneToday : doneYesterday;
    const setDoneSet = day === "today" ? setDoneToday : setDoneYesterday;
    const isDone = doneSet.has(q.id);
    setDoneSet((prev) => {
      const nextSet = new Set(prev);
      if (isDone) nextSet.delete(q.id);
      else nextSet.add(q.id);
      return nextSet;
    });
    if (!isDone) setXpFloat({ id: q.id, amount: q.xp });
    const { data, error: rpcError } = await supabase.rpc(
      isDone ? "uncomplete_quest_for" : "complete_quest_for",
      { p_quest_id: q.id, p_on: day === "today" ? days.today : days.yesterday },
    );
    if (rpcError) {
      setDoneSet((prev) => {
        const nextSet = new Set(prev);
        if (isDone) nextSet.add(q.id);
        else nextSet.delete(q.id);
        return nextSet;
      });
      if (rpcError.message.includes("only log today") || rpcError.message.includes("only change today")) {
        // the day rolled over while the page was open: refresh dates silently
        load();
      } else {
        setError(rpcError.message);
      }
    } else if (data) {
      const updated = data as Profile;
      if (!isDone && profile) {
        const before = rankForXp(profile.xp);
        const after = rankForXp(updated.xp);
        if (after.label !== before.label) {
          setRankUp(after);
          setTimeout(() => setRankUp(null), 2800);
        }
      }
      setProfile(updated);
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
    <div className="slide-in">
      {rankUp && (
        <div className="rankup-backdrop" onClick={() => setRankUp(null)}>
          <div className="relative flex items-center justify-center">
            <div className="rankup-ring" />
            <div className="rankup-ring late" />
            <div className="rankup-badge">
              <RankBadge tierIndex={rankUp.tierIndex} stageIndex={rankUp.stageIndex} size={120} />
            </div>
          </div>
          <div className="rankup-title text-center mt-6">
            <div className="hud-label" style={{ color: "var(--accent)" }}>Rank up</div>
            <div className="display text-3xl mt-1" style={{ color: rankUp.color }}>
              {rankUp.label.toUpperCase()}
            </div>
          </div>
        </div>
      )}
      {/* hero: hunter card */}
      <div className="bezel">
        <div className="bezel-core p-4">
          <div className="flex items-center gap-3">
            <Avatar size={64} character={profile.archetype} />
            <div className="flex-1 min-w-0">
              <div className="display text-[17px] leading-tight truncate">{profile.username}</div>
              <div className="mt-1.5">
                <span className="class-pill" style={{ color: character ? character.accent : "var(--accent)" }}>
                  {character ? character.name.replace("The ", "") : "Pick one"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-center flex-none">
              <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={50} />
              <span className="hud-label mt-1 whitespace-nowrap" style={{ color: rank.color }}>
                {rank.label}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <XpMeter rank={rank} xp={profile.xp} />

            <div className="flex items-center gap-3 mt-4">
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 flex-none"
                style={{ background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.4)" }}
              >
                <span className="flame-flicker inline-flex" style={{ color: "var(--accent)" }}>
                  <Icon name="flame" size={14} strokeWidth={2.2} />
                </span>
                <span className="display text-[15px]" style={{ color: "var(--accent)" }}>
                  {profile.streak_current}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="hud-label">Streak</span>
                  <span className="hud-label">next {milestone}</span>
                </div>
                <div className="bar-seg !h-[11px]">
                  <i style={{ width: `${streakPct * 100}%`, background: "linear-gradient(90deg, var(--bronze), var(--accent))" }} />
                  <b />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* first run: choose your character */}
      {!profile.archetype && (
        <div className="hud-frame p-4 mt-5 rise">
          <div className="display text-[15px] mb-3.5" style={{ color: "var(--accent)" }}>Choose your character</div>
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
      <div className="flex items-center justify-between mt-7 mb-3.5">
        <h2 className="display text-[19px]">Today&apos;s quests</h2>
        <div className="flex items-center gap-3">
          <span className="display text-[15px] text-muted">
            {clearedCount}/{quests.length}
          </span>
          <Link href="/app/quests" aria-label="Manage quests" className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform">
            <Icon name="sliders" size={17} />
          </Link>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      <div className="flex flex-col gap-3 stagger">
        {quests.map((q) => {
          const done = doneToday.has(q.id);
          return (
            <button
              key={q.id}
              onClick={() => toggle(q)}
              disabled={pendingId === q.id}
              className="relative overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-[0.985]"
              style={{
                border: done ? "1px solid rgba(255,107,0,0.75)" : "1px solid var(--line)",
                boxShadow: done ? "0 0 22px rgba(255,107,0,0.16)" : "none",
                minHeight: 96,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={questArt(q.pillar)}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: done ? "saturate(0.6) brightness(0.75)" : "none" }}
              />
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(10,9,8,0.94) 0%, rgba(10,9,8,0.78) 42%, rgba(10,9,8,0.35) 75%, rgba(10,9,8,0.2) 100%)",
                }}
              />
              {done && (
                <span aria-hidden className="absolute inset-0" style={{ background: "rgba(255,107,0,0.10)" }} />
              )}
              <span className="relative flex items-center gap-3.5 px-4 py-4 min-h-[96px]">
                <span
                  className="icon-tile !bg-[rgba(0,0,0,0.35)]"
                  style={{ backdropFilter: "blur(4px)", color: done ? "var(--accent)" : "var(--ink)", borderColor: done ? "rgba(255,107,0,0.5)" : "var(--line-strong)" }}
                >
                  <Icon name={q.icon} size={21} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-[16px] font-semibold truncate ${done ? "line-through" : ""}`}
                    style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)", color: done ? "var(--muted)" : "var(--ink)" }}
                  >
                    {q.title}
                  </span>
                  <span className="hud-label mt-1.5 !text-[10px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                    {q.pillar} · +{q.xp} XP
                  </span>
                </span>
                <span
                  key={done ? "done" : "todo"}
                  className={`w-8 h-8 rounded-[10px] border flex items-center justify-center flex-none transition-colors duration-150 ${done ? "check-pop" : ""}`}
                  style={
                    done
                      ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgba(255,107,0,0.6)" }
                      : { borderColor: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.3)", color: "transparent", backdropFilter: "blur(4px)" }
                  }
                  aria-hidden
                >
                  <Icon name="check" size={15} strokeWidth={2.6} />
                </span>
                {xpFloat?.id === q.id && (
                  <span className="xp-float absolute right-4 top-1 font-mono font-bold text-sm">
                    +{xpFloat.amount} XP
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {quests.length === 0 && (
          <div className="card p-6 text-center text-muted text-sm">
            No active quests. Open the quest manager to build your loadout.
          </div>
        )}
      </div>

      {/* yesterday: one day of grace to log what you forgot */}
      {quests.length > 0 && (
        <div className="mt-5">
          <button
            className="card w-full px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
            onClick={() => setShowYesterday(!showYesterday)}
          >
            <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
              <Icon name="calendar" size={16} />
            </span>
            <span className="flex-1 text-left">
              <span className="display block text-[14px]">Yesterday</span>
              <span className="hud-label mt-0.5">
                {quests.filter((q) => !doneYesterday.has(q.id)).length === 0
                  ? "All cleared"
                  : `${quests.filter((q) => !doneYesterday.has(q.id)).length} open`}
              </span>
            </span>
            <span
              className="text-muted transition-transform duration-300"
              style={{ transform: showYesterday ? "rotate(180deg)" : "none" }}
            >
              <Icon name="chevron-down" size={17} />
            </span>
          </button>

          {showYesterday && (
            <div className="flex flex-col gap-2.5 mt-2.5 stagger">
              {quests.map((q) => {
                const done = doneYesterday.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => toggle(q, "yesterday")}
                    disabled={pendingId === q.id}
                    className="relative overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-[0.985]"
                    style={{
                      border: done ? "1px solid rgba(255,107,0,0.75)" : "1px solid var(--line)",
                      boxShadow: done ? "0 0 18px rgba(255,107,0,0.14)" : "none",
                      minHeight: 76,
                      opacity: done ? 1 : 0.85,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={questArt(q.pillar)}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: done ? "saturate(0.6) brightness(0.7)" : "saturate(0.85) brightness(0.85)" }}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(10,9,8,0.94) 0%, rgba(10,9,8,0.8) 42%, rgba(10,9,8,0.4) 75%, rgba(10,9,8,0.25) 100%)",
                      }}
                    />
                    {done && (
                      <span aria-hidden className="absolute inset-0" style={{ background: "rgba(255,107,0,0.10)" }} />
                    )}
                    <span className="relative flex items-center gap-3.5 px-4 py-3 min-h-[76px]">
                      <span
                        className="icon-tile !w-10 !h-10 !bg-[rgba(0,0,0,0.35)]"
                        style={{ backdropFilter: "blur(4px)", color: done ? "var(--accent)" : "var(--ink)", borderColor: done ? "rgba(255,107,0,0.5)" : "var(--line-strong)" }}
                      >
                        <Icon name={q.icon} size={18} />
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span
                          className={`block text-[15px] font-semibold truncate ${done ? "line-through" : ""}`}
                          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)", color: done ? "var(--muted)" : "var(--ink)" }}
                        >
                          {q.title}
                        </span>
                        <span className="hud-label mt-1 !text-[10px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                          Yesterday · +{q.xp} XP
                        </span>
                      </span>
                      <span
                        key={done ? "done" : "todo"}
                        className={`w-7 h-7 rounded-[9px] border flex items-center justify-center flex-none ${done ? "check-pop" : ""}`}
                        style={
                          done
                            ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 14px rgba(255,107,0,0.55)" }
                            : { borderColor: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.3)", color: "transparent", backdropFilter: "blur(4px)" }
                        }
                        aria-hidden
                      >
                        <Icon name="check" size={13} strokeWidth={2.5} />
                      </span>
                      {xpFloat?.id === q.id && (
                        <span className="xp-float absolute right-4 -top-1 font-mono font-bold text-sm">
                          +{xpFloat.amount} XP
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {clearedAll && (
        <div className="hud-frame p-5 mt-6 text-center rise">
          <div className="flex justify-center bounce-in" style={{ color: "var(--accent)" }}>
            <Icon name="trophy" size={26} strokeWidth={1.8} />
          </div>
          <p className="display mt-2 text-[17px]">All quests cleared</p>
          <p className="hud-label mt-1.5">The streak holds · see you tomorrow</p>
        </div>
      )}
    </div>
  );
}
