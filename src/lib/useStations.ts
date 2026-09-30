"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cardStepOn, cardXp, doneInPeriod, periodOf, trackedBy, type Profile, type Quest } from "@/lib/game";
import type { Station } from "@/lib/legoWorld";

// Everything your room needs: your active missions as stations (today's pay
// with the 7-day card multiplier, done or not), the chest (what your watch
// earned that's waiting to be collected) and your gold.
// Weekly and monthly missions count once per week / month; missions a
// connected watch pays for (steps, sleep, workouts) are not stations at all.
// ponytail: today only; yesterday and un-checking stay on the Missions page
export function useStations() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [today, setToday] = useState<string | null>(null);
  // null until the chest migration (2026-09-30-xp-chest.sql) is applied
  const [chest, setChest] = useState<number | null>(null);
  const [gold, setGold] = useState<number | null>(null);
  // the shop: prices by item id (null until the shop migration), and what you own
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  const [owned, setOwned] = useState<string[]>([]);

  useEffect(() => {
    const loadChest = async (uid: string) => {
      const [{ data: waiting, error }, { data: prof }] = await Promise.all([
        supabase.from("xp_ledger").select("pending_xp").eq("user_id", uid).gt("pending_xp", 0),
        supabase.from("profiles").select("gold").eq("id", uid).single(),
      ]);
      if (error) return;
      setChest(((waiting ?? []) as { pending_xp: number }[]).reduce((s, r) => s + r.pending_xp, 0));
      setGold((prof as { gold?: number } | null)?.gold ?? null);
    };

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

      const [{ data: items, error: shopError }, { data: mine }] = await Promise.all([
        supabase.from("shop_items").select("id, price"),
        supabase.from("owned_items").select("item_id").eq("user_id", uid),
      ]);
      if (!shopError) {
        setPrices(Object.fromEntries(((items ?? []) as { id: string; price: number }[]).map((i) => [i.id, i.price])));
        setOwned(((mine ?? []) as { item_id: string }[]).map((o) => o.item_id));
      }

      // what's already waiting, then ask the watch for anything new (safe to repeat)
      await loadChest(uid);
      const { data: session } = await supabase.auth.getSession();
      await fetch("/api/integrations/sync-all", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.session?.access_token ?? ""}` },
      }).catch(() => null);
      await loadChest(uid);
    })();
  }, []);

  // do a mission; resolves with the XP it paid, or null if it didn't go through
  async function complete(id: string): Promise<number | null> {
    const st = stations?.find((s) => s.id === id);
    if (!st || !today) return null;
    const { error } = await supabase.rpc("complete_quest_for", { p_quest_id: id, p_on: today });
    if (error) return null;
    setStations((all) => all?.map((s) => (s.id === id ? { ...s, done: true } : s)) ?? null);
    setGold((g) => (g === null ? g : g + st.xp)); // missions pay gold too
    return st.xp;
  }

  // open the chest: everything waiting becomes XP, and the same in gold
  async function collect(): Promise<{ xp: number; profile: Profile } | null> {
    const { data, error } = await supabase.rpc("collect");
    if (error || !data) return null;
    const r = data as { xp: number; gold: number; profile: Profile };
    setChest(0);
    setGold(r.profile.gold ?? null);
    return { xp: r.xp, profile: r.profile };
  }

  // buy a piece of furniture; resolves with an error message, or null when it's yours
  async function buy(id: string): Promise<string | null> {
    const { data, error } = await supabase.rpc("buy_item", { p_item: id });
    if (error) return error.message;
    setGold(data as number);
    setOwned((o) => [...o, id]);
    return null;
  }

  return { stations, complete, chest, gold, collect, prices, owned, buy };
}
