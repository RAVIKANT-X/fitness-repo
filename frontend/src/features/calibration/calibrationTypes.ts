/**
 * Calibration feature — types.
 *
 * Flow:
 *   EXPLAIN → STEP (n of N) → REPORT → LIVE
 *
 * Each ExerciseStep is one named position the user must hold.
 * The engine watches the relevant angles for that step, samples frames,
 * and emits a StepResult with a 0–100 score and any detected issues.
 *
 * After all steps pass, a MovementProfile is assembled and shown as the
 * pre-workout AI report before the live session begins.
 */

import type { AngleDefinition } from '../biomechanics/biomechanicsTypes'
import type { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Step definition ───────────────────────────────────────────────────────────

export interface AngleTarget {
  /** Which angle to evaluate (must match an AngleDefinition name). */
  angleName: string
  /** Ideal target value in degrees (shown to user). */
  idealDegrees: number
  /**
   * Tolerance: ±toleranceDegrees from ideal is "correct".
   * Outside tolerance but within 2× tolerance = partial.
   * More than 2× outside = wrong.
   */
  toleranceDegrees: number
  /** Human-readable label for the report (e.g. "Knee bend"). */
  label: string
}

export interface ExerciseStep {
  /** 1-based step number (set automatically by calibrationEngine). */
  number: number
  /** Short title shown in the UI (e.g. "Start Position"). */
  title: string
  /** One-sentence instruction telling the user what to do. */
  instruction: string
  /** Which body landmarks must be visible for this step. */
  requiredLandmarks: PoseLandmark[]
  /** Angle definitions needed only for this step (subset of the exercise's). */
  angles: AngleDefinition[]
  /** Scoring targets: what angles to measure and what is "correct". */
  targets: AngleTarget[]
  /**
   * How many consecutive "correct" frames are needed to pass.
   * Default: 15 frames (~0.5 s at 30 fps).
   */
  holdFrames?: number
  /**
   * Text correction shown when the step fails.
   * Displayed alongside the captured bad frame.
   */
  correction: string
}

// ── Step result ───────────────────────────────────────────────────────────────

export interface StepResult {
  step: ExerciseStep
  /** 0–100. 100 = perfectly on target; 0 = never close. */
  score: number
  /**
   * The specific deviations detected during the step evaluation.
   * Each entry names the angle, the observed value, and what was ideal.
   */
  issues: StepIssue[]
  /** Whether the step was eventually passed (even after retries). */
  passed: boolean
  /** Number of attempts the user needed. */
  attempts: number
}

export interface StepIssue {
  angleName: string
  label: string
  observed: number
  ideal: number
  toleranceDegrees: number
}

// ── Movement profile ──────────────────────────────────────────────────────────

export interface MovementProfile {
  exerciseId: string
  exerciseName: string
  stepResults: StepResult[]
  /** Index (0-based) of the weakest step. */
  weakestStepIndex: number
  /** Overall score averaged across all steps. */
  overallScore: number
  /** ISO timestamp when calibration was completed. */
  completedAt: string
}

// ── Calibration machine state ─────────────────────────────────────────────────

export type CalibrationStage =
  | 'EXPLAIN'       // AI briefing shown before any camera
  | 'STEP'          // Actively evaluating a step
  | 'STEP_FAILED'   // Step was wrong — show correction, allow retry
  | 'REPORT'        // All steps done — show movement profile report
  | 'LIVE'          // Transition to live workout

export interface CalibrationState {
  stage: CalibrationStage
  currentStepIndex: number      // 0-based index into exercise.steps
  stepAttempts: number[]        // attempt count per step
  stepResults: StepResult[]     // accumulated results (one per completed step)
  /** Live frame buffer for current step — last N angle snapshots. */
  frameBuffer: FrameSnapshot[]
  /** Frames that have passed the target check consecutively. */
  consecutivePassFrames: number
}

export interface FrameSnapshot {
  angleName: string
  degrees: number
}
