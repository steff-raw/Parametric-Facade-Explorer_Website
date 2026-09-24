/**
 * Perforated Screen — SVG primitives for React DOM rendering.
 * Hole shapes are selectable motifs (reference atlas) instead of only circles.
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
  hash2,
  mulberry32,
  serializePrimitivesToSvg,
} from "../shared/math";
import { HOLE_MOTIF_COUNT, buildMotifPrimitives } from "./motifs";

export const meta: PatternMeta = {
  slug: "perforated-screen",
  name: "Perforated Screen",
  description:
    "A punched-metal privacy screen with controllable open-area ratio. Choose a hole motif from the reference library, then vary size, density, and randomness — the same language used on perforated aluminium rainscreens and balcony shrouds.",
  tags: ["Perforated", "Parametric Grid"],
  popularity: 95,
  createdAt: "2026-05-18",
  type: "static-2d",
  staticParams: [
    {
      key: "density",
      label: "Hole density",
      min: 4,
      max: 28,
      step: 1,
      default: 14,
      unit: "/m*",
    },
    {
      key: "holeSize",
      label: "Hole size",
      min: 4,
      max: 40,
      step: 1,
      default: 14,
      unit: "mm*",
    },
    {
      key: "randomness",
      label: "Randomness",
      min: 0,
      max: 100,
      step: 1,
      default: 35,
      unit: "%",
    },
    {
      key: "jitter",
      label: "Position jitter",
      min: 0,
      max: 50,
      step: 1,
      default: 15,
      unit: "%",
    },
    {
      key: "seed",
      label: "Pattern seed",
      min: 1,
      max: 999,
      step: 1,
      default: 7,
    },
    {
      key: "holeShape",
      label: "Hole motif",
      min: 0,
      max: HOLE_MOTIF_COUNT - 1,
      step: 1,
      default: 0,
    },
  ],
};

export const defaults = defaultsFromMeta(meta);

export function generate(params: PatternParams): PatternResult {
  const density = Math.round(params.density ?? defaults.density);
  const holeSize = params.holeSize ?? defaults.holeSize;
  const randomness = (params.randomness ?? defaults.randomness) / 100;
  const jitter = (params.jitter ?? defaults.jitter) / 100;
  const seed = Math.round(params.seed ?? defaults.seed);
  const holeShape = Math.round(params.holeShape ?? defaults.holeShape);

  const margin = 56;
  const usable = SVG_SIZE - margin * 2;
  const cols = density;
  const rows = density;
  const cell = usable / cols;
  const baseR = holeSize * 0.45;

  const rand = mulberry32(seed);
  const primitives: SvgPrimitive[] = [
    {
      type: "rect",
      x: margin,
      y: margin,
      width: usable,
      height: usable,
      opacity: 0.4,
    },
  ];
  let nodeCount = 0;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (rand() < randomness * 0.45) continue;

      const cx0 = margin + (i + 0.5) * cell;
      const cy0 = margin + (j + 0.5) * cell;
      const jx = (hash2(i, j, seed) - 0.5) * 2 * jitter * cell * 0.8;
      const jy = (hash2(i + 3, j + 5, seed) - 0.5) * 2 * jitter * cell * 0.8;
      const sizeVar = 1 + (rand() - 0.5) * 2 * randomness * 0.5;
      const r = Math.max(1.2, baseR * sizeVar);

      const motifParts = buildMotifPrimitives(
        holeShape,
        cx0 + jx,
        cy0 + jy,
        r
      );
      primitives.push(...motifParts);
      nodeCount += motifParts.length;
    }
  }

  return {
    size: SVG_SIZE,
    primitives,
    svg: serializePrimitivesToSvg(primitives, SVG_SIZE),
    stats: {
      elementCount: primitives.length,
      nodeCount,
      connectionCount: nodeCount,
    },
  };
}

export { HOLE_MOTIFS, MOTIF_SHEETS, getMotif, HOLE_MOTIF_COUNT } from "./motifs";
