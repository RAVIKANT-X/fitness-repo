/**
 * SessionSummaryPage — /session-summary
 *
 * Displays the completed workout summary with an optional AI coaching report
 * that compares the user's movements against True Reference form standards.
 *
 * Entry modes:
 *  1. From LiveWorkoutPage with full location.state — shows AI summary when
 *     requestAiSummary === true.
 *  2. Direct navigation with sessionId — fetches from backend.
 *  3. No state → redirect home.
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CheckCircle, XCircle, AlertTriangle, Dumbbell,
  Eye, Sparkles, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react'
import { getSession } from '../services/sessionService'
import type { SessionRecord } from '../services/sessionService'
import type { Deviation } from '../features/analysis/analysisTypes'
import { getTrueReference } from '../features/reference'
import { renderReferenceOnly } from '../features/reference/referenceRenderer'
import type { NormalizedLandmark } from '../features/pose/poseTypes'
import {
  analyseWorkoutSession,
} from '../services/geminiVision'
import type { WorkoutAISummary } from '../services/geminiVision'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkoutResult {
  exerciseName: string
  exerciseId: string
  repCount: number
  formStatus: string
  deviations: Deviation[]
  startedAt: string
  completedAt: string
  avgMatchScore?: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SummaryState {
  result: WorkoutResult
  saveStatus: SaveStatus
  savedRecord: SessionRecord | null
  saveError: string | null
  requestAiSummary?: boolean
  durationSeconds?: number
}

// ── Reference pose mini-canvas ────────────────────────────────────────────────

function ReferencePoseCanvasMini({
  landmarks, size = 64,
}: { landmarks: NormalizedLandmark[]; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size, size)
    renderReferenceOnly(ctx, landmarks, false, 1.0)
  }, [landmarks, size])
  return (
    <canvas ref={canvasRef} width={size} height={size}
      className="rounded-xl bg-emerald-50 shrink-0"
      aria-label="Reference pose" />
  )
}

// ── Deviation messages ────────────────────────────────────────────────────────

function deviationMessage(id: string): string {
  const messages: Record<string, string> = {
    DEPTH_TOO_SHALLOW:    'Squat a little deeper — aim to get thighs parallel to the floor',
    KNEE_ASYMMETRY:       'Keep your knees tracking evenly — one side is bending more than the other',
    HIP_ASYMMETRY:        'Try to keep your hips level throughout the movement',
    ELBOW_ASYMMETRY:      'Keep both elbows bending evenly — one side is lagging behind',
    SHOULDER_ALIGNMENT:   'Keep your shoulders from flaring — elbows closer to your body',
    INCOMPLETE_CURL:      'Curl all the way up — squeeze at the top for full range of motion',
    INCOMPLETE_EXTENSION: 'Fully extend your arm on the way down for complete range of motion',
    SHOULDER_MOVEMENT:    'Keep your shoulder stable — avoid swinging for momentum',
  }
  return messages[id] ?? id
}

// ── Score colour helpers ──────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 80 ? 'text-emerald-600' : s >= 60 ? 'text-amber-500' : 'text-red-500'
}
function scoreRing(s: number) {
  return s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444'
}
function scoreBg(s: number) {
  return s >= 80
    ? 'bg-emerald-50 border-emerald-200'
    : s >= 60
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200'
}

// ── AI Summary section ────────────────────────────────────────────────────────

type AiState = 'idle' | 'loading' | 'done' | 'error'

function AiSummarySection({
  result,
  durationSeconds,
}: {
  result: WorkoutResult
  durationSeconds: number
}) {
  const [aiState, setAiState] = useState<AiState>('loading')
  const [summary, setSummary]  = useState<WorkoutAISummary | null>(null)
  const [aiError, setAiError]  = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    analyseWorkoutSession({
      exerciseName:   result.exerciseName,
      exerciseId:     result.exerciseId,
      repCount:       result.repCount,
      formStatus:     result.formStatus,
      durationSeconds,
      deviations:     result.deviations.map(d => ({ id: d.id, severity: d.severity })),
      avgMatchScore:  result.avgMatchScore,
    })
      .then((s) => { setSummary(s); setAiState('done') })
      .catch((e) => { setAiError(e instanceof Error ? e.message : 'Unknown error'); setAiState('error') })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => {
    fetchedRef.current = false
    setAiState('loading')
    setAiError(null)
    setSummary(null)
    // Re-trigger by resetting the ref and calling manually
    fetchedRef.current = true
    analyseWorkoutSession({
      exerciseName:   result.exerciseName,
      exerciseId:     result.exerciseId,
      repCount:       result.repCount,
      formStatus:     result.formStatus,
      durationSeconds,
      deviations:     result.deviations.map(d => ({ id: d.id, severity: d.severity })),
      avgMatchScore:  result.avgMatchScore,
    })
      .then((s) => { setSummary(s); setAiState('done') })
      .catch((e) => { setAiError(e instanceof Error ? e.message : 'Unknown error'); setAiState('error') })
  }

  return (
    <div
      className={['rounded-2xl border overflow-hidden', aiState === 'done' && summary ? scoreBg(summary.formScore) : 'bg-surface border-border'].join(' ')}
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center gap-2.5 px-5 py-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">AI Movement Analysis</p>
          <p className="text-sm font-semibold text-slate-800 leading-tight">
            {aiState === 'loading' ? 'Analysing your session…' :
             aiState === 'error'   ? 'Analysis unavailable' :
             summary               ? `Form Score: ${summary.formScore}/100` : ''}
          </p>
        </div>
        {aiState === 'done' && (
          expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />
        )}
      </button>

      {/* Loading */}
      {aiState === 'loading' && (
        <div className="px-5 pb-5 flex flex-col items-center gap-3 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Comparing with True Reference movements…</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-primary/50 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error */}
      {aiState === 'error' && (
        <div className="px-5 pb-5 flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-slate-600">{aiError}</p>
            <button
              onClick={retry}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary"
            >
              <RotateCcw size={12} />
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {aiState === 'done' && summary && expanded && (
        <div className="px-5 pb-5 space-y-4">

          {/* Score ring + verdict */}
          <div className="flex items-center gap-4">
            {/* Ring */}
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke={scoreRing(summary.formScore)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - summary.formScore / 100)}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={['text-2xl font-black', scoreColor(summary.formScore)].join(' ')}>
                  {summary.formScore}
                </span>
                <span className="text-[8px] text-slate-400 font-bold uppercase">/100</span>
              </div>
            </div>

            {/* Verdict */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                True Reference Comparison
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">{summary.verdict}</p>
            </div>
          </div>

          {/* Positives */}
          {summary.positives.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1.5">✓ Well done</p>
              <ul className="space-y-1">
                {summary.positives.map((p, i) => (
                  <li key={i} className="text-xs text-emerald-800 leading-relaxed flex items-start gap-1.5">
                    <span className="text-emerald-500 shrink-0 mt-0.5">●</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coaching points */}
          {summary.coachingPoints.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Coaching Notes</p>
              {summary.coachingPoints.map((pt, i) => {
                const bg = pt.severity === 'good'
                  ? 'bg-emerald-50 border-emerald-200'
                  : pt.severity === 'critical'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
                const dot = pt.severity === 'good' ? 'bg-emerald-500' : pt.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                const labelColor = pt.severity === 'good' ? 'text-emerald-700' : pt.severity === 'critical' ? 'text-red-700' : 'text-amber-700'
                return (
                  <div key={i} className={['rounded-xl border p-3', bg].join(' ')}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={['w-1.5 h-1.5 rounded-full shrink-0', dot].join(' ')} />
                      <span className={['text-[10px] font-bold uppercase tracking-wide', labelColor].join(' ')}>{pt.area}</span>
                      {pt.referenceNote && (
                        <span className="ml-auto text-[9px] text-slate-400 font-medium">{pt.referenceNote}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-1">{pt.observation}</p>
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed">→ {pt.correction}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Top priority */}
          {summary.topPriority && (
            <div className="bg-slate-900 rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-white/50 uppercase tracking-wide mb-1">🎯 Top Priority Next Session</p>
              <p className="text-sm font-semibold text-white leading-relaxed">{summary.topPriority}</p>
            </div>
          )}

          {/* Next session tips */}
          {summary.nextSessionTips.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Next Session Drills</p>
              <ul className="space-y-1.5">
                {summary.nextSessionTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionSummaryPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const navState = location.state as SummaryState | null
  const idFromState = (location.state as { sessionId?: number } | null)?.sessionId
  const [fetchedSession, setFetchedSession] = useState<SessionRecord | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (idFromState && !navState?.result) {
      setFetchLoading(true)
      getSession(idFromState)
        .then((s) => { if (s) setFetchedSession(s); else setFetchError('Session not found.') })
        .catch(() => setFetchError('Could not load session.'))
        .finally(() => setFetchLoading(false))
    }
  }, [idFromState, navState])

  useEffect(() => {
    if (!navState?.result && !idFromState) navigate('/', { replace: true })
  }, [navState, idFromState, navigate])

  if (fetchLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-4">
        <AlertTriangle size={36} className="text-warning" />
        <p className="text-base font-semibold text-slate-800">{fetchError}</p>
        <button onClick={() => navigate('/')} className="bg-primary text-white font-semibold rounded-2xl px-6 py-3 min-h-[48px]">
          Back to Home
        </button>
      </div>
    )
  }

  const result: WorkoutResult | null = navState?.result ?? (fetchedSession ? {
    exerciseName: fetchedSession.exercise_name,
    exerciseId:   fetchedSession.exercise_id,
    repCount:     fetchedSession.reps,
    formStatus:   fetchedSession.form_status,
    deviations:   fetchedSession.deviations,
    startedAt:    fetchedSession.started_at,
    completedAt:  fetchedSession.completed_at,
  } : null)

  const saveStatus:  SaveStatus        = navState?.saveStatus  ?? (fetchedSession ? 'saved' : 'idle')
  const savedRecord: SessionRecord | null = navState?.savedRecord ?? fetchedSession ?? null
  const saveError:   string | null     = navState?.saveError   ?? null
  const requestAiSummary               = navState?.requestAiSummary ?? false
  const durationSeconds                = navState?.durationSeconds ?? 0

  if (!result) return null

  const formGood     = result.formStatus === 'GOOD'
  const trueReference = getTrueReference(result.exerciseId)

  return (
    <div className="space-y-5 pt-2 pb-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="text-center pt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-3">
          <CheckCircle size={32} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Session Complete</h1>
        <p className="text-slate-500 text-sm mt-1">{result.exerciseName}</p>
      </div>

      {/* ── Save status ───────────────────────────────────────────────── */}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 justify-center">
          <CheckCircle size={14} className="text-success" />
          <span className="text-sm font-semibold text-success">Session saved</span>
          {savedRecord && <span className="text-xs text-slate-400">· #{savedRecord.id}</span>}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 bg-error/8 border border-error/20 rounded-2xl px-4 py-3">
          <XCircle size={16} className="text-error shrink-0" />
          <div>
            <p className="text-sm font-semibold text-error">Session could not be saved</p>
            {saveError && <p className="text-xs text-slate-500 mt-0.5">{saveError}</p>}
          </div>
        </div>
      )}

      {/* ── Key metrics ───────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Reps completed</p>
            <p className="text-6xl font-extrabold text-slate-900 tabular-nums leading-none">
              {String(result.repCount).padStart(2, '0')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Form</p>
            <span className={[
              'inline-block text-sm font-bold px-3 py-1.5 rounded-full',
              formGood ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
            ].join(' ')}>
              {formGood ? 'Good' : 'Needs Attention'}
            </span>
          </div>
        </div>

        {/* Reference match + duration */}
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">
              <Dumbbell size={10} className="inline mr-0.5" />
              Form notes
            </p>
            <p className="text-sm font-semibold text-slate-700">
              {result.deviations.length === 0 ? 'None detected' : `${result.deviations.length} detected`}
            </p>
          </div>
          {result.avgMatchScore != null && (
            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Ref match</p>
              <p className={['text-sm font-bold', scoreColor(result.avgMatchScore)].join(' ')}>
                {result.avgMatchScore}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── AI Movement Summary — auto-loads when requestAiSummary=true ── */}
      {requestAiSummary && (
        <AiSummarySection result={result} durationSeconds={durationSeconds} />
      )}

      {/* ── Deviation detail list ─────────────────────────────────────── */}
      {result.deviations.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Form notes</p>
          <div className="space-y-3">
            {result.deviations.map((d) => (
              <div key={d.id} className="flex items-start gap-2.5">
                <span className={[
                  'text-xs mt-0.5 shrink-0',
                  d.severity === 'WARNING' || d.severity === 'ERROR' ? 'text-warning' : 'text-slate-400',
                ].join(' ')}>●</span>
                <p className="text-sm text-slate-700 leading-relaxed">{deviationMessage(d.id)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── True Reference visual comparison ─────────────────────────── */}
      {trueReference && trueReference.phases.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Eye size={13} className="text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">True Reference Positions</p>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Ideal reference positions for {result.exerciseName}. Compare your movement against each phase.
          </p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {trueReference.phases.map((phase) => (
              <div key={phase.phase} className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="bg-emerald-50 rounded-xl p-1.5">
                  <ReferencePoseCanvasMini landmarks={phase.pose} size={72} />
                </div>
                <span className="text-[9px] font-bold text-emerald-700 text-center max-w-[72px] leading-tight">
                  {phase.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/exercises')}
          className="w-full bg-primary text-white font-bold rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors"
        >
          New Workout
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full border border-slate-200 text-slate-700 font-semibold rounded-2xl py-3.5 min-h-[52px] active:bg-slate-50 transition-colors"
        >
          Back to Home
        </button>
      </div>

    </div>
  )
}
