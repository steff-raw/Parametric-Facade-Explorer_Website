"use client";

/**
 * Facade Yield Map view (slug-gated in PatternDetail, P-0017): flat front elevation,
 * 8 x 8 modules with annual clear-sky kWh/m² yr, dashed cells below the cut-off,
 * block-height bar at the left, one mismatch bar per series string, KPI chips and footnote.
 * Grey scale = linear min–max of the on-modules.
 */

import { ReactNode, useMemo } from "react";
import { PatternParams } from "@/lib/patterns";
import { defaults, getSolve, greyScale, grey, stringingOf } from "@/lib/patterns/yield-map";
import {
  CAPTION,
  COLS,
  EFFICIENCY,
  GRID_HEADER,
  LONDON_FOOTNOTE,
  LONDON_SOURCE,
  PERFORMANCE_RATIO,
  ROWS,
  STRING_LABEL,
  YIELD_CONTEXT,
  layout,
} from "@/lib/patterns/yield-map/engine";

const HEAT = "#c47a48";
const GREY = "#969696";
const MUTED = "#8a8a8a";
const CELL = 56;
const GAP = 3;
const GRID = COLS * CELL + (COLS - 1) * GAP; // 469 px
const LEFT = 36; // block bar column
const TOP = 24; // header line
const GW = LEFT + GRID; // grid svg width
const CUT_H = 30; // cut-off line under the grid
const BAR_X = 18; // bars start at grid right + 18 px
const PX_PER_PCT = 4; // row bars, capped at 50 %
const BW = BAR_X + 50 * PX_PER_PCT + 56; // row-bar svg width
const COL_PX_PER_PCT = 3; // column bars, capped at 50 %
const FACADE_M = ROWS * 1.5;
const LABEL = "text-[14px] sm:text-[12px]"; // ≥ 10 px on a 390 px phone (SVG scales ~0.71)

const kwh = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const pct = (v: number) => `${(Math.abs(v) < 0.05 ? 0 : v).toFixed(1).replace("-", "−")} %`;
const r1 = (v: number) => Math.round(v * 10) / 10; // same attribute text on server and client

function Chip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="text-[11px] leading-snug text-muted sm:text-xs">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">{children}</div>
    </div>
  );
}

export default function YieldMap({ params }: { params: PatternParams }) {
  const p = { ...defaults, ...params };
  const stringing = stringingOf(p.stringing);
  const sol = useMemo(() => getSolve({ orientation: p.orientation, latitude: p.latitude, blockHeight: p.blockHeight }), [p.orientation, p.latitude, p.blockHeight]);
  // Both wirings come from one re-derive per cut-off; the Stringing toggle only picks one.
  const base = useMemo(() => {
    const L = layout(sol, p.cutoff, "rows");
    return { ...L, t: greyScale(sol, L.on) };
  }, [sol, p.cutoff]);
  const chosen = stringing === "cols" ? base.cols : base.rows;
  const view = { ...base, chosen, kwh: chosen.kwh, vsNaive: base.naiveKwh > 0 ? 100 * (chosen.kwh / base.naiveKwh - 1) : 0 };

  const bars = view.chosen.strings;
  const worst = Math.max(...bars);
  const barColour = (v: number) => (worst > 0 && v === worst ? HEAT : GREY);
  const barH = (Math.min(p.blockHeight, FACADE_M) / FACADE_M) * GRID;
  const blockLabel = p.blockHeight > 0 ? `block ${p.blockHeight} m` : "no block";
  const isCols = stringing === "cols";
  // Grid and KPI chips keep the same y in both modes; column bars go below the chips (labels on one baseline).
  const colMax = r1(Math.max(1, Math.min(50, worst) * COL_PX_PER_PCT));
  const gridH = TOP + GRID + CUT_H;
  const colH = 20 + colMax + 26;
  const higher = view.rows.loss === view.cols.loss ? null : view.rows.loss > view.cols.loss ? "rows" : "cols";
  const [srcBefore, srcAfter] = LONDON_FOOTNOTE.split("PVGIS 5.2");

  return (
    <div className="px-4 pb-24 pt-[104px] sm:pb-8 md:pl-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
        <svg
          viewBox={`0 0 ${GW} ${gridH}`}
          width={GW}
          height={gridH}
          className="block h-auto w-full shrink-0"
          style={{ maxWidth: GW }}
          role="img"
          aria-label={`${GRID_HEADER}: ${view.onCount} of 64 modules above the cut-off`}
          fontFamily="inherit"
        >
          <text data-yield-header x={LEFT} y={14} className={LABEL} fill={MUTED}>{GRID_HEADER}</text>
          <text x={GW} y={14} className={LABEL} fill={MUTED} textAnchor="end">dashed = below cut-off</text>

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
                  textAnchor="middle"
                  className="text-[15px] tabular-nums sm:text-[13px]"
                  fill={on ? (t > 0.45 ? "#161616" : "#f2f2f2") : MUTED}
                  fillOpacity={on ? 1 : 0.75}
                >
                  {kwh(h)}
                </text>
              </g>
            );
          })}

          <text data-yield-cut x={LEFT} y={TOP + GRID + 20} className={LABEL} fill={MUTED}>
            {`Cut-off = ${kwh(view.threshold)} kWh/m² yr (${p.cutoff} % of unshaded ${kwh(sol.H0)}) · ${view.onCount} of 64 on`}
          </text>

        </svg>

        {!isCols && (
          <svg
            viewBox={`0 0 ${BW} ${TOP + GRID}`}
            width={BW}
            height={TOP + GRID}
            className="hidden shrink-0 sm:block"
            data-yield-bars="rows"
            aria-label="String mismatch loss, row strings"
            fontFamily="inherit"
          >
            <text x={BAR_X} y={14} fontSize={12} fill={MUTED}>String mismatch loss, row strings</text>
            {bars.map((v, r) => {
              const y = TOP + r * (CELL + GAP) + CELL / 2;
              const w = r1(Math.max(1.5, Math.min(50, v) * PX_PER_PCT));
              return (
                <g key={r} data-bar={r}>
                  <rect x={BAR_X} y={y - 6} width={w} height={12} fill={barColour(v)} />
                  <text x={BAR_X + w + 8} y={y + 4.5} fontSize={12} className="tabular-nums" fill="#e8e8e8">{pct(v)}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-4 grid max-w-[820px] grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.5fr_1fr] sm:gap-3" data-yield-kpis>
        <Chip label={`Layout yield, ${isCols ? "columns" : "rows"}`}>
          <span className="text-lg font-bold text-ink">{kwh(view.kwh)}</span>
          <span className="text-xs text-muted">kWh/yr</span>
        </Chip>
        <Chip label="vs all 64 modules, no cut-off or string loss">
          <span className="text-lg font-bold text-ink">{pct(view.vsNaive)}</span>
        </Chip>
        <Chip label="String loss, on-modules">
          <span className="text-xs text-muted">rows</span>
          <span className="text-lg font-bold" style={{ color: higher === "rows" ? HEAT : "#e8e8e8" }}>{pct(view.rows.loss)}</span>
          <span className="text-xs text-muted">/ cols</span>
          <span className="text-lg font-bold" style={{ color: higher === "cols" ? HEAT : "#e8e8e8" }}>{pct(view.cols.loss)}</span>
        </Chip>
        <Chip label="Modules above cut-off">
          <span className="text-lg font-bold text-ink">{view.onCount}</span>
          <span className="text-xs text-muted">of 64</span>
        </Chip>
      </div>

      {!isCols && (
        <div className="mt-4 sm:hidden" data-yield-bars-phone>
          <div className="mb-1.5 text-xs text-muted">String mismatch loss, row strings</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] tabular-nums">
            {bars.map((v, r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span className="w-9 shrink-0 text-muted">Row {r + 1}</span>
                <span className="h-2 shrink-0" style={{ width: r1(Math.max(1.5, Math.min(50, v) * 1.2)), background: barColour(v) }} />
                <span className="text-ink">{pct(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCols && (
        <svg
          viewBox={`0 0 ${GW} ${colH}`}
          width={GW}
          height={colH}
          className="mt-4 block h-auto w-full"
          style={{ maxWidth: GW }}
          aria-label="String mismatch loss, column strings"
          fontFamily="inherit"
        >
          <g data-yield-bars="cols">
            <text x={LEFT} y={12} className={LABEL} fill={MUTED}>String mismatch loss, column strings</text>
            {bars.map((v, c) => {
              const x = LEFT + c * (CELL + GAP) + CELL / 2;
              const y0 = 20;
              const h = r1(Math.max(1, Math.min(50, v) * COL_PX_PER_PCT));
              return (
                <g key={c} data-bar={c}>
                  <rect x={x - 6} y={y0} width={12} height={h} fill={barColour(v)} />
                  <text x={x} y={y0 + colMax + 16} textAnchor="middle" className={`${LABEL} tabular-nums`} fill="#e8e8e8">{pct(v)}</text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      <div className="mt-3 max-w-[820px] space-y-1 text-[11px] leading-relaxed text-muted">
        <p>
          <span className="text-ink">{STRING_LABEL}.</span> Block {p.blockHeight} m high, {YIELD_CONTEXT.blockDistance} m away,{" "}
          {YIELD_CONTEXT.blockWidthShare * 100} % wide, flush left; {ROWS} × {COLS} modules of 1.5 m; {EFFICIENCY * 100} % efficiency,
          PR {PERFORMANCE_RATIO}; clear sky, solar time.
        </p>
        <p>
          {srcBefore}
          <a href={LONDON_SOURCE} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">
            PVGIS 5.2
          </a>
          {srcAfter}
        </p>
        <p className="text-ink">{CAPTION}.</p>
      </div>
    </div>
  );
}
