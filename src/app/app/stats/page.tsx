"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import Link from "next/link";
import BrickLoader from "@/components/BrickLoader";
import LegoIcon, { PILLAR_BRICK_COLOR, type BrickColor } from "@/components/LegoIcon";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PILLAR_BRICK, photoOf } from "@/lib/brick";
import {
  PILLARS,
  PILLAR_STAT,
  PILLAR_ICONS,
  Pillar,
  Profile,
  Quest,
  STAT_INFO,
  STAT_KEYS,
  characterOf,
} from "@/lib/game";

// each stat's brick colour and printed icon, like the friend page
const STAT_BRICK: Record<string, { color: BrickColor; css: string }> = {
  CON: { color: "green", css: "var(--lego-green)" },
  FOC: { color: "azure", css: "var(--lego-azure)" },
  DIS: { color: "blue", css: "var(--lego-blue)" },
  STR: { color: "red", css: "var(--lego-red)" },
  WIS: { color: "orange", css: "var(--lego-orange)" },
};

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
  // studs are scaled to the strongest stat: the sheet shows where you focus,
  // not how big the numbers are
  const statMax = Math.max(1, ...values);

  return (
    <div className="slide-in">
      <div className="flex items-center gap-3">
        <Link href="/app/profile" className="icon-tile !w-10 !h-10 !bg-white" aria-label="Back to Profile">
          <Icon name="chevron-left" size={20} strokeWidth={2.4} />
        </Link>
        <h1 className="display tt-text text-[28px]">Your record</h1>
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

      {/* the character sheet, like a LEGO game's: a printed brick per stat and
          a row of ten studs that fill in its colour */}
      <section className="card mt-5 divide-y-2 divide-[var(--line)] overflow-hidden">
        {STAT_KEYS.map((k) => {
          const value = profile.stats[k] ?? 0;
          const open = openStat === k;
          const brick = STAT_BRICK[k] ?? STAT_BRICK.DIS;
          const on = value === 0 ? 0 : Math.max(1, Math.round((value / statMax) * 10));
          return (
            <button key={k} className="w-full px-4 py-3 text-left block" onClick={() => setOpenStat(open ? null : k)} aria-expanded={open}>
              <span className="flex items-center gap-3">
                <LegoIcon name={`stat-${k.toLowerCase()}`} color={brick.color} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-extrabold">
                      {STAT_INFO[k].name} <span className="text-muted text-[12px]">{k}</span>
                    </span>
                    <span className="display text-[18px]">{value}</span>
                  </span>
                  <span className="stat-studs mt-1.5" style={{ "--c": brick.css } as React.CSSProperties} aria-hidden>
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className={i < on ? "on" : ""} style={{ animationDelay: `${i * 35}ms` }} />
                    ))}
                  </span>
                </span>
                <span className="text-muted transition-transform duration-300 flex-none" style={{ transform: open ? "rotate(180deg)" : "none" }}>
                  <Icon name="chevron-down" size={14} />
                </span>
              </span>
              {open && <span className="block text-[13px] text-muted leading-relaxed mt-2.5 pl-12 pr-1 rise">{STAT_INFO[k].lore}</span>}
            </button>
          );
        })}
      </section>

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
        {/* a brick tower per pillar, as tall as how often you trained it */}
        <div className="grid grid-cols-5 gap-2 items-end" style={{ height: 190 }}>
          {PILLARS.map((p: Pillar) => {
            const count = pillarCounts[p] ?? 0;
            const bricks = count === 0 ? 0 : Math.max(1, Math.round((count / maxPillar) * 8));
            return (
              <div key={p} className="flex flex-col items-center justify-end h-full">
                <span className="display text-[15px] mb-1">{count}</span>
                <div className="brick-tower" style={{ "--c": PILLAR_BRICK[p] } as React.CSSProperties}>
                  {Array.from({ length: bricks }, (_, i) => (
                    <span key={i} className="tower-brick rise" style={{ animationDelay: `${(bricks - i) * 40}ms` }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {PILLARS.map((p: Pillar) => (
            <div key={p} className="flex flex-col items-center gap-1">
              <LegoIcon name={PILLAR_ICONS[p]} color={PILLAR_BRICK_COLOR[p]} size={30} />
              <span className="text-[11px] font-extrabold text-muted">{PILLAR_STAT[p]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
