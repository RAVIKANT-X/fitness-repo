/**
 * Tests for spaceAnalysis.ts
 */

import { describe, it, expect } from 'vitest'
import { analyseSpace } from '../features/scanSpace/spaceAnalysis'
import type { NormalizedLandmark } from '../features/pose/poseTypes'

function makeLandmarks(): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }))
}

function setLm(lms: NormalizedLandmark[], idx: number, x: number, y: number, vis = 0.85): void {
  lms[idx] = { x, y, z: 0, visibility: vis }
}

function centeredDesktopLandmarks(): NormalizedLandmark[] {
  const lms = makeLandmarks()
  // Comfortable distance: shoulder width ~0.28 (not too close/far)
  setLm(lms, 11, 0.36, 0.45)   // LEFT_SHOULDER
  setLm(lms, 12, 0.64, 0.45)   // RIGHT_SHOULDER
  setLm(lms, 23, 0.38, 0.65)   // LEFT_HIP
  setLm(lms, 24, 0.62, 0.65)   // RIGHT_HIP
  return lms
}

describe('analyseSpace', () => {
  it('handles empty landmarks gracefully', () => {
    const result = analyseSpace([], 'DESK_SITTING')
    expect(result.userPosition.status).toBe('UNKNOWN')
    expect(result.detectedObjects).toHaveLength(0)
  })

  it('detects desk and chair for DESK_SITTING activity', () => {
    const lms = centeredDesktopLandmarks()
    const result = analyseSpace(lms, 'DESK_SITTING')
    const types = result.detectedObjects.map((o) => o.type)
    expect(types).toContain('desk')
    expect(types).toContain('chair')
  })

  it('does not detect desk for STANDING activity', () => {
    const lms = centeredDesktopLandmarks()
    const result = analyseSpace(lms, 'STANDING')
    const deskObj = result.detectedObjects.find((o) => o.type === 'desk')
    expect(deskObj).toBeUndefined()
  })

  it('returns GOOD position for centered, comfortable-distance user', () => {
    const lms = centeredDesktopLandmarks()
    const result = analyseSpace(lms, 'DESK_SITTING')
    expect(result.userPosition.status).toBe('GOOD')
    expect(result.userPosition.optimized).toBe(true)
    expect(result.userPosition.arrow).toBeNull()
  })

  it('returns TOO_CLOSE when shoulder width is very large in frame', () => {
    const lms = makeLandmarks()
    // Very large shoulder width = very close to camera
    setLm(lms, 11, 0.15, 0.45)   // LEFT_SHOULDER
    setLm(lms, 12, 0.85, 0.45)   // RIGHT_SHOULDER — width = 0.70 (way too close)
    setLm(lms, 23, 0.20, 0.65)
    setLm(lms, 24, 0.80, 0.65)
    const result = analyseSpace(lms, 'DESK_SITTING')
    expect(result.userPosition.status).toBe('TOO_CLOSE')
    expect(result.userPosition.arrow).toBe('↑')
    expect(result.userPosition.coaching).not.toBeNull()
  })

  it('returns TOO_FAR when shoulder width is very small in frame', () => {
    const lms = makeLandmarks()
    // Tiny shoulder width = very far from camera
    setLm(lms, 11, 0.47, 0.45)   // LEFT_SHOULDER
    setLm(lms, 12, 0.53, 0.45)   // RIGHT_SHOULDER — width = 0.06 (too far)
    setLm(lms, 23, 0.47, 0.65)
    setLm(lms, 24, 0.53, 0.65)
    const result = analyseSpace(lms, 'DESK_SITTING')
    expect(result.userPosition.status).toBe('TOO_FAR')
    expect(result.userPosition.arrow).toBe('↓')
  })

  it('returns SHIFTED_RIGHT when body appears on left side of image', () => {
    // In the engine: if bodyCentreX < 0.5 - 0.12 (= 0.38), offset is negative → SHIFTED_RIGHT.
    // This is correct: body appears on left of frame → user is shifted right of centre.
    // The arrow '→' tells the user to move right (toward centre).
    const lms = makeLandmarks()
    setLm(lms, 11, 0.10, 0.45)
    setLm(lms, 12, 0.30, 0.45)   // shoulder width = 0.20, centre ≈ 0.20
    setLm(lms, 23, 0.12, 0.65)
    setLm(lms, 24, 0.28, 0.65)
    const result = analyseSpace(lms, 'DESK_SITTING')
    expect(result.userPosition.status).toBe('SHIFTED_RIGHT')
    expect(result.userPosition.arrow).toBe('→')
    expect(result.userPosition.coaching).not.toBeNull()
  })

  it('returns SHIFTED_LEFT when body appears on right side of image', () => {
    const lms = makeLandmarks()
    setLm(lms, 11, 0.70, 0.45)
    setLm(lms, 12, 0.90, 0.45)   // centre ≈ 0.80
    setLm(lms, 23, 0.70, 0.65)
    setLm(lms, 24, 0.88, 0.65)
    const result = analyseSpace(lms, 'DESK_SITTING')
    expect(result.userPosition.status).toBe('SHIFTED_LEFT')
    expect(result.userPosition.arrow).toBe('←')
  })

  it('workspace size reflects body proportion in frame', () => {
    const closeLms = makeLandmarks()
    setLm(closeLms, 11, 0.10, 0.45)
    setLm(closeLms, 12, 0.70, 0.45)  // very wide = very close

    const farLms = makeLandmarks()
    setLm(farLms, 11, 0.45, 0.45)
    setLm(farLms, 12, 0.55, 0.45)   // narrow = far away

    const closeResult = analyseSpace(closeLms, 'DESK_SITTING')
    const farResult   = analyseSpace(farLms, 'DESK_SITTING')

    // Close = small/very_small workspace, far = larger workspace
    expect(['VERY_SMALL', 'SMALL']).toContain(closeResult.workspaceSize)
    expect(['MEDIUM', 'LARGE']).toContain(farResult.workspaceSize)
  })

  it('always provides a summary string', () => {
    const result = analyseSpace(centeredDesktopLandmarks(), 'DESK_SITTING')
    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(0)
  })
})
