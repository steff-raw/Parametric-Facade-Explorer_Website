/**
 * Facade Studio engine — real-unit (mm) panelised perforation.
 *
 * A perforation field is laid over the whole elevation, driven by a gradient,
 * then cut into fabricable panels with joints. Fabrication rules:
 *  - hole Ø ≥ sheet thickness (smaller holes are omitted: the sheet stays solid)
 *  - web between holes ≥ sheet thickness (larger holes are clamped)
 *  - no hole within the edge margin of a panel (folds, fixings)
 *  - optional quantisation to N punch tool sizes
 *
 * Pure and dependency-free: same spec → same result. Units are millimetres,
 * origin at the bottom-left of the elevation, y up.
 */

export type DriverType = "linear" | "radial" | "noise";
export type HoleLayout = "square" | "staggered";

export interface StudioSpec {
  facadeW: number;
  facadeH: number;
  panelW: number;
  panelH: number;
  joint: number;
  thickness: number;
  edgeMargin: number;
  layout: HoleLayout;
  pitch: number;
  holeMin: number;
  holeMax: number;
  driver: DriverType;
  /** Linear driver direction in degrees: 90 = bottom (small) to top (large) */
  angle: number;
  /** Radial driver attractor, 0..1 of facade width/height */
  attractorX: number;
  attractorY: number;
  /** Radial reach as a fraction of the facade diagonal */
  falloff: number;
  /** Noise feature size in mm */
  noiseScale: number;
  seed: number;
  invert: boolean;
  /** Number of punch tool sizes; 0 = continuous sizes */
  tools: number;
}

export interface Hole {
  x: number;
  y: number;
  d: number;
}

export interface Panel {
  id: string;
  row: number;
  col: number;
  /** Panel origin on the elevation (bottom-left) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Holes in panel-local coordinates */
  holes: Hole[];
  openArea: number;
}

export interface StudioResult {
  panels: Panel[];
  cols: number;
  rows: number;
  panelW: number;
  panelH: number;
  holeCount: number;
  openArea: number;
  toolSizes: number[];
  uniquePanelTypes: number;
  clamped: number;
  omitted: number;
  warnings: string[];
}

export const DEFAULT_SPEC: StudioSpec = {
  facadeW: 18000,
  facadeH: 9000,
  panelW: 1500,
  panelH: 3000,
  joint: 20,
  thickness: 3,
  edgeMargin: 40,
  layout: "staggered",
  pitch: 60,
  holeMin: 6,
  holeMax: 48,
  driver: "linear",
  angle: 90,
  attractorX: 0.35,
  attractorY: 0.45,
  falloff: 0.6,
  noiseScale: 2500,
  seed: 7,
  invert: false,
  tools: 5,
};

/** Above this many hole positions the field is not generated (browser limit). */
export const MAX_HOLE_POSITIONS = 400_000;

const SQRT3_2 = Math.sqrt(3) / 2;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = x - x0;
  const sy = y - y0;
  const fx = sx * sx * (3 - 2 * sx);
  const fy = sy * sy * (3 - 2 * sy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** Gradient value 0..1 at an elevation point; 1 = largest hole. */
export function driverValue(spec: StudioSpec, x: number, y: number): number {
  let v: number;
  if (spec.driver === "linear") {
    const a = (spec.angle * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const half = (Math.abs(dx) * spec.facadeW + Math.abs(dy) * spec.facadeH) / 2;
    const t = ((x - spec.facadeW / 2) * dx + (y - spec.facadeH / 2) * dy) / (half || 1);
    v = (t + 1) / 2;
  } else if (spec.driver === "radial") {
    const ax = spec.attractorX * spec.facadeW;
    const ay = spec.attractorY * spec.facadeH;
    const reach = Math.max(1, spec.falloff * Math.hypot(spec.facadeW, spec.facadeH));
    v = 1 - Math.hypot(x - ax, y - ay) / reach;
  } else {
    const s = Math.max(50, spec.noiseScale);
    v = valueNoise(x / s, y / s, spec.seed) * 0.65 + valueNoise((x / s) * 2.3, (y / s) * 2.3, spec.seed + 11) * 0.35;
  }
  v = clamp01(v);
  return spec.invert ? 1 - v : v;
}

/** Punch sizes available to the field (continuous range → empty list). */
export function toolSet(spec: StudioSpec): number[] {
  const maxD = Math.min(spec.holeMax, spec.pitch - spec.thickness);
  const minD = Math.max(spec.holeMin, spec.thickness);
  if (spec.tools <= 0 || maxD < minD) return [];
  if (spec.tools === 1) return [round1(maxD)];
  const out: number[] = [];
  for (let k = 0; k < spec.tools; k++) out.push(round1(minD + ((maxD - minD) * k) / (spec.tools - 1)));
  return out;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Lay panels to fill the elevation exactly, keeping the module close to the request. */
export function panelGrid(spec: StudioSpec): { cols: number; rows: number; w: number; h: number } {
  const cols = Math.max(1, Math.round((spec.facadeW + spec.joint) / (spec.panelW + spec.joint)));
  const rows = Math.max(1, Math.round((spec.facadeH + spec.joint) / (spec.panelH + spec.joint)));
  return {
    cols,
    rows,
    w: (spec.facadeW - (cols - 1) * spec.joint) / cols,
    h: (spec.facadeH - (rows - 1) * spec.joint) / rows,
  };
}

export function generateStudio(spec: StudioSpec): StudioResult {
  const warnings: string[] = [];
  const grid = panelGrid(spec);
  const panels: Panel[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      panels.push({
        id: `P${String(r + 1).padStart(2, "0")}-${String(c + 1).padStart(2, "0")}`,
        row: r + 1,
        col: c + 1,
        x: c * (grid.w + spec.joint),
        y: r * (grid.h + spec.joint),
        w: grid.w,
        h: grid.h,
        holes: [],
        openArea: 0,
      });
    }
  }

  if (grid.w <= 2 * spec.edgeMargin || grid.h <= 2 * spec.edgeMargin) {
    warnings.push("Edge margin leaves no perforable area on the panels.");
  }
  if (spec.holeMax > spec.pitch - spec.thickness) {
    warnings.push(
      `Largest hole limited to ${round1(spec.pitch - spec.thickness)} mm to keep a ${spec.thickness} mm web at ${spec.pitch} mm pitch.`
    );
  }
  if (spec.holeMin < spec.thickness) {
    warnings.push(`Holes under ${spec.thickness} mm (sheet thickness) are left solid.`);
  }

  const rowStep = spec.layout === "staggered" ? spec.pitch * SQRT3_2 : spec.pitch;
  const nx = Math.floor(spec.facadeW / spec.pitch) + 1;
  const ny = Math.floor(spec.facadeH / rowStep) + 1;
  if (nx * ny > MAX_HOLE_POSITIONS) {
    warnings.push(
      `Pitch too fine for this elevation (${(nx * ny).toLocaleString("en-GB")} positions). Increase the pitch.`
    );
    return finish(spec, grid, panels, 0, 0, warnings);
  }

  const tools = toolSet(spec);
  const maxD = spec.pitch - spec.thickness;
  let clamped = 0;
  let omitted = 0;

  for (let j = 0; j < ny; j++) {
    const y = spec.pitch / 2 + j * rowStep;
    if (y > spec.facadeH) break;
    const shift = spec.layout === "staggered" && j % 2 === 1 ? spec.pitch / 2 : 0;
    const r = Math.floor(y / (grid.h + spec.joint));
    if (r >= grid.rows) continue;
    const ly = y - r * (grid.h + spec.joint);
    if (ly > grid.h) continue;
    for (let i = 0; i < nx; i++) {
      const x = spec.pitch / 2 + shift + i * spec.pitch;
      if (x > spec.facadeW) break;
      const c = Math.floor(x / (grid.w + spec.joint));
      if (c >= grid.cols) continue;
      const lx = x - c * (grid.w + spec.joint);
      if (lx > grid.w) continue;

      let d = spec.holeMin + driverValue(spec, x, y) * (spec.holeMax - spec.holeMin);
      if (d > maxD) {
        d = maxD;
        clamped++;
      }
      if (tools.length) d = nearest(tools, d, spec.thickness);
      if (d < spec.thickness) {
        omitted++;
        continue;
      }
      const rad = d / 2;
      if (lx - rad < spec.edgeMargin || lx + rad > grid.w - spec.edgeMargin) continue;
      if (ly - rad < spec.edgeMargin || ly + rad > grid.h - spec.edgeMargin) continue;
      panels[r * grid.cols + c].holes.push({ x: round1(lx), y: round1(ly), d: round1(d) });
    }
  }

  if (clamped) warnings.push(`${clamped.toLocaleString("en-GB")} holes clamped to keep the minimum web.`);
  return finish(spec, grid, panels, clamped, omitted, warnings);
}

/** Snap to the nearest tool; values well below the smallest tool become solid. */
function nearest(tools: number[], d: number, thickness: number): number {
  if (d < tools[0] / 2 || d < thickness) return 0;
  let best = tools[0];
  for (const t of tools) if (Math.abs(t - d) < Math.abs(best - d)) best = t;
  return best;
}

function finish(
  spec: StudioSpec,
  grid: { cols: number; rows: number; w: number; h: number },
  panels: Panel[],
  clamped: number,
  omitted: number,
  warnings: string[]
): StudioResult {
  let holeArea = 0;
  let holeCount = 0;
  const sizes = new Set<number>();
  const signatures = new Set<string>();
  for (const p of panels) {
    let a = 0;
    for (const h of p.holes) {
      a += (Math.PI * h.d * h.d) / 4;
      sizes.add(h.d);
    }
    p.openArea = a / (p.w * p.h);
    holeArea += a;
    holeCount += p.holes.length;
    signatures.add(p.holes.map((h) => `${h.x},${h.y},${h.d}`).join(";"));
  }
  return {
    panels,
    cols: grid.cols,
    rows: grid.rows,
    panelW: round1(grid.w),
    panelH: round1(grid.h),
    holeCount,
    openArea: holeArea / (grid.cols * grid.rows * grid.w * grid.h),
    toolSizes: Array.from(sizes).sort((a, b) => a - b),
    uniquePanelTypes: signatures.size,
    clamped,
    omitted,
    warnings,
  };
}

/** Panel schedule as CSV. */
export function scheduleCsv(result: StudioResult): string {
  const lines = ["panel_id,row,col,x_mm,y_mm,width_mm,height_mm,hole_count,open_area_pct,hole_sizes_mm"];
  for (const p of result.panels) {
    const sizes = Array.from(new Set(p.holes.map((h) => h.d))).sort((a, b) => a - b).join(" ");
    lines.push(
      [p.id, p.row, p.col, round1(p.x), round1(p.y), round1(p.w), round1(p.h), p.holes.length, (p.openArea * 100).toFixed(2), sizes].join(",")
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Elevation as DXF R12 (AC1009), millimetres. Layers: PANELS (outlines),
 * HOLES (circles), LABELS (panel ids). Opens in AutoCAD, Rhino, Revit, laser/CNC CAM.
 */
export function elevationDxf(result: StudioResult): string {
  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), String(value));
  const num = (v: number) => (Math.round(v * 1000) / 1000).toString();

  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, 4);
  g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LAYER"); g(70, 3);
  for (const [name, colour] of [["PANELS", 7], ["HOLES", 1], ["LABELS", 3]] as const) {
    g(0, "LAYER"); g(2, name); g(70, 0); g(62, colour); g(6, "CONTINUOUS");
  }
  g(0, "ENDTAB");
  g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");
  for (const p of result.panels) {
    const corners: [number, number][] = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]];
    for (let k = 0; k < 4; k++) {
      const [x1, y1] = corners[k];
      const [x2, y2] = corners[(k + 1) % 4];
      g(0, "LINE"); g(8, "PANELS"); g(10, num(x1)); g(20, num(y1)); g(11, num(x2)); g(21, num(y2));
    }
    for (const h of p.holes) {
      g(0, "CIRCLE"); g(8, "HOLES"); g(10, num(p.x + h.x)); g(20, num(p.y + h.y)); g(40, num(h.d / 2));
    }
    g(0, "TEXT"); g(8, "LABELS"); g(10, num(p.x + 20)); g(20, num(p.y + 20)); g(40, 60); g(1, p.id);
  }
  g(0, "ENDSEC");
  g(0, "EOF");
  return out.join("\n") + "\n";
}
