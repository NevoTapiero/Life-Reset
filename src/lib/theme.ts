// The app wears one LEGO palette everywhere (see the tokens in globals.css).
// Characters used to repaint the whole UI in their accent colour; in the brick
// theme a character's colour only shows on its own badge and avatar, so these
// helpers now keep (or restore) the LEGO palette. They stay exported so older
// screens that still call them keep working.

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

// A friend's screen used to take their colours; now every screen is LEGO.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for old callers
export function characterVars(_key?: string | null): React.CSSProperties {
  return {};
}

// Drop any accent an older build painted onto <html>, so the :root LEGO
// tokens apply again.
export function resetTheme() {
  const s = document.documentElement.style;
  s.removeProperty("--accent");
  s.removeProperty("--accent-2");
  s.removeProperty("--accent-rgb");
  s.removeProperty("--accent-2-rgb");
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
    localStorage.removeItem(THEME_STORAGE_KEY_2);
  } catch {}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for old callers
export function applyCharacterTheme(_key?: string | null) {
  resetTheme();
}
