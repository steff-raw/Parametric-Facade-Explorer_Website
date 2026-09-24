"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPattern } from "@/lib/patterns";
import {
  SavedVariation,
  loadCollected,
  removeVariation,
} from "@/lib/storage";
import { PatternThumbnail } from "./PatternCanvas";

export default function CollectedGrid() {
  const [items, setItems] = useState<SavedVariation[]>([]);

  useEffect(() => {
    setItems(loadCollected());
  }, []);

  const remove = (id: string) => {
    removeVariation(id);
    setItems(loadCollected());
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Collected
        </h1>
        <p className="mt-4 max-w-lg text-base leading-body text-muted">
          Saved variations live in this browser. Open a pattern, tweak the
          sliders, and hit{" "}
          <span className="text-ink">Save variation</span>.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block text-sm text-ink underline underline-offset-4 hover:text-accent"
        >
          Browse patterns →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
      <h1 className="mb-10 text-3xl font-bold tracking-tight text-ink md:text-4xl">
        Collected
      </h1>
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const pattern = getPattern(item.slug);
          if (!pattern) return null;
          const href = `/patterns/${item.slug}`;
          return (
            <div key={item.id} className="group">
              <Link href={href}>
                <PatternThumbnail
                  pattern={pattern}
                  params={item.params}
                  className="transition-opacity group-hover:opacity-90"
                />
              </Link>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={href}
                    className="text-sm font-medium text-ink hover:text-accent"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(item.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="text-xs text-muted underline underline-offset-4 hover:text-accent"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
