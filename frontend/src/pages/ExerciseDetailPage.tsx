/**
 * ExerciseDetailPage — /exercises/:id
 *
 * Shows a full briefing for one exercise before the user starts the camera:
 *   - Hero header with name, description, difficulty, and muscle groups
 *   - Step-by-step instructions
 *   - What the AI coach monitors
 *   - Common form mistakes
 *   - Start Exercise button (sets exercise context + navigates to /workout)
 *
 * All content is read from the exercise definition — no hard-coded strings here.
 * If the :id param doesn't match a known exercise, the user is redirected to /exercises.
 */

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Cpu, AlertTriangle, ChevronRight } from 'lucide-react'
import { getExerciseById } from '../features/exercise/exerciseLibrary'
import { useSelectedExercise } from '../hooks/useSelectedExercise'

const ACCENTS: Record<string, { iconBg: string; text: string; badgePill: string; headerBg: string }> = {
  squat:  {
    iconBg:    'bg-green-100',
    text:      'text-green-700',
    badgePill: 'bg-green-100 text-green-700',
    headerBg:  'bg-green-50',
  },
  pushup: {
    iconBg:    'bg-blue-100',
    text:      'text-blue-700',
    badgePill: 'bg-blue-100 text-blue-700',
    headerBg:  'bg-blue-50',
  },
  curl:   {
    iconBg:    'bg-amber-100',
    text:      'text-amber-700',
    badgePill: 'bg-amber-100 text-amber-700',
    headerBg:  'bg-amber-50',
  },
}

const difficultyLabel: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

// ── Inline SVG illustrations (larger, for the hero) ───────────────────────────

function SquatHero({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <circle cx="40" cy="12" r="7" fill="currentColor" opacity=".8" />
      <path d="M40 19v17M30 27l10 10 10-10M24 46l-6 13M56 46l6 13M22 46h36"
        stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 59h12M51 59h12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

function PushUpHero({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <circle cx="64" cy="15" r="7" fill="currentColor" opacity=".8" />
      <path d="M64 22v10L52 40H10"
        stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 40v13" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M4 53h14" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

function CurlHero({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <circle cx="40" cy="11" r="7" fill="currentColor" opacity=".8" />
      <path d="M40 18v13M32 31l8 4 8-4M40 35l-7 20"
        stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 60h12" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

const HERO_ILLUSTRATIONS: Record<string, typeof SquatHero> = {
  squat:  SquatHero,
  pushup: PushUpHero,
  curl:   CurlHero,
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setSelectedExercise } = useSelectedExercise()

  const exercise = id ? getExerciseById(id) : undefined

  // Redirect to library if exercise ID is unknown
  useEffect(() => {
    if (id && !exercise) {
      navigate('/exercises', { replace: true })
    }
  }, [id, exercise, navigate])

  if (!exercise) return null

  const accent = ACCENTS[exercise.id] ?? ACCENTS.squat
  const Hero = HERO_ILLUSTRATIONS[exercise.id] ?? SquatHero

  const handleStart = () => {
    setSelectedExercise(exercise)
    navigate(`/calibrate/${exercise.id}`)
  }

  return (
    <div className="pb-4">

      {/* ── Back navigation ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/exercises')}
        className="flex items-center gap-1.5 text-sm text-slate-500 font-medium mb-4 active:opacity-70 -ml-0.5 mt-1"
        aria-label="Back to exercises"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Exercises
      </button>

      {/* ── Hero card ───────────────────────────────────────────────── */}
      <div className={['rounded-2xl p-5 mb-5', accent.headerBg].join(' ')}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Difficulty + Category pills */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {exercise.difficulty && (
                <span className={['text-[11px] font-semibold px-2.5 py-0.5 rounded-full', accent.badgePill].join(' ')}>
                  {difficultyLabel[exercise.difficulty] ?? exercise.difficulty}
                </span>
              )}
              {exercise.category && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/70 text-slate-600">
                  {exercise.category}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 leading-tight">{exercise.name}</h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {exercise.shortDescription ?? exercise.description}
            </p>

            {/* Muscle groups */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {exercise.muscleGroups.map((m) => (
                <span key={m} className="text-xs px-2.5 py-0.5 rounded-full bg-white/70 text-slate-600 font-medium">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Hero illustration */}
          <div className={['w-20 h-20 rounded-2xl flex items-center justify-center shrink-0', accent.iconBg].join(' ')}>
            <Hero className={['w-14 h-14', accent.text].join(' ')} />
          </div>
        </div>
      </div>

      {/* ── Content sections ────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Instructions */}
        {exercise.instructions && exercise.instructions.length > 0 && (
          <Section
            title="How to perform"
            icon={
              <div className="w-6 h-6 rounded-lg bg-primary-light flex items-center justify-center">
                <ChevronRight size={14} className="text-primary" aria-hidden="true" />
              </div>
            }
          >
            <ol className="space-y-3">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* AI monitors */}
        {exercise.aiMonitors && exercise.aiMonitors.length > 0 && (
          <Section
            title="AI form checks"
            icon={
              <div className="w-6 h-6 rounded-lg bg-primary-light flex items-center justify-center">
                <Cpu size={13} className="text-primary" aria-hidden="true" />
              </div>
            }
          >
            <ul className="space-y-2">
              {exercise.aiMonitors.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span className="text-sm text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              The AI coach analyses joint angles from your camera feed in real time.
              It does not provide medical assessment or rehabilitation guidance.
            </p>
          </Section>
        )}

        {/* Common mistakes */}
        {exercise.commonMistakes && exercise.commonMistakes.length > 0 && (
          <Section
            title="Common mistakes"
            icon={
              <div className="w-6 h-6 rounded-lg bg-warning/15 flex items-center justify-center">
                <AlertTriangle size={13} className="text-warning" aria-hidden="true" />
              </div>
            }
          >
            <ul className="space-y-2">
              {exercise.commonMistakes.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 mt-2" />
                  <span className="text-sm text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

      </div>

      {/* ── Start button ─────────────────────────────────────────────── */}
      <div className="mt-6">
        <button
          onClick={handleStart}
          className="w-full bg-primary text-white font-bold text-base rounded-2xl py-4 active:bg-primary-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark min-h-[56px]"
          aria-label={`Start ${exercise.name}`}
        >
          Learn &amp; Calibrate
        </button>
        <p className="text-xs text-slate-400 text-center mt-3 leading-relaxed px-4">
          You'll be guided through {exercise.instructions?.length ?? 'a few'} key positions
          before the live workout begins.
        </p>
      </div>

    </div>
  )
}
