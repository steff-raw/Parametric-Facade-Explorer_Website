// Pattern Performance Badge checks (P-0038): Stage 1 ray test through the real 3D instances, Stage 2 thumbnail (pure parts).
// Run: node --experimental-strip-types --no-warnings scripts/pattern-badge-checks.mjs
import { register } from "node:module";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Loader as in adaptive-panel-checks.mjs: modules import without a file extension (Next/tsc style), so let
// Node add ".ts" or "/index.ts". The 3D modules also import interfaces without `import type`, which Node's
// type stripping keeps; so .ts files are transpiled with the repo's own typescript (type-only imports elided).
register(
  "data:text/javascript," +
    encodeURIComponent(
      [
        "let ts; export async function initialize(d) { ts = (await import(d.ts)).default; }",
        "export async function resolve(s, c, next) { try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.[a-z]+$/.test(s)) { try { return await next(s + '.ts', c); } catch { return next(s + '/index.ts', c); } } throw e; } }",
        "export async function load(u, c, next) { if (!u.endsWith('.ts')) return next(u, c); const r = await next(u, { ...c, format: 'module' });",
        "  const out = ts.transpileModule(String(r.source), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });",
        "  return { format: 'module', source: out.outputText, shortCircuit: true }; }",
      ].join("\n"),
    ),
  { parentURL: import.meta.url, data: { ts: import.meta.resolve("typescript") } },
);

const THREE = await import("three");
const E = await import("../src/lib/patterns-3d/solar-budget-skin/engine.ts");
const M = await import("../src/lib/pattern-badge/matrix.ts");
const R = await import("../src/lib/pattern-badge/raycast.ts");
const A = await import("../src/lib/pattern-badge/adapters.ts");
const { patterns } = await import("../src/lib/patterns/index.ts");
const louvre = await import("../src/lib/patterns-3d/louvre-cascade/index.ts");
const skin = await import("../src/lib/patterns-3d/solar-budget-skin/index.ts");

const rows = [];
const near = (v, want, tol) => Math.abs(v - want) <= tol;
const check = (id, what, got, pass) => rows.push({ id, what, got, pass });
const f = (v, n = 1) => Number(v).toFixed(n);
const SLUGS = patterns.map((p) => p.meta.slug);
const SCORED = SLUGS.filter((s) => A.getBoxes(s) !== null);
const FLAT = SLUGS.filter((s) => !SCORED.includes(s));

// Plan prototype (Critical Evaluator, 2026-11-04), central 60% window, cell-centre origins.
const PROTO = {
  "louvre-cascade": [77.4, 67.7],
  "radial-pulse-panels": [73.2, 19.9],
  "hinged-flap-grid": [45.1, 29.6],
  "rotated-brick-screen": [98.3, 11.5],
  "adaptive-panel": [34.5, 87.6],
  "solar-budget-skin": [60.2, 80.2],
};

// ---------------------------------------------------------------- table (timed, cold memo)
const table = SLUGS.map((slug) => {
  const t0 = performance.now();
  const b = A.getBadge(slug);
  const ms = performance.now() - t0;
  if (!b) return { slug, b: null };
  const boxes = A.getBoxes(slug);
  const full = R.scoreBoxes(boxes, { share: 1 });
  return { slug, b, ms, full, boxes: boxes.length };
});

// (1) engine untouched
let diff = "git error";
try {
  diff = execSync("git diff origin/main -- src/lib/patterns-3d/solar-budget-skin/engine.ts", { encoding: "utf8" });
} catch {}
check("1", "git diff origin/main on solar-budget-skin/engine.ts is empty", diff === "" ? "empty" : "NOT empty", diff === "");

// (2) deterministic: a second, uncached run gives the same numbers
const again = SCORED.every((s) => {
  const x = R.scoreBoxes(A.getBoxes(s));
  const b = A.getBadge(s);
  return x.blocks === b.blocks && x.winterKept === b.winterKept;
});
check("2", "deterministic: an uncached re-score equals the memoised badge, bit for bit", again ? "identical" : "differs", again);

// (3) engine cross-checks on synthetic boxes, every front-facing DOME patch
const sky = R.frontSky();
const CELL = E.CELL;
const big = 1000;
const box = (pos, size) => ({ matrix: M.composeMatrix(pos, [0, 0, 0]), size });
const line = (n, axis) =>
  Array.from({ length: n }, (_, i) => {
    const v = ((i + 0.5) / n) * CELL;
    return axis === "y" ? [CELL / 2, v, 0] : [v, CELL / 2, 0];
  });
const thin = 1e-4;
function perPatchCheck(type, d, boxes, origins) {
  const T = R.transmittedPerPatch(boxes, origins, sky.dirs);
  let worst = 0;
  sky.dirs.forEach((v, i) => {
    const want = E.unshaded(type, d, v[1] / v[2], v[0] / v[2]);
    worst = Math.max(worst, Math.abs(T[i] - want));
  });
  return worst;
}
const D = 0.3;
// head blade: very wide (no side escape, as the engine's 2D profile), front edge at depth d, bottom at the cell top
const blade = [box([0, CELL + thin / 2, D / 2], [big, thin, D])];
const wBlade = perPatchCheck("blade", D, blade, line(400, "y"));
check("3", `head blade d ${D} vs unshaded("blade"), ${sky.dirs.length} front patches, worst |diff| <= 0.02`, `worst ${f(wBlade, 4)}`, wBlade <= 0.02);
// fins: the engine's "fins" type = one fin on each cell edge (|tanH|); tall, no top/bottom escape
const fins = [box([-thin / 2, 0, D / 2], [thin, big, D]), box([CELL + thin / 2, 0, D / 2], [thin, big, D])];
const wFin = perPatchCheck("fins", D, fins, line(400, "x"));
check("3", `vertical fin (one per edge) d ${D} vs unshaded("fins"), every front patch, <= 0.02`, `worst ${f(wFin, 4)}`, wFin <= 0.02);
// hand-check: tanV = 1 on one patch (geometry check, not a standard example)
const r45 = R.transmittedPerPatch(blade, line(400, "y"), [[0, Math.SQRT1_2, Math.SQRT1_2]])[0];
check("3", "geometry check (not a standard example): d 0.3, cell 1.5, tanV 1 -> 0.80 +-0.02", `ray ${f(r45, 3)} engine ${f(E.unshaded("blade", 0.3, 1, 0), 3)}`, near(r45, 0.8, 0.02));

// (4) limits
const win = { x0: 0, x1: 3, y0: 0, y1: 3, z: 0 };
const empty = R.scoreBoxes([], { window: win });
const bare = E.solve({}, { blockHeight: 0 }).kpi.bareSummer;
check("4", "empty scene: blocks 0, winter kept 100, bare summer = solve(block 0) 258.255", `${f(empty.blocks)} / ${f(empty.winterKept)} / ${f(empty.bareSummer, 3)} (engine ${f(bare, 3)})`,
  near(empty.blocks, 0, 1e-9) && near(empty.winterKept, 100, 1e-9) && near(empty.bareSummer, bare, 1e-6) && near(bare, 258.255, 0.001));
const plane = R.scoreBoxes([box([1.5, 1.5, 0], [big, big, 0.01])], { window: win });
check("4", "full opaque plane: blocks 100, winter kept 0", `${f(plane.blocks)} / ${f(plane.winterKept)}`, near(plane.blocks, 100, 1e-9) && near(plane.winterKept, 0, 1e-9));
const inRange = table.filter((t) => t.b).every((t) => [t.b.blocks, t.b.winterKept, t.full.blocks, t.full.winterKept].every((v) => v >= 0 && v <= 100));
check("4", "all scored values in 0..100", inRange ? "yes" : "no", inRange);
const flatTypes = FLAT.map((s) => patterns.find((p) => p.meta.slug === s).meta.type);
check("4", "the 5 flat (static-2d) slugs return null; the 6 3D slugs score", `${FLAT.length} null (${[...new Set(flatTypes)].join(",")}), ${SCORED.length} scored`,
  FLAT.length === 5 && flatTypes.every((t) => t === "static-2d") && SCORED.length === 6);

// (5) worked example (hand-check, illustrative, not from the standard)
const w = R.badgeFromGains(120, 78);
check("5", "worked example: bare 120, with blade 78, g 0.6 -> F_c 0.65, g_tot 0.39, Blocks 35", `F_c ${f(w.fc, 3)} g_tot ${f(w.gtot, 3)} Blocks ${f(w.blocks, 1)}`,
  near(w.fc, 0.65, 1e-9) && near(w.gtot, 0.39, 1e-9) && near(w.blocks, 35, 1e-9));

// (6) matrix.ts vs THREE.Object3D.updateMatrix, louvre limits and sign
let seed = 38;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const span = (a, b) => a + (b - a) * rnd();
const dummy = new THREE.Object3D();
let worstM = 0;
for (let k = 0; k < 100; k++) {
  const pos = [span(-10, 10), span(-10, 10), span(-10, 10)];
  const rot = [span(-Math.PI, Math.PI), span(-Math.PI, Math.PI), span(-Math.PI, Math.PI)];
  const scale = k % 4 === 0 ? undefined : [span(0.05, 3), span(0.05, 3), span(0.05, 3)];
  dummy.position.set(...pos);
  dummy.rotation.set(...rot);
  if (scale) dummy.scale.set(...scale);
  else dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  const m = M.composeMatrix(pos, rot, scale);
  for (let i = 0; i < 16; i++) worstM = Math.max(worstM, Math.abs(m[i] - dummy.matrix.elements[i]));
}
check("6", "matrix.ts = THREE.Object3D.updateMatrix, 100 random transforms, within 1e-9", `worst ${worstM.toExponential(1)}`, worstM <= 1e-9);

const L = louvre.kineticModule;
const flat = { ...L.defaults, spacing: 0.02 };
const flatK = { ...L.kineticDefaults, amplitude: 0 };
const flatBoxes = A.boxesFromTransforms(L.getElementCount(flat), L.getInstanceSize(flat), (i) => L.getElementTransform(i, flat, flatK, 0));
const flatScore = R.scoreBoxes(flatBoxes, { n: 20 });
const closed = { ...L.kineticDefaults, amplitude: 90, frequency: 0, phase: 90 };
const closedBoxes = A.boxesFromTransforms(L.getElementCount(flat), L.getInstanceSize(flat), (i) => L.getElementTransform(i, flat, closed, 0));
const closedScore = R.scoreBoxes(closedBoxes, { n: 20 });
check("6", "louvre all tilts 0, spacing 0.02: blocks near 100 (>= 90)", `blocks ${f(flatScore.blocks)}, winter kept ${f(flatScore.winterKept)} (all 90 deg: ${f(closedScore.blocks)})`, flatScore.blocks >= 90);
// tilt sign: outer chord edge (local +z) moves down for positive rotX, in matrix.ts and in THREE alike
let signOk = 0, tilted = 0;
const n = L.getElementCount(L.defaults);
const half = L.getInstanceSize(L.defaults)[2] / 2;
for (let i = 0; i < n; i++) {
  const t = L.getElementTransform(i, L.defaults, L.kineticDefaults, 0);
  if (Math.abs(t.rotation[0]) < 1e-6) continue;
  tilted++;
  const m = M.composeMatrix(t.position, t.rotation, t.scale);
  const yOurs = m[9] * half; // local (0,0,half) -> world y offset
  dummy.position.set(...t.position);
  dummy.rotation.set(...t.rotation);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  const yThree = new THREE.Vector3(0, 0, half).applyMatrix4(dummy.matrix).y - t.position[1];
  if (Math.sign(yOurs) === Math.sign(yThree) && Math.sign(yOurs) === -Math.sign(t.rotation[0])) signOk++;
}
check("6", "louvre tilt sign: outer edge y from matrix.ts = THREE picture, down for +rotX", `${signOk}/${tilted} tilted blades agree`, signOk === tilted && tilted > 0);

// (7) mesh vs engine on the SAME drawn depths (default solve, block ignored)
const cells = skin.getSolve(skin.defaults).cells;
const eng = (season) => {
  let a = 0, all = 0;
  for (const c of cells) {
    sky.dirs.forEach((v, i) => {
      const wgt = sky[season][i];
      a += wgt * E.unshaded(c.type, c.depth, v[1] / v[2], v[0] / v[2]);
      all += wgt;
    });
  }
  return a / all;
};
const engBlocks = 100 * (1 - eng("cooling")), engWinter = 100 * eng("heating");
const sb = A.getBadge("solar-budget-skin");
const dS = sb.blocks - engBlocks, dW = sb.winterKept - engWinter;
check("7", "solar-budget-skin ray vs engine unshaded on default-solve depths (block ignored), <= 8 points",
  `ray ${f(sb.blocks)}/${f(sb.winterKept)} engine ${f(engBlocks)}/${f(engWinter)} diff ${f(dS)}/${f(dW)}`, Math.abs(dS) <= 8 && Math.abs(dW) <= 8);

// (8) central 60% window used for all six; full window printed in the table
const central = SCORED.every((s) => {
  const x = R.scoreBoxes(A.getBoxes(s), { n: 20, share: 0.6 });
  return R.CENTRAL_SHARE === 0.6 && R.DEFAULT_N === 20 && x.blocks === A.getBadge(s).blocks;
});
check("8", "badge = n 20 x 20 over the central 60% window for all six (full window printed as diagnostic)", central ? "all six" : "mismatch", central);

// (9) time budget
const slow = table.filter((t) => t.b && t.ms > 150);
check("9", "each pattern scores in 150 ms or less (cold)", `max ${f(Math.max(...table.filter((t) => t.b).map((t) => t.ms)), 0)} ms`, slow.length === 0);

// (10) standard named, clause not claimed
const src = ["raycast.ts", "adapters.ts", "matrix.ts"].map((x) => readFileSync(new URL(`../src/lib/pattern-badge/${x}`, import.meta.url), "utf8"));
const header = src[0].slice(0, src[0].indexOf("*/"));
const noClause = src.every((s) => !/(clause|§|section)\s*\d/i.test(s));
check("10", "raycast.ts header names EN ISO 52022-1:2017 and 'clause not verified (standard paywalled)'; no clause number",
  noClause ? "named, no clause number" : "clause number found",
  header.includes("EN ISO 52022-1:2017") && header.includes("clause not verified (standard paywalled)") && noClause);

// (11) real module defaults (drift guard)
const counts = { "louvre-cascade": 160, "radial-pulse-panels": 81, "hinged-flap-grid": 320, "rotated-brick-screen": 253, "adaptive-panel": 5, "solar-budget-skin": 88 };
const got = SCORED.map((s) => `${table.find((t) => t.slug === s).boxes}`).join("/");
const sameT = (() => {
  const t = L.getElementTransform(37, L.defaults, L.kineticDefaults, 0);
  const m = M.composeMatrix(t.position, t.rotation, t.scale);
  return A.getBoxes("louvre-cascade")[37].matrix.every((v, i) => v === m[i]);
})();
const geoSrc = readFileSync(new URL("../src/lib/pattern-badge/geometry.ts", import.meta.url), "utf8");
const frameGuard = geoSrc.includes(`export const FRAME_CLEARANCE = ${A.FRAME_CLEARANCE};`) && geoSrc.includes("Math.max(t * 0.85, 0.02)");
check("11", "boxes from the modules' own defaults (box counts as prototype, transform 37 = module), frame constants = canvas",
  `boxes ${got}${sameT ? ", louvre 37 same" : ""}${frameGuard ? ", frame ok" : ", frame DRIFT"}`,
  SCORED.every((s) => table.find((t) => t.slug === s).boxes === counts[s]) && sameT && frameGuard);

// AC2: prototype. The prototype used cell-centre origins, which alias (Evaluator Stage 1 checkpoint:
// blocks over N = 10,16,20,24,30,40 spanned the ranges below). With stratified origins the badge must
// land inside that range; the winter difference is printed.
const PROTO_RANGE = {
  "louvre-cascade": [75.5, 79.3],
  "radial-pulse-panels": [70.8, 76.9],
  "hinged-flap-grid": [44.9, 47.7],
  "rotated-brick-screen": [98.2, 98.5],
  "adaptive-panel": [33.1, 41.2],
  "solar-budget-skin": [58.8, 69.4],
};
for (const s of SCORED) {
  const b = A.getBadge(s), p = PROTO[s], [lo, hi] = PROTO_RANGE[s];
  // Stage 2 checkpoint: range alone is too loose, so both numbers must also be within 3 points of the N 20 lattice value.
  const dB = b.blocks - p[0], dW = b.winterKept - p[1];
  check("P", `${s}: blocks in prototype N 10..40 range ${lo}-${hi}, and blocks, winter <= 3 points of N 20 (${p[0]} / ${p[1]})`,
    `${f(b.blocks)} / ${f(b.winterKept)} (diff ${f(dB)} / ${f(dW)})`, b.blocks >= lo && b.blocks <= hi && Math.abs(dB) <= 3 && Math.abs(dW) <= 3);
}

// (S) sample-count sensitivity: every N = 10..40 at the central 60% window; window share at N 20 (diagnostic)
const NS = Array.from({ length: 31 }, (_, i) => 10 + i);
const SHARES = [0.4, 0.5, 0.6, 0.7, 0.8];
const sens = SCORED.map((s) => {
  const boxes = A.getBoxes(s);
  const byN = NS.map((n) => R.scoreBoxes(boxes, { n }));
  const byShare = SHARES.map((share) => R.scoreBoxes(boxes, { share }).blocks);
  const spread = (vals) => Math.max(...vals) - Math.min(...vals);
  return { s, byN, byShare, sB: spread(byN.map((x) => x.blocks)), sW: spread(byN.map((x) => x.winterKept)) };
});
for (const x of sens) {
  check("S", `${x.s}: spread over N = 10..40 <= 5 points (blocks / winter kept)`, `${f(x.sB)} / ${f(x.sW)}`, x.sB <= 5 && x.sW <= 5);
}

// ---------------------------------------------------------------- Stage 2: thumbnail (pure parts; WebGL render checked in a browser)
const T = await import("../src/lib/pattern-badge/thumb3d.ts");
const G = await import("../src/lib/pattern-badge/geometry.ts");
// (T2) backplate tint: decode the texture bytes back to transmitted share; 100 (1 - mean) = Blocks within 1 point
for (const s of SCORED) {
  const b = A.getBadge(s);
  const px = T.backplatePixels(b.map);
  const t = [];
  for (let i = 0; i < px.length; i += 4) t.push(T.shareFromTint(px[i], px[i + 1], px[i + 2]));
  const tintBlocks = 100 * (1 - t.reduce((x, y) => x + y, 0) / t.length);
  check("T2", `${s}: backplate tint decoded, 100 x (1 - mean of map) = Blocks within 1 point`, `${f(tintBlocks)} vs ${f(b.blocks)}`, Math.abs(tintBlocks - b.blocks) <= 1);
}
// (T4) no WebGL (here: no document at all) -> null, so callers keep the SVG preview
const none = await T.renderThumb3D("louvre-cascade");
const flatThumb = await T.renderThumb3D("perforated-screen");
check("T4", "no WebGL -> renderThumb3D returns null; flat slug -> null", `${none} / ${flatThumb}`, none === null && flatThumb === null);
// (T1) frame geometry = scorer's frame bars: ring outer/inner and depth from the shared builder
const H = (await import("../src/lib/patterns-3d/hinged-flap-grid/index.ts")).static3dModule;
const hs = H.getInstanceSize(H.defaults);
const ring = G.buildDoorFrameGeometry(hs, H.defaults.frameWidth);
ring.computeBoundingBox();
const rb = ring.boundingBox;
// geometry buffers are Float32: compare at 1e-6
const ringOk = near(rb.max.x - rb.min.x, hs[0] + 2 * H.defaults.frameWidth, 1e-6) && near(rb.max.z - rb.min.z, Math.max(hs[2] * 0.85, 0.02), 1e-6) && G.FRAME_CLEARANCE === A.FRAME_CLEARANCE;
check("T1", "shared door-frame builder: outer width, depth and clearance = the scorer's frame bars", `w ${f(rb.max.x - rb.min.x, 3)} d ${f(rb.max.z - rb.min.z, 3)}`, ringOk);

// ---------------------------------------------------------------- Stage 3: card label and thumbnail framing
const LB = await import("../src/lib/pattern-badge/label.ts");
// (R) badge numbers read as approximate: nearest 5 with a leading "~"
const cases = [[76.5, "~75%"], [67.5, "~70%"], [98.4, "~100%"], [11.2, "~10%"], [2.4, "~0%"], [36.7, "~35%"]];
const bad = cases.filter(([v, want]) => LB.approx(v) !== want);
check("R", "badge rounding: nearest 5 with '~' (76.5 -> ~75%, 67.5 -> ~70%, 98.4 -> ~100%)", bad.length ? `wrong: ${bad.map(([v]) => `${v} -> ${LB.approx(v)}`).join(", ")}` : cases.map(([v, w]) => `${v}->${w}`).join(" "), bad.length === 0);
check("R", "n/a reason for every flat slug; tooltip names south, 51.5 N, May-Aug, default pose, neighbour block ignored",
  FLAT.map((s) => LB.naReason(s)).join(" | ").slice(0, 60),
  FLAT.every((s) => LB.naReason(s).length > 10) && /south.*51\.5 N.*May-Aug.*default pose.*neighbour block ignored/i.test(LB.SUN_TOOLTIP));
// (C) fit-to-content framing at the card aspect (square): every drawn instance corner projected with the thumbnail
// camera; long side fills 70-85% of the frame, content centred within 5%, nothing outside. Instances = getElementCount.
const corners = (mesh) => {
  mesh.geometry.computeBoundingBox();
  const g = mesh.geometry.boundingBox, m = new THREE.Matrix4(), v = new THREE.Vector3(), pts = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    for (let k = 0; k < 8; k++) pts.push(v.set(k & 1 ? g.max.x : g.min.x, k & 2 ? g.max.y : g.min.y, k & 4 ? g.max.z : g.min.z).clone().applyMatrix4(m));
  }
  return pts;
};
for (const s of SCORED) {
  const { scene, camera, mesh, count } = T.buildThumbScene(s);
  camera.updateMatrixWorld();
  const meshes = [];
  scene.traverse((o) => { if (o.isInstancedMesh) meshes.push(o); });
  const ndc = meshes.flatMap(corners).map((p) => p.project(camera));
  const xs = ndc.map((p) => p.x), ys = ndc.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const fill = Math.max(x1 - x0, y1 - y0) / 2, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  check("C", `${s}: framing at aspect ${camera.aspect}: long side 70-85%, centred within 5%, instances = getElementCount`,
    `fill ${f(100 * fill, 0)}% centre ${f(cx, 2)},${f(cy, 2)} instances ${mesh.count}/${count}`,
    camera.aspect === 1 && fill >= 0.7 && fill <= 0.85 && Math.abs(cx) <= 0.05 && Math.abs(cy) <= 0.05 && mesh.count === count);
}

// ---------------------------------------------------------------- print
const pad = (s, n) => String(s).padEnd(n);
const passed = rows.filter((r) => r.pass).length;
console.log("Pattern Performance Badge, Stage 1 + 2 + 3 checks (P-0038)");
console.log("South, 51.5 N, clear sky, summer May-Aug, default pose (kinetic t = 0), neighbour block ignored\n");
console.log(`${pad("slug", 24)}${pad("boxes", 7)}${pad("blocks %", 10)}${pad("winter kept %", 15)}${pad("g_tot", 7)}${pad("full blocks / winter", 22)}ms`);
console.log("-".repeat(90));
for (const t of table) {
  if (!t.b) console.log(`${pad(t.slug, 24)}${pad("-", 7)}${pad("n/a", 10)}${pad("n/a", 15)}${pad("-", 7)}${pad("-", 22)}-`);
  else console.log(`${pad(t.slug, 24)}${pad(t.boxes, 7)}${pad(f(t.b.blocks), 10)}${pad(f(t.b.winterKept), 15)}${pad(f(E.G_VALUE * (1 - t.b.blocks / 100), 2), 7)}${pad(`${f(t.full.blocks)} / ${f(t.full.winterKept)}`, 22)}${f(t.ms, 0)}`);
}
console.log(`\n(7) ray vs engine, solar-budget-skin: summer ${f(dS)} points, winter ${f(dW)} points. Drawn mesh has thickness (T 0.07, fins 0.12)`);
console.log("    and 0.1 insets at each element end; the engine assumes zero thickness and full cell width.\n");
const SHOW = [10, 16, 20, 24, 30, 40];
console.log("Sensitivity, blocks %: sample count N (central 60%), spread over every N 10..40; window share at N 20 (diagnostic)");
console.log(`${pad("slug", 24)}${SHOW.map((n) => pad(`N ${n}`, 7)).join("")}${pad("spread B/W", 13)}${SHARES.map((s) => pad(`w ${s}`, 7)).join("")}`);
console.log("-".repeat(24 + 7 * SHOW.length + 13 + 7 * SHARES.length));
for (const x of sens) {
  const atN = SHOW.map((n) => pad(f(x.byN[NS.indexOf(n)].blocks), 7)).join("");
  console.log(`${pad(x.s, 24)}${atN}${pad(`${f(x.sB)} / ${f(x.sW)}`, 13)}${x.byShare.map((v) => pad(f(v), 7)).join("")}`);
}
console.log("");
console.log(`${pad("case", 5)}${pad("check", 116)}${pad("value", 58)}result`);
console.log("-".repeat(185));
for (const x of rows) console.log(`${pad(x.id, 5)}${pad(x.what, 116)}${pad(x.got, 58)}${x.pass ? "PASS" : "FAIL"}`);
console.log(`\n${passed}/${rows.length} pass`);
process.exitCode = passed === rows.length ? 0 : 1;
