/**
 * useCalibration — state machine hook for the Learn & Calibrate flow.
 *
 * Flow:  EXPLAIN → STEP (per step) → STEP_FAILED → REPORT → LIVE
 *
 * Manual controls:
 *   handleAnalyzeStep  — starts a 10-second timed analysis window.
 *                        Pose frames are sampled every ~333 ms.
 *                        At the end the average score is evaluated:
 *                          ≥ 60  → PASS  → advance to next step
 *                          < 60  → FAIL  → STEP_FAILED with correction
 *   handleSkipStep     — user skips: records a 100-score pass with no issues.
 *
 * Auto-advance is kept as a fallback: if the user holds the position correctly
 * for holdFrames consecutive frames it still passes automatically.
 *
 * Timed-analysis state exposed to UI:
 *   isAnalysing      — true while the 10-second window is open
 *   analyseSecondsLeft — countdown integer (10 → 0)
 *   analysePct       — 0 → 100 fill for a progress bar (time-based)
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

const DEFAULT_HOLD_FRAMES  = 20     // auto-advance: ~0.67 s at 30 fps
const ANALYSE_DURATION_MS  = 10_000 // 10-second timed analysis window
const ANALYSE_PASS_SCORE   = 60     // minimum average score to pass

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
  /** Whether the 10-second timed analysis is currently running. */
  isAnalysing: boolean
  /** Countdown seconds remaining (10 → 0). */
  analyseSecondsLeft: number
  /** 0 → 100 fill percentage for a progress bar (time elapsed). */
  analysePct: number
  /** User confirmed they read the explanation → start step 0. */
  handleStartCalibration: () => void
  /** Start the 10-second timed analysis window. */
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

  // ── Timed-analysis state ──────────────────────────────────────────────────
  const [isAnalysing, setIsAnalysing]             = useState(false)
  const [analyseSecondsLeft, setAnalyseSecondsLeft] = useState(ANALYSE_DURATION_MS / 1000)
  const [analysePct, setAnalysePct]               = useState(0)

  // ── Refs (frame-hot-path — never cause re-renders) ────────────────────────
  const consecutivePassRef    = useRef(0)
  const frameScoreWindowRef   = useRef<number[]>([])
  const frameCountRef         = useRef(0)
  const stageRef              = useRef<CalibrationStage>('EXPLAIN')
  const currentStepIndexRef   = useRef(0)
  const stepAttemptsRef       = useRef<number[]>([])
  const latestPosesRef        = useRef<PoseResult[]>([])
  const latestEvalRef         = useRef<FrameEvaluation | null>(null)

  // ── Timed-analysis refs ───────────────────────────────────────────────────
  const isAnalysingRef        = useRef(false)
  const analyseFramesRef      = useRef<number[]>([])   // collected frame scores
  const analyseEndTimeRef     = useRef<number>(0)
  const analyseTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep refs in sync with state
  useEffect(() => { stageRef.current = stage }, [stage])
  useEffect(() => { currentStepIndexRef.current = currentStepIndex }, [currentStepIndex])
  useEffect(() => { latestPosesRef.current = poses }, [poses])

  // ── Clear any running timer ────────────────────────────────────────────────
  const clearAnalyseTimer = useCallback(() => {
    if (analyseTimerRef.current !== null) {
      clearInterval(analyseTimerRef.current)
      analyseTimerRef.current = null
    }
  }, [])

  // ── Reset timed-analysis state ────────────────────────────────────────────
  const resetAnalysis = useCallback(() => {
    clearAnalyseTimer()
    isAnalysingRef.current = false
    analyseFramesRef.current = []
    analyseEndTimeRef.current = 0
    setIsAnalysing(false)
    setAnalyseSecondsLeft(ANALYSE_DURATION_MS / 1000)
    setAnalysePct(0)
  }, [clearAnalyseTimer])

  // ── Reset on exercise change ───────────────────────────────────────────────
  useEffect(() => {
    resetAnalysis()
    setStage('EXPLAIN');              stageRef.current = 'EXPLAIN'
    setCurrentStepIndex(0);           currentStepIndexRef.current = 0
    setStepResults([])
    setLiveEval(null);                latestEvalRef.current = null
    setConsPass(0);                   consecutivePassRef.current = 0
    setMovementProfile(null)
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    stepAttemptsRef.current = []
  }, [exercise?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => { clearAnalyseTimer() }, [clearAnalyseTimer])

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

  // ── Finalise timed analysis (called when 10s window closes) ──────────────
  const finaliseAnalysis = useCallback(() => {
    if (!isAnalysingRef.current) return
    resetAnalysis()

    if (!exercise || steps.length === 0) return
    const stepIndex = currentStepIndexRef.current
    const step = steps[stepIndex]
    if (!step) return

    const frames = analyseFramesRef.current
    const attempts = (stepAttemptsRef.current[stepIndex] ?? 0) + 1
    stepAttemptsRef.current[stepIndex] = attempts

    // Average all collected frame scores (or use latest eval as fallback)
    const avgScore = frames.length > 0
      ? averageFrameScores(frames)
      : (latestEvalRef.current?.frameScore ?? 0)

    const eval_ = latestEvalRef.current

    if (avgScore >= ANALYSE_PASS_SCORE && (eval_?.landmarksValid ?? false)) {
      // Pass
      const result: StepResult = { step, score: avgScore, issues: [], passed: true, attempts }
      setStepResults((prev) => {
        const newResults = [...prev, result]
        consecutivePassRef.current = 0
        frameScoreWindowRef.current = []
        frameCountRef.current = 0
        setConsPass(0)
        advanceStep(newResults, stepIndex + 1, exercise.id, exercise.name)
        return newResults
      })
    } else {
      // Fail
      const score = Math.max(0, avgScore - 5)
      const issues = eval_ ? buildStepIssues(eval_) : []
      const failResult: StepResult = { step, score, issues, passed: false, attempts }
      setStepResults((prev) => {
        const n = [...prev]
        n[stepIndex] = failResult
        return n
      })
      frameCountRef.current = 0
      consecutivePassRef.current = 0
      frameScoreWindowRef.current = []
      setConsPass(0)
      setStage('STEP_FAILED');  stageRef.current = 'STEP_FAILED'
    }
  }, [exercise, steps, advanceStep, resetAnalysis])

  // ── Per-frame analysis loop (auto-advance + collect timed frames) ─────────
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

    // ── Collect frame scores during timed analysis ─────────────────────────
    if (isAnalysingRef.current && eval_.landmarksValid) {
      analyseFramesRef.current.push(eval_.frameScore)
    }

    // ── Auto-advance on hold (unchanged) ──────────────────────────────────
    // Do not count auto-advance frames during timed analysis to avoid
    // double-advancing.
    if (!isAnalysingRef.current) {
      const holdRequired = step.holdFrames ?? DEFAULT_HOLD_FRAMES
      frameCountRef.current += 1

      if (eval_.passing && eval_.landmarksValid) {
        consecutivePassRef.current += 1
        frameScoreWindowRef.current.push(eval_.frameScore)
        setConsPass(consecutivePassRef.current)

        if (consecutivePassRef.current >= holdRequired) {
          // Auto-advance
          const score    = averageFrameScores(frameScoreWindowRef.current)
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
    }
  }, [poses, exercise, steps, stepResults, advanceStep])

  // ── handleAnalyzeStep — start 10-second timed analysis ───────────────────
  const handleAnalyzeStep = useCallback(() => {
    if (stageRef.current !== 'STEP') return
    if (!exercise || steps.length === 0) return
    if (isAnalysingRef.current) return   // already running

    analyseFramesRef.current = []
    isAnalysingRef.current = true
    setIsAnalysing(true)

    const endTime = Date.now() + ANALYSE_DURATION_MS
    analyseEndTimeRef.current = endTime

    setAnalyseSecondsLeft(ANALYSE_DURATION_MS / 1000)
    setAnalysePct(0)

    // Tick every 100 ms to update countdown + progress bar
    analyseTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, analyseEndTimeRef.current - Date.now())
      const secondsLeft = Math.ceil(remaining / 1000)
      const pct = Math.round(((ANALYSE_DURATION_MS - remaining) / ANALYSE_DURATION_MS) * 100)

      setAnalyseSecondsLeft(secondsLeft)
      setAnalysePct(pct)

      if (remaining <= 0) {
        // Time's up — finalise in next microtask so state above flushes first
        clearInterval(analyseTimerRef.current!)
        analyseTimerRef.current = null
        // Use setTimeout(0) to let React batch the state updates before we mutate more state
        setTimeout(() => { finaliseAnalysis() }, 0)
      }
    }, 100)
  }, [exercise, steps, finaliseAnalysis])

  // ── handleSkipStep — record a perfect pass and move on ────────────────────
  const handleSkipStep = useCallback(() => {
    resetAnalysis()
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
  }, [exercise, steps, stepResults, advanceStep, resetAnalysis])

  // ── handleStartCalibration ────────────────────────────────────────────────
  const handleStartCalibration = useCallback(() => {
    resetAnalysis()
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    stepAttemptsRef.current = []
    setStepResults([])
    setCurrentStepIndex(0);  currentStepIndexRef.current = 0
    setConsPass(0)
    setStage('STEP');  stageRef.current = 'STEP'
  }, [resetAnalysis])

  // ── handleRetryStep ───────────────────────────────────────────────────────
  const handleRetryStep = useCallback(() => {
    resetAnalysis()
    consecutivePassRef.current = 0
    frameScoreWindowRef.current = []
    frameCountRef.current = 0
    setConsPass(0)
    setStepResults((prev) => prev.slice(0, currentStepIndexRef.current))
    setStage('STEP');  stageRef.current = 'STEP'
  }, [resetAnalysis])

  // ── handleStartLive ───────────────────────────────────────────────────────
  const handleStartLive = useCallback(() => {
    resetAnalysis()
    setStage('LIVE');  stageRef.current = 'LIVE'
  }, [resetAnalysis])

  const holdFramesRequired = steps[currentStepIndex]?.holdFrames ?? DEFAULT_HOLD_FRAMES

  return {
    stage, currentStepIndex, steps, stepResults,
    liveEval, consecutivePassFrames, holdFramesRequired,
    movementProfile,
    isAnalysing, analyseSecondsLeft, analysePct,
    handleStartCalibration,
    handleAnalyzeStep,
    handleSkipStep,
    handleRetryStep,
    handleStartLive,
  }
}
