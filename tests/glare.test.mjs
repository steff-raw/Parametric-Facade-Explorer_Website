// Run: npm run test:glare  (Node 22+, type stripping)
// P-0055 Stage 1. Approximate geometric-optics screening, not a standard method.
// Worked example: hand-checked, computed from the repo's own sun formula, not from a standard.
// Hand check (distances from the facade foot O, 40 m point, lat 51.5, solar time):
//   vertical 1 Sep noon: altitude 46.2 deg, reach = 40 / tan 46.2 = 38 m.
//   tilt 10: reflected drop = 46.2 - 2*10 = 26.2 deg, reach = 40 / tan 26.2 = 81 m from the plan
//   position of the 40 m point, which sits 40 tan 10 = 7 m north of the foot: 74 m from the foot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  analyse, analyseHour, trace, facadePoint, reflect, landing, zoneOf, DEFAULT_INPUT,
  ZONES, PLAN, SEASONS, CELL_M, FLAG_X, SAMPLE_CAP,
} from "../src/lib/glare/engine.ts";
import { dirFromAngles, sunPosition } from "../src/lib/patterns-3d/solar-budget-skin/engine.ts";

const SEP = 244, JUN = 172, DEC = 355;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} got ${a}, want ${b} +-${tol}`);
const run = (over = {}, hours = [12]) => analyse({ ...DEFAULT_INPUT, ...over, hours });
const spot = (over, hour) => run({ day: SEP, ...over }, [hour]).hours[0].spot;
const sunAt = (day, hour) => sunPosition(51.5, day, hour);

function allFinite(x, path = "") {
  if (typeof x === "number") assert.ok(Number.isFinite(x), `non-finite at ${path}`);
  else if (ArrayBuffer.isView(x)) x.forEach((v, i) => assert.ok(Number.isFinite(v), `non-finite at ${path}[${i}]`));
  else if (Array.isArray(x)) x.forEach((v, i) => allFinite(v, `${path}[${i}]`));
  else if (x && typeof x === "object") for (const k of Object.keys(x)) allFinite(x[k], `${path}.${k}`);
}

// (2) worked example, landings from the foot, +-1 m
test("worked example: vertical glass", () => {
  const a = run({ tilt: 0, day: SEP }, [12, 15]).hours;
  near(a[0].spot.e, 0, 1); near(a[0].spot.n, -38, 1);
  near(a[1].spot.e, 52, 1); near(a[1].spot.n, -34, 1);
});
test("worked example: tilt 10, 1 Sep", () => {
  for (const [h, e, n] of [[12, 0, -74], [11, -24, -73], [13, 24, -73], [15, 80, -64]]) {
    const s = spot({ tilt: 10 }, h);
    near(s.e, e, 1, `E ${h}h`); near(s.n, n, 1, `N ${h}h`);
  }
});
test("worked example: tilt 20 noon, 21 Jun, 21 Dec", () => {
  const s20 = spot({ tilt: 20 }, 12);
  near(s20.e, 0, 1); near(s20.n, -352, 1);
  const j = run({ tilt: 10, day: JUN }).hours[0].spot;
  near(j.e, 0, 1); near(j.n, -37, 1);
  assert.equal(run({ tilt: 10, day: DEC }).hours[0].spot, null);
});
test("vertical comparison reach is reported per hour", () => {
  const h = run({ tilt: 10, day: SEP }).hours[0];
  near(h.vertical.n, -38, 1);
});

// (4)
test("symmetry: 11:00 and 13:00 mirror in east, equal in north", () => {
  const a = spot({ tilt: 10 }, 11), b = spot({ tilt: 10 }, 13);
  near(a.e, -b.e, 1e-6); near(a.n, b.n, 1e-6);
});

// (5)
test("sun overhead: vertical facade not lit, no spot, no NaN", () => {
  const sun = { altitude: 90, vec: dirFromAngles(90, 0) };
  const h = analyseHour({ ...DEFAULT_INPUT, tilt: 0 }, sun, 12);
  assert.equal(h.spot, null);
  assert.equal(h.litCount, 0);
  assert.equal(h.peak.erel, 0);
  allFinite(h);
});

// (6)
const footprint = (input, sun) => {
  const pts = [[-30, 0], [30, 0], [-30, input.height], [30, input.height]].map(([x, z]) => {
    const f = facadePoint(input, x, z); return landing(f.p, reflect(sun.vec, f.n));
  });
  return { x0: Math.min(...pts.map((p) => p.e)), x1: Math.max(...pts.map((p) => p.e)),
           y0: Math.min(...pts.map((p) => p.n)), y1: Math.max(...pts.map((p) => p.n)) };
};
const interior = (h, fp) => {
  const g = h.grid, out = [];
  for (let iy = 0; iy < g.ny; iy++) for (let ix = 0; ix < g.nx; ix++) {
    const cx0 = g.x0 + ix * g.cell, cy0 = g.y0 + iy * g.cell;
    if (cx0 >= fp.x0 + g.cell && cx0 + g.cell <= fp.x1 - g.cell && cy0 >= fp.y0 + g.cell && cy0 + g.cell <= fp.y1 - g.cell)
      out.push(h.cells[iy * g.nx + ix]);
  }
  return out;
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

test("flux: flat 1 Sep noon tilt 10 rho 0.2 median interior cell = 0.122 +-1%; rho applied once", () => {
  const input = { ...DEFAULT_INPUT, day: SEP, hours: [12] };
  const r = analyse(input), h = r.hours[0];
  const cells = interior(h, footprint(input, sunAt(SEP, 12)));
  assert.ok(cells.length > 100, `interior cells ${cells.length}`);
  near(median(cells), 0.122, 0.00122);
  const r2 = analyse({ ...input, rho: 0.4 }).hours[0];
  const c2 = interior(r2, footprint(input, sunAt(SEP, 12)));
  near(median(c2) / median(cells), 2, 1e-9);
});

// (7)
test("cylinder: rays near the centre line converge near R/2 in plan", () => {
  const input = { ...DEFAULT_INPUT, shape: "cylinder", radius: 60 };
  const s = [0, -1, 0]; // sun along the facade normal, horizontal
  for (const x of [0.5, 5]) {
    const f = facadePoint(input, x, 20), r = reflect(s, f.n);
    const t = (0 - f.p[0]) / r[0]; // reach the x = 0 centre line
    near(f.p[1] + t * r[1], -30, 3, `x ${x}`);
  }
});
test("cylinder ground peak ~2.2x near x +-3, y -24..-27; above flat", () => {
  const c = run({ shape: "cylinder", day: SEP }).hours[0];
  near(c.peak.erel, 2.2, 0.33);
  assert.ok(Math.abs(c.peak.e) <= 6 && c.peak.n >= -33 && c.peak.n <= -18, `peak at ${c.peak.e},${c.peak.n}`);
  assert.ok(c.peak.erel > run({ day: SEP }).hours[0].peak.erel);
});

// (8)
test("everything finite or explicit no spot (flat, cylinder, three seasons, all hours)", () => {
  for (const shape of ["flat", "cylinder"]) for (const day of SEASONS.map((s) => s.n))
    allFinite(analyse({ ...DEFAULT_INPUT, shape, day, hours: undefined }));
  allFinite(analyse({ ...DEFAULT_INPUT, tilt: 30, rho: 0.6, height: 100 }));
});

// (9)
test("zones equal the plan table; default spot in street; default flag false", () => {
  assert.deepEqual(ZONES, [
    { id: "street", label: "Street", x0: -100, x1: 100, y0: -86, y1: -62 },
    { id: "a", label: "Neighbour A", x0: -90, x1: -45, y0: -112, y1: -92 },
    { id: "b", label: "Neighbour B", x0: 30, x1: 85, y0: -112, y1: -92 },
  ]);
  assert.deepEqual(PLAN, { x0: -100, x1: 100, y0: -117, y1: 12 });
  assert.equal(zoneOf(0, -74).id, "street");
  assert.equal(zoneOf(0, -40).id, "open");
  const d = run({ day: SEP }).hours[0];
  assert.equal(d.spot.zone.id, "street");
  assert.equal(d.flag, false);
  assert.equal(run({ day: SEP }).flag, false);
});
test("cylinder R 60 1 Sep noon rho 0.30: flag true, peak > 3x on open ground", () => {
  const r = run({ shape: "cylinder", rho: 0.3, day: SEP }), h = r.hours[0];
  assert.equal(r.flag, true);
  assert.equal(h.flag, true);
  assert.ok(h.peak.erel > FLAG_X);
  assert.equal(h.peak.zone.id, "open");
});
test("property: flag never true for flat glass, rho <= 0.6, tilt 0..30, three seasons", () => {
  for (let tilt = 0; tilt <= 30; tilt += 5) for (const day of SEASONS.map((s) => s.n)) {
    const r = analyse({ ...DEFAULT_INPUT, tilt, rho: 0.6, day, nx: 10, nz: 8, hours: [6, 8, 10, 12, 14, 16, 18] });
    assert.equal(r.flag, false, `tilt ${tilt} day ${day}`);
  }
});

// (10)(11)
test("engine: no DOM/React, reuses sunPosition, header wording", () => {
  const src = readFileSync(new URL("../src/lib/glare/engine.ts", import.meta.url), "utf8");
  assert.ok(!/from ["'](react|react-dom|next)/.test(src));
  assert.ok(!/\b(document|window)\./.test(src));
  assert.match(src, /import \{[^}]*sunPosition[^}]*\} from "\.\.\/patterns-3d\/solar-budget-skin\/engine\.ts"/);
  assert.ok(!/function sunPosition/.test(src));
  const head = src.slice(0, src.indexOf("export"));
  assert.match(head, /NOAA solar equations and BRE solar dazzle method named as references, not verified/);
  assert.match(head, /hand-checked, computed from the repo's own sun formula, not from a standard/);
  assert.match(head, /distances from the facade foot/);
  assert.ok(!/clause\s*\d|IP\s?\d/i.test(head));
});

// (12)
test("sampling: flat default interior cells and Peak within 10% of 0.122", () => {
  const input = { ...DEFAULT_INPUT, day: SEP, hours: [12] };
  const h = analyse(input).hours[0];
  for (const v of interior(h, footprint(input, sunAt(SEP, 12)))) near(v, 0.122, 0.0122);
  near(h.peak.erel, 0.122, 0.0122);
});
test("sampling: cylinder peak at default within 15% of 4x patches; cap flag", () => {
  const base = { ...DEFAULT_INPUT, shape: "cylinder", day: SEP, hours: [12] };
  const a = analyse(base), b = analyse({ ...base, nx: 50, nz: 40 });
  near(a.hours[0].peak.erel, b.hours[0].peak.erel, 0.15 * b.hours[0].peak.erel);
  assert.equal(a.sampleLimited, false);
  const c = analyse({ ...base, nx: 999, nz: 999 });
  assert.equal(c.sampleLimited, true);
  assert.deepEqual(c.samples, SAMPLE_CAP);
});

// (13)
test("self-hit: cylinder 09:00 drops rays; brute-force finds no kept ray crossing the arc", () => {
  const input = { ...DEFAULT_INPUT, shape: "cylinder", day: SEP, radius: 60, nx: 60, nz: 40 };
  const sun = sunAt(SEP, 9);
  const h = analyseHour(input, sun, 9);
  assert.ok(h.droppedCount >= 1);
  assert.ok(h.droppedShare > 0 && h.droppedShare < 1);
  const R = 60, W = 60, cy = -R;
  const crossesArc = (r) => {
    const N = 4000;
    for (let k = 1; k < N; k++) {
      const u = k / N, x = r.x + u * (r.lx - r.x), y = r.y + u * (r.ly - r.y), z = r.z * (1 - u);
      if (Math.hypot(x, y - cy) >= R && z > 0 && Math.abs(Math.atan2(x, y - cy)) * R <= W / 2) return true;
    }
    return false;
  };
  const rays = trace(input, sun);
  let dropped = 0;
  for (const r of rays) {
    if (r.dropped) dropped++;
    else assert.ok(!crossesArc(r), `kept ray crosses arc from x ${r.x} z ${r.z}`);
  }
  assert.equal(dropped, h.droppedCount);
});

// UI data
test("off-plan spot, sample note data, constants", () => {
  const h = run({ tilt: 20, day: SEP }).hours[0];
  assert.equal(h.spot.offPlan, true);
  near(h.spot.dist, 352, 1);
  assert.ok(h.offPlanShare > 0.5); // the lower facade still lands near the foot, on the plan
  assert.equal(CELL_M, 3);
  assert.deepEqual(SEASONS.map((s) => s.n), [172, 244, 355]);
  const st = analyse({ ...DEFAULT_INPUT, day: SEP, hours: [11, 12, 13] });
  const max = Math.max(...st.hours.map((x) => x.cells[100]));
  assert.equal(st.stacked[100], max);
});
