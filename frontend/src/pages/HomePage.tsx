/**
 * HomePage — polished mobile fitness dashboard.
 *
 * Sections:
 *  1. Hero banner — greeting, tagline, AI badge, "Start Workout" CTA
 *  2. Stats strip — real data: total sessions, total reps, avg form score
 *  3. Exercise cards — horizontal scroll, larger, muscle groups shown
 *  4. Recent sessions — real data, rich rows with duration + form badge
 *  5. Safety notice — consult a doctor
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Dumbbell, HeartHandshake,
  Cpu, Flame, Activity, Star,
} from 'lucide-react'
import { EXERCISE_LIBRARY } from '../features/exercise/exerciseLibrary'
import { listSessions } from '../services/sessionService'
import type { SessionRecord } from '../services/sessionService'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'

// ── Design tokens ─────────────────────────────────────────────────────────────

const ACCENTS: Record<string, { card: string; icon: string; text: string; badge: string }> = {
  squat:  { card: 'bg-emerald-50 border-emerald-100', icon: 'bg-emerald-100', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  pushup: { card: 'bg-sky-50    border-sky-100',     icon: 'bg-sky-100',     text: 'text-sky-700',     badge: 'bg-sky-100 text-sky-700'         },
  curl:   { card: 'bg-amber-50  border-amber-100',   icon: 'bg-amber-100',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700'     },
}

// ── Greeting ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 5)  return 'Up early'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}

function motiveLine(sessionCount: number) {
  if (sessionCount === 0) return 'Start your first session today.'
  if (sessionCount < 5)   return `${sessionCount} session${sessionCount > 1 ? 's' : ''} done. Keep it up!`
  if (sessionCount < 20)  return `${sessionCount} sessions logged — you're building a habit.`
  return `${sessionCount} sessions strong. Outstanding consistency!`
}

// ── Illustrations ─────────────────────────────────────────────────────────────

function SquatSVG({ cls }: { cls?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={cls} aria-hidden="true">
      <circle cx="28" cy="9" r="5" fill="currentColor" opacity=".85" />
      <path d="M28 14v12M21 19l7 7 7-7M18 32l-4 10M38 32l4 10M17 32h22"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 42h8M33 42h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function PushUpSVG({ cls }: { cls?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={cls} aria-hidden="true">
      <circle cx="44" cy="10" r="5" fill="currentColor" opacity=".85" />
      <path d="M44 15v7L36 28H8"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 28v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 38h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function CurlSVG({ cls }: { cls?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={cls} aria-hidden="true">
      <circle cx="28" cy="8" r="5" fill="currentColor" opacity=".85" />
      <path d="M28 13v10M22 23l6 3 6-3M28 26l-5 15"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 44h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const SVGs: Record<string, typeof SquatSVG> = { squat: SquatSVG, pushup: PushUpSVG, curl: CurlSVG }

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, onTap }: { exercise: ExerciseDefinition; onTap: () => void }) {
  const a   = ACCENTS[exercise.id] ?? ACCENTS.squat
  const Svg = SVGs[exercise.id] ?? SquatSVG

  return (
    <button
      onClick={onTap}
      className={[
        'flex-shrink-0 w-40 rounded-2xl p-4 text-left border active:scale-[0.97] transition-transform',
        a.card,
      ].join(' ')}
      aria-label={`Open ${exercise.name}`}
    >
      {/* Illustration */}
      <div className={['w-12 h-12 rounded-xl flex items-center justify-center mb-3', a.icon].join(' ')}>
        <Svg cls={['w-8 h-8', a.text].join(' ')} />
      </div>

      {/* Name */}
      <p className={['text-sm font-bold leading-tight', a.text].join(' ')}>{exercise.name}</p>

      {/* Muscle groups — first two */}
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
        {exercise.muscleGroups.slice(0, 2).join(' · ')}
      </p>

      {/* Difficulty badge */}
      {exercise.difficulty && (
        <span className={['mt-2.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full', a.badge].join(' ')}>
          {exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}
        </span>
      )}
    </button>
  )
}

// ── Recent session row ────────────────────────────────────────────────────────

function SessionRow({ session }: { session: SessionRecord }) {
  const good    = session.form_status === 'GOOD'
  const dateStr = new Date(session.completed_at).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
        <Dumbbell size={17} className="text-primary" aria-hidden="true" />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{session.exercise_name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {session.reps} {session.reps === 1 ? 'rep' : 'reps'} · {dateStr}
        </p>
      </div>

      {/* Form badge */}
      <span className={[
        'text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0',
        good ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
      ].join(' ')}>
        {good ? '✓ Good' : '⚠ Fair'}
      </span>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  value, label, sub, icon: Icon, iconColor,
}: {
  value: string; label: string; sub: string
  icon: typeof Flame; iconColor: string
}) {
  return (
    <div className="flex-1 bg-surface rounded-2xl shadow-card p-4 flex flex-col gap-1 min-w-0">
      <div className={['w-7 h-7 rounded-lg flex items-center justify-center mb-0.5', iconColor].join(' ')}>
        <Icon size={14} strokeWidth={2} className="text-white" aria-hidden="true" />
      </div>
      <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{value}</p>
      <p className="text-xs font-semibold text-slate-700 leading-tight">{label}</p>
      <p className="text-[10px] text-slate-400 leading-tight">{sub}</p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const [sessions, setSessions]   = useState<SessionRecord[]>([])
  const [loaded, setLoaded]       = useState(false)

  useEffect(() => {
    listSessions()
      .then((all) => setSessions(all))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Derived stats
  const totalSessions = sessions.length
  const totalReps     = sessions.reduce((s, r) => s + r.reps, 0)
  const goodCount     = sessions.filter((s) => s.form_status === 'GOOD').length
  const formPct       = totalSessions > 0 ? Math.round((goodCount / totalSessions) * 100) : 0
  const recent        = sessions.slice(0, 3)

  return (
    <div className="space-y-5 pt-1 pb-2">

      {/* ── 1. HERO BANNER ───────────────────────────────────────────── */}
      <div className="rounded-3xl overflow-hidden bg-primary relative">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative px-5 pt-5 pb-6">
          {/* AI badge */}
          <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 mb-3">
            <Cpu size={11} className="text-green-200" />
            <span className="text-[11px] font-bold text-green-100 uppercase tracking-wide">AI Form Coach</span>
          </div>

          {/* Greeting */}
          <p className="text-green-200 text-sm font-medium">{greeting()} 👋</p>
          <h1 className="text-white text-2xl font-black leading-tight mt-0.5">
            Ready to train?
          </h1>
          <p className="text-green-100/80 text-sm mt-1 leading-relaxed">
            {motiveLine(totalSessions)}
          </p>

          {/* CTA */}
          <button
            onClick={() => navigate('/exercises')}
            className="mt-4 flex items-center gap-2 bg-white text-primary font-bold text-sm rounded-2xl px-5 py-3 active:scale-[0.97] transition-transform shadow-card"
          >
            Start Workout
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── 2. STATS STRIP ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
          Your progress
        </h2>
        <div className="flex gap-2.5">
          <StatTile
            value={loaded ? String(totalSessions) : '—'}
            label="Sessions"
            sub="total logged"
            icon={Flame}
            iconColor="bg-orange-400"
          />
          <StatTile
            value={loaded ? String(totalReps) : '—'}
            label="Total Reps"
            sub="across all sessions"
            icon={Activity}
            iconColor="bg-sky-400"
          />
          <StatTile
            value={loaded ? (totalSessions > 0 ? `${formPct}%` : '—') : '—'}
            label="Good Form"
            sub="sessions rated good"
            icon={Star}
            iconColor="bg-primary"
          />
        </div>
      </div>

      {/* ── 3. EXERCISE CARDS ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Exercises</h2>
          <button
            onClick={() => navigate('/exercises')}
            className="flex items-center gap-0.5 text-xs text-primary font-semibold active:opacity-70"
          >
            All <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {EXERCISE_LIBRARY.map((ex) => (
            <div key={ex.id} className="snap-start shrink-0">
              <ExerciseCard exercise={ex} onTap={() => navigate(`/exercises/${ex.id}`)} />
            </div>
          ))}
          {/* "More coming" placeholder */}
          <div className="snap-start shrink-0 w-40 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-4 gap-1.5">
            <Dumbbell size={20} className="text-slate-300" />
            <p className="text-xs text-slate-400 font-medium leading-tight">More exercises<br/>coming soon</p>
          </div>
        </div>
      </div>

      {/* ── 4. RECENT SESSIONS ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recent Sessions</h2>
          {totalSessions > 3 && (
            <button
              onClick={() => navigate('/progress')}
              className="flex items-center gap-0.5 text-xs text-primary font-semibold active:opacity-70"
            >
              View all <ChevronRight size={13} />
            </button>
          )}
        </div>

        <div className="bg-surface rounded-2xl shadow-card px-4">
          {/* Loading */}
          {!loaded && (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* Empty */}
          {loaded && recent.length === 0 && (
            <div className="py-8 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Dumbbell size={22} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">No sessions yet</p>
              <p className="text-xs text-slate-400 mt-1">Complete a workout to see it here</p>
              <button
                onClick={() => navigate('/exercises')}
                className="mt-4 inline-flex items-center gap-1.5 bg-primary text-white text-xs font-bold rounded-xl px-4 py-2.5 active:bg-primary-dark transition-colors"
              >
                Start your first workout
                <ChevronRight size={12} />
              </button>
            </div>
          )}

          {/* Rows */}
          {loaded && recent.map((s) => <SessionRow key={s.id} session={s} />)}
        </div>
      </div>

      {/* ── 5. SAFETY NOTICE ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/consult-doctor')}
        className="w-full bg-surface rounded-2xl shadow-card p-4 flex items-center gap-3 text-left active:bg-surface-muted transition-colors"
        aria-label="Read medical guidance"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <HeartHandshake size={19} className="text-blue-500" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Before you train</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">
            Read our guidance on safe exercise and professional advice
          </p>
        </div>
        <ChevronRight size={16} className="text-slate-300 shrink-0" />
      </button>

    </div>
  )
}
