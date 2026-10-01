import HOUSES from "./legoHouses.json" with { type: "json" };
import SHOP from "./legoShop.json" with { type: "json" };
import LOADOUTS from "./legoLoadouts.generated.json" with { type: "json" };
import PROPS from "./legoProps.json" with { type: "json" };

// The plot, built from real LDraw parts (the community library that models
// every LEGO element). This file only writes LDraw text: which part, which
// colour, where. The renderer (components/LegoWorld.tsx) parses it with three's
// LDrawLoader against the parts packed by scripts/lego/pack.mjs.
//
// LDraw units: 1 stud = 20 LDU, 1 plate = 8, 1 brick = 24, and -Y is up.
// The plot is a 48x48 baseplate; cell (i, j) is a stud, 0..47 on x and z.
// The front of the house and the garden face +Z.

export const PLOT = 64; // a plot's side, studs: the house at the back, the garden and your stations round it
export const PLAZA = 48; // the plaza's paved square in the middle of its block
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

// Your stations stand outside, round the house, where the neighbours see what
// you're up to: down both sides of it (as many as fit, up to four a side) and
// the two front corners, by the street. Plot frame, studs; f: which way it faces.
export const STATION_SIZE = 6; // studs, the room a station takes
export function stationSpots(s: HouseSpec): { x: number; z: number; f: Mat }[] {
  const out: { x: number; z: number; f: Mat }[] = [];
  const perSide = Math.min(4, Math.floor((s.d - 2) / STATION_SIZE));
  for (let k = 0; k < perSide; k++) {
    const z = s.z0 + 4 + k * STATION_SIZE;
    out.push({ x: s.x0 / 2, z, f: ROT[270] }, { x: (s.x0 + s.w + PLOT) / 2, z, f: ROT[90] });
  }
  out.push({ x: 9, z: PLOT - 7, f: ROT[0] }, { x: PLOT - 11, z: PLOT - 7, f: ROT[0] });
  return out;
}
/** a station's centre in the plot frame (LDU) */
export const stationAt = ({ x, z }: { x: number; z: number }): [number, number] => [(x - PLOT / 2) * S, (z - PLOT / 2) * S];

export function buildGarden(streak: number, s: HouseSpec, stations: Station[] = []): string[] {
  const out: string[] = [];
  // a piece of furniture per mission, out in the garden
  const spots = stationSpots(s);
  const seen: Record<string, number> = {};
  stations.slice(0, spots.length).forEach((st, i) => {
    const kinds = FURNITURE[st.pillar] ?? FURNITURE.Discipline;
    const n = (seen[st.pillar] = (seen[st.pillar] ?? -1) + 1);
    const [x, z] = stationAt(spots[i]);
    out.push(...place(kinds[n % kinds.length], x, z, spots[i].f, 0));
  });
  const door = doorCells(s);
  const pathL = door[1];
  const front = s.z0 + s.d;

  // the path from the door to the edge, and on to the gate where the gravel path begins
  let z = front;
  for (; z + 1 < PLOT + 3; z += 2) out.push(put("3068b", COL.lightGrey, pathL + 0.5, z + 0.5, 0));
  if (z < PLOT + 3) out.push(put("3069b", COL.lightGrey, pathL + 0.5, z, 0));

  // one flower per streak day, up to 12, in beds either side of the path
  const beds: [number, number][] = [];
  for (let zz = front + 2; zz < PLOT - 3; zz += 2) for (const x of [pathL - 2, pathL - 3, pathL + 3, pathL + 4]) beds.push([x, zz]);
  beds.slice(0, Math.min(streak, 12)).forEach(([x, zz], i) => out.push(put("3741ac05", FLOWER_COLOURS[i % FLOWER_COLOURS.length], x, zz, 0)));

  // the name sign at the gate, beside the path
  const [gx, gz] = gateSignAt(s);
  out.push(...place(SIGNPOST, gx, gz, ROT[0], 0));

  // a hedge along the front at 5 days
  if (streak >= 5) for (let x = 1; x < PLOT - 1; x++) if (x < pathL - 1 || x > pathL + 2) out.push(put("3062b", COL.green, x, PLOT - 2, 0));

  // trees at 10 and 30 days
  if (streak >= 10) out.push(put("3470", COL.green, 3.5, front + 2.5, 0));
  if (streak >= 30) out.push(put("2435", COL.green, PLOT - 4, front + 4, 0));
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
export type Resident = {
  name: string;
  level: number;
  streak: number;
  me?: boolean;
  /** their character (archetype key); none: the Warrior */
  character?: string | null;
  /** their stations (a piece of furniture per mission), out on their plot */
  stations?: Station[];
};

// The town is a square: the shop on a plaza in the middle, up to eight houses
// around it on 48x48 plots, every one facing the plaza. Between the plots
// there's air: a lawn in front of every hedge, a wide pavement, then the
// road; a ring road round it all, and forest beyond.
export const ROAD = 16; // the road round the village, studs wide
export const TOWN_HALF = 232; // the village's radius to the road's outer edge, studs
export const RING = 40; // the gravel ring round the plaza, studs from the centre: where every path meets
export const PATH_W = 6; // the paths, studs
export const RING_R = RING * S; // the ring, LDU
/** a plot in the village: its centre (LDU), its turn `yaw` (radians about Y, LDraw
 *  frame: its front faces the plaza, give or take a twist), and how far round and out it
 *  stands (`a` radians, `r` studs) */
export type Lot = { x: number; z: number; yaw: number; a: number; r: number };
// Like a Minecraft village: the houses stand round the plaza at their own distances and
// angles, none square to another. You first, right behind the shop; then your friends
// round the circle. [angle from north (degrees), distance (studs), twist (degrees)]
const LOTS: [number, number, number][] = [
  [180, 100, -8],
  [226, 150, 9],
  [134, 132, -12],
  [278, 108, 6],
  [92, 168, -6],
  [356, 122, 11],
  [318, 166, -9],
  [40, 140, 5],
];
export const MAX_RESIDENTS = LOTS.length;
/** a turn about Y (LDraw), as ROT is for the quarter turns */
export const yawMat = (yaw: number): Mat => [Math.cos(yaw), 0, Math.sin(yaw), 0, 1, 0, -Math.sin(yaw), 0, Math.cos(yaw)];
export const lotMat = (lot: Lot): Mat => yawMat(lot.yaw);
export function lotFor(i: number): Lot {
  const [deg, r, twist] = LOTS[i];
  const a = (deg * Math.PI) / 180;
  // its front (+z in its frame, (sin yaw, cos yaw) in the town's) points back at the plaza
  return { x: Math.sin(a) * r * S, z: Math.cos(a) * r * S, yaw: a + Math.PI + (twist * Math.PI) / 180, a, r };
}
// a point in the town's frame back into a lot's own frame
export function fromLot(lot: Lot, [x, z]: [number, number]): [number, number] {
  const m = lotMat(lot);
  const [rx, rz] = [x - lot.x, z - lot.z];
  return [m[0] * rx + m[6] * rz, m[2] * rx + m[8] * rz];
}
// a point in a lot's own frame (its front is +Z) in the town's frame
export function inLot(lot: Lot, [x, y, z]: [number, number, number]): [number, number, number] {
  const m = lotMat(lot);
  return [lot.x + m[0] * x + m[2] * z, y, lot.z + m[6] * x + m[8] * z];
}
/** the gravel path from a lot's front gate (just past its hedge, by the door) in to the ring
 *  round the plaza: from the ring inwards, winding a little, LDU */
/** the middle of the tiled path from a house's door, in the plot frame (LDU) */
export const pathX = (s: HouseSpec) => (doorCells(s)[1] + 1 - PLOT / 2) * S;
export function lotPath(lot: Lot, level: number): P3[] {
  const gate = inLot(lot, [pathX(houseSpec(level)), 0, (PLOT / 2 + 3) * S]); // where the tiles end, past the hedge
  const end = nearestStreet(gate);
  const [dx, dz] = [end[0] - gate[0], end[2] - gate[2]];
  const len = Math.hypot(dx, dz) || 1;
  const [nx, nz] = [-dz / len, dx / len]; // across the path
  const bend = (lot.a * 7 + lot.r) % 2 ? 1 : -1;
  const wind = [0, 0.35, 0.7, 1].map((t, k) => {
    const w = k === 0 || k === 3 ? 0 : bend * (k === 1 ? 1 : -1) * 6 * S;
    return [gate[0] + dx * t + nx * w, 0, gate[2] + dz * t + nz * w] as P3;
  });
  return wind.reverse();
}

// The town as one LDraw file: each plot (its garden) as its own submodel
// turned to face the plaza, and the forest around. The ground under it all --
// plots, plaza, streets, grass -- is drawn flat by the renderer: a 48x48
// baseplate alone is 110,000 triangles of studs.
export function townText(residents: Resident[]): string {
  const lots = residents.slice(0, MAX_RESIDENTS).map((_, i) => lotFor(i));
  const main = [
    ...lots.map((lot, i) => `1 16 ${n(lot.x)} 0 ${n(lot.z)} ${lotMat(lot).map(n).join(" ")} plot-${i}.ldr`),
    ...splitInstanced(townLand()).kept, // trees are drawn instanced: townInstances()
  ];
  const plots = residents
    .slice(0, MAX_RESIDENTS)
    .map((r, i) => modelText(splitInstanced(buildGarden(r.streak, houseSpec(r.level), r.stations)).kept, `plot-${i}.ldr`));
  return [modelText(main, "town.ldr"), ...plots].join("");
}

// The trees and flowers townText() leaves out, placed in the town's frame.
export function townInstances(residents: Resident[]): Placement[] {
  const out = splitInstanced(townLand()).placed;
  residents.slice(0, MAX_RESIDENTS).forEach((r, i) => {
    const lot = lotFor(i);
    out.push(...splitInstanced(buildGarden(r.streak, houseSpec(r.level), r.stations), { x: lot.x, z: lot.z, r: lotMat(lot) }).placed);
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


// ---- the land round the village: two roads out, a river, a lake, the woods ----
// The roads leave the village together, at a little roundabout on its south-east
// edge, and fork: each winds off its own way into the woods until it fades into the
// hills. One crosses the river on a bridge. A dirt track leads from the ring to a
// lake in the woods. The woods start at the village's edge and thicken outwards.
export const ROAD_OUT = 16; // the roads out, studs wide
export const ROAD_END = TOWN_HALF + 130; // where the roads out fade into the hills, studs from the centre
export const RIVER_W = 16; // studs
export const RIVER_Z = -(TOWN_HALF + 40); // the river's mean line, studs (it wanders)
const ENTRANCE = { a: (248 * Math.PI) / 180, r: 175, round: 9 }; // the roundabout: where it stands (a gap between houses, at the woods' edge), its radius (studs)
export const ROUNDABOUT: [number, number] = [Math.sin(ENTRANCE.a) * ENTRANCE.r * S, Math.cos(ENTRANCE.a) * ENTRANCE.r * S];
export const ROUND_R = ENTRANCE.round * S;
/** a road out into the woods from the roundabout's rim, winding (LDU) */
function roadOut(heading: number, seed: number): P3[] {
  const rnd = seeded(seed);
  const pts: P3[] = [];
  let [x, z] = [ROUNDABOUT[0] + Math.sin(heading) * ROUND_R, ROUNDABOUT[1] + Math.cos(heading) * ROUND_R];
  let h = heading;
  pts.push([x, 0, z]);
  const step = 26 * S;
  for (let k = 0; k < 16 && Math.hypot(x, z) < ROAD_END * S; k++) {
    h += (rnd() - 0.5) * 0.6 + (heading - h) * 0.3; // wanders, but keeps heading out
    x += Math.sin(h) * step;
    z += Math.cos(h) * step;
    pts.push([x, 0, z]);
  }
  return pts;
}
export const ROADS: P3[][] = [roadOut((275 * Math.PI) / 180, 41), roadOut((190 * Math.PI) / 180, 42)];
/** the river, west to east across the north woods, wandering (LDU) */
export const RIVER: P3[] = Array.from({ length: 27 }, (_, k) => {
  const x = -780 + k * 60;
  return [x * S, 0, (RIVER_Z + 26 * Math.sin(x / 90) + 14 * Math.sin(x / 37 + 1)) * S] as P3;
});
/** the lake in the woods, and the dirt track to it from the ring (LDU) */
export const LAKE = { x: Math.sin((66 * Math.PI) / 180) * (TOWN_HALF + 18) * S, z: Math.cos((66 * Math.PI) / 180) * (TOWN_HALF + 18) * S, r: 22 * S };
const LAKE_Z_FOR_BROOK = LAKE.z - 18 * S; // the brook ends at the lake's top edge
/** a brook from the river down the village's west edge into the lake, winding (LDU) */
export const BROOK: P3[] = (() => {
  const x0 = 236 * S;
  const z0 = RIVER_Z * S + 26 * Math.sin((x0 / S) / 90) * S + 14 * Math.sin((x0 / S) / 37 + 1) * S; // on the river's line there
  const out: P3[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    out.push([x0 + Math.sin(t * 9) * 14 * S + t * 6 * S, 0, z0 + t * (LAKE_Z_FOR_BROOK - z0)]);
  }
  return out;
})();

export const TRACK: P3[] = (() => {
  const rim: P3 = [LAKE.x * (1 - (LAKE.r + 2 * S) / Math.hypot(LAKE.x, LAKE.z)), 0, LAKE.z * (1 - (LAKE.r + 2 * S) / Math.hypot(LAKE.x, LAKE.z))];
  const start = nearestStreet(rim);
  const [dx, dz] = [rim[0] - start[0], rim[2] - start[2]];
  const len = Math.hypot(dx, dz) || 1;
  const [nx, nz] = [-dz / len, dx / len];
  return [0, 0.25, 0.5, 0.75, 1].map((t, k) => {
    const w = [0, 6, -5, 6, 0][k] * S;
    return [start[0] + dx * t + nx * w, 0, start[2] + dz * t + nz * w] as P3;
  });
})();
/** where a road crosses the river: the point and the road's heading there (as a slab yaw), or null */
export function crossing(road: P3[], river: P3[]): { p: P3; yaw: number; dir: [number, number] } | null {
  for (let i = 0; i + 1 < road.length; i++)
    for (let j = 0; j + 1 < river.length; j++) {
      const [a, b, c, d] = [road[i], road[i + 1], river[j], river[j + 1]];
      const [r1x, r1z, r2x, r2z] = [b[0] - a[0], b[2] - a[2], d[0] - c[0], d[2] - c[2]];
      const den = r1x * r2z - r1z * r2x;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((c[0] - a[0]) * r2z - (c[2] - a[2]) * r2x) / den;
      const u = ((c[0] - a[0]) * r1z - (c[2] - a[2]) * r1x) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      const len = Math.hypot(r1x, r1z) || 1;
      return { p: [a[0] + r1x * t, 0, a[2] + r1z * t], yaw: Math.atan2(-r1z, r1x), dir: [r1x / len, r1z / len] };
    }
  return null;
}
/** the cars' loop: in along one road, round the roundabout, out along the other, and back
 *  unseen through the hills (LDU) */
export function carLoop(): [number, number][] {
  const [a, b] = ROADS;
  const pts: [number, number][] = a.slice().reverse().map((p) => [p[0], p[2]]);
  const angle = (p: P3) => Math.atan2(p[0] - ROUNDABOUT[0], p[2] - ROUNDABOUT[1]);
  const [a0, a1] = [angle(a[0]), angle(b[0])];
  for (let k = 1; k < 8; k++) {
    const t = a0 + ((a1 - a0) * k) / 8;
    pts.push([ROUNDABOUT[0] + Math.sin(t) * ROUND_R, ROUNDABOUT[1] + Math.cos(t) * ROUND_R]);
  }
  pts.push(...b.map((p) => [p[0], p[2]] as [number, number]));
  // home through the hills: an arc well beyond where the roads fade, out of sight
  const far = (ROAD_END + 40) * S;
  const [e0, e1] = [Math.atan2(b[b.length - 1][0], b[b.length - 1][2]), Math.atan2(a[a.length - 1][0], a[a.length - 1][2])];
  let d = e1 - e0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  for (let k = 0; k <= 10; k++) {
    const t = e0 + (d * k) / 10;
    pts.push([Math.sin(t) * far, Math.cos(t) * far]);
  }
  return pts;
}
const WOODS_FROM = TOWN_HALF - 30; // the woods begin here (thin), studs from the centre
const WOODS_TO = TOWN_HALF + 120; // and run out to the hills
/** the woods: where each tree stands (LDU), how tall (LDU), a pine or leafy, and a shade of
 *  its green (0.8..1.2). Drawn instanced by the renderer (ForestBelt). Never on a plot, a
 *  path, a road, the river, the lake or the roundabout; thin at the village's edge, thick beyond. */
export function forestTrees(): { x: number; z: number; h: number; pine: boolean; shade: number }[] {
  const out: { x: number; z: number; h: number; pine: boolean; shade: number }[] = [];
  const rnd = seeded(7);
  const lots = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotFor(i));
  const paths = lots.map((lot) => lotPath(lot, 3));
  const bridge = crossing(ROADS[1], RIVER);
  for (let i = -WOODS_TO; i <= WOODS_TO; i += 9)
    for (let j = -WOODS_TO; j <= WOODS_TO; j += 9) {
      const x = (i + (rnd() - 0.5) * 6) * S;
      const z = (j + (rnd() - 0.5) * 6) * S;
      const r = Math.hypot(x, z) / S;
      if (r < WOODS_FROM || r > WOODS_TO) continue;
      if (rnd() > 0.3 + (r - WOODS_FROM) / 45) continue; // thin at the edge of the village
      if (lots.some((lot) => nearLot(x, z, lot, 6 * S))) continue;
      if (paths.some((p) => toPath(x, z, p) < 8 * S)) continue;
      if (ROADS.some((p) => toPath(x, z, p) < (ROAD_OUT / 2 + 5) * S)) continue;
      if (toPath(x, z, RIVER) < (RIVER_W / 2 + 5) * S || toPath(x, z, TRACK) < 6 * S || toPath(x, z, BROOK) < 9 * S) continue;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 5 * S) continue;
      if (Math.hypot(x - ROUNDABOUT[0], z - ROUNDABOUT[1]) < ROUND_R + (ROAD_OUT + 4) * S) continue;
      if (bridge && Math.hypot(x - bridge.p[0], z - bridge.p[2]) < 24 * S) continue;
      const pine = rnd() < 0.7;
      out.push({ x, z, h: (pine ? 130 : 95) + rnd() * 70, pine, shade: 0.8 + rnd() * 0.4 });
    }
  return out;
}
export function townLand(): string[] {
  return villageTrees();
}
/** is (x, z) LDU within `margin` LDU of a lot's plot (its turned square)? */
function nearLot(x: number, z: number, lot: Lot, margin: number): boolean {
  const [u, v] = fromLot(lot, [x, z]);
  const h = (PLOT / 2) * S + margin;
  return Math.abs(u) < h && Math.abs(v) < h;
}
/** the distance from (x, z) to a polyline, LDU */
function toPath(x: number, z: number, path: P3[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) {
    const [a, b] = [path[i], path[i + 1]];
    const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  return best;
}
// Trees scattered between the houses, the village way: leafy ones mostly, the odd pine,
// never on a plot, a path, the plaza or the road. The same scatter every visit.
function villageTrees(): string[] {
  const out: string[] = [];
  const rnd = seeded(23);
  const lots = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotFor(i));
  const paths = lots.map((lot) => lotPath(lot, 3)); // level 3's door is about where every level's is
  const taken: [number, number][] = [];
  // the tree on the roundabout
  out.push(line(COL.green, Math.round(ROUNDABOUT[0] / S) * S, -BOTTOM["2435"], Math.round(ROUNDABOUT[1] / S) * S, ROT[0], "2435"));
  for (let tries = 0; tries < 900 && out.length < 90; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = (RING + 14 + rnd() * (WOODS_FROM - RING - 14)) * S;
    const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
    if (lots.some((lot) => nearLot(x, z, lot, 6 * S))) continue;
    if (paths.some((path) => toPath(x, z, path) < 7 * S)) continue;
    if (ROADS.some((p) => toPath(x, z, p) < (ROAD_OUT / 2 + 5) * S) || toPath(x, z, TRACK) < 6 * S || toPath(x, z, BROOK) < 9 * S) continue;
    if (Math.hypot(x - ROUNDABOUT[0], z - ROUNDABOUT[1]) < ROUND_R + (ROAD_OUT + 4) * S) continue;
    if (Math.hypot(x - PLAYGROUND[0], z - PLAYGROUND[1]) < 260 || Math.hypot(x - WATER_TOWER[0], z - WATER_TOWER[1]) < 160) continue;
    if (taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 11 * S)) continue;
    taken.push([x, z]);
    const part = rnd() < 0.72 ? "2435" : rnd() < 0.5 ? "3471" : "3470";
    out.push(line(part === "3471" ? COL.darkGreen : COL.green, Math.round(x / S) * S, -BOTTOM[part], Math.round(z / S) * S, ROT[0], part));
  }
  // wildflowers in clusters of three in the gaps, never on a plot or a path (gone in winter, like every flower)
  for (let tries = 0; tries < 400 && out.length < 190; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = (RING + 12 + rnd() * (WOODS_FROM - RING - 20)) * S;
    const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
    if (lots.some((lot) => nearLot(x, z, lot, 4 * S))) continue;
    if (paths.some((path) => toPath(x, z, path) < 5 * S) || toPath(x, z, TRACK) < 5 * S) continue;
    if (Math.hypot(x - PLAYGROUND[0], z - PLAYGROUND[1]) < 240 || Math.hypot(x - WATER_TOWER[0], z - WATER_TOWER[1]) < 150) continue;
    if (taken.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 4 * S)) continue;
    const colour = [COL.red, COL.yellow, COL.pink, COL.white][Math.floor(rnd() * 4)];
    for (const [dx, dz] of [[0, 0], [20, 20], [-20, 20]]) out.push(line(colour, Math.round(x / S) * S + dx, -BOTTOM["3741ac05"], Math.round(z / S) * S + dz, ROT[0], "3741ac05"));
  }
  // leafy trees lining both sides of the roads out, every 16 studs, as far as the woods' edge
  for (const road of ROADS)
    for (let k = 0; k + 1 < road.length; k++) {
      const [a, b] = [road[k], road[k + 1]];
      const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
      const len = Math.hypot(dx, dz) || 1;
      const [nx, nz] = [-dz / len, dx / len];
      for (let d = 8 * S; d < len; d += 16 * S)
        for (const side of [-1, 1]) {
          const x = a[0] + (dx * d) / len + nx * side * (ROAD_OUT / 2 + 4) * S;
          const z = a[2] + (dz * d) / len + nz * side * (ROAD_OUT / 2 + 4) * S;
          if (Math.hypot(x, z) > WOODS_FROM * S || lots.some((lot) => nearLot(x, z, lot, 4 * S))) continue;
          if (Math.hypot(x - ROUNDABOUT[0], z - ROUNDABOUT[1]) < ROUND_R + (ROAD_OUT + 6) * S) continue;
          out.push(line(COL.green, Math.round(x / S) * S, -BOTTOM["2435"], Math.round(z / S) * S, ROT[0], "2435"));
        }
    }
  return out;
}

// A hedge round the back and sides of every plot (the front is the garden's
// own, by streak): dark green, just inside the edge, its back corners cut off
// (rounded, not boxed in). Boxes for the renderer's Slabs, turned with the lot,
// and blockers so nobody walks through them.
export const HEDGE_H = 20; // LDU
const HEDGE_CUT = 8; // studs off each back corner
export function plotHedges(): Slab[] {
  const out: Slab[] = [];
  const E = (PLOT / 2 - 0.5) * S;
  const C = HEDGE_CUT * S;
  for (let i = 0; i < MAX_RESIDENTS; i++) {
    const lot = lotFor(i);
    const seg = (cx: number, cz: number, w: number, d: number, turn = 0) => {
      const [x, , z] = inLot(lot, [cx, 0, cz]);
      out.push({ x, z, w, d, h: HEDGE_H, color: "#237841", yaw: lot.yaw + turn, studs: true });
    };
    seg(0, -E, (PLOT - 1) * S - 2 * C, S); // the back
    seg(-E, C / 2, S, (PLOT - 1) * S - C); // the sides
    seg(E, C / 2, S, (PLOT - 1) * S - C);
    for (const side of [-1, 1]) seg(side * (E - C / 2), -(E - C / 2), C * Math.SQRT2, S, side * (Math.PI / 4)); // the cut corners
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
  "3470": 8, "3471": 8, "3832": 8, "3034": 8, "4032a": 8, "2423": 8, "33320": 0, "49661": 0,
  "3961": 24, "3960": 16, "60474": 8, "11213": 8, "87081": 24, "6141": 8, "98138": 8, "2039": 168, "30367c": 24,
  "3027": 8, "3958": 8, "3035": 8, "3942c": 48,
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
export const SHOP_FRONT = (-PLAZA / 2 + 34) * S; // Market Street is 34 deep, backed onto the plaza's back edge
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
// a lamppost where each house's path meets the ring, just outside the ring, off the path (LDU)
const STREET_LAMPS: [number, number][] = Array.from({ length: MAX_RESIDENTS }, (_, i) => {
  const lot = lotFor(i);
  const [end, next] = lotPath(lot, 3);
  const [dx, dz] = [next[0] - end[0], next[2] - end[2]];
  const len = Math.hypot(dx, dz) || 1;
  const r = Math.hypot(end[0], end[2]) || 1;
  return [end[0] + (end[0] / r) * 4 * S + (-dz / len) * 6 * S, end[2] + (end[2] / r) * 4 * S + (dx / len) * 6 * S] as [number, number];
});
// and along the roads out, every 40 studs, sides alternating, as far as the woods
const ROAD_LAMPS: [number, number][] = ROADS.flatMap((road) => {
  const out: [number, number][] = [];
  let side = 1;
  let next = 20 * S;
  let walked = 0;
  for (let k = 0; k + 1 < road.length; k++) {
    const [a, b] = [road[k], road[k + 1]];
    const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
    const len = Math.hypot(dx, dz) || 1;
    while (next - walked <= len) {
      const t = (next - walked) / len;
      const [x, z] = [a[0] + dx * t + (-dz / len) * side * (ROAD_OUT / 2 + 2) * S, a[2] + dz * t + (dx / len) * side * (ROAD_OUT / 2 + 2) * S];
      if (Math.hypot(x, z) < (TOWN_HALF - 30) * S) out.push([x, z]);
      side = -side;
      next += 40 * S;
    }
    walked += len;
  }
  return out;
});
export const STREET_LAMP_LIGHTS: [number, number, number][] = [...STREET_LAMPS, ...ROAD_LAMPS].map(([x, z]) => [x, -(168 + 14), z]);
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
const GARDEN_POND: [number, number] = [(PLOT / 2 - 13) * S, (PLOT / 2 - 7) * S];
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
    const f = lotMat(lot);
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
// LDU; y = bottom height; r: a round slab; yaw: a box turned about Y; radius (+ border): a
// rounded rectangle (a ring `border` wide when set) instead of a box
export type Slab = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  y?: number;
  r?: number;
  yaw?: number;
  radius?: number;
  border?: number;
  color: string;
  /** studs on top, a stud a stud */
  studs?: boolean;
  /** one continuous band `w` wide along these points (a river, a road, a path): no seams, nothing overlapping */
  ribbon?: P3[];
};
const GRAVEL = "#c9b48a";

export function townFlats(): Slab[] {
  const out: Slab[] = [];
  const white = "#f2f2ee";
  const asphalt = "#43474c";
  const GRAVEL_W = PATH_W * S;
  // a road or path along a polyline: a turned box per leg (they overlap at the bends), its top at ground level
  // `drop`: LDU below ground level for its top (a band that lies under another must sit well below it: the map camera
  // can't tell heights a LDU apart, and they shimmer)
  const along = (pts: P3[], w: number, color: string, h = 2, studs = true, drop = 0) => out.push({ x: 0, z: 0, w, d: 0, h, y: -h - drop, color, studs, ribbon: pts });
  // a point `d` LDU along a polyline, and the leg's yaw
  const at = (pts: P3[], d: number): { x: number; z: number; yaw: number } | null => {
    for (let k = 0; k + 1 < pts.length; k++) {
      const [a, b] = [pts[k], pts[k + 1]];
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (d <= len) return { x: a[0] + ((b[0] - a[0]) * d) / len, z: a[2] + ((b[2] - a[2]) * d) / len, yaw: Math.atan2(-(b[2] - a[2]), b[0] - a[0]) };
      d -= len;
    }
    return null;
  };
  // the two roads out of the village, dashed down their middles, from the roundabout
  const bridge = crossing(ROADS[1], RIVER);
  for (const road of ROADS) {
    along(road, (ROAD_OUT + 3) * S, "#9a9ea2", 1, false, 4); // a light kerb showing along both edges
    along(road, ROAD_OUT * S, asphalt, 2, false); // road plates are smooth
    for (let d = 14 * S; ; d += 8 * S) {
      const p = at(road, d);
      if (!p) break;
      if (bridge && Math.hypot(p.x - bridge.p[0], p.z - bridge.p[2]) < (RIVER_W / 2 + 8) * S) continue;
      out.push({ x: p.x, z: p.z, w: 80, d: 20, h: 2, color: white, yaw: p.yaw });
    }
  }
  // the roundabout: an asphalt ring round a grassy island with its tree, and a gravel spur to it from the ring
  const side = 2 * (ROUND_R + ROAD_OUT * S);
  out.push({ x: ROUNDABOUT[0], z: ROUNDABOUT[1], w: side, d: side, h: 2, y: -5, radius: side / 2, border: ROAD_OUT * S, color: asphalt }); // under the roads that meet it
  const spurStart = nearestStreet([ROUNDABOUT[0], 0, ROUNDABOUT[1]]);
  along([spurStart, [ROUNDABOUT[0], 0, ROUNDABOUT[1]]], GRAVEL_W, GRAVEL);
  {
    // a zebra crossing over the roundabout's road where the spur reaches it
    const [dx, dz] = [ROUNDABOUT[0] - spurStart[0], ROUNDABOUT[1] - spurStart[2]];
    const len = Math.hypot(dx, dz) || 1;
    const [ux, uz, nx, nz] = [dx / len, dz / len, -dz / len, dx / len];
    const from = len - ROUND_R - ROAD_OUT * S;
    for (let k = -2; k <= 2; k++)
      for (let d = from + 20; d < len - ROUND_R - 10; d += 40)
        out.push({ x: spurStart[0] + ux * d + nx * k * 40, z: spurStart[2] + uz * d + nz * k * 40, w: 20, d: 20, h: 2, color: white, yaw: Math.atan2(-uz, ux) });
  }
  // the river: sandy banks under a band of water, wandering across the north woods; a bridge where the road crosses it
  along(RIVER, (RIVER_W + 6) * S, "#d8c79c", 1, true, 4); // the banks, under the water
  along(RIVER, RIVER_W * S, "#3f8fd8", 2);
  // the brook, a touch higher than the river where they meet so the join never shimmers
  along(BROOK, 11 * S, "#d8c79c", 1, true, 2);
  along(BROOK, 7 * S, "#3f8fd8", 2, true, -2);
  if (bridge) {
    const [nx, nz] = [-bridge.dir[1], bridge.dir[0]];
    const deck = (RIVER_W + 14) * S;
    out.push({ x: bridge.p[0], z: bridge.p[2], w: deck, d: (ROAD_OUT + 2) * S, h: 6, color: "#8c9196", yaw: bridge.yaw });
    for (const s of [-1, 1])
      out.push({ x: bridge.p[0] + nx * s * (ROAD_OUT / 2 + 0.5) * S, z: bridge.p[2] + nz * s * (ROAD_OUT / 2 + 0.5) * S, w: deck, d: S, h: 22, color: white, yaw: bridge.yaw });
  }
  // the lake in the woods, sand round it, and the dirt track out to it
  const lake = (r: number, h: number, color: string, drop = 0) => out.push({ x: LAKE.x, z: LAKE.z, w: 2 * r, d: 2 * r, radius: r, h, y: -h - drop, color, studs: true });
  lake(LAKE.r + 3 * S, 1, "#d8c79c", 4); // the sand, under the water
  lake(LAKE.r, 2, "#3f8fd8");
  // a wooden jetty out from where the track arrives, on posts, and two rowing boats
  const shore = TRACK[TRACK.length - 1];
  const [jx, jz] = [LAKE.x - shore[0], LAKE.z - shore[2]];
  const jl = Math.hypot(jx, jz) || 1;
  const jetty: P3[] = [[shore[0], 0, shore[2]], [shore[0] + (jx / jl) * 14 * S, 0, shore[2] + (jz / jl) * 14 * S]];
  out.push({ x: 0, z: 0, w: 4 * S, d: 0, h: 4, y: 6, color: "#a0703c", studs: true, ribbon: jetty });
  for (const t of [0.35, 0.95])
    for (const side of [-1, 1])
      out.push({ x: shore[0] + jx * (t * 14 * S) / jl + (-jz / jl) * side * 1.6 * S, z: shore[2] + jz * (t * 14 * S) / jl + (jx / jl) * side * 1.6 * S, w: 8, d: 8, h: 14, y: -4, color: "#6b4a2a" });
  // (the boats and ducks are the renderer's: they move, see LakeLife)
  along(TRACK, GRAVEL_W, GRAVEL);
  // the gravel ring round the plaza, and a winding gravel path in from every house's gate
  out.push({ x: 0, z: 0, w: (2 * RING + PATH_W) * S, d: (2 * RING + PATH_W) * S, h: 2, y: -5, radius: (RING + PATH_W / 2) * S, border: PATH_W * S, color: GRAVEL, studs: true }); // under the paths that meet it
  for (let i = 0; i < MAX_RESIDENTS; i++) along(lotPath(lotFor(i), 3), GRAVEL_W, GRAVEL);
  // a sandy disc round the fountain with a darker border (round slabs)
  out.push(
    { x: FOUNTAIN[0], z: FOUNTAIN[1], r: 150, w: 0, d: 0, h: 1, color: "#8b7a5c" },
    { x: FOUNTAIN[0], z: FOUNTAIN[1], r: 138, w: 0, d: 0, h: 2, color: "#d8c79c" },
  );
  return out;
}

// A hot-air balloon: rings of round bricks in red and white, a basket under it (LDU, about its
// own centre at the basket's bottom); the renderer drifts it slowly round over the village.
export function balloonSlabs(): Slab[] {
  const out: Slab[] = [];
  const rings = [60, 110, 150, 175, 185, 185, 175, 150, 110, 60];
  rings.forEach((r, k) => out.push({ x: 0, z: 0, w: 0, d: 0, r, h: 30, y: 180 + k * 30, color: k % 2 ? "#f2f2ee" : "#c4281c" }));
  out.push({ x: 0, z: 0, w: 70, d: 70, h: 50, y: 0, color: "#a0703c", studs: true });
  for (const [dx, dz] of [[-25, -25], [25, -25], [-25, 25], [25, 25]]) out.push({ x: dx, z: dz, w: 6, d: 6, h: 130, y: 50, color: "#3b2a1a" });
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
  // a few over the village itself (seen from the ground), the rest in a ring over the hills
  const spots: [number, number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rnd() * 0.6;
    const d = (RING + 60 + rnd() * 120) * S;
    spots.push([Math.cos(a) * d, Math.sin(a) * d, 1500 + rnd() * 500]);
  }
  for (const [cx, cz, cy] of spots)
    for (const [dx, dz, w, dd, layer] of puff)
      out.push({ x: cx + dx * 40, z: cz + dz * 40, w: w * 40, d: dd * 40, h: 16, y: cy + layer * 16, radius: Math.min(w, dd) * 40 * 0.4, color: "#ffffff", studs: true });
  for (let a = 0; a < Math.PI * 2; a += 0.55 + rnd() * 0.35) {
    const d = (TOWN_HALF + 80 + rnd() * 70) * S;
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const cy = 1100 + rnd() * 700; // height of the cloud's base
    // white round-cornered plates with studs, stacked: a LEGO cloud
    for (const [dx, dz, w, dd, layer] of puff)
      out.push({ x: cx + dx * 60, z: cz + dz * 60, w: w * 60, d: dd * 60, h: 24, y: cy + layer * 24, radius: Math.min(w, dd) * 60 * 0.4, color: "#ffffff", studs: true });
  }
  return out;
}

// The lampposts on the pavement corners that face the plaza (LDraw).
export function townDecorText(): string {
  const out: string[] = [];
  for (const [x, z] of [...STREET_LAMPS, ...ROAD_LAMPS]) out.push(...place(lamp, x, z, ROT[0], 0));
  out.push(...place(SIGNPOST, PLAZA_SIGN[0], PLAZA_SIGN[1], ROT[0], 0), ...place(SIGNPOST, SHOP_SIGN[0], SHOP_SIGN[1], ROT[0], 0));
  // life round the ring: a bench facing the plaza and a pot of flowers just outside the ring path,
  // between the paths in (never on one)
  for (const { x, z, yaw, bench: isBench, k } of RING_SEATS) out.push(...place(isBench ? bench : flowerPot([COL.red, COL.yellow, COL.pink][k % 3]), x, z, yawMat(yaw), 0));
  out.push(...playgroundText());
  return modelText(out, "town-decor.ldr");
}

// ---- the lake's life (the renderer moves these): two rowing boats and a duck ----
/** a rowing boat about its own centre, floating: a round-cornered hull and a seat */
export const boatSlabs = (color: string): Slab[] => [
  { x: 0, z: 0, w: 6 * S, d: 3 * S, h: 14, y: 1, radius: 28, color },
  { x: 0, z: 0, w: 2 * S, d: 2.4 * S, h: 6, y: 15, color: "#a0703c" },
];
export const BOATS: { dx: number; dz: number; yaw: number; color: string }[] = [
  { dx: -120, dz: -90, yaw: 0.7, color: "#c4281c" },
  { dx: 150, dz: 120, yaw: -0.4, color: "#f2f2ee" },
];
export const duckText = () => modelText(place([["49661", COL.yellow, 0, -2, 0]], 0, 0, ROT[0], 0), "duck.ldr");

// ---- meadows: round patches of a slightly different green, in the gaps and under the woods ----
export function meadows(): { x: number; z: number; r: number; k: number }[] {
  const out: { x: number; z: number; r: number; k: number }[] = [];
  const rnd = seeded(31);
  const lots = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotFor(i));
  const paths = lots.map((lot) => lotPath(lot, 3));
  for (let tries = 0; tries < 300 && out.length < 26; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = (RING + 30 + rnd() * (TOWN_HALF + 60 - RING - 30)) * S;
    const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
    const size = (18 + rnd() * 26) * S;
    if (lots.some((lot) => nearLot(x, z, lot, size))) continue;
    if (paths.some((p) => toPath(x, z, p) < size) || toPath(x, z, TRACK) < size || ROADS.some((p) => toPath(x, z, p) < size + 10 * S)) continue;
    if (toPath(x, z, RIVER) < size + 12 * S || toPath(x, z, BROOK) < size + 8 * S || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + size) continue;
    if (Math.hypot(x - PLAYGROUND[0], z - PLAYGROUND[1]) < size + 200 || Math.hypot(x - WATER_TOWER[0], z - WATER_TOWER[1]) < size + 120) continue;
    if (out.some((m) => Math.hypot(m.x - x, m.z - z) < m.r + size)) continue;
    out.push({ x, z, r: size, k: Math.floor(rnd() * 3) });
  }
  return out;
}

/** the open ground at (x, z) LDU, for the real studs laid round the player: -1 on anything flat
 *  (plaza, paths, roads, water, the roundabout), 0 on grass, 1..3 on a meadow (its shade + 1) */
export function openGround(x: number, z: number): number {
  if (Math.abs(x) < (PLAZA / 2 + 1) * S && Math.abs(z) < (PLAZA / 2 + 1) * S) return -1;
  if (Math.abs(Math.hypot(x, z) - RING_R) < (PATH_W / 2 + 1) * S) return -1;
  if (LOT_PATHS.some((p) => toPath(x, z, p) < (PATH_W / 2 + 1) * S) || toPath(x, z, TRACK) < (PATH_W / 2 + 1) * S) return -1;
  if (toPath(x, z, SPUR) < (PATH_W / 2 + 1) * S) return -1;
  if (ROADS.some((p) => toPath(x, z, p) < (ROAD_OUT / 2 + 3) * S)) return -1;
  if (toPath(x, z, RIVER) < (RIVER_W / 2 + 4) * S || toPath(x, z, BROOK) < 7 * S) return -1;
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4 * S) return -1;
  if (Math.hypot(x - ROUNDABOUT[0], z - ROUNDABOUT[1]) < ROUND_R + (ROAD_OUT + 1) * S) return -1;
  for (const m of MEADOWS) if (Math.hypot(x - m.x, z - m.z) < m.r) return m.k + 1;
  return 0;
}
const LOT_PATHS = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotPath(lotFor(i), 3));
const SPUR: P3[] = [nearestStreet([ROUNDABOUT[0], 0, ROUNDABOUT[1]]), [ROUNDABOUT[0], 0, ROUNDABOUT[1]]];

// ---- landmarks between the houses: a playground and a water tower ----
const at = (deg: number, r: number): [number, number] => [Math.sin((deg * Math.PI) / 180) * r * S, Math.cos((deg * Math.PI) / 180) * r * S];
export const PLAYGROUND = at(300, 74); // in the gap between two houses, off the ring
export const WATER_TOWER = at(18, 165); // at the village's edge, seen from everywhere
const PITCH_X = (a: number): Mat => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)]; // a lean about X
// swings (two round-brick towers, a bar, two seats), a slide (steps up, a plate leaning
// down), a sandbox (a tan plate with a brick rim)
const PLAYGROUND_PIECES: Piece[] = [
  ...stack("3062b", COL.red, -80, -60, 5),
  ...stack("3062b", COL.red, 80, -60, 5),
  ["3010", COL.red, -40, 120, -60],
  ["3010", COL.red, 40, 120, -60],
  ["3068b", COL.yellow, -35, 40, -60],
  ["3068b", COL.blue, 35, 40, -60],
  ...stack("3005", COL.blue, 120, 60, 1),
  ...stack("3005", COL.blue, 120, 40, 2),
  ...stack("3005", COL.blue, 120, 20, 3),
  ["3795", COL.yellow, 120, 60, -40, PITCH_X(0.6)],
  ["3958", COL.tan, -110, 0, 60],
  ["3010", COL.reddishBrown, -110, 8, 10],
  ["3010", COL.reddishBrown, -110, 8, 110],
  ["3010", COL.reddishBrown, -160, 8, 60, ROT[90]],
  ["3010", COL.reddishBrown, -60, 8, 60, ROT[90]],
];
export function playgroundText(): string[] {
  return place(PLAYGROUND_PIECES, PLAYGROUND[0], PLAYGROUND[1], yawMat((300 * Math.PI) / 180 + Math.PI), 0);
}
// the water tower: four grey legs, a blue tank, a lid (slabs the renderer stacks)
export function waterTowerSlabs(): Slab[] {
  const [x, z] = WATER_TOWER;
  const out: Slab[] = [];
  for (const [dx, dz] of [[-55, -55], [55, -55], [-55, 55], [55, 55]]) out.push({ x: x + dx, z: z + dz, w: 10, d: 10, h: 300, y: 0, color: "#6d6e6c" });
  out.push({ x, z, w: 0, d: 0, r: 70, h: 8, y: 300, color: "#6d6e6c" });
  out.push({ x, z, w: 0, d: 0, r: 95, h: 130, y: 308, color: "#0055bf" });
  out.push({ x, z, w: 0, d: 0, r: 100, h: 12, y: 438, color: "#f2f2ee" });
  out.push({ x, z, w: 0, d: 0, r: 30, h: 30, y: 450, color: "#f2f2ee" });
  return out;
}

/** the benches and flower pots round the ring: where each stands (LDU) and its turn (its front to the plaza) */
export const RING_SEATS: { x: number; z: number; yaw: number; bench: boolean; k: number }[] = (() => {
  const paths = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotPath(lotFor(i), 3));
  const busy = (x: number, z: number) => paths.some((pth) => toPath(x, z, pth) < 7 * S) || toPath(x, z, TRACK) < 7 * S;
  const out: { x: number; z: number; yaw: number; bench: boolean; k: number }[] = [];
  for (let k = 0; k < 12; k++) {
    const a = ((k + 0.5) / 12) * Math.PI * 2;
    const r = (RING + PATH_W / 2 + 3) * S;
    const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
    if (!busy(x, z)) out.push({ x, z, yaw: a + Math.PI, bench: k % 2 === 1, k });
  }
  return out;
})();

export const MEADOWS = meadows(); // (after the landmarks: it keeps off them)

// ---- signs: how the game works, told where it happens ----
// A LEGO signpost (a round post with a tile on top) stands where a newcomer needs the
// one line that explains the place; walk up to it and the line appears over it.
// a signpost: three round bricks and a 2x4 board on top, a tile each way so it reads from both sides
const SIGNPOST: Piece[] = [
  ...stack("3062b", COL.reddishBrown, 0, 0, 3),
  ["87079", COL.white, 0, 72, 4, ON_WALL],
  ["87079", COL.white, 0, 72, -4, turnMat(ROT[180], ON_WALL)],
];
/** by the ring where the path from your house comes in (LDU) */
export const PLAZA_SIGN: [number, number] = [90, -(RING - 5) * S];
/** to the right of the shop's front (LDU) */
export const SHOP_SIGN: [number, number] = [190, 250];
/** a plot's gate sign, beside where its path starts (plot frame, LDU) */
export function gateSignAt(s: HouseSpec): [number, number] {
  return [(doorCells(s)[1] + 4 - PLOT / 2) * S, (PLOT / 2 + 5) * S];
}
export const SIGN_LINES = {
  plaza: "Level up in real life. Your minifig levels up here.",
  gate: "Every real thing you do is a station. Do it, tap it: XP and gold.",
  shop: "Gold from real life buys bricks for your garden.",
  friend: "Gold studs over their stations: what they did today.",
};

// ---- walking round town ----
// Everyone walks the gravel ring round the plaza (RING studs out) and the paths off it,
// one to each house; the cars keep to the road round the village. A place is a chain of
// points from the ring (first) to where you stand (last), so a walk is: back along your
// chain to where it meets the new one (the ring, if they share nothing), round the ring
// if need be, and on down the new chain.
export type P3 = [number, number, number];
/** from the ring, along the path, to your spot at a lot's door; `side` steps along the door (so you stand beside its owner) */
export function doorWalk(lot: Lot, level: number, side = 0): P3[] {
  const [u, y, w] = minifigSpot(houseSpec(level));
  const path = lotPath(lot, level);
  return [...path, inLot(lot, [u + side, y, w])];
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
/** the joggers' loop: laps of the gravel ring round the plaza, on its inner edge (clear of
 *  the walkers on its middle); returns where you are `d` LDU round and which way you face */
export function jogAt(d: number): { at: P3; heading: number } {
  const r = RING_R - 50;
  const a = -d / r; // clockwise, seen from above
  return { at: [Math.sin(a) * r, 0, Math.cos(a) * r], heading: Math.atan2(-Math.cos(a), Math.sin(a)) };
}
/** where a resident's ride is parked: in the street in front of their plot, just off the
 *  pavement and ending beside the walk from their door (the ride runs off away from it) */
export function rideSpot(lot: Lot, level: number): P3 {
  const [u] = minifigSpot(houseSpec(level));
  return inLot(lot, [u - 5 * S, 0, (PLOT / 2 + 4) * S + 10]);
}
/** from the ring on the plaza's left, between the planters and the bench, to the shop's front;
 *  `k` of 0..3 stands further along the front (so friends shopping don't stand in each other) */
export const shopWalk = (k = 0): P3[] => [nearestStreet([-150, 0, 290]), [-150, 0, 290], [-120 + 45 * k, 0, 222]]; // outside the strollers' circle
export const SHOP_WALK = shopWalk(0);
/** on the ring round the plaza? */
export const onRing = (p: P3) => Math.abs(Math.hypot(p[0], p[2]) - RING_R) < 1;
const same = (p: P3, q: P3) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1;
/** the way round the ring between two points on it: a point every few steps, the short way */
export function streetLink(p: P3, q: P3): P3[] {
  const [a0, a1] = [Math.atan2(p[0], p[2]), Math.atan2(q[0], q[2])];
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const n = Math.ceil(Math.abs(d) / (Math.PI / 10));
  const out: P3[] = [];
  for (let k = 1; k < n; k++) {
    const a = a0 + (d * k) / n;
    out.push([Math.sin(a) * RING_R, 0, Math.cos(a) * RING_R]);
  }
  return out;
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
// ---- walking where you like (the joystick) ----
// What you can't walk through: houses and the shop (boxes), the fountain (a
// circle), and the edge of the town. LDU, town frame.
export type Blocker =
  | { x0: number; z0: number; x1: number; z1: number }
  | { cx: number; cz: number; r: number }
  | { cx: number; cz: number; hw: number; hd: number; yaw: number }; // a box turned about Y, half sizes
export function townBlockers(residents: Resident[]): Blocker[] {
  const out: Blocker[] = residents.slice(0, MAX_RESIDENTS).map((r, i) => {
    const lot = lotFor(i);
    const h = houseFor(r.level, r.name);
    const [hx, , hz] = houseAt(houseSpec(r.level), h);
    const [cx, , cz] = inLot(lot, [hx + (h.w * S) / 2, 0, hz - (h.d * S) / 2]);
    return { cx, cz, hw: (h.w * S) / 2 - 10, hd: (h.d * S) / 2 - 10, yaw: lot.yaw };
  });
  residents.slice(0, MAX_RESIDENTS).forEach((r, i) => {
    const lot = lotFor(i);
    const spots = stationSpots(houseSpec(r.level));
    (r.stations ?? []).slice(0, spots.length).forEach((_, k) => {
      const [x, z] = stationAt(spots[k]);
      const [cx, , cz] = inLot(lot, [x, 0, z]);
      out.push({ cx, cz, hw: 55, hd: 55, yaw: lot.yaw });
    });
  });
  const shop = SHOP as House;
  out.push({ x0: (-shop.w / 2) * S + 10, x1: (shop.w / 2) * S - 10, z0: SHOP_FRONT - shop.d * S, z1: SHOP_FRONT - 10 });
  out.push({ cx: FOUNTAIN[0], cz: FOUNTAIN[1], r: 95 });
  out.push({ cx: PLAZA_SIGN[0], cz: PLAZA_SIGN[1], r: 22 }, { cx: SHOP_SIGN[0], cz: SHOP_SIGN[1], r: 22 });
  out.push({ cx: PLAYGROUND[0], cz: PLAYGROUND[1], r: 200 }, { cx: WATER_TOWER[0], cz: WATER_TOWER[1], r: 110 });
  residents.slice(0, MAX_RESIDENTS).forEach((r, i) => {
    const [gx, gz] = gateSignAt(houseSpec(r.level));
    const [cx, , cz] = inLot(lotFor(i), [gx, 0, gz]);
    out.push({ cx, cz, r: 22 });
  });
  for (const h of plotHedges()) out.push({ cx: h.x, cz: h.z, hw: h.w / 2 + 8, hd: h.d / 2 + 8, yaw: h.yaw ?? 0 });
  return out;
}
const EDGE = (TOWN_HALF - 4) * S;
/** can you stand here? */
export function free(x: number, z: number, blockers: Blocker[]): boolean {
  if (Math.hypot(x, z) > EDGE) return false;
  return !blockers.some((b) => {
    if ("yaw" in b) {
      const [c, s] = [Math.cos(b.yaw), Math.sin(b.yaw)];
      const [rx, rz] = [x - b.cx, z - b.cz];
      return Math.abs(c * rx - s * rz) < b.hw && Math.abs(s * rx + c * rz) < b.hd;
    }
    return "r" in b ? (x - b.cx) ** 2 + (z - b.cz) ** 2 < b.r * b.r : x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  });
}
/** a step from (x, z) by (dx, dz), sliding along whatever is in the way */
export function stepFree(x: number, z: number, dx: number, dz: number, blockers: Blocker[]): [number, number] {
  if (free(x + dx, z + dz, blockers)) return [x + dx, z + dz];
  if (free(x + dx, z, blockers)) return [x + dx, z];
  if (free(x, z + dz, blockers)) return [x, z + dz];
  return [x, z];
}
/** the nearest point on the ring round the plaza (where walks begin and end) */
export function nearestStreet([x, , z]: P3): P3 {
  const r = Math.hypot(x, z) || 1;
  return [(x / r) * RING_R, 0, (z / r) * RING_R];
}
/** a walk from wherever you are (after driving yourself about) to a place: straight
 *  there if it's close by, otherwise out to the street, along, and in */
export function walkFrom(pos: P3, to: P3[]): Route {
  const here = [nearestStreet(pos), pos];
  if (Math.hypot(to[1][0] - pos[0], to[1][2] - pos[2]) < 520)
    return { pts: [pos, ...to.slice(1)], chains: [here, ...to.slice(1).map((_, k) => to.slice(0, k + 2))] };
  return walkRoute(here, to);
}

// ---- people keep out of each other's way ----
// Everyone who moves writes where they are (LDraw x, z) here every frame.
// Walking along, people sidestep anyone in their path (an offset that pushes
// them apart and eases back onto their path once clear); driving yourself, you
// can't walk into people, you go round them.
export const CROWD = new Map<string, { x: number; z: number }>();
export const PERSON = 24; // LDU: about a minifig's width from arm to arm, halved
export function sidestep(id: string, x: number, z: number, off: { x: number; z: number }, dt: number): [number, number] {
  let px = 0;
  let pz = 0;
  for (const [k, p] of CROWD) {
    if (k === id) continue;
    const dx = x + off.x - p.x;
    const dz = z + off.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01 || d > PERSON * 2) continue;
    const w = 1 - d / (PERSON * 2); // the closer, the harder the push
    px += (dx / d) * w;
    pz += (dz / d) * w;
  }
  const k = Math.min(1, dt * 6);
  off.x += (px * 60 - off.x * (px || pz ? 0.2 : 1)) * k;
  off.z += (pz * 60 - off.z * (px || pz ? 0.2 : 1)) * k;
  const m = Math.hypot(off.x, off.z);
  if (m > 55) [off.x, off.z] = [(off.x / m) * 55, (off.z / m) * 55];
  return [x + off.x, z + off.z];
}
/** would stepping from (ox, oz) to (nx, nz) walk into someone? (moving away from them is fine) */
export function intoSomeone(id: string, ox: number, oz: number, nx: number, nz: number) {
  for (const [k, p] of CROWD) {
    if (k === id) continue;
    const dn = Math.hypot(nx - p.x, nz - p.z);
    if (dn < PERSON * 1.7 && dn < Math.hypot(ox - p.x, oz - p.z)) return true;
  }
  return false;
}

/** turn round mid-walk at `pos` on segment `i` of `r` */
export function rerouteFrom(r: Route, i: number, pos: P3, to: P3[]): Route {
  const [a, b] = [r.chains[i], r.chains[i + 1]];
  // on the street, or somewhere down the chain nearer the street
  const here = a.length === 1 && b.length === 1 ? [pos] : [...(a.length < b.length ? a : b), pos];
  return walkRoute(here, to);
}

// ---- the garden shop: buy a thing, put it where you like on your plot, watch it build ----
// Each item is a footprint in studs and either LDraw pieces (its own frame,
// centred, +z its front) or an official set baked as a prop. Prices are the
// server's (shop_items); these are the defaults the migration seeds.
export type GardenItem = { id: string; name: string; price: number; w: number; d: number; pieces?: Piece[]; prop?: string };
const propSize = (id: string) => (PROPS as { id: string; w: number; d: number }[]).find((p) => p.id === id) ?? { w: 6, d: 6 };
export const GARDEN: GardenItem[] = [
  { id: "g-pot", name: "Flower pot", price: 30, w: 2, d: 2, pieces: flowerPot(COL.red) },
  { id: "g-flowers", name: "Flower bed", price: 40, w: 4, d: 2, pieces: [-30, -10, 10, 30].map((dx, k) => ["3741ac05", [COL.red, COL.yellow, COL.pink, COL.white][k], dx, 0, 0] as Piece) },
  { id: "g-pine", name: "Pine tree", price: 60, w: 2, d: 2, pieces: [["3471", COL.darkGreen, 0, 0, 0]] },
  { id: "g-bench", name: "Bench", price: 60, w: 4, d: 2, pieces: bench },
  { id: "g-planter", name: "Planter", price: 70, w: 2, d: 2, pieces: planterTree },
  { id: "g-tree", name: "Apple tree", price: 80, w: 2, d: 2, pieces: [["2435", COL.green, 0, 0, 0]] },
  { id: "g-lamp", name: "Lamp post", price: 120, w: 2, d: 2, pieces: lamp },
  { id: "g-pond", name: "Pond", price: 250, w: 10, d: 8, pieces: POND },
  { id: "g-cart", name: "Ice cream cart", price: 300, ...propSize("6601-1"), prop: "6601-1" },
  { id: "g-burger", name: "Burger stand", price: 400, ...propSize("6683-1"), prop: "6683-1" },
];
export const gardenItem = (id: string) => GARDEN.find((g) => g.id === id);
/** something placed on a plot: the item, its footprint's near-left cell (studs, 0..47) and quarter turns */
export type Placed = { item: string; x: number; z: number; turn: number };
/** the footprint's size once turned */
export const footprint = (g: GardenItem, turn: number) => (turn % 2 ? { w: g.d, d: g.w } : { w: g.w, d: g.d });
/** the item's LDraw lines in the plot's frame (its centre on the footprint's centre, on the ground) */
export function gardenItemLines(p: Placed): string[] {
  const g = gardenItem(p.item);
  if (!g?.pieces) return [];
  const { w, d } = footprint(g, p.turn);
  const x = (p.x + w / 2 - PLOT / 2) * S;
  const z = (p.z + d / 2 - PLOT / 2) * S;
  return place(g.pieces, x, z, ROT[([0, 90, 180, 270] as const)[p.turn % 4]], 0);
}
/** where a placed prop's centre is in the plot frame (LDU) */
export function gardenPropAt(p: Placed): [number, number] {
  const g = gardenItem(p.item)!;
  const { w, d } = footprint(g, p.turn);
  return [(p.x + w / 2 - PLOT / 2) * S, (p.z + d / 2 - PLOT / 2) * S];
}
// Where you can't put things: the house (with a stud round it), the path from
// the door to the street, the front two rows (hedge and kerb), the garden's
// own pond, every station's spot (whether a mission stands there yet or not),
// and anything already placed; and it must be on the plot.
type Box = { x0: number; z0: number; x1: number; z1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
export function blockedOnPlot(level: number, streak: number, placed: Placed[], except?: Placed): Box[] {
  const s = houseSpec(level);
  const door = doorCells(s);
  const out: Box[] = [
    { x0: s.x0 - 1, z0: s.z0 - 1, x1: s.x0 + s.w + 1, z1: s.z0 + s.d + 1 },
    { x0: door[1] - 1, z0: s.z0 + s.d, x1: door[1] + 3, z1: PLOT },
    { x0: 0, z0: PLOT - 3, x1: PLOT, z1: PLOT },
  ];
  const h = STATION_SIZE / 2;
  for (const q of stationSpots(s)) out.push({ x0: q.x - h, z0: q.z - h, x1: q.x + h, z1: q.z + h });
  if (streak >= POND_STREAK) {
    const [px, pz] = GARDEN_POND;
    out.push({ x0: px / S + PLOT / 2 - 6, z0: pz / S + PLOT / 2 - 5, x1: px / S + PLOT / 2 + 6, z1: pz / S + PLOT / 2 + 5 });
  }
  for (const q of placed) {
    if (q === except) continue;
    const g = gardenItem(q.item);
    if (!g) continue;
    const { w, d } = footprint(g, q.turn);
    out.push({ x0: q.x, z0: q.z, x1: q.x + w, z1: q.z + d });
  }
  return out;
}
/** `moving`: the placed thing being moved, which doesn't block itself */
export function canPlace(p: Placed, level: number, streak: number, placed: Placed[], moving?: Placed): boolean {
  const g = gardenItem(p.item);
  if (!g) return false;
  const { w, d } = footprint(g, p.turn);
  const box: Box = { x0: p.x, z0: p.z, x1: p.x + w, z1: p.z + d };
  if (box.x0 < 1 || box.z0 < 1 || box.x1 > PLOT - 1 || box.z1 > PLOT - 1) return false;
  return !blockedOnPlot(level, streak, placed, moving).some((b) => overlaps(b, box));
}
/** a free spot to start placing from: the first that fits (either way round), scanning from the
 *  front of the garden; null when nothing fits (a big thing on a full plot) */
export function firstFreeSpot(item: string, level: number, streak: number, placed: Placed[]): Placed | null {
  const g = gardenItem(item)!;
  for (const turn of [0, 1]) {
    const { w, d } = footprint(g, turn);
    for (let z = PLOT - 4 - d; z >= 1; z -= 2)
      for (let x = 1; x + w <= PLOT - 1; x += 2) {
        const p = { item, x, z, turn };
        if (canPlace(p, level, streak, placed)) return p;
      }
  }
  return null;
}

/** a shop item on its own at the origin (LDraw lines), for its picture: a garden thing's
 *  pieces or a piece of room furniture; null for an official set (a baked prop) */
export function itemPreviewLines(id: string): string[] | null {
  const g = gardenItem(id);
  if (g) return g.pieces ? place(g.pieces, 0, 0, ROT[0], 0) : null;
  if (id === "indoor-trees") return place([["3941", COL.darkOrange, 0, 0, 0], ["2435", COL.green, 0, 24, 0]], 0, 0, ROT[0], 0); // the room plants them itself
  const d = DECOR.find((x) => x.id === id);
  return d ? place(d.pieces, 0, 0, ROT[0], 0) : null;
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
// open to the camera. It's your home: the chest, the starter furniture and
// what you buy at the shop (your stations are outside, round the house).
const ROOM = 320; // half the room, LDU
const WALL = 240; // ten bricks

// the starter furniture (plot frame pieces, see place()): the rug is a 6x16 plate with
// tan corner tiles and two cushions; the table for two has round legs, mugs and chairs
const RUG: Piece[] = [
  ["3027", COL.darkRed, 0, 0, 0],
  ...[-140, 140].flatMap((dx) => [-40, 40].map((dz) => ["3068b", COL.tan, dx, 8, dz] as Piece)),
  ["3022", COL.yellow, -100, 8, 0],
  ["3022", COL.blue, 100, 8, 0],
];
export const DINING_AT: [number, number] = [20, 150];
const DINING: Piece[] = [
  ...[-30, 30].flatMap((dx) => [-30, 30].map((dz) => ["3062b", COL.reddishBrown, dx, 0, dz] as Piece)),
  ["3032", COL.reddishBrown, 0, 24, 0],
  ["3062b", COL.white, -20, 32, -10],
  ["3062b", COL.white, 20, 32, 10],
  ["33051", COL.red, 0, 32, 0],
  ["3062b", COL.darkGrey, -80, 0, 0],
  ["4079", COL.red, -80, 24, 0, ROT[270]],
  ["3062b", COL.darkGrey, 80, 0, 0],
  ["4079", COL.red, 80, 24, 0, ROT[90]],
];
// a shelf on the wall (its top at -150): a 2x6 plate out of the wall, a mug and a plant on it
const SHELF: Piece[] = [["3795", COL.reddishBrown, 0, -8, 0, ALONG_Z], ["3062b", COL.white, 0, 0, -30], ["3941", COL.darkOrange, 0, 0, 20], ["3741ac05", COL.pink, 0, 24, 20]];
const SHELVES: [number, number, Mat][] = [
  [ROOM - 30, -60, ROT[270]],
  [-(ROOM - 30), 100, ROT[90]],
];
// where you first stand in your room (LDU): just in from the doormat
export const ROOM_START: [number, number] = [-40, 240];

// What you can't walk through in your room: the walls, the table, the chest, the
// plants and what you've bought.
export function roomBlockers(owned: string[] = []): Blocker[] {
  const big = 9999;
  const w = ROOM - 25;
  const out: Blocker[] = [
    { x0: w, x1: big, z0: -big, z1: big },
    { x0: -big, x1: -w, z0: -big, z1: big },
    { x0: -big, x1: big, z0: -big, z1: -w },
    { x0: -big, x1: big, z0: ROOM - 12, z1: big },
    { x0: DINING_AT[0] - 120, x1: DINING_AT[0] + 120, z0: DINING_AT[1] - 45, z1: DINING_AT[1] + 45 },
    { cx: CHEST_SPOT[0], cz: CHEST_SPOT[1], r: 50 },
    { cx: -265, cz: 275, r: 32 },
    { cx: 265, cz: 275, r: 32 },
  ];
  for (const d of DECOR) if (owned.includes(d.id) && d.pieces.length) out.push({ cx: d.at[0], cz: d.at[1], r: d.id === "cat" ? 18 : 50 });
  return out;
}

export function roomText(owned: string[] = []): string {
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
  // a dark skirting board along the foot of every wall (1x2 tiles on the planks)
  for (let k = 0; k < 16; k++) {
    const t = -ROOM + 20 + k * 40;
    out.push(line(COL.reddishBrown, t, -16, -ROOM + 10, ROT[0], "3069b"));
    for (const side of [-1, 1]) out.push(line(COL.reddishBrown, side * (ROOM - 10), -16, t, ROT[90], "3069b"));
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
  // the starter house: a big rug with cushions in the middle, a table for two in front of
  // it, a doormat at the open front, plants in the front corners, shelves, pictures and
  // a clock on the walls
  out.push(...place(RUG, 0, 40, ROT[0]), ...place(DINING, DINING_AT[0], DINING_AT[1], ROT[0]));
  out.push(line(COL.tan, 0, FLOOR - 8, 292, ROT[0], "3020")); // the doormat
  for (const [x, z, f] of SHELVES) out.push(...place(SHELF, x, z, f, -150));
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
  out.push(picture("14769p0f", ROOM - 28, -170, ROT[270])); // the clock

  // the chest, where what your watch earned waits to be collected
  out.push(...place([["4738a", COL.reddishBrown, 0, 0, 0], ["4739a", COL.reddishBrown, 0, 32, 0]], CHEST_SPOT[0], CHEST_SPOT[1], ROT[180]));
  return modelText(out, "room.ldr");
}
