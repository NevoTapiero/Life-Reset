"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { PLAN_DAYS, Profile, dayOfPlan, finishDate, formatDate, rankForXp } from "@/lib/game";

const COMMITMENTS = [7, 14, 30, 50];

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

  async function saveCommitment(days: number) {
    setMsg(null);
    const { data, error } = await supabase.rpc("set_commitment", { p_days: days });
    if (error) setMsg(error.message);
    else setProfile(data as Profile);
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
      <span className="eyebrow hud-label !text-ink">System · Challenger file</span>

      <div className="bezel mt-4">
        <div className="bezel-core p-5 text-center">
          <div className="flex justify-center">
            <Avatar size={104} />
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
          <div className="mt-3.5 flex justify-center gap-2 flex-wrap">
            <span className="eyebrow hud-label" style={{ color: "var(--accent)" }}>
              {profile.archetype ?? "The Challenger"}
            </span>
            <span className="eyebrow hud-label" style={{ color: rank.color }}>
              {rank.label}
            </span>
          </div>
          {msg && <p className="text-sm text-muted mt-3">{msg}</p>}
        </div>
      </div>

      <div className="hud-label mt-6 mb-2.5">The contract · streak commitment</div>
      <div className="grid grid-cols-4 gap-2">
        {COMMITMENTS.map((c) => (
          <button
            key={c}
            className={`option-row py-3 flex flex-col items-center gap-0.5 ${profile.streak_commitment === c ? "selected" : ""}`}
            onClick={() => saveCommitment(c)}
          >
            <span className="display text-lg leading-none">{c}</span>
            <span className="hud-label">days</span>
          </button>
        ))}
      </div>

      <div className="card mt-5 divide-y divide-[var(--line)]">
        <Row label="Campaign" value={`Day ${day} of ${PLAN_DAYS}`} />
        <Row
          label="Started"
          value={profile.plan_started_on ? formatDate(new Date(profile.plan_started_on + "T00:00:00Z")) : "Not started"}
        />
        <Row label="Day 66 lands" value={formatDate(finishDate(profile.plan_started_on))} />
        <Row label="Current streak" value={`${profile.streak_current} days`} />
        <Row label="Best streak" value={`${profile.streak_best} days`} />
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
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
