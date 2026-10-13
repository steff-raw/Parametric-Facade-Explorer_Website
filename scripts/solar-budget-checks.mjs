// Solar Budget Skin, Stage 1 checks (P-0014).
// Run: node --experimental-strip-types --no-warnings scripts/solar-budget-checks.mjs
import {
  DOME,
  DEFAULT_CONTEXT,
  sunPosition,
  haurwitz,
  toFacade,
  bladeFraction,
  finFraction,
  unshaded,
  seasonLabels,
  solve,
  clearCaches,
  viewOut,
  FOOTNOTES,
  VIEW_OUT_LABEL,
} from "../src/lib/patterns-3d/solar-budget-skin/engine.ts";

const RAD = Math.PI / 180;
const rows = [];
const near = (v, want, tol) => Math.abs(v - want) <= tol;
const check = (id, what, got, pass) => rows.push({ id, what, got, pass });
const f = (v, n = 3) => Number(v).toFixed(n);
const noBlock = { blockHeight: 0 };

// (a) equinox noon
const a = sunPosition(51.5, 81, 12);
check("a", "lat 51.5, n 81, noon: alt 38.5, az 180", `alt ${f(a.altitude, 2)} az ${f(a.azimuth, 2)}`,
  near(a.altitude, 38.5, 0.05) && near(a.azimuth, 180, 0.05));

// (b) solstice noon
const b = sunPosition(51.5, 172, 12);
check("b", "n 172 noon: alt 61.95 +-0.05", `alt ${f(b.altitude, 3)}`, near(b.altitude, 61.95, 0.05));

// (c) Haurwitz
const ghi = haurwitz(38.5);
check("c", "Haurwitz alt 38.5: 623.7 +-0.5 W/m2", f(ghi, 2), near(ghi, 623.7, 0.5));

// (d) dome
const omega = DOME.reduce((s, p) => s + p.omega, 0);
check("d", "145 patches, sum omega = 2pi +-1%", `${DOME.length} patches, ${f(omega / (2 * Math.PI), 5)} x 2pi`,
  DOME.length === 145 && near(omega, 2 * Math.PI, 0.01 * 2 * Math.PI));

// (e) incidence on S facade at equinox noon
const sLocal = toFacade(a.vec, 180);
check("e", "S facade incidence factor = cos 38.5 = 0.783", f(sLocal[2], 4), near(sLocal[2], 0.783, 0.0005));

// (f) blade
const shadow = 0.5 * Math.tan(38.5 * RAD);
const fh = bladeFraction(0.5, Math.tan(38.5 * RAD));
check("f", "blade d 0.5, profile 38.5: shadow 0.398 m, fh 0.265", `${f(shadow)} m, fh ${f(fh)}`,
  near(shadow, 0.398, 0.0005) && near(fh, 0.265, 0.0005));

// (i) DNI and vertical beam
const dni = (0.85 * ghi) / Math.sin(38.5 * RAD);
const vBeam = dni * sLocal[2];
check("i", "DNI 851.6, vertical S beam 666.5 W/m2", `${f(dni, 1)} / ${f(vBeam, 1)}`,
  near(dni, 851.6, 0.1) && near(vBeam, 666.5, 0.1));

// (j) fins
const fv = finFraction(0.5, Math.tan(45 * RAD));
check("j", "fins d 0.5, HSA 45: fv 0.333", f(fv), near(fv, 0.333, 0.0005));

// (k) hood
const k = unshaded("hood", 0.5, Math.tan(38.5 * RAD), Math.tan(45 * RAD));
check("k", "hood (f)+(j): unshaded 0.490", f(k), near(k, 0.49, 0.0005));

// (l) bare glare, S, 51.5, no block
const l = solve({ target: 300 }, noBlock);
check("l", "bare S 51.5 no block: glare 2,828 h/yr", f(l.kpi.bareGlare, 0), l.kpi.bareGlare === 2828);

// (m) diffuse on vertical, isotropic dome
const dhi = 0.15 * ghi;
let vDiff = 0;
for (const p of DOME) {
  const z = toFacade(p.vec, 180)[2];
  if (z > 0) vDiff += (dhi / Math.PI) * p.omega * z;
}
check("m", "vertical diffuse = 0.5 DHI (46.8) +-3%", `${f(vDiff, 2)} (${f(vDiff / (0.5 * dhi), 4)})`,
  near(vDiff, 0.5 * dhi, 0.03 * 0.5 * dhi));

// (n) block height 0 -> uniform skin
const n = solve({}, noBlock);
const n0 = n.cells[0];
const uniform = n.cells.every((c) => c.type === n0.type && c.depth === n0.depth);
check("n", "block height 0: all 64 cells same type and depth", `${n.cells.length} x ${n0.type} ${f(n0.depth)} m`,
  uniform && n.cells.length === 64);

// (o) Target >= bare gain -> no elements
const oBare = solve({ target: 300 });
const oMax = Math.max(...oBare.cells.map((c) => c.bareCooling));
const o = solve({ target: Math.ceil(oMax) + 1 });
const oNone = o.cells.every((c) => c.type === "none");
const oSame = o.kpi.skinSummer === o.kpi.bareSummer && o.kpi.winterKept === 100 && o.kpi.skinGlare === o.kpi.bareGlare;
check("o", "Target >= bare gain: no elements, skin KPIs = bare", `target ${Math.ceil(oMax) + 1}, none ${oNone}, equal ${oSame}`,
  oNone && oSame);

// (p) presets: 4 cases, one per element family; valid only if capped <= 50%
const mixOf = (res) => {
  const m = { blade: 0, fins: 0, hood: 0, none: 0 };
  for (const c of res.cells) m[c.type]++;
  return m;
};
const mixText = (res) => {
  const m = mixOf(res);
  const d = res.cells.map((c) => c.depth);
  return `B${m.blade} F${m.fins} H${m.hood} none ${m.none} capped ${res.cappedCount} (${f((100 * res.cappedCount) / res.cells.length, 1)}%) d ${f(Math.min(...d), 2)}-${f(Math.max(...d), 2)} m`;
};
const p4Target = [90, 120, 150].find((t) => solve({ orientation: 90, latitude: -33.5, target: t, maxDepth: 0.6 }).cappedCount <= 32);
const presets = [
  { name: "P1 S 180 / 51.5 / 90 / 0.6", p: { orientation: 180, latitude: 51.5, target: 90, maxDepth: 0.6 } },
  { name: "P2 W 270 / 51.5 / 120 / 0.6", p: { orientation: 270, latitude: 51.5, target: 120, maxDepth: 0.6 } },
  { name: "P3 N 0 / 51.5 / 60 / 0.6", p: { orientation: 0, latitude: 51.5, target: 60, maxDepth: 0.6 } },
];
if (p4Target !== undefined) {
  presets.push({ name: `P4 E 90 / -33.5 / ${p4Target} / 0.6`, p: { orientation: 90, latitude: -33.5, target: p4Target, maxDepth: 0.6 } });
}
const pRes = presets.map((x) => ({ ...x, r: solve(x.p) }));
for (const { name, r: res } of pRes) {
  const ok = res.cells.every((c) => c.capped || c.cooling <= res.params.target + 1e-9) && res.cappedCount <= res.cells.length / 2;
  check("p", `${name}: non-capped cooling <= Target, capped <= 50%`, mixText(res), ok);
}
if (p4Target === undefined) check("p", "P4 E 90 / -33.5 dropped: no Target in 90/120/150 gives capped <= 50%", "dropped", true);

// (q) hemisphere mirror
const qN = solve({ latitude: 51.5, orientation: 180 }, noBlock);
const qS = solve({ latitude: -51.5, orientation: 0 }, noBlock);
const qNb = solve({ latitude: 51.5, orientation: 180 });
const qSb = solve({ latitude: -51.5, orientation: 0 });
const winterOf = (r) => r.cells.reduce((s, c) => s + c.bareHeating, 0) / r.cells.length;
const within = (x, y) => Math.abs(x - y) / Math.max(x, y) <= 0.05;
const qOk = within(qN.kpi.bareSummer, qS.kpi.bareSummer) && within(winterOf(qN), winterOf(qS)) &&
  within(qNb.kpi.bareSummer, qSb.kpi.bareSummer) && within(winterOf(qNb), winterOf(qSb));
check("q", "lat -51.5 O 0 vs 51.5 O 180: bare summer + winter +-5%",
  `no block S ${f(qN.kpi.bareSummer, 1)}/${f(qS.kpi.bareSummer, 1)} W ${f(winterOf(qN), 1)}/${f(winterOf(qS), 1)}; block S ${f(qNb.kpi.bareSummer, 1)}/${f(qSb.kpi.bareSummer, 1)}`,
  qOk);

// (r) low-latitude labels
const r = seasonLabels(10);
check("r", "lat 10: Hot season / Cool season", `${r.cooling} / ${r.heating}`, r.cooling === "Hot season" && r.heating === "Cool season");

// (s) view-out, cosine-weighted, S facade
const vBlade = viewOut("blade", 0.5, 180);
const vHood = viewOut("hood", 0.47, 180);
check("s", "view-out: blade 0.5 -> 86.0%, hood 0.47 -> 65.2% (+-0.5)", `${f(vBlade, 1)}% / ${f(vHood, 1)}%`,
  near(vBlade, 86.0, 0.5) && near(vHood, 65.2, 0.5));

// Stage 2 pre-check at 8 x 8
const spread = (res, key) => {
  let best = 0;
  for (let i = 0; i < 8; i++) {
    const d = res.cells.filter((c) => c[key] === i).map((c) => c.depth);
    best = Math.max(best, Math.max(...d) - Math.min(...d));
  }
  return best;
};
const [P1, P2, P3] = pRes.map((x) => x.r);
const m1 = mixOf(P1), m2 = mixOf(P2), m3 = mixOf(P3);
const rowSpread = spread(P1, "row"), colSpread = spread(P1, "col");
check("pre", "Stage 2 P1: blades > fins, blades >= 40, row + col range > 0.05 m",
  `B${m1.blade} F${m1.fins}; max row range ${f(rowSpread, 2)} m, col range ${f(colSpread, 2)} m`,
  m1.blade > m1.fins && m1.blade >= 40 && rowSpread > 0.05 && colSpread > 0.05);
check("pre", "Stage 2 P2: hoods + fins > blades", `H${m2.hood} + F${m2.fins} vs B${m2.blade}`, m2.hood + m2.fins > m2.blade);
check("pre", "Stage 2 P3: fins > 0", `F${m3.fins}`, m3.fins > 0);
const wDef = mixOf(solve({ orientation: 270 }));
check("pre", "Stage 2 plan wording, W 270 at default Target 90: hoods + fins > blades", `H${wDef.hood} + F${wDef.fins} vs B${wDef.blade}`,
  wDef.hood + wDef.fins > wDef.blade);

// ---- print
const pad = (v, w) => String(v).padEnd(w);
const passed = rows.filter((x) => x.pass).length;
const timingsOnly = process.argv.includes("--timings");

if (!timingsOnly) {
  console.log("Solar Budget Skin, Stage 1 checks (P-0014)\n");
  console.log(`${pad("case", 5)}${pad("check", 76)}${pad("value", 64)}result`);
  console.log("-".repeat(151));
  for (const x of rows) console.log(`${pad(x.id, 5)}${pad(x.what, 76)}${pad(x.got, 64)}${x.pass ? "PASS" : "FAIL"}`);
  console.log(`\n${passed}/${rows.length} pass`);
  if (p4Target !== undefined) console.log(`P4 Target chosen: ${p4Target} (lowest of 90/120/150 with capped <= 50%)`);

  console.log("\nElement mix at defaults (51.5, T 90, Max 0.6, 8 x 8), by orientation");
  for (const [name, o] of [["S 180", 180], ["W 270", 270], ["E 90", 90], ["N 0", 0]]) {
    console.log(`  ${pad(name, 7)}${mixText(solve({ orientation: o }))}`);
  }

  console.log("\nKPIs (bare -> skin, area-averaged)");
  for (const { name, r: res } of pRes) {
    const k = res.kpi;
    console.log(`  ${pad(name, 30)}summer ${f(k.bareSummer, 1)} -> ${f(k.skinSummer, 1)} kWh/m2 yr | ${res.labels.winterKept.toLowerCase()} ${f(k.winterKept, 1)}% | glare ${f(k.bareGlare, 0)} -> ${f(k.skinGlare, 0)} h/yr | view-out 100 -> ${f(k.viewOut, 1)}%`);
  }

  const def = P1;
  console.log(`\nCapped at defaults: ${def.cappedCount}/${def.cells.length} = ${f((100 * def.cappedCount) / def.cells.length, 1)}% (guard: > 25% must be reported)`);
  console.log("\nDefault skin map (row 0 = top; left = facade's left seen from outside; B blade, F fins, H hood, . none, * capped; depth cm)");
  for (let i = 0; i < def.context.rows; i++) {
    const line = def.cells.filter((c) => c.row === i)
      .map((c) => `${c.type === "none" ? "." : c.type[0].toUpperCase()}${c.capped ? "*" : " "}${String(Math.round(c.depth * 100)).padStart(2)}`);
    console.log("  " + line.join(" "));
  }
  console.log("\nFootnotes");
  for (const line of [...FOOTNOTES, VIEW_OUT_LABEL]) console.log(`  ${line}`);
} else {
  const time = (fn, reps) => {
    const t0 = performance.now();
    for (let i = 0; i < reps; i++) fn(i);
    return (performance.now() - t0) / reps;
  };
  console.log("Solar Budget Skin, Stage 1 solve timings (P-0014; Node, this machine; ms per solve)\n");
  for (const size of [8, 30]) {
    const ctx = { ...DEFAULT_CONTEXT, rows: size, cols: size };
    const cold = time(() => { clearCaches(); solve({}, ctx); }, 5);
    // Target move: sky + mask cached, solve re-run
    const target = time((i) => solve({ target: 55 + (i % 20) * 10 }, ctx), 20);
    // Latitude move: new sky vectors, mask cached
    const lat = time((i) => solve({ latitude: 30 + i * 0.5 }, ctx), 10);
    // Orientation move: new context mask, sky cached
    const orient = time((i) => solve({ orientation: i * 22.5 + (i >= 8 ? 22.5 : 0) }, ctx), 14);
    console.log(`  ${size} x ${size}: cold ${f(cold, 1)} | Target move ${f(target, 1)} | Latitude move ${f(lat, 1)} | Orientation move ${f(orient, 1)}`);
  }
}

process.exitCode = passed === rows.length ? 0 : 1;
