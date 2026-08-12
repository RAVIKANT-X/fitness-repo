/**
 * useCalibration — state machine hook for the Learn & Calibrate flow.
 *
 * Flow:  EXPLAIN → STEP (per step) → STEP_FAILED → REPORT → LIVE
 *
 * Manual controls (new):
 *   handleAnalyzeStep  — user taps "Analyze Step": snapshot current pose,
 *                        score it, pass or show correction.
 *   handleSkipStep     — user skips: records a 100-score pass with no issues.
 *
 * Auto-advance is kept as a fallback: if the user holds the position correctly
 * for holdFrames consecutive frames it still passes automatically.
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

const DEFAULT_HOLD_FRAMES = 20    // auto-advance: ~0.67 s at 30 fps

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
  /** User confirmed they read the explanation → start step 0. */
  handleStartCalibration: () => void
  /** Manually trigger analysis of the current pose snapshot. */
  handleAnalyzeStep: () => void
  /** Skip the current step entirely (records a perfect score). */
  handleSkipStep: () => void
  /** Retry after a failure. */
  handleRetryStep: () => void
  /** Transition to live workout. */
  handleStartLive: () => void
}

export function useCalibration({
  poses,
  exercise,
}: UseCalibrationOptions): UseCalibrationReturn {
  const steps = exercise ? getStepsForExercise(exercise.id) : []

  const [stage, setStage]                         = useState<CalibrationStage>('EXPLAIN')
  const [currentStepIndex, setCurrentStepIndex]   = useState(0)
  const [stepResults, setStepResults]             = useState<StepResult[]>([])
  const [liveEval, setLiveEval]                   = useState<FrameEvaluation | null>(null)
  const [consecutivePassFrames, setConsPass]      = useState(0)
  const [movementProfile, setMovementProfile]     = useState<MovementProfile | null>(null)

  // ── Refs (frame-hot-path — never cause re-renders) ────────────────────────
  const consecutivePassRef    = useRef(0)
  const frameScoreWindowRef   = useRef<number[]>([])
  const frameCountRef         = useRef(0)
  const stageRef              = useRef<CalibrationStage>('EXPLAIN')
  const currentStepIndexRef   = useRef(0)
  const stepAttemptsRef       = useRef<number[]>([])
  const latestPosesRef        = useRef<PoseResult[]>([])
  const latestEvalRef         = useRef<FrameEvaluation | null>(null)

  // Keep refs in sync with state
  useEffect(() => { stageRef.current = stage }, [stage])
  useEffect(() => { currentStepIndexRef.current = currentStepIndex }, [currentStepIndex])
  useEffect(() => { latestPosesRef.current = poses }, [poses])

  // ── Reset on exercise change ───────────────────────────────────────────────
  useEffect(() => {
    setStage('EXPLAIN');              stageRef.current = 'EXPLAIN'
    setCurrentStepIndex(0);           currentStepIndexRef.current = 0
    setStepResults([])
    setLiveEval(null);                latestEvalRef.current = null
    setConsPass(0);                   consecutivePassRef.current = 0
    setMovementProfile(null)
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    stepAttemptsRef.current = []
  }, [exercise?.id])

  // ── Shared: advance to next step or finish ────────────────────────────────
  const advanceStep = useCallback((
    newResults: StepResult[],
    nextIndex: number,
    exId: string,
    exName: string,
  ) => {
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    setConsPass(0)

    if (nextIndex >= steps.length) {
      const overallScore = Math.round(
        newResults.reduce((s, r) => s + r.score, 0) / newResults.length,
      )
      const weakestIndex = newResults.reduce(
        (minI, r, i, arr) => (r.score < arr[minI].score ? i : minI), 0,
      )
      const profile: MovementProfile = {
        exerciseId: exId,
        exerciseName: exName,
        stepResults: newResults,
        weakestStepIndex: weakestIndex,
        overallScore,
        completedAt: new Date().toISOString(),
      }
      setMovementProfile(profile)
      setStage('REPORT');  stageRef.current = 'REPORT'
    } else {
      setCurrentStepIndex(nextIndex)
      currentStepIndexRef.current = nextIndex
    }
  }, [steps.length])

  // ── Per-frame analysis loop (auto-advance on hold) ────────────────────────
  useEffect(() => {
    if (stageRef.current !== 'STEP') return
    if (!exercise || steps.length === 0) return
    if (poses.length === 0 || poses[0].landmarks.length === 0) return

    const stepIndex = currentStepIndexRef.current
    const step = steps[stepIndex]
    if (!step) return

    const eval_ = evaluateFrame(poses[0].landmarks, step)
    latestEvalRef.current = eval_
    setLiveEval(eval_)

    const holdRequired = step.holdFrames ?? DEFAULT_HOLD_FRAMES
    frameCountRef.current += 1

    if (eval_.passing && eval_.landmarksValid) {
      consecutivePassRef.current += 1
      frameScoreWindowRef.current.push(eval_.frameScore)
      setConsPass(consecutivePassRef.current)

      if (consecutivePassRef.current >= holdRequired) {
        // Auto-advance
        const score   = averageFrameScores(frameScoreWindowRef.current)
        const attempts = stepAttemptsRef.current[stepIndex] ?? 1
        const result: StepResult = { step, score, issues: [], passed: true, attempts }
        const newResults = [...stepResults, result]
        setStepResults(newResults)
        advanceStep(newResults, stepIndex + 1, exercise.id, exercise.name)
      }
    } else {
      consecutivePassRef.current = 0
      frameScoreWindowRef.current = []
      setConsPass(0)
    }
  }, [poses, exercise, steps, stepResults, advanceStep])

  // ── handleAnalyzeStep — manual snapshot & score ──────────────────────────
  const handleAnalyzeStep = useCallback(() => {
    if (stageRef.current !== 'STEP') return
    if (!exercise || steps.length === 0) return

    const stepIndex = currentStepIndexRef.current
    const step = steps[stepIndex]
    if (!step) return

    const poses_ = latestPosesRef.current
    if (poses_.length === 0 || poses_[0].landmarks.length === 0) return

    const eval_ = evaluateFrame(poses_[0].landmarks, step)
    latestEvalRef.current = eval_
    setLiveEval(eval_)

    const attempts = (stepAttemptsRef.current[stepIndex] ?? 0) + 1
    stepAttemptsRef.current[stepIndex] = attempts

    if (eval_.passing && eval_.landmarksValid) {
      // Pass
      const score = eval_.frameScore
      const result: StepResult = { step, score, issues: [], passed: true, attempts }
      const newResults = [...stepResults, result]
      setStepResults(newResults)
      consecutivePassRef.current = 0
      frameScoreWindowRef.current = []
      frameCountRef.current = 0
      setConsPass(0)
      advanceStep(newResults, stepIndex + 1, exercise.id, exercise.name)
    } else {
      // Fail — show correction
      const score = Math.max(0, eval_.frameScore - 5)
      const failResult: StepResult = {
        step, score,
        issues: buildStepIssues(eval_),
        passed: false, attempts,
      }
      setStepResults((prev) => { const n = [...prev]; n[stepIndex] = failResult; return n })
      frameCountRef.current = 0
      consecutivePassRef.current = 0
      frameScoreWindowRef.current = []
      setConsPass(0)
      setStage('STEP_FAILED');  stageRef.current = 'STEP_FAILED'
    }
  }, [exercise, steps, stepResults, advanceStep])

  // ── handleSkipStep — record a perfect pass and move on ────────────────────
  const handleSkipStep = useCallback(() => {
    if (!exercise || steps.length === 0) return
    const stepIndex = currentStepIndexRef.current
    const step = steps[stepIndex]
    if (!step) return

    const result: StepResult = {
      step, score: 100, issues: [], passed: true,
      attempts: stepAttemptsRef.current[stepIndex] ?? 0,
    }
    const newResults = [...stepResults, result]
    setStepResults(newResults)
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    setConsPass(0)
    // If we were in STEP_FAILED, go back to STEP state before advancing
    stageRef.current = 'STEP'
    setStage('STEP')
    advanceStep(newResults, stepIndex + 1, exercise.id, exercise.name)
  }, [exercise, steps, stepResults, advanceStep])

  // ── handleStartCalibration ────────────────────────────────────────────────
  const handleStartCalibration = useCallback(() => {
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    stepAttemptsRef.current = []
    setStepResults([])
    setCurrentStepIndex(0);  currentStepIndexRef.current = 0
    setConsPass(0)
    setStage('STEP');  stageRef.current = 'STEP'
  }, [])

  // ── handleRetryStep ───────────────────────────────────────────────────────
  const handleRetryStep = useCallback(() => {
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    setConsPass(0)
    setStepResults((prev) => prev.slice(0, currentStepIndexRef.current))
    setStage('STEP');  stageRef.current = 'STEP'
  }, [])

  // ── handleStartLive ───────────────────────────────────────────────────────
  const handleStartLive = useCallback(() => {
    setStage('LIVE');  stageRef.current = 'LIVE'
  }, [])

  const holdFramesRequired = steps[currentStepIndex]?.holdFrames ?? DEFAULT_HOLD_FRAMES

  return {
    stage, currentStepIndex, steps, stepResults,
    liveEval, consecutivePassFrames, holdFramesRequired,
    movementProfile,
    handleStartCalibration,
    handleAnalyzeStep,
    handleSkipStep,
    handleRetryStep,
    handleStartLive,
  }
}
