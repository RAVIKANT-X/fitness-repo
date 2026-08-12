/**
 * Exercise feature — shared types.
 *
 * ExerciseDefinition is the single source of truth for what an exercise IS
 * (its structure, relevant joints, required landmarks).
 *
 * It deliberately does NOT contain:
 *  - angle thresholds or acceptable ranges  (Phase 4)
 *  - rep phases (up/down/hold)              (Phase 4)
 *  - deviation rules                        (Phase 4)
 *  - coaching messages                      (Phase 5)
 *
 * The schema is designed so Phase 4 can consume it directly without
 * modification.
 */

import type { AngleDefinition } from '../biomechanics/biomechanicsTypes'
import type { PoseLandmark } from '../biomechanics/landmarkMapping'

export interface ExerciseDefinition {
  /** URL-safe unique identifier (e.g. "squat", "pushup", "curl"). */
  id: string

  /** Human-readable display name. */
  name: string

  /** One-sentence description shown in the exercise selection UI. */
  description: string

  /** Primary muscle groups — used for display only. */
  muscleGroups: string[]

  /**
   * The joint angles that characterise this exercise.
   * Phase 4 will evaluate these angles on every frame to detect movement
   * phases and form deviations.
   */
  primaryAngles: AngleDefinition[]

  /**
   * All landmarks that must be visible for this exercise to be analysed.
   * Phase 4 uses areLandmarksVisible() with this list before running
   * angle calculations — if any are occluded, the frame is skipped.
   */
  requiredLandmarks: PoseLandmark[]
}
