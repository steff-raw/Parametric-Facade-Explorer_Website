"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PatternModule, PatternParams } from "@/lib/patterns";
import { approx, naReason, SUN_TOOLTIP } from "@/lib/pattern-badge/label";
import BADGES from "@/lib/pattern-badge/badges.json";
import { renderThumb3D } from "@/lib/pattern-badge/thumb-client";
import { PatternThumbnail } from "./PatternCanvas";

interface PatternCardProps {
  pattern: PatternModule;
  params?: PatternParams;
  href?: string;
  subtitle?: string;
}

type Sun = { blocks: number; winterKept: number };

/** Screen-reader wording of a rounded value: "~60%" -> "about 60%", ">95%" -> "over 95%", "<5%" -> "under 5%". */
const spoken = (v: number) => approx(v).replace("~", "about ").replace(">", "over ").replace("<", "under ");

export default function PatternCard({
  pattern,
  params,
  href,
  subtitle,
}: PatternCardProps) {
  const to = href ?? `/patterns/${pattern.meta.slug}`;
  const slug = pattern.meta.slug;
  const flat = pattern.meta.type === "static-2d";
  // Score and 3D render are of the default pose, so only when the card shows defaults.
  const scored = !flat && !params;
  // Precomputed (badges.json, asserted equal to the scorer by pattern-badge-checks): no ray test in the page.
  const sun: Sun | null = scored ? ((BADGES as Record<string, Sun>)[slug] ?? null) : null;
  const [thumb, setThumb] = useState<string | null>(null);
  const card = useRef<HTMLAnchorElement>(null);

  // 3D render only when the card nears the viewport, in a Web Worker (three.js never on the main thread); no WebGL keeps the SVG.
  useEffect(() => {
    const el = card.current;
    if (!scored || !el || typeof IntersectionObserver === "undefined") return;
    let live = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        renderThumb3D(slug).then((url) => live && url && setThumb(url));
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [slug, scored]);

  return (
    <Link ref={card} href={to} className="group block">
      <PatternThumbnail
        pattern={pattern}
        params={params}
        className="transition-opacity group-hover:opacity-90"
        // Headroom so the top-left badge / pill sits above the SVG artwork, not on it.
        previewClassName={sun || flat ? "pt-[52px] pb-3" : ""}
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- object URL rendered in the browser
          <img
            src={thumb}
            alt=""
            data-thumb3d
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {sun && (
          <span
            data-sun-badge
            role="img"
            aria-label={`Sun badge: blocks ${spoken(sun.blocks)}, winter kept ${spoken(sun.winterKept)}.`}
            title={SUN_TOOLTIP}
            className="absolute left-3 top-3 flex items-center gap-2 whitespace-nowrap rounded-md border border-[#444] bg-[#1f2a30]/90 px-2.5 py-1"
          >
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full bg-[#f2b632]" />
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-white">
                Blocks {approx(sun.blocks)}
              </span>{" "}
              <span className="text-[10px] text-[#cfd6da]">
                winter kept {approx(sun.winterKept)}
              </span>
            </span>
          </span>
        )}
        {flat && (
          <span
            data-sun-na
            title={naReason(slug)}
            className="absolute left-3 top-3 inline-flex h-7 items-center rounded-full border border-line bg-pill px-3 text-[11px] text-muted"
          >
            Sun: n/a
          </span>
        )}
      </PatternThumbnail>
      <div className="mt-3">
        <p className="text-sm font-medium text-ink group-hover:text-accent">
          {pattern.meta.name}
        </p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}
