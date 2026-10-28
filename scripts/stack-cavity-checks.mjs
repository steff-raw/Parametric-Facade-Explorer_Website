// Stack-Effect Cavity, Stage 1 checks (P-0019).
// Run: node --experimental-strip-types --no-warnings scripts/stack-cavity-checks.mjs
const E = await import("../src/lib/patterns/stack-cavity/engine.ts");
const { solve, DEFAULT_PARAMS: D, F_BLIND, FORMULA_SOURCE } = E;

const rows = [];
const near = (v, want, tol) => Math.abs(v - want) <= tol;
const check = (id, what, got, pass) => rows.push({ id, what, got, pass });
const f = (v, n = 2) => Number(v).toFixed(n);

// (a) default = reference.jpg
const a = solve(D);
check("a", "default (blind on): Q 2.54 +-0.01, dT 3.55 +-0.05, ACH 211 +-1, v 0.70 +-0.01",
  `Q ${f(a.Q)} dT ${f(a.dT)} ACH ${f(a.ach, 1)} v ${f(a.vCavity)}`,
  near(a.Q, 2.54, 0.01) && near(a.dT, 3.55, 0.05) && near(a.ach, 211, 1) && near(a.vCavity, 0.7, 0.01));

// (b) opening sweep
const s = [100, 50, 25].map((o) => solve({ ...D, opening: o }));
check("b", "sweep 100/50/25%: ACH 211/133/84, dT 3.6/5.6/8.9",
  s.map((r) => `${f(r.ach, 0)}/${f(r.dT, 1)}`).join("  "),
  near(s[0].ach, 211, 1) && near(s[1].ach, 133, 1) && near(s[2].ach, 84, 1) &&
    near(s[0].dT, 3.6, 0.1) && near(s[1].dT, 5.6, 0.05) && near(s[2].dT, 8.9, 0.05));

// (c) A^(2/3)
const c = s[1].Q / s[0].Q;
check("c", "A x0.5 gives Q = 0.63 x Q0 (A^(2/3))", f(c, 3), near(c, 0.63, 0.005));

// (d) height scaling, both ways
const dFixedP = solve({ ...D, H: 24, gain: D.gain / 2 }); // same total P (W x H constant)
const dFixedG = solve({ ...D, H: 24 });
check("d1", "H x2, fixed total P: Q x1.26 (3.20)", `Q ${f(dFixedP.Q)} x${f(dFixedP.Q / a.Q)}`,
  near(dFixedP.Q / a.Q, 1.26, 0.01) && near(dFixedP.Q, 3.2, 0.01) && near(dFixedP.P, a.P, 1e-9));
check("d2", "H x2, fixed W/m2: Q x1.59 (4.03), dT 4.47, ACH 168, P 21.6 kW",
  `Q ${f(dFixedG.Q)} x${f(dFixedG.Q / a.Q)} dT ${f(dFixedG.dT)} ACH ${f(dFixedG.ach, 0)} P ${f(dFixedG.P / 1000, 1)}`,
  near(dFixedG.Q / a.Q, 1.59, 0.01) && near(dFixedG.Q, 4.03, 0.01) && near(dFixedG.dT, 4.47, 0.01) &&
    near(dFixedG.ach, 168, 1) && near(dFixedG.P, 21600, 1));

// (e) degenerate inputs
const e = [solve({ ...D, gain: 0 }), solve({ ...D, opening: 0 })];
const finite = (r) => [r.Q, r.dT, r.ach, r.vCavity, r.vVent, r.P, r.A].every(Number.isFinite);
check("e", "P=0 and A=0: finite values, flagged, no NaN",
  e.map((r) => `${r.flag}`).join(" / "),
  e.every(finite) && e[0].flag === "no-gain" && e[1].flag === "no-opening" && a.flag === null);

// (f) formula cross-check: Q = Cd A sqrt(gH dT/T) with dT = P/(1200 Q) solves to the closed form
const fQ = a.Q, fT = D.tOut + 273.15;
const direct = D.cd * a.A * Math.sqrt((E.G * D.H * a.dT) / fT);
check("f", "closed form satisfies Q = Cd A sqrt(gH dT/T) (AM10/ASHRAE) to 1e-9; source cited",
  `Q ${f(fQ, 6)} vs ${f(direct, 6)}`, near(fQ, direct, 1e-9) && /AM10|ASHRAE/.test(FORMULA_SOURCE));

// (g) blind off
const g = solve({ ...D, blind: false });
const gr = g.Q / a.Q;
check("g", `blind off: Q x (1/${F_BLIND})^(1/3) = 0.737 +-0.01`, `x${f(gr, 3)} P ${f(g.P)}`,
  near(gr, 0.737, 0.01) && near(g.P, a.P / F_BLIND, 1e-9));

// (h) Stage 2 view helpers: sweep rows, halving verdict, particle speed ratio
const sw = E.sweep(D);
check("h1", "sweep(D): openings 100/50/25 and ACH 211/133/84",
  sw.map((r) => `${r.opening}:${f(r.res.ach, 0)}`).join(" "),
  sw.map((r) => r.opening).join() === "100,50,25" && near(sw[1].res.ach, 133, 1) && near(sw[2].res.ach, 84, 1));
const loss = E.halvingLoss(D);
check("h2", "halving vents loses 37% (ACH 133.1/211.3)", `${f(loss, 1)}%`, near(loss, 37, 0.5));
check("h3", "halvingLoss at no-gain is finite 0", `${E.halvingLoss({ ...D, gain: 0 })}`, E.halvingLoss({ ...D, gain: 0 }) === 0);
const vr = s[2].vCavity / a.vCavity;
check("h4", "particle speed at 25% vents = 0.40 x default (0.397)", f(vr, 3), near(vr, 0.4, 0.005));

console.log("\nStack-Effect Cavity, Stage 1 checks\n");
console.log(`default: Q ${f(a.Q)} m3/s | dT +${f(a.dT)} K | ${f(a.ach, 0)} ACH | v ${f(a.vCavity)} m/s | vent ${f(a.vVent)} m/s | P ${f(a.P / 1000, 1)} kW | A ${f(a.A, 1)} m2\n`);
console.log("id  result  check -> got");
for (const r of rows) console.log(`${r.id.padEnd(3)} ${r.pass ? "PASS  " : "FAIL  "} ${r.what} -> ${r.got}`);
const bad = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - bad}/${rows.length} PASS`);
process.exit(bad ? 1 : 0);
