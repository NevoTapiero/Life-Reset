"use client";

import { useEffect, useRef } from "react";

// Pixel art only looks right at a whole-number scale: the game renders at
// 1/3 of the box and the canvas is shown at exactly 3x, so a 16px tile is a
// crisp 48px square and a character stands ~48px tall on a phone.
const ZOOM = 3;
import type { TownScene, TownState } from "@/game/TownScene";
import type { TownHouse } from "@/lib/town";

// Same shape as HouseCanvas: Phaser loads lazily in the browser, React feeds it state.
export default function TownCanvas({ state, onHouse }: { state: TownState; onHouse?: (h: TownHouse) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<TownScene | null>(null);
  const latest = useRef(state);
  const tap = useRef(onHouse);

  useEffect(() => {
    let game: Phaser.Game | null = null;
    let cancelled = false;
    (async () => {
      const [Phaser, { TownScene }] = await Promise.all([import("phaser"), import("@/game/TownScene")]);
      if (cancelled || !host.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: Math.round(host.current.clientWidth / ZOOM),
        height: Math.round(host.current.clientHeight / ZOOM),
        zoom: ZOOM,
        roundPixels: true, // tiles stay blocky via their texture filter (see the scene); text renders smooth
        backgroundColor: "#0c0c0e",
        scale: { mode: Phaser.Scale.NONE },
        scene: [TownScene],
      });
      game.events.once(Phaser.Core.Events.READY, () => {
        scene.current = game!.scene.getScene("town") as TownScene;
        scene.current.setHouseHandler((h) => tap.current?.(h));
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
    tap.current = onHouse;
  }, [onHouse]);

  return <div ref={host} className="house-canvas w-full h-full min-w-0 overflow-hidden" style={{ background: "#0c0c0e", contain: "inline-size" }} />;
}
