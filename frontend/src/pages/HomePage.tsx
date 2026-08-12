/**
 * HomePage — mobile fitness dashboard.
 *
 * Sections:
 *  1. Greeting banner + CTA
 *  2. Activity summary strip (static placeholder — honest about no live data)
 *  3. Recommended exercise quick-cards (horizontal scroll)
 *  4. Recent session — real data from listSessions(); empty state if none
 *  5. Consult a doctor entry point
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Dumbbell, HeartHandshake } from 'lucide-react'
import { EXERCISE_LIBRARY } from '../features/exercise/exerciseLibrary'
import { listSessions } from '../services/sessionService'
import type { SessionRecord } from '../services/sessionService'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'

// ── Exercise accent colours ───────────────────────────────────────────────────

const EXERCISE_ACCENTS: Record<string, { bg: string; text: string; iconBg: string }> = {
  squat:  { bg: 'bg-green-50',  text: 'text-green-700',  iconBg: 'bg-green-100' },
  pushup: { bg: 'bg-blue-50',   text: 'text-blue-700',   iconBg: 'bg-blue-100'  },
  curl:   { bg: 'bg-amber-50',  text: 'text-amber-700',  iconBg: 'bg-amber-100' },
}

const difficultyLabel: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

// ── Greeting helper ───────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ── Inline exercise SVG illustrations ────────────────────────────────────────

function SquatIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="8" r="4" fill="currentColor" opacity=".8" />
      <path d="M24 12v10M18 16l6 6 6-6M16 28l-3 8M32 28l3 8M15 28h18"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 36h6M28 36h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function PushUpIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="36" cy="9" r="4" fill="currentColor" opacity=".8" />
      <path d="M36 13v6l-6 4H8"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 23v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M4 31h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function CurlIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle cx="24" cy="7" r="4" fill="currentColor" opacity=".8" />
      <path d="M24 11v8M20 19l4 2 4-2M24 21l-4 12"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 37h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

const illustrations: Record<string, typeof SquatIllustration> = {
  squat:  SquatIllustration,
  pushup: PushUpIllustration,
  curl:   CurlIllustration,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExerciseQuickCard({ exercise, onTap }: { exercise: ExerciseDefinition; onTap: () => void }) {
  const accent = EXERCISE_ACCENTS[exercise.id] ?? EXERCISE_ACCENTS.squat
  const Illustration = illustrations[exercise.id] ?? SquatIllustration

  return (
    <button
      onClick={onTap}
      className={[
        'flex-shrink-0 w-36 rounded-2xl p-4 text-left',
        accent.bg,
        'active:opacity-80 transition-opacity',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      ].join(' ')}
      aria-label={`View ${exercise.name}`}
    >
      <Illustration className={['w-12 h-12 mb-3', accent.text].join(' ')} />
      <p className={['text-sm font-semibold leading-tight', accent.text].join(' ')}>
        {exercise.name}
      </p>
      {exercise.difficulty && (
        <p className={['text-xs mt-0.5 opacity-70', accent.text].join(' ')}>
          {difficultyLabel[exercise.difficulty] ?? exercise.difficulty}
        </p>
      )}
    </button>
  )
}

function RecentSessionRow({ session }: { session: SessionRecord }) {
  const formGood = session.form_status === 'GOOD'
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
        <Dumbbell size={18} className="text-primary" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{session.exercise_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {session.reps} {session.reps === 1 ? 'rep' : 'reps'}
          {' · '}
          {new Date(session.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </div>
      <span
        className={[
          'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0',
          formGood ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
        ].join(' ')}
      >
        {formGood ? 'Good' : 'Fair'}
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  useEffect(() => {
    listSessions()
      .then((sessions) => setRecentSessions(sessions.slice(0, 3)))
      .catch(() => { /* silent — empty state handles this */ })
      .finally(() => setSessionsLoaded(true))
  }, [])

  return (
    <div className="space-y-6 pt-1">

      {/* ── 1. Greeting + CTA ─────────────────────────────────────── */}
      <div>
        <p className="text-sm text-slate-500 font-medium">{getGreeting()} 👋</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5 leading-tight">
          Ready for today's workout?
        </h1>
      </div>

      {/* Start Workout CTA card */}
      <button
        onClick={() => navigate('/exercises')}
        className="w-full bg-primary rounded-2xl p-5 text-left active:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark"
        aria-label="Start Workout"
      >
        <p className="text-green-100 text-xs font-semibold uppercase tracking-wide mb-1">
          AI Form Coach
        </p>
        <p className="text-white text-xl font-bold leading-tight">Start Workout</p>
        <p className="text-green-100 text-sm mt-1">
          Choose an exercise and let the camera guide your form
        </p>
        <div className="flex items-center gap-1 mt-3">
          <span className="text-white text-sm font-semibold">Browse exercises</span>
          <ChevronRight size={16} className="text-white" aria-hidden="true" />
        </div>
      </button>

      {/* ── 2. Activity summary strip ──────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Your activity
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Workouts', value: sessionsLoaded ? String(recentSessions.length > 0 ? '—' : '0') : '—', note: 'total logged' },
            { label: 'Reps', value: '—', note: 'coming soon' },
            { label: 'Form', value: '—', note: 'coming soon' },
          ].map(({ label, value, note }) => (
            <div key={label} className="bg-surface rounded-2xl p-3.5 shadow-card">
              <p className="text-xl font-bold text-slate-900 tabular-nums">{value}</p>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">{label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Exercise quick-cards (horizontal scroll) ─────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Exercises
          </h2>
          <button
            onClick={() => navigate('/exercises')}
            className="text-xs text-primary font-semibold flex items-center gap-0.5 active:opacity-70"
          >
            See all <ChevronRight size={12} aria-hidden="true" />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
          {EXERCISE_LIBRARY.map((ex) => (
            <div key={ex.id} className="snap-start">
              <ExerciseQuickCard
                exercise={ex}
                onTap={() => navigate(`/exercises/${ex.id}`)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Recent sessions ─────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Recent sessions
        </h2>
        <div className="bg-surface rounded-2xl shadow-card px-4">
          {!sessionsLoaded && (
            <div className="py-6 text-center">
              <div className="w-6 h-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          )}
          {sessionsLoaded && recentSessions.length === 0 && (
            <div className="py-6 text-center">
              <Dumbbell size={28} className="text-slate-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-400">No workouts yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Complete a session to see it here</p>
            </div>
          )}
          {sessionsLoaded && recentSessions.map((s) => (
            <RecentSessionRow key={s.id} session={s} />
          ))}
        </div>
      </div>

      {/* ── 5. Consult a doctor entry point ────────────────────────── */}
      <button
        onClick={() => navigate('/consult-doctor')}
        className="w-full bg-surface rounded-2xl shadow-card p-4 flex items-center gap-3 text-left active:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Medical advice notice"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <HeartHandshake size={20} className="text-blue-500" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Before you train</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Read our guidance on exercise and professional advice
          </p>
        </div>
        <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
      </button>

    </div>
  )
}
