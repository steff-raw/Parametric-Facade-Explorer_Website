// Adaptive Panel, Stage 1 checks (P-0023).
// Run: node --experimental-strip-types --no-warnings scripts/adaptive-panel-checks.mjs
import { register } from "node:module";

// The adaptive-panel engine imports the P-0014 engine without a file extension (Next/tsc style); let Node add ".ts".
register(
  "data:text/javascript," +
    encodeURIComponent(
      "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
    ),
  import.meta.url,
);

const { sunPosition, SAMPLE_DAY } = await import("../src/lib/patterns-3d/solar-budget-skin/engine.ts");
const E = await import("../src/lib/patterns-3d/adaptive-panel/engine.ts");
const { sun, svf, tauD, tauB, gain, kineticDepth, depthSeries, sunPath, dayResult, equalGainDepth, DAY_MONTHS, DEPTHS, CHART_HOURS, DEFAULTS } = E;

const rows = [];
const near = (v, want, tol) => Math.abs(v - want) <= tol;
const check = (id, what, got, pass) => rows.push({ id, what, got, pass });
const f = (v, n = 2) => Number(v).toFixed(n);
const [JUN, DEC, MAR] = DAY_MONTHS;
const NAMES = { [JUN]: "Jun", [DEC]: "Dec", [MAR]: "Mar" };
const { cap: CAP, staticDepth: STATIC } = DEFAULTS;
const sameDepth = (a, b) => Math.abs(a - b) < 1e-9;
const inChart = (s) => s.hours.map((h, i) => [h, i]).filter(([h]) => h >= 7.5 && h <= 16.5);

// (a) 21 Jun 12:30, open
const a = gain(JUN, 12.5, 0);
check("a", "21 Jun 12:30, d = 0: gain 288 +-1 W/m2", f(a, 1), near(a, 288, 1));

// (b) open glass: tau_b 1, SVF 0.5, sky view 100
const bVec = sun(JUN, 12.5).vec;
const bSky = dayResult(JUN, CAP, 0).skyView.static;
check("b", "d = 0: tau_b = 1, SVF = 0.5 +-0.01, sky view kept 100", `tau_b ${f(tauB(bVec, 0), 3)} SVF ${f(svf(0), 4)} sky ${f(bSky, 1)}`,
  tauB(bVec, 0) === 1 && near(svf(0), 0.5, 0.01) && bSky === 100);

// (c) gain non-increasing in d, every sun-up hour of the three days
let cBad = 0, cN = 0;
for (const m of DAY_MONTHS) {
  for (const h of depthSeries(m, CAP, STATIC).hours) {
    for (let i = 1; i < DEPTHS.length; i++) {
      cN++;
      if (gain(m, h, DEPTHS[i]) > gain(m, h, DEPTHS[i - 1]) + 1e-9) cBad++;
    }
  }
}
check("c", "gain non-increasing in d (all sun-up hours, 3 days, 0 to 0.6)", `${cN} steps, ${cBad} increases`, cBad === 0);

// (d) prototype table
const PROTO = {
  [JUN]: { open: 1.9, stat: 1.14, kin: 1.21, moves: 6, glare: [6, 4] },
  [DEC]: { open: 2.39, stat: 2.28, kin: 2.39, moves: 0, glare: [7, 7] },
  [MAR]: { open: 3.16, stat: 2.68, kin: 3.16, moves: 0, glare: [8, 8] },
};
for (const m of DAY_MONTHS) {
  const r = dayResult(m, CAP, STATIC);
  const p = PROTO[m];
  const ok = near(r.open, p.open, 0.05) && near(r.static, p.stat, 0.05) && near(r.kinetic, p.kin, 0.05) && r.moves === p.moves &&
    (m !== JUN || (r.glare.static === 6 && r.glare.kinetic === 4));
  check("d", `${NAMES[m]}: open/static/kinetic ${p.open}/${p.stat}/${p.kin} +-0.05, ${p.moves} moves${m === JUN ? ", glare 6/4" : ""}`,
    `${f(r.open)}/${f(r.static)}/${f(r.kinetic)} kWh/m2, ${r.moves} moves${m === JUN ? `, glare ${r.glare.static}/${r.glare.kinetic}` : ""}`, ok);
}

// (e) June depth series, 07:30 to 16:30
const JUNE = [0, 0, 0.2, 0.4, 0.5, 0.5, 0.4, 0.2, 0, 0];
const eS = depthSeries(JUN, CAP, STATIC);
const eK = inChart(eS).map(([, i]) => eS.kinetic[i]);
check("e", "June kinetic depth 07:30-16:30 = 0 0 .2 .4 .5 .5 .4 .2 0 0", eK.join(" "),
  eK.length === 10 && eK.every((d, i) => sameDepth(d, JUNE[i])));

// (f) Dec / Mar kinetic open every sun-up hour
for (const m of [DEC, MAR]) {
  const s = depthSeries(m, CAP, STATIC);
  check("f", `${NAMES[m]}: kinetic d = 0 every sun-up hour`, `${s.hours.length} h, max d ${f(Math.max(...s.kinetic), 1)}`,
    s.kinetic.every((d) => d === 0));
}

// (g) cap honoured where the gate passes
let gN = 0, gBad = 0;
for (const cap of [100, 150, 200, 250, 300]) {
  for (const m of DAY_MONTHS) {
    const s = depthSeries(m, cap, STATIC);
    s.hours.forEach((h, i) => {
      if (kineticDepth(m, h, 1e9) === 0 && kineticDepth(m, h, 0) === 0) return; // gate closed: open by rule
      gN++;
      const d = s.kinetic[i];
      if (!(gain(m, h, d) <= cap + 1e-9 || sameDepth(d, 0.6))) gBad++;
    });
  }
}
check("g", "gate-passed hours: gain <= cap or d = 0.6 (caps 100-300, 3 days)", `${gN} hours, ${gBad} breaches`, gN > 0 && gBad === 0);

// (h) cap extremes
const hHuge = DAY_MONTHS.map((m) => ({ s: depthSeries(m, 1e9, STATIC), r: dayResult(m, 1e9, STATIC) }));
const hHugeOk = hHuge.every(({ s, r }) => s.kinetic.every((d) => d === 0) && r.moves === 0);
const hZero = depthSeries(JUN, 0, STATIC);
const hGatePassed = hZero.hours.filter((h) => {
  const v = sun(JUN, h).vec;
  return v[2] > 0 && Math.atan2(v[1], v[2]) * (180 / Math.PI) >= 45;
});
const hZeroOk = hGatePassed.length > 0 && hGatePassed.every((h) => sameDepth(hZero.kinetic[hZero.hours.indexOf(h)], 0.6)) &&
  hZero.kinetic.every((d, i) => hGatePassed.includes(hZero.hours[i]) || d === 0);
check("h", "cap 1e9: d = 0, moves 0 (3 days); cap 0, Jun: d = 0.6 where gate passes, else 0",
  `huge ${hHugeOk ? "all open, 0 moves" : "FAIL"}; cap 0: ${hGatePassed.length} gate h, ${hZero.kinetic.filter((d) => sameDepth(d, 0.6)).length} at 0.6, rest 0`, hHugeOk && hZeroOk);

// (i) equal-gain static depth reproduces kinetic heat
for (const m of DAY_MONTHS) {
  const d = equalGainDepth(m, CAP);
  const k = dayResult(m, CAP, STATIC).kinetic;
  const s = dayResult(m, CAP, d).static;
  check("i", `${NAMES[m]}: equal-gain static depth gives kinetic heat +-1%`, `d ${f(d, 3)} m: static ${f(s, 3)} vs kinetic ${f(k, 3)}`,
    Math.abs(s - k) <= 0.01 * k);
}

// (j) diffuse factor
check("j", "tau_d(0.3) = 0.82 +-0.02, tau_d(0.6) = 0.68 +-0.02", `${f(tauD(0.3), 3)} / ${f(tauD(0.6), 3)}`,
  near(tauD(0.3), 0.82, 0.02) && near(tauD(0.6), 0.68, 0.02));

// (k) no NaN at night, lat 0, lat 70
const finite = (x) => (typeof x === "number" ? Number.isFinite(x) : Array.isArray(x) ? x.every(finite) : Object.values(x).every(finite));
let kBad = 0, kN = 0;
for (const lat of [0, 52, 70]) {
  for (const m of DAY_MONTHS) {
    const vals = [gain(m, 0.5, 0, lat), gain(m, 0.5, 0.6, lat), kineticDepth(m, 0.5, CAP, lat), depthSeries(m, CAP, STATIC, lat),
      dayResult(m, CAP, STATIC, lat), equalGainDepth(m, CAP, lat), sunPath(m, lat)];
    kN += vals.length;
    kBad += vals.filter((v) => !finite(v)).length;
  }
}
check("k", "no NaN: 00:30, lat 0 / 52 / 70, 3 days, all functions", `${kN} results, ${kBad} non-finite`, kBad === 0);

// (l) sunPath
for (const m of DAY_MONTHS) {
  const p = sunPath(m);
  let want = 0;
  for (let k = 0; k < 48; k++) if (sunPosition(52, SAMPLE_DAY[m], k / 2).altitude > 0) want++;
  const unit = p.every(({ vec }) => near(Math.hypot(...vec), 1, 0.001));
  check("l", `${NAMES[m]} sunPath: y > 0, unit +-0.001, count = sun-up half-hours`, `${p.length} points (want ${want}), min y ${f(Math.min(...p.map((x) => x.vec[1])), 3)}`,
    p.length === want && p.every(({ vec }) => vec[1] > 0) && unit);
}

// (m) depthSeries = prototype series
for (const m of DAY_MONTHS) {
  const s = depthSeries(m, CAP, STATIC);
  const win = inChart(s);
  const k = win.map(([, i]) => s.kinetic[i]);
  const outside = s.kinetic.filter((d, i) => !win.some(([, j]) => j === i));
  // Jun: the 10 prototype hours; Dec / Mar: open at every sun-up hour inside the window (Dec has only 08:30 to 15:30)
  const kOk = m === JUN ? k.length === 10 && k.every((d, i) => sameDepth(d, JUNE[i])) : k.length > 0 && k.every((d) => d === 0);
  const ok = kOk && outside.every((d) => d === 0) &&
    s.static.every((d) => d === STATIC) && s.static.length === s.hours.length && s.kinetic.length === s.hours.length;
  check("m", `${NAMES[m]} depthSeries: kinetic = prototype, 0 outside 07:30-16:30, static 0.3`, `kinetic ${k.join(" ")} | static ${STATIC} x ${s.static.length}`, ok);
}

// (n) glare hours
for (const m of DAY_MONTHS) {
  const r = dayResult(m, CAP, STATIC);
  const [ws, wk] = PROTO[m].glare;
  check("n", `${NAMES[m]} glare h static / kinetic = ${ws} / ${wk}`, `${r.glare.static} / ${r.glare.kinetic}`, r.glare.static === ws && r.glare.kinetic === wk);
}

// (o) 12:30 June sun
const o = sun(JUN, 12.5);
check("o", "Jun 12:30: alt 60.9 +-0.2, vec (-0.120, 0.874, 0.472) +-0.005", `alt ${f(o.altitude, 2)} vec (${o.vec.map((v) => f(v, 3)).join(", ")})`,
  near(o.altitude, 60.9, 0.2) && near(o.vec[0], -0.12, 0.005) && near(o.vec[1], 0.874, 0.005) && near(o.vec[2], 0.472, 0.005));

// ---- print
const pad = (v, w) => String(v).padEnd(w);
const passed = rows.filter((x) => x.pass).length;
console.log("Adaptive Panel, Stage 1 checks (P-0023)\n");
console.log(`${pad("case", 5)}${pad("check", 80)}${pad("value", 62)}result`);
console.log("-".repeat(153));
for (const x of rows) console.log(`${pad(x.id, 5)}${pad(x.what, 80)}${pad(x.got, 62)}${x.pass ? "PASS" : "FAIL"}`);
console.log(`\n${passed}/${rows.length} pass`);

console.log("\nPrototype at defaults (cap 150, gate 45, static 0.3 m; kWh/m2 of glass, all sun-up hours)");
console.log(`  ${pad("day", 5)}${pad("open", 7)}${pad("static", 8)}${pad("kinetic", 9)}${pad("k - s", 16)}${pad("moves", 7)}${pad("glare s/k", 11)}${pad("sky view s/k", 14)}equal-gain d`);
for (const m of DAY_MONTHS) {
  const r = dayResult(m, CAP, STATIC);
  const diff = r.kinetic - r.static;
  console.log(`  ${pad(NAMES[m], 5)}${pad(f(r.open), 7)}${pad(f(r.static), 8)}${pad(f(r.kinetic), 9)}${pad(`${diff >= 0 ? "+" : ""}${f(diff)} (${f((100 * diff) / r.static, 0)}%)`, 16)}${pad(r.moves, 7)}${pad(`${r.glare.static} / ${r.glare.kinetic}`, 11)}${pad(`${f(r.skyView.static, 0)} / ${f(r.skyView.kinetic, 0)}`, 14)}${f(equalGainDepth(m, CAP), 3)} m`);
}
console.log("\nJune by hour (W/m2 of glass)");
console.log(`  ${pad("", 10)}${CHART_HOURS.map((h) => pad(`${String(Math.floor(h)).padStart(2, "0")}:30`, 7)).join("")}`);
console.log(`  ${pad("depth m", 10)}${CHART_HOURS.map((h) => pad(f(kineticDepth(JUN, h, CAP), 1), 7)).join("")}`);
console.log(`  ${pad("kinetic", 10)}${CHART_HOURS.map((h) => pad(f(gain(JUN, h, kineticDepth(JUN, h, CAP)), 1), 7)).join("")}`);
console.log(`  ${pad("static .3", 10)}${CHART_HOURS.map((h) => pad(f(gain(JUN, h, STATIC), 1), 7)).join("")}`);
console.log(`  ${pad("open", 10)}${CHART_HOURS.map((h) => pad(f(gain(JUN, h, 0), 1), 7)).join("")}`);

process.exitCode = passed === rows.length ? 0 : 1;
