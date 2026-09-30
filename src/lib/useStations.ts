"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cardStepOn, cardXp, doneInPeriod, periodOf, trackedBy, type Quest } from "@/lib/game";
import type { Station } from "@/lib/legoWorld";

// Your active missions as room stations: today's pay (with the 7-day card
// multiplier) and whether it's done today. complete() does one, the same as
// checking it on Missions.
// Weekly and monthly missions count once per week / month; missions a
// connected watch pays for (steps, sleep, workouts) are not stations at all.
// ponytail: today only; yesterday and un-checking stay on the Missions page
export function useStations() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [{ data: uq }, { data: day }, { data: prov }] = await Promise.all([
        supabase.from("user_quests").select("quests(*)").eq("user_id", uid).eq("active", true),
        supabase.rpc("app_today"),
        supabase.rpc("my_trackers"),
      ]);
      const providers = (prov as string[] | null) ?? [];
      const todayStr = String(day);
      const since = new Date(new Date(todayStr + "T00:00:00Z").getTime() - 90 * 86400000).toISOString().slice(0, 10);
      const { data: comps } = await supabase
        .from("quest_completions")
        .select("quest_id, completed_on")
        .eq("user_id", uid)
        .gte("completed_on", since);
      const history = new Map<string, Set<string>>();
      for (const c of (comps ?? []) as { quest_id: string; completed_on: string }[]) {
        if (!history.has(c.quest_id)) history.set(c.quest_id, new Set());
        history.get(c.quest_id)!.add(c.completed_on);
      }
      const quests = ((uq ?? []) as unknown as { quests: Quest | null }[])
        .map((r) => r.quests)
        .filter((q): q is Quest => !!q && !trackedBy(q, providers))
        .sort((a, b) => a.sort - b.sort);
      setToday(todayStr);
      setStations(
        quests.map((q) => {
          const done = history.get(q.id) ?? new Set<string>();
          const period = periodOf(q);
          return {
            id: q.id,
            title: q.title,
            pillar: q.pillar,
            xp: cardXp(q.xp, cardStepOn(done, period, todayStr)),
            done: doneInPeriod(done, period, todayStr),
          };
        }),
      );
    })();
  }, []);

  // resolves with the XP paid, or null if it didn't go through
  async function complete(id: string): Promise<number | null> {
    const st = stations?.find((s) => s.id === id);
    if (!st || !today) return null;
    const { error } = await supabase.rpc("complete_quest_for", { p_quest_id: id, p_on: today });
    if (error) return null;
    setStations((all) => all?.map((s) => (s.id === id ? { ...s, done: true } : s)) ?? null);
    return st.xp;
  }

  return { stations, complete };
}
