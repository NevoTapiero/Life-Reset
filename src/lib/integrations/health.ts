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

// What a workout is worth: three signals weighed together, not just one.
//   heart: minutes in each heart-rate zone (a peak minute is worth nine light
//          ones), else Active Zone Minutes
//   burn:  calories, 10 kcal = 1
//   time:  minutes of activity, at a rate that depends on the kind of workout
// The weights depend on the kind, so each is judged fairly: a run is mostly
// about effort, a strength session mostly about time under load and what it
// burns (the heart rarely climbs high lifting), stretching mostly about time.
// A signal the watch didn't record is left out and the others share its weight.
// Returns a rated value on the quest scale (0 to 50).
export type WorkoutKind = "cardio" | "strength" | "flexibility" | "other";

const KIND_WORDS: [WorkoutKind, RegExp][] = [
  ["flexibility", /yoga|stretch|pilates|mobility|flexib|barre|tai ?chi/i],
  ["strength", /strength|weight|lift|crossfit|functional|bodyweight|calisthenic|resistance|core|gym/i],
  [
    "cardio",
    /run|jog|treadmill|cycl|bik|spin|swim|row|elliptical|hiit|interval|cardio|walk|hik|skat|ski|danc|box|martial|kick|tennis|padel|squash|soccer|football|basket|volley|sport|climb|stair/i,
  ],
];

export function workoutKind(w: HealthExercise): WorkoutKind {
  const text = `${w.exercise?.exerciseType ?? ""} ${w.exercise?.displayName ?? ""}`;
  for (const [kind, re] of KIND_WORDS) if (re.test(text)) return kind;
  return "other";
}

// [heart, burn, time] weights, and XP-scale points per minute of the workout
const BLEND: Record<WorkoutKind, { heart: number; burn: number; time: number; perMinute: number }> = {
  cardio: { heart: 0.5, burn: 0.3, time: 0.2, perMinute: 0.5 },
  strength: { heart: 0.2, burn: 0.35, time: 0.45, perMinute: 0.55 },
  flexibility: { heart: 0.1, burn: 0.2, time: 0.7, perMinute: 0.5 },
  other: { heart: 0.45, burn: 0.3, time: 0.25, perMinute: 0.45 },
};

export function workoutXp(w: HealthExercise): { xp: number; basis: string; kind: WorkoutKind } {
  const m = w.exercise?.metricsSummary;
  const z = m?.heartRateZoneDurations;
  const zone = {
    light: durationMinutes(z?.lightTime),
    moderate: durationMinutes(z?.moderateTime),
    vigorous: durationMinutes(z?.vigorousTime),
    peak: durationMinutes(z?.peakTime),
  };
  const kind = workoutKind(w);
  const blend = BLEND[kind];
  const minutes = exerciseMinutes(w);
  const zoneTotal = zone.light + zone.moderate + zone.vigorous + zone.peak;
  const azm = Number(m?.activeZoneMinutes ?? 0);
  const kcal = Number(m?.caloriesKcal ?? 0);

  const parts: { value: number; weight: number }[] = [];
  const said: string[] = [];
  if (zoneTotal > 0) {
    parts.push({ value: zone.light * 0.25 + zone.moderate * 0.75 + zone.vigorous * 1.5 + zone.peak * 2.25, weight: blend.heart });
    said.push(`heart zones ${zone.moderate}/${zone.vigorous}/${zone.peak} min`);
  } else if (azm > 0) {
    parts.push({ value: azm * 0.75, weight: blend.heart });
    said.push(`${azm} active zone min`);
  }
  if (kcal > 0) {
    parts.push({ value: kcal / 10, weight: blend.burn });
    said.push(`${Math.round(kcal)} kcal`);
  }
  parts.push({ value: minutes * blend.perMinute, weight: blend.time });

  const weight = parts.reduce((a, p) => a + p.weight, 0);
  const score = parts.reduce((a, p) => a + p.value * p.weight, 0) / (weight || 1);
  const xp = Math.max(0, Math.min(50, Math.round(score)));
  return { xp, kind, basis: [kind, ...said].join(", ") };
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
