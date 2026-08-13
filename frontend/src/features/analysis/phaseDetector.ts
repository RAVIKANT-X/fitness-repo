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
 * Refinements (v2):
 *  - UNKNOWN initialisation now picks the most specific zone rather than
 *    defaulting too eagerly to DESCENDING/CURLING (reduces false rep starts).
 *  - Squat: ASCENDING→STANDING requires truly passing STANDING_ENTER (was
 *    STANDING_ENTER directly — now uses the same strict value, but the
 *    BOTTOM_EXIT gap is wider so the path DEPTH→RETURNING is cleaner).
 *  - PushUp: same corrections mirror the squat fixes.
 *  - Curl: RETURNING→EXTENDED requires arm to fully pass EXTENDED_ENTER,
 *    preventing incomplete-extension reps from silently completing.
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
 * Initialization from UNKNOWN/INVALID:
 *   Picks the correct zone immediately to avoid spurious DESCENDING
 *   on first detection if the user is standing still.
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
      // Initialise into the tightest matching zone to avoid false starts.
      if (knee >= SQUAT.STANDING_ENTER) return 'STANDING'
      if (knee <= SQUAT.BOTTOM_ENTER)   return 'BOTTOM'
      // Mid-range: classify as DESCENDING only if clearly not at rest.
      // Use STANDING_EXIT as the upper guard so a casual stand doesn't
      // immediately register as descending.
      if (knee >= SQUAT.STANDING_EXIT) return 'STANDING'
      return 'DESCENDING'

    case 'STANDING':
      if (knee < SQUAT.STANDING_EXIT) return 'DESCENDING'
      return 'STANDING'

    case 'DESCENDING':
      if (knee <= SQUAT.BOTTOM_ENTER)  return 'BOTTOM'
      if (knee >= SQUAT.STANDING_ENTER) return 'STANDING'
      return 'DESCENDING'

    case 'BOTTOM':
      if (knee > SQUAT.BOTTOM_EXIT) return 'ASCENDING'
      return 'BOTTOM'

    case 'ASCENDING':
      if (knee >= SQUAT.STANDING_ENTER) return 'STANDING'
      if (knee <= SQUAT.BOTTOM_ENTER)   return 'BOTTOM' // sank back down
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
 *
 * Initialization fix: same guard as squat — if the user starts with
 * arms fully extended, go directly to TOP rather than DESCENDING.
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
      if (elbow >= PUSHUP.TOP_ENTER)    return 'TOP'
      if (elbow <= PUSHUP.BOTTOM_ENTER) return 'BOTTOM'
      // Mid-range: if close to top, initialise there to avoid false start
      if (elbow >= PUSHUP.TOP_EXIT) return 'TOP'
      return 'DESCENDING'

    case 'TOP':
      if (elbow < PUSHUP.TOP_EXIT) return 'DESCENDING'
      return 'TOP'

    case 'DESCENDING':
      if (elbow <= PUSHUP.BOTTOM_ENTER) return 'BOTTOM'
      if (elbow >= PUSHUP.TOP_ENTER)    return 'TOP'
      return 'DESCENDING'

    case 'BOTTOM':
      if (elbow > PUSHUP.BOTTOM_EXIT) return 'ASCENDING'
      return 'BOTTOM'

    case 'ASCENDING':
      if (elbow >= PUSHUP.TOP_ENTER)    return 'TOP'
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
 *
 * Initialization fix: if elbow is already near-extended, go to EXTENDED
 * rather than CURLING to prevent a phantom rep on first detection.
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
      if (elbowAngle <= CURL.PEAK_ENTER)     return 'PEAK'
      // Mid-range: if closer to extended, go EXTENDED to prevent false start
      if (elbowAngle >= CURL.EXTENDED_EXIT) return 'EXTENDED'
      return 'CURLING'

    case 'EXTENDED':
      if (elbowAngle < CURL.EXTENDED_EXIT) return 'CURLING'
      return 'EXTENDED'

    case 'CURLING':
      if (elbowAngle <= CURL.PEAK_ENTER)     return 'PEAK'
      if (elbowAngle >= CURL.EXTENDED_ENTER) return 'EXTENDED'
      return 'CURLING'

    case 'PEAK':
      if (elbowAngle > CURL.PEAK_EXIT) return 'RETURNING'
      return 'PEAK'

    case 'RETURNING':
      if (elbowAngle >= CURL.EXTENDED_ENTER) return 'EXTENDED'
      if (elbowAngle <= CURL.PEAK_ENTER)     return 'PEAK' // returned to peak
      return 'RETURNING'

    default:
      return prev
  }
}
