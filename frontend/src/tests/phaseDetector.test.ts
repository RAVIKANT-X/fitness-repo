/**
 * phaseDetector.test.ts
 *
 * Tests for MovementPhase detection with hysteresis.
 * Verifies:
 *  - correct phase transitions for each exercise
 *  - hysteresis prevents oscillation
 *  - INVALID returned when angles are null
 */

import { describe, it, expect } from 'vitest'
import { detectSquatPhase, detectPushUpPhase, detectCurlPhase } from '../features/analysis/phaseDetector'
import type { SquatAngles, PushUpAngles } from '../features/analysis/angleEvaluator'
import { SQUAT, PUSHUP, CURL } from '../features/analysis/analysisThresholds'

// ── Helpers ───────────────────────────────────────────────────────────────────

function squatAngles(avgKnee: number | null): SquatAngles {
  return {
    leftKnee: avgKnee,
    rightKnee: avgKnee,
    leftHip: 90,
    rightHip: 90,
    avgKnee,
    avgHip: 90,
  }
}

function pushUpAngles(avgElbow: number | null): PushUpAngles {
  return {
    leftElbow: avgElbow,
    rightElbow: avgElbow,
    leftShoulder: 40,
    rightShoulder: 40,
    avgElbow,
  }
}

// ── detectSquatPhase ──────────────────────────────────────────────────────────

describe('detectSquatPhase — basic transitions', () => {
  it('initialises to STANDING when angle is above threshold', () => {
    expect(detectSquatPhase(squatAngles(170), 'UNKNOWN')).toBe('STANDING')
  })

  it('initialises to BOTTOM when angle is below bottom threshold', () => {
    expect(detectSquatPhase(squatAngles(SQUAT.BOTTOM_ENTER - 5), 'UNKNOWN')).toBe('BOTTOM')
  })

  it('initialises to DESCENDING when angle is between thresholds', () => {
    // Between BOTTOM_ENTER(130) exclusive and STANDING_ENTER(160) exclusive
    // Use 145° — above BOTTOM_ENTER=130, below STANDING_ENTER=160
    expect(detectSquatPhase(squatAngles(145), 'UNKNOWN')).toBe('DESCENDING')
  })

  it('transitions STANDING → DESCENDING when knee drops below exit', () => {
    // STANDING_EXIT = 145; dropping below should transition
    const phase = detectSquatPhase(squatAngles(SQUAT.STANDING_EXIT - 1), 'STANDING')
    expect(phase).toBe('DESCENDING')
  })

  it('stays STANDING above exit threshold', () => {
    const phase = detectSquatPhase(squatAngles(SQUAT.STANDING_EXIT + 5), 'STANDING')
    expect(phase).toBe('STANDING')
  })

  it('transitions DESCENDING → BOTTOM when angle reaches bottom threshold', () => {
    const phase = detectSquatPhase(squatAngles(SQUAT.BOTTOM_ENTER - 1), 'DESCENDING')
    expect(phase).toBe('BOTTOM')
  })

  it('transitions BOTTOM → ASCENDING when angle rises above exit threshold', () => {
    const phase = detectSquatPhase(squatAngles(SQUAT.BOTTOM_EXIT + 1), 'BOTTOM')
    expect(phase).toBe('ASCENDING')
  })

  it('stays BOTTOM below exit threshold', () => {
    const phase = detectSquatPhase(squatAngles(SQUAT.BOTTOM_ENTER + 5), 'BOTTOM')
    expect(phase).toBe('BOTTOM')
  })

  it('transitions ASCENDING → STANDING when angle reaches standing threshold', () => {
    const phase = detectSquatPhase(squatAngles(SQUAT.STANDING_ENTER + 5), 'ASCENDING')
    expect(phase).toBe('STANDING')
  })
})

describe('detectSquatPhase — hysteresis', () => {
  it('does NOT leave STANDING on a small dip (below enter but above exit)', () => {
    // angle between STANDING_EXIT(145) and STANDING_ENTER(160) — must stay STANDING
    const borderlineAngle = SQUAT.STANDING_EXIT + 5 // 150 — above exit threshold
    expect(detectSquatPhase(squatAngles(borderlineAngle), 'STANDING')).toBe('STANDING')
  })

  it('does NOT leave BOTTOM on a small rise (below exit)', () => {
    // BOTTOM_EXIT = 145 — staying below should keep BOTTOM
    const angle = SQUAT.BOTTOM_EXIT - 5 // 140
    expect(detectSquatPhase(squatAngles(angle), 'BOTTOM')).toBe('BOTTOM')
  })
})

describe('detectSquatPhase — null angles', () => {
  it('returns INVALID when avgKnee is null', () => {
    expect(detectSquatPhase(squatAngles(null), 'STANDING')).toBe('INVALID')
  })
})

// ── detectPushUpPhase ─────────────────────────────────────────────────────────

describe('detectPushUpPhase — basic transitions', () => {
  it('initialises to TOP when elbow is extended', () => {
    expect(detectPushUpPhase(pushUpAngles(170), 'UNKNOWN')).toBe('TOP')
  })

  it('transitions TOP → DESCENDING when elbow drops below exit', () => {
    const phase = detectPushUpPhase(pushUpAngles(PUSHUP.TOP_EXIT - 1), 'TOP')
    expect(phase).toBe('DESCENDING')
  })

  it('stays TOP above exit threshold', () => {
    const phase = detectPushUpPhase(pushUpAngles(PUSHUP.TOP_EXIT + 5), 'TOP')
    expect(phase).toBe('TOP')
  })

  it('transitions DESCENDING → BOTTOM when elbow reaches bottom', () => {
    const phase = detectPushUpPhase(pushUpAngles(PUSHUP.BOTTOM_ENTER - 1), 'DESCENDING')
    expect(phase).toBe('BOTTOM')
  })

  it('transitions BOTTOM → ASCENDING when elbow rises above exit', () => {
    const phase = detectPushUpPhase(pushUpAngles(PUSHUP.BOTTOM_EXIT + 1), 'BOTTOM')
    expect(phase).toBe('ASCENDING')
  })

  it('stays BOTTOM below exit threshold', () => {
    const phase = detectPushUpPhase(pushUpAngles(PUSHUP.BOTTOM_ENTER + 5), 'BOTTOM')
    expect(phase).toBe('BOTTOM')
  })

  it('transitions ASCENDING → TOP when elbow reaches top', () => {
    const phase = detectPushUpPhase(pushUpAngles(PUSHUP.TOP_ENTER + 5), 'ASCENDING')
    expect(phase).toBe('TOP')
  })
})

describe('detectPushUpPhase — hysteresis', () => {
  it('does NOT leave TOP on a small dip above exit threshold', () => {
    const angle = PUSHUP.TOP_EXIT + 5 // above exit — stays TOP
    expect(detectPushUpPhase(pushUpAngles(angle), 'TOP')).toBe('TOP')
  })
})

// ── detectCurlPhase ───────────────────────────────────────────────────────────

describe('detectCurlPhase — basic transitions', () => {
  it('initialises to EXTENDED when arm is straight', () => {
    expect(detectCurlPhase(170, 'UNKNOWN')).toBe('EXTENDED')
  })

  it('transitions EXTENDED → CURLING when elbow drops below exit', () => {
    expect(detectCurlPhase(CURL.EXTENDED_EXIT - 1, 'EXTENDED')).toBe('CURLING')
  })

  it('stays EXTENDED above exit threshold', () => {
    expect(detectCurlPhase(CURL.EXTENDED_EXIT + 5, 'EXTENDED')).toBe('EXTENDED')
  })

  it('transitions CURLING → PEAK when elbow reaches peak angle', () => {
    expect(detectCurlPhase(CURL.PEAK_ENTER - 1, 'CURLING')).toBe('PEAK')
  })

  it('transitions PEAK → RETURNING when elbow rises above exit', () => {
    expect(detectCurlPhase(CURL.PEAK_EXIT + 1, 'PEAK')).toBe('RETURNING')
  })

  it('stays PEAK below exit threshold', () => {
    expect(detectCurlPhase(CURL.PEAK_ENTER + 5, 'PEAK')).toBe('PEAK')
  })

  it('transitions RETURNING → EXTENDED when arm fully extends', () => {
    expect(detectCurlPhase(CURL.EXTENDED_ENTER + 5, 'RETURNING')).toBe('EXTENDED')
  })
})

describe('detectCurlPhase — hysteresis', () => {
  it('does NOT leave EXTENDED on a small bend above exit threshold', () => {
    const angle = CURL.EXTENDED_EXIT + 5 // above exit — stays EXTENDED
    expect(detectCurlPhase(angle, 'EXTENDED')).toBe('EXTENDED')
  })

  it('does NOT leave PEAK on a small rise below exit threshold', () => {
    const angle = CURL.PEAK_EXIT - 5 // below exit — stays PEAK
    expect(detectCurlPhase(angle, 'PEAK')).toBe('PEAK')
  })
})

describe('detectCurlPhase — null angle', () => {
  it('returns INVALID when elbow angle is null', () => {
    expect(detectCurlPhase(null, 'EXTENDED')).toBe('INVALID')
  })
})
