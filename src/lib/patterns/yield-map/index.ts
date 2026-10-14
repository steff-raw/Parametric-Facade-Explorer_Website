/**
 * Facade Yield Map (BIPV): static-2d (P-0017)
 *
 * Annual clear-sky irradiation per 1.5 m module on a facade shaded by a block,
 * with a relative yield cut-off. The detail view is the slug-gated `YieldMap`
 * SVG; `generate` gives the gallery thumbnail and the SVG/PNG export.
 * Concept-stage estimate, not compliance.
 */

import {
  PatternMeta,
  PatternParams,
  PatternResult,
  SvgPrimitive,
  defaultsFromMeta,
} from "../shared/types";
import { SVG_SIZE } from "../shared/math";
import { compass, formatLatitude } from "../../patterns-3d/solar-budget-skin";
import { COLS, DEFAULT_PARAMS, ROWS, Solution, Stringing, layout, solve } from "./engine";

export const meta: PatternMeta = {
  slug: "facade-yield-map",
  name: "Facade Yield Map",
  description:
    "Annual clear-sky irradiation on each 1.5 m PV module of a facade shaded by a neighbouring block. Modules under a yield cut-off (a share of an unshaded module) are left plain. Concept-stage estimate, not compliance.",
  tags: ["Performance", "Solar", "PV"],
  type: "static-2d",
  popularity: 70,
  createdAt: "2026-10-14",
  staticParams: [
    { key: "orientation", label: "Orientation", min: 0, max: 337.5, step: 22.5, default: DEFAULT_PARAMS.orientation, format: (v) => `${compass(v)} ${v}°` },
    { key: "latitude", label: "Latitude", min: -60, max: 60, step: 0.5, default: DEFAULT_PARAMS.latitude, format: formatLatitude },
    { key: "cutoff", label: "Yield cut-off", min: 0, max: 100, step: 1, default: DEFAULT_PARAMS.cutoff, format: (v) => `${v} % of unshaded` },
    { key: "stringing", label: "Stringing", min: 0, max: 1, step: 1, default: 0, options: ["Rows", "Columns"] },
    { key: "blockHeight", label: "Block height", min: 0, max: 30, step: 2, default: DEFAULT_PARAMS.blockHeight, format: (v) => `${v} m` },
  ],
};

export const defaults = defaultsFromMeta(meta);

/** Stringing slider value (0 rows, 1 columns) to the engine's key. */
export const stringingOf = (v: number): Stringing => (Math.round(v) === 1 ? "cols" : "rows");

const cache = new Map<string, Solution>();

/** Memoised trace per (orientation, latitude, block height); cut-off re-derives are cheap. */
export function getSolve(params: PatternParams): Solution {
  const p = { ...defaults, ...params };
  const key = `${p.orientation}|${p.latitude}|${p.blockHeight}`;
  let sol = cache.get(key);
  if (!sol) {
    sol = solve(p.orientation, p.latitude, p.blockHeight);
    if (cache.size >= 32) cache.clear();
    cache.set(key, sol);
  }
  return sol;
}

/** Grey level 0–1 (1 = light = high H), linear min–max of the on-modules. */
export function greyScale(sol: Solution, on: boolean[]): number[] {
  const hs = sol.H.filter((_, m) => on[m]);
  const lo = Math.min(...hs), hi = Math.max(...hs);
  return sol.H.map((h) => (hi > lo ? Math.min(1, Math.max(0, (h - lo) / (hi - lo))) : 1));
}

/** sRGB grey from level t: dark #3a3a3a … light #dcdcdc. */
export function grey(t: number): string {
  const v = Math.round(58 + t * (220 - 58)).toString(16).padStart(2, "0");
  return `#${v}${v}${v}`;
}

/** Thumbnail and export: grey cells, dashed off cells, no text. */
export function generate(params: PatternParams): PatternResult {
  const p = { ...defaults, ...params };
  const sol = getSolve(p);
  const { on } = layout(sol, p.cutoff, "rows");
  const t = greyScale(sol, on);
  const margin = 120, gap = 8;
  const cell = (SVG_SIZE - 2 * margin - (COLS - 1) * gap) / COLS;
  const primitives: SvgPrimitive[] = [];
  const body: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const m = r * COLS + c;
      const x = margin + c * (cell + gap), y = margin + r * (cell + gap);
      primitives.push({ type: "rect", x, y, width: cell, height: cell });
      body.push(
        on[m]
          ? `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${grey(t[m])}" />`
          : `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" fill="none" stroke="#969696" stroke-width="2" stroke-dasharray="6 5" />`,
      );
    }
  }
  return {
    size: SVG_SIZE,
    primitives,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" width="100%" height="100%">${body.join("")}</svg>`,
    stats: { elementCount: ROWS * COLS, nodeCount: on.filter(Boolean).length, connectionCount: 0 },
  };
}
