/**
 * Pattern Performance Badge: gallery thumbnail as a real 3D render (P-0038, Stage 2).
 *
 * One shared offscreen THREE.WebGLRenderer draws each 3D pattern's instanced mesh at its
 * defaults (kinetic at t = 0) with the detail-page camera and lights, no backplate (the badge carries the score). The image is
 * rendered on an OffscreenCanvas inside thumb3d.worker (off the main thread) and encoded with
 * convertToBlob. No OffscreenCanvas / WebGL2: null, so callers keep the existing SVG preview.
 */

import * as THREE from "three";
import { kineticModule as louvreCascade } from "../patterns-3d/louvre-cascade";
import { kineticModule as radialPulse } from "../patterns-3d/radial-pulse-panels";
import { static3dModule as hingedFlap } from "../patterns-3d/hinged-flap-grid";
import { static3dModule as rotatedBrick } from "../patterns-3d/rotated-brick-screen";
import { static3dModule as solarSkin } from "../patterns-3d/solar-budget-skin";
import { static3dModule as adaptivePanel } from "../patterns-3d/adaptive-panel";
import type { ElementTransform, KineticPatternModule, Static3DPatternModule } from "../patterns-3d/shared/types";
import { buildDoorFrameGeometry, buildPanelGeometry } from "./geometry";
import { composeMatrix } from "./matrix";

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

// ---------------------------------------------------------------- shared renderer
let shared: THREE.WebGLRenderer | null | undefined;

/** The one renderer, on an OffscreenCanvas (in the worker); null without OffscreenCanvas or WebGL2. */
function getRenderer(): THREE.WebGLRenderer | null {
  if (shared !== undefined) return shared;
  shared = null;
  if (typeof OffscreenCanvas === "undefined") return null;
  const canvas = new OffscreenCanvas(THUMB_SIZE, THUMB_SIZE);
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

/**
 * Safe box in NDC of the square card thumbnail: content fits inside it. Top band leaves room for the top-left sun badge
 * (12 px + 38 px on a 342 px phone card), bottom band for the bottom-left 3D icon.
 */
export const SAFE_BOX = { x0: -0.9, x1: 0.9, y0: -0.76, y1: 0.68 };

/** Every drawn instance's box corners in world space. */
function contentPoints(scene: THREE.Scene): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const m = new THREE.Matrix4();
  scene.traverse((o) => {
    const mesh = o as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh) return;
    mesh.geometry.computeBoundingBox();
    const g = mesh.geometry.boundingBox!;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      for (let k = 0; k < 8; k++) pts.push(new THREE.Vector3(k & 1 ? g.max.x : g.min.x, k & 2 ? g.max.y : g.min.y, k & 4 ? g.max.z : g.min.z).applyMatrix4(m));
    }
  });
  return pts;
}

/**
 * Fit-to-content: keep the detail page's view direction, then set distance and a sideways shift so the projected
 * content fills SAFE_BOX on its limiting axis, centred in it, at the card aspect.
 */
function fitCamera(camera: THREE.PerspectiveCamera, scene: THREE.Scene, aspect = 1) {
  const pts = contentPoints(scene);
  if (!pts.length) return;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const dir = camera.position.clone().normalize();
  const target = new THREE.Box3().setFromPoints(pts).getCenter(new THREE.Vector3());
  let d = camera.position.length();
  const right = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3();
  const B = SAFE_BOX;
  for (let it = 0; it < 12; it++) {
    camera.position.copy(target).addScaledVector(dir, d);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of pts) {
      v.copy(p).project(camera);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const fill = Math.max((x1 - x0) / (B.x1 - B.x0), (y1 - y0) / (B.y1 - B.y0));
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    // Move the camera so the content centre lands on the safe-box centre (its offset scales with the zoom below).
    const [sx, sy] = [(x0 + x1) / 2 - ((B.x0 + B.x1) / 2) * fill, (y0 + y1) / 2 - ((B.y0 + B.y1) / 2) * fill];
    target.addScaledVector(right, sx * half * aspect).addScaledVector(up, sy * half);
    d *= fill;
  }
  camera.position.copy(target).addScaledVector(dir, d);
  camera.lookAt(target);
  camera.updateMatrixWorld();
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

/** Thumbnail scene for a 3D slug (no renderer needed): meshes and a camera framed to the square card. */
export function buildThumbScene(slug: string) {
  const s = SCENES[slug];
  const scene = new THREE.Scene();
  const { camera, mesh } = s.kind === "kinetic" ? kineticScene(s.m, scene) : staticScene(s.m, scene);
  fitCamera(camera, scene);
  return { scene, camera, mesh, count: s.m.getElementCount(s.m.defaults) };
}

/** Render one thumbnail and encode it (convertToBlob, async). Runs inside thumb3d.worker; null without OffscreenCanvas / WebGL2. */
export async function drawThumb(slug: string): Promise<{ blob: Blob; instances: number } | null> {
  const r = SCENES[slug] && getRenderer();
  if (!r) return null;
  const { scene, camera, mesh } = buildThumbScene(slug);
  r.render(scene, camera);
  dispose(scene);
  const blob = await (r.domElement as unknown as OffscreenCanvas).convertToBlob({ type: "image/webp", quality: 0.9 });
  return { blob, instances: mesh.count };
}
