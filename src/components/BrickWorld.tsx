"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BASE_HUNTER, Figure, type FigureLook } from "@/components/BrickFigure";
import { PLATE, baseplate, buildGarden, buildHouse, houseSpec, visibleStuds, type Brick } from "@/lib/brickWorld";

// Your plot: a studded baseplate with your house and garden, and you in front
// of the door. Every brick is an instance, so a whole house is a handful of
// draw calls. House level and garden streak drive what gets built.

const SIZE = 22;
const GAP = 0.03; // the hairline between bricks that makes them read as bricks

type Kind = "box" | "round" | "glass";

function BrickInstances({ bricks, kind }: { bricks: Brick[]; kind: Kind }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(
    () => (kind === "round" ? new THREE.CylinderGeometry(0.46, 0.46, 1, 20) : new THREE.BoxGeometry(1, 1, 1)),
    [kind],
  );
  const material = useMemo(
    () =>
      kind === "glass"
        ? new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.55 })
        : new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    [kind],
  );
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    bricks.forEach((b, i) => {
      const h = b.h * PLATE;
      m.compose(
        new THREE.Vector3(b.x + b.w / 2, b.y * PLATE + h / 2, b.z + b.d / 2),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w - GAP, h - GAP, b.d - GAP),
      );
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(b.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bricks]);
  if (!bricks.length) return null;
  return <instancedMesh key={bricks.length} ref={ref} args={[geometry, material, bricks.length]} castShadow={kind !== "glass"} receiveShadow />;
}

function Studs({ bricks }: { bricks: Brick[] }) {
  const studs = useMemo(() => visibleStuds(bricks), [bricks]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 0.18, 16), []);
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 }), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    studs.forEach((s, i) => {
      m.makeTranslation(s.x + 0.5, s.y * PLATE + 0.09, s.z + 0.5);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(s.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [studs]);
  return <instancedMesh key={studs.length} ref={ref} args={[geometry, material, studs.length]} castShadow receiveShadow />;
}

// Place the camera so the plot fits the screen width: a phone in portrait needs
// to stand much further back than a laptop.
const TARGET = new THREE.Vector3(SIZE / 2, 2.5, SIZE / 2 + 2);
const VIEW_DIR = new THREE.Vector3(0.62, 0.62, 0.8).normalize();
function FitCamera({ width }: { width: number }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vfov = (cam.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const dist = width / 2 / Math.tan(Math.min(hfov, vfov) / 2);
    cam.position.copy(TARGET).addScaledVector(VIEW_DIR, dist);
    cam.lookAt(TARGET);
    cam.updateProjectionMatrix();
  }, [camera, size, width]);
  return null;
}

export default function BrickWorld({
  houseLevel = 1,
  streak = 0,
  look = BASE_HUNTER,
  className,
}: {
  houseLevel?: number;
  streak?: number;
  look?: FigureLook;
  className?: string;
}) {
  const [wave, setWave] = useState(0);
  const bricks = useMemo(() => {
    const house = houseSpec(houseLevel);
    return [baseplate(SIZE), ...buildHouse(houseLevel), ...buildGarden(streak, house, SIZE)];
  }, [houseLevel, streak]);
  const byKind = useMemo(
    () => ({
      box: bricks.filter((b) => !b.kind || b.kind === "box" || b.kind === "tile"),
      round: bricks.filter((b) => b.kind === "round"),
      glass: bricks.filter((b) => b.kind === "glass"),
    }),
    [bricks],
  );
  const s = houseSpec(houseLevel);
  const door = { x: s.x + s.w / 2, z: s.z + s.d + 1.6 }; // he stands on the path, just outside the door

  return (
    <div className={className} role="img" aria-label="Your house and garden">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [SIZE, 20, SIZE + 10], fov: 35 }} gl={{ antialias: true }}>
        <color attach="background" args={["#bfe3ff"]} />
        <fog attach="fog" args={["#bfe3ff", 90, 160]} />
        <hemisphereLight args={["#fff6ec", "#4c6a3f", 0.8]} />
        <directionalLight
          position={[SIZE / 2 + 14, 26, SIZE / 2 + 10]}
          target-position={[SIZE / 2, 0, SIZE / 2]}
          intensity={2.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-camera-far={80}
          shadow-bias={-0.0005}
        />
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 8, -8]} scale={[16, 6, 1]} />
          <Lightformer intensity={1} position={[-8, 3, 4]} scale={[6, 6, 1]} />
        </Environment>

        <group>
          <BrickInstances bricks={byKind.box} kind="box" />
          <BrickInstances bricks={byKind.round} kind="round" />
          <BrickInstances bricks={byKind.glass} kind="glass" />
          <Studs bricks={bricks} />
          <group position={[door.x, 0.02, door.z]} scale={0.78} onClick={(e) => (e.stopPropagation(), setWave((n) => n + 1))}>
            <group position={[0, -0.34, 0]}>
              <Figure look={look} wave={wave} />
            </group>
          </group>
        </group>
        <ContactShadows position={[SIZE / 2, 0.01, SIZE / 2]} opacity={0.25} scale={SIZE + 6} blur={2} far={8} />
        <FitCamera width={21} />
        <OrbitControls
          target={TARGET}
          enablePan={false}
          minDistance={14}
          maxDistance={90}
          minPolarAngle={0.5}
          maxPolarAngle={1.2}
        />
      </Canvas>
    </div>
  );
}
