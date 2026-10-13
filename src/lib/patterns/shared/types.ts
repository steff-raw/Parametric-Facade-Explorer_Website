/**
 * Shared types for parametric facade pattern generators.
 * Generators are pure: same params (+ seed) → same output. No side effects.
 */

export type PatternType = "static-2d" | "static-3d" | "kinetic-3d";

export interface PatternParams {
  [key: string]: number;
}

/** Alias matching the kinetic architecture brief */
export type ParamDef = PatternParamDef;

export interface PatternParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** Optional unit suffix shown next to the live value (e.g. "mm", "°") */
  unit?: string;
  /** Discrete labels for step-1 enums (indexed from min) */
  options?: string[];
  /** Optional value label (overrides unit and options in the slider readout) */
  format?: (value: number) => string;
}

export interface PatternMeta {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  type: PatternType;
  /** Structure params (grid size, panel count, spacing, etc.) */
  staticParams: PatternParamDef[];
  /** Motion params — only for type: "kinetic-3d" */
  kineticParams?: PatternParamDef[];
  /** Approximate popularity for gallery sort stub */
  popularity: number;
  /** ISO date string for "Recent" sort */
  createdAt: string;
}

export interface PatternStats {
  elementCount: number;
  nodeCount: number;
  connectionCount: number;
  renderTimeMs: number;
}

/** Vector primitives for React SVG DOM rendering (not canvas) */
export type SvgPrimitive =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
      opacity?: number;
    }
  | { type: "path"; d: string; opacity?: number }
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      opacity?: number;
    };

export interface PatternResult {
  /** ViewBox size (square) */
  size: number;
  /** Geometry drawn as real SVG DOM nodes in PatternCanvas */
  primitives: SvgPrimitive[];
  /** Serialized SVG markup for export / thumbnails */
  svg: string;
  stats: Omit<PatternStats, "renderTimeMs">;
}

export type PatternGenerator = (params: PatternParams) => PatternResult;

export interface PatternModule {
  meta: PatternMeta;
  /** Present for static-2d patterns */
  generate?: PatternGenerator;
  defaults: PatternParams;
  /** Kinetic defaults split for clarity; merged into defaults for storage */
  kineticDefaults?: PatternParams;
}

export function defaultsFromMeta(meta: PatternMeta): PatternParams {
  const staticDefaults = Object.fromEntries(
    meta.staticParams.map((p) => [p.key, p.default])
  );
  const kineticDefaults = Object.fromEntries(
    (meta.kineticParams ?? []).map((p) => [p.key, p.default])
  );
  return { ...staticDefaults, ...kineticDefaults };
}

export function staticDefaultsFromMeta(meta: PatternMeta): PatternParams {
  return Object.fromEntries(meta.staticParams.map((p) => [p.key, p.default]));
}

export function kineticDefaultsFromMeta(meta: PatternMeta): PatternParams {
  return Object.fromEntries(
    (meta.kineticParams ?? []).map((p) => [p.key, p.default])
  );
}
