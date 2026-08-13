/**
 * Rep counter — exercise-specific repetition state machines.
 *
 * Design principles:
 *
 *  1. RepCycleState only advances FORWARD — never regresses.
 *     This prevents double-counting and jitter-induced phantom reps.
 *
 *  2. Depth must be confirmed (AT_DEPTH / DEPTH cycle state) before
 *     an ascending phase can progress to COMPLETE.
 *
 *  3. A minimum dwell at depth (DWELL_FRAMES_DEPTH frames) is required
 *     before RETURNING is allowed. This prevents bounce-throughs from
 *     counting as full reps when a user passes through the threshold
 *     for a single frame (landmark noise or very fast movement).
 *
 *  4. A rep is only finalised (COMPLETE) when the full cycle is done.
 *     No partial-rep counting.
 *
 *  5. If landmarks become INVALID mid-rep, the cycle state is preserved
 *     but no rep is counted and no state advances.
 *
 *  6. Movement extrema (minAngle, maxAngle) are tracked per cycle and
 *     returned so the deviation detector can evaluate depth post-rep.
 *
 * Each exercise has its own step function that maps:
 *   (prevCycleState, prevPhase, currentPhase, minAngle, maxAngle, dwellFrames)
 *   → { nextCycleState, countDelta, nextMin, nextMax, nextDwell }
 *
 * countDelta is 0 or 1 — the caller adds it to repCount.
 */

import type { RepCycleState, MovementPhase } from './analysisTypes'
import { SQUAT, PUSHUP, CURL } from './analysisThresholds'

export interface RepCounterOutput {
  nextCycleState: RepCycleState
  /** 1 if a rep was just completed, 0 otherwise. */
  countDelta: number
  /** Updated minimum angle (deepest position this cycle). */
  nextMin: number
  /** Updated maximum angle (most extended this cycle). */
  nextMax: number
  /** Updated dwell frame counter at depth. */
  nextDwell: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateMin(current: number, newValue: number | null): number {
  if (newValue === null) return current
  return Math.min(current, newValue)
}

function updateMax(current: number, newValue: number | null): number {
  if (newValue === null) return current
  return Math.max(current, newValue)
}

// ── Squat Rep Counter ─────────────────────────────────────────────────────────

/**
 * Squat cycle:
 *   IDLE → STARTED (phase leaves STANDING/UNKNOWN)
 *        → DEPTH   (phase reaches BOTTOM)
 *        → RETURNING (phase leaves BOTTOM after DWELL_FRAMES_DEPTH dwell)
 *        → COMPLETE  (phase returns to STANDING)  → rep++
 *        → IDLE
 */
export function stepSquatRepCounter(
  cycleState: RepCycleState,
  _prevPhase: MovementPhase,
  currentPhase: MovementPhase,
  currentMin: number,
  currentMax: number,
  avgKneeAngle: number | null,
  depthDwellFrames: number,
): RepCounterOutput {
  if (currentPhase === 'INVALID') {
    return { nextCycleState: cycleState, countDelta: 0, nextMin: currentMin, nextMax: currentMax, nextDwell: depthDwellFrames }
  }

  const nextMin = updateMin(currentMin, avgKneeAngle)
  const nextMax = updateMax(currentMax, avgKneeAngle)

  switch (cycleState) {
    case 'IDLE': {
      // Wait for the movement to begin (leave standing position)
      if (
        currentPhase === 'DESCENDING' ||
        currentPhase === 'BOTTOM' ||
        currentPhase === 'ASCENDING'
      ) {
        return { nextCycleState: 'STARTED', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
      }
      return { nextCycleState: 'IDLE', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'STARTED': {
      // Waiting to confirm depth
      if (currentPhase === 'BOTTOM') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: 1 }
      }
      // Aborted — returned to standing without reaching bottom
      if (currentPhase === 'STANDING') {
        return {
          nextCycleState: 'IDLE',
          countDelta: 0,
          nextMin: Infinity,
          nextMax: -Infinity,
          nextDwell: 0,
        }
      }
      return { nextCycleState: 'STARTED', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'DEPTH': {
      // Still at depth — increment dwell counter
      if (currentPhase === 'BOTTOM') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
      }
      // Only allow RETURNING after minimum dwell at depth
      if (currentPhase === 'ASCENDING') {
        if (depthDwellFrames >= SQUAT.DWELL_FRAMES_DEPTH) {
          return { nextCycleState: 'RETURNING', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
        }
        // Not enough dwell yet — stay at DEPTH (treat as still at bottom)
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
      }
      return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
    }

    case 'RETURNING': {
      // Rising — wait for standing to complete the rep
      if (currentPhase === 'STANDING') {
        return { nextCycleState: 'COMPLETE', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
      }
      // Sank back down — reset to DEPTH
      if (currentPhase === 'BOTTOM') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: 1 }
      }
      return { nextCycleState: 'RETURNING', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'COMPLETE': {
      // Rep is complete — signal count +1, reset cycle state and extrema
      return {
        nextCycleState: 'IDLE',
        countDelta: 1,
        nextMin: Infinity,
        nextMax: -Infinity,
        nextDwell: 0,
      }
    }
  }
}

// ── Push-Up Rep Counter ───────────────────────────────────────────────────────

/**
 * Push-up cycle:
 *   IDLE → STARTED (leaves TOP)
 *        → DEPTH   (reaches BOTTOM)
 *        → RETURNING (leaves BOTTOM after DWELL_FRAMES_DEPTH dwell)
 *        → COMPLETE  (returns to TOP) → rep++
 *        → IDLE
 */
export function stepPushUpRepCounter(
  cycleState: RepCycleState,
  _prevPhase: MovementPhase,
  currentPhase: MovementPhase,
  currentMin: number,
  currentMax: number,
  avgElbowAngle: number | null,
  depthDwellFrames: number,
): RepCounterOutput {
  if (currentPhase === 'INVALID') {
    return { nextCycleState: cycleState, countDelta: 0, nextMin: currentMin, nextMax: currentMax, nextDwell: depthDwellFrames }
  }

  const nextMin = updateMin(currentMin, avgElbowAngle)
  const nextMax = updateMax(currentMax, avgElbowAngle)

  switch (cycleState) {
    case 'IDLE': {
      if (
        currentPhase === 'DESCENDING' ||
        currentPhase === 'BOTTOM' ||
        currentPhase === 'ASCENDING'
      ) {
        return { nextCycleState: 'STARTED', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
      }
      return { nextCycleState: 'IDLE', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'STARTED': {
      if (currentPhase === 'BOTTOM') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: 1 }
      }
      if (currentPhase === 'TOP') {
        // Aborted without reaching bottom
        return {
          nextCycleState: 'IDLE',
          countDelta: 0,
          nextMin: Infinity,
          nextMax: -Infinity,
          nextDwell: 0,
        }
      }
      return { nextCycleState: 'STARTED', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'DEPTH': {
      if (currentPhase === 'BOTTOM') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
      }
      if (currentPhase === 'ASCENDING') {
        if (depthDwellFrames >= PUSHUP.DWELL_FRAMES_DEPTH) {
          return { nextCycleState: 'RETURNING', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
        }
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
      }
      return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
    }

    case 'RETURNING': {
      if (currentPhase === 'TOP') {
        return { nextCycleState: 'COMPLETE', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
      }
      if (currentPhase === 'BOTTOM') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: 1 }
      }
      return { nextCycleState: 'RETURNING', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'COMPLETE': {
      return {
        nextCycleState: 'IDLE',
        countDelta: 1,
        nextMin: Infinity,
        nextMax: -Infinity,
        nextDwell: 0,
      }
    }
  }
}

// ── Curl Rep Counter ──────────────────────────────────────────────────────────

/**
 * Curl cycle:
 *   IDLE → STARTED (leaves EXTENDED)
 *        → DEPTH   (reaches PEAK)
 *        → RETURNING (leaves PEAK after DWELL_FRAMES_DEPTH dwell)
 *        → COMPLETE  (returns to EXTENDED) → rep++
 *        → IDLE
 *
 * Tracks the single active arm's elbow angle.
 */
export function stepCurlRepCounter(
  cycleState: RepCycleState,
  _prevPhase: MovementPhase,
  currentPhase: MovementPhase,
  currentMin: number,
  currentMax: number,
  activeArmElbow: number | null,
  depthDwellFrames: number,
): RepCounterOutput {
  if (currentPhase === 'INVALID') {
    return { nextCycleState: cycleState, countDelta: 0, nextMin: currentMin, nextMax: currentMax, nextDwell: depthDwellFrames }
  }

  const nextMin = updateMin(currentMin, activeArmElbow)
  const nextMax = updateMax(currentMax, activeArmElbow)

  switch (cycleState) {
    case 'IDLE': {
      if (
        currentPhase === 'CURLING' ||
        currentPhase === 'PEAK' ||
        currentPhase === 'RETURNING'
      ) {
        return { nextCycleState: 'STARTED', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
      }
      return { nextCycleState: 'IDLE', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'STARTED': {
      if (currentPhase === 'PEAK') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: 1 }
      }
      if (currentPhase === 'EXTENDED') {
        // Aborted before reaching peak
        return {
          nextCycleState: 'IDLE',
          countDelta: 0,
          nextMin: Infinity,
          nextMax: -Infinity,
          nextDwell: 0,
        }
      }
      return { nextCycleState: 'STARTED', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'DEPTH': {
      if (currentPhase === 'PEAK') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
      }
      if (currentPhase === 'RETURNING') {
        if (depthDwellFrames >= CURL.DWELL_FRAMES_DEPTH) {
          return { nextCycleState: 'RETURNING', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
        }
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
      }
      return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: depthDwellFrames + 1 }
    }

    case 'RETURNING': {
      if (currentPhase === 'EXTENDED') {
        return { nextCycleState: 'COMPLETE', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
      }
      if (currentPhase === 'PEAK') {
        return { nextCycleState: 'DEPTH', countDelta: 0, nextMin, nextMax, nextDwell: 1 }
      }
      return { nextCycleState: 'RETURNING', countDelta: 0, nextMin, nextMax, nextDwell: 0 }
    }

    case 'COMPLETE': {
      return {
        nextCycleState: 'IDLE',
        countDelta: 1,
        nextMin: Infinity,
        nextMax: -Infinity,
        nextDwell: 0,
      }
    }
  }
}
