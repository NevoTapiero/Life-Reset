import * as Phaser from "phaser";
import type { CharacterKey } from "@/lib/game";
import { HERO_FRAME, T } from "./sprites";
import {
  TOWN_W,
  TOWN_H,
  YARD_W,
  YARD_H,
  STREET_X,
  STREET_Y,
  blockedGrid,
  findPath,
  placeHouses,
  scatterTrees,
  statusFor,
  type Plot,
  type TownHouse,
  type TownRow,
} from "@/lib/town";

// The town: a small open map built from Kenney's Tiny Town tiles. Your house
// and your friends' houses, each with its owner standing outside. Tap the
// ground to walk, tap a house to visit.

export type TownState = { hero: CharacterKey | null; rows: TownRow[] };

// Tiny Town tile indices (12 columns, packed)
const GRASS = [0, 0, 0, 0, 0, 1, 2];
const COBBLE = 43;
const TREES = [3, 4, 5, 15, 16, 27, 28];
const HOUSE_TILES: Record<0 | 1 | 2, number[][]> = {
  0: [
    [60, 61, 62],
    [72, 74, 73],
  ],
  1: [
    [53, 54, 55],
    [65, 66, 67],
    [76, 78, 77],
  ],
  2: [
    [99, 100, 101, 102],
    [111, 112, 113, 114],
    [123, 124, 125, 126],
  ],
};
// fence pieces: corners, rails, and what grows in a garden
const FENCE = { tl: 44, top: 45, tr: 46, left: 56, right: 58, bl: 68, bottom: 69, br: 70 };
const GARDEN: Record<string, number> = { flower: 2, hive: 94, target: 95, sign: 83, shroom: 29, tree: 15 };
const px = (t: number) => t * T + T / 2;

// Text is the one thing that must not be pixelated: draw it at device density
// and let the GPU smooth it, while every tile keeps nearest-neighbour edges.
function crisp<T extends Phaser.GameObjects.Text>(t: T): T {
  return t; // resolution 1: glyphs are drawn at their real size and smoothed by the 3x zoom
}

export class TownScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Sprite;
  private houses: TownHouse[] = [];
  private blocked: boolean[][] = [];
  private at: Plot = { x: STREET_X[0], y: STREET_Y[0] };
  private walking = false;
  private bob?: Phaser.Tweens.Tween;
  private built = false;
  private ready = false;
  private pendingState: TownState | null = null;
  private onHouse: ((h: TownHouse) => void) | null = null;
  private objects!: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super("town");
  }

  preload() {
    this.load.spritesheet("town", "/game/tiny-town.png", { frameWidth: T, frameHeight: T });
    this.load.spritesheet("heroes", "/game/tiny-dungeon.png", { frameWidth: T, frameHeight: T });
  }

  create() {
    // pixel art wants hard edges; everything else (text) may be smooth
    this.textures.get("town").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("heroes").setFilter(Phaser.Textures.FilterMode.NEAREST);
    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: TOWN_W, height: TOWN_H });
    const tiles = map.addTilesetImage("town", "town", T, T, 0, 0)!;
    const ground = map.createBlankLayer("ground", tiles)!.setDepth(0);
    this.objects = map.createBlankLayer("objects", tiles)!.setDepth(1);
    let seed = 3;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let y = 0; y < TOWN_H; y++)
      for (let x = 0; x < TOWN_W; x++) ground.putTileAt(STREET_X.includes(x) || STREET_Y.includes(y) ? COBBLE : GRASS[Math.floor(rnd() * GRASS.length)], x, y);

    this.body = this.add.sprite(0, 0, "heroes", HERO_FRAME.warrior);
    this.hero = this.add.container(px(this.at.x), px(this.at.y), [this.body]).setDepth(10);

    const cam = this.cameras.main.setBounds(0, 0, TOWN_W * T, TOWN_H * T).startFollow(this.hero, true, 0.08, 0.08);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.stopFollow();
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.getDistance() >= 6) return;
      const tx = Math.floor(p.worldX / T);
      const ty = Math.floor(p.worldY / T);
      const house = this.houses.find((h) => tx >= h.house.x && tx < h.house.x + h.spec.w && ty >= h.house.y && ty < h.house.y + h.spec.h);
      if (house) this.walkTo(house.doorstep, () => this.onHouse?.(house));
      else this.walkTo({ x: tx, y: ty });
    });

    this.night = this.add.rectangle(0, 0, TOWN_W * T, TOWN_H * T, 0x0b1030).setOrigin(0).setDepth(50).setAlpha(0);
    this.applyNight();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.applyNight() });

    this.ready = true;
    if (this.pendingState) this.sync(this.pendingState);
  }


  // the world runs on the real clock: a blue-black tint rolls in at dusk
  private night!: Phaser.GameObjects.Rectangle;
  private applyNight() {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
    const amt = hour >= 7 && hour < 18 ? 0 : hour >= 18 && hour < 21 ? (hour - 18) / 3 : hour >= 5 && hour < 7 ? (7 - hour) / 2 : 1;
    this.night.setAlpha(0.55 * amt);
  }

  setHouseHandler(fn: ((h: TownHouse) => void) | null) {
    this.onHouse = fn;
  }

  sync(s: TownState) {
    if (!this.ready) {
      this.pendingState = s;
      return;
    }
    this.pendingState = null;
    this.body.setFrame(HERO_FRAME[s.hero ?? "warrior"]);
    if (!this.built && s.rows.length) this.build(s.rows);
  }

  // Houses, their owners standing outside, the labels, the trees, and the
  // doorstep paths that join every door to the street.
  private build(rows: TownRow[]) {
    this.built = true;
    this.houses = placeHouses(rows);
    const trees = scatterTrees(this.houses);
    this.blocked = blockedGrid(this.houses, trees);
    const ground = this.objects.tilemap.getLayer("ground")!.tilemapLayer;

    for (const h of this.houses) {
      // the yard: fence all round, a gate at the bottom
      for (let y = 0; y < YARD_H; y++)
        for (let x = 0; x < YARD_W; x++) {
          const gx = h.plot.x + x;
          const gy = h.plot.y + y;
          const idx =
            y === 0 && x === 0 ? FENCE.tl
            : y === 0 && x === YARD_W - 1 ? FENCE.tr
            : y === YARD_H - 1 && x === 0 ? FENCE.bl
            : y === YARD_H - 1 && x === YARD_W - 1 ? FENCE.br
            : y === 0 ? FENCE.top
            : y === YARD_H - 1 ? FENCE.bottom
            : x === 0 ? FENCE.left
            : x === YARD_W - 1 ? FENCE.right
            : -1;
          if (idx >= 0 && !(gx === h.gate.x && gy === h.gate.y)) this.objects.putTileAt(idx, gx, gy);
        }
      HOUSE_TILES[h.spec.tier].forEach((row, dy) => row.forEach((idx, dx) => this.objects.putTileAt(idx, h.house.x + dx, h.house.y + dy)));
      for (const it of h.garden) this.objects.putTileAt(GARDEN[it.kind], it.x, it.y);
      // the lane: doorstep, through the gate, down to the street
      const sy = STREET_Y.find((y) => y > h.gate.y) ?? h.gate.y;
      for (let y = h.doorstep.y; y <= sy; y++) ground.putTileAt(COBBLE, h.doorstep.x, y);

      const cx = px(h.house.x) + ((h.spec.w - 1) * T) / 2;
      const top = h.house.y * T - 2;
      const xpText = h.row.today_xp !== null ? `+${h.row.today_xp} today` : h.row.weekly_xp !== null ? `+${h.row.weekly_xp} this week` : "";
      crisp(
        this.add
          .text(cx, top, `${h.row.is_me ? "You" : h.row.username}${xpText ? `\n${xpText}` : ""}`, {
            fontFamily: "monospace",
            fontSize: "7px",
            color: h.row.is_me ? "#ffd27a" : "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(20),
      );

      if (!h.row.is_me) {
        // the friend, standing by their door, doing what their status says
        const who = this.add.sprite(px(h.doorstep.x + 1), px(h.doorstep.y), "heroes", HERO_FRAME[h.row.archetype ?? "warrior"]).setDepth(9);
        this.tweens.add({ targets: who, y: who.y - 1, duration: 900 + (h.plot.x % 5) * 90, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        crisp(
          this.add
            .text(who.x, who.y - 11, statusFor(h.row), { fontFamily: "monospace", fontSize: "6px", color: "#cfd6ff", stroke: "#000", strokeThickness: 2 })
            .setOrigin(0.5, 1)
            .setDepth(20),
        );
      }
    }
    trees.forEach((t, i) => this.objects.putTileAt(TREES[i % TREES.length], t.x, t.y));

    // you start on your own doorstep
    const mine = this.houses.find((h) => h.row.is_me);
    if (mine) {
      this.at = { ...mine.doorstep };
      this.hero.setPosition(px(this.at.x), px(this.at.y));
      this.cameras.main.centerOn(this.hero.x, this.hero.y);
    }
  }

  private walkTo(target: Plot, then?: () => void) {
    if (this.walking) return;
    const path = findPath(this.blocked, this.at, target);
    if (!path) return;
    if (!path.length) {
      then?.();
      return;
    }
    this.walking = true;
    this.cameras.main.startFollow(this.hero, true, 0.08, 0.08);
    this.bob = this.tweens.add({ targets: this.body, y: -2, duration: 140, yoyo: true, repeat: -1 });
    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    let prev = this.at;
    for (const step of path) {
      tweens.push({
        targets: this.hero,
        x: px(step.x),
        y: px(step.y),
        duration: 190,
        ease: "Linear",
        onStart: () => this.body.setFlipX(step.x < prev.x),
      });
      prev = step;
    }
    this.tweens.chain({
      tweens,
      onComplete: () => {
        this.at = target;
        this.walking = false;
        this.bob?.destroy();
        this.body.setY(0);
        then?.();
      },
    });
  }
}

export const TOWN_VIEW_W = 11 * T;
export const TOWN_VIEW_H = 11 * T;
