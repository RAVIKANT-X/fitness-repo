/**
 * ExerciseSelectionPage — redesigned exercise library.
 *
 * Tapping a card navigates to /exercises/:id (Exercise Detail) rather than
 * starting the workout directly. The Detail page sets the exercise context
 * and allows the user to read the briefing before starting the camera.
 */

import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { EXERCISE_LIBRARY } from '../features/exercise/exerciseLibrary'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'

// ── Accent colours per exercise ───────────────────────────────────────────────

const ACCENTS: Record<string, { bg: string; iconBg: string; text: string; pill: string }> = {
  squat:  {
    bg:     'bg-green-50',
    iconBg: 'bg-green-100',
    text:   'text-green-700',
    pill:   'bg-green-100 text-green-700',
  },
  pushup: {
    bg:     'bg-blue-50',
    iconBg: 'bg-blue-100',
    text:   'text-blue-700',
    pill:   'bg-blue-100 text-blue-700',
  },
  curl:   {
    bg:     'bg-amber-50',
    iconBg: 'bg-amber-100',
    text:   'text-amber-700',
    pill:   'bg-amber-100 text-amber-700',
  },
}

const difficultyLabel: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

// ── Inline SVG illustrations ──────────────────────────────────────────────────

function SquatSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <circle cx="28" cy="9" r="5" fill="currentColor" opacity=".85" />
      <path d="M28 14v12M21 19l7 7 7-7M18 33l-4 9M38 33l4 9M17 33h22"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 42h8M35 42h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function PushUpSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <circle cx="44" cy="11" r="5" fill="currentColor" opacity=".85" />
      <path d="M44 16v7l-7 5H8"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 28v9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M3 37h10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function CurlSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <circle cx="28" cy="8" r="5" fill="currentColor" opacity=".85" />
      <path d="M28 13v9M23 22l5 2.5 5-2.5M28 24.5l-5 14"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 44h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const ILLUSTRATIONS: Record<string, typeof SquatSVG> = {
  squat:  SquatSVG,
  pushup: PushUpSVG,
  curl:   CurlSVG,
}

// ── Exercise card ─────────────────────────────────────────────────────────────

function ExerciseCard({ exercise, onTap }: { exercise: ExerciseDefinition; onTap: () => void }) {
  const accent = ACCENTS[exercise.id] ?? ACCENTS.squat
  const Illustration = ILLUSTRATIONS[exercise.id] ?? SquatSVG

  return (
    <button
      onClick={onTap}
      className={[
        'w-full rounded-2xl p-4 text-left',
        'bg-surface shadow-card',
        'active:opacity-80 transition-opacity duration-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      ].join(' ')}
      aria-label={`View details for ${exercise.name}`}
    >
      <div className="flex items-start gap-4">
        {/* Illustration badge */}
        <div className={['w-16 h-16 rounded-2xl flex items-center justify-center shrink-0', accent.iconBg].join(' ')}>
          <Illustration className={['w-10 h-10', accent.text].join(' ')} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-slate-900 text-base leading-tight">{exercise.name}</p>
            <ChevronRight size={16} className="text-slate-300 shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          {/* Short description */}
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
            {exercise.shortDescription ?? exercise.description}
          </p>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {/* Difficulty */}
            {exercise.difficulty && (
              <span className={['text-[10px] font-semibold px-2 py-0.5 rounded-full', accent.pill].join(' ')}>
                {difficultyLabel[exercise.difficulty] ?? exercise.difficulty}
              </span>
            )}
            {/* Category */}
            {exercise.category && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {exercise.category}
              </span>
            )}
            {/* Primary muscle groups (max 2) */}
            {exercise.muscleGroups.slice(0, 2).map((m) => (
              <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-muted text-slate-500">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExerciseSelectionPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5 pt-1">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Exercises</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Choose an exercise to get started
        </p>
      </div>

      {/* ── Exercise cards ── */}
      <div className="space-y-3">
        {EXERCISE_LIBRARY.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onTap={() => navigate(`/exercises/${exercise.id}`)}
          />
        ))}
      </div>
    </div>
  )
}
