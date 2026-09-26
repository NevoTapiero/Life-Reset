// Rasterize scripts/icon.svg into the PWA icon set.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, "icon.svg"));
const out = join(here, "..", "public");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(svg).resize(t.size, t.size).png().toFile(join(out, t.file));
  console.log("wrote", t.file);
}

// maskable: same art with safe-zone padding on solid background
const inner = await sharp(svg).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#0c0c0e" } })
  .composite([{ input: inner, left: 56, top: 56 }])
  .png()
  .toFile(join(out, "icon-maskable-512.png"));
console.log("wrote icon-maskable-512.png");
