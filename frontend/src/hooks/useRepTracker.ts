/**
 * useRepTracker — collects structured per-rep trackpoint data during a session.
 *
 * On every new analysisResult it checks if a rep just completed (repCount
 * increased by 1) and records the full biomechanical snapshot:
 *
 *   - rep number
 *   - min/max angle during the cycle (actual measured degrees)
 *   - deviations with observed angle + threshold + severity
 *   - phases visited during the rep
 *   - whether the rep met depth / extension targets
 *
 * This data is later serialised as a human-readable text block and sent to
 * Gemini for AI movement analysis.
 */

import { useRef, useCallback } from 'react'
import type { AnalysisResult, Deviation } from '../features/analysis/analysisTypes'
import { SQUAT, PUSHUP, CURL } from '../features/analysis/analysisThresholds'

// ── Per-rep snapshot ──────────────────────────────────────────────────────────

export interface RepSnapshot {
  repNumber: number
  /** Deepest joint angle reached during this rep (degrees) */
  minAngle: number
  /** Most extended joint angle during this rep (degrees) */
  maxAngle: number
  /** Range of motion = maxAngle - minAngle (degrees) */
  rangeOfMotion: number
  /** Deviations detected for this specific rep */
  deviations: Array<{
    id: string
    severity: string
    observed: number
    threshold: number
    angleName?: string
  }>
  /** Whether depth target was met for this rep */
  metDepthTarget: boolean
  /** Primary joint angle label for context */
  primaryJoint: string
  /** Human-readable depth target string e.g. "< 110°" */
  depthTargetLabel: string
}

export interface SessionTrackData {
  exerciseId: string
  exerciseName: string
  totalReps: number
  reps: RepSnapshot[]
  /** Overall summary statistics */
  avgMinAngle: number
  avgMaxAngle: number
  avgRangeOfMotion: number
  depthTargetMetCount: number
  mostFrequentDeviation: string | null
  allDeviationIds: string[]
}

// ── Exercise-specific depth targets ──────────────────────────────────────────

interface ExerciseTarget {
  primaryJoint: string
  depthTarget: number
  depthLabel: string
  depthIsMin: boolean   // true = target is a maximum angle (go lower), false = minimum (reach higher)
}

function getExerciseTarget(exerciseId: string): ExerciseTarget {
  if (exerciseId === 'squat') return {
    primaryJoint: 'Knee',
    depthTarget: SQUAT.MIN_DEPTH_REQUIRED,   // 110°
    depthLabel: `≤ ${SQUAT.MIN_DEPTH_REQUIRED}°`,
    depthIsMin: true,
  }
  if (exerciseId === 'pushup') return {
    primaryJoint: 'Elbow',
    depthTarget: PUSHUP.MIN_DEPTH_REQUIRED,  // 85°
    depthLabel: `≤ ${PUSHUP.MIN_DEPTH_REQUIRED}°`,
    depthIsMin: true,
  }
  if (exerciseId === 'curl') return {
    primaryJoint: 'Elbow',
    depthTarget: CURL.MIN_CURL_REQUIRED,     // 65°
    depthLabel: `≤ ${CURL.MIN_CURL_REQUIRED}°`,
    depthIsMin: true,
  }
  return {
    primaryJoint: 'Joint',
    depthTarget: 90,
    depthLabel: '≤ 90°',
    depthIsMin: true,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRepTracker(exerciseId: string, exerciseName: string) {
  const repsRef         = useRef<RepSnapshot[]>([])
  const lastRepCountRef = useRef(0)
  // Track per-cycle accumulation between reps
  const cycleMinRef     = useRef<number>(Infinity)
  const cycleMaxRef     = useRef<number>(-Infinity)

  const target = getExerciseTarget(exerciseId)

  /**
   * Call this on every new analysisResult from useAnalysis.
   * It captures a RepSnapshot when repCount increments.
   */
  const onAnalysisResult = useCallback((result: AnalysisResult | null) => {
    if (!result) return

    // Track min/max throughout the cycle
    if (result.landmarksValid) {
      // Use the angle values from the result's angles object
      const angles = result.angles
      const jointAngle = extractPrimaryAngle(angles, exerciseId)
      if (jointAngle !== null) {
        if (jointAngle < cycleMinRef.current) cycleMinRef.current = jointAngle
        if (jointAngle > cycleMaxRef.current) cycleMaxRef.current = jointAngle
      }
    }

    // Rep just completed
    if (result.repCount > lastRepCountRef.current) {
      const repNum = result.repCount
      lastRepCountRef.current = repNum

      const minAngle = isFinite(cycleMinRef.current) ? cycleMinRef.current : 0
      const maxAngle = isFinite(cycleMaxRef.current) ? cycleMaxRef.current : 0
      const rom = Math.max(0, maxAngle - minAngle)

      const deviations: RepSnapshot['deviations'] = result.activeDeviations.map((d: Deviation) => ({
        id:        d.id,
        severity:  d.severity,
        observed:  Math.round(d.observed),
        threshold: Math.round(d.threshold),
        angleName: d.angleName,
      }))

      const metDepth = target.depthIsMin
        ? (minAngle <= target.depthTarget)
        : (maxAngle >= target.depthTarget)

      repsRef.current.push({
        repNumber:        repNum,
        minAngle:         Math.round(minAngle),
        maxAngle:         Math.round(maxAngle),
        rangeOfMotion:    Math.round(rom),
        deviations,
        metDepthTarget:   metDepth,
        primaryJoint:     target.primaryJoint,
        depthTargetLabel: target.depthLabel,
      })

      // Reset cycle tracking for next rep
      cycleMinRef.current = Infinity
      cycleMaxRef.current = -Infinity
    }
  }, [exerciseId, target])

  /** Build the final SessionTrackData for AI analysis */
  const buildTrackData = useCallback((): SessionTrackData => {
    const reps = repsRef.current
    const totalReps = reps.length

    if (totalReps === 0) {
      return {
        exerciseId, exerciseName, totalReps: 0, reps: [],
        avgMinAngle: 0, avgMaxAngle: 0, avgRangeOfMotion: 0,
        depthTargetMetCount: 0, mostFrequentDeviation: null, allDeviationIds: [],
      }
    }

    const avgMinAngle     = Math.round(reps.reduce((s, r) => s + r.minAngle, 0) / totalReps)
    const avgMaxAngle     = Math.round(reps.reduce((s, r) => s + r.maxAngle, 0) / totalReps)
    const avgROM          = Math.round(reps.reduce((s, r) => s + r.rangeOfMotion, 0) / totalReps)
    const depthMetCount   = reps.filter(r => r.metDepthTarget).length

    // Count deviation frequency
    const devCounts = new Map<string, number>()
    for (const rep of reps) {
      for (const d of rep.deviations) {
        devCounts.set(d.id, (devCounts.get(d.id) ?? 0) + 1)
      }
    }
    const allDeviationIds = [...devCounts.keys()]
    const mostFrequent = allDeviationIds.length > 0
      ? allDeviationIds.reduce((a, b) => (devCounts.get(a)! >= devCounts.get(b)! ? a : b))
      : null

    return {
      exerciseId, exerciseName, totalReps, reps,
      avgMinAngle, avgMaxAngle, avgRangeOfMotion: avgROM,
      depthTargetMetCount: depthMetCount,
      mostFrequentDeviation: mostFrequent,
      allDeviationIds,
    }
  }, [exerciseId, exerciseName])

  /** Reset for a new session */
  const reset = useCallback(() => {
    repsRef.current = []
    lastRepCountRef.current = 0
    cycleMinRef.current = Infinity
    cycleMaxRef.current = -Infinity
  }, [])

  return { onAnalysisResult, buildTrackData, reset }
}

// ── Angle extraction helper ───────────────────────────────────────────────────

function extractPrimaryAngle(angles: Record<string, unknown>, exerciseId: string): number | null {
  if (exerciseId === 'squat') {
    const l = (angles.leftKneeAngle as { degrees?: number; valid?: boolean } | undefined)
    const r = (angles.rightKneeAngle as { degrees?: number; valid?: boolean } | undefined)
    const lv = l?.valid ? l.degrees : null
    const rv = r?.valid ? r.degrees : null
    if (lv != null && rv != null) return (lv + rv) / 2
    return lv ?? rv ?? null
  }
  if (exerciseId === 'pushup' || exerciseId === 'curl') {
    const l = (angles.leftElbowAngle as { degrees?: number; valid?: boolean } | undefined)
    const r = (angles.rightElbowAngle as { degrees?: number; valid?: boolean } | undefined)
    const lv = l?.valid ? l.degrees : null
    const rv = r?.valid ? r.degrees : null
    if (lv != null && rv != null) return (lv + rv) / 2
    return lv ?? rv ?? null
  }
  return null
}

// ── Text serialiser — converts SessionTrackData to a Gemini-readable block ───

export function serialiseTrackDataForGemini(data: SessionTrackData): string {
  if (data.totalReps === 0) {
    return `No rep data recorded for ${data.exerciseName}.`
  }

  const target = getExerciseTarget(data.exerciseId)
  const lines: string[] = []

  lines.push(`EXERCISE: ${data.exerciseName} (${data.exerciseId})`)
  lines.push(`TOTAL REPS: ${data.totalReps}`)
  lines.push(`PRIMARY JOINT: ${target.primaryJoint}`)
  lines.push(`DEPTH TARGET: ${target.depthLabel}  (reps meeting target: ${data.depthTargetMetCount}/${data.totalReps})`)
  lines.push(`AVG MIN ANGLE (deepest): ${data.avgMinAngle}°`)
  lines.push(`AVG MAX ANGLE (extended): ${data.avgMaxAngle}°`)
  lines.push(`AVG RANGE OF MOTION: ${data.avgRangeOfMotion}°`)
  lines.push(`MOST FREQUENT DEVIATION: ${data.mostFrequentDeviation ?? 'None'}`)
  lines.push('')
  lines.push('PER-REP BREAKDOWN:')

  for (const rep of data.reps) {
    const depthOk = rep.metDepthTarget ? '✓' : '✗'
    lines.push(`  Rep ${rep.repNumber}: min=${rep.minAngle}° max=${rep.maxAngle}° ROM=${rep.rangeOfMotion}° depth=${depthOk}`)
    if (rep.deviations.length > 0) {
      for (const d of rep.deviations) {
        lines.push(`    ↳ ${d.id} [${d.severity}] observed=${d.observed}° threshold=${d.threshold}°${d.angleName ? ` (${d.angleName})` : ''}`)
      }
    } else {
      lines.push(`    ↳ No deviations`)
    }
  }

  return lines.join('\n')
}
