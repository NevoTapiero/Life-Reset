// node scripts/walk.check.mjs -- every walk between any two places (doors, insides, the shop) keeps to the streets
import assert from "node:assert";
import { doorWalk, insideWalk, lotFor, MAX_RESIDENTS, SHOP_WALK, shopWalk, walkRoute, rerouteFrom } from "../src/lib/legoWorld.ts";

const lots = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotFor(i));
const places = [SHOP_WALK, shopWalk(1), shopWalk(3), ...lots.flatMap((lot, i) => [doorWalk(lot, 1 + (i % 5), 40), doorWalk(lot, 1 + (i % 5), -40), insideWalk(lot, 1 + (i % 5), 40)])];
const straight = (a, b) => Math.abs(a[0] - b[0]) < 1 || Math.abs(a[2] - b[2]) < 1;
const onStreets = (r) => {
  for (let i = 0; i < r.pts.length - 1; i++)
    if (r.chains[i].length === 1 && r.chains[i + 1].length === 1) assert(straight(r.pts[i], r.pts[i + 1]), JSON.stringify(r.pts));
};
for (const a of places)
  for (const b of places) {
    const r = walkRoute(a, b);
    onStreets(r);
    assert.deepEqual(r.pts[0], a[a.length - 1]);
    assert.deepEqual(r.pts[r.pts.length - 1], b[b.length - 1]);
    // turning round anywhere on the way still ends at the new place, along the streets
    for (let i = 0; i < r.pts.length - 1; i++) {
      const pos = r.pts[i].map((v, k) => (v + r.pts[i + 1][k]) / 2);
      const t = rerouteFrom(r, i, pos, places[0]);
      onStreets(t);
      assert.deepEqual(t.pts[0], pos);
    }
  }
// stepping inside from a friend's door doesn't go back out to the street first
const inside = walkRoute(doorWalk(lots[1], 2, 40), insideWalk(lots[1], 2, 40));
assert.equal(inside.pts.length, insideWalk(lots[1], 2, 40).length - 1); // from beside the door, not the street
assert.deepEqual(walkRoute(insideWalk(lots[1], 2, 40), doorWalk(lots[1], 2, 40)).pts, [...inside.pts].reverse());
console.log(`ok: ${places.length ** 2} walks`);
