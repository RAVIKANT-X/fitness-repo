import { describe, it, expect } from 'vitest'
import { calculateAngle, calculateExerciseAngles } from '../features/biomechanics/angles'
import type { Vec3 } from '../features/biomechanics/biomechanicsTypes'
import type { AngleDefinition } from '../features/biomechanics/biomechanicsTypes'
import { PoseLandmark } from '../features/biomechanics/landmarkMapping'
import type { NormalizedLandmark } from '../features/pose/poseTypes'

// ── Helper to create a plain Vec3/NormalizedLandmark point ────────────────────
function pt(x: number, y: number, z = 0): Vec3 {
  return { x, y, z }
}

function lm(x: number, y: number, z = 0): NormalizedLandmark {
  return { x, y, z, visibility: 1 }
}

// ── calculateAngle ─────────────────────────────────────────────────────────────

describe('calculateAngle — 90°', () => {
  it('returns ~90° for a right angle in the XY plane', () => {
    // A is directly above vertex; C is directly to the right
    const result = calculateAngle(pt(0, 1), pt(0, 0), pt(1, 0))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(90, 3)
  })

  it('returns ~90° regardless of arm length', () => {
    // Scale the arms — angle should be invariant to scale
    const result = calculateAngle(pt(0, 10), pt(0, 0), pt(5, 0))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(90, 3)
  })

  it('returns ~90° in 3D', () => {
    // A along Z axis, C along Y axis — right angle at origin
    const result = calculateAngle(pt(0, 0, 1), pt(0, 0, 0), pt(0, 1, 0))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(90, 3)
  })
})

describe('calculateAngle — 180° (straight line)', () => {
  it('returns ~180° for collinear points', () => {
    // A --- vertex --- C on the same line
    const result = calculateAngle(pt(-1, 0), pt(0, 0), pt(1, 0))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(180, 3)
  })

  it('returns ~180° regardless of scale', () => {
    const result = calculateAngle(pt(-100, 0), pt(0, 0), pt(50, 0))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(180, 3)
  })
})

describe('calculateAngle — orientation invariance', () => {
  it('returns the same angle when A and C are swapped', () => {
    // Angle at joint is symmetric: (A, vertex, C) == (C, vertex, A)
    const r1 = calculateAngle(pt(0, 1), pt(0, 0), pt(1, 0))
    const r2 = calculateAngle(pt(1, 0), pt(0, 0), pt(0, 1))
    expect(r1.degrees).toBeCloseTo(r2.degrees, 5)
  })

  it('returns ~45° for a diagonal angle', () => {
    // A is at (1,0), vertex at origin, C at (1,1)
    // Vector BA = (1,0), BC = (1,1) — angle between them is 45°
    const result = calculateAngle(pt(1, 0), pt(0, 0), pt(1, 1))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(45, 3)
  })

  it('returns ~135° for an obtuse angle', () => {
    // BA along +x, BC along second quadrant at 135° from +x
    const result = calculateAngle(pt(1, 0), pt(0, 0), pt(-1, 1))
    expect(result.valid).toBe(true)
    expect(result.degrees).toBeCloseTo(135, 3)
  })
})

describe('calculateAngle — degenerate cases', () => {
  it('returns valid:false when A equals vertex (zero arm)', () => {
    const result = calculateAngle(pt(0, 0), pt(0, 0), pt(1, 0))
    expect(result.valid).toBe(false)
    // Degrees is 0 as a sentinel — must NOT be treated as a real angle
    expect(result.degrees).toBe(0)
  })

  it('returns valid:false when C equals vertex (zero arm)', () => {
    const result = calculateAngle(pt(1, 0), pt(0, 0), pt(0, 0))
    expect(result.valid).toBe(false)
  })

  it('does not produce NaN for floating-point values slightly outside [-1,1]', () => {
    // Simulate a near-parallel pair where rounding could push cosAngle to 1.0000000002
    const tiny = 1e-10
    const result = calculateAngle(pt(1, tiny), pt(0, 0), pt(1, 0))
    expect(result.valid).toBe(true)
    expect(Number.isNaN(result.degrees)).toBe(false)
    expect(result.degrees).toBeCloseTo(0, 1) // near-zero angle, not NaN
  })
})

// ── calculateExerciseAngles ───────────────────────────────────────────────────

describe('calculateExerciseAngles', () => {
  // Build a minimal landmark array: 33 entries, all at origin except the ones we need.
  function makeLandmarks(): NormalizedLandmark[] {
    const arr: NormalizedLandmark[] = Array.from({ length: 33 }, () => lm(0, 0, 0))
    // Place LEFT_HIP at (0,1,0), LEFT_KNEE at origin, LEFT_ANKLE at (1,0,0)
    // → expected knee angle ≈ 90°
    arr[PoseLandmark.LEFT_HIP]   = lm(0, 1, 0)
    arr[PoseLandmark.LEFT_KNEE]  = lm(0, 0, 0)
    arr[PoseLandmark.LEFT_ANKLE] = lm(1, 0, 0)
    return arr
  }

  const kneeAngleDef: AngleDefinition = {
    name: 'leftKneeAngle',
    pointA: PoseLandmark.LEFT_HIP,
    vertex: PoseLandmark.LEFT_KNEE,
    pointC: PoseLandmark.LEFT_ANKLE,
  }

  it('returns a named result for each angle definition', () => {
    const landmarks = makeLandmarks()
    const result = calculateExerciseAngles([kneeAngleDef], landmarks)
    expect(result).toHaveProperty('leftKneeAngle')
  })

  it('calculates ~90° for the right-angle knee setup', () => {
    const landmarks = makeLandmarks()
    const result = calculateExerciseAngles([kneeAngleDef], landmarks)
    expect(result['leftKneeAngle'].valid).toBe(true)
    expect(result['leftKneeAngle'].degrees).toBeCloseTo(90, 3)
  })

  it('returns valid:false when a landmark is missing (zero-vector degenerate)', () => {
    // All landmarks at origin → degenerate
    const blankLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => lm(0, 0, 0))
    const result = calculateExerciseAngles([kneeAngleDef], blankLandmarks)
    expect(result['leftKneeAngle'].valid).toBe(false)
  })
})
