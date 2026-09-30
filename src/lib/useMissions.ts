"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brickSound } from "@/lib/brickSound";
import {
  PERIODS,
  Period,
  Profile,
  Quest,
  Rank,
  TRACKER_NAME,
  cardStepOn,
  cardXp,
  doneInPeriod,
  periodOf,
  periodStart,
  rankForXp,
  trackedBy,
} from "@/lib/game";

type UserQuestRow = { quest_id: string; added_on: string; quests: Quest };

// Everything the Home screen needs about your missions: the active quests,
// what's done (today, this week, this month), yesterday's grace list, and the
// check/uncheck call. Same rules as before the brick theme; only the screen
// changed. XP is always the server's answer (complete_quest_for).
export function useMissions() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  // quest id -> every day it was done (about 7 months back, enough for a monthly card)
  const [history, setHistory] = useState<Map<string, Set<string>>>(new Map());
  // connected apps that pay for some quests on their own (steps, sleep, workouts)
  const [trackers, setTrackers] = useState<string[]>([]);
  const [yesterdayQuests, setYesterdayQuests] = useState<Quest[]>([]);
  const [days, setDays] = useState<{ today: string; yesterday: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [xpFloat, setXpFloat] = useState<{ id: string; amount: number } | null>(null);
  const [rankUp, setRankUp] = useState<{ rank: Rank; previousTier: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // the first load failed (offline, server down): Home shows a retry
  const [loadFailed, setLoadFailed] = useState(false);

  const loadOnce = async () => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const uid = userData.user?.id;
    if (!uid) return;
    setEmail(userData.user?.email ?? null);
    const [{ data: prof, error: profErr }, { data: uq }, { data: todayData }, { data: tr }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("user_quests").select("quest_id, added_on, quests(*)").eq("user_id", uid).eq("active", true),
      supabase.rpc("app_today"),
      supabase.rpc("my_trackers"),
    ]);
    if (profErr || !prof || !todayData) throw profErr ?? new Error("no profile");
    setTrackers((tr as string[]) ?? []);
    const todayStr = String(todayData);
    const yesterdayStr = new Date(new Date(todayStr + "T00:00:00Z").getTime() - 86400000).toISOString().slice(0, 10);
    const since = new Date(new Date(todayStr + "T00:00:00Z").getTime() - 230 * 86400000).toISOString().slice(0, 10);
    const { data: comps } = await supabase
      .from("quest_completions")
      .select("quest_id, completed_on")
      .eq("user_id", uid)
      .gte("completed_on", since);
    setProfile(prof as Profile);
    const activeRows = ((uq as unknown as UserQuestRow[]) ?? []).filter((r) => r.quests);
    setQuests(activeRows.map((r) => r.quests).sort((a, b) => a.sort - b.sort));
    const rows = (comps ?? []) as { quest_id: string; completed_on: string }[];
    const hist = new Map<string, Set<string>>();
    for (const c of rows) {
      if (!hist.has(c.quest_id)) hist.set(c.quest_id, new Set());
      hist.get(c.quest_id)!.add(c.completed_on);
    }
    setHistory(hist);
    setDays({ today: todayStr, yesterday: yesterdayStr });

    // Yesterday is fixed to what actually happened yesterday: quests active
    // before today plus anything completed yesterday (even if removed since).
    const yDoneIds = rows.filter((c) => c.completed_on === yesterdayStr).map((c) => c.quest_id);
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
  };

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      await loadOnce();
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then sets state
    load();
  }, [load]);

  // Done on `on`: that day for a daily quest, anywhere in its week or month otherwise.
  const isDoneOn = useCallback(
    (q: Quest, on: string): boolean => {
      const dates = history.get(q.id);
      if (!dates) return false;
      const period = periodOf(q);
      return period === "daily" ? dates.has(on) : doneInPeriod(dates, period, on);
    },
    [history],
  );

  const cardDayOf = useCallback(
    (q: Quest, on?: string) => (days ? cardStepOn(history.get(q.id) ?? new Set(), periodOf(q), on ?? days.today) : 1),
    [days, history],
  );

  async function toggle(q: Quest, day: "today" | "yesterday" = "today") {
    if (pendingId || !days) return;
    setError(null);
    const watch = trackedBy(q, trackers);
    if (watch) {
      setError(`${TRACKER_NAME[watch]} tracks this and pays for it automatically.`);
      return;
    }
    setPendingId(q.id);
    const on = day === "today" ? days.today : days.yesterday;
    const period = periodOf(q);
    const before = new Set(history.get(q.id) ?? []);
    const isDone = isDoneOn(q, on);
    // optimistic: unchecking a weekly/monthly quest clears the whole period
    const after = new Set(before);
    if (isDone) {
      for (const d of before) if (periodStart(period, d) === periodStart(period, on)) after.delete(d);
    } else after.add(on);
    setHistory((prev) => new Map(prev).set(q.id, after));
    if (isDone) brickSound.unsnap();
    else {
      brickSound.snap();
      brickSound.stud(cardStepOn(before, period, on));
    }
    if (!isDone) setXpFloat({ id: q.id, amount: cardXp(q.xp, cardStepOn(before, period, on)) });
    const { data, error: rpcError } = await supabase.rpc(isDone ? "uncomplete_quest_for" : "complete_quest_for", {
      p_quest_id: q.id,
      p_on: on,
    });
    if (rpcError) {
      setHistory((prev) => new Map(prev).set(q.id, before));
      if (rpcError.message.includes("only log today") || rpcError.message.includes("only change today")) load();
      else {
        brickSound.error();
        setError(rpcError.message);
      }
    } else if (data) {
      const updated = data as Profile;
      if (!isDone && profile) {
        const was = rankForXp(profile.xp);
        const now = rankForXp(updated.xp);
        if (now.label !== was.label) {
          setRankUp({ rank: now, previousTier: was.tierIndex });
          setTimeout(() => setRankUp(null), now.tierIndex > was.tierIndex ? 5000 : 3000);
        }
      }
      setProfile(updated);
    }
    setPendingId(null);
    setTimeout(() => setXpFloat(null), 1100);
  }

  const today = days?.today ?? "";
  const checkable = (qs: Quest[]) => qs.filter((q) => !trackedBy(q, trackers));
  const inPeriod = (p: Period) => quests.filter((q) => periodOf(q) === p);
  const counts = Object.fromEntries(
    PERIODS.map((p) => {
      const qs = checkable(inPeriod(p));
      return [p, { done: qs.filter((q) => isDoneOn(q, today)).length, total: qs.length }];
    }),
  ) as Record<Period, { done: number; total: number }>;
  // Yesterday: daily quests, plus a weekly/monthly one only at its period's edge.
  const yesterdayList = yesterdayQuests.filter((q) => {
    const period = periodOf(q);
    if (trackedBy(q, trackers)) return false;
    if (period === "daily") return true;
    return !!days && periodStart(period, days.yesterday) !== periodStart(period, days.today);
  });

  return {
    profile,
    setProfile,
    loadFailed,
    email,
    quests,
    trackers,
    days,
    today,
    pendingId,
    xpFloat,
    rankUp,
    dismissRankUp: () => setRankUp(null),
    error,
    load,
    toggle,
    isDoneOn,
    cardDayOf,
    inPeriod,
    counts,
    yesterdayList,
  };
}
