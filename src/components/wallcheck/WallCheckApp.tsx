"use client";

import { useMemo, useState } from "react";
import Slider from "@/components/Slider";
import TagPill from "@/components/TagPill";
import { PatternParamDef } from "@/lib/patterns";
import { DEFAULT_WALL, LONDON_LIKE, Layer, analyse } from "@/lib/wallcheck/engine";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MAX_LAYERS = 5;

// Illustrative round numbers, not a product datasheet.
const PRESETS: { name: string; d: number; lambda: number; mu: number }[] = [
  { name: "Plasterboard", d: 12.5, lambda: 0.21, mu: 8 },
  { name: "Mineral wool", d: 100, lambda: 0.035, mu: 1 },
  { name: "Brick", d: 102, lambda: 0.77, mu: 10 },
  { name: "Concrete", d: 150, lambda: 1.8, mu: 80 },
  { name: "Timber board", d: 18, lambda: 0.13, mu: 50 },
  { name: "Vapour control layer (sd 10 m)", d: 0.2, lambda: 0.4, mu: 50000 },
];

type Row = { id: number; name: string; d: string; lambda: string; mu: string };

const rowFrom = (id: number, p: (typeof PRESETS)[number]): Row => ({
  id,
  name: p.name,
  d: String(p.d),
  lambda: String(p.lambda),
  mu: String(p.mu),
});

const num = (s: string) => {
  const v = Number(s);
  return s.trim() !== "" && Number.isFinite(v) ? v : NaN;
};
const rowValid = (r: Row) => num(r.d) > 0 && num(r.lambda) > 0 && num(r.mu) > 0;
const toLayer = (r: Row): Layer => ({ name: r.name, d: num(r.d) / 1000, lambda: num(r.lambda), mu: num(r.mu) });

const pa = (v: number) => String(Math.round(v));
const kg = (v: number) => v.toFixed(2);
const deg = (v: number) => v.toFixed(1);

const def = (key: string, label: string, min: number, max: number, step: number, dflt: number, unit: string): PatternParamDef => ({
  key,
  label,
  min,
  max,
  step,
  default: dflt,
  unit,
});
const THETA_DEF = def("wc-thetaI", "Inside temperature", 15, 26, 0.5, 20, "°C");
const RH_DEF = def("wc-rhI", "Inside humidity", 30, 80, 1, 55, "% RH");

const RED = "#e5484d";
const BLUE = "#7fb4ff";
const AMBER = "#f5a524";
const GREEN = "#2f9e6a";
const FILLS = ["#2a2a2a", "#1c1c1c", "#333", "#262626", "#303030"];

const input =
  "w-full rounded border border-line bg-pill px-2 py-1.5 text-sm text-ink tabular-nums focus:border-ink focus:outline-none";

export default function WallCheckApp() {
  const [rows, setRows] = useState<Row[]>(() =>
    DEFAULT_WALL.layers.map((l, i) => ({
      id: i,
      name: l.name ?? "Layer",
      d: String(Math.round((l.d * 1000) * 10) / 10),
      lambda: String(l.lambda),
      mu: String(l.mu),
    }))
  );
  const [nextId, setNextId] = useState(DEFAULT_WALL.layers.length);
  const [thetaI, setThetaI] = useState(20);
  const [rhI, setRhI] = useState(55);
  const [month, setMonth] = useState(0);

  const valid = rows.filter(rowValid);
  const layers = valid.map(toLayer);

  const result = useMemo(
    () =>
      layers.length
        ? analyse({ layers, thetaI, rhI: rhI / 100, rsi: DEFAULT_WALL.rsi, rse: DEFAULT_WALL.rse, climate: LONDON_LIKE })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(layers), thetaI, rhI]
  );

  const update = (id: number, key: keyof Row, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const c = [...rs];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const add = (idx: number) => {
    setRows((rs) => [...rs, rowFrom(nextId, PRESETS[idx])]);
    setNextId((n) => n + 1);
  };

  // interface labels: 0 = inner surface, n = outer surface (n = valid layers)
  const names = valid.map((r) => r.name || "Layer");
  const label = (k: number) =>
    k === 0 ? "Inner surface" : k === names.length ? "Outer surface" : `${names[k - 1]} / ${names[k]}`;

  const flaggedAny = result ? result.interfaces.some((i) => i.flaggedMonths > 0) : false;

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10">
      <div className="mb-6 max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Wall check</h1>
        <p className="mt-2 text-sm text-muted">
          Dew-point screening of a wall build-up, approximate, after EN ISO 13788. Concept screening, not compliance.
        </p>
        <p className="mt-2 text-xs text-muted">
          Limits: steady-state, diffusion only, no drying. Each interface is computed alone, not combined; kg/m2 is never
          summed across interfaces.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span title="illustrative values, not from a weather file">
            <TagPill label="Climate: London-like, illustrative" />
          </span>
          <span title="illustrative round numbers, not a product datasheet">
            <TagPill label="Materials: sample values" />
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-6" aria-label="Inputs">
          <div className="space-y-4">
            <Slider def={THETA_DEF} value={thetaI} onChange={(_, v) => setThetaI(v)} />
            <Slider def={RH_DEF} value={rhI} onChange={(_, v) => setRhI(v)} />
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-tag text-muted">Layers, inside to outside</p>
            <ul className="space-y-3">
              {rows.map((r, i) => {
                const ok = rowValid(r);
                const sd = (num(r.d) / 1000) * num(r.mu);
                return (
                  <li key={r.id} className="rounded border border-line bg-pill p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <input
                        aria-label={`Layer ${i + 1} name`}
                        className={`${input} font-medium`}
                        value={r.name}
                        onChange={(e) => update(r.id, "name", e.target.value)}
                      />
                      <div className="flex shrink-0 gap-1">
                        <button type="button" aria-label="Move towards inside" onClick={() => move(i, -1)} className="h-8 w-8 rounded border border-line text-muted hover:text-ink">
                          ↑
                        </button>
                        <button type="button" aria-label="Move towards outside" onClick={() => move(i, 1)} className="h-8 w-8 rounded border border-line text-muted hover:text-ink">
                          ↓
                        </button>
                        <button type="button" aria-label={`Remove ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="h-8 w-8 rounded border border-line text-muted hover:text-ink">
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["d", "d mm"],
                          ["lambda", "λ W/mK"],
                          ["mu", "μ"],
                        ] as const
                      ).map(([k, t]) => (
                        <label key={k} className="block text-[11px] text-muted">
                          {t}
                          <input
                            inputMode="decimal"
                            className={`${input} mt-1`}
                            value={r[k]}
                            onChange={(e) => update(r.id, k, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <p className={`mt-2 text-[11px] ${ok ? "text-muted" : ""}`} style={ok ? undefined : { color: RED }}>
                      {ok ? `sd = ${sd < 10 ? sd.toFixed(2) : sd.toFixed(1)} m` : "Enter numbers above 0; layer left out until then."}
                    </p>
                  </li>
                );
              })}
            </ul>
            {rows.length < MAX_LAYERS ? (
              <div className="mt-3">
                <label className="block text-[11px] uppercase tracking-tag text-muted" htmlFor="wc-add">
                  Add a layer (sample values)
                </label>
                <select
                  id="wc-add"
                  className={`${input} mt-1`}
                  value=""
                  onChange={(e) => e.target.value !== "" && add(Number(e.target.value))}
                >
                  <option value="">Choose a material…</option>
                  {PRESETS.map((p, i) => (
                    <option key={p.name} value={i}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">Up to {MAX_LAYERS} layers.</p>
            )}
            <p className="mt-3 text-[11px] text-muted">
              Rsi 0.13 / Rse 0.04 m²K/W, typical, check against your standard. A cavity behind cladding: treat as outdoor air.
            </p>
          </div>
        </section>

        <section className="min-w-0 space-y-8" aria-label="Results">
          {!result ? (
            <p className="text-sm text-muted">Add a layer to start.</p>
          ) : (
            <Results
              result={result}
              layers={layers}
              names={names}
              label={label}
              month={month}
              setMonth={setMonth}
              flaggedAny={flaggedAny}
            />
          )}
        </section>
      </div>
    </main>
  );
}

type R = NonNullable<ReturnType<typeof analyse>>;

function Results({
  result,
  layers,
  names,
  label,
  month,
  setMonth,
  flaggedAny,
}: {
  result: R;
  layers: Layer[];
  names: string[];
  label: (k: number) => string;
  month: number;
  setMonth: (m: number) => void;
  flaggedAny: boolean;
}) {
  const m = result.months[month];
  const n = layers.length;
  const flagged = m.interfaces.map((i, k) => ({ i, k })).filter((x) => x.i.flag);

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-tag text-muted">U-value (approximate)</p>
          <p className="text-lg tabular-nums text-ink">{result.u.toFixed(2)} W/m²K</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-tag text-muted">Diagram month</p>
          <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Month for diagrams">
            {MONTHS.map((mn, i) => (
              <TagPill key={mn} label={mn} active={i === month} onClick={() => setMonth(i)} />
            ))}
          </div>
        </div>
      </div>

      {result.note && (
        <p className="text-sm" style={{ color: AMBER }}>
          {result.note}
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-2">
        <TempChart layers={layers} names={names} m={m} month={MONTHS[month]} />
        <GlaserChart layers={layers} m={m} month={MONTHS[month]} sd={result.sd} label={label} />
      </div>

      <div aria-live="polite">
        <p className="text-[11px] uppercase tracking-tag text-muted">{MONTHS[month]}: interfaces with p above ps</p>
        {flagged.length === 0 ? (
          <p className="mt-1 text-sm text-ink">None this month.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-ink tabular-nums">
            {flagged.map(({ i, k }) => (
              <li key={k}>
                {label(k)}: p {pa(i.p)} Pa &gt; ps {pa(i.ps)} Pa,{" "}
                {i.kg_m2 === null ? "surface condensation, kg/m2 n/a" : `${kg(i.kg_m2)} kg/m2`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-tag text-muted">12 months, one row per interface (kg/m2 per month)</p>
        <div className="overflow-x-auto" data-testid="strip-scroll">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[150px_repeat(12,minmax(0,1fr))] gap-1 text-[11px] text-muted">
              <span />
              {MONTHS.map((mn) => (
                <span key={mn} className="text-center">
                  {mn}
                </span>
              ))}
            </div>
            {Array.from({ length: n + 1 }, (_, k) => (
              <div key={k} className="mt-1 grid grid-cols-[150px_repeat(12,minmax(0,1fr))] gap-1 text-[11px]">
                <span className="truncate pr-1 text-muted" title={label(k)}>
                  {label(k)}
                </span>
                {result.months.map((mm, mi) => {
                  const c = mm.interfaces[k];
                  return (
                    <span
                      key={mi}
                      className="flex h-7 items-center justify-center rounded-sm tabular-nums text-ink"
                      style={{ background: c.flag ? RED : GREEN, opacity: c.flag ? 0.9 : 0.5 }}
                    >
                      {c.flag ? (c.kg_m2 === null ? "n/a" : kg(c.kg_m2)) : ""}
                    </span>
                  );
                })}
              </div>
            ))}
            <div className="mt-1 grid grid-cols-[150px_repeat(12,minmax(0,1fr))] gap-1 text-[11px]">
              <span className="truncate pr-1 text-muted">Mould: inner RH &gt; 80%</span>
              {result.months.map((mm, mi) => (
                <span
                  key={mi}
                  className="flex h-7 items-center justify-center rounded-sm tabular-nums text-ink"
                  style={{ background: mm.innerSurface.mould ? RED : GREEN, opacity: mm.innerSurface.mould ? 0.9 : 0.5 }}
                >
                  {Math.round(mm.innerSurface.rh * 100)}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Red = p above ps in that month. Mould row: inner surface RH in %, a common rule of thumb, not tied to the standard.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-tag text-muted">Per-interface values (no drying modelled)</p>
        {!flaggedAny ? (
          <p className="text-sm text-ink">No interface has p above ps in this climate.</p>
        ) : (
          <ul className="space-y-1 text-sm text-ink tabular-nums">
            {result.interfaces.map((it, k) =>
              it.flaggedMonths === 0 ? null : (
                <li key={k}>
                  {label(k)}: {it.flaggedMonths} {it.flaggedMonths === 1 ? "month" : "months"},{" "}
                  {it.yearKg === null ? "surface condensation, kg/m2 n/a" : `${kg(it.yearKg)} kg/m2 (this interface only)`}
                </li>
              )
            )}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-muted">
          Each value is the sum of that one interface&apos;s own monthly values, not a yearly moisture balance.
        </p>
      </div>
    </>
  );
}

type MonthRes = R["months"][number];

function TempChart({ layers, names, m, month }: { layers: Layer[]; names: string[]; m: MonthRes; month: string }) {
  const W = 420, H = 250, x0 = 10, x1 = 410, y0 = 40, y1 = 200;
  const total = layers.reduce((s, l) => s + l.d, 0);
  const th = m.interfaces.map((i) => i.theta);
  const lo = Math.min(...th), hi = Math.max(...th);
  const span = hi - lo || 1;
  const y = (t: number) => y1 - ((t - lo) / span) * (y1 - y0 - 30) - 10;
  let acc = 0;
  const xs = [x0, ...layers.map((l) => { acc += l.d; return x0 + (acc / total) * (x1 - x0); })];
  return (
    <figure>
      <figcaption className="mb-2 text-[11px] uppercase tracking-tag text-muted">Temperature through the wall ({month})</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Temperature through the wall in ${month}`}>
        {layers.map((l, i) => (
          <g key={i}>
            <rect x={xs[i]} y={y0} width={xs[i + 1] - xs[i]} height={y1 - y0} fill={FILLS[i % FILLS.length]} stroke="#2a2a2a" />
            {xs[i + 1] - xs[i] > 60 && (
              <text x={(xs[i] + xs[i + 1]) / 2} y={y1 + 16} fontSize="10" fill="#8a8a8a" textAnchor="middle">
                {(names[i] ?? "").slice(0, 14)}
              </text>
            )}
          </g>
        ))}
        <polyline fill="none" stroke={BLUE} strokeWidth="2.5" points={th.map((t, k) => `${xs[k]},${y(t)}`).join(" ")} />
        {th.map((t, k) => (
          <g key={k}>
            <circle cx={xs[k]} cy={y(t)} r="3.5" fill={m.interfaces[k].flag ? RED : BLUE} />
            <text
              x={Math.min(Math.max(xs[k], x0 + 14), x1 - 14)}
              y={k === 1 && xs[1] - xs[0] < 40 ? y(t) + 18 : y(t) - 8}
              fontSize="11"
              fill={m.interfaces[k].flag ? RED : BLUE}
              textAnchor="middle"
            >
              {deg(t)} °C
            </text>
          </g>
        ))}
        <text x={x0} y={H - 12} fontSize="11" fill="#8a8a8a">inside</text>
        <text x={x1} y={H - 12} fontSize="11" fill="#8a8a8a" textAnchor="end">outside</text>
      </svg>
    </figure>
  );
}

function GlaserChart({ layers, m, month, sd, label }: { layers: Layer[]; m: MonthRes; month: string; sd: number; label: (k: number) => string }) {
  const W = 420, H = 250, x0 = 40, x1 = 410, y0 = 30, y1 = 200;
  if (sd <= 0) {
    return (
      <figure>
        <figcaption className="mb-2 text-[11px] uppercase tracking-tag text-muted">Glaser diagram ({month})</figcaption>
        <p className="text-sm text-muted">No vapour resistance (SD = 0): no profile to draw.</p>
      </figure>
    );
  }
  let acc = 0;
  const cum = [0, ...layers.map((l) => (acc += l.d * l.mu))];
  const x = (s: number) => x0 + (s / sd) * (x1 - x0);
  const pmax = Math.max(...m.interfaces.map((i) => Math.max(i.p, i.ps))) * 1.1;
  const y = (p: number) => y1 - (p / pmax) * (y1 - y0);
  const pts = (f: (i: MonthRes["interfaces"][number]) => number) => m.interfaces.map((i, k) => `${x(cum[k])},${y(f(i))}`).join(" ");
  return (
    <figure>
      <figcaption className="mb-2 text-[11px] uppercase tracking-tag text-muted">Glaser diagram: pressure vs sd ({month}, Pa)</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Vapour pressure and saturation pressure in ${month}`}>
        {layers.map((_, i) => (
          <rect key={i} x={x(cum[i])} y={y0} width={Math.max(0, x(cum[i + 1]) - x(cum[i]))} height={y1 - y0} fill={FILLS[i % FILLS.length]} stroke="#2a2a2a" />
        ))}
        <polyline fill="none" stroke="#e8e8e8" strokeWidth="2" strokeDasharray="6 4" points={pts((i) => i.ps)} />
        <polyline fill="none" stroke={AMBER} strokeWidth="2.5" points={pts((i) => i.p)} />
        {m.interfaces.map((i, k) =>
          i.flag ? (
            <g key={k}>
              <circle cx={x(cum[k])} cy={y(i.p)} r="5" fill={RED}>
                <title>{label(k)}</title>
              </circle>
            </g>
          ) : null
        )}
        <text x="4" y={y0 + 4} fontSize="10" fill="#8a8a8a">{pa(pmax)}</text>
        <text x="4" y={y1} fontSize="10" fill="#8a8a8a">0</text>
        <line x1="10" y1="226" x2="36" y2="226" stroke={AMBER} strokeWidth="2.5" />
        <text x="42" y="230" fontSize="11" fill="#8a8a8a">p (vapour)</text>
        <line x1="150" y1="226" x2="176" y2="226" stroke="#e8e8e8" strokeWidth="2" strokeDasharray="6 4" />
        <text x="182" y="230" fontSize="11" fill="#8a8a8a">ps (saturation)</text>
        <text x={x1} y="246" fontSize="11" fill="#8a8a8a" textAnchor="end">x = sd, 0 to {sd.toFixed(2)} m</text>
      </svg>
    </figure>
  );
}
