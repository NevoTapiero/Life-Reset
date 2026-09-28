"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

// What the connected services (Google Tasks/Calendar, WHOOP) are tracking and
// what they have paid out, so the player can see the app is actually watching
// instead of guessing. Everything here is read-only except the Sync button.

type Entry = { source: string; ref: string; xp: number; reason: string | null; created_at: string };
type AgendaEvent = { id: string; title: string; start: string | null; allDay: boolean; today: boolean };
type AgendaTask = { id: string; title: string; due: string | null };

const SOURCES: Record<string, { icon: string; label: string }> = {
  google_tasks: { icon: "tasks", label: "Task done" },
  google_calendar: { icon: "calendar", label: "Calendar" },
  whoop_sleep: { icon: "moon", label: "Sleep" },
  whoop_recovery: { icon: "stat-con", label: "Recovery" },
  whoop_workout: { icon: "dumbbell", label: "Workout" },
};

const SYNC_GAP_MS = 3 * 60 * 1000; // don't re-sync more often than this on open
const TZ = "Asia/Jerusalem";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function clock(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function dayName(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
}

function dueLabel(iso: string | null): string {
  if (!iso) return "No date";
  const due = new Date(iso);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const on = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(due);
  if (on === today) return "Due today";
  if (on < today) return "Overdue";
  return `Due ${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(due)}`;
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="display text-[18px]" style={{ color: "var(--accent)" }}>{value}</div>
      <div className="hud-label mt-1">{label}</div>
    </div>
  );
}

export default function AppActivity({ onXp }: { onXp?: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [google, setGoogle] = useState<boolean | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [tab, setTab] = useState<"tracking" | "earned">("tracking");
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

  const loadAgenda = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const r = await fetch("/api/integrations/google/agenda", {
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    });
    const d = await r.json();
    setGoogle(!!d.connected);
    if (d.connected) {
      setConnected(true);
      setEvents((d.events as AgendaEvent[]) ?? []);
      setTasks((d.tasks as AgendaTask[]) ?? []);
    }
    return !!d.connected;
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
    loadAgenda().then(async (isConnected) => {
      let last = 0;
      try {
        last = Number(localStorage.getItem("sl-last-sync") ?? 0);
      } catch {}
      if (Date.now() - last > SYNC_GAP_MS) {
        runSync(false); // this also settles whether anything is connected
      } else if (!isConnected) {
        // Google is not linked, but WHOOP might be: ask before showing an empty state
        const { data } = await supabase.auth.getSession();
        const r = await fetch("/api/integrations/whoop/status", {
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        }).then((x) => x.json()).catch(() => ({}));
        setConnected(!!r.connected);
      }
    });
  }, [loadEntries, loadAgenda, runSync]);

  async function refreshAll() {
    await Promise.all([runSync(true), loadAgenda()]);
  }

  // nothing connected yet: one line pointing at the connect screen
  if (connected === false && (entries?.length ?? 0) === 0) {
    return (
      <Link href="/app/profile" className="card px-4 py-3.5 flex items-center gap-3 mt-6 active:scale-[0.99] transition-transform">
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

  const todayEvents = events.filter((e) => e.today);
  const laterEvents = events.filter((e) => !e.today);
  const dueToday = tasks.filter((t) => dueLabel(t.due) === "Due today").length;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <h2 className="display text-[19px]">From your apps</h2>
        <button
          className="btn-ghost px-3.5 py-2 !text-[11px] gap-2 whitespace-nowrap"
          disabled={busy}
          onClick={refreshAll}
        >
          <Icon name={busy ? "sparkle" : "arrow-right"} size={13} className={busy ? "pulse-glow" : "-rotate-90"} />
          {busy ? "Syncing" : "Refresh"}
        </button>
      </div>

      <div className="hud-frame px-3 py-3.5 flex items-stretch">
        <Stat value={todayEvents.length} label="Today" />
        <span className="w-px self-stretch" style={{ background: "var(--line)" }} />
        <Stat value={tasks.length} label="Open tasks" />
        <span className="w-px self-stretch" style={{ background: "var(--line)" }} />
        <Stat value={total.toLocaleString()} label="XP earned" />
      </div>

      {flash && <p className="hud-label mt-2.5" style={{ color: "var(--accent)" }}>{flash}</p>}

      <div className="flex gap-2 mt-3.5">
        {(["tracking", "earned"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-[11px] hud-label transition-colors ${tab === t ? "" : "text-muted"}`}
            style={
              tab === t
                ? { background: "rgb(var(--accent-rgb) / 0.14)", border: "1px solid rgb(var(--accent-rgb) / 0.45)", color: "var(--accent)" }
                : { border: "1px solid var(--line)" }
            }
          >
            {t === "tracking" ? "Schedule & tasks" : "XP earned"}
          </button>
        ))}
      </div>

      {tab === "tracking" ? (
        <div className="flex flex-col gap-2 mt-3 stagger">
          {google === null && <div className="hud-label pulse-glow py-4 text-center">Reading your calendar…</div>}

          {todayEvents.length > 0 && <p className="hud-label mt-1">Today</p>}
          {todayEvents.slice(0, 6).map((e) => (
            <div key={e.id} className="card px-3.5 py-3 flex items-center gap-3">
              <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
                <Icon name="calendar" size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] truncate">{e.title}</span>
                <span className="hud-label mt-0.5 block">{e.allDay ? "All day" : clock(e.start)}</span>
              </span>
            </div>
          ))}

          {tasks.length > 0 && <p className="hud-label mt-2">Open tasks</p>}
          {tasks.slice(0, 6).map((t) => (
            <div key={t.id} className="card px-3.5 py-3 flex items-center gap-3">
              <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
                <Icon name="tasks" size={16} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] truncate">{t.title}</span>
                <span className="hud-label mt-0.5 block">{dueLabel(t.due)}</span>
              </span>
            </div>
          ))}
          {tasks.length > 6 && <p className="hud-label">and {tasks.length - 6} more</p>}

          {laterEvents.length > 0 && <p className="hud-label mt-2">Rest of the week</p>}
          {laterEvents.slice(0, 5).map((e) => (
            <div key={e.id} className="card px-3.5 py-2.5 flex items-center gap-3 opacity-80">
              <span className="icon-tile !w-8 !h-8 !rounded-[9px] text-muted">
                <Icon name="calendar" size={14} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] truncate">{e.title}</span>
                <span className="hud-label mt-0.5 block">
                  {dayName(e.start)} {e.allDay ? "" : clock(e.start)}
                </span>
              </span>
            </div>
          ))}

          {google === false && (
            <Link href="/app/profile" className="card px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform">
              <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
                <Icon name="calendar" size={16} />
              </span>
              <span className="flex-1">
                <span className="display block text-[14px]">Connect Google</span>
                <span className="hud-label mt-0.5 block">Your schedule and task list show up here</span>
              </span>
              <Icon name="arrow-right" size={16} />
            </Link>
          )}

          {google && events.length === 0 && tasks.length === 0 && (
            <div className="card p-5 text-center text-muted text-sm">
              Connected, but your calendar and task lists are empty for the week.
            </div>
          )}
          {google && (events.length > 0 || tasks.length > 0) && (
            <p className="hud-label mt-1">
              Tick a task off in Google and the Judge pays you for it on your next open
              {dueToday > 0 ? ` · ${dueToday} due today` : ""}
            </p>
          )}
        </div>
      ) : entries === null ? (
        <div className="hud-label pulse-glow py-4 text-center">Checking your apps…</div>
      ) : entries.length === 0 ? (
        <div className="card p-5 text-center text-muted text-sm mt-3">
          Nothing paid out yet. Complete a task or log a workout and it shows up here.
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-3 stagger">
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
