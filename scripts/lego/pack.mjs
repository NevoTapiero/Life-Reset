// Pack the LDraw parts the world uses into one file the browser loads once.
//
//   LDRAW=/path/to/ldraw node scripts/lego/pack.mjs
//
// LDRAW is the unzipped official library (https://library.ldraw.org, complete.zip).
// Writes public/lego/parts.mpd (every part in LEGO_PARTS plus everything they
// reference, as embedded "0 FILE" sections) and public/lego/LDConfig.ldr (colours).
// Also packs each official set in scripts/lego/sets/ (from the LDraw Official
// Model Repository, library.ldraw.org/omr) into public/lego/sets/, self-contained.
// The library is CC BY 2.0; see public/lego/LICENSE.txt.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
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
// as "p/48/..." (and "p/8/..."), so embed them under those names
const embedName = (name) => (name.startsWith("s/") ? `parts/${name}` : /^(48|8)\//.test(name) ? `p/${name}` : name);
const embed = (files) => [...files].map(([name, text]) => `0 FILE ${embedName(name)}\n${text.replace(/\r/g, "").trim()}\n0 NOFILE\n`).join("");

const files = collect(LEGO_PARTS.map((p) => `${p}.dat`));
const out = "0 FILE parts-index.ldr\n0 packed parts for the brick world\n0 NOFILE\n" + embed(files);
writeFileSync(`${OUT}parts.mpd`, out);

// official sets: the house only (drop the figures, vehicles and animals in the
// main model), then every part it uses
const SETS = fileURLToPath(new URL("./sets/", import.meta.url));
const EXTRAS = /minifig|car \d|trailer|boat|quad|moose|bird|4719c01/i;
mkdirSync(`${OUT}sets`, { recursive: true });
for (const f of readdirSync(SETS).filter((f) => f.endsWith(".mpd"))) {
  const text = readFileSync(SETS + f, "utf8").replace(/\r/g, "");
  const end = text.indexOf("\n0 FILE ", 1); // the main model is the first file
  const main = text.slice(0, end).split("\n").filter((l) => !(l.startsWith("1 ") && EXTRAS.test(l))).join("\n");
  const model = main + text.slice(end);
  const own = new Set([...model.matchAll(/^0 FILE (.+)$/gm)].map((m) => m[1].trim().toLowerCase()));
  const parts = collect(refs(model).filter((r) => !own.has(r.toLowerCase())));
  const packed = model.trim() + "\n" + embed(parts);
  writeFileSync(`${OUT}sets/${f}`, packed);
  console.log(`set ${f}: ${parts.size} files, ${(packed.length / 1e6).toFixed(2)} MB`);
}

const colours = readFileSync(`${ROOT}/LDConfig.ldr`, "utf8").split(/\r?\n/).filter((l) => l.startsWith("0 !COLOUR")).join("\n");
writeFileSync(`${OUT}LDConfig.ldr`, colours + "\n");
console.log(`packed ${files.size} files, ${(out.length / 1e6).toFixed(2)} MB; ${colours.split("\n").length} colours`);
