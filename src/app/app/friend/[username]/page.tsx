"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import Radar from "@/components/Radar";
import RankBadge from "@/components/RankBadge";
import { CharacterKey, PILLAR_ICONS, STAT_ICONS, STAT_KEYS, Stats, characterOf, formatDate, rankForXp } from "@/lib/game";
import { characterVars } from "@/lib/theme";

type FriendQuest = {
  id: string;
  title: string;
  pillar: string;
  xp: number;
  icon: string;
  done_today: boolean;
};

type FriendFile = {
  username: string;
  archetype: CharacterKey | null;
  xp: number;
  streak_current: number;
  streak_best: number;
  stats: Stats;
  member_since: string;
  weekly_xp: number;
  quests: FriendQuest[];
};

export default function FriendProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const [file, setFile] = useState<FriendFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const username = decodeURIComponent(params.username ?? "");
    if (!username) return;
    supabase.rpc("get_friend_profile", { p_username: username }).then(({ data, error }) => {
      if (error) setError(error.message);
      else setFile(data as FriendFile);
    });
  }, [params.username]);

  if (error) {
    return (
      <div className="slide-in text-center py-16">
        <p className="text-danger text-sm">{error}</p>
        <button className="btn-ghost px-6 py-2.5 mt-5" onClick={() => router.back()}>
          Back
        </button>
      </div>
    );
  }
  if (!file) {
    return <div className="hud-label pulse-glow text-center py-20">Opening their file…</div>;
  }

  const rank = rankForXp(file.xp);
  const character = characterOf(file.archetype);
  const cleared = file.quests.filter((q) => q.done_today).length;
  const values = STAT_KEYS.map((k) => file.stats[k] ?? 0);
  const radarMax = Math.max(1, ...values) * 1.25;

  return (
    <div className="slide-in" style={characterVars(file.archetype)}>
      <button
        className="flex items-center gap-3 py-1.5 active:scale-95 transition-transform"
        onClick={() => router.back()}
      >
        <span className="icon-tile !w-11 !h-11 !rounded-[13px]">
          <Icon name="arrow-right" size={24} strokeWidth={2.2} className="rotate-180" />
        </span>
        <span className="display text-[17px]">Back</span>
      </button>

      <div
        className="scene p-5 pt-6 mt-4 text-center"
        style={{ "--scene-glow": `${character?.accent ?? "#ff6b00"}44` } as React.CSSProperties}
      >
        <div className="relative">
          <div className="flex justify-center">
            <Avatar size={100} character={file.archetype} tierIndex={rank.tierIndex} />
          </div>
          <div className="display text-[23px] mt-3">{file.username}</div>
          <div className="flex items-center justify-center gap-2.5 mt-2.5">
            {character && (
              <span className="class-pill" style={{ color: character.accent }}>
                {character.name.replace("The ", "")}
              </span>
            )}
            <span className="class-pill" style={{ color: rank.color }}>{rank.label}</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3.5">
            <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={42} />
            <span className="hud-label">Since {formatDate(new Date(file.member_since))}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-4">
        <div className="card p-3.5 text-center">
          <div className="display text-[19px]" style={{ color: "var(--accent)" }}>
            {file.weekly_xp.toLocaleString()}
          </div>
          <div className="hud-label mt-1">Last 7 days</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="display text-[19px]">{file.xp.toLocaleString()}</div>
          <div className="hud-label mt-1">All time XP</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="display text-[19px]" style={{ color: "var(--accent)" }}>
            {file.streak_current}
          </div>
          <div className="hud-label mt-1">Streak</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="display text-[19px]" style={{ color: "var(--bronze)" }}>
            {file.streak_best}
          </div>
          <div className="hud-label mt-1">Best</div>
        </div>
      </div>

      {/* the five stats, like on your own profile */}
      <div className="card p-4 mt-3 grid grid-cols-5">
        {STAT_KEYS.map((k) => (
          <div key={k} className="text-center">
            <div className="flex justify-center text-muted mb-1.5">
              <Icon name={STAT_ICONS[k]} size={18} />
            </div>
            <div className="display text-[19px]" style={{ color: character?.accent ?? "var(--accent)" }}>
              {file.stats[k] ?? 0}
            </div>
            <div className="hud-label mt-1">{k}</div>
          </div>
        ))}
      </div>

      <div className="bezel mt-4">
        <div className="bezel-core py-2 flex justify-center">
          <Radar
            labels={[...STAT_KEYS]}
            size={230}
            max={radarMax}
            series={[{ values, stroke: "var(--accent)", fill: "rgb(var(--accent-rgb) / 0.28)", dots: true }]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-7 mb-3">
        <h2 className="display text-[17px]">Their quests</h2>
        <span className="display text-[14px] text-muted">
          {cleared}/{file.quests.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 stagger pb-4">
        {file.quests.map((q) => (
          <div
            key={q.id}
            className={`option-row px-4 py-3.5 flex items-center gap-3.5 ${q.done_today ? "selected" : ""}`}
          >
            <span className="icon-tile" style={q.done_today ? { color: "var(--accent)", borderColor: "rgb(var(--accent-rgb) / 0.4)" } : undefined}>
              <Icon name={PILLAR_ICONS[q.pillar as keyof typeof PILLAR_ICONS]} size={23} />
            </span>
            <span className="flex-1 min-w-0">
              <span className={`block text-[15px] truncate ${q.done_today ? "text-muted line-through" : ""}`}>
                {q.title}
              </span>
              <span className="hud-label mt-1">{q.pillar} · +{q.xp} XP</span>
            </span>
            {q.done_today && (
              <span className="hud-label flex-none" style={{ color: "var(--accent)" }}>
                Cleared
              </span>
            )}
          </div>
        ))}
        {file.quests.length === 0 && (
          <div className="card p-5 text-center text-muted text-sm">No active challenges yet.</div>
        )}
      </div>
    </div>
  );
}
