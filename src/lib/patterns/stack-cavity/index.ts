/**
 * Stack-Effect Cavity: static-2d (P-0019)
 *
 * Buoyancy-driven air flow through a ventilated double-skin cavity (closed form, see engine.ts).
 * The detail view is a slug-gated component (Stage 2); `generate` gives the gallery thumbnail.
 * Concept estimate, not compliance.
 */

import { PatternMeta, PatternParams, PatternResult, SvgPrimitive, defaultsFromMeta } from "../shared/types";
import { SVG_SIZE } from "../shared/math";
import { DEFAULT_PARAMS, solve } from "./engine";

export const meta: PatternMeta = {
  slug: "stack-effect-cavity",
  name: "Stack-Effect Cavity",
  description:
    "Buoyancy-driven air flow through a ventilated double-skin cavity: air-change rate, outlet temperature rise and flow from height, vent area and solar gain. Not modelled: wind, height-varying temperature, radiation between skins. Cd 0.6 assumed for full-section vents. Concept estimate, not compliance.",
  tags: ["Performance", "Air"],
  type: "static-2d",
  popularity: 60,
  createdAt: "2026-10-28",
  staticParams: [
    { key: "H", label: "Cavity height", min: 3, max: 36, step: 1, default: DEFAULT_PARAMS.H, format: (v) => `${v} m` },
    { key: "W", label: "Cavity width", min: 2, max: 12, step: 0.5, default: DEFAULT_PARAMS.W, format: (v) => `${v} m` },
    { key: "depth", label: "Cavity depth", min: 0.2, max: 1.5, step: 0.1, default: DEFAULT_PARAMS.depth, format: (v) => `${v} m` },
    { key: "opening", label: "Vent opening", min: 5, max: 100, step: 5, default: DEFAULT_PARAMS.opening, format: (v) => `${v} %` },
    { key: "gain", label: "Solar gain", min: 0, max: 400, step: 10, default: DEFAULT_PARAMS.gain, format: (v) => `${v} W/m²` },
    { key: "tOut", label: "Outdoor temperature", min: -10, max: 40, step: 1, default: DEFAULT_PARAMS.tOut, format: (v) => `${v} °C` },
    { key: "blind", label: "Blind", min: 0, max: 1, step: 1, default: 1, options: ["Off", "On"] },
  ],
};

export const defaults = defaultsFromMeta(meta);

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Thumbnail: cavity section with a blue-to-orange gradient and rising arrows scaled by ACH. */
export function generate(params: PatternParams): PatternResult {
  const p = { ...defaults, ...params };
  const res = solve({ ...DEFAULT_PARAMS, H: p.H, W: p.W, depth: p.depth, opening: p.opening, gain: p.gain, tOut: p.tOut, blind: Math.round(p.blind) === 1 });
  const x0 = 280, x1 = 520, y0 = 100, y1 = 700;
  const n = Math.max(1, Math.min(7, Math.round(res.ach / 40)));
  const primitives: SvgPrimitive[] = [{ type: "rect", x: x0, y: y0, width: x1 - x0, height: y1 - y0 }];
  const arrows: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = r2(x0 + ((i + 1) * (x1 - x0)) / (n + 1));
    arrows.push(`<line x1="${x}" y1="${y1 - 40}" x2="${x}" y2="${y0 + 40}" stroke="#e6e6e6" stroke-width="4" stroke-linecap="round" />`);
  }
  return {
    size: SVG_SIZE,
    primitives,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIZE} ${SVG_SIZE}" width="100%" height="100%"><defs><linearGradient id="sc-g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1b3a57" /><stop offset="1" stop-color="#7a3d1c" /></linearGradient></defs><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#sc-g)" />${arrows.join("")}</svg>`,
    stats: { elementCount: n, nodeCount: 0, connectionCount: 0 },
  };
}
