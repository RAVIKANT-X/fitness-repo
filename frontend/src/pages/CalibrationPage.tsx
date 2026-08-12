/**
 * CalibrationPage — /calibrate/:id
 *
 * Enhanced with True Reference:
 *  - EXPLAIN: shows reference ghost skeleton previews for each step
 *  - STEP: renders reference ghost over user pose + live comparison
 *  - STEP_FAILED: shows True Reference vs Your Movement comparison
 *  - REPORT: full True Reference vs Your Movement analysis report
 *
 * All existing functionality is preserved.
 */

import { useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Cpu, CheckCircle2, AlertTriangle,
  RotateCcw, ChevronRight, Zap, SkipForward,
} from 'lucide-react'
import CameraView from '../components/workout/CameraView'
import PoseOverlay from '../components/workout/PoseOverlay'
import ReferenceGhostCanvas from '../components/workout/ReferenceGhostCanvas'
import { useCamera } from '../hooks/useCamera'
import { usePoseLandmarker } from '../hooks/usePoseLandmarker'
import { useCalibration } from '../hooks/useCalibration'
import { useReferenceComparison } from '../hooks/useReferenceComparison'
import { getExerciseById } from '../features/exercise/exerciseLibrary'
import { getTrueReference, getReferencePhase } from '../features/reference'
import type { CameraError } from '../features/camera/cameraTypes'
import type { MovementProfile, StepResult } from '../features/calibration/calibrationTypes'
import type { FrameEvaluation } from '../features/calibration/calibrationEngine'
import type { UsePoseLandmarkerReturn } from '../hooks/usePoseLandmarker'
import type { ReferencePhase } from '../features/reference'

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(s: number) { return s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-amber-500' : 'text-red-500' }
function scoreBar(s: number)   { return s >= 85 ? 'bg-emerald-500'   : s >= 70 ? 'bg-amber-400'   : 'bg-red-400'   }

// ── Phase → step index map (calibration steps align with reference phases) ──
const STEP_PHASE_MAP: Record<string, string[]> = {
  squat:  ['STANDING', 'DESCENDING', 'BOTTOM', 'ASCENDING'],
  pushup: ['TOP', 'DESCENDING', 'BOTTOM', 'ASCENDING'],
  curl:   ['EXTENDED', 'CURLING', 'PEAK'],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalibrationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const exercise = id ? getExerciseById(id) : undefined

  const { videoRef, status, error, facing, isActive, start, stop, switchCamera } = useCamera()
  const { modelStatus, poses, startLoop, stopLoop } = usePoseLandmarker()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  const {
    stage, currentStepIndex, steps, stepResults,
    liveEval, consecutivePassFrames, holdFramesRequired, movementProfile,
    handleStartCalibration, handleAnalyzeStep, handleSkipStep,
    handleRetryStep, handleStartLive,
  } = useCalibration({ poses, exercise: exercise ?? null })

  // ── Reference comparison (runs during STEP stage) ─────────────────────────
  const phaseForStep = STEP_PHASE_MAP[id ?? '']?.[currentStepIndex] as string | undefined
  const refPhaseForStep = phaseForStep && id ? getReferencePhase(id, phaseForStep) : null

  // Use reference comparison with the expected phase for the current step
  const { liveComparison, matchScore, primaryDeviation, isMatched } = useReferenceComparison({
    poses,
    exerciseId: id ?? null,
    currentPhase: (phaseForStep ?? 'UNKNOWN') as import('../features/analysis/analysisTypes').MovementPhase,
    isActive: isActive && stage === 'STEP',
  })

  // Redirect on unknown exercise
  useEffect(() => {
    if (id && !exercise) navigate('/exercises', { replace: true })
  }, [id, exercise, navigate])

  // Camera: on when STEP / STEP_FAILED, off otherwise
  useEffect(() => {
    if ((stage === 'STEP' || stage === 'STEP_FAILED') && !isActive) start('user')
  }, [stage, isActive, start])

  useEffect(() => {
    if (stage === 'REPORT' || stage === 'LIVE') { stop(); stopLoop() }
  }, [stage, stop, stopLoop])

  useEffect(() => () => { stop(); stopLoop() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoLive = useCallback(() => {
    handleStartLive()
    navigate('/workout', { state: { movementProfile } })
  }, [handleStartLive, navigate, movementProfile])

  if (!exercise) return null

  const trueRef = getTrueReference(exercise.id)
  const userLandmarks = poses[0]?.landmarks ?? []

  return (
    <div className="flex flex-col min-h-[calc(100vh-0px)] -mx-4 -mt-5 bg-background">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border shrink-0">
        <button
          onClick={() => navigate(`/exercises/${exercise.id}`)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 active:opacity-70 min-h-[44px] pr-3"
        >
          <ArrowLeft size={18} />
          {exercise.name}
        </button>
        <div className="flex items-center gap-2">
          {/* True Reference badge */}
          <span
            className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            TRUE REFERENCE
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Cpu size={13} className="text-primary" />
            {stage === 'EXPLAIN' && 'Calibration'}
            {(stage === 'STEP' || stage === 'STEP_FAILED') &&
              `Step ${currentStepIndex + 1} / ${steps.length}`}
            {stage === 'REPORT' && 'Movement Profile'}
          </div>
        </div>
      </div>

      {stage === 'EXPLAIN' && (
        <ExplainView exercise={exercise} steps={steps} trueRef={trueRef} onStart={handleStartCalibration} />
      )}

      {(stage === 'STEP' || stage === 'STEP_FAILED') && (
        <StepView
          stage={stage}
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
          stepResults={stepResults}
          onAnalyze={handleAnalyzeStep}
          onSkip={handleSkipStep}
          onRetry={handleRetryStep}
          onSwitchCamera={switchCamera}
          referencePhase={refPhaseForStep ?? null}
          userLandmarks={userLandmarks}
          matchScore={matchScore}
          isMatched={isMatched}
          primaryDeviation={primaryDeviation}
          liveComparison={liveComparison}
        />
      )}

      {stage === 'REPORT' && movementProfile && (
        <ReportView
          profile={movementProfile}
          exerciseId={exercise.id}
          onStartLive={handleGoLive}
          onSkip={handleGoLive}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLAIN VIEW
// ─────────────────────────────────────────────────────────────────────────────

function ExplainView({
  exercise, steps, trueRef, onStart,
}: {
  exercise: NonNullable<ReturnType<typeof getExerciseById>>
  steps: { title: string; instruction: string }[]
  trueRef: ReturnType<typeof getTrueReference>
  onStart: () => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
      {/* Hero with True Reference badge */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(34,197,94,0.04))', border: '1px solid rgba(34,197,94,0.20)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Cpu size={16} className="text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">AI Calibration</span>
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#15803d', border: '1px solid rgba(34,197,94,0.30)' }}
          >
            ✦ TRUE REFERENCE
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">{exercise.name}</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          I'll guide you through <strong>{steps.length} key positions</strong> using a{' '}
          <strong>True Reference skeleton</strong> — ideal form landmarks you can visually align with.
        </p>
      </div>

      {/* Steps list with reference phase info */}
      <div className="bg-surface rounded-2xl shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Movement phases</h2>
        </div>
        <ol className="space-y-4">
          {steps.map((step, i) => {
            const refPhase = trueRef?.phases[i]
            return (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.instruction}</p>
                  {refPhase && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {refPhase.keyJoints.map((j) => (
                        <span key={j} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {j}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* True Reference info */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(15,20,30,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">About True Reference</span>
        </div>
        <ul className="space-y-1 text-xs text-slate-600 leading-relaxed">
          <li>• A <span className="text-emerald-600 font-semibold">green ghost skeleton</span> will show the ideal pose for each step.</li>
          <li>• <span className="text-red-500 font-semibold">Red joints</span> = significant deviation from reference.</li>
          <li>• <span className="text-amber-500 font-semibold">Amber arrows</span> = direction to correct toward.</li>
          <li>• Your movement is compared in real time, phase by phase.</li>
        </ul>
      </div>

      {/* AI monitors */}
      {exercise.aiMonitors && exercise.aiMonitors.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">AI Coach monitors</h2>
          <ul className="space-y-1.5">
            {exercise.aiMonitors.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Tips</p>
        <ul className="space-y-1 text-sm text-amber-800">
          <li>• Stand 1.5–2 m away so your full body is visible.</li>
          <li>• Good lighting helps the AI track your joints clearly.</li>
          <li>• Align your body with the <strong>green ghost skeleton</strong>.</li>
          <li>• Tap <strong>Analyze Step</strong> when matched, or just hold position.</li>
        </ul>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-primary text-white font-bold text-base rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors"
      >
        Start Calibration
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP VIEW  — full-screen camera + reference ghost + comparison
// ─────────────────────────────────────────────────────────────────────────────

function StepView({
  stage, currentStepIndex, steps, liveEval,
  consecutivePassFrames, holdFramesRequired,
  isActive, status, error, facing,
  videoRef, canvasRef, modelStatus, poses,
  startLoop, stopLoop,
  stepResults, onAnalyze, onSkip, onRetry, onSwitchCamera,
  referencePhase, userLandmarks, matchScore, isMatched, primaryDeviation, liveComparison,
}: {
  stage: string
  currentStepIndex: number
  steps: { title: string; instruction: string; correction: string }[]
  liveEval: FrameEvaluation | null
  consecutivePassFrames: number
  holdFramesRequired: number
  isActive: boolean
  status: Parameters<typeof CameraView>[0]['status']
  error: CameraError | null
  facing: Parameters<typeof CameraView>[0]['facing']
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  modelStatus: UsePoseLandmarkerReturn['modelStatus']
  poses: UsePoseLandmarkerReturn['poses']
  startLoop: UsePoseLandmarkerReturn['startLoop']
  stopLoop: UsePoseLandmarkerReturn['stopLoop']
  stepResults: StepResult[]
  onAnalyze: () => void
  onSkip: () => void
  onRetry: () => void
  onSwitchCamera: () => void
  referencePhase: ReferencePhase | null
  userLandmarks: import('../features/pose/poseTypes').NormalizedLandmark[]
  matchScore: number
  isMatched: boolean
  primaryDeviation: import('../features/reference').JointDeviation | null
  liveComparison: import('../features/reference').ReferenceComparison | null
}) {
  const currentStep = steps[currentStepIndex]
  if (!currentStep) return null

  const isFailed    = stage === 'STEP_FAILED'
  const failResult  = isFailed ? stepResults[currentStepIndex] : null
  const holdPct     = Math.min(100, Math.round((consecutivePassFrames / holdFramesRequired) * 100))
  const landmarksOk = liveEval?.landmarksValid ?? false
  const passing     = liveEval?.passing ?? false
  const mirrored    = facing === 'user'

  return (
    <div className="flex flex-col flex-1">

      {/* ── Step progress pills ───────────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 pt-3 pb-2 shrink-0">
        {steps.map((_, i) => (
          <div key={i} className={[
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            i < currentStepIndex  ? 'bg-primary' :
            i === currentStepIndex ? 'bg-primary/50' : 'bg-slate-200',
          ].join(' ')} />
        ))}
      </div>

      {/* ── Step label ─────────────────────────────────────────────────── */}
      <div className="px-4 pb-2 shrink-0">
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
        <h2 className="text-base font-bold text-slate-900 leading-tight">{currentStep.title}</h2>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{currentStep.instruction}</p>
      </div>

      {/* ── FULL-SCREEN CAMERA ────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
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
            {/* TRUE REFERENCE ghost skeleton */}
            {referencePhase && isActive && (
              <ReferenceGhostCanvas
                videoRef={videoRef}
                referenceLandmarks={referencePhase.pose}
                userLandmarks={userLandmarks}
                deviations={liveComparison?.jointDeviations ?? []}
                mirrored={mirrored}
                opacity={0.75}
                visible={!isFailed}
              />
            )}
          </CameraView>
        </div>

        {/* ── TRUE REFERENCE label (top-left) ────────────────────────── */}
        {isActive && referencePhase && !isFailed && (
          <div className="absolute top-3 left-3 pointer-events-none">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: 'rgba(34,197,94,0.85)', color: 'white', backdropFilter: 'blur(8px)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
              TRUE REFERENCE
            </div>
          </div>
        )}

        {/* ── AI COACH match score (top-right) ───────────────────────── */}
        {isActive && landmarksOk && !isFailed && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{
                background: isMatched ? 'rgba(34,197,94,0.85)' : 'rgba(0,0,0,0.65)',
                color: 'white',
                backdropFilter: 'blur(8px)',
              }}
            >
              {isMatched ? '✓ MATCHED' : `${matchScore}% match`}
            </div>
          </div>
        )}

        {/* ── Live angle chips overlay ─────────────────────────────────── */}
        {isActive && !isFailed && landmarksOk && liveEval && liveEval.targetEvals.length > 0 && (
          <div className="absolute top-12 left-3 right-3 flex flex-wrap gap-1.5 pointer-events-none">
            {liveEval.targetEvals.map((te, i) => (
              <div key={i} className={[
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm',
                te.withinTolerance
                  ? 'bg-emerald-500/80 text-white'
                  : 'bg-black/60 text-white/90',
              ].join(' ')}>
                {te.withinTolerance
                  ? <CheckCircle2 size={11} />
                  : <span className="w-2 h-2 rounded-full border border-white/60 inline-block" />}
                <span>{te.target.label}</span>
                {te.valid && <span className="opacity-80">{te.observed}°</span>}
              </div>
            ))}
          </div>
        )}

        {/* ── Live reference deviation hint ───────────────────────────── */}
        {isActive && !isFailed && landmarksOk && primaryDeviation && !isMatched && (
          <div className="absolute top-3 left-3 right-3 mt-8 pointer-events-none flex justify-center">
            <div
              className="px-3 py-2 rounded-xl text-xs font-semibold max-w-xs text-center"
              style={{
                background: primaryDeviation.severity === 'ERROR' ? 'rgba(239,68,68,0.82)' : 'rgba(245,158,11,0.85)',
                color: 'white',
                backdropFilter: 'blur(8px)',
                marginTop: liveEval?.targetEvals.length ? '36px' : '0',
              }}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide opacity-80 mb-0.5">
                {primaryDeviation.affectedJoint}
              </span>
              {primaryDeviation.correctionText}
            </div>
          </div>
        )}

        {/* ── Hold progress overlay ────────────────────────────────────── */}
        {isActive && !isFailed && landmarksOk && (
          <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
            <div className="bg-black/65 backdrop-blur-sm rounded-xl px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/80 font-medium">
                  {passing ? '✓ Hold position…' : 'Align with reference'}
                </span>
                <span className="text-xs text-white/50 tabular-nums">{holdPct}%</span>
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

        {/* ── No-landmarks overlay ─────────────────────────────────────── */}
        {isActive && !isFailed && !landmarksOk && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-black/70 backdrop-blur-sm text-white/80 text-xs px-4 py-2 rounded-full whitespace-nowrap">
              Step into frame — full body needed
            </div>
          </div>
        )}
      </div>

      {/* ── Controls (below camera) ───────────────────────────────────── */}
      <div className="shrink-0 px-4 pb-5 pt-3 space-y-2 bg-background">

        {!isFailed && (
          <>
            <button
              onClick={onAnalyze}
              disabled={!isActive || !landmarksOk}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold rounded-2xl py-4 min-h-[52px] active:bg-primary-dark disabled:opacity-40 transition-colors"
            >
              <Cpu size={18} />
              Analyze Step
            </button>
            <button
              onClick={onSkip}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 font-semibold rounded-2xl py-3 min-h-[48px] active:bg-slate-50 transition-colors"
            >
              <SkipForward size={16} />
              Skip Step
            </button>
          </>
        )}

        {isFailed && (
          <>
            {/* ── TRUE REFERENCE vs YOUR MOVEMENT comparison ─────────── */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-red-500 shrink-0" />
                <span className="text-sm font-bold text-red-700">Needs correction</span>
                {/* Reference label */}
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  REFERENCE
                </span>
              </div>
              <p className="text-sm text-red-800 leading-relaxed">{currentStep.correction}</p>

              {/* Issue detail: reference angle vs observed */}
              {failResult && failResult.issues.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-200 space-y-2">
                  <p className="text-[10px] text-red-600 font-bold uppercase tracking-wide">
                    True Reference vs Your Movement
                  </p>
                  {failResult.issues.map((issue, i) => (
                    <div key={i} className="flex items-center justify-between text-xs rounded-lg bg-red-100/60 px-2.5 py-2">
                      <span className="text-red-700 font-medium">{issue.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                          ✦ {issue.ideal}°
                        </span>
                        <span className="text-red-400">→</span>
                        <span className="text-red-600 font-bold">{issue.observed}°</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold rounded-2xl py-4 min-h-[52px] active:bg-primary-dark transition-colors"
            >
              <RotateCcw size={16} />
              Try Again
            </button>
            <button
              onClick={onSkip}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-500 font-semibold rounded-2xl py-3 min-h-[44px] active:bg-slate-50 transition-colors"
            >
              <SkipForward size={15} />
              Skip Step
            </button>
          </>
        )}

        {isActive && (
          <button onClick={onSwitchCamera} className="w-full text-xs text-slate-400 py-1.5 active:opacity-70">
            Switch Camera
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT VIEW  — TRUE REFERENCE vs YOUR MOVEMENT
// ─────────────────────────────────────────────────────────────────────────────

function ReportView({
  profile, exerciseId, onStartLive, onSkip,
}: {
  profile: MovementProfile
  exerciseId: string
  onStartLive: () => void
  onSkip: () => void
}) {
  const weakest = profile.stepResults[profile.weakestStepIndex]
  const trueRef = getTrueReference(exerciseId)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(34,197,94,0.04))', border: '1px solid rgba(34,197,94,0.20)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Zap size={15} className="text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">Movement Profile</span>
        </div>

        {/* TRUE REFERENCE vs YOUR MOVEMENT header */}
        <div className="flex items-center gap-2 mb-2 mt-3">
          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            TRUE REFERENCE
          </span>
          <span className="text-slate-300 text-xs">vs</span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            YOUR MOVEMENT
          </span>
        </div>

        <h1 className="text-xl font-bold text-slate-900">Pre-Workout AI Report</h1>
        <p className="text-sm text-slate-500 mt-0.5">{profile.exerciseName} · Calibration complete</p>
        <div className="mt-4 flex items-end gap-3">
          <span className={['text-5xl font-black', scoreColor(profile.overallScore)].join(' ')}>
            {profile.overallScore}
          </span>
          <span className="text-slate-400 mb-1 text-sm">/ 100 overall</span>
        </div>
        <div className="mt-3 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={['h-full rounded-full', scoreBar(profile.overallScore)].join(' ')}
               style={{ width: `${profile.overallScore}%` }} />
        </div>
      </div>

      {/* Step-by-step breakdown with reference */}
      <div className="bg-surface rounded-2xl shadow-card p-5">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-4">
          Step Scores — True Reference vs Your Movement
        </h2>
        <div className="space-y-3">
          {profile.stepResults.map((r, i) => {
            const refPhase = trueRef?.phases[i]
            return (
              <div key={i} className={[
                'rounded-xl border p-3',
                i === profile.weakestStepIndex ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white',
              ].join(' ')}>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                    {r.step.number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.step.title}</p>
                      {i === profile.weakestStepIndex && (
                        <span className="text-[10px] bg-amber-200 text-amber-800 rounded-full px-1.5 py-0.5 font-bold shrink-0">
                          FOCUS
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={['h-full rounded-full', scoreBar(r.score)].join(' ')}
                           style={{ width: `${r.score}%` }} />
                    </div>
                  </div>
                  <span className={['text-lg font-black shrink-0', scoreColor(r.score)].join(' ')}>
                    {r.score}%
                  </span>
                  {r.score >= 85
                    ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    : <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
                </div>

                {/* Reference phase key joints */}
                {refPhase && r.score < 90 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {refPhase.keyJoints.map((j) => (
                      <span key={j} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                        {j}
                      </span>
                    ))}
                  </div>
                )}

                {/* Issues: reference vs observed */}
                {r.issues.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-100 space-y-1.5">
                    {r.issues.map((issue, j) => (
                      <div key={j} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{issue.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600 font-bold">✦ {issue.ideal}°</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-bold text-amber-700">{issue.observed}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main weakness (focus area) */}
      {weakest && weakest.score < 90 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Main Area to Improve</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Step {weakest.step.number}: {weakest.step.title}
              </p>
            </div>
          </div>
          {weakest.issues.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {weakest.issues.map((issue, i) => (
                <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-amber-100/80 px-3 py-2">
                  <span className="text-amber-800">{issue.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-xs">
                      ✦ {issue.ideal}°
                    </span>
                    <span className="font-bold text-amber-900">{issue.observed}°</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-amber-100 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-900 mb-1">Correction</p>
            <p className="text-sm text-amber-800 leading-relaxed">{weakest.step.correction}</p>
          </div>
        </div>
      )}

      {/* Great score */}
      {profile.overallScore >= 90 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800 leading-relaxed">
            <strong>Excellent form!</strong> Your movement profile closely matches the True Reference.
            The AI coach will monitor all calibrated positions in real time.
          </p>
        </div>
      )}

      {/* AI Confidence note */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-2"
        style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}
      >
        <Cpu size={13} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>AI Confidence:</strong> Landmark-based comparison using MediaPipe 33-point model.
          Scores reflect joint angle alignment vs the True Reference. Live session will compare both
          your calibration profile and the True Reference.
        </p>
      </div>

      {/* CTAs */}
      <button
        onClick={onStartLive}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold text-base rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors"
      >
        <ChevronRight size={18} />
        Start Live Workout
      </button>
      <button
        onClick={onSkip}
        className="w-full text-sm text-slate-400 py-2 active:opacity-70"
      >
        Skip to workout without calibration
      </button>
    </div>
  )
}
