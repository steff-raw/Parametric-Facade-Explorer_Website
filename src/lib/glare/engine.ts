// Reflected-glare map: pure engine, no DOM, no React (P-0055).
// APPROXIMATE geometric-optics screening of where reflected direct sun lands on level ground.
// References, named only: NOAA solar equations and BRE solar dazzle method named as references, not verified.
// Sun comes from the repo's own sunPosition (Cooper declination, solar time, no equation of time, no DST),
// about 1 deg from NOAA on 1 Sep (unverified), so spots can shift a few metres.
// Worked example (hand-checked, computed from the repo's own sun formula, not from a standard):
// flat south facade, 40 m point, lat 51.5, 1 Sep, tilt 10, noon lands 74 m south of the foot.
// All distances and landings (E, N) are distances from the facade foot O (x east, y north, z up).
// Limits: point sun (no 0.5 deg disc), specular, constant reflectance (assumed), no Fresnel angle effect,
// no cloud or diffuse, no blocking, ground receivers only. Cylinder is vertical-axis concave only; rays
// that would re-hit the curved glass are dropped ("second reflection, not modelled"), never passed through.
// Relative flux = reflected irradiance on level ground / direct sun on level ground (not W/m2).
// Peaks depend on the 3 m cell size and sample count. Concept screening, not compliance.

// @ts-ignore node type stripping needs the explicit .ts extension; tsconfig does not allow it
import { sunPosition } from "../patterns-3d/solar-budget-skin/engine.ts";

export type Shape = "flat" | "cylinder";
export type GlareInput = {
  shape: Shape;
  tilt: number; // deg back from vertical, flat only
  height: number; // m
  rho: number; // reflectance, assumed
  radius: number; // m, cylinder plan radius
  day: number; // day of year n
  nx: number; // facade patches across W
  nz: number; // facade patches up H
  hours?: number[]; // solar hours to run (default: every whole hour with the sun up)
};
export type Sun = { altitude: number; vec: [number, number, number] };
export type Zone = { id: "street" | "a" | "b" | "open"; label: string; x0: number; x1: number; y0: number; y1: number };

export const LAT = 51.5;
export const W = 60; // facade width, m
export const CELL_M = 3; // ground cell, m
export const FLAG_X = 3; // "ask a specialist" above this multiple of direct sun
export const SAMPLE_CAP = { nx: 150, nz: 120 };
export const PLAN = { x0: -100, x1: 100, y0: -117, y1: 12 };
export const ZONES: Zone[] = [
  { id: "street", label: "Street", x0: -100, x1: 100, y0: -86, y1: -62 },
  { id: "a", label: "Neighbour A", x0: -90, x1: -45, y0: -112, y1: -92 },
  { id: "b", label: "Neighbour B", x0: 30, x1: 85, y0: -112, y1: -92 },
];
const OPEN: Zone = { id: "open", label: "Open ground", ...PLAN };
export const SEASONS = [
  { id: "jun", label: "21 Jun", n: 172 },
  { id: "sep", label: "1 Sep", n: 244 },
  { id: "dec", label: "21 Dec", n: 355 },
];
export const DEFAULT_INPUT: GlareInput = {
  shape: "flat", tilt: 10, height: 40, rho: 0.2, radius: 60, day: 244, nx: 25, nz: 20,
};

type V3 = [number, number, number];
const RAD = Math.PI / 180;
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function zoneOf(e: number, n: number): Zone {
  return ZONES.find((z) => e >= z.x0 && e <= z.x1 && n >= z.y0 && n <= z.y1) ?? OPEN;
}

/** Facade point and outward normal at plan coordinate x (flat: east; cylinder: arc length s) and height z. */
export function facadePoint(inp: Pick<GlareInput, "shape" | "tilt" | "radius">, x: number, z: number): { p: V3; n: V3 } {
  if (inp.shape === "flat") {
    const t = inp.tilt * RAD;
    return { p: [x, z * Math.tan(t), z], n: [0, -Math.cos(t), Math.sin(t)] };
  }
  const R = inp.radius, phi = x / R;
  return { p: [R * Math.sin(phi), -R * (1 - Math.cos(phi)), z], n: [-Math.sin(phi), -Math.cos(phi), 0] };
}

/** Mirror reflection r = 2 (n.s) n - s. */
export function reflect(s: V3, n: V3): V3 {
  const k = 2 * dot(n, s);
  return [k * n[0] - s[0], k * n[1] - s[1], k * n[2] - s[2]];
}

/** Ground landing (E, N) of a ray from p along r; null if it goes skyward or level. */
export function landing(p: V3, r: V3): { e: number; n: number } | null {
  if (!(r[2] < -1e-9)) return null;
  const t = p[2] / -r[2];
  return { e: p[0] + t * r[0], n: p[1] + t * r[1] };
}

export type Ray = { x: number; y: number; z: number; lx: number; ly: number; dropped: boolean };

// Cell edges sit on multiples of 3 m from the foot (x = 0 is an edge); edge cells are clipped to the plan.
const GRID = { x0: -102, y0: PLAN.y0, cell: CELL_M, nx: 68, ny: Math.ceil((PLAN.y1 - PLAN.y0) / CELL_M) };

function clampSamples(inp: GlareInput) {
  return { nx: Math.min(Math.max(1, Math.round(inp.nx)), SAMPLE_CAP.nx), nz: Math.min(Math.max(1, Math.round(inp.nz)), SAMPLE_CAP.nz) };
}

/** Does the horizontal path of a reflected cylinder ray cross the arc at 0 < z_c <= H? */
function selfHit(inp: GlareInput, p: V3, lx: number, ly: number): boolean {
  const R = inp.radius, cy = -R;
  const dx = lx - p[0], dy = ly - p[1], d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) return false;
  const u = (-2 * (p[0] * dx + (p[1] - cy) * dy)) / d2; // second root of |P + u d - C| = R
  if (!(u > 1e-9 && u < 1)) return false;
  const qx = p[0] + u * dx, qy = p[1] + u * dy;
  const zc = p[2] * (1 - u);
  return zc > 0 && zc <= inp.height && Math.abs(Math.atan2(qx, qy - cy)) * R <= W / 2 + 1e-9;
}

type Patch = { ray: Ray; power: number; box: [number, number, number, number] | null };

/** Lit patch centres with their landing; used by the engine and by the self-hit test. */
function patches(inp: GlareInput, sun: Sun): { list: Patch[]; skyward: number } {
  const { nx, nz } = clampSamples(inp), H = inp.height;
  const du = W / nx, dz = H / nz;
  const dA = inp.shape === "flat" ? (du * dz) / Math.cos(inp.tilt * RAD) : du * dz;
  const list: Patch[] = [];
  let skyward = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const u = -W / 2 + (i + 0.5) * du, z = (j + 0.5) * dz;
    const f = facadePoint(inp, u, z), ns = dot(f.n, sun.vec);
    if (!(ns > 1e-9)) continue;
    const L = landing(f.p, reflect(sun.vec, f.n));
    if (!L) { skyward++; continue; }
    const dropped = inp.shape === "cylinder" && selfHit(inp, f.p, L.e, L.n);
    const ray: Ray = { x: f.p[0], y: f.p[1], z, lx: L.e, ly: L.n, dropped };
    // footprint: bounding box of the 4 corner landings (fallback: the centre landing as a point)
    const cs = [[u - du / 2, z - dz / 2], [u + du / 2, z - dz / 2], [u - du / 2, z + dz / 2], [u + du / 2, z + dz / 2]]
      .map(([cu, cz]) => { const c = facadePoint(inp, cu, cz); return dot(c.n, sun.vec) > 1e-9 ? landing(c.p, reflect(sun.vec, c.n)) : null; });
    const box = cs.every(Boolean)
      ? ([Math.min(...cs.map((c) => c!.e)), Math.max(...cs.map((c) => c!.e)), Math.min(...cs.map((c) => c!.n)), Math.max(...cs.map((c) => c!.n))] as [number, number, number, number])
      : null;
    list.push({ ray, power: inp.rho * ns * dA, box: box ?? [L.e, L.e, L.n, L.n] });
  }
  return { list, skyward };
}

/** Every lit, landing facade ray for one sun (dropped ones flagged). */
export function trace(inp: GlareInput, sun: Sun): Ray[] {
  return patches(inp, sun).list.map((p) => p.ray);
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export type HourResult = {
  hour: number;
  altitude: number;
  spot: { e: number; n: number; zone: Zone; dist: number; offPlan: boolean } | null; // top-centre point
  vertical: { e: number; n: number } | null; // same point on a vertical flat face, for comparison
  peak: { erel: number; e: number; n: number; zone: Zone }; // erel 0 and e,n 0 when nothing lands on the plan
  flag: boolean;
  litCount: number;
  droppedCount: number;
  droppedShare: number; // dropped / lit patches
  offPlanShare: number; // power landing outside the plan / all kept power
  grid: typeof GRID;
  cells: Float64Array; // E_rel per cell, row = north index from y0
};

function topSpot(inp: GlareInput, sun: Sun, flatTilt?: number) {
  const f = facadePoint({ ...inp, shape: flatTilt === undefined ? inp.shape : "flat", tilt: flatTilt ?? inp.tilt }, 0, inp.height);
  if (!(dot(f.n, sun.vec) > 1e-9)) return null;
  return landing(f.p, reflect(sun.vec, f.n));
}

export function analyseHour(inp: GlareInput, sun: Sun, hour: number): HourResult {
  const { list } = patches(inp, sun);
  const cells = new Float64Array(GRID.nx * GRID.ny);
  const sinAlt = Math.sin(sun.altitude * RAD);
  let kept = 0, off = 0, dropped = 0;
  for (const { ray, power, box } of list) {
    if (ray.dropped) { dropped++; continue; }
    kept += power;
    const [bx0, bx1, by0, by1] = box!;
    const w = Math.max(bx1 - bx0, 1e-6), h = Math.max(by1 - by0, 1e-6), area = w * h;
    let inside = 0;
    const i0 = Math.max(0, Math.floor((bx0 - GRID.x0) / CELL_M)), i1 = Math.min(GRID.nx - 1, Math.floor((bx0 + w - GRID.x0) / CELL_M));
    const j0 = Math.max(0, Math.floor((by0 - GRID.y0) / CELL_M)), j1 = Math.min(GRID.ny - 1, Math.floor((by0 + h - GRID.y0) / CELL_M));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = Math.max(GRID.x0 + i * CELL_M, PLAN.x0), cx1 = Math.min(GRID.x0 + (i + 1) * CELL_M, PLAN.x1);
      const cy = GRID.y0 + j * CELL_M, cy1 = Math.min(cy + CELL_M, PLAN.y1);
      const a = overlap(bx0, bx0 + w, cx, cx1) * overlap(by0, by0 + h, cy, cy1);
      if (a <= 0) continue;
      inside += a;
      const cellArea = (cx1 - cx) * (cy1 - cy);
      cells[j * GRID.nx + i] += (power * a) / area / (cellArea * sinAlt);
    }
    off += power * (1 - inside / area);
  }
  let best = -1;
  for (let k = 0; k < cells.length; k++) if (cells[k] > (best < 0 ? 0 : cells[best])) best = k;
  const pe = best < 0 ? 0 : GRID.x0 + (best % GRID.nx) * CELL_M + CELL_M / 2;
  const pn = best < 0 ? 0 : GRID.y0 + Math.floor(best / GRID.nx) * CELL_M + CELL_M / 2;
  const erel = best < 0 ? 0 : cells[best];
  const s = topSpot(inp, sun), v = topSpot(inp, sun, 0);
  return {
    hour,
    altitude: sun.altitude,
    spot: s ? { e: s.e, n: s.n, zone: zoneOf(s.e, s.n), dist: Math.hypot(s.e, s.n), offPlan: s.e < PLAN.x0 || s.e > PLAN.x1 || s.n < PLAN.y0 || s.n > PLAN.y1 } : null,
    vertical: v,
    peak: { erel, e: pe, n: pn, zone: zoneOf(pe, pn) },
    flag: erel > FLAG_X,
    litCount: list.length,
    droppedCount: dropped,
    droppedShare: list.length ? dropped / list.length : 0,
    offPlanShare: kept > 0 ? off / kept : 0,
    grid: GRID,
    cells,
  };
}

export type GlareResult = {
  hours: HourResult[];
  stacked: Float64Array; // per-cell maximum over the hours, never a sum
  peak: HourResult["peak"] & { hour: number | null };
  flag: boolean; // any binned cell above FLAG_X in any shown hour
  samples: { nx: number; nz: number };
  sampleLimited: boolean; // requested samples hit the cap
  grid: typeof GRID;
};

export function analyse(input: GlareInput): GlareResult {
  const hours = input.hours ?? Array.from({ length: 23 }, (_, i) => i + 1);
  const rows: HourResult[] = [];
  for (const h of hours) {
    const sun = sunPosition(LAT, input.day, h);
    if (sun.altitude > 0) rows.push(analyseHour(input, sun, h));
  }
  const stacked = new Float64Array(GRID.nx * GRID.ny);
  for (const r of rows) for (let k = 0; k < stacked.length; k++) if (r.cells[k] > stacked[k]) stacked[k] = r.cells[k];
  const top = rows.reduce<HourResult | null>((m, r) => (!m || r.peak.erel > m.peak.erel ? r : m), null);
  return {
    hours: rows,
    stacked,
    peak: top ? { ...top.peak, hour: top.hour } : { erel: 0, e: 0, n: 0, zone: OPEN, hour: null },
    flag: rows.some((r) => r.flag),
    samples: clampSamples(input),
    sampleLimited: input.nx > SAMPLE_CAP.nx || input.nz > SAMPLE_CAP.nz,
    grid: GRID,
  };
}
