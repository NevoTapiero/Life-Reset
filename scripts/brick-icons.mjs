// Renders the brick-theme app icons (public/icon-*.png, apple-touch-icon.png)
// from one SVG: a red LEGO tile with studs and a minifig head. Run once:
//   node scripts/brick-icons.mjs
import sharp from "sharp";

const head = (cx, cy, r) => `
  <g transform="translate(${cx - r} ${cy - r}) scale(${(2 * r) / 64})">
    <rect x="25.5" y="6" width="13" height="8" rx="2.5" fill="#d9b320"/>
    <rect x="13" y="12" width="38" height="38" rx="11" fill="#f2cd37"/>
    <ellipse cx="25" cy="29" rx="3" ry="3.6" fill="#1b2a34"/>
    <ellipse cx="39" cy="29" rx="3" ry="3.6" fill="#1b2a34"/>
    <circle cx="26" cy="27.7" r="1" fill="#fff"/>
    <circle cx="40" cy="27.7" r="1" fill="#fff"/>
    <path d="M23.5 37c4.8 4.8 12.2 4.8 17 0" fill="none" stroke="#1b2a34" stroke-width="2.8" stroke-linecap="round"/>
  </g>`;

function svg(size, pad) {
  const s = 512;
  const inner = s - pad * 2;
  const studs = [];
  for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    const cx = pad + inner * x, cy = pad + inner * y, r = inner * 0.085;
    studs.push(`<circle cx="${cx}" cy="${cy + r * 0.18}" r="${r}" fill="#8a1206"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="#d9331f"/><circle cx="${cx - r * 0.25}" cy="${cy - r * 0.3}" r="${r * 0.45}" fill="#e86a55" opacity="0.8"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
    <rect x="${pad ? 0 : 0}" y="0" width="${s}" height="${s}" rx="${pad ? 0 : 112}" fill="${pad ? "#c91a09" : "none"}"/>
    <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${pad ? inner * 0.2 : 112}" fill="#c91a09"/>
    ${studs.join("")}
    ${head(256, 262, inner * 0.3)}
  </svg>`;
}

const out = [
  ["public/icon-192.png", 192, 0],
  ["public/icon-512.png", 512, 0],
  ["public/apple-touch-icon.png", 180, 0],
  ["public/icon-maskable-512.png", 512, 60],
];
for (const [file, size, pad] of out) {
  await sharp(Buffer.from(svg(size, pad))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
