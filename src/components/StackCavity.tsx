"use client";

/**
 * Stack-Effect Cavity view (slug-gated in PatternDetail, P-0019): SVG section of a ventilated
 * double-skin cavity with rising particles (speed ∝ Q / (W·depth)), KPI card, live hand-check,
 * opening-area sweep and a limits label. Sliders live in the PatternDetail controls panel.
 * Concept estimate, not compliance.
 */

import { ReactNode, useEffect, useMemo, useRef } from "react";
import { PatternParams } from "@/lib/patterns";
import { defaults } from "@/lib/patterns/stack-cavity";
import { DEFAULT_PARAMS, F_BLIND, G, halvingLoss, solve, sweep } from "@/lib/patterns/stack-cavity/engine";

const MUTED = "#8a8a8a";
const N = 36; // particles
const PX_PER_MS = 70; // particle px/s per 1 m/s of cavity velocity
const X0 = 110, X1 = 270, Y0 = 70, Y1 = 570; // cavity rectangle in the 380 x 660 section
const LABEL = "Concept estimate, not compliance. No wind, single mean temperature (outlet rise used as the buoyancy ΔT, so Q is upper-end), no inter-skin radiation. Cd 0.6 assumed for full-section vents.";

const f = (v: number, n = 2) => v.toFixed(n);
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",");

// Same pseudo-random layout on server and client.
const SEEDS = Array.from({ length: N }, (_, i) => {
  const r = (k: number) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };
  return { x: X0 + 10 + r(1) * (X1 - X0 - 20), phase: r(2), factor: 0.65 + r(3) * 0.7, size: 1.6 + r(4) * 2 };
});

function Card({ title, children, ...rest }: { title: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <div className="min-w-0 rounded-[10px] border border-line px-4 py-3" {...rest}>
      <div className="mb-2 text-[11px] text-muted sm:text-xs">{title}</div>
      {children}
    </div>
  );
}

export default function StackCavity({ params }: { params: PatternParams }) {
  const p = { ...defaults, ...params };
  const cp = useMemo(
    () => ({ ...DEFAULT_PARAMS, H: p.H, W: p.W, depth: p.depth, opening: p.opening, gain: p.gain, tOut: p.tOut, blind: Math.round(p.blind) === 1 }),
    [p.H, p.W, p.depth, p.opening, p.gain, p.tOut, p.blind],
  );
  const res = useMemo(() => solve(cp), [cp]);
  const rows = useMemo(() => sweep(cp), [cp]);
  const loss = useMemo(() => halvingLoss(cp), [cp]);
  const noFlow = res.flag !== null;
  const section = cp.W * cp.depth;
  const T = cp.tOut + 273.15;
  const winter = cp.tOut <= 10;

  // Height insight: both ways, each says what is held fixed.
  const dbl = useMemo(() => {
    const fixedG = solve({ ...cp, H: cp.H * 2 });
    const fixedP = solve({ ...cp, H: cp.H * 2, gain: cp.gain / 2 });
    return { g: res.Q > 0 ? fixedG.Q / res.Q : 0, p: res.Q > 0 ? fixedP.Q / res.Q : 0 };
  }, [cp, res.Q]);

  // Particles: rAF writes transforms directly (no React render per frame); speed read from a ref so
  // slider moves change speed live without restarting the loop.
  const speedRef = useRef(0);
  speedRef.current = noFlow ? 0 : res.vCavity * PX_PER_MS;
  const dots = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const off = SEEDS.map((s) => s.phase * (Y1 - Y0));
    const draw = () => SEEDS.forEach((_, i) => dots.current[i]?.setAttribute("transform", `translate(0 ${(Y1 - 8 - (off[i] % (Y1 - Y0 - 16))).toFixed(1)})`));
    draw();
    if (mq.matches) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const v = speedRef.current;
      if (v > 0) {
        SEEDS.forEach((s, i) => { off[i] += v * s.factor * dt; });
        draw();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hot = Math.min(1, res.dT / 12);
  const top = mix([70, 60, 56], [140, 66, 28], hot);
  const outlet = cp.tOut + res.dT;
  const maxAch = Math.max(1, ...rows.map((r) => r.res.ach));

  return (
    <div className="px-4 pb-24 pt-[104px] sm:pb-8 md:pl-12" data-stack-cavity>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <svg viewBox="0 0 380 660" width={380} height={660} className="block h-auto w-full shrink-0" style={{ maxWidth: 380 }} role="img"
          aria-label={noFlow ? "Cavity section: no flow" : `Cavity section: ${f(res.ach, 0)} air changes per hour`} fontFamily="inherit">
          <defs>
            <linearGradient id="sc-cav" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="rgb(27,58,87)" />
              <stop offset="1" stopColor={`rgb(${top})`} />
            </linearGradient>
          </defs>
          <text x={4} y={30} fontSize={13} fill="#e8e8e8">H = {cp.H} m</text>
          <line x1={22} y1={Y0} x2={22} y2={Y1} stroke={MUTED} strokeWidth={1} />
          <path d={`M17 ${Y0 + 8} L22 ${Y0} L27 ${Y0 + 8} M17 ${Y1 - 8} L22 ${Y1} L27 ${Y1 - 8}`} stroke={MUTED} fill="none" />
          <rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} fill="url(#sc-cav)" />
          <rect x={X0 - 10} y={Y0} width={10} height={Y1 - Y0} fill="none" stroke={MUTED} />
          <rect x={X1} y={Y0} width={10} height={Y1 - Y0} fill="none" stroke={MUTED} />
          <text transform={`translate(${X0 - 18} ${(Y0 + Y1) / 2}) rotate(-90)`} fontSize={12} fill={MUTED} textAnchor="middle">inner skin (room)</text>
          <text transform={`translate(${X1 + 24} ${(Y0 + Y1) / 2}) rotate(90)`} fontSize={12} fill={MUTED} textAnchor="middle">outer skin (glazed)</text>
          {cp.blind && <g><rect x={(X0 + X1) / 2 - 2} y={Y0 + 100} width={4} height={90} fill={MUTED} /><text x={(X0 + X1) / 2 + 8} y={Y0 + 150} fontSize={12} fill={MUTED}>blind</text></g>}
          <g data-particles opacity={noFlow ? 0 : 1}>
            {SEEDS.map((s, i) => (
              <g key={i} ref={(el) => { dots.current[i] = el; }}>
                <line x1={s.x} x2={s.x} y1={0} y2={14} stroke="#e8e8e8" strokeOpacity={0.35} />
                <circle cx={s.x} cy={0} r={s.size} fill="#f2f2f2" />
              </g>
            ))}
          </g>
          <g stroke={noFlow ? "#555" : MUTED} fill={noFlow ? "#555" : MUTED}>
            <path d={`M190 ${Y0 - 8} L190 ${Y0 - 40} M180 ${Y0 - 28} L190 ${Y0 - 40} L200 ${Y0 - 28}`} fill="none" strokeWidth={2} />
            <path d={`M190 ${Y1 + 50} L190 ${Y1 + 18} M180 ${Y1 + 30} L190 ${Y1 + 18} L200 ${Y1 + 30}`} fill="none" strokeWidth={2} />
          </g>
          <text x={376} y={Y0 - 14} textAnchor="end" fontSize={13} fill={noFlow ? MUTED : "#d98a5a"}>{noFlow ? "no flow" : `outlet ${f(outlet, 1)} °C`}</text>
          <text x={4} y={Y1 + 66} fontSize={12} fill={MUTED}>{`inlet A = ${f(res.A, 1)} m², air ${f(cp.tOut, 1)} °C`}</text>
          <text x={4} y={Y1 + 86} fontSize={12} fill={MUTED}>{winter ? "Winter preheat: inlet = outdoor air" : "Summer vent: inlet = outdoor air"}</text>
        </svg>

        <div className="flex min-w-0 max-w-[620px] flex-1 flex-col gap-4">
          <Card title="KPI (live, updates with sliders)" data-kpi>
            {noFlow ? (
              <div className="text-sm text-ink" data-noflow>
                No flow: {res.flag === "no-gain" ? "no solar gain, so no buoyancy" : "vents closed"}. Values shown as dashes; particles stopped.
              </div>
            ) : null}
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 tabular-nums">
              <dt className="text-3xl font-bold text-ink sm:text-4xl">{noFlow ? "—" : `${f(res.ach, 0)} ACH`}</dt>
              <dd className="text-xs text-muted">cavity air change rate</dd>
              <dt className="text-xl text-ink">{noFlow ? "—" : `${f(res.Q)} m³/s`}</dt>
              <dd className="text-xs text-muted">buoyancy flow Q</dd>
              <dt className="text-xl text-ink">{noFlow ? "—" : `+${f(res.dT)} K`}</dt>
              <dd className="text-xs text-muted">outlet minus outdoor air</dd>
              <dt className="text-xl text-ink">{noFlow ? "—" : `${f(res.vCavity)} m/s`}</dt>
              <dd className="text-xs text-muted">mean cavity velocity (vent {noFlow ? "—" : f(res.vVent)} m/s)</dd>
            </dl>
            <div className="mt-2 text-[11px] text-muted">Particle speed = Q / (W × depth). {winter ? "Winter preheat" : "Summer vent"} at Tout {cp.tOut} °C; for winter preheat start at 0 °C.</div>
          </Card>

          <Card title="Hand-check (recomputed from the sliders)" data-handcheck>
            <div className="space-y-1 font-mono text-[11px] leading-relaxed text-ink sm:text-xs">
              <div>Q = Cd × A × √(g·H·ΔT/T) (equal in/out vents). A = {f(cp.opening, 0)} % × {f(section, 1)} m² = {f(res.A, 1)} m², Cd {cp.cd}, T = {f(T, 1)} K</div>
              <div>P = {f(cp.gain / (cp.blind ? 1 : F_BLIND), 0)} W/m² × {f(cp.W * cp.H, 0)} m² = {f(res.P / 1000, 1)} kW{cp.blind ? "" : ` (blind off: ${cp.gain} / f_blind ${F_BLIND}, assumed)`}</div>
              <div>Q^1.5 = Cd·A·√(g·H/T)·√(P/1200) = {f(cp.cd * res.A * Math.sqrt((G * cp.H) / T) * Math.sqrt(res.P / 1200))} ⇒ Q = {noFlow ? "0" : f(res.Q)} m³/s</div>
              <div>ΔT = P / (ρ·cp·Q) = {noFlow ? "—" : `${f(res.P / 1000, 1)} kW / (1200 × ${f(res.Q)}) = +${f(res.dT)} K`}</div>
              <div>ACH = Q × 3600 / ({f(cp.W, 1)} × {f(cp.depth, 1)} × {cp.H} = {f(res.volume, 1)} m³) = {noFlow ? "—" : f(res.ach, 0)}</div>
              <div className="pt-1 font-sans text-muted">
                Doubling H to {cp.H * 2} m: Q × {f(dbl.g)} at fixed W/m² (total power doubles); Q × {f(dbl.p)} at fixed total power (W/m² halves).
              </div>
            </div>
          </Card>

          <Card title="Opening-area sweep (same solar gain): Q scales as A^(2/3), not A" data-sweep>
            <div className="space-y-2 text-xs tabular-nums">
              {rows.map((r) => (
                <div key={r.opening} className="grid grid-cols-[88px_1fr_96px] items-center gap-2 sm:grid-cols-[110px_1fr_130px]" data-sweep-row={r.opening}>
                  <span className="text-muted">A {r.opening}% ({f(r.res.A, 1)} m²)</span>
                  <span className="h-3 bg-[#969696]" style={{ width: `${Math.round((r.res.ach / maxAch) * 100)}%` }} />
                  <span className="text-ink">{r.res.flag ? "no flow" : `${f(r.res.ach, 0)} ACH +${f(r.res.dT)} K`}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-muted" data-verdict>
              {noFlow ? "Verdict: no flow at this setting." : `Verdict: halving the vents loses ${f(loss, 0)}% of the flow, not 50%.`}
            </div>
          </Card>

          <p className="text-[11px] leading-relaxed text-muted" data-limits>{LABEL}</p>
        </div>
      </div>
    </div>
  );
}
