"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import BrickLoader from "@/components/BrickLoader";
import Icon from "@/components/Icon";
import LegoIcon, { BrickColor, PILLAR_BRICK_COLOR } from "@/components/LegoIcon";
import CharacterFile from "@/components/CharacterFile";
import MinifigCard from "@/components/MinifigCard";
import PlayerAvatar from "@/components/PlayerAvatar";
import { legoLevel, levelTitle, photoOf } from "@/lib/brick";
import { CharacterKey, PERIOD_LABEL, PILLAR_ICONS, Period, STAT_ICONS, STAT_KEYS, Stats, questBase, rankForXp } from "@/lib/game";

type FriendQuest = {
  id: string;
  title: string;
  pillar: string;
  xp: number;
  icon: string;
  done_today: boolean; // this week or month for a weekly or monthly quest
  period?: Period;
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
  avatar_url?: string | null;
};

export default function FriendProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const [file, setFile] = useState<FriendFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function removeFriend() {
    if (!file) return;
    const { error } = await supabase.rpc("remove_friend", { p_username: file.username });
    if (error) {
      setConfirmRemove(false);
      return setError(error.message);
    }
    router.replace("/app/world");
  }

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
      <div className="slide-in py-16 flex flex-col items-center gap-4">
        <p className="card px-4 py-3 font-bold" style={{ color: "var(--danger)" }}>{error}</p>
        <button className="btn-ghost px-6 py-2.5" onClick={() => router.back()}>
          Back
        </button>
      </div>
    );
  }
  if (!file) {
    return (
      <div className="py-24 flex justify-center">
        <BrickLoader label="Knocking on their door" />
      </div>
    );
  }

  const rank = rankForXp(file.xp);
  const cleared = file.quests.filter((q) => q.done_today).length;
  // the best streak is never below the one running now
  const best = Math.max(file.streak_best, file.streak_current);

  return (
    <div className="slide-in">
      <button className="flex items-center gap-2.5 py-1 active:translate-y-[1px]" onClick={() => router.back()}>
        <span className="icon-tile !w-10 !h-10 !bg-white">
          <Icon name="chevron-left" size={20} strokeWidth={2.4} />
        </span>
        <span className="display text-[17px]">Back</span>
      </button>

      <div className="mt-4">
        <MinifigCard
          character={file.archetype}
          level={legoLevel(rank.tierIndex)}
          size={230}
          tap
          back={
            <CharacterFile
              name={file.username}
              character={file.archetype}
              level={legoLevel(rank.tierIndex)}
              title={levelTitle(file.archetype, rank.tierIndex)}
              stats={file.stats}
              bestStreak={best}
              since={file.member_since}
            />
          }
        >
          <PlayerAvatar photo={photoOf(file)} character={file.archetype} size={54} />
          <span className="flex-1 min-w-0">
            <span className="display block text-[24px] truncate">{file.username}</span>
            <span className="block text-[13px] font-extrabold text-muted truncate">
              {levelTitle(file.archetype, rank.tierIndex)} · {rank.label} · since {new Date(file.member_since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          </span>
        </MinifigCard>
      </div>
      <Link href={`/app/town?visit=${encodeURIComponent(file.username)}`} className="btn-primary brick-yellow w-full py-3.5 mt-4 !text-[17px]">
        <Icon name="home" size={18} strokeWidth={2.4} />
        Visit their house
      </Link>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Tile label="Last 7 days" value={`${file.weekly_xp.toLocaleString()} XP`} color="green" icon="star" />
        <Tile label="All time" value={`${file.xp.toLocaleString()} XP`} color="blue" icon="chart" />
        <Tile label="Streak" value={`${file.streak_current} ${file.streak_current === 1 ? "day" : "days"}`} color="orange" icon="flame" />
        <Tile label="Best streak" value={`${best} ${best === 1 ? "day" : "days"}`} color="red" icon="trophy" />
      </div>

      {/* the five stats */}
      <div className="card p-4 mt-3 grid grid-cols-5">
        {STAT_KEYS.map((k) => (
          <div key={k} className="text-center">
            <div className="flex justify-center mb-1">
              <LegoIcon name={STAT_ICONS[k]} color={(["green", "azure", "blue", "red", "orange"] as BrickColor[])[STAT_KEYS.indexOf(k)]} size={30} />
            </div>
            <div className="display text-[19px]">{file.stats[k] ?? 0}</div>
            <div className="hud-label mt-0.5">{k}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="section-title" style={{ "--brick": "var(--lego-green)" } as React.CSSProperties}>
          Their missions
        </h2>
        <span className="chip">
          {cleared}/{file.quests.length} done
        </span>
      </div>
      <div className="flex flex-col gap-2.5 stagger pb-4">
        {file.quests.map((q) => {
          return (
            <div key={q.id} className="card px-3 py-3 flex items-center gap-3">
              <LegoIcon name={PILLAR_ICONS[q.pillar as keyof typeof PILLAR_ICONS] ?? "sparkle"} color={PILLAR_BRICK_COLOR[q.pillar] ?? "blue"} size={40} />
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] font-extrabold truncate ${q.done_today ? "text-muted line-through" : ""}`}>{q.title}</span>
                <span className="text-[12.5px] font-bold text-muted">
                  {q.period && q.period !== "daily" ? `${PERIOD_LABEL[q.period]} · ` : ""}
                  {q.pillar} · +{questBase(q.xp)} XP
                </span>
              </span>
              <span className={`stud-check !w-8 !h-8 ${q.done_today ? "on" : "opacity-40 scale-75"}`} aria-label={q.done_today ? "Done" : "Not yet"}>
                <Icon name="check" size={15} strokeWidth={3} />
              </span>
            </div>
          );
        })}
        {file.quests.length === 0 && <div className="card p-5 text-center text-[14px] font-bold text-muted">No missions yet.</div>}
      </div>

      {confirmRemove ? (
        <div className="card p-4 mt-4 text-center">
          <p className="font-extrabold">Remove {file.username}?</p>
          <p className="text-[13px] font-bold text-muted mt-1">Their house leaves your town and yours leaves theirs.</p>
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <button className="btn-ghost brick-flat py-2.5" onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
            <button className="btn-primary brick-red brick-flat py-2.5" onClick={removeFriend}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button className="w-full text-center text-[13px] font-extrabold text-muted underline underline-offset-4 mt-4 py-2" onClick={() => setConfirmRemove(true)}>
          Remove friend
        </button>
      )}
    </div>
  );
}

function Tile({ label, value, color, icon }: { label: string; value: string; color: BrickColor; icon: string }) {
  return (
    <div className="card px-3 py-3 flex items-center gap-2.5 min-w-0">
      <LegoIcon name={icon} color={color} size={36} />
      <span className="min-w-0">
        <span className="block text-[12px] font-extrabold text-muted">{label}</span>
        <span className="display block text-[17px] truncate">{value}</span>
      </span>
    </div>
  );
}
