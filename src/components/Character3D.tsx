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
  // Generated (Meshy) models ship their colour texture as a full-strength glow
  // (emissive 1) with 2x specular: faces blow out white and cloth looks wet.
  // Lit by the scene instead, and matte.
  useMemo(() => {
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (!m || !("roughness" in m)) return;
      m.emissiveMap = null;
      m.emissive?.setRGB(0, 0, 0);
      m.roughness = Math.max(m.roughness ?? 0, 0.82);
      m.metalness = 0;
      if ("specularIntensity" in m) {
        m.specularIntensity = 0.3;
        m.specularColor?.setRGB(1, 1, 1);
      }
      m.needsUpdate = true;
    });
  }, [scene]);

  // scale to a fixed height, centred on the origin: feet at -H/2, head at +H/2
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y || 1;
    const scale = HEIGHT / h;
    return { scale, y: -box.min.y * scale - HEIGHT / 2 };
  }, [scene]);

  // the idle clip: named Idle when there is one, otherwise whatever the model ships with first
  const idleName = useMemo(
    () => (animations.find((a) => /idle/i.test(a.name)) ?? animations[0])?.name,
    [animations],
  );

  // idle forever; a tap plays Cheer once (if the model has one) and returns to idle
  useEffect(() => {
    const idle = idleName ? actions[idleName] : undefined;
    idle?.reset().fadeIn(0.2).play();
    return () => {
      idle?.fadeOut(0.2);
    };
  }, [actions, idleName]);
  useEffect(() => {
    if (!cheer) return;
    const idle = idleName ? actions[idleName] : undefined;
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
  }, [cheer, actions, mixer, idleName]);

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
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.05, 4.6], fov: 30 }} gl={{ alpha: true, antialias: true }} style={{ background: "transparent" }}>
        <hemisphereLight args={["#fff4ea", "#2a2320", 1.4]} />
        <directionalLight position={[1.5, 3, 3]} intensity={2.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />
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
