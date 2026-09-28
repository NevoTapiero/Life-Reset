"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

// Everything the connected services (Google Tasks/Calendar, WHOOP) have counted
// toward XP, so the tracking is visible instead of happening silently.

type Entry = { source: string; ref: string; xp: number; reason: string | null; created_at: string };

const SOURCES: Record<string, { icon: string; label: string }> = {
  google_tasks: { icon: "tasks", label: "Task done" },
  google_calendar: { icon: "calendar", label: "Calendar" },
  whoop_sleep: { icon: "moon", label: "Sleep" },
  whoop_recovery: { icon: "stat-con", label: "Recovery" },
  whoop_workout: { icon: "dumbbell", label: "Workout" },
};

const SYNC_GAP_MS = 3 * 60 * 1000; // don't re-sync more often than this on open

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export default function AppActivity({ onXp }: { onXp?: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const [{ data: recent }, { data: all }] = await Promise.all([
      supabase
        .from("xp_ledger")
        .select("source, ref, xp, reason, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("xp_ledger").select("xp").eq("user_id", uid),
    ]);
    setEntries((recent as Entry[]) ?? []);
    setTotal(((all as { xp: number }[]) ?? []).reduce((s, r) => s + (r.xp ?? 0), 0));
  }, []);

  const runSync = useCallback(
    async (manual: boolean) => {
      setBusy(true);
      if (manual) setFlash(null);
      try {
        const { data } = await supabase.auth.getSession();
        const r = await fetch("/api/integrations/sync-all", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        });
        const d = await r.json();
        setConnected(!!d.connectedAny);
        try {
          localStorage.setItem("sl-last-sync", String(Date.now()));
        } catch {}
        if (d.xpGained > 0) {
          setFlash(`+${d.xpGained} XP from ${d.newItems} new item${d.newItems === 1 ? "" : "s"}`);
          onXp?.();
        } else if (manual) {
          setFlash(d.connectedAny ? "Up to date" : null);
        }
        await loadEntries();
      } catch {
        if (manual) setFlash("Sync failed, try again");
      }
      setBusy(false);
    },
    [loadEntries, onXp],
  );

  useEffect(() => {
    loadEntries();
    let last = 0;
    try {
      last = Number(localStorage.getItem("sl-last-sync") ?? 0);
    } catch {}
    if (Date.now() - last > SYNC_GAP_MS) runSync(false);
    else {
      // still need to know whether anything is connected, for the empty state
      (async () => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const [g, w] = await Promise.all([
          fetch("/api/integrations/google/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({})),
          fetch("/api/integrations/whoop/status", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => ({})),
        ]);
        setConnected(!!g.connected || !!w.connected);
      })();
    }
  }, [loadEntries, runSync]);

  // nothing connected yet: one line pointing at the connect screen
  if (connected === false && (entries?.length ?? 0) === 0) {
    return (
      <Link href="/app/profile" className="card px-4 py-3.5 flex items-center gap-3 mt-5 active:scale-[0.99] transition-transform">
        <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
          <Icon name="sparkle" size={16} />
        </span>
        <span className="flex-1">
          <span className="display block text-[14px]">Connect your apps</span>
          <span className="hud-label mt-0.5 block">Google Tasks, Calendar and WHOOP earn XP too</span>
        </span>
        <Icon name="arrow-right" size={16} />
      </Link>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="display text-[17px]">From your apps</h2>
        <div className="flex items-center gap-2.5 flex-none">
          <span className="flex items-baseline gap-1">
            <span className="display text-[16px]" style={{ color: "var(--accent)" }}>{total.toLocaleString()}</span>
            <span className="hud-label">XP</span>
          </span>
          <button
            className="icon-tile !w-8 !h-8 !rounded-[9px] text-muted active:scale-95 transition-transform"
            aria-label="Sync connected apps"
            disabled={busy}
            onClick={() => runSync(true)}
          >
            <Icon name={busy ? "sparkle" : "arrow-right"} size={14} className={busy ? "pulse-glow" : "-rotate-90"} />
          </button>
        </div>
      </div>

      {flash && (
        <p className="hud-label mb-2.5" style={{ color: "var(--accent)" }}>{flash}</p>
      )}

      {entries === null ? (
        <div className="hud-label pulse-glow py-4 text-center">Checking your apps…</div>
      ) : entries.length === 0 ? (
        <div className="card p-5 text-center text-muted text-sm">
          Connected. Complete a task or log a workout and it shows up here.
        </div>
      ) : (
        <div className="flex flex-col gap-2 stagger">
          {entries.map((e) => {
            const meta = SOURCES[e.source] ?? { icon: "sparkle", label: "Activity" };
            return (
              <div key={`${e.source}-${e.ref}`} className="card px-3.5 py-3 flex items-center gap-3">
                <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
                  <Icon name={meta.icon} size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] truncate">{e.reason || meta.label}</span>
                  <span className="hud-label mt-0.5 block">{meta.label} · {ago(e.created_at)}</span>
                </span>
                <span className="flex items-baseline gap-1 flex-none">
                  <span className="display text-[15px]" style={{ color: "var(--accent)" }}>+{e.xp}</span>
                  <span className="hud-label">XP</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
