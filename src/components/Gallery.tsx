"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { patterns, countByTag, countKinetic, allTags } from "@/lib/patterns";
import TagPill from "./TagPill";
import PatternCard from "./PatternCard";
import StudioCard from "./studio/StudioCard";

type SortMode = "recent" | "popular";
type FilterMode = string | null | "__kinetic__";

export default function Gallery() {
  const searchParams = useSearchParams();
  const tagFromUrl = searchParams.get("tag");
  const [activeFilter, setActiveFilter] = useState<FilterMode>(tagFromUrl);
  const [sort, setSort] = useState<SortMode>("recent");
  const tagCounts = useMemo(() => countByTag(), []);
  const kineticCount = useMemo(() => countKinetic(), []);

  useEffect(() => {
    setActiveFilter(tagFromUrl);
  }, [tagFromUrl]);

  const filtered = useMemo(() => {
    let list = [...patterns];
    if (activeFilter === "__kinetic__") {
      list = list.filter((p) => p.meta.type === "kinetic-3d");
    } else if (activeFilter) {
      list = list.filter((p) => p.meta.tags.includes(activeFilter));
    }
    if (sort === "popular") {
      list.sort((a, b) => b.meta.popularity - a.meta.popularity);
    } else {
      list.sort(
        (a, b) =>
          new Date(b.meta.createdAt).getTime() -
          new Date(a.meta.createdAt).getTime()
      );
    }
    return list;
  }, [activeFilter, sort]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
      <section className="mb-12 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Facade Patterns
        </h1>
        <p className="mt-4 text-base leading-body text-muted">
          Generative studies for louvres, screens, and tessellated cladding —
          including kinetic 3D surfaces you can orbit and pause.
        </p>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <TagPill
          label="All"
          count={patterns.length}
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
              count={tagCounts[tag] ?? 0}
              active={activeFilter === tag}
              onClick={() =>
                setActiveFilter((prev) => (prev === tag ? null : tag))
              }
            />
          ))}
      </div>

      <div className="mb-10 flex items-center gap-4 text-sm text-muted">
        <span className="uppercase tracking-tag text-[11px]">Sort</span>
        <button
          type="button"
          onClick={() => setSort("recent")}
          className={
            sort === "recent"
              ? "text-ink"
              : "hover:text-accent transition-colors"
          }
        >
          Recent
        </button>
        <span className="text-line">/</span>
        <button
          type="button"
          onClick={() => setSort("popular")}
          className={
            sort === "popular"
              ? "text-ink"
              : "hover:text-accent transition-colors"
          }
        >
          Popular
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {(activeFilter === null || activeFilter === "Perforated") && <StudioCard />}
        {filtered.map((p) => (
          <PatternCard key={p.meta.slug} pattern={p} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-20 text-center text-muted">
          No patterns in this category yet.
        </p>
      )}
    </div>
  );
}
