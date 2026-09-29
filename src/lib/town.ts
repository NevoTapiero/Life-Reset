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
// Every plot is a fenced yard, Clash of Clans style: the house at the top, a
// garden below it that fills as its owner levels up, a gate at the bottom
// onto the street. Three columns of yards, streets between and below them.
export const TOWN_W = 30;
export const TOWN_H = 27;
export const YARD_W = 7;
export const YARD_H = 7; // tall enough for a castle and two rows of garden

export type Plot = { x: number; y: number }; // top-left of the yard
export type HouseSpec = { tier: 0 | 1 | 2; w: number; h: number; door: number }; // door = column offset of the doorstep
export const HOUSE_SPEC: Record<0 | 1 | 2, HouseSpec> = {
  0: { tier: 0, w: 3, h: 2, door: 1 },
  1: { tier: 1, w: 3, h: 3, door: 1 },
  2: { tier: 2, w: 4, h: 3, door: 1 },
};

export const PLOTS: Plot[] = [
  { x: 12, y: 2 }, // yours, top middle
  { x: 2, y: 2 },
  { x: 22, y: 2 },
  { x: 2, y: 10 },
  { x: 22, y: 10 },
  { x: 12, y: 10 },
  { x: 2, y: 18 },
  { x: 12, y: 18 },
  { x: 22, y: 18 },
];
export const STREET_X = [10, 20]; // north-south streets between the columns
export const STREET_Y = [9, 17, 25]; // east-west streets under each row of yards

export type GardenItem = { x: number; y: number; kind: "flower" | "hive" | "target" | "sign" | "shroom" | "tree" };
export type TownHouse = {
  row: TownRow;
  plot: Plot;
  spec: HouseSpec;
  house: Plot; // top-left of the building inside the yard
  doorstep: { x: number; y: number };
  gate: { x: number; y: number }; // the gap in the bottom fence
  garden: GardenItem[];
};

// What grows in the yard, from what the street can see. ponytail: driven by
// streak and rank until the shop lets people place things themselves.
export function gardenFor(row: Pick<TownRow, "xp" | "streak_current">, plot: Plot, spec: HouseSpec, doorX: number): GardenItem[] {
  const tier = rankForXp(row.xp).tierIndex;
  const items: GardenItem[] = [];
  const inner = { x0: plot.x + 1, x1: plot.x + YARD_W - 2, y0: plot.y + 1 + spec.h, y1: plot.y + YARD_H - 2 };
  // the column under the door stays clear: that is the lane to the gate
  const free: Plot[] = [];
  for (let y = inner.y0; y <= inner.y1; y++) for (let x = inner.x0; x <= inner.x1; x++) if (x !== doorX) free.push({ x, y });
  let seed = plot.x * 31 + plot.y * 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const take = (kind: GardenItem["kind"]) => {
    if (!free.length) return;
    const i = Math.floor(rnd() * free.length);
    items.push({ ...free.splice(i, 1)[0], kind });
  };
  // rank rewards first, so a small garden never loses its tree to flowers
  if (tier >= 5) take("sign");
  if (tier >= 4) take("tree"); // Diamond: an orchard tree
  if (tier >= 3) take("target"); // Platinum: a training target
  if (tier >= 2) take("hive"); // Gold: bees
  if (tier >= 1) take("shroom");
  for (let i = 0; i < Math.min(row.streak_current, 6); i++) take("flower"); // a flower per streak day
  return items;
}

export function placeHouses(rows: TownRow[]): TownHouse[] {
  const me = rows.filter((r) => r.is_me);
  const others = rows.filter((r) => !r.is_me).slice(0, PLOTS.length - 1);
  return [...me, ...others].map((row, i) => {
    const plot = PLOTS[i];
    const spec = HOUSE_SPEC[houseTier(row.xp)];
    const house = { x: plot.x + 1 + (spec.w === 4 ? 0 : 1), y: plot.y + 1 }; // inside the fence, top row
    const doorstep = { x: house.x + spec.door, y: house.y + spec.h };
    const gate = { x: doorstep.x, y: plot.y + YARD_H - 1 };
    return { row, plot, spec, house, doorstep, gate, garden: gardenFor(row, plot, spec, doorstep.x) };
  });
}

// Grid of what blocks walking: buildings, fences (except gates), garden items, trees.
export function blockedGrid(houses: TownHouse[], trees: Plot[]): boolean[][] {
  const g = Array.from({ length: TOWN_H }, () => Array<boolean>(TOWN_W).fill(false));
  for (const h of houses) {
    for (let y = 0; y < YARD_H; y++)
      for (let x = 0; x < YARD_W; x++) {
        const edge = x === 0 || y === 0 || x === YARD_W - 1 || y === YARD_H - 1;
        if (edge) g[h.plot.y + y][h.plot.x + x] = true;
      }
    g[h.gate.y][h.gate.x] = false;
    for (let y = 0; y < h.spec.h; y++) for (let x = 0; x < h.spec.w; x++) g[h.house.y + y][h.house.x + x] = true;
    for (const it of h.garden) g[it.y][it.x] = true;
  }
  for (const t of trees) if (g[t.y]) g[t.y][t.x] = true;
  return g;
}

// Deterministic tree scatter outside the yards, off the streets.
export function scatterTrees(houses: TownHouse[], count = 40): Plot[] {
  const taken = Array.from({ length: TOWN_H }, () => Array<boolean>(TOWN_W).fill(false));
  for (const h of houses) for (let y = -1; y <= YARD_H; y++) for (let x = -1; x <= YARD_W; x++) if (taken[h.plot.y + y]) taken[h.plot.y + y][h.plot.x + x] = true;
  const out: Plot[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let tries = 0; out.length < count && tries < 800; tries++) {
    const x = Math.floor(rnd() * TOWN_W);
    const y = Math.floor(rnd() * TOWN_H);
    if (STREET_X.includes(x) || STREET_Y.includes(y) || taken[y]?.[x]) continue;
    if (houses.some((h) => h.gate.x === x && y > h.gate.y)) continue; // the lane from a gate to the street
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
