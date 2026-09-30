// Pack the LDraw parts the world uses into one file the browser loads once.
//
//   LDRAW=/path/to/ldraw node scripts/lego/pack.mjs
//
// LDRAW is the unzipped official library (https://library.ldraw.org, complete.zip).
// Writes public/lego/parts.mpd (every part in LEGO_PARTS plus everything they
// reference, as embedded "0 FILE" sections) and public/lego/LDConfig.ldr (colours).
// Then bakes the official houses (scripts/lego/sets/) into public/lego/houses/
// and writes their footprints to src/lib/legoHouses.json.
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
  if (missing.size) console.warn("missing:", [...missing].join(", "));
  return files;
}

// three's LDrawLoader looks sub-parts up as "parts/s/..." and hi-res primitives
// as "p/48/..."; everything else (low-res "8/..." included) by its plain name
const embedName = (name) => (name.startsWith("s/") ? `parts/${name}` : name.startsWith("48/") ? `p/${name}` : name);
const embed = (files) => [...files].map(([name, text]) => `0 FILE ${embedName(name)}\n${text.replace(/\r/g, "").trim()}\n0 NOFILE\n`).join("");

const files = collect(LEGO_PARTS.map((p) => `${p}.dat`));
const out = "0 FILE parts-index.ldr\n0 packed parts for the brick world\n0 NOFILE\n" + embed(files);
writeFileSync(`${OUT}parts.mpd`, out);

const colours = readFileSync(`${ROOT}/LDConfig.ldr`, "utf8").split(/\r?\n/).filter((l) => l.startsWith("0 !COLOUR")).join("\n");
writeFileSync(`${OUT}LDConfig.ldr`, colours + "\n");
console.log(`packed ${files.size} files, ${(out.length / 1e6).toFixed(2)} MB; ${colours.split("\n").length} colours`);

// ---- the houses ----------------------------------------------------------
// House level 1..5 is an official set from scripts/lego/sets (LDraw Official
// Model Repository, library.ldraw.org/omr). Each is baked to a small glb so the
// app never parses LDraw for a house: the house only (figures, vehicles and
// animals dropped), turned to face the garden (+Z), left edge at x = 0, front
// at z = 0, standing on y = 0; outlines dropped; meshopt-compressed.
const HOUSES = [
  { id: "31009-1", name: "Small Cottage", turn: 3 },
  { id: "1472-1", name: "Holiday Home", turn: 2 },
  { id: "31025-1", name: "Mountain Hut", turn: 0 },
  { id: "31048-1", name: "Lakeside Lodge", turn: 3 },
  { id: "3315-1", name: "Olivia's House", turn: 2 },
];
const EXTRAS = /minifig|car \d|trailer|boat|quad|moose|bird|4719c01|anna|olivia|peter/i;

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
for (const { id, name, turn } of HOUSES) {
  const text = readFileSync(`${SETS}${id}.mpd`, "utf8").replace(/\r/g, "");
  const end = text.indexOf("\n0 FILE ", 1); // the main model is the first file
  const main = text.slice(0, end).split("\n").filter((l) => !(l.startsWith("1 ") && EXTRAS.test(l))).join("\n");
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
  manifest.push({ id, name, w, d, h });
  console.log(`house ${id} ${name}: ${w}x${d} studs, ${(statSync(`${HOUSE_OUT}${id}.glb`).size / 1e6).toFixed(2)} MB`);
}
writeFileSync(fileURLToPath(new URL("../../src/lib/legoHouses.json", import.meta.url)), JSON.stringify(manifest, null, 2) + "\n");
