/**
 * 3D pattern transform types (static + kinetic).
 * Pure functions: same inputs → same transform. No side effects.
 */

import {
  PatternMeta,
  PatternParams,
  PatternParamDef,
} from "../../patterns/shared/types";

export interface ElementTransform {
  position: [number, number, number];
  /** Euler rotation in radians (Three.js XYZ order) */
  rotation: [number, number, number];
  scale?: [number, number, number];
}

export type GetElementTransform = (
  index: number,
  staticParams: PatternParams,
  kineticParams: PatternParams,
  elapsedTime: number
) => ElementTransform;

/** Shared box size [width, height, depth] in world units */
export type InstanceSize = [number, number, number];

export interface KineticPatternModule {
  meta: PatternMeta;
  defaults: PatternParams;
  kineticDefaults: PatternParams;
  getElementCount: (staticParams: PatternParams) => number;
  getElementTransform: GetElementTransform;
  getInstanceSize: (staticParams: PatternParams) => InstanceSize;
  generatePreviewSvg: (staticParams?: PatternParams) => string;
}

/**
 * Static 3D: geometry + lighting only (no time). Same Instances pipeline,
 * optional hinge/pivot geometry offset.
 */
export interface Static3DPatternModule {
  meta: PatternMeta;
  defaults: PatternParams;
  getElementCount: (staticParams: PatternParams) => number;
  getElementTransform: (
    index: number,
    staticParams: PatternParams
  ) => ElementTransform;
  /**
   * Fixed coplanar frame transforms (door surrounds on the host surface).
   * When omitted, no separate frame instances are drawn.
   */
  getFrameTransform?: (
    index: number,
    staticParams: PatternParams
  ) => ElementTransform;
  getInstanceSize: (staticParams: PatternParams) => InstanceSize;
  /**
   * Offset applied once to BoxGeometry so a hinge edge sits at local origin.
   * e.g. [0, -height/2, 0] for top-edge hinge.
   */
  getGeometryOffset?: (
    staticParams: PatternParams
  ) => [number, number, number];
  /** World-space footprint for camera framing */
  getGridExtents?: (staticParams: PatternParams) => {
    width: number;
    height: number;
  };
  /** Optional per-instance colour (CSS colour). When omitted, no instance colours are set. */
  getInstanceColor?: (index: number, staticParams: PatternParams) => string;
  /**
   * Optional initial camera position and field of view (default 3/4 oblique view, fov 42).
   * `getCameraPosition` and `getFov` are read once when the Canvas is created; they must not depend on params.
   */
  getCameraPosition?: (staticParams: PatternParams) => [number, number, number];
  getFov?: (staticParams: PatternParams) => number;
  /**
   * Optional key-light position. When omitted, the default light is used.
   * Returning null turns the key light and its shadows off.
   */
  getLightPosition?: (
    staticParams: PatternParams
  ) => [number, number, number] | null;
  generatePreviewSvg: (staticParams?: PatternParams) => string;
}

export type { PatternMeta, PatternParams, PatternParamDef };
