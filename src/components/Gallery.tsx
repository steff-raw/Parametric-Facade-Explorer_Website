"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { patterns, type PatternModule } from "@/lib/patterns";
import TagPill from "./TagPill";
import PatternCard from "./PatternCard";
import StudioCard from "./studio/StudioCard";
import WallCheckCard from "./wallcheck/WallCheckCard";
import GlareCard from "./glare/GlareCard";
import { SUN_TOOLTIP } from "@/lib/pattern-badge/label";

type FilterMode = string | null | "__kinetic__";

// Gradient Perforation is a tool, but it sits in the grid like a pattern: one entry, sorted by date.
const STUDIO_ENTRY = {
  studio: true as const,
  meta: {
    slug: "gradient-perforation",
    type: "static-2d",
    createdAt: "2026-10-07",
    tags: ["Perforated", "Parametric Grid"],
  },
};
type Entry = PatternModule | typeof STUDIO_ENTRY;
const entries: Entry[] = [...patterns, STUDIO_ENTRY];
const allTags = Array.from(new Set(entries.flatMap((e) => e.meta.tags))).sort();
const countTag = (tag: string) => entries.filter((e) => e.meta.tags.includes(tag)).length;

export default function Gallery() {
  const searchParams = useSearchParams();
  const tagFromUrl = searchParams.get("tag");
  const [activeFilter, setActiveFilter] = useState<FilterMode>(tagFromUrl);
  const kineticCount = entries.filter((e) => e.meta.type === "kinetic-3d").length;

  useEffect(() => {
    setActiveFilter(tagFromUrl);
  }, [tagFromUrl]);

  const filtered = useMemo(() => {
    let list = [...entries];
    if (activeFilter === "__kinetic__") {
      list = list.filter((p) => p.meta.type === "kinetic-3d");
    } else if (activeFilter) {
      list = list.filter((p) => p.meta.tags.includes(activeFilter));
    }
    list.sort(
      (a, b) =>
        new Date(b.meta.createdAt).getTime() -
        new Date(a.meta.createdAt).getTime()
    );
    return list;
  }, [activeFilter]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
      <section className="mb-12 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Facade Patterns
        </h1>
        <p className="mt-4 text-base leading-body text-muted">
          Generative studies for louvres, screens, and tessellated cladding,
          including kinetic 3D surfaces you can orbit and pause.
        </p>
      </section>

      <h2 className="mb-6 text-xl font-semibold tracking-tight text-ink">Patterns</h2>

      <div className="mb-10 flex flex-wrap gap-2">
        <TagPill
          label="All"
          count={entries.length}
          active={activeFilter === null}
          onClick={() => setActiveFilter(null)}
        />
        <TagPill
          label="Kinetic"
          count={kineticCount}
          active={activeFilter === "__kinetic__"}
          onClick={() =>
            setActiveFilter((prev) =>
              prev === "__kinetic__" ? null : "__kinetic__"
            )
          }
        />
        {allTags
          .filter((tag) => tag !== "Kinetic")
          .map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              count={countTag(tag)}
              active={activeFilter === tag}
              onClick={() =>
                setActiveFilter((prev) => (prev === tag ? null : tag))
              }
            />
          ))}
      </div>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) =>
          "studio" in p ? (
            <StudioCard key={p.meta.slug} />
          ) : (
            <PatternCard key={p.meta.slug} pattern={p} />
          ),
        )}
      </div>

      {filtered.length > 0 && (
        <p data-sun-footnote title={SUN_TOOLTIP} className="mt-10 text-xs leading-body text-muted">
          Sun badge: approximate, after EN ISO 52022-1; concept estimate, clear sky, not compliance.
          Scored over the central 60% of the element field.
        </p>
      )}

      {filtered.length === 0 && (
        <p className="py-20 text-center text-muted">
          No patterns in this category yet.
        </p>
      )}

      <section aria-labelledby="tools-heading" className="mt-16">
        <h2 id="tools-heading" className="mb-6 text-xl font-semibold tracking-tight text-ink">
          Tools
        </h2>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <WallCheckCard />
          <GlareCard />
        </div>
      </section>
    </div>
  );
}
