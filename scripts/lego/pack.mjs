// Pack the LDraw parts the world uses into one file the browser loads once.
//
//   LDRAW=/path/to/ldraw node scripts/lego/pack.mjs
//
// LDRAW is the unzipped official library (https://library.ldraw.org, complete.zip).
// Writes public/lego/parts.mpd (every part in LEGO_PARTS plus everything they
// reference, as embedded "0 FILE" sections) and public/lego/LDConfig.ldr (colours).
// Then bakes the official houses (scripts/lego/sets/) into public/lego/houses/
// and writes their footprints to src/lib/legoHouses.json.
// Also packs the character loadouts (src/lib/legoLoadouts.generated.json, made
// by scripts/lego/loadouts.mjs) into public/lego/figures.mpd and their rides
// into public/lego/rides.mpd, loaded only when a figure / ride needs them.
// PARTS_ONLY=1 stops after the part packs (no house / vehicle / prop baking).
// The library is CC BY 2.0; see public/lego/LICENSE.txt.
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import { Box3, Group } from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawUtils } from "three/examples/jsm/utils/LDrawUtils.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { fileURLToPath } from "url";
import { LEGO_PARTS } from "../../src/lib/legoWorld.ts";
import LOADOUTS from "../../src/lib/legoLoadouts.generated.json" with { type: "json" };

const ROOT = process.env.LDRAW;
if (!ROOT || !existsSync(`${ROOT}/parts`)) throw new Error("set LDRAW to the unzipped ldraw folder");
const OUT = fileURLToPath(new URL("../../public/lego/", import.meta.url));
mkdirSync(OUT, { recursive: true });

// where a reference like "s\3040s01.dat", "48\1-4cyli.dat" or "stud.dat" lives
function locate(ref) {
  const r = ref.toLowerCase().replace(/\\/g, "/");
  for (const dir of ["parts", "p"]) {
    const f = `${ROOT}/${dir}/${r}`;
    if (existsSync(f)) return f;
  }
  return null;
}

const refs = (text) =>
  text.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).filter((a) => a[0] === "1" && a.length >= 15).map((a) => a.slice(14).join(" "));

// every library file reachable from roots, as normalised name -> text
function collect(roots) {
  const files = new Map();
  const missing = new Set();
  const add = (ref) => {
    const name = ref.toLowerCase().replace(/\\/g, "/");
    if (files.has(name) || missing.has(name)) return;
    const path = locate(name);
    if (!path) return missing.add(name);
    const text = readFileSync(path, "utf8");
    files.set(name, text);
    refs(text).forEach(add);
  };
  roots.forEach(add);
  // a missing part would ship a pack the browser can't finish loading
  if (missing.size) throw new Error(`missing from ${ROOT}: ${[...missing].join(", ")}`);
  return files;
}

// three's LDrawLoader looks sub-parts up as "parts/s/..." and hi-res primitives
// as "p/48/..."; everything else (low-res "8/..." included) by its plain name
const embedName = (name) => (name.startsWith("s/") ? `parts/${name}` : name.startsWith("48/") ? `p/${name}` : name);
const embed = (files) => [...files].map(([name, text]) => `0 FILE ${embedName(name)}\n${text.replace(/\r/g, "").trim()}\n0 NOFILE\n`).join("");

const files = collect(LEGO_PARTS.map((p) => `${p}.dat`));
const out = "0 FILE parts-index.ldr\n0 packed parts for the brick world\n0 NOFILE\n" + embed(files);
writeFileSync(`${OUT}parts.mpd`, out);

// Every parse carries its whole pack, so the character loadouts and the rides
// get packs of their own instead of growing parts.mpd for every model:
// figures.mpd (printed torsos, helmets, gear) for minifig parses, rides.mpd for
// rides. Each holds only what the packs before it don't already have.
const figureFiles = collect(LOADOUTS.parts.map((p) => `${p}.dat`));
for (const name of files.keys()) figureFiles.delete(name);
const figures = "0 FILE figures-index.ldr\n0 packed parts for the character loadouts\n0 NOFILE\n" + embed(figureFiles);
writeFileSync(`${OUT}figures.mpd`, figures);

// the rides (skateboard ... dragon)
const rideFiles = collect(LOADOUTS.rideParts.map((p) => `${p}.dat`));
for (const name of [...files.keys(), ...figureFiles.keys()]) rideFiles.delete(name);
const rides = "0 FILE rides-index.ldr\n0 packed parts for the rides\n0 NOFILE\n" + embed(rideFiles);
writeFileSync(`${OUT}rides.mpd`, rides);

const colours = readFileSync(`${ROOT}/LDConfig.ldr`, "utf8").split(/\r?\n/).filter((l) => l.startsWith("0 !COLOUR")).join("\n");
writeFileSync(`${OUT}LDConfig.ldr`, colours + "\n");
console.log(`packed ${files.size} files, ${(out.length / 1e6).toFixed(2)} MB; figures ${figureFiles.size} files, ${(figures.length / 1e6).toFixed(2)} MB; rides ${rideFiles.size} files, ${(rides.length / 1e6).toFixed(2)} MB; ${colours.split("\n").length} colours`);
if (process.env.PARTS_ONLY) process.exit(0);

// ---- the houses ----------------------------------------------------------
// House level 1..5 is an official set from scripts/lego/sets (LDraw Official
// Model Repository, library.ldraw.org/omr). Each is baked to a small glb so the
// app never parses LDraw for a house: the house only (figures, vehicles and
// animals dropped), turned to face the garden (+Z), left edge at x = 0, front
// at z = 0, standing on y = 0; outlines dropped; meshopt-compressed.
// Each level has one or more houses; a player gets one of their level's
// houses by name, so neighbours on the same level usually differ. `turn`
// (quarter turns) was checked by eye so the front faces the garden.
const HOUSES = [
  { id: "31009-1", name: "Small Cottage", level: 1, turn: 3 },
  { id: "349-1", name: "Swiss Chalet", level: 1, turn: 3 },
  { id: "6365-1", name: "Summer Cottage", level: 1, turn: 1 },
  { id: "1472-1", name: "Holiday Home", level: 2, turn: 2 },
  { id: "1484-1", name: "Weetabix Town House", level: 2, turn: 2 },
  { id: "346-2", name: "House with Car", level: 2, turn: 3 },
  { id: "1854-1", name: "House with Roof Windows", level: 2, turn: 2 },
  { id: "31025-1", name: "Mountain Hut", level: 3, turn: 0 },
  { id: "31038-1", name: "Changing Seasons", level: 3, turn: 2 },
  { id: "31048-1", name: "Lakeside Lodge", level: 4, turn: 3 },
  { id: "31063-1", name: "Beachside Vacation", level: 4, turn: 0 },
  { id: "3315-1", name: "Olivia's House", level: 5, turn: 2 },
];
// the building in the middle of the town where you spend gold
const SHOP = { id: "10190-1", name: "Market Street", turn: 2 };
// cars that drive round the town: a sub-model of an official set, turned to face +Z
const VEHICLES = [
  { id: "car-1", name: "Car", turn: 1, set: "1472-1", model: "1472 - car 1.ldr" },
  { id: "car-2", name: "Car", turn: 0, set: "1472-1", model: "1472 - car 2.ldr" },
];
// people, animals and vehicles in a set's main model (not its buildings; "Car port" stays)
// small official sets that liven up the plaza; `keep` keeps their minifigs (the vendors)
const PROPS = [
  { id: "6601-1", name: "Ice Cream Cart", turn: 0, keep: true },
  { id: "6683-1", name: "Burger Stand", turn: 0, keep: true },
];
const EXTRAS = /minifig|\bcar( \d)?\.ldr|smallcar|trailer|boat|quad|moose|bird|turtle|jetski|female|male|girl|guy|90397|4719c01|anna|olivia|peter/i;

// GLTFExporter reads its Blobs with the browser's FileReader; Node only has Blob
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => ((this.result = b), this.onloadend?.(), this.onload?.({ target: this })));
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(b).toString("base64")}`;
      this.onloadend?.();
      this.onload?.({ target: this });
    });
  }
};

const loader = new LDrawLoader();
loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
loader.smoothNormals = true;
const SETS = fileURLToPath(new URL("./sets/", import.meta.url));
const HOUSE_OUT = `${OUT}houses/`;
mkdirSync(HOUSE_OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "lego-"));
const manifest = [];
for (const { id, name, turn, set, model: sub, keep } of [...HOUSES, SHOP, ...VEHICLES, ...PROPS]) {
  // (some sets end lines with spaces: "0 FILE x.ldr " would never match a reference to x.ldr)
  let text = readFileSync(`${SETS}${set ?? id}.mpd`, "utf8").replace(/\r/g, "").replace(/[ \t]+$/gm, "");
  if (sub) {
    // bake one sub-model: put its file first, so it's the one the loader builds
    const files = text.split(/\n(?=0 FILE )/);
    const i = files.findIndex((f) => f.startsWith(`0 FILE ${sub}`));
    if (i < 0) throw new Error(`${set} has no ${sub}`);
    text = [files[i], ...files.filter((_, k) => k !== i)].join("\n");
  }
  const end = text.indexOf("\n0 FILE ", 1); // the main model is the first file
  const main = text.slice(0, end).split("\n").filter((l) => keep || !(l.startsWith("1 ") && EXTRAS.test(l))).join("\n");
  // a set's own sub-parts are named "s\\..."; the loader looks them up as "parts/s/..."
  const model = (main + text.slice(end)).replace(/^0 FILE s\\/gim, "0 FILE parts/s/");
  const own = new Set([...model.matchAll(/^0 FILE (.+)$/gm)].map((m) => m[1].trim().toLowerCase()));
  const isOwn = (r) => own.has(r.toLowerCase().replace(/^s\\/, "parts/s/"));
  const parts = collect(refs(model).filter((r) => !isOwn(r)));
  // colours first: LDrawLoader reads !COLOUR lines from the model itself
  const nl = model.indexOf("\n");
  const packed = model.slice(0, nl + 1) + colours + "\n" + model.slice(nl + 1).trim() + "\n" + embed(parts);
  const group = await new Promise((res, rej) => loader.parse(packed, res, rej));

  const holder = new Group();
  holder.add(group);
  group.rotation.y = (turn * Math.PI) / 2;
  holder.updateMatrixWorld(true);
  const merged = LDrawUtils.mergeObject(holder);
  const drop = [];
  merged.traverse((o) => o.isLineSegments && drop.push(o));
  drop.forEach((o) => o.removeFromParent());
  const box = new Box3();
  merged.traverse((o) => {
    if (!o.isMesh) return;
    for (const k of Object.keys(o.geometry.attributes)) if (k !== "position" && k !== "normal") o.geometry.deleteAttribute(k);
    o.geometry = mergeVertices(o.geometry, 1e-3);
    o.geometry.computeBoundingBox();
    box.union(o.geometry.boundingBox);
  });
  // left edge and front onto the stud grid's lines, bottom on the ground (-Y is up)
  merged.traverse((o) => o.isMesh && o.geometry.translate(-box.min.x, -box.max.y, -box.max.z));
  const w = Math.ceil((box.max.x - box.min.x) / 20 - 0.01);
  const d = Math.ceil((box.max.z - box.min.z) / 20 - 0.01);
  const h = Math.round(box.max.y - box.min.y);

  const raw = join(tmp, `${id}.glb`);
  writeFileSync(raw, Buffer.from(await new GLTFExporter().parseAsync(merged, { binary: true })));
  execFileSync("npx", ["-y", "@gltf-transform/cli@4", "meshopt", raw, `${HOUSE_OUT}${id}.glb`], { stdio: "ignore" });
  const level = HOUSES.find((x) => x.id === id)?.level;
  manifest.push({ id, name, w, d, h, ...(level && { level }) });
  console.log(`house ${id} ${name}: ${w}x${d} studs, ${(statSync(`${HOUSE_OUT}${id}.glb`).size / 1e6).toFixed(2)} MB`);
}
const isHouse = (m) => HOUSES.some((h) => h.id === m.id);
writeFileSync(fileURLToPath(new URL("../../src/lib/legoHouses.json", import.meta.url)), JSON.stringify(manifest.filter(isHouse), null, 2) + "\n");
writeFileSync(fileURLToPath(new URL("../../src/lib/legoVehicles.json", import.meta.url)), JSON.stringify(manifest.filter((m) => VEHICLES.some((v) => v.id === m.id)), null, 2) + "\n");
writeFileSync(fileURLToPath(new URL("../../src/lib/legoProps.json", import.meta.url)), JSON.stringify(manifest.filter((m) => PROPS.some((v) => v.id === m.id)), null, 2) + "\n");
writeFileSync(fileURLToPath(new URL("../../src/lib/legoShop.json", import.meta.url)), JSON.stringify(manifest.find((m) => m.id === SHOP.id), null, 2) + "\n");
