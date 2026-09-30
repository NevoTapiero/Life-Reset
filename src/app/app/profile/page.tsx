"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BrickLoader from "@/components/BrickLoader";
import Connections from "@/components/Connections";
import Icon from "@/components/Icon";
import LegoIcon, { BrickColor } from "@/components/LegoIcon";
import Minifig from "@/components/Minifig";
import MinifigCard from "@/components/MinifigCard";
import GoldBricks from "@/components/GoldBricks";
import PlayerAvatar from "@/components/PlayerAvatar";
import { legoLevel, levelTitle, photoOf } from "@/lib/brick";
import { setSound, soundOn } from "@/lib/sfx";
import { CHARACTERS, CHARACTER_KEYS, CharacterKey, Profile, rankForXp } from "@/lib/game";

// three.js touches window: the 3D plot loads on the client, and only when asked
const LegoWorld = dynamic(() => import("@/components/LegoWorld"), { ssr: false });

// Profile: the plain facts. Your picture, name, email, level, streak and XP,
// which character you play, the apps you connected, privacy, sign out.
export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [show3d, setShow3d] = useState(false);
  const [sound, setSoundState] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    setEmail(userData.user?.email ?? null);
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(prof as Profile);
    setNameDraft((prof as Profile)?.username ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then sets state
    reload();
  }, [reload]);

  // the sound switch reads this device's setting after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a device setting once
    setSoundState(soundOn());
  }, []);

  // jump to the apps section when linked from Home (#apps), once
  const jumped = useRef(false);
  useEffect(() => {
    if (!profile || jumped.current) return;
    jumped.current = true;
    if (window.location.hash === "#apps") {
      document.getElementById("apps")?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", window.location.pathname);
    }
  }, [profile]);

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
    else setProfile(data as Profile);
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
    } else setProfile(data as Profile);
  }

  // Shrink the photo to a 512px square in the browser, store it in your own
  // folder, then point your profile at it.
  async function uploadPhoto(file: File) {
    if (!profile) return;
    setMsg(null);
    setUploading(true);
    try {
      const blob = await squareJpeg(file, 512);
      const path = `${profile.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const old = photoOf(profile);
      const { data, error } = await supabase.rpc("set_avatar", { p_url: pub.publicUrl });
      if (error) throw error;
      setProfile(data as Profile);
      if (old) await removeStored(old);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not upload that picture.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function useMinifig() {
    if (!profile) return;
    const old = photoOf(profile);
    const { data, error } = await supabase.rpc("set_avatar", { p_url: null });
    if (error) return setMsg(error.message);
    setProfile(data as Profile);
    if (old) await removeStored(old);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!profile) {
    return (
      <div className="py-24 flex justify-center">
        <BrickLoader label="Opening your profile" />
      </div>
    );
  }

  const rank = rankForXp(profile.xp);
  const photo = photoOf(profile);
  const level = legoLevel(rank.tierIndex);

  return (
    <div className="slide-in">
      {/* the collectible minifigure card: your minifig on its stand, your level as the series number */}
      <MinifigCard character={profile.archetype} level={level}>
          <div className="relative flex-none">
            <PlayerAvatar photo={photo} character={profile.archetype} size={54} />
            <button
              className="absolute -right-1.5 -bottom-1 grid place-items-center rounded-full"
              style={{ width: 28, height: 28, background: "var(--lego-yellow)", color: "var(--lego-black)", boxShadow: "0 0 0 2px #fff, 0 3px 0 2px var(--lego-yellow-edge)" }}
              aria-label="Change your picture"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name={uploading ? "refresh" : "camera"} size={14} strokeWidth={2.4} className={uploading ? "animate-spin" : ""} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
              }}
            />
          </div>
          {!editing ? (
            <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(true)} aria-label="Edit your name">
              <span className="flex items-center gap-1.5">
                <span className="display text-[24px] truncate">{profile.username}</span>
                <span className="text-muted flex-none">
                  <Icon name="pen" size={14} strokeWidth={2.4} />
                </span>
              </span>
              <span className="block text-[13px] font-extrabold text-muted truncate">
                {levelTitle(profile.archetype, rank.tierIndex)} · {CHARACTERS[(profile.archetype ?? "warrior") as CharacterKey].name.replace("The ", "")} · {rank.label}
              </span>
            </button>
          ) : (
            <div className="flex-1 min-w-0 flex gap-1.5">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="field px-3 py-2 flex-1 min-w-0 text-[16px]"
                maxLength={20}
                aria-label="Your name"
                autoFocus
              />
              <button className="btn-primary brick-flat px-3 py-2 !text-[13px]" onClick={saveName}>
                Save
              </button>
              <button className="btn-ghost brick-flat px-2.5 py-2 !text-[13px]" aria-label="Cancel" onClick={() => { setEditing(false); setNameDraft(profile.username); }}>
                <Icon name="x" size={14} strokeWidth={2.6} />
              </button>
            </div>
          )}
      </MinifigCard>
      {photo && (
        <div className="text-center">
          <button className="text-[12.5px] font-extrabold text-muted underline underline-offset-4 mt-2" disabled={uploading} onClick={useMinifig}>
            Remove my photo
          </button>
        </div>
      )}
      {msg && <p className="text-sm font-bold mt-3 text-center" style={{ color: "var(--danger)" }}>{msg}</p>}

      {/* your plot in 3D: the house grows with your level, the garden with your streak */}
      <section className="scene mt-4 overflow-hidden">
        {show3d ? (
          <div className="relative" style={{ height: 320 }}>
            <LegoWorld houseLevel={level} name={profile.username} streak={profile.streak_current} character={profile.archetype} className="absolute inset-0" />
            <button className="absolute right-3 top-3 icon-tile !w-9 !h-9 !bg-white" aria-label="Close the 3D view" onClick={() => setShow3d(false)}>
              <Icon name="x" size={16} strokeWidth={2.4} />
            </button>
          </div>
        ) : (
          <button className="w-full px-4 py-4 flex items-center gap-3 text-left" onClick={() => setShow3d(true)}>
            <LegoIcon name="home" color="orange" size={46} />
            <span className="flex-1">
              <span className="display block text-[18px] text-white" style={{ textShadow: "0 2px 0 rgb(0 0 0 / 0.15)" }}>My house in 3D</span>
              <span className="block text-[13px] font-extrabold text-white/90">Level {level} house, {profile.streak_current} day garden</span>
            </span>
            <span className="chip">Show</span>
          </button>
        )}
      </section>

      {/* the numbers */}
      <section className="grid grid-cols-2 gap-3 mt-4">
        <Stat label="Total XP" value={profile.xp.toLocaleString()} color="green" icon="star" />
        <Stat label="Rank" value={rank.label} color="blue" icon="chart" />
        <Stat label="Streak" value={`${profile.streak_current} ${profile.streak_current === 1 ? "day" : "days"}`} color="orange" icon="flame" />
        <Stat label="Best streak" value={`${profile.streak_best} ${profile.streak_best === 1 ? "day" : "days"}`} color="red" icon="trophy" />
        <Stat label="Gold" value={(profile.gold ?? 0).toLocaleString()} color="yellow" icon="stud" />
        <Stat label="Playing since" value={new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(profile.created_at)).replace(" 20", " ")} color="azure" icon="calendar" />
      </section>

      <div className="mt-4">
        <GoldBricks profile={profile} />
      </div>

      {/* account */}
      <h2 className="section-title mt-8 mb-3" style={{ "--brick": "var(--lego-blue)" } as React.CSSProperties}>
        Account
      </h2>
      <section className="card divide-y-2 divide-[var(--line)]">
        <Row icon="mail" label="Email" value={email ?? "..."} />
        <Row icon="chart" label="Your record" value="Stats and what you train most" onClick={() => router.push("/app/stats")} />
        <Row icon="user" label="Name" value={profile.username} onClick={() => { setEditing(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        <div className="px-4 py-3.5 flex items-center gap-3">
          <LegoIcon name="users" color="white" size={34} />
          <span className="flex-1 min-w-0">
            <span className="block font-extrabold text-[15px]">Friends can see me</span>
            <span className="block text-[12.5px] font-bold text-muted">{profile.share_activity ? "Your house and rank show in their town" : "You are hidden from friends"}</span>
          </span>
          <button className={`switch ${profile.share_activity ? "on" : ""}`} role="switch" aria-checked={profile.share_activity} aria-label="Friends can see me" onClick={togglePrivacy} />
        </div>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <LegoIcon name="sparkle" color="white" size={34} />
          <span className="flex-1 min-w-0">
            <span className="block font-extrabold text-[15px]">Sounds</span>
            <span className="block text-[12.5px] font-bold text-muted">Brick snaps and chimes on this device</span>
          </span>
          <button
            className={`switch ${sound ? "on" : ""}`}
            role="switch"
            aria-checked={sound}
            aria-label="Sounds"
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
            }}
          />
        </div>
      </section>

      {/* character */}
      <h2 className="section-title mt-8 mb-1" style={{ "--brick": "var(--lego-orange)" } as React.CSSProperties}>
        Your minifig
      </h2>
      <p className="text-[13px] font-bold text-muted mb-3">Who you are in the LEGO world. Each one dresses up as you level.</p>
      <div className="grid grid-cols-5 gap-2">
        {CHARACTER_KEYS.map((key) => {
          const on = (profile.archetype ?? "warrior") === key;
          return (
            <button
              key={key}
              className={`option-row !p-1.5 flex flex-col items-center gap-1 ${on ? "selected" : ""}`}
              onClick={() => chooseCharacter(key)}
              aria-pressed={on}
              aria-label={CHARACTERS[key].name}
            >
              <Minifig character={key} level={level} size={78} />
              <span className="text-[10px] font-extrabold leading-tight">{CHARACTERS[key].name.replace("The ", "")}</span>
            </button>
          );
        })}
      </div>

      {/* connected apps */}
      <h2 id="apps" className="section-title mt-8 mb-1 scroll-mt-4" style={{ "--brick": "var(--lego-green)" } as React.CSSProperties}>
        Your apps
      </h2>
      <p className="text-[13px] font-bold text-muted mb-3">Connected apps count your tasks, sleep, steps and workouts and pay XP on their own.</p>
      <Connections onXp={reload} />

      <button className="btn-ghost w-full py-3.5 mt-8" onClick={signOut}>
        <Icon name="logout" size={17} strokeWidth={2.2} />
        Sign out
      </button>
      <p className="text-center hud-label mt-5">Solo Leveling</p>
    </div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: string; color: BrickColor; icon: string }) {
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

function Row({ icon, label, value, onClick }: { icon: string; label: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <LegoIcon name={icon} color="white" size={34} />
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[12.5px] font-extrabold text-muted">{label}</span>
        <span className="block font-extrabold text-[15px] truncate">{value}</span>
      </span>
      {onClick && <Icon name="chevron-right" size={17} strokeWidth={2.2} className="text-muted" />}
    </>
  );
  return onClick ? (
    <button className="w-full px-4 py-3 flex items-center gap-3" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="px-4 py-3 flex items-center gap-3">{body}</div>
  );
}

// Centre-crop an image to a square and re-encode it as a JPEG of `size` px.
async function squareJpeg(file: File, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize pictures.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that picture."))), "image/jpeg", 0.86),
  );
}

// Delete an old picture from storage (best effort; a leftover file is harmless).
async function removeStored(publicUrl: string) {
  const marker = "/storage/v1/object/public/avatars/";
  const i = publicUrl.indexOf(marker);
  if (i < 0) return;
  await supabase.storage.from("avatars").remove([publicUrl.slice(i + marker.length)]);
}
