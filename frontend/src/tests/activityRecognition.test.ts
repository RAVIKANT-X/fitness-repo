/**
 * Tests for activityRecognition.ts
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { recogniseActivity, resetActivitySmoother } from '../features/scanSpace/activityRecognition'
import type { NormalizedLandmark } from '../features/pose/poseTypes'

function makeLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }))
}

function setLm(lms: NormalizedLandmark[], idx: number, x: number, y: number, vis = 0.85): void {
  lms[idx] = { x, y, z: 0, visibility: vis }
}

beforeEach(() => {
  resetActivitySmoother()
})

describe('recogniseActivity', () => {
  it('returns UNKNOWN for empty landmarks', () => {
    const result = recogniseActivity([])
    expect(result.activity).toBe('UNKNOWN')
    expect(result.confidence).toBe(0)
  })

  it('returns UNKNOWN for low-visibility landmarks', () => {
    const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.05 }))
    const result = recogniseActivity(lms)
    expect(result.activity).toBe('UNKNOWN')
  })

  it('recognises DESK_SITTING when upper body is visible without legs', () => {
    // Flood history with DESK_SITTING frames to overcome smoother
    for (let i = 0; i < 25; i++) {
      const lms = makeLandmarks()
      setLm(lms, 0,  0.50, 0.25)  // NOSE
      setLm(lms, 11, 0.38, 0.42)  // LEFT_SHOULDER
      setLm(lms, 12, 0.62, 0.42)  // RIGHT_SHOULDER
      setLm(lms, 23, 0.40, 0.62)  // LEFT_HIP
      setLm(lms, 24, 0.60, 0.62)  // RIGHT_HIP
      recogniseActivity(lms)
    }
    const lms = makeLandmarks()
    setLm(lms, 0,  0.50, 0.25)
    setLm(lms, 11, 0.38, 0.42)
    setLm(lms, 12, 0.62, 0.42)
    setLm(lms, 23, 0.40, 0.62)
    setLm(lms, 24, 0.60, 0.62)
    const result = recogniseActivity(lms)
    expect(result.activity).toBe('DESK_SITTING')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('recognises STANDING when full body visible with extended legs', () => {
    for (let i = 0; i < 25; i++) {
      const lms = makeLandmarks()
      setLm(lms, 0,  0.50, 0.05)  // NOSE — top of frame
      setLm(lms, 11, 0.40, 0.25)  // LEFT_SHOULDER
      setLm(lms, 12, 0.60, 0.25)  // RIGHT_SHOULDER
      setLm(lms, 23, 0.42, 0.48)  // LEFT_HIP
      setLm(lms, 24, 0.58, 0.48)  // RIGHT_HIP
      setLm(lms, 25, 0.43, 0.68)  // LEFT_KNEE
      setLm(lms, 26, 0.57, 0.68)  // RIGHT_KNEE
      setLm(lms, 27, 0.43, 0.88)  // LEFT_ANKLE
      setLm(lms, 28, 0.57, 0.88)  // RIGHT_ANKLE
      recogniseActivity(lms)
    }
    const lms = makeLandmarks()
    setLm(lms, 0,  0.50, 0.05)
    setLm(lms, 11, 0.40, 0.25)
    setLm(lms, 12, 0.60, 0.25)
    setLm(lms, 23, 0.42, 0.48)
    setLm(lms, 24, 0.58, 0.48)
    setLm(lms, 25, 0.43, 0.68)
    setLm(lms, 26, 0.57, 0.68)
    setLm(lms, 27, 0.43, 0.88)
    setLm(lms, 28, 0.57, 0.88)
    const result = recogniseActivity(lms)
    expect(result.activity).toBe('STANDING')
  })

  it('always returns a label and icon', () => {
    const result = recogniseActivity([])
    expect(typeof result.label).toBe('string')
    expect(result.label.length).toBeGreaterThan(0)
    expect(typeof result.icon).toBe('string')
  })

  it('temporal smoother prevents single-frame switching', () => {
    // Fill history with DESK_SITTING
    for (let i = 0; i < 20; i++) {
      const lms = makeLandmarks()
      setLm(lms, 11, 0.38, 0.42)
      setLm(lms, 12, 0.62, 0.42)
      setLm(lms, 23, 0.40, 0.62)
      setLm(lms, 24, 0.60, 0.62)
      recogniseActivity(lms)
    }
    // One single standing frame should NOT flip the smoothed output
    const singleStanding = makeLandmarks()
    setLm(singleStanding, 0,  0.50, 0.05)
    setLm(singleStanding, 11, 0.40, 0.20)
    setLm(singleStanding, 12, 0.60, 0.20)
    setLm(singleStanding, 23, 0.42, 0.42)
    setLm(singleStanding, 24, 0.58, 0.42)
    setLm(singleStanding, 27, 0.43, 0.88)
    setLm(singleStanding, 28, 0.57, 0.88)
    const result = recogniseActivity(singleStanding)
    // Should still be DESK_SITTING due to majority vote
    expect(result.activity).toBe('DESK_SITTING')
  })
})
