"use client";

/**
 * Adaptive Panel 3D scene (P-0023): static and kinetic blade walls, the sun on its 3D arc, live depth labels.
 * View only: depths, sun and tint come from the adaptive-panel engine/module. frameloop="demand" always;
 * blade easing calls invalidate() until settled. WebGL missing or context lost: thumbnail + message.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { sun, sunPath } from "@/lib/patterns-3d/adaptive-panel/engine";
import {
  ARC_RADIUS,
  CAMERA,
  CAPPED,
  ELEMENT,
  LIGHT_DISTANCE,
  ROWS,
  SKIN_GLASS,
  SUN_RADIUS,
  WALL_H,
  WALL_X,
  WARM,
  bladeTransform,
  cameraPosition,
  css,
  fmtHour,
  glassTransform,
  heatT,
  mix,
} from "@/lib/patterns-3d/adaptive-panel";

const HEAT = "#c47a48";
const GREY = "#969696";

type Vec3 = [number, number, number];
const scale = (v: Vec3, k: number) => v.map((n) => n * k) as Vec3;

export interface AdaptivePanel3DProps {
  month: number;
  hour: number;
  /** Ordered hours of the scrubber (sun-up, 07:30 to 16:30) for the arc ticks. */
  hours: number[];
  staticDepth: number;
  kineticDepth: number;
  cap: number;
  resetViewKey: number;
  fallbackSvg: string;
}

function Walls({ depths, tints }: { depths: [number, number]; tints: [string, string] }) {
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const bladeRef = useRef<THREE.InstancedMesh>(null);
  const shown = useRef<[number, number]>([...depths]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const invalidate = useThree((s) => s.invalidate);

  const writeBlades = () => {
    const mesh = bladeRef.current;
    if (!mesh) return;
    for (let wall = 0; wall < 2; wall++) {
      for (let row = 0; row < ROWS; row++) {
        const t = bladeTransform(wall, row, shown.current[wall]);
        dummy.position.set(...t.position);
        dummy.scale.set(...(t.scale as Vec3));
        dummy.updateMatrix();
        mesh.setMatrixAt(wall * ROWS + row, dummy.matrix);
        mesh.setColorAt(wall * ROWS + row, color.set(depths[wall] >= 0.6 ? CAPPED : ELEMENT));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const mesh = glassRef.current;
    if (!mesh) return;
    for (let wall = 0; wall < 2; wall++) {
      for (let row = 0; row < ROWS; row++) {
        const t = glassTransform(wall, row);
        dummy.position.set(...t.position);
        dummy.scale.set(...(t.scale as Vec3));
        dummy.updateMatrix();
        mesh.setMatrixAt(wall * ROWS + row, dummy.matrix);
        mesh.setColorAt(wall * ROWS + row, color.set(tints[wall]));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    writeBlades();
    invalidate();
    // writeBlades reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tints, depths, dummy, color, invalidate]);

  useEffect(() => () => geo.dispose(), [geo]);

  // Ease the drawn depth towards the rule's depth (about 0.4 s), one frame at a time.
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-Math.min(delta, 0.1) / 0.1);
    let changed = false, moving = false;
    for (let w = 0; w < 2; w++) {
      const diff = depths[w] - shown.current[w];
      if (diff === 0) continue;
      changed = true;
      if (Math.abs(diff) < 0.002) shown.current[w] = depths[w];
      else {
        shown.current[w] += diff * k;
        moving = true;
      }
    }
    if (changed) writeBlades();
    if (moving) invalidate();
  });

  return (
    <>
      <instancedMesh ref={glassRef} args={[geo, undefined, 2 * ROWS]} receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.35} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={bladeRef} args={[geo, undefined, 2 * ROWS]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.7} metalness={0.05} />
      </instancedMesh>
    </>
  );
}

function SunAndArc({ month, hour, hours, shadows }: { month: number; hour: number; hours: number[]; shadows: boolean }) {
  const s = sun(month, hour);
  const up = s.altitude > 0 && s.vec[2] > 0;
  const pos = scale(s.vec, ARC_RADIUS);

  // Arc split into the part in front of the facade (z > 0, lit) and behind it (dim).
  const segments = useMemo(() => {
    const pts = sunPath(month);
    const out: { front: boolean; points: Vec3[] }[] = [];
    for (const p of pts) {
      const front = p.vec[2] > 0;
      const v = scale(p.vec, ARC_RADIUS);
      const last = out[out.length - 1];
      if (!last || last.front !== front) {
        out.push({ front, points: last ? [last.points[last.points.length - 1], v] : [v] });
      } else last.points.push(v);
    }
    return out.filter((seg) => seg.points.length > 1);
  }, [month]);

  const ticks = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(hours.flatMap((h) => scale(sun(month, h).vec, ARC_RADIUS)), 3));
    return g;
  }, [month, hours]);
  useEffect(() => () => ticks.dispose(), [ticks]);

  return (
    <>
      {segments.map((seg, i) => (
        <Line key={i} points={seg.points} color={seg.front ? GREY : "#3a3a3a"} lineWidth={1} />
      ))}
      <points geometry={ticks}>
        <pointsMaterial color={GREY} size={5} sizeAttenuation={false} />
      </points>
      <mesh position={pos}>
        <sphereGeometry args={[SUN_RADIUS, 24, 16]} />
        <meshBasicMaterial color={up ? HEAT : "#5a4434"} toneMapped={false} />
      </mesh>
      <Html position={[pos[0], pos[1] - 1.1, pos[2]]} center className="pointer-events-none whitespace-nowrap text-[10px] text-muted tabular-nums">
        {fmtHour(hour)}
      </Html>
      {up && (
        <directionalLight
          castShadow={shadows}
          position={scale(s.vec, LIGHT_DISTANCE)}
          intensity={1.6}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={1}
          shadow-camera-far={80}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
          shadow-bias={-0.0004}
        />
      )}
    </>
  );
}

/** Applies the camera rule on mount, on resize (aspect) and on "Reset view". */
function CameraRig({ resetViewKey }: { resetViewKey: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    camera.position.set(...cameraPosition(size.width / size.height));
    camera.lookAt(...CAMERA.target);
    if (controls) {
      controls.target.set(...CAMERA.target);
      controls.update();
    }
    invalidate();
  }, [camera, size.width, size.height, controls, resetViewKey, invalidate]);
  return null;
}

const label = "pointer-events-none whitespace-nowrap text-[10px] text-muted sm:text-[11px]";

export default function AdaptivePanel3D(props: AdaptivePanel3DProps) {
  const { month, hour, hours, staticDepth, kineticDepth, cap, resetViewKey, fallbackSvg } = props;
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const c = document.createElement("canvas");
    setWebgl(Boolean(c.getContext("webgl2") || c.getContext("webgl")));
    setPhone(window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 640);
  }, []);

  const depths = useMemo<[number, number]>(() => [staticDepth, kineticDepth], [staticDepth, kineticDepth]);
  const tints = useMemo<[string, string]>(
    () => [css(mix(SKIN_GLASS, WARM, heatT(month, hour, staticDepth, cap))), css(mix(SKIN_GLASS, WARM, heatT(month, hour, kineticDepth, cap)))],
    [month, hour, staticDepth, kineticDepth, cap],
  );

  if (webgl === null) {
    return <div className="flex h-full w-full items-center justify-center bg-canvas text-sm text-muted">Loading 3D…</div>;
  }

  if (!webgl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-canvas px-6 pt-20" data-testid="webgl-fallback">
        <div className="aspect-square h-[55%] max-h-[360px]" dangerouslySetInnerHTML={{ __html: fallbackSvg }} aria-hidden />
        <p className="max-w-xs text-center text-xs text-muted">
          The 3D view needs WebGL, which is off or unavailable in this browser. The chart, totals and verdict still work.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-canvas">
      <Canvas
        frameloop="demand"
        shadows={!phone}
        dpr={phone ? [1, 1.5] : [1, 2]}
        camera={{ position: cameraPosition(), fov: CAMERA.fov, near: 0.1, far: 200 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0d0d0d");
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            setWebgl(false);
          });
        }}
      >
        <ambientLight intensity={0.45} />
        <hemisphereLight args={["#f2f0ea", "#3a3a3a", 0.4]} />
        <directionalLight position={[-6, 4, -5]} intensity={0.3} />
        <SunAndArc month={month} hour={hour} hours={hours} shadows={!phone} />
        <Walls depths={depths} tints={tints} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
          <planeGeometry args={[11, 11]} />
          <meshStandardMaterial color="#161616" roughness={1} />
        </mesh>
        <gridHelper args={[11, 11, "#2a2a2a", "#1f1f1f"]} position={[0, 0.002, 2]} />

        {(
          [
            ["W", [-6, 0, 2]],
            ["E", [6, 0, 2]],
            ["S", [0, 0, 8]],
            ["N", [0, 0, -4]],
          ] as [string, Vec3][]
        ).map(([t, p]) => (
          <Html key={t} position={p} center className={`${label} text-center`}>
            {t}
          </Html>
        ))}

        {/* Depth labels above the walls: static to the left, kinetic to the right (they overlap if centred). */}
        <Html position={[WALL_X[0] - 0.75, WALL_H + 0.6, 0]} className={label}>
          <div className="-translate-x-full -translate-y-full text-right">
            <div className="text-xs text-ink sm:text-sm">Static</div>
            <div className="tabular-nums">Fixed blade {staticDepth.toFixed(2)} m</div>
          </div>
        </Html>
        <Html position={[WALL_X[1] + 0.75, WALL_H + 0.6, 0]} className={label}>
          <div className="-translate-y-full text-left">
            <div className="text-xs text-ink sm:text-sm">Kinetic</div>
            <div className="tabular-nums" data-testid="kinetic-depth">
              {kineticDepth.toFixed(2)} m at {fmtHour(hour)}
            </div>
          </div>
        </Html>

        <CameraRig resetViewKey={resetViewKey} />
        <OrbitControls makeDefault enablePan={!phone} enableZoom minDistance={CAMERA.minDistance} maxDistance={CAMERA.maxDistance} target={CAMERA.target} />
      </Canvas>
    </div>
  );
}
