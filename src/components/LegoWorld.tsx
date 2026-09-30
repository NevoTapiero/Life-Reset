"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawUtils } from "three/examples/jsm/utils/LDrawUtils.js";
import VEHICLES from "@/lib/legoVehicles.json";
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
  buildMinifig,
  houseAt,
  houseFor,
  houseUrl,
  houseById,
  houseSpec,
  minifigSpot,
  modelText,
  CHEST_SPOT,
  DECOR,
  roomText,
  stationSpot,
  TOWN_HALF,
  MAX_RESIDENTS,
  SHOP_BUILDING,
  lotFor,
  inLot,
  townText,
  plazaText,
  townDecorText,
  townFlats,
  townClouds,
  type Slab,
  emptyLotsText,
  PLAZA_LAMPS,
  STREET_LAMP_LIGHTS,
  SHOP_FRONT,
  FOUNTAIN,
  MAX_STATIONS,
  type Station,
  type MinifigLook,
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

// Each minifig look is parsed once; every figure wearing it is a clone
// (sharing its geometry and materials).
const minifigs = new Map<string, Promise<THREE.Object3D>>();
function loadMinifig(look: MinifigLook) {
  const key = `${look.skin}/${look.hair}/${look.torso}/${look.legs}`;
  let p = minifigs.get(key);
  if (!p)
    minifigs.set(
      key,
      (p = getLoader(true)
        .then(({ loader, parts }) => parse(loader, modelText(buildMinifig(look), "minifig.ldr") + parts))
        .then(finish)),
    );
  return p;
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
  if (!p) houses.set(url, (p = gltf.loadAsync(url).then((g) => finish(g.scene))));
  return p;
}

// A baked building placed at `at` (LDU). `cut`: a height (three's y) above
// which it is clipped away -- the roof comes off and you look down into the
// rooms, dollhouse style.
// `lit`: after dark the window glass glows warm -- somebody's home.
function Building({ url, at, cut, lit = false }: { url: string; at: [number, number, number]; cut?: number; lit?: boolean }) {
  const [model, setModel] = useState<{
    url: string;
    obj: THREE.Object3D;
  } | null>(null);
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
        setModel({ url, obj });
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
    const planes = cut === undefined ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), cut)];
    model.obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.Material;
      m.clippingPlanes = planes;
      m.clipShadows = true;
      m.needsUpdate = true;
    });
  }, [model, cut]);
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
  return <primitive object={model.obj} position={at} />;
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
function House({ level, name, id, cut, lit }: { level: number; name?: string; id?: string; cut?: number; lit?: boolean }) {
  const house = (id && houseById(id)) || houseFor(level, name);
  return <Building url={houseUrl(house)} at={houseAt(houseSpec(level), house)} cut={cut} lit={lit} />;
}

// `turn`: which way the figure faces (radians about the vertical, LDraw frame)
function Minifig({ look, at, turn = 0 }: { look: MinifigLook; at: [number, number, number]; turn?: number }) {
  const [model, setModel] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let live = true;
    loadMinifig(look)
      .then((o) => live && setModel(o.clone()))
      .catch((e) => console.error("minifig:", e));
    return () => {
      live = false;
    };
  }, [look]);
  const root = useRef<THREE.Group>(null);
  const taps = useRef(0); // bumped by a tap
  const seen = useRef(0);
  const hopAt = useRef(-10); // frame-clock time the current hop started
  const base = useRef<THREE.Quaternion[]>([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!model || !root.current) return;
    // the head and hair turn together, glancing around
    const head = model.children[MINIFIG_PARTS.indexOf("head")];
    const hair = model.children[MINIFIG_PARTS.indexOf("hair")];
    if (head && hair) {
      if (!base.current.length) base.current = [head.quaternion.clone(), hair.quaternion.clone()];
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 0.5) * 0.45);
      head.quaternion.copy(base.current[0]).premultiply(yaw);
      hair.quaternion.copy(base.current[1]).premultiply(yaw);
    }
    // a hop when tapped (LDraw is -Y up)
    if (taps.current !== seen.current) {
      seen.current = taps.current;
      hopAt.current = t;
    }
    const h = t - hopAt.current;
    root.current.position.y = at[1] - (h < 0.45 ? Math.sin((h / 0.45) * Math.PI) * 14 : 0);
    root.current.rotation.y = turn + Math.sin(t * 0.3) * 0.25;
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
}: {
  target: THREE.Vector3;
  width: number;
  dir?: THREE.Vector3;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, size } = useThree();
  const flight = useRef<{ from: THREE.Vector3; fromAim: THREE.Vector3; to: THREE.Vector3; toAim: THREE.Vector3; t: number } | null>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const dist = width / 2 / Math.tan(Math.min(hfov, vfov) / 2);
    // by default from the front-right, looking down at the house (the front faces three's -Z)
    const to = target.clone().addScaledVector(dir, dist);
    const c = controls.current;
    if (!placed.current || !c) {
      cam.position.copy(to);
      cam.lookAt(target);
      c?.target.copy(target);
      c?.update();
      placed.current = !!c;
      return;
    }
    flight.current = { from: cam.position.clone(), fromAim: c.target.clone(), to, toAim: target.clone(), t: 0 };
  }, [camera, size, target, width, dir, controls]);
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

export default function LegoWorld({
  houseLevel = 1,
  name,
  house,
  spin = 0,
  streak = 0,
  look = BASE_HUNTER,
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
      <Minifig look={look} at={at} />
    </Stage>
  );
}

// ---- time of day ----
// The town follows your real clock: blue day, golden sunrise and sunset, a
// dusk when the lamps come on, and night with stars and moonlight.
// ponytail: four fixed moods; blend between them if the switch ever jars
export type Mood = { name: string; top: string; horizon: string; sun: number; sunColor: string; ambient: number; night: boolean };
const MOODS: Record<string, Mood> = {
  day: { name: "day", top: "#4f9be6", horizon: "#cfe8ff", sun: 2.3, sunColor: "#fff4e2", ambient: 0.9, night: false },
  golden: { name: "golden", top: "#6f8fd0", horizon: "#ffcf96", sun: 1.7, sunColor: "#ffb070", ambient: 0.7, night: false },
  dusk: { name: "dusk", top: "#26356a", horizon: "#e58a6c", sun: 0.7, sunColor: "#ff9a6a", ambient: 0.45, night: true },
  night: { name: "night", top: "#070d26", horizon: "#1d2a52", sun: 0.35, sunColor: "#9fb4ff", ambient: 0.28, night: true },
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

export type Pin = { key: string; at: [number, number, number]; node: React.ReactNode };

// Moves each pinned button to its point's place on screen, every frame.
// (drei's Html gives each label its own React root, and under React 19 the
// first one is dropped; plain DOM moved by hand has no such trouble.)
function PinTracker({ pins, els }: { pins: Pin[]; els: React.RefObject<Map<string, HTMLDivElement>> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const p of pins) {
      const el = els.current.get(p.key);
      if (!el) continue;
      v.set(...p.at).project(camera);
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
  children: React.ReactNode;
}) {
  const [sun] = useState(() => new THREE.Object3D());
  const controls = useRef<OrbitControlsImpl>(null);
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
          dpr={[1, 1.5]}
          camera={{ fov, near: 1, far: far }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => (gl.localClippingEnabled = true)}
        >
          <color attach="background" args={[mood?.horizon ?? sky]} />
          {/* the haze scales with how much is in view: a house, the shop, or the whole town */}
          <fog attach="fog" args={[mood?.horizon ?? sky, Math.max(140, width * 2.3), Math.max(330, width * 5.3)]} />
          {mood && <SkyDome mood={mood} />}
          <hemisphereLight args={["#fff8ef", "#5a7a4a", mood?.ambient ?? 0.9]} />
          <primitive object={sun} position={[target.x, 0, target.z]} />
          <directionalLight
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
          <Environment resolution={256}>
            <Lightformer intensity={2 * (mood?.ambient ?? 1)} position={[0, 10, 10]} scale={[20, 8, 1]} />
            <Lightformer intensity={1 * (mood?.ambient ?? 1)} position={[-10, 4, -6]} scale={[8, 8, 1]} />
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
          <FitCamera target={target} width={width} dir={dir} controls={controls} />
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
  className?: string;
}) {
  const residents = all.slice(0, MAX_RESIDENTS);
  const [hour, setHour] = useState(() => new Date().getHours() + new Date().getMinutes() / 60);
  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours() + new Date().getMinutes() / 60), 60_000);
    return () => clearInterval(t);
  }, []);
  const mood = time ? moodNamed(time) : moodAt(hour);
  const town = useModel(
    useMemo(() => townText(residents), [residents]),
    true,
  );
  const plaza = useModel(useMemo(() => plazaText(), []), true);
  const decor = useModel(useMemo(() => townDecorText(), []), true);
  // plots nobody lives on yet are little parks
  const parks = useModel(useMemo(() => emptyLotsText(residents.length), [residents.length]), true);
  const emptyLots = useMemo(() => Array.from({ length: MAX_RESIDENTS - residents.length }, (_, k) => lotFor(residents.length + k)), [residents.length]);
  const lots = useMemo(() => residents.map((_, i) => lotFor(i)), [residents]);
  const meIndex = Math.max(
    0,
    residents.findIndex((r) => r.me),
  );
  // the town opens on the whole square, then (once it's built) glides down to your house
  const [focus, setFocus] = useState(OVERVIEW);
  const built = !!town;
  useEffect(() => {
    if (!built) return;
    const t = setTimeout(() => setFocus((f) => (f === OVERVIEW ? meIndex : f)), 1800);
    return () => clearTimeout(t);
  }, [built, meIndex]);
  const [inside, setInside] = useState<number | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // a house's centre on the ground, in its lot's frame (LDU)
  const centre = (level: number): [number, number, number] => {
    const s = houseSpec(level);
    return [(s.x0 + s.w / 2 - PLOT / 2) * 20, 0, (s.z0 + s.d / 2 - PLOT / 2) * 20];
  };
  const houseCentre = (i: number) => inLot(lots[i], centre(residents[i].level));

  const target = useMemo(() => {
    // the shop and the fountain in front of it, looking up at the building
    if (focus === OVERVIEW) return new THREE.Vector3(0, 0, 0);
    if (focus === SHOP_FOCUS) return new THREE.Vector3(0, 10, -((SHOP_FRONT + FOUNTAIN[1]) / 2) * LDU);
    const [x, , z] = toThree(houseCentre(focus));
    return new THREE.Vector3(x, inside === null ? 3 : 2, z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, inside, lots]);
  // look at a house from its front: turn the view with the lot
  const dir = useMemo(() => {
    const base = inside === null ? FRONT_RIGHT : LOOK_IN;
    if (focus === OVERVIEW) return LOOK_DOWN;
    if (focus === SHOP_FOCUS) return base;
    return base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -turnRad(lots[focus].facing));
  }, [focus, inside, lots]);
  const bounds = useMemo(() => {
    const h = (TOWN_HALF - 8) * 20 * LDU;
    return new THREE.Box3(new THREE.Vector3(-h, 0, -h), new THREE.Vector3(h, 12, h));
  }, []);

  const go = (i: number) => {
    setFocus(i);
    setInside(null);
  };
  // the stops along the way, for the arrows: the shop, then every house
  const stops = [SHOP_FOCUS, ...residents.map((_, i) => i)];
  const step = (by: number) => go(stops[(stops.indexOf(focus) + by + stops.length) % stops.length]);
  const nameOf = (i: number) =>
    i === SHOP_FOCUS ? "the shop" : i === OVERVIEW ? "the whole town" : residents[i].me ? "your house" : residents[i].name;

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

  if (room && inside === meIndex) return <div className={className}>{room(() => setInside(null))}</div>;

  const r = focus < 0 ? null : residents[focus]; // the shop and the overview are nobody's house
  const access = r && (r.me ? "allowed" : visits[r.name]);
  const label = (text: string, me: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: me ? "#ff8a1f" : "rgba(20,18,16,0.8)", color: "#fff" }}
    >
      {text}
    </button>
  );

  return (
    <div className={`relative ${className ?? ""}`}>
      <Stage
        className="absolute inset-0"
        label="Your town"
        target={target}
        width={
          inside !== null
            ? houseFor(residents[inside].level, residents[inside].name).w + 10
            : focus === OVERVIEW
              ? 230
              : focus === SHOP_FOCUS
                ? 95
                : 62
        }
        far={1500}
        maxDistance={600}
        dir={dir}
        bounds={bounds}
        pan
        mood={mood}
        onPick={pick}
        overlay={
          <>
            <Hills />
            {/* the ground: grass everywhere, the smooth grey street square, the plaza and each plot */}
            <StudGround at={[0, 0]} size={Math.round(TOWN_HALF * 4)} color="#4b9b3c" y={-0.03} />
            <StudGround at={[0, 0]} size={TOWN_HALF * 2} color="#5d6166" y={-0.015} flat />
            <StudGround at={[0, 0]} size={PLOT} color="#a3a7ad" />
            {[...lots, ...emptyLots].map((lot, i) => (
              <StudGround key={i} at={[lot.x * LDU, -lot.z * LDU]} size={PLOT} color="#4b9b3c" />
            ))}
          </>
        }
        pins={[
          {
            key: "shop",
            at: [0, SHOP_BUILDING.h * LDU + 3, -(SHOP_FRONT - (SHOP_BUILDING.d / 2) * 20) * LDU] as [number, number, number],
            node: label("Shop", false, () => go(SHOP_FOCUS)),
          },
          ...emptyLots.map((lot, k) => ({
            key: `empty-${k}`,
            at: [lot.x * LDU, 6, -lot.z * LDU] as [number, number, number],
            node: (
              <button
                onClick={onInvite}
                disabled={!onInvite}
                className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                style={{ background: "rgba(255,255,255,0.85)", color: "#2a5a1f" }}
              >
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
        <InstancedParts placements={townInstances(residents)} />
        {/* the shop, its front to the camera's side of the plaza */}
        {/* the shop at the back of the plaza, the fountain and the rest of the square in front of it */}
        <Building url={houseUrl(SHOP_BUILDING)} at={[(-SHOP_BUILDING.w / 2) * 20, 0, SHOP_FRONT]} lit={mood.night} />
        {plaza && <primitive object={plaza} />}
        {decor && <primitive object={decor} />}
        <Slabs slabs={FLATS} />
        <Slabs slabs={CLOUDS} shadows={false} />
        {parks && <primitive object={parks} />}
        <Traffic night={mood.night} />
        <Seagulls />
        <FountainSpray />
        <TownSign name={residents[meIndex]?.name ?? "Your"} />
        {mood.night && <LampGlows at={[...PLAZA_LAMPS, ...STREET_LAMP_LIGHTS]} />}
        {STROLLERS.map((p, i) => (
          <Stroller key={i} {...p} />
        ))}
        {residents.map((res, i) => (
          <group key={res.name} position={[lots[i].x, 0, lots[i].z]} rotation={[0, turnRad(lots[i].facing), 0]}>
            <House level={res.level} name={res.name} cut={i === inside ? CUT : undefined} lit={mood.night} />
          </group>
        ))}
        {residents.map((res, i) => {
          // you walk into the house you're visiting; everyone else stays at their door
          if (i === meIndex && inside !== null) {
            const [x, y, z] = inLot(lots[inside], [
              centre(residents[inside].level)[0],
              -16,
              centre(residents[inside].level)[2] + 40,
            ]);
            return <Minifig key={res.name} look={BASE_HUNTER} at={[x, y, z]} turn={turnRad(lots[inside].facing)} />;
          }
          return (
            <Minifig
              key={res.name}
              look={BASE_HUNTER}
              at={inLot(lots[i], minifigSpot(houseSpec(res.level)))}
              turn={turnRad(lots[i].facing)}
            />
          );
        })}
      </Stage>

      {focus !== OVERVIEW && inside === null && (
        <button
          onClick={() => go(OVERVIEW)}
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg active:scale-95 transition-transform"
          style={{ background: "rgba(20,18,16,0.8)", color: "#fff" }}
        >
          Whole town
        </button>
      )}
      {note && !shopOpen && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
          <span
            className="px-3 py-1.5 rounded-full text-sm font-semibold shadow"
            style={{ background: "rgba(20,18,16,0.85)", color: "#fff" }}
          >
            {note}
          </span>
        </div>
      )}

      {/* the arrows sit at the edges, so they never move when the middle button's text changes */}
      <div className="absolute inset-x-0 bottom-3 flex items-center gap-2 px-3 pointer-events-none">
        <div className="pointer-events-auto flex-none">
          <TownButton
            quiet
            onClick={() => step(-1)}
            label={`Walk to ${nameOf(stops[(stops.indexOf(focus) - 1 + stops.length) % stops.length])}`}
          >
            ‹
          </TownButton>
        </div>
        <div className="flex-1 min-w-0 flex justify-center">
          {focus === OVERVIEW ? null : focus === SHOP_FOCUS ? (
            prices && <TownButton onClick={() => setShopOpen(true)}>Go into the shop</TownButton>
          ) : inside !== null ? (
            <TownButton onClick={() => setInside(null)}>Step outside</TownButton>
          ) : access === "allowed" ? (
            <TownButton onClick={() => setInside(focus)}>{r!.me ? "Go inside" : `Go inside ${r!.name}'s house`}</TownButton>
          ) : access === "knocked" ? (
            <TownButton disabled>Knocked. Waiting for {r!.name}…</TownButton>
          ) : onKnock ? (
            <TownButton onClick={() => onKnock(r!.name)}>Knock on {r!.name}&apos;s door</TownButton>
          ) : null}
        </div>
        <div className="pointer-events-auto flex-none">
          <TownButton quiet onClick={() => step(1)} label={`Walk to ${nameOf(stops[(stops.indexOf(focus) + 1) % stops.length])}`}>
            ›
          </TownButton>
        </div>
      </div>

      {shopOpen && prices && onBuy && (
        <ShopSheet
          gold={gold}
          prices={prices}
          owned={owned}
          onBuy={onBuy}
          onClose={(bought) => {
            setShopOpen(false);
            if (!bought) return;
            setNote(`${bought} is waiting in your house`);
            setTimeout(() => setNote(null), 2500);
          }}
        />
      )}
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

function TownButton({
  children,
  onClick,
  disabled,
  quiet,
  label,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** the dark round arrow buttons */
  quiet?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${quiet ? "w-10 h-10 text-xl" : "px-4 py-2.5 text-sm"} pointer-events-auto rounded-full font-semibold shadow-lg active:scale-95 transition-transform disabled:opacity-80`}
      style={{ background: disabled || quiet ? "rgba(20,18,16,0.8)" : "#ff8a1f", color: "#fff" }}
    >
      {children}
    </button>
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
  /** closed, with the name of what was just bought (if anything) */
  onClose: (bought?: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buy = async (id: string, name: string) => {
    if (busy) return;
    setBusy(id);
    const err = await onBuy(id);
    setBusy(null);
    if (err) return setError(err);
    onClose(name);
  };
  return (
    <div className="absolute inset-0 flex items-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={() => onClose()}>
      <div
        className="w-full max-h-[70%] overflow-y-auto rounded-t-2xl p-4 slide-in"
        style={{ background: "var(--panel, #1b1916)", color: "var(--ink, #fff)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="display text-[17px]">Market Street</span>
          <span className="text-sm font-bold" style={{ color: "#ffd35c" }}>
            {(gold ?? 0).toLocaleString()} gold
          </span>
        </div>
        <p className="text-xs text-muted mb-3">Furniture for your house. It&apos;s there when you get home.</p>
        {error && (
          <p className="text-sm mb-2" style={{ color: "#ff8a7a" }}>
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {DECOR.filter((d) => prices[d.id] !== undefined)
            .sort((a, b) => prices[a.id] - prices[b.id])
            .map((d) => {
              const price = prices[d.id];
              const short = price - (gold ?? 0);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: "var(--line, #333)" }}
                >
                  <span className="font-semibold text-sm">{d.name}</span>
                  {owned.includes(d.id) ? (
                    <span className="text-xs text-muted">In your house</span>
                  ) : short > 0 ? (
                    <span className="text-xs text-muted">
                      {price} gold · need {short} more
                    </span>
                  ) : (
                    <button
                      onClick={() => buy(d.id, d.name)}
                      disabled={busy === d.id}
                      className="px-3 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-transform"
                      style={{
                        background: "linear-gradient(180deg,#ffd35c,#f0a818)",
                        color: "#4a2a00",
                        opacity: busy === d.id ? 0.7 : 1,
                      }}
                    >
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
  // between the fountain's rim (80) and the benches (130): spread round the circle
  { look: { skin: COL.yellow, hair: COL.reddishBrown, torso: COL.red, legs: COL.blue }, r: 106, speed: 0.22, start: 0 },
  { look: { skin: COL.yellow, hair: COL.black, torso: COL.white, legs: COL.darkGrey }, r: 112, speed: 0.22, start: Math.PI },
  { look: { skin: COL.yellow, hair: COL.yellow, torso: COL.green, legs: COL.tan }, r: 104, speed: -0.17, start: Math.PI / 2 },
  { look: { skin: COL.yellow, hair: COL.darkOrange, torso: COL.purple, legs: COL.black }, r: 110, speed: 0.15, start: (3 * Math.PI) / 2 },
];
function Stroller({ look, r, speed, start }: (typeof STROLLERS)[number]) {
  const root = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const a = start + clock.elapsedTime * speed;
    root.current.position.set(FOUNTAIN[0] + Math.cos(a) * r, 0, FOUNTAIN[1] + Math.sin(a) * r);
    // facing along the circle, the way they're walking (a minifig's front is +Z)
    root.current.rotation.y = Math.atan2(-Math.sin(a) * speed, Math.cos(a) * speed);
  });
  return (
    <group ref={root}>
      <Minifig look={look} at={[0, 0, 0]} />
    </group>
  );
}

// ---- seagulls circling over the square ----
const GULLS = [
  { r: 700, y: 520, speed: 0.12, start: 0 },
  { r: 900, y: 640, speed: 0.1, start: 2 },
  { r: 500, y: 460, speed: -0.14, start: 4 },
  { r: 1100, y: 700, speed: 0.08, start: 1 },
  { r: 800, y: 580, speed: -0.1, start: 5 },
];
function Seagulls() {
  const gull = useModel(useMemo(() => modelText(["1 15 0 0 0 1 0 0 0 1 0 0 0 1 12891p01.dat"], "gull.ldr"), []), true);
  const flock = useMemo(() => (gull ? GULLS.map(() => gull.clone()) : []), [gull]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    GULLS.forEach((g, i) => {
      const o = refs.current[i];
      if (!o) return;
      const a = g.start + clock.elapsedTime * g.speed;
      o.position.set(FOUNTAIN[0] + Math.cos(a) * g.r, -g.y - Math.sin(clock.elapsedTime * 1.3 + i) * 20, FOUNTAIN[1] + Math.sin(a) * g.r);
      // beak along the flight: the part's beak points -Z, so face the tangent and turn round
      o.rotation.set(0, Math.atan2(-Math.sin(a) * g.speed, Math.cos(a) * g.speed) + Math.PI, Math.sign(g.speed) * 0.35);
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
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 64);
  // the stud's shadow, then its top, lit from the top left
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.arc(35, 35, 19, 0, Math.PI * 2);
  g.fill();
  const top = g.createRadialGradient(26, 26, 2, 32, 32, 19);
  top.addColorStop(0, "#ffffff");
  top.addColorStop(1, "#dcdcdc");
  g.fillStyle = top;
  g.beginPath();
  g.arc(32, 32, 18, 0, Math.PI * 2);
  g.fill();
  studs = new THREE.CanvasTexture(c);
  studs.colorSpace = THREE.SRGBColorSpace;
  studs.wrapS = studs.wrapT = THREE.RepeatWrapping;
  studs.anisotropy = 8;
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
      <meshStandardMaterial color={color} map={map} roughness={0.8} />
    </mesh>
  );
}

// Soft green hills beyond the forest, fading into the haze: the land goes on,
// you just can't get there.
function Hills() {
  const hills = useMemo(() => {
    const out: { p: [number, number, number]; r: number }[] = [];
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const far = (TOWN_HALF + 48) * 20 * LDU + 90; // well beyond the forest
    for (let a = 0; a < Math.PI * 2; a += 0.28 + rnd() * 0.2) {
      const d = far + rnd() * 60;
      out.push({ p: [Math.cos(a) * d, 0, Math.sin(a) * d], r: 40 + rnd() * 40 });
    }
    return out;
  }, []);
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.p} scale={[h.r, h.r * 0.2, h.r]}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={i % 3 ? "#5f9e46" : "#6aa84f"} roughness={1} />
        </mesh>
      ))}
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
  className?: string;
}) {
  // roomText only reads each station's id and pillar (and what you own), so doing one doesn't rebuild the room
  const room = useModel(roomText(stations, owned), true);
  const [busy, setBusy] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ id: string; xp: number } | null>(null);
  const target = useMemo(() => new THREE.Vector3(0, 3, 3), []);

  const tap = async (st: Station) => {
    if (st.done || busy) return;
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
        width={31}
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
                  className="relative flex flex-col items-center max-w-[70px] px-2 py-0.5 rounded-lg leading-tight shadow-md active:scale-95 transition-transform"
                  style={{
                    background: st.done ? "rgba(40,120,60,0.92)" : "#ff8a1f",
                    color: "#fff",
                    opacity: busy === st.id ? 0.7 : 1,
                  }}
                >
                  <span className="text-[11px] font-bold">{st.done ? "✓" : `+${st.xp}`}</span>
                  <span className="w-full truncate text-center text-[9px] font-medium opacity-90">{st.title}</span>
                  {paid?.id === st.id && (
                    <span
                      className="xp-float absolute left-1/2 -top-5 w-40 -ml-20 text-center font-mono font-bold text-sm"
                      style={{ color: "#ffb347" }}
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
                      <button
                        onClick={open}
                        disabled={!chest || busy === "chest"}
                        className="relative px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-lg active:scale-95 transition-transform"
                        style={
                          chest
                            ? { background: "linear-gradient(180deg,#ffd35c,#f0a818)", color: "#4a2a00" }
                            : { background: "rgba(20,18,16,0.7)", color: "#fff" }
                        }
                      >
                        {chest ? `Collect +${chest}` : "Chest empty"}
                        {paid?.id === "chest" && (
                          <span
                            className="xp-float absolute left-1/2 -top-6 w-44 -ml-22 text-center font-mono font-bold text-sm"
                            style={{ color: "#ffb347" }}
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
        <Minifig look={look} at={[0, -16, 60]} />
      </Stage>
      {stations.length === 0 && (
        <p className="absolute inset-x-0 top-4 text-center text-sm font-semibold" style={{ color: "#3a3a3a" }}>
          No missions yet. Add some and their stations appear here.
        </p>
      )}
      {gold !== null && (
        <div
          className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-sm font-bold shadow"
          style={{ background: "rgba(20,18,16,0.8)", color: "#ffd35c" }}
        >
          {gold.toLocaleString()} gold
        </div>
      )}
      {onLeave && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <TownButton onClick={onLeave}>Step outside</TownButton>
        </div>
      )}
    </div>
  );
}
