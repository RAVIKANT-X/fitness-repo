/**
 * ExerciseSelectionPage — Phase 3.
 *
 * Displays the exercise library. When the user taps an exercise:
 *  1. The exercise is stored in ExerciseContext (useSelectedExercise).
 *  2. The user is navigated to /workout.
 *
 * Phase 3 scope: exercise selection + navigation only.
 * Angle calculations and form analysis → Phase 4.
 */

import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { EXERCISE_LIBRARY } from '../features/exercise/exerciseLibrary'
import { useSelectedExercise } from '../hooks/useSelectedExercise'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'

// ── Exercise category icons (inline SVG — no extra library) ──────────────────

function SquatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <circle cx="12" cy="3.5" r="1.5" />
      <path d="M12 5.5v4M9 7l3 2.5L15 7M9 14l-2 5M15 14l2 5M8 14h8" />
    </svg>
  )
}

function PushUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <circle cx="18" cy="4" r="1.5" />
      <path d="M18 5.5v3l-3 2H5M5 10.5v3" />
      <line x1="2" y1="13.5" x2="8" y2="13.5" />
    </svg>
  )
}

function CurlIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <circle cx="12" cy="3.5" r="1.5" />
      <path d="M12 5.5v4M9 9.5l3 1 3-1M12 10.5l-3 6" />
      <line x1="7" y1="19.5" x2="11" y2="19.5" />
    </svg>
  )
}

const exerciseIcons: Record<string, () => JSX.Element> = {
  squat: SquatIcon,
  pushup: PushUpIcon,
  curl: CurlIcon,
}

// ── Exercise card ─────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: ExerciseDefinition
  isSelected: boolean
  onSelect: (exercise: ExerciseDefinition) => void
}

function ExerciseCard({ exercise, isSelected, onSelect }: ExerciseCardProps) {
  const Icon = exerciseIcons[exercise.id] ?? SquatIcon

  return (
    <Card
      elevated={isSelected}
      className={[
        'cursor-pointer transition-all duration-150',
        isSelected
          ? 'ring-2 ring-primary border-transparent'
          : 'hover:shadow-card-md',
      ].join(' ')}
      onClick={() => onSelect(exercise)}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(exercise)
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Icon badge */}
          <div
            className={[
              'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors',
              isSelected ? 'bg-primary text-white' : 'bg-primary-light text-primary',
            ].join(' ')}
          >
            <Icon />
          </div>

          {/* Text */}
          <div>
            <p className="font-semibold text-slate-900">{exercise.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{exercise.description}</p>
            {/* Muscle groups */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {exercise.muscleGroups.slice(0, 3).map((m) => (
                <span
                  key={m}
                  className="text-[10px] bg-surface-muted text-slate-500 px-1.5 py-0.5 rounded-full"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Selection indicator */}
        <div className="shrink-0 ml-3">
          {isSelected ? (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <svg viewBox="0 0 12 12" fill="white" className="w-3 h-3" aria-hidden="true">
                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
          )}
        </div>
      </div>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ExerciseSelectionPage() {
  const navigate = useNavigate()
  const { selectedExercise, setSelectedExercise } = useSelectedExercise()

  const handleSelect = (exercise: ExerciseDefinition) => {
    setSelectedExercise(exercise)
  }

  const handleStart = () => {
    if (selectedExercise) {
      navigate('/workout')
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Choose an Exercise</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Select an exercise to begin your session
        </p>
      </div>

      {/* ── Exercise cards ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        {EXERCISE_LIBRARY.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isSelected={selectedExercise?.id === exercise.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* ── Angle info (Phase 3 detail) ──────────────────────────────────── */}
      {selectedExercise && (
        <Card className="bg-surface-muted">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            Tracked angles — {selectedExercise.name}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedExercise.primaryAngles.map((a) => (
              <span
                key={a.name}
                className="text-xs bg-primary-light text-primary-dark px-2 py-0.5 rounded-full font-medium"
              >
                {a.name}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {selectedExercise.requiredLandmarks.length} landmarks required for analysis
          </p>
        </Card>
      )}

      {/* ── Start CTA ────────────────────────────────────────────────────── */}
      <Button
        variant="primary"
        fullWidth
        disabled={!selectedExercise}
        onClick={handleStart}
      >
        {selectedExercise
          ? `Start ${selectedExercise.name}`
          : 'Select an exercise above'}
      </Button>

      {/* ── Phase notice ─────────────────────────────────────────────────── */}
      <Card className="border border-dashed border-slate-200 bg-surface-muted">
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Phase 3 — Biomechanics. Form analysis and rep counting arrive in Phase 4.
        </p>
      </Card>
    </div>
  )
}
