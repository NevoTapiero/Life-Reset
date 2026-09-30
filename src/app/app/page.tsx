"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import XpMeter from "@/components/XpMeter";
import { useStations } from "@/lib/useStations";

// three.js touches window: load the LEGO world on the client only
const LegoWorld = dynamic(() => import("@/components/LegoWorld"), { ssr: false });
const LegoRoom = dynamic(() => import("@/components/LegoWorld").then((m) => m.LegoRoom), { ssr: false });
import {
  CHARACTERS,
  CHARACTER_KEYS,
  CHARACTER_SKIN_TIERS,
  CharacterKey,
  Profile,
  STAT_ICONS,
  STAT_INFO,
  STAT_KEYS,
  TIERS,
  characterOf,
  rankForXp,
  skinTierFor,
} from "@/lib/game";

// You: the character, big, wearing the look your rank has earned. The five
// stats climbing, the XP meter, the streak. Everything you do in real life
// ends up here.

export default function YouPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // inside your house: a station per mission
  const [inside, setInside] = useState(false);
  const { stations, complete, chest, gold, collect, prices, owned, buy } = useStations();

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function chooseCharacter(key: CharacterKey) {
    const { data, error } = await supabase.rpc("set_archetype", { p_key: key });
    if (error) setError(error.message);
    else setProfile(data as Profile);
  }

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Loading…</div>;
  }

  const rank = rankForXp(profile.xp);
  const character = characterOf(profile.archetype);
  const accent = character?.accent ?? "var(--accent)";
  const key = profile.archetype ?? "warrior";
  const skin = skinTierFor(key, rank.tierIndex);
  const nextSkin = CHARACTER_SKIN_TIERS[key].find((t) => t > rank.tierIndex);
  const statMax = Math.max(100, ...STAT_KEYS.map((k) => profile.stats[k] ?? 0));

  return (
    <div className="slide-in">
      {/* your plot: the brick house grows with rank, the garden with your streak; you by the door */}
      <div className="scene p-0 text-center overflow-hidden" style={{ "--scene-glow": `${character?.accent ?? "#ff6b00"}66` } as React.CSSProperties}>
        <span className="particle" style={{ left: "10%", top: "24%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="particle" style={{ right: "12%", top: "18%", animationDelay: "1.2s", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="particle" style={{ left: "20%", bottom: "30%", animationDelay: "2.1s", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="particle" style={{ right: "22%", bottom: "38%", animationDelay: "0.6s", background: accent, boxShadow: `0 0 8px ${accent}` }} />

        <div className="relative">
          <div className="relative" style={{ height: "58vh", minHeight: 360 }}>
            {inside ? (
              <LegoRoom
                stations={stations ?? []}
                onTap={async (id) => {
                  const xp = await complete(id);
                  // the XP bar and rank follow the payout
                  if (xp !== null) setProfile((p) => (p ? { ...p, xp: p.xp + xp } : p));
                  return xp;
                }}
                chest={chest}
                gold={gold}
                onCollect={async () => {
                  const r = await collect();
                  if (r) setProfile(r.profile);
                  return r?.xp ?? null;
                }}
                prices={prices}
                owned={owned}
                onBuy={buy}
                onLeave={() => setInside(false)}
                className="absolute inset-0"
              />
            ) : (
              <>
                <LegoWorld
                  // ponytail: house grows with rank tier until gold buys upgrades
                  houseLevel={rank.tierIndex + 1}
                  streak={profile.streak_current}
                  className="absolute inset-0"
                />
                <button
                  onClick={() => setInside(true)}
                  className="absolute top-3 right-3 px-3.5 py-2 rounded-full text-sm font-semibold shadow-lg active:scale-95 transition-transform"
                  style={{ background: "#ff8a1f", color: "#fff" }}
                >
                  {chest ? `Collect +${chest} XP` : `Go inside${stations ? ` · ${stations.filter((s) => !s.done).length} to do` : ""}`}
                </button>
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: "linear-gradient(180deg, transparent, var(--panel))" }} />
          </div>
          <div className="display text-[28px] leading-tight -mt-6 relative px-5">{profile.username}</div>
          <div className="flex items-center justify-center gap-2.5 mt-3">
            {character && (
              <span className="class-pill" style={{ color: character.accent }}>
                {character.name.replace("The ", "")}
              </span>
            )}
            <span className="class-pill" style={{ color: rank.color }}>{rank.label}</span>
          </div>
          <div className="hud-label mt-4 pb-6">
            {skin > 0
              ? `${TIERS[skin].name} look`
              : nextSkin !== undefined
                ? `New look at ${TIERS[nextSkin].name}`
                : "Base look"}
          </div>
        </div>
      </div>

      {/* first run: choose who you are */}
      {!profile.archetype && (
        <div className="hud-frame p-4 mt-4 rise">
          <div className="display text-[15px] mb-3.5" style={{ color: "var(--accent)" }}>Choose your character</div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {CHARACTER_KEYS.map((k) => (
              <button key={k} className="flex flex-col items-center gap-1.5 flex-none active:scale-95 transition-transform" onClick={() => chooseCharacter(k)}>
                <Avatar size={64} character={k} />
                <span className="hud-label !text-ink">{CHARACTERS[k].name.replace("The ", "")}</span>
                <span className="hud-label !text-[9px]">{CHARACTERS[k].stat}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      {/* rank and XP */}
      <div className="card p-4 mt-4 flex items-center gap-4">
        <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={54} />
        <div className="flex-1 min-w-0">
          <XpMeter rank={rank} xp={profile.xp} />
        </div>
      </div>

      {/* the five stats, climbing */}
      <div className="card p-4 mt-3">
        <div className="flex items-baseline justify-between mb-3">
          <span className="hud-label">Stats</span>
          <span className="hud-label" style={{ color: "var(--accent)" }}>
            {profile.streak_current} day streak
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {STAT_KEYS.map((k) => {
            const v = profile.stats[k] ?? 0;
            return (
              <div key={k} className="flex items-center gap-3">
                <span className="icon-tile !w-9 !h-9 !rounded-[10px]" style={{ color: accent }}>
                  <Icon name={STAT_ICONS[k]} size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[14px] font-semibold">{STAT_INFO[k].name}</span>
                    <span className="display text-[15px]" style={{ color: accent }}>{v}</span>
                  </div>
                  <div className="bar-seg !h-[8px] mt-1.5">
                    <i style={{ width: `${(v / statMax) * 100}%` }} />
                    <b />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Link href="/app/missions" className="btn-primary w-full py-4 mt-4">
        Today&apos;s missions
      </Link>
    </div>
  );
}
