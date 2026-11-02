"use client";

/**
 * Adaptive Panel page body (slug-gated in PatternDetail, P-0023): 3D scene, hour scrubber and verdict over it,
 * its own 340 px panel (day pills, gain chart, DAY TOTALS, 2 sliders) and the footnote. Owns `hour`, so the
 * chart marker and the scene share one value. Params (day, cap, staticDepth) stay in PatternDetail state.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PatternParams } from "@/lib/patterns";
import { CHART_HOURS, dayResult, depthSeries, gain } from "@/lib/patterns-3d/adaptive-panel/engine";
import { DAY_LABELS, fmtHour, generatePreviewSvg, meta, nextHour, readParams, scrubHours, type Focus } from "@/lib/patterns-3d/adaptive-panel";
import { addVariation } from "@/lib/storage";
import Slider from "./Slider";
import TagPill from "./TagPill";

const AdaptivePanel3D = dynamic(() => import("./AdaptivePanel3D"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-canvas text-sm text-muted">Loading 3D…</div>,
});

const HEAT = "#c47a48";
const GREY = "#969696";
const heading = "text-[11px] font-medium uppercase tracking-tag text-muted";
const f2 = (v: number) => v.toFixed(2);
const signed = (v: number, n = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(n)}`;
/** The day's scrubber hour nearest to h (21 Dec has no 07:30 or 16:30 sun). */
const snap = (hours: number[], h: number) => hours.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a), hours[0]);
/** Play: one hour per second. */
const PLAY_MS = 1000;

interface AdaptivePanelProps {
  params: PatternParams;
  onChange: (key: string, value: number) => void;
  resetViewKey: number;
}

function Chip({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="min-w-0 flex-1 basis-[30%] rounded-[10px] border border-line px-2.5 py-2">
      <div className="whitespace-nowrap text-[10px] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1 tabular-nums">
        <span className="text-xs text-muted">{a}</span>
        <span className="text-xs text-muted">→</span>
        <span className="text-sm font-bold text-ink">{b}</span>
      </div>
    </div>
  );
}

/** Gain through glass by hour: open (dashed), static (grey), kinetic (white), cap line and hour marker. */
function GainChart({ rows, cap, hour, focus }: { rows: { h: number; open: number; st: number; kin: number }[]; cap: number; hour: number; focus: Focus }) {
  const W = 300, H = 130, L = 16, R = 284, TOP = 8, BOT = 108;
  const yMax = Math.max(cap, ...rows.map((r) => r.open)) * 1.1;
  const x = (h: number) => L + ((h - CHART_HOURS[0]) / (CHART_HOURS[CHART_HOURS.length - 1] - CHART_HOURS[0])) * (R - L);
  const y = (g: number) => BOT - (g / yMax) * (BOT - TOP);
  const line = (k: "open" | "st" | "kin") => rows.map((r) => `${x(r.h).toFixed(1)},${y(r[k]).toFixed(1)}`).join(" ");
  const now = rows.find((r) => r.h === hour);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[130px] w-full" role="img" aria-label="Gain through glass by hour">
        <line x1={L} x2={R} y1={y(cap)} y2={y(cap)} stroke={GREY} strokeWidth="1" strokeDasharray="1 3" />
        <text x={R} y={y(cap) - 4} fontSize="9" fill={GREY} textAnchor="end">cap {cap}</text>
        <polyline points={line("open")} fill="none" stroke={HEAT} strokeWidth="1.25" strokeDasharray="4 3" />
        <polyline points={line("st")} fill="none" stroke={GREY} strokeWidth={focus === "static" ? 3 : 1.5} opacity={focus === "kinetic" ? 0.35 : 1} data-testid="curve-static" />
        <polyline points={line("kin")} fill="none" stroke="#e8e8e8" strokeWidth={focus === "kinetic" ? 3 : 2} opacity={focus === "static" ? 0.35 : 1} data-testid="curve-kinetic" />
        {now && (
          <>
            <line x1={x(hour)} x2={x(hour)} y1={TOP} y2={BOT} stroke={HEAT} strokeWidth="1" />
            <circle cx={x(hour)} cy={y(now.st)} r="2.5" fill={GREY} />
            <circle cx={x(hour)} cy={y(now.kin)} r="2.5" fill="#e8e8e8" />
          </>
        )}
        {[7.5, 9.5, 11.5, 13.5, 15.5].map((h) => (
          <text key={h} x={x(h)} y={H - 6} fontSize="9" fill={GREY} textAnchor="middle">{fmtHour(h)}</text>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-[10px] text-muted">
        <span style={{ color: HEAT }}>- - open</span>
        <span>— static</span>
        <span className="text-ink">— kinetic</span>
      </div>
    </div>
  );
}

export default function AdaptivePanel({ params, onChange, resetViewKey }: AdaptivePanelProps) {
  const { day, month, cap, staticDepth } = readParams(params);
  const [hourPick, setHourPick] = useState(12.5);
  const [playing, setPlaying] = useState(false);
  const [focus, setFocus] = useState<Focus>("overview");
  const [open, setOpen] = useState(false); // phone only
  const [saved, setSaved] = useState(false);

  const hours = useMemo(() => scrubHours(month), [month]);
  // The day's nearest scrubber hour (21 Dec has no 07:30 or 16:30 sun).
  const hour = snap(hours, hourPick);

  // Play loops 07:30 to 16:30; scrubbing, dragging the sun or touching a control pauses it.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setHourPick((h) => nextHour(hours, snap(hours, h))), PLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, hours]);
  const pick = (h: number) => {
    setPlaying(false);
    setHourPick(h);
  };
  const change = (key: string, value: number) => {
    setPlaying(false);
    onChange(key, value);
  };
  // "Reset view" in the title chrome also leaves focus.
  useEffect(() => setFocus("overview"), [resetViewKey]);
  const series = useMemo(() => depthSeries(month, cap, staticDepth), [month, cap, staticDepth]);
  const kinAt = (h: number) => series.kinetic[series.hours.indexOf(h)];
  const res = useMemo(() => dayResult(month, cap, staticDepth), [month, cap, staticDepth]);
  // Gate closed every hour (blade would not close even at cap 0): kinetic is bare glass all day.
  const gateClosed = useMemo(() => depthSeries(month, 0, 0).kinetic.every((d) => d === 0), [month]);
  const rows = useMemo(
    () => hours.map((h) => ({ h, open: gain(month, h, 0), st: gain(month, h, staticDepth), kin: gain(month, h, kinAt(h)) })),
    // kinAt reads series
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hours, month, staticDepth, series],
  );
  const kd = kinAt(hour);
  const delta = res.kinetic - res.static;
  const pct = res.static > 0 ? (100 * delta) / res.static : 0;
  const thumb = useMemo(() => generatePreviewSvg(params), [params]);

  const verdict = gateClosed
    ? [
        `Kinetic = bare glass (open): gate: profile < 45°, blade cannot help. ${signed(delta)} kWh/m² vs static ${f2(staticDepth)} m.`,
        "Extra gain helps only in the heating season; March can overheat.",
      ]
    : [
        `${Math.abs(delta) < 0.005 ? "Heat is a tie" : `${delta > 0 ? "Static" : "Kinetic"} wins on heat by ${Math.abs(delta).toFixed(2)} kWh/m²`}; ${
          res.glare.kinetic < res.glare.static ? "kinetic cuts glare" : "glare"
        } ${res.glare.static} → ${res.glare.kinetic} h for ${res.moves} moves.`,
      ];

  const scrubIdx = hours.indexOf(hour);
  const scrubber = (
    <div className="pointer-events-auto flex items-start gap-3">
      <button
        type="button"
        onClick={() => setPlaying((p) => !p)}
        className="-my-3 min-h-[44px] shrink-0 text-sm text-ink underline underline-offset-4 transition-colors hover:text-accent"
        aria-pressed={playing}
      >
        {playing ? "❚❚ Pause" : "▶ Play"}
      </button>
      <div className="min-w-0 flex-1">
      <input
        type="range"
        className="pfe-slider"
        min={0}
        max={hours.length - 1}
        step={1}
        value={scrubIdx}
        onChange={(e) => pick(hours[Number(e.target.value)])}
        onPointerDown={() => setPlaying(false)}
        onKeyDown={() => setPlaying(false)}
        aria-label="Hour (solar time)"
        aria-valuetext={`${fmtHour(hour)} solar`}
      />
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted">
        <span>{fmtHour(hours[0])}</span>
        <span className="text-ink">{fmtHour(hour)} solar</span>
        <span>{fmtHour(hours[hours.length - 1])}</span>
      </div>
      </div>
    </div>
  );

  const handCheck = `Hand check, ${fmtHour(hour)}: gain = (Ib·z·τb(d) + Id·SVF(d)) × 0.6 = ${gain(month, hour, kd).toFixed(0)} W/m² at d = ${f2(kd)} m (kinetic), ${gain(month, hour, staticDepth).toFixed(0)} W/m² at ${f2(staticDepth)} m (static). Gate: profile angle < 45° keeps the blade open (Dec, Mar).`;
  const capDef = meta.staticParams.find((d) => d.key === "cap")!;
  const depthDef = meta.staticParams.find((d) => d.key === "staticDepth")!;
  const totals: [string, string, string][] = [
    ["Heat gain kWh/m²", f2(res.static), `${f2(res.kinetic)} ${signed(pct, 0)}%`],
    ["Sky view kept %", res.skyView.static.toFixed(0), res.skyView.kinetic.toFixed(0)],
    ["Glare hours", String(res.glare.static), String(res.glare.kinetic)],
    ["Moves / day", "0", String(res.moves)],
  ];

  return (
    <div className="relative w-full">
      <div className="relative sm:h-[80vh] sm:min-h-[480px]">
        {/* Scene: phone 55vh on top; desktop fills the space left of the panel */}
        <div className="relative h-[55vh] min-h-[360px] w-full sm:absolute sm:inset-y-0 sm:left-0 sm:right-[min(340px,38vw)] sm:h-auto sm:w-auto sm:min-h-0">
          <AdaptivePanel3D
            month={month}
            hour={hour}
            hours={hours}
            staticDepth={staticDepth}
            kineticDepth={kd}
            cap={cap}
            resetViewKey={resetViewKey}
            fallbackSvg={thumb}
            focus={focus}
            onFocus={setFocus}
            onScrub={pick}
          />
          <div className="pointer-events-none absolute right-5 top-24 z-10 text-[10px] text-muted sm:right-8 sm:text-[11px]">
            Sun path · {DAY_LABELS[day]} · 52° N · viewed from outside, drag the sun
          </div>
        </div>

        {/* Over the scene (desktop, bottom-left) / under it (phone): scrubber, chips, verdict */}
        <div className="relative z-10 flex flex-col gap-2 px-4 pt-3 sm:pointer-events-none sm:absolute sm:bottom-4 sm:left-8 sm:right-[calc(min(340px,38vw)+2rem)] sm:gap-3 sm:p-0">
          <div className="order-1 sm:order-2">{scrubber}</div>
          <div className="order-2 text-[10px] text-muted sm:hidden">
            Concept-stage estimate, not compliance · static → kinetic, {DAY_LABELS[day]}
          </div>
          <div className="order-2 flex gap-2 sm:hidden">
            <Chip label="Heat kWh/m²" a={f2(res.static)} b={f2(res.kinetic)} />
            <Chip label="Glare h" a={String(res.glare.static)} b={String(res.glare.kinetic)} />
            <Chip label="Moves" a="0" b={String(res.moves)} />
          </div>
          <div className="order-3 text-xs leading-relaxed text-ink sm:order-1 sm:-mx-2 sm:w-fit sm:max-w-full sm:rounded sm:bg-canvas/80 sm:px-2 sm:py-1 sm:text-sm" data-testid="verdict">
            {verdict.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <p className="order-4 text-[11px] text-muted sm:hidden">
            The value is seasonal, not hourly: kinetic wins on glare and shoulder/winter gain; June heat is a wash.
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="order-5 mt-2 rounded-full border border-line bg-canvas py-2 text-sm text-ink sm:hidden"
            aria-expanded={open}
          >
            {open ? "Hide controls ▴" : "Show controls ▾"}
          </button>
        </div>

        {/* Own panel: desktop 340 px aside; phone behind "Show controls" */}
        <aside
          className={`${open ? "flex" : "hidden"} relative z-20 w-full flex-col sm:absolute sm:inset-y-0 sm:right-0 sm:flex sm:w-[min(340px,38vw)] sm:max-w-md sm:overflow-hidden`}
          aria-label="Adaptive Panel controls"
        >
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-l from-[#0d0d0d]/95 via-[#0d0d0d]/75 to-transparent sm:block" />
          <div className="relative flex flex-col gap-3 px-5 py-6 sm:h-full sm:overflow-y-auto sm:pt-24 md:px-6">
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((l, i) => (
                <TagPill key={l} label={l} active={i === day} onClick={() => change("day", i)} />
              ))}
            </div>

            <div>
              <h2 className={`${heading} mb-2`}>Gain through glass · W/m²</h2>
              <GainChart rows={rows} cap={cap} hour={hour} focus={focus} />
            </div>

            <div>
              <h2 className={`${heading} mb-2`}>Day totals · {DAY_LABELS[day]}</h2>
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-[10px] text-muted">
                    <th className="text-left font-normal" />
                    <th className={`pb-1 text-right font-normal ${focus === "static" ? "text-ink underline underline-offset-4" : ""}`}>static</th>
                    <th className={`pb-1 text-right font-normal ${focus === "kinetic" ? "text-ink underline underline-offset-4" : ""}`}>kinetic</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map(([k, s, kv]) => (
                    <tr key={k}>
                      <td className="py-0.5 text-muted">{k}</td>
                      <td className={`py-0.5 text-right ${focus === "static" ? "bg-pill pr-1 font-bold text-ink" : "text-muted"}`} data-col="static">{s}</td>
                      <td className={`py-0.5 text-right ${focus === "static" ? "text-muted" : "font-bold text-ink"} ${focus === "kinetic" ? "bg-pill pr-1" : ""}`} data-col="kinetic">{kv}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Totals include diffuse-only shoulder hours outside 07:30 to 16:30; chart and scrubber span 07:30 to 16:30 only.
              </p>
            </div>

            <Slider def={capDef} value={cap} onChange={change} />
            <Slider def={depthDef} value={staticDepth} onChange={change} />
            <p className="text-[11px] text-muted">Gate: profile angle 45° (fixed).</p>

            <p className="text-[11px] leading-relaxed text-muted sm:hidden">{handCheck}</p>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  addVariation(meta.slug, meta.name, params);
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1600);
                }}
                className="text-ink underline underline-offset-4 transition-colors hover:text-accent"
              >
                {saved ? "Saved" : "Save variation"}
              </button>
              <button
                type="button"
                onClick={() => meta.staticParams.forEach((d) => change(d.key, d.default))}
                className="text-muted underline underline-offset-4 transition-colors hover:text-accent"
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Footnote below the scene (SolarFootnote style) */}
      <div className="max-w-3xl px-5 pt-4 text-[11px] leading-relaxed text-muted md:px-8">
        <p className="hidden sm:block">{handCheck}</p>
        <p className="hidden sm:block">
          The value is seasonal, not hourly: kinetic wins on glare and shoulder/winter gain; June heat is a wash.
        </p>
        <p>
          * Concept estimate, not compliance. Clear sky, single cell, south, 52° N, no HVAC or lighting energy, no annual run.
          Sky view is a relative index, not lux. More solar gain helps only in the heating season.
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer underline underline-offset-4 transition-colors hover:text-accent">Assumptions and limits</summary>
          <p className="mt-2">
            Control rule per hour: if the beam misses the glass or the profile angle is under 45°, the blade stays open; else the
            smallest depth (0 to 0.6 m in 0.1 m steps) that keeps gain at or under the cap, else 0.6 m. Hourly midpoints, solar
            time, g-value 0.6, one 1.5 m cell, head blade only. Glare and sky view over 09:30 to 16:30.
          </p>
          <p>
            Not modelled: real weather, ground reflection, inter-reflection, frame, thermal mass, HVAC and lighting energy,
            actuator energy and wear cost, annual run.
          </p>
        </details>
      </div>
    </div>
  );
}
