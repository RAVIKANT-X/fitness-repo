/**
 * Calibration engine — pure, stateless frame evaluator.
 *
 * evaluateFrame():
 *   Takes a single pose frame + the current step definition,
 *   returns per-angle scores and an overall pass/fail verdict.
 *
 * scoreAngles():
 *   Computes a 0–100 score for a set of AngleTargets against measured angles.
 *   100 = on target; 0 = far outside twice the tolerance.
 *
 * No React, no side effects, no singletons — fully unit-testable.
 */

import { calculateExerciseAngles } from '../biomechanics/angles'
import { areLandmarksVisible } from '../biomechanics/landmarkMapping'
import type { NormalizedLandmark } from '../pose/poseTypes'
import type { ExerciseStep, AngleTarget, StepIssue } from './calibrationTypes'

// ── Frame evaluation ──────────────────────────────────────────────────────────

export interface FrameEvaluation {
  /** Whether required landmarks are visible. */
  landmarksValid: boolean
  /** 0–100 overall step score for this single frame. */
  frameScore: number
  /** Per-target detail. */
  targetEvals: TargetEval[]
  /** True if every target is within tolerance. */
  passing: boolean
}

export interface TargetEval {
  target: AngleTarget
  observed: number
  valid: boolean
  withinTolerance: boolean
  score: number        // 0–100 for this single target
}

export function evaluateFrame(
  landmarks: NormalizedLandmark[],
  step: ExerciseStep,
): FrameEvaluation {
  // 1. Validate required landmarks
  const landmarksValid = areLandmarksVisible(landmarks, step.requiredLandmarks)
  if (!landmarksValid) {
    return { landmarksValid: false, frameScore: 0, targetEvals: [], passing: false }
  }

  // 2. Calculate all angles for this step
  const angles = calculateExerciseAngles(step.angles, landmarks)

  // 3. Score each target
  const targetEvals: TargetEval[] = step.targets.map((target) => {
    const result = angles[target.angleName]
    if (!result || !result.valid) {
      return {
        target,
        observed: 0,
        valid: false,
        withinTolerance: false,
        score: 0,
      }
    }
    const diff = Math.abs(result.degrees - target.idealDegrees)
    const withinTolerance = diff <= target.toleranceDegrees
    // Linear score: 100 at 0 diff, 0 at 2× tolerance
    const score = Math.max(0, Math.round(100 - (diff / (target.toleranceDegrees * 2)) * 100))
    return {
      target,
      observed: Math.round(result.degrees),
      valid: true,
      withinTolerance,
      score,
    }
  })

  const validEvals = targetEvals.filter((e) => e.valid)
  const frameScore = validEvals.length > 0
    ? Math.round(validEvals.reduce((sum, e) => sum + e.score, 0) / validEvals.length)
    : 0
  const passing = validEvals.length > 0 && validEvals.every((e) => e.withinTolerance)

  return { landmarksValid: true, frameScore, targetEvals, passing }
}

// ── Step result scoring ───────────────────────────────────────────────────────

/**
 * Called once when a step is confirmed passed or the user moves on.
 * Aggregates the rolling frame scores into a final StepResult.
 */
export function buildStepIssues(
  lastEval: FrameEvaluation,
): StepIssue[] {
  return lastEval.targetEvals
    .filter((e) => e.valid && !e.withinTolerance)
    .map((e) => ({
      angleName: e.target.angleName,
      label: e.target.label,
      observed: e.observed,
      ideal: e.target.idealDegrees,
      toleranceDegrees: e.target.toleranceDegrees,
    }))
}

/**
 * Compute a rolling average score from a window of recent frame scores.
 */
export function averageFrameScores(scores: number[]): number {
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}
