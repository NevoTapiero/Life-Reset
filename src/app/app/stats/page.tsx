"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Radar from "@/components/Radar";
import {
  PILLARS,
  PILLAR_ICONS,
  Pillar,
  Profile,
  Quest,
  STAT_INFO,
  STAT_KEYS,
  Stats,
} from "@/lib/game";

export default function StatsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pillarCounts, setPillarCounts] = useState<Record<string, number>>({});
  const [totalCompletions, setTotalCompletions] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [{ data: prof }, { data: comps }, { data: questRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("quest_completions").select("quest_id").eq("user_id", uid),
        supabase.from("quests").select("id, pillar"),
      ]);
      setProfile(prof as Profile);
      const pillarOf: Record<string, string> = {};
      for (const q of (questRows as Pick<Quest, "id" | "pillar">[]) ?? []) pillarOf[q.id] = q.pillar;
      const counts: Record<string, number> = {};
      for (const c of (comps as { quest_id: string }[]) ?? []) {
        const p = pillarOf[c.quest_id] ?? "Other";
        counts[p] = (counts[p] ?? 0) + 1;
      }
      setPillarCounts(counts);
      setTotalCompletions((comps ?? []).length);
    })();
  }, []);

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Reading your record…</div>;
  }

  const baselineRaw = (profile.onboarding as { baseline_stats?: Stats })?.baseline_stats;
  const baseline: Stats =
    baselineRaw ?? ({ CON: 50, FOC: 50, DIS: 50, STR: 50, WIS: 50 } as Stats);
  const maxPillar = Math.max(1, ...Object.values(pillarCounts));

  return (
    <div className="rise">
      <div className="hud-label">Character sheet</div>
      <h1 className="text-2xl font-bold mt-1">
        {profile.username} · <span className="text-accent">{profile.archetype ?? "Challenger"}</span>
      </h1>

      <div className="flex justify-center mt-2">
        <Radar
          labels={[...STAT_KEYS]}
          series={[
            {
              values: STAT_KEYS.map((k) => profile.stats[k] ?? 50),
              stroke: "var(--accent)",
              fill: "color-mix(in srgb, var(--accent) 14%, transparent)",
            },
            { values: STAT_KEYS.map((k) => baseline[k] ?? 50), stroke: "var(--muted)", dashed: true },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        {STAT_KEYS.map((k) => {
          const now = profile.stats[k] ?? 50;
          const base = baseline[k] ?? 50;
          const delta = now - base;
          return (
            <div key={k} className="card px-4 py-2.5 flex items-center gap-3">
              <span className="hud-label w-9">{k}</span>
              <span className="flex-1">
                <span className="block text-sm">{STAT_INFO[k].name}</span>
                <span className="block text-xs text-muted">{STAT_INFO[k].blurb}</span>
              </span>
              <span className="font-mono font-semibold">{now}</span>
              {delta !== 0 && (
                <span className={`hud-label ${delta > 0 ? "!text-success" : "!text-danger"}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{totalCompletions}</div>
          <div className="hud-label mt-1">Quests cleared</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gold">{profile.streak_best}</div>
          <div className="hud-label mt-1">Best streak</div>
        </div>
      </div>

      <div className="card p-4 mt-5">
        <div className="hud-label mb-3">Pillar activity</div>
        <div className="flex flex-col gap-2.5">
          {PILLARS.map((p: Pillar) => {
            const count = pillarCounts[p] ?? 0;
            return (
              <div key={p} className="flex items-center gap-3">
                <span className="w-6 text-center" aria-hidden>{PILLAR_ICONS[p]}</span>
                <span className="hud-label w-24">{p}</span>
                <div className="flex-1 h-2 rounded-full bg-panel2 overflow-hidden">
                  <div
                    className="h-full bg-accent2 rounded-full"
                    style={{ width: `${(count / maxPillar) * 100}%` }}
                  />
                </div>
                <span className="hud-label w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
