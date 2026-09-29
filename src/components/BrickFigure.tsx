"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// Your character as a brick-built toy figure, made entirely in code: no model
// files, crisp at any size, and every part (hair, torso, legs, gear) is a
// swappable piece -- which is what upgrades will change. He stands on a studded
// grass plate, breathes, glances around, and waves when you tap him.

export type FigureLook = {
  skin: string;
  hair: string;
  hairTips: string;
  torso: string; // hoodie
  torsoTrim: string; // drawstrings, pocket
  legs: string;
  shoes: string;
  plate: string;
};

export const BASE_HUNTER: FigureLook = {
  skin: "#e8b48a",
  hair: "#16161a",
  hairTips: "#ff6b00",
  torso: "#1b1b20",
  torsoTrim: "#6b6b75",
  legs: "#2a2f3a",
  shoes: "#111114",
  plate: "#4c9a3f",
};

// glossy toy plastic
function plastic(color: string) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
}

// a box whose top face is narrower than its bottom: the figure's torso
function taperedBox(w: number, h: number, d: number, topScale: number) {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * topScale);
  g.computeVertexNormals();
  return g;
}

function Stud({ position, color, r = 0.24 }: { position: [number, number, number]; color: string; r?: number }) {
  const m = useMemo(() => plastic(color), [color]);
  return (
    <mesh position={position} material={m} castShadow>
      <cylinderGeometry args={[r, r, 0.18, 24]} />
    </mesh>
  );
}

function Plate({ color }: { color: string }) {
  const m = useMemo(() => plastic(color), [color]);
  const studs: [number, number, number][] = [];
  for (let x = -3.5; x <= 3.5; x++) for (let z = -3.5; z <= 3.5; z++) studs.push([x, 0.25, z]);
  return (
    <group>
      <mesh position={[0, 0, 0]} material={m} receiveShadow>
        <boxGeometry args={[8, 0.32, 8]} />
      </mesh>
      {studs.map((p, i) => (
        <Stud key={i} position={p} color={color} />
      ))}
    </group>
  );
}

function Figure({ look, wave }: { look: FigureLook; wave: number }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const waveStart = useRef(-10);
  const lastWave = useRef(0);

  const mat = useMemo(
    () => ({
      skin: plastic(look.skin),
      hair: plastic(look.hair),
      tips: plastic(look.hairTips),
      torso: plastic(look.torso),
      trim: plastic(look.torsoTrim),
      legs: plastic(look.legs),
      shoes: plastic(look.shoes),
      ink: new THREE.MeshBasicMaterial({ color: "#141414" }),
      eyeGlint: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    }),
    [look],
  );
  const torsoGeo = useMemo(() => taperedBox(2.0, 1.35, 1.0, 0.72), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (wave !== lastWave.current) {
      lastWave.current = wave;
      waveStart.current = t;
    }
    const w = t - waveStart.current; // seconds into a wave
    if (torso.current) torso.current.scale.y = 1 + Math.sin(t * 1.8) * 0.012; // breathing
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.45) * 0.35 + Math.sin(t * 1.3) * 0.04;
      head.current.rotation.x = Math.sin(t * 0.7) * 0.04;
    }
    if (root.current) root.current.rotation.y = Math.sin(t * 0.25) * 0.18;
    if (armL.current) armL.current.rotation.x = Math.sin(t * 1.8) * 0.05;
    if (armR.current) {
      if (w < 1.6) {
        // raise, wave three times, lower
        const up = Math.min(1, w / 0.25) * Math.min(1, (1.6 - w) / 0.25);
        armR.current.rotation.x = -2.6 * up;
        armR.current.rotation.z = -0.25 * up + Math.sin(w * 14) * 0.35 * up;
      } else {
        armR.current.rotation.x = Math.sin(t * 1.8 + 1) * 0.05;
        armR.current.rotation.z = 0;
      }
    }
  });

  // proportions (world units): legs 1.3, hips 0.3, torso 1.35, neck, head ~0.9, hair on top
  return (
    <group ref={root} position={[0, 0.34, 0]}>
      {/* legs and shoes */}
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={mat.shoes} position={[0, 0.12, 0.08]} castShadow>
            <boxGeometry args={[0.92, 0.24, 1.15]} />
          </mesh>
          <mesh material={mat.legs} position={[0, 0.78, 0]} castShadow>
            <boxGeometry args={[0.9, 1.08, 0.95]} />
          </mesh>
        </group>
      ))}
      <mesh material={mat.legs} position={[0, 1.47, 0]} castShadow>
        <boxGeometry args={[1.95, 0.3, 0.95]} />
      </mesh>

      {/* torso: the hoodie */}
      <group ref={torso} position={[0, 1.62, 0]}>
        <mesh geometry={torsoGeo} material={mat.torso} position={[0, 0.675, 0]} castShadow />
        {/* hood, folded behind the neck */}
        <mesh material={mat.torso} position={[0, 1.33, -0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.42, 0.16, 12, 24, Math.PI]} />
        </mesh>
        {/* drawstrings and pocket */}
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} material={mat.trim} position={[x, 1.02, 0.5]}>
            <cylinderGeometry args={[0.025, 0.025, 0.45, 8]} />
          </mesh>
        ))}
        <mesh material={mat.trim} position={[0, 0.3, 0.505]}>
          <boxGeometry args={[1.0, 0.36, 0.02]} />
        </mesh>

        {/* arms hang from the shoulders; the right one waves */}
        {[
          { x: -1.02, ref: armL, side: -1 },
          { x: 1.02, ref: armR, side: 1 },
        ].map(({ x, ref, side }) => (
          <group key={x} ref={ref} position={[x, 1.2, 0]}>
            <group rotation={[0, 0, side * 0.12]}>
              <mesh material={mat.torso} position={[0, -0.55, 0]} castShadow>
                <boxGeometry args={[0.5, 1.15, 0.6]} />
              </mesh>
              <mesh material={mat.skin} position={[0, -1.25, 0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[0.17, 0.09, 12, 24]} />
              </mesh>
            </group>
          </group>
        ))}

        {/* neck and head */}
        <mesh material={mat.skin} position={[0, 1.43, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.18, 24]} />
        </mesh>
        <group ref={head} position={[0, 1.95, 0]}>
          <mesh material={mat.skin} castShadow>
            <cylinderGeometry args={[0.58, 0.58, 0.9, 40]} />
          </mesh>
          {/* face: eyes with a glint, brows set in a determined line, a small grin */}
          {[-0.2, 0.2].map((x) => (
            <group key={x} position={[x, 0.06, 0.565]}>
              <mesh material={mat.ink} scale={[1, 1.25, 0.4]}>
                <sphereGeometry args={[0.075, 16, 16]} />
              </mesh>
              <mesh material={mat.eyeGlint} position={[0.022, 0.03, 0.03]}>
                <sphereGeometry args={[0.02, 8, 8]} />
              </mesh>
              <mesh material={mat.ink} position={[x * 0.1, 0.19, 0]} rotation={[0, 0, x > 0 ? 0.25 : -0.25]}>
                <boxGeometry args={[0.2, 0.04, 0.02]} />
              </mesh>
            </group>
          ))}
          <mesh material={mat.ink} position={[0.03, -0.2, 0.568]} rotation={[0, 0, Math.PI + 0.15]}>
            <torusGeometry args={[0.14, 0.022, 8, 24, Math.PI * 0.8]} />
          </mesh>

          {/* hair: a black cap with spikes, the tips dipped in the accent colour */}
          <mesh material={mat.hair} position={[0, 0.5, -0.02]} castShadow>
            <cylinderGeometry args={[0.62, 0.64, 0.28, 40]} />
          </mesh>
          <mesh material={mat.hair} position={[0, 0.2, -0.3]} castShadow>
            <boxGeometry args={[1.22, 0.7, 0.62]} />
          </mesh>
          {[
            [-0.35, 0.72, 0.25, -0.5, 0.35],
            [0, 0.8, 0.3, 0, 0.5],
            [0.35, 0.72, 0.25, 0.5, 0.35],
            [-0.3, 0.75, -0.25, -0.4, -0.3],
            [0.3, 0.75, -0.25, 0.4, -0.3],
            [0, 0.78, -0.05, 0.1, 0],
          ].map(([x, y, z, rz, rx], i) => (
            <group key={i} position={[x, y, z]} rotation={[rx, 0, rz]}>
              <mesh material={mat.hair} castShadow>
                <coneGeometry args={[0.22, 0.45, 5]} />
              </mesh>
              <mesh material={mat.tips} position={[0, 0.2, 0]}>
                <coneGeometry args={[0.1, 0.15, 5]} />
              </mesh>
            </group>
          ))}
          {/* fringe over the forehead */}
          <mesh material={mat.hair} position={[-0.15, 0.36, 0.45]} rotation={[0.9, 0, 0.35]} castShadow>
            <coneGeometry args={[0.2, 0.42, 5]} />
          </mesh>
          <mesh material={mat.hair} position={[0.2, 0.36, 0.44]} rotation={[0.9, 0, -0.3]} castShadow>
            <coneGeometry args={[0.18, 0.38, 5]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default function BrickFigure({ look = BASE_HUNTER, className }: { look?: FigureLook; className?: string }) {
  const [wave, setWave] = useState(0);
  return (
    <div className={className} onPointerUp={() => setWave((n) => n + 1)} role="img" aria-label="Your character">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 4.2, 15], fov: 30 }} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={["#fff6ec", "#3a3228", 0.7]} />
        <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
        {/* soft studio reflections for the plastic, built from light panels: no downloads */}
        <Environment resolution={256}>
          <Lightformer intensity={2} position={[0, 5, -5]} scale={[10, 5, 1]} />
          <Lightformer intensity={1.2} position={[-5, 2, 3]} scale={[4, 4, 1]} />
          <Lightformer intensity={0.8} color="#ffb070" position={[5, 1, 3]} scale={[3, 3, 1]} />
        </Environment>
        <group position={[0, -1.6, 0]}>
          <Plate color={look.plate} />
          <Figure look={look} wave={wave} />
        </group>
        <ContactShadows position={[0, -1.42, 0]} opacity={0.35} scale={10} blur={2.4} far={4} />
        <OrbitControls target={[0, 1.1, 0]} enablePan={false} enableZoom={false} minPolarAngle={1.1} maxPolarAngle={1.5} />
      </Canvas>
    </div>
  );
}
