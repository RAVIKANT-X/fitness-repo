/**
 * Human Detection — validates that MediaPipe landmarks represent a real human.
 *
 * Uses MediaPipe landmark visibility scores as the validation layer.
 * Does NOT add a separate heavy object detection model.
 *
 * Detection States:
 *   NO_PERSON       — no pose landmarks detected
 *   LOW_CONFIDENCE  — landmarks detected but visibility is very low
 *   PARTIAL_PERSON  — some key landmarks visible but not enough for the exercise
 *   VALID_PERSON    — full body visible with sufficient confidence
 *
 * This rejects:
 *   - Dogs, cats, furniture, empty rooms → no landmarks detected
 *   - Partial frames (head only, legs only) → insufficient visibility
 *   - Low-confidence detections → visibility below threshold
 */

import type { NormalizedLandmark } from '../pose/poseTypes'

// ── Detection state ───────────────────────────────────────────────────────────

export type HumanDetectionState =
  | 'NO_PERSON'
  | 'LOW_CONFIDENCE'
  | 'PARTIAL_PERSON'
  | 'VALID_PERSON'

export interface HumanDetectionResult {
  state: HumanDetectionState
  /** 0–1 confidence that a valid human is detected */
  confidence: number
  /** Human-readable message for the UI */
  message: string
  /** Whether analysis should proceed */
  valid: boolean
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Minimum visibility for a landmark to be considered "present" */
const MIN_VISIBILITY = 0.45

/** Minimum number of key torso landmarks that must be visible */
const MIN_TORSO_VISIBLE = 4

/** Minimum average visibility across all key landmarks */
const MIN_AVERAGE_VISIBILITY = 0.55

/** Key landmark groups for detection */
const TORSO_LANDMARKS = [11, 12, 23, 24] as const  // shoulders + hips
const HEAD_LANDMARKS  = [0, 7, 8] as const           // nose + ears
const LEG_LANDMARKS   = [25, 26, 27, 28] as const    // knees + ankles
const ARM_LANDMARKS   = [13, 14, 15, 16] as const    // elbows + wrists

// ── Exercise-specific required landmarks ─────────────────────────────────────

const EXERCISE_REQUIRED: Record<string, readonly number[]> = {
  squat:  [...TORSO_LANDMARKS, ...LEG_LANDMARKS],
  pushup: [...TORSO_LANDMARKS, ...ARM_LANDMARKS],
  curl:   [...TORSO_LANDMARKS, ...ARM_LANDMARKS],
}

// ── Detection logic ───────────────────────────────────────────────────────────

/**
 * Determines whether a detected pose represents a valid human.
 *
 * @param landmarks   - 33 MediaPipe pose landmarks
 * @param exerciseId  - Optional: validate for specific exercise requirements
 */
export function detectHuman(
  landmarks: NormalizedLandmark[],
  exerciseId?: string,
): HumanDetectionResult {
  // No landmarks at all → nothing detected
  if (!landmarks || landmarks.length === 0) {
    return {
      state:      'NO_PERSON',
      confidence: 0,
      message:    'Step into frame to begin.',
      valid:      false,
    }
  }

  // Check torso visibility — critical for any human detection
  const torsoVisible = TORSO_LANDMARKS.filter(
    (i) => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY,
  ).length

  if (torsoVisible === 0) {
    return {
      state:      'NO_PERSON',
      confidence: 0,
      message:    'Human body not detected.',
      valid:      false,
    }
  }

  // Compute average visibility of all key landmarks
  const allKey = [...TORSO_LANDMARKS, ...HEAD_LANDMARKS, ...LEG_LANDMARKS, ...ARM_LANDMARKS]
  const visibilities = allKey.map((i) => landmarks[i]?.visibility ?? 0)
  const avgVis = visibilities.reduce((a, b) => a + b, 0) / visibilities.length

  // Very low confidence
  if (avgVis < 0.25 || torsoVisible < 2) {
    return {
      state:      'LOW_CONFIDENCE',
      confidence: avgVis,
      message:    'Move closer to the camera.',
      valid:      false,
    }
  }

  // Check exercise-specific requirements
  if (exerciseId) {
    const required = EXERCISE_REQUIRED[exerciseId] ?? TORSO_LANDMARKS
    const visibleCount = required.filter(
      (i) => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY,
    ).length

    const visibleFraction = visibleCount / required.length

    if (visibleFraction < 0.6) {
      return {
        state:      'PARTIAL_PERSON',
        confidence: visibleFraction,
        message:    'Full body required. Step back to show your full body.',
        valid:      false,
      }
    }
  }

  // Check torso meets minimum
  if (torsoVisible < MIN_TORSO_VISIBLE) {
    return {
      state:      'PARTIAL_PERSON',
      confidence: avgVis,
      message:    'Full body required for this exercise.',
      valid:      false,
    }
  }

  // Valid human with sufficient confidence
  if (avgVis < MIN_AVERAGE_VISIBILITY) {
    return {
      state:      'LOW_CONFIDENCE',
      confidence: avgVis,
      message:    'Improve lighting or move closer.',
      valid:      false,
    }
  }

  return {
    state:      'VALID_PERSON',
    confidence: avgVis,
    message:    '',
    valid:      true,
  }
}

/**
 * Validates a set of specific required landmark indices for an exercise step.
 */
export function validateExerciseLandmarks(
  landmarks: NormalizedLandmark[],
  requiredLandmarkIndices: readonly number[],
): boolean {
  if (!landmarks || landmarks.length === 0) return false
  const visibleCount = requiredLandmarkIndices.filter(
    (i) => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY,
  ).length
  return visibleCount / requiredLandmarkIndices.length >= 0.75
}
