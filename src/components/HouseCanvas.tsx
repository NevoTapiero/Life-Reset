"use client";

import { useEffect, useRef } from "react";
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
      const [Phaser, { HouseScene, VIEW_W, VIEW_H }] = await Promise.all([import("phaser"), import("@/game/HouseScene")]);
      if (cancelled || !host.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: VIEW_W,
        height: VIEW_H,
        pixelArt: true,
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
