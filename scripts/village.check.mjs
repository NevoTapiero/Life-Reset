// node scripts/village.check.mjs -- the village's layout: no two plots touch; no path, road, track or spur crosses a plot; a road bridges the river
import assert from "node:assert";
import { lotFor, lotPath, fromLot, MAX_RESIDENTS, PLOT, ROADS, TRACK, ROUNDABOUT, nearestStreet, crossing, RIVER } from "../src/lib/legoWorld.ts";

const lots = Array.from({ length: MAX_RESIDENTS }, (_, i) => lotFor(i));
for (let i = 0; i < lots.length; i++)
  for (let j = i + 1; j < lots.length; j++)
    assert(Math.hypot(lots[i].x - lots[j].x, lots[i].z - lots[j].z) / 20 >= 90, `plots ${i} and ${j} too close`);
const crossesPlot = (poly, except) =>
  lots.some((lot, j) => {
    if (j === except) return false;
    for (let k = 0; k + 1 < poly.length; k++)
      for (let t = 0; t <= 1; t += 0.05) {
        const x = poly[k][0] + (poly[k + 1][0] - poly[k][0]) * t;
        const z = poly[k][2] + (poly[k + 1][2] - poly[k][2]) * t;
        const [u, v] = fromLot(lot, [x, z]);
        if (Math.abs(u) < (PLOT / 2 + 3) * 20 && Math.abs(v) < (PLOT / 2 + 3) * 20) return true;
      }
    return false;
  });
lots.forEach((lot, i) => {
  for (let lvl = 1; lvl <= 5; lvl++) assert(!crossesPlot(lotPath(lot, lvl), i), `the path of plot ${i} (level ${lvl}) crosses another plot`);
});
const spur = [nearestStreet([ROUNDABOUT[0], 0, ROUNDABOUT[1]]), [ROUNDABOUT[0], 0, ROUNDABOUT[1]]];
for (const [name, poly] of [["road A", ROADS[0]], ["road B", ROADS[1]], ["the lake track", TRACK], ["the roundabout spur", spur]]) assert(!crossesPlot(poly), `${name} crosses a plot`);
assert(crossing(ROADS[1], RIVER), "road B bridges the river");
console.log(`ok: ${lots.length} plots, ${ROADS.length} roads, the track and the spur keep clear`);
