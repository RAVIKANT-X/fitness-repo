/**
 * Angle evaluator — extracts named angle values from JointAngles.
 *
 * Each exercise uses different angle names. This module provides
 * typed accessor functions so the rest of the analysis engine
 * can work with clearly-named values rather than string-key lookups.
 *
 * Returns null for any angle that is invalid or missing, so callers
 * can distinguish "angle is 0°" from "angle was not computable".
 */

import type { JointAngles } from '../biomechanics/biomechanicsTypes'

/** Returns the degrees value if the angle is valid, otherwise null. */
export function getAngle(angles: JointAngles, name: string): number | null {
  const result = angles[name]
  if (!result || !result.valid) return null
  return result.degrees
}

// ── Squat ─────────────────────────────────────────────────────────────────────

export interface SquatAngles {
  leftKnee: number | null
  rightKnee: number | null
  leftHip: number | null
  rightHip: number | null
  /** Average of valid knee angles; null if neither is valid. */
  avgKnee: number | null
  /** Average of valid hip angles; null if neither is valid. */
  avgHip: number | null
}

export function extractSquatAngles(angles: JointAngles): SquatAngles {
  const leftKnee = getAngle(angles, 'leftKneeAngle')
  const rightKnee = getAngle(angles, 'rightKneeAngle')
  const leftHip = getAngle(angles, 'leftHipAngle')
  const rightHip = getAngle(angles, 'rightHipAngle')

  const kneeValues = [leftKnee, rightKnee].filter((v): v is number => v !== null)
  const hipValues = [leftHip, rightHip].filter((v): v is number => v !== null)

  return {
    leftKnee,
    rightKnee,
    leftHip,
    rightHip,
    avgKnee: kneeValues.length > 0 ? kneeValues.reduce((a, b) => a + b, 0) / kneeValues.length : null,
    avgHip: hipValues.length > 0 ? hipValues.reduce((a, b) => a + b, 0) / hipValues.length : null,
  }
}

// ── Push-Up ───────────────────────────────────────────────────────────────────

export interface PushUpAngles {
  leftElbow: number | null
  rightElbow: number | null
  leftShoulder: number | null
  rightShoulder: number | null
  /** Average of valid elbow angles; null if neither is valid. */
  avgElbow: number | null
}

export function extractPushUpAngles(angles: JointAngles): PushUpAngles {
  const leftElbow = getAngle(angles, 'leftElbowAngle')
  const rightElbow = getAngle(angles, 'rightElbowAngle')
  const leftShoulder = getAngle(angles, 'leftShoulderAngle')
  const rightShoulder = getAngle(angles, 'rightShoulderAngle')

  const elbowValues = [leftElbow, rightElbow].filter((v): v is number => v !== null)

  return {
    leftElbow,
    rightElbow,
    leftShoulder,
    rightShoulder,
    avgElbow:
      elbowValues.length > 0
        ? elbowValues.reduce((a, b) => a + b, 0) / elbowValues.length
        : null,
  }
}

// ── Curl ──────────────────────────────────────────────────────────────────────

export interface CurlAngles {
  leftElbow: number | null
  rightElbow: number | null
  leftShoulder: number | null
  rightShoulder: number | null
}

export function extractCurlAngles(angles: JointAngles): CurlAngles {
  return {
    leftElbow: getAngle(angles, 'leftElbowAngle'),
    rightElbow: getAngle(angles, 'rightElbowAngle'),
    leftShoulder: getAngle(angles, 'leftShoulderStability'),
    rightShoulder: getAngle(angles, 'rightShoulderStability'),
  }
}
