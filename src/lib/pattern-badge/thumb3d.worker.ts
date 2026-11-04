/**
 * Pattern Performance Badge: 3D thumbnails off the main thread (P-0038). Message in: a slug.
 * Message out: { slug, blob, instances } or { slug, blob: null } without OffscreenCanvas / WebGL2.
 * Renders one at a time (one shared renderer).
 */
import { drawThumb } from "./thumb3d";

let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<string>) => {
  const slug = e.data;
  queue = queue
    .then(() => drawThumb(slug))
    .catch(() => null)
    .then((t) => self.postMessage({ slug, blob: t?.blob ?? null, instances: t?.instances ?? 0 }));
};
