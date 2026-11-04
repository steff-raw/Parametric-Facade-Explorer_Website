/**
 * Instance matrix as the 3D canvases build it (P-0038).
 *
 * Same result as THREE.Object3D.updateMatrix after position.set / rotation.set (Euler XYZ) /
 * scale.set, which is what `writeMatrices` in Pattern3DCanvas and KineticPatternCanvas does.
 * Pure maths, no three import, so the ray test and the thumbnails share one matrix.
 */

export type Vec3 = [number, number, number];
/** 4 x 4, column-major (same layout as THREE.Matrix4.elements). */
export type Mat4 = number[];

export function composeMatrix(position: Vec3, rotation: Vec3, scale: Vec3 = [1, 1, 1]): Mat4 {
  const [x, y, z] = rotation;
  const a = Math.cos(x), b = Math.sin(x);
  const c = Math.cos(y), d = Math.sin(y);
  const e = Math.cos(z), f = Math.sin(z);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  const [sx, sy, sz] = scale;
  return [
    c * e * sx, (af + be * d) * sx, (bf - ae * d) * sx, 0,
    -c * f * sy, (ae - bf * d) * sy, (be + af * d) * sy, 0,
    d * sz, -b * c * sz, a * c * sz, 0,
    position[0], position[1], position[2], 1,
  ];
}
