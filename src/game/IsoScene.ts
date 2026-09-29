import * as Phaser from "phaser";
import type { HouseState } from "./HouseScene";
import type { Spot } from "@/lib/needs";
import { findPath, type Plot } from "@/lib/town";

// Your home, isometric: Kenney's rendered miniature pieces (public/game/iso).
// A small yard with an open-top cabin at the back; he runs between the bed,
// the desk, the barrels, the table and the open ground. Same contract as the
// pixel HouseScene: React calls sync(), taps come back through the handler.

const TW = 128; // tile diamond width at half resolution
const TH = 64;
const GRID = 7;
const PAD = 5; // rows of open land around the fence
const HERO_SCALE = 1.25;

// where he stands for each spot (x, y), what stands there and where (px, py)
const SPOTS: Record<Spot, { x: number; y: number; face: number; piece?: string; px?: number; py?: number }> = {
  bed: { x: 3, y: 1, face: 0, piece: "chest", px: 3, py: 1 }, // the bed is a chest for now: he stands on it, asleep
  desk: { x: 2, y: 2, face: 7, piece: "bookdesk_S", px: 2, py: 1 }, // inside, facing the desk at the back wall
  kitchen: { x: 5, y: 3, face: 0, piece: "barrels", px: 5, py: 2 },
  couch: { x: 3, y: 5, face: 6, piece: "table", px: 2, py: 5 },
  mat: { x: 5, y: 5, face: 4 },
};
const HOUSE = { x0: 2, y0: 1, x1: 3, y1: 2 }; // cabin footprint, inclusive
const PORCH = [{ x: 2, y: 3 }, { x: 3, y: 3 }];
const DECOR: { x: number; y: number; piece: string }[] = [
  { x: 6, y: 5, piece: "hay" }, { x: 6, y: 6, piece: "hayStack" },
  { x: 0, y: 5, piece: "corn" }, { x: 0, y: 6, piece: "cornDouble" }, { x: 1, y: 6, piece: "corn" },
  { x: 4, y: 2, piece: "sacks" }, { x: 6, y: 1, piece: "crates" }, { x: 0, y: 1, piece: "barrel" },
];
// Kenney's suffix is not the edge the piece sits on. Read off the renders:
// _N covers the south-west edge, _E the north-west, _S the north-east, _W the south-east.
// Screen-wise: NE edge faces (x, y-1) up-right, NW faces (x-1, y) up-left,
// SE faces (x+1, y) down-right, SW faces (x, y+1) down-left.
const EDGE = { nw: "E", ne: "S", se: "W", sw: "N" } as const;

const sx = (x: number, y: number) => (x - y) * (TW / 2);
const sy = (x: number, y: number) => (x + y) * (TH / 2);
const depthOf = (x: number, y: number, layer: number) => (x + y) * 10 + layer;

// grid direction -> Kenney compass frame (0 N up-right, 2 E down-right, 4 S down-left, 6 W up-left)
function dirOf(dx: number, dy: number): number {
  if (dx > 0 && dy === 0) return 2;
  if (dx < 0 && dy === 0) return 6;
  if (dy > 0 && dx === 0) return 4;
  if (dy < 0 && dx === 0) return 0;
  if (dx > 0 && dy > 0) return 3;
  if (dx < 0 && dy < 0) return 7;
  if (dx > 0 && dy < 0) return 1;
  return 5;
}

export class IsoScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Sprite;
  private markers = new Map<Spot, Phaser.GameObjects.Container>();
  private night!: Phaser.GameObjects.Rectangle;
  private blocked: boolean[][] = [];
  private at: Plot = { x: 4, y: 4 };
  private atSpot: Spot | null = null;
  private walking = false;
  private pending: HouseState | null = null;
  private ready = false;
  private lastBoost = 0;
  private onTap: ((spot: Spot) => void) | null = null;

  constructor() {
    super("iso");
  }

  preload() {
    this.load.atlas("tiles", "/game/iso/tiles.png", "/game/iso/tiles.json");
    this.load.atlas("hero", "/game/iso/hero.png", "/game/iso/hero.json");
  }

  private put(x: number, y: number, frame: string, layer: number, dy = 0) {
    return this.add.image(sx(x, y), sy(x, y) + TH + dy, "tiles", frame).setOrigin(0.5, 1).setDepth(depthOf(x, y, layer));
  }

  create() {
    this.blocked = Array.from({ length: GRID }, () => Array<boolean>(GRID).fill(false));
    const inHouse = (x: number, y: number) => x >= HOUSE.x0 && x <= HOUSE.x1 && y >= HOUSE.y0 && y <= HOUSE.y1;

    // ground: the yard plus a wide apron of land around it, so the screen is never black
    for (let y = -PAD; y < GRID + PAD; y++)
      for (let x = -PAD; x < GRID + PAD; x++) {
        const inside = x >= 0 && y >= 0 && x < GRID && y < GRID;
        const floor = inside && (inHouse(x, y) || PORCH.some((p) => p.x === x && p.y === y));
        this.put(x, y, floor ? "planks" : (x * 7 + y * 3) % 5 === 0 ? "farmland" : "dirt", 0);
      }
    // fence round the yard, with a gap in the front-left side
    for (let i = 0; i < GRID; i++) {
      this.put(i, 0, `fence_${EDGE.ne}`, 1); // back row, up-right edge
      this.put(0, i, `fence_${EDGE.nw}`, 1); // left column, up-left edge
      if (i !== 3) this.put(i, GRID - 1, `fence_${EDGE.sw}`, 3); // front-left side, with the gate gap
      this.put(GRID - 1, i, `fence_${EDGE.se}`, 3); // front-right side
    }
    // the cabin, open-top: plain walls at the back, door and windows at the front
    for (let y = HOUSE.y0; y <= HOUSE.y1; y++)
      for (let x = HOUSE.x0; x <= HOUSE.x1; x++) {
        if (y === HOUSE.y0) this.put(x, y, `wall_${EDGE.ne}`, 1);
        if (x === HOUSE.x0) this.put(x, y, `wall_${EDGE.nw}`, 1);
        if (y === HOUSE.y1) this.put(x, y, x === HOUSE.x0 ? `door_${EDGE.sw}` : `window_${EDGE.sw}`, 3);
        if (x === HOUSE.x1) this.put(x, y, y === HOUSE.y0 ? `window_${EDGE.se}` : `wall_${EDGE.se}`, 3);
      }
    for (const d of DECOR) {
      this.put(d.x, d.y, d.piece, 2);
      this.blocked[d.y][d.x] = true;
    }
    for (const [spot, s] of Object.entries(SPOTS) as [Spot, (typeof SPOTS)[Spot]][]) {
      if (s.piece) {
        this.put(s.px!, s.py!, s.piece, 2);
        if (s.px !== s.x || s.py !== s.y) this.blocked[s.py!][s.px!] = true;
      }
      // marker: a bouncing chevron over the spot while there is something to do there
      const g = this.add.graphics().fillStyle(0xffd27a, 1).fillTriangle(-10, -16, 10, -16, 0, 0).lineStyle(2, 0x000000, 0.5).strokeTriangle(-10, -16, 10, -16, 0, 0);
      const m = this.add.container(sx(s.x, s.y), sy(s.x, s.y) - 40, [g]).setDepth(depthOf(s.x, s.y, 9)).setVisible(false);
      this.tweens.add({ targets: m, y: m.y - 10, duration: 420, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.markers.set(spot, m);
    }

    // the character: idle per direction, run loops per direction, pickup for "doing it"
    for (let d = 0; d < 8; d++) {
      this.anims.create({ key: `run_${d}`, frames: this.anims.generateFrameNames("hero", { prefix: `run_${d}_`, start: 0, end: 9 }), frameRate: 14, repeat: -1 });
      this.anims.create({ key: `pick_${d}`, frames: this.anims.generateFrameNames("hero", { prefix: `pick_${d}_`, frames: [0, 2, 4, 6, 8] }), frameRate: 6, repeat: -1, yoyo: true });
    }
    this.hero = this.add
      .sprite(sx(this.at.x, this.at.y), sy(this.at.x, this.at.y) + TH / 2, "hero", "idle_4")
      .setOrigin(0.5, 128 / 144)
      .setScale(HERO_SCALE)
      .setDepth(depthOf(this.at.x, this.at.y, 6));

    // camera: the yard, a little zoomed out; drag to look around, it follows him when he moves
    const cam = this.cameras.main;
    // the camera may roam the yard and a little of the land around it
    const minX = sx(-2, GRID + 1) - TW / 2, maxX = sx(GRID + 1, -2) + TW / 2;
    const minY = sy(-2, -2) - 120, maxY = sy(GRID + 1, GRID + 1) + TH;
    // cover the screen with the yard: zoom to the larger of fit-width / fit-height, then pan
    const yardW = sx(GRID - 1, 0) - sx(0, GRID - 1) + TW;
    const zoom = Math.max(this.scale.width / yardW, this.scale.height / (maxY - minY));
    cam.setBounds(minX, minY, maxX - minX, maxY - minY).setZoom(zoom).startFollow(this.hero, true, 0.08, 0.08);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.stopFollow();
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (p.getDistance() >= 6) return;
      const wx = p.worldX, wy = p.worldY - TH / 2;
      const gx = Math.floor((wx / (TW / 2) + wy / (TH / 2)) / 2);
      const gy = Math.floor((wy / (TH / 2) - wx / (TW / 2)) / 2);
      const hit = (Object.entries(SPOTS) as [Spot, (typeof SPOTS)[Spot]][]).find(([, s]) => (s.x === gx && s.y === gy) || (s.px === gx && s.py === gy));
      if (hit) this.walkTo(SPOTS[hit[0]], () => this.onTap?.(hit[0]));
      else if (gx >= 0 && gy >= 0 && gx < GRID && gy < GRID) this.walkTo({ x: gx, y: gy });
    });

    this.night = this.add.rectangle(minX, minY, maxX - minX, maxY - minY, 0x0b1030).setOrigin(0).setDepth(1000).setAlpha(0);
    this.applyNight();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.applyNight() });

    this.ready = true;
    if (this.pending) this.sync(this.pending);
  }

  private applyNight() {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
    const amt = hour >= 7 && hour < 18 ? 0 : hour >= 18 && hour < 21 ? (hour - 18) / 3 : hour >= 5 && hour < 7 ? (7 - hour) / 2 : 1;
    this.night.setAlpha(0.5 * amt);
  }

  setTapHandler(fn: ((spot: Spot) => void) | null) {
    this.onTap = fn;
  }

  sync(s: HouseState) {
    if (!this.ready) {
      this.pending = s;
      return;
    }
    this.pending = null;
    for (const [spot, m] of this.markers) m.setVisible(s.available.includes(spot) && !(s.busy && s.spot === spot));
    this.hero.setTint(s.tired && !s.busy ? 0x9a9ab5 : 0xffffff);
    if (s.spot !== this.atSpot) this.walkTo(SPOTS[s.spot], () => this.pose(s.spot, s.busy), s.spot);
    else if (!this.walking) this.pose(s.spot, s.busy);
    if (s.boost && s.boost.id !== this.lastBoost) {
      this.lastBoost = s.boost.id;
      this.tweens.add({ targets: this.hero, y: this.hero.y - 18, duration: 140, yoyo: true, ease: "Quad.easeOut" });
    }
  }

  private pose(spot: Spot, busy: boolean) {
    const s = SPOTS[spot];
    this.hero.anims.stop();
    if (busy) this.hero.play(`pick_${s.face}`);
    else this.hero.setFrame(`idle_${s.face}`);
  }

  private walkTo(target: Plot, then?: () => void, spot: Spot | null = null) {
    if (this.walking) return;
    const path = findPath(this.blocked, this.at, target);
    if (!path) return;
    this.atSpot = spot;
    if (!path.length) {
      then?.();
      return;
    }
    this.walking = true;
    this.cameras.main.startFollow(this.hero, true, 0.08, 0.08);
    let prev = this.at;
    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = [];
    for (const step of path) {
      const from = prev;
      tweens.push({
        targets: this.hero,
        x: sx(step.x, step.y),
        y: sy(step.x, step.y) + TH / 2,
        duration: 260,
        ease: "Linear",
        onStart: () => {
          const d = dirOf(step.x - from.x, step.y - from.y);
          if (this.hero.anims.currentAnim?.key !== `run_${d}`) this.hero.play(`run_${d}`);
          this.hero.setDepth(depthOf(step.x, step.y, 6));
        },
      });
      prev = step;
    }
    this.tweens.chain({
      tweens,
      onComplete: () => {
        this.at = target;
        this.walking = false;
        this.hero.anims.stop();
        this.hero.setFrame("idle_4");
        then?.();
      },
    });
  }
}
