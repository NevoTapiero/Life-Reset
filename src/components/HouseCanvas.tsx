"use client";

import { useEffect, useRef } from "react";

// Pixel art only looks right at a whole-number scale: the game renders at
// 1/3 of the box and the canvas is shown at exactly 3x, so a 16px tile is a
// crisp 48px square and a character stands ~48px tall on a phone.
const ZOOM = 3;
import type { HouseState, HouseScene } from "@/game/HouseScene";
import type { Spot } from "@/lib/needs";

// Mounts the Phaser house into a div and keeps it in sync with React state.
// Phaser touches window at import, so everything game-related loads lazily
// inside the effect and never runs on the server.

export default function HouseCanvas({ state, onTap }: { state: HouseState; onTap?: (spot: Spot) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<HouseScene | null>(null);
  const latest = useRef(state); // what READY should show if it fires before the first sync effect
  const tap = useRef(onTap);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    (async () => {
      const [Phaser, { HouseScene }] = await Promise.all([import("phaser"), import("@/game/HouseScene")]);
      if (cancelled || !host.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: Math.round(host.current.clientWidth / ZOOM),
        height: Math.round(host.current.clientHeight / ZOOM),
        zoom: ZOOM,
        roundPixels: true, // tiles stay blocky via their texture filter (see the scene); text renders smooth
        backgroundColor: "#0c0c0e",
        scale: { mode: Phaser.Scale.NONE }, // CSS scales the canvas (see .house-canvas in globals.css)
        scene: [HouseScene],
      });
      game.events.once(Phaser.Core.Events.READY, () => {
        scene.current = game!.scene.getScene("house") as HouseScene;
        scene.current.setTapHandler((spot) => tap.current?.(spot));
        scene.current.sync(latest.current);
      });
    })();
    return () => {
      cancelled = true;
      scene.current = null;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    latest.current = state;
    scene.current?.sync(state);
  }, [state]);

  useEffect(() => {
    tap.current = onTap;
  }, [onTap]);

  return <div ref={host} className="house-canvas w-full min-w-0 rounded-2xl overflow-hidden" style={{ aspectRatio: "176 / 160", background: "#0c0c0e", contain: "inline-size" }} />;
}
