/**
 * useAnalysis — React bridge for the analysis engine.
 *
 * Integrates the analysis engine into the existing rAF-based pose loop.
 *
 * Performance strategy (per spec §18):
 *   - The analysis engine runs on every pose result (not on every rAF frame —
 *     MediaPipe only produces a new result when detection changes).
 *   - The result is stored in a ref (`analysisResultRef`) immediately.
 *   - React setState is called ONLY when meaningful UI values change:
 *       · repCount
 *       · currentPhase
 *       · formStatus
 *       · activeDeviations (compared by ID set, not reference)
 *       · landmarksValid
 *   - This prevents 60 React re-renders per second in the hot path.
 *
 * Usage:
 *   const { analysisResult, resetAnalysis } = useAnalysis({
 *     poses,
 *     selectedExercise,
 *     isActive,
 *   })
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import { analyze, createInitialAnalysisState } from '../features/analysis/analysisEngine'
import type { AnalysisResult, AnalysisState } from '../features/analysis/analysisTypes'
import type { PoseResult } from '../features/pose/poseTypes'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'

interface UseAnalysisOptions {
  /** Latest pose results from usePoseLandmarker. */
  poses: PoseResult[]
  /** Currently selected exercise. Null if none selected. */
  selectedExercise: ExerciseDefinition | null
  /** Whether the camera/analysis is active. Resets state when toggled off. */
  isActive: boolean
}

interface UseAnalysisReturn {
  /** Latest analysis result for UI rendering. */
  analysisResult: AnalysisResult | null
  /** Manually reset all rep/state counters (e.g. new exercise selected). */
  resetAnalysis: () => void
}

export function useAnalysis({
  poses,
  selectedExercise,
  isActive,
}: UseAnalysisOptions): UseAnalysisReturn {
  // ── Engine state (ref — never causes re-renders) ──────────────────────────
  const analysisStateRef = useRef<AnalysisState>(createInitialAnalysisState())

  // ── React state (causes re-renders — updated sparingly) ──────────────────
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  // ── Previous notified values (for change detection) ───────────────────────
  const lastNotifiedRef = useRef({
    repCount: -1,
    currentPhase: '' as string,
    formStatus: '' as string,
    deviationIds: '' as string,
    landmarksValid: true,
  })

  // ── Reset when exercise changes or camera stops ───────────────────────────
  useEffect(() => {
    analysisStateRef.current = createInitialAnalysisState()
    setAnalysisResult(null)
    lastNotifiedRef.current = {
      repCount: -1,
      currentPhase: '',
      formStatus: '',
      deviationIds: '',
      landmarksValid: true,
    }
  }, [selectedExercise?.id, isActive])

  // ── Run analysis on every new pose result ─────────────────────────────────
  useEffect(() => {
    if (!selectedExercise || !isActive) return
    if (poses.length === 0 || poses[0].worldLandmarks.length === 0) return

    const poseResult = poses[0]
    const result = analyze(poseResult, selectedExercise, analysisStateRef.current)

    // Update engine state ref immediately (no re-render)
    analysisStateRef.current = result.nextState

    // ── Change detection: only setState if something meaningful changed ──
    const deviationIds = result.activeDeviations.map((d) => d.id).sort().join(',')
    const last = lastNotifiedRef.current

    const changed =
      result.repCount !== last.repCount ||
      result.currentPhase !== last.currentPhase ||
      result.formStatus !== last.formStatus ||
      deviationIds !== last.deviationIds ||
      result.landmarksValid !== last.landmarksValid

    if (changed) {
      lastNotifiedRef.current = {
        repCount: result.repCount,
        currentPhase: result.currentPhase,
        formStatus: result.formStatus,
        deviationIds,
        landmarksValid: result.landmarksValid,
      }
      setAnalysisResult(result)
    }
  }, [poses, selectedExercise, isActive])

  // ── Manual reset ──────────────────────────────────────────────────────────
  const resetAnalysis = useCallback(() => {
    analysisStateRef.current = createInitialAnalysisState()
    setAnalysisResult(null)
    lastNotifiedRef.current = {
      repCount: -1,
      currentPhase: '',
      formStatus: '',
      deviationIds: '',
      landmarksValid: true,
    }
  }, [])

  return { analysisResult, resetAnalysis }
}
