/**
 * Solar Budget Skin: solar engine + per-cell solver (P-0014, Stage 1).
 *
 * Pure TypeScript, no libraries, no DOM. Concept-stage estimate, not compliance.
 * Own maths from public formulas:
 *  - sun: Cooper declination, hour angle 15°/h, solar time (no equation of time)
 *  - sky: 145 Tregenza-type patches, Haurwitz clear-sky global horizontal,
 *    15% diffuse (isotropic), 85% beam binned to the nearest patch
 *  - shading: profile-angle shadow fractions for blade / fins / hood
 *
 * Facade-local frame: x = viewer's right seen from outside, y = up,
 * z = outward normal. Azimuths clockwise from north (S = 180).
 */

const RAD = Math.PI / 180;

export const CELL = 1.5; // m, glazing module
export const G_VALUE = 0.6;
export const BEAM_SHARE = 0.85;
export const DIFFUSE_SHARE = 0.15;
export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Day of year of the 21st of each month (non-leap year). */
export const SAMPLE_DAY = [21, 52, 80, 111, 141, 172, 202, 233, 264, 294, 325, 355];
const OCCUPIED_START = 9; // occupied bins 9:30 … 16:30
const OCCUPIED_END = 17;

export type ElementType = "none" | "blade" | "fins" | "hood";

export interface SolveParams {
  orientation: number; // facade-normal azimuth, deg
  latitude: number; // deg
  target: number; // kWh/m² yr, cooling season
  maxDepth: number; // m
}

/** Fixed in v3 (not sliders). Overridable only for tests. */
export interface Context {
  rows: number;
  cols: number;
  blockHeight: number; // m
  blockDistance: number; // m
  blockWidthShare: number; // of facade width, flush with the left edge seen from outside
}

export const DEFAULT_PARAMS: SolveParams = { orientation: 180, latitude: 51.5, target: 90, maxDepth: 0.6 };
export const DEFAULT_CONTEXT: Context = { rows: 8, cols: 8, blockHeight: 25, blockDistance: 12, blockWidthShare: 0.6 };

/** Footnote copy (fixed inputs and model limits). */
export const FOOTNOTES = [
  "Context block modelled as a wall facing the facade; its depth is ignored.",
  "Facade from ground level, 8 rows x 1.5 m = 12 m.",
  "Block 25 m high, 12 m away.",
  "12 deg dome resolution: column steps of a few cm are model resolution.",
];
export const VIEW_OUT_LABEL = "View-out (cosine-weighted)";

// ---------------------------------------------------------------- sun

export function declination(n: number): number {
  return 23.45 * Math.sin(((360 * (284 + n)) / 365) * RAD);
}

/** Sun direction for latitude, day n and solar hour. ENU unit vector + angles (deg). */
export function sunPosition(lat: number, n: number, hour: number) {
  const d = declination(n) * RAD;
  const h = 15 * (hour - 12) * RAD;
  const p = lat * RAD;
  const e = -Math.cos(d) * Math.sin(h);
  const north = Math.cos(p) * Math.sin(d) - Math.sin(p) * Math.cos(d) * Math.cos(h);
  const up = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h);
  const altitude = Math.asin(Math.max(-1, Math.min(1, up))) / RAD;
  const azimuth = ((Math.atan2(e, north) / RAD) + 360) % 360;
  return { altitude, azimuth, vec: [e, north, up] as [number, number, number] };
}

/** ENU unit vector from altitude/azimuth in degrees. */
export function dirFromAngles(altitude: number, azimuth: number): [number, number, number] {
  const a = altitude * RAD;
  const z = azimuth * RAD;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
}

/** ENU vector → facade-local [x right, y up, z out]. */
export function toFacade(v: [number, number, number], orientation: number): [number, number, number] {
  const t = orientation * RAD;
  const nx = Math.sin(t), ny = Math.cos(t); // outward normal
  return [v[0] * -ny + v[1] * nx, v[2], v[0] * nx + v[1] * ny];
}

// ---------------------------------------------------------------- sky

/** Haurwitz clear-sky global horizontal, W/m². */
export function haurwitz(altitudeDeg: number): number {
  const s = Math.sin(altitudeDeg * RAD);
  return s <= 0 ? 0 : 1098 * s * Math.exp(-0.057 / s);
}

export interface Patch {
  altitude: number;
  azimuth: number;
  omega: number; // sr
  vec: [number, number, number];
}

const BAND_COUNTS = [30, 30, 24, 24, 18, 12, 6];

function buildDome(): Patch[] {
  const out: Patch[] = [];
  BAND_COUNTS.forEach((count, b) => {
    const lo = b * 12, hi = lo + 12;
    const omega = (2 * Math.PI * (Math.sin(hi * RAD) - Math.sin(lo * RAD))) / count;
    for (let k = 0; k < count; k++) {
      const altitude = lo + 6, azimuth = (360 * k) / count;
      out.push({ altitude, azimuth, omega, vec: dirFromAngles(altitude, azimuth) });
    }
  });
  out.push({ altitude: 90, azimuth: 0, omega: 2 * Math.PI * (1 - Math.sin(84 * RAD)), vec: [0, 0, 1] });
  return out;
}

export const DOME: Patch[] = buildDome();

function nearestPatch(v: [number, number, number]): number {
  let best = 0, bestDot = -2;
  for (let i = 0; i < DOME.length; i++) {
    const p = DOME[i].vec;
    const dot = p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
    if (dot > bestDot) { bestDot = dot; best = i; }
  }
  return best;
}

export function isSouth(lat: number): boolean {
  return lat < 0;
}

/** Month indices (0 = Jan) of the cooling and heating seasons. */
export function seasons(lat: number): { cooling: number[]; heating: number[] } {
  const may_aug = [4, 5, 6, 7], nov_feb = [10, 11, 0, 1];
  return isSouth(lat) ? { cooling: nov_feb, heating: may_aug } : { cooling: may_aug, heating: nov_feb };
}

export function seasonLabels(lat: number) {
  const tropical = Math.abs(lat) < 23.45;
  return {
    cooling: tropical ? "Hot season" : "Summer",
    heating: tropical ? "Cool season" : "Winter",
    winterKept: tropical ? "Cool season gain kept" : "Winter gain kept",
    footnote: tropical ? "no heating need assumed" : "",
  };
}

interface Sky {
  /** Per patch: season irradiation as normal incidence, Wh/m² (beam + diffuse). */
  cooling: Float64Array;
  heating: Float64Array;
  /** Occupied sun samples for glare: ENU vector + weight in hours/yr. */
  glare: { vec: [number, number, number]; hours: number }[];
}

const skyCache = new Map<number, Sky>();

/** Season sky energy vectors per latitude (cached). */
export function sky(lat: number): Sky {
  const hit = skyCache.get(lat);
  if (hit) return hit;
  const { cooling, heating } = seasons(lat);
  const c = new Float64Array(DOME.length), w = new Float64Array(DOME.length);
  const glare: Sky["glare"] = [];
  for (let m = 0; m < 12; m++) {
    const target = cooling.includes(m) ? c : heating.includes(m) ? w : null;
    for (let h = 0; h < 24; h++) {
      const sun = sunPosition(lat, SAMPLE_DAY[m], h + 0.5);
      if (sun.altitude <= 0) continue;
      if (h >= OCCUPIED_START && h < OCCUPIED_END) glare.push({ vec: sun.vec, hours: DAYS[m] });
      if (!target) continue;
      const ghi = haurwitz(sun.altitude) * DAYS[m]; // Wh/m² over the month, 1 h bin
      const dni = (BEAM_SHARE * ghi) / Math.sin(sun.altitude * RAD);
      target[nearestPatch(sun.vec)] += dni;
      const radiance = (DIFFUSE_SHARE * ghi) / Math.PI;
      for (let i = 0; i < DOME.length; i++) target[i] += radiance * DOME[i].omega;
    }
  }
  const s = { cooling: c, heating: w, glare };
  skyCache.set(lat, s);
  return s;
}

// ---------------------------------------------------------------- shading

/** Shadow fractions on a 1.5 m cell from facade-local direction (x, y, z). */
export function bladeFraction(d: number, tanVertical: number): number {
  return Math.min(1, Math.max(0, (d * tanVertical) / CELL));
}
export function finFraction(d: number, tanHorizontal: number): number {
  return Math.min(1, (d * Math.abs(tanHorizontal)) / CELL);
}
export function unshaded(type: ElementType, d: number, tanV: number, tanH: number): number {
  if (type === "none" || d <= 0) return 1;
  const fh = type === "fins" ? 0 : bladeFraction(d, tanV);
  const fv = type === "blade" ? 0 : finFraction(d, tanH);
  return (1 - fh) * (1 - fv);
}

/**
 * View-out %: cosine-weighted share of the outward hemisphere left open by the element.
 * Up-views = dome patches in front of the facade; down-views = the same directions
 * mirrored below horizontal (the head blade cannot block them). Block ignored.
 */
const localDomeCache = new Map<number, [number, number, number][]>();

export function viewOut(type: ElementType, d: number, orientation: number): number {
  let local = localDomeCache.get(orientation);
  if (!local) {
    local = DOME.map((p) => toFacade(p.vec, orientation));
    if (localDomeCache.size > 64) localDomeCache.clear();
    localDomeCache.set(orientation, local);
  }
  let open = 0, all = 0;
  for (let i = 0; i < DOME.length; i++) {
    const [x, y, z] = local[i];
    if (z <= 1e-9) continue;
    const w = z * DOME[i].omega;
    open += w * (unshaded(type, d, y / z, x / z) + unshaded(type, d, -y / z, x / z));
    all += 2 * w;
  }
  return (100 * open) / all;
}

// ---------------------------------------------------------------- context

/** Cell centre in facade-local metres. Row 0 = top, col 0 = left seen from outside. */
function cellCentre(r: number, c: number, ctx: Context): [number, number] {
  return [(c + 0.5) * CELL, (ctx.rows - r - 0.5) * CELL];
}

/** Ray-wall test: true if the ray from the cell centre towards local direction v hits the block wall. */
function blocked(x0: number, y0: number, v: [number, number, number], ctx: Context): boolean {
  if (ctx.blockHeight <= 0 || v[2] <= 0) return false;
  const t = ctx.blockDistance / v[2];
  const x = x0 + v[0] * t, y = y0 + v[1] * t;
  return x >= 0 && x <= ctx.blockWidthShare * ctx.cols * CELL && y >= 0 && y <= ctx.blockHeight;
}

/** Visible, front-facing patches per cell: [patch index, cos incidence, tanV, tanH]. */
interface CellView {
  idx: Int16Array;
  cos: Float64Array;
  tanV: Float64Array;
  tanH: Float64Array;
}

interface Geometry {
  cells: CellView[];
}

const geomCache = new Map<string, Geometry>();

/** Context mask per (orientation, grid, block): cached. */
function geometry(orientation: number, ctx: Context): Geometry {
  const key = `${orientation}|${ctx.rows}|${ctx.cols}|${ctx.blockHeight}|${ctx.blockDistance}|${ctx.blockWidthShare}`;
  const hit = geomCache.get(key);
  if (hit) return hit;
  const local = DOME.map((p) => toFacade(p.vec, orientation));
  const cells: CellView[] = [];
  for (let r = 0; r < ctx.rows; r++) {
    for (let c = 0; c < ctx.cols; c++) {
      const [x0, y0] = cellCentre(r, c, ctx);
      const ids: number[] = [];
      for (let i = 0; i < local.length; i++) {
        const v = local[i];
        if (v[2] > 1e-9 && !blocked(x0, y0, v, ctx)) ids.push(i);
      }
      const view: CellView = {
        idx: Int16Array.from(ids),
        cos: Float64Array.from(ids, (i) => local[i][2]),
        tanV: Float64Array.from(ids, (i) => local[i][1] / local[i][2]),
        tanH: Float64Array.from(ids, (i) => local[i][0] / local[i][2]),
      };
      cells.push(view);
    }
  }
  const g = { cells };
  if (geomCache.size > 64) geomCache.clear();
  geomCache.set(key, g);
  return g;
}

/** Transmitted gain, kWh/m², for one cell, one season vector, one element (same maths as `unshaded`, inlined). */
function gain(cell: CellView, season: Float64Array, type: ElementType, d: number): number {
  const blade = type === "blade" || type === "hood";
  const fins = type === "fins" || type === "hood";
  const k = d / CELL;
  let sum = 0;
  for (let i = 0; i < cell.idx.length; i++) {
    let u = 1;
    if (blade && d > 0) u *= 1 - Math.min(1, Math.max(0, k * cell.tanV[i]));
    if (fins && d > 0) u *= 1 - Math.min(1, k * Math.abs(cell.tanH[i]));
    sum += season[cell.idx[i]] * cell.cos[i] * u;
  }
  return (G_VALUE * sum) / 1000;
}

// ---------------------------------------------------------------- solve

export interface CellResult {
  row: number;
  col: number;
  type: ElementType;
  depth: number;
  capped: boolean;
  bareCooling: number;
  bareHeating: number;
  cooling: number;
  heating: number;
  bareGlare: number;
  glare: number;
  viewOut: number; // %, bare = 100
}

export interface SolveResult {
  params: SolveParams;
  context: Context;
  cells: CellResult[];
  cappedCount: number;
  kpi: {
    bareSummer: number;
    skinSummer: number;
    winterKept: number; // %
    bareGlare: number; // h/yr
    skinGlare: number;
    viewOut: number; // %, skin cells area-averaged; bare = 100
  };
  labels: ReturnType<typeof seasonLabels>;
}

const SINGLE: ElementType[] = ["blade", "fins"];
const TYPES: ElementType[] = ["blade", "fins", "hood"];
const BISECT_STEPS = 10;

function solveCell(cell: CellView, s: Sky, p: SolveParams): { type: ElementType; depth: number; capped: boolean } {
  if (gain(cell, s.cooling, "none", 0) <= p.target) return { type: "none", depth: 0, capped: false };
  const bareWinter = gain(cell, s.heating, "none", 0);
  const ok: { type: ElementType; depth: number; kept: number }[] = [];
  for (const type of TYPES) {
    if (gain(cell, s.cooling, type, p.maxDepth) > p.target) continue;
    let lo = 0, hi = p.maxDepth;
    for (let i = 0; i < BISECT_STEPS; i++) {
      const mid = (lo + hi) / 2;
      if (gain(cell, s.cooling, type, mid) <= p.target) hi = mid; else lo = mid;
    }
    const kept = bareWinter > 0 ? (100 * gain(cell, s.heating, type, hi)) / bareWinter : 100;
    ok.push({ type, depth: hi, kept });
  }
  if (ok.length === 0) return { type: "hood", depth: p.maxDepth, capped: true };
  const best = Math.max(...ok.map((o) => o.kept));
  const singles = ok.filter((o) => SINGLE.includes(o.type) && o.kept >= best - 1);
  const pool = singles.length ? singles : ok;
  const pick = pool.reduce((a, b) => (b.kept > a.kept ? b : a));
  return { type: pick.type, depth: pick.depth, capped: false };
}

/** Glare hours/yr for one cell: occupied sun samples in front, unshaded beam ≥ 0.5. */
function glareHours(r: number, c: number, sun: Sky["glare"], ctx: Context, type: ElementType, d: number): number {
  const [x0, y0] = cellCentre(r, c, ctx);
  let hours = 0;
  for (const g of sun) {
    const v = g.vec;
    if (v[2] <= 0 || blocked(x0, y0, v, ctx)) continue;
    if (unshaded(type, d, v[1] / v[2], v[0] / v[2]) >= 0.5) hours += g.hours;
  }
  return hours;
}

const solveCache = new Map<string, SolveResult>();

/** Per-cell solve, memoised on params + context. */
export function solve(params: Partial<SolveParams> = {}, context: Partial<Context> = {}): SolveResult {
  const p = { ...DEFAULT_PARAMS, ...params };
  const ctx = { ...DEFAULT_CONTEXT, ...context };
  const key = JSON.stringify([p, ctx]);
  const hit = solveCache.get(key);
  if (hit) return hit;
  const s = sky(p.latitude);
  const geo = geometry(p.orientation, ctx);
  const sun = s.glare.map((g) => ({ vec: toFacade(g.vec, p.orientation), hours: g.hours }));
  const cells: CellResult[] = [];
  for (let r = 0; r < ctx.rows; r++) {
    for (let c = 0; c < ctx.cols; c++) {
      const view = geo.cells[r * ctx.cols + c];
      const pick = solveCell(view, s, p);
      cells.push({
        row: r,
        col: c,
        ...pick,
        bareCooling: gain(view, s.cooling, "none", 0),
        bareHeating: gain(view, s.heating, "none", 0),
        cooling: gain(view, s.cooling, pick.type, pick.depth),
        heating: gain(view, s.heating, pick.type, pick.depth),
        bareGlare: glareHours(r, c, sun, ctx, "none", 0),
        glare: glareHours(r, c, sun, ctx, pick.type, pick.depth),
        viewOut: viewOut(pick.type, pick.depth, p.orientation),
      });
    }
  }
  const mean = (f: (c: CellResult) => number) => cells.reduce((a, c) => a + f(c), 0) / cells.length;
  const bareHeat = mean((c) => c.bareHeating);
  const result: SolveResult = {
    params: p,
    context: ctx,
    cells,
    cappedCount: cells.filter((c) => c.capped).length,
    kpi: {
      bareSummer: mean((c) => c.bareCooling),
      skinSummer: mean((c) => c.cooling),
      winterKept: bareHeat > 0 ? (100 * mean((c) => c.heating)) / bareHeat : 100,
      bareGlare: mean((c) => c.bareGlare),
      skinGlare: mean((c) => c.glare),
      viewOut: mean((c) => c.viewOut),
    },
    labels: seasonLabels(p.latitude),
  };
  if (solveCache.size > 64) solveCache.clear();
  solveCache.set(key, result);
  return result;
}

/** Drop all caches (used by timing checks to measure a cold solve). */
export function clearCaches(): void {
  skyCache.clear();
  geomCache.clear();
  solveCache.clear();
  localDomeCache.clear();
}
