/**
 * usePoseLandmarker — React hook that drives the MediaPipe inference loop.
 *
 * Responsibilities:
 *  - initialises the PoseLandmarker singleton when the hook mounts
 *  - runs a requestAnimationFrame loop that calls detectPoseForVideo()
 *  - draws the result onto a provided canvas ref via poseRenderer
 *  - exposes model status and the latest pose result for future phases
 *  - guarantees exactly ONE active rAF loop at a time
 *  - cancels the loop cleanly on stop, unmount, or camera switch
 *
 * Design decisions:
 *  - The rAF loop is gated behind a boolean ref (`loopActiveRef`) that is
 *    set to false before cancelling. This ensures the callback from a
 *    still-queued frame does not restart the loop after teardown.
 *  - React re-renders do NOT restart the loop because the loop state lives
 *    in refs, not in useState.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { initPoseLandmarker, detectPoseForVideo } from '../features/pose/poseLandmarker'
import { renderPose, clearCanvas } from '../features/pose/poseRenderer'
import type { PoseLandmarkerStatus, PoseResult } from '../features/pose/poseTypes'
import type { CameraFacing } from '../features/camera/cameraTypes'

export interface UsePoseLandmarkerReturn {
  /** Current state of the MediaPipe model. */
  modelStatus: PoseLandmarkerStatus
  /** Latest detected poses (empty array = no person in frame). */
  poses: PoseResult[]
  /** Start the inference loop (called after camera becomes active). */
  startLoop: (video: HTMLVideoElement, canvas: HTMLCanvasElement, facing: CameraFacing) => void
  /** Stop the inference loop (called on camera stop or unmount). */
  stopLoop: () => void
}

export function usePoseLandmarker(): UsePoseLandmarkerReturn {
  const [modelStatus, setModelStatus] = useState<PoseLandmarkerStatus>('uninitialized')
  const [poses, setPoses] = useState<PoseResult[]>([])

  // Refs hold loop state so React re-renders don't affect the loop
  const loopActiveRef = useRef(false)
  const rafIdRef = useRef<number>(0)
  // Store video/canvas/facing for use inside the rAF callback
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const facingRef = useRef<CameraFacing>('user')
  const modelReadyRef = useRef(false)

  // ── Initialise MediaPipe once on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setModelStatus('loading')

    initPoseLandmarker()
      .then(() => {
        if (cancelled) return
        modelReadyRef.current = true
        setModelStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setModelStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ── Core inference callback ─────────────────────────────────────────────
  // Written as a plain function (not useCallback) so it can reference the
  // latest refs without stale closure issues.
  const runFrame = useCallback(() => {
    // Guard: stop immediately if the loop was deactivated
    if (!loopActiveRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (video && canvas && ctx && modelReadyRef.current) {
      // Re-sync canvas intrinsic size to video resolution on every frame.
      // videoWidth/videoHeight only change on camera switch or metadata load,
      // so this is cheap in steady state.
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
      }

      const detectedPoses = detectPoseForVideo(video, performance.now())

      if (detectedPoses.length > 0 && detectedPoses[0].landmarks.length > 0) {
        // Mirror the canvas drawing when using the front-facing camera
        const mirrored = facingRef.current === 'user'
        renderPose(ctx, detectedPoses[0].landmarks, mirrored)
        setPoses(detectedPoses)
      } else {
        clearCanvas(ctx)
        setPoses([])
      }
    }

    // Schedule next frame only if loop is still active
    if (loopActiveRef.current) {
      rafIdRef.current = requestAnimationFrame(runFrame)
    }
  }, [])

  // ── Public: start the loop ──────────────────────────────────────────────
  const startLoop = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement, facing: CameraFacing) => {
      // Prevent duplicate loops: cancel any existing one first
      if (loopActiveRef.current) {
        loopActiveRef.current = false
        cancelAnimationFrame(rafIdRef.current)
      }

      videoRef.current = video
      canvasRef.current = canvas
      facingRef.current = facing

      // Set initial canvas size
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      loopActiveRef.current = true
      rafIdRef.current = requestAnimationFrame(runFrame)
    },
    [runFrame],
  )

  // ── Public: stop the loop ───────────────────────────────────────────────
  const stopLoop = useCallback(() => {
    loopActiveRef.current = false
    cancelAnimationFrame(rafIdRef.current)

    // Clear any drawn skeleton
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) clearCanvas(ctx)

    setPoses([])
  }, [])

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      loopActiveRef.current = false
      cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  return { modelStatus, poses, startLoop, stopLoop }
}
