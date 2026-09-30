"use client";

import { useEffect } from "react";
import { brickSound } from "@/lib/brickSound";

// Every brick button, tab and option clicks like plastic when pressed. One
// listener for the whole app instead of a handler on each button.
export default function ButtonSounds() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".btn-primary, .btn-ghost, .brick-tab, .option-row, .brick-nav a, .switch");
      // buttons that play their own sound opt out
      if (!el || (el as HTMLButtonElement).disabled || el.hasAttribute("data-own-sound")) return;
      if (el.matches(".switch")) brickSound.snap();
      else if (el.matches(".brick-tab, .brick-nav a")) brickSound.tap();
      else brickSound.press();
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);
  return null;
}
