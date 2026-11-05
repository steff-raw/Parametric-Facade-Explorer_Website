// Run: npm run test:wallcheck  (Node 22+, type stripping)
// Worked example: illustrative numbers, hand-checked, not from the standard
// (see P-0052 research.md). Approximate, after EN ISO 13788.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyse, satPressure, DEFAULT_WALL, LONDON_LIKE } from "../src/lib/wallcheck/engine.ts";

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} got ${a}, want ${b} +-${tol}`);
const run = (over = {}) => analyse({ ...DEFAULT_WALL, ...over });
const WB = 2; // wool/brick interface index (0 = inner surface, 3 = outer surface)

function allFinite(x, path = "") {
  if (typeof x === "number") assert.ok(Number.isFinite(x), `non-finite at ${path}`);
  else if (Array.isArray(x)) x.forEach((v, i) => allFinite(v, `${path}[${i}]`));
  else if (x && typeof x === "object") for (const k of Object.keys(x)) allFinite(x[k], `${path}.${k}`);
}

test("totals: Rt 3.2191, U 0.311, SD 1.22", () => {
  const r = run();
  near(r.rt, 3.2191, 0.0001);
  near(r.u, 0.311, 0.001);
  near(r.sd, 1.22, 1e-9);
});

test("January at wool/brick: theta 5.80, ps 922, pi 1285, p 1196, flag, 0.88 kg/m2", () => {
  const r = run();
  const jan = r.months[0];
  near(jan.q, 4.660, 0.001);
  const i = jan.interfaces[WB];
  near(i.theta, 5.80, 0.01);
  near(i.ps, 922, 1);
  near(jan.pi, 1285, 2);
  near(i.p, 1196, 2);
  assert.equal(i.flag, true);
  assert.equal(i.kind, "interstitial");
  near(i.kg_m2, 0.88, 0.01);
});

test("year at wool/brick: Jan .88 Feb .74 Mar .41 Nov .33 Dec .75, Apr-Oct clear, year 3.10", () => {
  const r = run();
  const want = [0.88, 0.74, 0.41, 0, 0, 0, 0, 0, 0, 0, 0.33, 0.75];
  want.forEach((w, m) => {
    const i = r.months[m].interfaces[WB];
    near(i.kg_m2, w, 0.01, `month ${m}`);
    assert.equal(i.flag, w > 0, `flag month ${m}`);
  });
  near(r.interfaces[WB].yearKg, 3.10, 0.02);
});

test("other interfaces never flagged; inner surface RH 0.55-0.57, no mould flag", () => {
  const r = run();
  for (const m of r.months) {
    m.interfaces.forEach((i, k) => { if (k !== WB) assert.equal(i.flag, false, `interface ${k}`); });
    assert.ok(m.innerSurface.rh >= 0.545 && m.innerSurface.rh < 0.575, `rh ${m.innerSurface.rh}`);
    assert.equal(m.innerSurface.mould, false);
  }
});

test("single layer: no condensation in any month", () => {
  const r = run({ layers: [{ d: 0.3, lambda: 0.77, mu: 10 }] });
  for (const m of r.months) for (const i of m.interfaces) assert.equal(i.flag, false);
});

test("vapour control layer sd 10 m inside removes the wool/brick flag", () => {
  const vcl = { d: 0.001, lambda: 0.2, mu: 10000 };
  const r = run({ layers: [vcl, ...DEFAULT_WALL.layers] });
  for (const m of r.months) for (const i of m.interfaces) assert.equal(i.flag, false);
});

test("SD = 0: inner p = pi, others pe, kg null, note, no NaN, no throw", () => {
  const layers = DEFAULT_WALL.layers.map((l) => ({ ...l, mu: 0 }));
  const r = run({ layers });
  assert.equal(r.sd, 0);
  assert.match(r.note, /SD = 0/);
  for (const m of r.months) {
    near(m.interfaces[0].p, m.pi, 1e-9);
    m.interfaces.slice(1).forEach((i) => { near(i.p, m.pe, 1e-9); assert.equal(i.kg_m2, null); });
    m.interfaces.forEach((i) => assert.equal(i.kg_m2, null));
  }
  allFinite(r);
});

test("sum_sd(k) = 0 with p = pi > ps: surface condensation, kg null", () => {
  // RHi 100% and cold inner layer: inner surface (sum_sd 0) has p = pi > ps(theta_si)
  const r = run({ rhI: 1 });
  const i = r.months[0].interfaces[0];
  assert.equal(i.p, r.months[0].pi);
  assert.equal(i.flag, true);
  assert.equal(i.kind, "surface");
  assert.equal(i.kg_m2, null);
  allFinite(r);
});

test("sum_sd(k) = SD with p = pe > ps (reverse flow): surface, kg null", () => {
  const climate = LONDON_LIKE.map((m) => ({ ...m, theta: 30, rh: 1 }));
  const r = run({ climate });
  const o = r.months[0].interfaces[3];
  near(o.p, r.months[0].pe, 1e-9);
  near(r.months[0].pe, 4241, 2);
  assert.equal(o.flag, true);
  assert.equal(o.kind, "surface");
  assert.equal(o.kg_m2, null);
  allFinite(r);
});

test("theta below zero uses the ice branch; theta_i = theta_e gives q = 0, no flag", () => {
  near(satPressure(-5), 610.5 * Math.exp((21.875 * -5) / (265.5 - 5)), 1e-9);
  near(satPressure(0), 610.5, 1e-9);
  const climate = LONDON_LIKE.map((m) => ({ ...m, theta: 20, rh: 0.55 }));
  const r = run({ climate });
  for (const m of r.months) { assert.equal(m.q, 0); m.interfaces.forEach((i) => assert.equal(i.flag, false)); }
  allFinite(r);
});

test("every output number is finite or null across cases", () => {
  allFinite(run());
  allFinite(run({ rhI: 1 }));
  allFinite(run({ layers: [{ d: 0.1, lambda: 0.04, mu: 0 }] }));
});
