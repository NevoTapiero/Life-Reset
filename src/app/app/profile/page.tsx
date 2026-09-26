"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PLAN_DAYS, Profile, dayOfPlan, finishDate, formatDate, rankForXp } from "@/lib/game";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState<string>("");
  const [nameDraft, setNameDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [{ data: prof }, { data: t }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.rpc("app_today"),
      ]);
      setProfile(prof as Profile);
      setNameDraft((prof as Profile)?.username ?? "");
      setToday(String(t));
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

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Opening your file…</div>;
  }

  const rank = rankForXp(profile.xp);
  const day = dayOfPlan(profile.plan_started_on, today || new Date().toISOString().slice(0, 10));

  return (
    <div className="rise">
      <div className="hud-label">Challenger file</div>
      <div className="card p-5 mt-3 text-center">
        <div className="text-5xl" aria-hidden>🎮</div>
        {!editing ? (
          <div className="mt-3">
            <div className="text-xl font-bold font-mono">{profile.username}</div>
            <button
              className="text-xs text-muted underline underline-offset-4 mt-1"
              onClick={() => setEditing(true)}
            >
              Change username
            </button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="card px-3 py-2 flex-1 outline-none focus:border-[var(--accent)] font-mono text-sm"
              maxLength={20}
            />
            <button className="btn-primary px-4" onClick={saveName}>
              Save
            </button>
          </div>
        )}
        <div className="mt-3 flex justify-center gap-2 flex-wrap">
          <span className="hud-label !text-accent border border-line rounded-full px-3 py-1">
            {profile.archetype ?? "The Challenger"}
          </span>
          <span
            className="hud-label border border-line rounded-full px-3 py-1"
            style={{ color: rank.color }}
          >
            {rank.label}
          </span>
        </div>
        {msg && <p className="text-sm text-muted mt-3">{msg}</p>}
      </div>

      <div className="card mt-4 divide-y divide-[var(--line)]">
        <Row label="Campaign" value={`Day ${day} of ${PLAN_DAYS}`} />
        <Row
          label="Started"
          value={profile.plan_started_on ? formatDate(new Date(profile.plan_started_on + "T00:00:00Z")) : "Not started"}
        />
        <Row label="Day 66 lands" value={formatDate(finishDate(profile.plan_started_on))} />
        <Row label="Streak commitment" value={`${profile.streak_commitment} days`} />
        <Row label="Current streak" value={`${profile.streak_current} days`} />
        <Row label="Best streak" value={`${profile.streak_best} days`} />
        <Row label="Total XP" value={profile.xp.toLocaleString()} />
      </div>

      <button className="btn-ghost w-full py-3.5 mt-6 text-danger" onClick={signOut}>
        Sign out
      </button>
      <p className="text-center text-xs text-muted mt-4">Life Reset · free for every challenger</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="hud-label">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
