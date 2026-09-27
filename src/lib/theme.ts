import { CHARACTERS, type CharacterKey } from "./game";

// The whole UI paints from --accent / --accent-2, so retheming the app to a
// user's character is just rewriting those on <html>. The -rgb pair carries the
// same colors as bare "r g b" triplets, because the glows and tints throughout
// globals.css need an alpha channel: rgb(var(--accent-rgb) / 0.35).

function triplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function applyCharacterTheme(key: string | null | undefined) {
  const c = key && key in CHARACTERS ? CHARACTERS[key as CharacterKey] : CHARACTERS.warrior;
  const s = document.documentElement.style;
  s.setProperty("--accent", c.accent);
  s.setProperty("--accent-2", c.accent2);
  s.setProperty("--accent-rgb", triplet(c.accent));
  s.setProperty("--accent-2-rgb", triplet(c.accent2));
}
