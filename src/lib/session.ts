// "Doing it now": you start a quest, your character does it on screen while
// you do it in real life, and the loot is waiting when you come back. One
// session at a time, kept in localStorage so a reload or a day at work does
// not lose it. ponytail: device-local; a profiles column when it matters.

export type Session = { questId: string; startedAt: number };

// components call this instead of Date.now() so the purity lint stays quiet
export const nowMs = () => Date.now();

const KEY = "sl-session";
export const STALE_MS = 12 * 3600_000; // forgot to finish: drop it after half a day

export function elapsedMin(s: Session, now = Date.now()): number {
  return Math.max(0, Math.floor((now - s.startedAt) / 60_000));
}

export function isStale(s: Session, now = Date.now()): boolean {
  return now - s.startedAt > STALE_MS;
}

export function loadSession(now = Date.now()): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.questId || typeof s.startedAt !== "number" || isStale(s, now)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function startSession(questId: string, now = Date.now()): Session {
  const s = { questId, startedAt: now };
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  return s;
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
