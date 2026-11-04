/**
 * Pattern Performance Badge: card wording (P-0038, Stage 3). No three.js here, so cards can import it up front.
 */

/**
 * Nearest 5 with a leading "~": the window-share choice alone moves the score 6-9 points.
 * Capped so it never reads as fully opaque or fully open: >= 97.5 -> ">95%", <= 2.5 -> "<5%".
 */
export function approx(v: number): string {
  if (v >= 97.5) return ">95%";
  if (v <= 2.5) return "<5%";
  return `~${5 * Math.round(v / 5)}%`;
}

export const SUN_TOOLTIP =
  "Sun-ray test through this pattern's 3D mesh: south facade, 51.5 N, clear sky, summer May-Aug, " +
  "default pose, neighbour block ignored. Scored over the central 60% of the element field.";

const NA: Record<string, string> = {
  "facade-yield-map": "it is a map tool, no 3D model",
  "stack-effect-cavity": "ventilation drawing, no 3D model",
};

/** Why a flat pattern has no sun score. */
export function naReason(slug: string): string {
  return `No sun score: ${NA[slug] ?? "2D drawing, no 3D model"}`;
}
