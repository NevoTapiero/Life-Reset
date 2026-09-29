"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AppActivity from "@/components/AppActivity";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import XpMeter from "@/components/XpMeter";
import {
  CHARACTERS,
  CHARACTER_KEYS,
  CharacterKey,
  CARD_DAYS,
  PILLAR_ICONS,
  Profile,
  Quest,
  Rank,
  cardDayOn,
  cardXp,
  characterOf,
  nextStreakMilestone,
  questArt,
  rankForXp,
} from "@/lib/game";

type UserQuestRow = { quest_id: string; added_on: string; quests: Quest };

// Seven pips: the quest's 7-day card. Filled = days already banked in this
// card; the ringed pip is the day this check counts as; the last one pays x3.
function CardPips({ day, done }: { day: number; done: boolean }) {
  return (
    <span className="flex items-center gap-[3px] mt-1.5" aria-label={`Day ${day} of ${CARD_DAYS}`}>
      {Array.from({ length: CARD_DAYS }, (_, i) => {
        const n = i + 1;
        const filled = n < day || (n === day && done);
        const current = n === day && !done;
        const last = n === CARD_DAYS;
        return (
          <span
            key={n}
            className="rounded-full"
            style={{
              width: last ? 9 : 6,
              height: last ? 9 : 6,
              background: filled ? "var(--accent)" : "rgba(0,0,0,0.35)",
              border: current ? "1.5px solid var(--accent)" : "1px solid rgba(255,255,255,0.35)",
              boxShadow: filled && last ? "0 0 8px rgb(var(--accent-rgb) / 0.8)" : "none",
            }}
          />
        );
      })}
    </span>
  );
}

export default function Dashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [doneYesterday, setDoneYesterday] = useState<Set<string>>(new Set());
  // quest id -> every day it was done (last 90 days), for the 7-day cards
  const [history, setHistory] = useState<Map<string, Set<string>>>(new Map());
  const [yesterdayQuests, setYesterdayQuests] = useState<Quest[]>([]);
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
      supabase.from("user_quests").select("quest_id, added_on, quests(*)").eq("user_id", uid).eq("active", true),
      supabase.rpc("app_today"),
    ]);
    const todayStr = String(todayData);
    const yesterdayStr = new Date(new Date(todayStr + "T00:00:00Z").getTime() - 86400000)
      .toISOString()
      .slice(0, 10);
    const since = new Date(new Date(todayStr + "T00:00:00Z").getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const { data: comps } = await supabase
      .from("quest_completions")
      .select("quest_id, completed_on")
      .eq("user_id", uid)
      .gte("completed_on", since);
    setProfile(prof as Profile);
    const activeRows = ((uq as unknown as UserQuestRow[]) ?? []).filter((r) => r.quests);
    const list = activeRows.map((r) => r.quests).sort((a, b) => a.sort - b.sort);
    setQuests(list);
    const rows = (comps ?? []) as { quest_id: string; completed_on: string }[];
    const hist = new Map<string, Set<string>>();
    for (const c of rows) {
      if (!hist.has(c.quest_id)) hist.set(c.quest_id, new Set());
      hist.get(c.quest_id)!.add(c.completed_on);
    }
    setHistory(hist);
    const yDoneIds = rows.filter((c) => c.completed_on === yesterdayStr).map((c) => c.quest_id);
    setDoneToday(new Set(rows.filter((c) => c.completed_on === todayStr).map((c) => c.quest_id)));
    setDoneYesterday(new Set(yDoneIds));
    setDays({ today: todayStr, yesterday: yesterdayStr });

    // Yesterday's list is fixed to what actually happened yesterday, independent
    // of today's loadout edits: quests active before today (so a quest added
    // today never appears) plus anything completed yesterday (so a quest you
    // later removed still shows, checked). Editing today's loadout never
    // rewrites yesterday.
    const byId = new Map<string, Quest>();
    for (const r of activeRows) {
      if (r.added_on && r.added_on < todayStr) byId.set(r.quests.id, r.quests);
    }
    const missing = yDoneIds.filter((id) => !byId.has(id));
    if (missing.length) {
      const { data: extra } = await supabase.from("quests").select("*").in("id", missing);
      for (const q of (extra as Quest[]) ?? []) byId.set(q.id, q);
    }
    setYesterdayQuests([...byId.values()].sort((a, b) => a.sort - b.sort));
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
    const on = day === "today" ? days.today : days.yesterday;
    if (!isDone) setXpFloat({ id: q.id, amount: cardXp(q.xp, cardDayOn(history.get(q.id) ?? new Set(), on)) });
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
      setHistory((prev) => {
        const next = new Map(prev);
        const dates = new Set(next.get(q.id) ?? []);
        if (isDone) dates.delete(on);
        else dates.add(on);
        next.set(q.id, dates);
        return next;
      });
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

            <div className="mt-4">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="hud-label">Streak · days</span>
                <span className="whitespace-nowrap leading-none">
                  <span className="display text-[16px]" style={{ color: "var(--accent)" }}>
                    {profile.streak_current}
                  </span>
                  <span className="hud-label !text-[10px]">/{milestone}</span>
                </span>
              </div>
              {milestone <= 50 ? (
                // one tick per day toward the next milestone
                <div className="flex gap-[3px] h-[11px]">
                  {Array.from({ length: milestone }).map((_, i) => {
                    const on = i < Math.min(profile.streak_current, milestone);
                    return (
                      <span
                        key={i}
                        className="flex-1 rounded-[2.5px]"
                        style={
                          on
                            ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", boxShadow: "0 0 8px rgb(var(--accent-rgb) / 0.5)" }
                            : { background: "#232327" }
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="bar-seg !h-[11px]">
                  <i style={{ width: `${streakPct * 100}%`, background: "linear-gradient(90deg, var(--bronze), var(--accent))" }} />
                  <b />
                </div>
              )}
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
          const cardDay = days ? cardDayOn(history.get(q.id) ?? new Set(), days.today) : 1;
          return (
            <button
              key={q.id}
              onClick={() => toggle(q)}
              disabled={pendingId === q.id}
              className="relative overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-[0.985]"
              style={{
                border: done ? "1px solid rgb(var(--accent-rgb) / 0.75)" : "1px solid var(--line)",
                boxShadow: done ? "0 0 22px rgb(var(--accent-rgb) / 0.16)" : "none",
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
                <span aria-hidden className="absolute inset-0" style={{ background: "rgb(var(--accent-rgb) / 0.10)" }} />
              )}
              <span className="relative flex items-center gap-3.5 px-4 py-4 min-h-[96px]">
                <span
                  className="icon-tile !bg-[rgba(0,0,0,0.35)]"
                  style={{ backdropFilter: "blur(4px)", color: done ? "var(--accent)" : "var(--ink)", borderColor: done ? "rgb(var(--accent-rgb) / 0.5)" : "var(--line-strong)" }}
                >
                  <Icon name={PILLAR_ICONS[q.pillar]} size={23} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-[16px] font-semibold truncate ${done ? "line-through" : ""}`}
                    style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)", color: done ? "var(--muted)" : "var(--ink)" }}
                  >
                    {q.title}
                  </span>
                  <span className="hud-label mt-1.5 !text-[10px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                    {q.pillar} · Day {cardDay}/{CARD_DAYS} · +{cardXp(q.xp, cardDay)} XP
                  </span>
                  <CardPips day={cardDay} done={done} />
                </span>
                <span
                  key={done ? "done" : "todo"}
                  className={`w-8 h-8 rounded-[10px] border flex items-center justify-center flex-none transition-colors duration-150 ${done ? "check-pop" : ""}`}
                  style={
                    done
                      ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgb(var(--accent-rgb) / 0.6)" }
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
      {yesterdayQuests.length > 0 && (
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
                {yesterdayQuests.filter((q) => !doneYesterday.has(q.id)).length === 0
                  ? "All cleared"
                  : `${yesterdayQuests.filter((q) => !doneYesterday.has(q.id)).length} open`}
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
              {yesterdayQuests.map((q) => {
                const done = doneYesterday.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => toggle(q, "yesterday")}
                    disabled={pendingId === q.id}
                    className="relative overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-[0.985]"
                    style={{
                      border: done ? "1px solid rgb(var(--accent-rgb) / 0.75)" : "1px solid var(--line)",
                      boxShadow: done ? "0 0 18px rgb(var(--accent-rgb) / 0.14)" : "none",
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
                      <span aria-hidden className="absolute inset-0" style={{ background: "rgb(var(--accent-rgb) / 0.10)" }} />
                    )}
                    <span className="relative flex items-center gap-3.5 px-4 py-3 min-h-[76px]">
                      <span
                        className="icon-tile !w-10 !h-10 !bg-[rgba(0,0,0,0.35)]"
                        style={{ backdropFilter: "blur(4px)", color: done ? "var(--accent)" : "var(--ink)", borderColor: done ? "rgb(var(--accent-rgb) / 0.5)" : "var(--line-strong)" }}
                      >
                        <Icon name={PILLAR_ICONS[q.pillar]} size={20} />
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span
                          className={`block text-[15px] font-semibold truncate ${done ? "line-through" : ""}`}
                          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)", color: done ? "var(--muted)" : "var(--ink)" }}
                        >
                          {q.title}
                        </span>
                        <span className="hud-label mt-1 !text-[10px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                          Yesterday · +{cardXp(q.xp, days ? cardDayOn(history.get(q.id) ?? new Set(), days.yesterday) : 1)} XP
                        </span>
                      </span>
                      <span
                        key={done ? "done" : "todo"}
                        className={`w-7 h-7 rounded-[9px] border flex items-center justify-center flex-none ${done ? "check-pop" : ""}`}
                        style={
                          done
                            ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 14px rgb(var(--accent-rgb) / 0.55)" }
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

      {/* what the connected services counted, so the tracking is visible */}
      <AppActivity onXp={load} />

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
