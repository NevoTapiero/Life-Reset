"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import type { CharacterKey } from "@/lib/game";

type Row = {
  username: string;
  archetype: string | null;
  xp: number;
  streak_current: number;
  weekly_xp: number;
  is_me: boolean;
};

const METALS = [
  { row: "metal-row metal-gold shine", medal: "medal medal-gold", ring: "#f5c752" },
  { row: "metal-row metal-silver", medal: "medal medal-silver", ring: "#c3cede" },
  { row: "metal-row metal-bronze", medal: "medal medal-bronze", ring: "#d47a1e" },
];

export default function LeaderboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myShare, setMyShare] = useState(true);
  const [codeDraft, setCodeDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: userData }] = await Promise.all([
      supabase.rpc("get_leaderboard"),
      supabase.auth.getUser(),
    ]);
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    const uid = userData.user?.id;
    if (uid) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("friend_code, share_activity")
        .eq("id", uid)
        .single();
      setMyCode(prof?.friend_code ?? null);
      setMyShare(prof?.share_activity ?? true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addFriend() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error } = await supabase.rpc("add_friend", { p_code: codeDraft });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    const friend = data as { username?: string };
    setNotice(friend?.username ? `${friend.username} joined your board.` : "Friend added.");
    setCodeDraft("");
    load();
  }

  async function removeFriend(username: string) {
    setError(null);
    const { error } = await supabase.rpc("remove_friend", { p_username: username });
    if (error) setError(error.message);
    else load();
  }

  async function copyCode() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  if (!rows) return <div className="hud-label pulse-glow text-center py-20">Ranking your circle…</div>;

  const alone = rows.length <= 1;

  return (
    <div className="slide-in">
      <h1 className="display text-[28px]">Board</h1>
      <p className="hud-label mt-1.5">Friends only · weekly XP · resets Monday</p>

      {/* invite */}
      <div className="hud-frame p-4 mt-5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg tracking-[0.3em] flex-1" style={{ color: "var(--accent)" }}>
            {myCode ?? "……"}
          </span>
          <button className="btn-ghost px-4 py-2 !text-xs" onClick={copyCode}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <input
            className="field flex-1 px-4 py-2.5 font-mono text-sm uppercase tracking-[0.2em]"
            placeholder="FRIEND CODE"
            value={codeDraft}
            maxLength={8}
            onChange={(e) => setCodeDraft(e.target.value.toUpperCase())}
          />
          <button
            className="btn-primary px-5 py-2.5 !text-xs"
            disabled={busy || codeDraft.trim().length < 4}
            onClick={addFriend}
          >
            Add
          </button>
        </div>
        {error && <p className="text-danger text-sm mt-2.5">{error}</p>}
        {notice && <p className="text-sm mt-2.5" style={{ color: "var(--accent)" }}>{notice}</p>}
      </div>

      {!myShare && (
        <p className="hud-label text-center mt-4">Privacy is on · friends cannot see you</p>
      )}

      {alone ? (
        <div className="card p-6 mt-5 text-center">
          <div className="flex justify-center text-muted">
            <Icon name="users" size={26} />
          </div>
          <p className="text-sm text-muted mt-2.5">Trade codes with a friend and race their streak.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mt-5 stagger">
          {rows.map((r, i) => {
            const metal = i < 3 ? METALS[i] : null;
            return (
              <div
                key={`${r.username}-${i}`}
                className={`px-3.5 py-3 flex items-center gap-3 ${metal ? metal.row : "card"}`}
                style={r.is_me && !metal ? { borderColor: "rgba(255,107,0,0.6)", boxShadow: "0 0 18px rgba(255,107,0,0.14)", background: "linear-gradient(180deg, rgba(255,107,0,0.10), rgba(255,107,0,0.03)), var(--panel)" } : undefined}
              >
                {metal ? (
                  <span className={metal.medal}>{i + 1}</span>
                ) : (
                  <span className="w-[30px] flex justify-center flex-none display text-[14px] text-muted">
                    {i + 1}
                  </span>
                )}
                <Avatar
                  size={46}
                  character={(r.archetype as CharacterKey) ?? null}
                  ringColor={metal?.ring}
                />
                <button
                  className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
                  onClick={() => !r.is_me && router.push(`/app/friend/${encodeURIComponent(r.username)}`)}
                >
                  <span
                    className="display block text-[15px] truncate"
                    style={r.is_me ? { color: "var(--accent)" } : undefined}
                  >
                    {r.username}
                    {r.is_me ? " · you" : ""}
                  </span>
                  <span className="hud-label flex items-center gap-1 mt-0.5" style={{ color: "var(--accent)" }}>
                    <Icon name="flame" size={11} strokeWidth={2.2} />
                    {r.streak_current}
                  </span>
                </button>
                <span className="text-right flex-none">
                  <span className="display block text-[19px]" style={{ color: metal ? metal.ring : "var(--ink)" }}>
                    {r.weekly_xp.toLocaleString()}
                  </span>
                  <span className="hud-label">XP</span>
                </span>
                {!r.is_me && (
                  <span className="relative flex-none">
                    <button
                      className="icon-tile !w-8 !h-8 !rounded-[9px] !bg-[rgba(0,0,0,0.25)] text-muted active:scale-95 transition-transform"
                      aria-label={`Options for ${r.username}`}
                      onClick={() => setMenuFor(menuFor === r.username ? null : r.username)}
                    >
                      <Icon name="dots" size={15} />
                    </button>
                    {menuFor === r.username && (
                      <>
                        <span className="fixed inset-0 z-40" onClick={() => setMenuFor(null)} />
                        <span className="card absolute right-0 top-10 z-50 w-36 py-1.5 flex flex-col rise shadow-xl">
                          <button
                            className="px-4 py-2.5 text-left text-sm flex items-center gap-2.5 active:opacity-70"
                            onClick={() => {
                              setMenuFor(null);
                              router.push(`/app/friend/${encodeURIComponent(r.username)}`);
                            }}
                          >
                            <Icon name="user" size={14} />
                            Profile
                          </button>
                          <button
                            className="px-4 py-2.5 text-left text-sm flex items-center gap-2.5 text-danger active:opacity-70"
                            onClick={() => {
                              setMenuFor(null);
                              removeFriend(r.username);
                            }}
                          >
                            <Icon name="x" size={14} />
                            Remove
                          </button>
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
