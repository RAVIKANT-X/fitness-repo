/**
 * LiveWorkoutPage — camera-first redesign.
 *
 * Layout (mobile):
 *   ┌──────────────────────────┐
 *   │ ← Back   Exercise name   │  minimal top bar
 *   ├──────────────────────────┤
 *   │                          │
 *   │       CAMERA (3:4)       │
 *   │     + SKELETON CANVAS    │
 *   │                          │
 *   ├──────────────────────────┤
 *   │  Feedback strip          │  WorkoutFeedback (compact)
 *   ├──────────────────────────┤
 *   │  [ Finish ]  [ 🔄 cam ]  │  controls
 *   └──────────────────────────┘
 *
 * After Finish Workout:
 *   navigate('/session-summary', { state: { result, saveStatus, savedRecord, saveError } })
 *
 * All hooks, analysis engine, camera, MediaPipe — completely unchanged.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FlipHorizontal, CameraOff, Camera, RotateCcw } from 'lucide-react'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import WorkoutFeedback from '../components/workout/WorkoutFeedback'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useSelectedExercise } from '../hooks/useSelectedExercise'
import { useAnalysis } from '../hooks/useAnalysis'
import { saveSession } from '../services/sessionService'
import type { Deviation } from '../features/analysis/analysisTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface WorkoutResult {
  exerciseName: string
  exerciseId: string
  repCount: number
  formStatus: string
  deviations: Deviation[]
  startedAt: string
  completedAt: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveWorkoutPage() {
  const navigate = useNavigate()
  const { selectedExercise } = useSelectedExercise()
  const { videoRef, status, error, facing, isActive, start, stop, switchCamera } = useCamera()
  const { modelStatus, poses, startLoop, stopLoop } = usePoseLandmarker()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  const { analysisResult, resetAnalysis } = useAnalysis({
    poses,
    selectedExercise,
    isActive,
  })

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const sessionStartRef = useRef<string>(new Date().toISOString())

  // Reset timing when camera becomes active
  useEffect(() => {
    if (isActive) {
      sessionStartRef.current = new Date().toISOString()
      setSaveStatus('idle')
    }
  }, [isActive])

  // Stop camera + inference on unmount
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

  // ── Finish Workout ──────────────────────────────────────────────────────────

  const handleFinishWorkout = useCallback(async () => {
    if (!selectedExercise || !analysisResult) return

    const completedAt = new Date().toISOString()
    const result: WorkoutResult = {
      exerciseName: selectedExercise.name,
      exerciseId: selectedExercise.id,
      repCount: analysisResult.repCount,
      formStatus: analysisResult.formStatus,
      deviations: analysisResult.activeDeviations,
      startedAt: sessionStartRef.current,
      completedAt,
    }

    handleStop()
    setSaveStatus('saving')

    let finalStatus: SaveStatus = 'saving'
    let record: { id: number; created_at: string } | null = null
    let errorMsg: string | null = null

    try {
      record = await saveSession({
        exercise_id: result.exerciseId,
        exercise_name: result.exerciseName,
        reps: result.repCount,
        form_status: result.formStatus,
        deviations: result.deviations,
        started_at: result.startedAt,
        completed_at: result.completedAt,
      })
      finalStatus = 'saved'
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error saving session'
      finalStatus = 'error'
    }

    // Navigate to summary page — pass all data via location state
    navigate('/session-summary', {
      state: {
        result,
        saveStatus: finalStatus,
        savedRecord: record,
        saveError: errorMsg,
      },
    })
  }, [selectedExercise, analysisResult, navigate])

  const personVisible = poses.length > 0 && poses[0].landmarks.length > 0

  return (
    // Full-height, no outer padding — camera owns the screen
    <div className="flex flex-col min-h-[calc(100vh-0px)] -mx-4 -mt-5">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-background">
        <button
          onClick={() => navigate(selectedExercise ? `/exercises/${selectedExercise.id}` : '/exercises')}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 active:opacity-70 min-h-[44px] pr-3"
          aria-label="Back"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {selectedExercise ? selectedExercise.name : 'Exercises'}
        </button>

        <div className="flex items-center gap-2">
          {isActive && selectedExercise && (
            <button
              onClick={resetAnalysis}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 min-h-[44px] px-2"
              title="Reset rep count"
              aria-label="Reset rep count"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          )}
          <ModelStatusBadge status={modelStatus} />
        </div>
      </div>

      {/* ── Camera view (fills available width) ─────────────────────── */}
      <div className="relative flex-shrink-0 px-0">
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
      </div>

      {/* ── Landmark status (active camera only) ─────────────────────── */}
      {isActive && (
        <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-border">
          <div className="flex items-center gap-2">
            <span className={[
              'w-2 h-2 rounded-full',
              personVisible
                ? analysisResult?.landmarksValid === false
                  ? 'bg-warning animate-pulse'
                  : 'bg-success animate-pulse'
                : 'bg-slate-300',
            ].join(' ')} />
            <span className="text-xs text-slate-500">
              {!personVisible
                ? 'Waiting for pose…'
                : analysisResult?.landmarksValid === false
                  ? 'Adjust position'
                  : `${poses[0].landmarks.length} landmarks`}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {facing === 'user' ? 'Front' : 'Rear'} camera
          </span>
        </div>
      )}

      {/* ── Workout feedback ─────────────────────────────────────────── */}
      {isActive && selectedExercise && (
        <div className="px-4 py-3 bg-background">
          <WorkoutFeedback
            result={analysisResult}
            isActive={isActive}
            exerciseId={selectedExercise.id}
          />
        </div>
      )}

      {/* ── No exercise selected notice ──────────────────────────────── */}
      {!selectedExercise && (
        <div className="px-4 py-4 bg-background flex-1 flex flex-col items-center justify-center gap-3">
          <p className="text-sm text-slate-500 text-center">
            No exercise selected.
          </p>
          <button
            onClick={() => navigate('/exercises')}
            className="text-sm text-primary font-semibold underline"
          >
            Choose an exercise
          </button>
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="mt-auto px-4 pb-6 pt-3 bg-background space-y-3">

        {/* Camera toggle row */}
        <div className="flex gap-3">
          {!isActive ? (
            <button
              onClick={handleStart}
              disabled={status === 'requesting'}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-semibold rounded-2xl py-3.5 min-h-[52px] active:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              <Camera size={18} aria-hidden="true" />
              {status === 'requesting' ? 'Starting…' : 'Enable Camera'}
            </button>
          ) : (
            <>
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 font-semibold rounded-2xl py-3.5 min-h-[52px] active:bg-slate-50 transition-colors"
              >
                <CameraOff size={18} aria-hidden="true" />
                Stop Camera
              </button>
              <button
                onClick={switchCamera}
                aria-label="Switch camera"
                className="w-14 flex items-center justify-center border border-slate-200 text-slate-600 rounded-2xl min-h-[52px] active:bg-slate-50 transition-colors shrink-0"
              >
                <FlipHorizontal size={18} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {/* Finish Workout — shown when camera active, exercise selected, and at least 1 rep */}
        {isActive && selectedExercise && (analysisResult?.repCount ?? 0) > 0 && saveStatus === 'idle' && (
          <button
            onClick={handleFinishWorkout}
            className="w-full bg-primary text-white font-bold rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors"
          >
            Finish Workout
          </button>
        )}

        {/* Saving indicator */}
        {saveStatus === 'saving' && (
          <div className="w-full flex items-center justify-center gap-2 py-3">
            <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Saving session…</span>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Model status badge ─────────────────────────────────────────────────────────

type ModelStatus = 'uninitialized' | 'loading' | 'ready' | 'error'

function ModelStatusBadge({ status }: { status: ModelStatus }) {
  const config: Record<ModelStatus, { label: string; dot: string }> = {
    uninitialized: { label: 'Pose model', dot: 'bg-slate-300' },
    loading:       { label: 'Loading…',   dot: 'bg-warning animate-pulse' },
    ready:         { label: 'Ready',      dot: 'bg-success' },
    error:         { label: 'Error',      dot: 'bg-error' },
  }
  const { label, dot } = config[status]

  return (
    <div className="flex items-center gap-1.5 bg-surface-muted rounded-full px-2.5 py-1">
      <span className={['w-1.5 h-1.5 rounded-full', dot].join(' ')} />
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  )
}
