"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PatternModule, PatternParams } from "@/lib/patterns";
import { approx, naReason, SUN_TOOLTIP } from "@/lib/pattern-badge/label";
import { PatternThumbnail } from "./PatternCanvas";

interface PatternCardProps {
  pattern: PatternModule;
  params?: PatternParams;
  href?: string;
  subtitle?: string;
}

type Sun = { blocks: number; winterKept: number };

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
  const [sun, setSun] = useState<Sun | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);

  // After first paint: three.js and the ray test load in their own chunk; no WebGL keeps the SVG.
  useEffect(() => {
    if (!scored) return;
    let live = true;
    import("@/lib/pattern-badge/thumb3d").then(({ loadBadge, renderThumb3D }) => {
      loadBadge(slug).then((b) => live && b && setSun(b));
      renderThumb3D(slug).then((t) => live && t && setThumb(t.url));
    });
    return () => {
      live = false;
    };
  }, [slug, scored]);

  return (
    <Link href={to} className="group block">
      <PatternThumbnail
        pattern={pattern}
        params={params}
        className="transition-opacity group-hover:opacity-90"
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL rendered in the browser
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
