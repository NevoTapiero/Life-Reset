"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Radar from "@/components/Radar";
import Icon from "@/components/Icon";
import Link from "next/link";
import BrickLoader from "@/components/BrickLoader";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PILLAR_BRICK, photoOf } from "@/lib/brick";
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
    return (
      <div className="py-24 flex justify-center">
        <BrickLoader label="Reading your record" />
      </div>
    );
  }

  const character = characterOf(profile.archetype);
  const maxPillar = Math.max(1, ...Object.values(pillarCounts));
  const values = STAT_KEYS.map((k) => profile.stats[k] ?? 0);
  // normalize to the strongest stat: the shape shows where you focus,
  // not how big the numbers are
  const radarMax = Math.max(1, ...values) * 1.25;

  return (
    <div className="slide-in">
      <div className="flex items-center gap-3">
        <Link href="/app/profile" className="icon-tile !w-10 !h-10 !bg-white" aria-label="Back to Profile">
          <Icon name="chevron-left" size={20} strokeWidth={2.4} />
        </Link>
        <h1 className="display text-[26px]">Your record</h1>
      </div>
      <div className="flex items-center gap-3.5 mt-5">
        <PlayerAvatar photo={photoOf(profile)} character={profile.archetype} size={58} />
        <div>
          <div className="display text-[19px]">{profile.username}</div>
          {character && (
            <div className="mt-1.5">
              <span className="class-pill" style={{ color: character.accent }}>
                {character.name.replace("The ", "")}
              </span>
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
                  stroke: "var(--lego-blue)",
                  fill: "rgb(0 85 191 / 0.22)",
                  dots: true,
                },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-5 stagger">
        {STAT_KEYS.map((k) => {
          const value = profile.stats[k] ?? 0;
          const open = openStat === k;
          return (
            <button
              key={k}
              className={`option-row px-4 py-3 text-left ${open ? "selected" : ""}`}
              onClick={() => setOpenStat(open ? null : k)}
            >
              <span className="flex items-center gap-3">
                <span className="chip chip-blue w-12 justify-center">{k}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-extrabold">{STAT_INFO[k].name}</span>
                </span>
                <span className="display text-[17px]">{value}</span>
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
          <div className="display text-[26px]" style={{ color: "var(--lego-green)" }}>{totalCompletions}</div>
          <div className="hud-label mt-1">Missions done</div>
        </div>
        <div className="card p-4 text-center">
          <div className="display text-[26px]" style={{ color: "var(--lego-orange)" }}>{profile.streak_best}</div>
          <div className="hud-label mt-1">Best streak</div>
        </div>
      </div>

      <div className="card p-4 mt-4">
        <div className="display text-[17px] mb-3.5">What you train most</div>
        <div className="flex flex-col gap-3">
          {PILLARS.map((p: Pillar) => {
            const count = pillarCounts[p] ?? 0;
            return (
              <div key={p} className="flex items-center gap-2">
                <span className="w-7 flex-none flex justify-center" style={{ color: PILLAR_BRICK[p] }}>
                  <Icon name={PILLAR_ICONS[p]} size={19} strokeWidth={2} />
                </span>
                <span className="hud-label flex-none w-[108px]">{p}</span>
                <div className="track flex-1">
                  <div
                    style={{
                      width: `${(count / maxPillar) * 100}%`,
                      background: PILLAR_BRICK[p],
                    }}
                  />
                </div>
                <span className="display text-[13px] w-6 text-right text-muted">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
