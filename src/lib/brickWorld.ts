// The brick world as data. Everything -- baseplate, house, garden -- is a
// list of bricks on a stud grid, so an upgrade is literally more bricks.
// Units: x/z in studs, y in plates (a brick is 3 plates tall). Pure; the
// renderer lives in components/BrickWorld.tsx.

export type Brick = {
  x: number;
  z: number;
  y: number; // bottom, in plates; the baseplate top is 0
  w: number; // studs along x
  d: number; // studs along z
  h: number; // plates (3 = a brick, 1 = a plate)
  color: string;
  kind?: "box" | "tile" | "round" | "glass"; // tile: smooth top; round: a 1x1 round piece
};

export const PLATE = 0.4; // world units per plate; a stud is 1 unit wide
export const BRICK = 3;

export const C = {
  grass: "#4c9a3f",
  grassDark: "#3b7d31",
  path: "#9da3a8",
  wall: "#ece3cf",
  wallDark: "#d8ccb0",
  trim: "#6b4a2b",
  door: "#7a2a1f",
  roof: "#b33a2b",
  roofDark: "#8f2d22",
  glass: "#a8d8ff",
  trunk: "#6b4a2b",
  leaf: "#3f8f3a",
  leafLight: "#5fb04c",
  stem: "#3b7d31",
  flowers: ["#e8453c", "#f7c948", "#f28cbd", "#ffffff", "#8e6fd8"],
  hedge: "#2f6f2b",
  stone: "#8a8f94",
} as const;

// running bond: split a run of cells into bricks, shifting the joints on alternate layers
function run(cells: number[], layer: number): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  const first = layer % 2 ? 1 : 2;
  while (i < cells.length) {
    let len = out.length === 0 ? first : 2;
    // a brick must cover consecutive cells
    while (len > 1 && (i + len > cells.length || cells[i + len - 1] !== cells[i] + len - 1)) len--;
    out.push([cells[i], len]);
    i += len;
  }
  return out;
}

export type HouseSpec = { x: number; z: number; w: number; d: number; floors: number };

// House level 1..n: level 1 is a small cabin; each level adds size, a floor,
// or detail. Front faces +z.
export function houseSpec(level: number): HouseSpec {
  if (level >= 5) return { x: 5, z: 3, w: 12, d: 8, floors: 2 };
  if (level >= 3) return { x: 6, z: 3, w: 10, d: 7, floors: 1 };
  return { x: 7, z: 4, w: 8, d: 6, floors: 1 };
}

export function buildHouse(level: number): Brick[] {
  const s = houseSpec(level);
  const out: Brick[] = [];
  const layers = 4 * s.floors; // four bricks per storey
  const doorX = s.x + Math.floor(s.w / 2) - 1; // two studs wide, centred on the front
  const cx = s.x + s.w / 2;

  // floor
  out.push({ x: s.x, z: s.z, y: 0, w: s.w, d: s.d, h: 1, color: C.wallDark, kind: "tile" });

  for (let L = 0; L < layers; L++) {
    const y = 1 + L * BRICK;
    const storeyLayer = L % 4;
    const isWindowRow = storeyLayer === 1 || storeyLayer === 2;
    const colour = storeyLayer === 0 && L > 0 ? C.trim : L === 0 ? C.wallDark : C.wall;

    // front and back walls run along x
    for (const [zRow, front] of [
      [s.z + s.d - 1, true],
      [s.z, false],
    ] as const) {
      const cells: number[] = [];
      for (let x = s.x; x < s.x + s.w; x++) {
        const door = front && L < 3 && (x === doorX || x === doorX + 1);
        const win = isWindowRow && !front && (x === s.x + 2 || x === s.x + 3 || x === s.x + s.w - 4 || x === s.x + s.w - 3);
        const frontWin = isWindowRow && front && L >= 4 && Math.abs(x + 0.5 - cx) > 1 && Math.abs(x + 0.5 - cx) < 4;
        if (door) continue;
        if (win || frontWin) {
          out.push({ x, z: zRow, y, w: 1, d: 1, h: BRICK, color: C.glass, kind: "glass" });
          continue;
        }
        cells.push(x);
      }
      for (const [x, len] of run(cells, L)) out.push({ x, z: zRow, y, w: len, d: 1, h: BRICK, color: colour });
    }
    // side walls run along z (between the front and back walls)
    for (const xCol of [s.x, s.x + s.w - 1]) {
      const cells: number[] = [];
      for (let z = s.z + 1; z < s.z + s.d - 1; z++) {
        const win = isWindowRow && (z === s.z + Math.floor(s.d / 2) - 1 || z === s.z + Math.floor(s.d / 2));
        if (win) {
          out.push({ x: xCol, z, y, w: 1, d: 1, h: BRICK, color: C.glass, kind: "glass" });
          continue;
        }
        cells.push(z);
      }
      for (const [z, len] of run(cells, L + 1)) out.push({ x: xCol, z, y, w: 1, d: len, h: BRICK, color: colour });
    }
  }

  // door: a dark frame lintel over the gap, and the door itself set just inside
  out.push({ x: doorX, z: s.z + s.d - 1, y: 1, w: 2, d: 1, h: BRICK * 3, color: C.door, kind: "tile" });

  // roof: stepped gable, sloping front and back, one stud of overhang all round
  const top = 1 + layers * BRICK;
  const rx = s.x - 1;
  const rw = s.w + 2;
  let z0 = s.z - 1;
  let z1 = s.z + s.d; // inclusive
  let step = 0;
  while (z1 - z0 >= 1) {
    const y = top + step * 2;
    const colour = step % 2 ? C.roofDark : C.roof;
    out.push({ x: rx, z: z0, y, w: rw, d: 1, h: 2, color: colour });
    out.push({ x: rx, z: z1, y, w: rw, d: 1, h: 2, color: colour });
    // fill the gable ends so the roof reads as solid from the side
    if (z1 - z0 > 1) out.push({ x: s.x, z: z0 + 1, y, w: s.w, d: z1 - z0 - 1, h: 2, color: C.wall, kind: "tile" });
    z0++;
    z1--;
    step++;
  }
  if (z0 === z1) out.push({ x: rx, z: z0, y: top + step * 2, w: rw, d: 1, h: 2, color: C.roof });

  // chimney from level 2, standing on the roof step above its cell
  if (level >= 2) {
    const zc = s.z + 1;
    const base = top + 2 * (zc - (s.z - 1)) + 2; // the roof reaches this cell k steps up, each step 2 plates
    for (let k = 0; k < 3; k++) out.push({ x: s.x + s.w - 2, z: zc, y: base + k * BRICK, w: 1, d: 1, h: BRICK, color: C.stone });
  }
  return out;
}

// Garden: grows with the streak. Flowers first, then hedges, then a tree.
export function buildGarden(streak: number, house: HouseSpec, size: number): Brick[] {
  const out: Brick[] = [];
  const doorX = house.x + Math.floor(house.w / 2) - 1;

  // path from the door to the front edge
  for (let z = house.z + house.d; z < size - 1; z++) out.push({ x: doorX, z, y: 0, w: 2, d: 1, h: 1, color: C.path, kind: "tile" });

  // flower beds either side of the path: one flower per streak day, up to 12
  const beds: [number, number][] = [];
  for (let z = house.z + house.d + 1; z < size - 2; z += 2)
    for (const x of [doorX - 3, doorX - 2, doorX + 3, doorX + 4]) beds.push([x, z]);
  beds.slice(0, Math.min(streak, 12)).forEach(([x, z], i) => {
    out.push({ x, z, y: 0, w: 1, d: 1, h: 2, color: C.stem, kind: "round" });
    out.push({ x, z, y: 2, w: 1, d: 1, h: 1, color: C.flowers[i % C.flowers.length], kind: "round" });
  });

  // hedge along the front at a 5-day streak
  if (streak >= 5)
    for (let x = 1; x < size - 1; x++) {
      if (x === doorX || x === doorX + 1) continue;
      out.push({ x, z: size - 2, y: 0, w: 1, d: 1, h: BRICK, color: C.hedge });
    }

  // a tree at 10 days, taller at 30
  if (streak >= 10) {
    const tx = 2;
    const tz = house.z + house.d + 2;
    const trunk = streak >= 30 ? 4 : 2;
    for (let k = 0; k < trunk; k++) out.push({ x: tx + 1, z: tz + 1, y: k * BRICK, w: 1, d: 1, h: BRICK, color: C.trunk, kind: "round" });
    const cy = trunk * BRICK;
    out.push({ x: tx, z: tz, y: cy, w: 3, d: 3, h: BRICK, color: C.leaf });
    out.push({ x: tx, z: tz, y: cy + BRICK, w: 3, d: 3, h: BRICK, color: C.leafLight });
    out.push({ x: tx + 1, z: tz + 1, y: cy + 2 * BRICK, w: 1, d: 1, h: BRICK, color: C.leaf });
  }
  return out;
}

export function baseplate(size: number): Brick {
  return { x: 0, z: 0, y: -1, w: size, d: size, h: 1, color: C.grass };
}

// Which studs are visible: the top of a brick shows studs except where another brick sits on it.
export function visibleStuds(bricks: Brick[]): { x: number; z: number; y: number; color: string }[] {
  const occupied = new Set<string>();
  for (const b of bricks) for (let x = b.x; x < b.x + b.w; x++) for (let z = b.z; z < b.z + b.d; z++) occupied.add(`${x},${z},${b.y}`);
  const out: { x: number; z: number; y: number; color: string }[] = [];
  for (const b of bricks) {
    if (b.kind === "tile" || b.kind === "glass") continue;
    const top = b.y + b.h;
    for (let x = b.x; x < b.x + b.w; x++) for (let z = b.z; z < b.z + b.d; z++) if (!occupied.has(`${x},${z},${top}`)) out.push({ x, z, y: top, color: b.color });
  }
  return out;
}
