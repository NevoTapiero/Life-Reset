"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
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
  townText,
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
function House({ level, dx = 0 }: { level: number; dx?: number }) {
  const url = houseUrl(houseFor(level));
  const [model, setModel] = useState<{
    url: string;
    obj: THREE.Object3D;
  } | null>(null);
  useEffect(() => {
    let live = true;
    loadHouse(url)
      .then((o) => live && setModel({ url, obj: o.clone() }))
      .catch((e) => console.error("house:", e));
    return () => {
      live = false;
    };
  }, [url]);
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

function FitCamera({ target, width }: { target: THREE.Vector3; width: number }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const dist = width / 2 / Math.tan(Math.min(hfov, vfov) / 2);
    // from the front-right, looking down at the house (the front faces three's -Z)
    cam.position.copy(target).addScaledVector(new THREE.Vector3(0.55, 0.65, -0.8).normalize(), dist);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, size, target, width]);
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

// Sky, light and camera around whatever LDraw models are passed in. The light
// and the contact shadow follow the target, so a long town is lit wherever you look.
function Stage({
  className,
  label,
  target,
  width,
  pan = false,
  onPick,
  overlay,
  children,
}: {
  className?: string;
  label: string;
  target: THREE.Vector3;
  width: number;
  pan?: boolean;
  /** a tap on the ground (not a drag), at this point in three's space */
  onPick?: (p: THREE.Vector3) => void;
  /** things placed in three's space rather than LDraw's (labels) */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sun] = useState(() => new THREE.Object3D());
  return (
    <div className={className} role="img" aria-label={label}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, near: 1, far: 400 }} gl={{ antialias: true }}>
        <color attach="background" args={["#bfe3ff"]} />
        <fog attach="fog" args={["#bfe3ff", 120, 220]} />
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

        <ContactShadows position={[target.x, 0.02, target.z]} opacity={0.2} scale={36} blur={2} far={10} />
        <FitCamera target={target} width={width} />
        <OrbitControls
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
          minDistance={14}
          maxDistance={110}
          minPolarAngle={0.45}
          maxPolarAngle={1.25}
        />
      </Canvas>
    </div>
  );
}

// Your town: you and your friends, one plot each along a street, you in the
// middle. Drag to walk along it; tap a house to go to it.
export function LegoTown({ residents, className }: { residents: Resident[]; className?: string }) {
  const town = useModel(
    useMemo(() => townText(residents), [residents]),
    true,
  );
  const count = residents.length;
  const [focus, setFocus] = useState(() =>
    Math.max(
      0,
      residents.findIndex((r) => r.me),
    ),
  );
  const target = useMemo(() => new THREE.Vector3(plotX(focus, count) * LDU, 3, 0), [focus, count]);
  const plotW = PLOT * 20 * LDU;

  return (
    <Stage
      className={className}
      label="Your town"
      target={target}
      width={62}
      pan
      onPick={(p) => setFocus(Math.min(count - 1, Math.max(0, Math.round(p.x / plotW + (count - 1) / 2))))}
      overlay={residents.map((r, i) => {
        const s = houseSpec(r.level);
        const cx = (s.x0 + s.w / 2 - PLOT / 2) * 20 * LDU;
        const cz = (s.z0 + s.d / 2 - PLOT / 2) * 20 * LDU;
        return (
          <Html
            key={r.name}
            position={[plotX(i, count) * LDU + cx, houseFor(r.level).h * LDU + 3, -cz]}
            center
            zIndexRange={[10, 0]}
          >
            <button
              onClick={() => setFocus(i)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{
                background: r.me ? "#ff8a1f" : "rgba(20,18,16,0.8)",
                color: "#fff",
              }}
            >
              {r.me ? "You" : r.name}
            </button>
          </Html>
        );
      })}
    >
      {town && <primitive object={town} />}
      {residents.map((r, i) => (
        <House key={r.name} level={r.level} dx={plotX(i, count)} />
      ))}
      {residents.map((r, i) => {
        const [x, y, z] = minifigSpot(houseSpec(r.level));
        return <Minifig key={r.name} look={BASE_HUNTER} at={[x + plotX(i, count), y, z]} />;
      })}
    </Stage>
  );
}
