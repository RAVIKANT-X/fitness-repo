/**
 * LiveWorkoutPage — full-screen camera with overlay feedback + voice coach.
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ ← Back    Exercise   [model] │  top bar (slim)
 *   ├──────────────────────────────┤
 *   │                              │
 *   │      FULL-SCREEN CAMERA      │
 *   │       + POSE SKELETON        │
 *   │                              │
 *   │  [chip] [chip]  ← angles     │  top-left overlay
 *   │                              │
 *   │  ⚠ "Keep knee aligned…"     │  bottom overlay (deviations)
 *   │  REPS: 04  |  GOOD FORM      │  bottom overlay strip
 *   └──────────────────────────────┘
 *   │ [Stop] [Flip] [🔊] [Finish]  │  bottom controls bar
 *   └──────────────────────────────┘
 *
 * Voice coach: speaks each unique deviation message once every 4 s.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FlipHorizontal, CameraOff, Camera,
  RotateCcw, Volume2, VolumeX,
} from 'lucide-react'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useSelectedExercise } from '../hooks/useSelectedExercise'
import { useAnalysis } from '../hooks/useAnalysis'
import { useVoiceCoach } from '../hooks/useVoiceCoach'
import { saveSession } from '../services/sessionService'
import type { Deviation, MovementPhase, FormStatus } from '../features/analysis/analysisTypes'
import type { JointAngles } from '../features/biomechanics/biomechanicsTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface WorkoutResult {
  exerciseName: string; exerciseId: string
  repCount: number; formStatus: string
  deviations: Deviation[]; startedAt: string; completedAt: string
}

// Deviation id → spoken / displayed text
const DEVIATION_TEXT: Record<string, string> = {
  DEPTH_TOO_SHALLOW:    'Squat deeper — aim for thighs parallel to the floor',
  KNEE_ASYMMETRY:       'Keep your knees tracking evenly — one side is bending more',
  HIP_ASYMMETRY:        'Try to keep your hips level throughout the movement',
  ELBOW_ASYMMETRY:      'Keep both elbows bending evenly',
  SHOULDER_ALIGNMENT:   'Keep your shoulders from flaring — elbows closer to your body',
  INCOMPLETE_CURL:      'Curl all the way up — squeeze at the top',
  INCOMPLETE_EXTENSION: 'Fully extend your arm on the way down',
  SHOULDER_MOVEMENT:    'Keep your shoulder still — avoid swinging for momentum',
}
function deviationText(id: string) { return DEVIATION_TEXT[id] ?? id }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LiveWorkoutPage() {
  const navigate = useNavigate()

  const { selectedExercise } = useSelectedExercise()
  const { videoRef, status, error, facing, isActive, start, stop, switchCamera } = useCamera()
  const { modelStatus, poses, startLoop, stopLoop } = usePoseLandmarker()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  const { analysisResult, resetAnalysis } = useAnalysis({ poses, selectedExercise, isActive })
  const voice = useVoiceCoach()

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const sessionStartRef = useRef(new Date().toISOString())

  // Reset session start time when camera activates
  useEffect(() => {
    if (isActive) { sessionStartRef.current = new Date().toISOString(); setSaveStatus('idle') }
  }, [isActive])

  // Stop on unmount
  useEffect(() => () => { stop(); stopLoop() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice coach: speak deviations ──────────────────────────────────────────
  useEffect(() => {
    if (!voice.enabled) return
    const devs = analysisResult?.activeDeviations ?? []
    if (devs.length === 0) return
    // Speak the highest-severity deviation
    const topDev = devs.find((d) => d.severity === 'ERROR') ?? devs[0]
    voice.speak(deviationText(topDev.id))
  }, [analysisResult?.activeDeviations, voice])

  const handleStart  = () => start('user')
  const handleStop   = () => { stop(); stopLoop() }

  // ── Finish Workout ──────────────────────────────────────────────────────────
  const handleFinishWorkout = useCallback(async () => {
    if (!selectedExercise || !analysisResult) return

    const completedAt = new Date().toISOString()
    const result: WorkoutResult = {
      exerciseName: selectedExercise.name,
      exerciseId:   selectedExercise.id,
      repCount:     analysisResult.repCount,
      formStatus:   analysisResult.formStatus,
      deviations:   analysisResult.activeDeviations,
      startedAt:    sessionStartRef.current,
      completedAt,
    }

    handleStop()
    setSaveStatus('saving')

    let finalStatus: SaveStatus = 'saving'
    let record: { id: number; created_at: string } | null = null
    let errorMsg: string | null = null

    try {
      record = await saveSession({
        exercise_id:   result.exerciseId,
        exercise_name: result.exerciseName,
        reps:          result.repCount,
        form_status:   result.formStatus,
        deviations:    result.deviations,
        started_at:    result.startedAt,
        completed_at:  result.completedAt,
      })
      finalStatus = 'saved'
    } catch (err) {
      errorMsg    = err instanceof Error ? err.message : 'Unknown error'
      finalStatus = 'error'
    }

    navigate('/session-summary', {
      state: { result, saveStatus: finalStatus, savedRecord: record, saveError: errorMsg },
    })
  }, [selectedExercise, analysisResult, navigate])

  // ── Derived display values ─────────────────────────────────────────────────
  const repCount     = analysisResult?.repCount ?? 0
  const formStatus   = analysisResult?.formStatus ?? 'GOOD'
  const deviations   = analysisResult?.activeDeviations ?? []
  const phase        = analysisResult?.currentPhase ?? 'UNKNOWN'
  const landmarksOk  = analysisResult?.landmarksValid ?? false
  const angles       = analysisResult?.angles ?? {}
  const personVisible = poses.length > 0 && poses[0].landmarks.length > 0

  const canFinish    = isActive && selectedExercise && repCount > 0 && saveStatus === 'idle'

  return (
    <div className="flex flex-col h-screen -mx-4 -mt-5 bg-black overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/80 backdrop-blur-sm shrink-0 z-10">
        <button
          onClick={() => navigate(selectedExercise ? `/exercises/${selectedExercise.id}` : '/exercises')}
          className="flex items-center gap-1.5 text-sm font-medium text-white/80 active:opacity-70 min-h-[44px] pr-3"
        >
          <ArrowLeft size={18} />
          {selectedExercise?.name ?? 'Exercises'}
        </button>

        <div className="flex items-center gap-2">
          {isActive && selectedExercise && (
            <button
              onClick={resetAnalysis}
              className="text-white/50 hover:text-white/80 min-h-[44px] px-2"
              title="Reset rep count"
            >
              <RotateCcw size={15} />
            </button>
          )}
          <ModelBadge status={modelStatus} />
        </div>
      </div>

      {/* ── FULL-SCREEN CAMERA ────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">

        {/* Camera + skeleton fill all remaining height */}
        <div className="absolute inset-0">
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

        {/* ── Angle chips overlay — top-left ─────────────────────────────── */}
        {isActive && landmarksOk && selectedExercise && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
            <AngleChips angles={angles} exerciseId={selectedExercise.id} />
          </div>
        )}

        {/* ── Phase badge — top-right ───────────────────────────────────── */}
        {isActive && landmarksOk && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <PhasePill phase={phase} />
          </div>
        )}

        {/* ── Deviation banner — centre-bottom on camera ───────────────── */}
        {isActive && deviations.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
            {deviations.slice(0, 2).map((d) => (
              <div
                key={d.id}
                className={[
                  'flex items-start gap-2 rounded-xl px-3 py-2 mb-1.5 backdrop-blur-sm',
                  d.severity === 'ERROR'
                    ? 'bg-red-500/80 text-white'
                    : 'bg-amber-400/85 text-amber-900',
                ].join(' ')}
              >
                <span className="text-sm font-bold shrink-0 mt-0.5">
                  {d.severity === 'ERROR' ? '⚠' : '•'}
                </span>
                <p className="text-sm font-semibold leading-snug">{deviationText(d.id)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── "Adjust position" badge ───────────────────────────────────── */}
        {isActive && !landmarksOk && personVisible && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-amber-400/85 text-amber-900 text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap">
              Adjust position — body not fully visible
            </div>
          </div>
        )}

        {/* ── Waiting badge ─────────────────────────────────────────────── */}
        {isActive && !personVisible && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/60 text-white/70 text-xs px-4 py-2 rounded-full whitespace-nowrap">
              Waiting for pose…
            </div>
          </div>
        )}

        {/* ── Reps + form status strip — bottom of camera ──────────────── */}
        {isActive && selectedExercise && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-3 px-4 pointer-events-none">
            <div className="flex items-end justify-between">
              {/* Rep count */}
              <div>
                <p className="text-[10px] text-white/60 font-semibold uppercase tracking-widest mb-0.5">Reps</p>
                <p className="text-6xl font-black text-white tabular-nums leading-none drop-shadow-lg">
                  {String(repCount).padStart(2, '0')}
                </p>
              </div>
              {/* Form status */}
              <FormPill status={formStatus} />
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls bar ───────────────────────────────────────────── */}
      <div className="shrink-0 bg-black px-4 pb-6 pt-3 space-y-2">

        {/* Camera controls row */}
        <div className="flex gap-2">
          {!isActive ? (
            <button
              onClick={handleStart}
              disabled={status === 'requesting'}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-semibold rounded-2xl py-3.5 min-h-[52px] active:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              <Camera size={18} />
              {status === 'requesting' ? 'Starting…' : 'Enable Camera'}
            </button>
          ) : (
            <>
              {/* Stop */}
              <button
                onClick={handleStop}
                className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white font-semibold rounded-2xl py-3.5 min-h-[52px] active:bg-white/20 transition-colors"
              >
                <CameraOff size={18} />
                Stop
              </button>

              {/* Flip camera */}
              <button
                onClick={switchCamera}
                className="w-14 flex items-center justify-center bg-white/10 text-white rounded-2xl min-h-[52px] active:bg-white/20 transition-colors shrink-0"
                aria-label="Switch camera"
              >
                <FlipHorizontal size={18} />
              </button>

              {/* Voice coach toggle */}
              {voice.supported && (
                <button
                  onClick={voice.toggle}
                  className={[
                    'w-14 flex items-center justify-center rounded-2xl min-h-[52px] active:opacity-70 transition-colors shrink-0',
                    voice.enabled
                      ? 'bg-primary text-white'
                      : 'bg-white/10 text-white/60',
                  ].join(' ')}
                  aria-label={voice.enabled ? 'Mute voice coach' : 'Enable voice coach'}
                  title={voice.enabled ? 'Voice coach on' : 'Voice coach off'}
                >
                  {voice.enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
              )}
            </>
          )}
        </div>

        {/* Finish Workout */}
        {canFinish && (
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
            <span className="text-sm text-white/50">Saving session…</span>
          </div>
        )}

        {/* No exercise selected */}
        {!selectedExercise && (
          <div className="flex flex-col items-center gap-2 py-3">
            <p className="text-sm text-white/50">No exercise selected.</p>
            <button
              onClick={() => navigate('/exercises')}
              className="text-sm text-primary font-semibold underline"
            >
              Choose an exercise
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Overlay sub-components ────────────────────────────────────────────────────

function AngleChips({ angles, exerciseId }: { angles: JointAngles; exerciseId: string }) {
  const entries = getAngleEntries(angles, exerciseId)
  return (
    <>
      {entries.map(({ label, value }) => (
        <div key={label}
          className="flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white/90 text-xs font-semibold px-2 py-1 rounded-lg">
          <span className="text-white/60">{label}</span>
          <span>{value !== null ? `${value.toFixed(0)}°` : '—'}</span>
        </div>
      ))}
    </>
  )
}

function PhasePill({ phase }: { phase: MovementPhase }) {
  const label: Partial<Record<MovementPhase, string>> = {
    STANDING: 'Standing', DESCENDING: 'Down', BOTTOM: 'Bottom',
    ASCENDING: 'Up', TOP: 'Top', EXTENDED: 'Extended',
    CURLING: 'Curling', PEAK: 'Peak', RETURNING: 'Returning',
  }
  if (!label[phase]) return null
  return (
    <span className="bg-black/55 backdrop-blur-sm text-white/80 text-xs font-semibold px-2.5 py-1 rounded-full">
      {label[phase]}
    </span>
  )
}

function FormPill({ status }: { status: FormStatus }) {
  const cfg: Record<FormStatus, { cls: string; label: string }> = {
    GOOD:    { cls: 'bg-emerald-500/80 text-white',     label: '✓ Good Form'   },
    WARNING: { cls: 'bg-amber-400/85 text-amber-900',   label: '⚠ Check Form'  },
    INVALID: { cls: 'bg-white/20 text-white/60',        label: 'Paused'        },
  }
  const { cls, label } = cfg[status]
  return (
    <span className={['text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm', cls].join(' ')}>
      {label}
    </span>
  )
}

function ModelBadge({ status }: { status: 'uninitialized' | 'loading' | 'ready' | 'error' }) {
  const cfg = {
    uninitialized: { dot: 'bg-slate-500',               label: 'Pose model' },
    loading:       { dot: 'bg-amber-400 animate-pulse', label: 'Loading…'   },
    ready:         { dot: 'bg-emerald-400',             label: 'Ready'      },
    error:         { dot: 'bg-red-400',                 label: 'Error'      },
  }
  const { dot, label } = cfg[status]
  return (
    <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
      <span className={['w-1.5 h-1.5 rounded-full', dot].join(' ')} />
      <span className="text-[11px] text-white/60">{label}</span>
    </div>
  )
}

// ── Angle helper ──────────────────────────────────────────────────────────────

function getAngleEntries(angles: JointAngles, exerciseId: string) {
  const g = (n: string) => { const a = angles[n]; return (a?.valid ? a.degrees : null) }
  if (exerciseId === 'squat')  return [{ label: 'L Knee', value: g('leftKneeAngle') }, { label: 'R Knee', value: g('rightKneeAngle') }]
  if (exerciseId === 'pushup') return [{ label: 'L Elbow', value: g('leftElbowAngle') }, { label: 'R Elbow', value: g('rightElbowAngle') }]
  if (exerciseId === 'curl')   return [{ label: 'L Elbow', value: g('leftElbowAngle') }, { label: 'R Elbow', value: g('rightElbowAngle') }]
  return []
}
