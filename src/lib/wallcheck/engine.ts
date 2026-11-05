// Wall build-up dew-point check: pure engine, no DOM.
// APPROXIMATE, after EN ISO 13788:2012 (named; clause not verified, standard paywalled).
// Magnus saturation constants: recalled, not verified against the standard.
// Steady-state, monthly, 1D, vapour diffusion only; no drying, air leakage or storage.
// Each interface is computed alone as a single plane; kg/m2 is never summed across interfaces.
// Concept screening, not compliance.

export type Layer = { name?: string; d: number; lambda: number; mu: number };
export type ClimateMonth = { theta: number; rh: number; days: number };
export type WallInput = {
  layers: Layer[];
  thetaI: number;
  rhI: number;
  rsi: number;
  rse: number;
  climate: ClimateMonth[];
};
export type InterfaceMonth = {
  theta: number;
  ps: number;
  p: number;
  flag: boolean;
  kind: "none" | "surface" | "interstitial";
  kg_m2: number | null;
};
export type MonthResult = {
  q: number;
  pi: number;
  pe: number;
  interfaces: InterfaceMonth[]; // 0 = inner surface, n = outer surface
  innerSurface: { theta: number; rh: number; mould: boolean };
};
export type WallResult = {
  rt: number;
  u: number;
  sd: number;
  note: string | null;
  months: MonthResult[];
  // per interface: sum of that interface's own monthly values; null if never interstitial
  interfaces: { yearKg: number | null; flaggedMonths: number }[];
};

const DELTA0 = 2e-10; // kg/(m s Pa), unverified
const MOULD_RH = 0.8; // common rule of thumb, not tied to the standard
const DAY = 86400;

export const DEFAULT_WALL: WallInput = {
  layers: [
    { name: "Plasterboard", d: 0.0125, lambda: 0.21, mu: 8 },
    { name: "Mineral wool", d: 0.1, lambda: 0.035, mu: 1 },
    { name: "Brick", d: 0.102, lambda: 0.77, mu: 10 },
  ],
  thetaI: 20,
  rhI: 0.55,
  rsi: 0.13,
  rse: 0.04,
  climate: [],
};

// Illustrative London-like values, not from a weather file.
const T = [5, 5.3, 7.4, 9.6, 12.9, 16, 18.5, 18.3, 15.4, 12, 8, 5.8];
const RH = [85, 83, 78, 73, 72, 71, 72, 75, 79, 84, 86, 86];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const LONDON_LIKE: ClimateMonth[] = T.map((theta, i) => ({ theta, rh: RH[i] / 100, days: DAYS[i] }));
DEFAULT_WALL.climate = LONDON_LIKE;

export function satPressure(theta: number): number {
  return theta >= 0
    ? 610.5 * Math.exp((17.269 * theta) / (237.3 + theta))
    : 610.5 * Math.exp((21.875 * theta) / (265.5 + theta));
}

export function analyse(w: WallInput): WallResult {
  const n = w.layers.length;
  const R = w.layers.map((l) => l.d / l.lambda);
  // cumulative resistance (from inside, incl. Rsi) and sd up to each interface k = 0..n
  const cumR: number[] = [w.rsi];
  const cumSd: number[] = [0];
  for (let k = 0; k < n; k++) {
    cumR.push(cumR[k] + R[k]);
    cumSd.push(cumSd[k] + w.layers[k].d * w.layers[k].mu);
  }
  const rt = cumR[n] + w.rse;
  const sd = cumSd[n];
  const note = sd === 0 ? "SD = 0: no vapour resistance, no interstitial condensation computed" : null;

  const months: MonthResult[] = w.climate.map((c) => {
    const q = (w.thetaI - c.theta) / rt;
    const pi = w.rhI * satPressure(w.thetaI);
    const pe = c.rh * satPressure(c.theta);
    const secs = c.days * DAY;
    const interfaces: InterfaceMonth[] = cumR.map((r, k) => {
      const theta = w.thetaI - q * r;
      const ps = satPressure(theta);
      // boundary cases first: no division by zero
      const atInner = sd === 0 ? k === 0 : cumSd[k] === 0;
      const atOuter = sd === 0 ? k !== 0 : cumSd[k] === sd;
      const p = atInner ? pi : atOuter ? pe : pi - ((pi - pe) * cumSd[k]) / sd;
      const flag = p > ps;
      if (atInner || atOuter) {
        return { theta, ps, p, flag, kind: flag ? "surface" : "none", kg_m2: null };
      }
      let kg = 0;
      if (flag) {
        const g = (pi - ps) / (cumSd[k] / DELTA0) - (ps - pe) / ((sd - cumSd[k]) / DELTA0);
        kg = Math.max(0, g) * secs;
      }
      return { theta, ps, p, flag, kind: "interstitial", kg_m2: kg };
    });
    const rh = pi / interfaces[0].ps;
    return { q, pi, pe, interfaces, innerSurface: { theta: interfaces[0].theta, rh, mould: rh > MOULD_RH } };
  });

  const interfaces = cumR.map((_, k) => {
    let yearKg: number | null = null;
    let flaggedMonths = 0;
    for (const m of months) {
      const i = m.interfaces[k];
      if (i.flag) flaggedMonths++;
      if (i.kg_m2 !== null) yearKg = (yearKg ?? 0) + i.kg_m2;
    }
    return { yearKg, flaggedMonths };
  });

  return { rt, u: 1 / rt, sd, note, months, interfaces };
}
