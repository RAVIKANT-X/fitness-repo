/**
 * ReferenceGhostCanvas — renders the True Reference ghost skeleton over
 * a full-screen camera canvas.
 *
 * Improvements:
 *  - Phase-synchronised: ghost follows user's movement phase
 *  - Body-adapted: reference is scaled to user's position/size in frame
 *  - Temporally smoothed: no snapping between poses
 *  - Larger markers visible at ~1 meter
 *  - Labels: "TRUE REFERENCE" shown near ghost head
 *
 * Used in:
 *  - CalibrationPage: ghost over user pose, aligned comparison
 *  - LiveWorkoutPage: ghost overlay with correction arrows
 */

import { useEffect, useRef } from 'react'
import type { NormalizedLandmark } from '../../features/pose/poseTypes'
import type { JointDeviation, TrueReference } from '../../features/reference'
import type { MovementPhase } from '../../features/analysis/analysisTypes'
import { renderReferencGhost } from '../../features/reference'
import { resolveGhostPose } from '../../features/reference/ghostSync'

interface ReferenceGhostCanvasProps {
  /** Video element for sizing the canvas correctly */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Reference pose landmarks (33 points) — raw single-phase landmarks */
  referenceLandmarks: NormalizedLandmark[]
  /** Full TrueReference for phase-synchronised ghost (optional) */
  trueReference?: TrueReference
  /** User's current movement phase (for synchronisation) */
  currentPhase?: MovementPhase
  /** 0–1 progress within current phase (for interpolation) */
  phaseProgress?: number
  /** Exercise identifier (for phase ordering) */
  exerciseId?: string
  /** User's live landmarks for body-relative adaptation + correction arrows */
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
  trueReference,
  currentPhase = 'UNKNOWN',
  phaseProgress = 0.5,
  exerciseId = '',
  userLandmarks = [],
  deviations = [],
  mirrored = true,
  opacity = 1,
  visible = true,
}: ReferenceGhostCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevGhostRef = useRef<NormalizedLandmark[]>([])

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

    // Determine which landmarks to render
    let ghostLandmarks: NormalizedLandmark[]

    if (
      trueReference &&
      exerciseId &&
      currentPhase !== 'UNKNOWN' &&
      currentPhase !== 'INVALID' &&
      userLandmarks.length > 0
    ) {
      // Phase-synchronised, body-adapted ghost
      ghostLandmarks = resolveGhostPose(
        trueReference,
        currentPhase,
        exerciseId,
        userLandmarks,
        prevGhostRef.current,
        phaseProgress,
      )
    } else if (referenceLandmarks.length > 0) {
      // Fallback: use raw reference landmarks
      ghostLandmarks = referenceLandmarks
    } else {
      return
    }

    prevGhostRef.current = ghostLandmarks

    if (ghostLandmarks.length === 0) return

    ctx.globalAlpha = opacity
    renderReferencGhost(ctx, ghostLandmarks, mirrored, deviations, userLandmarks)
    ctx.globalAlpha = 1
  })

  // Reset smoothed ghost when exercise or phase changes
  useEffect(() => {
    prevGhostRef.current = []
  }, [exerciseId, currentPhase])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.3s' }}
    />
  )
}
