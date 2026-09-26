"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

type Row = {
  username: string;
  archetype: string | null;
  xp: number;
  streak_current: number;
  weekly_xp: number;
  is_me: boolean;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error }, { data: userData }] = await Promise.all([
      supabase.rpc("get_leaderboard"),
      supabase.auth.getUser(),
    ]);
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    const uid = userData.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("friend_code").eq("id", uid).single();
      setMyCode(prof?.friend_code ?? null);
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

  const myIndex = rows.findIndex((r) => r.is_me);
  const alone = rows.length <= 1;

  return (
    <div className="rise">
      <span className="eyebrow hud-label !text-ink">System · Friends board</span>
      <h1 className="display text-2xl mt-3">THIS WEEK</h1>
      <p className="text-muted text-sm mt-1.5">
        Only you and your friends. Weekly XP resets every Monday.
      </p>

      {/* invite */}
      <div className="hud-frame p-4 mt-5">
        <div className="hud-label mb-2.5" style={{ color: "var(--accent)" }}>
          Invite a friend
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg tracking-[0.3em]" style={{ color: "var(--accent)" }}>
            {myCode ?? "……"}
          </span>
          <span className="flex-1 hud-label">your code</span>
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

      {alone ? (
        <div className="card p-6 mt-5 text-center">
          <div className="flex justify-center text-muted">
            <Icon name="users" size={26} />
          </div>
          <p className="text-sm text-muted mt-2.5">
            Your board is empty. Trade codes with a friend and race their streak.
          </p>
        </div>
      ) : (
        <div className="card mt-5 divide-y divide-[var(--line)] overflow-hidden stagger">
          {rows.map((r, i) => (
            <div
              key={`${r.username}-${i}`}
              className="px-4 py-3 flex items-center gap-3"
              style={r.is_me ? { background: "rgba(255,107,0,0.07)" } : undefined}
            >
              <span className="w-8 flex justify-center flex-none">
                {i === 0 ? (
                  <Icon name="crown" size={19} className="text-accent" strokeWidth={1.8} />
                ) : (
                  <span className="hud-label font-mono">#{i + 1}</span>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span
                  className="block font-mono text-sm truncate"
                  style={r.is_me ? { color: "var(--accent)" } : undefined}
                >
                  {r.username}
                  {r.is_me ? " (you)" : ""}
                </span>
                <span className="hud-label flex items-center gap-1">
                  <Icon name="flame" size={10} strokeWidth={2} />
                  {r.streak_current} day streak
                </span>
              </span>
              <span className="text-right flex-none">
                <span className="block font-mono text-sm" style={{ color: "var(--accent)" }}>
                  {r.weekly_xp.toLocaleString()}
                </span>
                <span className="hud-label">weekly XP</span>
              </span>
              {!r.is_me && (
                <button
                  className="icon-tile !w-8 !h-8 !rounded-[9px] text-muted active:scale-95 transition-transform"
                  aria-label={`Remove ${r.username}`}
                  onClick={() => removeFriend(r.username)}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {myIndex > 0 && (
        <p className="hud-label text-center mt-4">
          Clear quests to pass {rows[myIndex - 1].username}.
        </p>
      )}
    </div>
  );
}
