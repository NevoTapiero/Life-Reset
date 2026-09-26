// One-time generation of quest card background art via Gemini image models.
// Saves compressed JPGs into the app's public/art folder. Skips existing files.
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const gkey = process.env.GKEY;
if (!gkey) { console.error("GKEY missing"); process.exit(1); }
const outDir = "C:/Users/user/Desktop/Life Reset/app/public/art";
mkdirSync(outDir, { recursive: true });

const STYLE =
  "Wide 16:9 cinematic anime illustration, dark and moody with warm amber and orange highlights, " +
  "Persona 5 key visual aesthetic, dramatic rim lighting, high quality, no text, no words, no letters, no logos, no watermark. Scene: ";

const TARGETS = [
  ["drink-water", "a person drinking from a glass water bottle in a dark kitchen at night, amber city glow through the window"],
  ["sleep-7-9", "a person sleeping peacefully in bed in a dark bedroom, moonlight and warm amber city lights through the window"],
  ["read-books", "a person reading a thick book in an armchair in a dark cozy room, single warm lamp glow"],
  ["workout", "a determined person doing push-ups on the floor of a dark home gym at night, dramatic amber rim light, sweat"],
  ["morning-sunlight", "a person standing at an open window at sunrise, golden orange morning light flooding a dark room"],
  ["meditate", "a person meditating cross-legged on the floor of a dark room, warm candle glow, floating dust particles"],
  ["journal", "a person writing in a paper journal at a desk at night, warm desk lamp, dark moody room"],
  ["cold-shower", "a person standing under a cold shower, dark bathroom, steely blue tones with faint warm edge light, droplets frozen mid air"],
  ["social-media-limit", "a smartphone lying face down on a dark table in warm amber light while a person walks away in the blurred background"],
  ["deep-work", "a person in headphones deeply focused at a desk with a laptop in a dark room, lit by the screen and a warm desk lamp"],
  ["plan-tomorrow", "an open planner notebook and pen on a dark desk at night, warm lamp light, neat handwriting lines"],
  ["reach-out", "a person on a rooftop at night sending a message on their phone, soft smile, amber city bokeh lights behind"],
  ["learn-skill", "a person studying with a laptop and handwritten notes late at night, warm light, shelves of books in shadow"],
  ["gratitude", "a person on a balcony watching a warm orange sunset sky, peaceful, city silhouette below"],
  ["healthy-meal", "a fresh healthy bowl of food with steam on a dark wooden table, warm kitchen light, greens and grilled protein"],
  ["screens-off", "a phone with a dark screen on a nightstand, person asleep in the soft moonlit background, calm dark bedroom"],
  ["pillar-body", "an athlete sprinting through a dark city street at night under amber streetlights, motion and power"],
  ["pillar-mind", "a calm person silhouetted against a night sky with glowing amber particles drifting around them"],
  ["pillar-rest", "a cozy dark bedroom with the moon through the window and a soft blanket over an empty bed"],
  ["pillar-fuel", "a water bottle and fresh fruit on a gym bench in a dark room with one warm spotlight"],
  ["pillar-connection", "two friends fist bumping on a night street, warm amber bokeh city lights around them"],
  ["pillar-purpose", "a determined person standing on a rooftop at dawn looking over the city, orange sunrise glow"],
];

const MODELS = ["gemini-3.1-flash-image", "gemini-3-pro-image"];

async function generate(prompt) {
  for (const model of MODELS) {
    for (const withConfig of [true, false]) {
      try {
        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          ...(withConfig ? { generationConfig: { imageConfig: { aspectRatio: "16:9" } } } : {}),
        };
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gkey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(60000),
          },
        );
        if (!r.ok) { continue; }
        const data = await r.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const img = parts.find((p) => p.inlineData?.data);
        if (img) return Buffer.from(img.inlineData.data, "base64");
      } catch { continue; }
    }
  }
  return null;
}

let ok = 0, fail = 0;
for (const [name, scene] of TARGETS) {
  const file = join(outDir, `${name}.jpg`);
  if (existsSync(file)) { console.log(`skip ${name} (exists)`); ok++; continue; }
  const buf = await generate(STYLE + scene);
  if (!buf) { console.log(`FAIL ${name}`); fail++; continue; }
  const outBuf = await sharp(buf).resize(720, 405, { fit: "cover" }).jpeg({ quality: 72 }).toBuffer();
  writeFileSync(file, outBuf);
  console.log(`wrote ${name}.jpg (${Math.round(outBuf.length / 1024)} KB)`);
  ok++;
  await new Promise((res) => setTimeout(res, 2500));
}
console.log(`done: ${ok} ok, ${fail} failed`);
