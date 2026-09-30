"use client";

import { useEffect, useRef, useState } from "react";
import Minifig from "@/components/Minifig";
import { CHARACTERS, type CharacterKey } from "@/lib/game";
import { brickSound } from "@/lib/brickSound";

// A minifig, alive: it blinks and sways, and a tap knocks it apart like in
// the LEGO games (head, arms and torso fly off) before it snaps back together.
export default function TapFig({
  character,
  level,
  size,
  phase = 0,
}: {
  character: string | null;
  level: number;
  size: number;
  /** seconds: puts idle blinks out of step in a group */
  phase?: number;
}) {
  const [breaking, setBreaking] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function knock() {
    if (breaking) return;
    setBreaking(true);
    brickSound.scatter();
    timers.current = [
      setTimeout(() => brickSound.rebuild(), 720),
      setTimeout(() => setBreaking(false), 1150),
    ];
  }

  const who = character && character in CHARACTERS ? CHARACTERS[character as CharacterKey].name.replace("The ", "") : "minifig";
  return (
    <button
      type="button"
      onClick={knock}
      className={`tap-fig ${breaking ? "mf-break" : ""}`}
      aria-label={`Tap the ${who}`}
      style={phase ? ({ "--mf-phase": `-${phase}s` } as React.CSSProperties) : undefined}
    >
      <Minifig character={character} level={level} size={size} alive />
    </button>
  );
}
