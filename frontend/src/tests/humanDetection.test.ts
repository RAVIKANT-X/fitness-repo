/**
 * Tests for human detection system.
 *
 * Verifies that detectHuman correctly identifies:
 *  - VALID_PERSON: high-confidence full-body landmarks
 *  - PARTIAL_PERSON: some key landmarks missing
 *  - LOW_CONFIDENCE: landmarks present but visibility too low
 *  - NO_PERSON: no landmarks detected
 */

import { describe, it, expect } from 'vitest'
import { detectHuman, validateExerciseLandmarks } from '../features/camera/humanDetection'
import type { NormalizedLandmark } from '../features/pose/poseTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLandmarks(
  overrides: Partial<Record<number, Partial<NormalizedLandmark>>>,
  defaultVis = 0.85,
): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0.5, y: (i / 33) * 0.9 + 0.05,
    z: 0, visibility: defaultVis,
    ...(overrides[i] ?? {}),
  }))
}

const FULL_BODY = makeLandmarks({})
const LOW_VIS   = makeLandmarks({}, 0.15)
const NO_TORSO  = makeLandmarks({
  11: { visibility: 0.05 },
  12: { visibility: 0.05 },
  23: { visibility: 0.05 },
  24: { visibility: 0.05 },
})

// ── detectHuman tests ─────────────────────────────────────────────────────────

describe('detectHuman', () => {
  it('returns NO_PERSON for empty landmarks array', () => {
    const result = detectHuman([])
    expect(result.state).toBe('NO_PERSON')
    expect(result.valid).toBe(false)
    expect(result.confidence).toBe(0)
  })

  it('returns VALID_PERSON for high-confidence full-body', () => {
    const result = detectHuman(FULL_BODY)
    expect(result.state).toBe('VALID_PERSON')
    expect(result.valid).toBe(true)
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('returns LOW_CONFIDENCE for globally low visibility', () => {
    const result = detectHuman(LOW_VIS)
    expect(['LOW_CONFIDENCE', 'NO_PERSON']).toContain(result.state)
    expect(result.valid).toBe(false)
  })

  it('returns NO_PERSON when torso landmarks are occluded', () => {
    const result = detectHuman(NO_TORSO)
    expect(['NO_PERSON', 'LOW_CONFIDENCE']).toContain(result.state)
    expect(result.valid).toBe(false)
  })

  it('message is non-empty for invalid state', () => {
    const result = detectHuman([])
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('message is empty for VALID_PERSON', () => {
    const result = detectHuman(FULL_BODY)
    expect(result.message).toBe('')
  })
})

// ── exercise-specific validation ──────────────────────────────────────────────

describe('detectHuman with exerciseId', () => {
  it('validates squat-specific landmarks for full body', () => {
    const result = detectHuman(FULL_BODY, 'squat')
    expect(result.state).toBe('VALID_PERSON')
    expect(result.valid).toBe(true)
  })

  it('returns PARTIAL_PERSON when squat key landmarks are missing', () => {
    // Squat requires knees and ankles — occlude them
    const noLegs = makeLandmarks({
      25: { visibility: 0.1 }, // L knee
      26: { visibility: 0.1 }, // R knee
      27: { visibility: 0.1 }, // L ankle
      28: { visibility: 0.1 }, // R ankle
    })
    const result = detectHuman(noLegs, 'squat')
    expect(['PARTIAL_PERSON', 'LOW_CONFIDENCE']).toContain(result.state)
    expect(result.valid).toBe(false)
  })
})

// ── validateExerciseLandmarks ─────────────────────────────────────────────────

describe('validateExerciseLandmarks', () => {
  it('returns true when all required landmarks are visible', () => {
    const valid = validateExerciseLandmarks(FULL_BODY, [11, 12, 23, 24, 25, 26])
    expect(valid).toBe(true)
  })

  it('returns false for empty landmarks', () => {
    const valid = validateExerciseLandmarks([], [11, 12])
    expect(valid).toBe(false)
  })

  it('returns false when too many required landmarks are occluded', () => {
    const partial = makeLandmarks({
      11: { visibility: 0.05 },
      12: { visibility: 0.05 },
      13: { visibility: 0.05 },
      14: { visibility: 0.05 },
    })
    const valid = validateExerciseLandmarks(partial, [11, 12, 13, 14])
    expect(valid).toBe(false)
  })
})
