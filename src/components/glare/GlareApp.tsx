"use client";

import { useCallback, useMemo, useState } from "react";
import Slider from "@/components/Slider";
import TagPill from "@/components/TagPill";
import { PatternParamDef } from "@/lib/patterns";
import {
  DEFAULT_INPUT, FLAG_X, PLAN, SEASONS, ZONES, analyse, facadePoint, type GlareInput, type HourResult, type Shape,
} from "@/lib/glare/engine";

const RED = "#e5484d";
const BLUE = "#7fb4ff";
const AMBER = "#f5a524";

const def = (key: string, label: string, min: number, max: number, step: number, dflt: number, unit: string): PatternParamDef => ({
  key, label, min, max, step, default: dflt, unit,
});
const TILT_DEF = def("gl-tilt", "Tilt back from vertical", 0, 30, 1, 10, "°");
const RHO_DEF = def("gl-rho", "Glass reflectance (assumed)", 0.05, 0.6, 0.01, 0.2, "");
const H_DEF = def("gl-h", "Facade height", 10, 100, 1, 40, "m");

const x1 = (v: number) => `${v.toFixed(1)}x`;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const rampColour = (v: number) => (v > FLAG_X ? RED : v >= 1 ? AMBER : BLUE);
const rampOpacity = (v: number) => (v > FLAG_X ? 0.85 : v >= 1 ? 0.65 : Math.min(0.7, 0.2 + 0.5 * v));

// width of the map in px, so text in the SVG keeps a readable size
function useWidth(): [(el: HTMLElement | null) => void, number] {
  const [w, setW] = useState(620);
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    setW(el.clientWidth || 620);
    new ResizeObserver(() => setW(el.clientWidth || 620)).observe(el);
  }, []);
  return [ref, w];
}

export default function GlareApp() {
  const [shape, setShape] = useState<Shape>("flat");
  const [tilt, setTilt] = useState(DEFAULT_INPUT.tilt);
  const [rho, setRho] = useState(DEFAULT_INPUT.rho);
  const [height, setHeight] = useState(DEFAULT_INPUT.height);
  const [day, setDay] = useState(244);
  const [stacked, setStacked] = useState(false);
  const [hour, setHour] = useState(12);

  const input: GlareInput = { ...DEFAULT_INPUT, shape, tilt, rho, height, day };
  const result = useMemo(
    () => analyse(input),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, tilt, rho, height, day]
  );
  const sel = result.hours.find((h) => h.hour === hour) ?? result.hours[Math.floor(result.hours.length / 2)];
  const flagged = result.hours.filter((h) => h.flag).map((h) => hh(h.hour));

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10">
      <div className="mb-6 max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Glare map</h1>
        <p className="mt-2 text-sm text-muted">
          Where a tilted or curved glass facade throws the reflected sun onto the ground, hour by hour. Approximate:
          concept screening, not a BRE or planning glare study.
        </p>
        <p className="mt-2 text-xs text-muted">
          Limits: direct sun, clear sky, solar time (no daylight saving), no cloud, no blocking, ground receivers only.
          Values are relative to direct sun on level ground, not W/m². All distances are measured from the facade foot.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <TagPill label="Approximate" />
          <span title="invented street and neighbour footprints, no real site">
            <TagPill label="Sample site, invented" />
          </span>
          <span title="latitude 51.5, solar time">
            <TagPill label="London-like, lat 51.5" />
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <section className="min-w-0 space-y-4" aria-label="Map">
          <SitePlan result={result} input={input} sel={sel} stacked={stacked} onPick={setHour} />

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-tag text-muted">Hour (solar time)</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hour">
              {result.hours.map((h) => (
                <button
                  key={h.hour}
                  type="button"
                  aria-pressed={!stacked && h.hour === sel.hour}
                  onClick={() => { setHour(h.hour); setStacked(false); }}
                  className={[
                    "h-9 min-w-9 rounded-full border px-2 text-xs tabular-nums transition-colors",
                    !stacked && h.hour === sel.hour ? "border-ink bg-pill text-ink" : "border-line bg-pill text-muted hover:border-ink hover:text-accent",
                  ].join(" ")}
                >
                  {h.hour}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <TagPill key={s.id} label={s.label} active={s.n === day} onClick={() => setDay(s.n)} />
            ))}
            <TagPill label="All hours (stacked)" active={stacked} onClick={() => setStacked((v) => !v)} />
          </div>
        </section>

        <section className="min-w-0 space-y-6" aria-label="Facade and results">
          <div className="space-y-4">
            <p className="text-[11px] uppercase tracking-tag text-muted">Facade</p>
            <div className="flex flex-wrap gap-2">
              <TagPill label="Flat, tilted" active={shape === "flat"} onClick={() => setShape("flat")} />
              <TagPill label="Curved, R 60 m" active={shape === "cylinder"} onClick={() => setShape("cylinder")} />
            </div>
            <fieldset disabled={shape === "cylinder"} className={shape === "cylinder" ? "opacity-40" : ""}>
              <Slider def={TILT_DEF} value={tilt} onChange={(_, v) => setTilt(v)} />
            </fieldset>
            {shape === "cylinder" && (
              <p className="text-[11px] text-muted">Curved shape has a vertical axis: tilt does not apply.</p>
            )}
            <Slider def={RHO_DEF} value={rho} onChange={(_, v) => setRho(v)} />
            <Slider def={H_DEF} value={height} onChange={(_, v) => setHeight(v)} />
            <p className="text-[11px] text-muted">Facade width 60 m. Reflectance is assumed, not a product datasheet.</p>
          </div>

          <Results result={result} sel={sel} stacked={stacked} shape={shape} rho={rho} flagged={flagged} />
          <Section input={input} sel={sel} />
        </section>
      </div>

      <p className="mt-10 max-w-3xl text-xs leading-body text-muted">
        Approximate, geometric optics only: specular reflection, constant reflectance (assumed), no angle dependence,
        no cloud or diffuse light, no second reflection (rays that would re-hit curved glass are dropped, not traced).
        Point sun, so curved-glass peaks depend on the 3 m cell and the sample count (about ±5%). Sun position is the
        site&apos;s own formula, about 1° from NOAA on 1 Sep (not verified), so spots can shift a few metres; NOAA solar
        equations and the BRE solar dazzle method are named as references still to verify. Neighbours are labelled
        footprints: no blocking, no wall or roof hits. A low value does not mean no risk: dazzle toward a viewer is not
        assessed. Near 3x the flag can flip with sample count; treat 2.5x and above as hot.
      </p>
    </main>
  );
}

function SitePlan({
  result, input, sel, stacked, onPick,
}: {
  result: ReturnType<typeof analyse>;
  input: GlareInput;
  sel: HourResult;
  stacked: boolean;
  onPick: (h: number) => void;
}) {
  const [ref, w] = useWidth();
  const k = w / 200; // px per metre
  const f = (px: number) => px / k; // font px -> svg units
  const g = result.grid;
  const cells = stacked ? result.stacked : sel.cells;
  const rects: JSX.Element[] = [];
  for (let j = 0; j < g.ny; j++)
    for (let i = 0; i < g.nx; i++) {
      const v = cells[j * g.nx + i];
      if (v < 0.01) continue;
      const cx0 = Math.max(g.x0 + i * g.cell, PLAN.x0), cx1 = Math.min(g.x0 + (i + 1) * g.cell, PLAN.x1);
      const cy0 = g.y0 + j * g.cell, cy1 = Math.min(cy0 + g.cell, PLAN.y1);
      rects.push(
        <rect key={`${i}-${j}`} x={cx0} y={-cy1} width={cx1 - cx0} height={cy1 - cy0} fill={rampColour(v)} fillOpacity={rampOpacity(v)} />
      );
    }
  const apex = facadePoint(input, 0, input.height).p; // top-centre point
  const arc =
    input.shape === "cylinder"
      ? Array.from({ length: 31 }, (_, i) => facadePoint(input, -30 + 2 * i, 0).p)
          .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${(-p[1]).toFixed(2)}`)
          .join(" ")
      : "";
  const depth = input.shape === "flat" ? input.height * Math.tan((input.tilt * Math.PI) / 180) : 0;
  const onPlan = (h: HourResult) => h.spot && !h.spot.offPlan;
  const grid = [-75, -50, -25, 0, 25, 50, 75];

  return (
    <div ref={ref} className="w-full">
      <p className="mb-2 text-[11px] uppercase tracking-tag text-muted">
        Site plan, north up. {stacked ? "Highest value in each cell over all hours" : `Reflected sun at ${hh(sel.hour)}`}
      </p>
      <svg
        viewBox={`${PLAN.x0} ${-PLAN.y1} 200 ${PLAN.y1 - PLAN.y0}`}
        className="block w-full border border-line bg-canvas"
        role="img"
        aria-label={`Site plan with reflected sun spots, ${stacked ? "all hours stacked" : hh(sel.hour)}`}
      >
        <g stroke="#1c1c1c" strokeWidth={f(1)}>
          {grid.map((v) => <line key={`x${v}`} x1={v} x2={v} y1={-PLAN.y1} y2={-PLAN.y0} />)}
          {[-100, -75, -50, -25, 0].map((v) => <line key={`y${v}`} x1={PLAN.x0} x2={PLAN.x1} y1={-v} y2={-v} />)}
        </g>
        {ZONES.map((z) => (
          <g key={z.id}>
            <rect x={z.x0} y={-z.y1} width={z.x1 - z.x0} height={z.y1 - z.y0} fill={z.id === "street" ? "#1c1c1c" : "#2a2a2a"} stroke="#3a3a3a" strokeWidth={f(1)} />
            <text x={z.x0 + 2} y={-z.y1 + f(12)} fontSize={f(10)} fill="#8a8a8a">{z.label.toUpperCase()} (sample)</text>
          </g>
        ))}
        {rects}
        {input.shape === "flat" ? (
          <rect x={-30} y={-depth} width={60} height={Math.max(depth, 0.6)} fill="#333" stroke="#e8e8e8" strokeWidth={f(1.5)} />
        ) : (
          <path d={arc} fill="none" stroke="#e8e8e8" strokeWidth={f(3)} />
        )}
        <text x={0} y={f(26)} fontSize={f(10)} fill="#8a8a8a" textAnchor="middle">foot (distances measured from here)</text>
        {!stacked &&
          result.hours.map((h) =>
            onPlan(h) ? (
              <g key={h.hour} onClick={() => onPick(h.hour)} style={{ cursor: "pointer" }}>
                <line x1={apex[0]} y1={-apex[1]} x2={h.spot!.e} y2={-h.spot!.n} stroke={AMBER} strokeOpacity={h.hour === sel.hour ? 0.8 : 0.3} strokeWidth={f(1)} strokeDasharray={`${f(4)} ${f(3)}`} />
                <circle cx={h.spot!.e} cy={-h.spot!.n} r={f(h.hour === sel.hour ? 6 : 4)} fill={rampColour(h.peak.erel)} stroke="#e8e8e8" strokeWidth={h.hour === sel.hour ? f(1.5) : 0} />
                {h.hour === sel.hour && (
                  <text x={h.spot!.e} y={-h.spot!.n + f(20)} fontSize={f(11)} fill="#e8e8e8" textAnchor="middle" fontWeight="bold">{hh(h.hour)}</text>
                )}
              </g>
            ) : null
          )}
        <text x={PLAN.x1 - 4} y={-PLAN.y1 + f(14)} fontSize={f(12)} fill="#8a8a8a" textAnchor="end">N ↑</text>
        <line x1={PLAN.x0 + 5} x2={PLAN.x0 + 30} y1={-PLAN.y0 - 6} y2={-PLAN.y0 - 6} stroke="#8a8a8a" strokeWidth={f(1.5)} />
        <text x={PLAN.x0 + 5} y={-PLAN.y0 - 9} fontSize={f(10)} fill="#8a8a8a">25 m</text>
        <text x={PLAN.x1 - 3} y={-PLAN.y0 - 4} fontSize={f(10)} fill="#8a8a8a" textAnchor="end">grid 25 m</text>
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-6" style={{ background: BLUE, opacity: 0.6 }} />under 1x</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-6" style={{ background: AMBER, opacity: 0.7 }} />1 to 3x</span>
        <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-6" style={{ background: RED, opacity: 0.85 }} />over 3x direct sun on that ground</span>
      </div>
    </div>
  );
}

function Results({
  result, sel, stacked, shape, rho, flagged,
}: {
  result: ReturnType<typeof analyse>;
  sel: HourResult;
  stacked: boolean;
  shape: Shape;
  rho: number;
  flagged: string[];
}) {
  const s = sel.spot;
  const nothing = !s && sel.peak.erel === 0;
  const vdist = sel.vertical ? Math.round(Math.hypot(sel.vertical.e, sel.vertical.n)) : null;
  return (
    <div className="space-y-2 rounded border border-line bg-pill p-3 text-sm text-ink" aria-live="polite">
      <p className="text-[11px] uppercase tracking-tag text-muted">Result</p>
      {stacked ? (
        <p>
          Highest cell over all hours: <strong>{x1(result.peak.erel)}</strong> direct sun
          {result.peak.hour !== null && <> at {hh(result.peak.hour)}</>}. Per-cell maximum, never a sum.
        </p>
      ) : nothing ? (
        <p>No reflection reaches the ground at {hh(sel.hour)}: the beam goes skyward or the glass is not lit.</p>
      ) : (
        <>
          {s && (
            <p>
              {hh(sel.hour)} lands <strong>{Math.round(s.dist)} m</strong> from the facade foot
              {s.offPlan ? <> (off the plan)</> : <>, {s.zone.label.toLowerCase()}</>}.
            </p>
          )}
          <p>
            Peak at {hh(sel.hour)}: <strong>{x1(sel.peak.erel)}</strong> direct sun on level ground.
          </p>
        </>
      )}
      {!stacked && !nothing && sel.offPlanShare > 0.1 && (
        <p className="text-muted">
          {s?.offPlan ? `Lands off the plan, ${Math.round(s.dist)} m from the foot. ` : ""}
          {Math.round(sel.offPlanShare * 100)}% of the reflected sun lands off this plan.
        </p>
      )}
      {!stacked && !nothing && sel.vertical === null && (
        <p className="text-muted">Flat vertical glass (same sun): no reflection reaches the ground.</p>
      )}
      {!stacked && vdist !== null && (
        <p className="text-muted">Flat vertical glass (same sun): lands {vdist} m out.</p>
      )}
      {shape === "flat" ? (
        <p className="text-muted">
          Flat glass does not concentrate sun: reflected sun is about {rho.toFixed(2)} × direct sun at most.
        </p>
      ) : (
        <>
          <p className="text-muted">
            Curved glass can concentrate sun: the focus is about 25 to 30 m out in front of the curve, not a point. Peak
            depends on the 3 m cell and sample count (about ±5%).
          </p>
          {!stacked && sel.droppedCount > 0 && (
            <p className="text-muted">
              Second reflection, not modelled: {Math.round(sel.droppedShare * 100)}% of lit rays at {hh(sel.hour)} are
              dropped.
            </p>
          )}
        </>
      )}
      {result.flag && (
        <p className="rounded border px-2 py-1.5" style={{ borderColor: RED, color: RED }} role="alert">
          Hot spot above {FLAG_X}x direct sun on this plan ({flagged.join(", ")}): ask a specialist.
        </p>
      )}
    </div>
  );
}

// N-S section at the selected hour, one scale for both axes.
function Section({ input, sel }: { input: GlareInput; sel: HourResult }) {
  const W = 300, Hh = 150, base = 125, left = 22;
  const s = sel.spot;
  const top = facadePoint(input, 0, input.height).p; // [x, n north, z]
  const topSouth = -top[1];
  const nSouth = (input.shape === "flat" ? input.height * Math.sin((input.tilt * Math.PI) / 180) : 0) + 5;
  const reach = Math.max(s ? -s.n : 0, input.height * 0.8) + 8;
  const sc = Math.min((W - left - 6) / (reach + nSouth), (base - 12) / input.height);
  const X = (south: number) => left + (south + nSouth) * sc;
  const Y = (z: number) => base - z * sc;
  const alt = (sel.altitude * Math.PI) / 180;
  // sun comes from the south when its azimuth is south; draw in N-S plane using altitude only
  const sunLen = 28;
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-tag text-muted">
        Section north-south, {hh(sel.hour)} (sun {Math.round(sel.altitude)}° up)
      </p>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="block w-full border border-line bg-canvas" role="img" aria-label="Section view of the sun, facade and reflected ray">
        <line x1={0} x2={W} y1={base} y2={base} stroke="#8a8a8a" />
        <line x1={X(0)} y1={Y(0)} x2={X(topSouth)} y2={Y(input.height)} stroke="#e8e8e8" strokeWidth={input.shape === "flat" ? 3 : 1.5} strokeDasharray={input.shape === "flat" ? undefined : "3 3"} />
        <line x1={X(topSouth)} y1={Y(input.height)} x2={X(topSouth) + Math.cos(alt) * sunLen} y2={Y(input.height) - Math.sin(alt) * sunLen} stroke={AMBER} strokeWidth="1.5" />
        {s && (
          <>
            <line x1={X(topSouth)} y1={Y(input.height)} x2={X(-s.n)} y2={Y(0)} stroke={AMBER} strokeWidth="1.5" strokeDasharray="5 3" />
            <circle cx={X(-s.n)} cy={Y(0)} r="4" fill={rampColour(sel.peak.erel)} />
          </>
        )}
        <text x={X(0)} y={base + 12} fontSize="9" fill="#8a8a8a" textAnchor="middle">foot</text>
        <text x={W - 4} y="12" fontSize="9" fill="#8a8a8a" textAnchor="end">south →</text>
        {s && <text x={Math.min(X(-s.n), W - 4)} y={base + 12} fontSize="9" fill="#8a8a8a" textAnchor={X(-s.n) > W - 60 ? "end" : "middle"}>{s.offPlan ? "off the plan, " : ""}{Math.round(s.dist)} m</text>}
      </svg>
      <p className="mt-1 text-[11px] text-muted">
        Reflected ray from the top-centre point of the facade, one scale for height and distance (east-west drift not shown).
      </p>
    </div>
  );
}
