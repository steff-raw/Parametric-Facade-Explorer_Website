/**
 * Instance geometry shared by the detail-page canvas (Pattern3DCanvas) and the gallery
 * thumbnails (thumb3d.ts), so both draw the same box and door-frame ring (P-0038).
 * Moved from Pattern3DCanvas.tsx without change.
 */

import * as THREE from "three";

/** Gap between the hinged leaf and the inner edge of its door frame. */
export const FRAME_CLEARANCE = 0.012;

export function buildPanelGeometry(
  size: [number, number, number],
  offset: [number, number, number]
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  g.translate(offset[0], offset[1], offset[2]);
  return g;
}

/**
 * Door-frame ring on the host surface: outer extends OUTSIDE the panel,
 * inner opening clears the leaf. Geometry is centered at origin (no hinge
 * offset) so instances stay coplanar when transforms have rotation = 0.
 */
export function buildDoorFrameGeometry(
  panelSize: [number, number, number],
  frameWidth: number
): THREE.BufferGeometry | null {
  const [w, h, t] = panelSize;
  const fw = frameWidth;
  if (fw <= 0.001) return null;

  const clearance = FRAME_CLEARANCE;
  const outerW = w + 2 * fw;
  const outerH = h + 2 * fw;
  const innerW = w + clearance * 2;
  const innerH = h + clearance * 2;

  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-innerW / 2, -innerH / 2);
  hole.lineTo(-innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, -innerH / 2);
  hole.closePath();
  shape.holes.push(hole);

  // Shallow extrusion coplanar with the façade (same midplane as closed panels)
  const depth = Math.max(t * 0.85, 0.02);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
