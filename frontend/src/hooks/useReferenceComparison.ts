/**
 * useReferenceComparison — React hook that runs the True Reference comparison
 * engine on every live pose frame.
 *
 * Outputs:
 *  - liveComparison: latest ReferenceComparison for the current phase
 *  - matchScore: smoothed 0–100 match score
 *  - primaryDeviation: the most critical joint deviation right now
 *
 * Performance strategy:
 *  - Comparison runs on every pose update (same cadence as useAnalysis)
 *  - React setState only when score bucket or primary deviation changes
 *  - Cooldown prevents repeated TTS / UI flicker for same deviation
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import type { PoseResult } from '../features/pose/poseTypes'
import type { MovementPhase } from '../features/analysis/analysisTypes'
import {
  compareToReference,
  smoothMatchScore,
  getReferencePhase,
} from '../features/reference'
import type { ReferenceComparison, JointDeviation } from '../features/reference'

interface UseReferenceComparisonOptions {
  poses: PoseResult[]
  exerciseId: string | null
  currentPhase: MovementPhase
  isActive: boolean
}

interface UseReferenceComparisonReturn {
  liveComparison: ReferenceComparison | null
  matchScore: number
  primaryDeviation: JointDeviation | null
  isMatched: boolean
  resetComparison: () => void
}

const SCORE_CHANGE_THRESHOLD = 5   // only re-render if score changes by this much
const COOLDOWN_MS = 2500           // minimum time between flagging same joint

export function useReferenceComparison({
  poses,
  exerciseId,
  currentPhase,
  isActive,
}: UseReferenceComparisonOptions): UseReferenceComparisonReturn {

  const [liveComparison, setLiveComparison] = useState<ReferenceComparison | null>(null)
  const [matchScore, setMatchScore]         = useState(80)
  const [primaryDeviation, setPrimaryDeviation] = useState<JointDeviation | null>(null)
  const [isMatched, setIsMatched]           = useState(false)

  const smoothedScoreRef     = useRef(80)
  const lastNotifiedScoreRef = useRef(80)
  const lastDeviationIdRef   = useRef('')
  const deviationCooldownRef = useRef<Record<string, number>>({})
  const sessionStartRef      = useRef(Date.now())

  const resetComparison = useCallback(() => {
    setLiveComparison(null)
    setMatchScore(80)
    setPrimaryDeviation(null)
    setIsMatched(false)
    smoothedScoreRef.current     = 80
    lastNotifiedScoreRef.current = 80
    lastDeviationIdRef.current   = ''
    deviationCooldownRef.current = {}
    sessionStartRef.current      = Date.now()
  }, [])

  useEffect(() => {
    resetComparison()
  }, [exerciseId, isActive, resetComparison])

  useEffect(() => {
    if (!isActive || !exerciseId) return
    if (poses.length === 0 || poses[0].landmarks.length === 0) return
    if (currentPhase === 'UNKNOWN' || currentPhase === 'INVALID') return

    const refPhase = getReferencePhase(exerciseId, currentPhase)
    if (!refPhase) return

    const userLandmarks = poses[0].landmarks
    const timestamp     = Date.now() - sessionStartRef.current

    const comparison = compareToReference(
      userLandmarks,
      refPhase,
      currentPhase,
      exerciseId,
      timestamp,
    )

    // Smooth the score
    smoothedScoreRef.current = smoothMatchScore(smoothedScoreRef.current, comparison.overallMatchScore)

    // Apply deviation cooldown — prevent same joint flooding the UI
    const now  = Date.now()
    const cds  = deviationCooldownRef.current
    const primary = comparison.primaryDeviation
    const primaryKey = primary?.affectedJoint ?? ''
    const canNotify = !primaryKey || !cds[primaryKey] || now - cds[primaryKey] > COOLDOWN_MS

    if (canNotify && primary) {
      cds[primaryKey] = now
    }

    // Only setState if meaningful change
    const scoreBucket  = Math.round(smoothedScoreRef.current / SCORE_CHANGE_THRESHOLD)
    const lastBucket   = Math.round(lastNotifiedScoreRef.current / SCORE_CHANGE_THRESHOLD)
    const deviationKey = primary?.affectedJoint ?? ''

    const changed =
      scoreBucket !== lastBucket ||
      deviationKey !== lastDeviationIdRef.current ||
      comparison.matched !== isMatched

    if (changed) {
      lastNotifiedScoreRef.current = smoothedScoreRef.current
      lastDeviationIdRef.current   = deviationKey
      setLiveComparison(comparison)
      setMatchScore(smoothedScoreRef.current)
      setPrimaryDeviation(canNotify ? primary : primaryDeviation)
      setIsMatched(comparison.matched)
    }
  }, [poses, exerciseId, currentPhase, isActive, isMatched, primaryDeviation])

  return { liveComparison, matchScore, primaryDeviation, isMatched, resetComparison }
}
