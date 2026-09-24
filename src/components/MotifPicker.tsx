"use client";

import { useMemo } from "react";
import {
  HOLE_MOTIFS,
  buildMotifPrimitives,
  getMotif,
} from "@/lib/patterns/perforated-screen/motifs";
import { SvgPrimitive } from "@/lib/patterns/shared/types";

interface MotifPickerProps {
  value: number;
  onChange: (motifId: number) => void;
}

const ICON_SIZE = 64;
/** Half-extent so the motif fills the tile with little empty margin */
const ICON_RADIUS = ICON_SIZE * 0.42;

function MotifIcon({ id }: { id: number }) {
  const prims = useMemo(
    () => buildMotifPrimitives(id, ICON_SIZE / 2, ICON_SIZE / 2, ICON_RADIUS),
    [id]
  );

  return (
    <svg
      viewBox={`0 0 ${ICON_SIZE} ${ICON_SIZE}`}
      className="h-full w-full"
      aria-hidden
    >
      {prims.map((p, i) => (
        <MotifPrimitive key={i} p={p} />
      ))}
    </svg>
  );
}

/** White geometry on a dark tile — filled solids, stroked lines/rings. */
function MotifPrimitive({ p }: { p: SvgPrimitive }) {
  const stroke = {
    stroke: "#ffffff",
    strokeWidth: 1.35,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (p.type === "line") {
    return (
      <line
        x1={p.x1}
        y1={p.y1}
        x2={p.x2}
        y2={p.y2}
        fill="none"
        {...stroke}
      />
    );
  }

  if (p.type === "circle") {
    // Nested rings stay readable as outlines; solid dots fill.
    const fill = p.r < ICON_RADIUS * 0.28 ? "#ffffff" : "none";
    return (
      <circle
        cx={p.cx}
        cy={p.cy}
        r={p.r}
        fill={fill}
        {...stroke}
        opacity={p.opacity}
      />
    );
  }

  if (p.type === "rect") {
    return (
      <rect
        x={p.x}
        y={p.y}
        width={p.width}
        height={p.height}
        fill="#ffffff"
        stroke="none"
        opacity={p.opacity}
      />
    );
  }

  if (p.type === "path") {
    return (
      <path
        d={p.d}
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth={1}
        strokeLinejoin="round"
        opacity={p.opacity}
      />
    );
  }

  return null;
}

/**
 * Unified hole-motif picker — one equal-size grid, white patterns on dark grey.
 * Icons are drawn from motif primitives (not atlas crops) so tiles never bleed.
 */
export default function MotifPicker({ value, onChange }: MotifPickerProps) {
  const selected = getMotif(value);

  return (
    <div className="mt-10 border-t border-line pt-6">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-tag text-muted">
          Hole motif
        </h2>
        <span className="truncate text-xs text-muted">{selected.label}</span>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
        {HOLE_MOTIFS.map((motif) => {
          const active = value === motif.id;
          return (
            <button
              key={motif.id}
              type="button"
              title={motif.label}
              aria-label={motif.label}
              aria-pressed={active}
              onClick={() => onChange(motif.id)}
              className={[
                "aspect-square overflow-hidden rounded-sm bg-[#2a2a2a] p-1 transition-[outline,background-color]",
                active
                  ? "outline outline-1 outline-offset-1 outline-ink"
                  : "hover:bg-[#333] outline-none",
              ].join(" ")}
            >
              <MotifIcon id={motif.id} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
