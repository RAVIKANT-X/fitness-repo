/**
 * Joint angle calculations.
 *
 * Provides a single generic function for computing the angle at a joint
 * defined by three points:
 *
 *   A ──── vertex ──── C
 *
 * The result is in degrees and includes a `valid` flag (see AngleResult).
 *
 * Also provides `calculateExerciseAngles` which evaluates all AngleDefinitions
 * for an exercise against a landmark array, returning a JointAngles map.
 * This is the primary entry point consumed by Phase 4's analysis loop.
 */

import { subtract, dot, magnitude, isZeroVector } from './vectors'
import type { Vec3, AngleDefinition, AngleResult, JointAngles } from './biomechanicsTypes'
import { getLandmark } from './landmarkMapping'
import type { PoseLandmark } from './landmarkMapping'
import type { NormalizedLandmark } from '../pose/poseTypes'

/**
 * Calculates the angle (in degrees) at `vertex` formed by the ray to `a`
 * and the ray to `c`.
 *
 * Returns `{ degrees: 0, valid: false }` when either arm vector is
 * zero-length — this represents a degenerate/invalid measurement, NOT a
 * genuine 0-degree angle.
 */
export function calculateAngle(a: Vec3, vertex: Vec3, c: Vec3): AngleResult {
  const ba = subtract(a, vertex)
  const bc = subtract(c, vertex)

  if (isZeroVector(ba) || isZeroVector(bc)) {
    // Degenerate case: two landmarks are at the same position.
    // Return invalid rather than NaN so Phase 4 can safely skip this frame.
    return { name: '', degrees: 0, valid: false }
  }

  // clamp to [-1, 1] to guard against floating-point values like 1.0000000002
  const cosAngle = Math.max(-1, Math.min(1, dot(ba, bc) / (magnitude(ba) * magnitude(bc))))
  const degrees = (Math.acos(cosAngle) * 180) / Math.PI

  return { name: '', degrees, valid: true }
}

/**
 * Evaluates a single AngleDefinition against a landmark array.
 * Returns the named AngleResult.
 */
function evaluateAngleDefinition(
  def: AngleDefinition,
  landmarks: NormalizedLandmark[],
): AngleResult {
  const lmA = getLandmark(landmarks, def.pointA as PoseLandmark)
  const lmVertex = getLandmark(landmarks, def.vertex as PoseLandmark)
  const lmC = getLandmark(landmarks, def.pointC as PoseLandmark)

  if (!lmA || !lmVertex || !lmC) {
    return { name: def.name, degrees: 0, valid: false }
  }

  const result = calculateAngle(lmA, lmVertex, lmC)
  return { ...result, name: def.name }
}

/**
 * Calculates all angles defined by an exercise against the provided landmarks.
 *
 * Intended usage (Phase 4):
 *   const angles = calculateExerciseAngles(exercise.primaryAngles, pose.worldLandmarks)
 *   // angles['leftKneeAngle'].degrees → 87.3
 *   // angles['leftKneeAngle'].valid   → true
 *
 * @param angleDefinitions - The exercise's primaryAngles array.
 * @param landmarks        - World landmarks from PoseResult.worldLandmarks.
 * @returns A map from angle name → AngleResult.
 */
export function calculateExerciseAngles(
  angleDefinitions: AngleDefinition[],
  landmarks: NormalizedLandmark[],
): JointAngles {
  const result: JointAngles = {}
  for (const def of angleDefinitions) {
    result[def.name] = evaluateAngleDefinition(def, landmarks)
  }
  return result
}
