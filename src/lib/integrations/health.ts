import { ApiIssue } from "./google";

// Google Health API (the successor to the Fitbit Web API): workouts, sleep and
// daily steps from the Google Health app, Fitbit devices and Pixel Watch.
// Read-only, same OAuth client as Tasks/Calendar, stored as provider "ghealth".

const API = "https://health.googleapis.com/v4/users/me/dataTypes";

type Interval = { startTime?: string; endTime?: string };

export type HealthExercise = {
  name: string;
  exercise?: {
    interval?: Interval;
    exerciseType?: string;
    displayName?: string;
    activeDuration?: string; // e.g. "2710s"
    metricsSummary?: {
      caloriesKcal?: number;
      distanceMillimeters?: number;
      activeZoneMinutes?: string; // int64 as string
      averageHeartRateBeatsPerMinute?: string; // int64 as string
      heartRateZoneDurations?: { lightTime?: string; moderateTime?: string; vigorousTime?: string; peakTime?: string };
    };
  };
};

// How hard a workout was, from the richest signal the watch recorded:
// minutes in each heart-rate zone, else Active Zone Minutes, else calories,
// else plain duration. Returns a rated value on the quest scale (1 to 50)
// and how it was measured, so a hard 30-minute run outscores a relaxed hour in
// the gym. A peak-zone minute is worth nine light ones.
export function workoutXp(w: HealthExercise): { xp: number; basis: string } {
  const m = w.exercise?.metricsSummary;
  const z = m?.heartRateZoneDurations;
  const zone = {
    light: durationMinutes(z?.lightTime),
    moderate: durationMinutes(z?.moderateTime),
    vigorous: durationMinutes(z?.vigorousTime),
    peak: durationMinutes(z?.peakTime),
  };
  const cap = (x: number) => Math.max(0, Math.min(50, Math.round(x))); // the quest scale (1-50)
  if (zone.light + zone.moderate + zone.vigorous + zone.peak > 0) {
    const xp = zone.light * 0.25 + zone.moderate * 0.75 + zone.vigorous * 1.5 + zone.peak * 2.25;
    return { xp: cap(xp), basis: `heart zones ${zone.moderate}/${zone.vigorous}/${zone.peak} min` };
  }
  const azm = Number(m?.activeZoneMinutes ?? 0);
  if (azm > 0) return { xp: cap(azm * 0.75), basis: `${azm} active zone min` };
  const kcal = Number(m?.caloriesKcal ?? 0);
  if (kcal > 0) return { xp: cap(kcal / 10), basis: `${Math.round(kcal)} kcal` };
  return { xp: cap(exerciseMinutes(w) * 0.4), basis: "duration only" };
}

export type HealthSleep = {
  name: string;
  sleep?: {
    interval?: Interval;
    summary?: { minutesAsleep?: string; minutesAwake?: string; minutesInSleepPeriod?: string };
  };
};

export type DailySteps = { date: string; steps: number };

async function healthCall(
  url: string,
  token: string,
  issues: ApiIssue[],
  init: { method?: string; body?: unknown } = {},
): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(9000),
    });
    if (r.ok) return await r.json();
    let message = `HTTP ${r.status}`;
    try {
      const b = await r.json();
      message = b?.error?.message ?? message;
    } catch {
      // status-only message
    }
    issues.push({ api: "Google Health", status: r.status, message: String(message).slice(0, 300) });
    return null;
  } catch (e) {
    issues.push({ api: "Google Health", status: 0, message: e instanceof Error ? e.message : "request failed" });
    return null;
  }
}

// Workouts that started since `sinceIso`. Exercise only accepts a civil-date
// filter (start_time is rejected), so filter by day at Google and trim to the
// exact instant here.
export async function recentExercise(token: string, sinceIso: string, issues: ApiIssue[] = []): Promise<HealthExercise[]> {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(sinceIso));
  const p = new URLSearchParams({
    pageSize: "25",
    filter: `exercise.interval.civil_start_time >= "${day}"`,
  });
  const body = await healthCall(`${API}/exercise/dataPoints?${p}`, token, issues);
  const since = new Date(sinceIso).getTime();
  return ((body?.dataPoints as HealthExercise[]) ?? []).filter((w) => {
    const at = new Date(w.exercise?.interval?.startTime ?? 0).getTime();
    return at >= since;
  });
}

// Active minutes, falling back to the session length when Google omits it.
export function exerciseMinutes(w: HealthExercise): number {
  const active = durationMinutes(w.exercise?.activeDuration);
  if (active > 0) return active;
  const i = w.exercise?.interval;
  if (!i?.startTime || !i.endTime) return 0;
  return Math.max(0, Math.round((new Date(i.endTime).getTime() - new Date(i.startTime).getTime()) / 60000));
}

// Sleep sessions that ended since `sinceIso`.
export async function recentSleep(token: string, sinceIso: string, issues: ApiIssue[] = []): Promise<HealthSleep[]> {
  const p = new URLSearchParams({
    pageSize: "25",
    filter: `sleep.interval.end_time >= "${sinceIso}"`,
  });
  const body = await healthCall(`${API}/sleep/dataPoints?${p}`, token, issues);
  return (body?.dataPoints as HealthSleep[]) ?? [];
}

type Civil = { year: number; month: number; day: number };
const civil = (d: string): Civil => {
  const [year, month, day] = d.split("-").map(Number);
  return { year, month, day };
};

// Step totals per day for [fromDate, toDate), dates as YYYY-MM-DD.
export async function dailySteps(token: string, fromDate: string, toDate: string, issues: ApiIssue[] = []): Promise<DailySteps[]> {
  // CivilDateTime nests the calendar date under `date`
  const body = await healthCall(`${API}/steps/dataPoints:dailyRollUp`, token, issues, {
    method: "POST",
    body: { range: { start: { date: civil(fromDate) }, end: { date: civil(toDate) } }, windowSizeDays: 1 },
  });
  const points =
    (body?.rollupDataPoints as {
      civilStartTime?: { date?: Civil } & Partial<Civil>;
      value?: { steps?: { countSum?: string | number } };
      steps?: { countSum?: string | number };
    }[]) ?? [];
  const out: DailySteps[] = [];
  for (const pt of points) {
    // the civil time may be nested under .date or flat; accept both shapes
    const c = pt.civilStartTime?.date ?? pt.civilStartTime;
    if (!c?.year || !c.month || !c.day) continue;
    const steps = Number(pt.value?.steps?.countSum ?? pt.steps?.countSum ?? 0);
    const date = `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
    out.push({ date, steps: Number.isFinite(steps) ? steps : 0 });
  }
  return out;
}

export function durationMinutes(d: string | undefined): number {
  const s = Number((d ?? "").replace(/s$/, ""));
  return Number.isFinite(s) ? Math.round(s / 60) : 0;
}

// Last path segment of a resource name, used as the stable id for XP awards.
export function pointId(name: string): string {
  return name.split("/").pop() ?? name;
}
