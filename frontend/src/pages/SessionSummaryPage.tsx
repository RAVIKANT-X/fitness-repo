/**
 * SessionSummaryPage — /session-summary
 *
 * Two entry modes:
 *
 * 1. Normal flow — navigated here from LiveWorkoutPage with location.state:
 *    { result, saveStatus, savedRecord, saveError }
 *    Displays the full workout summary.
 *
 * 2. Direct navigation with a savedRecord.id in state — fetches the session
 *    from the backend using getSession(id) and displays the result.
 *
 * 3. No state + no ID → redirects to home.
 *
 * Rules:
 *  - Never shows "Saved ✓" when saveStatus is not 'saved'.
 *  - Never fabricates workout data.
 *  - Save error is clearly displayed without hiding the workout result.
 */

import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, Dumbbell } from 'lucide-react'
import { getSession } from '../services/sessionService'
import type { SessionRecord } from '../services/sessionService'
import type { Deviation } from '../features/analysis/analysisTypes'

// ── Types (mirror WorkoutResult from LiveWorkoutPage) ────────────────────────

interface WorkoutResult {
  exerciseName: string
  exerciseId: string
  repCount: number
  formStatus: string
  deviations: Deviation[]
  startedAt: string
  completedAt: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface SummaryState {
  result: WorkoutResult
  saveStatus: SaveStatus
  savedRecord: SessionRecord | null
  saveError: string | null
}

// ── Deviation messages (same map as WorkoutFeedback) ─────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionSummaryPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Case 1: navigated here with full state from LiveWorkoutPage
  const navState = location.state as SummaryState | null

  // Case 2: navigated here with only a session ID (e.g. from a notification or progress)
  const idFromState = (location.state as { sessionId?: number } | null)?.sessionId
  const [fetchedSession, setFetchedSession] = useState<SessionRecord | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    // Only fetch if we have an ID but no full result state
    if (idFromState && !navState?.result) {
      setFetchLoading(true)
      getSession(idFromState)
        .then((s) => {
          if (s) setFetchedSession(s)
          else setFetchError('Session not found.')
        })
        .catch(() => setFetchError('Could not load session.'))
        .finally(() => setFetchLoading(false))
    }
  }, [idFromState, navState])

  // Case 3: no usable state → redirect home
  useEffect(() => {
    if (!navState?.result && !idFromState) {
      navigate('/', { replace: true })
    }
  }, [navState, idFromState, navigate])

  // ── Loading state (fetching by ID) ────────────────────────────────────────
  if (fetchLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-8 h-8 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading session…</p>
      </div>
    )
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 px-4">
        <AlertTriangle size={36} className="text-warning" aria-hidden="true" />
        <p className="text-base font-semibold text-slate-800">{fetchError}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-white font-semibold rounded-2xl px-6 py-3 min-h-[48px] active:bg-primary-dark"
        >
          Back to Home
        </button>
      </div>
    )
  }

  // ── Build display data ────────────────────────────────────────────────────

  // Prioritise full nav state; fall back to fetched session record
  const result: WorkoutResult | null = navState?.result ?? (fetchedSession ? {
    exerciseName: fetchedSession.exercise_name,
    exerciseId:   fetchedSession.exercise_id,
    repCount:     fetchedSession.reps,
    formStatus:   fetchedSession.form_status,
    deviations:   fetchedSession.deviations,
    startedAt:    fetchedSession.started_at,
    completedAt:  fetchedSession.completed_at,
  } : null)

  const saveStatus:   SaveStatus     = navState?.saveStatus  ?? (fetchedSession ? 'saved' : 'idle')
  const savedRecord:  SessionRecord | null = navState?.savedRecord ?? fetchedSession ?? null
  const saveError:    string | null  = navState?.saveError   ?? null

  if (!result) return null

  const formGood = result.formStatus === 'GOOD'

  return (
    <div className="space-y-5 pt-2">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="text-center pt-2">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-3">
          <CheckCircle size={32} className="text-primary" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Workout Complete</h1>
        <p className="text-slate-500 text-sm mt-1">{result.exerciseName}</p>
      </div>

      {/* ── Save status banner ────────────────────────────────────────── */}
      {saveStatus === 'saved' && (
        <div className="flex items-center gap-2 justify-center">
          <CheckCircle size={14} className="text-success" aria-hidden="true" />
          <span className="text-sm font-semibold text-success">Session saved</span>
          {savedRecord && (
            <span className="text-xs text-slate-400">
              · #{savedRecord.id}
            </span>
          )}
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-2 bg-error/8 border border-error/20 rounded-2xl px-4 py-3">
          <XCircle size={16} className="text-error shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-error">Session could not be saved</p>
            {saveError && (
              <p className="text-xs text-slate-500 mt-0.5">{saveError}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Key metrics ───────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between">
          {/* Rep count */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Reps completed
            </p>
            <p className="text-6xl font-extrabold text-slate-900 tabular-nums leading-none">
              {String(result.repCount).padStart(2, '0')}
            </p>
          </div>

          {/* Form status */}
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Form
            </p>
            <span className={[
              'inline-block text-sm font-bold px-3 py-1.5 rounded-full',
              formGood ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
            ].join(' ')}>
              {formGood ? 'Good' : 'Needs Attention'}
            </span>
          </div>
        </div>

        {/* Deviations count */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell size={16} className="text-slate-400" aria-hidden="true" />
            <span className="text-sm text-slate-600">
              {result.deviations.length === 0
                ? 'No form deviations detected'
                : `${result.deviations.length} form ${result.deviations.length === 1 ? 'note' : 'notes'}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── Deviation detail list ─────────────────────────────────────── */}
      {result.deviations.length > 0 && (
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
            Form notes
          </p>
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
