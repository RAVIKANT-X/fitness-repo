import { describe, it, expect } from 'vitest'
import { subtract, magnitude, dot, normalize, isZeroVector } from '../features/biomechanics/vectors'

describe('subtract', () => {
  it('returns the correct vector difference', () => {
    const result = subtract({ x: 5, y: 3, z: 1 }, { x: 2, y: 1, z: 0 })
    expect(result).toEqual({ x: 3, y: 2, z: 1 })
  })

  it('handles negative components', () => {
    const result = subtract({ x: 1, y: 1, z: 1 }, { x: 3, y: 4, z: 5 })
    expect(result).toEqual({ x: -2, y: -3, z: -4 })
  })

  it('returns zero vector when subtracting equal vectors', () => {
    const v = { x: 7, y: -2, z: 3 }
    const result = subtract(v, v)
    expect(result).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('magnitude', () => {
  it('returns 0 for a zero vector', () => {
    expect(magnitude({ x: 0, y: 0, z: 0 })).toBe(0)
  })

  it('returns 1 for a unit vector along x', () => {
    expect(magnitude({ x: 1, y: 0, z: 0 })).toBe(1)
  })

  it('returns correct length for a known vector', () => {
    // 3-4-5 right triangle
    expect(magnitude({ x: 3, y: 4, z: 0 })).toBeCloseTo(5, 5)
  })

  it('works in 3D', () => {
    // sqrt(1 + 4 + 4) = sqrt(9) = 3
    expect(magnitude({ x: 1, y: 2, z: 2 })).toBeCloseTo(3, 5)
  })
})

describe('dot', () => {
  it('returns 0 for perpendicular vectors', () => {
    expect(dot({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(0)
  })

  it('returns the product of magnitudes for parallel vectors', () => {
    expect(dot({ x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 })).toBe(6)
  })

  it('returns a negative value for opposing vectors', () => {
    expect(dot({ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 })).toBe(-1)
  })

  it('computes correctly in 3D', () => {
    expect(dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBe(32)
  })
})

describe('normalize', () => {
  it('returns a unit vector', () => {
    const n = normalize({ x: 3, y: 4, z: 0 })
    expect(magnitude(n)).toBeCloseTo(1, 5)
  })

  it('returns direction-preserving result', () => {
    const n = normalize({ x: 0, y: 5, z: 0 })
    expect(n).toEqual({ x: 0, y: 1, z: 0 })
  })

  it('returns zero vector for zero input without throwing', () => {
    const n = normalize({ x: 0, y: 0, z: 0 })
    expect(n).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('isZeroVector', () => {
  it('returns true for the zero vector', () => {
    expect(isZeroVector({ x: 0, y: 0, z: 0 })).toBe(true)
  })

  it('returns true for near-zero vector within epsilon', () => {
    expect(isZeroVector({ x: 1e-11, y: 0, z: 0 })).toBe(true)
  })

  it('returns false for a non-zero vector', () => {
    expect(isZeroVector({ x: 0.001, y: 0, z: 0 })).toBe(false)
  })
})
