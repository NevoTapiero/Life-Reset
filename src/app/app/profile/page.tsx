"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { applyCharacterTheme } from "@/lib/theme";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import XpMeter from "@/components/XpMeter";
import {
  CHARACTERS,
  CHARACTER_KEYS,
  CharacterKey,
  Profile,
  STAT_ICONS,
  STAT_KEYS,
  characterOf,
  formatDate,
  rankForXp,
} from "@/lib/game";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).single();
      setProfile(prof as Profile);
      setNameDraft((prof as Profile)?.username ?? "");
    })();
  }, []);

  async function saveName() {
    setMsg(null);
    const { data, error } = await supabase.rpc("set_username", { p_name: nameDraft });
    if (error) setMsg(error.message);
    else {
      setProfile(data as Profile);
      setEditing(false);
    }
  }

  async function chooseCharacter(key: CharacterKey) {
    setMsg(null);
    const { data, error } = await supabase.rpc("set_archetype", { p_key: key });
    if (error) setMsg(error.message);
    else {
      setProfile(data as Profile);
      applyCharacterTheme(key);
    }
  }

  async function togglePrivacy() {
    if (!profile) return;
    setMsg(null);
    const next = !profile.share_activity;
    setProfile({ ...profile, share_activity: next });
    const { data, error } = await supabase.rpc("set_privacy", { p_share: next });
    if (error) {
      setProfile({ ...profile, share_activity: !next });
      setMsg(error.message);
    } else {
      setProfile(data as Profile);
    }
  }

  async function copyCode() {
    if (!profile?.friend_code) return;
    try {
      await navigator.clipboard.writeText(profile.friend_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setMsg(`Your code: ${profile.friend_code}`);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Opening your file…</div>;
  }

  const rank = rankForXp(profile.xp);
  const character = characterOf(profile.archetype);
  const accent = character?.accent ?? "#ff6b00";

  return (
    <div className="slide-in">
      {/* wallpaper hero */}
      <div
        className="scene p-5 pt-7 text-center"
        style={{ "--scene-glow": `${accent}44` } as React.CSSProperties}
      >
        <SceneGrid color={accent} />
        <span className="particle" style={{ left: "12%", top: "30%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="particle" style={{ right: "14%", top: "22%", animationDelay: "1.2s", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="particle" style={{ left: "22%", bottom: "34%", animationDelay: "2.1s", background: accent, boxShadow: `0 0 8px ${accent}` }} />

        <div className="relative">
          <div className="flex justify-center">
            <Avatar size={116} character={profile.archetype} tierIndex={rank.tierIndex} />
          </div>

          {!editing ? (
            <div className="mt-4">
              <button className="display text-[26px] leading-tight" onClick={() => setEditing(true)}>
                {profile.username}
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="field px-3.5 py-2.5 flex-1 font-mono text-sm"
                maxLength={20}
                autoFocus
              />
              <button className="btn-primary px-5 py-2.5 !text-xs" onClick={saveName}>
                Save
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-2.5 mt-3">
            {character && (
              <span className="class-pill" style={{ color: character.accent }}>
                {character.name.replace("The ", "")}
              </span>
            )}
            <span className="class-pill" style={{ color: rank.color }}>{rank.label}</span>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4">
            <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={46} />
            <span className="hud-label">Since {formatDate(new Date(profile.created_at))}</span>
          </div>

          {msg && <p className="text-sm text-danger mt-3">{msg}</p>}
        </div>
      </div>

      {/* XP meter */}
      <div className="card p-4 mt-4">
        <XpMeter rank={rank} xp={profile.xp} />
      </div>

      {/* stat grid */}
      <div className="card p-4 mt-3 grid grid-cols-5">
        {STAT_KEYS.map((k) => (
          <div key={k} className="text-center">
            <div className="flex justify-center text-muted mb-1.5">
              <Icon name={STAT_ICONS[k]} size={18} />
            </div>
            <div className="display text-[19px]" style={{ color: accent }}>{profile.stats[k] ?? 0}</div>
            <div className="hud-label mt-1">{k}</div>
          </div>
        ))}
      </div>

      <h2 className="display text-[16px] mt-7 mb-3">Your character</h2>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {CHARACTER_KEYS.map((key) => {
          const on = profile.archetype === key;
          return (
            <button
              key={key}
              className={`option-row flex-none w-[112px] px-3 py-4 flex flex-col items-center gap-2 ${on ? "selected" : ""}`}
              onClick={() => chooseCharacter(key)}
            >
              <Avatar size={64} character={key} ring={on} />
              <span className="display !text-[11px]">{CHARACTERS[key].name.replace("The ", "")}</span>
              <span className="hud-label !text-[9px]" style={{ color: CHARACTERS[key].accent }}>
                {CHARACTERS[key].stat}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="display text-[16px] mt-7 mb-3">Privacy</h2>
      <div className="card px-4 py-4 flex items-center gap-3.5">
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">Share activity with friends</span>
          <span className="hud-label mt-1 block">
            {profile.share_activity ? "Friends see your rank and streak" : "You are hidden"}
          </span>
        </span>
        <button
          className={`switch ${profile.share_activity ? "on" : ""}`}
          role="switch"
          aria-checked={profile.share_activity}
          aria-label="Share my activity with friends"
          onClick={togglePrivacy}
        />
      </div>

      <h2 className="display text-[16px] mt-7 mb-3">Friend code</h2>
      <div className="card px-4 py-3.5 flex items-center gap-3">
        <span className="font-mono text-lg tracking-[0.3em] flex-1" style={{ color: "var(--accent)" }}>
          {profile.friend_code ?? "……"}
        </span>
        <button className="btn-ghost px-4 py-2 !text-xs" onClick={copyCode}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="card mt-5 divide-y divide-[var(--line)]">
        <Row label="Current streak" value={`${profile.streak_current} ${profile.streak_current === 1 ? "day" : "days"}`} />
        <Row label="Best streak" value={`${profile.streak_best} ${profile.streak_best === 1 ? "day" : "days"}`} />
        <Row label="Total XP" value={profile.xp.toLocaleString()} />
      </div>

      <button className="btn-ghost w-full py-3.5 mt-6 gap-2 text-danger" onClick={signOut}>
        <Icon name="logout" size={16} />
        Sign out
      </button>
      <p className="text-center hud-label mt-4">Solo Leveling</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="hud-label">{label}</span>
      <span className="display text-[14px]">{value}</span>
    </div>
  );
}

// faint radar-web pattern behind the hero
function SceneGrid({ color }: { color: string }) {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.14 }}
    >
      {[46, 86, 126, 166].map((r) => (
        <circle key={r} cx="200" cy="96" r={r} fill="none" stroke={color} strokeWidth="1" />
      ))}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <line
            key={i}
            x1="200"
            y1="96"
            x2={200 + Math.cos(a) * 170}
            y2={96 + Math.sin(a) * 170}
            stroke={color}
            strokeWidth="0.7"
          />
        );
      })}
    </svg>
  );
}
