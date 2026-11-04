/**
 * Pattern Performance Badge: main-thread side of the 3D card thumbnails (P-0038).
 * No three.js here: the render runs in thumb3d.worker on an OffscreenCanvas. Cards ask when they near
 * the viewport; each request is posted in its own idle callback. Resolves to an object URL, or null for
 * flat patterns, without Worker / OffscreenCanvas / WebGL2, or on a worker error (callers keep the SVG).
 */
import BADGES from "./badges.json";

let worker: Worker | null | undefined;
const waiting = new Map<string, (url: string | null) => void>();
const cache = new Map<string, Promise<string | null>>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  try {
    const w = new Worker(new URL("./thumb3d.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<{ slug: string; blob: Blob | null }>) => {
      const { slug, blob } = e.data;
      waiting.get(slug)?.(blob ? URL.createObjectURL(blob) : null);
      waiting.delete(slug);
    };
    w.onerror = () => {
      waiting.forEach((done) => done(null));
      waiting.clear();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

const idle = (go: () => void) =>
  typeof requestIdleCallback === "function" ? requestIdleCallback(go, { timeout: 2000 }) : setTimeout(go, 0);

/** 3D thumbnail (object URL) for a gallery slug, cached; null for flat patterns or without worker rendering. */
export function renderThumb3D(slug: string): Promise<string | null> {
  if (!(slug in BADGES)) return Promise.resolve(null);
  const hit = cache.get(slug);
  if (hit) return hit;
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const job = new Promise<string | null>((done) => {
    waiting.set(slug, done);
    idle(() => w.postMessage(slug));
  });
  cache.set(slug, job);
  return job;
}
