/**
 * Biomechanics feature — shared types.
 *
 * Vec3 is the fundamental unit: a point or vector in 3-D space.
 * It deliberately mirrors the x/y/z fields of NormalizedLandmark so that
 * both image landmarks and world landmarks can be passed to math utilities
 * without conversion.
 *
 * AngleDefinition describes *which* landmarks form an angle.
 * It carries no thresholds, phase logic, or rep rules — those belong to Phase 4.
 *
 * AngleResult wraps a calculated value with a validity flag so Phase 4 can
 * distinguish a genuine 0° angle from a degenerate/invalid measurement.
 */

import type { PoseLandmark } from './landmarkMapping'

/** A point or direction vector in 3-D space. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/**
 * Describes one joint angle by its three constituent landmarks.
 * The angle is always measured at `vertex`.
 *
 *   pointA ──── vertex ──── pointC
 */
export interface AngleDefinition {
  /** Unique name within an exercise (e.g. "leftKneeAngle"). */
  name: string
  /** First arm of the angle. */
  pointA: PoseLandmark
  /** The joint at which the angle is measured. */
  vertex: PoseLandmark
  /** Second arm of the angle. */
  pointC: PoseLandmark
}

/**
 * The result of computing one AngleDefinition against a landmark set.
 *
 * `valid: false` means at least one of the three landmarks had a zero-length
 * arm vector — the `degrees` value (0) should NOT be interpreted as a real
 * joint angle. Phase 4 must check `valid` before applying thresholds.
 */
export interface AngleResult {
  name: string
  /** Angle in degrees [0, 180]. */
  degrees: number
  /**
   * false when a degenerate (zero-length) vector was encountered.
   * A valid result of ~0° is geometrically possible but rare in practice.
   */
  valid: boolean
}

/** All angles calculated for one pose frame across one exercise. */
export type JointAngles = Record<string, AngleResult>
