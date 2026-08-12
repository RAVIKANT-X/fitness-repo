/**
 * Exercise library — the central registry of supported exercises.
 *
 * Each definition describes the biomechanical structure of one exercise.
 * No thresholds, rep logic, or form rules are included here.
 *
 * Adding a new exercise in a future phase:
 *  1. Create an ExerciseDefinition below.
 *  2. Add it to EXERCISE_LIBRARY.
 *  3. No other file needs to change for Phase 4 to pick it up.
 */

import type { ExerciseDefinition } from './exerciseTypes'
import { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Squat ─────────────────────────────────────────────────────────────────────
const squat: ExerciseDefinition = {
  id: 'squat',
  name: 'Squat',
  description: 'A fundamental lower-body compound movement targeting quads, glutes, and core.',
  muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings', 'Core'],
  primaryAngles: [
    {
      name: 'leftKneeAngle',
      pointA: PoseLandmark.LEFT_HIP,
      vertex: PoseLandmark.LEFT_KNEE,
      pointC: PoseLandmark.LEFT_ANKLE,
    },
    {
      name: 'rightKneeAngle',
      pointA: PoseLandmark.RIGHT_HIP,
      vertex: PoseLandmark.RIGHT_KNEE,
      pointC: PoseLandmark.RIGHT_ANKLE,
    },
    {
      name: 'leftHipAngle',
      pointA: PoseLandmark.LEFT_SHOULDER,
      vertex: PoseLandmark.LEFT_HIP,
      pointC: PoseLandmark.LEFT_KNEE,
    },
    {
      name: 'rightHipAngle',
      pointA: PoseLandmark.RIGHT_SHOULDER,
      vertex: PoseLandmark.RIGHT_HIP,
      pointC: PoseLandmark.RIGHT_KNEE,
    },
  ],
  requiredLandmarks: [
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
    PoseLandmark.LEFT_KNEE,
    PoseLandmark.RIGHT_KNEE,
    PoseLandmark.LEFT_ANKLE,
    PoseLandmark.RIGHT_ANKLE,
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
  ],
}

// ── Push-Up ───────────────────────────────────────────────────────────────────
const pushUp: ExerciseDefinition = {
  id: 'pushup',
  name: 'Push-Up',
  description: 'An upper-body pushing exercise targeting chest, triceps, and shoulders.',
  muscleGroups: ['Chest', 'Triceps', 'Shoulders', 'Core'],
  primaryAngles: [
    {
      name: 'leftElbowAngle',
      pointA: PoseLandmark.LEFT_SHOULDER,
      vertex: PoseLandmark.LEFT_ELBOW,
      pointC: PoseLandmark.LEFT_WRIST,
    },
    {
      name: 'rightElbowAngle',
      pointA: PoseLandmark.RIGHT_SHOULDER,
      vertex: PoseLandmark.RIGHT_ELBOW,
      pointC: PoseLandmark.RIGHT_WRIST,
    },
    {
      // Measures upper-arm / torso alignment — should stay close to 180°
      // in a good push-up (elbows not flaring excessively)
      name: 'leftShoulderAngle',
      pointA: PoseLandmark.LEFT_ELBOW,
      vertex: PoseLandmark.LEFT_SHOULDER,
      pointC: PoseLandmark.LEFT_HIP,
    },
    {
      name: 'rightShoulderAngle',
      pointA: PoseLandmark.RIGHT_ELBOW,
      vertex: PoseLandmark.RIGHT_SHOULDER,
      pointC: PoseLandmark.RIGHT_HIP,
    },
  ],
  requiredLandmarks: [
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.LEFT_ELBOW,
    PoseLandmark.RIGHT_ELBOW,
    PoseLandmark.LEFT_WRIST,
    PoseLandmark.RIGHT_WRIST,
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
  ],
}

// ── Bicep Curl ────────────────────────────────────────────────────────────────
const curl: ExerciseDefinition = {
  id: 'curl',
  name: 'Bicep Curl',
  description: 'An isolation exercise for the biceps performed with the arm curling at the elbow.',
  muscleGroups: ['Biceps', 'Forearms'],
  primaryAngles: [
    {
      name: 'leftElbowAngle',
      pointA: PoseLandmark.LEFT_SHOULDER,
      vertex: PoseLandmark.LEFT_ELBOW,
      pointC: PoseLandmark.LEFT_WRIST,
    },
    {
      name: 'rightElbowAngle',
      pointA: PoseLandmark.RIGHT_SHOULDER,
      vertex: PoseLandmark.RIGHT_ELBOW,
      pointC: PoseLandmark.RIGHT_WRIST,
    },
    {
      // Upper-arm stability: measures how much the shoulder lifts during the curl.
      // Should remain close to its starting value throughout the movement.
      name: 'leftShoulderStability',
      pointA: PoseLandmark.LEFT_ELBOW,
      vertex: PoseLandmark.LEFT_SHOULDER,
      pointC: PoseLandmark.LEFT_HIP,
    },
    {
      name: 'rightShoulderStability',
      pointA: PoseLandmark.RIGHT_ELBOW,
      vertex: PoseLandmark.RIGHT_SHOULDER,
      pointC: PoseLandmark.RIGHT_HIP,
    },
  ],
  requiredLandmarks: [
    PoseLandmark.LEFT_SHOULDER,
    PoseLandmark.RIGHT_SHOULDER,
    PoseLandmark.LEFT_ELBOW,
    PoseLandmark.RIGHT_ELBOW,
    PoseLandmark.LEFT_WRIST,
    PoseLandmark.RIGHT_WRIST,
    PoseLandmark.LEFT_HIP,
    PoseLandmark.RIGHT_HIP,
  ],
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * The central exercise library.
 * Index by `id` for O(1) lookup: `EXERCISE_MAP['squat']`
 * Iterate for display: `EXERCISE_LIBRARY`
 */
export const EXERCISE_LIBRARY: ExerciseDefinition[] = [squat, pushUp, curl]

export const EXERCISE_MAP: Record<string, ExerciseDefinition> = Object.fromEntries(
  EXERCISE_LIBRARY.map((ex) => [ex.id, ex]),
)

/** Convenience lookup — returns undefined for unknown IDs. */
export function getExerciseById(id: string): ExerciseDefinition | undefined {
  return EXERCISE_MAP[id]
}
