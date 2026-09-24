import * as deformedGrid from "./deformed-grid";
import * as radialLouvre from "./radial-louvre";
import * as perforatedScreen from "./perforated-screen";
import {
  kineticPatterns,
  static3dPatterns,
  getKineticPattern,
  getStatic3DPattern,
  KineticPatternModule,
  Static3DPatternModule,
  ElementTransform,
} from "../patterns-3d";
import { PatternMeta, PatternModule, PatternParams } from "./shared/types";

const staticModules: PatternModule[] = [
  {
    meta: deformedGrid.meta,
    generate: deformedGrid.generate,
    defaults: deformedGrid.defaults,
  },
  {
    meta: radialLouvre.meta,
    generate: radialLouvre.generate,
    defaults: radialLouvre.defaults,
  },
  {
    meta: perforatedScreen.meta,
    generate: perforatedScreen.generate,
    defaults: perforatedScreen.defaults,
  },
];

const kineticAsModules: PatternModule[] = kineticPatterns.map((k) => ({
  meta: k.meta,
  defaults: k.defaults,
  kineticDefaults: k.kineticDefaults,
}));

const static3dAsModules: PatternModule[] = static3dPatterns.map((p) => ({
  meta: p.meta,
  defaults: p.defaults,
}));

/** All patterns (static SVG + static 3D + kinetic 3D) */
export const patterns: PatternModule[] = [
  ...staticModules,
  ...static3dAsModules,
  ...kineticAsModules,
];

export const allTags: string[] = Array.from(
  new Set(patterns.flatMap((m) => m.meta.tags))
).sort();

export function getPattern(slug: string): PatternModule | undefined {
  return patterns.find((m) => m.meta.slug === slug);
}

export function getPatternMeta(slug: string): PatternMeta | undefined {
  return getPattern(slug)?.meta;
}

export function isKineticPattern(slug: string): boolean {
  return getPattern(slug)?.meta.type === "kinetic-3d";
}

export function isStatic3DPattern(slug: string): boolean {
  return getPattern(slug)?.meta.type === "static-3d";
}

export function is3DPattern(slug: string): boolean {
  const t = getPattern(slug)?.meta.type;
  return t === "static-3d" || t === "kinetic-3d";
}

export { getKineticPattern, getStatic3DPattern };
export type { KineticPatternModule, Static3DPatternModule, ElementTransform };

export function getAdjacentSlugs(slug: string): {
  prev: string | null;
  next: string | null;
} {
  const idx = patterns.findIndex((m) => m.meta.slug === slug);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? patterns[idx - 1].meta.slug : null,
    next: idx < patterns.length - 1 ? patterns[idx + 1].meta.slug : null,
  };
}

export function getRelatedPatterns(
  slug: string,
  limit = 4
): PatternModule[] {
  const current = getPattern(slug);
  if (!current) return [];
  const tags = new Set(current.meta.tags);
  return patterns
    .filter((m) => m.meta.slug !== slug)
    .map((m) => ({
      m,
      score: m.meta.tags.filter((t) => tags.has(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || b.m.meta.popularity - a.m.meta.popularity
    )
    .slice(0, limit)
    .map((x) => x.m);
}

export function countByTag(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tag of allTags) {
    counts[tag] = patterns.filter((m) => m.meta.tags.includes(tag)).length;
  }
  return counts;
}

export function countKinetic(): number {
  return patterns.filter((m) => m.meta.type === "kinetic-3d").length;
}

export function count3D(): number {
  return patterns.filter(
    (m) => m.meta.type === "kinetic-3d" || m.meta.type === "static-3d"
  ).length;
}

/** Thumbnail SVG for any pattern type */
export function getThumbnailSvg(
  pattern: PatternModule,
  params?: PatternParams
): string {
  if (pattern.meta.type === "kinetic-3d") {
    const k = getKineticPattern(pattern.meta.slug);
    return k?.generatePreviewSvg(params) ?? "";
  }
  if (pattern.meta.type === "static-3d") {
    const s = getStatic3DPattern(pattern.meta.slug);
    return s?.generatePreviewSvg(params) ?? "";
  }
  return pattern.generate?.(params ?? pattern.defaults).svg ?? "";
}

export type { PatternParams, PatternMeta, PatternModule };
export type {
  PatternResult,
  PatternStats,
  PatternParamDef,
  SvgPrimitive,
} from "./shared/types";
