import { supabase } from "./supabase";
import { rankForXp, type CharacterKey } from "./game";
import { actionFor } from "./needs";

// The town: everyone in your circle as a house on one map. Pure layout and
// pathfinding live here so they can be tested without Phaser.

export type TownRow = {
  username: string;
  archetype: CharacterKey | null;
  xp: number;
  streak_current: number;
  is_me: boolean;
  today_xp: number | null; // null until get_town exists on the server (falls back to the board)
  weekly_xp: number | null;
  last_quest: { id: string; title: string; pillar: string } | null;
  last_done_at: string | null;
};

export async function loadTown(): Promise<TownRow[]> {
  const { data, error } = await supabase.rpc("get_town");
  if (!error && Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map((r) => ({
      username: String(r.username),
      archetype: (r.archetype as CharacterKey) ?? null,
      xp: Number(r.xp ?? 0),
      streak_current: Number(r.streak_current ?? 0),
      is_me: !!r.is_me,
      today_xp: Number(r.today_xp ?? 0),
      weekly_xp: null,
      last_quest: r.last_quest_id ? { id: String(r.last_quest_id), title: String(r.last_quest_title), pillar: String(r.last_quest_pillar) } : null,
      last_done_at: (r.last_done_at as string) ?? null,
    }));
  }
  // ponytail: the migration is not applied yet -- the board still knows the people
  const { data: board } = await supabase.rpc("get_leaderboard");
  return ((board as Record<string, unknown>[]) ?? []).map((r) => ({
    username: String(r.username),
    archetype: (r.archetype as CharacterKey) ?? null,
    xp: Number(r.xp ?? 0),
    streak_current: Number(r.streak_current ?? 0),
    is_me: !!r.is_me,
    today_xp: null,
    weekly_xp: Number(r.weekly_xp ?? 0),
    last_quest: null,
    last_done_at: null,
  }));
}

// One sentence the street can see. Never the quest list.
export function statusFor(row: Pick<TownRow, "last_quest" | "last_done_at">, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(now));
  if (row.last_quest && row.last_done_at) {
    const ageMin = (now.getTime() - new Date(row.last_done_at).getTime()) / 60_000;
    const a = actionFor({ id: row.last_quest.id, title: row.last_quest.title, pillar: row.last_quest.pillar as never });
    if (ageMin < 90) return a.label;
    return `Was ${a.label.toLowerCase()} earlier`;
  }
  if (hour >= 23 || hour < 6) return "Asleep";
  return "At home";
}

// How grand the house looks: 0 small, 1 proper, 2 castle
export function houseTier(xp: number): 0 | 1 | 2 {
  const t = rankForXp(xp).tierIndex;
  return t >= 4 ? 2 : t >= 2 ? 1 : 0;
}

// ---- layout ----
export const TOWN_W = 26;
export const TOWN_H = 22;

export type Plot = { x: number; y: number }; // top-left of the house footprint
export type HouseSpec = { tier: 0 | 1 | 2; w: number; h: number; door: number }; // door = column offset of the doorstep
export const HOUSE_SPEC: Record<0 | 1 | 2, HouseSpec> = {
  0: { tier: 0, w: 3, h: 2, door: 1 },
  1: { tier: 1, w: 3, h: 3, door: 1 },
  2: { tier: 2, w: 4, h: 3, door: 1 },
};

// Plots on a loose grid around the main street; yours is first, in the middle.
export const PLOTS: Plot[] = [
  { x: 11, y: 3 },
  { x: 3, y: 3 },
  { x: 19, y: 3 },
  { x: 3, y: 10 },
  { x: 19, y: 10 },
  { x: 3, y: 16 },
  { x: 11, y: 16 },
  { x: 19, y: 16 },
];
export const STREET_X = 13; // the north-south main street
export const STREET_Y = [8, 15]; // two east-west streets

export type TownHouse = { row: TownRow; plot: Plot; spec: HouseSpec; doorstep: { x: number; y: number } };

export function placeHouses(rows: TownRow[]): TownHouse[] {
  const me = rows.filter((r) => r.is_me);
  const others = rows.filter((r) => !r.is_me).slice(0, PLOTS.length - 1);
  return [...me, ...others].map((row, i) => {
    const plot = PLOTS[i];
    const spec = HOUSE_SPEC[houseTier(row.xp)];
    return { row, plot, spec, doorstep: { x: plot.x + spec.door, y: plot.y + spec.h } };
  });
}

// Grid of what blocks walking: house footprints and trees. Streets and
// doorsteps are always clear.
export function blockedGrid(houses: TownHouse[], trees: Plot[]): boolean[][] {
  const g = Array.from({ length: TOWN_H }, () => Array<boolean>(TOWN_W).fill(false));
  for (const h of houses) for (let y = 0; y < h.spec.h; y++) for (let x = 0; x < h.spec.w; x++) g[h.plot.y + y][h.plot.x + x] = true;
  for (const t of trees) if (g[t.y]) g[t.y][t.x] = true;
  return g;
}

// Deterministic tree scatter so the town looks the same every visit.
export function scatterTrees(houses: TownHouse[], count = 34): Plot[] {
  const taken = blockedGrid(houses, []);
  const near = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (taken[y + dy]?.[x + dx]) return true;
    return false;
  };
  const out: Plot[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let tries = 0; out.length < count && tries < 600; tries++) {
    const x = Math.floor(rnd() * TOWN_W);
    const y = Math.floor(rnd() * TOWN_H);
    if (x === STREET_X || STREET_Y.includes(y) || near(x, y)) continue;
    if (houses.some((h) => h.doorstep.x === x && (h.doorstep.y === y || h.doorstep.y + 1 === y))) continue;
    if (out.some((t) => t.x === x && t.y === y)) continue;
    out.push({ x, y });
  }
  return out;
}

// Breadth-first path on the grid, 4-neighbour. Returns the steps after `from`, or null.
export function findPath(blocked: boolean[][], from: Plot, to: Plot): Plot[] | null {
  const H = blocked.length;
  const W = blocked[0].length;
  if (to.x < 0 || to.y < 0 || to.x >= W || to.y >= H || blocked[to.y][to.x]) return null;
  const key = (p: Plot) => p.y * W + p.x;
  const prev = new Map<number, number>();
  const seen = new Set<number>([key(from)]);
  const q: Plot[] = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === to.x && cur.y === to.y) {
      const path: Plot[] = [];
      let k = key(cur);
      while (k !== key(from)) {
        path.push({ x: k % W, y: Math.floor(k / W) });
        k = prev.get(k)!;
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= H || blocked[n.y][n.x]) continue;
      const nk = key(n);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, key(cur));
      q.push(n);
    }
  }
  return null;
}
