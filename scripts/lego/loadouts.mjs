// Turn the character upgrade data in 3d/lego/ into what the world renders.
//
//   LDRAW=/path/to/ldraw node scripts/lego/loadouts.mjs
//
// Reads 3d/lego/catalog/slots.json (the 7 slots + colour names),
// 3d/lego/characters/<name>/levels.json (one loadout per level) and the ride
// models in 3d/lego/rides/, and writes src/lib/legoLoadouts.generated.json.
// Do not edit that file by hand: edit levels.json and run this again, then
// `PARTS_ONLY=1 LDRAW=... node scripts/lego/pack.mjs` to pack any new parts.
//
// Every figure comes out as the parts of MINIFIG in src/lib/legoWorld.ts
// (torso, armL, armR, handL, handR, hips, legR, legL, head, hair), each with an
// LDraw part and colour, so the arms and legs stay separate and can swing.
// The library's shortcut assemblies used in levels.json (76382pXX = printed
// torso with arms and hands, 3815c01 = hips and legs) are opened up here.
// Side names follow MINIFIG: armL / handL sit on -X, which is the figure's own
// right hand (LDraw 3818 "Arm Right"); the Warrior's sword is held there.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";

const ROOT = process.env.LDRAW;
if (!ROOT || !existsSync(`${ROOT}/parts`)) throw new Error("set LDRAW to the unzipped ldraw folder");
const at = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const LEGO = at("../../3d/lego/");
const catalog = JSON.parse(readFileSync(`${LEGO}catalog/slots.json`, "utf8"));
const COLOUR = catalog.ldraw_colors;
const col = (name) => {
  if (!(name in COLOUR)) throw new Error(`unknown colour name "${name}" (add it to 3d/lego/catalog/slots.json)`);
  return COLOUR[name];
};

// type-1 lines of a library part: { colour, x, y, z, m[9], part }
function partLines(part) {
  const file = `${ROOT}/parts/${part}.dat`;
  if (!existsSync(file)) throw new Error(`LDraw part ${part} not found in ${ROOT}/parts`);
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim().split(/\s+/))
    .filter((a) => a[0] === "1" && a.length >= 15)
    .map((a) => ({ colour: Number(a[1]), p: a.slice(2, 5).map(Number), m: a.slice(5, 14).map(Number), part: a.slice(14).join(" ").replace(/\.dat$/i, "") }));
}
const inherit = (c, parent) => (c === 16 ? parent : c);

// The torso slot -> torso, armL, armR, handL, handR.
function torsoParts(t) {
  if (t.arms) {
    // assembled piece by piece in levels.json (plain 973 or a printed 973pXX)
    const c = col(t.color);
    return {
      torso: { part: t.part, color: c },
      armL: { part: "3818", color: col(t.arms) },
      armR: { part: "3819", color: col(t.arms) },
      handL: { part: "3820", color: col(t.hands) },
      handR: { part: "3820", color: col(t.hands) },
    };
  }
  // a 76382pXX shortcut: its own file says which print and which arm/hand colours
  const c = col(t.color);
  const lines = partLines(t.part);
  const torso = lines.find((l) => /^973/i.test(l.part));
  const arm = (n) => lines.find((l) => l.part === n);
  const hands = lines.filter((l) => l.part === "3820").sort((a, b) => a.p[0] - b.p[0]); // -X first
  if (!torso || !arm("3818") || !arm("3819") || hands.length !== 2) throw new Error(`${t.part}: not a torso-with-arms-and-hands shortcut`);
  return {
    torso: { part: torso.part, color: inherit(torso.colour, c) },
    armL: { part: "3818", color: inherit(arm("3818").colour, c) },
    armR: { part: "3819", color: inherit(arm("3819").colour, c) },
    handL: { part: "3820", color: inherit(hands[0].colour, c) },
    handR: { part: "3820", color: inherit(hands[1].colour, c) },
  };
}

// The legs slot -> hips, legR, legL.
function legParts(l) {
  const c = col(l.color);
  if (!/c\d+$/i.test(l.part)) return { hips: { part: "3815", color: c }, legR: { part: "3816", color: c }, legL: { part: "3817", color: c } };
  const lines = partLines(l.part);
  const pick = (n) => {
    const x = lines.find((y) => y.part === n);
    if (!x) throw new Error(`${l.part}: no ${n} inside`);
    return { part: n, color: inherit(x.colour, c) };
  };
  return { hips: pick("3815"), legR: pick("3816"), legL: pick("3817") };
}

// Held items, in the same torso frame as MINIFIG (from 3d/lego/tools/build_ldr.py):
// the hand's own frame, at the point where the hand grips a bar.
const GEAR_AT = {
  right_hand: { attach: "handL", at: [-24.89, 33.73, -9.898], m: [0.985, -0.12, 0.12, 0.17, 0.696, -0.696, 0, 0.707, 0.707] },
  left_hand: { attach: "handR", at: [24.89, 33.73, -9.898], m: [0.985, 0.12, -0.12, -0.17, 0.696, -0.696, 0, 0.707, 0.707] },
  neck: { attach: "torso", at: [0, 0, 0], m: [1, 0, 0, 0, 1, 0, 0, 0, 1] },
};

const rideText = (file) => readFileSync(`${LEGO}rides/${file}`, "utf8").replace(/\r/g, "").trim() + "\n";
const refsOf = (text) =>
  text.split("\n").map((l) => l.trim().split(/\s+/)).filter((a) => a[0] === "1" && a.length >= 15).map((a) => a.slice(14).join(" ").replace(/\.dat$/i, ""));

const parts = new Set();
const rideParts = new Set();
const characters = {};
for (const name of readdirSync(`${LEGO}characters`)) {
  const src = JSON.parse(readFileSync(`${LEGO}characters/${name}/levels.json`, "utf8"));
  const levels = src.levels.map((lv) => {
    const fig = {
      ...torsoParts(lv.torso),
      ...legParts(lv.legs),
      head: { part: lv.head.part, color: col(lv.head.color) },
      hair: { part: lv.hair.part, color: col(lv.hair.color) },
    };
    Object.values(fig).forEach((p) => parts.add(p.part));
    const gear = Object.entries(lv.gear ?? {}).map(([slot, g]) => {
      const place = GEAR_AT[slot];
      if (!place) throw new Error(`${name} L${lv.level}: unknown gear slot "${slot}"`);
      parts.add(g.part);
      return { slot, name: g.name ?? g.part, part: g.part, color: col(g.color), ...place };
    });
    const ldr = rideText(lv.ride.file);
    refsOf(ldr).forEach((p) => rideParts.add(p));
    return {
      level: lv.level,
      title: lv.title,
      parts: fig,
      // Lego has no separate shoes: the feet are part of each leg. The renderer
      // decides how to show this (tint the foot area, or a printed-boots leg).
      shoes: { color: col(lv.shoes.color), finish: lv.shoes.finish },
      gear,
      ride: { name: lv.ride.name, file: lv.ride.file, turn: lv.ride.turn ?? -70, ldr },
    };
  });
  characters[name] = { stat: src.stat, identity: src.identity, levels };
}

const out = {
  _generated: "by scripts/lego/loadouts.mjs from 3d/lego/ -- do not edit by hand",
  slots: catalog.slots,
  characters,
  parts: [...parts].sort(),
  rideParts: [...rideParts].filter((p) => !parts.has(p)).sort(),
};
writeFileSync(at("../../src/lib/legoLoadouts.generated.json"), JSON.stringify(out, null, 2) + "\n");
console.log(
  `loadouts: ${Object.keys(characters).length} character(s), ${Object.values(characters).reduce((n, c) => n + c.levels.length, 0)} levels, ${out.parts.length} figure/gear parts, ${out.rideParts.length} ride parts`,
);
