/**
 * Vector mathematics utilities.
 *
 * All functions operate on Vec3 — a plain { x, y, z } object.
 * No React dependency. No side effects. Fully unit-testable.
 *
 * These primitives are used by angles.ts and may be used by future
 * phase modules (e.g. velocity estimation in Phase 4+).
 */

import type { Vec3 } from './biomechanicsTypes'

/** Returns a new vector: a − b. */
export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

/** Returns the Euclidean magnitude (length) of vector v. */
export function magnitude(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

/** Returns the dot product of vectors a and b. */
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

/**
 * Returns a unit vector (magnitude = 1) in the same direction as v.
 * Returns a zero vector { 0, 0, 0 } if the input has zero magnitude
 * to avoid division by zero — callers must check for the zero case.
 */
export function normalize(v: Vec3): Vec3 {
  const m = magnitude(v)
  if (m === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / m, y: v.y / m, z: v.z / m }
}

/** Returns true when the vector is zero-length (within floating-point epsilon). */
export function isZeroVector(v: Vec3): boolean {
  return magnitude(v) < 1e-10
}
