import * as louvreCascade from "./louvre-cascade";
import * as radialPulse from "./radial-pulse-panels";
import * as hingedFlapGrid from "./hinged-flap-grid";
import * as rotatedBrickScreen from "./rotated-brick-screen";
import * as wovenStripScreen from "./woven-strip-screen";
import {
  KineticPatternModule,
  Static3DPatternModule,
} from "./shared/types";

export const kineticPatterns: KineticPatternModule[] = [
  louvreCascade.kineticModule,
  radialPulse.kineticModule,
];

export const static3dPatterns: Static3DPatternModule[] = [
  hingedFlapGrid.static3dModule,
  rotatedBrickScreen.static3dModule,
  wovenStripScreen.static3dModule,
];

export function getKineticPattern(
  slug: string
): KineticPatternModule | undefined {
  return kineticPatterns.find((p) => p.meta.slug === slug);
}

export function getStatic3DPattern(
  slug: string
): Static3DPatternModule | undefined {
  return static3dPatterns.find((p) => p.meta.slug === slug);
}

export type {
  KineticPatternModule,
  Static3DPatternModule,
  ElementTransform,
  GetElementTransform,
} from "./shared/types";
