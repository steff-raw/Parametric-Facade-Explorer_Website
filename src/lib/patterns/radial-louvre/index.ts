/**
 * Radial Louvre — SVG primitives for React DOM rendering.
 */

import {
  PatternMeta,
  PatternParams,
  PatternResult,
  SvgPrimitive,
  defaultsFromMeta,
} from "../shared/types";
import { SVG_SIZE, serializePrimitivesToSvg } from "../shared/math";

export const meta: PatternMeta = {
  slug: "radial-louvre",
  name: "Radial Louvre",
  description:
    "Radial brise-soleil blades arranged around a central oculus. Adjust blade count and tilt to tune solar cut-off for circular atria or cylindrical façades — a familiar sunshade language rendered as a live study model.",
  tags: ["Louvre", "Brise-Soleil"],
  popularity: 88,
  createdAt: "2026-04-02",
  type: "static-2d",
  staticParams: [
    {
      key: "blades",
      label: "Blade count",
      min: 8,
      max: 72,
      step: 1,
      default: 36,
    },
    {
      key: "angle",
      label: "Blade angle",
      min: 0,
      max: 60,
      step: 1,
      default: 22,
      unit: "°",
    },
    {
      key: "innerRadius",
      label: "Inner radius",
      min: 40,
      max: 280,
      step: 5,
      default: 100,
      unit: "mm*",
    },
    {
      key: "outerRadius",
      label: "Outer radius",
      min: 200,
      max: 380,
      step: 5,
      default: 340,
      unit: "mm*",
    },
    {
      key: "bladeWidth",
      label: "Blade width",
      min: 2,
      max: 24,
      step: 1,
      default: 8,
      unit: "mm*",
    },
    {
      key: "rings",
      label: "Concentric rings",
      min: 1,
      max: 8,
      step: 1,
      default: 3,
    },
  ],
};

export const defaults = defaultsFromMeta(meta);

export function generate(params: PatternParams): PatternResult {
  const blades = Math.round(params.blades ?? defaults.blades);
  const angleDeg = params.angle ?? defaults.angle;
  const innerR = params.innerRadius ?? defaults.innerRadius;
  const outerR = Math.max(
    params.outerRadius ?? defaults.outerRadius,
    innerR + 20
  );
  const bladeWidth = params.bladeWidth ?? defaults.bladeWidth;
  const rings = Math.round(params.rings ?? defaults.rings);

  const cx = SVG_SIZE / 2;
  const cy = SVG_SIZE / 2;
  const angleRad = (angleDeg * Math.PI) / 180;

  const primitives: SvgPrimitive[] = [];
  let connectionCount = 0;
  let nodeCount = 0;

  for (let r = 0; r <= rings; r++) {
    const t = rings === 0 ? 0 : r / rings;
    const radius = innerR + (outerR - innerR) * t;
    primitives.push({
      type: "circle",
      cx,
      cy,
      r: radius,
      opacity: 0.35,
    });
    connectionCount += blades;
  }

  for (let i = 0; i < blades; i++) {
    const theta = (i / blades) * Math.PI * 2;
    const x0 = cx + Math.cos(theta) * innerR;
    const y0 = cy + Math.sin(theta) * innerR;
    const x1 = cx + Math.cos(theta) * outerR;
    const y1 = cy + Math.sin(theta) * outerR;

    const px = -Math.sin(theta);
    const py = Math.cos(theta);
    const half = bladeWidth / 2;
    const tilt = Math.tan(angleRad) * ((outerR - innerR) / 2);
    const ox = px * tilt;
    const oy = py * tilt;

    const a = { x: x0 + px * half - ox * 0.3, y: y0 + py * half - oy * 0.3 };
    const b = { x: x1 + px * half + ox, y: y1 + py * half + oy };
    const c = { x: x1 - px * half + ox, y: y1 - py * half + oy };
    const d = { x: x0 - px * half - ox * 0.3, y: y0 - py * half - oy * 0.3 };

    primitives.push({
      type: "path",
      d: `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`,
    });
    nodeCount += 4;
    connectionCount += 4;
  }

  primitives.push({ type: "circle", cx, cy, r: innerR });

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
