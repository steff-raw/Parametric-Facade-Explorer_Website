"use client";

import { useEffect, useMemo } from "react";
import {
  PatternModule,
  PatternParams,
  PatternStats,
  SvgPrimitive,
  getThumbnailSvg,
} from "@/lib/patterns";
import { STROKE, STROKE_WIDTH } from "@/lib/patterns/shared/math";

interface PatternCanvasProps {
  pattern: PatternModule;
  params: PatternParams;
  className?: string;
  onStats?: (stats: PatternStats) => void;
}

/** Shared stroke props — matches bookofshapes <line> attributes exactly */
const strokeProps = {
  stroke: STROKE,
  strokeWidth: STROKE_WIDTH,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none" as const,
  vectorEffect: "nonScalingStroke" as const,
};

function SvgPrimitiveNode({
  primitive: p,
  index,
}: {
  primitive: SvgPrimitive;
  index: number;
}) {
  switch (p.type) {
    case "line":
      return (
        <line
          key={index}
          x1={p.x1}
          y1={p.y1}
          x2={p.x2}
          y2={p.y2}
          {...strokeProps}
        />
      );
    case "circle":
      return (
        <circle
          key={index}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          {...strokeProps}
          strokeOpacity={p.opacity}
        />
      );
    case "path":
      return (
        <path
          key={index}
          d={p.d}
          {...strokeProps}
          strokeOpacity={p.opacity}
        />
      );
    case "rect":
      return (
        <rect
          key={index}
          x={p.x}
          y={p.y}
          width={p.width}
          height={p.height}
          {...strokeProps}
          strokeOpacity={p.opacity}
        />
      );
    default:
      return null;
  }
}

/**
 * Static 2D pattern view — plain SVG DOM (not <canvas>).
 * Each generator primitive becomes a real <line>/<circle>/… node.
 */
export default function PatternCanvas({
  pattern,
  params,
  className = "",
  onStats,
}: PatternCanvasProps) {
  const { result, stats } = useMemo(() => {
    const t0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const generated = pattern.generate?.(params);
    const t1 =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    if (!generated) {
      return {
        result: null,
        stats: {
          elementCount: 0,
          nodeCount: 0,
          connectionCount: 0,
          renderTimeMs: 0,
        } satisfies PatternStats,
      };
    }

    return {
      result: generated,
      stats: {
        ...generated.stats,
        renderTimeMs: Math.max(0, Math.round((t1 - t0) * 10) / 10),
      } satisfies PatternStats,
    };
  }, [pattern, params]);

  useEffect(() => {
    onStats?.(stats);
  }, [stats, onStats]);

  if (!result) {
    return (
      <div
        className={`h-full w-full overflow-hidden bg-canvas ${className}`}
      />
    );
  }

  return (
    <div
      className={`h-full w-full overflow-hidden bg-canvas ${className}`}
      role="img"
      aria-label={`${pattern.meta.name} preview`}
    >
      <svg
        viewBox={`0 0 ${result.size} ${result.size}`}
        width="100%"
        height="100%"
        fill="none"
        className="block h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {result.primitives.map((p, i) => (
          <SvgPrimitiveNode key={i} primitive={p} index={i} />
        ))}
      </svg>
    </div>
  );
}

/** Gallery thumbnails — serialized SVG string is fine at small size */
export function PatternThumbnail({
  pattern,
  params,
  className = "",
  showKineticBadge = false,
}: {
  pattern: PatternModule;
  params?: PatternParams;
  className?: string;
  showKineticBadge?: boolean;
}) {
  const svg = useMemo(
    () => getThumbnailSvg(pattern, params),
    [pattern, params]
  );

  const isKinetic = pattern.meta.type === "kinetic-3d";
  const is3D =
    pattern.meta.type === "kinetic-3d" || pattern.meta.type === "static-3d";

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden bg-canvas ${className}`}
    >
      <div
        className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
        aria-hidden
      />
      {(showKineticBadge || is3D) && (
        <span
          className="absolute bottom-3 left-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-pill text-ink"
          title={isKinetic ? "Kinetic 3D pattern" : "3D pattern"}
          aria-label={isKinetic ? "Kinetic" : "3D"}
        >
          {isKinetic ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
              <path d="M12 12v9M12 12 4 7.5M12 12l8-4.5" />
            </svg>
          )}
        </span>
      )}
    </div>
  );
}
