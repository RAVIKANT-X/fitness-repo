/**
 * repCounter.test.ts
 *
 * Tests for the exercise rep-counting state machines.
 * Verifies:
 *  - complete reps increment the count
 *  - partial reps do not count
 *  - threshold jitter does not cause phantom reps
 *  - INVALID phase does not advance the state machine
 */

import { describe, it, expect } from 'vitest'
import {
  stepSquatRepCounter,
  stepPushUpRepCounter,
  stepCurlRepCounter,
} from '../features/analysis/repCounter'
import type { RepCycleState, MovementPhase } from '../features/analysis/analysisTypes'

// ── Squat Rep Counter ─────────────────────────────────────────────────────────

describe('stepSquatRepCounter — complete rep', () => {
  /**
   * Simulate: IDLE → STARTED → DEPTH → RETURNING → COMPLETE
   * Then the COMPLETE frame resets and returns countDelta=1.
   */
  it('counts 1 rep for a full STANDING→BOTTOM→STANDING cycle', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity
    let max = -Infinity
    let totalCount = 0

    // Phase: STANDING (idle)
    let out = stepSquatRepCounter(state, 'UNKNOWN', 'STANDING', min, max, 160)
    state = out.nextCycleState
    min = out.nextMin
    max = out.nextMax
    expect(state).toBe('IDLE')

    // Phase: DESCENDING
    out = stepSquatRepCounter(state, 'STANDING', 'DESCENDING', min, max, 135)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('STARTED')

    // Phase: BOTTOM
    out = stepSquatRepCounter(state, 'DESCENDING', 'BOTTOM', min, max, 105)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('DEPTH')

    // Phase: ASCENDING
    out = stepSquatRepCounter(state, 'BOTTOM', 'ASCENDING', min, max, 120)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('RETURNING')

    // Phase: STANDING — rep completes
    out = stepSquatRepCounter(state, 'ASCENDING', 'STANDING', min, max, 160)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('COMPLETE')

    // COMPLETE fires count
    out = stepSquatRepCounter(state, 'STANDING', 'STANDING', min, max, 160)
    totalCount += out.countDelta
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(out.countDelta).toBe(1)
    expect(state).toBe('IDLE')
    expect(totalCount).toBe(1)
  })
})

describe('stepSquatRepCounter — partial squat (no BOTTOM)', () => {
  it('does not count a rep when BOTTOM is never reached', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity; let max = -Infinity

    // Start descending
    let out = stepSquatRepCounter(state, 'STANDING', 'DESCENDING', min, max, 135)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('STARTED')

    // Return to standing without reaching bottom
    out = stepSquatRepCounter(state, 'DESCENDING', 'STANDING', min, max, 160)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('IDLE')
    expect(out.countDelta).toBe(0)
  })
})

describe('stepSquatRepCounter — INVALID phase does not advance state', () => {
  it('preserves cycle state on INVALID phase', () => {
    // Simulate mid-rep interruption
    let state: RepCycleState = 'DEPTH'
    let out = stepSquatRepCounter(state, 'BOTTOM', 'INVALID', 105, 160, null)
    expect(out.nextCycleState).toBe('DEPTH')
    expect(out.countDelta).toBe(0)
  })
})

describe('stepSquatRepCounter — does not double count from jitter at STANDING', () => {
  it('stays IDLE when oscillating around STANDING without descending', () => {
    let state: RepCycleState = 'IDLE'
    let count = 0
    let min = Infinity; let max = -Infinity

    // Multiple transitions that don't go below STANDING threshold
    for (let i = 0; i < 10; i++) {
      const out = stepSquatRepCounter(state, 'STANDING', 'STANDING', min, max, 160)
      state = out.nextCycleState
      count += out.countDelta
    }
    expect(count).toBe(0)
    expect(state).toBe('IDLE')
  })
})

// ── Phase 4.5 Squat Depth Tests ───────────────────────────────────────────────

describe('stepSquatRepCounter — Phase 4.5: good depth squat (108°)', () => {
  /**
   * With BOTTOM_ENTER=130: 108° < 130 → enters BOTTOM → rep complete
   * min angle = 108 < MIN_DEPTH_REQUIRED=115 → no DEPTH_TOO_SHALLOW
   * The counter tracks the min correctly for the deviation detector.
   */
  it('completes a rep and tracks min=108 for a good-depth squat', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity
    let max = -Infinity
    let totalCount = 0

    const steps: Array<[MovementPhase, number]> = [
      ['STANDING',   165],
      ['DESCENDING', 140],
      ['BOTTOM',     108],  // 108 < BOTTOM_ENTER=130, min tracked
      ['ASCENDING',  150],
      ['STANDING',   165],
    ]

    for (const [phase, angle] of steps) {
      const out = stepSquatRepCounter(state, 'UNKNOWN', phase, min, max, angle)
      state = out.nextCycleState
      min = out.nextMin
      max = out.nextMax
      totalCount += out.countDelta
    }

    expect(state).toBe('COMPLETE')
    // min should be 108 — tracked during the rep
    expect(min).toBe(108)

    // Fire COMPLETE
    const out = stepSquatRepCounter(state, 'STANDING', 'STANDING', min, max, 165)
    totalCount += out.countDelta
    expect(out.countDelta).toBe(1)
    expect(totalCount).toBe(1)
  })
})

describe('stepSquatRepCounter — Phase 4.5: shallow completed squat (128°)', () => {
  /**
   * With BOTTOM_ENTER=130: 128° < 130 → enters BOTTOM → rep counts
   * min angle = 128 > MIN_DEPTH_REQUIRED=115 → caller should flag DEPTH_TOO_SHALLOW
   */
  it('completes a rep and tracks min=128 for a shallow squat', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity
    let max = -Infinity
    let totalCount = 0

    const steps: Array<[MovementPhase, number]> = [
      ['STANDING',   165],
      ['DESCENDING', 140],
      ['BOTTOM',     128],  // 128 < BOTTOM_ENTER=130 → BOTTOM confirmed; min=128 > 115
      ['ASCENDING',  150],
      ['STANDING',   165],
    ]

    for (const [phase, angle] of steps) {
      const out = stepSquatRepCounter(state, 'UNKNOWN', phase, min, max, angle)
      state = out.nextCycleState
      min = out.nextMin
      max = out.nextMax
      totalCount += out.countDelta
    }

    expect(state).toBe('COMPLETE')
    // min should be 128 — shallow but tracked correctly
    expect(min).toBe(128)

    const out = stepSquatRepCounter(state, 'STANDING', 'STANDING', min, max, 165)
    totalCount += out.countDelta
    expect(out.countDelta).toBe(1)
    expect(totalCount).toBe(1)
  })
})

describe('stepSquatRepCounter — Phase 4.5: incomplete squat (140° — never enters BOTTOM)', () => {
  /**
   * 140° > BOTTOM_ENTER=130 → BOTTOM phase is never reached → no rep counted
   */
  it('counts 0 reps when squat stays at 140° (above BOTTOM_ENTER=130°)', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity
    let max = -Infinity

    // Descend to 140° then return — never crosses 130°
    let out = stepSquatRepCounter(state, 'STANDING', 'DESCENDING', min, max, 140)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('STARTED')

    // Stays DESCENDING with angle 140 — no BOTTOM
    out = stepSquatRepCounter(state, 'DESCENDING', 'DESCENDING', min, max, 140)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('STARTED')

    // Returns to standing
    out = stepSquatRepCounter(state, 'DESCENDING', 'STANDING', min, max, 165)
    expect(out.nextCycleState).toBe('IDLE')
    expect(out.countDelta).toBe(0)
  })
})

describe('stepSquatRepCounter — Phase 4.5: threshold jitter at BOTTOM boundary', () => {
  /**
   * Oscillation at BOTTOM_ENTER=130 boundary should not cause duplicate DEPTH transitions.
   * BOTTOM_EXIT=145 prevents leaving BOTTOM until angle rises above 145.
   */
  it('stays in DEPTH state when oscillating around 130° once in BOTTOM', () => {
    let state: RepCycleState = 'DEPTH'
    let count = 0

    // Oscillate between 128 and 132 — below BOTTOM_EXIT=145, so stays BOTTOM
    const angles = [128, 131, 129, 132, 128]
    for (const angle of angles) {
      const out = stepSquatRepCounter(state, 'BOTTOM', 'BOTTOM', Infinity, -Infinity, angle)
      state = out.nextCycleState
      count += out.countDelta
    }

    expect(count).toBe(0)
    expect(state).toBe('DEPTH')
  })
})



// ── Push-Up Rep Counter ───────────────────────────────────────────────────────

describe('stepPushUpRepCounter — complete rep', () => {
  it('counts 1 rep for a full TOP→BOTTOM→TOP cycle', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity; let max = -Infinity
    let totalCount = 0

    const steps: Array<[MovementPhase, number]> = [
      ['TOP', 160],
      ['DESCENDING', 120],
      ['BOTTOM', 75],
      ['ASCENDING', 100],
      ['TOP', 160],
    ]

    for (const [phase, angle] of steps) {
      const out = stepPushUpRepCounter(state, 'UNKNOWN', phase, min, max, angle)
      state = out.nextCycleState
      min = out.nextMin
      max = out.nextMax
      totalCount += out.countDelta
    }

    // Should be COMPLETE now
    expect(state).toBe('COMPLETE')

    // Fire COMPLETE
    const out = stepPushUpRepCounter(state, 'TOP', 'TOP', min, max, 160)
    totalCount += out.countDelta
    expect(totalCount).toBe(1)
    expect(out.nextCycleState).toBe('IDLE')
  })
})

describe('stepPushUpRepCounter — partial push-up (no BOTTOM)', () => {
  it('does not count a rep when returning to TOP before reaching BOTTOM', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity; let max = -Infinity

    // Descend a bit then return
    let out = stepPushUpRepCounter(state, 'TOP', 'DESCENDING', min, max, 120)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('STARTED')

    out = stepPushUpRepCounter(state, 'DESCENDING', 'TOP', min, max, 160)
    state = out.nextCycleState
    expect(state).toBe('IDLE')
    expect(out.countDelta).toBe(0)
  })
})

describe('stepPushUpRepCounter — INVALID does not advance', () => {
  it('preserves DEPTH state through INVALID frames', () => {
    const out = stepPushUpRepCounter('DEPTH', 'BOTTOM', 'INVALID', 70, 160, null)
    expect(out.nextCycleState).toBe('DEPTH')
    expect(out.countDelta).toBe(0)
  })
})

// ── Curl Rep Counter ──────────────────────────────────────────────────────────

describe('stepCurlRepCounter — complete rep', () => {
  it('counts 1 rep for a full EXTENDED→PEAK→EXTENDED cycle', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity; let max = -Infinity
    let totalCount = 0

    const steps: Array<[MovementPhase, number]> = [
      ['EXTENDED', 160],
      ['CURLING', 100],
      ['PEAK', 55],
      ['RETURNING', 80],
      ['EXTENDED', 160],
    ]

    for (const [phase, angle] of steps) {
      const out = stepCurlRepCounter(state, 'UNKNOWN', phase, min, max, angle)
      state = out.nextCycleState
      min = out.nextMin
      max = out.nextMax
      totalCount += out.countDelta
    }

    expect(state).toBe('COMPLETE')

    const out = stepCurlRepCounter(state, 'EXTENDED', 'EXTENDED', min, max, 160)
    totalCount += out.countDelta
    expect(totalCount).toBe(1)
    expect(out.nextCycleState).toBe('IDLE')
  })
})

describe('stepCurlRepCounter — partial curl (no PEAK)', () => {
  it('does not count when returning to EXTENDED before reaching PEAK', () => {
    let state: RepCycleState = 'IDLE'
    let min = Infinity; let max = -Infinity

    // Start curling
    let out = stepCurlRepCounter(state, 'EXTENDED', 'CURLING', min, max, 110)
    state = out.nextCycleState; min = out.nextMin; max = out.nextMax
    expect(state).toBe('STARTED')

    // Return without reaching PEAK
    out = stepCurlRepCounter(state, 'CURLING', 'EXTENDED', min, max, 160)
    state = out.nextCycleState
    expect(state).toBe('IDLE')
    expect(out.countDelta).toBe(0)
  })
})

describe('stepCurlRepCounter — INVALID does not advance', () => {
  it('preserves DEPTH state when phase is INVALID', () => {
    const out = stepCurlRepCounter('DEPTH', 'PEAK', 'INVALID', 55, 160, null)
    expect(out.nextCycleState).toBe('DEPTH')
    expect(out.countDelta).toBe(0)
  })
})

describe('stepCurlRepCounter — threshold jitter at PEAK', () => {
  it('does not create extra DEPTH→RETURNING transitions from small oscillation', () => {
    // Simulate staying at PEAK with minor angle variation
    let state: RepCycleState = 'DEPTH'
    let count = 0

    // Oscillate around 60° (just above and below PEAK_EXIT=75) — but stay below exit
    const angles = [58, 62, 59, 63, 57]
    for (const angle of angles) {
      const out = stepCurlRepCounter(state, 'PEAK', 'PEAK', Infinity, -Infinity, angle)
      state = out.nextCycleState
      count += out.countDelta
    }

    expect(count).toBe(0)
    expect(state).toBe('DEPTH')
  })
})
