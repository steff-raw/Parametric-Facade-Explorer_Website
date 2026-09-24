"use client";

import {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  buildDebugReport,
  installDebugHooks,
  recordRuntimeError,
  submitDebugReport,
} from "@/lib/debug-report";

function isDev() {
  return process.env.NODE_ENV === "development";
}

/** Recoverable panel when a child tree throws during render. */
export class DebugErrorBoundary extends Component<
  { children: ReactNode; label?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isDev()) return;
    recordRuntimeError({
      message: error.message,
      stack: error.stack,
      source: "react",
      timestamp: new Date().toISOString(),
    });
  }

  private async saveReport() {
    const note = `React error boundary: ${this.props.label ?? "viewer"} — ${this.state.error?.message ?? "unknown"}`;
    const payload = buildDebugReport(note);
    await submitDebugReport(payload);
  }

  private async copyReport() {
    const note = `React error boundary: ${this.props.label ?? "viewer"} — ${this.state.error?.message ?? "unknown"}`;
    const payload = buildDebugReport(note);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.error && isDev()) {
      return (
        <div className="flex h-full min-h-[200px] w-full flex-col items-start justify-center gap-3 bg-[#1a1210] p-6 text-sm text-[#f0e6e0]">
          <p className="font-semibold text-[#ffb4a2]">
            Render error{this.props.label ? ` · ${this.props.label}` : ""}
          </p>
          <pre className="max-h-40 w-full overflow-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-black/40 p-3 text-xs text-[#ffd7cc]">
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void this.saveReport()}
              className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              Save report
            </button>
            <button
              type="button"
              onClick={() => void this.copyReport()}
              className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              Copy report
            </button>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-canvas text-sm text-muted">
          Something went wrong.
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Floating “Report issue” control — development builds only.
 */
export default function DebugReporter() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isDev()) return;
    installDebugHooks();
  }, []);

  const onSubmit = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const payload = buildDebugReport(note || "(no note)");
      const result = await submitDebugReport(payload);
      if (result.ok) {
        setStatus(`Saved → ${result.path ?? "debug/latest-report.json"}`);
        setNote("");
        setOpen(false);
      } else {
        setStatus(result.error ?? "Save failed");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [busy, note]);

  if (!isDev()) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {status && (
        <div className="pointer-events-auto max-w-xs rounded border border-white/15 bg-[#1c1c1c] px-3 py-2 text-xs text-[#c8c8c8] shadow-lg">
          {status}
        </div>
      )}

      {open && (
        <div className="pointer-events-auto w-[min(100vw-2rem,20rem)] rounded border border-white/15 bg-[#161616] p-3 shadow-xl">
          <p className="mb-2 text-xs font-medium text-[#e8e8e8]">
            Report issue
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What looks wrong? (params + console are captured automatically)"
            rows={4}
            className="mb-2 w-full resize-y rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-[#e8e8e8] outline-none placeholder:text-[#666] focus:border-white/30"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2.5 py-1 text-xs text-[#999] hover:text-[#e8e8e8]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSubmit()}
              className="rounded bg-[#e8e8e8] px-2.5 py-1 text-xs font-medium text-[#111] hover:bg-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save report"}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setStatus(null);
        }}
        className="pointer-events-auto rounded-full border border-white/20 bg-[#222] px-3 py-2 text-xs font-medium text-[#ddd] shadow-lg hover:bg-[#2a2a2a]"
        title="Save a debug report for the agent"
      >
        Report issue
      </button>
    </div>
  );
}
