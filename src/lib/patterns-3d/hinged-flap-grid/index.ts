/**
 * Hinged Flap Grid — static-3d
 *
 * Flat panels hinged on a chosen edge (top / right / bottom / left), rotating
 * inward from flush (0°) to maxAngle. Optional edge frame rim per panel.
 *
 * TODO(v2): independent hinge direction per panel
 * TODO(v2): promote to kinetic-3d by feeding elapsedTime into getFlapAngle
 */

import {
  PatternMeta,
  PatternParams,
  defaultsFromMeta,
  staticDefaultsFromMeta,
} from "../../patterns/shared/types";
import {
  hash2,
  valueNoise2D,
  STROKE,
  STROKE_WIDTH,
} from "../../patterns/shared/math";
import {
  ElementTransform,
  Static3DPatternModule,
} from "../shared/types";

/** 0 Top · 1 Right · 2 Bottom · 3 Left */
export const HINGE_SIDES = ["Top", "Right", "Bottom", "Left"] as const;

export const meta: PatternMeta = {
  slug: "hinged-flap-grid",
  name: "Hinged Flap Grid",
  description:
    "A rainscreen of hinged door flaps that swing open from a chosen edge. Fixed door frames sit coplanar on the host surface and surround each leaf from the outside — panels move; frames stay put.",
  tags: ["Parametric Grid", "Tessellated"],
  type: "static-3d",
  popularity: 86,
  createdAt: "2026-09-18",
  staticParams: [
    {
      key: "rows",
      label: "Rows",
      min: 4,
      max: 20,
      step: 1,
      default: 8,
    },
    {
      key: "cols",
      label: "Columns",
      min: 4,
      max: 20,
      step: 1,
      default: 8,
    },
    {
      key: "panelWidth",
      label: "Panel Width",
      min: 0.3,
      max: 3,
      step: 0.05,
      default: 1.2,
      unit: "m*",
    },
    {
      key: "panelHeight",
      label: "Panel Height",
      min: 0.3,
      max: 3,
      step: 0.05,
      default: 1.2,
      unit: "m*",
    },
    {
      key: "panelThickness",
      label: "Panel Thickness",
      min: 0.01,
      max: 0.15,
      step: 0.005,
      default: 0.03,
      unit: "m*",
    },
    {
      key: "frameWidth",
      label: "Frame thickness",
      min: 0,
      max: 0.35,
      step: 0.01,
      default: 0.06,
      unit: "m*",
    },
    {
      key: "gapX",
      label: "Gap (Horizontal)",
      min: 0,
      max: 0.5,
      step: 0.01,
      default: 0.1,
      unit: "m*",
    },
    {
      key: "gapY",
      label: "Gap (Vertical)",
      min: 0,
      max: 0.5,
      step: 0.01,
      default: 0.1,
      unit: "m*",
    },
    {
      key: "hingeSide",
      label: "Hinge side",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: ["Top", "Right", "Bottom", "Left"],
    },
    {
      key: "maxAngle",
      label: "Max Open Angle",
      min: 0,
      max: 90,
      step: 1,
      default: 45,
      unit: "°",
    },
    {
      key: "anglePattern",
      label: "Angle Pattern",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: ["Noise", "Radial", "Diagonal", "Random"],
    },
    {
      key: "seed",
      label: "Seed",
      min: 1,
      max: 999,
      step: 1,
      default: 42,
    },
  ],
};

export const defaults = defaultsFromMeta(meta);
export const staticDefaults = staticDefaultsFromMeta(meta);

export function getFlapAngle(
  row: number,
  col: number,
  rows: number,
  cols: number,
  maxAngle: number,
  patternMode: number,
  seed: number
): number {
  const mode = Math.round(patternMode);
  const maxA = Math.max(0, maxAngle);
  let t = 0;

  if (mode === 1) {
    const maxR = Math.hypot((cols - 1) / 2, (rows - 1) / 2) || 1;
    const r =
      Math.hypot(col - (cols - 1) / 2, row - (rows - 1) / 2) / maxR;
    t = 1 - r;
  } else if (mode === 2) {
    const denom = Math.max(1, rows + cols - 2);
    t = (row + col) / denom;
  } else if (mode === 3) {
    t = hash2(col, row, seed);
  } else {
    t = valueNoise2D(col * 0.45, row * 0.45, seed);
  }

  return Math.min(1, Math.max(0, t)) * maxA;
}

export function getElementCount(staticParams: PatternParams): number {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  return rows * cols;
}

export function getInstanceSize(
  staticParams: PatternParams
): [number, number, number] {
  const w = staticParams.panelWidth ?? staticDefaults.panelWidth;
  const h = staticParams.panelHeight ?? staticDefaults.panelHeight;
  const t = staticParams.panelThickness ?? staticDefaults.panelThickness;
  return [w, h, t];
}

/**
 * Pivot offset so the chosen hinge edge sits at local origin.
 * 0 Top · 1 Right · 2 Bottom · 3 Left
 */
export function getGeometryOffset(
  staticParams: PatternParams
): [number, number, number] {
  const w = staticParams.panelWidth ?? staticDefaults.panelWidth;
  const h = staticParams.panelHeight ?? staticDefaults.panelHeight;
  const side = Math.round(staticParams.hingeSide ?? staticDefaults.hingeSide);

  switch (side) {
    case 1: // Right
      return [-w / 2, 0, 0];
    case 2: // Bottom
      return [0, h / 2, 0];
    case 3: // Left
      return [w / 2, 0, 0];
    case 0: // Top
    default:
      return [0, -h / 2, 0];
  }
}

export function getElementTransform(
  index: number,
  staticParams: PatternParams
): ElementTransform {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  const panelWidth = staticParams.panelWidth ?? staticDefaults.panelWidth;
  const panelHeight = staticParams.panelHeight ?? staticDefaults.panelHeight;
  const gapX = staticParams.gapX ?? staticDefaults.gapX;
  const gapY = staticParams.gapY ?? staticDefaults.gapY;
  const maxAngle = staticParams.maxAngle ?? staticDefaults.maxAngle;
  const anglePattern =
    staticParams.anglePattern ?? staticDefaults.anglePattern;
  const seed = Math.round(staticParams.seed ?? staticDefaults.seed);
  const side = Math.round(
    staticParams.hingeSide ?? staticDefaults.hingeSide
  );

  const col = index % cols;
  const row = Math.floor(index / cols);

  const pitchX = panelWidth + gapX;
  const pitchY = panelHeight + gapY;

  const cx = (col - (cols - 1) / 2) * pitchX;
  const cy = ((rows - 1) / 2 - row) * pitchY;

  let hx = cx;
  let hy = cy;
  switch (side) {
    case 1:
      hx = cx + panelWidth / 2;
      break;
    case 2:
      hy = cy - panelHeight / 2;
      break;
    case 3:
      hx = cx - panelWidth / 2;
      break;
    case 0:
    default:
      hy = cy + panelHeight / 2;
      break;
  }

  const angleDeg = getFlapAngle(
    row,
    col,
    rows,
    cols,
    maxAngle,
    anglePattern,
    seed
  );
  const a = (angleDeg * Math.PI) / 180;

  // Open into −Z (cavity). Axis depends on hinge side.
  let rotation: [number, number, number];
  switch (side) {
    case 1: // Right hinge → rotate −Y
      rotation = [0, -a, 0];
      break;
    case 2: // Bottom hinge → rotate −X
      rotation = [-a, 0, 0];
      break;
    case 3: // Left hinge → rotate +Y
      rotation = [0, a, 0];
      break;
    case 0: // Top hinge → rotate +X
    default:
      rotation = [a, 0, 0];
      break;
  }

  return {
    position: [hx, hy, 0],
    rotation,
  };
}

/**
 * Door-frame surround — fixed on the host façade plane (never rotates with the flap).
 * Centered on the panel cell; geometry extends outward by frameWidth.
 */
export function getFrameTransform(
  index: number,
  staticParams: PatternParams
): ElementTransform {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  const panelWidth = staticParams.panelWidth ?? staticDefaults.panelWidth;
  const panelHeight = staticParams.panelHeight ?? staticDefaults.panelHeight;
  const gapX = staticParams.gapX ?? staticDefaults.gapX;
  const gapY = staticParams.gapY ?? staticDefaults.gapY;

  const col = index % cols;
  const row = Math.floor(index / cols);
  const pitchX = panelWidth + gapX;
  const pitchY = panelHeight + gapY;
  const cx = (col - (cols - 1) / 2) * pitchX;
  const cy = ((rows - 1) / 2 - row) * pitchY;

  return {
    position: [cx, cy, 0],
    rotation: [0, 0, 0],
  };
}

export function getGridExtents(staticParams: PatternParams): {
  width: number;
  height: number;
} {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  const panelWidth = staticParams.panelWidth ?? staticDefaults.panelWidth;
  const panelHeight = staticParams.panelHeight ?? staticDefaults.panelHeight;
  const gapX = staticParams.gapX ?? staticDefaults.gapX;
  const gapY = staticParams.gapY ?? staticDefaults.gapY;
  const frameW = staticParams.frameWidth ?? staticDefaults.frameWidth;
  return {
    width: cols * panelWidth + Math.max(0, cols - 1) * gapX + 2 * frameW,
    height: rows * panelHeight + Math.max(0, rows - 1) * gapY + 2 * frameW,
  };
}

export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = { ...staticDefaults, ...staticParams };
  const rows = Math.min(10, Math.round(p.rows));
  const cols = Math.min(10, Math.round(p.cols));
  const size = 800;
  const margin = 70;
  const usable = size - margin * 2;
  const cellW = usable / cols;
  const cellH = usable / rows;
  const parts: string[] = [];
  const fwRatio = Math.min(
    0.18,
    (p.frameWidth ?? 0) / Math.max(p.panelWidth, 0.01)
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const angle = getFlapAngle(
        r,
        c,
        rows,
        cols,
        p.maxAngle,
        p.anglePattern,
        p.seed
      );
      const open = Math.min(1, angle / 90);
      const pad = Math.min(cellW, cellH) * 0.08;
      const outerX = margin + c * cellW + pad * 0.35;
      const outerY = margin + r * cellH + pad * 0.35;
      const outerW = cellW - pad * 0.7;
      const outerH = cellH - pad * 0.7;
      const inset = Math.min(outerW, outerH) * fwRatio;
      // Fixed door frame (outer) — coplanar host surface
      if (inset > 0.5) {
        parts.push(
          `<rect x="${outerX.toFixed(1)}" y="${outerY.toFixed(1)}" width="${outerW.toFixed(1)}" height="${outerH.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-opacity="0.55" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" vector-effect="non-scaling-stroke" />`
        );
      }
      // Leaf foreshortened by open angle
      const leafH = (outerH - inset * 2) * (0.92 - open * 0.55);
      const leafW = outerW - inset * 2;
      const leafX = outerX + inset;
      const leafY = outerY + inset;
      const opacity = 0.35 + (1 - open) * 0.55;
      parts.push(
        `<rect x="${leafX.toFixed(1)}" y="${leafY.toFixed(1)}" width="${leafW.toFixed(1)}" height="${leafH.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" vector-effect="non-scaling-stroke" />`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">${parts.join("")}</svg>`;
}

export const static3dModule: Static3DPatternModule = {
  meta,
  defaults,
  getElementCount,
  getElementTransform,
  getFrameTransform,
  getInstanceSize,
  getGeometryOffset,
  getGridExtents,
  generatePreviewSvg,
};

export function debugAngleGrid(
  mode: number,
  seed = 42,
  rows = 4,
  cols = 4,
  maxAngle = 45
): number[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      Math.round(getFlapAngle(r, c, rows, cols, maxAngle, mode, seed) * 10) /
      10
    )
  );
}
