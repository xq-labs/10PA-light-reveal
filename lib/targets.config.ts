/**
 * Per-target placement config for the AR avatar planes.
 *
 * There is one entry per target index in /public/targets.mind
 * (this POC assumes 2 targets: index 0 and index 1).
 *
 * Each target has TWO personalized avatar variants ("a" and "b"). A global
 * variant toggle (on-screen button, or the ?variant=a|b URL param) chooses which
 * one renders. Placement (offset / scale / rotationY) is shared across variants,
 * since both sit on the same frame in the same spot.
 *
 * Coordinate system (MindAR image target space):
 *   - The tracked image is 1 unit wide. Its height is (imageHeight / imageWidth).
 *   - Origin (0, 0) is the CENTER of the tracked image.
 *   - +x = right, +y = up, +z = toward the viewer (out of the page).
 *
 * So an offset of { x: 0.25, y: -0.1, z: 0 } nudges the avatar right and down,
 * relative to the center of the frame. `scale` is the plane width in those same
 * units (1 = as wide as the target image). `rotationY` is in DEGREES.
 *
 * Tune these live using calibration mode (open /ar?calibrate=true), then paste
 * the values the "Log config" button prints back into this file.
 */
export type VariantKey = "a" | "b";

export interface TargetConfig {
  targetIndex: number;
  /** Two personalized avatar overlays, keyed by variant. */
  variants: Record<VariantKey, string>;
  offset: { x: number; y: number; z: number };
  scale: number;
  /** Rotation about the Y (vertical) axis, in degrees. */
  rotationY: number;
}

export const targetsConfig: TargetConfig[] = [
  {
    // Frame 0 — "before" (blue)
    targetIndex: 0,
    variants: {
      a: "/avatars/frame0-variant-a.png",
      b: "/avatars/frame0-variant-b.png",
    },
    offset: { x: -0.26, y: -0.28, z: 0 },
    scale: 0.41,
    rotationY: 0,
  },
  {
    // Frame 1 — "after" (red)
    targetIndex: 1,
    variants: {
      a: "/avatars/frame1-variant-a.png",
      b: "/avatars/frame1-variant-b.png",
    },
    offset: { x: -0.4, y: -0.24, z: -0.03 },
    scale: 0.61,
    rotationY: 0,
  },
];
