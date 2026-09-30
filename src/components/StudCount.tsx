"use client";

import { useEffect, useRef, useState } from "react";
import { brickSound } from "@/lib/brickSound";

// A number that ticks up like a LEGO game's stud counter: when it's higher
// than the last time this device saw it, it rolls up from there with stud
// chimes; otherwise it just shows the value.
export default function StudCount({ value, storeKey }: { value: number; storeKey: string }) {
  // start from what this device saw last, so the roll never flashes the end
  // value first (Home draws this only on the phone, after its data loads)
  const [shown, setShown] = useState(() => {
    try {
      const n = Number(localStorage.getItem(storeKey) ?? NaN);
      return Number.isFinite(n) && n < value ? n : value;
    } catch {
      return value;
    }
  });
  const [rolling, setRolling] = useState(false);
  // the number on screen right now: a new value mid-roll carries on from here
  const shownRef = useRef(shown);
  const raf = useRef(0);

  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(storeKey, String(value));
      } catch {}
    };
    const show = (n: number) => {
      shownRef.current = n;
      setShown(n);
    };
    const from = shownRef.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (from >= value || reduce) {
      // no roll (nothing new, or gold was spent): show the value as it is
      show(value);
      setRolling(false);
      save();
      return;
    }
    const start = performance.now();
    const dur = Math.min(1600, 500 + (value - from) * 12);
    let lastTick = 0;
    let step = 1;
    setRolling(true);
    const frame = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      show(Math.round(from + (value - from) * eased));
      if (now - lastTick > 110 && k < 1) {
        lastTick = now;
        brickSound.stud(Math.min(7, step++));
      }
      if (k < 1) raf.current = requestAnimationFrame(frame);
      else setRolling(false);
    };
    raf.current = requestAnimationFrame(frame);
    // leaving mid-roll counts as seen, so it doesn't replay next visit
    return () => {
      cancelAnimationFrame(raf.current);
      save();
    };
  }, [value, storeKey]);

  return <span className={rolling ? "stud-rolling" : undefined}>{shown.toLocaleString()}</span>;
}
