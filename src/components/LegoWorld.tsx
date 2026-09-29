"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { LDrawLoader } from "three/examples/jsm/loaders/LDrawLoader.js";
import { LDrawConditionalLineMaterial } from "three/examples/jsm/materials/LDrawConditionalLineMaterial.js";
import { LDrawUtils } from "three/examples/jsm/utils/LDrawUtils.js";
import {
  BASE_HUNTER,
  MINIFIG_PARTS,
  PLOT,
  baseplate,
  buildGarden,
  buildHouse,
  buildMinifig,
  houseSpec,
  minifigSpot,
  modelText,
  type MinifigLook,
} from "@/lib/legoWorld";

// Your plot in real parts: the 32x32 baseplate, your house, your garden, and
// your minifigure outside the door. The parts are loaded once (public/lego);
// every model after that is just LDraw text parsed against them.

const LDU = 0.05; // three units per LDraw unit: a stud is 1

// The colours and the packed parts are fetched once. Each model is parsed as
// one packed file: its own lines first, then every part embedded after it,
// the same shape as an official "_Packed.mpd".
let setup: Promise<{ loader: LDrawLoader; parts: string }> | null = null;
function getLoader() {
  setup ??= (async () => {
    const loader = new LDrawLoader();
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    loader.smoothNormals = true;
    const [, parts] = await Promise.all([
      loader.preloadMaterials("/lego/LDConfig.ldr"),
      fetch("/lego/parts.mpd").then((r) => r.text()),
    ]);
    // drop the index model at the top: only the embedded parts are needed
    return { loader, parts: parts.slice(parts.indexOf("0 NOFILE") + "0 NOFILE".length) };
  })();
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
    getLoader()
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

function Minifig({ look, at }: { look: MinifigLook; at: [number, number, number] }) {
  const model = useModel(useMemo(() => modelText(buildMinifig(look), "minifig.ldr"), [look]), false);
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
    () => modelText([baseplate(), ...buildHouse(houseLevel), ...buildGarden(streak, houseSpec(houseLevel))], "plot.ldr"),
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
    <div className={className} role="img" aria-label="Your house and garden">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 32, near: 1, far: 400 }} gl={{ antialias: true }}>
        <color attach="background" args={["#bfe3ff"]} />
        <fog attach="fog" args={["#bfe3ff", 120, 220]} />
        <hemisphereLight args={["#fff8ef", "#5a7a4a", 0.9]} />
        <directionalLight
          position={[18, 30, -14]}
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
        <group rotation={[Math.PI, 0, 0]} scale={LDU}>
          {world && <primitive object={world} />}
          <Minifig look={look} at={at} />
        </group>

        <ContactShadows position={[0, 0.02, 0]} opacity={0.2} scale={36} blur={2} far={10} />
        <FitCamera target={target} width={30} />
        <OrbitControls target={target} enablePan={false} minDistance={14} maxDistance={110} minPolarAngle={0.45} maxPolarAngle={1.25} />
      </Canvas>
    </div>
  );
}
