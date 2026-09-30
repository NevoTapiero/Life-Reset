"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BrickLoader from "@/components/BrickLoader";
import Icon from "@/components/Icon";
import Minifig from "@/components/Minifig";
import PlayerAvatar from "@/components/PlayerAvatar";
import TownArt from "@/components/TownArt";
import BrickWipe from "@/components/BrickWipe";
import TownNews from "@/components/TownNews";
import ShopWindow from "@/components/ShopWindow";
import { legoLevel, levelTitle, photoOf } from "@/lib/brick";
import { brickSound } from "@/lib/brickSound";
import LegoIcon from "@/components/LegoIcon";
import { rankForXp } from "@/lib/game";

type Row = {
  username: string;
  archetype: string | null;
  xp: number;
  streak_current: number;
  weekly_xp: number;
  is_me: boolean;
  avatar_url?: string | null;
};

type Board = "all" | "week";

// World: the door into the 3D LEGO town, the race between you and your
// friends, and where new friends come in.
export default function WorldPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [board, setBoard] = useState<Board>("all");
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myGold, setMyGold] = useState(0);
  // friends at your door, waiting for an answer
  const [knocks, setKnocks] = useState<string[]>([]);
  const [doorMsg, setDoorMsg] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // the brick wipe into the 3D world
  const [jumping, setJumping] = useState(false);
  const jump = useCallback(() => router.push("/app/town"), [router]);

  const knockHeard = useRef(false);
  const load = useCallback(async () => {
    const [{ data, error }, { data: userData }, { data: visits }] = await Promise.all([
      supabase.rpc("get_leaderboard"),
      supabase.auth.getUser(),
      supabase.rpc("my_visits"),
    ]);
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    const atDoor = ((visits as { username: string; knocked_by_me: boolean; allowed: boolean }[] | null) ?? [])
      .filter((v) => !v.knocked_by_me && !v.allowed)
      .map((v) => v.username);
    setKnocks(atDoor);
    if (atDoor.length > 0 && !knockHeard.current) {
      knockHeard.current = true;
      brickSound.knock();
    }
    const uid = userData.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("friend_code, gold").eq("id", uid).single();
      setMyCode(prof?.friend_code ?? null);
      setMyGold((prof as { gold?: number } | null)?.gold ?? 0);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then sets state
    load();
  }, [load]);

  async function addFriend() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.rpc("add_friend", { p_code: codeDraft });
    setBusy(false);
    if (error) return setError(error.message);
    const friend = data as { username?: string };
    setNotice(friend?.username ? `${friend.username} moved into your town.` : "Friend added.");
    setCodeDraft("");
    load();
  }

  async function answer(name: string, allow: boolean) {
    setError(null);
    const { error } = await supabase.rpc("answer_knock", { p_visitor: name, p_allow: allow });
    if (error) return setError(error.message);
    setKnocks((k) => k.filter((n) => n !== name));
    if (allow) brickSound.stud(4);
    window.dispatchEvent(new Event("sl-knocks"));
    setDoorMsg(allow ? `${name} can come into your house now.` : `You told ${name} not now.`);
  }

  async function removeFriend(username: string) {
    setConfirmRemove(null);
    setError(null);
    const { error } = await supabase.rpc("remove_friend", { p_username: username });
    if (error) setError(error.message);
    else load();
  }

  function flashCopied(what: "code" | "link") {
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  }

  async function copyCode() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      flashCopied("code");
    } catch {}
  }

  async function shareInvite() {
    if (!myCode) return;
    const url = `${window.location.origin}/join/${myCode}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Solo Leveling", text: "Move into my LEGO town", url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      flashCopied("link");
    } catch {}
  }

  if (!rows) {
    return (
      <div className="py-24 flex justify-center">
        {error ? <p className="card px-4 py-3 font-bold" style={{ color: "var(--danger)" }}>{error}</p> : <BrickLoader label="Opening the world" />}
      </div>
    );
  }

  const ranked = [...rows].sort((a, b) => (board === "all" ? b.xp - a.xp : b.weekly_xp - a.weekly_xp));
  const score = (r: Row) => (board === "all" ? r.xp : r.weekly_xp);
  const residents = rows.map((r) => ({ name: r.username, level: legoLevel(rankForXp(r.xp).tierIndex), character: r.archetype, me: r.is_me, photo: photoOf(r) }));
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const alone = rows.length <= 1;

  return (
    <div className="slide-in">
      {confirmRemove && (
        <div className="fixed inset-0 z-50 grid place-items-center px-6" style={{ background: "rgb(27 42 52 / 0.45)" }} onClick={() => setConfirmRemove(null)}>
          <div className="card p-5 w-full max-w-[320px] text-center rise" onClick={(e) => e.stopPropagation()}>
            <div className="display text-[19px]">Remove {confirmRemove}?</div>
            <p className="text-sm font-bold text-muted mt-2">Their house leaves your town and yours leaves theirs.</p>
            <div className="flex gap-2.5 mt-5">
              <button className="btn-ghost flex-1 py-2.5" onClick={() => setConfirmRemove(null)}>
                Keep
              </button>
              <button className="btn-primary brick-red flex-1 py-2.5" onClick={() => removeFriend(confirmRemove)}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* the door into the 3D world */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="section-title" style={{ "--brick": "var(--lego-blue)" } as React.CSSProperties}>
          Your world
        </h1>
        <span className="chip">{rows.length === 1 ? "Just your house" : `${Math.min(rows.length, 8)} houses`}</span>
      </div>
      <section className="scene overflow-hidden">
        <TownArt residents={residents} className="w-full h-auto block" />
      </section>
      <button className="btn-primary brick-yellow w-full py-4 mt-4 !text-[19px]" onClick={() => setJumping(true)}>
        <Icon name="play" size={18} />
        Jump into the world
      </button>
      {jumping && <BrickWipe onCovered={jump} />}
      {knocks.map((name) => {
        const r = rows.find((x) => x.username === name);
        return (
          <div key={name} className="card mt-4 p-3.5 rise">
            <div className="flex items-center gap-3">
              <span className="relative flex-none">
                <PlayerAvatar photo={r ? photoOf(r) : null} character={r?.archetype} size={44} />
                <span className="door-knock absolute -right-2 -bottom-1" aria-hidden>
                  <LegoIcon name="home" color="orange" size={24} />
                </span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-extrabold text-[15px] truncate">{name} is at your door</span>
                <span className="block text-[12.5px] font-bold text-muted">Let them into your house?</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button className="btn-ghost brick-flat py-2.5 !text-[14px]" onClick={() => answer(name, false)}>
                Not now
              </button>
              <button className="btn-primary brick-green brick-flat py-2.5 !text-[14px]" onClick={() => answer(name, true)}>
                Let in
              </button>
            </div>
          </div>
        );
      })}

      {doorMsg && <p className="chip chip-green mt-4">{doorMsg}</p>}

      <div className="mt-6">
        <ShopWindow gold={myGold} />
      </div>

      {!alone && (
        <div className="mt-4">
          <TownNews friends={rows.filter((r) => !r.is_me).map((r) => ({ username: r.username, archetype: r.archetype, xp: r.xp }))} />
        </div>
      )}

      {/* the board */}
      <div className="flex items-center justify-between mt-8 mb-3">
        <h1 className="section-title" style={{ "--brick": "var(--lego-yellow)" } as React.CSSProperties}>
          Leaderboard
        </h1>
      </div>
      <div className="brick-tabs grid-cols-2 mb-4" role="tablist">
        {(["all", "week"] as Board[]).map((b) => (
          <button key={b} role="tab" aria-selected={board === b} className={`brick-tab ${board === b ? "on" : ""}`} onClick={() => setBoard(b)}>
            {b === "all" ? "All time" : "This week"}
          </button>
        ))}
      </div>

      {alone ? (
        <div className="card p-6 text-center">
          <p className="display text-[18px]">Your town is quiet</p>
          <p className="text-sm font-bold text-muted mt-1.5">Invite a friend: their house moves in next to yours and you race each other up the board.</p>
          <button className="btn-primary brick-green px-5 py-3 mt-4" onClick={shareInvite}>
            <Icon name="link" size={17} strokeWidth={2.2} />
            {copied === "link" ? "Link copied" : "Send an invite"}
          </button>
        </div>
      ) : (
        <>
          <Podium rows={podium} score={score} onOpen={(r) => !r.is_me && router.push(`/app/friend/${encodeURIComponent(r.username)}`)} />
          <div className="flex flex-col gap-2.5 mt-4 stagger">
            {rest.map((r, i) => (
              <div key={r.username} className="card px-3 py-2.5 flex items-center gap-3" style={r.is_me ? { boxShadow: "0 0 0 3px var(--lego-blue), 0 5px 0 3px var(--lego-blue-edge)" } : undefined}>
                <span className="w-7 text-center display text-[17px] text-muted flex-none">{i + 4}</span>
                <span className="relative flex-none -my-1">
                  <Minifig character={r.archetype} level={legoLevel(rankForXp(r.xp).tierIndex)} size={54} alive phase={(i * 1.7) % 5} />
                  {photoOf(r) && (
                    <span className="absolute -right-2 top-0">
                      <PlayerAvatar photo={photoOf(r)} character={r.archetype} size={18} />
                    </span>
                  )}
                </span>
                <button className="flex-1 min-w-0 text-left" onClick={() => !r.is_me && router.push(`/app/friend/${encodeURIComponent(r.username)}`)}>
                  <span className="block font-extrabold text-[15px] truncate">
                    {r.username}
                    {r.is_me ? " (you)" : ""}
                  </span>
                  <span className="block text-[12.5px] font-bold text-muted truncate">
                    Level {legoLevel(rankForXp(r.xp).tierIndex)} {levelTitle(r.archetype, rankForXp(r.xp).tierIndex)} · {r.streak_current} day streak
                  </span>
                </button>
                <span className="display text-[17px] flex-none">{score(r).toLocaleString()}</span>
                {!r.is_me && (
                  <button className="icon-tile !w-8 !h-8 !rounded-[9px] text-muted" aria-label={`Remove ${r.username}`} onClick={() => setConfirmRemove(r.username)}>
                    <Icon name="x" size={14} strokeWidth={2.2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* friends in */}
      <h2 className="section-title mt-8 mb-3" style={{ "--brick": "var(--lego-green)" } as React.CSSProperties}>
        Add friends
      </h2>
      <section className="card p-4">
        <div className="text-[13px] font-extrabold text-muted">Your friend code</div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="flex-1 display text-[26px] tracking-[0.18em]" style={{ color: "var(--lego-blue)" }}>
            {myCode ?? "......"}
          </span>
          <button className="btn-ghost brick-flat px-3.5 py-2 !text-[13px]" onClick={copyCode}>
            <Icon name="copy" size={15} strokeWidth={2.2} />
            {copied === "code" ? "Copied" : "Copy"}
          </button>
        </div>
        <button className="btn-primary brick-green w-full py-3 mt-5" onClick={shareInvite}>
          <Icon name="link" size={17} strokeWidth={2.2} />
          {copied === "link" ? "Link copied" : "Share an invite link"}
        </button>
        <div className="flex items-center gap-3 my-4">
          <span className="flex-1 h-[2px] rounded" style={{ background: "var(--line)" }} />
          <span className="hud-label">or type their code</span>
          <span className="flex-1 h-[2px] rounded" style={{ background: "var(--line)" }} />
        </div>
        <div className="flex gap-2">
          <input
            className="field flex-1 min-w-0 px-4 py-3 text-[16px] uppercase tracking-[0.2em]"
            placeholder="CODE"
            aria-label="Friend code"
            value={codeDraft}
            maxLength={8}
            onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
          />
          <button className="btn-primary px-5 py-3 !mt-0 brick-flat" disabled={busy || codeDraft.trim().length < 4} onClick={addFriend}>
            Add
          </button>
        </div>
        {error && <p className="text-sm font-bold mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
        {notice && <p className="chip chip-green mt-3">{notice}</p>}
      </section>
    </div>
  );
}

// First, second and third on brick columns: 2nd left, 1st in the middle (the
// tallest), 3rd right, each player's head on top.
function Podium({ rows, score, onOpen }: { rows: Row[]; score: (r: Row) => number; onOpen: (r: Row) => void }) {
  const order = [rows[1], rows[0], rows[2]];
  const place = [2, 1, 3];
  const height = [74, 104, 56];
  const brick = ["var(--lego-grey)", "var(--lego-yellow)", "var(--lego-orange)"];
  const edge = ["var(--lego-dark-grey)", "var(--lego-yellow-edge)", "var(--lego-orange-edge)"];
  return (
    <div className="card px-3 pt-5 pb-0 overflow-hidden">
      <div className="grid grid-cols-3 items-end gap-2">
        {order.map((r, i) =>
          r ? (
            <button key={r.username} className="flex flex-col items-center min-w-0 rise" onClick={() => onOpen(r)} style={{ animationDelay: `${i * 90}ms` }}>
              <span className="flex items-center gap-1 max-w-full">
                {photoOf(r) && <PlayerAvatar photo={photoOf(r)} character={r.archetype} size={20} />}
                <span className="font-extrabold text-[14px] truncate">{r.is_me ? "You" : r.username}</span>
              </span>
              <span className="text-[12.5px] font-extrabold text-muted">{score(r).toLocaleString()} XP</span>
              <span className="mt-1 relative z-10 -mb-2">
                <Minifig
                  character={r.archetype}
                  level={legoLevel(rankForXp(r.xp).tierIndex)}
                  size={place[i] === 1 ? 108 : 92}
                  alive
                  className={place[i] === 1 ? "mf-cheer" : undefined}
                />
              </span>
              <span
                className="podium-col w-full grid place-items-start justify-center pt-3"
                style={{ height: height[i], "--c": brick[i], "--e": edge[i] } as React.CSSProperties}
              >
                <span className="display text-[26px]" style={{ color: place[i] === 3 ? "#fff" : "var(--lego-black)" }}>
                  {place[i]}
                </span>
              </span>
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}
