// The plot, built from real LDraw parts (the community library that models
// every LEGO element). This file only writes LDraw text: which part, which
// colour, where. The renderer (components/LegoWorld.tsx) parses it with three's
// LDrawLoader against the parts packed by scripts/lego/pack.mjs.
//
// LDraw units: 1 stud = 20 LDU, 1 plate = 8, 1 brick = 24, and -Y is up.
// The plot is a 32x32 baseplate; cell (i, j) is a stud, 0..31 on x and z.
// The front of the house and the garden face +Z.

export const PLOT = 32;
const S = 20;
const PLATE = 8;

// LDraw colour codes
export const COL = {
  black: 0,
  blue: 1,
  green: 2,
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
  "3005": 24, "3004": 24, "3622": 24, "3010": 24, "3062b": 24,
  "3040b": 24, "3044b": 24,
  "3068b": 8, "3069b": 8, "3070b": 8,
  "60596": 144, "60592": 48, "3741ac05": 12, "3470": 8, "2435": 8,
};

// every part the world can use; scripts/lego/pack.mjs packs exactly these
export const LEGO_PARTS = [
  "3811", "3005", "3004", "3622", "3010", "3062b", "3040b", "3044b",
  "3068b", "3069b", "3070b", "60596", "60623", "60592", "60601",
  "3741ac05", "3470", "2435",
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

const BRICK_1XN: Record<number, string> = { 1: "3005", 2: "3004", 3: "3622", 4: "3010" };

// split consecutive cells into 1xN bricks, staggering the joints on odd layers
function runs(cells: number[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (const c of cells) {
    if (cur.length && c !== cur[cur.length - 1] + 1) {
      out.push(cur);
      cur = [];
    }
    cur.push(c);
  }
  if (cur.length) out.push(cur);
  return out;
}
function chunk(len: number, odd: boolean): number[] {
  const out: number[] = [];
  let left = len;
  let first = true;
  while (left > 0) {
    let take = left >= 4 ? 4 : left;
    if (first && odd && left >= 3) take = 2;
    else if (left === 5) take = 3;
    out.push(take);
    left -= take;
    first = false;
  }
  return out;
}

export type HouseSpec = { x0: number; z0: number; w: number; d: number; floors: number };

// House level 1..5. w and d stay even so the floor tiles and the roof ridge fit.
export function houseSpec(level: number): HouseSpec {
  if (level >= 5) return { x0: 9, z0: 4, w: 14, d: 10, floors: 2 };
  if (level >= 3) return { x0: 10, z0: 5, w: 12, d: 10, floors: 1 };
  return { x0: 11, z0: 6, w: 10, d: 8, floors: 1 };
}

export function doorCells(s: HouseSpec) {
  const dx = s.x0 + s.w / 2 - 2;
  return [dx, dx + 1, dx + 2, dx + 3];
}

export function buildHouse(level: number): string[] {
  const s = houseSpec(level);
  const out: string[] = [];
  const { x0, z0, w, d } = s;
  const front = z0 + d - 1;
  const back = z0;
  const left = x0;
  const right = x0 + w - 1;
  const door = doorCells(s);
  const layers = 6 * s.floors;

  // windows: [wall, first cell, layer] -- each is 2 cells wide and 2 bricks tall
  const windows: { wall: "front" | "back" | "left" | "right"; at: number; layer: number }[] = [];
  for (let f = 0; f < s.floors; f++) {
    const L = f * 6 + 2;
    windows.push({ wall: "front", at: x0 + 1, layer: L }, { wall: "front", at: right - 2, layer: L });
    if (f > 0) windows.push({ wall: "front", at: door[1], layer: L });
    windows.push({ wall: "back", at: x0 + 2, layer: L }, { wall: "back", at: right - 3, layer: L });
    windows.push({ wall: "left", at: z0 + d / 2 - 1, layer: L }, { wall: "right", at: z0 + d / 2 - 1, layer: L });
  }
  const inWindow = (wall: string, cell: number, L: number) =>
    windows.some((o) => o.wall === wall && L >= o.layer && L < o.layer + 2 && cell >= o.at && cell < o.at + 2);

  // floor: 2x2 tiles over the inside
  for (let x = x0 + 1; x < right; x += 2) for (let z = z0 + 1; z < front; z += 2) out.push(put("3068b", COL.tan, x + 0.5, z + 0.5, 0));

  for (let L = 0; L < layers; L++) {
    const odd = L % 2 === 1;
    const colour = L === 0 ? COL.lightGrey : COL.white;
    const plates = L * 3;
    // corners interlock: front/back own them on even layers, the sides on odd ones
    const xs: number[] = [];
    for (let x = odd ? x0 + 1 : x0; x <= (odd ? right - 1 : right); x++) xs.push(x);
    const zs: number[] = [];
    for (let z = odd ? back : back + 1; z <= (odd ? front : front - 1); z++) zs.push(z);

    for (const [wall, zRow] of [["front", front], ["back", back]] as const) {
      const cells = xs.filter((x) => !inWindow(wall, x, L) && !(wall === "front" && L < 6 && door.includes(x)));
      for (const r of runs(cells)) {
        let at = r[0];
        for (const len of chunk(r.length, odd)) {
          out.push(put(BRICK_1XN[len], colour, at + (len - 1) / 2, zRow, plates));
          at += len;
        }
      }
    }
    for (const [wall, xCol] of [["left", left], ["right", right]] as const) {
      const cells = zs.filter((z) => !inWindow(wall, z, L));
      for (const r of runs(cells)) {
        let at = r[0];
        for (const len of chunk(r.length, !odd)) {
          out.push(put(BRICK_1XN[len], colour, xCol, at + (len - 1) / 2, plates, 90));
          at += len;
        }
      }
    }
  }

  // door frame and door; parts face -Z, the house faces +Z, so both turn 180
  const doorU = door[0] + 1.5;
  const frame = put("60596", COL.white, doorU, front, 0, 180);
  out.push(frame);
  const fy = Number(frame.split(" ")[3]);
  out.push(line(COL.reddishBrown, (doorU - (PLOT - 1) / 2) * S + 30, fy, (front - (PLOT - 1) / 2) * S, ROT[180], "60623"));

  // windows with glass, facing outwards
  const facing = { front: 180, back: 0, left: 90, right: 270 } as const;
  for (const o of windows) {
    const alongX = o.wall === "front" || o.wall === "back";
    const u = alongX ? o.at + 0.5 : o.wall === "left" ? left : right;
    const v = alongX ? (o.wall === "front" ? front : back) : o.at + 0.5;
    const frameLine = put("60592", COL.white, u, v, o.layer * 3, facing[o.wall]);
    out.push(frameLine, frameLine.replace(/^1 \d+ /, `1 ${COL.transClear} `).replace("60592.dat", "60601.dat")); // the glass shares the frame's origin
  }

  // roof: 45-degree slopes stepping in one stud and up one brick per course,
  // a double slope on the ridge; the gable ends are filled with bricks
  const top = layers * 3;
  const courses = (d - 2) / 2;
  for (let k = 0; k <= courses; k++) {
    const plates = top + k * 3;
    for (let x = x0; x <= right; x++) {
      out.push(put("3040b", COL.red, x, front - k, plates, 180));
      out.push(put("3040b", COL.red, x, back + k, plates, 0));
    }
    // gable fill between the two high cells, on both side walls
    const zs: number[] = [];
    for (let z = back + k + 1; z <= front - k - 1; z++) zs.push(z);
    for (const xCol of [left, right])
      for (const r of runs(zs)) {
        let at = r[0];
        for (const len of chunk(r.length, k % 2 === 1)) {
          out.push(put(BRICK_1XN[len], COL.white, xCol, at + (len - 1) / 2, plates, 90));
          at += len;
        }
      }
  }
  for (let x = x0; x <= right; x++) out.push(put("3044b", COL.red, x, back + courses + 0.5, top + (courses + 1) * 3));
  return out;
}

// 3040b's origin is its high (studded) cell and it slopes down towards -Z; at
// 180 degrees it slopes towards +Z. Either way `put` centres on the high cell.

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
  return line(COL.green, 0, 0, 0, ROT[0], "3811");
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
// with a grey street of baseplates running in front of them (+Z).
export function townText(residents: Resident[]): string {
  const count = residents.length;
  const main = residents.flatMap((_, i) => [
    `1 16 ${n(plotX(i, count))} 0 0 1 0 0 0 1 0 0 0 1 plot-${i}.ldr`,
    line(COL.darkGrey, plotX(i, count), 0, PLOT * S, ROT[0], "3811"),
  ]);
  const plots = residents.map((r, i) =>
    modelText([baseplate(), ...buildHouse(r.level), ...buildGarden(r.streak, houseSpec(r.level))], `plot-${i}.ldr`),
  );
  return [modelText(main, "town.ldr"), ...plots].join("");
}
