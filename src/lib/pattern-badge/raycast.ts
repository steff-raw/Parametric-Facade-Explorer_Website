/**
 * Pattern Performance Badge: sun-ray test through a pattern's real 3D instances (P-0038).
 *
 * Standard: EN ISO 52022-1:2017 (simplified method, solar characteristics of shading with glazing;
 * supersedes EN 13363-1). Relation used: F_c = g_tot / g, so g_tot = G_VALUE x F_c.
 * clause not verified (standard paywalled); no worked example from the standard.
 * Approximate, after EN ISO 52022-1: a seasonal, angle-aware clear-sky ray ratio on the drawn
 * mesh, not the standard's normal-incidence method. Concept estimate, not compliance.
 *
 * Method:
 *  - sky: P-0014 engine `sky(lat)` over `DOME`, turned into facade space with `toFacade(v, 180)`
 *    (south); only front-facing patches (z > 0); weight = season irradiation x cos incidence.
 *  - boxes: oriented boxes from `composeMatrix` (= THREE.Object3D.updateMatrix) x instance size
 *    (+ geometry offset). Module space: facade in XY, outward normal +Z.
 *  - rays start on the glazing plane z_g = lowest z of any box vertex and go outward;
 *    n x n origins over the central 60% (each axis) of the boxes' XY bounding box.
 *  - T_i = share of origins whose ray hits no box; F = sum(w_i T_i) / sum(w_i).
 */

import { DOME, G_VALUE, sky, toFacade } from "../patterns-3d/solar-budget-skin/engine";
import type { Mat4, Vec3 } from "./matrix";

export interface Box {
  matrix: Mat4;
  /** Box size [x, y, z] before the instance scale (getInstanceSize). */
  size: Vec3;
  /** Geometry offset applied to the box before the instance matrix (getGeometryOffset). */
  offset?: Vec3;
}

export interface Window {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Glazing plane: rays start here. */
  z: number;
}

export interface Score {
  blocks: number; // %, summer
  winterKept: number; // %
  /** n x n summer transmitted share per origin, row 0 = top, column 0 = left. */
  map: number[];
  fc: number;
  bareSummer: number; // kWh/m2 of glazing, summer, no element (g included)
}

export const LATITUDE = 51.5;
export const ORIENTATION = 180;
export const CENTRAL_SHARE = 0.6;
export const DEFAULT_N = 20;

export interface FrontSky {
  dirs: Vec3[];
  cooling: number[];
  heating: number[];
}

let skyMemo: FrontSky | null = null;

/** Front-facing DOME patches in facade space with season weights (irradiation x cos incidence). */
export function frontSky(): FrontSky {
  if (skyMemo) return skyMemo;
  const s = sky(LATITUDE);
  const out: FrontSky = { dirs: [], cooling: [], heating: [] };
  DOME.forEach((p, i) => {
    const v = toFacade(p.vec, ORIENTATION);
    if (v[2] <= 1e-9) return;
    out.dirs.push(v);
    out.cooling.push(s.cooling[i] * v[2]);
    out.heating.push(s.heating[i] * v[2]);
  });
  skyMemo = out;
  return out;
}

/** F_c = shaded / bare, g_tot = G_VALUE x F_c, Blocks % = 100 (1 - F_c). */
export function badgeFromGains(bare: number, shaded: number) {
  const fc = bare > 0 ? shaded / bare : 1;
  return { fc, gtot: G_VALUE * fc, blocks: 100 * (1 - fc) };
}

/** Oriented box: centre, unit axes (9), half extents, world AABB. Null for zero-size boxes. */
interface Obb {
  c: Vec3;
  u: number[];
  h: Vec3;
  lo: Vec3;
  hi: Vec3;
}

function toObb(b: Box): Obb | null {
  const m = b.matrix;
  const o = b.offset ?? [0, 0, 0];
  const c: Vec3 = [
    m[0] * o[0] + m[4] * o[1] + m[8] * o[2] + m[12],
    m[1] * o[0] + m[5] * o[1] + m[9] * o[2] + m[13],
    m[2] * o[0] + m[6] * o[1] + m[10] * o[2] + m[14],
  ];
  const u: number[] = [];
  const h: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const len = Math.hypot(m[4 * k], m[4 * k + 1], m[4 * k + 2]);
    if (len * b.size[k] <= 0) return null;
    u.push(m[4 * k] / len, m[4 * k + 1] / len, m[4 * k + 2] / len);
    h[k] = (len * b.size[k]) / 2;
  }
  const ext = [0, 1, 2].map((a) => Math.abs(u[a]) * h[0] + Math.abs(u[3 + a]) * h[1] + Math.abs(u[6 + a]) * h[2]);
  return { c, u, h, lo: [c[0] - ext[0], c[1] - ext[1], c[2] - ext[2]], hi: [c[0] + ext[0], c[1] + ext[1], c[2] + ext[2]] };
}

/** Slab test: does the ray o + t d (t >= 0) touch the box? */
function hits(b: Obb, o: Vec3, d: Vec3): boolean {
  let tmin = 0, tmax = Infinity;
  const px = b.c[0] - o[0], py = b.c[1] - o[1], pz = b.c[2] - o[2];
  for (let k = 0; k < 3; k++) {
    const ux = b.u[3 * k], uy = b.u[3 * k + 1], uz = b.u[3 * k + 2];
    const e = ux * px + uy * py + uz * pz;
    const f = ux * d[0] + uy * d[1] + uz * d[2];
    const h = b.h[k];
    if (Math.abs(f) > 1e-12) {
      let t1 = (e + h) / f, t2 = (e - h) / f;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return false;
    } else if (e + h < 0 || e - h > 0) return false;
  }
  return true;
}

function obbs(boxes: Box[]): Obb[] {
  return boxes.map(toObb).filter((b): b is Obb => b !== null);
}

/** Blocked flags per (origin, direction): row-major [origin * dirs + dir]. */
function blockedGrid(list: Obb[], origins: Vec3[], dirs: Vec3[]): Uint8Array {
  const out = new Uint8Array(origins.length * dirs.length);
  origins.forEach((o, i) => {
    dirs.forEach((d, j) => {
      for (const b of list) {
        if (hits(b, o, d)) { out[i * dirs.length + j] = 1; return; }
      }
    });
  });
  return out;
}

/** Per direction: share of origins whose ray hits no box. */
export function transmittedPerPatch(boxes: Box[], origins: Vec3[], dirs: Vec3[]): Float64Array {
  const grid = blockedGrid(obbs(boxes), origins, dirs);
  const t = new Float64Array(dirs.length);
  for (let j = 0; j < dirs.length; j++) {
    let open = 0;
    for (let i = 0; i < origins.length; i++) if (!grid[i * dirs.length + j]) open++;
    t[j] = open / origins.length;
  }
  return t;
}

/** XY bounding box of the boxes (all vertices), shrunk to `share` per axis about its centre; z = lowest vertex. */
export function boxWindow(boxes: Box[], share = CENTRAL_SHARE): Window {
  const list = obbs(boxes);
  const lo = [0, 1, 2].map((a) => Math.min(...list.map((b) => b.lo[a])));
  const hi = [0, 1, 2].map((a) => Math.max(...list.map((b) => b.hi[a])));
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2;
  const hw = ((hi[0] - lo[0]) * share) / 2, hh = ((hi[1] - lo[1]) * share) / 2;
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh, z: lo[2] };
}

/** Ray score of a box scene: n x n origins over the window (default: central 60% of the boxes' bounding box). */
export function scoreBoxes(boxes: Box[], opts: { n?: number; share?: number; window?: Window } = {}): Score {
  const n = opts.n ?? DEFAULT_N;
  const w = opts.window ?? boxWindow(boxes, opts.share ?? CENTRAL_SHARE);
  const origins: Vec3[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      origins.push([w.x0 + ((c + 0.5) / n) * (w.x1 - w.x0), w.y1 - ((r + 0.5) / n) * (w.y1 - w.y0), w.z]);
    }
  }
  const s = frontSky();
  const P = s.dirs.length;
  const grid = blockedGrid(obbs(boxes), origins, s.dirs);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const allC = sum(s.cooling), allH = sum(s.heating);
  let shadedC = 0, shadedH = 0;
  const map = origins.map((_, i) => {
    let c = 0, h = 0;
    for (let j = 0; j < P; j++) {
      if (grid[i * P + j]) continue;
      c += s.cooling[j];
      h += s.heating[j];
    }
    shadedC += c;
    shadedH += h;
    return c / allC;
  });
  const bareSummer = (G_VALUE * allC) / 1000;
  const b = badgeFromGains(allC * origins.length, shadedC);
  return {
    blocks: b.blocks,
    winterKept: allH > 0 ? (100 * shadedH) / (allH * origins.length) : 100,
    map,
    fc: b.fc,
    bareSummer,
  };
}
