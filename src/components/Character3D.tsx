"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { CharacterKey } from "@/lib/game";

// The character as a live 3D model: idles, slowly turns to face you, cheers
// when tapped. Models are KayKit CC0 placeholders (public/chars/3d) with the
// same five roles as our characters, until our own models exist.

const HEIGHT = 1.85; // world units the model is scaled to stand at
const DRACO = "/draco/";

function Model({ url, cheer, accent }: { url: string; cheer: number; accent: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url, DRACO);
  const { actions, mixer } = useAnimations(animations, group);
  // scale to a fixed height, centred on the origin: feet at -H/2, head at +H/2
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y || 1;
    const scale = HEIGHT / h;
    return { scale, y: -box.min.y * scale - HEIGHT / 2 };
  }, [scene]);

  // idle forever; a tap plays Cheer once and returns to idle
  useEffect(() => {
    const idle = actions.Idle ?? actions.Unarmed_Idle;
    idle?.reset().fadeIn(0.2).play();
    return () => {
      idle?.fadeOut(0.2);
    };
  }, [actions]);
  useEffect(() => {
    if (!cheer) return;
    const idle = actions.Idle ?? actions.Unarmed_Idle;
    const c = actions.Cheer;
    if (!c || !idle) return;
    c.reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
    idle.crossFadeTo(c, 0.15, false);
    c.play();
    const back = () => {
      c.crossFadeTo(idle.reset().play(), 0.25, false);
      mixer.removeEventListener("finished", back);
    };
    mixer.addEventListener("finished", back);
    return () => mixer.removeEventListener("finished", back);
  }, [cheer, actions, mixer]);

  // a slow sway so he never looks frozen
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.35) * 0.25;
  });

  // tint nothing on the model; the accent lives in the light so any model matches the theme
  const rim = useMemo(() => new THREE.Color(accent), [accent]);

  return (
    <group ref={group} position={[0, fit.y, 0]} scale={fit.scale}>
      <primitive object={scene} />
      <pointLight position={[-2, 2, -2]} intensity={6} color={rim} distance={8} />
    </group>
  );
}

export default function Character3D({ character, accent, className }: { character: CharacterKey | null; accent: string; className?: string }) {
  const url = `/chars/3d/${character ?? "warrior"}.glb`;
  const [cheer, setCheer] = useState(0);
  return (
    <div className={className} onPointerDown={() => setCheer((n) => n + 1)} role="img" aria-label="Your character">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.15, 4.3], fov: 30 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.6} />
        <Suspense fallback={null}>
          <group>
            <Model url={url} cheer={cheer} accent={accent} />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/chars/3d/warrior.glb", DRACO);
