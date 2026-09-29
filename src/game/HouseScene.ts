import * as Phaser from "phaser";
import type { CharacterKey } from "@/lib/game";
import type { Spot } from "@/lib/needs";

// Your character's house: Kenney's CC0 sample interior (public/game/room.json)
// with a Tiny Dungeon hero walking between the bed, desk, kitchen, table and an
// open patch of floor. The scene is dumb on purpose -- React tells it what you
// are doing (sync) and it acts it out.

export type HouseState = {
  hero: CharacterKey | null;
  spot: Spot;
  label: string;
  busy: boolean; // a quest was just checked: he goes and does it
  tired: boolean; // Energy is low: he moves slow and grey
  boost: { id: number; text: string } | null; // floating text, e.g. "+25 Mind"; a new id floats again
  available: Spot[]; // spots with a quest still to do today: they get a marker, like an idle builder
};

import { HERO_FRAME, T } from "./sprites";
// tile coords inside the 22x10 room; y=5 is the open corridor every spot is reached through
// x/y: where he stands. hit: the tappable rectangle over the furniture, in
// tiles (cx, cy, w, h) -- kept apart so the desk and the stove above it never
// swallow each other's taps
const SPOTS: Record<Spot, { x: number; y: number; face: 1 | -1; lie?: boolean; hit: [number, number, number, number] }> = {
  bed: { x: 1, y: 3, face: 1, lie: true, hit: [1.5, 3.5, 3, 3] },
  couch: { x: 12, y: 6, face: -1, hit: [11.5, 7.5, 4, 3] }, // the big table and its chairs
  mat: { x: 4, y: 5, face: 1, hit: [4.5, 5.5, 4, 2] }, // open floor in the bedroom
  desk: { x: 18, y: 4, face: -1, hit: [18, 5, 3, 1.6] }, // the chair beside the cabinet
  kitchen: { x: 18, y: 3, face: 1, hit: [18.5, 2.7, 4, 1.6] }, // the stove row
};
const CORRIDOR_Y = 5;
const px = (t: number) => t * T + T / 2;

// Text is the one thing that must not be pixelated: draw it at device density
// and let the GPU smooth it, while every tile keeps nearest-neighbour edges.
function crisp<T extends Phaser.GameObjects.Text>(t: T): T {
  return t; // resolution 1: glyphs are drawn at their real size and smoothed by the 3x zoom
}

type Layers = Record<string, number[][]>;

export class HouseScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Sprite;
  private bubble!: Phaser.GameObjects.Container;
  private bubbleText!: Phaser.GameObjects.Text;
  private bubbleBg!: Phaser.GameObjects.Graphics;
  private zzz!: Phaser.GameObjects.Text;
  private bob?: Phaser.Tweens.Tween;
  private at: Spot = "couch";
  private pending: HouseState | null = null;
  private lastBoost = 0;
  private markers = new Map<Spot, Phaser.GameObjects.Container>();
  private onTap: ((spot: Spot) => void) | null = null;
  private ready = false;

  constructor() {
    super("house");
  }

  preload() {
    this.load.spritesheet("roguelike", "/game/roguelike.png", { frameWidth: T, frameHeight: T, spacing: 1 });
    this.load.spritesheet("heroes", "/game/tiny-dungeon.png", { frameWidth: T, frameHeight: T });
    this.load.json("room", "/game/room.json");
  }

  create() {
    // pixel art wants hard edges; everything else (text) may be smooth
    this.textures.get("roguelike").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("heroes").setFilter(Phaser.Textures.FilterMode.NEAREST);
    const room = this.cache.json.get("room") as { width: number; height: number; layers: Layers };
    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: room.width, height: room.height });
    const tiles = map.addTilesetImage("roguelike", "roguelike", T, T, 0, 1)!;
    let depth = 0;
    for (const name of ["Floor", "Carpet", "Objects", "Details"]) {
      const grid = room.layers[name];
      if (!grid) continue;
      const layer = map.createBlankLayer(name, tiles)!;
      layer.setDepth(depth++);
      grid.forEach((row, y) => row.forEach((idx, x) => idx >= 0 && layer.putTileAt(idx, x, y)));
    }

    this.body = this.add.sprite(0, 0, "heroes", HERO_FRAME.warrior);
    this.bubbleBg = this.add.graphics();
    this.bubbleText = crisp(
      this.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "8px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 1),
    );
    this.bubble = this.add.container(0, -12, [this.bubbleBg, this.bubbleText]).setVisible(false); // words are drawn in HTML over the canvas
    this.zzz = crisp(this.add.text(6, -14, "z z", { fontFamily: "monospace", fontSize: "8px", color: "#bfe9ff" })).setVisible(false);
    this.hero = this.add.container(px(SPOTS.couch.x), px(SPOTS.couch.y), [this.body, this.bubble, this.zzz]).setDepth(10);

    // the viewport shows one room at a time and glides after him as he walks;
    // drag to look at the rest of the house, it snaps back to him when he moves
    const cam = this.cameras.main.setBounds(0, 0, ROOM_W, ROOM_H).startFollow(this.hero, true, 0.08, 0.08);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.stopFollow();
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
    });

    // each piece of furniture is a tap target; tapping is how you log
    for (const [spot, at] of Object.entries(SPOTS) as [Spot, (typeof SPOTS)[Spot]][]) {
      const [hx, hy, hw, hh] = at.hit;
      this.add
        .zone(hx * T, hy * T, hw * T, hh * T)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", (p: Phaser.Input.Pointer) => p.getDistance() < 6 && this.onTap?.(spot));
      // marker: a small bouncing chevron above the spot, shown while there is something to do there
      const g = this.add.graphics().fillStyle(0xffd27a, 1).fillTriangle(-4, -6, 4, -6, 0, 0).lineStyle(1, 0x000000, 0.6).strokeTriangle(-4, -6, 4, -6, 0, 0);
      const m = this.add.container(px(at.x), px(at.y) - 16, [g]).setDepth(15).setVisible(false);
      this.tweens.add({ targets: m, y: m.y - 4, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.markers.set(spot, m);
    }

    this.night = this.add.rectangle(0, 0, ROOM_W, ROOM_H, 0x0b1030).setOrigin(0).setDepth(50).setAlpha(0);
    this.applyNight();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.applyNight() });

    this.ready = true;
    if (this.pending) this.sync(this.pending);
  }


  // the world runs on the real clock: a blue-black tint rolls in at dusk
  private night!: Phaser.GameObjects.Rectangle;
  private applyNight() {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
    const amt = hour >= 7 && hour < 18 ? 0 : hour >= 18 && hour < 21 ? (hour - 18) / 3 : hour >= 5 && hour < 7 ? (7 - hour) / 2 : 1;
    this.night.setAlpha(0.55 * amt);
  }

  setTapHandler(fn: ((spot: Spot) => void) | null) {
    this.onTap = fn;
  }

  // Called from React whenever the state changes. Safe to call before create().
  sync(s: HouseState) {
    if (!this.ready) {
      this.pending = s;
      return;
    }
    this.pending = null;
    this.body.setFrame(HERO_FRAME[s.hero ?? "warrior"]);
    this.setLabel(s.label + (s.busy ? "…" : ""));
    this.body.setTint(s.tired && !s.busy ? 0x8f8fa8 : 0xffffff);
    if (s.spot !== this.at) this.walkTo(s.spot, s.tired && !s.busy);
    else this.arrive(s.spot, s.busy);
    for (const [spot, m] of this.markers) m.setVisible(s.available.includes(spot) && !(s.busy && s.spot === spot));
    if (s.boost && s.boost.id !== this.lastBoost) {
      this.lastBoost = s.boost.id;
      this.hop(); // the number itself floats in HTML; he just reacts
    }
  }

  private setLabel(text: string) {
    this.bubbleText.setText(text);
    const w = this.bubbleText.width + 8;
    const h = this.bubbleText.height + 4;
    this.bubbleBg.clear().fillStyle(0x000000, 0.75).fillRoundedRect(-w / 2, -h - 1, w, h, 3);
    this.bubbleText.setY(-1);
  }

  private walkTo(spot: Spot, slow: boolean) {
    const from = SPOTS[this.at];
    const to = SPOTS[spot];
    this.at = spot;
    this.tweens.killTweensOf(this.hero);
    this.stopPose();
    this.cameras.main.startFollow(this.hero, true, 0.08, 0.08);
    // three legs: out to the corridor, along it, into the spot
    const legs = [
      { x: px(from.x), y: px(CORRIDOR_Y) },
      { x: px(to.x), y: px(CORRIDOR_Y) },
      { x: px(to.x), y: px(to.y) },
    ];
    const speed = slow ? 45 : 90; // px per second
    let cx = this.hero.x;
    let cy = this.hero.y;
    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    for (const l of legs) {
      const d = Math.hypot(l.x - cx, l.y - cy);
      cx = l.x;
      cy = l.y;
      if (d >= 1) tweens.push({ targets: this.hero, x: l.x, y: l.y, duration: (d / speed) * 1000, ease: "Linear" });
    }
    this.body.setFlipX(to.x < from.x);
    // a little hop each step while walking
    this.bob = this.tweens.add({ targets: this.body, y: -2, duration: 140, yoyo: true, repeat: -1 });
    if (!tweens.length) return this.arrive(spot, false);
    this.tweens.chain({ tweens, onComplete: () => this.arrive(spot, false) });
  }

  private stopPose() {
    this.bob?.destroy();
    this.bob = undefined;
    this.body.setAngle(0).setY(0);
    this.zzz.setVisible(false);
  }

  private arrive(spot: Spot, busy: boolean) {
    const s = SPOTS[spot];
    this.stopPose();
    this.body.setFlipX(s.face < 0);
    if (s.lie) {
      this.body.setAngle(-90); // lying in the bed
      this.zzz.setVisible(true);
      this.tweens.add({ targets: this.zzz, y: -18, alpha: { from: 1, to: 0.2 }, duration: 900, yoyo: true, repeat: -1 });
    } else if (busy) {
      // doing the thing: a quick working bob
      this.bob = this.tweens.add({ targets: this.body, y: -1, duration: 220, yoyo: true, repeat: -1 });
    }
  }

  private hop() {
    this.tweens.add({ targets: this.body, y: -4, duration: 110, yoyo: true, ease: "Quad.easeOut" });
  }

  private float(text: string) {
    const t = crisp(
      this.add
        .text(this.hero.x, this.hero.y - 14, text, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: text.startsWith("-") ? "#ff7d8c" : "#ffd27a",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 1)
        .setDepth(20),
    );
    this.tweens.add({ targets: t, y: t.y - 18, alpha: 0, duration: 1100, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }
}

export const ROOM_W = 22 * T; // the whole house
export const ROOM_H = 16 * T; // house, porch and garden
export const VIEW_W = 11 * T; // what the canvas shows: about one room, so tiles are big on a phone
export const VIEW_H = 10 * T;
