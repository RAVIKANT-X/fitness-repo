/**
 * angleEvaluator.test.ts
 *
 * Tests for angle extraction from JointAngles maps.
 * Verifies correct null-handling for invalid angles and proper averaging.
 */

import { describe, it, expect } from 'vitest'
import {
  extractSquatAngles,
  extractPushUpAngles,
  extractCurlAngles,
  getAngle,
} from '../features/analysis/angleEvaluator'
import type { JointAngles } from '../features/biomechanics/biomechanicsTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function validAngle(degrees: number) {
  return { name: '', degrees, valid: true }
}

function invalidAngle() {
  return { name: '', degrees: 0, valid: false }
}

// ── getAngle ──────────────────────────────────────────────────────────────────

describe('getAngle', () => {
  it('returns degrees for a valid angle', () => {
    const angles: JointAngles = { testAngle: validAngle(90) }
    expect(getAngle(angles, 'testAngle')).toBe(90)
  })

  it('returns null for an invalid angle', () => {
    const angles: JointAngles = { testAngle: invalidAngle() }
    expect(getAngle(angles, 'testAngle')).toBeNull()
  })

  it('returns null for a missing angle', () => {
    const angles: JointAngles = {}
    expect(getAngle(angles, 'testAngle')).toBeNull()
  })
})

// ── extractSquatAngles ────────────────────────────────────────────────────────

describe('extractSquatAngles — both sides valid', () => {
  const angles: JointAngles = {
    leftKneeAngle: validAngle(90),
    rightKneeAngle: validAngle(100),
    leftHipAngle: validAngle(80),
    rightHipAngle: validAngle(80),
  }

  it('extracts individual knee angles', () => {
    const sa = extractSquatAngles(angles)
    expect(sa.leftKnee).toBe(90)
    expect(sa.rightKnee).toBe(100)
  })

  it('calculates correct average knee angle', () => {
    const sa = extractSquatAngles(angles)
    expect(sa.avgKnee).toBe(95)
  })

  it('calculates correct average hip angle', () => {
    const sa = extractSquatAngles(angles)
    expect(sa.avgHip).toBe(80)
  })
})

describe('extractSquatAngles — one side invalid', () => {
  const angles: JointAngles = {
    leftKneeAngle: validAngle(90),
    rightKneeAngle: invalidAngle(),
    leftHipAngle: invalidAngle(),
    rightHipAngle: validAngle(85),
  }

  it('averages only valid angles', () => {
    const sa = extractSquatAngles(angles)
    expect(sa.avgKnee).toBe(90) // only left is valid
    expect(sa.avgHip).toBe(85)  // only right is valid
  })

  it('returns null for the invalid side', () => {
    const sa = extractSquatAngles(angles)
    expect(sa.rightKnee).toBeNull()
    expect(sa.leftHip).toBeNull()
  })
})

describe('extractSquatAngles — both invalid', () => {
  const angles: JointAngles = {
    leftKneeAngle: invalidAngle(),
    rightKneeAngle: invalidAngle(),
  }

  it('returns null for avgKnee', () => {
    const sa = extractSquatAngles(angles)
    expect(sa.avgKnee).toBeNull()
  })
})

// ── extractPushUpAngles ───────────────────────────────────────────────────────

describe('extractPushUpAngles', () => {
  it('averages valid elbow angles', () => {
    const angles: JointAngles = {
      leftElbowAngle: validAngle(80),
      rightElbowAngle: validAngle(100),
    }
    const pa = extractPushUpAngles(angles)
    expect(pa.avgElbow).toBe(90)
  })

  it('uses single valid elbow if other is invalid', () => {
    const angles: JointAngles = {
      leftElbowAngle: validAngle(70),
      rightElbowAngle: invalidAngle(),
    }
    const pa = extractPushUpAngles(angles)
    expect(pa.avgElbow).toBe(70)
  })

  it('returns null avgElbow when both invalid', () => {
    const angles: JointAngles = {
      leftElbowAngle: invalidAngle(),
      rightElbowAngle: invalidAngle(),
    }
    const pa = extractPushUpAngles(angles)
    expect(pa.avgElbow).toBeNull()
  })
})

// ── extractCurlAngles ─────────────────────────────────────────────────────────

describe('extractCurlAngles', () => {
  it('extracts both elbow angles independently', () => {
    const angles: JointAngles = {
      leftElbowAngle: validAngle(50),
      rightElbowAngle: validAngle(160),
      leftShoulderStability: validAngle(30),
      rightShoulderStability: validAngle(32),
    }
    const ca = extractCurlAngles(angles)
    expect(ca.leftElbow).toBe(50)
    expect(ca.rightElbow).toBe(160)
    expect(ca.leftShoulder).toBe(30)
    expect(ca.rightShoulder).toBe(32)
  })

  it('returns null for invalid angles', () => {
    const angles: JointAngles = {
      leftElbowAngle: invalidAngle(),
      rightElbowAngle: validAngle(160),
    }
    const ca = extractCurlAngles(angles)
    expect(ca.leftElbow).toBeNull()
    expect(ca.rightElbow).toBe(160)
  })
})
