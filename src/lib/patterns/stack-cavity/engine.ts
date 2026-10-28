/**
 * Stack-Effect Cavity: buoyancy-driven flow in a ventilated double-skin cavity (P-0019, Stage 1).
 *
 * Pure TypeScript, no DOM. Concept-stage estimate, not compliance.
 *
 * Source: CIBSE AM10 "Natural ventilation in non-domestic buildings" and ASHRAE Handbook
 * Fundamentals, Ventilation and Infiltration (stack effect): Q = Cd * A * sqrt(2 g dH_NPL dT / T),
 * equal inlet and outlet area A, neutral plane midway so dH_NPL = H / 2.
 *
 * Derivation (checked here, not only quoted):
 *  - stack pressure: dP = rho g H dT / T
 *  - two equal openings in series: A_eff = A / sqrt(2)
 *  - orifice flow: Q = Cd A_eff sqrt(2 dP / rho) = Cd A sqrt(g H dT / T)   (matches the source)
 *  - energy: dT = P / (rho cp Q), rho cp = 1200 J/m3K
 *  - substitute dT: Q^1.5 = Cd A sqrt(g H / T) sqrt(P / 1200)   (closed form, no iteration)
 * Simplification: dT is the outlet rise, used as the single buoyancy temperature difference.
 * A linear temperature profile would give a mean rise of dT / 2, so Q is an upper-leaning
 * estimate; this is the "single mean temperature" limit stated on the page.
 */

export const G = 9.81;
export const RHO_CP = 1200; // J/m3K
export const F_BLIND = 2.5; // assumed: blind-off gain = blind-on gain / F_BLIND (plausible range 2 to 3)
export const FORMULA_SOURCE = "CIBSE AM10 / ASHRAE Fundamentals stack ventilation: Q = Cd A sqrt(2 g (H/2) dT / T)";

export interface CavityParams {
  H: number; // m, vent centre to vent centre
  W: number; // m, cavity width
  depth: number; // m
  opening: number; // % of the cavity section (W x depth), inlet and outlet equal
  gain: number; // W/m2 of cavity face, blind-on cavity-air gain
  tOut: number; // deg C, outdoor
  blind: boolean;
  cd: number;
}

// Reference mock-up: 6 m wide x 12 m high x 0.6 m deep, full-depth vents, 150 W/m2, 30 C, Cd 0.6.
export const DEFAULT_PARAMS: CavityParams = { H: 12, W: 6, depth: 0.6, opening: 100, gain: 150, tOut: 30, blind: true, cd: 0.6 };

export type Flag = "no-gain" | "no-opening" | null;

export interface CavityResult {
  A: number; // m2 vent area
  P: number; // W, gain on the cavity air (blind-adjusted)
  Q: number; // m3/s
  dT: number; // K outlet minus outdoor
  ach: number; // air changes per hour
  vCavity: number; // m/s, Q / (W depth)
  vVent: number; // m/s, Q / A
  volume: number; // m3
  flag: Flag; // set when the model gives no flow; values stay finite (dT = 0 is then not meaningful)
}

export function solve(p: CavityParams): CavityResult {
  const section = p.W * p.depth;
  const volume = section * p.H;
  const A = (p.opening / 100) * section;
  const P = (p.gain * p.W * p.H) / (p.blind ? 1 : F_BLIND);
  const T = p.tOut + 273.15;
  const flag: Flag = A <= 0 ? "no-opening" : P <= 0 ? "no-gain" : null;
  const Q = flag ? 0 : Math.pow(p.cd * A * Math.sqrt((G * p.H) / T) * Math.sqrt(P / RHO_CP), 1 / 1.5);
  const safe = (n: number, d: number) => (d > 0 ? n / d : 0);
  return {
    A,
    P: Math.max(P, 0),
    Q,
    dT: safe(P, RHO_CP * Q),
    ach: safe(Q * 3600, volume),
    vCavity: safe(Q, section),
    vVent: safe(Q, A),
    volume,
    flag,
  };
}
