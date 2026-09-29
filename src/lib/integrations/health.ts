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
    metricsSummary?: { caloriesKcal?: number; distanceMillimeters?: number; activeZoneMinutes?: string };
  };
};

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

// Workouts that started since `sinceIso`.
export async function recentExercise(token: string, sinceIso: string, issues: ApiIssue[] = []): Promise<HealthExercise[]> {
  const p = new URLSearchParams({
    pageSize: "25",
    filter: `exercise.interval.start_time >= "${sinceIso}"`,
  });
  const body = await healthCall(`${API}/exercise/dataPoints?${p}`, token, issues);
  return (body?.dataPoints as HealthExercise[]) ?? [];
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
  const body = await healthCall(`${API}/steps/dataPoints:dailyRollUp`, token, issues, {
    method: "POST",
    body: { range: { start: civil(fromDate), end: civil(toDate) }, windowSizeDays: 1 },
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
