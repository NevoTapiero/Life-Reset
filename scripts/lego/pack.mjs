// Pack the LDraw parts the world uses into one file the browser loads once.
//
//   LDRAW=/path/to/ldraw node scripts/lego/pack.mjs
//
// LDRAW is the unzipped official library (https://library.ldraw.org, complete.zip).
// Writes public/lego/parts.mpd (every part in LEGO_PARTS plus everything they
// reference, as embedded "0 FILE" sections) and public/lego/LDConfig.ldr (colours).
// The library is CC BY 2.0; see public/lego/LICENSE.txt.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
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

const files = new Map(); // normalised name -> text
const missing = new Set();
function add(ref) {
  const name = ref.toLowerCase().replace(/\\/g, "/");
  if (files.has(name) || missing.has(name)) return;
  const path = locate(name);
  if (!path) return missing.add(name);
  const text = readFileSync(path, "utf8");
  files.set(name, text);
  for (const line of text.split(/\r?\n/)) {
    const a = line.trim().split(/\s+/);
    if (a[0] === "1" && a.length >= 15) add(a.slice(14).join(" "));
  }
}
for (const p of LEGO_PARTS) add(`${p}.dat`);
if (missing.size) console.warn("missing:", [...missing].join(", "));

let out = "0 FILE parts-index.ldr\n0 packed parts for the brick world\n0 NOFILE\n";
// three's LDrawLoader looks sub-parts up as "parts/s/..." and hi-res primitives
// as "p/48/..." (and "p/8/..."), so embed them under those names
const embedName = (name) => (name.startsWith("s/") ? `parts/${name}` : /^(48|8)\//.test(name) ? `p/${name}` : name);
for (const [name, text] of files) out += `0 FILE ${embedName(name)}\n${text.replace(/\r/g, "").trim()}\n0 NOFILE\n`;
writeFileSync(`${OUT}parts.mpd`, out);

const colours = readFileSync(`${ROOT}/LDConfig.ldr`, "utf8").split(/\r?\n/).filter((l) => l.startsWith("0 !COLOUR")).join("\n");
writeFileSync(`${OUT}LDConfig.ldr`, colours + "\n");
console.log(`packed ${files.size} files, ${(out.length / 1e6).toFixed(2)} MB; ${colours.split("\n").length} colours`);
