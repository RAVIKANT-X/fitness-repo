/**
 * PoseOverlay — renders a <canvas> on top of the camera feed.
 *
 * Positioning:
 *  This component is rendered as a child of CameraView's video container.
 *  It uses `absolute inset-0` to fill the same space as the <video> element.
 *
 *  The canvas intrinsic size (canvas.width / canvas.height) is kept equal to
 *  the video's intrinsic resolution (videoWidth / videoHeight) by the
 *  usePoseLandmarker hook on every frame. CSS `object-fit: cover` on the
 *  canvas ensures it scales to the container just like the video.
 *
 * Mirror transform:
 *  The <video> is CSS-mirrored for the front camera (scale-x-[-1] in CameraView).
 *  The canvas does NOT use CSS mirror — instead poseRenderer applies the same
 *  horizontal flip in canvas-space. This avoids double-mirroring.
 *
 * No person detected state:
 *  Shown as a small badge — not treated as an error.
 */

import { useEffect } from 'react'
import type { CameraFacing } from '../../features/camera/cameraTypes'
import type { UsePoseLandmarkerReturn } from '../../hooks/usePoseLandmarker'

interface PoseOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  videoRef: React.RefObject<HTMLVideoElement>
  facing: CameraFacing
  modelStatus: UsePoseLandmarkerReturn['modelStatus']
  poses: UsePoseLandmarkerReturn['poses']
  startLoop: UsePoseLandmarkerReturn['startLoop']
  stopLoop: UsePoseLandmarkerReturn['stopLoop']
}

export default function PoseOverlay({
  canvasRef,
  videoRef,
  facing,
  modelStatus,
  poses,
  startLoop,
  stopLoop,
}: PoseOverlayProps) {
  /**
   * Start the inference loop when the model is ready and the video is active.
   * Restart it whenever the facing mode changes (camera switched).
   * Stop it on unmount.
   */
  useEffect(() => {
    if (modelStatus !== 'ready') return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    startLoop(video, canvas, facing)

    return () => {
      stopLoop()
    }
    // Re-run when model becomes ready or camera is switched
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus, facing])

  const noPoseDetected = modelStatus === 'ready' && poses.length === 0

  return (
    <>
      {/* ── Canvas — fills the same space as <video> ─────────────────── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        // Canvas intentionally NOT mirrored via CSS — the renderer handles it
        aria-hidden="true"
      />

      {/* ── Model loading badge ───────────────────────────────────────── */}
      {modelStatus === 'loading' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Loading pose model&hellip;
        </div>
      )}

      {/* ── Model error badge ─────────────────────────────────────────── */}
      {modelStatus === 'error' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-error/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
          Pose model failed to load
        </div>
      )}

      {/* ── No person detected badge ─────────────────────────────────── */}
      {noPoseDetected && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white/80 text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
          No person detected — move into frame
        </div>
      )}
    </>
  )
}
