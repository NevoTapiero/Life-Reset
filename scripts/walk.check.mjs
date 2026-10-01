// node scripts/walk.check.mjs -- every walk between any two places (doors, insides, the shop) keeps to the streets
import assert from "node:assert";
import { onRing, RING_R, CROWD, PERSON, sidestep, intoSomeone, jogAt, townBlockers, free, stepFree, nearestStreet, walkFrom, doorWalk, insideWalk, lotFor, MAX_RESIDENTS, SHOP_WALK, FOUNTAIN_WALK, shopWalk, walkRoute, rerouteFrom } from "../src/lib/legoWorld.ts";

const lots = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotFor(i));
const places = [SHOP_WALK, FOUNTAIN_WALK, shopWalk(1), shopWalk(3), ...lots.flatMap((lot, i) => [doorWalk(lot, 1 + (i % 5), 40), doorWalk(lot, 1 + (i % 5), -40), insideWalk(lot, 1 + (i % 5), 40)])];
// on the ring (or a step inside it, mid-way between two of its points), or straight along
const nearRing = (p) => Math.abs(Math.hypot(p[0], p[2]) - RING_R) < 12;
const straight = (a, b) => (nearRing(a) && nearRing(b)) || Math.abs(a[0] - b[0]) < 1 || Math.abs(a[2] - b[2]) < 1;
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
assert.equal(inside.pts.length, insideWalk(lots[1], 2, 40).length - doorWalk(lots[1], 2, 40).length + 1); // from beside the door, not the street
assert.deepEqual(walkRoute(insideWalk(lots[1], 2, 40), doorWalk(lots[1], 2, 40)).pts, [...inside.pts].reverse());
// the joggers' lap is continuous: no jumps anywhere round it (or when it wraps)
for (let d = -500; d < 10000; d += 5) {
  const [a, b] = [jogAt(d).at, jogAt(d + 5).at];
  assert(Math.hypot(a[0] - b[0], a[2] - b[2]) <= 5.01, `jump at ${d}`);
}
// walking where you like: everywhere people stand is walkable, and nothing walks into a house
for (let lvl = 1; lvl <= 5; lvl++) {
  const residents = lots.map((_, i) => ({ name: `p${i}`, level: lvl, streak: 0 }));
  const blockers = townBlockers(residents);
  for (const [i, lot] of lots.entries()) {
    const door = doorWalk(lot, lvl, 40).at(-1);
    assert(free(door[0], door[2], blockers), `door ${i} at level ${lvl} is inside something`);
    assert(free(...doorWalk(lot, lvl).at(-1).filter((_, k) => k !== 1), blockers), `own door ${i}`);
  }
  for (const k of [0, 1, 2, 3]) assert(free(shopWalk(k).at(-1)[0], shopWalk(k).at(-1)[2], blockers), `shop spot ${k}`);
  // pushing straight into a house stops at its wall
  const [x, z] = stepFree(0, 1000, 0, -2000, blockers);
  assert(free(x, z, blockers));
}
// the nearest street point is on a street, and a walk from anywhere ends where it should
for (const p of [[100, 0, 900], [-1500, 0, 200], [30, 0, -30]]) {
  const st = nearestStreet(p);
  assert(onRing(st));
  const r = walkFrom(p, places[4]);
  assert.deepEqual(r.pts.at(-1), places[4].at(-1));
  assert.equal(r.pts.length, r.chains.length);
}
// people keep out of each other's way: two walking into the same spot end up apart,
// you can't drive into someone, and stepping away from them is always allowed
{
  const a = { x: 0, z: 0 }, b = { x: 0, z: 0 };
  let pa = [0, 0], pb = [0, 0];
  for (let f = 0; f < 120; f++) {
    pa = sidestep("a", 0, 0, a, 1 / 60);
    CROWD.set("a", { x: pa[0], z: pa[1] });
    pb = sidestep("b", 5, 0, b, 1 / 60);
    CROWD.set("b", { x: pb[0], z: pb[1] });
  }
  assert(Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) > PERSON * 1.4, `still in each other: ${pa} ${pb}`);
  CROWD.clear();
  CROWD.set("them", { x: 100, z: 0 });
  assert(intoSomeone("me", 40, 0, 70, 0), "walked into someone");
  assert(!intoSomeone("me", 80, 0, 60, 0), "couldn't step away");
  assert(!intoSomeone("me", 0, 0, 10, 0), "blocked by someone far off");
  CROWD.clear();
}
console.log(`ok: ${places.length ** 2} walks, the joggers' lap, walking where you like, and people`);
