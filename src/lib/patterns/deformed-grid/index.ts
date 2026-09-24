/**
 * Deformed Grid Mesh
 *
 * Rainscreen-style panel grid warped by smooth noise.
 * Emits one line primitive per grid edge — rendered as React SVG <line>
 * DOM nodes (bookofshapes approach), never canvas.
 */

import {
  PatternMeta,
  PatternParams,
  PatternResult,
  SvgPrimitive,
  defaultsFromMeta,
} from "../shared/types";
import {
  SVG_SIZE,
  serializePrimitivesToSvg,
  valueNoise2D,
} from "../shared/math";

export const meta: PatternMeta = {
  slug: "deformed-grid",
  name: "Deformed Grid Mesh",
  description:
    "A rainscreen-style panel grid gently warped by a continuous noise field. Architects use this kind of deformation to break the flatness of curtain-wall modules without abandoning a regular joint layout — useful for studying how light catches undulating cladding.",
  tags: ["Parametric Grid", "Tessellated"],
  popularity: 92,
  createdAt: "2026-03-12",
  type: "static-2d",
  staticParams: [
    {
      key: "columns",
      label: "Columns",
      min: 4,
      max: 32,
      step: 1,
      default: 12,
      unit: "panels",
    },
    {
      key: "rows",
      label: "Rows",
      min: 4,
      max: 32,
      step: 1,
      default: 12,
      unit: "panels",
    },
    {
      key: "warp",
      label: "Warp amount",
      min: 0,
      max: 80,
      step: 1,
      default: 28,
      unit: "mm*",
    },
    {
      key: "noiseScale",
      label: "Noise scale",
      min: 0.5,
      max: 8,
      step: 0.1,
      default: 2.4,
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

export function generate(params: PatternParams): PatternResult {
  const cols = Math.round(params.columns ?? defaults.columns);
  const rows = Math.round(params.rows ?? defaults.rows);
  const warp = params.warp ?? defaults.warp;
  const noiseScale = params.noiseScale ?? defaults.noiseScale;
  const seed = Math.round(params.seed ?? defaults.seed);

  const margin = 48;
  const usable = SVG_SIZE - margin * 2;
  const warpPx = warp * 0.55;

  type Pt = { x: number; y: number };
  const pts: Pt[][] = [];

  for (let j = 0; j <= rows; j++) {
    const row: Pt[] = [];
    for (let i = 0; i <= cols; i++) {
      const ux = i / cols;
      const uy = j / rows;
      const nx = valueNoise2D(ux * noiseScale, uy * noiseScale, seed);
      const ny = valueNoise2D(
        ux * noiseScale + 17.3,
        uy * noiseScale + 9.1,
        seed + 1
      );
      row.push({
        x: margin + ux * usable + (nx - 0.5) * 2 * warpPx,
        y: margin + uy * usable + (ny - 0.5) * 2 * warpPx,
      });
    }
    pts.push(row);
  }

  const primitives: SvgPrimitive[] = [];
  let connectionCount = 0;

  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = pts[j][i];
      const b = pts[j][i + 1];
      primitives.push({ type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      connectionCount++;
    }
  }

  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = pts[j][i];
      const b = pts[j + 1][i];
      primitives.push({ type: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      connectionCount++;
    }
  }

  const nodeCount = (cols + 1) * (rows + 1);

  return {
    size: SVG_SIZE,
    primitives,
    svg: serializePrimitivesToSvg(primitives, SVG_SIZE),
    stats: {
      elementCount: primitives.length,
      nodeCount,
      connectionCount,
    },
  };
}
