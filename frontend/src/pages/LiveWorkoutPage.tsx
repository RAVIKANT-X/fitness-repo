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

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CameraOff, Camera,
  RotateCcw, Volume2, VolumeX,
} from 'lucide-react'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import ReferenceGhostCanvas from '../components/workout/ReferenceGhostCanvas'
import HumanValidationOverlay from '../components/workout/HumanValidationOverlay'
import CameraSwitchButton from '../components/workout/CameraSwitchButton'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useSelectedExercise } from '../hooks/useSelectedExercise'
import { useAnalysis } from '../hooks/useAnalysis'
import { useRepTracker, serialiseTrackDataForGemini } from '../hooks/useRepTracker'
import { useReferenceComparison } from '../hooks/useReferenceComparison'
import { useVoiceCoach } from '../hooks/useVoiceCoach'
import { saveSession } from '../services/sessionService'
import { getReferencePhase, getTrueReference } from '../features/reference'
import {
  validateHumanScene,
  ValidationSmoother,
  getValidationTtsMessage,
} from '../features/camera/humanValidation'
import type { Deviation, MovementPhase, FormStatus } from '../features/analysis/analysisTypes'
import type { JointAngles } from '../features/biomechanics/biomechanicsTypes'

// ── Types ─────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface WorkoutResult {
  exerciseName: string; exerciseId: string
  repCount: number; formStatus: string
  deviations: Deviation[]; startedAt: string; completedAt: string
  /** Average reference match score collected during the session */
  avgMatchScore?: number
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

  // ── Human scene validation (shared gate) ──────────────────────────────────
  const validationSmoother = useMemo(() => new ValidationSmoother(), [])
  const humanScene = useMemo(() => {
    const raw = validateHumanScene(poses, selectedExercise?.id)
    return validationSmoother.update(raw)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poses, selectedExercise?.id])

  const humanValid = humanScene.canProceed

  const { analysisResult, resetAnalysis } = useAnalysis({
    poses: humanValid ? poses : [],
    selectedExercise,
    isActive,
  })
  const voice = useVoiceCoach()

  // ── Per-rep trackpoint collector ──────────────────────────────────────────
  const repTracker = useRepTracker(
    selectedExercise?.id ?? '',
    selectedExercise?.name ?? '',
  )
  // Feed every new analysisResult into the tracker
  useEffect(() => {
    repTracker.onAnalysisResult(analysisResult)
  }, [analysisResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset tracker when exercise changes or camera stops
  useEffect(() => {
    repTracker.reset()
  }, [selectedExercise?.id, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── True Reference comparison ─────────────────────────────────────────────
  const currentPhase = analysisResult?.currentPhase ?? 'UNKNOWN'
  const { liveComparison, matchScore, primaryDeviation, isMatched } = useReferenceComparison({
    poses,
    exerciseId: selectedExercise?.id ?? null,
    currentPhase,
    isActive,
  })

  // Track rolling average match score for the AI summary
  const matchScoreHistoryRef = useRef<number[]>([])
  useEffect(() => {
    if (isActive && matchScore > 0) {
      matchScoreHistoryRef.current.push(matchScore)
      // Keep last 300 samples (~10s at 30fps)
      if (matchScoreHistoryRef.current.length > 300) matchScoreHistoryRef.current.shift()
    }
  }, [matchScore, isActive])

  // Reference ghost: full TrueReference for phase-synchronised ghost
  const trueReference = selectedExercise ? getTrueReference(selectedExercise.id) : undefined
  const refPhase = selectedExercise && currentPhase !== 'UNKNOWN' && currentPhase !== 'INVALID'
    ? getReferencePhase(selectedExercise.id, currentPhase)
    : null
  const userLandmarks = poses[0]?.landmarks ?? []
  const mirrored = facing === 'user'


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

  // ── Voice: human validation status announcements ────────────────────────
  const lastSpokenSceneStatus = useRef<string>('')
  useEffect(() => {
    if (!voice.enabled || !isActive) return
    const tts = getValidationTtsMessage(humanScene.status)
    if (!tts || tts === lastSpokenSceneStatus.current) return
    lastSpokenSceneStatus.current = tts
    voice.speak(tts)
  }, [humanScene.status, voice.enabled, isActive, voice])

  const handleStart  = () => start('user')
  const handleStop   = () => { stop(); stopLoop() }

  // ── End / Finish Workout ───────────────────────────────────────────────────
  const handleFinishWorkout = useCallback(async (requestAiSummary = true) => {
    if (!selectedExercise || !analysisResult) return

    const completedAt = new Date().toISOString()
    const history = matchScoreHistoryRef.current
    const avgMatchScore = history.length > 0
      ? Math.round(history.reduce((a, b) => a + b, 0) / history.length)
      : undefined

    // Build rich trackpoint data from per-rep angle measurements
    const trackData = repTracker.buildTrackData()
    const trackDataText = trackData.totalReps > 0
      ? serialiseTrackDataForGemini(trackData)
      : undefined

    const result: WorkoutResult = {
      exerciseName: selectedExercise.name,
      exerciseId:   selectedExercise.id,
      repCount:     analysisResult.repCount,
      formStatus:   analysisResult.formStatus,
      deviations:   analysisResult.activeDeviations,
      startedAt:    sessionStartRef.current,
      completedAt,
      avgMatchScore,
    }

    const durationSeconds = (new Date(completedAt).getTime() - new Date(sessionStartRef.current).getTime()) / 1000

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
      state: {
        result,
        saveStatus: finalStatus,
        savedRecord: record,
        saveError: errorMsg,
        requestAiSummary,
        durationSeconds,
        trackDataText,
      },
    })
  }, [selectedExercise, analysisResult, navigate])

  // ── Derived display values ─────────────────────────────────────────────────
  const repCount     = analysisResult?.repCount ?? 0
  const formStatus   = analysisResult?.formStatus ?? 'GOOD'
  const deviations   = analysisResult?.activeDeviations ?? []
  const phase        = analysisResult?.currentPhase ?? 'UNKNOWN'
  const landmarksOk  = analysisResult?.landmarksValid ?? false
  const angles       = analysisResult?.angles ?? {}

  const canFinish    = isActive && selectedExercise && saveStatus === 'idle'
  const hasReps      = repCount > 0

  return (
    <div className="camera-page">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="camera-page-header flex items-center justify-between px-4 py-2.5 bg-black/80 backdrop-blur-sm">
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
      <div className="camera-section">

        {/* Camera + skeleton fill all remaining height */}
        <div className="absolute inset-0">
          <CameraView videoRef={videoRef} status={status} error={error} facing={facing}>
            {/* User pose skeleton */}
            <PoseOverlay
              canvasRef={canvasRef}
              videoRef={videoRef}
              facing={facing}
              modelStatus={modelStatus}
              poses={poses}
              startLoop={startLoop}
              stopLoop={stopLoop}
            />
            {/* TRUE REFERENCE ghost skeleton — phase-synchronised, body-adapted */}
            {isActive && humanValid && (refPhase || trueReference) && (
              <ReferenceGhostCanvas
                videoRef={videoRef}
                referenceLandmarks={refPhase?.pose ?? []}
                trueReference={trueReference}
                currentPhase={currentPhase}
                exerciseId={selectedExercise?.id ?? ''}
                userLandmarks={userLandmarks}
                deviations={liveComparison?.jointDeviations ?? []}
                mirrored={mirrored}
                opacity={0.70}
                visible={humanValid}
              />
            )}
          </CameraView>
        </div>

        {/* ── TRUE REFERENCE label — top-left compact badge ────────────── */}
        {isActive && refPhase && (
          <div className="absolute top-3 left-3 pointer-events-none z-10">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold w-fit"
              style={{ background: 'rgba(34,197,94,0.85)', color: 'white', backdropFilter: 'blur(8px)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
              TRUE REFERENCE
            </div>
          </div>
        )}

        {/* ── Camera switch button — top-right floating ────────────────── */}
        {(isActive || status === 'requesting') && (
          <CameraSwitchButton
            onSwitch={switchCamera}
            disabled={status === 'requesting'}
            facing={facing}
          />
        )}

        {/* ── Angle chips — below True Reference label ─────────────────── */}
        {isActive && landmarksOk && selectedExercise && (
          <div className="absolute top-12 left-3 flex flex-wrap gap-1.5 pointer-events-none z-10">
            <AngleChips angles={angles} exerciseId={selectedExercise.id} />
          </div>
        )}

        {/* ── Phase badge + match score — below switch button ──────────── */}
        {isActive && landmarksOk && (
          <div className="absolute top-14 right-3 pointer-events-none flex flex-col items-end gap-1.5 z-10">
            <PhasePill phase={phase} />
            {refPhase && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold"
                style={{
                  background: isMatched ? 'rgba(34,197,94,0.85)' : 'rgba(0,0,0,0.65)',
                  color: 'white',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {isMatched ? '✓ MATCHED' : `${matchScore}%`}
              </div>
            )}
          </div>
        )}

        {/* ── Reference deviation banner (True Reference comparison) ───── */}
        {isActive && primaryDeviation && !isMatched && deviations.length === 0 && (
          <div className="absolute bottom-16 left-3 right-3 pointer-events-none z-10">
            <div
              className="rounded-xl px-3 py-2.5"
              style={{
                background: primaryDeviation.severity === 'ERROR' ? 'rgba(239,68,68,0.85)' : 'rgba(245,158,11,0.88)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold text-white/70 uppercase tracking-wider">
                  AI COACH · {primaryDeviation.affectedJoint}
                </span>
                <span className="ml-auto text-[9px] text-white/60">
                  Ref: {primaryDeviation.referenceAngle.toFixed(0)}° → Yours: {primaryDeviation.userAngle.toFixed(0)}°
                </span>
              </div>
              <p className="text-xs font-semibold text-white leading-snug">{primaryDeviation.correctionText}</p>
            </div>
          </div>
        )}

        {/* ── Analysis deviation banner ─────────────────────────────────── */}
        {isActive && deviations.length > 0 && (
          <div className="absolute bottom-16 left-3 right-3 pointer-events-none z-10">
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

        {/* ── Human scene validation overlay ───────────────────────────── */}
        {isActive && (
          <HumanValidationOverlay
            status={humanScene.status}
            message={humanScene.message}
            contextHint={
              humanScene.status === 'NO_HUMAN'
                ? 'Step into the camera frame.'
                : undefined
            }
            personCount={humanScene.personCount}
            position="bottom"
          />
        )}

        {/* ── Rep counter + form status strip — bottom of camera ────────── */}
        {isActive && selectedExercise && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-16 pb-3 px-4 pointer-events-none z-10">
            <div className="flex items-end justify-between">
              <RepCounter repCount={repCount} phase={phase} />
              <FormPill status={formStatus} />
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls bar ───────────────────────────────────────────── */}
      <div className="camera-controls bg-black px-4 pt-3 space-y-2">

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

        {/* End Session button — always visible when camera is active */}
        {canFinish && (
          <button
            onClick={() => handleFinishWorkout(true)}
            className={[
              'w-full font-bold rounded-2xl py-4 min-h-[56px] transition-colors flex items-center justify-center gap-2',
              hasReps
                ? 'bg-primary text-white active:bg-primary-dark'
                : 'bg-white/10 text-white/70 border border-white/20 active:bg-white/15',
            ].join(' ')}
          >
            <span>🏁</span>
            {hasReps ? 'End Session + AI Summary' : 'End Session'}
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

// ── Rep Counter ───────────────────────────────────────────────────────────────

function RepCounter({ repCount, phase }: { repCount: number; phase: MovementPhase }) {
  const [flash, setFlash] = useState(false)
  const prevCountRef = useRef(repCount)

  useEffect(() => {
    if (repCount > prevCountRef.current) {
      // Rep just completed — trigger flash animation
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      prevCountRef.current = repCount
      return () => clearTimeout(t)
    }
    prevCountRef.current = repCount
  }, [repCount])

  // Progress ring: shows movement phase as a partial arc
  const phaseProgress: Partial<Record<MovementPhase, number>> = {
    STANDING:   0,   EXTENDED:   0,
    DESCENDING: 35,  CURLING:    35,
    BOTTOM:     70,  PEAK:       70,
    ASCENDING:  85,  RETURNING:  85,
    TOP:        0,
  }
  const progress = phaseProgress[phase] ?? 0
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-end gap-3">
      {/* SVG ring behind the number */}
      <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="5"
          />
          {/* Progress arc */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={
              phase === 'BOTTOM' || phase === 'PEAK'
                ? 'rgba(34,197,94,0.90)'
                : phase === 'ASCENDING' || phase === 'RETURNING'
                ? 'rgba(34,197,94,0.60)'
                : 'rgba(255,255,255,0.25)'
            }
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.2s ease, stroke 0.2s ease' }}
          />
        </svg>

        {/* Rep number */}
        <div className="flex flex-col items-center z-10">
          <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none mb-1">
            REPS
          </span>
          <span
            className="text-5xl font-black text-white tabular-nums leading-none drop-shadow-lg"
            style={{
              transform: flash ? 'scale(1.25)' : 'scale(1)',
              color: flash ? '#22c55e' : 'white',
              textShadow: flash ? '0 0 24px rgba(34,197,94,0.8)' : '0 2px 8px rgba(0,0,0,0.6)',
              transition: 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), color 0.15s ease, text-shadow 0.15s ease',
            }}
          >
            {String(repCount).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Flash ring overlay — pulses green on rep complete */}
      {flash && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)',
            animation: 'fadeIn 0.1s ease both',
          }}
        />
      )}
    </div>
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
