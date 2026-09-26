"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import {
  CHARACTERS,
  CHARACTER_KEYS,
  CharacterKey,
  Profile,
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
      setMsg("Username updated.");
    }
  }

  async function chooseCharacter(key: CharacterKey) {
    setMsg(null);
    const { data, error } = await supabase.rpc("set_archetype", { p_key: key });
    if (error) setMsg(error.message);
    else setProfile(data as Profile);
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

  return (
    <div className="rise">
      <span className="eyebrow hud-label !text-ink">System · Challenger file</span>

      <div className="bezel mt-4">
        <div className="bezel-core p-5 text-center">
          <div className="flex justify-center items-center gap-5">
            <Avatar size={100} character={profile.archetype} />
            <div className="flex flex-col items-center">
              <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={56} />
              <span className="hud-label mt-1.5" style={{ color: rank.color }}>{rank.label}</span>
            </div>
          </div>
          {!editing ? (
            <div className="mt-4">
              <div className="display text-xl">{profile.username.toUpperCase()}</div>
              <button
                className="text-xs text-muted underline underline-offset-4 mt-1"
                onClick={() => setEditing(true)}
              >
                Change username
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="field px-3.5 py-2.5 flex-1 font-mono text-sm"
                maxLength={20}
              />
              <button className="btn-primary px-5 py-2.5 !text-xs" onClick={saveName}>
                Save
              </button>
            </div>
          )}
          {character && (
            <div className="hud-label mt-2.5" style={{ color: character.accent }}>
              {character.name} · {character.focus}
            </div>
          )}
          {msg && <p className="text-sm text-muted mt-3">{msg}</p>}
        </div>
      </div>

      <div className="hud-label mt-6 mb-2.5">Your character</div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {CHARACTER_KEYS.map((key) => {
          const on = profile.archetype === key;
          return (
            <button
              key={key}
              className={`option-row flex-none w-[104px] py-3 flex flex-col items-center gap-1.5 ${on ? "selected" : ""}`}
              onClick={() => chooseCharacter(key)}
            >
              <Avatar size={56} character={key} ring={on} />
              <span className="hud-label !text-ink">{CHARACTERS[key].name.replace("The ", "")}</span>
              <span className="hud-label !text-[9px]">{CHARACTERS[key].focus}</span>
            </button>
          );
        })}
      </div>

      <div className="hud-label mt-6 mb-2.5">Friend code</div>
      <div className="card px-4 py-3.5 flex items-center gap-3">
        <span className="font-mono text-lg tracking-[0.3em]" style={{ color: "var(--accent)" }}>
          {profile.friend_code ?? "……"}
        </span>
        <span className="flex-1 hud-label">Share it, get seen on boards</span>
        <button className="btn-ghost px-4 py-2 !text-xs" onClick={copyCode}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="card mt-5 divide-y divide-[var(--line)]">
        <Row label="Member since" value={formatDate(new Date(profile.created_at))} />
        <Row label="Current streak" value={`${profile.streak_current} ${profile.streak_current === 1 ? "day" : "days"}`} />
        <Row label="Best streak" value={`${profile.streak_best} ${profile.streak_best === 1 ? "day" : "days"}`} />
        <Row label="Total XP" value={profile.xp.toLocaleString()} />
      </div>

      <button className="btn-ghost w-full py-3.5 mt-6 gap-2 text-danger" onClick={signOut}>
        <Icon name="logout" size={16} />
        Sign out
      </button>
      <p className="text-center hud-label mt-4">Life Reset · free for every challenger</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="hud-label">{label}</span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}
