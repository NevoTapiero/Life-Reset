"use client";

import { useRef, useState } from "react";
import Minifig from "@/components/Minifig";
import { brickSound } from "@/lib/brickSound";

// Your minifig, alive: it blinks and sways, and a tap knocks it apart like in
// the LEGO games (head, arms and torso fly off) before it snaps back together.
export default function TapFig({ character, level, size }: { character: string | null; level: number; size: number }) {
  const [breaking, setBreaking] = useState(0);
  const busy = useRef(false);

  function knock() {
    if (busy.current) return;
    busy.current = true;
    setBreaking((n) => n + 1);
    brickSound.scatter();
    setTimeout(() => brickSound.rebuild(), 720);
    setTimeout(() => {
      busy.current = false;
      setBreaking(0);
    }, 1150);
  }

  return (
    <button type="button" onClick={knock} className={`tap-fig ${breaking ? "mf-break" : ""}`} aria-label="Tap your minifig">
      <Minifig character={character} level={level} size={size} alive />
    </button>
  );
}
