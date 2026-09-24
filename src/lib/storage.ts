/**
 * localStorage persistence for saved pattern variations.
 * No auth / backend for v1.
 */

import { PatternParams } from "./patterns";

const STORAGE_KEY = "pfe-collected-v1";

export interface SavedVariation {
  id: string;
  slug: string;
  name: string;
  params: PatternParams;
  savedAt: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadCollected(): SavedVariation[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedVariation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCollected(items: SavedVariation[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
