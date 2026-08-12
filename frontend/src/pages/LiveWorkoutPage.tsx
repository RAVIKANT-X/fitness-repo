/**
 * LiveWorkoutPage — Phase 3.
 *
 * Extends Phase 2 with exercise context awareness:
 *  - Reads selectedExercise from ExerciseContext
 *  - Displays the active exercise name and its tracked angles
 *  - Passes landmark data to calculateExerciseAngles (Phase 3)
 *  - Displays live angle values in the UI (read-only — no form rules yet)
 *
 * Phase 4 will use these angle values to detect reps and form deviations.
 *
 *   LiveWorkoutPage
 *     ├── useCamera              (camera stream + state)
 *     ├── usePoseLandmarker      (MediaPipe inference loop)
 *     ├── useSelectedExercise    (exercise from ExerciseContext)
 *     ├── calculateExerciseAngles (biomechanics — Phase 3)
 *     ├── CameraView             (<video> + states)
 *     │     └── PoseOverlay      (<canvas> skeleton)
 *     └── Controls + AngleDisplay
 */

import { useRef, useEffect } from 'react'
import { FlipHorizontal, CameraOff, Camera, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useSelectedExercise } from '../hooks/useSelectedExercise'
import { calculateExerciseAngles } from '../features/biomechanics/angles'
import type { JointAngles } from '../features/biomechanics/biomechanicsTypes'

export default function LiveWorkoutPage() {
  const navigate = useNavigate()
  const { selectedExercise } = useSelectedExercise()
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

  // ── Compute live angles whenever a new pose arrives ─────────────────────
  // Uses world landmarks for 3D angle accuracy (Phase 3).
  // No form thresholds are applied here — that is Phase 4's responsibility.
  let liveAngles: JointAngles = {}
  if (
    selectedExercise &&
    poses.length > 0 &&
    poses[0].worldLandmarks.length > 0
  ) {
    liveAngles = calculateExerciseAngles(
      selectedExercise.primaryAngles,
      poses[0].worldLandmarks,
    )
  }

  const personVisible = poses.length > 0 && poses[0].landmarks.length > 0

  return (
    <div className="space-y-4">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          {/* Back to exercise selection if no exercise chosen */}
          {!selectedExercise && (
            <button
              onClick={() => navigate('/exercises')}
              className="flex items-center gap-1 text-xs text-primary mb-1"
            >
              <ArrowLeft size={12} />
              Choose exercise
            </button>
          )}
          <h2 className="text-2xl font-bold text-slate-900">
            {selectedExercise ? selectedExercise.name : 'Live Workout'}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {selectedExercise ? selectedExercise.description : 'Real-time pose detection'}
          </p>
        </div>
        <ModelStatusBadge status={modelStatus} />
      </div>

      {/* ── Camera + pose overlay ─────────────────────────────────────────── */}
      <CameraView videoRef={videoRef} status={status} error={error} facing={facing}>
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

      {/* ── Status row ───────────────────────────────────────────────────── */}
      {isActive && (
        <Card className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={['w-2 h-2 rounded-full', personVisible ? 'bg-success animate-pulse' : 'bg-slate-300'].join(' ')} />
            <span className="text-sm text-slate-600">
              {personVisible ? `${poses[0].landmarks.length} landmarks detected` : 'Waiting for person…'}
            </span>
          </div>
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            {facing === 'user' ? 'Front cam' : 'Rear cam'}
          </span>
        </Card>
      )}

      {/* ── Live angle readout (Phase 3) ─────────────────────────────────── */}
      {isActive && selectedExercise && personVisible && Object.keys(liveAngles).length > 0 && (
        <Card>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Live Joint Angles
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(liveAngles).map((result) => (
              <div key={result.name} className="bg-surface-muted rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 truncate">{result.name}</p>
                <p className={['text-lg font-bold', result.valid ? 'text-slate-900' : 'text-slate-300'].join(' ')}>
                  {result.valid ? `${result.degrees.toFixed(1)}°` : '—'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Phase 3 — display only. Form analysis and rep counting arrive in Phase 4.
          </p>
        </Card>
      )}

      {/* ── Camera controls ───────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {!isActive ? (
          <Button variant="primary" fullWidth onClick={handleStart} disabled={status === 'requesting'}>
            <Camera size={18} aria-hidden="true" />
            {status === 'requesting' ? 'Starting…' : 'Enable Camera'}
          </Button>
        ) : (
          <>
            <Button variant="outline" fullWidth onClick={handleStop}>
              <CameraOff size={18} aria-hidden="true" />
              Stop Camera
            </Button>
            <Button variant="secondary" size="md" onClick={switchCamera}
              aria-label="Switch camera" title="Switch between front and rear camera"
              className="shrink-0 px-4">
              <FlipHorizontal size={18} aria-hidden="true" />
            </Button>
          </>
        )}
      </div>

      {/* ── No exercise selected warning ─────────────────────────────────── */}
      {!selectedExercise && (
        <Card className="border border-dashed border-slate-200 bg-surface-muted">
          <p className="text-xs text-slate-400 text-center leading-relaxed">
            No exercise selected.{' '}
            <button onClick={() => navigate('/exercises')} className="text-primary underline">
              Choose one
            </button>{' '}
            to see live angle measurements.
          </p>
        </Card>
      )}
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
