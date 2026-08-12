/**
 * ProgressPage — workout history and performance overview.
 *
 * Calls listSessions() from the existing sessionService to fetch real data.
 * Shows an honest empty state when no sessions exist.
 * Does NOT fabricate statistics or chart data.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Dumbbell, TrendingUp, ChevronRight } from 'lucide-react'
import { listSessions } from '../services/sessionService'
import type { SessionRecord } from '../services/sessionService'

// ── Sub-components ────────────────────────────────────────────────────────────

function SessionRow({ session, onTap }: { session: SessionRecord; onTap: () => void }) {
  const formGood = session.form_status === 'GOOD'
  const date = new Date(session.completed_at)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 py-3.5 border-b border-border last:border-0 text-left active:bg-surface-muted transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
        <Dumbbell size={16} className="text-primary" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{session.exercise_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900 tabular-nums">{session.reps}</p>
          <p className="text-[10px] text-slate-400">reps</p>
        </div>
        <span className={[
          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
          formGood ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
        ].join(' ')}>
          {formGood ? 'Good' : 'Fair'}
        </span>
        <ChevronRight size={14} className="text-slate-300" aria-hidden="true" />
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setError('Could not load sessions. Check your connection.'))
      .finally(() => setLoading(false))
  }, [])

  const totalReps = sessions.reduce((sum, s) => sum + s.reps, 0)
  const goodFormCount = sessions.filter((s) => s.form_status === 'GOOD').length

  return (
    <div className="space-y-5 pt-1">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Progress</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your workout history</p>
      </div>

      {/* ── Summary stats (only when sessions exist) ─────────────────── */}
      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-surface rounded-2xl shadow-card p-3.5 text-center">
            <p className="text-xl font-bold text-slate-900 tabular-nums">{sessions.length}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sessions</p>
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-3.5 text-center">
            <p className="text-xl font-bold text-slate-900 tabular-nums">{totalReps}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total reps</p>
          </div>
          <div className="bg-surface rounded-2xl shadow-card p-3.5 text-center">
            <p className="text-xl font-bold text-slate-900 tabular-nums">{goodFormCount}</p>
            <p className="text-xs text-slate-500 mt-0.5">Good form</p>
          </div>
        </div>
      )}

      {/* ── Session list ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-slate-400" aria-hidden="true" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            All sessions
          </h2>
        </div>

        {loading && (
          <div className="bg-surface rounded-2xl shadow-card py-8 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading sessions…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-surface rounded-2xl shadow-card p-5">
            <p className="text-sm text-slate-500 text-center">{error}</p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="bg-surface rounded-2xl shadow-card py-10 flex flex-col items-center gap-3">
            <Calendar size={32} className="text-slate-300" aria-hidden="true" />
            <p className="text-base font-semibold text-slate-700">No workouts yet</p>
            <p className="text-sm text-slate-400 text-center px-6">
              Complete your first session to see your history here.
            </p>
            <button
              onClick={() => navigate('/exercises')}
              className="mt-2 bg-primary text-white font-semibold rounded-2xl px-5 py-2.5 min-h-[44px] active:bg-primary-dark transition-colors text-sm"
            >
              Start a workout
            </button>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="bg-surface rounded-2xl shadow-card px-4">
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onTap={() => navigate('/session-summary', { state: { sessionId: s.id } })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
