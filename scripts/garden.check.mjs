// node scripts/garden.check.mjs -- placing things on the plot: never on the house, the path, the front rows, each other, or off the plot
import assert from "node:assert";
import { GARDEN, canPlace, firstFreeSpot, gardenItemLines, houseSpec, doorCells, PLOT } from "../src/lib/legoWorld.ts";

for (const g of GARDEN) {
  for (let level = 1; level <= 5; level++) {
    const s = houseSpec(level);
    const door = doorCells(s);
    assert(!canPlace({ item: g.id, x: s.x0 + 1, z: s.z0 + 1, turn: 0 }, level, 0, []), `${g.name} on the house, level ${level}`);
    assert(!canPlace({ item: g.id, x: door[1], z: PLOT - 6, turn: 0 }, level, 0, []), `${g.name} on the path`);
    assert(!canPlace({ item: g.id, x: 10, z: PLOT - 2, turn: 0 }, level, 0, []), `${g.name} on the front hedge`);
    assert(!canPlace({ item: g.id, x: 0, z: 10, turn: 0 }, level, 0, []), `${g.name} off the plot's edge`);
    const first = firstFreeSpot(g.id, level, 25, []);
    if (g.w * g.d <= 16) assert(first, `${g.name} always has a spot`);
    if (first) {
      assert(canPlace(first, level, 25, []), `${g.name} first free spot is free (with the streak pond)`);
      assert(!canPlace(first, level, 25, [first]), `${g.name} can't go where one already is`);
      assert(canPlace(first, level, 25, [first], first), `${g.name} can be moved onto its own spot`);
    }
  }
  if (g.pieces) assert(gardenItemLines({ item: g.id, x: 2, z: 2, turn: 3 }).length === g.pieces.length, `${g.name} draws every piece`);
}
// a pond can't sit on the garden's own pond once the streak has one
assert(!canPlace({ item: "g-pond", x: PLOT - 22, z: PLOT - 12, turn: 0 }, 1, 20, []), "the streak pond's spot is taken");
console.log(`ok: garden placing, ${GARDEN.length} items`);
