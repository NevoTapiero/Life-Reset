"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { Profile, Quest, Rank, rankForXp } from "./game";

// One day of quests: what is active, what is done today and yesterday, and
// the optimistic toggle that logs a quest through the server. Shared by Home
// (the house) and Missions (the list) so both stay in step.

type UserQuestRow = { quest_id: string; added_on: string; quests: Quest };

export type ToggleFx = {
  onLogged?: (q: Quest) => void; // optimistic, before the server answers
  onUnlogged?: (q: Quest) => void;
  onPaid?: (q: Quest, updated: Profile) => void; // the server confirmed and paid
};

export function useQuestDay(onLoaded?: (uid: string) => void) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [doneToday, setDoneToday] = useState<Set<string>>(new Set());
  const [doneYesterday, setDoneYesterday] = useState<Set<string>>(new Set());
  const [yesterdayQuests, setYesterdayQuests] = useState<Quest[]>([]);
  const [days, setDays] = useState<{ today: string; yesterday: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rankUp, setRankUp] = useState<Rank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const [{ data: prof }, { data: uq }, { data: todayData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).single(),
      supabase.from("user_quests").select("quest_id, added_on, quests(*)").eq("user_id", uid).eq("active", true),
      supabase.rpc("app_today"),
    ]);
    onLoadedRef.current?.(uid);
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
    const activeRows = ((uq as unknown as UserQuestRow[]) ?? []).filter((r) => r.quests);
    const list = activeRows.map((r) => r.quests).sort((a, b) => a.sort - b.sort);
    setQuests(list);
    const rows = (comps ?? []) as { quest_id: string; completed_on: string }[];
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

  async function toggle(q: Quest, day: "today" | "yesterday" = "today", fx?: ToggleFx) {
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
    if (!isDone) fx?.onLogged?.(q);
    else fx?.onUnlogged?.(q);
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
      if (!isDone) fx?.onPaid?.(q, updated);
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
  }


  return { profile, setProfile, quests, doneToday, doneYesterday, yesterdayQuests, days, pendingId, rankUp, setRankUp, error, setError, load, toggle };
}
