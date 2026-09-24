"use client";

import Link from "next/link";
import { PatternModule, PatternParams } from "@/lib/patterns";
import { PatternThumbnail } from "./PatternCanvas";

interface PatternCardProps {
  pattern: PatternModule;
  params?: PatternParams;
  href?: string;
  subtitle?: string;
}

export default function PatternCard({
  pattern,
  params,
  href,
  subtitle,
}: PatternCardProps) {
  const to = href ?? `/patterns/${pattern.meta.slug}`;

  return (
    <Link href={to} className="group block">
      <PatternThumbnail
        pattern={pattern}
        params={params}
        className="transition-opacity group-hover:opacity-90"
      />
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
