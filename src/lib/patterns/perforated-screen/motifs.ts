/**
 * Perforation hole motifs for the Perforated Screen pattern.
 * Indexed to match the 6×7 reference atlases in /public/reference/.
 *
 * Sheet A (geometric): ids 0–41
 * Sheet B (dots / bars): ids 42–83
 */

import { SvgPrimitive } from "../shared/types";

export interface HoleMotif {
  id: number;
  label: string;
  sheet: "a" | "b";
  /** 0–41 index within its sheet (row-major, 6 cols) */
  cell: number;
}

const COLS = 6;
const ROWS = 7;

function labelsA(): string[] {
  return [
    "Ornate frame",
    "Cross grid",
    "Checker 4×4",
    "Loose checker",
    "Beaded lines",
    "Star grid",
    "Hatched diamond",
    "Basketweave",
    "Herringbone",
    "Split triangles",
    "Comb rows",
    "Nested grid",
    "Sawtooth",
    "Square grid",
    "Zigzag",
    "Vertical bars",
    "Linked squares",
    "Greek key",
    "Diagonal sash",
    "Pinstripes",
    "Cross-hatch",
    "Folded triangles",
    "Dots 2×2",
    "Dots 3×3",
    "Woven mesh",
    "Houndstooth",
    "Polka 4×4",
    "Concentric rings",
    "Target rings",
    "Quadrant hatch",
    "Brick dashes",
    "Quadrant lines",
    "Diamonds 2×2",
    "Diamond mesh",
    "Ladder",
    "Inscribed diamond",
    "Geo flower",
    "Diamonds 4×4",
    "Stepped path",
    "Half-moons",
    "Kaleidoscope",
    "Quarter circles",
  ];
}

function labelsB(): string[] {
  return [
    "Staggered capsules",
    "Horizontal triplets",
    "Dot grids",
    "Stacked lines",
    "Radial dots",
    "Diagonal dots",
    "Bar grid",
    "Staggered circles",
    "Octagon dots",
    "Dotted rings",
    "Double dot square",
    "Fine dot columns",
    "Circle bars",
    "Sparse dots",
    "Oval dots",
    "Figural dots",
    "Fine horizontals",
    "Dense rings",
    "Arrowhead dots",
    "Solid dots",
    "Pill honeycomb",
    "Stacked pairs",
    "Octagon bars",
    "Heavy horizontals",
    "Split circle bars",
    "Square line fill",
    "Parallel lines",
    "Bar triangle",
    "Variable lines",
    "Heavy verticals",
    "Diagonal hatch",
    "Dashed rows",
    "Dot block",
    "Semicircle mesh",
    "Stacked triplets",
    "Pincushion bars",
    "Wide oval mesh",
    "Thick bar square",
    "Double line blocks",
    "Diagonal hatch 2",
    "Dashed grid",
    "Diagonal dashes",
  ];
}

export const HOLE_MOTIFS: HoleMotif[] = [
  ...labelsA().map((label, cell) => ({
    id: cell,
    label,
    sheet: "a" as const,
    cell,
  })),
  ...labelsB().map((label, cell) => ({
    id: 42 + cell,
    label,
    sheet: "b" as const,
    cell,
  })),
];

export const HOLE_MOTIF_COUNT = HOLE_MOTIFS.length; // 84
export const MOTIF_SHEET_COLS = COLS;
export const MOTIF_SHEET_ROWS = ROWS;

export const MOTIF_SHEETS = {
  a: {
    src: "/reference/5fab1b16b79b0fc2e6dc36b15235b24d.jpg",
    label: "Geometric",
    idOffset: 0,
  },
  b: {
    src: "/reference/2b8f6a2bed5387518a3bb6ef7c117cf2.jpg",
    label: "Dots & bars",
    idOffset: 42,
  },
} as const;

export function getMotif(id: number): HoleMotif {
  const i = ((Math.round(id) % HOLE_MOTIF_COUNT) + HOLE_MOTIF_COUNT) % HOLE_MOTIF_COUNT;
  return HOLE_MOTIFS[i];
}

/* ---------- geometry helpers (local unit space → world) ---------- */

function path(d: string): SvgPrimitive {
  return { type: "path", d };
}

function circle(cx: number, cy: number, r: number): SvgPrimitive {
  return { type: "circle", cx, cy, r };
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): SvgPrimitive {
  return { type: "line", x1, y1, x2, y2 };
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number
): SvgPrimitive {
  return { type: "rect", x, y, width: w, height: h };
}

function poly(pts: [number, number][]): SvgPrimitive {
  const d =
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ") +
    " Z";
  return path(d);
}

function regularPolygon(
  cx: number,
  cy: number,
  r: number,
  n: number,
  rot = -Math.PI / 2
): SvgPrimitive {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

function star4(cx: number, cy: number, r: number): SvgPrimitive {
  const ri = r * 0.35;
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
    const rad = i % 2 === 0 ? r : ri;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return poly(pts);
}

/** Build motif primitives centered at (cx,cy) with half-size `s` (≈ former circle radius). */
export function buildMotifPrimitives(
  motifId: number,
  cx: number,
  cy: number,
  s: number
): SvgPrimitive[] {
  const id = ((Math.round(motifId) % HOLE_MOTIF_COUNT) + HOLE_MOTIF_COUNT) % HOLE_MOTIF_COUNT;
  const out: SvgPrimitive[] = [];

  // --- Sheet A: 0–41 ---
  if (id === 0) {
    // Ornate frame: square + center circle + corner dots
    const h = s * 0.95;
    out.push(rect(cx - h, cy - h, h * 2, h * 2));
    out.push(circle(cx, cy, s * 0.35));
    for (const [dx, dy] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ] as const) {
      out.push(circle(cx + dx * s, cy + dy * s, s * 0.12));
    }
  } else if (id === 1) {
    // Cross grid / center square + checker corners
    const cell = s * 0.55;
    out.push(rect(cx - cell * 0.5, cy - cell * 0.5, cell, cell));
    for (const [ox, oy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const bx = cx + ox * s * 0.55;
      const by = cy + oy * s * 0.55;
      const u = s * 0.22;
      out.push(rect(bx - u, by - u, u, u));
      out.push(rect(bx, by, u, u));
    }
  } else if (id === 2 || id === 3) {
    // Checkerboards
    const n = 4;
    const gap = id === 3 ? 0.12 : 0.02;
    const cell = (s * 2) / n;
    const pad = cell * gap;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if ((i + j) % 2 !== 0) continue;
        out.push(
          rect(
            cx - s + i * cell + pad,
            cy - s + j * cell + pad,
            cell - pad * 2,
            cell - pad * 2
          )
        );
      }
    }
  } else if (id === 4) {
    // Beaded vertical lines
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * s * 0.55;
      out.push(line(x, cy - s, x, cy + s));
      for (let j = -1; j <= 1; j++) {
        out.push(circle(x, cy + j * s * 0.55, s * 0.12));
      }
    }
  } else if (id === 5) {
    // Star grid
    const n = 3;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = cx - s * 0.65 + (i / (n - 1)) * s * 1.3;
        const y = cy - s * 0.65 + (j / (n - 1)) * s * 1.3;
        out.push(star4(x, y, s * 0.18));
      }
    }
  } else if (id === 6) {
    out.push(regularPolygon(cx, cy, s, 4, 0));
    for (let k = -2; k <= 2; k++) {
      out.push(
        line(cx - s * 0.7, cy + k * s * 0.25, cx + s * 0.7, cy + k * s * 0.25)
      );
      out.push(
        line(cx + k * s * 0.25, cy - s * 0.7, cx + k * s * 0.25, cy + s * 0.7)
      );
    }
  } else if (id === 7) {
    // Basketweave
    const step = s * 0.45;
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 1; col++) {
        const x = cx + col * step;
        const y = cy + row * step * 0.5;
        if ((row + col) % 2 === 0) {
          out.push(line(x, y, x + step * 0.85, y));
        } else {
          out.push(line(x + step * 0.4, y - step * 0.35, x + step * 0.4, y + step * 0.35));
        }
      }
    }
  } else if (id === 8) {
    // Herringbone
    for (let col = -2; col <= 2; col++) {
      const x = cx + col * s * 0.35;
      for (let row = -2; row <= 2; row++) {
        const y = cy + row * s * 0.35;
        const dir = col % 2 === 0 ? 1 : -1;
        out.push(
          line(x - s * 0.12, y, x + s * 0.12 * dir, y - s * 0.18)
        );
        out.push(
          line(x - s * 0.12, y, x + s * 0.12 * dir, y + s * 0.18)
        );
      }
    }
  } else if (id === 9) {
    out.push(poly([
      [cx - s, cy - s],
      [cx + s, cy - s],
      [cx - s, cy + s],
    ]));
    out.push(poly([
      [cx + s, cy - s],
      [cx + s, cy + s],
      [cx - s, cy + s],
    ]));
  } else if (id === 10) {
    for (let row = -2; row <= 2; row++) {
      const y = cy + row * s * 0.35;
      out.push(line(cx - s, y, cx + s, y));
      for (let t = -3; t <= 3; t++) {
        const x = cx + t * s * 0.28;
        out.push(line(x, y, x, y + s * 0.18));
      }
    }
  } else if (id === 11) {
    for (let k = 1; k <= 3; k++) {
      const h = (s * k) / 3;
      out.push(rect(cx - h, cy - h, h * 2, h * 2));
    }
  } else if (id === 12) {
    const n = 3;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x0 = cx - s + (i / n) * s * 2;
        const y0 = cy - s + (j / n) * s * 2;
        out.push(
          poly([
            [x0, y0],
            [x0 + (s * 2) / n, y0],
            [x0, y0 + (s * 2) / n],
          ])
        );
      }
    }
  } else if (id === 13) {
    const n = 3;
    const cell = (s * 2) / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        out.push(
          rect(
            cx - s + i * cell + cell * 0.12,
            cy - s + j * cell + cell * 0.12,
            cell * 0.76,
            cell * 0.76
          )
        );
      }
    }
  } else if (id === 14) {
    for (let row = -1; row <= 1; row++) {
      const y = cy + row * s * 0.55;
      let d = `M ${cx - s} ${y}`;
      for (let i = 0; i < 6; i++) {
        const x = cx - s + ((i + 1) / 6) * s * 2;
        const yy = y + (i % 2 === 0 ? -s * 0.2 : s * 0.2);
        d += ` L ${x} ${yy}`;
      }
      out.push(path(d));
    }
  } else if (id === 15) {
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * s * 0.4;
      out.push(line(x, cy - s, x, cy + s));
    }
  } else if (id === 16) {
    const n = 2;
    const cell = s * 0.9;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = cx - cell * 0.5 + i * cell;
        const y = cy - cell * 0.5 + j * cell;
        out.push(rect(x - cell * 0.35, y - cell * 0.35, cell * 0.7, cell * 0.7));
      }
    }
  } else if (id === 17) {
    // Greek key simplified
    const r = s * 0.85;
    out.push(
      path(
        `M ${cx - r} ${cy + r} L ${cx - r} ${cy - r} L ${cx + r} ${cy - r} L ${cx + r} ${cy - r * 0.25} L ${cx - r * 0.25} ${cy - r * 0.25} L ${cx - r * 0.25} ${cy + r * 0.25} L ${cx + r * 0.5} ${cy + r * 0.25} L ${cx + r * 0.5} ${cy + r} Z`
      )
    );
  } else if (id === 18) {
    out.push(rect(cx - s, cy - s, s * 2, s * 2));
    out.push(line(cx - s * 0.85, cy + s * 0.85, cx + s * 0.85, cy - s * 0.85));
    out.push(line(cx - s * 0.55, cy + s * 0.85, cx + s * 0.85, cy - s * 0.55));
  } else if (id === 19) {
    for (let i = -4; i <= 4; i++) {
      const x = cx + i * s * 0.2;
      out.push(line(x, cy - s, x, cy + s));
    }
  } else if (id === 20) {
    for (let i = -3; i <= 3; i++) {
      out.push(line(cx - s, cy + i * s * 0.28, cx + s, cy + i * s * 0.28));
      out.push(line(cx + i * s * 0.28, cy - s, cx + i * s * 0.28, cy + s));
    }
  } else if (id === 21) {
    out.push(
      poly([
        [cx, cy - s],
        [cx + s, cy],
        [cx, cy + s],
        [cx - s, cy],
      ])
    );
    out.push(line(cx - s * 0.5, cy - s * 0.5, cx + s * 0.5, cy + s * 0.5));
    out.push(line(cx + s * 0.5, cy - s * 0.5, cx - s * 0.5, cy + s * 0.5));
  } else if (id === 22) {
    for (const [dx, dy] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ] as const) {
      out.push(circle(cx + dx * s, cy + dy * s, s * 0.28));
    }
  } else if (id === 23) {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        out.push(circle(cx + i * s * 0.55, cy + j * s * 0.55, s * 0.16));
      }
    }
  } else if (id === 24) {
    for (let i = -2; i <= 2; i++) {
      out.push(line(cx - s, cy + i * s * 0.35, cx + s, cy + i * s * 0.35));
      out.push(line(cx + i * s * 0.35, cy - s, cx + i * s * 0.35, cy + s));
    }
  } else if (id === 25) {
    // Houndstooth-ish
    out.push(poly([
      [cx - s, cy - s * 0.2],
      [cx - s * 0.2, cy - s],
      [cx + s * 0.3, cy - s * 0.3],
      [cx - s * 0.3, cy + s * 0.3],
    ]));
    out.push(poly([
      [cx + s, cy + s * 0.2],
      [cx + s * 0.2, cy + s],
      [cx - s * 0.3, cy + s * 0.3],
      [cx + s * 0.3, cy - s * 0.3],
    ]));
  } else if (id === 26) {
    for (let j = -1.5; j <= 1.5; j++) {
      for (let i = -1.5; i <= 1.5; i++) {
        out.push(circle(cx + i * s * 0.45, cy + j * s * 0.45, s * 0.12));
      }
    }
  } else if (id === 27) {
    for (let k = 1; k <= 4; k++) {
      out.push(circle(cx, cy, (s * k) / 4));
    }
  } else if (id === 28) {
    for (const [dx, dy] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ] as const) {
      out.push(circle(cx + dx * s, cy + dy * s, s * 0.32));
      out.push(circle(cx + dx * s, cy + dy * s, s * 0.1));
    }
  } else if (id === 29) {
    out.push(line(cx - s, cy - s, cx + s, cy + s));
    out.push(line(cx + s, cy - s, cx - s, cy + s));
    out.push(line(cx - s, cy, cx + s, cy));
    out.push(line(cx, cy - s, cx, cy + s));
    for (let k = 1; k <= 3; k++) {
      const t = k * 0.22;
      out.push(line(cx - s * t, cy - s, cx - s, cy - s * t));
      out.push(line(cx + s * t, cy - s, cx + s, cy - s * t));
      out.push(line(cx - s * t, cy + s, cx - s, cy + s * t));
      out.push(line(cx + s * t, cy + s, cx + s, cy + s * t));
    }
  } else if (id === 30) {
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = cx + col * s * 0.4 + (row % 2 === 0 ? 0 : s * 0.2);
        const y = cy + row * s * 0.35;
        out.push(line(x - s * 0.15, y, x + s * 0.15, y));
      }
    }
  } else if (id === 31) {
    out.push(line(cx - s, cy, cx, cy));
    out.push(line(cx, cy - s, cx, cy));
    for (let i = -3; i <= 0; i++) {
      out.push(line(cx - s, cy + i * s * 0.25, cx, cy + i * s * 0.25));
    }
    for (let i = 0; i <= 3; i++) {
      out.push(line(cx + i * s * 0.25, cy - s, cx + i * s * 0.25, cy));
    }
    for (let i = 0; i <= 3; i++) {
      out.push(line(cx, cy + i * s * 0.25, cx + s, cy + i * s * 0.25));
    }
    for (let i = -3; i <= 0; i++) {
      out.push(line(cx + i * s * 0.25, cy, cx + i * s * 0.25, cy + s));
    }
  } else if (id === 32) {
    for (const [dx, dy] of [
      [-0.45, -0.45],
      [0.45, -0.45],
      [-0.45, 0.45],
      [0.45, 0.45],
    ] as const) {
      out.push(regularPolygon(cx + dx * s, cy + dy * s, s * 0.28, 4, 0));
    }
  } else if (id === 33) {
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        out.push(
          regularPolygon(
            cx + i * s * 0.35,
            cy + j * s * 0.35,
            s * 0.14,
            4,
            0
          )
        );
      }
    }
  } else if (id === 34) {
    out.push(line(cx - s * 0.7, cy - s, cx - s * 0.7, cy + s));
    out.push(line(cx + s * 0.7, cy - s, cx + s * 0.7, cy + s));
    for (let i = -2; i <= 2; i++) {
      out.push(
        line(cx - s * 0.7, cy + i * s * 0.35, cx + s * 0.7, cy + i * s * 0.35)
      );
    }
  } else if (id === 35) {
    out.push(rect(cx - s, cy - s, s * 2, s * 2));
    out.push(regularPolygon(cx, cy, s * 0.75, 4, 0));
  } else if (id === 36) {
    out.push(regularPolygon(cx, cy, s * 0.95, 4, -Math.PI / 4));
    out.push(rect(cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9));
    out.push(regularPolygon(cx, cy, s * 0.35, 4, 0));
  } else if (id === 37) {
    for (let j = -1.5; j <= 1.5; j++) {
      for (let i = -1.5; i <= 1.5; i++) {
        out.push(
          regularPolygon(cx + i * s * 0.45, cy + j * s * 0.45, s * 0.16, 4, 0)
        );
      }
    }
  } else if (id === 38) {
    for (let k = -3; k <= 3; k++) {
      out.push(
        rect(
          cx + k * s * 0.22 - s * 0.08,
          cy + k * s * 0.22 - s * 0.08,
          s * 0.16,
          s * 0.16
        )
      );
    }
  } else if (id === 39) {
    for (let row = -1; row <= 1; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = cx + col * s * 0.35;
        const y = cy + row * s * 0.5;
        out.push(
          path(
            `M ${x - s * 0.2} ${y} A ${s * 0.2} ${s * 0.2} 0 0 1 ${x + s * 0.2} ${y}`
          )
        );
      }
    }
  } else if (id === 40) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push(
        line(
          cx,
          cy,
          cx + Math.cos(a) * s,
          cy + Math.sin(a) * s
        )
      );
    }
    out.push(circle(cx, cy, s * 0.25));
  } else if (id === 41) {
    out.push(
      path(
        `M ${cx - s} ${cy - s} A ${s} ${s} 0 0 1 ${cx} ${cy} L ${cx - s} ${cy} Z`
      )
    );
    out.push(
      path(
        `M ${cx + s} ${cy + s} A ${s} ${s} 0 0 1 ${cx} ${cy} L ${cx + s} ${cy} Z`
      )
    );
  }

  // --- Sheet B: 42–83 (dots & bars families) ---
  else if (id === 42) {
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = cx + col * s * 0.4 + (row % 2 ? s * 0.2 : 0);
        const y = cy + row * s * 0.35;
        out.push(line(x, y - s * 0.18, x, y + s * 0.18));
      }
    }
  } else if (id === 43) {
    for (let row = -1; row <= 0; row++) {
      for (let i = -1; i <= 1; i++) {
        out.push(
          line(
            cx + i * s * 0.5 - s * 0.28,
            cy + row * s * 0.55,
            cx + i * s * 0.5 + s * 0.28,
            cy + row * s * 0.55
          )
        );
      }
    }
  } else if (id === 44 || id === 54 || id === 60 || id === 61) {
    const n = id === 44 ? 4 : id === 54 ? 3 : 5;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        out.push(
          circle(
            cx - s + (i / Math.max(n - 1, 1)) * s * 2,
            cy - s + (j / Math.max(n - 1, 1)) * s * 2,
            s * (0.08 + (id === 61 ? 0.06 : 0.04))
          )
        );
      }
    }
  } else if (id === 45 || id === 70 || id === 80) {
    for (let i = -3; i <= 3; i++) {
      out.push(line(cx + i * s * 0.22, cy - s, cx + i * s * 0.22, cy + s));
    }
  } else if (id === 46) {
    out.push(circle(cx, cy, s * 0.15));
    for (let ring = 1; ring <= 2; ring++) {
      const n = 6 * ring;
      const rr = s * 0.35 * ring;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push(circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.08));
      }
    }
  } else if (id === 47) {
    for (let j = -3; j <= 3; j++) {
      for (let i = -3; i <= 3; i++) {
        const x = (i - j) * s * 0.18;
        const y = (i + j) * s * 0.18;
        if (Math.hypot(x, y) > s) continue;
        out.push(circle(cx + x, cy + y, s * 0.06));
      }
    }
  } else if (id === 48 || id === 68 || id === 71) {
    for (let j = -3; j <= 3; j++) {
      out.push(line(cx - s, cy + j * s * 0.28, cx + s, cy + j * s * 0.28));
    }
  } else if (id === 49) {
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = cx + col * s * 0.4 + (row % 2 ? s * 0.2 : 0);
        out.push(circle(x, cy + row * s * 0.35, s * 0.14));
      }
    }
  } else if (id === 50 || id === 64) {
    out.push(regularPolygon(cx, cy, s, 8));
    const n = 4;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = cx - s * 0.55 + (i / (n - 1)) * s * 1.1;
        const y = cy - s * 0.55 + (j / (n - 1)) * s * 1.1;
        if (id === 50) out.push(circle(x, y, s * 0.07));
        else out.push(line(x - s * 0.35, y, x + s * 0.35, y));
      }
    }
  } else if (id === 51 || id === 59) {
    for (let ring = 1; ring <= (id === 59 ? 5 : 3); ring++) {
      const n = 8 + ring * 2;
      const rr = (s * ring) / (id === 59 ? 5 : 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push(circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s * 0.06));
      }
    }
  } else if (id === 52) {
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        out.push(
          circle(cx - s * 0.5 + i * s * 0.5, cy - s * 0.5 + j * s * 0.5, s * 0.1)
        );
      }
    }
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        out.push(
          circle(cx + s * 0.15 + i * s * 0.35, cy + s * 0.15 + j * s * 0.35, s * 0.08)
        );
      }
    }
  } else if (id === 53) {
    for (let b = -1; b <= 1; b += 2) {
      for (let i = -2; i <= 2; i++) {
        out.push(
          circle(cx + b * s * 0.35 + i * 0, cy + i * s * 0.28, s * 0.06)
        );
      }
    }
  } else if (id === 55) {
    for (let j = -4; j <= 4; j++) {
      const t = 1 - Math.abs(j) / 5;
      const half = s * t;
      out.push(line(cx - half, cy + j * s * 0.2, cx + half, cy + j * s * 0.2));
    }
  } else if (id === 56) {
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        out.push(circle(cx + i * s * 0.35, cy + j * s * 0.45, s * 0.08));
      }
    }
  } else if (id === 57) {
    // figural cross of dots
    for (let i = -2; i <= 2; i++) {
      out.push(circle(cx, cy + i * s * 0.3, s * 0.1));
      out.push(circle(cx + i * s * 0.3, cy - s * 0.3, s * 0.08));
    }
  } else if (id === 58 || id === 69 || id === 75) {
    for (let j = -4; j <= 4; j++) {
      out.push(line(cx - s, cy + j * s * 0.2, cx + s, cy + j * s * 0.2));
    }
  } else if (id === 62) {
    for (let row = -2; row <= 2; row++) {
      for (let col = -2; col <= 2; col++) {
        const x = cx + col * s * 0.38 + (row % 2 ? s * 0.19 : 0);
        const y = cy + row * s * 0.32;
        out.push(line(x, y - s * 0.2, x, y + s * 0.2));
      }
    }
  } else if (id === 63) {
    for (let i = -1; i <= 1; i += 2) {
      out.push(line(cx + i * s * 0.35 - s * 0.3, cy - s * 0.4, cx + i * s * 0.35 + s * 0.3, cy - s * 0.4));
      out.push(line(cx + i * s * 0.35 - s * 0.3, cy + s * 0.4, cx + i * s * 0.35 + s * 0.3, cy + s * 0.4));
    }
  } else if (id === 65) {
    for (let j = -3; j <= 3; j++) {
      out.push(line(cx - s, cy + j * s * 0.25, cx + s, cy + j * s * 0.25));
    }
  } else if (id === 66) {
    for (let j = -4; j <= 4; j++) {
      const half = s * Math.sqrt(Math.max(0, 1 - (j / 4.5) ** 2));
      out.push(line(cx - half, cy + j * s * 0.2, cx - s * 0.05, cy + j * s * 0.2));
      out.push(line(cx + s * 0.05, cy + j * s * 0.2, cx + half, cy + j * s * 0.2));
    }
    out.push(line(cx, cy - s, cx, cy + s));
  } else if (id === 67) {
    for (let j = -3; j <= 3; j++) {
      out.push(line(cx - s, cy + j * s * 0.28, cx + s, cy + j * s * 0.28));
    }
    out.push(rect(cx - s, cy - s, s * 2, s * 2));
  } else if (id === 72) {
    for (let j = 0; j < 5; j++) {
      const t = j / 4;
      const half = s * (1 - t);
      out.push(
        line(cx - half, cy - s + t * s * 2, cx + half, cy - s + t * s * 2)
      );
    }
  } else if (id === 73) {
    for (let j = -3; j <= 3; j++) {
      const w = 0.08 + (Math.abs(j) % 3) * 0.05;
      out.push(line(cx - s, cy + j * s * 0.28, cx + s, cy + j * s * 0.28));
      void w;
    }
  } else if (id === 74) {
    for (let i = -3; i <= 3; i++) {
      out.push(line(cx + i * s * 0.28, cy - s, cx + i * s * 0.28, cy + s));
    }
  } else if (id === 76 || id === 81) {
    for (let i = -4; i <= 4; i++) {
      out.push(
        line(
          cx - s,
          cy + i * s * 0.22,
          cx + s,
          cy + i * s * 0.22 - s * 0.4
        )
      );
    }
  } else if (id === 77) {
    for (let row = -3; row <= 3; row++) {
      for (let col = -2; col <= 1; col++) {
        const x = cx + col * s * 0.55 + (row % 2 ? s * 0.25 : 0);
        const y = cy + row * s * 0.28;
        out.push(line(x, y, x + s * 0.35, y));
      }
    }
  } else if (id === 78) {
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        out.push(
          circle(cx - s * 0.6 + i * s * 0.4, cy - s * 0.3 + j * s * 0.35, s * 0.08)
        );
      }
    }
    out.push(circle(cx, cy - s * 0.85, s * 0.12));
  } else if (id === 79) {
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 5; i++) {
        const y = cy + s * 0.1 + j * s * 0.22;
        const x = cx - s + i * s * 0.5;
        if ((x - cx) ** 2 / (s * 1.1) ** 2 + (y - cy) ** 2 / (s * 0.9) ** 2 > 1)
          continue;
        out.push(circle(x, y, s * 0.07));
      }
    }
  } else if (id === 82) {
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        const x0 = cx - s + i * s * 0.5;
        const y0 = cy - s + j * s * 0.5;
        out.push(rect(x0, y0, s * 0.4, s * 0.4));
      }
    }
  } else if (id === 83) {
    for (let j = -3; j <= 3; j++) {
      for (let i = -3; i <= 3; i++) {
        const x = cx + i * s * 0.28;
        const y = cy + j * s * 0.28;
        out.push(line(x - s * 0.1, y + s * 0.1, x + s * 0.1, y - s * 0.1));
      }
    }
  } else {
    // Fallback circle
    out.push(circle(cx, cy, s));
  }

  return out;
}

/** Tiny preview SVG for a motif — white on transparent (picker / docs). */
export function motifPreviewSvg(motifId: number, size = 64): string {
  const prims = buildMotifPrimitives(motifId, size / 2, size / 2, size * 0.42);
  const body = prims
    .map((p) => {
      if (p.type === "circle") {
        const fill = p.r < size * 0.42 * 0.28 ? "#ffffff" : "none";
        return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fill}" stroke="#ffffff" stroke-width="1.35" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;
      }
      if (p.type === "line") {
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" fill="none" stroke="#ffffff" stroke-width="1.35" stroke-linecap="round" vector-effect="non-scaling-stroke" />`;
      }
      if (p.type === "rect") {
        return `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="#ffffff" stroke="none" />`;
      }
      if (p.type === "path") {
        return `<path d="${p.d}" fill="#ffffff" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" />`;
      }
      return "";
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">${body}</svg>`;
}
