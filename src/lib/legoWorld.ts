import HOUSES from "./legoHouses.json" with { type: "json" };
import SHOP from "./legoShop.json" with { type: "json" };
import LOADOUTS from "./legoLoadouts.generated.json" with { type: "json" };

// The plot, built from real LDraw parts (the community library that models
// every LEGO element). This file only writes LDraw text: which part, which
// colour, where. The renderer (components/LegoWorld.tsx) parses it with three's
// LDrawLoader against the parts packed by scripts/lego/pack.mjs.
//
// LDraw units: 1 stud = 20 LDU, 1 plate = 8, 1 brick = 24, and -Y is up.
// The plot is a 48x48 baseplate; cell (i, j) is a stud, 0..47 on x and z.
// The front of the house and the garden face +Z.

export const PLOT = 48;
const S = 20;
const PLATE = 8;

// LDraw colour codes
export const COL = {
  black: 0,
  blue: 1,
  green: 2,
  darkGreen: 288,
  orange: 25,
  darkTan: 28,
  darkRed: 320,
  darkOrange: 484,
  transLightBlue: 43,
  transYellow: 46,
  pearlGold: 297,
  azure: 322,
  purple: 22,
  brightGreen: 10,
  red: 4,
  yellow: 14,
  white: 15,
  tan: 19,
  pink: 13,
  lightGrey: 71,
  darkGrey: 72,
  reddishBrown: 70,
  darkBlue: 272,
  transClear: 47,
  mediumLavender: 324,
} as const;

// How far below its origin each part reaches (its bottom), measured from the
// LDraw geometry: the part's origin sits this far above whatever it stands on.
const BOTTOM: Record<string, number> = {
  "3062b": 24, "3068b": 8, "87079": 8, "3069b": 8, "3741ac05": 12, "3470": 8, "2435": 8, "3471": 8, "2417": 8, "30055": 48,
};

// every part the plot and the minifig use; scripts/lego/pack.mjs packs exactly
// these (the houses are official sets, baked separately into public/lego/houses)
export const LEGO_PARTS = [
  "4186", "91405", "3062b", "3068b", "3069b", "3741ac05", "3470", "2435", "3471", "2417", "30055",
  "3031", "3754", "3003", "29592", "62698-f2", "33051", "14769p0f", "1", "60594", "60603", "3010", "3005", "87079",
  "3001", "3002", "3004", "3009", "3020", "3022", "3023b", "3032", "3036", "3795", "3666", "3710", "2431", "3941", "4589", "4079", "3068bp0t", "3068bp71", "3068bp74", "4738a", "4739a", "11602", "89801", "30224",
  "3961", "3960", "60474", "11213", "87081", "6141", "98138", "2039", "30367c", "3942c", "3027", "3033", "3958", "41539", "3035", "3832", "3034", "4032a", "2423", "33320", "49661", "12891p01",
  "973", "3818", "3819", "3820", "3815", "3816", "3817", "3626cp01", "53981",
];

type Mat = [number, number, number, number, number, number, number, number, number];
const ROT: Record<0 | 90 | 180 | 270, Mat> = {
  0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  90: [0, 0, 1, 0, 1, 0, -1, 0, 0],
  180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  270: [0, 0, -1, 0, 1, 0, 1, 0, 0],
};

const n = (v: number) => String(Math.round(v * 1000) / 1000);
function line(color: number, x: number, y: number, z: number, m: Mat, part: string) {
  return `1 ${color} ${n(x)} ${n(y)} ${n(z)} ${m.map(n).join(" ")} ${part}.dat`;
}

// Put a part whose footprint is centred on cell-space point (u, w), standing
// on the surface `plates` plates above the baseplate.
function put(part: string, color: number, u: number, w: number, plates: number, rot: 0 | 90 | 180 | 270 = 0) {
  const bottom = BOTTOM[part] ?? 24;
  return line(color, (u - (PLOT - 1) / 2) * S, -plates * PLATE - bottom, (w - (PLOT - 1) / 2) * S, ROT[rot], part);
}

// ---- the house -------------------------------------------------------------

// House level 1..5 is an official LEGO set (LDraw Official Model Repository),
// baked by scripts/lego/pack.mjs into public/lego/houses/<id>.glb: turned to
// face the garden (+Z), its left edge at x = 0, its front at z = 0, standing
// on y = 0. HOUSES records each one's footprint in studs.
export type House = { id: string; name: string; w: number; d: number; h: number; level?: number };
const levelOf = (level: number) => Math.min(Math.max(level, 1), 5);
const housesAt = (level: number) => (HOUSES as House[]).filter((h) => h.level === levelOf(level));
// Each level has a few official houses; a player's name picks theirs, so
// neighbours on the same level usually differ and yours never changes.
export function houseFor(level: number, name?: string): House {
  const all = housesAt(level);
  if (!name) return all[0];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return all[Math.abs(hash) % all.length];
}
export const houseById = (id: string) => (HOUSES as House[]).find((h) => h.id === id);
export const houseUrl = (h: House) => `/lego/houses/${h.id}.glb`;
// the shop in the middle of the town (an official set too, baked the same way)
export const SHOP_BUILDING = SHOP as House;

// The house's footprint on the plot, in cells: big enough for any of the
// level's houses, centred left to right, as far back as leaves the garden 12
// rows (or against the back edge if it's deep). Gardens, paths and the door
// spot follow it, whichever of the level's houses stands there.
export type HouseSpec = { x0: number; z0: number; w: number; d: number };
export function houseSpec(level: number): HouseSpec {
  const all = housesAt(level);
  const w = Math.max(...all.map((h) => h.w));
  const d = Math.max(...all.map((h) => h.d));
  return { x0: Math.floor((PLOT - w) / 2), z0: Math.max(1, PLOT - d - 12), w, d };
}

// Where a house's model goes (LDU): centred on the footprint, its front on the
// footprint's front (the glb's origin is its front-left corner).
export function houseAt(s: HouseSpec, h: House): [number, number, number] {
  return [(s.x0 + s.w / 2 - PLOT / 2) * S - (h.w * S) / 2, 0, (s.z0 + s.d - PLOT / 2) * S];
}

export function doorCells(s: HouseSpec) {
  const dx = s.x0 + Math.floor(s.w / 2) - 2;
  return [dx, dx + 1, dx + 2, dx + 3];
}

const FLOWER_COLOURS = [COL.red, COL.yellow, COL.white, COL.pink, COL.blue, COL.mediumLavender];

export function buildGarden(streak: number, s: HouseSpec): string[] {
  const out: string[] = [];
  const door = doorCells(s);
  const pathL = door[1];
  const front = s.z0 + s.d;

  // the path from the door to the edge
  let z = front;
  for (; z + 1 < PLOT; z += 2) out.push(put("3068b", COL.lightGrey, pathL + 0.5, z + 0.5, 0));
  if (z < PLOT) out.push(put("3069b", COL.lightGrey, pathL + 0.5, z, 0));

  // one flower per streak day, up to 12, in beds either side of the path
  const beds: [number, number][] = [];
  for (let zz = front + 2; zz < PLOT - 3; zz += 2) for (const x of [pathL - 2, pathL - 3, pathL + 3, pathL + 4]) beds.push([x, zz]);
  beds.slice(0, Math.min(streak, 12)).forEach(([x, zz], i) => out.push(put("3741ac05", FLOWER_COLOURS[i % FLOWER_COLOURS.length], x, zz, 0)));

  // a hedge along the front at 5 days
  if (streak >= 5) for (let x = 1; x < PLOT - 1; x++) if (x < pathL - 1 || x > pathL + 2) out.push(put("3062b", COL.green, x, PLOT - 2, 0));

  // trees at 10 and 30 days
  if (streak >= 10) out.push(put("3470", COL.green, 5.5, front + 3.5, 0));
  if (streak >= 30) out.push(put("2435", COL.green, PLOT - 6, front + 4, 0));
  // and a pond with a frog and ducklings at 20
  if (streak >= POND_STREAK) out.push(...place(POND, GARDEN_POND[0], GARDEN_POND[1], ROT[0], 0));
  return out;
}

export function baseplate(): string {
  return line(COL.green, 0, 0, 0, ROT[0], "4186");
}

// ---- the minifigure --------------------------------------------------------

export type MinifigLook = { skin: number; hair: number; torso: number; legs: number };
export const BASE_HUNTER: MinifigLook = { skin: COL.yellow, hair: COL.black, torso: COL.black, legs: COL.darkBlue };

// Parts relative to the torso origin (the top of the torso), from the library's
// own assemblies (973c01 for arms and hands, 3815c01 for hips and legs).
const MINIFIG: { name: string; part: string; slot: keyof MinifigLook; at: [number, number, number]; m: Mat }[] = [
  { name: "torso", part: "973", slot: "torso", at: [0, 0, 0], m: ROT[0] },
  { name: "armL", part: "3818", slot: "torso", at: [-15.552, 9, 0], m: [0.985, -0.17, 0, 0.17, 0.985, 0, 0, 0, 1] },
  { name: "armR", part: "3819", slot: "torso", at: [15.552, 9, 0], m: [0.985, 0.17, 0, -0.17, 0.985, 0, 0, 0, 1] },
  { name: "handL", part: "3820", slot: "skin", at: [-23.6904, 26.774, -9.8982], m: [0.985, -0.1202, 0.1202, 0.17, 0.6964, -0.6964, 0, 0.707, 0.707] },
  { name: "handR", part: "3820", slot: "skin", at: [23.6904, 26.774, -9.8982], m: [0.985, 0.1202, -0.1202, -0.17, 0.6964, -0.6964, 0, 0.707, 0.707] },
  { name: "hips", part: "3815", slot: "legs", at: [0, 32, 0], m: ROT[0] },
  { name: "legR", part: "3816", slot: "legs", at: [0, 44, 0], m: ROT[0] },
  { name: "legL", part: "3817", slot: "legs", at: [0, 44, 0], m: ROT[0] },
  { name: "head", part: "3626cp01", slot: "skin", at: [0, -24, 0], m: ROT[0] },
  { name: "hair", part: "53981", slot: "hair", at: [0, -24, 0], m: ROT[0] },
];
export const MINIFIG_PARTS = MINIFIG.map((p) => p.name);
const FEET = 72; // torso top to the soles

// What a minifig wears: a part and colour for each MINIFIG slot, the gear it
// holds or wears (placed in the same torso frame as MINIFIG, on a MINIFIG part:
// `attach`), and its shoes (no LDraw part: the renderer tints the feet).
export type Figure = {
  parts: Record<string, { part: string; color: number }>;
  gear?: { part: string; color: number; attach: string; at: number[]; m: number[] }[];
  shoes?: { color: number; finish: string };
};
/** a plain figure in four colours (the townsfolk) */
export const figureOf = (look: MinifigLook): Figure => ({
  parts: Object.fromEntries(MINIFIG.map((p) => [p.name, { part: p.part, color: look[p.slot] }])),
});
// The characters' levels (3d/lego/characters, via scripts/lego/loadouts.mjs):
// clothes, gear, shoes and a ride per level. Only the Warrior has them so far.
export type Loadout = (typeof LOADOUTS.characters.warrior.levels)[number];
export function loadoutFor(level: number, character = "warrior"): Loadout {
  const levels = (LOADOUTS.characters as Record<string, { levels: Loadout[] }>)[character]?.levels ?? LOADOUTS.characters.warrior.levels;
  return levels[Math.min(Math.max(Math.round(level), 1), levels.length) - 1];
}

// ponytail: the shields the loadouts use (2586 ovoid, 18836 triangular), by part; a name/category field if more come
const SHIELD = /^(2586|18836)/;

// A standalone minifig model, torso origin at 0, soles at y = 0, facing +Z.
// Its lines come out in MINIFIG_PARTS order, then its gear, so the renderer can find each part.
export function buildMinifig(fig: Figure): string[] {
  const R = ROT[180];
  // turn the whole figure 180 degrees about Y: rotate the offset and the matrix
  const put = (part: string, color: number, [x, y, z]: number[], m: number[]) => {
    const mm: Mat = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mm[i * 3 + j] = R[i * 3] * m[j] + R[i * 3 + 1] * m[3 + j] + R[i * 3 + 2] * m[6 + j];
    return line(color, R[0] * x + R[2] * z, y - FEET, R[6] * x + R[8] * z, mm, part);
  };
  return [
    ...MINIFIG.map(({ name, part, at, m }) => {
      const p = fig.parts[name] ?? { part, color: COL.yellow };
      return put(p.part, p.color, at, m);
    }),
    ...(fig.gear ?? []).map(({ part, color, at, m }) =>
      // a shield's face is its XY plane, handle at the origin: on the grip as is it lies flat, so turn
      // it a quarter about its handle (m * Ry(-90)) to face out from the arm
      put(part, color, at, SHIELD.test(part) ? [m[2], m[1], -m[0], m[5], m[4], -m[3], m[8], m[7], -m[6]] : m),
    ),
  ];
}

// Where the figure stands: on the path, just outside the door (LDraw units, top of the path tiles).
export function minifigSpot(s: HouseSpec): [number, number, number] {
  const door = doorCells(s);
  const u = door[1] + 0.5;
  const w = s.z0 + s.d + 1.5;
  return [(u - (PLOT - 1) / 2) * S, -PLATE, (w - (PLOT - 1) / 2) * S];
}

export function modelText(lines: string[], name = "model.ldr"): string {
  return [`0 FILE ${name}`, `0 ${name}`, ...lines, "0 NOFILE", ""].join("\n");
}

// ---- the town -------------------------------------------------------------

// A resident's plot: their house by level, their garden by streak.
export type Resident = { name: string; level: number; streak: number; me?: boolean };

// The town is a square: the shop on a plaza in the middle, up to eight houses
// around it on 48x48 plots, every one facing the plaza, 16-stud streets
// between the blocks and a ring road round them, and forest beyond.
const PITCH = PLOT + 16; // a block and the street after it, studs
export const TOWN_HALF = 1.5 * PLOT + 2 * 16; // 104 studs: three blocks, two streets, the ring road
export type Lot = { x: number; z: number; facing: 0 | 90 | 180 | 270 }; // centre (LDU) and where its front faces
// you first, right behind the shop; then your friends around the square
const LOTS: [number, number, Lot["facing"]][] = [
  [0, -1, 0], [-1, -1, 0], [1, -1, 0], [-1, 0, 90], [1, 0, 270], [0, 1, 180], [-1, 1, 180], [1, 1, 180],
];
export const MAX_RESIDENTS = LOTS.length;
export function lotFor(i: number): Lot {
  const [gx, gz, facing] = LOTS[i];
  return { x: gx * PITCH * S, z: gz * PITCH * S, facing };
}
// a point in a lot's own frame (its front is +Z) in the town's frame
export function inLot(lot: Lot, [x, y, z]: [number, number, number]): [number, number, number] {
  const m = ROT[lot.facing];
  return [lot.x + m[0] * x + m[2] * z, y, lot.z + m[6] * x + m[8] * z];
}

// The town as one LDraw file: each plot (its garden) as its own submodel
// turned to face the plaza, and the forest around. The ground under it all --
// plots, plaza, streets, grass -- is drawn flat by the renderer: a 48x48
// baseplate alone is 110,000 triangles of studs.
export function townText(residents: Resident[]): string {
  const lots = residents.slice(0, MAX_RESIDENTS).map((_, i) => lotFor(i));
  const main = [
    ...lots.map((lot, i) => `1 16 ${n(lot.x)} 0 ${n(lot.z)} ${ROT[lot.facing].map(n).join(" ")} plot-${i}.ldr`),
    ...splitInstanced(townLand()).kept, // trees are drawn instanced: townInstances()
  ];
  const plots = residents
    .slice(0, MAX_RESIDENTS)
    .map((r, i) => modelText(splitInstanced(buildGarden(r.streak, houseSpec(r.level))).kept, `plot-${i}.ldr`));
  return [modelText(main, "town.ldr"), ...plots].join("");
}

// The trees and flowers townText() leaves out, placed in the town's frame.
export function townInstances(residents: Resident[]): Placement[] {
  const out = splitInstanced(townLand()).placed;
  residents.slice(0, MAX_RESIDENTS).forEach((r, i) => {
    const lot = lotFor(i);
    out.push(...splitInstanced(buildGarden(r.streak, houseSpec(r.level)), { x: lot.x, z: lot.z, r: ROT[lot.facing] }).placed);
  });
  return out;
}

// ---- instanced props --------------------------------------------------------
// Trees and flowers repeat by the hundred (about 140 forest trees at 1.8k to
// 3.5k triangles each, up to 12 flowers per garden at 2.5k). Parsed and merged
// once per placement they cost most of the town's triangles, memory and load
// time; the renderer instead parses each part + colour once and draws every
// copy with one InstancedMesh. Same geometry, same look.
export const INSTANCED_PARTS = new Set(["3470", "3471", "2417", "2435", "3741ac05"]);
/** a part placed in LDraw space: m = [x, y, z, a, b, c, d, e, f, g, h, i] as in a type-1 line */
export type Placement = { part: string; color: number; m: number[] };

// Pull the instanced parts out of LDraw lines. `parent`: the transform of the
// sub-model the lines live in (a plot on its lot), applied to each placement.
export function splitInstanced(lines: string[], parent?: { x: number; z: number; r: Mat }) {
  const kept: string[] = [];
  const placed: Placement[] = [];
  for (const l of lines) {
    const t = l.trim().split(/\s+/);
    const part = t[0] === "1" && t.length >= 15 ? t[14].replace(/\.dat$/i, "") : "";
    if (!INSTANCED_PARTS.has(part)) {
      kept.push(l);
      continue;
    }
    let [x, y, z, ...m] = t.slice(2, 14).map(Number);
    if (parent) {
      const R = parent.r;
      [x, y, z] = [R[0] * x + R[1] * y + R[2] * z + parent.x, R[3] * x + R[4] * y + R[5] * z, R[6] * x + R[7] * y + R[8] * z + parent.z];
      m = turnMat(R, m as Mat);
    }
    placed.push({ part, color: Number(t[1]), m: [x, y, z, ...m] });
  }
  return { kept, placed };
}

// ---- seasons, by the real date ----------------------------------------------
// Leafy trees turn orange, yellow and red in autumn and are snowy white in
// winter; spring has pink blossom among the green. Pines (3471) stay green all
// year, and flowers are gone in winter.
export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
// ponytail: northern hemisphere (Israel); flip by 6 months for southern players if we get any
export const seasonAt = (d: Date): Season => SEASONS[Math.floor(((d.getMonth() + 10) % 12) / 3)];
const LEAFY = new Set(["3470", "2435", "2417"]);
const AUTUMN = [COL.orange, COL.yellow, COL.darkOrange, COL.red];
/** a part's colour this season (k: which copy, for variety); null: not there this season */
export function seasonColor(part: string, color: number, k: number, season: Season): number | null {
  if (part === "3741ac05") return season === "winter" ? null : color;
  if (!LEAFY.has(part) || season === "summer") return color;
  if (season === "winter") return COL.white;
  if (season === "autumn") return AUTUMN[k % AUTUMN.length];
  return k % 3 === 0 ? COL.pink : color; // spring blossom
}
export const placementsIn = (placed: Placement[], season: Season): Placement[] =>
  placed.flatMap((p, k) => {
    const color = seasonColor(p.part, p.color, k, season);
    return color === null ? [] : [{ ...p, color }];
  });
/** the same for LDraw text (the plaza and the parks) */
export const textIn = (text: string, season: Season): string => {
  let k = 0;
  return text
    .split("\n")
    .flatMap((l) => {
      const t = l.trim().split(/\s+/);
      if (t[0] !== "1" || t.length < 15) return [l];
      const color = seasonColor(t[14].replace(/\.dat$/i, ""), Number(t[1]), k++, season);
      return color === null ? [] : [[t[0], color, ...t.slice(2)].join(" ")];
    })
    .join("\n");
};

// ---- the land around the town -------------------------------------------

// small seeded random, so the forest is the same every visit
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TREES = [
  { part: "3471", color: COL.darkGreen },
  { part: "3471", color: COL.green },
  { part: "3470", color: COL.green },
  { part: "2435", color: COL.darkGreen },
  { part: "2417", color: COL.brightGreen },
];

// The ground itself is drawn flat by the renderer (smooth grey streets, like
// LEGO road plates, and grass beyond); studded plates there would be about
// 90,000 studs. Here: the forest -- a band of trees and bushes on a 16-stud
// lattice all round the town, the edge of your world, seen but not walked into.
const FOREST = 3; // rings of 16-stud cells
export function townLand(): string[] {
  const out: string[] = [];
  const inner = TOWN_HALF / 16 - 0.5; // the town is 13 cells across
  const rnd = seeded(7);
  for (let i = -inner - FOREST; i <= inner + FOREST; i++)
    for (let j = -inner - FOREST; j <= inner + FOREST; j++) {
      if (Math.abs(i) <= inner && Math.abs(j) <= inner) continue;
      if (rnd() < 0.4) continue; // a clearing
      const t = TREES[Math.floor(rnd() * TREES.length)];
      const x = Math.round(i * 16 + (rnd() - 0.5) * 12) * S;
      const z = Math.round(j * 16 + (rnd() - 0.5) * 12) * S;
      out.push(line(t.color, x, -BOTTOM[t.part], z, ROT[([0, 90, 180, 270] as const)[Math.floor(rnd() * 4)]], t.part));
    }
  return out;
}

// ---- your room: a station per mission ------------------------------------

// Inside your house is a room with a station for each of your missions (up to
// 10). Tapping a station is doing the mission: it pays out and lights up.
export type Station = { id: string; title: string; pillar: string; xp: number; done: boolean };
export const MAX_STATIONS = 10;

// A turn about the vertical composed onto a part's own orientation.
function turnMat(facing: Mat, m: Mat): Mat {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Mat;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) out[i * 3 + j] += facing[i * 3 + k] * m[k * 3 + j];
  return out;
}

// ---- furniture ----
// A piece of furniture is a list of parts in its own frame: x along the wall,
// +z out into the room, `h` how high the part's bottom sits above the floor
// (LDU). Every part here has its origin on top, HEIGHT above its bottom.
const HEIGHT: Record<string, number> = {
  "3001": 24, "3003": 24, "3004": 24, "3005": 24, "3010": 24, "3062b": 24, "3941": 24, "4589": 24,
  "3020": 8, "3022": 8, "3023b": 8, "3031": 8, "3032": 8, "3036": 8, "3795": 8, "3710": 8,
  "3068b": 8, "87079": 8, "2431": 8, "14769p0f": 8, "4079": 8, "3741ac05": 12,
  "29592": 11, "62698-f2": 1, "33051": 0, "1": 96, "4738a": 32, "4739a": 25,
  "3009": 24, "2435": 8, "11602": 0, "89801": 0, "30224": 8,
  "3470": 8, "3832": 8, "3034": 8, "4032a": 8, "2423": 8, "33320": 0, "49661": 0,
  "3961": 24, "3960": 16, "60474": 8, "11213": 8, "87081": 24, "6141": 8, "98138": 8, "2039": 168, "30367c": 24,
};
type Piece = [part: string, color: number, dx: number, h: number, dz: number, m?: Mat];
const FLOOR = -8; // top of the planks

const LAY_FLAT: Mat = [0, -1, 0, 1, 0, 0, 0, 0, 1]; // a quarter turn about Z
const ALONG_Z = ROT[90]; // a part's long side pointing out into the room
const stack = (part: string, color: number, dx: number, dz: number, n: number, from = 0): Piece[] =>
  Array.from({ length: n }, (_, k) => [part, color, dx, from + k * HEIGHT[part], dz]);

// Each pillar's furniture; a second mission of the same pillar gets the next variant.
const FURNITURE: Record<string, Piece[][]> = {
  Strength: [
    // a weight rack with the barbell across it, and a bench
    [
      ...stack("3062b", COL.darkGrey, -30, -30, 3),
      ...stack("3062b", COL.darkGrey, 30, -30, 3),
      ["29592", COL.darkGrey, 0, 72, -30, LAY_FLAT],
      ["3005", COL.black, 0, 0, 10],
      ["3005", COL.black, 0, 0, 50],
      ["3020", COL.red, 0, 24, 30, ALONG_Z],
    ],
    // a treadmill
    [
      ["3795", COL.darkGrey, 0, 0, 10, ALONG_Z],
      ["87079", COL.black, 0, 8, 20, ALONG_Z],
      ...stack("3062b", COL.lightGrey, -30, -40, 3),
      ...stack("3062b", COL.lightGrey, 30, -40, 3),
      ["2431", COL.red, 0, 72, -40],
    ],
  ],
  Focus: [
    // a desk with the laptop and a lamp, a chair pulled up to it
    [
      ...[-50, 50].flatMap((dx) => [...stack("3005", COL.white, dx, -50, 2), ...stack("3005", COL.white, dx, 10, 2)]),
      ["3032", COL.white, 0, 48, -20],
      ["62698-f2", COL.lightGrey, -10, 56, -25, ROT[180]],
      ["3062b", COL.black, 45, 56, -45],
      ["4589", COL.yellow, 45, 80, -45],
      ["3062b", COL.darkGrey, 0, 0, 50],
      ["4079", COL.blue, 0, 24, 50],
    ],
  ],
  Constitution: [
    // the kitchen: a fridge, a counter with a water bottle and an apple
    [
      ...stack("3003", COL.white, -50, -30, 4),
      ["3068b", COL.lightGrey, -50, 96, -30],
      ...stack("3001", COL.white, 20, -30, 2),
      ["87079", COL.lightGrey, 20, 48, -30],
      ...stack("3062b", COL.transLightBlue, 45, -30, 2, 56),
      ["33051", COL.red, 0, 56, -30],
    ],
    // a counter with fruit and a plant
    [
      ...stack("3001", COL.white, 0, -30, 2),
      ["87079", COL.lightGrey, 0, 48, -30],
      ["33051", COL.red, -20, 56, -30],
      ["3941", COL.darkOrange, 45, 0, 20],
      ["3741ac05", COL.yellow, 45, 24, 20],
    ],
  ],
  Discipline: [
    // a bed, with a nightstand and the alarm clock
    [
      ...[-30, 30].flatMap((dx) => [["3005", COL.reddishBrown, dx, 0, -50], ["3005", COL.reddishBrown, dx, 0, 50]] as Piece[]),
      ["3032", COL.reddishBrown, 0, 24, 0, ALONG_Z],
      ["3032", COL.white, 0, 32, 0, ALONG_Z],
      ["3068b", COL.white, 0, 40, -40],
      ["87079", COL.blue, -20, 40, 20, ALONG_Z],
      ["87079", COL.blue, 20, 40, 20, ALONG_Z],
      ...stack("3010", COL.reddishBrown, 0, -70, 3),
      ["3003", COL.reddishBrown, 60, 0, -50],
      ["14769p0f", COL.white, 60, 24, -50],
    ],
    // a clock on a stand and a chair: sit, no phone
    [
      ...stack("3003", COL.white, -30, -30, 2),
      ["14769p0f", COL.white, -30, 48, -30],
      ["3062b", COL.darkGrey, 30, 0, 20],
      ["4079", COL.orange, 30, 24, 20],
    ],
  ],
  Wisdom: [
    // the bookcase and an armchair
    [
      ["1", COL.reddishBrown, -20, 0, -30, ROT[180]],
      ["3022", COL.darkRed, 45, 0, 30],
      ["4079", COL.darkRed, 45, 8, 30],
    ],
    // a bookcase and a plant
    [
      ["1", COL.reddishBrown, 0, 0, -30, ROT[180]],
      ["3941", COL.darkOrange, 55, 0, 10],
      ["3741ac05", COL.red, 55, 24, 10],
    ],
  ],
};

// Parts placed at (x, z), turned by `f`, standing on `floor` (the room's
// planks by default; 0 is the ground outdoors).
function place(pieces: Piece[], x: number, z: number, f: Mat, floor = FLOOR): string[] {
  return pieces.map(([part, color, dx, h, dz, m]) =>
    line(color, x + f[0] * dx + f[2] * dz, floor - h - HEIGHT[part], z + f[6] * dx + f[8] * dz, turnMat(f, m ?? ROT[0]), part),
  );
}

// Pictures hang flat on a wall: a tile turned to face out of it (f is the wall's facing).
const ON_WALL: Mat = [1, 0, 0, 0, 0, 1, 0, -1, 0];
function picture(tile: string, x: number, z: number, f: Mat): string {
  return line(COL.white, x, -170, z, turnMat(f, ON_WALL), tile);
}

// ---- the shop: furniture you buy with gold ----
// Each piece has its own spot, clear of the stations along the walls, the rug
// and the chest. Prices live in the database (shop_items); `id` matches.
export type Decor = { id: string; name: string; at: [number, number]; facing: 0 | 90 | 180 | 270; pieces: Piece[] };
export const DECOR: Decor[] = [
  { id: "cat", name: "Cat", at: [70, 40], facing: 180, pieces: [["11602", COL.orange, 0, 8, 0]] },
  {
    id: "floor-lamp",
    name: "Floor lamp",
    at: [140, -140],
    facing: 0,
    pieces: [...stack("3062b", COL.black, 0, 0, 4), ["3941", COL.yellow, 0, 96, 0]],
  },
  {
    id: "coffee-table",
    name: "Coffee table",
    at: [50, -110],
    facing: 0,
    pieces: [
      ...[-30, 30].flatMap((dx) => [["3062b", COL.reddishBrown, dx, 0, -10], ["3062b", COL.reddishBrown, dx, 0, 10]] as Piece[]),
      ["3020", COL.reddishBrown, 0, 24, 0],
      ["87079", COL.tan, 0, 32, 0],
    ],
  },
  {
    id: "sofa",
    name: "Sofa",
    at: [-90, -120],
    facing: 0,
    pieces: [
      ["3009", COL.darkBlue, 0, 0, 0],
      ["3009", COL.darkBlue, 0, 0, 20],
      ...stack("3009", COL.darkBlue, 0, -20, 2),
      ["3005", COL.darkBlue, -50, 24, 10],
      ["3005", COL.darkBlue, 50, 24, 10],
    ],
  },
  {
    id: "tv",
    name: "TV",
    at: [150, 100],
    facing: 270,
    pieces: [["3020", COL.darkGrey, 0, 0, 0], ["3004", COL.darkGrey, 0, 8, 0], ...stack("3009", COL.black, 0, 0, 3, 32)],
  },
  {
    id: "aquarium",
    name: "Aquarium",
    at: [110, 250],
    facing: 0,
    pieces: [
      ["3001", COL.darkGrey, 0, 0, 0],
      ...stack("3001", COL.transLightBlue, 0, 0, 2, 24),
      ["30224", COL.orange, -15, 32, 0],
      ["87079", COL.black, 0, 72, 0],
    ],
  },
  {
    id: "trophy",
    name: "Trophy",
    at: [-150, 50],
    facing: 0,
    pieces: [...stack("3941", COL.white, 0, 0, 2), ["89801", COL.pearlGold, 0, 48, 0]],
  },
  {
    id: "indoor-trees",
    name: "Indoor trees",
    at: [0, 0], // two pots, in the front corners (see roomText)
    facing: 0,
    pieces: [],
  },
];

// ---- the plaza: the square in the middle of the town ----
// The shop stands at the back of the plaza; in front of it a two-tier
// fountain, benches facing it, lampposts and trees in planters down both
// sides, flower pots at the front. LDU, the plaza's centre at 0; the shop's
// front edge is at SHOP_FRONT.
export const SHOP_FRONT = (-PLOT / 2 + 34) * S; // Market Street is 34 deep, backed onto the plaza's back edge
export const FOUNTAIN: [number, number] = [0, 340];
const fountain: Piece[] = [
  ["3961", COL.lightGrey, 0, 0, 0], // the basin: a big inverted dish
  ["11213", COL.transLightBlue, 0, 16, 0], // its water
  ...stack("3941", COL.lightGrey, 0, 0, 2, 24), // the column
  ["3960", COL.lightGrey, 0, 72, 0], // the upper bowl
  ["60474", COL.transLightBlue, 0, 80, 0], // its water
  ...stack("6141", COL.transClear, 0, 0, 3, 88), // the jet
  ["98138", COL.transClear, 0, 112, 0],
];
const lamp: Piece[] = [["2039", COL.black, 0, 0, 0], ["30367c", COL.transYellow, 0, 168, 0]];
const LAMP_SPOTS: [number, number][] = [-1, 1].flatMap((side) => [380, 60, -300].map((z) => [side * 400, z] as [number, number]));
// where the lamps' lights are, for the glow after dark (LDU; -Y is up)
export const PLAZA_LAMPS: [number, number, number][] = LAMP_SPOTS.map(([x, z]) => [x, -(168 + 14), z]);
// a lamppost on each block corner that faces the plaza, on the pavement (LDU):
// all four round the plaza, two on the side blocks, one on the corner blocks
const STREET_LAMPS: [number, number][] = [-1, 0, 1].flatMap((gx) =>
  [-1, 0, 1].flatMap((gz) =>
    [-1, 1]
      .flatMap((sx) => [-1, 1].map((sz) => [sx, sz]))
      .filter(([sx, sz]) => (gx === 0 || sx === -gx) && (gz === 0 || sz === -gz))
      .map(([sx, sz]) => [(gx * PITCH + sx * (PLOT / 2 + 1)) * S, (gz * PITCH + sz * (PLOT / 2 + 1)) * S] as [number, number]),
  ),
);
export const STREET_LAMP_LIGHTS: [number, number, number][] = STREET_LAMPS.map(([x, z]) => [x, -(168 + 14 + 8), z]); // on the pavement
const bench: Piece[] = [
  ["3005", COL.darkGrey, -30, 0, 0],
  ["3005", COL.darkGrey, 30, 0, 0],
  ["3020", COL.reddishBrown, 0, 24, 0],
  ["3010", COL.reddishBrown, 0, 32, -10],
];
const planterTree: Piece[] = [["87081", COL.darkTan, 0, 0, 0], ["2435", COL.green, 0, 24, 0]];
const flowerPot = (color: number): Piece[] => [["3941", COL.darkOrange, 0, 0, 0], ["3741ac05", color, 0, 24, 0]];

export function plazaText(): string {
  const out: string[] = [];
  const [fx, fz] = FOUNTAIN;
  out.push(...place(fountain, fx, fz, ROT[0], 0));
  // benches either side of the fountain, facing it
  out.push(...place(bench, fx - 150, fz, ROT[90], 0), ...place(bench, fx + 150, fz, ROT[270], 0));
  // down both sides: lampposts and trees in planters, alternating
  for (const side of [-1, 1]) {
    for (const [x, z] of LAMP_SPOTS.filter(([x]) => Math.sign(x) === side)) out.push(...place(lamp, x, z, ROT[0], 0));
    // (the right side's front planter makes way for the ice cream cart, ICE_CREAM_CART)
    for (const z of side > 0 ? [-120, -440] : [220, -120, -440]) out.push(...place(planterTree, side * 400, z, ROT[0], 0));
    out.push(...place(flowerPot(side < 0 ? COL.red : COL.yellow), side * 240, 440, ROT[0], 0));
  }
  return modelText(out, "plaza.ldr");
}

// ---- a pond ----
// An oval of medium azure plates (10 x 8 studs) with lily pads, a frog, two
// ducklings, stones and reeds; centred on its own origin, on the ground.
const POND: Piece[] = [
  ["3795", COL.azure, 0, 0, -60],
  ["3832", COL.azure, 0, 0, -20],
  ["3832", COL.azure, 0, 0, 20],
  ["3795", COL.azure, 0, 0, 60],
  ["4032a", COL.green, -40, 8, -20],
  ["33320", COL.green, -40, 16, -20], // a frog on a lily pad
  ["4032a", COL.green, 50, 8, 30],
  ["49661", COL.yellow, 10, 8, -10],
  ["49661", COL.yellow, 35, 8, -40, ROT[90]],
  ["3941", COL.darkGrey, -120, 0, 0],
  ["4032a", COL.lightGrey, 115, 0, 40],
  ["2423", COL.green, 80, 0, -70, ROT[180]],
  ["2423", COL.green, -90, 0, 70],
];
// where a garden's pond goes (plot frame, LDU): right of the flower beds, clear
// of the path, the hedge and the 30-day tree; every level's garden starts on row 36
const GARDEN_POND: [number, number] = [220, 340];
export const POND_STREAK = 20;

// ---- empty plots: a little park until a friend moves in ----
// Trees in the corners, flower beds either side of a path, a bench -- in the
// plot's own frame (front +Z), turned with the lot like a house would be.
export function emptyLotsText(first: number): string {
  const park: Piece[] = [
    ["3470", COL.green, -360, 0, -360],
    // (the back-right corner holds the burger stand, PARK_BURGER_STAND)
    ["2435", COL.darkGreen, -380, 0, 120],
    ["2435", COL.darkGreen, 380, 0, 120],
    ...[-160, -120, 120, 160].flatMap((x) => [-80, 0, 80].map((z, k) => ["3741ac05", [COL.red, COL.yellow, COL.pink][k], x, 0, z] as Piece)),
    ...bench.map(([p, c, dx, h, dz, m]) => [p, c, dx, h, dz - 200, m] as Piece),
    ...Array.from({ length: 12 }, (_, k) => ["3068b", COL.tan, 0, 0, -200 + k * 40 + 20] as Piece), // the path
    ...POND.map(([p, c, dx, h, dz, m]) => [p, c, dx - 240, h, dz + 280, m] as Piece), // a pond, front left
  ];
  const out: string[] = [];
  for (let i = first; i < MAX_RESIDENTS; i++) {
    const lot = lotFor(i);
    const f = ROT[lot.facing];
    for (const [part, color, dx, h, dz, m] of park)
      out.push(line(color, lot.x + f[0] * dx + f[2] * dz, -h - HEIGHT[part], lot.z + f[6] * dx + f[8] * dz, turnMat(f, m ?? ROT[0]), part));
  }
  return modelText(out, "parks.ldr");
}

// ---- the town's roads and sky ----
// Road markings, pavements and clouds are flat or plain shapes, so they're
// drawn as boxes (townFlats, townClouds) rather than LDraw: the tile versions
// cost ~550k triangles of undersides and studs nobody ever sees. The lampposts
// on the pavement corners are real LDraw (townDecorText).
export type Slab = { x: number; z: number; w: number; d: number; h: number; y?: number; r?: number; color: string }; // LDU; y = bottom height; r: round

const PAVEMENT = "#a0a5a9";
export function townFlats(): Slab[] {
  const out: Slab[] = [];
  const streets = [-(TOWN_HALF - 8), -PITCH / 2, PITCH / 2, TOWN_HALF - 8]; // street centre lines, studs
  const crossings = [-PITCH / 2, PITCH / 2]; // the streets round the plaza
  const white = "#f2f2ee";
  // dashed centre lines, leaving the junctions and the zebra crossings clear
  for (const c of streets)
    for (let t = -TOWN_HALF + 4; t <= TOWN_HALF - 4; t += 8) {
      if (streets.some((x) => Math.abs(t - x) < 10)) continue;
      if (crossings.includes(c) && Math.abs(t) < 8) continue;
      out.push({ x: c * S, z: t * S, w: 20, d: 80, h: 2, color: white }, { x: t * S, z: c * S, w: 80, d: 20, h: 2, color: white });
    }
  // a sandy disc round the fountain with a darker border (round slabs)
  out.push(
    { x: FOUNTAIN[0], z: FOUNTAIN[1], r: 150, w: 0, d: 0, h: 1, color: "#8b7a5c" },
    { x: FOUNTAIN[0], z: FOUNTAIN[1], r: 138, w: 0, d: 0, h: 2, color: "#d8c79c" },
  );
  // zebra crossings on the four streets round the plaza
  for (const c of crossings)
    for (let k = -2.5; k <= 2.5; k++) {
      out.push({ x: 0, z: (c + k * 2) * S, w: 80, d: 20, h: 2, color: white }, { x: (c + k * 2) * S, z: 0, w: 20, d: 80, h: 2, color: white });
    }
  // a kerbed 2-stud pavement round every block
  for (const bx of [-PITCH, 0, PITCH])
    for (const bz of [-PITCH, 0, PITCH]) {
      const e = (PLOT / 2 + 1) * S;
      const long = (PLOT + 4) * S;
      out.push(
        { x: bx * S, z: bz * S - e, w: long, d: 40, h: 8, color: PAVEMENT },
        { x: bx * S, z: bz * S + e, w: long, d: 40, h: 8, color: PAVEMENT },
        { x: bx * S - e, z: bz * S, w: 40, d: PLOT * S, h: 8, color: PAVEMENT },
        { x: bx * S + e, z: bz * S, w: 40, d: PLOT * S, h: 8, color: PAVEMENT },
      );
    }
  return out;
}

// Clouds: plate-shaped slabs stacked into puffs, three times LEGO size, in a
// ring over the hills.
export function townClouds(): Slab[] {
  const out: Slab[] = [];
  const puff: [number, number, number, number, number][] = [
    // dx, dz, w, d (studs), layer
    [0, 0, 16, 6, 0],
    [-2, -0.5, 10, 6, 1],
    [4, 1, 8, 8, 1],
    [-3, 0, 6, 6, 2],
    [2, -0.5, 8, 4, 2],
    [0, 0, 4, 4, 3],
  ];
  const rnd = seeded(11);
  for (let a = 0; a < Math.PI * 2; a += 0.55 + rnd() * 0.35) {
    const d = (TOWN_HALF + 80 + rnd() * 70) * S;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const cy = 1100 + rnd() * 700; // height of the cloud's base
    for (const [dx, dz, w, dd, layer] of puff)
      out.push({ x: cx + dx * 60, z: cz + dz * 60, w: w * 60, d: dd * 60, h: 24, y: cy + layer * 24, color: "#ffffff" });
  }
  return out;
}

// The lampposts on the pavement corners that face the plaza (LDraw).
export function townDecorText(): string {
  const out: string[] = [];
  for (const [x, z] of STREET_LAMPS) out.push(...place(lamp, x, z, ROT[0], -8)); // on the pavement
  return modelText(out, "town-decor.ldr");
}

// ---- walking round town ----
// You walk the inner streets round the plaza (x or z = +-ST; the cars keep to
// the ring road). Every plot's front faces one of them. A place is a chain of
// points from its street (first) to where you stand (last), so a walk is: back
// along your chain to where it meets the new one (the street, if they share
// nothing), along the streets if need be, and on down the new chain.
export type P3 = [number, number, number];
const ST = (PITCH / 2) * S;
/** from the street to your spot at a lot's door; `side` steps along the door (so you stand beside its owner) */
export function doorWalk(lot: Lot, level: number, side = 0): P3[] {
  const [u, y, w] = minifigSpot(houseSpec(level));
  return [inLot(lot, [u + side, 0, ST]), inLot(lot, [u + side, y, w])];
}
/** where a house's rooms are on its plot (LDU, plot frame): their middle, and the z of their front wall */
export type Rooms = { x: number; z: number; front: number };
/** on from the door, across the garden, in through the front wall and on to the middle of the room (the roof comes off).
 *  `rooms`: measured from the house model; without it, the middle of the footprint. */
export function insideWalk(lot: Lot, level: number, side = 0, rooms?: Rooms): P3[] {
  const s = houseSpec(level);
  const [u, y, w] = minifigSpot(s);
  const r = rooms ?? { x: (s.x0 + s.w / 2 - PLOT / 2) * S, z: (s.z0 + s.d / 2 - PLOT / 2) * S + 40, front: (s.z0 + s.d - PLOT / 2) * S };
  const floor = -2 * PLATE;
  return [
    ...doorWalk(lot, level, side),
    inLot(lot, [u, y, w]),
    inLot(lot, [r.x, y, r.front + S]),
    inLot(lot, [r.x, floor, r.front - 2 * S]),
    inLot(lot, [r.x, floor, r.z]),
  ];
}
/** from the street on the plaza's left, between the planters and the bench, to the shop's front */
export const SHOP_WALK: P3[] = [[-ST, 0, 290], [-150, 0, 290], [-120, 0, 250]];
const onX = (p: P3) => Math.abs(Math.abs(p[0]) - ST) < 1; // on a street running along z
const onZ = (p: P3) => Math.abs(Math.abs(p[2]) - ST) < 1;
const same = (p: P3, q: P3) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1;
/** the corners between two points on the streets */
export function streetLink(p: P3, q: P3): P3[] {
  if ((onX(p) && onX(q) && Math.abs(p[0] - q[0]) < 1) || (onZ(p) && onZ(q) && Math.abs(p[2] - q[2]) < 1)) return [];
  if (onX(p) && onZ(q)) return [[p[0], 0, q[2]]];
  if (onZ(p) && onX(q)) return [[q[0], 0, p[2]]];
  // parallel streets: cross by the nearer of the two others
  const cross = (a: number, b: number) => (Math.abs(a - ST) + Math.abs(b - ST) < Math.abs(a + ST) + Math.abs(b + ST) ? ST : -ST);
  if (onX(p)) {
    const c = cross(p[2], q[2]);
    return [[p[0], 0, c], [q[0], 0, c]];
  }
  const c = cross(p[0], q[0]);
  return [[c, 0, p[2]], [c, 0, q[2]]];
}
/** a walk: its points, and for each the chain from the street that leads to it (length 1: on the street) */
export type Route = { pts: P3[]; chains: P3[][] };
export function walkRoute(from: P3[], to: P3[]): Route {
  let c = 0;
  while (c < from.length && c < to.length && same(from[c], to[c])) c++;
  const back = from.slice(Math.max(c - 1, 0)).reverse();
  const link = c ? [] : streetLink(from[0], to[0]);
  const fwd = to.slice(c);
  return {
    pts: [...back, ...link, ...fwd],
    chains: [
      ...back.map((_, j) => from.slice(0, from.length - j)),
      ...link.map((p) => [p]),
      ...fwd.map((_, k) => to.slice(0, c + k + 1)),
    ],
  };
}
/** turn round mid-walk at `pos` on segment `i` of `r` */
export function rerouteFrom(r: Route, i: number, pos: P3, to: P3[]): Route {
  const [a, b] = [r.chains[i], r.chains[i + 1]];
  // on the street, or somewhere down the chain nearer the street
  const here = a.length === 1 && b.length === 1 ? [pos] : [...(a.length < b.length ? a : b), pos];
  return walkRoute(here, to);
}

// Small official sets placed as props (baked glbs, see PROPS in pack.mjs):
// where they stand (LDU, centre) and their quarter turns. The ice cream cart
// is on the plaza, by the shop; a burger stand is in every empty-plot park
// (plot frame), where the back-right tree would be.
export const ICE_CREAM_CART = { id: "6601-1", at: [330, 250] as [number, number], turn: 0 };
export const PARK_BURGER_STAND = { id: "6683-1", at: [250, -300] as [number, number], turn: 0 };

// the chest's spot on the floor (LDU): front left of the rug, facing you
export const CHEST_SPOT: [number, number] = [-130, 190];

// The room is 32x32 studs with walls ten bricks high -- about two and a half
// minifigs, a real ceiling height -- on the back and both sides; the front is
// open to the camera. Stations stand against the walls like furniture: four
// along the back, three down each side, the floor open in the middle.
const ROOM = 320; // half the room, LDU
const WALL = 240; // ten bricks
// station i: its centre on the floor (LDU) and which way it faces
export function stationSpot(i: number): [number, number] {
  // the camera faces the back wall, where screen-left is +x
  if (i < 4) return [(1.5 - i) * 140, -ROOM + 70];
  const side = i < 7 ? -1 : 1;
  return [side * (ROOM - 70), -110 + ((i - 4) % 3) * 140];
}
const stationFacing = (i: number): Mat => (i < 4 ? ROT[0] : i < 7 ? ROT[90] : ROT[270]);

export function roomText(stations: Station[], owned: string[] = []): string {
  const out: string[] = [];
  // the floor: base plates, then smooth planks (2x4 tiles in staggered rows,
  // a 2x2 tile closing each row) between the walls
  for (const x of [-160, 160]) for (const z of [-160, 160]) out.push(line(COL.darkTan, x, 0, z, ROT[0], "91405"));
  for (let row = 0; row < 15; row++) {
    const z = -ROOM + 40 + row * 40;
    let x = -ROOM + 20;
    const plank = (len: 2 | 4) => {
      out.push(line(COL.reddishBrown, x + len * 10, -8, z, ROT[0], len === 4 ? "87079" : "3068b"));
      x += len * 20;
    };
    if (row % 2) plank(2);
    for (let k = 0; k < 7; k++) plank(4);
    if (!(row % 2)) plank(2);
  }
  // walls: a tan lower course and a white upper one, 1x6x5 bricks
  const back = -ROOM + 10;
  for (let k = -2; k <= 2; k++) {
    const x = k * 120;
    out.push(line(COL.tan, x, -120, back, ROT[0], "3754"));
    if (k === -1 || k === 1) {
      // a window: frame and glass, a 1x1 column either side, two 1x4 bricks above
      out.push(line(COL.white, x, -192, back, ROT[0], "60594"), line(COL.transClear, x, -192, back, ROT[0], "60603"));
      for (let b = 0; b < 5; b++) for (const dx of [-50, 50]) out.push(line(COL.white, x + dx, -144 - b * 24, back, ROT[0], "3005"));
      for (const y of [-216, -240]) out.push(line(COL.white, x, y, back, ROT[0], "3010"));
    } else out.push(line(COL.white, x, -WALL, back, ROT[0], "3754"));
  }
  for (const side of [-1, 1])
    for (let k = 0; k < 5; k++) {
      const z = -ROOM + 60 + k * 120;
      out.push(line(COL.tan, side * (ROOM - 10), -120, z, ROT[90], "3754"), line(COL.white, side * (ROOM - 10), -WALL, z, ROT[90], "3754"));
    }
  // the starter house: a rug in the middle, plants in the front corners, pictures on the walls
  out.push(line(COL.darkRed, 0, FLOOR - 8, 40, ROT[0], "3036"));
  const trees = owned.includes("indoor-trees");
  for (const side of [-1, 1])
    out.push(
      ...place(
        [["3941", COL.darkOrange, 0, 0, 0], trees ? ["2435", COL.green, 0, 24, 0] : ["3741ac05", side < 0 ? COL.pink : COL.yellow, 0, 24, 0]],
        side * 265,
        275,
        ROT[0],
      ),
    );
  // what you've bought
  for (const d of DECOR) if (owned.includes(d.id) && d.pieces.length) out.push(...place(d.pieces, d.at[0], d.at[1], ROT[d.facing]));
  out.push(picture("3068bp0t", 0, -ROOM + 28, ROT[0]), picture("3068bp71", -ROOM + 28, 30, ROT[90]), picture("3068bp74", ROOM - 28, 30, ROT[270]));

  // the chest, where what your watch earned waits to be collected
  out.push(...place([["4738a", COL.reddishBrown, 0, 0, 0], ["4739a", COL.reddishBrown, 0, 32, 0]], CHEST_SPOT[0], CHEST_SPOT[1], ROT[180]));

  // a piece of furniture per mission
  const seen: Record<string, number> = {};
  stations.slice(0, MAX_STATIONS).forEach((st, i) => {
    const [x, z] = stationSpot(i);
    const kinds = FURNITURE[st.pillar] ?? FURNITURE.Discipline;
    const n = (seen[st.pillar] = (seen[st.pillar] ?? -1) + 1);
    out.push(...place(kinds[n % kinds.length], x, z, stationFacing(i)));
  });
  return modelText(out, "room.ldr");
}
