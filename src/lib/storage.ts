/**
 * localStorage persistence for saved pattern variations.
 * No auth / backend for v1.
 *
 * Entries are validated on load (see storage-validate.ts): unknown slugs,
 * non-finite numbers and out-of-range enum values are dropped.
 * Storage access is wrapped so private mode / quota errors never throw.
 */

import { PatternParams, getPattern } from "./patterns";
import { SavedVariation, parseCollected } from "./storage-validate";

export type { SavedVariation };

const STORAGE_KEY = "pfe-collected-v1";

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadCollected(): SavedVariation[] {
  const storage = getStorage();
  if (!storage) return [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  return parseCollected(raw, getPattern);
}

/** Returns false when the write failed (private mode, quota, blocked storage). */
export function saveCollected(items: SavedVariation[]): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function addVariation(
  slug: string,
  name: string,
  params: PatternParams
): SavedVariation {
  const item: SavedVariation = {
    id: `${slug}-${Date.now()}`,
    slug,
    name,
    params: { ...params },
    savedAt: new Date().toISOString(),
  };
  const all = loadCollected();
  all.unshift(item);
  saveCollected(all);
  return item;
}

export function removeVariation(id: string): void {
  const all = loadCollected().filter((v) => v.id !== id);
  saveCollected(all);
}
