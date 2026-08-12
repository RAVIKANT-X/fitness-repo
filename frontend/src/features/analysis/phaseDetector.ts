/**
 * Phase detector — determines MovementPhase from extracted angles.
 *
 * Each detector function takes the current angle values, the previous
 * MovementPhase (for hysteresis), and returns the next MovementPhase.
 *
 * Hysteresis is applied via separate ENTER/EXIT thresholds from
 * analysisThresholds.ts. This prevents rapid oscillation around a
 * threshold boundary due to landmark noise.
 *
 * Pure functions — no state, no React, no side effects.
 */

import type { MovementPhase } from './analysisTypes'
import type { SquatAngles, PushUpAngles } from './angleEvaluator'
import { SQUAT, PUSHUP, CURL } from './analysisThresholds'

// ── Squat ─────────────────────────────────────────────────────────────────────

/**
 * Determines the current squat MovementPhase.
 *
 * State transitions (knee angle ↑ = more extended):
 *
 *   STANDING   → DESCENDING  when knee < STANDING_EXIT
 *   DESCENDING → BOTTOM      when knee < BOTTOM_ENTER
 *   BOTTOM     → ASCENDING   when knee > BOTTOM_EXIT
 *   ASCENDING  → STANDING    when knee > STANDING_ENTER
 *
 * Also handles ASCENDING → DESCENDING for paused mid-rep movements.
 */
export function detectSquatPhase(
  sa: SquatAngles,
  prev: MovementPhase,
): MovementPhase {
  const knee = sa.avgKnee
  if (knee === null) return 'INVALID'

  switch (prev) {
    case 'UNKNOWN':
    case 'INVALID':
      // Initialise to whichever zone the user is currently in
      if (knee >= SQUAT.STANDING_ENTER) return 'STANDING'
      if (knee <= SQUAT.BOTTOM_ENTER) return 'BOTTOM'
      return 'DESCENDING'

    case 'STANDING':
      if (knee < SQUAT.STANDING_EXIT) return 'DESCENDING'
      return 'STANDING'

    case 'DESCENDING':
      if (knee <= SQUAT.BOTTOM_ENTER) return 'BOTTOM'
      if (knee >= SQUAT.STANDING_ENTER) return 'STANDING'
      return 'DESCENDING'

    case 'BOTTOM':
      if (knee > SQUAT.BOTTOM_EXIT) return 'ASCENDING'
      return 'BOTTOM'

    case 'ASCENDING':
      if (knee >= SQUAT.STANDING_ENTER) return 'STANDING'
      if (knee <= SQUAT.BOTTOM_ENTER) return 'BOTTOM' // sank back down
      return 'ASCENDING'

    default:
      return prev
  }
}

// ── Push-Up ───────────────────────────────────────────────────────────────────

/**
 * Determines the current push-up MovementPhase.
 *
 * Uses average elbow angle (both arms expected to move together).
 *
 *   TOP        → DESCENDING  when elbow < TOP_EXIT
 *   DESCENDING → BOTTOM      when elbow < BOTTOM_ENTER
 *   BOTTOM     → ASCENDING   when elbow > BOTTOM_EXIT
 *   ASCENDING  → TOP         when elbow > TOP_ENTER
 */
export function detectPushUpPhase(
  pa: PushUpAngles,
  prev: MovementPhase,
): MovementPhase {
  const elbow = pa.avgElbow
  if (elbow === null) return 'INVALID'

  switch (prev) {
    case 'UNKNOWN':
    case 'INVALID':
      if (elbow >= PUSHUP.TOP_ENTER) return 'TOP'
      if (elbow <= PUSHUP.BOTTOM_ENTER) return 'BOTTOM'
      return 'DESCENDING'

    case 'TOP':
      if (elbow < PUSHUP.TOP_EXIT) return 'DESCENDING'
      return 'TOP'

    case 'DESCENDING':
      if (elbow <= PUSHUP.BOTTOM_ENTER) return 'BOTTOM'
      if (elbow >= PUSHUP.TOP_ENTER) return 'TOP'
      return 'DESCENDING'

    case 'BOTTOM':
      if (elbow > PUSHUP.BOTTOM_EXIT) return 'ASCENDING'
      return 'BOTTOM'

    case 'ASCENDING':
      if (elbow >= PUSHUP.TOP_ENTER) return 'TOP'
      if (elbow <= PUSHUP.BOTTOM_ENTER) return 'BOTTOM'
      return 'ASCENDING'

    default:
      return prev
  }
}

// ── Curl ──────────────────────────────────────────────────────────────────────

/**
 * Determines the curl MovementPhase for a single arm's elbow angle.
 *
 * Takes the elbow angle of the ACTIVE arm only — single-arm curl support.
 *
 *   EXTENDED  → CURLING   when elbow < EXTENDED_EXIT
 *   CURLING   → PEAK      when elbow < PEAK_ENTER
 *   PEAK      → RETURNING when elbow > PEAK_EXIT
 *   RETURNING → EXTENDED  when elbow > EXTENDED_ENTER
 */
export function detectCurlPhase(
  elbowAngle: number | null,
  prev: MovementPhase,
): MovementPhase {
  if (elbowAngle === null) return 'INVALID'

  switch (prev) {
    case 'UNKNOWN':
    case 'INVALID':
      if (elbowAngle >= CURL.EXTENDED_ENTER) return 'EXTENDED'
      if (elbowAngle <= CURL.PEAK_ENTER) return 'PEAK'
      return 'CURLING'

    case 'EXTENDED':
      if (elbowAngle < CURL.EXTENDED_EXIT) return 'CURLING'
      return 'EXTENDED'

    case 'CURLING':
      if (elbowAngle <= CURL.PEAK_ENTER) return 'PEAK'
      if (elbowAngle >= CURL.EXTENDED_ENTER) return 'EXTENDED'
      return 'CURLING'

    case 'PEAK':
      if (elbowAngle > CURL.PEAK_EXIT) return 'RETURNING'
      return 'PEAK'

    case 'RETURNING':
      if (elbowAngle >= CURL.EXTENDED_ENTER) return 'EXTENDED'
      if (elbowAngle <= CURL.PEAK_ENTER) return 'PEAK' // returned to peak
      return 'RETURNING'

    default:
      return prev
  }
}
