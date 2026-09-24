n# Parametric Facade Explorer

A gallery of generative, parametric facade design patterns — louvres, perforated screens, brise-soleil, and tessellated panels — each with live sliders to adjust the pattern in real time.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Pure SVG generators (no canvas/WebGL for v1)
- localStorage for saved variations

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Patterns

Each pattern lives in its own named folder — edit by opening that folder:

| Folder | Type |
|--------|------|
| `src/lib/patterns/deformed-grid/` | static-2d |
| `src/lib/patterns/radial-louvre/` | static-2d |
| `src/lib/patterns/perforated-screen/` | static-2d |
| `src/lib/patterns-3d/hinged-flap-grid/` | static-3d |
| `src/lib/patterns-3d/louvre-cascade/` | kinetic-3d |
| `src/lib/patterns-3d/radial-pulse-panels/` | kinetic-3d |

Shared helpers: `src/lib/patterns/shared/` and `src/lib/patterns-3d/shared/`. Registry: `index.ts` in each tree.

3D patterns use Three.js via `@react-three/fiber` — static-3d via `Pattern3DCanvas` (shadows + optional backing plane), kinetic-3d via `KineticPatternCanvas`. Pipeline check: `/test-3d`.

## Deploy

Built for Vercel — connect the repo and deploy with default Next.js settings.
