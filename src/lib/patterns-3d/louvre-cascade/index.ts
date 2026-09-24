/**
 * Louvre Cascade — kinetic 3D brise-soleil array
 *
 * Horizontal louvre blades on a flat facade grid. Each blade rotates about its
 * long axis following a sine wave driven by column position + elapsed time,
 * so a ripple travels across the surface.
 *
 * getElementTransform is pure and deterministic.
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
  slug: "louvre-cascade",
  name: "Louvre Cascade",
  description:
    "A kinetic brise-soleil field where each blade tilts on its long axis as a sine wave travels across the façade. Tune amplitude and frequency to study solar cut-off over time, or pause to inspect a single pose for detailing.",
  tags: ["Louvre", "Brise-Soleil", "Kinetic"],
  type: "kinetic-3d",
  popularity: 90,
  createdAt: "2026-09-18",
  staticParams: [
    {
      key: "rows",
      label: "Rows",
      min: 2,
      max: 24,
      step: 1,
      default: 10,
    },
    {
      key: "cols",
      label: "Columns",
      min: 2,
      max: 36,
      step: 1,
      default: 16,
    },
    {
      key: "bladeLength",
      label: "Blade length",
      min: 0.4,
      max: 2.4,
      step: 0.05,
      default: 1.0,
      unit: "m*",
    },
    {
      key: "bladeWidth",
      label: "Blade width",
      min: 0.08,
      max: 0.5,
      step: 0.01,
      default: 0.18,
      unit: "m*",
    },
    {
      key: "spacing",
      label: "Base spacing",
      min: 0.02,
      max: 0.4,
      step: 0.01,
      default: 0.08,
      unit: "m*",
    },
  ],
  kineticParams: [
    {
      key: "amplitude",
      label: "Amplitude",
      min: 0,
      max: 75,
      step: 1,
      default: 35,
      unit: "°",
    },
    {
      key: "frequency",
      label: "Frequency",
      min: 0.25,
      max: 4,
      step: 0.05,
      default: 1.25,
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
      default: 0.85,
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
  const length = staticParams.bladeLength ?? staticDefaults.bladeLength;
  const width = staticParams.bladeWidth ?? staticDefaults.bladeWidth;
  const thickness = Math.max(0.012, width * 0.08);
  // Box: X = long axis, Y = thin edge when flat, Z = chord width
  return [length, thickness, width];
}

/**
 * Pure per-blade transform.
 * Rotation about local X (long axis) follows a traveling sine wave in column space.
 */
export function getElementTransform(
  index: number,
  staticParams: PatternParams,
  kineticParams: PatternParams,
  elapsedTime: number
): ElementTransform {
  const rows = Math.round(staticParams.rows ?? staticDefaults.rows);
  const cols = Math.round(staticParams.cols ?? staticDefaults.cols);
  const bladeLength = staticParams.bladeLength ?? staticDefaults.bladeLength;
  const bladeWidth = staticParams.bladeWidth ?? staticDefaults.bladeWidth;
  const spacing = staticParams.spacing ?? staticDefaults.spacing;

  const amplitudeDeg = kineticParams.amplitude ?? kineticDefaults.amplitude;
  const frequency = kineticParams.frequency ?? kineticDefaults.frequency;
  const phaseDeg = kineticParams.phase ?? kineticDefaults.phase;
  const speed = kineticParams.speed ?? kineticDefaults.speed;

  const col = index % cols;
  const row = Math.floor(index / cols);

  const pitchX = bladeLength + spacing;
  const pitchY = bladeWidth + spacing;

  const x = (col - (cols - 1) / 2) * pitchX;
  const y = ((rows - 1) / 2 - row) * pitchY;
  const z = 0;

  const nx = cols <= 1 ? 0 : col / (cols - 1);
  const phase = (phaseDeg * Math.PI) / 180;
  const amplitude = (amplitudeDeg * Math.PI) / 180;
  const rotX =
    amplitude *
    Math.sin(2 * Math.PI * (frequency * nx) + phase + elapsedTime * speed);

  return {
    position: [x, y, z],
    rotation: [rotX, 0, 0],
  };
}

/** Flat 2D silhouette for gallery cards (no WebGL) */
export function generatePreviewSvg(staticParams?: PatternParams): string {
  const p = { ...staticDefaults, ...staticParams };
  const rows = Math.min(8, Math.round(p.rows));
  const cols = Math.min(12, Math.round(p.cols));
  const size = 800;
  const margin = 60;
  const usable = size - margin * 2;
  const cellW = usable / cols;
  const cellH = usable / rows;
  const lines: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = cols <= 1 ? 0 : c / (cols - 1);
      const tilt = Math.sin(nx * Math.PI * 2 * 1.25) * 10;
      const cx = margin + (c + 0.5) * cellW;
      const cy = margin + (r + 0.5) * cellH;
      const hw = cellW * 0.38;
      lines.push(
        `<line x1="${(cx - hw).toFixed(2)}" y1="${cy.toFixed(2)}" x2="${(cx + hw).toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${STROKE}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" vector-effect="non-scaling-stroke" transform="rotate(${tilt} ${cx} ${cy})" />`
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%"><style>line,path,circle,rect,polygon,polyline{vector-effect:non-scaling-stroke}</style>${lines.join("")}</svg>`;
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
