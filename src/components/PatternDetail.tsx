"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getPattern,
  getKineticPattern,
  getStatic3DPattern,
  getAdjacentSlugs,
  getRelatedPatterns,
  getThumbnailSvg,
  PatternParams,
  PatternStats,
} from "@/lib/patterns";
import Slider from "./Slider";
import TagPill from "./TagPill";
import PatternCanvas from "./PatternCanvas";
import PatternCard from "./PatternCard";
import MotifPicker from "./MotifPicker";
import SolarOverlay, { SolarFootnote } from "./SolarOverlay";
import YieldMap from "./YieldMap";
import { DebugErrorBoundary } from "./DebugReporter";
import { addVariation } from "@/lib/storage";
import { downloadPng, downloadSvg } from "@/lib/export";
import { setDebugParamsSnapshot } from "@/lib/debug-report";
import dynamic from "next/dynamic";

const loading3d = (
  <div className="flex h-full w-full items-center justify-center bg-canvas text-sm text-muted">
    Loading 3D…
  </div>
);

const KineticPatternCanvas = dynamic(() => import("./KineticPatternCanvas"), {
  ssr: false,
  loading: () => loading3d,
});

const Pattern3DCanvas = dynamic(() => import("./Pattern3DCanvas"), {
  ssr: false,
  loading: () => loading3d,
});

interface PatternDetailProps {
  slug: string;
}

export default function PatternDetail({ slug }: PatternDetailProps) {
  const pattern = getPattern(slug);
  const kinetic = getKineticPattern(slug);
  const static3d = getStatic3DPattern(slug);
  const isKinetic = pattern?.meta.type === "kinetic-3d";
  const isStatic3D = pattern?.meta.type === "static-3d";
  const is3D = isKinetic || isStatic3D;

  const [params, setParams] = useState<PatternParams>(
    pattern ? { ...pattern.defaults } : {}
  );
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);
  const [playing, setPlaying] = useState(true);
  const isSolar = slug === "solar-budget-skin";
  const isYield = slug === "facade-yield-map";
  const [controlsOpen, setControlsOpen] = useState(false); // phone only, solar and yield slugs
  const phoneToggle = isSolar || isYield;

  const handleStats = useCallback((s: PatternStats) => {
    setStats(s);
  }, []);

  const { prev, next } = useMemo(() => getAdjacentSlugs(slug), [slug]);
  const related = useMemo(() => getRelatedPatterns(slug, 4), [slug]);

  useEffect(() => {
    if (pattern) {
      setParams({ ...pattern.defaults });
      setStats(null);
      setPlaying(true);
    }
  }, [pattern]);

  const onChange = useCallback((key: string, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const staticParams = useMemo(() => {
    const out: PatternParams = {};
    for (const def of pattern?.meta.staticParams ?? []) {
      out[def.key] = params[def.key] ?? def.default;
    }
    return out;
  }, [params, pattern]);

  const kineticParams = useMemo(() => {
    const out: PatternParams = {};
    for (const def of pattern?.meta.kineticParams ?? []) {
      out[def.key] = params[def.key] ?? def.default;
    }
    return out;
  }, [params, pattern]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    setDebugParamsSnapshot({
      slug: pattern?.meta.slug ?? slug,
      staticParams,
      kineticParams: Object.keys(kineticParams).length ? kineticParams : null,
      allParams: params,
    });
    return () => {
      setDebugParamsSnapshot({
        slug: null,
        staticParams: null,
        kineticParams: null,
        allParams: null,
      });
    };
  }, [pattern, slug, staticParams, kineticParams, params]);

  if (!pattern) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12 text-muted md:px-10">
        Pattern not found.
      </div>
    );
  }

  const reset = () => setParams({ ...pattern.defaults });

  const save = () => {
    addVariation(pattern.meta.slug, pattern.meta.name, params);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const exportSvg = is3D
    ? getThumbnailSvg(pattern, params)
    : pattern.generate?.(params).svg ?? "";

  const handleDownloadSvg = () => {
    downloadSvg(exportSvg, `${pattern.meta.slug}.svg`);
  };

  const handleDownloadPng = async () => {
    try {
      await downloadPng(exportSvg, `${pattern.meta.slug}.png`);
    } catch {
      downloadSvg(exportSvg, `${pattern.meta.slug}.svg`);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareFlash(true);
        window.setTimeout(() => setShareFlash(false), 1600);
      }
    } catch {
      /* ignore */
    }
  };

  const viewer = isKinetic && kinetic ? (
    <KineticPatternCanvas
      pattern={kinetic}
      staticParams={staticParams}
      kineticParams={kineticParams}
      playing={playing}
      onStats={handleStats}
    />
  ) : isStatic3D && static3d ? (
    <Pattern3DCanvas
      pattern={static3d}
      staticParams={staticParams}
      onStats={handleStats}
    />
  ) : isYield ? (
    <YieldMap params={staticParams} />
  ) : (
    <PatternCanvas
      pattern={pattern}
      params={params}
      onStats={handleStats}
    />
  );

  return (
    <div className="w-full">
      {/* Immersive viewer — ~80% viewport. Solar keeps its own phone toggle over the viewer;
          the yield map grows with its content; other patterns stack their controls under the viewer below sm. */}
      <section
        className={
          isSolar
            ? "relative h-[80vh] min-h-[480px] w-full overflow-hidden bg-canvas"
            : isYield
              ? "relative min-h-[80vh] w-full overflow-hidden bg-canvas"
              : "relative w-full bg-canvas sm:h-[80vh] sm:min-h-[480px] sm:overflow-hidden"
        }
      >
        <div
          className={
            isYield
              ? "relative sm:mr-[min(340px,38vw)]"
              : isSolar
              ? "absolute inset-y-0 left-0 right-0 sm:right-[min(340px,38vw)]"
              : "relative h-[70vh] min-h-[360px] w-full sm:absolute sm:inset-0 sm:h-auto sm:min-h-0"
          }
        >
          <DebugErrorBoundary label={pattern.meta.slug}>
            {viewer}
          </DebugErrorBoundary>
          {isSolar && <SolarOverlay params={staticParams} hidden={controlsOpen} />}
        </div>

        {phoneToggle && (
          <button
            type="button"
            onClick={() => setControlsOpen((o) => !o)}
            className={`${isYield && controlsOpen ? "fixed top-4 z-50" : "absolute bottom-4 z-30"} inset-x-4 rounded-full border border-line bg-canvas py-2 text-sm text-ink sm:hidden`}
            aria-expanded={controlsOpen}
          >
            {controlsOpen ? "Hide controls ▴" : "Show controls ▾"}
          </button>
        )}

        {/* Top chrome */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-[#0d0d0d]/90 via-[#0d0d0d]/45 to-transparent px-5 pb-16 pt-5 md:px-8">
          <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                {pattern.meta.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-muted">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-accent"
                  title="Copy link"
                >
                  <IconShare />
                  <span className="sr-only sm:not-sr-only">
                    {shareFlash ? "Copied" : "Share"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-accent"
                  title="Download SVG"
                >
                  <IconDownload />
                  <span className="sr-only sm:not-sr-only">SVG</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-accent"
                  title="Download PNG"
                >
                  <IconImage />
                  <span className="sr-only sm:not-sr-only">PNG</span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              {prev ? (
                <Link
                  href={`/patterns/${prev}`}
                  className="hover:text-accent"
                  aria-label="Previous pattern"
                >
                  ← Prev
                </Link>
              ) : (
                <span className="opacity-30">← Prev</span>
              )}
              <span className="text-line">|</span>
              {next ? (
                <Link
                  href={`/patterns/${next}`}
                  className="hover:text-accent"
                  aria-label="Next pattern"
                >
                  Next →
                </Link>
              ) : (
                <span className="opacity-30">Next →</span>
              )}
            </div>
          </div>
        </div>

        {/* Floating controls panel */}
        <aside
          className={
            isSolar
              ? `absolute bottom-0 right-0 top-0 z-20 ${controlsOpen ? "flex" : "hidden sm:flex"} w-full max-w-md flex-col overflow-hidden sm:w-[min(340px,38vw)]`
              : isYield
                ? `absolute bottom-0 right-0 top-0 z-20 ${controlsOpen ? "flex" : "hidden sm:flex"} max-sm:fixed max-sm:inset-0 max-sm:z-40 max-sm:max-w-none max-sm:bg-canvas w-full max-w-md flex-col overflow-hidden sm:w-[min(340px,38vw)]`
                : "relative z-20 flex w-full flex-col border-t border-line/60 sm:absolute sm:bottom-0 sm:right-0 sm:top-0 sm:w-[min(340px,38vw)] sm:max-w-md sm:overflow-hidden sm:border-t-0"
          }
          aria-label="Pattern controls"
        >
          <div
            className={
              isSolar
                ? "pointer-events-none absolute inset-0 bg-gradient-to-l from-[#0d0d0d]/95 via-[#0d0d0d]/75 to-transparent"
                : "pointer-events-none absolute inset-0 hidden bg-gradient-to-l from-[#0d0d0d]/95 via-[#0d0d0d]/75 to-transparent sm:block"
            }
          />
          <div
            className={
              phoneToggle
                ? "relative flex h-full flex-col overflow-y-auto px-5 py-6 pb-20 pt-24 sm:pb-6 md:px-6"
                : "relative flex flex-col px-5 py-6 sm:h-full sm:overflow-y-auto sm:pt-24 md:px-6"
            }
          >
            <div className="flex flex-col gap-6">
              {pattern.meta.staticParams
                .filter((def) => def.key !== "holeShape")
                .map((def) => (
                  <Slider
                    key={def.key}
                    def={def}
                    value={params[def.key] ?? def.default}
                    onChange={onChange}
                  />
                ))}
            </div>

            {pattern.meta.slug === "perforated-screen" && (
              <MotifPicker
                value={Math.round(params.holeShape ?? 0)}
                onChange={(id) => onChange("holeShape", id)}
              />
            )}

            {isKinetic && pattern.meta.kineticParams && (
              <div className="mt-8 border-t border-line/60 pt-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h2 className="text-[11px] font-medium uppercase tracking-tag text-muted">
                    Motion
                  </h2>
                  <button
                    type="button"
                    onClick={() => setPlaying((p) => !p)}
                    className="inline-flex items-center gap-1.5 text-sm text-ink underline underline-offset-4 transition-colors hover:text-accent"
                    aria-pressed={playing}
                  >
                    {playing ? (
                      <>
                        <IconPause /> Pause
                      </>
                    ) : (
                      <>
                        <IconPlay /> Play
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-col gap-6">
                  {pattern.meta.kineticParams.map((def) => (
                    <Slider
                      key={def.key}
                      def={def}
                      value={params[def.key] ?? def.default}
                      onChange={onChange}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <button
                type="button"
                onClick={save}
                className="text-ink underline underline-offset-4 transition-colors hover:text-accent"
              >
                {savedFlash ? "Saved" : "Save variation"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-muted underline underline-offset-4 transition-colors hover:text-accent"
              >
                Reset to defaults
              </button>
            </div>

            {stats && (
              <dl className="mt-8 space-y-2 border-t border-line/60 pt-5 text-xs text-muted">
                <div className="flex justify-between gap-4">
                  <dt>Elements</dt>
                  <dd className="tabular-nums text-ink">
                    {stats.elementCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Nodes</dt>
                  <dd className="tabular-nums text-ink">{stats.nodeCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Connections</dt>
                  <dd className="tabular-nums text-ink">
                    {stats.connectionCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Render</dt>
                  <dd className="tabular-nums text-ink">
                    {is3D ? "GPU" : `${stats.renderTimeMs} ms`}
                  </dd>
                </div>
              </dl>
            )}

            <div className="mt-8 border-t border-line/60 pt-5 pb-4">
              <p className="text-sm leading-body text-muted">
                Want this for your project?{" "}
                <a
                  href="mailto:hello@example.com?subject=Facade%20pattern%20inquiry"
                  className="text-ink underline underline-offset-4 transition-colors hover:text-accent"
                >
                  Contact us →
                </a>
              </p>
            </div>
          </div>
        </aside>
      </section>
      {isSolar && <SolarFootnote params={staticParams} />}

      {/* Meta below the immersive viewer */}
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        <p className="max-w-2xl text-base leading-body text-muted">
          {pattern.meta.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {pattern.meta.tags.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
            />
          ))}
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 h-px w-full bg-line" />
            <h2 className="mb-8 text-lg font-semibold text-ink">
              Related Patterns
            </h2>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {related.map((r) => (
                <PatternCard key={r.meta.slug} pattern={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.5 13.5 15.5 17.5M15.5 6.5 8.5 10.5" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 4v12M12 16l-4-4M12 16l4-4M5 20h14" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}
