/**
 * Analysis engine — the top-level entry point for Phase 4 analysis.
 *
 * API:
 *   analyze(poseResult, exerciseDefinition, previousState) → AnalysisResult
 *
 * Pipeline:
 *   1. Validate required landmarks (areLandmarksVisible)
 *   2. Calculate joint angles (calculateExerciseAngles — Phase 3)
 *   3. Dispatch to the exercise-specific analyser
 *   4. Derive form status from deviations
 *   5. Return AnalysisResult with updated state
 *
 * The engine is:
 *   - Pure: no React, no side effects, no singleton state
 *   - Deterministic: same inputs → same outputs (testable without camera)
 *   - Exercise-agnostic at the top level: dispatches by exerciseDefinition.id
 *
 * Consumers:
 *   - useAnalysis hook (React bridge)
 *   - Unit tests (synthetic landmark data)
 */

import type { PoseResult } from '../pose/poseTypes'
import type { ExerciseDefinition } from '../exercise/exerciseTypes'
import type { AnalysisResult, AnalysisState, FormStatus } from './analysisTypes'
import { createInitialAnalysisState } from './analysisTypes'
import { calculateExerciseAngles } from '../biomechanics/angles'
import { areLandmarksVisible } from '../biomechanics/landmarkMapping'
import { deriveFormStatus } from './deviationDetector'
import { analyzeSquat, analyzePushUp, analyzeCurl } from './exerciseAnalyzers'

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Analyses a single pose frame for the given exercise.
 *
 * @param poseResult         - Latest pose result from MediaPipe.
 * @param exerciseDef        - The active ExerciseDefinition (from Phase 3 library).
 * @param previousState      - Analysis state from the previous frame.
 *                             Pass createInitialAnalysisState() on the first frame.
 * @returns AnalysisResult   - Contains updated state + all UI-consumable fields.
 */
export function analyze(
  poseResult: PoseResult,
  exerciseDef: ExerciseDefinition,
  previousState: AnalysisState,
): AnalysisResult {
  // ── 1. Landmark validity check ────────────────────────────────────────────
  const landmarksValid = areLandmarksVisible(
    poseResult.worldLandmarks,
    exerciseDef.requiredLandmarks,
  )

  if (!landmarksValid) {
    // Preserve rep count and cycle state so they survive a brief occlusion,
    // but set phase to INVALID so nothing advances while landmarks are bad.
    const invalidState: AnalysisState = {
      ...previousState,
      currentPhase: 'INVALID',
    }
    return {
      exerciseId: exerciseDef.id,
      landmarksValid: false,
      currentPhase: 'INVALID',
      repCycleState: previousState.repCycleState,
      repCount: previousState.repCount,
      formStatus: 'INVALID',
      activeDeviations: [],
      angles: {},
      nextState: invalidState,
    }
  }

  // ── 2. Calculate joint angles (Phase 3) ───────────────────────────────────
  const angles = calculateExerciseAngles(
    exerciseDef.primaryAngles,
    poseResult.worldLandmarks,
  )

  // ── 3. Exercise-specific analysis ─────────────────────────────────────────
  const nextState = dispatchAnalyzer(exerciseDef.id, angles, previousState)

  // ── 4. Form status ────────────────────────────────────────────────────────
  // During an in-progress rep: evaluate frame deviations
  // After rep complete: display the completed rep's deviations (stable)
  const activeDeviations =
    nextState.repCycleState === 'IDLE'
      ? nextState.lastCompletedRepDeviations
      : nextState.repDeviations

  const formStatus: FormStatus =
    nextState.currentPhase === 'INVALID'
      ? 'INVALID'
      : deriveFormStatus(activeDeviations)

  // ── 5. Return result ──────────────────────────────────────────────────────
  return {
    exerciseId: exerciseDef.id,
    landmarksValid: true,
    currentPhase: nextState.currentPhase,
    repCycleState: nextState.repCycleState,
    repCount: nextState.repCount,
    formStatus,
    activeDeviations,
    angles,
    nextState,
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function dispatchAnalyzer(
  exerciseId: string,
  angles: ReturnType<typeof calculateExerciseAngles>,
  prev: AnalysisState,
): AnalysisState {
  switch (exerciseId) {
    case 'squat':
      return analyzeSquat(angles, prev)
    case 'pushup':
      return analyzePushUp(angles, prev)
    case 'curl':
      return analyzeCurl(angles, prev)
    default:
      // Unknown exercise — return previous state unchanged
      return prev
  }
}

// ── Re-export for convenience ─────────────────────────────────────────────────
export { createInitialAnalysisState }
