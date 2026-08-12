/**
 * ReferenceGhostCanvas — renders the True Reference ghost skeleton over
 * a full-screen camera canvas.
 *
 * Used in:
 *  - CalibrationPage (StepView): ghost over user pose, aligned comparison
 *  - LiveWorkoutPage: ghost overlay with correction arrows
 *
 * The ghost is drawn on a SEPARATE canvas layered above the pose canvas.
 * This prevents interference with the pose renderer and allows independent
 * opacity/visibility control.
 */

import { useEffect, useRef } from 'react'
import type { NormalizedLandmark } from '../../features/pose/poseTypes'
import type { JointDeviation } from '../../features/reference'
import { renderReferencGhost } from '../../features/reference'

interface ReferenceGhostCanvasProps {
  /** Video element for sizing the canvas correctly */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Reference pose landmarks (33 points) */
  referenceLandmarks: NormalizedLandmark[]
  /** User's live landmarks for correction arrows (optional) */
  userLandmarks?: NormalizedLandmark[]
  /** Active joint deviations — determines which joints are highlighted red */
  deviations?: JointDeviation[]
  /** Whether to mirror (front camera) */
  mirrored?: boolean
  /** 0–1 opacity for the ghost skeleton */
  opacity?: number
  /** Whether to show the ghost at all */
  visible?: boolean
}

export default function ReferenceGhostCanvas({
  videoRef,
  referenceLandmarks,
  userLandmarks = [],
  deviations = [],
  mirrored = true,
  opacity = 1,
  visible = true,
}: ReferenceGhostCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video || !visible) {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    // Match canvas size to video intrinsic resolution
    const vw = video.videoWidth  || 640
    const vh = video.videoHeight || 480
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width  = vw
      canvas.height = vh
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (referenceLandmarks.length === 0) return

    ctx.globalAlpha = opacity
    renderReferencGhost(ctx, referenceLandmarks, mirrored, deviations, userLandmarks)
    ctx.globalAlpha = 1
  })  // run every render — same cadence as pose renderer

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}
    />
  )
}
