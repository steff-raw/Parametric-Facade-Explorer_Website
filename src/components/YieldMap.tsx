"use client";

/**
 * Facade Yield Map view (slug-gated in PatternDetail, P-0017): flat front elevation,
 * 8 x 8 modules with annual clear-sky kWh/m² yr, dashed cells below the cut-off,
 * block-height bar at the left. Grey scale = linear min–max of the on-modules.
 */

import { useMemo } from "react";
import { PatternParams } from "@/lib/patterns";
import { defaults, getSolve, greyScale, grey } from "@/lib/patterns/yield-map";
import { COLS, GRID_HEADER, ROWS, layout } from "@/lib/patterns/yield-map/engine";

const GREY = "#969696";
const MUTED = "#8a8a8a";
const CELL = 56;
const GAP = 3;
const GRID = COLS * CELL + (COLS - 1) * GAP; // 469 px
const LEFT = 36; // block bar column
const TOP = 24; // header line
const W = LEFT + GRID;
const H = TOP + GRID + 30;
const FACADE_M = ROWS * 1.5;

const kwh = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function YieldMap({ params }: { params: PatternParams }) {
  const p = { ...defaults, ...params };
  const sol = useMemo(() => getSolve({ orientation: p.orientation, latitude: p.latitude, blockHeight: p.blockHeight }), [p.orientation, p.latitude, p.blockHeight]);
  const view = useMemo(() => {
    const L = layout(sol, p.cutoff, "rows");
    return { ...L, t: greyScale(sol, L.on) };
  }, [sol, p.cutoff]);

  const barH = (Math.min(p.blockHeight, FACADE_M) / FACADE_M) * GRID;
  const blockLabel = p.blockHeight > 0 ? `block ${p.blockHeight} m` : "no block";

  return (
    <div className="absolute inset-0 overflow-auto px-4 pb-6 pt-[104px] md:pl-12">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block h-auto w-full"
        style={{ maxWidth: W }}
        role="img"
        aria-label={`${GRID_HEADER}: ${view.onCount} of 64 modules above the cut-off`}
        fontFamily="inherit"
      >
        <text data-yield-header x={LEFT} y={14} fontSize={12} fill={MUTED}>{GRID_HEADER}</text>
        <text x={W} y={14} fontSize={12} fill={MUTED} textAnchor="end">dashed = below cut-off</text>

        <g data-yield-block>
          {barH > 0 && <rect x={18} y={TOP + GRID - barH} width={12} height={barH} fill="none" stroke={GREY} strokeWidth={1} />}
          <text
            x={0}
            y={0}
            fontSize={11}
            fill={MUTED}
            textAnchor="middle"
            transform={`translate(12 ${TOP + GRID - (barH > 0 ? barH / 2 : GRID / 2)}) rotate(-90)`}
          >
            {blockLabel}
          </text>
        </g>

        {sol.H.map((h, m) => {
          const r = Math.floor(m / COLS), c = m % COLS;
          const x = LEFT + c * (CELL + GAP), y = TOP + r * (CELL + GAP);
          const on = view.on[m];
          const t = view.t[m];
          return (
            <g key={m} data-cell={m} data-on={on ? 1 : 0}>
              {on ? (
                <rect x={x} y={y} width={CELL} height={CELL} fill={grey(t)} />
              ) : (
                <rect x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} fill="none" stroke={GREY} strokeWidth={1} strokeDasharray="3 3" />
              )}
              <text
                x={x + CELL / 2}
                y={y + CELL / 2 + 4.5}
                fontSize={13}
                textAnchor="middle"
                className="tabular-nums"
                fill={on ? (t > 0.45 ? "#161616" : "#f2f2f2") : MUTED}
                fillOpacity={on ? 1 : 0.75}
              >
                {kwh(h)}
              </text>
            </g>
          );
        })}

        <text data-yield-cut x={LEFT} y={TOP + GRID + 20} fontSize={12} fill={MUTED}>
          {`Cut-off = ${kwh(view.threshold)} kWh/m² yr (${p.cutoff} % of unshaded ${kwh(sol.H0)}) · ${view.onCount} of 64 on`}
        </text>
      </svg>
    </div>
  );
}
