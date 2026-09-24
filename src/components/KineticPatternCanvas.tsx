"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Instances, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  KineticPatternModule,
  PatternParams,
  PatternStats,
} from "@/lib/patterns";

interface KineticPatternCanvasProps {
  pattern: KineticPatternModule;
  staticParams: PatternParams;
  kineticParams: PatternParams;
  playing?: boolean;
  className?: string;
  onStats?: (stats: PatternStats) => void;
}

function KineticInstances({
  pattern,
  staticParams,
  kineticParams,
  playing,
}: {
  pattern: KineticPatternModule;
  staticParams: PatternParams;
  kineticParams: PatternParams;
  playing: boolean;
}) {
  const count = pattern.getElementCount(staticParams);
  const size = pattern.getInstanceSize(staticParams);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const frozenTime = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const limit = Math.max(count, 1);

  const writeMatrices = (t: number) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      const transform = pattern.getElementTransform(
        i,
        staticParams,
        kineticParams,
        t
      );
      dummy.position.set(...transform.position);
      dummy.rotation.set(...transform.rotation);
      if (transform.scale) {
        dummy.scale.set(...transform.scale);
      } else {
        dummy.scale.set(1, 1, 1);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  };

  useEffect(() => {
    writeMatrices(frozenTime.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, pattern, staticParams, kineticParams, size.join(",")]);

  useFrame(({ clock }) => {
    if (playing) {
      frozenTime.current = clock.elapsedTime;
    }
    writeMatrices(frozenTime.current);
  });

  return (
    <Instances
      key={`inst-${size.join("x")}-${limit}`}
      ref={meshRef}
      limit={limit}
      range={count}
      frustumCulled={false}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#e8e8e8"
        metalness={0.12}
        roughness={0.58}
      />
    </Instances>
  );
}

function Scene({
  pattern,
  staticParams,
  kineticParams,
  playing,
}: {
  pattern: KineticPatternModule;
  staticParams: PatternParams;
  kineticParams: PatternParams;
  playing: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 8, 5]} intensity={1.15} />
      <KineticInstances
        pattern={pattern}
        staticParams={staticParams}
        kineticParams={kineticParams}
        playing={playing}
      />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={2}
        maxDistance={48}
      />
    </>
  );
}

export default function KineticPatternCanvas({
  pattern,
  staticParams,
  kineticParams,
  playing = true,
  className = "",
  onStats,
}: KineticPatternCanvasProps) {
  const count = pattern.getElementCount(staticParams);

  useEffect(() => {
    onStats?.({
      elementCount: count,
      nodeCount: count,
      connectionCount: 0,
      renderTimeMs: 0,
    });
  }, [count, onStats]);

  const cameraZ = useMemo(() => {
    const rows = Math.round(staticParams.rows ?? 8);
    const cols = Math.round(staticParams.cols ?? 8);
    const extent = Math.max(rows, cols) * 1.1;
    return Math.max(8, extent * 1.35);
  }, [staticParams.rows, staticParams.cols]);

  return (
    <div className={`h-full w-full bg-canvas ${className}`}>
      <Canvas
        camera={{
          position: [cameraZ * 0.55, cameraZ * 0.35, cameraZ],
          fov: 42,
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0d0d0d");
        }}
      >
        <Scene
          pattern={pattern}
          staticParams={staticParams}
          kineticParams={kineticParams}
          playing={playing}
        />
      </Canvas>
    </div>
  );
}
