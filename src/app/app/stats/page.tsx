"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Radar from "@/components/Radar";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";
import {
  PILLARS,
  PILLAR_ICONS,
  Pillar,
  Profile,
  Quest,
  STAT_INFO,
  STAT_KEYS,
  characterOf,
} from "@/lib/game";

export default function StatsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pillarCounts, setPillarCounts] = useState<Record<string, number>>({});
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [openStat, setOpenStat] = useState<string | null>(null);

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

  const character = characterOf(profile.archetype);
  const maxPillar = Math.max(1, ...Object.values(pillarCounts));
  const values = STAT_KEYS.map((k) => profile.stats[k] ?? 0);
  const radarMax = Math.max(20, ...values) * 1.15;

  return (
    <div className="slide-in">
      <span className="eyebrow hud-label !text-ink">System · Character sheet</span>
      <div className="flex items-center gap-3.5 mt-4">
        <Avatar size={56} character={profile.archetype} />
        <div>
          <h1 className="display text-xl">{profile.username.toUpperCase()}</h1>
          {character && (
            <div className="hud-label mt-0.5" style={{ color: character.accent }}>
              {character.name}
            </div>
          )}
        </div>
      </div>

      <div className="bezel mt-5">
        <div className="bezel-core py-2">
          <div className="flex justify-center">
            <Radar
              labels={[...STAT_KEYS]}
              size={264}
              max={radarMax}
              series={[
                {
                  values,
                  stroke: "var(--accent)",
                  fill: "rgba(255, 107, 0, 0.28)",
                  dots: true,
                },
              ]}
            />
          </div>
          <p className="hud-label text-center pb-3">
            Every cleared quest trains its linked stats · +2 each
          </p>
        </div>
      </div>

      <p className="hud-label mt-4 mb-2">Tap a stat to see what it means</p>
      <div className="flex flex-col gap-2 stagger">
        {STAT_KEYS.map((k) => {
          const value = profile.stats[k] ?? 0;
          const open = openStat === k;
          return (
            <button
              key={k}
              className={`option-row px-4 py-2.5 text-left ${open ? "selected" : ""}`}
              onClick={() => setOpenStat(open ? null : k)}
            >
              <span className="flex items-center gap-3">
                <span className="hud-label w-9" style={{ color: "var(--accent)" }}>{k}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm">{STAT_INFO[k].name}</span>
                  <span className="block text-xs text-muted truncate">{STAT_INFO[k].blurb}</span>
                </span>
                <span className="font-mono font-semibold text-[15px]">{value}</span>
                <span
                  className="text-muted transition-transform duration-300 flex-none"
                  style={{ transform: open ? "rotate(180deg)" : "none" }}
                >
                  <Icon name="chevron-down" size={14} />
                </span>
              </span>
              {open && (
                <span className="block text-[13px] text-muted leading-relaxed mt-2.5 pl-12 pr-1 rise">
                  {STAT_INFO[k].lore}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-5">
        <div className="card p-4 text-center">
          <div className="font-mono font-bold text-2xl" style={{ color: "var(--accent)" }}>{totalCompletions}</div>
          <div className="hud-label mt-1">Quests cleared</div>
        </div>
        <div className="card p-4 text-center">
          <div className="font-mono font-bold text-2xl" style={{ color: "var(--bronze)" }}>{profile.streak_best}</div>
          <div className="hud-label mt-1">Best streak</div>
        </div>
      </div>

      <div className="card p-4 mt-4">
        <div className="hud-label mb-1.5">Pillar activity</div>
        <p className="text-xs text-muted mb-3.5">
          How many quests you have cleared in each life pillar, all time. The bars compare the
          pillars to each other.
        </p>
        <div className="flex flex-col gap-3">
          {PILLARS.map((p: Pillar) => {
            const count = pillarCounts[p] ?? 0;
            return (
              <div key={p} className="flex items-center gap-3">
                <span className="w-6 flex justify-center text-muted">
                  <Icon name={PILLAR_ICONS[p]} size={16} />
                </span>
                <span className="hud-label w-24">{p}</span>
                <div className="track flex-1">
                  <div
                    style={{
                      width: `${(count / maxPillar) * 100}%`,
                      background: "linear-gradient(90deg, var(--bronze), var(--accent))",
                    }}
                  />
                </div>
                <span className="hud-label font-mono w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
