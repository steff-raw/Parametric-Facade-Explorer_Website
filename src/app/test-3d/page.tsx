"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

function SpinningCube() {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.6;
    ref.current.rotation.y += delta * 0.9;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color="#e8e8e8" wireframe />
    </mesh>
  );
}

export default function Test3DPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
      <h1 className="mb-2 text-2xl font-bold text-ink">R3F pipeline test</h1>
      <p className="mb-6 text-sm text-muted">
        Spinning cube — confirms three / fiber / drei load correctly. Remove this
        route once kinetic patterns are wired.
      </p>
      <div className="aspect-square w-full bg-canvas">
        <Canvas camera={{ position: [2.5, 2, 2.5], fov: 45 }}>
          <ambientLight intensity={0.45} />
          <directionalLight position={[4, 6, 3]} intensity={1.1} />
          <SpinningCube />
        </Canvas>
      </div>
    </div>
  );
}
