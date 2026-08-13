/**
 * ExerciseSelectionPage — enhanced exercise library with:
 *  - Hero banner with animated gradient, AI badge, live stats
 *  - Glassmorphism animated cards with hover/lift effects
 *  - Search & category filter with animated pills
 *  - "Add Exercise" modal with AI (Gemini) for instructions/rules/mistakes
 *  - Custom exercises persisted in localStorage, deletable
 *  - Confetti success animation on exercise added
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight, Search, Plus, X, Sparkles, Loader2,
  AlertCircle, CheckCircle2, Trash2, Zap, Brain, Target,
  Dumbbell, RotateCcw, ArrowRight,
} from 'lucide-react'
import { EXERCISE_LIBRARY } from '../features/exercise/exerciseLibrary'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'
import { inferExerciseConfig } from '../features/exercise/genericExerciseBridge'

// ── Custom-exercise storage ───────────────────────────────────────────────────
const CUSTOM_KEY = 'fitcoach_custom_exercises'

function loadCustomExercises(): ExerciseDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    return raw ? (JSON.parse(raw) as ExerciseDefinition[]) : []
  } catch {
    return []
  }
}

function saveCustomExercises(list: ExerciseDefinition[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list))
}

// ── Accent colour palette ─────────────────────────────────────────────────────

const PRESET_ACCENTS: Record<string, { gradient: string; glow: string; text: string; pill: string; border: string }> = {
  squat: {
    gradient: 'linear-gradient(135deg, #bbf7d0 0%, #dcfce7 60%, #f0fdf4 100%)',
    glow: 'rgba(22,163,74,0.18)',
    text: 'text-green-700',
    pill: 'bg-green-100 text-green-700',
    border: 'rgba(22,163,74,0.20)',
  },
  pushup: {
    gradient: 'linear-gradient(135deg, #bfdbfe 0%, #dbeafe 60%, #eff6ff 100%)',
    glow: 'rgba(59,130,246,0.18)',
    text: 'text-blue-700',
    pill: 'bg-blue-100 text-blue-700',
    border: 'rgba(59,130,246,0.20)',
  },
  curl: {
    gradient: 'linear-gradient(135deg, #fde68a 0%, #fef3c7 60%, #fffbeb 100%)',
    glow: 'rgba(245,158,11,0.18)',
    text: 'text-amber-700',
    pill: 'bg-amber-100 text-amber-700',
    border: 'rgba(245,158,11,0.20)',
  },
}

const CUSTOM_ACCENTS = [
  { gradient: 'linear-gradient(135deg, #e9d5ff 0%, #f3e8ff 60%, #faf5ff 100%)', glow: 'rgba(124,58,237,0.18)', text: 'text-purple-700', pill: 'bg-purple-100 text-purple-700', border: 'rgba(124,58,237,0.20)' },
  { gradient: 'linear-gradient(135deg, #fecdd3 0%, #ffe4e6 60%, #fff1f2 100%)', glow: 'rgba(244,63,94,0.18)',  text: 'text-rose-700',   pill: 'bg-rose-100 text-rose-700',     border: 'rgba(244,63,94,0.20)'  },
  { gradient: 'linear-gradient(135deg, #a5f3fc 0%, #cffafe 60%, #ecfeff 100%)', glow: 'rgba(6,182,212,0.18)',  text: 'text-cyan-700',   pill: 'bg-cyan-100 text-cyan-700',     border: 'rgba(6,182,212,0.20)'  },
  { gradient: 'linear-gradient(135deg, #fed7aa 0%, #ffedd5 60%, #fff7ed 100%)', glow: 'rgba(249,115,22,0.18)', text: 'text-orange-700', pill: 'bg-orange-100 text-orange-700', border: 'rgba(249,115,22,0.20)' },
  { gradient: 'linear-gradient(135deg, #d9f99d 0%, #ecfccb 60%, #f7fee7 100%)', glow: 'rgba(101,163,13,0.18)', text: 'text-lime-700',   pill: 'bg-lime-100 text-lime-700',     border: 'rgba(101,163,13,0.20)' },
]

function getAccent(id: string, index: number) {
  return PRESET_ACCENTS[id] ?? CUSTOM_ACCENTS[index % CUSTOM_ACCENTS.length]
}

// ── Inline SVG illustrations ──────────────────────────────────────────────────

function SquatSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="6" r="4" fill="currentColor" opacity=".9" />
      <path d="M20 10v9M14 14l6 5 6-5M12 24l-3 8M28 24l3 8M11 24h18"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 32h7M23 32h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function PushUpSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="7" r="4" fill="currentColor" opacity=".9" />
      <path d="M32 11v5L24 20H6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 20v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M2 28h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function CurlSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="6" r="4" fill="currentColor" opacity=".9" />
      <path d="M20 10v8M15 18l5 3 5-3M20 21l-4 12"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 33h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

function CustomSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="6" r="4" fill="currentColor" opacity=".9" />
      <path d="M20 10v20M10 20h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="10" cy="20" r="3" fill="currentColor" opacity=".5" />
      <circle cx="30" cy="20" r="3" fill="currentColor" opacity=".5" />
    </svg>
  )
}

const ILLUSTRATIONS: Record<string, typeof SquatSVG> = {
  squat: SquatSVG,
  pushup: PushUpSVG,
  curl: CurlSVG,
}

const CATEGORIES = ['All', 'Strength', 'Mobility', 'Cardio', 'Custom'] as const
type Category = typeof CATEGORIES[number]

const difficultyLabel: Record<string, string> = {
  beginner: '● Beginner',
  intermediate: '●● Intermediate',
  advanced: '●●● Advanced',
}

// ── AI Exercise types ─────────────────────────────────────────────────────────

interface AIGeneratedExercise {
  description: string
  shortDescription: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: 'Strength' | 'Mobility' | 'Cardio'
  muscleGroups: string[]
  instructions: string[]
  commonMistakes: string[]
  aiMonitors: string[]
}

// ── AI generation ─────────────────────────────────────────────────────────────

async function generateExerciseWithAI(exerciseName: string): Promise<AIGeneratedExercise> {
  const apiKey = import.meta.env.VITE_GEMINI_KEY as string | undefined
  const windowKey = (window as unknown as Record<string, unknown>)._GEMINI_KEY as string | undefined
  const key = apiKey ?? windowKey

  if (key && key.startsWith('AIzaSy')) {
    const prompt = `You are a professional fitness coach. Generate structured exercise data for "${exerciseName}".
Return ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{
  "description": "2-3 sentence detailed description",
  "shortDescription": "1 sentence summary under 80 chars",
  "difficulty": "beginner|intermediate|advanced",
  "category": "Strength|Mobility|Cardio",
  "muscleGroups": ["primary muscle", "secondary muscle", ...],
  "instructions": ["Step 1...", "Step 2...", ...],
  "commonMistakes": ["Mistake 1...", "Mistake 2...", ...],
  "aiMonitors": ["Form checkpoint 1...", "Form checkpoint 2...", ...]
}
Keep instructions to 5-7 steps, mistakes to 3-4 items, aiMonitors to 4-5 items.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      }
    )
    if (!res.ok) throw new Error(`Gemini API ${res.status}`)
    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error('No JSON in response')
    return JSON.parse(json) as AIGeneratedExercise
  }

  // Smart offline mock
  await new Promise((r) => setTimeout(r, 1400))
  return buildMockExercise(exerciseName)
}

function buildMockExercise(name: string): AIGeneratedExercise {
  const n = name.toLowerCase()
  const isLower = n.includes('squat') || n.includes('lunge') || n.includes('deadlift') || n.includes('leg')
  const isUpper = n.includes('press') || n.includes('curl') || n.includes('row') || n.includes('pull') || n.includes('push')
  const isCore  = n.includes('plank') || n.includes('crunch') || n.includes('sit') || n.includes('core') || n.includes('ab')
  const isCardio = n.includes('run') || n.includes('jump') || n.includes('burpee') || n.includes('sprint') || n.includes('cardio')

  const category: AIGeneratedExercise['category'] = isCardio ? 'Cardio' : 'Strength'
  const muscleGroups = isLower
    ? ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves']
    : isUpper
    ? ['Chest', 'Shoulders', 'Triceps', 'Biceps']
    : isCore
    ? ['Core', 'Rectus Abdominis', 'Obliques', 'Lower Back']
    : isCardio
    ? ['Full Body', 'Cardiovascular System', 'Legs', 'Core']
    : ['Full Body', 'Core', 'Legs', 'Shoulders']

  return {
    description: `${name} is a compound exercise that targets multiple muscle groups for strength and stability. It is commonly used in functional fitness programs to improve overall athletic performance and muscle coordination.`,
    shortDescription: `A compound movement targeting ${muscleGroups[0].toLowerCase()} and ${muscleGroups[1].toLowerCase()}.`,
    difficulty: 'intermediate',
    category,
    muscleGroups,
    instructions: [
      `Stand with feet shoulder-width apart, maintaining a neutral spine.`,
      `Engage your core and take a deep breath before initiating the movement.`,
      `Begin the ${name} motion by hinging at the appropriate joint for the movement.`,
      `Lower or move through the full range of motion with controlled tempo (2 seconds down).`,
      `Pause briefly at the end position, ensuring full muscle engagement.`,
      `Return to the starting position by reversing the movement under control.`,
      `Complete the desired number of reps (8-12 for strength, 15-20 for endurance).`,
    ],
    commonMistakes: [
      `Rounding the lower back — keep the spine neutral throughout the entire movement.`,
      `Using momentum instead of muscle control — slow down the eccentric (lowering) phase.`,
      `Not achieving full range of motion — work on mobility before adding load.`,
      `Holding breath — exhale on exertion (the hardest part of each rep).`,
    ],
    aiMonitors: [
      `Spine alignment — watch for forward lean or rounding`,
      `Knee tracking — knees should stay over toes, not cave inward`,
      `Hip symmetry — both sides should move evenly`,
      `Shoulder position — keep shoulders back and down, away from ears`,
      `Head position — neutral neck, eyes forward or slightly down`,
    ],
  }
}

// ── Exercise Card ─────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  index,
  isCustom,
  onTap,
  onDelete,
}: {
  exercise: ExerciseDefinition
  index: number
  isCustom: boolean
  onTap: () => void
  onDelete?: () => void
}) {
  const accent = getAccent(exercise.id, index)
  const Illustration = ILLUSTRATIONS[exercise.id] ?? CustomSVG
  const stagger = `stagger-${Math.min(index + 1, 6) as 1 | 2 | 3 | 4 | 5 | 6}`
  const [pressed, setPressed] = useState(false)

  return (
    <div className={`animate-fade-in-up ${stagger} relative`}>
      <button
        onClick={onTap}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        className="w-full rounded-2xl text-left overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{
          transform: pressed ? 'scale(0.975)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: pressed
            ? '0 2px 8px rgba(0,0,0,0.06)'
            : `0 4px 16px ${accent.glow}, 0 1px 4px rgba(0,0,0,0.06)`,
          border: `1px solid ${accent.border}`,
        }}
        aria-label={`View details for ${exercise.name}`}
      >
        <div className="p-4" style={{ background: accent.gradient }}>
          <div className="flex items-start gap-4">
            {/* Illustration badge */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(255,255,255,0.70)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.80)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <Illustration className={['w-10 h-10', accent.text].join(' ')} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-900 text-base leading-tight">{exercise.name}</p>
                <ChevronRight size={15} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              </div>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                {exercise.shortDescription ?? exercise.description}
              </p>

              {/* Tags row */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {exercise.difficulty && (
                  <span
                    className={['text-[10px] font-semibold px-2 py-0.5 rounded-full', accent.pill].join(' ')}
                    style={{ background: 'rgba(255,255,255,0.70)' }}
                  >
                    {difficultyLabel[exercise.difficulty] ?? exercise.difficulty}
                  </span>
                )}
                {exercise.category && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-slate-600"
                    style={{ background: 'rgba(255,255,255,0.70)' }}
                  >
                    {exercise.category}
                  </span>
                )}
                {exercise.muscleGroups.slice(0, 2).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-2 py-0.5 rounded-full text-slate-500"
                    style={{ background: 'rgba(255,255,255,0.55)' }}
                  >
                    {m}
                  </span>
                ))}
                {isCustom && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-purple-700"
                    style={{ background: 'rgba(233,213,255,0.80)' }}
                  >
                    ✦ Custom
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Delete button */}
      {isCustom && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
          style={{
            background: 'rgba(255,255,255,0.90)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
          }}
          aria-label={`Delete ${exercise.name}`}
        >
          <Trash2 size={12} className="text-slate-400 hover:text-rose-500 transition-colors" />
        </button>
      )}
    </div>
  )
}

// ── Confetti particle ─────────────────────────────────────────────────────────

function ConfettiPiece({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-sm pointer-events-none"
      style={{
        left: `${x}%`,
        top: '-10px',
        background: color,
        animation: `confettiFall 1.2s ease-in ${delay}s both`,
        transform: 'rotate(0deg)',
      }}
    />
  )
}

function SuccessConfetti() {
  const pieces = useMemo(() => {
    const colors = ['#16a34a', '#7c3aed', '#f59e0b', '#0ea5e9', '#f43f5e', '#22c55e', '#a855f7']
    return Array.from({ length: 18 }, (_, i) => ({
      delay: i * 0.06,
      x: 5 + (i * 5.5),
      color: colors[i % colors.length],
    }))
  }, [])
  return (
    <div className="absolute inset-x-0 top-0 h-32 overflow-hidden pointer-events-none">
      {pieces.map((p, i) => <ConfettiPiece key={i} {...p} />)}
    </div>
  )
}

// ── Add Exercise Modal ────────────────────────────────────────────────────────

type ModalStep = 'input' | 'generating' | 'preview' | 'success'

interface AddExerciseModalProps {
  onClose: () => void
  onAdd: (exercise: ExerciseDefinition) => void
}

const AI_LOADING_STEPS = [
  { icon: Brain, label: 'Analysing exercise biomechanics…' },
  { icon: Target, label: 'Generating form checkpoints…' },
  { icon: Zap, label: 'Writing instructions & mistakes…' },
  { icon: Sparkles, label: 'Finalising AI rules…' },
]

function AddExerciseModal({ onClose, onAdd }: AddExerciseModalProps) {
  const [step, setStep] = useState<ModalStep>('input')
  const [exerciseName, setExerciseName] = useState('')
  const [generated, setGenerated] = useState<AIGeneratedExercise | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step === 'input') inputRef.current?.focus()
  }, [step])

  // Cycle through loading substeps for visual feedback
  useEffect(() => {
    if (step === 'generating') {
      setLoadingStep(0)
      timerRef.current = setInterval(() => {
        setLoadingStep((prev) => Math.min(prev + 1, AI_LOADING_STEPS.length - 1))
      }, 400)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step])

  const handleGenerate = useCallback(async () => {
    const name = exerciseName.trim()
    if (!name) return
    setError(null)
    setStep('generating')
    try {
      const result = await generateExerciseWithAI(name)
      setGenerated(result)
      setStep('preview')
    } catch (err) {
      setError('AI generation failed. Please try again.')
      setStep('input')
      console.error(err)
    }
  }, [exerciseName])

  const handleConfirmAdd = useCallback(() => {
    if (!generated) return
    const id = `custom_${exerciseName.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
    // Build a stub exercise first to infer the correct landmark config
    const stub: ExerciseDefinition = {
      id,
      name: exerciseName.trim(),
      description: generated.description,
      shortDescription: generated.shortDescription,
      difficulty: generated.difficulty,
      category: generated.category as 'Strength' | 'Mobility' | 'Cardio',
      muscleGroups: generated.muscleGroups,
      instructions: generated.instructions,
      commonMistakes: generated.commonMistakes,
      aiMonitors: generated.aiMonitors,
      // Temporary placeholder — replaced below with inferred config
      primaryAngles: [],
      requiredLandmarks: [],
    }
    // Infer the correct body-region config so the engine can analyze this exercise
    const engineConfig = inferExerciseConfig(stub)
    const exercise: ExerciseDefinition = {
      ...stub,
      primaryAngles: engineConfig.primaryAngles,
      requiredLandmarks: engineConfig.requiredLandmarks,
    }
    onAdd(exercise)
    setStep('success')
  }, [exerciseName, generated, onAdd])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-lg animate-scale-in relative"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '92dvh',
          overflowY: 'auto',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.14)',
        }}
      >
        {/* Pull handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pb-safe-bottom" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
          {/* ── Modal header ── */}
          <div className="flex items-center justify-between py-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 3px 10px rgba(109,40,217,0.40)',
                }}
              >
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base leading-tight">Add Exercise</h2>
                <p className="text-[11px] text-slate-400">AI-powered rule generation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors active:scale-95"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Step: Input ── */}
          {step === 'input' && (
            <div className="animate-fade-in-up space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Exercise Name
                </label>
                <div className="relative">
                  <Dumbbell size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={inputRef}
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
                    placeholder="e.g. Romanian Deadlift, Plank, Jump Squat…"
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm text-slate-900 border-2 border-slate-200 focus:border-violet-400 focus:outline-none transition-colors placeholder:text-slate-400 bg-white"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Type any exercise name and AI will generate a complete workout plan with instructions, rules & form checks.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 animate-fade-in">
                  <AlertCircle size={15} className="text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-600">{error}</p>
                </div>
              )}

              {/* AI Info card */}
              <div
                className="p-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)',
                  border: '1px solid rgba(139,92,246,0.18)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                    <Brain size={14} className="text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-violet-800 mb-0.5">What AI generates:</p>
                    <ul className="space-y-0.5">
                      {['Step-by-step instructions', 'Common mistakes to avoid', 'Real-time form checkpoints', 'Target muscle groups'].map((item) => (
                        <li key={item} className="flex items-center gap-1.5 text-[11px] text-violet-700">
                          <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!exerciseName.trim()}
                className="w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                style={
                  exerciseName.trim()
                    ? {
                        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        boxShadow: '0 4px 16px rgba(109,40,217,0.40)',
                        color: 'white',
                      }
                    : { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }
                }
              >
                <Sparkles size={16} />
                Generate with AI
                {exerciseName.trim() && <ArrowRight size={15} />}
              </button>
            </div>
          )}

          {/* ── Step: Generating ── */}
          {step === 'generating' && (
            <div className="animate-fade-in flex flex-col items-center py-8 gap-5">
              {/* Spinning orb */}
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)',
                    boxShadow: '0 6px 24px rgba(109,40,217,0.45)',
                  }}
                >
                  <Loader2 size={32} className="text-white animate-spin-slow" />
                </div>
                {/* Glow ring */}
                <div
                  className="absolute -inset-3 rounded-full animate-pulse-glow pointer-events-none"
                  style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.20)' }}
                />
              </div>

              <div className="text-center">
                <p className="font-bold text-slate-800 text-base">Generating exercise rules…</p>
                <p className="text-xs text-slate-400 mt-1">AI is analysing <em>"{exerciseName}"</em></p>
              </div>

              {/* Animated substep list */}
              <div className="w-full space-y-2">
                {AI_LOADING_STEPS.map(({ icon: StepIcon, label }, i) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300"
                    style={{
                      background: i <= loadingStep ? 'rgba(139,92,246,0.08)' : 'transparent',
                      opacity: i <= loadingStep ? 1 : 0.35,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300"
                      style={{
                        background: i <= loadingStep ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f1f5f9',
                      }}
                    >
                      <StepIcon size={13} style={{ color: i <= loadingStep ? 'white' : '#94a3b8' }} />
                    </div>
                    <span className={`text-xs font-medium transition-colors duration-300 ${i <= loadingStep ? 'text-violet-700' : 'text-slate-400'}`}>
                      {label}
                    </span>
                    {i === loadingStep && (
                      <div className="ml-auto">
                        <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin-slow" />
                      </div>
                    )}
                    {i < loadingStep && (
                      <CheckCircle2 size={14} className="ml-auto text-violet-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && generated && (
            <div className="animate-fade-in-up space-y-3">
              {/* Exercise header card */}
              <div
                className="flex items-center gap-3 p-4 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)',
                  border: '1px solid rgba(124,58,237,0.15)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{exerciseName}</p>
                  <p className="text-[11px] text-slate-500">
                    {generated.category} · {difficultyLabel[generated.difficulty] ?? generated.difficulty}
                  </p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                    AI Generated
                  </span>
                </div>
              </div>

              {/* Short description */}
              <div className="p-3.5 rounded-2xl bg-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Overview</p>
                <p className="text-sm text-slate-700 leading-relaxed">{generated.shortDescription}</p>
              </div>

              {/* Muscles */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Muscles Targeted</p>
                <div className="flex flex-wrap gap-1.5">
                  {generated.muscleGroups.map((m) => (
                    <span key={m} className="text-[11px] font-semibold px-3 py-1 rounded-full bg-violet-50 text-violet-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-2xl bg-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Instructions</p>
                <ol className="space-y-2">
                  {generated.instructions.map((inst, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-700 leading-relaxed">{inst}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* AI Form Checks */}
              <div className="p-3.5 rounded-2xl bg-slate-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">AI Form Checks</p>
                <ul className="space-y-1.5">
                  {generated.aiMonitors.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Target size={11} className="text-primary shrink-0" />
                      <span className="text-xs text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Common Mistakes */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Common Mistakes</p>
                <ul className="space-y-1.5">
                  {generated.commonMistakes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-amber-800 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setGenerated(null); setStep('input') }}
                  className="flex-1 py-3.5 rounded-2xl text-sm font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} /> Re-generate
                </button>
                <button
                  onClick={handleConfirmAdd}
                  className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    boxShadow: '0 4px 16px rgba(22,163,74,0.40)',
                  }}
                >
                  <Plus size={15} /> Add Exercise
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Success ── */}
          {step === 'success' && (
            <div className="animate-scale-in flex flex-col items-center py-10 gap-4 text-center relative">
              <SuccessConfetti />
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center animate-glow-ring"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 6px 24px rgba(22,163,74,0.40)',
                }}
              >
                <CheckCircle2 size={36} className="text-white" />
              </div>
              <div>
                <p className="font-black text-slate-800 text-xl">Exercise Added! 🎉</p>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  <span className="font-semibold text-slate-700">"{exerciseName}"</span> is ready in your library.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-1 px-8 py-3.5 rounded-2xl font-bold text-white text-sm active:scale-[0.97] transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  boxShadow: '0 4px 16px rgba(22,163,74,0.35)',
                }}
              >
                View in Library
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExerciseSelectionPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('All')
  const [showModal, setShowModal] = useState(false)
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>(loadCustomExercises)

  // Merge built-in + custom
  const allExercises = useMemo(() => [...EXERCISE_LIBRARY, ...customExercises], [customExercises])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return allExercises.filter((ex) => {
      const matchesSearch =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.muscleGroups.some((m) => m.toLowerCase().includes(q)) ||
        (ex.category ?? '').toLowerCase().includes(q)
      const isCustomEx = ex.id.startsWith('custom_')
      const matchesCategory =
        activeCategory === 'All' ||
        (activeCategory === 'Custom' ? isCustomEx : ex.category === activeCategory)
      return matchesSearch && matchesCategory
    })
  }, [allExercises, searchQuery, activeCategory])

  const customCount = customExercises.length

  const handleAdd = (exercise: ExerciseDefinition) => {
    const updated = [...customExercises, exercise]
    setCustomExercises(updated)
    saveCustomExercises(updated)
  }

  const handleDelete = (id: string) => {
    const updated = customExercises.filter((ex) => ex.id !== id)
    setCustomExercises(updated)
    saveCustomExercises(updated)
  }

  return (
    <div className="space-y-4 pt-1">

      {/* ── Hero Banner ── */}
      <div
        className="rounded-3xl overflow-hidden relative animate-fade-in"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 40%, #4c1d95 100%)',
          boxShadow: '0 8px 32px rgba(109,40,217,0.30)',
        }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute top-4 right-20 w-16 h-16 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.04)' }} />

        <div className="relative px-5 py-5">
          {/* AI badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Sparkles size={11} className="text-violet-200" />
            <span className="text-[11px] font-bold text-violet-100 uppercase tracking-wide">AI Exercise Builder</span>
          </div>

          <h1 className="text-white text-2xl font-black leading-tight">
            Build Your<br />
            <span style={{ color: '#c4b5fd' }}>Exercise Library</span>
          </h1>
          <p className="text-violet-200/80 text-sm mt-1.5 leading-relaxed">
            {allExercises.length} exercises ready · Add custom ones with AI
          </p>

          {/* Stats row */}
          <div className="flex gap-3 mt-3.5">
            {[
              { value: String(EXERCISE_LIBRARY.length), label: 'Built-in' },
              { value: String(customCount), label: 'Custom' },
              { value: String(allExercises.length), label: 'Total' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex-1 rounded-2xl px-3 py-2 text-center"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <p className="text-white font-black text-lg tabular-nums leading-none">{value}</p>
                <p className="text-violet-200/70 text-[10px] font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm active:scale-[0.97] transition-transform"
            style={{
              background: 'rgba(255,255,255,0.95)',
              color: '#6d28d9',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Plus size={16} />
            Add with AI
            <Sparkles size={13} style={{ opacity: 0.7 }} />
          </button>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="relative animate-fade-in-up stagger-1">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises, muscles…"
          className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400"
          style={{
            background: 'rgba(255,255,255,0.90)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(229,231,235,0.8)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Category filter pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 animate-fade-in-up stagger-2 no-scrollbar">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 active:scale-95"
              style={
                active
                  ? {
                      background: cat === 'Custom'
                        ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                        : 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: 'white',
                      boxShadow: cat === 'Custom'
                        ? '0 2px 8px rgba(109,40,217,0.35)'
                        : '0 2px 8px rgba(22,163,74,0.30)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.90)',
                      backdropFilter: 'blur(8px)',
                      border: '1.5px solid rgba(229,231,235,0.8)',
                      color: '#64748b',
                    }
              }
            >
              {cat}
              {cat === 'Custom' && customCount > 0 && (
                <span
                  className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: active ? 'rgba(255,255,255,0.25)' : 'rgba(124,58,237,0.12)',
                    color: active ? 'white' : '#7c3aed',
                  }}
                >
                  {customCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Results count ── */}
      {(searchQuery || activeCategory !== 'All') && filtered.length > 0 && (
        <p className="text-xs text-slate-400 animate-fade-in px-0.5">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          {searchQuery && <> for <em className="text-slate-600 not-italic font-semibold">"{searchQuery}"</em></>}
        </p>
      )}

      {/* ── Exercise cards ── */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((exercise, i) => {
            const isCustom = exercise.id.startsWith('custom_')
            return (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                index={i}
                isCustom={isCustom}
                onTap={() => navigate(`/exercises/${exercise.id}`)}
                onDelete={isCustom ? () => handleDelete(exercise.id) : undefined}
              />
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 animate-fade-in gap-3 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(124,58,237,0.08)' }}
          >
            <Search size={24} className="text-violet-300" />
          </div>
          <p className="font-semibold text-slate-500">No exercises found</p>
          <p className="text-xs text-slate-400">Try a different search or create one with AI</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-1 px-5 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2 active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 14px rgba(109,40,217,0.35)',
            }}
          >
            <Sparkles size={14} />
            {searchQuery ? `Create "${searchQuery}" with AI` : 'Add New Exercise'}
          </button>
        </div>
      )}

      {/* ── Add Exercise Modal ── */}
      {showModal && (
        <AddExerciseModal
          onClose={() => setShowModal(false)}
          onAdd={(ex) => { handleAdd(ex) }}
        />
      )}
    </div>
  )
}
