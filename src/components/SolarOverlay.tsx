"use client";

/**
 * Solar Budget Skin overlay (slug-gated in PatternDetail): sun-path arc with compass labels,
 * array labels, element key, plan inset and KPI chips. Positions come from the module's
 * screenPoint(), so they sit on the same camera as the 3D view.
 */

import { useEffect, useRef, useState } from "react";
import { PatternParams } from "@/lib/patterns";
import {
  LAYOUT,
  MONTHS,
  compass,
  formatHour,
  formatLatitude,
  getSolve,
  screenPoint,
} from "@/lib/patterns-3d/solar-budget-skin";
import {
  DEFAULT_CONTEXT,
  FOOTNOTES,
  SAMPLE_DAY,
  VIEW_OUT_LABEL,
  sunPosition,
  toFacade,
} from "@/lib/patterns-3d/solar-budget-skin/engine";

const HEAT = "#c47a48";
const GREY = "#969696";

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: e.contentRect.width, height: e.contentRect.height })
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Sun direction in the facade frame: x = viewer's right seen from outside, y up, z out. */
function sunLocal(p: PatternParams, hour: number) {
  const sun = sunPosition(p.latitude, SAMPLE_DAY[Math.round(p.month) - 1], hour);
  return toFacade(sun.vec, p.orientation);
}

function Chip({ label, short, bare, skin }: { label: string; short: string; bare: string; skin: string }) {
  return (
    <div className="min-w-0 flex-1 basis-[30%] rounded-[10px] border border-line px-2.5 py-2 sm:px-4">
      <div className="whitespace-nowrap text-[10px] text-muted sm:text-xs">
        <span className="sm:hidden">{short}</span>
        <span className="hidden sm:inline">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1 tabular-nums sm:gap-2">
        <span className="text-xs sm:text-sm" style={{ color: HEAT }}>{bare}</span>
        <span className="text-xs text-muted">→</span>
        <span className="text-sm font-bold text-ink sm:text-lg">{skin}</span>
      </div>
    </div>
  );
}

function KeyIcon({ kind }: { kind: "blade" | "fin" | "hood" | "capped" }) {
  const c = kind === "capped" ? "#8f8f8f" : "#c8c8c8";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden>
      <rect x="4" y="5" width="16" height="16" fill="#3a5a8c" stroke={GREY} strokeWidth="1" />
      {(kind === "blade" || kind === "hood" || kind === "capped") && (
        <polygon points="4,5 20,5 23,2 7,2" fill={c} stroke={GREY} strokeWidth="0.75" />
      )}
      {(kind === "fin" || kind === "hood" || kind === "capped") && (
        <>
          <polygon points="4,5 4,21 7,18 7,2" fill={c} stroke={GREY} strokeWidth="0.75" />
          <polygon points="20,5 20,21 23,18 23,2" fill={c} stroke={GREY} strokeWidth="0.75" />
        </>
      )}
    </svg>
  );
}

function PlanInset({ orientation }: { orientation: number }) {
  const s = 5; // px per m
  const w = DEFAULT_CONTEXT.cols * 1.5;
  const blockW = w * DEFAULT_CONTEXT.blockWidthShare;
  const ox = 6, oy = 22;
  const by = oy + DEFAULT_CONTEXT.blockDistance * s;
  const [nx, , nz] = toFacade([0, 1, 0], orientation);
  const ax = 100, ay = 46;
  return (
    <svg viewBox="0 0 120 96" className="h-24 w-[120px]" aria-label="Plan: facade, opposite block, north">
      <line x1={ox} y1={oy} x2={ox + w * s} y2={oy} stroke="#cccccc" strokeWidth="1.5" />
      <text x={ox} y={oy - 6} fontSize="10" fill={GREY}>facade</text>
      <rect x={ox} y={by} width={blockW * s} height={14} fill="none" stroke={GREY} strokeDasharray="2 2" />
      <text x={ox + 3} y={by + 11} fontSize="10" fill={GREY}>block</text>
      <line x1={ax} y1={ay} x2={ax + nx * 12} y2={ay + nz * 12} stroke="#cccccc" strokeWidth="1.2" />
      <circle cx={ax + nx * 12} cy={ay + nz * 12} r="1.8" fill="#cccccc" />
      <text x={ax + nx * 22} y={ay + nz * 22 + 4} fontSize="10" fill="#cccccc" textAnchor="middle">N</text>
    </svg>
  );
}

export default function SolarOverlay({ params, hidden }: { params: PatternParams; hidden?: boolean }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const res = getSolve(params);
  const k = res.kpi;
  const ready = width > 0 && height > 0;
  const at = (x: number, y: number): [number, number] =>
    ready ? screenPoint([x, y, 0], width, height) : [0, 0];

  const [bl, bt] = at(LAYOUT.bare[0], LAYOUT.top);
  const [sr, st] = at(LAYOUT.skin[1], LAYOUT.top);
  const [, bb] = at(LAYOUT.bare[0], LAYOUT.bottom);
  const [, sb] = at(LAYOUT.skin[1], LAYOUT.bottom);
  const [bmx] = at((LAYOUT.bare[0] + LAYOUT.bare[1]) / 2, LAYOUT.bottom);
  const [smx] = at((LAYOUT.skin[0] + LAYOUT.skin[1]) / 2, LAYOUT.bottom);

  // Sun-path arc above both arrays, in the viewer's frame (left = viewer's left seen from outside).
  const base = Math.min(bt, st) - 14;
  const half = (sr - bl) / 2;
  const mid = (sr + bl) / 2;
  const arcH = Math.min(46, half * 0.28);
  const toArc = ([x, y, z]: number[]): [number, number] => {
    const a = Math.atan2(x, z) / (Math.PI / 2);
    const e = Math.asin(Math.max(-1, Math.min(1, y))) / (Math.PI / 2);
    return [mid + a * half, base - e * arcH * 2];
  };
  const arc: [number, number][] = [];
  const segments: string[][] = [];
  let open = false;
  for (let h = 0; h <= 24; h += 0.1) {
    const v = sunLocal(params, h);
    const visible = v[1] > 0 && v[2] > 0;
    if (visible) {
      arc.push(toArc(v));
      if (!open) segments.push([]);
      segments[segments.length - 1].push(arc[arc.length - 1].map((n) => n.toFixed(1)).join(","));
    }
    open = visible;
  }
  const xs = arc.map((q) => q[0]);
  const endY = (pick: number) => (arc.length ? arc[xs.indexOf(pick)][1] : base) + 14;
  const leftY = arc.length ? endY(Math.min(...xs)) : base;
  const rightY = arc.length ? endY(Math.max(...xs)) : base;
  const topY = arc.length ? Math.min(...arc.map((q) => q[1])) - 8 : base - arcH;
  const now = sunLocal(params, params.hour);
  const status = now[1] <= 0 ? "Sun below horizon" : now[2] <= 0 ? "Sun behind facade" : "";
  const dot = status ? null : toArc(now);
  const month = MONTHS[Math.round(params.month) - 1];
  const labels = res.labels;

  return (
    <div
      ref={ref}
      className={`pointer-events-none absolute inset-0 z-10 ${hidden ? "invisible sm:visible" : ""}`}
    >
      {ready && (
        <>
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {segments.map((seg, i) => (
              <polyline key={i} points={seg.join(" ")} fill="none" stroke={GREY} strokeWidth="1" />
            ))}
            {dot && (
              <>
                <circle cx={dot[0]} cy={dot[1]} r="5" fill="none" stroke={HEAT} strokeWidth="1.5" />
                <text x={dot[0]} y={dot[1] + 16} fontSize="10" fill={GREY} textAnchor="middle">
                  {formatHour(params.hour).replace(" solar", "")}
                </text>
              </>
            )}
            <text x={bl} y={leftY} fontSize="10" fill={GREY} textAnchor="middle">
              {compass(params.orientation + 90)}
            </text>
            <text x={sr} y={rightY} fontSize="10" fill={GREY} textAnchor="middle">
              {compass(params.orientation - 90)}
            </text>
            <text x={mid} y={topY} fontSize="10" fill={GREY} textAnchor="middle">
              {compass(params.orientation)}
            </text>
          </svg>

          <div
            className="absolute whitespace-nowrap text-[10px] text-muted sm:text-[11px]"
            style={{ right: Math.max(8, width - sr), top: topY - 28 }}
          >
            Sun path · 21 {month} · {formatLatitude(params.latitude)} · viewed from outside
            {status && <span className="ml-2 text-ink">· {status}</span>}
          </div>

          {[
            { x: bmx, title: "Bare glass", sub: "Exposure tint" },
            { x: smx, title: "Solved skin", sub: "Element + depth chosen per cell" },
          ].map((l) => (
            <div
              key={l.title}
              className="absolute -translate-x-1/2 text-center"
              style={{ left: l.x, top: Math.max(bb, sb) + 8 }}
            >
              <div className="text-xs text-ink sm:text-sm">{l.title}</div>
              <div className="hidden text-[11px] text-muted sm:block">{l.sub}</div>
            </div>
          ))}

          <div
            className="absolute hidden flex-col gap-3 text-[11px] sm:flex"
            style={{ left: sr + 8, top: st + 104 }}
          >
            {[
              { kind: "blade" as const, t: "Blade", s: "high sun · top" },
              { kind: "fin" as const, t: "Fin", s: "low side sun" },
              { kind: "hood" as const, t: "Hood", s: "mixed" },
              { kind: "capped" as const, t: "Grey", s: "capped · Target not met" },
            ].map((e) => (
              <div key={e.kind} className="flex items-center gap-1.5">
                <KeyIcon kind={e.kind} />
                <div className="max-w-[76px]">
                  <div className="text-ink">{e.t}</div>
                  <div className="text-muted">{e.s}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="absolute hidden sm:block" style={{ left: sr + 4, top: st }}>
            <PlanInset orientation={params.orientation} />
          </div>
        </>
      )}

      <div className="absolute inset-x-4 bottom-16 sm:bottom-4 sm:left-8 sm:right-8">
        <div className="mb-1.5 text-[10px] text-muted sm:text-xs">
          Concept-stage estimate, not compliance · bare → skin
        </div>
        <div className="flex max-w-3xl flex-wrap gap-2 sm:gap-3">
          <Chip
            label={`${labels.cooling === "Summer" ? "Summer" : "Hot season"} gain kWh/m² yr`}
            short={`${labels.cooling === "Summer" ? "Summer" : "Hot season"} kWh/m²`}
            bare={k.bareSummer.toFixed(0)}
            skin={k.skinSummer.toFixed(0)}
          />
          <Chip
            label={`${labels.winterKept} %`}
            short={labels.cooling === "Summer" ? "Winter kept %" : "Cool season kept %"}
            bare="100" skin={k.winterKept.toFixed(0)} />
          <Chip label="Glare h/yr" short="Glare h/yr" bare={k.bareGlare.toFixed(0)} skin={k.skinGlare.toFixed(0)} />
        </div>
      </div>
    </div>
  );
}

/** Footnote under the canvas: one visible line; fixed inputs and limits in a closed <details>. */
export function SolarFootnote({ params }: { params: PatternParams }) {
  const res = getSolve(params);
  const inputs = FOOTNOTES.filter((f) => !f.includes("dome resolution"));
  return (
    <div className="max-w-3xl px-5 pt-4 text-[11px] leading-relaxed text-muted md:px-8">
      <p>
        * Synthetic clear sky, solar time, g-value 0.6, occupied 09:00–17:00, 8 × 8 cells of 1.5 m.
        {" "}{VIEW_OUT_LABEL.replace(" (cosine-weighted)", "")} 100% → {res.kpi.viewOut.toFixed(0)}%.
        {res.labels.footnote && ` ${res.labels.cooling} / ${res.labels.heating}: ${res.labels.footnote}.`}
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer underline underline-offset-4 transition-colors hover:text-accent">
          Assumptions and limits
        </summary>
        <p className="mt-2">Fixed inputs: {inputs.join(" ")} View-out is cosine-weighted.</p>
        <p>
          Dome resolution: single-column steps (the col-2 stripe in the bare array, a lone blade
          among hoods) are 12° dome resolution, not design.
        </p>
        <p>
          Not modelled: ground reflection, inter-reflection, equation of time, real weather,
          thermal mass, frame, self-shading between neighbouring cells&apos; elements.
        </p>
      </details>
    </div>
  );
}
