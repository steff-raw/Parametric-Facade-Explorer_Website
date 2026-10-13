"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  Static3DPatternModule,
  PatternParams,
  PatternStats,
  ElementTransform,
} from "@/lib/patterns";

interface Pattern3DCanvasProps {
  pattern: Static3DPatternModule;
  staticParams: PatternParams;
  className?: string;
  onStats?: (stats: PatternStats) => void;
}

function resolveExtents(
  pattern: Static3DPatternModule,
  staticParams: PatternParams
): { width: number; height: number } {
  if (pattern.getGridExtents) {
    return pattern.getGridExtents(staticParams);
  }
  const rows = Math.round(staticParams.rows ?? 8);
  const cols = Math.round(staticParams.cols ?? 8);
  return { width: cols * 1.2, height: rows * 1.2 };
}

function buildPanelGeometry(
  size: [number, number, number],
  offset: [number, number, number]
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  g.translate(offset[0], offset[1], offset[2]);
  return g;
}

/**
 * Door-frame ring on the host surface: outer extends OUTSIDE the panel,
 * inner opening clears the leaf. Geometry is centered at origin (no hinge
 * offset) so instances stay coplanar when transforms have rotation = 0.
 */
function buildDoorFrameGeometry(
  panelSize: [number, number, number],
  frameWidth: number
): THREE.BufferGeometry | null {
  const [w, h, t] = panelSize;
  const fw = frameWidth;
  if (fw <= 0.001) return null;

  const clearance = 0.012;
  const outerW = w + 2 * fw;
  const outerH = h + 2 * fw;
  const innerW = w + clearance * 2;
  const innerH = h + clearance * 2;

  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-innerW / 2, -innerH / 2);
  hole.lineTo(-innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, -innerH / 2);
  hole.closePath();
  shape.holes.push(hole);

  // Shallow extrusion coplanar with the façade (same midplane as closed panels)
  const depth = Math.max(t * 0.85, 0.02);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function writeMatrices(
  mesh: THREE.InstancedMesh,
  count: number,
  dummy: THREE.Object3D,
  getTransform: (i: number) => ElementTransform
) {
  for (let i = 0; i < count; i++) {
    const tr = getTransform(i);
    dummy.position.set(...tr.position);
    dummy.rotation.set(...tr.rotation);
    if (tr.scale) dummy.scale.set(...tr.scale);
    else dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}

function StaticInstances({
  pattern,
  staticParams,
}: {
  pattern: Static3DPatternModule;
  staticParams: PatternParams;
}) {
  const count = pattern.getElementCount(staticParams);
  const size = pattern.getInstanceSize(staticParams);
  const offset = pattern.getGeometryOffset?.(staticParams) ?? [0, 0, 0];
  const frameWidth = staticParams.frameWidth ?? 0;
  const panelRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const panelGeo = useMemo(
    () => buildPanelGeometry(size, offset),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size[0], size[1], size[2], offset[0], offset[1], offset[2]]
  );

  const frameGeo = useMemo(
    () =>
      pattern.getFrameTransform
        ? buildDoorFrameGeometry(size, frameWidth)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size[0], size[1], size[2], frameWidth, Boolean(pattern.getFrameTransform)]
  );

  useLayoutEffect(() => {
    if (panelRef.current) {
      writeMatrices(panelRef.current, count, dummy, (i) =>
        pattern.getElementTransform(i, staticParams)
      );
      if (pattern.getInstanceColor) {
        for (let i = 0; i < count; i++) {
          panelRef.current.setColorAt(
            i,
            color.set(pattern.getInstanceColor(i, staticParams))
          );
        }
        if (panelRef.current.instanceColor) {
          panelRef.current.instanceColor.needsUpdate = true;
        }
      }
    }
    if (frameRef.current && frameGeo && pattern.getFrameTransform) {
      const getFrame = pattern.getFrameTransform;
      writeMatrices(frameRef.current, count, dummy, (i) =>
        getFrame(i, staticParams)
      );
    }
  }, [count, pattern, staticParams, dummy, color, panelGeo, frameGeo]);

  useEffect(
    () => () => {
      panelGeo.dispose();
      frameGeo?.dispose();
    },
    [panelGeo, frameGeo]
  );

  const limit = Math.max(count, 1);
  const geoKey = `${size.join("x")}-${offset.join("x")}-${frameWidth}`;

  return (
    <>
      {/* Frames first (host surface), then hinged leaves */}
      {frameGeo && (
        <instancedMesh
          key={`frame-${geoKey}`}
          ref={frameRef}
          args={[frameGeo, undefined, limit]}
          castShadow
          receiveShadow
          frustumCulled={false}
        >
          <meshStandardMaterial
            color="#c8c8c8"
            roughness={0.8}
            metalness={0.04}
          />
        </instancedMesh>
      )}
      <instancedMesh
        key={`panel-${geoKey}`}
        ref={panelRef}
        args={[panelGeo, undefined, limit]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial
          color="#e8e8e8"
          roughness={0.85}
          metalness={0}
        />
      </instancedMesh>
    </>
  );
}

function Scene({
  pattern,
  staticParams,
}: {
  pattern: Static3DPatternModule;
  staticParams: PatternParams;
}) {
  const keyLight = pattern.getLightPosition
    ? pattern.getLightPosition(staticParams)
    : ([7, 10, 8] as [number, number, number]);
  return (
    <>
      <ambientLight intensity={0.42} />
      <hemisphereLight args={["#f2f0ea", "#3a3a3a", 0.45]} />
      {keyLight && (
        <directionalLight
          castShadow
          position={keyLight}
          intensity={1.15}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.0002}
        />
      )}
      <directionalLight position={[-6, 4, -5]} intensity={0.35} />
      <StaticInstances pattern={pattern} staticParams={staticParams} />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        minDistance={2}
        maxDistance={60}
      />
    </>
  );
}

export default function Pattern3DCanvas({
  pattern,
  staticParams,
  className = "",
  onStats,
}: Pattern3DCanvasProps) {
  const count = pattern.getElementCount(staticParams);
  const extents = resolveExtents(pattern, staticParams);

  useEffect(() => {
    onStats?.({
      elementCount: count,
      nodeCount: count,
      connectionCount: 0,
      renderTimeMs: 0,
    });
  }, [count, onStats]);

  const cameraZ = useMemo(() => {
    const extent = Math.max(extents.width, extents.height, 4);
    return Math.max(10, extent * 1.45);
  }, [extents.width, extents.height]);

  return (
    <div className={`h-full w-full bg-canvas ${className}`}>
      <Canvas
        shadows
        camera={{
          position: pattern.getCameraPosition?.(staticParams) ?? [
            cameraZ * 0.45,
            cameraZ * 0.28,
            cameraZ,
          ],
          fov: 42,
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0d0d0d");
        }}
      >
        <Scene pattern={pattern} staticParams={staticParams} />
      </Canvas>
    </div>
  );
}
