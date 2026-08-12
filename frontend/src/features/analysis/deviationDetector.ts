/**
 * Deviation detector — evaluates form quality from angle data and cycle history.
 *
 * Design:
 *  - Mid-rep deviations (per-frame): asymmetry, shoulder alignment
 *  - Post-rep deviations (at rep-complete): depth, extension completeness
 *
 * All functions return Deviation[] (empty = no issues).
 * No human-readable strings here — the UI maps IDs to messages.
 *
 * Pure functions — no state, no React, no side effects.
 */

import type { Deviation } from './analysisTypes'
import type { SquatAngles, PushUpAngles } from './angleEvaluator'
import { SQUAT, PUSHUP, CURL } from './analysisThresholds'

// ── Squat Deviations ──────────────────────────────────────────────────────────

/**
 * Per-frame squat deviations (evaluated continuously while the camera is running).
 * Returns deviations if they are currently active.
 */
export function detectSquatFrameDeviations(sa: SquatAngles): Deviation[] {
  const deviations: Deviation[] = []

  // Knee asymmetry
  if (sa.leftKnee !== null && sa.rightKnee !== null) {
    const diff = Math.abs(sa.leftKnee - sa.rightKnee)
    if (diff > SQUAT.KNEE_ASYMMETRY_THRESHOLD) {
      deviations.push({
        id: 'KNEE_ASYMMETRY',
        severity: 'WARNING',
        angleName: 'kneeAngle',
        observed: diff,
        threshold: SQUAT.KNEE_ASYMMETRY_THRESHOLD,
      })
    }
  }

  // Hip asymmetry
  if (sa.leftHip !== null && sa.rightHip !== null) {
    const diff = Math.abs(sa.leftHip - sa.rightHip)
    if (diff > SQUAT.HIP_ASYMMETRY_THRESHOLD) {
      deviations.push({
        id: 'HIP_ASYMMETRY',
        severity: 'INFO',
        angleName: 'hipAngle',
        observed: diff,
        threshold: SQUAT.HIP_ASYMMETRY_THRESHOLD,
      })
    }
  }

  return deviations
}

/**
 * Post-rep squat deviations (evaluated at rep completion).
 * Uses cycle extrema tracked throughout the rep.
 *
 * @param minKneeAngle - Minimum knee angle reached during the rep.
 */
export function detectSquatRepDeviations(minKneeAngle: number): Deviation[] {
  const deviations: Deviation[] = []

  if (minKneeAngle > SQUAT.MIN_DEPTH_REQUIRED) {
    deviations.push({
      id: 'DEPTH_TOO_SHALLOW',
      severity: 'WARNING',
      angleName: 'avgKneeAngle',
      observed: minKneeAngle,
      threshold: SQUAT.MIN_DEPTH_REQUIRED,
    })
  }

  return deviations
}

// ── Push-Up Deviations ────────────────────────────────────────────────────────

/**
 * Per-frame push-up deviations.
 */
export function detectPushUpFrameDeviations(pa: PushUpAngles): Deviation[] {
  const deviations: Deviation[] = []

  // Elbow asymmetry
  if (pa.leftElbow !== null && pa.rightElbow !== null) {
    const diff = Math.abs(pa.leftElbow - pa.rightElbow)
    if (diff > PUSHUP.ELBOW_ASYMMETRY_THRESHOLD) {
      deviations.push({
        id: 'ELBOW_ASYMMETRY',
        severity: 'WARNING',
        angleName: 'elbowAngle',
        observed: diff,
        threshold: PUSHUP.ELBOW_ASYMMETRY_THRESHOLD,
      })
    }
  }

  // Shoulder alignment (either side)
  if (pa.leftShoulder !== null && pa.leftShoulder > PUSHUP.SHOULDER_ALIGNMENT_MAX) {
    deviations.push({
      id: 'SHOULDER_ALIGNMENT',
      severity: 'INFO',
      angleName: 'leftShoulderAngle',
      observed: pa.leftShoulder,
      threshold: PUSHUP.SHOULDER_ALIGNMENT_MAX,
    })
  } else if (pa.rightShoulder !== null && pa.rightShoulder > PUSHUP.SHOULDER_ALIGNMENT_MAX) {
    deviations.push({
      id: 'SHOULDER_ALIGNMENT',
      severity: 'INFO',
      angleName: 'rightShoulderAngle',
      observed: pa.rightShoulder,
      threshold: PUSHUP.SHOULDER_ALIGNMENT_MAX,
    })
  }

  return deviations
}

/**
 * Post-rep push-up deviations.
 *
 * @param minElbowAngle - Minimum elbow angle reached during the rep.
 */
export function detectPushUpRepDeviations(minElbowAngle: number): Deviation[] {
  const deviations: Deviation[] = []

  if (minElbowAngle > PUSHUP.MIN_DEPTH_REQUIRED) {
    deviations.push({
      id: 'DEPTH_TOO_SHALLOW',
      severity: 'WARNING',
      angleName: 'avgElbowAngle',
      observed: minElbowAngle,
      threshold: PUSHUP.MIN_DEPTH_REQUIRED,
    })
  }

  return deviations
}

// ── Curl Deviations ───────────────────────────────────────────────────────────

/**
 * Per-frame curl deviations.
 *
 * @param activeArmShoulder - Shoulder stability angle for the active arm.
 * @param shoulderBaseline  - Baseline shoulder angle captured at EXTENDED.
 */
export function detectCurlFrameDeviations(
  activeArmShoulder: number | null,
  shoulderBaseline: number | null,
): Deviation[] {
  const deviations: Deviation[] = []

  if (
    activeArmShoulder !== null &&
    shoulderBaseline !== null
  ) {
    const deviation = Math.abs(activeArmShoulder - shoulderBaseline)
    if (deviation > CURL.SHOULDER_MOVEMENT_MAX_DEVIATION) {
      deviations.push({
        id: 'SHOULDER_MOVEMENT',
        severity: 'INFO',
        angleName: 'shoulderStability',
        observed: deviation,
        threshold: CURL.SHOULDER_MOVEMENT_MAX_DEVIATION,
      })
    }
  }

  return deviations
}

/**
 * Post-rep curl deviations.
 *
 * @param minElbowAngle - Minimum elbow angle reached (peak contraction).
 * @param maxElbowAngle - Maximum elbow angle reached on return (extension).
 */
export function detectCurlRepDeviations(
  minElbowAngle: number,
  maxElbowAngle: number,
): Deviation[] {
  const deviations: Deviation[] = []

  if (minElbowAngle > CURL.MIN_CURL_REQUIRED) {
    deviations.push({
      id: 'INCOMPLETE_CURL',
      severity: 'WARNING',
      angleName: 'activeArmElbow',
      observed: minElbowAngle,
      threshold: CURL.MIN_CURL_REQUIRED,
    })
  }

  if (maxElbowAngle < CURL.MIN_EXTENSION_REQUIRED) {
    deviations.push({
      id: 'INCOMPLETE_EXTENSION',
      severity: 'WARNING',
      angleName: 'activeArmElbow',
      observed: maxElbowAngle,
      threshold: CURL.MIN_EXTENSION_REQUIRED,
    })
  }

  return deviations
}

// ── Form Status Derivation ────────────────────────────────────────────────────

import type { FormStatus } from './analysisTypes'

/**
 * Derives an aggregate FormStatus from a list of deviations.
 * GOOD if no WARNING or ERROR deviations exist.
 */
export function deriveFormStatus(deviations: Deviation[]): FormStatus {
  if (deviations.some((d) => d.severity === 'ERROR' || d.severity === 'WARNING')) {
    return 'WARNING'
  }
  return 'GOOD'
}
