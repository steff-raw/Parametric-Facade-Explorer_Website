/**
 * Pattern Performance Badge: which real 3D instances each pattern is scored from (P-0038).
 *
 * Adapters only pick instances from the modules at their own defaults (kinetic at t = 0);
 * they hold no shading formulas. Patterns without a 3D model return null (badge "n/a").
 */

import { kineticModule as louvreCascade } from "../patterns-3d/louvre-cascade";
import { kineticModule as radialPulse } from "../patterns-3d/radial-pulse-panels";
import { static3dModule as hingedFlap } from "../patterns-3d/hinged-flap-grid";
import { static3dModule as rotatedBrick } from "../patterns-3d/rotated-brick-screen";
import { static3dModule as solarSkin } from "../patterns-3d/solar-budget-skin";
import { ROWS as ADAPTIVE_ROWS, static3dModule as adaptivePanel } from "../patterns-3d/adaptive-panel";
import { DEFAULT_CONTEXT } from "../patterns-3d/solar-budget-skin/engine";
import type { ElementTransform, KineticPatternModule } from "../patterns-3d/shared/types";
import { composeMatrix, type Vec3 } from "./matrix";
import { scoreBoxes, type Box } from "./raycast";

/** Door-frame ring as `buildDoorFrameGeometry` in Pattern3DCanvas draws it (drift-guarded by the check script). */
export const FRAME_CLEARANCE = 0.012;
const frameDepth = (t: number) => Math.max(t * 0.85, 0.02);

export function boxesFromTransforms(count: number, size: Vec3, at: (i: number) => ElementTransform, offset?: Vec3): Box[] {
  return Array.from({ length: count }, (_, i) => {
    const t = at(i);
    return { matrix: composeMatrix(t.position, t.rotation, t.scale), size, offset };
  });
}

const nonZero = (b: Box) => [0, 1, 2].every((k) => Math.hypot(b.matrix[4 * k], b.matrix[4 * k + 1], b.matrix[4 * k + 2]) > 0);

function kinetic(m: KineticPatternModule): Box[] {
  const p = m.defaults;
  return boxesFromTransforms(m.getElementCount(p), m.getInstanceSize(p), (i) => m.getElementTransform(i, p, m.kineticDefaults, 0));
}

/** Leaves with hinge offset, plus each frame ring as 4 bars (top, bottom, left, right). */
function hinged(): Box[] {
  const m = hingedFlap;
  const p = m.defaults;
  const n = m.getElementCount(p);
  const size = m.getInstanceSize(p);
  const leaves = boxesFromTransforms(n, size, (i) => m.getElementTransform(i, p), m.getGeometryOffset?.(p));
  const fw = p.frameWidth ?? 0;
  if (!m.getFrameTransform || fw <= 0.001) return leaves;
  const [w, h, t] = size;
  const outerW = w + 2 * fw;
  const innerW = w + 2 * FRAME_CLEARANCE, innerH = h + 2 * FRAME_CLEARANCE;
  const bar = fw - FRAME_CLEARANCE;
  const d = frameDepth(t);
  const bars: [Vec3, Vec3][] = [
    [[outerW, bar, d], [0, innerH / 2 + bar / 2, 0]],
    [[outerW, bar, d], [0, -innerH / 2 - bar / 2, 0]],
    [[bar, innerH, d], [-innerW / 2 - bar / 2, 0, 0]],
    [[bar, innerH, d], [innerW / 2 + bar / 2, 0, 0]],
  ];
  const frames = bars.flatMap(([s, o]) => boxesFromTransforms(n, s, (i) => m.getFrameTransform!(i, p), o));
  return [...leaves, ...frames];
}

/** Static wall only: wall 0 blade instances (indices 2 ROWS ... 3 ROWS - 1); glass excluded. */
function adaptive(): Box[] {
  const m = adaptivePanel;
  const p = m.defaults;
  const all = boxesFromTransforms(m.getElementCount(p), m.getInstanceSize(p), (i) => m.getElementTransform(i, p));
  return all.slice(2 * ADAPTIVE_ROWS, 3 * ADAPTIVE_ROWS).filter(nonZero);
}

/** Skin array only: parts 2..4 of each cell (blade, left fin, right fin); glass and bare array excluded. */
function solarBudget(): Box[] {
  const m = solarSkin;
  const p = m.defaults;
  const count = m.getElementCount(p);
  const parts = count / (DEFAULT_CONTEXT.rows * DEFAULT_CONTEXT.cols);
  const all = boxesFromTransforms(count, m.getInstanceSize(p), (i) => m.getElementTransform(i, p));
  return all.filter((b, i) => i % parts >= 2 && nonZero(b));
}

const ADAPTERS: Record<string, () => Box[]> = {
  "louvre-cascade": () => kinetic(louvreCascade),
  "radial-pulse-panels": () => kinetic(radialPulse),
  "hinged-flap-grid": hinged,
  "rotated-brick-screen": () => {
    const m = rotatedBrick;
    const p = m.defaults;
    return boxesFromTransforms(m.getElementCount(p), m.getInstanceSize(p), (i) => m.getElementTransform(i, p));
  },
  "adaptive-panel": adaptive,
  "solar-budget-skin": solarBudget,
};

export function getBoxes(slug: string): Box[] | null {
  return ADAPTERS[slug]?.() ?? null;
}

export interface Badge {
  blocks: number;
  winterKept: number;
  map: number[];
}

const memo = new Map<string, Badge | null>();

/** Badge at defaults, south, 51.5 N; null = no 3D model (n/a). Memoised per slug. */
export function getBadge(slug: string): Badge | null {
  if (memo.has(slug)) return memo.get(slug)!;
  const boxes = getBoxes(slug);
  const s = boxes && scoreBoxes(boxes);
  const badge = s ? { blocks: s.blocks, winterKept: s.winterKept, map: s.map } : null;
  memo.set(slug, badge);
  return badge;
}
