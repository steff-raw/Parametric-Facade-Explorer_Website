/**
 * Radial Pulse Panels — kinetic 3D rainscreen modules
 *
 * Flat panel grid on the façade plane. Each panel translates in Z following a
 * radial sine pulse from the array center — a breathing / ripple surface.
 */

import {
  PatternMeta,
  PatternParams,
  defaultsFromMeta,
  kineticDefaultsFromMeta,
  staticDefaultsFromMeta,
} from "../../patterns/shared/types";
import { ElementTransform, KineticPatternModule } from "../shared/types";
import { STROKE, STROKE_WIDTH } from "../../patterns/shared/math";

export const meta: PatternMeta = {
  slug: "radial-pulse-panels",
  name: "Radial Pulse Panels",
  description:
    "Rainscreen modules that push and pull along the façade normal as a radial wave expands from the bay centre. Useful for studying kinetic cladding depth, shadow play, and how amplitude reads at human scale.",
  tags: ["Tessellated", "Parametric Grid", "Kinetic"],
  type: "kinetic-3d",
  popularity: 84,
  createdAt: "2026-09-18",
  staticParams: [
    {
      key: "rows",
      label: "Rows",
      min: 3,
      max: 20,
      step: 1,
      default: 9,
    },
    {
      key: "cols",
      label: "Columns",
      min: 3,
      max: 20,
      step: 1,
      default: 9,
    },
    {
      key: "panelSize",
      label: "Panel size",
      min: 0.3,
      max: 1.5,
      step: 0.05,
      default: 0.7,
      unit: "m*",
    },
    {
      key: "gap",
      label: "Joint gap",
      min: 0.02,
      max: 0.25,
      step: 0.01,
      default: 0.06,
      unit: "m*",
    },
  ],
  kineticParams: [
    {
      key: "amplitude",
      label: "Z amplitude",
      min: 0,
      max: 0.8,
      step: 0.02,
      default: 0.28,
      unit: "m*",
    },
    {
      key: "frequency",
      label: "Radial frequency",
      min: 0.5,
      max: 5,
      step: 0.1,
      default: 2,
      unit: "cycles",
    },
    {
      key: "phase",
      label: "Phase offset",
      min: 0,
      max: 360,
      step: 1,
      default: 0,
      unit: "°",
    },
    {
      key: "speed",
      label: "Speed",
      min: 0,
      max: 3,
      step: 0.05,
      default: 1.1,
    },
  ],
};

export const defaults = defaultsFromMeta(meta);
export const staticDefaults = staticDefaultsFromMeta(meta);
export const kineticDefaults = kineticDefaultsFromMeta(meta);

export function getElementCount(staticParams: PatternParams): number {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  return rows * cols;
}

export function getInstanceSize(
  staticParams: PatternParams
): [number, number, number] {
  const size = staticParams.panelSize ?? staticDefaults.panelSize;
  const thickness = Math.max(0.02, size * 0.04);
  return [size, size, thickness];
}

export function getElementTransform(
  index: number,
  staticParams: PatternParams,
  kineticParams: PatternParams,
  elapsedTime: number
): ElementTransform {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  const panelSize = staticParams.panelSize ?? staticDefaults.panelSize;
  const gap = staticParams.gap ?? staticDefaults.gap;

  const amplitude = kineticParams.amplitude ?? kineticDefaults.amplitude;
  const frequency = kineticParams.frequency ?? kineticDefaults.frequency;
  const phaseDeg = kineticParams.phase ?? kineticDefaults.phase;
  const speed = kineticParams.speed ?? kineticDefaults.speed;

  const col = index % cols;
  const row = Math.floor(index / cols);

  const pitch = panelSize + gap;
  const x = (col - (cols - 1) / 2) * pitch;
  const y = ((rows - 1) / 2 - row) * pitch;

  // Normalized radius from array centre (0 at centre → ~1 at corner)
  const maxR = Math.hypot((cols - 1) / 2, (rows - 1) / 2) || 1;
  const r = Math.hypot(col - (cols - 1) / 2, row - (rows - 1) / 2) / maxR;

  const phase = (phaseDeg * Math.PI) / 180;
  const z =
    amplitude *
    Math.sin(2 * Math.PI * (frequency * r) - elapsedTime * speed + phase);

  return {
    position: [x, y, z],
    rotation: [0, 0, 0],
  };
}

export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = { ...staticDefaults, ...staticParams };
  const rows = Math.min(9, Math.round(p.rows));
  const cols = Math.min(9, Math.round(p.cols));
  const size = 800;
  const margin = 70;
  const usable = size - margin * 2;
  const cellW = usable / cols;
  const cellH = usable / rows;
  const pad = 0.12;
  const rects: string[] = [];
  const maxR = Math.hypot((cols - 1) / 2, (rows - 1) / 2) || 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rad =
        Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) / maxR;
      const opacity = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(rad * Math.PI * 2));
      const x = margin + c * cellW + cellW * pad;
      const y = margin + r * cellH + cellH * pad;
      const w = cellW * (1 - pad * 2);
      const h = cellH * (1 - pad * 2);
      rects.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="none" stroke="${STROKE}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" vector-effect="non-scaling-stroke" />`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%"><style>line,path,circle,rect,polygon,polyline{vector-effect:non-scaling-stroke}</style>${rects.join("")}</svg>`;
}

export const kineticModule: KineticPatternModule = {
  meta,
  defaults,
  kineticDefaults,
  getElementCount,
  getElementTransform,
  getInstanceSize,
  generatePreviewSvg,
};
