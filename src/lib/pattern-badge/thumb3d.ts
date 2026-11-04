/**
 * Pattern Performance Badge: gallery thumbnail as a real 3D render (P-0038, Stage 2).
 *
 * One shared offscreen THREE.WebGLRenderer draws each 3D pattern's instanced mesh at its
 * defaults (kinetic at t = 0) with the detail-page camera and lights, plus a backplate on the
 * glazing plane tinted from the ray map (amber = sun reaches, dark = shaded). The image is
 * cached as a data URL. Work starts after first paint. No WebGL: resolves null, so callers
 * keep the existing SVG preview.
 */

import * as THREE from "three";
import { kineticModule as louvreCascade } from "../patterns-3d/louvre-cascade";
import { kineticModule as radialPulse } from "../patterns-3d/radial-pulse-panels";
import { static3dModule as hingedFlap } from "../patterns-3d/hinged-flap-grid";
import { static3dModule as rotatedBrick } from "../patterns-3d/rotated-brick-screen";
import { static3dModule as solarSkin } from "../patterns-3d/solar-budget-skin";
import { static3dModule as adaptivePanel } from "../patterns-3d/adaptive-panel";
import type { ElementTransform, KineticPatternModule, Static3DPatternModule } from "../patterns-3d/shared/types";
import { getBadge, getBoxes } from "./adapters";
import { buildDoorFrameGeometry, buildPanelGeometry } from "./geometry";
import { composeMatrix } from "./matrix";
import { boxWindow } from "./raycast";

export interface Thumb {
  /** PNG data URL. */
  url: string;
  /** Instances drawn in the element mesh (= module getElementCount at defaults). */
  instances: number;
}

type Scene3D = { kind: "kinetic"; m: KineticPatternModule } | { kind: "static"; m: Static3DPatternModule };

const SCENES: Record<string, Scene3D> = {
  "louvre-cascade": { kind: "kinetic", m: louvreCascade },
  "radial-pulse-panels": { kind: "kinetic", m: radialPulse },
  "hinged-flap-grid": { kind: "static", m: hingedFlap },
  "rotated-brick-screen": { kind: "static", m: rotatedBrick },
  "solar-budget-skin": { kind: "static", m: solarSkin },
  "adaptive-panel": { kind: "static", m: adaptivePanel },
};

export const THUMB_SIZE = 512;

// ---------------------------------------------------------------- backplate tint (pure)
const SHADE: [number, number, number] = [0x2a, 0x2a, 0x2a];
const LIT: [number, number, number] = [0xd9, 0xa1, 0x2a];
const RANGE = LIT[0] - SHADE[0] + (LIT[1] - SHADE[1]) + (LIT[2] - SHADE[2]);

/** RGBA bytes for the n x n map (transmitted share), bottom row first as a DataTexture reads it. */
export function backplatePixels(map: number[]): Uint8Array {
  const n = Math.round(Math.sqrt(map.length));
  const px = new Uint8Array(4 * n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const t = Math.min(1, Math.max(0, map[r * n + c]));
      const o = 4 * ((n - 1 - r) * n + c);
      for (let k = 0; k < 3; k++) px[o + k] = Math.round(SHADE[k] + (LIT[k] - SHADE[k]) * t);
      px[o + 3] = 255;
    }
  }
  return px;
}

/** Inverse of the tint: transmitted share from one backplate pixel. */
export function shareFromTint(r: number, g: number, b: number): number {
  return (r - SHADE[0] + (g - SHADE[1]) + (b - SHADE[2])) / RANGE;
}

// ---------------------------------------------------------------- shared renderer
let shared: THREE.WebGLRenderer | null | undefined;

/** The one offscreen renderer; null when there is no DOM or no WebGL2. */
function getRenderer(): THREE.WebGLRenderer | null {
  if (shared !== undefined) return shared;
  shared = null;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = THUMB_SIZE;
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  try {
    const r = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
    r.setPixelRatio(1);
    r.setSize(THUMB_SIZE, THUMB_SIZE, false);
    // As @react-three/fiber sets it for the detail canvases (PCFSoft is removed in this three; PCF is what it falls back to).
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor("#0d0d0d");
    shared = r;
  } catch {
    shared = null;
  }
  return shared;
}

function setMatrices(mesh: THREE.InstancedMesh, count: number, at: (i: number) => ElementTransform) {
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const t = at(i);
    mesh.setMatrixAt(i, m.fromArray(composeMatrix(t.position, t.rotation, t.scale)));
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}

/** Backplate on the glazing plane over the scored window, tinted from the ray map. */
function backplate(slug: string): THREE.Mesh | null {
  const boxes = getBoxes(slug);
  const badge = getBadge(slug);
  if (!boxes || !badge) return null;
  const w = boxWindow(boxes);
  const n = Math.round(Math.sqrt(badge.map.length));
  const tex = new THREE.DataTexture(backplatePixels(badge.map), n, n, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, w.y1 - w.y0), mat);
  plane.position.set((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, w.z);
  plane.receiveShadow = true;
  return plane;
}

/** Static scene as Pattern3DCanvas draws it: camera, lights, frame ring, leaves, instance colours. */
function staticScene(m: Static3DPatternModule, scene: THREE.Scene): { camera: THREE.PerspectiveCamera; mesh: THREE.InstancedMesh } {
  const p = m.defaults;
  const count = m.getElementCount(p);
  const size = m.getInstanceSize(p);
  const offset = m.getGeometryOffset?.(p) ?? [0, 0, 0];
  const ext = m.getGridExtents?.(p) ?? { width: Math.round(p.cols ?? 8) * 1.2, height: Math.round(p.rows ?? 8) * 1.2 };
  const cz = Math.max(10, Math.max(ext.width, ext.height, 4) * 1.45);
  const camera = new THREE.PerspectiveCamera(m.getFov?.(p, 1) ?? 42, 1, 0.1, 1000);
  camera.position.set(...(m.getCameraPosition?.(p) ?? [cz * 0.45, cz * 0.28, cz]));

  scene.add(new THREE.AmbientLight(0xffffff, 0.42));
  scene.add(new THREE.HemisphereLight("#f2f0ea", "#3a3a3a", 0.45));
  const keyPos = m.getLightPosition ? m.getLightPosition(p) : ([7, 10, 8] as [number, number, number]);
  if (keyPos) {
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(...keyPos);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { near: 0.5, far: 60, left: -20, right: 20, top: 20, bottom: -20 });
    key.shadow.bias = -0.0002;
    scene.add(key);
  }
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-6, 4, -5);
  scene.add(fill);

  const limit = Math.max(count, 1);
  const frameGeo = m.getFrameTransform ? buildDoorFrameGeometry(size, p.frameWidth ?? 0) : null;
  if (frameGeo && m.getFrameTransform) {
    const frame = new THREE.InstancedMesh(frameGeo, new THREE.MeshStandardMaterial({ color: "#c8c8c8", roughness: 0.8, metalness: 0.04 }), limit);
    frame.castShadow = frame.receiveShadow = true;
    frame.frustumCulled = false;
    const at = m.getFrameTransform;
    setMatrices(frame, count, (i) => at(i, p));
    scene.add(frame);
  }
  const mesh = new THREE.InstancedMesh(buildPanelGeometry(size, offset), new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.85, metalness: 0 }), limit);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  setMatrices(mesh, count, (i) => m.getElementTransform(i, p));
  if (m.getInstanceColor) {
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) mesh.setColorAt(i, c.set(m.getInstanceColor(i, p)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  scene.add(mesh);
  return { camera, mesh };
}

/** Kinetic scene as KineticPatternCanvas draws it, frozen at t = 0. */
function kineticScene(m: KineticPatternModule, scene: THREE.Scene): { camera: THREE.PerspectiveCamera; mesh: THREE.InstancedMesh } {
  const p = m.defaults;
  const count = m.getElementCount(p);
  const cz = Math.max(8, Math.max(Math.round(p.rows ?? 8), Math.round(p.cols ?? 8)) * 1.1 * 1.35);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  camera.position.set(cz * 0.55, cz * 0.35, cz);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(6, 8, 5);
  scene.add(key);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(...m.getInstanceSize(p)), new THREE.MeshStandardMaterial({ color: "#e8e8e8", metalness: 0.12, roughness: 0.58 }), Math.max(count, 1));
  mesh.frustumCulled = false;
  setMatrices(mesh, count, (i) => m.getElementTransform(i, p, m.kineticDefaults, 0));
  scene.add(mesh);
  return { camera, mesh };
}

function dispose(scene: THREE.Scene) {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.MeshBasicMaterial | undefined;
    mat?.map?.dispose();
    mat?.dispose();
    (o as THREE.DirectionalLight).shadow?.dispose();
  });
}

function draw(slug: string): Thumb | null {
  const s = SCENES[slug];
  const r = s && getRenderer();
  if (!s || !r) return null;
  const scene = new THREE.Scene();
  const { camera, mesh } = s.kind === "kinetic" ? kineticScene(s.m, scene) : staticScene(s.m, scene);
  camera.lookAt(0, 0, 0);
  const plate = backplate(slug);
  if (plate) scene.add(plate);
  r.render(scene, camera);
  const thumb = { url: r.domElement.toDataURL("image/png"), instances: mesh.count };
  dispose(scene);
  return thumb;
}

/** Resolves after the page has painted and the main thread is idle. */
function afterFirstPaint(): Promise<void> {
  return new Promise((done) =>
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (typeof requestIdleCallback === "function") requestIdleCallback(() => done(), { timeout: 2000 });
        else done();
      }, 0),
    ),
  );
}

const cache = new Map<string, Promise<Thumb | null>>();
let queue: Promise<unknown> = Promise.resolve();

/** 3D thumbnail for a gallery slug, cached; null for flat patterns or without WebGL. Renders one at a time after first paint. */
export function renderThumb3D(slug: string): Promise<Thumb | null> {
  if (!SCENES[slug] || typeof document === "undefined") return Promise.resolve(null);
  const hit = cache.get(slug);
  if (hit) return hit;
  const job = queue.then(afterFirstPaint).then(() => draw(slug));
  queue = job.catch(() => null);
  cache.set(slug, job);
  return job;
}
