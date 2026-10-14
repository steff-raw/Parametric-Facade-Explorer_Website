// Facade Yield Map, Stage 1 checks (P-0017).
// Run: node --experimental-strip-types --no-warnings scripts/yield-map-checks.mjs [--timings]
import { register } from "node:module";

// The yield-map engine imports the P-0014 engine without a file extension (Next/tsc style); let Node add ".ts".
register(
  "data:text/javascript," +
    encodeURIComponent(
      "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) return next(s + '.ts', c); throw e; } }",
    ),
  import.meta.url,
);

const { CELL, DOME, DAYS, SAMPLE_DAY, haurwitz, sunPosition, toFacade } = await import("../src/lib/patterns-3d/solar-budget-skin/engine.ts");
const E = await import("../src/lib/patterns/yield-map/engine.ts");
const { solve, layout, seriesString, moduleYield, sunSamples, frame, pointSeries, annual, YIELD_CONTEXT, DEFAULT_PARAMS, ROWS, COLS } = E;

const RAD = Math.PI / 180;
const rows = [];
const near = (v, want, tol) => Math.abs(v - want) <= tol;
const check = (id, what, got, pass) => rows.push({ id, what, got, pass });
const f = (v, n = 1) => Number(v).toFixed(n);
const k = (v) => Math.round(v).toLocaleString("en-GB");
const range = (a, b, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
const { orientation: O, latitude: LAT, cutoff: CUT, blockHeight: BH } = DEFAULT_PARAMS;

// (a) solstice noon
const a = sunPosition(51.5, 172, 12);
const aG = haurwitz(a.altitude);
check("a", "noon 21 Jun, lat 51.5: alt 61.95 +-0.05, Haurwitz 908.4 +-1 W/m2", `alt ${f(a.altitude, 2)} G ${f(aG, 1)}`,
  near(a.altitude, 61.95, 0.05) && near(aG, 908.4, 1));

// (b) series string, one sample
const b = seriesString([[400], [400], [200]], [1]);
check("b", "string [400, 400, 200]: 3 x 200 = 600 of 1,000, loss 40.0%", `${b.out} of ${b.ideal}, ${f(b.loss)}%`,
  b.out === 600 && b.ideal === 1000 && near(b.loss, 40, 1e-9));

// (c) module yield
const c = moduleYield(500);
check("c", "H 500 -> 500 x 0.2 x 0.8 x 2.25 = 180.0 kWh/yr", f(c), near(c, 180, 1e-9));

// (d) block 0
const d = solve(O, LAT, 0);
const dL = layout(d, CUT, "rows");
const dSpread = Math.max(...d.H) - Math.min(...d.H);
check("d", "block 0: 64 H equal = H0 (about 1,632), rows = cols = 0%",
  `H ${f(Math.min(...d.H))}-${f(Math.max(...d.H))}, H0 ${f(d.H0)}, rows ${f(dL.rows.loss, 3)} cols ${f(dL.cols.loss, 3)}`,
  dSpread < 1e-6 && near(d.H[0], d.H0, 1e-6) && near(d.H0, 1632, 5) && dL.rows.loss < 1e-9 && dL.cols.loss < 1e-9);

// defaults
const P1 = solve(O, LAT, BH);
const P1L = layout(P1, CUT, "rows");

// (e) cut-off ends
const e0 = layout(P1, 0, "rows").onCount;
const e100 = layout(P1, 100, "rows");
const topOn = range(0, 7).filter((m) => e100.on[m]).length;
const e100b = layout(d, 100, "rows").onCount;
const eOff = layout(P1, 101, "rows");
const eVals = [eOff.kwh, eOff.rows.loss, eOff.cols.loss, eOff.idealKwh, eOff.vsNaive];
check("e", "cut 0 -> 64 on; cut 100 -> 7-8 top-row on (H = H0); block 0 at 100 -> 64",
  `${e0} / ${e100.onCount} (top row ${topOn}) / ${e100b}`,
  e0 === 64 && topOn >= 7 && e100.onCount === topOn && e100b === 64);
check("e", "test-only cut 101: all off -> layout 0, losses 0, no NaN", `on ${eOff.onCount}, ${eVals.map((v) => f(v)).join(", ")}`,
  eOff.onCount === 0 && eOff.kwh === 0 && eOff.rows.loss === 0 && eOff.cols.loss === 0 && eVals.every(Number.isFinite));

// presets
const PRESETS = [
  { name: "P1 S 180 / 51.5", o: 180, lat: 51.5 },
  { name: "P2 W 270 / 51.5", o: 270, lat: 51.5 },
  { name: "P3 N 0 / 51.5", o: 0, lat: 51.5 },
  { name: "P4 E 90 / -33.5", o: 90, lat: -33.5 },
  { name: "S 180 / lat 10", o: 180, lat: 10 },
];
const pres = PRESETS.map((p) => ({ ...p, sol: solve(p.o, p.lat, BH) }));
const sweepOf = (sol) => range(0, 100).map((cut) => layout(sol, cut, "rows").onCount);

// (f) monotone sweep
for (const p of pres) {
  const s = sweepOf(p.sol);
  const mono = s.every((n, i) => i === 0 || n <= s[i - 1]);
  check("f", `${p.name}: on-count non-increasing 0->100, 64 -> below 64`, `${s[0]} -> ${s[100]}`, mono && s[0] === 64 && s[100] < 64);
}

// (g) layout <= ideal <= naive
for (const p of pres) {
  let ok = true;
  for (const cut of range(0, 101)) {
    const L = layout(p.sol, cut, "rows");
    const ideal = L.idealKwh + 1e-9;
    ok &&= L.rows.kwh <= ideal && L.cols.kwh <= ideal && L.idealKwh <= L.naiveKwh + 1e-9;
  }
  check("g", `${p.name}: layout <= ideal <= naive, cut 0-101, rows + cols`, ok ? "all hold" : "violated", ok);
}

// (h) horizontal energy: traced beam + dome diffuse vs P-0014 binned (12 days x hourly)
const s515 = sunSamples(51.5);
const fHoriz = DOME.reduce((a, p) => a + (p.omega * Math.max(0, p.vec[2])) / Math.PI, 0);
const hTraced = s515.reduce((a, s) => a + (s.dni * s.vec[2] + s.dhi * fHoriz) * s.w, 0) / 1000;
let hBinned = 0;
for (let m = 0; m < 12; m++) {
  for (let h = 0; h < 24; h++) hBinned += haurwitz(sunPosition(51.5, SAMPLE_DAY[m], h + 0.5).altitude) * DAYS[m];
}
hBinned /= 1000;
const omega = DOME.reduce((a, p) => a + p.omega, 0);
check("h", "horizontal: traced beam + diffuse = binned total +-1%", `${f(hTraced)} vs ${f(hBinned)} (${f(100 * (hTraced / hBinned - 1), 2)}%)`,
  Math.abs(hTraced / hBinned - 1) <= 0.01);
check("h", "dome: sum omega = 2pi +-1%", `${f(omega / (2 * Math.PI), 5)} x 2pi`, near(omega, 2 * Math.PI, 0.02 * Math.PI));

// (i) left-4 < right-4
const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
const left4 = mean(P1.H.filter((_, m) => m % COLS < 4));
const right4 = mean(P1.H.filter((_, m) => m % COLS >= 4));
check("i", "defaults: left-4 mean H < right-4 mean H", `${k(left4)} < ${k(right4)}`, left4 < right4);

// (j) mirror
const jN = solve(180, 51.5, 0).H0, jS = solve(0, -51.5, 0).H0;
check("j", "no block: O 180 lat 51.5 vs O 0 lat -51.5, H within 5%", `${f(jN)} / ${f(jS)}`, Math.abs(jN - jS) / Math.max(jN, jS) <= 0.05);

// (k) gate
const all = P1.H.map(() => true);
const allL = { rows: E.wire(P1, all, "rows"), cols: E.wire(P1, all, "cols") };
const hMin = Math.min(...P1.H), hMax = Math.max(...P1.H);
const spread = (100 * (hMax - hMin)) / hMax;
check("k", "gate: spread (max - min)/max >= 25%", `${k(hMin)}-${k(hMax)}, ${f(spread)}%`, spread >= 25);
check("k", "gate: all 64 on, |rows - cols| >= 1 pt (instantaneous)", `rows ${f(allL.rows.loss)} / cols ${f(allL.cols.loss)}`,
  Math.abs(allL.rows.loss - allL.cols.loss) >= 1);
check("k", "gate: left-4 < right-4 (see i)", `${k(left4)} < ${k(right4)}`, left4 < right4);
check("k", "gate: cut-off 76% -> 55 +-2 on", `${P1L.onCount} of 64`, Math.abs(P1L.onCount - 55) <= 2);
const within1 = (v, want) => Math.abs(v - want) <= Math.max(0.01 * Math.abs(want), 0.05);
const bars = [0.0, 2.7, 14.3, 20.2, 25.1, 28.4, 33.0, 8.7];
check("k", "default view = Evaluator run +-1%: layout 24,197 / 25,619, naive 32,471",
  `${k(P1L.rows.kwh)} / ${k(P1L.cols.kwh)}, naive ${k(P1L.naiveKwh)}`,
  within1(P1L.rows.kwh, 24197) && within1(P1L.cols.kwh, 25619) && within1(P1L.naiveKwh, 32471));
check("k", "default view: rows 15.2% / cols 10.2%, row bars as Evaluator (+-1% or 0.05 pt)",
  `rows ${f(P1L.rows.loss)} / cols ${f(P1L.cols.loss)}; ${P1L.rows.strings.map((x) => f(x)).join(" ")}`,
  within1(P1L.rows.loss, 15.2) && within1(P1L.cols.loss, 10.2) && P1L.rows.strings.every((x, i) => within1(Number(f(x)), bars[i])));

// (l) presets printed
const presL = pres.map((p) => ({ ...p, L: layout(p.sol, CUT, "rows") }));
check("l", "presets P1-P4 printed (table below), all finite", presL.slice(0, 4).map((p) => p.name.split(" ")[0]).join(", "),
  presL.every((p) => p.sol.H.every(Number.isFinite) && Number.isFinite(p.L.kwh)));

// (m) accuracy: dense daily 5-min reference
const ctx = { ...YIELD_CONTEXT, blockHeight: BH };
const centre = (m) => [((m % COLS) + 0.5) * CELL, (ROWS - Math.floor(m / COLS) - 0.5) * CELL];
const dense = sunSamples(LAT, 1, 5);
const fDense = frame(O, dense);
const mErr = Math.max(...P1.H.map((h, m) => Math.abs(h / annual(pointSeries(fDense, ...centre(m), ctx), dense) - 1)));
check("m", "traced weekly 15-min vs dense daily 5-min at P1: max per-cell error <= 2.5%", `${f(100 * mErr, 2)}%`, mErr <= 0.025);
// binned (P-0014 style: sun to nearest patch, 12 days x hourly) vs traced, unobstructed vertical S
const local = DOME.map((p) => toFacade(p.vec, 180));
const svf = local.reduce((a, v, i) => a + (v[2] > 0 ? DOME[i].omega * v[2] : 0), 0) / Math.PI;
let hBin = 0;
for (let m = 0; m < 12; m++) {
  for (let h = 0; h < 24; h++) {
    const sun = sunPosition(51.5, SAMPLE_DAY[m], h + 0.5);
    if (sun.altitude <= 0) continue;
    const ghi = haurwitz(sun.altitude) * DAYS[m];
    let best = 0, bestDot = -2;
    DOME.forEach((p, i) => {
      const dot = p.vec[0] * sun.vec[0] + p.vec[1] * sun.vec[1] + p.vec[2] * sun.vec[2];
      if (dot > bestDot) { bestDot = dot; best = i; }
    });
    hBin += ((0.85 * ghi) / Math.sin(sun.altitude * RAD)) * Math.max(0, local[best][2]) + 0.15 * ghi * svf;
  }
}
hBin /= 1000;
check("m", "unobstructed vertical S: binned vs traced within 3% (1,605 vs 1,632)", `${f(hBin)} vs ${f(d.H0)}`,
  Math.abs(hBin / d.H0 - 1) <= 0.03);

// (n) annual rule vs instantaneous rule
const nA = [800, 400], nB = [400, 800];
const nAnnual = seriesString([[nA[0] + nA[1]], [nB[0] + nB[1]]], [1]);
const nInst = seriesString([nA, nB], [1, 1]);
check("n", "G_A [800, 400], G_B [400, 800]: annual rule 0%, instantaneous 1,600 of 2,400 = 33.3%",
  `annual ${f(nAnnual.loss)}%, inst ${nInst.out} of ${nInst.ideal} = ${f(nInst.loss)}%`,
  nAnnual.loss === 0 && nInst.out === 1600 && nInst.ideal === 2400 && near(nInst.loss, 100 / 3, 1e-9));

// (o) block-height keep-gate
const HEIGHTS = [0, 6, 12, 18, 24, 30];
const hTable = HEIGHTS.map((h) => {
  const sol = solve(O, LAT, h);
  const on = sol.H.map(() => true);
  return { h, sol, rows: E.wire(sol, on, "rows").loss, cols: E.wire(sol, on, "cols").loss, cut: layout(sol, CUT, "rows") };
});
const span = (xs) => Math.max(...xs) - Math.min(...xs);
const rSpan = span(hTable.map((x) => x.rows)), cSpan = span(hTable.map((x) => x.cols));
check("o", "block height 0-30: rows % and cols % each move >= 5 pts (keep slider)", `rows ${f(rSpan)} pts, cols ${f(cSpan)} pts`,
  rSpan >= 5 && cSpan >= 5);

// (p) 1 vs 2 x 2 sample points
const fP = frame(O, P1.samples);
const pErr = Math.max(...P1.H.map((h, m) => {
  const [x, y] = centre(m);
  const four = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dy]) =>
    annual(pointSeries(fP, x + dx * CELL / 4, y + dy * CELL / 4, ctx), P1.samples));
  return Math.abs(h / mean(four) - 1);
}));
check("p", "centre vs 2 x 2 points per module: max difference <= 2%", `${f(100 * pErr, 2)}%`, pErr <= 0.02);

// (q) London comparison via PVGIS
const PVGIS = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=51.5&lon=-0.1&peakpower=1&loss=14&angle=0&aspect=0&outputformat=json";
const FALLBACK = "PVGIS not reachable, 975 approximate/secondary";
let qLine = FALLBACK, qPass;
try {
  const res = await fetch(PVGIS, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hy = (await res.json()).outputs.totals.fixed["H(i)_y"];
  qLine = `PVGIS horizontal London ${f(hy, 0)} kWh/m2 yr, ${PVGIS}, fetched ${new Date().toISOString().slice(0, 10)}`;
  qPass = false; // footnote still says "about 975": it must be updated to the PVGIS value before this passes
} catch {
  qPass = E.LONDON_FOOTNOTE.includes("about 975") && E.LONDON_FOOTNOTE.includes("approximate") && E.LONDON_FOOTNOTE.includes("secondary source");
}
check("q", "London: PVGIS value printed, or fallback line; footnote matches", qLine, qPass);

// ---- print
const pad = (v, w) => String(v).padEnd(w);
const passed = rows.filter((x) => x.pass).length;

if (!process.argv.includes("--timings")) {
  console.log("Facade Yield Map, Stage 1 checks (P-0017)\n");
  console.log(`${pad("case", 5)}${pad("check", 84)}${pad("value", 70)}result`);
  console.log("-".repeat(165));
  for (const x of rows) console.log(`${pad(x.id, 5)}${pad(x.what, 84)}${pad(x.got, 70)}${x.pass ? "PASS" : "FAIL"}`);
  console.log(`\n${passed}/${rows.length} pass`);

  const grid = (sol, L) => {
    for (let r = 0; r < ROWS; r++) {
      const line = range(0, COLS - 1).map((cc) => {
        const m = r * COLS + cc;
        return k(sol.H[m]).padStart(6) + (L.on[m] ? " " : "x");
      });
      console.log("  " + line.join(""));
    }
  };
  console.log(`\nDefault grid, ${E.GRID_HEADER} (S 180, lat 51.5, block 12 m; row 0 = top, col 0 = left seen from outside; x = off at cut-off 76%)`);
  grid(P1, P1L);
  console.log(`  H0 (unshaded) ${f(P1.H0)}; cut-off 76% = ${f(P1L.threshold)} kWh/m2 yr; range ${k(hMin)}-${k(hMax)}, spread ${f(spread)}%`);

  const kpi = (L) =>
    `on ${L.onCount}/64 | rows ${f(L.rows.loss)}% cols ${f(L.cols.loss)}% | layout rows ${k(L.rows.kwh)} cols ${k(L.cols.kwh)} kWh/yr | ideal ${k(L.idealKwh)} | naive ${k(L.naiveKwh)} | rows vs naive ${f(L.vsNaive)}%`;
  console.log("\nDefault view KPIs (cut-off 76%)");
  console.log(`  ${kpi(P1L)}`);
  console.log(`  row-string bars %: ${P1L.rows.strings.map((x) => f(x)).join(" ")}`);
  console.log(`  col-string bars %: ${P1L.cols.strings.map((x) => f(x)).join(" ")}`);
  console.log(`  all 64 on: rows ${f(allL.rows.loss)}% / cols ${f(allL.cols.loss)}%`);

  console.log("\nCut-off sweep at P1 (cut %, on, rows %, cols %, layout rows kWh, layout cols kWh)");
  for (const cut of [...range(0, 100, 10), 76].sort((x, y) => x - y)) {
    const L = layout(P1, cut, "rows");
    console.log(`  ${String(cut).padStart(3)}%  ${String(L.onCount).padStart(2)}  ${f(L.rows.loss).padStart(5)}  ${f(L.cols.loss).padStart(5)}  ${k(L.rows.kwh).padStart(6)}  ${k(L.cols.kwh).padStart(6)}`);
  }
  console.log("  on-count steps (cut:on): " + sweepOf(P1).map((n, i, s) => (i === 0 || n !== s[i - 1] ? `${i}:${n}` : "")).filter(Boolean).join(" "));

  console.log("\nBlock-height table (S 180, lat 51.5; all 64 on rows/cols %, then cut-off 76%)");
  for (const x of hTable) {
    console.log(`  h ${String(x.h).padStart(2)} m: all-on rows ${f(x.rows).padStart(4)} / cols ${f(x.cols).padStart(4)} ${x.rows > x.cols ? "rows > cols" : "rows <= cols"} | cut 76: on ${x.cut.onCount}, rows ${f(x.cut.rows.loss)} / cols ${f(x.cut.cols.loss)}`);
  }

  console.log("\nPresets (block 12 m, cut-off 76%)");
  for (const p of presL) {
    const lo = Math.min(...p.sol.H), hi = Math.max(...p.sol.H);
    const sw = [0, 25, 50, 75, 90, 100].map((cut) => layout(p.sol, cut, "rows").onCount).join("/");
    console.log(`  ${pad(p.name, 18)}H ${k(lo)}-${k(hi)} (${f((100 * (hi - lo)) / hi)}%), H0 ${k(p.sol.H0)} | ${kpi(p.L)} | sweep 0/25/50/75/90/100: ${sw}`);
  }

  console.log("\nLabels");
  for (const line of [E.GRID_HEADER, E.STRING_LABEL, E.CAPTION, `Horizontal (engine sampling) ${k(hTraced)} kWh/m2 yr`, qLine, E.LONDON_FOOTNOTE]) console.log(`  ${line}`);
} else {
  const time = (fn, reps) => {
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fn(i);
    return (performance.now() - t0) / reps;
  };
  console.log("Facade Yield Map, Stage 1 timings (P-0017; Node, this machine; ms per move, 8 x 8)\n");
  const orient = time((i) => solve((i % 16) * 22.5, LAT, BH), 32);
  const lat = time((i) => solve(O, 30 + i * 0.5, BH), 20);
  const height = time((i) => solve(O, LAT, (i % 16) * 2), 32);
  const cut = time((i) => layout(P1, 50 + i, "rows"), 40);
  const str = time((i) => layout(P1, CUT, i % 2 ? "rows" : "cols"), 40);
  console.log(`  Orientation move ${f(orient, 1)} | Latitude move ${f(lat, 1)} | Block height move ${f(height, 1)} | Cut-off move ${f(cut, 1)} | Stringing toggle ${f(str, 1)}`);
  console.log("  (a solve move is followed by one layout re-derive in the page)");
}

process.exitCode = passed === rows.length ? 0 : 1;
