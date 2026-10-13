// Run: npm run test:storage  (Node 22+, type stripping)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCollected, validateVariation } from "../src/lib/storage-validate.ts";

const brick = {
  meta: {
    slug: "brick",
    staticParams: [
      { key: "cols", label: "Cols", min: 2, max: 40, step: 1, default: 12 },
      { key: "bond", label: "Bond", min: 0, max: 1, step: 1, default: 0, options: ["Stretcher", "Stack"] },
    ],
    kineticParams: [{ key: "speed", label: "Speed", min: 0, max: 2, step: 0.1, default: 1 }],
  },
  defaults: { cols: 12, bond: 0, speed: 1 },
};
const lookup = (slug) => (slug === "brick" ? brick : undefined);
const entry = (over = {}) => ({
  id: "brick-1", slug: "brick", name: "Brick", savedAt: "2026-01-01T00:00:00Z",
  params: { cols: 10, bond: 1, speed: 0.5 }, ...over,
});

test("valid entry passes unchanged", () => {
  assert.deepEqual(validateVariation(entry(), lookup), entry());
});

test("unknown slug is dropped", () => {
  assert.equal(validateVariation(entry({ slug: "gone" }), lookup), null);
});

test("non-finite or non-number param drops the entry", () => {
  for (const bad of [NaN, Infinity, "10", null, true, {}]) {
    assert.equal(validateVariation(entry({ params: { cols: bad, bond: 0, speed: 1 } }), lookup), null);
  }
});

test("enum must be a known option index", () => {
  assert.equal(validateVariation(entry({ params: { cols: 10, bond: 2, speed: 1 } }), lookup), null);
  assert.equal(validateVariation(entry({ params: { cols: 10, bond: 0.5, speed: 1 } }), lookup), null);
});

test("out-of-range numbers clamp, missing keys default, unknown keys stripped", () => {
  const v = validateVariation(entry({ params: { cols: 9999, evil: 1 } }), lookup);
  assert.deepEqual(v.params, { cols: 40, bond: 0, speed: 1 });
});

test("bad shapes are dropped", () => {
  for (const bad of [null, 1, "x", [], entry({ id: "" }), entry({ params: [] }), entry({ name: 3 })]) {
    assert.equal(validateVariation(bad, lookup), null);
  }
});

test("parseCollected keeps only valid entries and survives garbage", () => {
  assert.deepEqual(parseCollected(null, lookup), []);
  assert.deepEqual(parseCollected("{not json", lookup), []);
  assert.deepEqual(parseCollected('{"a":1}', lookup), []);
  const raw = JSON.stringify([entry(), entry({ slug: "gone" }), { junk: true }]);
  assert.equal(parseCollected(raw, lookup).length, 1);
});
