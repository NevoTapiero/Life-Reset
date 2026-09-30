import HOUSES from "./legoHouses.json" with { type: "json" };

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
export type House = { id: string; name: string; w: number; d: number; h: number };
export const houseFor = (level: number): House => (HOUSES as House[])[Math.min(Math.max(level, 1), HOUSES.length) - 1];
export const houseUrl = (h: House) => `/lego/houses/${h.id}.glb`;

// The house's footprint on the plot, in cells: centred left to right, as far
// back as leaves the garden 12 rows (or against the back edge if it's deep).
export type HouseSpec = { x0: number; z0: number; w: number; d: number };
export function houseSpec(level: number): HouseSpec {
  const { w, d } = houseFor(level);
  return { x0: Math.floor((PLOT - w) / 2), z0: Math.max(1, PLOT - d - 12), w, d };
}

// Where the house model goes (LDU): its left edge on x0, its front on the spec's front.
export function houseAt(s: HouseSpec): [number, number, number] {
  return [(s.x0 - PLOT / 2) * S, 0, (s.z0 + s.d - PLOT / 2) * S];
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

// A standalone minifig model, torso origin at 0, soles at y = 0, facing +Z.
// Its lines come out in MINIFIG_PARTS order so the renderer can find the head.
export function buildMinifig(look: MinifigLook): string[] {
  const R = ROT[180];
  return MINIFIG.map(({ part, slot, at, m }) => {
    const [x, y, z] = at;
    // turn the whole figure 180 degrees about Y: rotate the offset and the matrix
    const p: [number, number, number] = [R[0] * x + R[2] * z, y - FEET, R[6] * x + R[8] * z];
    const mm: Mat = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) mm[i * 3 + j] = R[i * 3] * m[j] + R[i * 3 + 1] * m[3 + j] + R[i * 3 + 2] * m[6 + j];
    return line(look[slot], p[0], p[1], p[2], mm, part);
  });
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

// ponytail: one straight street, plots side by side; a grid of streets when towns get big
// Plot i's centre on x (LDU): the plots sit side by side, centred on the middle one.
export const plotX = (i: number, n: number) => (i - (n - 1) / 2) * PLOT * S;

// The town as one LDraw file: each plot is its own submodel, placed along x,
// with a grey street of 16x16 plates, flush with the baseplates, in front (+Z).
export function townText(residents: Resident[]): string {
  const count = residents.length;
  const main = residents.flatMap((_, i) => [
    `1 16 ${n(plotX(i, count))} 0 0 1 0 0 0 1 0 0 0 1 plot-${i}.ldr`,
    ...[-16, 0, 16].map((dx) => line(COL.darkGrey, plotX(i, count) + dx * S, 0, (PLOT / 2 + 8) * S, ROT[0], "91405")),
  ]);
  const plots = residents.map((r, i) =>
    modelText([baseplate(), ...buildGarden(r.streak, houseSpec(r.level))], `plot-${i}.ldr`),
  );
  return [modelText([...main, ...townLand(count)], "town.ldr"), ...plots].join("");
}

// ---- the land around the town -------------------------------------------

// The street's extent in LDU: x across every plot, z from the back fence to
// the far side of the street. The camera may not leave it.
export function townBounds(count: number) {
  return { x0: plotX(0, count), x1: plotX(count - 1, count), zBack: (-PLOT / 2) * S, zFront: (PLOT / 2 + 16) * S };
}

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

// Everything outside the plots: a spindled fence along the back of the street,
// then meadow and a forest all around (baseplates of grass, trees and bushes)
// that you can see but not walk into -- the edge of your world.
export function townLand(count: number): string[] {
  const out: string[] = [];
  const P = PLOT * S;
  const { x0, x1 } = townBounds(count);
  const left = x0 - P / 2;
  const right = x1 + P / 2;

  // the fence, on the last row of every plot
  for (let x = left + 40; x < right; x += 80) out.push(line(COL.reddishBrown, x, -BOTTOM["30055"], -P / 2 + 10, ROT[0], "30055"));

  // grass: a ring of baseplates one plot deep around the street
  const zStreet = P / 2 + 8 * S;
  const ground: [number, number][] = [];
  for (let i = -1; i <= count; i++) {
    const x = plotX(i, count);
    ground.push([x, -P], [x, P + 16 * S]);
    if (i === -1 || i === count) ground.push([x, 0]);
  }
  for (const [x, z] of ground) out.push(line(COL.green, x, 0, z, ROT[0], "4186"));
  // the street's two ends are grass too
  for (const x of [plotX(-1, count), plotX(count, count)]) for (const dx of [-16, 0, 16]) out.push(line(COL.green, x + dx * S, 0, zStreet, ROT[0], "91405"));

  // the forest: thick behind and at the ends, starting beyond a strip of meadow
  // in front so it never hides the houses from the camera
  const rnd = seeded(7);
  for (const [gx, gz] of ground) {
    const front = gz > 0;
    const n = front ? 10 : 22;
    for (let k = 0; k < n; k++) {
      const t = TREES[Math.floor(rnd() * TREES.length)];
      const x = gx + (rnd() - 0.5) * (P - 60);
      const z = front ? gz + rnd() * (P / 2 - 40) : gz + (rnd() - 0.5) * (P - 60);
      const rot = ([0, 90, 180, 270] as const)[Math.floor(rnd() * 4)];
      out.push(line(t.color, Math.round(x / S) * S, -BOTTOM[t.part], Math.round(z / S) * S, ROT[rot], t.part));
    }
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

// Each pillar's station: a 4x4 plate in its colour with a prop on top, turned
// to face into the room. `top` is the plate's upper surface (LDraw -Y is up).
const LAY_FLAT: Mat = [0, -1, 0, 1, 0, 0, 0, 0, 1]; // a quarter turn about Z
type Place = (color: number, dx: number, y: number, dz: number, m: Mat, part: string) => string;
const STATION_LOOK: Record<string, { colour: number; props: (put: Place, top: number) => string[] }> = {
  Strength: { colour: COL.red, props: (put, top) => [put(COL.darkGrey, 0, top - 11, 0, LAY_FLAT, "29592")] },
  Focus: {
    colour: COL.blue,
    props: (put, top) => [put(COL.darkGrey, 0, top - 24, 0, ROT[0], "3003"), put(COL.lightGrey, 0, top - 25, 0, ROT[180], "62698-f2")],
  },
  Constitution: { colour: COL.green, props: (put, top) => [put(COL.red, 6, top, 0, ROT[0], "33051")] },
  Discipline: {
    colour: COL.orange,
    props: (put, top) => [put(COL.white, 0, top - 24, 0, ROT[0], "3003"), put(COL.white, 0, top - 32, 0, ROT[0], "14769p0f")],
  },
  Wisdom: { colour: COL.purple, props: (put, top) => [put(COL.reddishBrown, 0, top - 96, 10, ROT[180], "1")] },
};

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

export function roomText(stations: Station[]): string {
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
  stations.slice(0, MAX_STATIONS).forEach((st, i) => {
    const [x, z] = stationSpot(i);
    const f = stationFacing(i);
    const look = STATION_LOOK[st.pillar] ?? STATION_LOOK.Discipline;
    // place a prop at an offset from the station's centre, turned with it
    const put: Place = (color, dx, y, dz, m, part) => line(color, x + f[0] * dx + f[2] * dz, y, z + f[6] * dx + f[8] * dz, turnMat(f, m), part);
    // a rug in the pillar's colour on the planks, the prop on it
    out.push(line(look.colour, x, -16, z, ROT[0], "3031"), ...look.props(put, -16));
  });
  return modelText(out, "room.ldr");
}
