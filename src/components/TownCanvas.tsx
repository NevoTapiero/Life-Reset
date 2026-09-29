"use client";

import { useEffect, useRef } from "react";
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
      const [Phaser, { TownScene, TOWN_VIEW_W, TOWN_VIEW_H }] = await Promise.all([import("phaser"), import("@/game/TownScene")]);
      if (cancelled || !host.current) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: TOWN_VIEW_W,
        height: TOWN_VIEW_H,
        pixelArt: true,
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

  return <div ref={host} className="house-canvas w-full min-w-0 rounded-2xl overflow-hidden" style={{ aspectRatio: "1 / 1", background: "#0c0c0e", contain: "inline-size" }} />;
}
