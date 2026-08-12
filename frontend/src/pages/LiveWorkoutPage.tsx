/**
 * LiveWorkoutPage — Phase 2.
 *
 * Composes the camera and pose subsystems:
 *
 *   LiveWorkoutPage
 *     ├── useCamera            (camera stream + state)
 *     ├── usePoseLandmarker    (MediaPipe inference loop + canvas drawing)
 *     ├── CameraView           (<video> + all permission/error states)
 *     │     └── PoseOverlay    (<canvas> skeleton on top of video)
 *     └── Controls             (Start / Stop / Switch camera)
 *
 * Phase 2 scope: camera + pose visualisation only.
 * Exercise selection, rep counting, form analysis → Phase 3+.
 */

import { useRef, useEffect } from 'react'
import { FlipHorizontal, CameraOff, Camera } from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'

export default function LiveWorkoutPage() {
  const { videoRef, status, error, facing, isActive, start, stop, switchCamera } = useCamera()
  const { modelStatus, poses, startLoop, stopLoop } = usePoseLandmarker()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  /**
   * When the user navigates away from this page while the camera is running,
   * stop the camera and inference loop to free the device camera resource.
   */
  useEffect(() => {
    return () => {
      stop()
      stopLoop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStart = () => start('user')
  const handleStop = () => {
    stop()
    stopLoop()
  }

  const personVisible = poses.length > 0 && poses[0].landmarks.length > 0

  return (
    <div className="space-y-4">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Live Workout</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time pose detection
          </p>
        </div>

        {/* Model status badge */}
        <ModelStatusBadge status={modelStatus} />
      </div>

      {/* ── Camera + pose overlay ─────────────────────────────────────────── */}
      <CameraView
        videoRef={videoRef}
        status={status}
        error={error}
        facing={facing}
      >
        {/* PoseOverlay is only rendered when CameraView passes children through
            (i.e. when status === 'active') */}
        <PoseOverlay
          canvasRef={canvasRef}
          videoRef={videoRef}
          facing={facing}
          modelStatus={modelStatus}
          poses={poses}
          startLoop={startLoop}
          stopLoop={stopLoop}
        />
      </CameraView>

      {/* ── Real-time landmark count indicator ───────────────────────────── */}
      {isActive && (
        <Card className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={[
                'w-2 h-2 rounded-full',
                personVisible ? 'bg-success animate-pulse' : 'bg-slate-300',
              ].join(' ')}
            />
            <span className="text-sm text-slate-600">
              {personVisible
                ? `${poses[0].landmarks.length} landmarks detected`
                : 'Waiting for person…'}
            </span>
          </div>
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            {facing === 'user' ? 'Front cam' : 'Rear cam'}
          </span>
        </Card>
      )}

      {/* ── Camera controls ───────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {!isActive ? (
          <Button
            variant="primary"
            fullWidth
            onClick={handleStart}
            disabled={status === 'requesting'}
          >
            <Camera size={18} aria-hidden="true" />
            {status === 'requesting' ? 'Starting…' : 'Enable Camera'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              fullWidth
              onClick={handleStop}
            >
              <CameraOff size={18} aria-hidden="true" />
              Stop Camera
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={switchCamera}
              aria-label="Switch camera"
              title="Switch between front and rear camera"
              className="shrink-0 px-4"
            >
              <FlipHorizontal size={18} aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      {/* ── Phase notice ─────────────────────────────────────────────────── */}
      <Card className="border border-dashed border-slate-200 bg-surface-muted">
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Phase 2 — Camera + Pose. Exercise selection, rep counting, and
          form analysis arrive in Phases 3–4.
        </p>
      </Card>
    </div>
  )
}

// ── Sub-component: model status badge ────────────────────────────────────────

type ModelStatus = 'uninitialized' | 'loading' | 'ready' | 'error'

function ModelStatusBadge({ status }: { status: ModelStatus }) {
  const config: Record<ModelStatus, { label: string; dot: string }> = {
    uninitialized: { label: 'Pose model', dot: 'bg-slate-300' },
    loading: { label: 'Loading model…', dot: 'bg-warning animate-pulse' },
    ready: { label: 'Model ready', dot: 'bg-success' },
    error: { label: 'Model error', dot: 'bg-error' },
  }
  const { label, dot } = config[status]

  return (
    <div className="flex items-center gap-1.5 bg-surface-muted rounded-full px-3 py-1">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}
