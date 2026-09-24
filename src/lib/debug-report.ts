/**
 * Dev-only debug report helpers: ring buffers for console + runtime errors,
 * and a shared snapshot of pattern params for the floating reporter.
 */

export interface DebugLogEntry {
  level: "error" | "warn";
  message: string;
  timestamp: string;
}

export interface DebugRuntimeError {
  message: string;
  stack?: string;
  source: "error" | "unhandledrejection" | "react";
  timestamp: string;
}

export interface DebugReportPayload {
  note: string;
  pathname: string;
  href: string;
  patternSlug: string | null;
  staticParams: Record<string, number> | null;
  kineticParams: Record<string, number> | null;
  allParams: Record<string, number> | null;
  consoleLogs: DebugLogEntry[];
  runtimeErrors: DebugRuntimeError[];
  timestamp: string;
  userAgent: string;
}

const MAX_LOGS = 40;
const MAX_ERRORS = 20;

const logBuffer: DebugLogEntry[] = [];
const errorBuffer: DebugRuntimeError[] = [];

type ParamsSnapshot = {
  slug: string | null;
  staticParams: Record<string, number> | null;
  kineticParams: Record<string, number> | null;
  allParams: Record<string, number> | null;
};

let paramsSnapshot: ParamsSnapshot = {
  slug: null,
  staticParams: null,
  kineticParams: null,
  allParams: null,
};

let hooksInstalled = false;

function pushCapped<T>(buf: T[], item: T, max: number) {
  buf.push(item);
  if (buf.length > max) buf.splice(0, buf.length - max);
}

function serializeArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

export function setDebugParamsSnapshot(next: ParamsSnapshot) {
  paramsSnapshot = next;
}

export function getDebugParamsSnapshot(): ParamsSnapshot {
  return paramsSnapshot;
}

export function getConsoleLogs(): DebugLogEntry[] {
  return [...logBuffer];
}

export function getRuntimeErrors(): DebugRuntimeError[] {
  return [...errorBuffer];
}

export function recordRuntimeError(err: DebugRuntimeError) {
  pushCapped(errorBuffer, err, MAX_ERRORS);
}

/** Install once on the client — wraps console + window error handlers. */
export function installDebugHooks() {
  if (typeof window === "undefined" || hooksInstalled) return;
  hooksInstalled = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    pushCapped(
      logBuffer,
      {
        level: "error",
        message: serializeArgs(args),
        timestamp: new Date().toISOString(),
      },
      MAX_LOGS
    );
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    pushCapped(
      logBuffer,
      {
        level: "warn",
        message: serializeArgs(args),
        timestamp: new Date().toISOString(),
      },
      MAX_LOGS
    );
    origWarn(...args);
  };

  window.addEventListener("error", (event) => {
    recordRuntimeError({
      message: event.message || String(event.error),
      stack: event.error instanceof Error ? event.error.stack : undefined,
      source: "error",
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    recordRuntimeError({
      message:
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : serializeArgs([reason]),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandledrejection",
      timestamp: new Date().toISOString(),
    });
  });
}

export function buildDebugReport(note: string): DebugReportPayload {
  const snap = getDebugParamsSnapshot();
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const href = typeof window !== "undefined" ? window.location.href : "";
  const slugFromPath = pathname.match(/^\/patterns\/([^/?#]+)/)?.[1] ?? null;

  return {
    note: note.trim(),
    pathname,
    href,
    patternSlug: snap.slug ?? slugFromPath,
    staticParams: snap.staticParams,
    kineticParams: snap.kineticParams,
    allParams: snap.allParams,
    consoleLogs: getConsoleLogs(),
    runtimeErrors: getRuntimeErrors(),
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  };
}

export async function submitDebugReport(
  payload: DebugReportPayload
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const res = await fetch("/api/debug-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    path?: string;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: data.error ?? res.statusText };
  }
  return { ok: true, path: data.path };
}
