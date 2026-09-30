"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawUtils } from "three/examples/jsm/utils/LDrawUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  BASE_HUNTER,
  MINIFIG_PARTS,
  PLOT,
  baseplate,
  buildGarden,
  buildMinifig,
  houseAt,
  houseFor,
  houseUrl,
  houseSpec,
  minifigSpot,
  modelText,
  plotX,
  roomText,
  stationSpot,
  townBounds,
  townText,
  MAX_STATIONS,
  type Station,
  type MinifigLook,
  type Resident,
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
    // merged models are the ground (plots, gardens, streets): no smoothing
    getLoader(!merge)
      .then(({ loader, parts }) => parse(loader, text + parts))
      .then((g) => {
        if (!live) return;
        setGroup(finish(merge ? LDrawUtils.mergeObject(g) : g));
      })
      .catch((e) => console.error("brick world:", e));
    return () => {
      live = false;
    };
  }, [text, merge]);
  return group;
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

// A house on its plot, `dx` LDU along the street.
// `cut`: a height (three's y) above which the house is clipped away -- the
// roof comes off and you look down into the rooms, dollhouse style.
function House({ level, dx = 0, cut }: { level: number; dx?: number; cut?: number }) {
  const url = houseUrl(houseFor(level));
  const [model, setModel] = useState<{
    url: string;
    obj: THREE.Object3D;
  } | null>(null);
  useEffect(() => {
    let live = true;
    loadHouse(url)
      .then((o) => {
        const obj = o.clone();
        // its own materials, so cutting this house leaves the others whole
        obj.traverse((m) => {
          const mesh = m as THREE.Mesh;
          if (mesh.isMesh) mesh.material = (mesh.material as THREE.Material).clone();
        });
        if (live) setModel({ url, obj });
      })
      .catch((e) => console.error("house:", e));
    return () => {
      live = false;
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
  if (!model || model.url !== url) return null;
  const [x, y, z] = houseAt(houseSpec(level));
  return <primitive object={model.obj} position={[x + dx, y, z]} />;
}

function Minifig({ look, at }: { look: MinifigLook; at: [number, number, number] }) {
  const model = useModel(
    useMemo(() => modelText(buildMinifig(look), "minifig.ldr"), [look]),
    false,
  );
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
    root.current.rotation.y = Math.sin(t * 0.3) * 0.25;
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

function FitCamera({ target, width, dir = FRONT_RIGHT }: { target: THREE.Vector3; width: number; dir?: THREE.Vector3 }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const dist = width / 2 / Math.tan(Math.min(hfov, vfov) / 2);
    // by default from the front-right, looking down at the house (the front faces three's -Z)
    cam.position.copy(target).addScaledVector(dir, dist);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, size, target, width, dir]);
  return null;
}

export default function LegoWorld({
  houseLevel = 1,
  streak = 0,
  look = BASE_HUNTER,
  className,
}: {
  houseLevel?: number;
  streak?: number;
  look?: MinifigLook;
  className?: string;
}) {
  const spec = houseSpec(houseLevel);
  const worldText = useMemo(
    () => modelText([baseplate(), ...buildGarden(streak, houseSpec(houseLevel))], "plot.ldr"),
    [houseLevel, streak],
  );
  const world = useModel(worldText, true);
  const at = minifigSpot(spec);
  // the house centre in three's space: x as is, LDraw z flipped by the container's half-turn
  const target = useMemo(() => {
    const cx = (spec.x0 + spec.w / 2 - PLOT / 2) * 20 * LDU;
    const cz = (spec.z0 + spec.d / 2 - PLOT / 2) * 20 * LDU;
    return new THREE.Vector3(cx, 3, -cz - 3);
  }, [spec.x0, spec.w, spec.z0, spec.d]);

  return (
    <Stage className={className} label="Your house and garden" target={target} width={Math.max(34, spec.w + 14)}>
      {world && <primitive object={world} />}
      <House level={houseLevel} />
      <Minifig look={look} at={at} />
    </Stage>
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
          dpr={[1, 2]}
          camera={{ fov, near: 1, far: 500 }}
          gl={{ antialias: true }}
          onCreated={({ gl }) => (gl.localClippingEnabled = true)}
        >
          <color attach="background" args={[sky]} />
          <fog attach="fog" args={[sky, 140, 330]} />
          <hemisphereLight args={["#fff8ef", "#5a7a4a", 0.9]} />
          <primitive object={sun} position={[target.x, 0, target.z]} />
          <directionalLight
            target={sun}
            position={[target.x + 18, 30, target.z - 14]}
            intensity={2.3}
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
            <Lightformer intensity={2} position={[0, 10, 10]} scale={[20, 8, 1]} />
            <Lightformer intensity={1} position={[-10, 4, -6]} scale={[8, 8, 1]} />
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
          <FitCamera target={target} width={width} dir={dir} />
          <OrbitControls
            ref={controls}
            onChange={clamp}
            target={target}
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
            maxDistance={110}
            minPolarAngle={0.45}
            maxPolarAngle={1.25}
          />
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

// Your town: you and your friends, one plot each along a street, you in the
// middle, fenced at the back and ringed by forest. Drag to walk along it; tap a
// house to go to it. Knock on a friend's door; once they let you in (or it's
// your own house) you can go inside: the roof comes off and you walk in.
export type Visit = "allowed" | "knocked";
export function LegoTown({
  residents,
  visits = {},
  onKnock,
  room,
  className,
}: {
  residents: Resident[];
  /** by friend's name: they let you in, or you knocked and they haven't answered */
  visits?: Record<string, Visit>;
  onKnock?: (name: string) => void;
  /** your own house's inside (your room); without it you get the roof-off view */
  room?: (leave: () => void) => React.ReactNode;
  className?: string;
}) {
  const town = useModel(
    useMemo(() => townText(residents), [residents]),
    true,
  );
  const count = residents.length;
  const meIndex = Math.max(
    0,
    residents.findIndex((r) => r.me),
  );
  const [focus, setFocus] = useState(meIndex);
  const [inside, setInside] = useState<number | null>(null);
  const plotW = PLOT * 20 * LDU;

  // a house's centre on the ground, in LDU relative to its plot
  const centre = (level: number) => {
    const s = houseSpec(level);
    return [(s.x0 + s.w / 2 - PLOT / 2) * 20, (s.z0 + s.d / 2 - PLOT / 2) * 20] as const;
  };
  const target = useMemo(() => {
    if (inside === null) return new THREE.Vector3(plotX(focus, count) * LDU, 3, 0);
    const [cx, cz] = centre(residents[inside].level);
    return new THREE.Vector3((plotX(inside, count) + cx) * LDU, 2, -cz * LDU);
  }, [focus, inside, count, residents]);
  const bounds = useMemo(() => {
    const b = townBounds(count);
    return new THREE.Box3(new THREE.Vector3(b.x0 * LDU, 0, -b.zFront * LDU), new THREE.Vector3(b.x1 * LDU, 12, -b.zBack * LDU));
  }, [count]);

  const r = residents[focus];
  const access = r.me ? "allowed" : visits[r.name];
  const go = (i: number) => {
    setFocus(i);
    setInside(null);
  };

  if (room && inside === meIndex) return <div className={className}>{room(() => setInside(null))}</div>;

  return (
    <div className={`relative ${className ?? ""}`}>
      <Stage
        className="absolute inset-0"
        label="Your town"
        target={target}
        width={inside === null ? 62 : houseFor(residents[inside].level).w + 10}
        dir={inside === null ? undefined : LOOK_IN}
        bounds={bounds}
        pan
        onPick={(p) => go(Math.min(count - 1, Math.max(0, Math.round(p.x / plotW + (count - 1) / 2))))}
        overlay={<Hills count={count} />}
        pins={residents.flatMap((res, i) => {
          if (i === inside) return [];
          const [cx, cz] = centre(res.level);
          const at: [number, number, number] = [(plotX(i, count) + cx) * LDU, houseFor(res.level).h * LDU + 3, -cz * LDU];
          return [
            {
              key: res.name,
              at,
              node: (
                <button
                  onClick={() => go(i)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={{ background: res.me ? "#ff8a1f" : "rgba(20,18,16,0.8)", color: "#fff" }}
                >
                  {res.me ? "You" : res.name}
                </button>
              ),
            },
          ];
        })}
      >
        {town && <primitive object={town} />}
        {residents.map((res, i) => (
          <House key={res.name} level={res.level} dx={plotX(i, count)} cut={i === inside ? CUT : undefined} />
        ))}
        {residents.map((res, i) => {
          // you walk into the house you're visiting; everyone else stays at their door
          if (i === meIndex && inside !== null) {
            const [cx, cz] = centre(residents[inside].level);
            return <Minifig key={res.name} look={BASE_HUNTER} at={[plotX(inside, count) + cx, -16, cz + 40]} />;
          }
          const [x, y, z] = minifigSpot(houseSpec(res.level));
          return <Minifig key={res.name} look={BASE_HUNTER} at={[x + plotX(i, count), y, z]} />;
        })}
      </Stage>

      {/* the camera looks along the street from its right, so the house on screen-left is the next one up */}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 px-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {focus + 1 < count && (
            <TownButton
              quiet
              onClick={() => go(focus + 1)}
              label={`Walk to ${residents[focus + 1].me ? "your house" : residents[focus + 1].name}`}
            >
              ‹
            </TownButton>
          )}
          {inside !== null ? (
            <TownButton onClick={() => setInside(null)}>Step outside</TownButton>
          ) : access === "allowed" ? (
            <TownButton onClick={() => setInside(focus)}>{r.me ? "Go inside" : `Go inside ${r.name}'s house`}</TownButton>
          ) : access === "knocked" ? (
            <TownButton disabled>Knocked. Waiting for {r.name}…</TownButton>
          ) : onKnock ? (
            <TownButton onClick={() => onKnock(r.name)}>Knock on {r.name}&apos;s door</TownButton>
          ) : null}
          {focus > 0 && (
            <TownButton
              quiet
              onClick={() => go(focus - 1)}
              label={`Walk to ${residents[focus - 1].me ? "your house" : residents[focus - 1].name}`}
            >
              ›
            </TownButton>
          )}
        </div>
      </div>
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
      className={`${quiet ? "w-10 h-10 text-xl" : "px-4 py-2.5 text-sm"} rounded-full font-semibold shadow-lg active:scale-95 transition-transform disabled:opacity-80`}
      style={{ background: disabled || quiet ? "rgba(20,18,16,0.8)" : "#ff8a1f", color: "#fff" }}
    >
      {children}
    </button>
  );
}

// Soft green hills beyond the forest, fading into the haze: the land goes on,
// you just can't get there.
function Hills({ count }: { count: number }) {
  const hills = useMemo(() => {
    const b = townBounds(count);
    const out: { p: [number, number, number]; r: number }[] = [];
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const back = -b.zBack * LDU + 100;
    for (let x = b.x0 * LDU - 140; x < b.x1 * LDU + 140; x += 45 + rnd() * 30)
      out.push({ p: [x, 0, back + rnd() * 50], r: 45 + rnd() * 45 });
    for (const side of [-1, 1]) {
      const x = side < 0 ? b.x0 * LDU - 110 : b.x1 * LDU + 110;
      for (let z = -90; z < back; z += 50) out.push({ p: [x + side * rnd() * 40, 0, z], r: 45 + rnd() * 35 });
    }
    return out;
  }, [count]);
  return (
    <>
      {hills.map((h, i) => (
        <mesh key={i} position={h.p} scale={[h.r, h.r * 0.26, h.r]}>
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
  onLeave,
  look = BASE_HUNTER,
  className,
}: {
  stations: Station[];
  /** do the mission; resolves with the XP it paid */
  onTap: (id: string) => Promise<number | null>;
  onLeave?: () => void;
  look?: MinifigLook;
  className?: string;
}) {
  // roomText only reads each station's id and pillar, so doing one doesn't rebuild the room
  const room = useModel(roomText(stations), true);
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
        pins={stations.slice(0, MAX_STATIONS).map((st, i) => {
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
                    className="xp-float absolute inset-x-0 -top-5 text-center font-mono font-bold text-sm"
                    style={{ color: "#ffb347" }}
                  >
                    +{paid.xp} XP
                  </span>
                )}
              </button>
            ),
          };
        })}
      >
        {room && <primitive object={room} />}
        <Minifig look={look} at={[0, -16, 60]} />
      </Stage>
      {stations.length === 0 && (
        <p className="absolute inset-x-0 top-4 text-center text-sm font-semibold" style={{ color: "#3a3a3a" }}>
          No missions yet. Add some and their stations appear here.
        </p>
      )}
      {onLeave && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <TownButton onClick={onLeave}>Step outside</TownButton>
        </div>
      )}
    </div>
  );
}
