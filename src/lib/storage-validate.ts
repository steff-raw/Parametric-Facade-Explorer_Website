/**
 * Pure validation for saved variations read back from localStorage.
 * No imports with side effects so it can be unit-tested in plain Node.
 */

import type { PatternModule, PatternParamDef, PatternParams } from "./patterns/shared/types";

export interface SavedVariation {
  id: string;
  slug: string;
  name: string;
  params: PatternParams;
  savedAt: string;
}

export type PatternLookup = (slug: string) => PatternModule | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/** Valid value for a param def, or null. Enums must be a known index; numbers are clamped to range. */
function validValue(def: PatternParamDef, raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (def.options && def.options.length > 0) {
    const maxIdx = def.min + def.options.length - 1;
    if (!Number.isInteger(raw) || raw < def.min || raw > maxIdx) return null;
    return raw;
  }
  return Math.min(def.max, Math.max(def.min, raw));
}

/** Returns a clean SavedVariation, or null if the entry should be dropped. */
export function validateVariation(
  entry: unknown,
  lookup: PatternLookup
): SavedVariation | null {
  if (!isRecord(entry)) return null;
  const { id, slug, name, savedAt, params } = entry;
  if (!nonEmptyString(id) || !nonEmptyString(slug)) return null;
  if (typeof name !== "string" || typeof savedAt !== "string") return null;
  if (!isRecord(params)) return null;

  const pattern = lookup(slug);
  if (!pattern) return null;

  const defs = [
    ...pattern.meta.staticParams,
    ...(pattern.meta.kineticParams ?? []),
  ];
  const clean: PatternParams = {};
  for (const def of defs) {
    if (!(def.key in params)) {
      clean[def.key] = pattern.defaults[def.key] ?? def.default;
      continue;
    }
    const v = validValue(def, params[def.key]);
    if (v === null) return null;
    clean[def.key] = v;
  }
  // Keys the pattern does not define are dropped.
  return { id, slug, name, savedAt, params: clean };
}

/** Parses the stored JSON string and keeps only valid entries. */
export function parseCollected(
  raw: string | null,
  lookup: PatternLookup
): SavedVariation[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SavedVariation[] = [];
  for (const entry of parsed) {
    const v = validateVariation(entry, lookup);
    if (v) out.push(v);
  }
  return out;
}
