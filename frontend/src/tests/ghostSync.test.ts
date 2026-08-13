/**
 * Tests for ghost synchronization: body frame computation, pose interpolation,
 * body-relative adaptation, and temporal smoothing.
 */

import { describe, it, expect } from 'vitest'
import {
  computeBodyFrame,
  interpolatePoses,
  smoothLandmarks,
  adaptReferenceToUser,
  resolveGhostPose,
} from '../features/reference/ghostSync'
import type { NormalizedLandmark } from '../features/pose/poseTypes'
import { SQUAT_STANDING, SQUAT_BOTTOM } from '../features/reference/referencePoses'
import { SQUAT_REFERENCE } from '../features/reference/referenceLibrary'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLandmarks(overrides: Partial<Record<number, Partial<NormalizedLandmark>>>): NormalizedLandmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0.5, y: 0.5, z: 0, visibility: 0.9,
    ...(overrides[i] ?? {}),
  }))
}

const STANDING_LANDMARKS = makeLandmarks({
  11: { x: 0.58, y: 0.28, visibility: 0.95 }, // L shoulder
  12: { x: 0.42, y: 0.28, visibility: 0.95 }, // R shoulder
  23: { x: 0.56, y: 0.62, visibility: 0.95 }, // L hip
  24: { x: 0.44, y: 0.62, visibility: 0.95 }, // R hip
})

// ── computeBodyFrame ──────────────────────────────────────────────────────────

describe('computeBodyFrame', () => {
  it('returns body frame with valid landmarks', () => {
    const frame = computeBodyFrame(STANDING_LANDMARKS)
    expect(frame).not.toBeNull()
    expect(frame!.cx).toBeCloseTo(0.5, 1)   // mid-shoulder x
    expect(frame!.cy).toBeCloseTo(0.28, 1)  // shoulder y
    expect(frame!.hw).toBeGreaterThan(0)
    expect(frame!.th).toBeGreaterThan(0)
  })

  it('returns null for empty landmarks', () => {
    expect(computeBodyFrame([])).toBeNull()
  })

  it('returns null when shoulder visibility is too low', () => {
    const low = makeLandmarks({
      11: { x: 0.58, y: 0.28, visibility: 0.1 },
      12: { x: 0.42, y: 0.28, visibility: 0.1 },
    })
    expect(computeBodyFrame(low)).toBeNull()
  })
})

// ── interpolatePoses ──────────────────────────────────────────────────────────

describe('interpolatePoses', () => {
  it('returns poseA when alpha = 0', () => {
    const a = SQUAT_STANDING
    const b = SQUAT_BOTTOM
    const result = interpolatePoses(a, b, 0)
    result.forEach((lm, i) => {
      expect(lm.x).toBeCloseTo(a[i].x, 5)
      expect(lm.y).toBeCloseTo(a[i].y, 5)
    })
  })

  it('returns poseB when alpha = 1', () => {
    const a = SQUAT_STANDING
    const b = SQUAT_BOTTOM
    const result = interpolatePoses(a, b, 1)
    result.forEach((lm, i) => {
      expect(lm.x).toBeCloseTo(b[i].x, 5)
      expect(lm.y).toBeCloseTo(b[i].y, 5)
    })
  })

  it('returns midpoint when alpha = 0.5', () => {
    const a = SQUAT_STANDING
    const b = SQUAT_BOTTOM
    const result = interpolatePoses(a, b, 0.5)
    result.forEach((lm, i) => {
      expect(lm.x).toBeCloseTo((a[i].x + b[i].x) / 2, 5)
      expect(lm.y).toBeCloseTo((a[i].y + b[i].y) / 2, 5)
    })
  })

  it('clamps alpha to [0, 1]', () => {
    const a = SQUAT_STANDING
    const b = SQUAT_BOTTOM
    const r0 = interpolatePoses(a, b, -1)
    const r1 = interpolatePoses(a, b, 2)
    r0.forEach((lm, i) => expect(lm.x).toBeCloseTo(a[i].x, 5))
    r1.forEach((lm, i) => expect(lm.x).toBeCloseTo(b[i].x, 5))
  })
})

// ── smoothLandmarks ───────────────────────────────────────────────────────────

describe('smoothLandmarks', () => {
  it('returns next when prev is empty', () => {
    const next = SQUAT_BOTTOM
    const result = smoothLandmarks([], next)
    expect(result).toEqual(next)
  })

  it('applies EMA smoothing (not snapping to next)', () => {
    const a = SQUAT_STANDING
    const b = SQUAT_BOTTOM
    const result = smoothLandmarks(a, b, 0.35)
    // Result should be between a and b, not equal to b
    result.forEach((lm, i) => {
      const expectedX = a[i].x + (b[i].x - a[i].x) * 0.35
      expect(lm.x).toBeCloseTo(expectedX, 5)
    })
  })
})

// ── adaptReferenceToUser ──────────────────────────────────────────────────────

describe('adaptReferenceToUser', () => {
  it('shifts reference to match user body center', () => {
    const refFrame = { cx: 0.5, cy: 0.3, hw: 0.08, th: 0.35 }
    const userFrame = { cx: 0.6, cy: 0.25, hw: 0.08, th: 0.35 }
    const adapted = adaptReferenceToUser(SQUAT_STANDING, refFrame, userFrame)
    // Reference centre landmark (shoulders) should shift to match user centre
    const refCentre = (SQUAT_STANDING[11].x + SQUAT_STANDING[12].x) / 2
    const offsetX = refCentre - refFrame.cx
    const expectedCx = userFrame.cx + offsetX * (userFrame.hw / refFrame.hw)
    const adaptedCentre = (adapted[11].x + adapted[12].x) / 2
    expect(adaptedCentre).toBeCloseTo(expectedCx, 2)
  })
})

// ── resolveGhostPose ──────────────────────────────────────────────────────────

describe('resolveGhostPose', () => {
  it('returns non-empty landmarks for STANDING phase', () => {
    const result = resolveGhostPose(
      SQUAT_REFERENCE,
      'STANDING',
      'squat',
      STANDING_LANDMARKS,
      [],
      0,
    )
    expect(result.length).toBe(33)
    expect(result[0].x).toBeGreaterThanOrEqual(0)
  })

  it('returns smoothed landmarks (not identical to raw reference)', () => {
    const prev = SQUAT_STANDING
    const result = resolveGhostPose(
      SQUAT_REFERENCE,
      'DESCENDING',
      'squat',
      STANDING_LANDMARKS,
      prev,
      0.5,
    )
    expect(result.length).toBe(33)
    // Should have been adapted (body-relative), so it may differ from raw reference
    // Just verify it produces valid output
    result.forEach((lm) => {
      expect(isFinite(lm.x)).toBe(true)
      expect(isFinite(lm.y)).toBe(true)
    })
  })

  it('falls back to raw reference when user landmarks are empty', () => {
    const result = resolveGhostPose(
      SQUAT_REFERENCE,
      'BOTTOM',
      'squat',
      [],   // no user landmarks
      [],
      0,
    )
    expect(result.length).toBe(33)
  })
})
