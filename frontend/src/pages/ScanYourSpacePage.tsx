/**
 * ScanYourSpacePage — fully-automatic workspace + posture scan powered by Gemini Vision.
 *
 * ── User flow ──────────────────────────────────────────────────────────────────
 *  1. User taps "Scan Your Space" on Home
 *  2. Permission screen appears (one-time camera consent notice)
 *  3. User taps "Scan Your Space →"  ← ONLY button the user ever taps
 *  4. Front camera opens, live preview starts
 *  5. App waits silently for a stable, valid frame:
 *       • Human detected (MediaPipe pose or brightness heuristic)
 *       • Frame brightness within acceptable range
 *       • N stable frames in a row
 *  6. One JPEG frame is captured from <video> via <canvas>
 *  7. Frame sent to Gemini Vision API (direct browser → Gemini)
 *  8. Structured suggestions render as glass overlays on the live camera
 *  9. Optional TTS reads the top action aloud
 * 10. "Rescan" button lets the user trigger a new capture
 *
 * No Capture / Analyze / Scan button is shown during operation.
 * On-device pose analysis continues in parallel for continuous posture monitoring.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FlipHorizontal, Volume2, VolumeX,
  Camera, ScanLine, RotateCcw, CheckCircle, AlertTriangle,
  Sparkles, Loader2,
} from 'lucide-react'
import { useCamera }          from '../hooks/useCamera'
import { usePoseLandmarker }  from '../hooks/usePoseLandmarker'
import { useVoiceCoach }      from '../hooks/useVoiceCoach'
import {
  validateHumanScene,
  ValidationSmoother,
  getValidationTtsMessage,
} from '../features/camera/humanValidation'
import HumanValidationOverlay from '../components/workout/HumanValidationOverlay'
import { analyseWorkspaceFrame } from '../services/geminiVision'
import { analysePosture }        from '../features/scanSpace/postureAnalysis'
import { recogniseActivity, resetActivitySmoother } from '../features/scanSpace/activityRecognition'
import { PostureCoach }          from '../features/scanSpace/postureCoach'
import { SmartBreakTracker }     from '../features/scanSpace/smartBreak'
import { recordPostureFrame, recordBreak } from '../features/scanSpace/postureDataStore'
import { EXERCISE_LIBRARY }      from '../features/exercise/exerciseLibrary'
import { useSelectedExercise }   from '../hooks/useSelectedExercise'
import type { GeminiScanResult, PostureIssue } from '../services/geminiVision'

// ── Constants ─────────────────────────────────────────────────────────────────

/** On-device analysis throttle: run every N rAF frames */
const ANALYSIS_EVERY_N = 4

/** Frames that must be consecutively "valid" before auto-capture fires */
const STABLE_FRAMES_NEEDED = 18   // ~0.6 s at 30 fps

/** JPEG quality for the captured frame sent to Gemini (0–1) */
const CAPTURE_QUALITY = 0.82

/** Max short-side dimension for the captured frame (keep payload small) */
const MAX_CAPTURE_DIM = 768

// ── Frame capture ─────────────────────────────────────────────────────────────

/**
 * Grab a single frame from the video element, optionally mirror it,
 * and return a pure base64 JPEG string (no data-URI prefix).
 */
function captureFrame(
  video: HTMLVideoElement,
  mirrored: boolean,
  quality = CAPTURE_QUALITY,
): string {
  const vw = video.videoWidth  || 640
  const vh = video.videoHeight || 480

  // Scale down so the longer side ≤ MAX_CAPTURE_DIM
  const scale = Math.min(1, MAX_CAPTURE_DIM / Math.max(vw, vh))
  const cw    = Math.round(vw * scale)
  const ch    = Math.round(vh * scale)

  const offscreen = document.createElement('canvas')
  offscreen.width  = cw
  offscreen.height = ch
  const ctx = offscreen.getContext('2d')!

  if (mirrored) {
    ctx.translate(cw, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0, cw, ch)

  const dataUrl = offscreen.toDataURL('image/jpeg', quality)
  // Strip "data:image/jpeg;base64," prefix
  return dataUrl.split(',')[1] ?? ''
}

// ── Scan state machine ────────────────────────────────────────────────────────

type ScanPhase =
  | 'idle'           // permission screen
  | 'starting'       // camera/model initialising
  | 'waiting'        // live preview, waiting for stable valid frame
  | 'capturing'      // snapping the frame
  | 'analysing'      // awaiting Gemini response
  | 'result'         // result overlays shown
  | 'error'          // Gemini/network error

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r     = (size - 8) / 2
  const circ  = 2 * Math.PI * r
  const dash  = (score / 100) * circ
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size < 56 ? 12 : 17} fontWeight="800">{score}</text>
    </svg>
  )
}

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityColor(s: PostureIssue['severity']) {
  if (s === 'good')    return 'text-emerald-400'
  if (s === 'warning') return 'text-amber-400'
  return 'text-sky-400'
}
function severityIcon(s: PostureIssue['severity']) {
  if (s === 'good')    return '✓'
  if (s === 'warning') return '⚠'
  return '💡'
}

// ── Glass panel ───────────────────────────────────────────────────────────────

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl p-4 ${className}`}
      style={{
        background:           'rgba(8,12,28,0.80)',
        backdropFilter:       'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border:               '1px solid rgba(255,255,255,0.11)',
        boxShadow:            '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      {children}
    </div>
  )
}

// ── Waiting overlay ───────────────────────────────────────────────────────────

function WaitingOverlay({ stableCount, needed, canProceed }: {
  stableCount: number
  needed:      number
  canProceed:  boolean
}) {
  const pct = Math.min(100, Math.round((stableCount / needed) * 100))
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-6 pointer-events-none">
      {canProceed && (
        <GlassPanel className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Auto-Scanning</span>
          </div>
          <p className="text-white font-semibold text-sm mb-2">Hold still…</p>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-white/40 text-[10px] mt-1.5 text-right">Waiting for stable frame…</p>
        </GlassPanel>
      )}
    </div>
  )
}

// ── Analysing overlay ─────────────────────────────────────────────────────────

function AnalysingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pointer-events-none">
      {/* Pulsing scan ring */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 rounded-full border-2 border-sky-400/30 animate-ping" />
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(14,165,233,0.15)', border: '2px solid rgba(14,165,233,0.4)' }}>
          <Sparkles size={28} className="text-sky-300" />
        </div>
      </div>
      <GlassPanel>
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="text-sky-400 animate-spin" />
          <div>
            <p className="text-white font-bold text-sm">Analysing your workspace…</p>
            <p className="text-white/50 text-xs mt-0.5">Gemini Vision AI is reviewing the frame</p>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}

// ── Result overlay ────────────────────────────────────────────────────────────

function ResultOverlay({
  result,
  onRescan,
  onSelectExercise,
}: {
  result:            GeminiScanResult
  onRescan:          () => void
  onSelectExercise:  (id: string) => void
}) {
  const [tab, setTab] = useState<'posture' | 'space' | 'workout'>('posture')
  const exercises = EXERCISE_LIBRARY.filter((ex) =>
    ['squat', 'pushup', 'curl'].includes(ex.id)
  )

  return (
    <div className="absolute inset-0 flex flex-col justify-end pb-4 px-3 gap-2 pointer-events-none">

      {/* Top action banner */}
      {result.topAction && (
        <div
          className="mx-1 rounded-2xl px-4 py-3 flex items-start gap-3 pointer-events-auto"
          style={{
            background:     'rgba(14,165,233,0.18)',
            border:         '1px solid rgba(14,165,233,0.35)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <Sparkles size={16} className="text-sky-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest mb-0.5">Top Action</p>
            <p className="text-white font-semibold text-sm leading-snug">{result.topAction}</p>
          </div>
          {/* Score ring */}
          <ScoreRing score={result.postureScore} size={52} />
        </div>
      )}

      {/* Main panel */}
      <GlassPanel className="pointer-events-auto">
        {/* Header + tabs */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <ScanLine size={13} className="text-sky-400" />
            <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Scan Complete</span>
          </div>
          <button
            onClick={onRescan}
            className="flex items-center gap-1.5 bg-white/8 rounded-xl px-2.5 py-1 active:bg-white/15"
          >
            <RotateCcw size={11} className="text-white/60" />
            <span className="text-[10px] text-white/60 font-semibold">Rescan</span>
          </button>
        </div>

        {/* Summary */}
        <p className="text-white/75 text-xs leading-relaxed mb-3">{result.summary}</p>

        {/* Tab strip */}
        <div className="flex gap-1 mb-3">
          {(['posture', 'space', 'workout'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-colors',
                tab === t
                  ? 'bg-sky-500/25 text-sky-300'
                  : 'bg-white/5 text-white/40 active:bg-white/10',
              ].join(' ')}
            >
              {t === 'posture' ? '🦴 Posture' : t === 'space' ? '📐 Space' : '🏋 Workout'}
            </button>
          ))}
        </div>

        {/* Posture tab */}
        {tab === 'posture' && (
          <div className="space-y-2">
            {result.postureIssues.length === 0 ? (
              <div className="flex items-center gap-2 py-2">
                <CheckCircle size={16} className="text-emerald-400" />
                <p className="text-emerald-400 text-sm font-semibold">Great posture detected!</p>
              </div>
            ) : (
              result.postureIssues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`text-sm shrink-0 mt-0.5 ${severityColor(issue.severity)}`}>
                    {severityIcon(issue.severity)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-wide ${severityColor(issue.severity)}`}>
                      {issue.area}
                    </p>
                    <p className="text-white/80 text-xs leading-snug">{issue.observation}</p>
                    <p className="text-white/50 text-[11px] mt-0.5 leading-snug">→ {issue.suggestion}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Space tab */}
        {tab === 'space' && (
          <div className="space-y-2">
            {result.spaceObservations.length === 0 ? (
              <p className="text-white/50 text-xs py-2">No workspace observations available.</p>
            ) : (
              result.spaceObservations.map((obs, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-sky-400 text-sm shrink-0 mt-0.5">📐</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sky-300 text-[10px] font-bold uppercase tracking-wide">{obs.item}</p>
                    <p className="text-white/80 text-xs leading-snug">{obs.observation}</p>
                    <p className="text-white/50 text-[11px] mt-0.5 leading-snug">→ {obs.suggestion}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Workout tab */}
        {tab === 'workout' && (
          <div className="space-y-2">
            <p className="text-white/50 text-[11px] mb-2">Workspace micro-workouts you can do right now:</p>
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => onSelectExercise(ex.id)}
                className="w-full flex items-center gap-3 bg-white/6 rounded-xl px-3 py-2.5 text-left active:bg-white/12"
              >
                <span className="text-emerald-400 text-xs font-bold">✓</span>
                <span className="text-white text-sm font-medium flex-1">{ex.name}</span>
                <span className="text-white/30 text-[10px]">{ex.muscleGroups[0]}</span>
                <ArrowLeft size={11} className="text-white/30 rotate-180 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}

// ── Error overlay ─────────────────────────────────────────────────────────────

function ErrorOverlay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-6 pointer-events-none">
      <GlassPanel className="w-full max-w-sm pointer-events-auto">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <p className="text-white font-semibold text-sm">Scan failed</p>
        </div>
        <p className="text-white/60 text-xs leading-relaxed mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white font-bold text-sm rounded-2xl py-3 active:bg-sky-600"
        >
          <RotateCcw size={14} />
          Try Again
        </button>
      </GlassPanel>
    </div>
  )
}

// ── Permission / intro screen ─────────────────────────────────────────────────

function PermissionScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg"
        style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}
      >
        <ScanLine size={36} className="text-white" />
      </div>

      <div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Scan Your Space</h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
          Let FitCoach understand your workspace and guide your posture — powered by Gemini AI.
        </p>
      </div>

      {/* How it works */}
      <div className="w-full max-w-xs space-y-3 text-left">
        {[
          { icon: '📷', text: 'Camera opens automatically' },
          { icon: '⏳', text: 'App waits for a stable frame' },
          { icon: '✨', text: 'One photo sent to Gemini Vision AI' },
          { icon: '🪑', text: 'Posture + workspace coaching appears' },
          { icon: '🔒', text: 'Only one frame captured — no continuous upload' },
        ].map((item) => (
          <div key={item.text} className="flex items-center gap-3 text-sm text-slate-600">
            <span className="text-lg w-6 text-center">{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* THE ONLY BUTTON */}
      <button
        onClick={onStart}
        className="w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-white font-black rounded-2xl px-6 py-4 text-base active:bg-primary-dark transition-all shadow-card"
      >
        <ScanLine size={20} />
        Scan Your Space
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScanYourSpacePage() {
  const navigate = useNavigate()
  const { setSelectedExercise } = useSelectedExercise()

  // Debug: log on mount so it's easy to spot in the console
  useEffect(() => {
    console.log('[ScanSpace] component mounted')
    return () => { console.log('[ScanSpace] component unmounted') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Camera + pose
  const camera    = useCamera()
  const poser     = usePoseLandmarker()
  const voice     = useVoiceCoach()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  // Scan state machine
  const [phase, setPhase]           = useState<ScanPhase>('idle')
  const [stableCount, setStableCount] = useState(0)
  const [geminiResult, setGeminiResult] = useState<GeminiScanResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  // Human scene validation — shared gate
  const validationSmoother = useMemo(() => new ValidationSmoother(), [])

  // On-device tracking (runs in background regardless of scan phase)
  const coach        = useMemo(() => new PostureCoach(), [])
  const breakTracker = useMemo(() => new SmartBreakTracker(), [])
  const frameCount   = useRef(0)
  const lastFrameMs  = useRef(Date.now())
  const capturedRef  = useRef(false)   // prevent double-capture

  // Track whether the pose loop has already been started this session so we
  // don't call startLoop twice (once for camera-active, once for model-ready).
  const poseLoopStartedRef = useRef(false)

  // ── Step 1: user taps "Scan Your Space" ──────────────────────────────────
  const handleStart = useCallback(async () => {
    setPhase('starting')
    capturedRef.current = false
    poseLoopStartedRef.current = false
    console.log('[ScanSpace] component starting camera')
    await camera.start('user')
  }, [camera])

  // ── Step 2a: camera becomes active → move to 'waiting' immediately so the
  //   live preview is visible.  The pose loop will start as soon as the model
  //   is also ready; until then, stableCount stays 0 and no capture fires.
  //
  //   KEY FIX: Do NOT gate the 'waiting' phase on poser.modelStatus === 'ready'.
  //   Previously both conditions had to be true simultaneously.  On mobile the
  //   MediaPipe model takes 2–5 s to download, so the camera was already
  //   streaming but the UI stayed on "Opening camera…" the whole time.
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (camera.isActive && phase === 'starting') {
      console.log('[ScanSpace] camera active — transitioning to waiting phase')
      setPhase('waiting')
    }
  }, [camera.isActive, phase])

  // ── Step 2b: start the pose loop once BOTH camera AND model are ready ─────
  //   This is separate from the phase transition above so we don't need the
  //   model to be ready before showing the live preview.
  useEffect(() => {
    if (
      camera.isActive &&
      camera.videoRef.current &&
      canvasRef.current &&
      poser.modelStatus === 'ready' &&
      !poseLoopStartedRef.current &&
      (phase === 'waiting' || phase === 'result')
    ) {
      poseLoopStartedRef.current = true
      console.log('[ScanSpace] starting human validation (pose model ready)')
      poser.startLoop(camera.videoRef.current, canvasRef.current, camera.facing)
    }
  }, [camera.isActive, camera.facing, poser.modelStatus, poser, camera.videoRef, phase])

  // ── Step 3: every pose frame — quality gate + auto-capture ───────────────
  const lastSpokenSceneStatus = useRef<string>('')

  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'result') return

    frameCount.current++
    if (frameCount.current % ANALYSIS_EVERY_N !== 0) return

    const now     = Date.now()
    const deltaMs = now - lastFrameMs.current
    lastFrameMs.current = now

    // ── Human scene validation ────────────────────────────────────────────
    const rawScene = validateHumanScene(poser.poses)
    const scene    = validationSmoother.update(rawScene)

    // TTS for scene status changes (with cooldown)
    if (voice.enabled) {
      const tts = getValidationTtsMessage(scene.status)
      if (tts && tts !== lastSpokenSceneStatus.current) {
        lastSpokenSceneStatus.current = tts
        voice.speak(tts)
      }
    }

    // ── On-device analysis (only when single human) ───────────────────
    if (scene.canProceed) {
      const landmarks = poser.poses[0]?.landmarks ?? []
      const act       = recogniseActivity(landmarks)
      const isSitting = act.activity === 'DESK_SITTING' || act.activity === 'READING'
      const posture   = isSitting ? analysePosture(landmarks) : null
      breakTracker.update(isSitting, posture?.overallScore ?? 0)
      recordPostureFrame(posture?.overallScore ?? 0, isSitting, deltaMs, null)
    }

    // ── Auto-capture gate (only in 'waiting' phase, only SINGLE_HUMAN) ───
    if (phase !== 'waiting' || capturedRef.current) return

    if (scene.canProceed) {
      const newCount = stableCount + 1
      setStableCount(newCount)

      if (newCount >= STABLE_FRAMES_NEEDED) {
        // All conditions met — capture the frame
        capturedRef.current = true
        setPhase('capturing')

        const video    = camera.videoRef.current
        const mirrored = camera.facing === 'user'

        if (!video) {
          setErrorMsg('Camera not ready — please try again.')
          setPhase('error')
          return
        }

        console.log('[ScanSpace] suitable frame found — capturing')

        // Slight delay so the UI can show "capturing" state briefly
        setTimeout(async () => {
          try {
            setPhase('analysing')
            const b64 = captureFrame(video, mirrored)
            if (!b64) throw new Error('Frame capture failed.')
            console.log('[ScanSpace] sending image to backend (b64 length=%d)', b64.length)
            const result = await analyseWorkspaceFrame(b64)

            // Gemini-level backup validation (requirement #11)
            if (result.analysisStatus === 'invalid_human_scene') {
              setErrorMsg('Please scan again with only yourself visible.')
              setPhase('error')
              return
            }

            setGeminiResult(result)
            setPhase('result')
            // Speak top action if voice is on
            if (voice.enabled && result.topAction) {
              voice.speak(result.topAction, true)
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error'
            setErrorMsg(msg)
            setPhase('error')
          }
        }, 80)
      }
    } else {
      // Reset stable counter on invalid human scene
      setStableCount(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poser.poses, phase])

  // ── Rescan ────────────────────────────────────────────────────────────────
  const handleRescan = useCallback(() => {
    capturedRef.current = false
    poseLoopStartedRef.current = false
    validationSmoother.reset()
    lastSpokenSceneStatus.current = ''
    setStableCount(0)
    setGeminiResult(null)
    setErrorMsg(null)
    // If the camera is still active just go back to waiting; otherwise
    // re-start the whole camera lifecycle.
    if (camera.isActive) {
      setPhase('waiting')
    } else {
      setPhase('starting')
      camera.start('user')
    }
  }, [validationSmoother, camera])

  // ── Navigate to exercise ──────────────────────────────────────────────────
  const handleSelectExercise = useCallback((id: string) => {
    const ex = EXERCISE_LIBRARY.find((e) => e.id === id)
    if (!ex) return
    setSelectedExercise(ex)
    camera.stop()
    poser.stopLoop()
    navigate(`/exercises/${id}`)
  }, [navigate, camera, poser, setSelectedExercise])

  // ── Break handler ─────────────────────────────────────────────────────────
  const handleTakeBreak = useCallback(() => {
    recordBreak()
    breakTracker.takeBreak()
  }, [breakTracker])
  void handleTakeBreak  // may be wired to a smart break modal in future

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      poser.stopLoop()
      camera.stop()
      coach.reset()
      breakTracker.reset()
      resetActivitySmoother()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Render: idle / permission ─────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      // Permission screen uses camera-page so it also fills the full viewport
      // and the BottomNav clears it correctly
      <div className="camera-page bg-background overflow-y-auto">
        <PermissionScreen onStart={handleStart} />
      </div>
    )
  }

  const isMirrored = camera.facing === 'user'

  // Derive a human-readable camera error heading for the specific error type
  const cameraErrorHeading = (() => {
    const name = camera.error?.name ?? ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Camera Permission Required'
    if (name === 'NotFoundError'   || name === 'DevicesNotFoundError')  return 'No Camera Found'
    if (name === 'NotReadableError'|| name === 'TrackStartError')       return 'Camera Busy'
    if (name === 'SecurityError')                                        return 'Camera Access Blocked'
    if (name === 'TimeoutError')                                         return 'Camera Could Not Start'
    return 'Camera Unavailable'
  })()

  return (
    <div className="camera-page bg-slate-950">
      {/* camera-section fills all available height between nothing and the status bar */}
      <div className="camera-section">

        {/* ── Live video ────────────────────────────────────────────────── */}
        {/* IMPORTANT: the video element must always be in the DOM once we leave
            the 'idle' phase so that camera.videoRef is attached before
            camera.start() is called.  We control visibility via opacity, not
            display:none, to avoid the video never becoming visible on mobile. */}
        <video
          ref={camera.videoRef}
          autoPlay playsInline muted
          className={[
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            isMirrored ? 'scale-x-[-1]' : '',
            camera.isActive ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-label="Camera preview"
        />

        {/* ── Pose skeleton ─────────────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          className={[
            'absolute inset-0 w-full h-full pointer-events-none',
            isMirrored ? 'scale-x-[-1]' : '',
          ].join(' ')}
          style={{ opacity: phase === 'result' ? 0.35 : 0.60 }}
        />

        {/* ── Camera / model loading ────────────────────────────────────── */}
        {/* Show the spinner only while the camera is actually starting up
            (status === 'requesting') OR while phase is explicitly 'starting'.
            Once phase becomes 'waiting' (camera active) we stop showing this
            overlay even if the pose model is still loading — the live preview
            must be visible. */}
        {(phase === 'starting' || camera.status === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-4 z-10">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full border-2 border-sky-400/20 animate-ping" />
              <div className="w-12 h-12 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
            </div>
            <p className="text-white/70 text-sm font-medium">Opening camera…</p>
          </div>
        )}

        {/* ── Camera error ──────────────────────────────────────────────── */}
        {camera.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-8 gap-4 z-10">
            <Camera size={40} className="text-white/25" />
            <p className="text-white font-bold text-center text-base">{cameraErrorHeading}</p>
            <p className="text-white/55 text-sm text-center leading-relaxed max-w-xs">
              {camera.error?.message ?? 'Unknown camera error.'}
            </p>
            <button
              onClick={() => { camera.start('user') }}
              className="mt-2 flex items-center gap-2 bg-sky-500 text-white font-bold text-sm rounded-2xl px-5 py-3 active:bg-sky-600"
            >
              <RotateCcw size={14} />
              Try Again
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-white/40 text-xs underline"
            >
              Back
            </button>
          </div>
        )}

        {/* ── Top bar ───────────────────────────────────────────────────── */}
        {camera.isActive && (
          <div className="absolute top-0 left-0 right-0 px-4 pt-3 pb-2 flex items-center justify-between z-20 pointer-events-none">
            <button
              onClick={() => navigate(-1)}
              className="pointer-events-auto w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)' }}
              aria-label="Go back"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>

            <span
              className="text-[11px] font-black text-white/80 uppercase tracking-widest"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
            >
              {phase === 'waiting'   ? 'Finding best frame…'
               : phase === 'capturing' ? 'Capturing…'
               : phase === 'analysing' ? 'AI Analysing…'
               : phase === 'result'    ? 'Scan Complete'
               : phase === 'error'     ? 'Scan Failed'
               : 'Scan Your Space'}
            </span>

            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={voice.toggle}
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)' }}
                aria-label={voice.enabled ? 'Mute voice coach' : 'Enable voice coach'}
              >
                {voice.enabled
                  ? <Volume2  size={16} className="text-emerald-400" />
                  : <VolumeX  size={16} className="text-white/40" />}
              </button>
              <button
                onClick={camera.switchCamera}
                className="w-9 h-9 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)' }}
                aria-label="Switch camera"
              >
                <FlipHorizontal size={16} className="text-white/70" />
              </button>
            </div>
          </div>
        )}

        {/* ── Corner bracket decorations (waiting / result) ────────────── */}
        {(phase === 'waiting' || phase === 'result') && camera.isActive && (
          <>
            <div className="absolute top-14 left-4 w-6 h-6 border-t-2 border-l-2 border-sky-400/60 rounded-tl pointer-events-none" />
            <div className="absolute top-14 right-4 w-6 h-6 border-t-2 border-r-2 border-sky-400/60 rounded-tr pointer-events-none" />
            <div className="absolute bottom-28 left-4 w-6 h-6 border-b-2 border-l-2 border-sky-400/60 rounded-bl pointer-events-none" />
            <div className="absolute bottom-28 right-4 w-6 h-6 border-b-2 border-r-2 border-sky-400/60 rounded-br pointer-events-none" />
          </>
        )}

        {/* ── Flash overlay on capture ──────────────────────────────────── */}
        {phase === 'capturing' && (
          <div className="absolute inset-0 bg-white/20 animate-[fadeIn_0.15s_ease-out] pointer-events-none" />
        )}

        {/* ── Human validation overlay (waiting phase) ─────────────────── */}
        {camera.isActive && phase === 'waiting' && (() => {
          const rawScene = validateHumanScene(poser.poses)
          const scene    = validationSmoother.update(rawScene)
          return (
            <>
              <HumanValidationOverlay
                status={scene.status}
                message={scene.message}
                contextHint={
                  scene.status === 'NO_HUMAN'
                    ? 'Make sure you are visible in the camera.'
                    : scene.status === 'MULTIPLE_HUMANS'
                    ? 'Only one person should be visible.'
                    : undefined
                }
                personCount={scene.personCount}
                position="top"
                showReady={true}
              />
              <WaitingOverlay
                stableCount={stableCount}
                needed={STABLE_FRAMES_NEEDED}
                canProceed={scene.canProceed}
              />
            </>
          )
        })()}

        {/* ── Phase-specific overlays ───────────────────────────────────── */}

        {(phase === 'capturing' || phase === 'analysing') && (
          <AnalysingOverlay />
        )}

        {phase === 'result' && geminiResult && (
          <ResultOverlay
            result={geminiResult}
            onRescan={handleRescan}
            onSelectExercise={handleSelectExercise}
          />
        )}

        {phase === 'error' && (
          <ErrorOverlay
            message={errorMsg ?? 'Something went wrong. Please try again.'}
            onRetry={handleRescan}
          />
        )}
      </div>

      {/* ── Status strip — uses camera-controls for safe-area clearance ─── */}
      <div
        className="camera-controls flex items-center justify-center gap-2 px-4 pt-2"
        style={{ background: 'rgba(5,8,20,0.90)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {camera.isActive && (
          <>
            <div className={[
              'w-1.5 h-1.5 rounded-full',
              phase === 'analysing' ? 'bg-amber-400 animate-pulse' :
              phase === 'result'    ? 'bg-emerald-400' :
              phase === 'error'     ? 'bg-rose-400' :
              'bg-sky-400 animate-pulse',
            ].join(' ')} />
            <span className="text-[10px] text-white/35 font-semibold uppercase tracking-widest">
              {phase === 'waiting'   ? 'Live · Waiting for stable frame'
               : phase === 'analysing' ? 'Gemini Vision · Analysing'
               : phase === 'result'    ? 'Scan complete · On-device monitoring active'
               : phase === 'error'     ? 'Scan failed'
               : 'On-Device · Live'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
