// Run: npm run test:studio  (Node 22+, type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SPEC,
  generateStudio,
  panelGrid,
  toolSet,
  scheduleCsv,
  elevationDxf,
} from "../src/lib/studio/engine.ts";

const spec = (over = {}) => ({ ...DEFAULT_SPEC, ...over });

test("panels fill the elevation exactly with joints", () => {
  for (const s of [spec(), spec({ facadeW: 7350, panelW: 1200, joint: 15 }), spec({ facadeH: 3100, panelH: 3000 })]) {
    const g = panelGrid(s);
    assert.ok(Math.abs(g.cols * g.w + (g.cols - 1) * s.joint - s.facadeW) < 1e-6);
    assert.ok(Math.abs(g.rows * g.h + (g.rows - 1) * s.joint - s.facadeH) < 1e-6);
  }
});

test("every hole obeys the fabrication rules", () => {
  for (const s of [spec(), spec({ layout: "square", tools: 0 }), spec({ driver: "radial" }), spec({ driver: "noise", holeMax: 80 })]) {
    const r = generateStudio(s);
    assert.ok(r.holeCount > 0);
    const global = [];
    for (const p of r.panels) {
      for (const h of p.holes) {
        assert.ok(h.d >= s.thickness, "hole smaller than sheet thickness");
        assert.ok(h.d <= s.pitch - s.thickness + 0.05, "web thinner than sheet");
        assert.ok(h.x - h.d / 2 >= s.edgeMargin - 0.05 && h.x + h.d / 2 <= p.w - s.edgeMargin + 0.05, "edge margin x");
        assert.ok(h.y - h.d / 2 >= s.edgeMargin - 0.05 && h.y + h.d / 2 <= p.h - s.edgeMargin + 0.05, "edge margin y");
        global.push([p.x + h.x, p.y + h.y, h.d]);
      }
    }
    // Neighbour web check through a spatial hash.
    const cell = s.pitch;
    const buckets = new Map();
    for (const g of global) {
      const k = `${Math.floor(g[0] / cell)},${Math.floor(g[1] / cell)}`;
      (buckets.get(k) ?? buckets.set(k, []).get(k)).push(g);
    }
    for (const [x, y, d] of global) {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        for (const [x2, y2, d2] of buckets.get(`${cx + i},${cy + j}`) ?? []) {
          if (x2 === x && y2 === y) continue;
          const web = Math.hypot(x2 - x, y2 - y) - (d + d2) / 2;
          assert.ok(web >= s.thickness - 0.15, `web ${web.toFixed(2)} mm below ${s.thickness} mm`);
        }
      }
    }
  }
});

test("punch tools limit the hole sizes", () => {
  const s = spec({ tools: 4 });
  const r = generateStudio(s);
  const allowed = toolSet(s);
  assert.equal(allowed.length, 4);
  assert.ok(r.toolSizes.length <= 4);
  for (const d of r.toolSizes) assert.ok(allowed.includes(d));
});

test("linear 90° gradient opens up towards the top", () => {
  const r = generateStudio(spec({ driver: "linear", angle: 90 }));
  const bottom = r.panels.filter((p) => p.row === 1);
  const top = r.panels.filter((p) => p.row === r.rows);
  const avg = (ps) => ps.reduce((a, p) => a + p.openArea, 0) / ps.length;
  assert.ok(avg(top) > avg(bottom) * 1.5);
  const inv = generateStudio(spec({ driver: "linear", angle: 90, invert: true }));
  assert.ok(avg(inv.panels.filter((p) => p.row === 1)) > avg(inv.panels.filter((p) => p.row === inv.rows)));
});

test("open area matches the hole geometry", () => {
  const s = spec({ facadeW: 1000, facadeH: 1000, panelW: 1000, panelH: 1000, driver: "linear", holeMin: 20, holeMax: 20, tools: 0, edgeMargin: 0, layout: "square", pitch: 50 });
  const r = generateStudio(s);
  assert.equal(r.panels.length, 1);
  assert.equal(r.holeCount, 400);
  const expected = (400 * Math.PI * 100) / 1e6;
  assert.ok(Math.abs(r.openArea - expected) < 1e-9);
});

test("too fine a pitch is refused, not frozen", () => {
  const r = generateStudio(spec({ facadeW: 60000, facadeH: 30000, pitch: 10 }));
  assert.equal(r.holeCount, 0);
  assert.ok(r.warnings.some((w) => w.includes("Pitch too fine")));
});

test("same spec gives the same result", () => {
  const a = generateStudio(spec({ driver: "noise", seed: 42 }));
  const b = generateStudio(spec({ driver: "noise", seed: 42 }));
  assert.equal(scheduleCsv(a), scheduleCsv(b));
});

test("exports carry every panel and hole", () => {
  const r = generateStudio(spec());
  const csv = scheduleCsv(r).trim().split("\n");
  assert.equal(csv.length, r.panels.length + 1);
  const dxf = elevationDxf(r);
  assert.ok(dxf.startsWith("0\nSECTION"));
  assert.ok(dxf.trimEnd().endsWith("0\nEOF"));
  assert.equal((dxf.match(/\nCIRCLE\n/g) ?? []).length, r.holeCount);
  assert.equal((dxf.match(/\nLINE\n/g) ?? []).length, r.panels.length * 4);
});
