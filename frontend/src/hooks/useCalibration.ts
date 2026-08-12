/**
 * useCalibration — state machine hook for the Learn & Calibrate flow.
 *
 * Drives the full calibration pipeline:
 *   EXPLAIN → STEP (per step) → STEP_FAILED (on wrong) → REPORT → LIVE
 *
 * Each step:
 *   1. Reads pose frames via `poses` prop.
 *   2. Calls evaluateFrame() on every frame while stage === 'STEP'.
 *   3. Accumulates consecutive passing frames.
 *   4. When consecutivePassFrames >= step.holdFrames → PASS → advance.
 *   5. On FAIL → capture the last frame evaluation → show correction.
 *
 * Returns:
 *   stage, currentStep, stepResults, liveEval, progressPct, handlers.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import type { PoseResult } from '../features/pose/poseTypes'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'
import type {
  CalibrationStage,
  StepResult,
  MovementProfile,
} from '../features/calibration/calibrationTypes'
import {
  evaluateFrame,
  averageFrameScores,
  buildStepIssues,
} from '../features/calibration/calibrationEngine'
import { getStepsForExercise } from '../features/calibration/exerciseSteps'
import type { FrameEvaluation } from '../features/calibration/calibrationEngine'

const DEFAULT_HOLD_FRAMES = 15    // ~0.5 s at 30 fps
const FAIL_WINDOW = 30            // check after 30 frames if still failing

interface UseCalibrationOptions {
  poses: PoseResult[]
  exercise: ExerciseDefinition | null
}

interface UseCalibrationReturn {
  stage: CalibrationStage
  currentStepIndex: number
  steps: ReturnType<typeof getStepsForExercise>
  stepResults: StepResult[]
  liveEval: FrameEvaluation | null
  consecutivePassFrames: number
  holdFramesRequired: number
  movementProfile: MovementProfile | null
  /** User confirmed they read the explanation. Start step 0. */
  handleStartCalibration: () => void
  /** User wants to retry the current step after a failure. */
  handleRetryStep: () => void
  /** All steps passed — transition to live workout. */
  handleStartLive: () => void
}

export function useCalibration({
  poses,
  exercise,
}: UseCalibrationOptions): UseCalibrationReturn {
  const steps = exercise ? getStepsForExercise(exercise.id) : []

  const [stage, setStage] = useState<CalibrationStage>('EXPLAIN')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [liveEval, setLiveEval] = useState<FrameEvaluation | null>(null)
  const [consecutivePassFrames, setConsecutivePassFrames] = useState(0)
  const [movementProfile, setMovementProfile] = useState<MovementProfile | null>(null)

  // Refs for frame-level state (avoid stale closures in rAF)
  const consecutivePassRef = useRef(0)
  const frameScoreWindowRef = useRef<number[]>([])
  const frameCountRef = useRef(0)
  const stageRef = useRef<CalibrationStage>('EXPLAIN')
  const currentStepIndexRef = useRef(0)
  const stepAttemptsRef = useRef<number[]>([])

  // Keep refs in sync
  useEffect(() => { stageRef.current = stage }, [stage])
  useEffect(() => { currentStepIndexRef.current = currentStepIndex }, [currentStepIndex])

  // Reset everything when exercise changes
  useEffect(() => {
    setStage('EXPLAIN')
    setCurrentStepIndex(0)
    setStepResults([])
    setLiveEval(null)
    setConsecutivePassFrames(0)
    setMovementProfile(null)
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    stepAttemptsRef.current = []
    stageRef.current = 'EXPLAIN'
    currentStepIndexRef.current = 0
  }, [exercise?.id])

  // ── Frame analysis loop ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stageRef.current !== 'STEP') return
    if (!exercise || steps.length === 0) return
    if (poses.length === 0 || poses[0].landmarks.length === 0) return

    const stepIndex = currentStepIndexRef.current
    const step = steps[stepIndex]
    if (!step) return

    const poseResult = poses[0]
    // Use normalised landmarks for angle calc (same as analysis engine)
    const eval_ = evaluateFrame(poseResult.landmarks, step)

    // Update live display
    setLiveEval(eval_)

    const holdRequired = step.holdFrames ?? DEFAULT_HOLD_FRAMES
    frameCountRef.current += 1

    if (eval_.passing && eval_.landmarksValid) {
      consecutivePassRef.current += 1
      frameScoreWindowRef.current.push(eval_.frameScore)
      setConsecutivePassFrames(consecutivePassRef.current)

      if (consecutivePassRef.current >= holdRequired) {
        // ── STEP PASSED ────────────────────────────────────────────────────
        const score = averageFrameScores(frameScoreWindowRef.current)
        const attempts = stepAttemptsRef.current[stepIndex] ?? 1

        const result: StepResult = {
          step,
          score,
          issues: buildStepIssues(eval_),
          passed: true,
          attempts,
        }

        // Reset per-step counters
        consecutivePassRef.current = 0
        frameScoreWindowRef.current = []
        frameCountRef.current = 0
        setConsecutivePassFrames(0)

        const newResults = [...stepResults, result]
        setStepResults(newResults)

        const nextIndex = stepIndex + 1

        if (nextIndex >= steps.length) {
          // ── ALL STEPS DONE — build movement profile ──────────────────────
          const overallScore = Math.round(
            newResults.reduce((s, r) => s + r.score, 0) / newResults.length,
          )
          const weakestIndex = newResults.reduce(
            (minI, r, i, arr) => (r.score < arr[minI].score ? i : minI),
            0,
          )
          const profile: MovementProfile = {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            stepResults: newResults,
            weakestStepIndex: weakestIndex,
            overallScore,
            completedAt: new Date().toISOString(),
          }
          setMovementProfile(profile)
          setStage('REPORT')
          stageRef.current = 'REPORT'
        } else {
          setCurrentStepIndex(nextIndex)
          currentStepIndexRef.current = nextIndex
        }
      }
    } else {
      // Not passing — reset consecutive run
      consecutivePassRef.current = 0
      frameScoreWindowRef.current = []
      setConsecutivePassFrames(0)

      // After FAIL_WINDOW frames with no pass — show correction
      if (eval_.landmarksValid && frameCountRef.current >= FAIL_WINDOW) {
        const score = Math.max(0, eval_.frameScore - 10)  // penalise for repeated failure
        const attempts = (stepAttemptsRef.current[stepIndex] ?? 0) + 1
        stepAttemptsRef.current[stepIndex] = attempts

        // Build a partial result for display purposes
        const failResult: StepResult = {
          step,
          score,
          issues: buildStepIssues(eval_),
          passed: false,
          attempts,
        }

        // Store as preliminary result (will be overwritten on pass)
        setStepResults((prev) => {
          const next = [...prev]
          next[stepIndex] = failResult
          return next
        })

        frameCountRef.current = 0   // reset window so it can trigger again if still wrong
        setStage('STEP_FAILED')
        stageRef.current = 'STEP_FAILED'
      }
    }
  }, [poses, exercise, steps, stepResults])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartCalibration = useCallback(() => {
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    setStepResults([])
    setCurrentStepIndex(0)
    currentStepIndexRef.current = 0
    setConsecutivePassFrames(0)
    setStage('STEP')
    stageRef.current = 'STEP'
  }, [])

  const handleRetryStep = useCallback(() => {
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    setConsecutivePassFrames(0)
    // Remove the failed partial result for this step
    setStepResults((prev) => prev.slice(0, currentStepIndexRef.current))
    setStage('STEP')
    stageRef.current = 'STEP'
  }, [])

  const handleStartLive = useCallback(() => {
    setStage('LIVE')
    stageRef.current = 'LIVE'
  }, [])

  const holdFramesRequired =
    steps[currentStepIndex]?.holdFrames ?? DEFAULT_HOLD_FRAMES

  return {
    stage,
    currentStepIndex,
    steps,
    stepResults,
    liveEval,
    consecutivePassFrames,
    holdFramesRequired,
    movementProfile,
    handleStartCalibration,
    handleRetryStep,
    handleStartLive,
  }
}
