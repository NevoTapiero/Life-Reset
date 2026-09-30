// node scripts/walk.check.mjs -- every walk between any two places stays on the streets
import assert from "node:assert";
import { doorWalk, lotFor, MAX_RESIDENTS, SHOP_WALK, walkRoute, rerouteFrom} from "../src/lib/legoWorld.ts";

const places = [SHOP_WALK, ...Array.from({ length: MAX_RESIDENTS }, (_, i) => doorWalk(lotFor(i), 1 + (i % 5)))];
const rev = (a) => [...a].reverse();
const straight = (a, b) => Math.abs(a[0] - b[0]) < 1 || Math.abs(a[2] - b[2]) < 1;
for (const a of places)
  for (const b of places) {
    const r = walkRoute(rev(a), b);
    // along the streets, every leg runs straight up or across
    for (let i = r.leave; i < r.enter; i++) assert(straight(r.pts[i], r.pts[i + 1]), JSON.stringify(r));
    assert.deepEqual(r.pts[r.pts.length - 1], b[b.length - 1]);
    // turning round anywhere on the way still ends at the new place, along the streets
    for (let i = 0; i < r.pts.length - 1; i++) {
      const pos = r.pts[i].map((v, k) => (v + r.pts[i + 1][k]) / 2);
      const t = rerouteFrom(r, i, pos, places[0]);
      for (let j = t.leave; j < t.enter; j++) assert(straight(t.pts[j], t.pts[j + 1]), `turn at ${i}: ${JSON.stringify(t)}`);
    }
  }
console.log(`ok: ${places.length ** 2} walks`);
