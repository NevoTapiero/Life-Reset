import { supabase } from "./supabase";
import type { StatKey } from "./game";

// The collect tray. While you were away the connected apps kept paying into
// xp_ledger; those rows are the bubbles floating over the house when you come
// back. Tapping one is the reveal: XP flies into the bar, the matching need
// fills. The XP itself was already credited at sync time -- collecting is the
// ceremony, and the meter simply hides uncollected XP until you tap.

export type Pending = {
  id: string;
  source: string;
  ref: string;
  xp: number;
  reason: string | null;
  created_at: string;
  gold?: number; // quests drop gold too; ledger loot never does
  // set for loot dropped by a quest you just logged; ledger loot derives these from its source
  stat?: StatKey;
  icon?: string;
  label?: string;
};

export const SOURCES: Record<string, { icon: string; label: string; stat: StatKey }> = {
  google_tasks: { icon: "tasks", label: "Task done", stat: "DIS" },
  google_calendar: { icon: "calendar", label: "Calendar", stat: "FOC" },
  whoop_sleep: { icon: "moon", label: "Sleep", stat: "CON" },
  whoop_recovery: { icon: "stat-con", label: "Recovery", stat: "CON" },
  whoop_workout: { icon: "dumbbell", label: "Workout", stat: "STR" },
  health_workout: { icon: "dumbbell", label: "Workout", stat: "STR" },
  health_sleep: { icon: "moon", label: "Sleep", stat: "CON" },
  health_steps: { icon: "stat-str", label: "Steps", stat: "STR" },
};
export function sourceInfo(p: Pick<Pending, "source" | "stat" | "icon" | "label">): { icon: string; label: string; stat: StatKey } {
  const base = SOURCES[p.source] ?? { icon: "sparkle", label: "Bonus", stat: "DIS" as StatKey };
  return { icon: p.icon ?? base.icon, label: p.label ?? base.label, stat: p.stat ?? base.stat };
}

// ponytail: "collected up to" lives in localStorage, so a second device shows
// the same bubbles again. Move to a profiles column when that matters.
const KEY = "sl-collected-at";
const DAY = 86400_000;

export function collectedSince(now = Date.now()): string {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v;
  } catch {}
  return new Date(now - DAY).toISOString(); // first visit: only the last day floats up
}

export function markCollected(iso: string) {
  try {
    const prev = localStorage.getItem(KEY);
    if (!prev || prev < iso) localStorage.setItem(KEY, iso);
  } catch {}
}

// Pure: which ledger rows are still uncollected, oldest first.
export function splitPending(rows: Omit<Pending, "id">[], since: string): Pending[] {
  return rows
    .filter((r) => r.xp !== 0 && r.created_at > since)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((r) => ({ ...r, id: `${r.source}:${r.ref}` }));
}

export async function loadPending(uid: string): Promise<Pending[]> {
  const since = collectedSince();
  const { data } = await supabase
    .from("xp_ledger")
    .select("source, ref, xp, reason, created_at")
    .eq("user_id", uid)
    .gt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(24);
  return splitPending((data as Omit<Pending, "id">[]) ?? [], since);
}
