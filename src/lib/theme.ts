import { CHARACTERS, type CharacterKey } from "./game";

// The whole UI paints from --accent / --accent-2, so retheming the app to a
// user's character is just rewriting those on <html>. The -rgb pair carries the
// same colors as bare "r g b" triplets, because the glows and tints throughout
// globals.css need an alpha channel: rgb(var(--accent-rgb) / 0.35).

export const THEME_STORAGE_KEY = "sl-accent";
export const THEME_STORAGE_KEY_2 = "sl-accent2";

export function triplet(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h,
    16
  );
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function charFor(key: string | null | undefined) {
  return key && key in CHARACTERS ? CHARACTERS[key as CharacterKey] : CHARACTERS.warrior;
}

// The four CSS vars that theme a subtree, as a React style object. Used to scope
// a friend's colors to their profile page without touching the global theme.
export function characterVars(key: string | null | undefined): React.CSSProperties {
  const c = charFor(key);
  return {
    "--accent": c.accent,
    "--accent-2": c.accent2,
    "--accent-rgb": triplet(c.accent),
    "--accent-2-rgb": triplet(c.accent2),
  } as React.CSSProperties;
}

// Restore the app's original orange theme (used on the landing and auth pages,
// which must never take on the signed-in character's color). Removing the inline
// overrides lets the :root defaults in globals.css apply again.
export function resetTheme() {
  const s = document.documentElement.style;
  s.removeProperty("--accent");
  s.removeProperty("--accent-2");
  s.removeProperty("--accent-rgb");
  s.removeProperty("--accent-2-rgb");
}

export function applyCharacterTheme(key: string | null | undefined) {
  const c = charFor(key);
  const s = document.documentElement.style;
  s.setProperty("--accent", c.accent);
  s.setProperty("--accent-2", c.accent2);
  s.setProperty("--accent-rgb", triplet(c.accent));
  s.setProperty("--accent-2-rgb", triplet(c.accent2));
  // remember it so the next load can paint the right color before first paint
  try {
    localStorage.setItem(THEME_STORAGE_KEY, c.accent);
    localStorage.setItem(THEME_STORAGE_KEY_2, c.accent2);
  } catch {}
}
