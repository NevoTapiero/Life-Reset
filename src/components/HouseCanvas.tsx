"use client";

import { useEffect, useRef } from "react";

// The isometric home. Rendered art, so it scales like a photo: no zoom tricks.
import type { HouseState } from "@/game/HouseScene";
import type { IsoScene } from "@/game/IsoScene";
import type { Spot } from "@/lib/needs";

// Mounts the Phaser house into a div and keeps it in sync with React state.
// Phaser touches window at import, so everything game-related loads lazily
// inside the effect and never runs on the server.

export default function HouseCanvas({ state, onTap }: { state: HouseState; onTap?: (spot: Spot) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<IsoScene | null>(null);
  const latest = useRef(state); // what READY should show if it fires before the first sync effect
  const tap = useRef(onTap);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    (async () => {
      const [Phaser, { IsoScene }] = await Promise.all([import("phaser"), import("@/game/IsoScene")]);
      if (cancelled || !host.current) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        // draw at device density: a backing canvas dpr times larger, shown at 1/dpr
        width: Math.round(host.current.clientWidth * dpr),
        height: Math.round(host.current.clientHeight * dpr),
        zoom: 1 / dpr,
        backgroundColor: "#b3905f", // the land's own colour, so the edge of the map is never a black cut
        scale: { mode: Phaser.Scale.NONE },
        scene: [IsoScene],
      });
      game.events.once(Phaser.Core.Events.READY, () => {
        scene.current = game!.scene.getScene("iso") as IsoScene;
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

  return <div ref={host} className="house-canvas w-full h-full min-w-0 overflow-hidden" style={{ background: "#0c0c0e", contain: "inline-size" }} />;
}
