// node scripts/energy.check.mjs -- the energy rule: sleep and steps add up the way the comment says
import assert from "node:assert";
import { energyFrom } from "../src/lib/energy.ts";

const T = "2026-10-01";
assert.equal(energyFrom([], T), 45, "no watch: the benefit of the doubt");
assert.equal(energyFrom([{ kind: "sleep", rated: 12, day: T }], T), 60, "a good night");
assert.equal(energyFrom([{ kind: "sleep", rated: 8, day: "2026-09-30" }], T), 35, "a short night, filed yesterday");
assert.equal(energyFrom([{ kind: "sleep", rated: 0, day: T }], T), 10, "a bad night");
assert.equal(energyFrom([{ kind: "sleep", rated: 12, day: T }, { kind: "steps", rated: 20, day: T }], T), 100, "good night + 10k steps fills it");
assert.equal(energyFrom([{ kind: "sleep", rated: 12, day: T }, { kind: "steps", rated: 50, day: T }], T), 100, "capped");
assert.equal(energyFrom([{ kind: "steps", rated: 6, day: "2026-09-30" }], T), 45, "yesterday's steps don't count");
assert.equal(energyFrom([{ kind: "sleep", rated: 8, day: "2026-09-30" }, { kind: "sleep", rated: 12, day: T }], T), 60, "the latest night wins");
console.log("ok: energy");
