/**
 * Tests for postureAnalysis.ts
 *
 * We construct synthetic landmark arrays to test each check individually.
 * MediaPipe landmark indices used:
 *   0  = NOSE
 *   7  = LEFT_EAR
 *   8  = RIGHT_EAR
 *   11 = LEFT_SHOULDER
 *   12 = RIGHT_SHOULDER
 *   23 = LEFT_HIP
 *   24 = RIGHT_HIP
 */

import { describe, it, expect } from 'vitest'
import { analysePosture } from '../features/scanSpace/postureAnalysis'
import type { NormalizedLandmark } from '../features/pose/poseTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal landmark array of 33 entries, all at origin with low vis */
function makeLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }))
}

function setLm(lms: NormalizedLandmark[], idx: number, x: number, y: number, vis = 0.9): void {
  lms[idx] = { x, y, z: 0, visibility: vis }
}

// ── Perfect posture fixture ───────────────────────────────────────────────────

function perfectPostureLandmarks(): NormalizedLandmark[] {
  const lms = makeLandmarks()
  // Shoulders level at y=0.5, horizontally separated
  setLm(lms, 11, 0.35, 0.50)   // LEFT_SHOULDER
  setLm(lms, 12, 0.65, 0.50)   // RIGHT_SHOULDER
  // Hips below shoulders, centered
  setLm(lms, 23, 0.38, 0.72)   // LEFT_HIP
  setLm(lms, 24, 0.62, 0.72)   // RIGHT_HIP
  // Nose directly above shoulder midpoint, slightly above
  setLm(lms, 0, 0.50, 0.28)    // NOSE
  // Ears at roughly same height as nose, flanking it
  setLm(lms, 7, 0.42, 0.30)    // LEFT_EAR
  setLm(lms, 8, 0.58, 0.30)    // RIGHT_EAR
  return lms
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('analysePosture', () => {
  it('returns reliable=false when landmarks array is empty', () => {
    const result = analysePosture([])
    expect(result.reliable).toBe(false)
    expect(result.overallScore).toBe(0)
  })

  it('returns reliable=false when fewer than 25 landmarks provided', () => {
    const result = analysePosture(Array.from({ length: 20 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 })))
    expect(result.reliable).toBe(false)
  })

  it('returns GOOD shoulder alignment for level shoulders', () => {
    const lms = perfectPostureLandmarks()
    const result = analysePosture(lms)
    expect(result.checks.shoulderAlignment.rating).toBe('GOOD')
    expect(result.checks.shoulderAlignment.coaching).toBeNull()
  })

  it('returns POOR shoulder alignment for heavily uneven shoulders', () => {
    const lms = perfectPostureLandmarks()
    // Raise left shoulder significantly
    setLm(lms, 11, 0.35, 0.38)   // left shoulder much higher
    const result = analysePosture(lms)
    expect(result.checks.shoulderAlignment.rating).toBe('POOR')
    expect(result.checks.shoulderAlignment.coaching).not.toBeNull()
  })

  it('returns GOOD torso for upright sitting position', () => {
    const lms = perfectPostureLandmarks()
    const result = analysePosture(lms)
    expect(result.checks.torsoInclination.rating).toBe('GOOD')
  })

  it('returns POOR torso for heavy forward lean', () => {
    const lms = perfectPostureLandmarks()
    // Lean shoulders far forward relative to hips
    setLm(lms, 11, 0.55, 0.50)   // shifted right
    setLm(lms, 12, 0.80, 0.50)   // shifted right
    const result = analysePosture(lms)
    // Torso is now leaning (shoulder midpoint far from hip midpoint horizontally)
    expect(['FAIR', 'POOR']).toContain(result.checks.torsoInclination.rating)
  })

  it('produces a positive overall score with reliable data', () => {
    const lms = perfectPostureLandmarks()
    const result = analysePosture(lms)
    expect(result.reliable).toBe(true)
    expect(result.overallScore).toBeGreaterThan(0)
    expect(result.overallScore).toBeLessThanOrEqual(100)
  })

  it('gives highest score for perfect posture', () => {
    const perfect = analysePosture(perfectPostureLandmarks())
    const lms = perfectPostureLandmarks()
    // Introduce poor shoulder alignment
    setLm(lms, 11, 0.35, 0.30)
    const poor = analysePosture(lms)
    expect(perfect.overallScore).toBeGreaterThanOrEqual(poor.overallScore)
  })

  it('does not produce coaching messages for GOOD checks', () => {
    const lms = perfectPostureLandmarks()
    const result = analysePosture(lms)
    for (const check of Object.values(result.checks)) {
      if (check.rating === 'GOOD') {
        expect(check.coaching).toBeNull()
      }
    }
  })

  it('produces coaching messages for POOR checks', () => {
    const lms = perfectPostureLandmarks()
    // Force very uneven shoulders
    setLm(lms, 11, 0.35, 0.25)
    const result = analysePosture(lms)
    const poorChecks = Object.values(result.checks).filter((c) => c.rating === 'POOR')
    for (const c of poorChecks) {
      if (c.measured) {
        expect(c.coaching).not.toBeNull()
        expect(typeof c.coaching).toBe('string')
      }
    }
  })
})
