"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Slider from "@/components/Slider";
import { PatternParamDef } from "@/lib/patterns";
import {
  DEFAULT_SPEC,
  DriverType,
  HoleLayout,
  Panel,
  StudioSpec,
  elevationDxf,
  generateStudio,
  scheduleCsv,
} from "@/lib/studio/engine";

const ALUMINIUM_DENSITY = 2700; // kg/m³

type NumKey = {
  [K in keyof StudioSpec]: StudioSpec[K] extends number ? K : never;
}[keyof StudioSpec];

const def = (key: NumKey, label: string, min: number, max: number, step: number, unit?: string): PatternParamDef => ({
  key,
  label,
  min,
  max,
  step,
  default: DEFAULT_SPEC[key],
  unit,
});

const GROUPS: { title: string; defs: PatternParamDef[] }[] = [
  {
    title: "Elevation",
    defs: [def("facadeW", "Facade width", 3000, 60000, 100, "mm"), def("facadeH", "Facade height", 3000, 30000, 100, "mm")],
  },
  {
    title: "Panels",
    defs: [
      def("panelW", "Panel width", 600, 3000, 10, "mm"),
      def("panelH", "Panel height", 600, 4500, 10, "mm"),
      def("joint", "Joint", 5, 50, 1, "mm"),
      def("edgeMargin", "Edge margin", 0, 150, 5, "mm"),
    ],
  },
  {
    title: "Perforation",
    defs: [
      def("pitch", "Pitch", 20, 200, 1, "mm"),
      def("holeMin", "Smallest hole", 0, 100, 1, "mm"),
      def("holeMax", "Largest hole", 2, 180, 1, "mm"),
      def("tools", "Punch tools (0 = any size)", 0, 8, 1),
    ],
  },
  { title: "Sheet", defs: [def("thickness", "Thickness", 1, 6, 0.5, "mm")] },
];

const DRIVER_DEFS: Record<DriverType, PatternParamDef[]> = {
  linear: [def("angle", "Gradient direction", 0, 360, 5, "°")],
  radial: [
    def("attractorX", "Attractor across", 0, 1, 0.01),
    def("attractorY", "Attractor up", 0, 1, 0.01),
    def("falloff", "Reach", 0.1, 1.5, 0.01),
  ],
  noise: [def("noiseScale", "Feature size", 300, 8000, 50, "mm"), def("seed", "Seed", 1, 999, 1)],
};

function heat(t: number): string {
  // Dark → warm ramp for open-area heat view, readable on the dark ground.
  const stops = [
    [28, 44, 74],
    [44, 120, 140],
    [120, 180, 110],
    [240, 200, 90],
    [250, 120, 70],
  ];
  const x = Math.max(0, Math.min(0.9999, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function download(content: string | Blob, filename: string, type: string) {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function StudioApp() {
  const [spec, setSpec] = useState<StudioSpec>(DEFAULT_SPEC);
  const [view, setView] = useState<"perforation" | "heat">("perforation");
  const [hover, setHover] = useState<Panel | null>(null);
  const deferred = useDeferredValue(spec);
  const result = useMemo(() => generateStudio(deferred), [deferred]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const set = (key: string, value: number) => setSpec((s) => ({ ...s, [key]: value }));

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width / deferred.facadeW;
  const height = Math.max(120, Math.round(deferred.facadeH * scale));
  const maxOpen = Math.max(0.0001, ...result.panels.map((p) => p.openArea));

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(0, 0, width, height);
    const s = width / deferred.facadeW;
    for (const p of result.panels) {
      const px = p.x * s;
      const py = height - (p.y + p.h) * s;
      ctx.fillStyle = view === "heat" ? heat(p.openArea / maxOpen) : "#1f1f1f";
      ctx.fillRect(px, py, p.w * s, p.h * s);
      if (view === "perforation") {
        ctx.fillStyle = "#e8e8e8";
        ctx.beginPath();
        for (const h of p.holes) {
          const r = Math.max(0.35, (h.d / 2) * s);
          const cx = px + h.x * s;
          const cy = py + (p.h - h.y) * s;
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (p.w * s > 46) {
        ctx.fillStyle = "#0d0d0d";
        ctx.font = "600 11px var(--font-inter), system-ui, sans-serif";
        ctx.fillText(`${(p.openArea * 100).toFixed(1)}%`, px + 6, py + 16);
      }
    }
    if (hover) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hover.x * s + 0.75, height - (hover.y + hover.h) * s + 0.75, hover.w * s - 1.5, hover.h * s - 1.5);
    }
    if (deferred.driver === "radial") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      const ax = deferred.attractorX * deferred.facadeW * s;
      const ay = height - deferred.attractorY * deferred.facadeH * s;
      ctx.beginPath();
      ctx.arc(ax, ay, 7, 0, Math.PI * 2);
      ctx.moveTo(ax - 12, ay);
      ctx.lineTo(ax + 12, ay);
      ctx.moveTo(ax, ay - 12);
      ctx.lineTo(ax, ay + 12);
      ctx.stroke();
    }
  }, [result, width, height, view, hover, deferred, maxOpen]);

  function panelAt(e: React.MouseEvent<HTMLCanvasElement>): { panel: Panel | null; fx: number; fy: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * deferred.facadeW;
    const fy = (1 - (e.clientY - rect.top) / rect.height) * deferred.facadeH;
    const panel = result.panels.find((p) => fx >= p.x && fx <= p.x + p.w && fy >= p.y && fy <= p.y + p.h) ?? null;
    return { panel, fx, fy };
  }

  const sheetArea = (result.cols * result.rows * result.panelW * result.panelH) / 1e6;
  const weight = sheetArea * (spec.thickness / 1000) * ALUMINIUM_DENSITY * (1 - result.openArea);
  const name = `facade-${spec.facadeW}x${spec.facadeH}`;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-tag text-muted">Facade Studio</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Perforated elevation, panel by panel
          </h1>
        </div>
        <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">Pro · free during beta</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-7">
          <section className="flex flex-col gap-3">
            <h2 className="text-xs uppercase tracking-tag text-muted">Gradient</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Gradient driver">
              {(["linear", "radial", "noise"] as DriverType[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSpec((s) => ({ ...s, driver: d }))}
                  aria-pressed={spec.driver === d}
                  className={`rounded-full border px-3 py-1.5 text-xs ${spec.driver === d ? "border-accent bg-accent text-canvas" : "border-line text-ink hover:border-muted"}`}
                >
                  {d === "linear" ? "Linear" : d === "radial" ? "Attractor" : "Noise"}
                </button>
              ))}
            </div>
            {DRIVER_DEFS[spec.driver].map((d) => (
              <Slider key={d.key} def={d} value={spec[d.key as NumKey]} onChange={set} />
            ))}
            <label className="flex items-center gap-2 text-sm text-ink max-sm:min-h-8">
              <input
                id="invert"
                type="checkbox"
                className="max-sm:h-5 max-sm:w-5"
                checked={spec.invert}
                onChange={(e) => setSpec((s) => ({ ...s, invert: e.target.checked }))}
              />
              Invert gradient
            </label>
            {spec.driver === "radial" && <p className="text-xs text-muted">Tip: click the elevation to move the attractor.</p>}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs uppercase tracking-tag text-muted">Hole grid</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Hole layout">
              {(["staggered", "square"] as HoleLayout[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setSpec((s) => ({ ...s, layout: l }))}
                  aria-pressed={spec.layout === l}
                  className={`rounded-full border px-3 py-1.5 text-xs ${spec.layout === l ? "border-accent bg-accent text-canvas" : "border-line text-ink hover:border-muted"}`}
                >
                  {l === "staggered" ? "Staggered 60°" : "Square 90°"}
                </button>
              ))}
            </div>
          </section>

          {GROUPS.map((g) => (
            <section key={g.title} className="flex flex-col gap-4">
              <h2 className="text-xs uppercase tracking-tag text-muted">{g.title}</h2>
              {g.defs.map((d) => (
                <Slider key={d.key} def={d} value={spec[d.key as NumKey]} onChange={set} />
              ))}
            </section>
          ))}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2" role="group" aria-label="View">
              {(["perforation", "heat"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-full border px-3 py-1.5 text-xs ${view === v ? "border-accent bg-accent text-canvas" : "border-line text-ink hover:border-muted"}`}
                >
                  {v === "perforation" ? "Perforation" : "Open area per panel"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted tabular-nums">
              {hover
                ? `${hover.id} · ${(hover.openArea * 100).toFixed(2)}% open · ${hover.holes.length.toLocaleString("en-GB")} holes`
                : "Hover a panel for its schedule line"}
            </p>
          </div>

          <div ref={wrapRef} className="w-full">
            <canvas
              ref={canvasRef}
              style={{ width: "100%", height }}
              className="block rounded-sm border border-line"
              aria-label={`Elevation ${spec.facadeW} by ${spec.facadeH} mm, ${result.cols * result.rows} panels`}
              onMouseMove={(e) => setHover(panelAt(e).panel)}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                if (spec.driver !== "radial") return;
                const { fx, fy } = panelAt(e);
                setSpec((s) => ({ ...s, attractorX: +(fx / s.facadeW).toFixed(2), attractorY: +(fy / s.facadeH).toFixed(2) }));
              }}
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
            {[
              ["Open area", `${(result.openArea * 100).toFixed(1)}%`],
              ["Panels", `${result.cols} × ${result.rows} = ${result.cols * result.rows}`],
              ["Panel module", `${result.panelW} × ${result.panelH} mm`],
              ["Holes", result.holeCount.toLocaleString("en-GB")],
              ["Punch tools", result.toolSizes.length ? `${result.toolSizes.length} · Ø ${result.toolSizes.slice(0, 6).join(" / ")}${result.toolSizes.length > 6 ? " …" : ""} mm` : "—"],
              ["Unique panels", String(result.uniquePanelTypes)],
              ["Sheet area", `${sheetArea.toFixed(1)} m²`],
              ["Aluminium weight", `${Math.round(weight).toLocaleString("en-GB")} kg`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 border-t border-line pt-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 text-sm font-medium text-ink tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          {result.warnings.length > 0 && (
            <ul className="flex flex-col gap-1.5 rounded-sm border border-line p-4 text-xs text-muted">
              {result.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-muted"
              onClick={() => canvasRef.current?.toBlob((b) => b && download(b, `${name}.png`, "image/png"), "image/png")}
            >
              Download PNG
            </button>
            <button
              type="button"
              className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-canvas"
              onClick={() => download(elevationDxf(result), `${name}.dxf`, "application/dxf")}
            >
              DXF for fabrication · Pro
            </button>
            <button
              type="button"
              className="rounded-full border border-accent bg-accent px-4 py-2 text-sm font-medium text-canvas"
              onClick={() => download(scheduleCsv(result), `${name}-panel-schedule.csv`, "text/csv")}
            >
              Panel schedule CSV · Pro
            </button>
          </div>
          <p className="text-xs text-muted">
            DXF layers: PANELS, HOLES, LABELS · millimetres · weight assumes aluminium at 2,700 kg/m³.
          </p>
        </div>
      </div>
    </div>
  );
}
