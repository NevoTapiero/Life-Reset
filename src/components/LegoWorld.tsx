"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor, Sky } from "@react-three/drei";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { sfx, setSound, soundOn } from "@/lib/sfx";
import { CAN_RUN_AT, ENERGY_MAX, JUMP_COST, RUN_COST, TRICKLE } from "@/lib/energy";
import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawUtils } from "three/examples/jsm/utils/LDrawUtils.js";
import VEHICLES from "@/lib/legoVehicles.json";
import PROPS from "@/lib/legoProps.json";
import PACKS from "@/lib/legoPacks.json";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  BASE_HUNTER,
  COL,
  MINIFIG_PARTS,
  PLOT,
  buildGarden,
  splitInstanced,
  townInstances,
  type Placement,
  type Season,
  seasonAt,
  placementsIn,
  textIn,
  buildMinifig,
  houseAt,
  houseFor,
  houseUrl,
  houseById,
  houseSpec,
  minifigSpot,
  doorWalk,
  insideWalk,
  rideSpot,
  jogAt,
  type Loadout,
  SHOP_WALK,
  shopWalk,
  walkRoute,
  rerouteFrom,
  walkFrom,
  stepFree,
  townBlockers,
  type Blocker,
  GARDEN,
  gardenItem,
  gardenItemLines,
  gardenPropAt,
  itemPreviewLines,
  footprint,
  canPlace,
  firstFreeSpot,
  fromLot,
  type Placed,
  CROWD,
  sidestep,
  intoSomeone,
  type P3,
  type Route,
  modelText,
  CHEST_SPOT,
  DECOR,
  roomText,
  stationSpot,
  TOWN_HALF,
  PITCH,
  BLOCK,
  MAX_RESIDENTS,
  SHOP_BUILDING,
  lotFor,
  inLot,
  townText,
  plazaText,
  townDecorText,
  townFlats,
  plotHedges,
  forestTrees,
  townClouds,
  type Slab,
  emptyLotsText,
  ICE_CREAM_CART,
  PARK_BURGER_STAND,
  type Lot,
  PLAZA_LAMPS,
  STREET_LAMP_LIGHTS,
  SHOP_FRONT,
  FOUNTAIN,
  MAX_STATIONS,
  type Station,
  type MinifigLook,
  type Figure,
  figureOf,
  loadoutFor,
  type Resident,
  type House as Baked,
} from "@/lib/legoWorld";

// Your plot in real parts: the 48x48 baseplate, your house, your garden, and
// your minifigure outside the door. The parts are loaded once (public/lego);
// every model after that is just LDraw text parsed against them.

const LDU = 0.05; // three units per LDraw unit: a stud is 1

// The colours and the packed parts are fetched once. Each model is parsed as
// one packed file: its own lines first, then every part embedded after it,
// the same shape as an official "_Packed.mpd".
// Smoothing normals is quadratic in a part's size: fine for a minifig, but it
// takes half a minute on a 48x48 baseplate, so the ground is parsed without it.
const setups = new Map<boolean, Promise<{ loader: LDrawLoader; parts: string }>>();
function getLoader(smooth: boolean) {
  let setup = setups.get(smooth);
  if (!setup)
    setups.set(
      smooth,
      (setup = (async () => {
        const loader = new LDrawLoader();
        loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
        loader.smoothNormals = smooth;
        const [, parts] = await Promise.all([
          loader.preloadMaterials("/lego/LDConfig.ldr"),
          fetch("/lego/parts.mpd").then((r) => r.text()),
        ]);
        // drop the index model at the top: only the embedded parts are needed
        return {
          loader,
          parts: parts.slice(parts.indexOf("0 NOFILE") + "0 NOFILE".length),
        };
      })()),
    );
  return setup;
}
// LEGO ABS: a glossy clear coat over a slightly rough colour, so bricks catch the
// sky and the sun the way real ones do. Metals and glass keep what the loader gave them.
// Every model passes through finish(), which swaps each mesh's material for its plastic
// twin -- one twin per material, so models keep sharing what they shared.
const PLASTIC = new Map<THREE.Material, THREE.Material>();
function plasticOf(m: THREE.Material): THREE.Material {
  if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return m;
  let p = PLASTIC.get(m);
  if (!p) PLASTIC.set(m, (p = asPlastic(m as THREE.MeshStandardMaterial)));
  return p;
}
function asPlastic(m: THREE.MeshStandardMaterial): THREE.MeshPhysicalMaterial {
  const p = new THREE.MeshPhysicalMaterial();
  // the standard fields only: the physical copy() expects a physical source
  THREE.MeshStandardMaterial.prototype.copy.call(p, m);
  p.userData = m.userData; // the loader keeps the edge material and colour code here
  if (m.metalness < 0.5) {
    p.roughness = m.transparent ? 0.15 : 0.42;
    p.clearcoat = m.transparent ? 0.9 : 0.6;
    p.clearcoatRoughness = 0.3;
  }
  return p;
}
function parse(loader: LDrawLoader, text: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => loader.parse(text, resolve, reject));
}

// plastic look: no drawn outlines, shadows on
function finish(group: THREE.Object3D): THREE.Object3D {
  group.traverse((o) => {
    if ((o as THREE.LineSegments).isLineSegments) o.visible = false;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(plasticOf) : plasticOf(mesh.material);
    }
  });
  return group;
}

function useModel(text: string, merge: boolean) {
  const [group, setGroup] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    let made: THREE.Object3D | null = null;
    // merged models are the ground (plots, gardens, streets): no smoothing
    getLoader(!merge)
      .then(({ loader, parts }) => parse(loader, text + parts))
      .then((g) => {
        if (!live) return;
        made = finish(merge ? LDrawUtils.mergeObject(g) : g);
        setGroup(made);
      })
      .catch((e) => console.error("brick world:", e));
    return () => {
      live = false;
      // a merged model's geometry is its own (a plain parse shares the loader's
      // cached parts, and the materials are the loader's): free it with the model
      if (merge) made?.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    };
  }, [text, merge]);
  return group;
}

// Trees and flowers (legoWorld INSTANCED_PARTS) repeat by the hundred: each
// part + colour is parsed once, and every copy is one instance of it.
const props = new Map<string, Promise<THREE.Mesh[]>>();
function loadProp(part: string, color: number) {
  const key = `${part}|${color}`;
  let p = props.get(key);
  if (!p)
    props.set(
      key,
      (p = getLoader(false)
        .then(({ loader, parts }) => parse(loader, modelText([`1 ${color} 0 0 0 1 0 0 0 1 0 0 0 1 ${part}.dat`], "prop.ldr") + parts))
        .then((g) => {
          const merged = LDrawUtils.mergeObject(g);
          merged.updateMatrixWorld(true);
          const meshes: THREE.Mesh[] = [];
          merged.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
          });
          return meshes;
        })),
    );
  return p;
}

// The loadouts' printed torsos, helmets and gear, and their rides, live in packs
// per character (figures-<name>.mpd, rides-<name>.mpd from scripts/lego/pack.mjs),
// each fetched once, only when a model uses a part in it: plain townsfolk fetch none.
const packFiles = new Map<string, Promise<string>>();
const getPack = (file: string) => {
  let p = packFiles.get(file);
  if (!p)
    packFiles.set(
      file,
      (p = fetch(`/lego/${file}`)
        .then((r) => r.text())
        .then((t) => t.slice(t.indexOf("0 NOFILE") + "0 NOFILE".length))),
    );
  return p;
};
/** the packs holding these parts (the first character's pack that has each one) */
function packsFor(kind: keyof typeof PACKS, parts: string[]) {
  const files = new Set<string>();
  for (const part of parts) {
    const name = Object.keys(PACKS[kind]).find((n) => (PACKS[kind] as Record<string, string[]>)[n].includes(part.toLowerCase().replace(/\.dat$/, "")));
    if (name) files.add(`${kind}-${name}.mpd`);
  }
  return Promise.all([...files].map(getPack)).then((t) => t.join(""));
}
const refsIn = (lines: string[]) =>
  lines.map((l) => l.trim().split(/\s+/)).filter((a) => a[0] === "1" && a.length >= 15).map((a) => a.slice(14).join(" "));

// Each figure is parsed once; every minifig wearing it is a clone (sharing its
// geometry and materials).
const minifigs = new Map<string, Promise<THREE.Object3D>>();
function loadMinifig(fig: Figure) {
  const key = JSON.stringify(fig);
  let p = minifigs.get(key);
  if (!p)
    minifigs.set(
      key,
      (p = Promise.all([getLoader(true), packsFor("figures", refsIn(buildMinifig(fig)))])
        .then(async ([{ loader, parts }, figures]) => rig(finish(await parse(loader, modelText(buildMinifig(fig), "minifig.ldr") + figures + parts)), fig, loader))),
    );
  return p;
}

// The rides (skateboard, horse, motorcycle, dragon...) come with the loadouts,
// their parts in their own pack; each ride is parsed only once someone needs it,
// laid lengthways along x with its wheels (or feet) at 0 and its corner at the
// origin: it runs off along -x and out along +z (from the pavement into the
// street), so a dragon grows away from the path, not across it.
const rides = new Map<string, Promise<THREE.Object3D>>();
function loadRide(ride: Loadout["ride"]) {
  let p = rides.get(ride.ldr);
  if (!p)
    rides.set(
      ride.ldr,
      (p = Promise.all([getLoader(true), packsFor("rides", refsIn(ride.ldr.split("\n")))]).then(async ([{ loader, parts }, pack]) => {
        const g = finish(await parse(loader, modelText(ride.ldr.split("\n"), "ride.ldr") + pack + parts));
        const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
        const turn = new THREE.Group();
        turn.rotation.y = size.z > size.x ? Math.PI / 2 : 0; // longer front to back: turn it to run along x
        turn.add(g);
        turn.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(turn);
        turn.position.set(-box.max.x, -box.max.y, -box.min.z); // LDraw is -Y up: the bottom is max y
        const holder = new THREE.Group();
        holder.add(turn);
        holder.userData.length = Math.max(size.x, size.z); // LDU
        return holder;
      })),
    );
  return p;
}
// Anything longer than this (the dragon) doesn't park: it flies slow circles
// above its owner's street, wings and all.
const PARKS_UP_TO = 260; // LDU, 13 studs
const BODY_AXIS = new THREE.Vector3(0, 0, 1); // a ride's long axis, as it was built (along z)
const NOSE_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // laid along x: nose to +Z
function Ride({ ride, at, turn }: { ride: Loadout["ride"]; at: P3; turn: number }) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const flier = useRef<THREE.Group>(null);
  const flies = (model?.userData.length ?? 0) > PARKS_UP_TO;
  // flying about its middle, not the corner it parks by
  const middle = useMemo(() => (model ? new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()).negate() : null), [model]);
  const path = useMemo(
    () => (t: number) => {
      // big lazy loops round its owner's street, swinging wide and back, high over the roofs;
      // each wingbeat lifts it a little
      const a = t * 0.2 + at[0] * 0.001;
      const r = 420 + 140 * Math.sin(t * 0.13);
      return new THREE.Vector3(at[0] + Math.cos(a) * r, -900 - Math.sin(t * 1.5) * 26 - Math.sin(t * 0.3) * 80, at[2] + Math.sin(a) * r);
    },
    [at],
  );
  // its wings (the big wedge plates) beat: found once by part name, each turned about the
  // body's long axis from where it was built -- down to a spread, then up and down
  const wings = useMemo(() => {
    const out: { o: THREE.Object3D; base: THREE.Quaternion; side: number }[] = [];
    model?.traverse((o) => {
      if (/^3035[56]\.dat$/i.test(o.name)) out.push({ o, base: o.quaternion.clone(), side: Math.sign(o.position.x) || 1 });
    });
    return out;
  }, [model]);
  const beat = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ clock }) => {
    if (!flies || !flier.current) return;
    const t = clock.elapsedTime;
    fly(flier.current, path, t, NOSE_X);
    const flap = 0.55 + Math.sin(t * 3) * 0.45; // radians down from how it was built
    for (const w of wings) w.o.quaternion.copy(w.base).premultiply(beat.setFromAxisAngle(BODY_AXIS, flap * w.side));
  });
  useEffect(() => {
    let live = true;
    loadRide(ride)
      .then((o) => live && setModel(o.clone()))
      .catch((e) => console.error("ride:", e));
    return () => {
      live = false;
    };
  }, [ride]);
  if (!model) return null;
  if (flies)
    return (
      <group ref={flier}>
        <primitive object={model} position={middle ?? undefined} />
      </group>
    );
  return <primitive object={model} position={at} rotation={[0, turn, 0]} />;
}

// Ready a parsed figure to move: its parts named (MINIFIG_PARTS, then its
// gear), each arm on a shoulder pivot ("swingL"/"swingR") that also carries
// its hand and whatever that hand holds, and the shoes painted on the feet.
function rig(model: THREE.Object3D, fig: Figure, loader: LDrawLoader) {
  const gear = fig.gear ?? [];
  model.children.forEach((c, i) => (c.name = i < MINIFIG_PARTS.length ? MINIFIG_PARTS[i] : `gear:${gear[i - MINIFIG_PARTS.length]?.attach}`));
  model.updateMatrixWorld(true);
  if (fig.shoes) {
    const shoe = (loader.getMaterial(String(fig.shoes.color)) as THREE.MeshStandardMaterial | null)?.clone() ?? new THREE.MeshStandardMaterial({ color: "#333" });
    const f = fig.shoes.finish;
    if (f === "gold" || f === "steel" || f === "iron") Object.assign(shoe, { metalness: f === "gold" ? 0.7 : 0.55, roughness: f === "gold" ? 0.3 : 0.4 });
    for (const leg of ["legL", "legR"]) model.getObjectByName(leg)?.traverse((o) => (o as THREE.Mesh).isMesh && paintFeet(o as THREE.Mesh, shoe));
  }
  for (const side of ["L", "R"]) {
    const arm = model.getObjectByName(`arm${side}`);
    if (!arm) continue;
    const pivot = new THREE.Group();
    pivot.name = `swing${side}`;
    pivot.position.copy(arm.position);
    model.add(pivot);
    pivot.updateMatrixWorld(true);
    const held = model.children.filter((c) => c.name === `hand${side}` || c.name === `gear:hand${side}` || c.name === `gear:arm${side}`);
    for (const o of [arm, ...held]) pivot.attach(o);
  }
  return model;
}

// Shoes have no LDraw part: the feet are moulded into the legs. Triangles in
// the bottom 8 LDU (soles at y = 0, -Y up) get the shoe material instead.
function paintFeet(mesh: THREE.Mesh, shoe: THREE.Material) {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const pos = g.getAttribute("position");
  const tris = pos.count / 3;
  const matOf = new Int32Array(tris);
  for (const gr of g.groups) for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) matOf[t] = gr.materialIndex ?? 0;
  const v = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    let foot = true;
    for (let k = 0; k < 3 && foot; k++) foot = v.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(mesh.matrixWorld).y > -8.5;
    if (foot) matOf[t] = mats.length;
  }
  // regroup: triangles sorted by material, one group per run
  const order = Array.from({ length: tris }, (_, t) => t).sort((a, b) => matOf[a] - matOf[b]);
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    const n = a.itemSize * 3;
    const out = new (a.array.constructor as Float32ArrayConstructor)(a.array.length);
    order.forEach((t, i) => out.set(a.array.subarray(t * n, t * n + n), i * n));
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize, a.normalized));
  }
  g.clearGroups();
  for (let i = 0; i < tris; ) {
    let j = i;
    while (j < tris && matOf[order[j]] === matOf[order[i]]) j++;
    g.addGroup(i * 3, (j - i) * 3, matOf[order[i]]);
    i = j;
  }
  mesh.geometry = g;
  mesh.material = [...mats, shoe];
}

// Every placement drawn with one InstancedMesh per part, colour and material.
// Lives inside the LDraw-space group, so placements are plain LDraw matrices.
function InstancedParts({ placements }: { placements: Placement[] }) {
  // a stable key: the caller's array is rebuilt on every render
  const sig = JSON.stringify(placements);
  const [meshes, setMeshes] = useState<THREE.InstancedMesh[]>([]);
  useEffect(() => {
    let live = true;
    const groups = new Map<string, Placement[]>();
    for (const pl of JSON.parse(sig) as Placement[]) {
      const k = `${pl.part}|${pl.color}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(pl);
    }
    const built: THREE.InstancedMesh[] = [];
    Promise.all(
      [...groups].map(async ([k, list]) => {
        const [part, color] = k.split("|");
        for (const mesh of await loadProp(part, Number(color))) {
          const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, list.length);
          const m = new THREE.Matrix4();
          list.forEach((pl, i) => {
            const [x, y, z, a, b, c, d, e, f, g, h, j] = pl.m;
            m.set(a, b, c, x, d, e, f, y, g, h, j, z, 0, 0, 0, 1).multiply(mesh.matrixWorld);
            im.setMatrixAt(i, m);
          });
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.castShadow = true;
          im.receiveShadow = true;
          built.push(im);
        }
      }),
    )
      .then(() => live && setMeshes(built))
      .catch((e) => console.error("props:", e));
    return () => {
      live = false;
      // the instance buffers are ours; geometry and materials stay cached for reuse
      built.forEach((im) => im.dispose());
    };
  }, [sig]);
  return (
    <>
      {meshes.map((im) => (
        <primitive key={im.uuid} object={im} />
      ))}
    </>
  );
}

// The houses are official sets baked to glb (scripts/lego/pack.mjs); each file
// is fetched once and every plot that needs it gets a clone sharing its geometry.
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const houses = new Map<string, Promise<THREE.Object3D>>();
function loadHouse(url: string) {
  let p = houses.get(url);
  if (!p)
    houses.set(
      url,
      (p = gltf.loadAsync(url).then((g) => {
        rooms.set(url, measureRooms(g.scene));
        return finish(g.scene); // (plastic too, like everything finish() touches)
      })),
    );
  return p;
}

// Where a set's rooms are: official sets come with yards, decks and porches,
// so the building isn't simply the middle of the model. The cells (1 stud)
// where the model rises past half its height are the building; their middle is
// the room, and going forward from there, where they end is the front wall. In the glb's own frame
// (LDU, origin its front-left corner, -Y up); filled in as each house loads.
const rooms = new Map<string, { x: number; z: number; front: number }>();
function measureRooms(scene: THREE.Object3D) {
  scene.updateMatrixWorld(true);
  const top = new Map<string, number>();
  const v = new THREE.Vector3();
  let highest = 0;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pos = mesh.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const k = `${Math.floor(v.x / 20)},${Math.floor(v.z / 20)}`;
      top.set(k, Math.max(top.get(k) ?? 0, -v.y));
      highest = Math.max(highest, -v.y);
    }
  });
  const tall = [...top].filter(([, h]) => h > highest / 2).map(([k]) => k.split(",").map(Number));
  if (!tall.length) return { x: 0, z: 0, front: 0 };
  const cx = Math.floor(tall.reduce((a, [x]) => a + x, 0) / tall.length);
  const cz = Math.floor(tall.reduce((a, [, z]) => a + z, 0) / tall.length);
  const isTall = new Set(tall.map(([x, z]) => `${x},${z}`));
  let front = cz;
  while (isTall.has(`${cx},${front + 1}`)) front++;
  return { x: (cx + 0.5) * 20, z: (cz + 0.5) * 20, front: (front + 1) * 20 };
}

// A baked building placed at `at` (LDU). `cut`: a height (three's y) above
// which it is clipped away -- the roof comes off and you look down into the
// rooms, dollhouse style.
// `lit`: after dark the window glass glows warm -- somebody's home.
// `build`: it builds itself (after this many seconds; null: not yet, keep it
// hidden): it goes up a row of bricks at a time while bricks shower down onto
// each new row -- when the town opens, and again whenever the house changes
// (a level up).
const BUILD_TIME = 2.4;
const ROW = 24; // LDU: one brick
const OPEN = 1e5; // a clipping plane that clips nothing
function Building({
  url,
  at,
  cut,
  lit = false,
  build,
}: {
  url: string;
  at: [number, number, number];
  cut?: number;
  lit?: boolean;
  build?: number | null;
}) {
  const [model, setModel] = useState<{
    url: string;
    obj: THREE.Object3D;
    /** its box in its own frame (LDU, -Y up) */
    box: THREE.Box3;
  } | null>(null);
  // the house that has finished building (none yet: this one still has to go up)
  const [built, setBuilt] = useState<string | null>(build === undefined ? url : null);
  const building = build !== undefined && built !== url;
  // Both clipping planes are always on every material (clipping nothing when not
  // in use): switching planes on and off recompiles the shaders, which is what
  // made the town hitch as each house started and finished building.
  const rise = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), -1), []);
  const lid = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), OPEN), []);
  const progress = useRef(0);
  const started = useRef<number | null>(null);
  const lastRow = useRef(0);
  useEffect(() => {
    let live = true;
    let own: THREE.Material[] = [];
    loadHouse(url)
      .then((o) => {
        if (!live) return;
        const obj = o.clone();
        // its own materials, so cutting this house leaves the others whole
        obj.traverse((m) => {
          const mesh = m as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = (mesh.material as THREE.Material).clone();
          own.push(mesh.material);
        });
        setModel({ url, obj, box: new THREE.Box3().setFromObject(obj) });
      })
      .catch((e) => console.error("house:", e));
    return () => {
      live = false;
      // the geometry is the shared cache's; the cloned materials are this house's
      own.forEach((m) => m.dispose());
      own = [];
    };
  }, [url]);
  useEffect(() => {
    if (!model) return;
    model.obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.Material;
      m.clippingPlanes = [lid, rise];
      m.clipShadows = true;
      m.needsUpdate = true;
    });
  }, [model, lid, rise]);
  // the roof off (you're inside): just move the lid
  useEffect(() => void lid.set(lid.normal, cut ?? OPEN), [lid, cut]);
  // going up: everything below the rising plane is there (three's y; the LDraw
  // group is scaled by LDU and -Y up, so the model's top is -box.min.y * LDU)
  useFrame(({ clock }) => {
    if (!model || model.url !== url) return;
    if (!building) {
      if (rise.constant !== OPEN) rise.set(rise.normal, OPEN);
      return;
    }
    if (typeof build !== "number") {
      rise.set(rise.normal, -1); // waiting its turn: nothing shows yet
      return;
    }
    started.current ??= clock.elapsedTime + build;
    const k = Math.min(1, Math.max(0, (clock.elapsedTime - started.current) / BUILD_TIME));
    progress.current = k;
    // a whole row of bricks at a time, the way LEGO goes up
    const rows = Math.ceil(-model.box.min.y / ROW);
    const row = k === 0 ? 0 : Math.min(rows, Math.floor(k * rows) + 1);
    if (row !== lastRow.current) {
      lastRow.current = row;
      if (row > 0) sfx.snap(); // a row of bricks snaps on
    }
    rise.set(rise.normal, row === 0 ? -1 : row * ROW * LDU + 0.02);
    if (k === 1) {
      started.current = null;
      setBuilt(url);
    }
  });
  useEffect(() => {
    if (!model) return;
    model.obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const m = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (!mesh.isMesh || !m?.transparent || !m.emissive) return; // glass is the transparent part
      m.emissive.set(lit ? "#ffc56b" : "#000000");
      m.emissiveIntensity = lit ? 0.9 : 0;
    });
  }, [model, lit]);
  if (!model || model.url !== url) return null;
  return (
    <>
      <primitive object={model.obj} position={at} />
      {building && (
        <group position={at}>
          <BrickShower box={model.box} progress={progress} />
        </group>
      )}
    </>
  );
}

// Bricks raining down onto a house while it builds: each one falls from high
// above to the height the house has reached when it lands, and is gone into
// the wall. LDraw frame (LDU, -Y up), in the house model's own frame.
const SHOWER = 44;
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const SHOWER_COLOURS = ["#c91a09", "#0055bf", "#f2cd37", "#237841", "#ffffff", "#fe8a18", "#a0a5a9", "#582a12"];
function BrickShower({ box, progress }: { box: THREE.Box3; progress: React.RefObject<number> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const bricks = useMemo(
    () =>
      Array.from({ length: SHOWER }, (_, i) => ({
        x: box.min.x + hash(i * 4) * (box.max.x - box.min.x),
        z: box.min.z + hash(i * 4 + 1) * (box.max.z - box.min.z),
        at: (i + hash(i * 4 + 2)) / SHOWER, // when it lands, as a share of the build
        turn: hash(i * 4 + 3) * Math.PI,
      })),
    [box],
  );
  useEffect(() => {
    if (!mesh.current) return;
    const c = new THREE.Color();
    bricks.forEach((_, i) => mesh.current!.setColorAt(i, c.set(SHOWER_COLOURS[i % SHOWER_COLOURS.length])));
    mesh.current.instanceColor!.needsUpdate = true;
  }, [bricks]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!mesh.current) return;
    const k = progress.current ?? 0;
    const top = -box.min.y;
    const rows = Math.ceil(top / ROW);
    bricks.forEach((b, i) => {
      const fall = 0.12; // share of the build a brick spends falling
      const f = (k - (b.at - fall)) / fall; // 0 when it starts falling, 1 when it lands
      const on = k > 0 && f > 0 && f < 1;
      // it lands on the row that goes up when it does
      const land = Math.min(rows, Math.floor(b.at * rows) + 1) * ROW;
      o.position.set(b.x, on ? -(land + (1 - f * f) * 500) : 1e5, b.z);
      o.rotation.set(0, b.turn + f * 2, 0);
      o.updateMatrix();
      mesh.current!.setMatrixAt(i, o.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, SHOWER]} frustumCulled={false}>
      {/* a 2x4 brick: 80 x 24 x 40 LDU */}
      <boxGeometry args={[80, 24, 40]} />
      <meshStandardMaterial roughness={0.35} />
    </instancedMesh>
  );
}

// A house on its plot (in the plot's own frame).
// Previews only: a house turned about its own centre.
function SpunHouse({ level, id, spin }: { level: number; id?: string; spin: number }) {
  const house = (id && houseById(id)) || houseFor(level);
  const [x, , z] = houseAt(houseSpec(level), house);
  const c: [number, number, number] = [x + (house.w * 20) / 2, 0, z - (house.d * 20) / 2];
  return (
    <group position={c} rotation={[0, (spin * Math.PI) / 2, 0]}>
      <Building url={houseUrl(house)} at={[-(house.w * 20) / 2, 0, (house.d * 20) / 2]} />
    </group>
  );
}

// A player's house on their plot: which of the level's houses is theirs comes from their name.
function House({ level, name, id, cut, lit, build }: { level: number; name?: string; id?: string; cut?: number; lit?: boolean; build?: number | null }) {
  const house = (id && houseById(id)) || houseFor(level, name);
  return <Building url={houseUrl(house)} at={houseAt(houseSpec(level), house)} cut={cut} lit={lit} build={build} />;
}

// `turn`: which way the figure faces (radians about the vertical, LDraw frame)
function Minifig({
  look,
  at,
  turn = 0,
  walking,
  wave = false,
  stride = 10,
  jumpRef,
}: {
  /** four colours (townsfolk) or a whole figure (a character's loadout) */
  look: MinifigLook | Figure;
  at: [number, number, number];
  turn?: number;
  /** while true, the legs and arms swing */
  walking?: React.RefObject<boolean>;
  /** standing, it raises an arm and waves (hello!) */
  wave?: boolean;
  /** how fast the legs go while walking (running: faster) */
  stride?: number;
  /** bumped to jump (the Jump button, Space) */
  jumpRef?: React.RefObject<number>;
}) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  const key = JSON.stringify("parts" in look ? { parts: look.parts, gear: look.gear, shoes: look.shoes } : figureOf(look));
  useEffect(() => {
    let live = true;
    loadMinifig(JSON.parse(key))
      .then((o) => live && setModel(o.clone()))
      .catch((e) => console.error("minifig:", e));
    return () => {
      live = false;
    };
  }, [key]);
  const root = useRef<THREE.Group>(null);
  const taps = useRef(0); // bumped by a tap
  const seen = useRef(0);
  const hopAt = useRef(-10); // frame-clock time the current hop started
  const hopBig = useRef(false); // a jump, not a little hop
  const jumpsSeen = useRef(0);
  const base = useRef<THREE.Quaternion[]>([]);
  const limbs = useRef<THREE.Quaternion[]>([]);
  const gait = useRef({ blend: 0, phase: 0 }); // 0 standing .. 1 walking; where it is in the step

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!model || !root.current) return;
    // ease into and out of the walk (no snapping between standing and striding)
    const g = gait.current;
    g.blend += ((walking?.current ? 1 : 0) - g.blend) * Math.min(1, dt * 10);
    g.phase += dt * stride * (0.4 + 0.6 * g.blend);
    // the head and hair turn together, glancing around
    const head = model.getObjectByName("head");
    const hair = model.getObjectByName("hair");
    if (head && hair) {
      if (!base.current.length) base.current = [head.quaternion.clone(), hair.quaternion.clone()];
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 0.5) * 0.45);
      head.quaternion.copy(base.current[0]).premultiply(yaw);
      hair.quaternion.copy(base.current[1]).premultiply(yaw);
    }
    // the LEGO-game walk: stiff legs swinging from the hips, arms (with hands and whatever
    // they hold) swinging the other way, shorter strides when strolling, longer when running
    const parts = ["legL", "legR", "swingL", "swingR"].map((n) => model.getObjectByName(n));
    const reach = Math.min(0.95, 0.3 + stride * 0.032) * g.blend;
    const s = Math.sin(g.phase);
    if (parts.every(Boolean)) {
      if (!limbs.current.length) limbs.current = parts.map((p) => p!.quaternion.clone());
      const swing = [s * reach, -s * reach, -s * reach * 0.8, s * reach * 0.8]; // legL legR armL armR
      parts.forEach((p, k) =>
        p!.quaternion.copy(limbs.current[k]).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), swing[k])),
      );
      // waving: one arm up (about the shoulder), rocking side to side; a few seconds, then a rest
      if (wave && !walking?.current && t % 5 < 3) {
        const up = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 2.6);
        const rock = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 9) * 0.35);
        parts[3]!.quaternion.copy(limbs.current[3]).premultiply(up).premultiply(rock);
      }
    }
    // a hop when tapped (LDraw is -Y up)
    if (taps.current !== seen.current) {
      seen.current = taps.current;
      hopAt.current = t;
      hopBig.current = false;
    }
    if (jumpRef && jumpRef.current !== jumpsSeen.current) {
      jumpsSeen.current = jumpRef.current;
      if (t - hopAt.current > 0.5) {
        hopAt.current = t;
        hopBig.current = true;
      }
    }
    const h = t - hopAt.current;
    const [hopTime, hopHeight] = hopBig.current ? [0.62, 44] : [0.45, 14];
    // a bounce on every step and a waddle from foot to foot (LDraw is -Y up)
    const bounce = Math.abs(s) * (1.5 + stride * 0.15) * g.blend;
    root.current.position.y = at[1] - bounce - (h < hopTime ? Math.sin((h / hopTime) * Math.PI) * hopHeight : 0);
    root.current.rotation.z = s * 0.075 * g.blend;
    root.current.rotation.y = turn + Math.sin(t * 0.3) * 0.25 * (1 - g.blend);
  });

  if (!model) return null;
  return (
    <group
      ref={root}
      position={at}
      onClick={(e) => {
        e.stopPropagation();
        taps.current++;
      }}
    >
      <primitive object={model} />
    </group>
  );
}

const FRONT_RIGHT = new THREE.Vector3(0.55, 0.65, -0.8).normalize();

// Frames `target` so `width` fits the view, looking from `dir`. The first
// time it jumps there; after that the camera glides (under a second, eased),
// and grabbing the view mid-flight hands it straight back to you.
function FitCamera({
  target,
  width,
  dir = FRONT_RIGHT,
  controls,
  follow,
  flyingRef,
}: {
  target: THREE.Vector3;
  width: number;
  dir?: THREE.Vector3;
  controls: React.RefObject<OrbitControlsImpl | null>;
  /** following someone: frame where they are when following starts, not `target` */
  follow?: React.RefObject<THREE.Vector3>;
  /** set while a glide is under way (the follow camera waits for it) */
  flyingRef?: React.RefObject<boolean>;
}) {
  const { camera, size } = useThree();
  const flight = useRef<{ from: THREE.Vector3; fromAim: THREE.Vector3; to: THREE.Vector3; toAim: THREE.Vector3; t: number } | null>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const dist = width / 2 / Math.tan(Math.min(hfov, vfov) / 2);
    const aim = follow ? follow.current.clone().add(CHASE_LIFT) : target;
    // by default from the front-right, looking down at the house (the front faces three's -Z)
    const to = aim.clone().addScaledVector(dir, dist);
    const c = controls.current;
    if (!placed.current || !c) {
      cam.position.copy(to);
      cam.lookAt(aim);
      c?.target.copy(aim);
      c?.update();
      placed.current = !!c;
      return;
    }
    flight.current = { from: cam.position.clone(), fromAim: c.target.clone(), to, toAim: aim.clone(), t: 0 };
    // (follow is a ref: only where they are when following starts matters)
  }, [camera, size, target, width, dir, controls, follow]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const grab = () => (flight.current = null);
    c.addEventListener("start", grab);
    return () => c.removeEventListener("start", grab);
  }, [controls]);
  useFrame((_, dt) => {
    const f = flight.current;
    const c = controls.current;
    if (flyingRef) flyingRef.current = !!f;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + dt / 0.9);
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2; // ease in and out
    camera.position.lerpVectors(f.from, f.to, e);
    c.target.lerpVectors(f.fromAim, f.toAim, e);
    c.update();
    if (f.t === 1) flight.current = null;
  });
  return null;
}

// Never more pixels than a phone screen at 2x: a big window renders at a lower ratio,
// since fill rate (bloom, anti-aliasing, the ground) is what makes big windows crawl.
const PIXEL_BUDGET = 2.2e6; // about 1080 x 2000
// (reported up to the Canvas's own dpr prop: r3f re-applies that prop, so setting the store alone doesn't stick)
function PixelBudget({ onSize }: { onSize: (w: number, h: number) => void }) {
  const size = useThree((s) => s.size);
  useEffect(() => onSize(size.width, size.height), [size.width, size.height, onSize]);
  return null;
}

// The lens can change (a wider one while playing); before FitCamera frames anything.
function FovSync({ fov }: { fov: number }) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov) < 0.01) return;
    // (the same as setting fov; it updates the projection too)
    cam.setFocalLength((0.5 * cam.getFilmHeight()) / Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  }, [camera, fov]);
  return null;
}

// The LEGO-game camera: once you're being followed, the view keeps you in
// frame as you move -- eased, not rigid -- at whatever angle and distance you
// have swung it to.
const CHASE_LIFT = new THREE.Vector3(0, 2.2, 0); // aim at the minifig's middle, not its feet
function Chase({
  follow,
  aim,
  controls,
  flying,
  cut,
}: {
  follow: React.RefObject<THREE.Vector3>;
  /** swing round behind (an angle round the target), or null: stay */
  aim?: React.RefObject<number | null>;
  controls: React.RefObject<OrbitControlsImpl | null>;
  flying: React.RefObject<boolean>;
  /** the camera cut: whatever is nearer the camera than this plane isn't drawn */
  cut: THREE.Plane;
}) {
  const { camera } = useThree();
  const want = useMemo(() => new THREE.Vector3(), []);
  const off = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  // when this camera goes (the map, a house), the cut goes too
  useEffect(() => () => void cut.set(cut.normal, 1e6), [cut]);
  const dragging = useRef(false);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const on = () => (dragging.current = true);
    const offDrag = () => (dragging.current = false);
    c.addEventListener("start", on);
    c.addEventListener("end", offDrag);
    return () => {
      c.removeEventListener("start", on);
      c.removeEventListener("end", offDrag);
    };
  }, [controls]);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || flying.current) return;
    want.copy(follow.current).add(CHASE_LIFT).sub(c.target).multiplyScalar(Math.min(1, dt * 6));
    c.target.add(want);
    camera.position.add(want);
    // ease round behind you as you go (never while you're turning the view yourself)
    const yaw = aim?.current;
    if (yaw !== null && yaw !== undefined && !dragging.current) {
      off.subVectors(camera.position, c.target);
      const now = Math.atan2(off.x, off.z);
      const d = Math.atan2(Math.sin(yaw - now), Math.cos(yaw - now));
      off.applyAxisAngle(THREE.Object3D.DEFAULT_UP, d * Math.min(1, dt * 1.4));
      camera.position.copy(c.target).add(off);
    }
    c.update();
    // cut away what stands between the camera and you (a lamp, a tree, a wall): a plane
    // most of the way to you, but short of where the bottom of the view meets the ground,
    // so the ground always stays
    camera.getWorldDirection(ahead);
    const half = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2);
    const pitch = Math.asin(-ahead.y); // how far down it looks
    const low = Math.sin(pitch + half); // the bottom edge's downward slope
    const groundNear = low > 0.05 ? (camera.position.y / low) * Math.cos(half) : Infinity;
    const reach = Math.min(camera.position.distanceTo(c.target) * 0.62, groundNear * 0.9);
    cut.setFromNormalAndCoplanarPoint(ahead, off.copy(camera.position).addScaledVector(ahead, reach));
  });
  return null;
}

export default function LegoWorld({
  houseLevel = 1,
  name,
  house,
  spin = 0,
  streak = 0,
  look = BASE_HUNTER,
  character,
  className,
}: {
  houseLevel?: number;
  /** whose house: picks which of the level's houses (same as in their town) */
  name?: string;
  /** show this exact house (an id from legoHouses.json), for previews */
  house?: string;
  /** previews only: extra quarter turns of the house, to find its front */
  spin?: number;
  streak?: number;
  look?: MinifigLook;
  /** the player's character (archetype key): they wear its loadout for houseLevel (instead of `look`) */
  character?: string | null;
  className?: string;
}) {
  const spec = houseSpec(houseLevel);
  // the baseplate is drawn flat (StudGround, like the town) instead of 2,304
  // real studs, and the garden's trees and flowers are instanced
  const garden = useMemo(() => splitInstanced(buildGarden(streak, houseSpec(houseLevel))), [houseLevel, streak]);
  const worldText = useMemo(() => modelText(garden.kept, "plot.ldr"), [garden]);
  const world = useModel(worldText, true);
  const at = minifigSpot(spec);
  // the house centre in three's space: x as is, LDraw z flipped by the container's half-turn
  const target = useMemo(() => {
    const cx = (spec.x0 + spec.w / 2 - PLOT / 2) * 20 * LDU;
    const cz = (spec.z0 + spec.d / 2 - PLOT / 2) * 20 * LDU;
    return new THREE.Vector3(cx, 3, -cz - 3);
  }, [spec.x0, spec.w, spec.z0, spec.d]);

  return (
    <Stage
      className={className}
      label="Your house and garden"
      target={target}
      width={Math.max(34, spec.w + 14)}
      overlay={<StudGround at={[0, 0]} size={PLOT} color="#4b9b3c" />}
    >
      {world && <primitive object={world} />}
      <InstancedParts placements={garden.placed} />
      {spin ? <SpunHouse level={houseLevel} id={house} spin={spin} /> : <House level={houseLevel} name={name} id={house} />}
      <Minifig look={character ? loadoutFor(houseLevel, character) : look} at={at} />
    </Stage>
  );
}

// ---- time of day ----
// The town follows your real clock: blue day, golden sunrise and sunset, a
// dusk when the lamps come on, and night with stars and moonlight.
// ponytail: four fixed moods; blend between them if the switch ever jars
export type Mood = { name: string; top: string; horizon: string; sun: number; sunColor: string; ambient: number; night: boolean };
const MOODS: Record<string, Mood> = {
  day: { name: "day", top: "#2f86ea", horizon: "#bfe3ff", sun: 2.6, sunColor: "#fff8ee", ambient: 1, night: false },
  golden: { name: "golden", top: "#5a86d6", horizon: "#ffc98a", sun: 2.1, sunColor: "#ffae66", ambient: 0.8, night: false },
  // LEGO-game nights stay readable: a cool blue moonlight, not just darker
  dusk: { name: "dusk", top: "#2c3f7e", horizon: "#f0957a", sun: 1.0, sunColor: "#ffa27a", ambient: 0.62, night: true },
  night: { name: "night", top: "#0c1740", horizon: "#2b3f78", sun: 0.75, sunColor: "#a9c2ff", ambient: 0.5, night: true },
};
export function moodAt(hour: number): Mood {
  if (hour >= 20.5 || hour < 5) return MOODS.night;
  if (hour >= 19 || hour < 6) return MOODS.dusk;
  if (hour >= 17 || hour < 8) return MOODS.golden;
  return MOODS.day;
}
export const MOOD_NAMES = Object.keys(MOODS);
export const moodNamed = (name: string) => MOODS[name] ?? MOODS.day;

// A gradient dome round the whole scene, and stars when it's dark.
function SkyDome({ mood }: { mood: Mood }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;\nvoid main() {\n  float h = clamp(vDir.y * 1.8, 0.0, 1.0);\n  gl_FragColor = vec4(mix(horizon, top, pow(h, 0.7)), 1.0);\n#include <colorspace_fragment>\n}",
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  useEffect(() => {
    material.uniforms.top.value.set(mood.top);
    material.uniforms.horizon.value.set(mood.horizon);
  }, [material, mood]);
  const stars = useMemo(() => {
    const pts: number[] = [];
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.15 + rnd() * 0.85; // upper sky only
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * r * 440, y * 440, Math.sin(a) * r * 440);
    }
    return new Float32Array(pts);
  }, []);
  return (
    <>
      <mesh material={material} scale={450} renderOrder={-1}>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      {mood.night && (
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[stars, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} fog={false} />
        </points>
      )}
    </>
  );
}

// Warm glows round the lamps after dark: additive sprites, no real lights.
let glowTexture: THREE.CanvasTexture | null = null;
function glow() {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,226,150,1)");
  r.addColorStop(0.25, "rgba(255,200,110,0.55)");
  r.addColorStop(1, "rgba(255,180,90,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}
function LampGlows({ at }: { at: [number, number, number][] }) {
  const map = useMemo(() => glow(), []);
  return (
    <>
      {at.map((p, i) => (
        <sprite key={i} position={p} scale={[130, 130, 1]}>
          <spriteMaterial map={map} blending={THREE.AdditiveBlending} depthWrite={false} transparent fog={false} />
        </sprite>
      ))}
    </>
  );
}

/** `at`: a point in three's space, or a function giving it each frame (for someone walking about) */
export type Pin = { key: string; at: [number, number, number] | (() => [number, number, number] | null); node: React.ReactNode };

// Real studs on the ground round you: a stud a stud, on the plots and the plaza
// (the painted studs stay underneath, and take over further off). Instanced
// low-poly cylinders, laid out again whenever you've moved a few studs.
const STUD_REACH = 16; // studs from you
const STUD_MAX = (2 * STUD_REACH + 1) ** 2;
function NearStuds({ follow, grass }: { follow: React.RefObject<THREE.Vector3>; grass: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const laid = useRef({ x: 1e9, z: 1e9 });
  const o = useMemo(() => new THREE.Object3D(), []);
  const green = useMemo(() => new THREE.Color(grass), [grass]);
  const grey = useMemo(() => new THREE.Color("#a3a7ad"), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const px = Math.round(follow.current.x);
    const pz = Math.round(follow.current.z);
    if (Math.abs(px - laid.current.x) < 3 && Math.abs(pz - laid.current.z) < 3) return;
    laid.current = { x: px, z: pz };
    let n = 0;
    for (let x = px - STUD_REACH; x <= px + STUD_REACH; x++)
      for (let z = pz - STUD_REACH; z <= pz + STUD_REACH; z++) {
        // three's z is -LDraw z; the blocks are PITCH studs apart, PLOT wide
        const bx = Math.round(x / PITCH_STUDS);
        const bz = Math.round(-z / PITCH_STUDS);
        if (Math.abs(bx) > 1 || Math.abs(bz) > 1) continue;
        const dx = x - bx * PITCH_STUDS;
        const dz = -z - bz * PITCH_STUDS;
        if (Math.abs(dx) >= PLOT / 2 || Math.abs(dz) >= PLOT / 2) continue; // the street
        o.position.set(x + 0.5, 0.085, z + 0.5);
        o.updateMatrix();
        m.setMatrixAt(n, o.matrix);
        m.setColorAt(n, bx === 0 && bz === 0 ? grey : green);
        n++;
      }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, STUD_MAX]} frustumCulled={false} receiveShadow>
      <cylinderGeometry args={[0.3, 0.3, 0.17, 12]} />
      <meshPhysicalMaterial roughness={0.42} clearcoat={0.6} clearcoatRoughness={0.3} />
    </instancedMesh>
  );
}
const PITCH_STUDS = PITCH;

// Following someone round the town, the sunlight (and its shadow area, only
// ~44 units across) goes with them, so you and what's around you always cast shadows.
function SunFollows({
  follow,
  sun,
  light,
}: {
  follow: React.RefObject<THREE.Vector3>;
  sun: THREE.Object3D;
  light: React.RefObject<THREE.DirectionalLight | null>;
}) {
  useFrame(() => {
    const p = follow.current;
    sun.position.set(p.x, 0, p.z);
    light.current?.position.set(p.x + 18, 30, p.z - 14);
  });
  return null;
}

// Moves each pinned button to its point's place on screen, every frame.
// (drei's Html gives each label its own React root, and under React 19 the
// first one is dropped; plain DOM moved by hand has no such trouble.)
function PinTracker({ pins, els }: { pins: Pin[]; els: React.RefObject<Map<string, HTMLDivElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const p of pins) {
      const el = els.current.get(p.key);
      if (!el) continue;
      const at = typeof p.at === "function" ? p.at() : p.at;
      if (!at) {
        el.style.transform = "translate(-9999px, 0)";
        continue;
      }
      v.set(...at).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = v.z > 1 ? "translate(-9999px, 0)" : `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  });
  return null;
}

// Sky, light and camera around whatever LDraw models are passed in. The light
// and the contact shadow follow the target, so a long town is lit wherever you look.
function Stage({
  className,
  label,
  target,
  width,
  pan = false,
  dir,
  fov = 32,
  sky = "#bfe3ff",
  mood,
  far = 500,
  maxDistance = 110,
  bounds,
  onPick,
  overlay,
  pins = [],
  follow,
  aim,
  children,
}: {
  className?: string;
  label: string;
  target: THREE.Vector3;
  width: number;
  pan?: boolean;
  dir?: THREE.Vector3;
  /** vertical field of view: narrow for the diorama outside, wide for being in a room */
  fov?: number;
  /** outdoors: the time of day -- a gradient sky, the sun (or moon), stars at night.
   *  Without it the scene sits in a plain `sky` colour (the room). */
  mood?: Mood;
  /** how far the camera sees, and how far out you may pull it (the town overview needs more) */
  far?: number;
  maxDistance?: number;
  /** the colour beyond the scene: sky outside, a warm ceiling glow inside */
  sky?: string;
  /** the camera's target stays inside this box (three's space) */
  bounds?: THREE.Box3;
  /** a tap on the ground (not a drag), at this point in three's space */
  onPick?: (p: THREE.Vector3) => void;
  /** things placed in three's space rather than LDraw's (hills) */
  overlay?: React.ReactNode;
  /** buttons pinned over points in three's space (names, station bubbles) */
  pins?: Pin[];
  /** follow someone (their position in three's space, kept up to date), LEGO-game style */
  follow?: React.RefObject<THREE.Vector3>;
  /** while following: which way round to swing the camera (behind them), or null */
  aim?: React.RefObject<number | null>;
  children: React.ReactNode;
}) {
  const [sun] = useState(() => new THREE.Object3D());
  // full sharpness (up to 2x) while the device keeps up; a step down if it can't
  const [dpr, setDpr] = useState(2);
  // and never more pixels than a phone screen at 2x (PixelBudget)
  const [box, setBox] = useState({ w: 400, h: 700 });
  const sized = useCallback((w: number, h: number) => setBox({ w, h }), []);
  const near = !!follow || !mood; // a close view (playing, or a room) rather than the whole town
  const budget = Math.max(1, Math.min(dpr, Math.sqrt(PIXEL_BUDGET / (box.w * box.h))));
  const controls = useRef<OrbitControlsImpl>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const flying = useRef(false);
  // one global clipping plane, always installed (so shaders never recompile when it starts
  // or stops cutting); it clips nothing until a follow camera moves it (Chase)
  const [cameraCut] = useState(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6));
  const pinEls = useRef(new Map<string, HTMLDivElement>());
  // keep the camera over the town: pull the target back inside, camera with it
  const clamp = () => {
    const c = controls.current;
    if (!c || !bounds) return;
    const d = c.target.clone().clamp(bounds.min, bounds.max).sub(c.target);
    if (d.lengthSq() === 0) return;
    c.target.add(d);
    c.object.position.add(d);
  };
  return (
    <div className={className} role="img" aria-label={label}>
      <div className="relative w-full h-full">
        <Canvas
          shadows
          dpr={[1, budget]}
          camera={{ fov, near: 1, far: far }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
            gl.clippingPlanes.push(cameraCut);
            // LEGO colours stay LEGO colours: the neutral curve keeps hue and saturation
            // where the default filmic one washes bright plastic out
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <PerformanceMonitor onDecline={() => setDpr(1.25)} onIncline={() => setDpr(2)} />
          <PixelBudget onSize={sized} />
          <color attach="background" args={[mood?.horizon ?? sky]} />
          {/* the haze scales with how much is in view: a house, the shop, or the whole town */}
          <fog attach="fog" args={[mood?.horizon ?? sky, Math.max(200, width * 3.2), Math.max(520, width * 8)]} />
          {mood && <SkyDome mood={mood} />}
          <hemisphereLight args={["#fff8ef", "#6f8f55", mood?.ambient ?? 0.9]} />
          <primitive object={sun} position={[target.x, 0, target.z]} />
          {follow && <SunFollows follow={follow} sun={sun} light={light} />}
          <directionalLight
            ref={light}
            target={sun}
            position={[target.x + 18, 30, target.z - 14]}
            intensity={mood?.sun ?? 2.3}
            color={mood?.sunColor ?? "#ffffff"}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-22}
            shadow-camera-right={22}
            shadow-camera-top={22}
            shadow-camera-bottom={-22}
            shadow-camera-far={90}
            shadow-bias={-0.0004}
          />
          <Environment resolution={256} frames={1} environmentIntensity={mood ? 0.5 : 0.7}>
            {/* what the plastic reflects: outdoors the sky and the sun; indoors a warm room.
                Plus soft panels for the glossy highlights that make it read as plastic. */}
            {mood ? (
              <Sky sunPosition={mood.night ? [0, -1, 0] : [18, 30, -14]} turbidity={6} rayleigh={mood.name === "day" ? 1.2 : 2.5} />
            ) : (
              <mesh scale={100}>
                <sphereGeometry args={[1, 16, 8]} />
                <meshBasicMaterial color="#f4e9d6" side={THREE.BackSide} />
              </mesh>
            )}
            <Lightformer intensity={2.6 * (mood?.ambient ?? 1)} position={[0, 10, 10]} scale={[20, 8, 1]} />
            <Lightformer intensity={1.4 * (mood?.ambient ?? 1)} position={[-10, 4, -6]} scale={[8, 8, 1]} />
            <Lightformer intensity={1.2 * (mood?.ambient ?? 1)} position={[10, 6, -8]} scale={[10, 6, 1]} />
          </Environment>

          {/* LDraw is -Y up: a half-turn about X stands it upright */}
          <group
            rotation={[Math.PI, 0, 0]}
            scale={LDU}
            onClick={
              onPick &&
              ((e) => {
                if (e.delta > 6) return; // a drag, not a tap
                onPick(e.point);
              })
            }
          >
            {children}
          </group>
          {overlay}
          <PinTracker pins={pins} els={pinEls} />

          <ContactShadows position={[target.x, 0.02, target.z]} opacity={0.2} scale={36} blur={2} far={10} />
          <OrbitControls
            ref={controls}
            onChange={clamp}
            enablePan={pan}
            screenSpacePanning={false}
            // in the town a one-finger drag walks along the street; two fingers turn and zoom
            {...(pan && {
              mouseButtons: {
                LEFT: THREE.MOUSE.PAN,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE,
              },
              touches: { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE },
            })}
            minDistance={fov > 40 ? 6 : 14}
            maxDistance={maxDistance}
            minPolarAngle={0.45}
            maxPolarAngle={1.25}
          />
          {/* after the controls, so it can move them */}
          <FovSync fov={fov} />
          <FitCamera target={target} width={width} dir={dir} controls={controls} follow={follow} flyingRef={flying} />
          {follow && <Chase follow={follow} aim={aim} controls={controls} flying={flying} cut={cameraCut} />}
          {/* outdoors: lamps and lit windows glowing after dark, a soft vignette. Everything
              stays sharp (no blur: it read as low quality). The effects draw off screen, so the
              neutral tone mapping moves in here. */}
          {/* keyed: the close views and the whole-town view get their own composer (changing a
              live composer's passes breaks its render) */}
          <EffectComposer key={near ? "near" : "far"} multisampling={2}>
            {/* ambient occlusion: the soft dark in the gaps between bricks and round every stud,
                the thing that makes LEGO renders look like LEGO (a stud is one unit here). Close
                views only: from above it barely shows and it draws the whole town a second time. */}
            {near ? <N8AO aoRadius={1.3} distanceFalloff={0.8} intensity={1.7} quality="medium" halfRes /> : null}
            {mood ? <Bloom luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={mood.night ? 1.1 : 0.25} mipmapBlur /> : null}
            {mood ? <Vignette offset={0.35} darkness={0.28} /> : null}
            <ToneMapping mode={ToneMappingMode.NEUTRAL} />
            {/* toy-box colour: a touch more saturation and contrast than life */}
            <HueSaturation saturation={0.05} />
            <BrightnessContrast contrast={0.06} />
          </EffectComposer>
        </Canvas>
        {/* pinned buttons: plain DOM over the canvas, moved every frame by PinTracker */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {pins.map((p) => (
            <div
              key={p.key}
              ref={(el) => {
                if (el) pinEls.current.set(p.key, el);
                else pinEls.current.delete(p.key);
              }}
              className="absolute left-0 top-0 pointer-events-auto"
              style={{ transform: "translate(-9999px, 0)" }}
            >
              {p.node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Your town: the shop on a plaza in the middle, your house and your
// friends' around it, all facing the plaza, forest all round. Drag to walk;
// tap a house or the shop to go to it. Knock on a friend's door; once they let
// you in (or it's your own house) you can go inside. The shop sells furniture
// for your house.
export type Visit = "allowed" | "knocked";
const SHOP_FOCUS = -1;
const OVERVIEW = -2; // the whole town from above
const LOOK_DOWN = new THREE.Vector3(0.25, 1.35, -0.75).normalize();
// playing: the camera behind and above you, looking down at about 40 degrees, close
// enough that you're the star (LEGO-game style); you can swing it round with a drag
const CHASE_DIR = new THREE.Vector3(0.1, 0.44, -0.9).normalize(); // about 25 degrees down: the horizon shows
const CHASE_WIDTH = 18;
const CHASE_FOV = 50; // a game camera's wider lens (the diorama views keep a narrow one)
const STILL = new THREE.Vector3(); // a target that never changes (the camera follows you instead)
// where the sun hangs in the sky (three's space): where the sunlight comes from
// (up, to the right and behind the usual view), just inside the sky dome
const SUN_AT = new THREE.Vector3(18, 30, -14).normalize().multiplyScalar(420);
const turnRad = (facing: number) => (facing * Math.PI) / 180;
const toThree = ([x, y, z]: [number, number, number]): [number, number, number] => [x * LDU, y, -z * LDU];

export function LegoTown({
  residents: all,
  visits = {},
  onKnock,
  room,
  gold = null,
  prices = null,
  owned = [],
  onBuy,
  onInvite,
  time,
  season: seasonProp,
  visit,
  onBack,
  energy = null,
  garden = [],
  onPlace,
  className,
}: {
  residents: Resident[];
  /** by friend's name: they let you in, or you knocked and they haven't answered */
  visits?: Record<string, Visit>;
  onKnock?: (name: string) => void;
  /** your own house's inside (your room); without it you get the roof-off view */
  room?: (leave: () => void) => React.ReactNode;
  /** the shop: your gold, prices by item id (null: no shop yet), what you own, and buying */
  gold?: number | null;
  prices?: Record<string, number> | null;
  owned?: string[];
  onBuy?: (id: string) => Promise<string | null>;
  /** an empty plot's "invite a friend" button */
  onInvite?: () => void;
  /** force a time of day ("day", "golden", "dusk", "night"); otherwise it follows the clock */
  time?: string;
  /** force a season; otherwise it follows the date */
  season?: Season;
  /** open on this friend's house (walk there) instead of your own */
  visit?: string | null;
  /** a way back out of the town (the app's World page) */
  onBack?: () => void;
  /** your energy today (0..100, from sleep and steps); null: no energy yet, no limits */
  energy?: number | null;
  /** the garden things on your plot */
  garden?: Placed[];
  /** put a garden thing you've bought on your plot; resolves with an error message, or null when it's there */
  onPlace?: (p: Placed) => Promise<string | null>;
  className?: string;
}) {
  const residents = all.slice(0, MAX_RESIDENTS);
  const [hour, setHour] = useState(() => new Date().getHours() + new Date().getMinutes() / 60);
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours() + new Date().getMinutes() / 60), 60_000);
    return () => clearInterval(t);
  }, []);
  const mood = time ? moodNamed(time) : moodAt(hour);
  const season = seasonProp ?? seasonAt(new Date());
  const grass = GRASS[season];
  const town = useModel(
    useMemo(() => townText(residents), [residents]),
    true,
  );
  const plaza = useModel(useMemo(() => textIn(plazaText(), season), [season]), true);
  const decor = useModel(useMemo(() => townDecorText(), []), true);
  // plots nobody lives on yet are little parks
  const parks = useModel(useMemo(() => textIn(emptyLotsText(residents.length), season), [residents.length, season]), true);
  const emptyLots = useMemo(() => Array.from({ length: MAX_RESIDENTS - residents.length }, (_, k) => lotFor(residents.length + k)), [residents.length]);
  const lots = useMemo(() => residents.map((_, i) => lotFor(i)), [residents]);
  const meIndex = Math.max(
    0,
    residents.findIndex((r) => r.me),
  );
  // the town opens on the whole square, then (once it's built) glides down to your house
  const [focus, setFocus] = useState(OVERVIEW);
  const built = !!town;
  // "settled": the town has loaded and frames come smoothly (parsing is done).
  // Only then does it build itself, from above, and a moment later the camera
  // glides down to your house.
  const [settled, setSettled] = useState(false);
  const visitIndex = visit ? residents.findIndex((r) => r.name === visit) : -1;
  useEffect(() => {
    if (!settled) return;
    const first = visitIndex >= 0 ? visitIndex : meIndex;
    const t = setTimeout(() => setFocus((f) => (f === OVERVIEW ? first : f)), 3000);
    return () => clearTimeout(t);
  }, [settled, meIndex, visitIndex]);
  const [inside, setInside] = useState<number | null>(null);
  // where your minifig is walking to: the last place you looked at
  const [dest, setDest] = useState(meIndex);
  // your friends go out too, a few at a time: to the shop, or round to a neighbour's door
  // (sometimes yours) if they're in. Whoever you go to see heads home; after dark everyone's home.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  const phase = (i: number) => (tick + i * 3) % 8; // 15 s steps: 0-3 home, 4-5 the shop, 6-7 visiting
  const outing = (i: number): "shop" | number | null => {
    if (i === meIndex || i === dest || i === inside || mood.night || residents.length < 2) return null;
    if (phase(i) < 4) return null;
    if (phase(i) < 6) return "shop";
    let host = (i + 1 + Math.floor(tick / 8)) % residents.length;
    if (host === i) host = (host + 1) % residents.length;
    const hostIn = host === meIndex || host === dest || phase(host) < 4;
    return hostIn ? host : "shop";
  };
  const visited = (host: number) => residents.some((_, j) => outing(j) === host);
  if (focus !== OVERVIEW && focus !== dest) setDest(focus);
  const [shopOpen, setShopOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // placing a garden thing you've just bought: where it's hovering on your plot, and whether it fits there
  const [placing, setPlacing] = useState<Placed | null>(null);
  const [fresh, setFresh] = useState<string | null>(null); // the thing just placed, still building
  const [watching, setWatching] = useState(false); // the camera stays over the plot while it builds
  const meRes = residents[meIndex];
  const placeOk = placing ? canPlace(placing, meRes.level, meRes.streak, garden) : false;
  const startPlacing = (item: string) => {
    setShopOpen(false);
    setInside(null);
    setFocus(meIndex);
    setPlacing(firstFreeSpot(item, meRes.level, meRes.streak, garden) ?? { item, x: 2, z: 2, turn: 0 });
  };
  // the pointer over the plot: the thing follows it, snapped to two studs, its footprint kept on the plot
  const hoverTo = (p: THREE.Vector3) => {
    if (!placing) return;
    const g = gardenItem(placing.item)!;
    const { w, d } = footprint(g, placing.turn);
    const [px, pz] = fromLot(lots[meIndex], [p.x / LDU, -p.z / LDU]);
    const snap = (v: number, size: number) => Math.max(1, Math.min(PLOT - 1 - size, Math.round((v / 20 + PLOT / 2 - size / 2) / 2) * 2));
    const x = snap(px, w);
    const z = snap(pz, d);
    if (x !== placing.x || z !== placing.z) setPlacing({ ...placing, x, z });
  };
  const placeIt = async () => {
    if (!placing || !placeOk) return;
    const err = onPlace ? await onPlace(placing) : null;
    if (err) {
      setNote(err);
      setTimeout(() => setNote(null), 2500);
      return;
    }
    setFresh(`${placing.item}:${placing.x}:${placing.z}`);
    setPlacing(null);
    setWatching(true);
    setTimeout(() => setWatching(false), BUILD_TIME * 1000 + 800);
  };
  // the brick wipe, for switching between the town and your room
  const [wipe, setWipe] = useState<"in" | "out" | null>(null);
  const wipeTo = (swap: () => void) => {
    setWipe("in");
    setTimeout(() => {
      swap();
      setWipe("out");
      setTimeout(() => setWipe(null), WIPE_OUT);
    }, WIPE_IN);
  };

  // playing: outside, the camera follows you and you walk where you like (stick or keys);
  // the whole-town view and being inside a house frame the scene instead
  const isPlacing = placing !== null || watching; // over your plot: placing, or watching it build
  const following = focus !== OVERVIEW && inside === null && !isPlacing;
  const stick = useRef({ x: 0, y: 0 });
  const jumps = useRef(0);
  // energy: the walker drains it as you run; a jump takes a bite; the bar reads it
  const energyRef = useRef(energy ?? ENERGY_MAX);
  useEffect(() => {
    if (energy !== null) energyRef.current = energy;
  }, [energy]);
  const jump = () => {
    if (energy !== null && energyRef.current < JUMP_COST) return;
    if (energy !== null) energyRef.current -= JUMP_COST;
    jumps.current++;
    sfx.jump();
  };
  useKeysToStick(stick, undefined, jump);
  const energyNow = useEnergyReadout(energy === null ? undefined : energyRef, energy ?? ENERGY_MAX);
  const me3 = useRef(new THREE.Vector3());
  const meAim = useRef<number | null>(null);
  const blockers = useMemo(() => townBlockers(residents), [residents]);
  const [goes, setGoes] = useState(0); // bumped by every "walk there", so the same place twice still walks
  const [near, setNear] = useState<number | null>(null);
  // who you've walked up to (they say something), and a new line each time you meet
  const [talker, setTalker] = useState<string | null>(null);
  const [meetings, setMeetings] = useState(0);
  const places = useMemo(
    () => [
      { id: SHOP_FOCUS, at: SHOP_WALK[SHOP_WALK.length - 1] },
      ...residents.map((res, i) => ({ id: i, at: doorWalk(lots[i], res.level).at(-1)! })),
    ],
    [residents, lots],
  );

  // a house's centre on the ground, in its lot's frame (LDU)
  const centre = (level: number): [number, number, number] => {
    const s = houseSpec(level);
    return [(s.x0 + s.w / 2 - PLOT / 2) * 20, 0, (s.z0 + s.d / 2 - PLOT / 2) * 20];
  };
  const houseCentre = (i: number) => inLot(lots[i], centre(residents[i].level));

  const target = useMemo(() => {
    if (following) return STILL; // the camera follows you instead
    if (isPlacing) {
      const [x, , z] = toThree([lots[meIndex].x, 0, lots[meIndex].z]);
      return new THREE.Vector3(x, 1, z);
    }
    // the shop and the fountain in front of it, looking up at the building
    if (focus === OVERVIEW) return new THREE.Vector3(0, 0, 0);
    if (focus === SHOP_FOCUS) return new THREE.Vector3(0, 10, -((SHOP_FRONT + FOUNTAIN[1]) / 2) * LDU);
    const [x, , z] = toThree(houseCentre(focus));
    return new THREE.Vector3(x, inside === null ? 3 : 2, z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, inside, lots, following, isPlacing, meIndex]);
  // look at a house from its front: turn the view with the lot
  const dir = useMemo(() => {
    if (following) return CHASE_DIR;
    if (isPlacing) return LOOK_DOWN.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -turnRad(lots[meIndex].facing));
    const base = inside === null ? FRONT_RIGHT : LOOK_IN;
    if (focus === OVERVIEW) return LOOK_DOWN;
    if (focus === SHOP_FOCUS) return base;
    return base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -turnRad(lots[focus].facing));
  }, [focus, inside, lots, following, isPlacing, meIndex]);
  const bounds = useMemo(() => {
    const h = (TOWN_HALF - 8) * 20 * LDU;
    return new THREE.Box3(new THREE.Vector3(-h, 0, -h), new THREE.Vector3(h, 12, h));
  }, []);

  // walk to a place (a name tapped): the camera follows you there
  const go = (i: number) => {
    setFocus(i);
    setInside(null);
    setGoes((n) => n + 1);
  };

  // a tap on the ground: go to whatever is nearest -- the plaza or a lot
  const pick = (p: THREE.Vector3) => {
    const x = p.x / LDU;
    const z = -p.z / LDU;
    let best = SHOP_FOCUS;
    let bestD = x * x + z * z;
    lots.forEach((lot, i) => {
      const d = (x - lot.x) ** 2 + (z - lot.z) ** 2;
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    go(best);
  };

  if (room && inside === meIndex)
    return (
      <div className={`relative ${className ?? ""}`}>
        {room(() => wipeTo(() => setInside(null)))}
        {wipe && <BrickWipe phase={wipe} />}
      </div>
    );

  // the action button is about where you're standing (following) or what you're looking at
  const here = following ? near : focus;
  const r = here === null || here < 0 ? null : residents[here]; // the shop and the overview are nobody's house
  const access = r && (r.me ? "allowed" : visits[r.name]);
  const label = (text: string, me: boolean, onClick: () => void) => (
    <button
      onClick={() => {
        sfx.click();
        onClick();
      }}
      className={`lego lego-sm ${me ? "" : "lego-white"}`}
    >
      {text}
    </button>
  );
  // playing: just the name of the place you're standing at, over it
  const nearPin = (i: number) => {
    if (i === SHOP_FOCUS)
      return {
        key: "shop",
        at: [0, SHOP_BUILDING.h * LDU + 3, -(SHOP_FRONT - (SHOP_BUILDING.d / 2) * 20) * LDU] as [number, number, number],
        node: <span className="lego lego-sm lego-white">Market Street</span>,
      };
    const [x, , z] = toThree(houseCentre(i));
    const res = residents[i];
    return {
      key: res.name,
      at: [x, houseFor(res.level, res.name).h * LDU + 3, z] as [number, number, number],
      node: <span className={`lego lego-sm ${res.me ? "" : "lego-white"}`}>{res.me ? "Your house" : `${res.name}'s house`}</span>,
    };
  };
  // a friend's speech bubble, over their head wherever they walk
  const chatPin = (name: string) => {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const line = CHATTER[Math.abs(h + meetings) % CHATTER.length](residents[meIndex]?.name ?? "friend");
    return {
      key: `chat-${name}-${meetings}`,
      at: () => {
        const p = CROWD.get(name);
        return p ? ([p.x * LDU, 6.4, -p.z * LDU] as [number, number, number]) : null;
      },
      node: <span className="lego-bubble">{line}</span>,
    };
  };
  // what the big round button does where you are
  const action: { icon: keyof typeof ICONS; text: string; onClick?: () => void; tone?: "" | "dark" | "yellow" | "green" } | null =
    here === null || here === OVERVIEW
      ? null
      : here === SHOP_FOCUS
        ? prices
          ? { icon: "shop", text: "Shop", onClick: () => setShopOpen(true), tone: "yellow" }
          : null
        : inside !== null
          ? { icon: "out", text: "Step outside", onClick: () => setInside(null) }
          : access === "allowed"
            ? {
                icon: "door",
                text: r!.me ? "Go inside" : `Visit ${r!.name}`,
                onClick: () => {
                  const go = () => {
                    setFocus(here);
                    setInside(here);
                  };
                  // your own room is a new scene: brick-wipe into it
                  if (room && here === meIndex) wipeTo(go);
                  else go();
                },
                tone: "green",
              }
            : access === "knocked"
              ? { icon: "wait", text: `Waiting for ${r!.name}…`, tone: "dark" }
              : onKnock
                ? { icon: "knock", text: `Knock`, onClick: () => onKnock(r!.name) }
                : null;
  const me = residents[meIndex];

  return (
    <div className={`relative ${className ?? ""}`}>
      <Stage
        className="absolute inset-0"
        label="Your town"
        target={target}
        width={
          inside !== null
            ? houseFor(residents[inside].level, residents[inside].name).w + 10
            : following
              ? CHASE_WIDTH
              : placing
                ? PLOT + 14
                : focus === OVERVIEW
                ? TOWN_HALF * 2.2
                : focus === SHOP_FOCUS
                  ? 95
                  : 62
        }
        far={1500}
        // the house and shop framings rely on the usual 110 limit; only the overview pulls further out
        maxDistance={focus === OVERVIEW ? 600 : 110}
        dir={dir}
        bounds={bounds}
        pan={!following}
        follow={following ? me3 : undefined}
        aim={meAim}
        fov={following ? CHASE_FOV : 32}
        mood={mood}
        onPick={placing || following ? undefined : pick}
        overlay={
          <>
            <Scenery color={grass} season={season} sunAt={mood.night ? undefined : SUN_AT} />
            {following && <NearStuds follow={me3} grass={grass} />}
            {/* the ground: grass everywhere, the smooth grey street square, the plaza (paved out to its
                pavement) and each plot on its lawn */}
            <StudGround at={[0, 0]} size={Math.round(TOWN_HALF * 4)} color={grass} y={-0.03} flat />
            <StudGround at={[0, 0]} size={TOWN_HALF * 2} color="#43474c" y={-0.015} flat />
            <StudGround at={[0, 0]} size={BLOCK} color="#a3a7ad" y={-0.008} flat />
            <StudGround at={[0, 0]} size={PLOT} color="#a3a7ad" />
            {[...lots, ...emptyLots].map((lot, i) => (
              <group key={i}>
                <StudGround at={[lot.x * LDU, -lot.z * LDU]} size={BLOCK} color={grass} y={-0.008} flat />
                <StudGround at={[lot.x * LDU, -lot.z * LDU]} size={PLOT} color={grass} />
              </group>
            ))}
          </>
        }
        pins={following ? [...(near === null ? [] : [nearPin(near)]), ...(talker ? [chatPin(talker)] : [])] : [
          {
            key: "shop",
            at: [0, SHOP_BUILDING.h * LDU + 3, -(SHOP_FRONT - (SHOP_BUILDING.d / 2) * 20) * LDU] as [number, number, number],
            node: label("Shop", false, () => go(SHOP_FOCUS)),
          },
          ...emptyLots.map((lot, k) => ({
            key: `empty-${k}`,
            at: [lot.x * LDU, 6, -lot.z * LDU] as [number, number, number],
            node: (
              <button onClick={onInvite} disabled={!onInvite} className="lego lego-sm lego-green">
                {onInvite ? "Free plot · invite a friend" : "Free plot"}
              </button>
            ),
          })),
          ...residents.flatMap((res, i) => {
            if (i === inside) return [];
            const [x, , z] = toThree(houseCentre(i));
            return [
              {
                key: res.name,
                at: [x, houseFor(res.level, res.name).h * LDU + 3, z] as [number, number, number],
                node: label(res.me ? "You" : res.name, !!res.me, () => go(i)),
              },
            ];
          }),
        ]}
      >
        {town && <primitive object={town} />}
        {built && !settled && <Settle onSettled={() => setSettled(true)} />}
        {following && <Near where={me3} places={places} onNear={setNear} />}
        {following && (
          <Chatter
            where={me3}
            friends={residents.filter((res) => !res.me).map((res) => res.name)}
            onTalk={(name) => {
              setTalker(name);
              if (!name) return;
              setMeetings((n) => n + 1);
              sfx.blip();
            }}
          />
        )}
        <InstancedParts placements={placementsIn(townInstances(residents), season)} />
        {/* the shop, its front to the camera's side of the plaza */}
        {/* the shop at the back of the plaza, the fountain and the rest of the square in front of it */}
        <Building url={houseUrl(SHOP_BUILDING)} at={[(-SHOP_BUILDING.w / 2) * 20, 0, SHOP_FRONT]} lit={mood.night} build={settled ? 0.1 : null} />
        {plaza && <primitive object={plaza} />}
        {decor && <primitive object={decor} />}
        <Slabs slabs={FLATS} />
        <Slabs slabs={HEDGES} />
        <DriftingClouds />
        {parks && <primitive object={parks} />}
        <Traffic night={mood.night} />
        <Seagulls />
        <Prop {...ICE_CREAM_CART} />
        {emptyLots.map((lot, k) => (
          <Prop key={k} {...PARK_BURGER_STAND} lot={lot} />
        ))}
        <FountainSpray />
        <TownSign name={residents[meIndex]?.name ?? "Your"} />
        {mood.night && <LampGlows at={[...PLAZA_LAMPS, ...STREET_LAMP_LIGHTS]} />}
        {STROLLERS.map((p, i) => (
          <Stroller key={i} id={`stroller-${i}`} {...p} />
        ))}
        {!mood.night &&
          JOGGERS.slice(0, mood.name === "golden" ? 4 : 2).map((p, i) => (
            <Jogger key={i} id={`jogger-${i}`} {...p} />
          ))}
        {residents.map((res, i) => (
          <Ride key={res.name} ride={loadoutFor(res.level, res.character ?? undefined).ride} at={rideSpot(lots[i], res.level)} turn={turnRad(lots[i].facing)} />
        ))}
        {/* the garden things on your plot, and the one you're placing with its footprint */}
        {garden.map((p) => (
          <PlacedThing key={`${p.item}:${p.x}:${p.z}`} lot={lots[meIndex]} placed={p} fresh={fresh === `${p.item}:${p.x}:${p.z}`} />
        ))}
        {placing && (
          <>
            <PlacedThing key={`ghost-${placing.item}`} lot={lots[meIndex]} placed={placing} />
            <Footprint lot={lots[meIndex]} placed={placing} ok={placeOk} />
            {/* an unseen plate over the whole plot that the pointer can land on (the lawn itself is
                drawn outside this group), so the thing follows the finger anywhere on the plot */}
            <mesh
              position={[lots[meIndex].x, -0.5, lots[meIndex].z]}
              rotation={[Math.PI / 2, 0, 0]}
              onPointerMove={(e) => hoverTo(e.point)}
              onClick={(e) => hoverTo(e.point)}
            >
              <planeGeometry args={[PLOT * 20, PLOT * 20]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </>
        )}
        {residents.map((res, i) => (
          <group key={res.name} position={[lots[i].x, 0, lots[i].z]} rotation={[0, turnRad(lots[i].facing), 0]}>
            {/* the town builds itself once it's loaded (not while it's still loading, which made
                it stutter): the shop, then each house in turn */}
            <House level={res.level} name={res.name} cut={i === inside ? CUT : undefined} lit={mood.night} build={settled ? 0.5 + i * 0.35 : null} />
          </group>
        ))}
        {residents.map((res, i) => {
          // you walk to where you last looked, and into the house you're visiting; everyone else stays at their door
          if (i === meIndex) {
            // you walk to wherever you last looked (the whole-town view doesn't move you)
            const shop = dest === SHOP_FOCUS || !residents[dest];
            let to = SHOP_WALK;
            if (!shop) {
              const { level, name } = residents[dest];
              const side = dest === meIndex ? 0 : 40;
              const house = houseFor(level, name);
              const r = rooms.get(houseUrl(house));
              const [hx, , hz] = houseAt(houseSpec(level), house);
              to =
                inside === dest
                  ? insideWalk(lots[dest], level, side, r && { x: hx + r.x, z: hz + r.z, front: hz + r.front })
                  : doorWalk(lots[dest], level, side);
            }
            // you wave at the friend you've come to see, or at one who's come round to yours
            const wave = inside === null && !shop && (dest !== meIndex || visited(meIndex));
            return <Walker key="me" id="me" wave={wave} go={goes} input={stick} jumpRef={jumps} aimRef={meAim} energyRef={energy === null ? undefined : energyRef} blockers={blockers} where={me3} look={loadoutFor(res.level, res.character ?? undefined)} to={to} turn={shop ? Math.PI : turnRad(lots[dest].facing)} />;
          }
          // friends: at their door, at the shop, or on a neighbour's step, turned to them
          const out = outing(i);
          const host = typeof out === "number" ? out : null;
          return (
            <Walker
              key={res.name}
              id={res.name}
              // hello: when you come to see them, when someone's round, and to whoever they're visiting
              wave={host !== null || (!out && (dest === i || visited(i)))}
              look={loadoutFor(res.level, res.character ?? undefined)}
              to={
                out === "shop"
                  ? shopWalk(1 + (i % 3))
                  : host !== null
                    ? doorWalk(lots[host], residents[host].level, -40)
                    : doorWalk(lots[i], res.level)
              }
              turn={out === "shop" ? Math.PI : host !== null ? turnRad(lots[host].facing) + Math.PI / 2 : turnRad(lots[i].facing)}
            />
          );
        })}
      </Stage>

      {/* while the town loads (it stutters then), a LEGO loading card; it fades as the town builds itself */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none ${settled ? "fade-away" : ""}`}
        style={{ background: "linear-gradient(180deg, #8fd0ff 0%, #d9efff 60%, #7cc36a 60%, #58ab41 100%)" }}
        aria-hidden={settled}
      >
        <div className="flex flex-col-reverse items-center gap-[3px]">
          {["#d01012", "#f5cd2f", "#0055bf"].map((c, i) => (
            <span key={c} className="stack-brick" style={{ "--c": c, animationDelay: `${i * 0.18}s` } as React.CSSProperties} />
          ))}
        </div>
        <span className="lego lego-white text-sm">Building your town…</span>
      </div>

      {/* the HUD, LEGO-game style. Top left: you (head, name, level, gold). */}
      {me && (
        <div className="absolute top-2 left-3 flex items-start gap-2 pointer-events-none">
          {onBack && <RoundAction icon="back" text="World" tone="dark" small onClick={onBack} />}
          <div className="lego-hud">
            <HeadIcon />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-extrabold leading-tight truncate max-w-[110px]">{me.name}</span>
              <div className="flex items-center gap-1">
                <span className="lego-chip level">Lv {me.level}</span>
                {gold !== null && (
                  <span className="lego-chip gold">
                    <span className="stud-icon" />
                    {gold.toLocaleString()}
                  </span>
                )}
              </div>
              {energy !== null && <EnergyBar value={energyNow} />}
            </div>
          </div>
        </div>
      )}
      {/* top right: the map (the whole town), and from it, back to playing */}
      <div className="absolute top-3 right-3 flex items-start gap-2">
        <SoundToggle />
        {inside === null &&
          !isPlacing &&
          (following ? (
            <RoundAction icon="map" text="Map" tone="dark" small onClick={() => go(OVERVIEW)} />
          ) : (
            <RoundAction icon="play" text="Play" small onClick={() => setFocus(dest)} />
          ))}
      </div>
      {note && !shopOpen && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
          <span className="lego lego-green text-sm">
            {note}
            <BrickBurst count={26} />
          </span>
        </div>
      )}

      {/* bottom left: the stick (while you're out and about); bottom right: what you can do
          where you're standing (the big round button) and Jump */}
      <div className="absolute inset-x-0 bottom-3 flex items-end justify-between gap-2 px-3 pointer-events-none">
        <div className="flex-none">{following && <Joystick outRef={stick} />}</div>
        {placing && (
          <div className="flex items-end gap-3 mx-auto">
            <RoundAction icon="x" text="Cancel" tone="dark" small onClick={() => setPlacing(null)} />
            <RoundAction icon="rotate" text="Turn" tone="dark" small onClick={() => setPlacing({ ...placing, turn: (placing.turn + 1) % 4 })} />
            <RoundAction icon="check" text={placeOk ? "Place it" : "Not here"} tone="green" onClick={placeIt} disabled={!placeOk} />
          </div>
        )}
        {placing && (
          <span className="lego lego-sm lego-white absolute left-1/2 -translate-x-1/2 -top-10" data-at={`${placing.x},${placing.z},${placing.turn}`} data-ok={placeOk}>
            Drag it where you want it
          </span>
        )}
        {focus === OVERVIEW && (
          <span className="lego lego-sm lego-white mb-2 self-center">Tap a place to walk there</span>
        )}
        {!isPlacing && (
          <div className="flex items-end gap-3">
            {following && <RoundAction icon="jump" text="Jump" tone="dark" small onClick={jump} disabled={energy !== null && energyNow < JUMP_COST} />}
            {action && <RoundAction icon={action.icon} text={action.text} onClick={action.onClick} disabled={!action.onClick} tone={action.tone} />}
          </div>
        )}
      </div>

      {shopOpen && prices && onBuy && (
        <ShopSheet
          gold={gold}
          prices={prices}
          owned={owned}
          onBuy={onBuy}
          onClose={(bought, gardenId) => {
            setShopOpen(false);
            if (gardenId) return startPlacing(gardenId);
            if (!bought) return;
            setNote(`${bought} is waiting in your house`);
            setTimeout(() => setNote(null), 2500);
          }}
        />
      )}
      {wipe && <BrickWipe phase={wipe} />}
    </div>
  );
}

// looking steeply down into a house with its roof off
const LOOK_IN = new THREE.Vector3(0.3, 1.25, -0.55).normalize();
// standing in your room: from the open front at about head height, looking across it
const ROOM_VIEW = new THREE.Vector3(0, 0.62, -1).normalize();
// you can look around the room but not walk out of it
const ROOM_BOUNDS = new THREE.Box3(new THREE.Vector3(-8, 0, -8), new THREE.Vector3(8, 6, 8));
// how high (three units, about four bricks) the walls stay when you're inside
const CUT = 4.6;

// Calls back once frames have come smoothly for a while (nothing heavy is
// being parsed any more): the moment to start animations that must not stutter.
function Settle({ onSettled }: { onSettled: () => void }) {
  const smooth = useRef(0);
  const waited = useRef(0);
  const done = useRef(false);
  useFrame((_, dt) => {
    if (done.current) return;
    smooth.current = dt < 1 / 30 ? smooth.current + 1 : 0;
    waited.current += dt;
    // a slow phone may never get that smooth: go anyway after 4 s
    if (smooth.current >= 20 || waited.current > 4) {
      done.current = true;
      onSettled();
    }
  });
  return null;
}

// The on-screen stick (bottom left, LEGO-game style): drag the knob; it writes
// where it points (-1..1, y up) into `out` and springs back when let go.
function Joystick({ outRef }: { outRef: React.RefObject<{ x: number; y: number }> }) {
  const knob = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const reach = r.width / 2 - 14;
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(x, y);
    if (d > reach) [x, y] = [(x / d) * reach, (y / d) * reach];
    outRef.current = { x: x / reach, y: -y / reach };
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const stop = () => {
    outRef.current = { x: 0, y: 0 };
    if (knob.current) knob.current.style.transform = "";
  };
  return (
    <div
      className="lego-stick pointer-events-auto"
      role="application"
      aria-label="Walk: drag to move"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => e.buttons && move(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <span ref={knob} className="lego-stick-knob" />
    </div>
  );
}

// WASD or the arrow keys walk you too (on a computer)
function useKeysToStick(outRef: React.RefObject<{ x: number; y: number }>, jumpRef?: React.RefObject<number>, onJump?: () => void) {
  useEffect(() => {
    const down = new Set<string>();
    const set = () => {
      const k = (a: string, b: string) => (down.has(a) || down.has(b) ? 1 : 0);
      // keys walk; hold Shift to run
      const push = down.has("shift") ? 1 : 0.7;
      outRef.current = { x: (k("d", "arrowright") - k("a", "arrowleft")) * push, y: (k("w", "arrowup") - k("s", "arrowdown")) * push };
    };
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const key = e.key.toLowerCase();
      if (key === " " && (jumpRef || onJump)) {
        e.preventDefault();
        if (e.type === "keydown" && !e.repeat) {
          if (onJump) onJump();
          else if (jumpRef) {
            jumpRef.current++;
            sfx.jump();
          }
        }
        return;
      }
      if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) return;
      e.preventDefault();
      if (e.type === "keydown") down.add(key);
      else down.delete(key);
      set();
    };
    window.addEventListener("keydown", on);
    window.addEventListener("keyup", on);
    return () => {
      window.removeEventListener("keydown", on);
      window.removeEventListener("keyup", on);
    };
  }, [outRef, jumpRef, onJump]);
}

// Walk up to a friend and they say something (LEGO games' chatter): whoever
// is nearest within a few steps, reported only when it changes.
const CHATTER = [
  (me: string) => `Hi ${me}!`,
  () => "Did your workout today?",
  () => "Race you to the shop!",
  () => "Nice house!",
  () => "Drunk your water yet?",
  () => "See you at the fountain!",
  () => "Streak still going?",
  (me: string) => `Looking strong, ${me}!`,
];
function Chatter({
  where,
  friends,
  onTalk,
}: {
  where: React.RefObject<THREE.Vector3>;
  friends: string[];
  onTalk: (name: string | null) => void;
}) {
  const last = useRef<string | null | undefined>(undefined);
  useFrame(() => {
    const [x, z] = [where.current.x / LDU, -where.current.z / LDU];
    let best: string | null = null;
    let bestD = 130; // LDU: close enough to chat
    for (const name of friends) {
      const p = CROWD.get(name);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) [best, bestD] = [name, d];
    }
    if (best !== last.current) {
      last.current = best;
      onTalk(best);
    }
  });
  return null;
}

// Which place you're standing at (a door, the shop), for the action button:
// checked every frame, reported only when it changes.
function Near({
  where,
  places,
  onNear,
}: {
  where: React.RefObject<THREE.Vector3>;
  places: { id: number; at: P3 }[];
  onNear: (id: number | null) => void;
}) {
  const last = useRef<number | null | undefined>(undefined);
  useFrame(() => {
    const p = where.current;
    let best: number | null = null;
    let bestD = 170; // LDU: a few steps from the door
    for (const pl of places) {
      const d = Math.hypot(pl.at[0] - p.x / LDU, pl.at[2] + p.z / LDU);
      if (d < bestD) [best, bestD] = [pl.id, d];
    }
    if (best !== last.current) {
      last.current = best;
      onNear(best);
    }
  });
  return null;
}

// ---- the HUD ----
// Simple, chunky icons for the round buttons (24x24, drawn in currentColor).
const ICONS: Record<string, React.ReactNode> = {
  door: <path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12.5h.01" strokeWidth="2.4" />,
  knock: <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V11m0-3a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14" strokeWidth="2" />,
  shop: <path d="M5 8h14l-1.2 11.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Zm4 0V6a3 3 0 0 1 6 0v2" strokeWidth="2.2" />,
  out: <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10" strokeWidth="2.4" />,
  wait: <path d="M12 6v6l4 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" strokeWidth="2.2" />,
  jump: <path d="M12 19V6M6 11l6-6 6 6" strokeWidth="2.8" />,
  map: <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5" strokeWidth="2" />,
  play: <path d="M12 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-4 16v-5a4 4 0 0 1 8 0v5" strokeWidth="2.4" />,
  sound: <path d="M4 10v4h4l5 4V6L8 10H4Zm12.5-1.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" strokeWidth="2.2" />,
  back: <path d="M15 5l-7 7 7 7" strokeWidth="3" />,
  rotate: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" strokeWidth="2.6" />,
  check: <path d="M5 12.5 10 17.5 19 7" strokeWidth="3.2" />,
  x: <path d="M6 6l12 12M18 6 6 18" strokeWidth="3" />,
  mute: <path d="M4 10v4h4l5 4V6L8 10H4Zm12 0 5 5m0-5-5 5" strokeWidth="2.2" />,
};
function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

// A round LEGO button with an icon, and what it does written under it.
function RoundAction({
  icon,
  text,
  onClick,
  disabled,
  tone = "",
  small,
}: {
  icon: keyof typeof ICONS;
  text?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "" | "dark" | "yellow" | "green";
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 pointer-events-auto">
      <button
        onClick={() => {
          sfx.click();
          onClick?.();
        }}
        disabled={disabled}
        aria-label={text}
        className={`lego-round ${tone} ${small ? "small" : ""}`}
      >
        <Icon name={icon} />
      </button>
      {text && <span className="lego-chip max-w-[120px] truncate" style={{ background: "rgba(20,18,16,0.72)", color: "#fff" }}>{text}</span>}
    </div>
  );
}

// The speaker: sound on or off (remembered on this device)
function SoundToggle() {
  const [on, setOn] = useState(soundOn);
  return (
    <RoundAction
      icon={on ? "sound" : "mute"}
      text={on ? "Sound" : "Muted"}
      tone="dark"
      small
      onClick={() => {
        setSound(!on);
        setOn(!on);
      }}
    />
  );
}

// The energy bar (0..100) on the player card: ten little bricks, green, then
// amber, then red as it runs down.
function EnergyBar({ value }: { value: number }) {
  const on = Math.round((Math.max(0, value) / ENERGY_MAX) * 10);
  const colour = value > 50 ? "#4b9f4a" : value > 25 ? "#f5cd2f" : "#d01012";
  return (
    <span className="energy-bar" role="meter" aria-label="Energy" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={ENERGY_MAX}>
      <span className="bolt" aria-hidden>
        ⚡
      </span>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < on ? "on" : ""} style={{ "--e": colour } as React.CSSProperties} />
      ))}
    </span>
  );
}
// Reads a live energy value (a ref the walker drains) a few times a second for the bar.
function useEnergyReadout(energyRef: React.RefObject<number> | undefined, initial: number) {
  const [shown, setShown] = useState(initial);
  useEffect(() => {
    if (!energyRef) return;
    const t = setInterval(() => setShown((v) => (Math.abs(v - energyRef.current) > 0.4 ? energyRef.current : v)), 250);
    return () => clearInterval(t);
  }, [energyRef]);
  return shown;
}

// Your minifig's head, for the player card: yellow, a stud on top, a smile.
function HeadIcon() {
  return (
    <svg viewBox="0 0 40 44" width="38" height="42" aria-hidden>
      <rect x="14" y="1" width="12" height="7" rx="2" fill="#f2cd37" stroke="#b58f12" strokeWidth="1.2" />
      <rect x="5" y="7" width="30" height="33" rx="9" fill="#f5d33f" stroke="#b58f12" strokeWidth="1.4" />
      <rect x="9" y="10" width="7" height="26" rx="3.5" fill="#fff" opacity="0.28" />
      <circle cx="15" cy="21" r="2.4" fill="#1b1b1b" />
      <circle cx="25" cy="21" r="2.4" fill="#1b1b1b" />
      <path d="M13 28c4 4 10 4 14 0" fill="none" stroke="#1b1b1b" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// The brick wipe: a wall of LEGO bricks tumbles in, row by row from the
// bottom, to cover the screen; then falls away (going into / out of a room).
const WIPE_COLOURS = ["#d01012", "#0055bf", "#f5cd2f", "#4b9f4a", "#fe8a18", "#ffffff", "#a0a5a9", "#582a12"];
function BrickWipe({ phase }: { phase: "in" | "out" }) {
  useEffect(() => sfx.clatter(), [phase]);
  const rows = 12;
  const cols = 6;
  return (
    <div className={`brick-wipe ${phase} ${phase === "in" ? "covering" : ""}`} aria-hidden>
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        return (
          <span
            key={i}
            className="wipe-brick"
            style={
              {
                "--c": WIPE_COLOURS[Math.floor(hash(i + 7) * WIPE_COLOURS.length)],
                // in: the bottom rows land first (a wall building up); out: the top rows go first
                animationDelay: `${(phase === "in" ? (rows - 1 - row) * 14 : row * 12) + hash(i) * 40}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
const WIPE_IN = 360 + 11 * 14 + 40; // ms until the wall is complete
const WIPE_OUT = 460 + 11 * 12 + 40;

// A handful of little LEGO bricks bursting out of the middle of whatever it's
// inside (a button, the screen) and tumbling down: something good happened.
const BURST_COLOURS = ["#d01012", "#0055bf", "#f5cd2f", "#4b9f4a", "#fe8a18", "#ffffff", "#a0a5a9"];
function BrickBurst({ count = 16 }: { count?: number }) {
  useEffect(() => sfx.ting(), []);
  return (
    <span className="absolute left-1/2 top-1/2 pointer-events-none" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + hash(i) * 0.6;
        const r = 38 + hash(i + 40) * 46;
        return (
          <span
            key={i}
            className="brick-bit"
            style={
              {
                "--c": BURST_COLOURS[i % BURST_COLOURS.length],
                "--dx": `${Math.cos(a) * r}px`,
                "--dy": `${Math.sin(a) * r - 30}px`,
                "--spin": `${(hash(i + 80) - 0.5) * 540}deg`,
                animationDelay: `${hash(i + 120) * 90}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}


// ---- pictures of the things for sale ----
// Each item is photographed once, LEGO-catalogue style, in a small hidden
// renderer of its own (the parts are already loaded for the town): filling
// the frame from the front and a little above, under studio light with
// reflections so the plastic shines, a soft shadow under it, on nothing.
// Shot at 4x the tile and kept for the session.
const THUMB = 256;
const thumbs = new Map<string, Promise<string>>();
let thumbGl: { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; stage: THREE.Group; floor: THREE.Mesh } | null = null;
function thumbRenderer() {
  if (thumbGl) return thumbGl;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = THUMB;
  const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setPixelRatio(1);
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = 1.15;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // the studio: a room's reflections for the sheen, a key light with a soft shadow, a fill
  scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight("#fff6e8", 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight("#dbe8ff", 0.7);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight("#ffffff", "#c8c8c0", 0.5));
  const stage = new THREE.Group();
  stage.rotation.x = Math.PI; // LDraw is -Y up
  scene.add(stage);
  // the floor: a studded LEGO plate (green grass for garden things, the room's wood for
  // furniture), with the thing's shadow on it
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: studTexture().clone(), roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(28, 1, 1, 20000);
  return (thumbGl = { gl, scene, camera, stage, floor });
}
function thumbFor(id: string): Promise<string> {
  let p = thumbs.get(id);
  if (p) return p;
  p = (async () => {
    const lines = itemPreviewLines(id);
    let obj: THREE.Object3D;
    if (lines) {
      const { loader, parts } = await getLoader(true);
      obj = finish(await parse(loader, modelText(lines, "thumb.ldr") + parts));
    } else {
      const g = gardenItem(id);
      if (!g?.prop) throw new Error(`no picture for ${id}`);
      obj = (await loadHouse(houseUrl((PROPS as Baked[]).find((x) => x.id === g.prop)!))).clone();
    }
    const { gl, scene, camera, stage, floor } = thumbRenderer();
    stage.clear();
    stage.add(obj);
    stage.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(stage);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    // the floor under it, big enough to fill the frame; its studs stay one stud each
    floor.position.set(centre.x, box.min.y - 0.5, centre.z);
    floor.scale.setScalar(radius * 20);
    const mat = floor.material as THREE.MeshStandardMaterial;
    mat.color.set(gardenItem(id) ? "#4b9f4a" : "#b8865a");
    mat.map!.repeat.set(radius, radius); // one stud a stud (20 LDU) across a plate 20 radii wide
    mat.map!.needsUpdate = true;
    const key = scene.children.find((o) => (o as THREE.DirectionalLight).isDirectionalLight) as THREE.DirectionalLight;
    key.position.copy(centre).add(new THREE.Vector3(-0.6, 1.2, -0.7).normalize().multiplyScalar(radius * 4));
    key.target.position.copy(centre);
    key.target.updateMatrixWorld();
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -radius * 1.6;
    cam.right = cam.top = radius * 1.6;
    cam.near = 1;
    cam.far = radius * 12;
    cam.updateProjectionMatrix();
    key.shadow.bias = -0.0005;
    // from the front (three's -Z after the flip) and a little above, right of centre, filling the frame
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.02;
    camera.position.copy(centre).add(new THREE.Vector3(0.62, 0.52, -0.75).normalize().multiplyScalar(dist));
    camera.lookAt(centre);
    camera.near = dist / 20;
    camera.far = dist * 4;
    camera.updateProjectionMatrix();
    gl.render(scene, camera);
    const url = gl.domElement.toDataURL("image/png");
    stage.clear();
    return url;
  })();
  thumbs.set(id, p);
  p.catch(() => thumbs.delete(id));
  return p;
}
function Thumb({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    thumbFor(id)
      .then((u) => live && setUrl(u))
      .catch((e) => console.error("thumb:", e));
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <span
      className="flex-none w-16 h-16 rounded-lg overflow-hidden grid place-items-center"
      style={{ background: gardenItem(id) ? "#4b9f4a" : "#b8865a", boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.25)" }}
    >
      {/* a data URL made here, nothing for next/image to optimise */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={name} width={64} height={64} className="w-16 h-16 object-contain" /> : <span className="stud-icon" />}
    </span>
  );
}

// Inside the shop: the furniture for sale, what you have, what you can afford.
function ShopSheet({
  gold,
  prices,
  owned,
  onBuy,
  onClose,
}: {
  gold: number | null;
  prices: Record<string, number>;
  owned: string[];
  onBuy: (id: string) => Promise<string | null>;
  /** closed, with the name of what was just bought (if anything); a garden thing also gives its id, to place */
  onClose: (bought?: string, gardenId?: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gardenSold = GARDEN.filter((g) => prices[g.id] !== undefined);
  const [tab, setTab] = useState<"garden" | "home">(gardenSold.length ? "garden" : "home");
  const buy = async (id: string, name: string, garden = false) => {
    if (busy) return;
    sfx.click();
    setBusy(id);
    const err = await onBuy(id);
    setBusy(null);
    if (err) return setError(err);
    onClose(name, garden ? id : undefined);
  };
  return (
    <div className="absolute inset-0 flex items-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => onClose()}>
      <div
        className="lego-panel w-full max-h-[70%] overflow-y-auto rounded-t-2xl p-4 slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="display text-[17px]">Market Street</span>
          <span className="lego lego-sm lego-yellow">{(gold ?? 0).toLocaleString()} gold</span>
        </div>
        {gardenSold.length > 0 && (
          <div className="flex gap-2 mb-2">
            <button onClick={() => setTab("garden")} className={`lego lego-sm ${tab === "garden" ? "lego-green" : "lego-white"}`}>
              Garden
            </button>
            <button onClick={() => setTab("home")} className={`lego lego-sm ${tab === "home" ? "lego-green" : "lego-white"}`}>
              Home
            </button>
          </div>
        )}
        <p className="text-xs mb-3" style={{ color: "#5d625a" }}>
          {tab === "garden" ? "Things for your plot. Buy one, put it where you like, and watch it build." : "Furniture for your house. It's there when you get home."}
        </p>
        {error && (
          <p className="text-sm mb-2 font-semibold" style={{ color: "#b3140f" }}>
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {tab === "garden" &&
            gardenSold.map((g) => {
              const price = prices[g.id];
              const short = price - (gold ?? 0);
              return (
                <div key={g.id} className="lego-plate flex items-center gap-3 px-2.5 py-2">
                  <Thumb id={g.id} name={g.name} />
                  <span className="font-semibold text-sm flex-1 min-w-0">
                    {g.name} <span className="text-xs font-normal" style={{ color: "#5d625a" }}>{g.w}×{g.d}</span>
                  </span>
                  {short > 0 ? (
                    <span className="text-xs" style={{ color: "#5d625a" }}>
                      {price} gold · need {short} more
                    </span>
                  ) : (
                    <button onClick={() => buy(g.id, g.name, true)} disabled={busy === g.id} className="lego lego-sm lego-yellow">
                      Buy · {price} gold
                    </button>
                  )}
                </div>
              );
            })}
          {tab === "home" && DECOR.filter((d) => prices[d.id] !== undefined)
            .sort((a, b) => prices[a.id] - prices[b.id])
            .map((d) => {
              const price = prices[d.id];
              const short = price - (gold ?? 0);
              return (
                <div key={d.id} className="lego-plate flex items-center gap-3 px-2.5 py-2">
                  <Thumb id={d.id} name={d.name} />
                  <span className="font-semibold text-sm flex-1 min-w-0">{d.name}</span>
                  {owned.includes(d.id) ? (
                    <span className="text-xs font-semibold" style={{ color: "#256a2b" }}>
                      In your house
                    </span>
                  ) : short > 0 ? (
                    <span className="text-xs" style={{ color: "#5d625a" }}>
                      {price} gold · need {short} more
                    </span>
                  ) : (
                    <button onClick={() => buy(d.id, d.name)} disabled={busy === d.id} className="lego lego-sm lego-yellow">
                      Buy · {price} gold
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// Plain boxes (road markings, pavements, clouds), merged into one mesh per
// colour. LDraw frame: -Y is up, so a slab resting at height y spans -y-h..-y.
function Slabs({ slabs, shadows = true }: { slabs: Slab[]; shadows?: boolean }) {
  const meshes = useMemo(() => {
    const byColor = new Map<string, THREE.BufferGeometry[]>();
    for (const b of slabs) {
      const g = b.r ? new THREE.CylinderGeometry(b.r, b.r, b.h, 48) : new THREE.BoxGeometry(b.w, b.h, b.d);
      g.translate(b.x, -(b.y ?? 0) - b.h / 2, b.z);
      if (!byColor.has(b.color)) byColor.set(b.color, []);
      byColor.get(b.color)!.push(g);
    }
    return [...byColor].map(([color, gs]) => ({ color, geometry: mergeGeometries(gs) }));
  }, [slabs]);
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes]);
  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.color} geometry={m.geometry} castShadow={shadows} receiveShadow={shadows}>
          <meshStandardMaterial color={m.color} roughness={0.7} />
        </mesh>
      ))}
    </>
  );
}
const FLATS = townFlats();
const HEDGES = plotHedges();
const CLOUDS = townClouds();

// ---- traffic: official LEGO cars driving round the ring road ----
// The loop is a rounded square down the ring road's outer lane (LDraw frame),
// sampled once into points with their distance along it.
const LANE = (TOWN_HALF - 4) * 20; // the ring road's outer lane, LDU from the centre
const CORNER = 160; // corner radius, LDU
const LOOP = (() => {
  const pts: { x: number; z: number; d: number }[] = [];
  const s = LANE - CORNER;
  // corners at (+,+), (-,+), (-,-), (+,-), turning the same way round
  const centres: [number, number][] = [[s, s], [-s, s], [-s, -s], [s, -s]];
  centres.forEach(([cx, cz], k) => {
    const a0 = (k * Math.PI) / 2;
    for (let j = 0; j <= 8; j++) {
      const a = a0 + (j / 8) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * CORNER, z: cz + Math.sin(a) * CORNER, d: 0 });
    }
  });
  pts.push({ ...pts[0] });
  for (let i = 1; i < pts.length; i++) pts[i].d = pts[i - 1].d + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return pts;
})();
const LOOP_LENGTH = LOOP[LOOP.length - 1].d;
const CAR_SPEED = 360; // LDU a second: about 18 studs

// where a car is `d` LDU along the loop, and which way it faces (radians about Y)
function alongLoop(d: number): [number, number, number] {
  const t = ((d % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH;
  let i = 1;
  while (LOOP[i].d < t) i++;
  const a = LOOP[i - 1];
  const b = LOOP[i];
  const f = (t - a.d) / (b.d - a.d || 1);
  // a car's own front is +Z; turning by θ about Y points it at (sin θ, cos θ)
  return [a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, Math.atan2(b.x - a.x, b.z - a.z)];
}

function Car({ car, start, night }: { car: Baked; start: number; night: boolean }) {
  const map = useMemo(() => glow(), []);
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    let live = true;
    loadHouse(houseUrl(car))
      .then((o) => live && setObj(o.clone()))
      .catch((e) => console.error("car:", e));
    return () => {
      live = false;
    };
  }, [car]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const [x, z, heading] = alongLoop(start + clock.elapsedTime * CAR_SPEED);
    root.current.position.set(x, 0, z);
    root.current.rotation.y = heading;
  });
  // the glb's origin is its front-left corner; centre it on the lane
  return (
    <group ref={root}>
      {obj && <primitive object={obj} position={[-car.w * 10, 0, car.d * 10]} />}
      {/* headlights after dark: two glows at the front, a little above the road */}
      {night &&
        [-1, 1].map((side) => (
          <sprite key={side} position={[side * car.w * 6, -22, car.d * 10 + 6]} scale={[60, 60, 1]}>
            <spriteMaterial map={map} color="#fff4d6" blending={THREE.AdditiveBlending} depthWrite={false} transparent fog={false} />
          </sprite>
        ))}
    </group>
  );
}

// ---- people strolling round the fountain ----
const STROLLERS: { look: MinifigLook; r: number; speed: number; start: number }[] = [
  // between the fountain's rim (80) and the benches (130), a quarter apart, all the same way at
  // the same pace, so they never walk into each other
  { look: { skin: COL.yellow, hair: COL.reddishBrown, torso: COL.red, legs: COL.blue }, r: 108, speed: 0.3, start: 0 },
  { look: { skin: COL.yellow, hair: COL.black, torso: COL.white, legs: COL.darkGrey }, r: 108, speed: 0.3, start: Math.PI },
  { look: { skin: COL.yellow, hair: COL.yellow, torso: COL.green, legs: COL.tan }, r: 108, speed: 0.3, start: Math.PI / 2 },
  { look: { skin: COL.yellow, hair: COL.darkOrange, torso: COL.purple, legs: COL.black }, r: 108, speed: 0.3, start: (3 * Math.PI) / 2 },
];
// Joggers doing laps of the streets round the plaza (it's a fitness town): a
// few by day, more in the morning and evening, all home after dark.
const JOGGERS: { look: MinifigLook; speed: number; start: number }[] = [
  { look: { skin: COL.yellow, hair: COL.black, torso: COL.azure, legs: COL.black }, speed: 330, start: 0 },
  { look: { skin: COL.yellow, hair: COL.reddishBrown, torso: COL.orange, legs: COL.darkBlue }, speed: 290, start: 1500 },
  { look: { skin: COL.yellow, hair: COL.yellow, torso: COL.brightGreen, legs: COL.darkGrey }, speed: 360, start: 3100 },
  { look: { skin: COL.yellow, hair: COL.darkOrange, torso: COL.pink, legs: COL.black }, speed: 310, start: 2300 },
];
const MOVING = { current: true }; // always on the move
function Jogger({ id, look, speed, start }: (typeof JOGGERS)[number] & { id: string }) {
  const root = useRef<THREE.Group>(null);
  const off = useMemo(() => ({ x: 0, z: 0 }), []);
  useEffect(() => () => void CROWD.delete(id), [id]);
  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    const { at, heading } = jogAt(start + clock.elapsedTime * speed);
    const [x, z] = sidestep(id, at[0], at[2], off, dt);
    // a little bounce in the step (LDraw is -Y up)
    root.current.position.set(x, -Math.abs(Math.sin(clock.elapsedTime * 8)) * 4, z);
    CROWD.set(id, { x, z });
    root.current.rotation.y = heading;
  });
  return (
    <group ref={root}>
      <Minifig look={look} at={[0, 0, 0]} walking={MOVING} stride={24} />
    </group>
  );
}

// You, walking round town to wherever you look: your door, a friend's door
// (beside them), the shop. Change your mind mid-walk and you turn round there.
const WALK_SPEED = 180; // LDU a second: brisk, with legs that keep up (stride 16)
// You can also drive yourself about (joystick or keys): `input` is where the
// stick points (x right, y up the screen), `blockers` what you can't walk
// through; `where` gets your position (three's space) every frame, for the
// camera to follow. A new `go` (the same place again included) walks you there.
const DRIVE_SPEED = 200; // LDU a second at full stick
function Walker({
  id,
  look,
  to,
  turn,
  wave = false,
  go = 0,
  input,
  blockers,
  where,
  jumpRef,
  aimRef,
  energyRef,
}: {
  /** who this is (for keeping out of each other's way) */
  id: string;
  look: MinifigLook | Figure;
  to: P3[];
  turn: number;
  wave?: boolean;
  go?: number;
  jumpRef?: React.RefObject<number>;
  /** which way the camera should come round to (behind you, as an angle round you), or null: leave it */
  aimRef?: React.RefObject<number | null>;
  /** your energy (0..100), drained by running and jumps, trickling back while you rest; none: no limits */
  energyRef?: React.RefObject<number>;
  input?: React.RefObject<{ x: number; y: number }>;
  blockers?: Blocker[];
  where?: React.RefObject<THREE.Vector3>;
}) {
  const root = useRef<THREE.Group>(null);
  const walking = useRef(false);
  const key = JSON.stringify(to) + "#" + go;
  // `from`: the place you last walked to, or null after driving yourself somewhere
  const state = useRef<{ from: P3[] | null; pos: P3; walk: { r: Route; i: number; f: number } | null }>(null);
  useEffect(() => {
    const dest: P3[] = JSON.parse(key.slice(0, key.lastIndexOf("#")));
    const s = state.current;
    if (!s) state.current = { from: dest, pos: dest[dest.length - 1], walk: null };
    else {
      const r = s.walk ? rerouteFrom(s.walk.r, s.walk.i, s.pos, dest) : s.from ? walkRoute(s.from, dest) : walkFrom(s.pos, dest);
      s.walk = r.pts.length > 1 ? { r, i: 0, f: 0 } : null;
      s.from = dest;
    }
  }, [key]);
  const look3 = useMemo(() => new THREE.Vector3(), []);
  const off = useMemo(() => ({ x: 0, z: 0 }), []); // sidestepping someone
  const stepped = useRef({ x: 0, z: 0, d: 0 }); // for your footsteps
  const [running, setRunning] = useState(false);
  useEffect(() => () => void CROWD.delete(id), [id]);
  useFrame(({ camera }, dt) => {
    const s = state.current;
    const o = root.current;
    if (!s || !o) return;
    // turn quickly but smoothly (never snap round a corner), the short way round
    const face = (yaw: number) => {
      const d = Math.atan2(Math.sin(yaw - o.rotation.y), Math.cos(yaw - o.rotation.y));
      o.rotation.y += d * Math.min(1, dt * 12);
    };
    // stand where the path puts you, stepped aside for anyone in the way; tell everyone
    const report = (dodge = true) => {
      let [x, z] = [s.pos[0], s.pos[2]];
      if (dodge) [x, z] = sidestep(id, x, z, off, dt);
      else [off.x, off.z] = [0, 0];
      o.position.set(x, s.pos[1], z);
      CROWD.set(id, { x, z });
      // your footsteps: a soft plastic tick every stride
      if (id === "me") {
        const f = stepped.current;
        f.d += Math.hypot(x - f.x, z - f.z);
        [f.x, f.z] = [x, z];
        if (f.d > 38 && f.d < 400) sfx.step();
        if (f.d > 38) f.d = 0;
      }
      where?.current.set(x * LDU, -s.pos[1] * LDU, -z * LDU);
    };
    // behind someone heading (dx, dz) in LDraw: the camera sits the other way round (three's x, -z)
    const behind = (dx: number, dz: number) => {
      if (aimRef) aimRef.current = Math.atan2(-dx, dz);
    };
    if (aimRef) aimRef.current = null;
    // driving: the stick moves you relative to the camera, sliding along walls
    const stick = input?.current;
    const push = stick ? Math.min(1, Math.hypot(stick.x, stick.y)) : 0;
    // running: the stick pushed right out (or Shift), while you have the energy for it
    const e = energyRef?.current;
    const run = push > 0.85 && (e === undefined || e >= CAN_RUN_AT);
    if (run !== running) setRunning(run);
    if (energyRef) {
      if (run) energyRef.current = Math.max(0, energyRef.current - RUN_COST * dt);
      else energyRef.current = Math.min(ENERGY_MAX, energyRef.current + TRICKLE * dt);
    }
    if (stick && push > 0.15) {
      camera.getWorldDirection(look3);
      const f = Math.hypot(look3.x, look3.z) || 1;
      const [fx, fz] = [look3.x / f, look3.z / f]; // forward on the ground, three's space
      const mx = fx * stick.y - fz * stick.x;
      const mz = fz * stick.y + fx * stick.x;
      const m = Math.hypot(mx, mz) || 1;
      const [dx, dz] = [mx / m, -mz / m]; // LDraw: z is flipped
      const len = DRIVE_SPEED * (run ? 1.8 : push) * Math.min(dt, 0.1);
      // start from where you're actually standing (if you'd stepped aside for someone)
      const [ox, oz] = [s.pos[0] + off.x, s.pos[2] + off.z];
      let [x, z] = stepFree(ox, oz, dx * len, dz * len, blockers ?? []);
      // people: go round them (slide along), never through
      if (intoSomeone(id, ox, oz, x, z)) {
        if (!intoSomeone(id, ox, oz, x, oz)) z = oz;
        else if (!intoSomeone(id, ox, oz, ox, z)) x = ox;
        else [x, z] = [ox, oz];
      }
      s.walk = null;
      s.from = null;
      s.pos = [x, 0, z];
      walking.current = true;
      face(Math.atan2(dx, dz));
      if (stick.y > Math.abs(stick.x)) behind(dx, dz); // only when heading on away from the camera
      report(false);
      return;
    }
    const w = s.walk;
    walking.current = !!w;
    if (!w) {
      if (s.from) face(turn); // at a place: turn to it; after driving, stay as you are
      report(!!s.from); // after driving you stay exactly where you stopped
      return;
    }
    let step = WALK_SPEED * Math.min(dt, 0.1);
    let [a, b] = [w.r.pts[w.i], w.r.pts[w.i + 1]];
    for (;;) {
      const left = Math.hypot(b[0] - a[0], b[2] - a[2]) - w.f;
      if (step < left) break;
      step -= left;
      w.i++;
      w.f = 0;
      if (w.i >= w.r.pts.length - 1) {
        s.walk = null;
        s.pos = b;
        report();
        return;
      }
      [a, b] = [w.r.pts[w.i], w.r.pts[w.i + 1]];
    }
    w.f += step;
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const k = w.f / len;
    s.pos = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    face(Math.atan2(b[0] - a[0], b[2] - a[2]));
    behind(b[0] - a[0], b[2] - a[2]);
    report();
  });
  return (
    <group ref={root}>
      <Minifig look={look} at={[0, 0, 0]} walking={walking} wave={wave} stride={running ? 24 : 16} jumpRef={jumpRef} />
    </group>
  );
}

function Stroller({ id, look, r, speed, start }: (typeof STROLLERS)[number] & { id: string }) {
  const root = useRef<THREE.Group>(null);
  const off = useMemo(() => ({ x: 0, z: 0 }), []);
  useEffect(() => () => void CROWD.delete(id), [id]);
  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    const a = start + clock.elapsedTime * speed;
    const [x, z] = sidestep(id, FOUNTAIN[0] + Math.cos(a) * r, FOUNTAIN[1] + Math.sin(a) * r, off, dt);
    root.current.position.set(x, 0, z);
    CROWD.set(id, { x, z });
    // facing along the circle, the way they're walking (a minifig's front is +Z)
    root.current.rotation.y = Math.atan2(-Math.sin(a) * speed, Math.cos(a) * speed);
  });
  return (
    <group ref={root}>
      <Minifig look={look} at={[0, 0, 0]} walking={MOVING} stride={7} />
    </group>
  );
}

// ---- props: small official sets (the ice cream cart, the parks' burger stands) ----
// Placed by their centre (LDraw frame) and quarter turns; the glb's origin is its front-left corner.
function Prop({ id, at, turn, lot, build }: { id: string; at: [number, number]; turn: number; lot?: Lot; build?: number | null }) {
  const prop = (PROPS as Baked[]).find((p) => p.id === id);
  if (!prop) return null;
  const [x, , z] = lot ? inLot(lot, [at[0], 0, at[1]]) : [at[0], 0, at[1]];
  const facing = (lot ? turnRad(lot.facing) : 0) + (turn * Math.PI) / 2;
  return (
    <group position={[x, 0, z]} rotation={[0, facing, 0]}>
      <Building url={houseUrl(prop)} at={[-prop.w * 10, 0, prop.d * 10]} build={build} />
    </group>
  );
}

// ---- garden things: bought at the shop, put where you like on your plot, built brick by brick ----
// One placed thing on a lot: an official set (a prop) or LDraw pieces. `fresh`:
// it has just been placed, so it goes up a row at a time under a brick shower.
function PlacedThing({ lot, placed, fresh = false }: { lot: Lot; placed: Placed; fresh?: boolean }) {
  const g = gardenItem(placed.item);
  if (!g) return null;
  return (
    <group position={[lot.x, 0, lot.z]} rotation={[0, turnRad(lot.facing), 0]}>
      {g.prop ? (
        <Prop id={g.prop} at={gardenPropAt(placed)} turn={placed.turn} build={fresh ? 0 : undefined} />
      ) : (
        <PiecesThing text={modelText(gardenItemLines(placed), "thing.ldr")} fresh={fresh} />
      )}
    </group>
  );
}
function PiecesThing({ text, fresh }: { text: string; fresh: boolean }) {
  const model = useModel(text, true);
  const box = useMemo(() => (model ? new THREE.Box3().setFromObject(model) : null), [model]);
  const rise = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), fresh ? -1 : OPEN), [fresh]);
  const [building, setBuilding] = useState(fresh);
  const progress = useRef(0);
  const started = useRef<number | null>(null);
  const lastRow = useRef(0);
  // its own materials (the merged model's are the loader's, shared with the town), clipped by the rising plane
  useEffect(() => {
    if (!model) return;
    const own: THREE.Material[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = (mesh.material as THREE.Material).clone();
      m.clippingPlanes = [rise];
      m.clipShadows = true;
      mesh.material = m;
      own.push(m);
    });
    return () => own.forEach((m) => m.dispose());
  }, [model, rise]);
  useFrame(({ clock }) => {
    if (!model || !box) return;
    if (!building) {
      if (rise.constant !== OPEN) rise.set(rise.normal, OPEN);
      return;
    }
    started.current ??= clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - started.current) / BUILD_TIME);
    progress.current = k;
    const rows = Math.max(1, Math.ceil(-box.min.y / ROW));
    const row = Math.min(rows, Math.floor(k * rows) + 1);
    if (row !== lastRow.current) {
      lastRow.current = row;
      sfx.snap();
    }
    rise.set(rise.normal, row * ROW * LDU + 0.02);
    if (k === 1) setBuilding(false);
  });
  return (
    <>
      {model && <primitive object={model} />}
      {building && box && <BrickShower box={box} progress={progress} />}
    </>
  );
}
// The footprint under the thing you're placing: green where it can go, red where it can't.
function Footprint({ lot, placed, ok }: { lot: Lot; placed: Placed; ok: boolean }) {
  const g = gardenItem(placed.item);
  if (!g) return null;
  const { w, d } = footprint(g, placed.turn);
  return (
    <group position={[lot.x, 0, lot.z]} rotation={[0, turnRad(lot.facing), 0]}>
      <mesh position={[(placed.x + w / 2 - PLOT / 2) * 20, -1.5, (placed.z + d / 2 - PLOT / 2) * 20]}>
        <boxGeometry args={[w * 20, 3, d * 20]} />
        <meshStandardMaterial color={ok ? "#4b9f4a" : "#d01012"} transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

// ---- flying: birds and dragons ----
// A flier follows a path (LDraw frame: -Y up) and faces where it's actually
// going: nose along its velocity, pitching up as it climbs, banking into its
// turns by how hard it's turning. `pre` turns the model so its nose points
// along +Z first (a gull's beak is -Z, the dragon runs along X).
const UP = new THREE.Vector3(0, -1, 0);
const flyTmp = { f: new THREE.Vector3(), u: new THREE.Vector3(), x: new THREE.Vector3(), a: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() };
function fly(o: THREE.Object3D, path: (t: number) => THREE.Vector3, t: number, pre: THREE.Quaternion, roll = 0) {
  const h = 0.08;
  const [p0, p1, p2] = [path(t), path(t + h), path(t + 2 * h)];
  const { f, u, x, a, m, q } = flyTmp;
  f.subVectors(p1, p0).normalize();
  a.subVectors(p2, p1).sub(p1.clone().sub(p0)).divideScalar(h * h); // acceleration
  u.copy(UP).addScaledVector(f, -UP.dot(f)).normalize();
  x.crossVectors(f, u); // the flier's side
  // a basis with the nose on +Z and the model's up (-Y in LDraw) on the world's up
  m.makeBasis(x, u.clone().negate(), f); // right-handed: (-u) x f = f x u = x
  q.setFromRotationMatrix(m);
  // bank into the turn: lean the up towards where it's being pulled
  const bank = THREE.MathUtils.clamp(x.dot(a) * 0.04, -0.6, 0.6) + roll;
  o.position.copy(p0);
  o.quaternion.setFromAxisAngle(f, bank).multiply(q).multiply(pre);
}

// seagulls wheeling over the town: wide loops that breathe in and out and
// rise and fall, each its own way round
const GULLS = [
  { r: 700, y: 520, speed: 0.12, start: 0 },
  { r: 900, y: 640, speed: 0.1, start: 2 },
  { r: 500, y: 460, speed: -0.14, start: 4 },
  { r: 1100, y: 700, speed: 0.08, start: 1 },
  { r: 800, y: 580, speed: -0.1, start: 5 },
];
const BEAK_BACK = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); // its beak is -Z
// The clouds drift slowly round the sky (a turn about every half hour).
function DriftingClouds() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => void g.current?.rotateY(dt * 0.0035));
  return (
    <group ref={g}>
      <Slabs slabs={CLOUDS} shadows={false} />
    </group>
  );
}

function Seagulls() {
  const gull = useModel(useMemo(() => modelText(["1 15 0 0 0 1 0 0 0 1 0 0 0 1 12891p01.dat"], "gull.ldr"), []), true);
  const flock = useMemo(() => (gull ? GULLS.map(() => gull.clone()) : []), [gull]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const paths = useMemo(
    () =>
      GULLS.map((g, i) => (t: number) => {
        const a = g.start + t * g.speed;
        const r = g.r * (1 + 0.22 * Math.sin(t * 0.21 + i));
        return new THREE.Vector3(FOUNTAIN[0] + Math.cos(a) * r, -g.y - Math.sin(t * 0.4 + i * 2) * 60, FOUNTAIN[1] + Math.sin(a) * r);
      }),
    [],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    GULLS.forEach((_, i) => {
      const o = refs.current[i];
      // a little rock from wing to wing as it flaps
      if (o) fly(o, paths[i], t, BEAK_BACK, Math.sin(t * 5 + i) * 0.1);
    });
  });
  return (
    <>
      {flock.map((o, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)}>
          <primitive object={o} />
        </group>
      ))}
    </>
  );
}

// ---- the fountain's water: droplets arcing from the jet into the bowls ----
const DROPS = 36;
function FountainSpray() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    for (let i = 0; i < DROPS; i++) {
      const t = (clock.elapsedTime * 0.9 + i / DROPS) % 1; // each drop's time along its arc, 0..1
      const a = (i * 2.39996) % (Math.PI * 2); // spread round the jet (golden angle)
      const out = 12 + t * (i % 3 ? 26 : 60); // most land in the upper bowl, some reach the basin
      const up = 128 + 60 * t - 110 * t * t * (i % 3 ? 1 : 1.3); // height above the ground, LDU
      m.makeTranslation(FOUNTAIN[0] + Math.cos(a) * out, -up, FOUNTAIN[1] + Math.sin(a) * out);
      mesh.current.setMatrixAt(i, m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, DROPS]}>
      <sphereGeometry args={[3.2, 6, 4]} />
      <meshStandardMaterial color="#bfe6ff" transparent opacity={0.75} roughness={0.1} />
    </instancedMesh>
  );
}

// ---- the welcome sign at the front of the plaza: "<name>'s Town" ----
function TownSign({ name }: { name: string }) {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#1f3f8f";
    g.fillRect(0, 0, 512, 128);
    g.strokeStyle = "#f2c230";
    g.lineWidth = 10;
    g.strokeRect(8, 8, 496, 112);
    g.fillStyle = "#ffffff";
    g.font = "bold 58px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(`${name}'s Town`, 256, 66, 470);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    // the LDraw frame is upside down (-Y up) and seen from the other side: flip both ways
    t.flipY = false;
    t.repeat.x = -1;
    t.offset.x = 1;
    return t;
  }, [name]);
  useEffect(() => () => texture.dispose(), [texture]);
  // LDraw frame: -Y is up; the board faces +Z (the front of the plaza)
  return (
    <group position={[-300, 0, 468]}>
      {[-72, 72].map((x) => (
        <mesh key={x} position={[x, -60, 0]} castShadow>
          <boxGeometry args={[10, 120, 10]} />
          <meshStandardMaterial color="#5a3b22" />
        </mesh>
      ))}
      <mesh position={[0, -100, 4]} castShadow>
        <boxGeometry args={[160, 40, 6]} />
        <meshStandardMaterial attach="material-0" color="#1f3f8f" />
        <meshStandardMaterial attach="material-1" color="#1f3f8f" />
        <meshStandardMaterial attach="material-2" color="#1f3f8f" />
        <meshStandardMaterial attach="material-3" color="#1f3f8f" />
        <meshStandardMaterial attach="material-4" map={texture} />
        <meshStandardMaterial attach="material-5" color="#1f3f8f" />
      </mesh>
    </group>
  );
}

function Traffic({ night }: { night: boolean }) {
  const cars = VEHICLES as Baked[];
  return (
    <>
      {[0, 1, 2].map((k) => (
        <Car key={k} car={cars[k % cars.length]} start={(k * LOOP_LENGTH) / 3} night={night} />
      ))}
    </>
  );
}

// A studded LEGO surface drawn as one flat quad with a stud texture: from town
// distance it reads the same as real studs at a fraction of the triangles.
let studs: THREE.CanvasTexture | null = null;
function studTexture() {
  if (studs) return studs;
  const c = document.createElement("canvas");
  // drawn at 128 px a stud and scaled, so studs stay crisp close up
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.scale(2, 2);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  // the stud's shadow, then its side ring, then its top, lit from the top left
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.arc(35, 35, 19, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#cfcfcf";
  g.beginPath();
  g.arc(32, 33, 18.5, 0, Math.PI * 2);
  g.fill();
  const top = g.createRadialGradient(26, 26, 2, 32, 32, 18);
  top.addColorStop(0, "#ffffff");
  top.addColorStop(1, "#e2e2e2");
  g.fillStyle = top;
  g.beginPath();
  g.arc(32, 31.5, 17, 0, Math.PI * 2);
  g.fill();
  studs = new THREE.CanvasTexture(c);
  studs.colorSpace = THREE.SRGBColorSpace;
  studs.wrapS = studs.wrapT = THREE.RepeatWrapping;
  studs.anisotropy = 16; // sharp at a glancing angle, not smeared (clamped to what the GPU has)
  return studs;
}
function StudGround({
  at,
  size,
  color,
  y = 0,
  flat,
}: {
  at: [number, number];
  size: number;
  color: string;
  y?: number;
  flat?: boolean;
}) {
  const map = useMemo(() => {
    if (flat) return null;
    const t = studTexture().clone();
    t.repeat.set(size, size);
    t.needsUpdate = true;
    return t;
  }, [size, flat]);
  const w = size * 20 * LDU;
  return (
    <mesh position={[at[0], y, at[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, w]} />
      <meshStandardMaterial color={color} map={map} roughness={0.5} />
    </mesh>
  );
}

// The grass by season: fresh in spring, LEGO green in summer, olive in autumn, snow in winter.
const GRASS: Record<Season, string> = { spring: "#58ab41", summer: "#4b9f4a", autumn: "#80a83e", winter: "#eef2f6" };

// The forest belt as three instanced meshes (trunks, pine cones, leafy balls):
// a few hundred trees for three draw calls. Three's space (LDraw z flipped).
const FOREST = forestTrees();
function ForestBelt({ season }: { season: Season }) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const leafy = useRef<THREE.InstancedMesh>(null);
  const nPine = FOREST.filter((t) => t.pine).length;
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    let p = 0;
    let l = 0;
    FOREST.forEach((t, i) => {
      const x = t.x * LDU;
      const z = -t.z * LDU;
      const h = t.h * LDU;
      o.position.set(x, h * 0.18, z);
      o.scale.set(0.5, h * 0.36, 0.5);
      o.updateMatrix();
      trunks.current?.setMatrixAt(i, o.matrix);
      if (t.pine) {
        o.position.set(x, h * 0.65, z);
        o.scale.set(h * 0.26, h * 0.7, h * 0.26);
        o.updateMatrix();
        pines.current?.setMatrixAt(p++, o.matrix);
      } else {
        o.position.set(x, h * 0.62, z);
        o.scale.set(h * 0.32, h * 0.3, h * 0.32);
        o.updateMatrix();
        leafy.current?.setMatrixAt(l++, o.matrix);
      }
    });
    for (const m of [trunks, pines, leafy]) if (m.current) m.current.instanceMatrix.needsUpdate = true;
  }, []);
  const leafColour = season === "winter" ? "#eef2f6" : season === "autumn" ? "#e8742a" : season === "spring" ? "#7bc043" : "#4b9f4a";
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, FOREST.length]} castShadow>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#582a12" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={pines} args={[undefined, undefined, nPine]} castShadow>
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color={season === "winter" ? "#dfe6ea" : "#237841"} roughness={0.55} />
      </instancedMesh>
      <instancedMesh ref={leafy} args={[undefined, undefined, FOREST.length - nPine]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color={leafColour} roughness={0.55} />
      </instancedMesh>
    </>
  );
}

// The world beyond the town, built the LEGO way: the land runs on to the
// horizon; terraced hills (stepped layers, each a shade lighter) with little
// LEGO trees on top; beyond them a ring of stepped grey mountains with white
// snow caps (deeper in winter); and a round LEGO sun in the sky. All plain
// shapes: from this far off they read as bricks without costing any.
function Scenery({ color, season, sunAt }: { color: string; season: Season; sunAt?: THREE.Vector3 }) {
  const { hills, peaks, trees } = useMemo(() => {
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const far = (TOWN_HALF + 48) * 20 * LDU + 90; // well beyond the forest
    const hills: { p: [number, number, number]; r: number; turn: number; layers: number }[] = [];
    for (let a = 0; a < Math.PI * 2; a += 0.28 + rnd() * 0.2) {
      const d = far + rnd() * 60;
      hills.push({ p: [Math.cos(a) * d, 0, Math.sin(a) * d], r: 40 + rnd() * 40, turn: rnd() * Math.PI, layers: 3 + Math.floor(rnd() * 3) });
    }
    const trees: [number, number, number, number][] = []; // x, y, z, size
    for (const h of hills)
      for (let k = 0; k < 3; k++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * h.r * 0.45;
        trees.push([h.p[0] + Math.cos(a) * d, h.r * 0.07 * h.layers, h.p[2] + Math.sin(a) * d, 5 + rnd() * 4]);
      }
    const peaks: { p: [number, number, number]; w: number; steps: number; turn: number }[] = [];
    for (let a = 0.1; a < Math.PI * 2; a += 0.38 + rnd() * 0.25) {
      const d = far + 150 + rnd() * 60;
      peaks.push({ p: [Math.cos(a) * d, 0, Math.sin(a) * d], w: 70 + rnd() * 60, steps: 7 + Math.floor(rnd() * 4), turn: rnd() * Math.PI });
    }
    return { hills, peaks, trees };
  }, []);
  // each terrace a shade lighter than the one below: the steps read even far off
  const shades = useMemo(() => [0.86, 0.93, 1, 1.07, 1.14].map((k) => new THREE.Color(color).multiplyScalar(k)), [color]);
  const snowLine = season === "winter" ? 0.45 : 0.72; // share of a mountain's steps below the snow
  const treeMesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = treeMesh.current;
    if (!m) return;
    const o = new THREE.Object3D();
    trees.forEach(([x, y, z, sz], i) => {
      o.position.set(x, y + sz * 0.9, z);
      o.scale.set(sz, sz * 1.8, sz);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [trees]);
  return (
    <>
      {/* the land goes on to the horizon */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
        <circleGeometry args={[900, 64]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {hills.map((h, i) => (
        <group key={i} position={h.p} rotation={[0, h.turn, 0]}>
          {Array.from({ length: h.layers }, (_, k) => {
            const w = h.r * 2 * (1 - k / (h.layers + 0.6));
            const t = h.r * 0.07;
            return (
              <mesh key={k} position={[(k % 2) * h.r * 0.08, t * (k + 0.5), -(k % 3) * h.r * 0.05]}>
                <boxGeometry args={[w, t, w * 0.8]} />
                <meshStandardMaterial color={shades[k]} roughness={0.55} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* the forest belt round the town: cone pines and ball-topped leafy trees on brown trunks */}
      <ForestBelt season={season} />
      {/* LEGO pine trees on the hilltops (a plain cone reads as the 3471 from here) */}
      <instancedMesh ref={treeMesh} args={[undefined, undefined, trees.length]}>
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color={season === "winter" ? "#e9eef3" : "#237841"} roughness={0.5} />
      </instancedMesh>
      {peaks.map((pk, i) => (
        <group key={`p${i}`} position={pk.p} rotation={[0, pk.turn, 0]}>
          {Array.from({ length: pk.steps }, (_, k) => {
            const w = pk.w * (1 - k / pk.steps);
            const t = pk.w * 0.11;
            const snow = k >= pk.steps * snowLine;
            return (
              <mesh key={k} position={[0, t * (k + 0.5), 0]}>
                <boxGeometry args={[w, t, w * 0.85]} />
                <meshStandardMaterial color={snow ? "#f4f6f8" : k % 2 ? "#a0a5a9" : "#8c9196"} roughness={0.6} />
              </mesh>
            );
          })}
        </group>
      ))}
      {/* the sun: a round yellow plate, bright enough to glow */}
      {sunAt && (
        <mesh position={sunAt}>
          <sphereGeometry args={[20, 24, 16]} />
          <meshBasicMaterial color="#fff3b0" toneMapped={false} fog={false} />
        </mesh>
      )}
    </>
  );
}

// Your room: a station for each mission. Tap one to do it -- it pays out
// (+XP floats up) and stays lit for the day.
export function LegoRoom({
  stations,
  onTap,
  chest = null,
  gold = null,
  onCollect,
  owned = [],
  onLeave,
  look = BASE_HUNTER,
  level,
  character,
  name,
  className,
}: {
  stations: Station[];
  /** do the mission; resolves with the XP it paid */
  onTap: (id: string) => Promise<number | null>;
  /** XP waiting in the chest (null: no chest yet) */
  chest?: number | null;
  /** your gold (null: no gold yet) */
  gold?: number | null;
  /** open the chest; resolves with the XP it paid */
  onCollect?: () => Promise<number | null>;
  /** furniture you've bought at the shop (DECOR ids) */
  owned?: string[];
  onLeave?: () => void;
  look?: MinifigLook;
  /** your level: you wear your character's loadout for it (instead of `look`) */
  level?: number;
  /** your character (archetype key); none: the Warrior */
  character?: string | null;
  /** your name, for the player card */
  name?: string;
  className?: string;
}) {
  // roomText only reads each station's id and pillar (and what you own), so doing one doesn't rebuild the room
  const room = useModel(roomText(stations, owned), true);
  const [busy, setBusy] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ id: string; xp: number } | null>(null);
  // aimed a little low and framed tight, so the room fills the screen (not the wall-sky above it)
  const target = useMemo(() => new THREE.Vector3(0, 5.5, 3), []);

  const tap = async (st: Station) => {
    if (st.done || busy) return;
    sfx.click();
    setBusy(st.id);
    const xp = await onTap(st.id);
    setBusy(null);
    if (xp === null) return;
    setPaid({ id: st.id, xp });
    setTimeout(() => setPaid(null), 1100);
  };
  const open = async () => {
    if (!onCollect || busy) return;
    setBusy("chest");
    const xp = await onCollect();
    setBusy(null);
    if (!xp) return;
    setPaid({ id: "chest", xp });
    setTimeout(() => setPaid(null), 1400);
  };
  // missions pay gold too once gold exists
  const payout = (xp: number) => (gold === null ? `+${xp} XP` : `+${xp} XP · +${xp} gold`);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Stage
        className="absolute inset-0"
        label="Your room"
        target={target}
        width={30}
        dir={ROOM_VIEW}
        fov={58}
        sky="#f4e9d6"
        pan
        bounds={ROOM_BOUNDS}
        pins={stations
          .slice(0, MAX_STATIONS)
          .map((st, i) => {
            const [x, z] = stationSpot(i);
            return {
              key: st.id,
              at: [x * LDU, 9, -z * LDU] as [number, number, number],
              node: (
                <button
                  onClick={() => tap(st)}
                  disabled={busy === st.id}
                  className={`lego lego-sm flex-col !gap-0 max-w-[76px] ${st.done ? "lego-green" : ""}`}
                >
                  <span className="text-[11px] font-bold">{st.done ? "✓" : `+${st.xp}`}</span>
                  <span className="w-full truncate text-center text-[9px] font-semibold opacity-90">{st.title}</span>
                  {paid?.id === st.id && <BrickBurst />}
                  {paid?.id === st.id && (
                    <span
                      className="xp-float absolute left-1/2 -top-5 w-40 -ml-20 text-center font-mono font-bold text-sm"
                      style={{ color: "#e8650c", textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 1px 0 #fff" }}
                    >
                      {payout(paid.xp)}
                    </span>
                  )}
                </button>
              ),
            };
          })
          .concat(
            chest === null
              ? []
              : [
                  {
                    key: "chest",
                    at: [CHEST_SPOT[0] * LDU, 5, -CHEST_SPOT[1] * LDU] as [number, number, number],
                    node: (
                      <button onClick={open} disabled={!chest || busy === "chest"} className={`lego lego-sm ${chest ? "lego-yellow" : "lego-dark"}`}>
                        {chest ? `Collect +${chest}` : "Chest empty"}
                        {paid?.id === "chest" && <BrickBurst />}
                        {paid?.id === "chest" && (
                          <span
                            className="xp-float absolute left-1/2 -top-6 w-44 -ml-22 text-center font-mono font-bold text-sm"
                            style={{ color: "#e8650c", textShadow: "0 0 3px #fff, 0 0 3px #fff, 0 1px 0 #fff" }}
                          >
                            {payout(paid.xp)}
                          </span>
                        )}
                      </button>
                    ),
                  },
                ],
          )}
      >
        {room && <primitive object={room} />}
        <Minifig look={level ? loadoutFor(level, character ?? undefined) : look} at={[0, -16, 60]} />
      </Stage>
      {stations.length === 0 && (
        <p className="absolute inset-x-0 top-4 text-center text-sm font-semibold" style={{ color: "#3a3a3a" }}>
          No missions yet. Add some and their stations appear here.
        </p>
      )}
      {/* the same HUD as in the town: you top left, what's left to do top right, the way out bottom right */}
      <div className="absolute top-2 left-3 pointer-events-none">
        <div className="lego-hud">
          <HeadIcon />
          <div className="flex flex-col gap-0.5 min-w-0">
            {name && <span className="text-[13px] font-extrabold leading-tight truncate max-w-[110px]">{name}</span>}
            <div className="flex items-center gap-1">
              {level !== undefined && <span className="lego-chip level">Lv {level}</span>}
              {gold !== null && (
                <span className="lego-chip gold">
                  <span className="stud-icon" />
                  {gold.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute top-3 right-3">
        <SoundToggle />
      </div>
      {stations.length > 0 && (
        <div className="absolute top-3 right-20 pointer-events-none">
          {stations.every((st) => st.done) ? (
            <span className="lego lego-sm lego-green">All done today ✓</span>
          ) : (
            <span className="lego lego-sm lego-white">{stations.filter((st) => !st.done).length} to do</span>
          )}
        </div>
      )}
      {onLeave && (
        <div className="absolute bottom-3 right-3">
          <RoundAction icon="out" text="Step outside" onClick={onLeave} />
        </div>
      )}
    </div>
  );
}
