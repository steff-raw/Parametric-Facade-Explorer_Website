"use client";

/**
 * Adaptive Panel 3D scene (P-0023): static and kinetic blade walls, the sun on its 3D arc, live depth labels.
 * View only: depths, sun and tint come from the adaptive-panel engine/module. frameloop="demand" always;
 * blade easing and the focus tween call invalidate() until settled. Drag the sun to scrub (OrbitControls off during the
 * drag, 44 px target); click a wall to focus it, empty space to return. WebGL missing or context lost: thumbnail + message.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { sun, sunPath } from "@/lib/patterns-3d/adaptive-panel/engine";
import {
  ARC_RADIUS,
  CAMERA,
  CELL,
  CAPPED,
  COMPASS,
  ELEMENT,
  LIGHT_DISTANCE,
  MAX_FRAME_DT,
  ROWS,
  SKIN_GLASS,
  SUN_HIT_PX,
  SUN_RADIUS,
  WALL_H,
  WALL_X,
  WARM,
  bladeTransform,
  cameraPosition,
  css,
  easeDepth,
  focusView,
  fmtHour,
  glassTransform,
  heatT,
  mix,
  nearestIndex,
  type Focus,
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
  focus: Focus;
  onFocus: (f: Focus) => void;
  /** Sun drag picked an hour (also pauses play). */
  onScrub: (hour: number) => void;
}

type Controls = {
  target: THREE.Vector3;
  update: () => void;
  enabled: boolean;
  enableDamping: boolean;
  addEventListener: (t: string, f: () => void) => void;
  removeEventListener: (t: string, f: () => void) => void;
};

/** Drop any orbit momentum left by damping, so a reset or tween is not pushed off its end point. */
function flushDamping(c: Controls) {
  const damping = c.enableDamping;
  c.enableDamping = false;
  c.update();
  c.enableDamping = damping;
}

function Walls({ depths, tints, onFocus }: { depths: [number, number]; tints: [string, string]; onFocus: (f: Focus) => void }) {
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
    let changed = false;
    for (let w = 0; w < 2; w++) {
      if (shown.current[w] === depths[w]) continue;
      shown.current[w] = easeDepth(shown.current[w], depths[w], delta);
      changed = true;
    }
    if (changed) {
      writeBlades();
      invalidate();
    }
  });

  // Click a wall (not an orbit drag) to focus it.
  const click = (e: { delta: number; instanceId?: number; stopPropagation: () => void }) => {
    if (e.delta > 4 || e.instanceId === undefined) return;
    e.stopPropagation();
    onFocus(e.instanceId < ROWS ? "static" : "kinetic");
  };

  return (
    <>
      <instancedMesh ref={glassRef} args={[geo, undefined, 2 * ROWS]} receiveShadow frustumCulled={false} onClick={click}>
        <meshStandardMaterial roughness={0.35} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={bladeRef} args={[geo, undefined, 2 * ROWS]} castShadow receiveShadow frustumCulled={false} onClick={click}>
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
      <DragRing position={pos} />
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

/** 44 px drag ring around the sun: radius SUN_HIT_PX in screen pixels at any zoom. */
function DragRing({ position }: { position: Vec3 }) {
  const ref = useRef<THREE.Mesh>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera;
    const perPx = (2 * cam.position.distanceTo(v.set(...position)) * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / size.height;
    ref.current?.scale.setScalar(Math.max(SUN_HIT_PX * perPx, SUN_RADIUS * 1.3));
  });
  return (
    <Billboard position={position}>
      <mesh ref={ref}>
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial color={HEAT} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </Billboard>
  );
}

/**
 * Drag-to-scrub. Capture-phase listeners on window run before OrbitControls (on the canvas): a press inside the scene
 * within SUN_HIT_PX of the sun (or its drawn radius) starts a drag, OrbitControls is disabled until release, and the
 * pointer snaps to the nearest hour tick on screen. Window, not the canvas, because the page's title row overlays the
 * top of the scene on desktop, where the June noon sun sits; presses on real controls there are left alone.
 */
function SunDrag({ month, hour, hours, onScrub }: { month: number; hour: number; hours: number[]; onScrub: (h: number) => void }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const live = useRef({ month, hour, hours, onScrub });
  live.current = { month, hour, hours, onScrub };

  useEffect(() => {
    const el = gl.domElement.parentElement;
    if (!el) return;
    const v = new THREE.Vector3();
    const local = (e: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const screen = (h: number): [number, number] => {
      const r = el.getBoundingClientRect();
      v.set(...scale(sun(live.current.month, h).vec, ARC_RADIUS)).project(camera);
      return [((v.x + 1) / 2) * r.width, ((1 - v.y) / 2) * r.height];
    };
    const onSun = (e: PointerEvent) => {
      const [sx, sy] = screen(live.current.hour);
      const [px, py] = local(e);
      const h = el.getBoundingClientRect().height;
      const drawn = (SUN_RADIUS / (camera.position.distanceTo(v.set(...scale(sun(live.current.month, live.current.hour).vec, ARC_RADIUS))) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * (h / 2);
      return Math.hypot(px - sx, py - sy) <= Math.max(SUN_HIT_PX, drawn);
    };
    let dragging = false, justDragged = false;
    const inScene = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const t = e.target as Element | null;
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom &&
        !t?.closest?.("a, button, input, select, textarea, label, summary, [role=button]");
    };
    const down = (e: PointerEvent) => {
      if ((e.pointerType === "mouse" && e.button !== 0) || !inScene(e) || !onSun(e)) return;
      e.stopPropagation();
      e.preventDefault();
      dragging = true;
      if (controls) controls.enabled = false;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!dragging) {
        if (e.pointerType === "mouse" && !e.buttons) el.style.cursor = inScene(e) && onSun(e) ? "grab" : "";
        return;
      }
      e.stopPropagation();
      const { hours: hs, hour: now } = live.current;
      const next = hs[nearestIndex(hs.map(screen), local(e))];
      if (next !== now) live.current.onScrub(next);
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      e.stopPropagation();
      dragging = false;
      justDragged = true;
      window.setTimeout(() => (justDragged = false), 0); // touch drags fire no click
      if (controls) controls.enabled = true;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.style.cursor = "grab";
    };
    // The click after a drag must not reach the scene (it would reset focus).
    const click = (e: MouseEvent) => {
      if (justDragged) e.stopPropagation();
      justDragged = false;
    };
    const opts = { capture: true };
    window.addEventListener("pointerdown", down, opts);
    window.addEventListener("pointermove", move, opts);
    window.addEventListener("pointerup", up, opts);
    window.addEventListener("pointercancel", up, opts);
    window.addEventListener("click", click, opts);
    return () => {
      window.removeEventListener("pointerdown", down, opts);
      window.removeEventListener("pointermove", move, opts);
      window.removeEventListener("pointerup", up, opts);
      window.removeEventListener("pointercancel", up, opts);
      window.removeEventListener("click", click, opts);
      if (controls) controls.enabled = true;
    };
  }, [gl, camera, controls]);
  return null;
}

/**
 * Camera: the J2 rule on mount and resize (or the focused view), the rule on "Reset view", and a 0.6 s tween of both
 * camera.position and controls.target when the focus changes (so the next orbit does not snap back).
 */
function CameraRig({ resetViewKey, focus }: { resetViewKey: number; focus: Focus }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const invalidate = useThree((s) => s.invalidate);
  const focusRef = useRef(focus);
  const tween = useRef<{ p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; t: number } | null>(null);
  const aspect = size.width / size.height;

  const place = (f: Focus) => {
    tween.current = null;
    const v = focusView(f, aspect);
    if (controls) flushDamping(controls);
    camera.position.set(...v.position);
    camera.lookAt(...v.target);
    if (controls) {
      controls.target.set(...v.target);
      controls.update();
    }
    invalidate();
  };

  // Mount / resize: keep the current view's framing.
  useEffect(() => place(focusRef.current), [camera, size.width, size.height, controls]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reset view: the camera rule.
  useEffect(() => place("overview"), [resetViewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusRef.current === focus || !controls) return;
    focusRef.current = focus;
    flushDamping(controls);
    const v = focusView(focus, aspect);
    tween.current = { p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...v.position), t1: new THREE.Vector3(...v.target), t: 0 };
    invalidate();
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  // A user orbit cancels a running tween.
  useEffect(() => {
    if (!controls) return;
    const stop = () => (tween.current = null);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, delta) => {
    const tw = tween.current;
    if (!tw || !controls) return;
    tw.t = Math.min(1, tw.t + Math.min(delta, MAX_FRAME_DT) / 0.6); // capped: first frame after idle carries the idle time
    const k = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - (-2 * tw.t + 2) ** 2 / 2;
    camera.position.lerpVectors(tw.p0, tw.p1, k);
    controls.target.lerpVectors(tw.t0, tw.t1, k);
    controls.update();
    if (tw.t < 1) invalidate();
    else tween.current = null;
  });
  return null;
}

/** Dashed outline round the focused wall (front plane of a full 0.6 m blade). */
function FocusOutline({ wall }: { wall: number }) {
  const x0 = WALL_X[wall] - CELL / 2 - 0.12, x1 = WALL_X[wall] + CELL / 2 + 0.12, y0 = 0.02, y1 = WALL_H + 0.15, z = 0.65;
  return (
    <Line
      points={[[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]]}
      color="#e8e8e8"
      lineWidth={1.25}
      dashed
      dashSize={0.25}
      gapSize={0.18}
    />
  );
}

const label = "pointer-events-none whitespace-nowrap text-[10px] text-muted sm:text-[11px]";

export default function AdaptivePanel3D(props: AdaptivePanel3DProps) {
  const { month, hour, hours, staticDepth, kineticDepth, cap, resetViewKey, fallbackSvg, focus, onFocus, onScrub } = props;
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
        onPointerMissed={() => onFocus("overview")}
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
        <Walls depths={depths} tints={tints} onFocus={onFocus} />
        {focus !== "overview" && <FocusOutline wall={focus === "static" ? 0 : 1} />}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
          <planeGeometry args={[11, 11]} />
          <meshStandardMaterial color="#161616" roughness={1} />
        </mesh>
        <gridHelper args={[11, 11, "#2a2a2a", "#1f1f1f"]} position={[0, 0.002, 2]} />

        {/* W and S sit off the grid's west / south edges, clear of the depth labels; N north-west, clear of both walls. */}
        {(Object.entries(COMPASS) as [string, Vec3][]).map(([t, p]) => (
          <Html key={t} position={p} center className={`${label} text-center`}>
            {t}
          </Html>
        ))}

        {/* Depth labels at the wall bases (as the reference), clear of the sun arc: static to the left, kinetic to the right. */}
        <Html position={[WALL_X[0] - 0.75, 0, 0.6]} className={label}>
          <div className="-translate-x-full pt-1 text-right">
            <div className="text-xs text-ink sm:text-sm">Static</div>
            <div className="tabular-nums">Fixed blade {staticDepth.toFixed(2)} m</div>
          </div>
        </Html>
        <Html position={[WALL_X[1] + 0.75, 0, 0.6]} className={label}>
          <div className="text-left">
            <div className="text-xs text-ink sm:text-sm">Kinetic</div>
            <div className="tabular-nums" data-testid="kinetic-depth">
              {kineticDepth.toFixed(2)} m at {fmtHour(hour)}
            </div>
          </div>
        </Html>

        <CameraRig resetViewKey={resetViewKey} focus={focus} />
        <SunDrag month={month} hour={hour} hours={hours} onScrub={onScrub} />
        <OrbitControls makeDefault enablePan={!phone} enableZoom minDistance={CAMERA.minDistance} maxDistance={CAMERA.maxDistance} target={CAMERA.target} />
      </Canvas>
    </div>
  );
}
