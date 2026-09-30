"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BrickLoader from "@/components/BrickLoader";
import Icon from "@/components/Icon";
import PlayerAvatar from "@/components/PlayerAvatar";
import TownArt from "@/components/TownArt";
import { legoLevel, levelTitle, photoOf } from "@/lib/brick";
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
  const [knocks, setKnocks] = useState(0);
  const [codeDraft, setCodeDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: userData }, { data: visits }] = await Promise.all([
      supabase.rpc("get_leaderboard"),
      supabase.auth.getUser(),
      supabase.rpc("my_visits"),
    ]);
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    setKnocks(((visits as { knocked_by_me: boolean; allowed: boolean }[] | null) ?? []).filter((v) => !v.knocked_by_me && !v.allowed).length);
    const uid = userData.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("friend_code").eq("id", uid).single();
      setMyCode(prof?.friend_code ?? null);
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
  const residents = rows.map((r) => ({ name: r.username, level: legoLevel(rankForXp(r.xp).tierIndex), character: r.archetype, me: r.is_me }));
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
      <Link href="/app/town" className="btn-primary brick-yellow w-full py-4 mt-4 !text-[19px]">
        <Icon name="play" size={18} />
        Jump into the world
      </Link>
      {knocks > 0 && (
        <Link href="/app/town" className="card mt-4 px-4 py-3 flex items-center gap-3 active:translate-y-[2px] transition-transform">
          <span className="icon-tile !w-10 !h-10" style={{ color: "var(--lego-orange)" }}>
            <Icon name="home" size={19} strokeWidth={2} />
          </span>
          <span className="flex-1 font-extrabold text-[15px]">
            {knocks === 1 ? "Someone is knocking on your door" : `${knocks} friends are knocking on your door`}
          </span>
          <Icon name="chevron-right" size={18} strokeWidth={2.2} className="text-muted" />
        </Link>
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
                <PlayerAvatar photo={photoOf(r)} character={r.archetype} size={42} />
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
              {place[i] === 1 && (
                <span className="mb-1" style={{ color: "var(--lego-yellow-edge)" }}>
                  <Icon name="crown" size={22} strokeWidth={2.2} />
                </span>
              )}
              <PlayerAvatar photo={photoOf(r)} character={r.archetype} size={place[i] === 1 ? 64 : 52} />
              <span className="mt-2 font-extrabold text-[14px] truncate max-w-full">{r.is_me ? "You" : r.username}</span>
              <span className="text-[12.5px] font-extrabold text-muted">{score(r).toLocaleString()} XP</span>
              <span
                className="mt-2 w-full rounded-t-[12px] grid place-items-start justify-center pt-2 relative"
                style={{ height: height[i], background: brick[i], boxShadow: `inset 0 3px 0 rgb(255 255 255 / 0.4), inset 0 -4px 0 ${edge[i]}` }}
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
