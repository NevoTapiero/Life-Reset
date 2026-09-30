"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon, { GoogleHealthMark, GoogleMark, WhoopMark } from "@/components/Icon";

// What the connected services (Google Tasks/Calendar, Google Health, WHOOP)
// are tracking and what they have paid, one tab per connection. Tasks and
// meetings can be checked and unchecked here; nothing on the calendar pays
// until the player says it happened.
//
// Everything shows today, with yesterday folded into a dropdown; older items
// drop off. Finished tasks are read from the app's own ledger, not from Google,
// so deleting one in Google never removes it (or its XP) here.

type Entry = {
  source: string;
  ref: string;
  xp: number;
  reason: string | null;
  created_at: string;
  meta: { listId?: string | null; calendarId?: string | null } | null;
};
type AgendaEvent = {
  id: string;
  calendarId: string;
  title: string;
  start: string | null;
  allDay: boolean;
  today: boolean;
  started: boolean;
  done: boolean;
};
type AgendaTask = { id: string; listId: string; title: string; due: string | null };
type Provider = "google" | "ghealth" | "whoop";
type Tab = Provider | "earned";

const SOURCES: Record<string, { icon: string; label: string }> = {
  google_tasks: { icon: "tasks", label: "Task done" },
  google_calendar: { icon: "calendar", label: "Meeting" },
  whoop_sleep: { icon: "moon", label: "Sleep" },
  whoop_recovery: { icon: "stat-con", label: "Recovery" },
  whoop_workout: { icon: "dumbbell", label: "Workout" },
  health_workout: { icon: "dumbbell", label: "Workout" },
  health_sleep: { icon: "moon", label: "Sleep" },
  health_steps: { icon: "stat-str", label: "Steps" },
  streak_bonus: { icon: "flame", label: "Streak bonus" },
  legacy: { icon: "trophy", label: "Earlier quests" },
};

const TABS: { key: Tab; label: string; mark?: React.ReactNode }[] = [
  { key: "google", label: "Google", mark: <GoogleMark size={14} /> },
  { key: "ghealth", label: "Health", mark: <GoogleHealthMark size={15} /> },
  { key: "whoop", label: "WHOOP", mark: <WhoopMark size={15} /> },
  { key: "earned", label: "XP earned" },
];

const SYNC_GAP_MS = 60 * 1000; // coming back to the app within a minute doesn't re-sync
const TZ = "Asia/Jerusalem";

const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

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
  const today = dayOf(new Date());
  const on = dayOf(due);
  if (on === today) return "Due today";
  if (on < today) return "Overdue";
  return `Due ${new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(due)}`;
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="display text-[22px]" style={{ color: "var(--lego-blue)" }}>{value}</div>
      <div className="hud-label mt-1">{label}</div>
    </div>
  );
}

// The round check button used for tasks and meetings; tapping a checked one
// unchecks it.
function DoneButton({
  done,
  busy,
  disabled,
  onClick,
  label,
}: {
  done: boolean;
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      disabled={busy || (!done && disabled)}
      onClick={onClick}
      className={`stud-check !w-[34px] !h-[34px] active:scale-95 ${done ? "on check-pop" : ""} ${busy ? "pulse-glow" : ""}`}
      style={!done && disabled ? { opacity: 0.4 } : undefined}
    >
      <Icon name="check" size={16} strokeWidth={3} />
    </button>
  );
}

function Row({
  icon,
  title,
  sub,
  done,
  right,
  dim,
}: {
  icon: string;
  title: string;
  sub: string;
  done?: boolean;
  right?: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <div
      className={`card px-3.5 py-3 flex items-center gap-3 ${dim ? "opacity-80" : ""}`}
    >
      <span className="icon-tile !w-10 !h-10 !rounded-[11px]" style={{ color: done ? "var(--lego-green)" : "var(--lego-blue)" }}>
        <Icon name={icon} size={18} strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-extrabold truncate ${done ? "line-through text-muted" : ""}`}>{title}</span>
        <span className="text-[12.5px] font-bold text-muted mt-0.5 block truncate">{sub}</span>
      </span>
      {right}
    </div>
  );
}

function XpTag({ xp }: { xp: number }) {
  return (
    <span className="flex items-baseline gap-1 flex-none">
      <span className="chip chip-green !text-[12px]">+{xp} XP</span>
    </span>
  );
}

// Yesterday's items, folded away like the quest list's Yesterday drawer.
function YesterdayDrawer({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <div className="mt-1.5">
      <button
        className="card w-full px-4 py-3 flex items-center gap-3 active:translate-y-[2px] transition-transform"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
          <Icon name="calendar" size={16} strokeWidth={2} />
        </span>
        <span className="flex-1 text-left">
          <span className="display block text-[15px]">Yesterday</span>
          <span className="text-[12.5px] font-bold text-muted">{count} item{count === 1 ? "" : "s"}</span>
        </span>
        <span className="text-muted transition-transform duration-300" style={{ transform: open ? "rotate(180deg)" : "none" }}>
          <Icon name="chevron-down" size={17} strokeWidth={2.2} />
        </span>
      </button>
      {open && <div className="flex flex-col gap-2 mt-2 stagger">{children}</div>}
    </div>
  );
}

export default function AppActivity({ onXp }: { onXp?: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [providers, setProviders] = useState<Record<Provider, boolean> | null>(null);
  const [google, setGoogle] = useState<boolean | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(true);
  const [tab, setTab] = useState<Tab | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const lastSync = useRef(0);

  const bearer = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }, []);

  // today and yesterday only: anything older has dropped off the lists
  const loadEntries = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    const [{ data: recent }, { data: all }] = await Promise.all([
      supabase
        .from("xp_ledger")
        .select("source, ref, xp, reason, created_at, meta")
        .eq("user_id", uid)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("xp_ledger").select("xp").eq("user_id", uid),
    ]);
    setEntries((recent as Entry[]) ?? []);
    setTotal(((all as { xp: number }[]) ?? []).reduce((s, r) => s + (r.xp ?? 0), 0));
  }, []);

  const loadProviders = useCallback(async () => {
    const headers = await bearer();
    const [g, h, w] = await Promise.all(
      (["google", "ghealth", "whoop"] as const).map((p) =>
        fetch(`/api/integrations/${p}/status`, { headers }).then((r) => r.json()).catch(() => ({})),
      ),
    );
    setProviders({ google: !!g.connected, ghealth: !!h.connected, whoop: !!w.connected });
  }, [bearer]);

  const loadAgenda = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/google/agenda", { headers: await bearer() });
      const d = await r.json();
      setGoogle(!!d.connected);
      setProblem(typeof d.problem === "string" ? d.problem : null);
      if (d.connected) {
        setCanWrite(d.canWrite !== false);
        setEvents((d.events as AgendaEvent[]) ?? []);
        setTasks((d.tasks as AgendaTask[]) ?? []);
        if (d.revoked > 0) {
          // a task was unchecked in Google itself since the last visit
          setFlash(`-${d.revoked} XP · a task was unchecked in Google`);
          onXp?.();
          loadEntries();
        }
      }
    } catch {
      // never leave the section stuck on its loading line
      setGoogle(false);
      setProblem("Could not reach your calendar.");
    }
  }, [bearer, loadEntries, onXp]);

  const runSync = useCallback(async () => {
    lastSync.current = Date.now();
    setSyncing(true);
    try {
      const r = await fetch("/api/integrations/sync-all", { method: "POST", headers: await bearer() });
      const d = await r.json();
      // tabs follow what is connected, even when a token needs renewing
      await loadProviders();
      if (d.xpGained > 0) {
        setFlash(`+${d.xpGained} XP from ${d.newItems} new item${d.newItems === 1 ? "" : "s"}`);
        onXp?.();
        await Promise.all([loadEntries(), loadAgenda()]);
      }
    } catch {
      // a failed background sync is retried on the next open
    }
    setSyncing(false);
  }, [bearer, loadEntries, loadAgenda, loadProviders, onXp]);

  // Refresh on open, and again every time the app comes back to the front: no
  // refresh button to remember.
  const refresh = useCallback(() => {
    loadEntries();
    loadAgenda();
    if (Date.now() - lastSync.current > SYNC_GAP_MS) runSync();
    else loadProviders();
  }, [loadEntries, loadAgenda, runSync, loadProviders]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then sets state
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  // Check or uncheck. Checking: the server confirms it with Google, the Judge
  // prices it, then XP is granted. Unchecking: the task is reopened in Google
  // and the XP is taken back.
  async function toggle(item: {
    kind: "task" | "event";
    id: string;
    listId?: string | null;
    calendarId?: string | null;
    undo: boolean;
  }) {
    const key = `${item.kind}:${item.id}`;
    if (marking) return;
    setMarking(key);
    setFlash(null);
    try {
      const r = await fetch("/api/integrations/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await bearer()) },
        body: JSON.stringify(
          item.kind === "task"
            ? { kind: "task", taskId: item.id, listId: item.listId ?? undefined, undo: item.undo }
            : { kind: "event", eventId: item.id, calendarId: item.calendarId ?? undefined, undo: item.undo },
        ),
      });
      const d = await r.json();
      if (!r.ok) {
        setFlash(d.error ?? (item.undo ? "Could not uncheck it" : "Could not mark it done"));
        if (d.reconnect) setCanWrite(false);
      } else {
        if (item.kind === "task" && !item.undo) setTasks((prev) => prev.filter((t) => t.id !== item.id));
        if (item.kind === "event") setEvents((prev) => prev.map((e) => (e.id === item.id ? { ...e, done: !item.undo } : e)));
        if (item.undo) setFlash(d.revoked > 0 ? `-${d.revoked} XP` : "Unchecked");
        else if (d.paid && d.xp > 0) setFlash(`+${d.xp} XP${d.reason ? ` · ${d.reason}` : ""}`);
        else setFlash("Already counted");
        onXp?.();
        await loadEntries();
        if (item.kind === "task" && item.undo) await loadAgenda(); // it is open again
      }
    } catch {
      setFlash("Could not update it, try again");
    }
    setMarking(null);
  }

  const connectedTabs = TABS.filter((t) => t.key === "earned" || providers?.[t.key as Provider]);
  const current: Tab | null = tab && connectedTabs.some((t) => t.key === tab) ? tab : connectedTabs[0]?.key ?? null;
  const anyConnected = !!providers && (providers.google || providers.ghealth || providers.whoop);

  // nothing connected yet: one line pointing at the connect screen
  if (providers && !anyConnected && (entries?.length ?? 0) === 0) {
    return (
      <Link href="/app/profile#apps" className="card px-4 py-3.5 flex items-center gap-3 mt-6 active:translate-y-[2px] transition-transform">
        <span className="icon-tile !w-11 !h-11" style={{ color: "var(--lego-blue)" }}>
          <Icon name="plug" size={20} strokeWidth={2} />
        </span>
        <span className="flex-1">
          <span className="display block text-[16px]">Connect your apps</span>
          <span className="text-[13px] font-bold text-muted block">Google Tasks, Calendar, Google Health and WHOOP pay XP on their own</span>
        </span>
        <Icon name="chevron-right" size={18} strokeWidth={2.2} className="text-muted" />
      </Link>
    );
  }

  const today = dayOf(new Date());
  const yesterday = dayOf(new Date(new Date().getTime() - 86400_000));
  const all = entries ?? [];
  const todays = all.filter((e) => dayOf(new Date(e.created_at)) === today);
  const yesterdays = all.filter((e) => dayOf(new Date(e.created_at)) === yesterday);
  const xpToday = todays.reduce((s, e) => s + e.xp, 0);

  const todayEvents = events.filter((e) => e.today);
  const laterEvents = events.filter((e) => !e.today);
  const doneTasksToday = todays.filter((e) => e.source === "google_tasks");
  const openDueToday = tasks.filter((t) => dueLabel(t.due) === "Due today").length;

  // a paid task or meeting, as a checked row that can be unchecked
  const paidRow = (e: Entry) => {
    const isTask = e.source === "google_tasks";
    const id = e.ref.replace(/^(task|event):/, "");
    const meta = SOURCES[e.source] ?? { icon: "sparkle", label: "Activity" };
    return (
      <Row
        key={`${e.source}-${e.ref}`}
        icon={meta.icon}
        title={e.reason || meta.label}
        sub={`Done · +${e.xp} XP`}
        done
        right={
          <DoneButton
            label={`Uncheck ${e.reason ?? ""}`}
            done
            busy={marking === `${isTask ? "task" : "event"}:${id}`}
            onClick={() =>
              toggle({
                kind: isTask ? "task" : "event",
                id,
                listId: e.meta?.listId,
                calendarId: e.meta?.calendarId,
                undo: true,
              })
            }
          />
        }
      />
    );
  };

  // a recorded item (health, WHOOP, or the full XP list)
  const ledgerRow = (e: Entry) => {
    const meta = SOURCES[e.source] ?? { icon: "sparkle", label: "Activity" };
    return (
      <Row
        key={`${e.source}-${e.ref}`}
        icon={meta.icon}
        title={e.reason || meta.label}
        sub={`${meta.label} · ${ago(e.created_at)}`}
        right={<XpTag xp={e.xp} />}
      />
    );
  };

  const ledgerTab = (match: (s: string) => boolean, emptyText: string) => {
    const t = todays.filter((e) => match(e.source));
    const y = yesterdays.filter((e) => match(e.source));
    return (
      <>
        {entries === null && <div className="hud-label pulse-glow py-4 text-center">Checking your apps…</div>}
        {entries !== null && t.length === 0 && <div className="card p-5 text-center text-muted text-sm">{emptyText}</div>}
        {t.map(ledgerRow)}
        <YesterdayDrawer count={y.length}>{y.map(ledgerRow)}</YesterdayDrawer>
      </>
    );
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <h2 className="section-title" style={{ "--brick": "var(--lego-blue)" } as React.CSSProperties}>From your apps</h2>
        {syncing && <span className="hud-label pulse-glow">Syncing</span>}
      </div>

      <div className="card px-3 py-3.5 flex items-stretch">
        {providers?.google ? (
          <>
            <Stat value={todayEvents.length + openDueToday + doneTasksToday.length} label="Today" />
            <span className="w-px self-stretch" style={{ background: "var(--line)" }} />
            <Stat value={tasks.length} label="Open tasks" />
          </>
        ) : (
          <Stat value={xpToday} label="XP today" />
        )}
        <span className="w-px self-stretch" style={{ background: "var(--line)" }} />
        <Stat value={total.toLocaleString()} label="XP earned" />
      </div>

      {flash && <p className="chip chip-green mt-2.5">{flash}</p>}

      <div className="brick-tabs !flex mt-3.5 overflow-x-auto no-scrollbar">
        {connectedTabs.map((t) => {
          const on = current === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`brick-tab flex-1 min-w-max !px-2.5 ${connectedTabs.length > 3 ? "!text-[11.5px]" : ""} whitespace-nowrap ${on ? "on" : ""}`}
            >
              {t.mark && <span className="flex-none flex">{t.mark}</span>}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 mt-3 stagger">
        {current === "google" && (
          <>
            {google === null && <div className="hud-label pulse-glow py-4 text-center">Reading your calendar…</div>}

            {problem && (
              <div className="card px-3.5 py-3 flex items-start gap-3" style={{ borderColor: "var(--danger)" }}>
                <span className="icon-tile !w-9 !h-9 !rounded-[10px]" style={{ color: "var(--danger)" }}>
                  <Icon name="x" size={16} />
                </span>
                <span className="flex-1 text-[13px] leading-snug">{problem}</span>
              </div>
            )}

            {todayEvents.length > 0 && <p className="hud-label mt-1">Today</p>}
            {todayEvents.slice(0, 6).map((e) => (
              <Row
                key={e.id}
                icon="calendar"
                title={e.title}
                sub={`${e.allDay ? "All day" : clock(e.start)}${e.done ? " · Done" : e.started ? "" : " · Not yet"}`}
                done={e.done}
                right={
                  <DoneButton
                    label={e.done ? `Uncheck ${e.title}` : `Mark ${e.title} done`}
                    done={e.done}
                    busy={marking === `event:${e.id}`}
                    disabled={!e.started}
                    onClick={() => toggle({ kind: "event", id: e.id, calendarId: e.calendarId, undo: e.done })}
                  />
                }
              />
            ))}

            {(tasks.length > 0 || doneTasksToday.length > 0) && <p className="hud-label mt-2">Tasks</p>}
            {!canWrite && tasks.length > 0 && (
              <Link href="/app/profile#apps" className="hud-label underline underline-offset-4" style={{ color: "var(--accent)" }}>
                Reconnect Google once to tick tasks from here
              </Link>
            )}
            {tasks.slice(0, 10).map((t) => (
              <Row
                key={t.id}
                icon="tasks"
                title={t.title}
                sub={dueLabel(t.due)}
                right={
                  <DoneButton
                    label={`Mark ${t.title} done`}
                    done={false}
                    busy={marking === `task:${t.id}`}
                    disabled={!canWrite}
                    onClick={() => toggle({ kind: "task", id: t.id, listId: t.listId, undo: false })}
                  />
                }
              />
            ))}
            {tasks.length > 10 && <p className="hud-label">and {tasks.length - 10} more</p>}
            {doneTasksToday.map(paidRow)}

            {laterEvents.length > 0 && <p className="hud-label mt-2">Rest of the week</p>}
            {laterEvents.slice(0, 5).map((e) => (
              <Row key={e.id} icon="calendar" title={e.title} sub={`${dayName(e.start)} ${e.allDay ? "" : clock(e.start)}`} dim />
            ))}

            <YesterdayDrawer count={yesterdays.filter((e) => e.source.startsWith("google_")).length}>
              {yesterdays.filter((e) => e.source.startsWith("google_")).map(paidRow)}
            </YesterdayDrawer>

            {google === false && !problem && (
              <Link href="/app/profile#apps" className="card px-4 py-3.5 flex items-center gap-3 active:translate-y-[2px] transition-transform">
                <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
                  <Icon name="calendar" size={16} />
                </span>
                <span className="flex-1">
                  <span className="display block text-[14px]">Reconnect Google</span>
                  <span className="hud-label mt-0.5 block">Your schedule and task list show up here</span>
                </span>
                <Icon name="arrow-right" size={16} />
              </Link>
            )}

            {google && events.length === 0 && tasks.length === 0 && doneTasksToday.length === 0 && (
              <div className="card p-5 text-center text-muted text-sm">Your calendar and task lists are empty for the week.</div>
            )}
          </>
        )}

        {current === "ghealth" &&
          ledgerTab((s) => s.startsWith("health_"), "Nothing recorded yet today. Workouts, sleep and finished days of steps show up here.")}

        {current === "whoop" &&
          ledgerTab((s) => s.startsWith("whoop_"), "Nothing recorded yet today. Sleep, recovery and workouts show up here.")}

        {current === "earned" && ledgerTab(() => true, "Nothing paid out yet today.")}
      </div>
    </div>
  );
}
