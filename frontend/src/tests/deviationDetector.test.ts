/**
 * deviationDetector.test.ts
 *
 * Tests for form deviation detection.
 * Verifies:
 *  - per-frame asymmetry and alignment deviations
 *  - post-rep depth/extension deviations
 *  - no false positives on good form
 *  - deriveFormStatus aggregation
 */

import { describe, it, expect } from 'vitest'
import {
  detectSquatFrameDeviations,
  detectSquatRepDeviations,
  detectPushUpFrameDeviations,
  detectPushUpRepDeviations,
  detectCurlFrameDeviations,
  detectCurlRepDeviations,
  deriveFormStatus,
} from '../features/analysis/deviationDetector'
import type { SquatAngles, PushUpAngles } from '../features/analysis/angleEvaluator'
import { SQUAT, PUSHUP, CURL } from '../features/analysis/analysisThresholds'

// ── Helpers ───────────────────────────────────────────────────────────────────

function squatAngles(partial: Partial<SquatAngles> = {}): SquatAngles {
  return {
    leftKnee: 90,
    rightKnee: 90,
    leftHip: 80,
    rightHip: 80,
    avgKnee: 90,
    avgHip: 80,
    ...partial,
  }
}

function pushUpAngles(partial: Partial<PushUpAngles> = {}): PushUpAngles {
  return {
    leftElbow: 75,
    rightElbow: 75,
    leftShoulder: 40,
    rightShoulder: 40,
    avgElbow: 75,
    ...partial,
  }
}

// ── Squat frame deviations ────────────────────────────────────────────────────

describe('detectSquatFrameDeviations — no deviation for symmetric form', () => {
  it('returns empty array when form is good', () => {
    const result = detectSquatFrameDeviations(squatAngles())
    expect(result).toHaveLength(0)
  })
})

describe('detectSquatFrameDeviations — KNEE_ASYMMETRY', () => {
  it('flags KNEE_ASYMMETRY when left/right differ by more than threshold', () => {
    const sa = squatAngles({
      leftKnee: 80,
      rightKnee: 80 + SQUAT.KNEE_ASYMMETRY_THRESHOLD + 5, // exceeds threshold
    })
    const result = detectSquatFrameDeviations(sa)
    const ids = result.map((d) => d.id)
    expect(ids).toContain('KNEE_ASYMMETRY')
  })

  it('does NOT flag KNEE_ASYMMETRY below threshold', () => {
    const sa = squatAngles({
      leftKnee: 90,
      rightKnee: 90 + SQUAT.KNEE_ASYMMETRY_THRESHOLD - 1,
    })
    const result = detectSquatFrameDeviations(sa)
    const ids = result.map((d) => d.id)
    expect(ids).not.toContain('KNEE_ASYMMETRY')
  })

  it('does NOT flag KNEE_ASYMMETRY when one side is null', () => {
    const sa = squatAngles({ leftKnee: null })
    const result = detectSquatFrameDeviations(sa)
    const ids = result.map((d) => d.id)
    expect(ids).not.toContain('KNEE_ASYMMETRY')
  })
})

describe('detectSquatFrameDeviations — HIP_ASYMMETRY', () => {
  it('flags HIP_ASYMMETRY when hips differ by more than threshold', () => {
    const sa = squatAngles({
      leftHip: 70,
      rightHip: 70 + SQUAT.HIP_ASYMMETRY_THRESHOLD + 5,
    })
    const result = detectSquatFrameDeviations(sa)
    const ids = result.map((d) => d.id)
    expect(ids).toContain('HIP_ASYMMETRY')
  })
})

// ── Squat rep deviations ──────────────────────────────────────────────────────

describe('detectSquatRepDeviations — DEPTH_TOO_SHALLOW', () => {
  it('flags DEPTH_TOO_SHALLOW when min angle exceeds required depth', () => {
    const result = detectSquatRepDeviations(SQUAT.MIN_DEPTH_REQUIRED + 5)
    expect(result.map((d) => d.id)).toContain('DEPTH_TOO_SHALLOW')
  })

  it('does NOT flag when depth is sufficient', () => {
    const result = detectSquatRepDeviations(SQUAT.MIN_DEPTH_REQUIRED - 5)
    expect(result).toHaveLength(0)
  })

  it('includes observed and threshold values', () => {
    const observed = SQUAT.MIN_DEPTH_REQUIRED + 10
    const result = detectSquatRepDeviations(observed)
    expect(result[0].observed).toBe(observed)
    expect(result[0].threshold).toBe(SQUAT.MIN_DEPTH_REQUIRED)
  })
})

// ── Push-up frame deviations ──────────────────────────────────────────────────

describe('detectPushUpFrameDeviations — no deviation for good form', () => {
  it('returns empty when form is symmetric and aligned', () => {
    const result = detectPushUpFrameDeviations(pushUpAngles())
    expect(result).toHaveLength(0)
  })
})

describe('detectPushUpFrameDeviations — ELBOW_ASYMMETRY', () => {
  it('flags ELBOW_ASYMMETRY when elbows differ by more than threshold', () => {
    const pa = pushUpAngles({
      leftElbow: 70,
      rightElbow: 70 + PUSHUP.ELBOW_ASYMMETRY_THRESHOLD + 5,
    })
    const result = detectPushUpFrameDeviations(pa)
    expect(result.map((d) => d.id)).toContain('ELBOW_ASYMMETRY')
  })
})

describe('detectPushUpFrameDeviations — SHOULDER_ALIGNMENT', () => {
  it('flags SHOULDER_ALIGNMENT when left shoulder exceeds max', () => {
    const pa = pushUpAngles({ leftShoulder: PUSHUP.SHOULDER_ALIGNMENT_MAX + 5 })
    const result = detectPushUpFrameDeviations(pa)
    expect(result.map((d) => d.id)).toContain('SHOULDER_ALIGNMENT')
  })

  it('flags SHOULDER_ALIGNMENT when right shoulder exceeds max', () => {
    const pa = pushUpAngles({ rightShoulder: PUSHUP.SHOULDER_ALIGNMENT_MAX + 5 })
    const result = detectPushUpFrameDeviations(pa)
    expect(result.map((d) => d.id)).toContain('SHOULDER_ALIGNMENT')
  })
})

// ── Push-up rep deviations ────────────────────────────────────────────────────

describe('detectPushUpRepDeviations — DEPTH_TOO_SHALLOW', () => {
  it('flags DEPTH_TOO_SHALLOW when min elbow exceeds required', () => {
    const result = detectPushUpRepDeviations(PUSHUP.MIN_DEPTH_REQUIRED + 10)
    expect(result.map((d) => d.id)).toContain('DEPTH_TOO_SHALLOW')
  })

  it('does NOT flag when depth is sufficient', () => {
    const result = detectPushUpRepDeviations(PUSHUP.MIN_DEPTH_REQUIRED - 10)
    expect(result).toHaveLength(0)
  })
})

// ── Curl frame deviations ─────────────────────────────────────────────────────

describe('detectCurlFrameDeviations — no deviation when stable', () => {
  it('returns empty when shoulder is within baseline', () => {
    const result = detectCurlFrameDeviations(35, 35) // no deviation
    expect(result).toHaveLength(0)
  })
})

describe('detectCurlFrameDeviations — SHOULDER_MOVEMENT', () => {
  it('flags SHOULDER_MOVEMENT when deviation exceeds threshold', () => {
    const baseline = 30
    const active = baseline + CURL.SHOULDER_MOVEMENT_MAX_DEVIATION + 5
    const result = detectCurlFrameDeviations(active, baseline)
    expect(result.map((d) => d.id)).toContain('SHOULDER_MOVEMENT')
  })

  it('does NOT flag when no baseline captured', () => {
    const result = detectCurlFrameDeviations(55, null) // no baseline
    expect(result).toHaveLength(0)
  })

  it('does NOT flag when active arm angle is null', () => {
    const result = detectCurlFrameDeviations(null, 30)
    expect(result).toHaveLength(0)
  })
})

// ── Curl rep deviations ───────────────────────────────────────────────────────

describe('detectCurlRepDeviations — INCOMPLETE_CURL', () => {
  it('flags INCOMPLETE_CURL when min angle exceeds required', () => {
    const result = detectCurlRepDeviations(CURL.MIN_CURL_REQUIRED + 10, 160)
    expect(result.map((d) => d.id)).toContain('INCOMPLETE_CURL')
  })

  it('does NOT flag when curl is sufficient', () => {
    const result = detectCurlRepDeviations(CURL.MIN_CURL_REQUIRED - 5, 160)
    expect(result.map((d) => d.id)).not.toContain('INCOMPLETE_CURL')
  })
})

describe('detectCurlRepDeviations — INCOMPLETE_EXTENSION', () => {
  it('flags INCOMPLETE_EXTENSION when max angle is below required', () => {
    const result = detectCurlRepDeviations(50, CURL.MIN_EXTENSION_REQUIRED - 10)
    expect(result.map((d) => d.id)).toContain('INCOMPLETE_EXTENSION')
  })

  it('does NOT flag when extension is sufficient', () => {
    const result = detectCurlRepDeviations(50, CURL.MIN_EXTENSION_REQUIRED + 5)
    expect(result.map((d) => d.id)).not.toContain('INCOMPLETE_EXTENSION')
  })
})

// ── deriveFormStatus ──────────────────────────────────────────────────────────

describe('deriveFormStatus', () => {
  it('returns GOOD for empty deviations', () => {
    expect(deriveFormStatus([])).toBe('GOOD')
  })

  it('returns GOOD for INFO-only deviations', () => {
    expect(
      deriveFormStatus([{ id: 'HIP_ASYMMETRY', severity: 'INFO', observed: 25, threshold: 20 }])
    ).toBe('GOOD')
  })

  it('returns WARNING for any WARNING deviation', () => {
    expect(
      deriveFormStatus([{ id: 'KNEE_ASYMMETRY', severity: 'WARNING', observed: 30, threshold: 20 }])
    ).toBe('WARNING')
  })

  it('returns WARNING for any ERROR deviation', () => {
    expect(
      deriveFormStatus([{ id: 'TEST', severity: 'ERROR', observed: 0, threshold: 0 }])
    ).toBe('WARNING')
  })
})
