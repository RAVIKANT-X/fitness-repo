/**
 * CalibrationPage — /calibrate/:id
 *
 * Full Learn & Calibrate flow:
 *
 *   EXPLAIN  → AI briefing: exercise description, step overview, what AI watches
 *   STEP     → Camera on, guided step-by-step with hold progress bar
 *   FAILED   → Freeze feedback, show exact issue, correction, retry button
 *   REPORT   → Personal Movement Profile: per-step scores, main weakness
 *   LIVE     → navigate to /workout with movement profile in location state
 *
 * Reuses CameraView, PoseOverlay, useCamera, usePoseLandmarker unchanged.
 * useCalibration drives the state machine.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ChevronRight,
  Zap,
} from 'lucide-react'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useCalibration } from '../hooks/useCalibration'
import { getExerciseById } from '../features/exercise/exerciseLibrary'
import type { CameraError } from '../features/camera/cameraTypes'
import type { MovementProfile, StepResult } from '../features/calibration/calibrationTypes'
import type { FrameEvaluation } from '../features/calibration/calibrationEngine'

// ── colour helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600'
  if (score >= 70) return 'text-amber-500'
  return 'text-red-500'
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500'
  if (score >= 70) return 'bg-amber-400'
  return 'bg-red-400'
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function CalibrationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const exercise = id ? getExerciseById(id) : undefined

  const { videoRef, status, error, facing, isActive, start, stop, switchCamera } = useCamera()
  const { modelStatus, poses, startLoop, stopLoop } = usePoseLandmarker()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  const {
    stage,
    currentStepIndex,
    steps,
    stepResults,
    liveEval,
    consecutivePassFrames,
    holdFramesRequired,
    movementProfile,
    handleStartCalibration,
    handleRetryStep,
    handleStartLive,
  } = useCalibration({ poses, exercise: exercise ?? null })

  // Redirect if unknown exercise
  useEffect(() => {
    if (id && !exercise) navigate('/exercises', { replace: true })
  }, [id, exercise, navigate])

  // Start camera when we enter STEP stage
  useEffect(() => {
    if (stage === 'STEP' && !isActive) {
      start('user')
    }
  }, [stage, isActive, start])

  // Stop camera when leaving to REPORT or back
  useEffect(() => {
    if (stage === 'REPORT' || stage === 'LIVE') {
      stop()
      stopLoop()
    }
  }, [stage, stop, stopLoop])

  // Clean up on unmount
  useEffect(() => {
    return () => { stop(); stopLoop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoLive = useCallback(() => {
    handleStartLive()
    navigate('/workout', { state: { movementProfile } })
  }, [handleStartLive, navigate, movementProfile])

  if (!exercise) return null

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[calc(100vh-0px)] -mx-4 -mt-5">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <button
          onClick={() => navigate(`/exercises/${exercise.id}`)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 active:opacity-70 min-h-[44px] pr-3"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
          {exercise.name}
        </button>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Cpu size={13} className="text-primary" />
          {stage === 'EXPLAIN' && 'Calibration'}
          {(stage === 'STEP' || stage === 'STEP_FAILED') && (
            <span>{currentStepIndex + 1} / {steps.length}</span>
          )}
          {stage === 'REPORT' && 'Movement Profile'}
        </div>
      </div>

      {/* ── EXPLAIN stage ────────────────────────────────────────────────── */}
      {stage === 'EXPLAIN' && (
        <ExplainView
          exercise={exercise}
          steps={steps}
          onStart={handleStartCalibration}
        />
      )}

      {/* ── STEP / STEP_FAILED stage ─────────────────────────────────────── */}
      {(stage === 'STEP' || stage === 'STEP_FAILED') && (
        <StepView
          stage={stage}
          exercise={exercise}
          currentStepIndex={currentStepIndex}
          steps={steps}
          liveEval={liveEval}
          consecutivePassFrames={consecutivePassFrames}
          holdFramesRequired={holdFramesRequired}
          isActive={isActive}
          status={status}
          error={error}
          facing={facing}
          videoRef={videoRef}
          canvasRef={canvasRef}
          modelStatus={modelStatus}
          poses={poses}
          startLoop={startLoop}
          stopLoop={stopLoop}
          onRetry={handleRetryStep}
          onSwitchCamera={switchCamera}
          stepResults={stepResults}
        />
      )}

      {/* ── REPORT stage ─────────────────────────────────────────────────── */}
      {stage === 'REPORT' && movementProfile && (
        <ReportView
          profile={movementProfile}
          onStartLive={handleGoLive}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLAIN view
// ─────────────────────────────────────────────────────────────────────────────

function ExplainView({
  exercise,
  steps,
  onStart,
}: {
  exercise: ReturnType<typeof getExerciseById> & object
  steps: { title: string; instruction: string }[]
  onStart: () => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

      {/* Hero */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={18} className="text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">AI Calibration</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">{exercise.name}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Before your workout, I'll guide you through <strong>{steps.length} key positions</strong> to
          learn your range of motion and build a personalised movement profile.
        </p>
      </div>

      {/* Steps overview */}
      <div className="bg-surface rounded-2xl shadow-card p-5">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
          What we'll do
        </h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.instruction}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* AI monitors */}
      {exercise.aiMonitors && exercise.aiMonitors.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            AI will monitor
          </h2>
          <ul className="space-y-1.5">
            {exercise.aiMonitors.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Tips</p>
        <ul className="space-y-1 text-sm text-amber-800">
          <li>• Stand 1.5–2m from the camera so your full body is visible.</li>
          <li>• Use good lighting so the AI can track your joints clearly.</li>
          <li>• Hold each position still for a moment — the AI needs ~0.5 s of data.</li>
        </ul>
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        className="w-full bg-primary text-white font-bold text-base rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors mt-2"
      >
        Start Calibration
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP view
// ─────────────────────────────────────────────────────────────────────────────

function StepView({
  stage,
  currentStepIndex,
  steps,
  liveEval,
  consecutivePassFrames,
  holdFramesRequired,
  isActive,
  status,
  error,
  facing,
  videoRef,
  canvasRef,
  modelStatus,
  poses,
  startLoop,
  stopLoop,
  onRetry,
  onSwitchCamera,
  stepResults,
}: {
  stage: string
  exercise: ReturnType<typeof getExerciseById> & object
  currentStepIndex: number
  steps: { title: string; instruction: string; correction: string }[]
  liveEval: FrameEvaluation | null
  consecutivePassFrames: number
  holdFramesRequired: number
  isActive: boolean
  status: string
  error: CameraError | null
  facing: string
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  modelStatus: string
  poses: unknown[]
  startLoop: Parameters<typeof PoseOverlay>[0]['startLoop']
  stopLoop: Parameters<typeof PoseOverlay>[0]['stopLoop']
  onRetry: () => void
  onSwitchCamera: () => void
  stepResults: StepResult[]
}) {
  const currentStep = steps[currentStepIndex]
  if (!currentStep) return null

  const isFailed = stage === 'STEP_FAILED'
  const failedResult = isFailed ? stepResults[currentStepIndex] : null
  const holdPct = Math.min(100, Math.round((consecutivePassFrames / holdFramesRequired) * 100))
  const isLandmarksValid = liveEval?.landmarksValid ?? false
  const passing = liveEval?.passing ?? false

  return (
    <div className="flex flex-col flex-1">

      {/* Step progress pills */}
      <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={[
              'h-1.5 flex-1 rounded-full transition-all',
              i < currentStepIndex ? 'bg-primary' :
              i === currentStepIndex ? 'bg-primary/50' : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Step title */}
      <div className="px-4 pb-2">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
        <h2 className="text-lg font-bold text-slate-900 mt-0.5">{currentStep.title}</h2>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{currentStep.instruction}</p>
      </div>

      {/* Camera */}
      <div className="relative px-0">
        <CameraView
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          status={status as Parameters<typeof CameraView>[0]['status']}
          error={error}
          facing={facing as Parameters<typeof CameraView>[0]['facing']}
        >
          <PoseOverlay
            canvasRef={canvasRef}
            videoRef={videoRef as React.RefObject<HTMLVideoElement>}
            facing={facing as Parameters<typeof PoseOverlay>[0]['facing']}
            modelStatus={modelStatus as Parameters<typeof PoseOverlay>[0]['modelStatus']}
            poses={poses as Parameters<typeof PoseOverlay>[0]['poses']}
            startLoop={startLoop}
            stopLoop={stopLoop}
          />

          {/* Hold progress overlay */}
          {isActive && !isFailed && isLandmarksValid && (
            <div className="absolute bottom-3 left-3 right-3">
              <div className="bg-black/60 rounded-xl px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/80 font-medium">
                    {passing ? '✓ Hold position…' : 'Adjust your position'}
                  </span>
                  <span className="text-xs text-white/60">{holdPct}%</span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={[
                      'h-full rounded-full transition-all duration-150',
                      passing ? 'bg-emerald-400' : 'bg-slate-400',
                    ].join(' ')}
                    style={{ width: `${holdPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* No landmarks badge */}
          {isActive && !isFailed && !isLandmarksValid && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white/80 text-xs px-3 py-1.5 rounded-full pointer-events-none whitespace-nowrap">
              Step into frame — full body needed
            </div>
          )}
        </CameraView>
      </div>

      {/* Live per-angle feedback (compact, during STEP) */}
      {isActive && !isFailed && liveEval && liveEval.landmarksValid && liveEval.targetEvals.length > 0 && (
        <div className="px-4 pt-3 grid grid-cols-2 gap-2">
          {liveEval.targetEvals.map((te, i) => (
            <div
              key={i}
              className={[
                'rounded-xl border px-3 py-2 flex items-center gap-2',
                te.withinTolerance ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200',
              ].join(' ')}
            >
              {te.withinTolerance
                ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                : <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />}
              <div className="min-w-0">
                <p className="text-[11px] text-slate-500 truncate">{te.target.label}</p>
                <p className={['text-sm font-bold', te.withinTolerance ? 'text-emerald-600' : 'text-slate-700'].join(' ')}>
                  {te.valid ? `${te.observed}°` : '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP_FAILED: Correction card ──────────────────────────────────── */}
      {isFailed && (
        <div className="px-4 pt-3 space-y-3">

          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <span className="text-sm font-bold text-red-700">Needs correction</span>
            </div>
            <p className="text-sm text-red-800 leading-relaxed">{currentStep.correction}</p>
          </div>

          {/* Issues detail */}
          {failedResult && failedResult.issues.length > 0 && (
            <div className="bg-surface rounded-2xl shadow-card p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">What we detected</p>
              <div className="space-y-2">
                {failedResult.issues.map((issue, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{issue.label}</span>
                    <div className="text-right">
                      <span className="font-bold text-red-500">{issue.observed}°</span>
                      <span className="text-slate-400 ml-1.5">target {issue.ideal}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold rounded-2xl py-4 min-h-[52px] active:bg-primary-dark transition-colors"
          >
            <RotateCcw size={16} />
            Try Step Again
          </button>
        </div>
      )}

      {/* Switch camera button */}
      {isActive && (
        <div className="px-4 pt-3 pb-4 mt-auto">
          <button
            onClick={onSwitchCamera}
            className="w-full border border-slate-200 text-slate-500 text-sm rounded-2xl py-3 active:bg-slate-50 transition-colors"
          >
            Switch Camera
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT view
// ─────────────────────────────────────────────────────────────────────────────

function ReportView({
  profile,
  onStartLive,
}: {
  profile: MovementProfile
  onStartLive: () => void
}) {
  const weakest = profile.stepResults[profile.weakestStepIndex]

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

      {/* Overall score header */}
      <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">Movement Profile</span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">Pre-Workout AI Report</h1>
        <p className="text-sm text-slate-500 mt-1">{profile.exerciseName} · Calibration complete</p>

        <div className="mt-4 flex items-end gap-3">
          <span className={['text-5xl font-black', scoreColor(profile.overallScore)].join(' ')}>
            {profile.overallScore}
          </span>
          <span className="text-slate-400 mb-1 text-sm">/ 100 overall</span>
        </div>

        {/* Overall bar */}
        <div className="mt-3 h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={['h-full rounded-full transition-all', scoreBarColor(profile.overallScore)].join(' ')}
            style={{ width: `${profile.overallScore}%` }}
          />
        </div>
      </div>

      {/* Per-step breakdown */}
      <div className="bg-surface rounded-2xl shadow-card p-5">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">Step Breakdown</h2>
        <div className="space-y-3">
          {profile.stepResults.map((result, i) => (
            <div
              key={i}
              className={[
                'rounded-xl border p-3 flex items-center gap-3',
                i === profile.weakestStepIndex
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-100 bg-white',
              ].join(' ')}
            >
              {/* Step number */}
              <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                {result.step.number}
              </span>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-800 truncate">{result.step.title}</p>
                  {i === profile.weakestStepIndex && (
                    <span className="text-[10px] bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 font-bold shrink-0">
                      FOCUS
                    </span>
                  )}
                </div>
                {/* Mini bar */}
                <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={['h-full rounded-full', scoreBarColor(result.score)].join(' ')}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
              </div>

              {/* Score */}
              <span className={['text-lg font-black shrink-0', scoreColor(result.score)].join(' ')}>
                {result.score}%
              </span>

              {/* Check / warning icon */}
              {result.score >= 85
                ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                : <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Main weakness card */}
      {weakest && weakest.score < 90 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Main Focus Area</p>
              <p className="text-xs text-amber-700 mt-0.5">Step {weakest.step.number}: {weakest.step.title}</p>
            </div>
          </div>

          {weakest.issues.length > 0 && (
            <div className="space-y-2 mb-3">
              {weakest.issues.map((issue, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-amber-800">{issue.label}</span>
                  <span className="font-bold text-amber-900">
                    {issue.observed}° <span className="font-normal text-amber-600">vs {issue.ideal}° ideal</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="bg-amber-100 rounded-xl p-3">
            <p className="text-sm font-semibold text-amber-900 mb-1">Correction</p>
            <p className="text-sm text-amber-800 leading-relaxed">{weakest.step.correction}</p>
          </div>
        </div>
      )}

      {/* Great score message */}
      {profile.overallScore >= 90 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800 leading-relaxed">
            <strong>Excellent form!</strong> Your movement profile looks great. The AI will monitor
            these positions during your live workout for real-time feedback.
          </p>
        </div>
      )}

      {/* Start live button */}
      <button
        onClick={onStartLive}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-base rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors"
      >
        <ChevronRight size={18} />
        Start Live Workout
      </button>

      <p className="text-xs text-slate-400 text-center pb-4 leading-relaxed px-4">
        The AI coach will monitor all calibrated positions in real time and alert you
        when your form deviates from this profile.
      </p>
    </div>
  )
}
