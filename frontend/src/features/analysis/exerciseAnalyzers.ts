/**
 * Exercise analyzers — per-exercise analysis orchestration.
 *
 * Each analyser function:
 *   1. Extracts typed angle values from JointAngles
 *   2. Detects the current MovementPhase
 *   3. Steps the RepCycleState machine
 *   4. Collects per-frame deviations
 *   5. At rep-complete: evaluates post-rep deviations and attaches them
 *   6. Returns the complete updated AnalysisState
 *
 * The single-arm curl logic lives here:
 *   - Arm selection uses visibility + movement delta
 *   - Only the active arm's elbow angle drives phase/rep state
 *   - Shoulder baseline for the active arm is captured at EXTENDED
 *
 * All functions are pure — no React, no MediaPipe, no side effects.
 */

import type { AnalysisState, Deviation, ActiveArm } from './analysisTypes'
import type { JointAngles } from '../biomechanics/biomechanicsTypes'
import {
  extractSquatAngles,
  extractPushUpAngles,
  extractCurlAngles,
} from './angleEvaluator'
import { detectSquatPhase, detectPushUpPhase, detectCurlPhase } from './phaseDetector'
import {
  stepSquatRepCounter,
  stepPushUpRepCounter,
  stepCurlRepCounter,
} from './repCounter'
import {
  detectSquatFrameDeviations,
  detectSquatRepDeviations,
  detectPushUpFrameDeviations,
  detectPushUpRepDeviations,
  detectCurlFrameDeviations,
  detectCurlRepDeviations,
} from './deviationDetector'
import { CURL } from './analysisThresholds'

// ── Squat Analyzer ────────────────────────────────────────────────────────────

export function analyzeSquat(angles: JointAngles, prev: AnalysisState): AnalysisState {
  const sa = extractSquatAngles(angles)

  // Detect movement phase
  const currentPhase = detectSquatPhase(sa, prev.currentPhase)

  if (currentPhase === 'INVALID') {
    return { ...prev, currentPhase: 'INVALID' }
  }

  // Step rep counter
  const counterOut = stepSquatRepCounter(
    prev.repCycleState,
    prev.currentPhase,
    currentPhase,
    prev.minAngleDuringCycle,
    prev.maxAngleDuringCycle,
    sa.avgKnee,
  )

  // Collect per-frame deviations during the active rep cycle
  const frameDeviations: Deviation[] =
    counterOut.nextCycleState !== 'IDLE'
      ? detectSquatFrameDeviations(sa)
      : []

  // Accumulate per-frame deviations into the cycle
  const accumulatedDeviations = mergeDeviations(prev.repDeviations, frameDeviations)

  // Rep just completed → evaluate post-rep deviations, increment count
  let lastCompletedRepDeviations = prev.lastCompletedRepDeviations
  let repCount = prev.repCount

  if (counterOut.countDelta === 1) {
    // Post-rep evaluation: use the min angle accumulated BEFORE the counter reset.
    // counterOut.nextMin is already reset to Infinity at COMPLETE→IDLE transition,
    // so we must snapshot prev.minAngleDuringCycle (the value from the COMPLETE frame)
    // before it is overwritten. Guard against Infinity in case tracking never started.
    const minForEval =
      isFinite(prev.minAngleDuringCycle) ? prev.minAngleDuringCycle : Infinity
    const repDeviations = [
      ...accumulatedDeviations,
      ...detectSquatRepDeviations(minForEval),
    ]
    lastCompletedRepDeviations = deduplicateDeviations(repDeviations)
    repCount = prev.repCount + 1
  }

  return {
    ...prev,
    repCount,
    repCycleState: counterOut.nextCycleState,
    currentPhase,
    repDeviations: counterOut.countDelta === 1 ? [] : accumulatedDeviations,
    minAngleDuringCycle: counterOut.nextMin,
    maxAngleDuringCycle: counterOut.nextMax,
    lastCompletedRepDeviations,
  }
}

// ── Push-Up Analyzer ──────────────────────────────────────────────────────────

export function analyzePushUp(angles: JointAngles, prev: AnalysisState): AnalysisState {
  const pa = extractPushUpAngles(angles)

  const currentPhase = detectPushUpPhase(pa, prev.currentPhase)

  if (currentPhase === 'INVALID') {
    return { ...prev, currentPhase: 'INVALID' }
  }

  const counterOut = stepPushUpRepCounter(
    prev.repCycleState,
    prev.currentPhase,
    currentPhase,
    prev.minAngleDuringCycle,
    prev.maxAngleDuringCycle,
    pa.avgElbow,
  )

  const frameDeviations: Deviation[] =
    counterOut.nextCycleState !== 'IDLE'
      ? detectPushUpFrameDeviations(pa)
      : []

  const accumulatedDeviations = mergeDeviations(prev.repDeviations, frameDeviations)

  let lastCompletedRepDeviations = prev.lastCompletedRepDeviations
  let repCount = prev.repCount

  if (counterOut.countDelta === 1) {
    const repDeviations = [
      ...accumulatedDeviations,
      ...detectPushUpRepDeviations(prev.minAngleDuringCycle),
    ]
    lastCompletedRepDeviations = deduplicateDeviations(repDeviations)
    repCount = prev.repCount + 1
  }

  return {
    ...prev,
    repCount,
    repCycleState: counterOut.nextCycleState,
    currentPhase,
    repDeviations: counterOut.countDelta === 1 ? [] : accumulatedDeviations,
    minAngleDuringCycle: counterOut.nextMin,
    maxAngleDuringCycle: counterOut.nextMax,
    lastCompletedRepDeviations,
  }
}

// ── Curl Analyzer ─────────────────────────────────────────────────────────────

/**
 * Single-arm curl logic:
 *
 * Arm selection strategy:
 *   1. If an arm was already selected in a previous frame (activeArm !== NONE),
 *      continue using it for the current cycle.
 *   2. If no arm is selected yet, check both arms:
 *      a. Filter arms with valid elbow angles.
 *      b. If only one arm has a valid angle, use that arm.
 *      c. If both are valid, check which one shows meaningful downward movement
 *         (elbow angle decreasing). The arm with lower elbow angle relative to
 *         EXTENDED_EXIT is selected as "moving".
 *      d. If neither arm is clearly moving, leave NONE (return UNKNOWN phase).
 *
 * Shoulder baseline:
 *   Captured the first time the selected arm's phase is EXTENDED.
 *   Used to measure shoulder stability deviation throughout the curl.
 */
export function analyzeCurl(angles: JointAngles, prev: AnalysisState): AnalysisState {
  const ca = extractCurlAngles(angles)

  // ── Step 1: Arm selection ─────────────────────────────────────────────────

  let activeArm: ActiveArm = prev.activeArm

  // Re-select arm at the start of each cycle (when IDLE and no arm chosen)
  if (prev.repCycleState === 'IDLE' || activeArm === 'NONE') {
    activeArm = selectActiveArm(ca, prev.activeArm)
  }

  // ── Step 2: Get active arm's angle values ─────────────────────────────────

  const activeElbow: number | null =
    activeArm === 'LEFT'
      ? ca.leftElbow
      : activeArm === 'RIGHT'
        ? ca.rightElbow
        : null

  const activeShoulder: number | null =
    activeArm === 'LEFT'
      ? ca.leftShoulder
      : activeArm === 'RIGHT'
        ? ca.rightShoulder
        : null

  if (activeElbow === null) {
    // No usable arm — pause analysis
    return { ...prev, currentPhase: 'INVALID', activeArm }
  }

  // ── Step 3: Phase detection ───────────────────────────────────────────────

  const currentPhase = detectCurlPhase(activeElbow, prev.currentPhase)

  if (currentPhase === 'INVALID') {
    return { ...prev, currentPhase: 'INVALID', activeArm }
  }

  // ── Step 4: Shoulder baseline (captured once at EXTENDED) ─────────────────

  let shoulderBaseline = prev.shoulderBaseline
  if (
    shoulderBaseline === null &&
    (currentPhase === 'EXTENDED' || currentPhase === 'UNKNOWN') &&
    activeShoulder !== null
  ) {
    shoulderBaseline = activeShoulder
  }

  // ── Step 5: Rep counter ───────────────────────────────────────────────────

  const counterOut = stepCurlRepCounter(
    prev.repCycleState,
    prev.currentPhase,
    currentPhase,
    prev.minAngleDuringCycle,
    prev.maxAngleDuringCycle,
    activeElbow,
  )

  // ── Step 6: Per-frame deviations ──────────────────────────────────────────

  const frameDeviations: Deviation[] =
    counterOut.nextCycleState !== 'IDLE'
      ? detectCurlFrameDeviations(activeShoulder, shoulderBaseline)
      : []

  const accumulatedDeviations = mergeDeviations(prev.repDeviations, frameDeviations)

  // ── Step 7: Post-rep evaluation ───────────────────────────────────────────

  let lastCompletedRepDeviations = prev.lastCompletedRepDeviations
  let repCount = prev.repCount
  let nextActiveArm = activeArm
  let nextShoulderBaseline = shoulderBaseline

  if (counterOut.countDelta === 1) {
    const repDeviations = [
      ...accumulatedDeviations,
      ...detectCurlRepDeviations(prev.minAngleDuringCycle, prev.maxAngleDuringCycle),
    ]
    lastCompletedRepDeviations = deduplicateDeviations(repDeviations)
    repCount = prev.repCount + 1
    // Reset arm selection for the next rep (re-detect in next IDLE)
    nextActiveArm = 'NONE'
    nextShoulderBaseline = null
  }

  return {
    ...prev,
    repCount,
    repCycleState: counterOut.nextCycleState,
    currentPhase,
    repDeviations: counterOut.countDelta === 1 ? [] : accumulatedDeviations,
    minAngleDuringCycle: counterOut.nextMin,
    maxAngleDuringCycle: counterOut.nextMax,
    activeArm: nextActiveArm,
    shoulderBaseline: nextShoulderBaseline,
    lastCompletedRepDeviations,
  }
}

// ── Arm selection helper ──────────────────────────────────────────────────────

/**
 * Selects which arm to track for the curl.
 *
 * Logic:
 *  1. If only one arm has a valid elbow angle → use it.
 *  2. If both arms are valid, the arm with the lower current elbow angle
 *     (i.e., currently more flexed / moving more) is selected.
 *     A minimum delta (ARM_MOVEMENT_DELTA) from EXTENDED_EXIT prevents
 *     accidentally selecting an arm that is just slightly bent.
 *  3. If neither arm is meaningfully below EXTENDED_EXIT → NONE.
 *
 * Once an arm is selected within a rep cycle, the caller keeps it
 * (this function is only called when prev.activeArm === NONE / IDLE).
 */
function selectActiveArm(ca: ReturnType<typeof extractCurlAngles>, prev: ActiveArm): ActiveArm {
  // If previously selected, preserve (caller should not re-call this mid-cycle)
  if (prev !== 'NONE') return prev

  const leftMoving =
    ca.leftElbow !== null &&
    ca.leftElbow < CURL.EXTENDED_EXIT - CURL.ARM_MOVEMENT_DELTA

  const rightMoving =
    ca.rightElbow !== null &&
    ca.rightElbow < CURL.EXTENDED_EXIT - CURL.ARM_MOVEMENT_DELTA

  if (leftMoving && rightMoving) {
    // Both arms moving — pick the one that's more flexed (lower angle)
    return (ca.leftElbow as number) <= (ca.rightElbow as number) ? 'LEFT' : 'RIGHT'
  }
  if (leftMoving) return 'LEFT'
  if (rightMoving) return 'RIGHT'

  // No arm clearly moving yet — check if either has a valid angle at all
  if (ca.leftElbow !== null && ca.rightElbow === null) return 'LEFT'
  if (ca.rightElbow !== null && ca.leftElbow === null) return 'RIGHT'

  return 'NONE'
}

// ── Utility: deviation helpers ────────────────────────────────────────────────

/**
 * Merges new deviations into the existing list, replacing any entry with the
 * same ID (keeps the most recent observation).
 */
function mergeDeviations(existing: Deviation[], incoming: Deviation[]): Deviation[] {
  if (incoming.length === 0) return existing
  const map = new Map<string, Deviation>(existing.map((d) => [d.id, d]))
  for (const d of incoming) {
    map.set(d.id, d)
  }
  return Array.from(map.values())
}

/**
 * Removes duplicate deviation IDs, keeping the last occurrence.
 */
function deduplicateDeviations(deviations: Deviation[]): Deviation[] {
  const map = new Map<string, Deviation>()
  for (const d of deviations) {
    map.set(d.id, d)
  }
  return Array.from(map.values())
}
