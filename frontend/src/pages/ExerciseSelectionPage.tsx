/**
 * ExerciseSelectionPage — enhanced exercise library with:
 *  - Animated cards with glassmorphism accents
 *  - Search & category filter
 *  - "Add Exercise" modal that uses AI (Gemini / OpenAI compatible) to generate
 *    instructions, common mistakes and AI monitors from just the exercise name.
 *  - Custom exercises persisted in localStorage and merged into the library.
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, Plus, X, Sparkles, Loader2, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { EXERCISE_LIBRARY } from '../features/exercise/exerciseLibrary'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'
import { PoseLandmark } from '../features/biomechanics/landmarkMapping'

// ── Custom-exercise storage key ───────────────────────────────────────────────
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

// ── Accent colours ────────────────────────────────────────────────────────────

const PRESET_ACCENTS: Record<string, { gradient: string; iconBg: string; text: string; pill: string }> = {
  squat: {
    gradient: 'linear-gradient(135deg, #bbf7d0 0%, #dcfce7 100%)',
    iconBg: 'bg-green-100',
    text: 'text-green-700',
    pill: 'bg-green-100 text-green-700',
  },
  pushup: {
    gradient: 'linear-gradient(135deg, #bfdbfe 0%, #dbeafe 100%)',
    iconBg: 'bg-blue-100',
    text: 'text-blue-700',
    pill: 'bg-blue-100 text-blue-700',
  },
  curl: {
    gradient: 'linear-gradient(135deg, #fde68a 0%, #fef3c7 100%)',
    iconBg: 'bg-amber-100',
    text: 'text-amber-700',
    pill: 'bg-amber-100 text-amber-700',
  },
}

const CUSTOM_ACCENTS = [
  { gradient: 'linear-gradient(135deg, #e9d5ff 0%, #f3e8ff 100%)', iconBg: 'bg-purple-100', text: 'text-purple-700', pill: 'bg-purple-100 text-purple-700' },
  { gradient: 'linear-gradient(135deg, #fecdd3 0%, #ffe4e6 100%)', iconBg: 'bg-rose-100', text: 'text-rose-700', pill: 'bg-rose-100 text-rose-700' },
  { gradient: 'linear-gradient(135deg, #a5f3fc 0%, #cffafe 100%)', iconBg: 'bg-cyan-100', text: 'text-cyan-700', pill: 'bg-cyan-100 text-cyan-700' },
  { gradient: 'linear-gradient(135deg, #fed7aa 0%, #ffedd5 100%)', iconBg: 'bg-orange-100', text: 'text-orange-700', pill: 'bg-orange-100 text-orange-700' },
  { gradient: 'linear-gradient(135deg, #d9f99d 0%, #ecfccb 100%)', iconBg: 'bg-lime-100', text: 'text-lime-700', pill: 'bg-lime-100 text-lime-700' },
]

function getAccent(id: string, index: number) {
  return PRESET_ACCENTS[id] ?? CUSTOM_ACCENTS[index % CUSTOM_ACCENTS.length]
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

function CustomSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 56" fill="none" className={className} aria-hidden="true">
      <circle cx="28" cy="9" r="5" fill="currentColor" opacity=".85" />
      <path d="M28 14v10M22 24h12M28 24v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 38l8 8 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ILLUSTRATIONS: Record<string, typeof SquatSVG> = {
  squat: SquatSVG,
  pushup: PushUpSVG,
  curl: CurlSVG,
}

const CATEGORIES = ['All', 'Strength', 'Mobility', 'Cardio', 'Custom']

const difficultyLabel: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

// ── AI exercise generator ─────────────────────────────────────────────────────

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

async function generateExerciseWithAI(exerciseName: string): Promise<AIGeneratedExercise> {
  const prompt = `You are a professional fitness coach and biomechanics expert.
Generate detailed exercise information for: "${exerciseName}"

Respond with ONLY a valid JSON object (no markdown, no code fences) in this exact schema:
{
  "description": "One sentence technical description",
  "shortDescription": "2-3 sentence engaging description for the user",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "category": "Strength" | "Mobility" | "Cardio",
  "muscleGroups": ["muscle1", "muscle2"],
  "instructions": ["Step 1...", "Step 2...", "Step 3...", "Step 4...", "Step 5..."],
  "commonMistakes": ["Mistake 1...", "Mistake 2...", "Mistake 3...", "Mistake 4..."],
  "aiMonitors": ["Joint/angle to monitor 1", "Joint/angle to monitor 2", "Joint/angle to monitor 3"]
}

Make instructions clear and actionable. Keep each step concise (max 15 words). 
Common mistakes should be practical warnings. AI monitors should describe specific body angles/alignments to track.`

  // Priority: VITE_ env var (build-time) → window._GEMINI_KEY (runtime console) → mock fallback.
  const geminiKey =
    (import.meta.env.VITE_GEMINI_KEY as string | undefined) ||
    ((window as unknown as Record<string, unknown>)._GEMINI_KEY as string | undefined)

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
        }),
      },
    )
    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    // Strip any accidental markdown fences
    const clean = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    return JSON.parse(clean) as AIGeneratedExercise
  }

  // ── Deterministic mock (no API key required) ──────────────────────────────
  await new Promise((r) => setTimeout(r, 1200)) // simulate network delay
  return buildMockExercise(exerciseName)
}

function buildMockExercise(name: string): AIGeneratedExercise {
  const n = name.toLowerCase()
  const isLower = n.includes('squat') || n.includes('lunge') || n.includes('leg') || n.includes('calf') || n.includes('deadlift')
  const isUpper = n.includes('press') || n.includes('curl') || n.includes('row') || n.includes('pull') || n.includes('dip') || n.includes('fly')
  const isCore  = n.includes('plank') || n.includes('crunch') || n.includes('sit') || n.includes('core') || n.includes('ab')
  const isCardio = n.includes('run') || n.includes('jump') || n.includes('burpee') || n.includes('cardio') || n.includes('hiit')

  const category: AIGeneratedExercise['category'] = isCardio ? 'Cardio' : isCore ? 'Strength' : 'Strength'
  const difficulty: AIGeneratedExercise['difficulty'] = n.includes('beginner') || n.includes('basic') ? 'beginner' : n.includes('advanced') || n.includes('heavy') ? 'advanced' : 'intermediate'

  const muscles = isLower
    ? ['Quadriceps', 'Hamstrings', 'Glutes', 'Core']
    : isUpper
    ? ['Chest', 'Shoulders', 'Triceps', 'Core']
    : isCore
    ? ['Core', 'Abdominals', 'Lower Back']
    : isCardio
    ? ['Full Body', 'Core', 'Cardiovascular System']
    : ['Core', 'Glutes', 'Shoulders']

  return {
    description: `A ${difficulty} ${category.toLowerCase()} exercise targeting ${muscles.slice(0, 2).join(' and ')}.`,
    shortDescription: `${name} is a highly effective ${category.toLowerCase()} movement. It builds functional strength and improves your ${muscles[0].toLowerCase()} and ${muscles[1]?.toLowerCase() ?? 'core'} performance. Ideal for ${difficulty} fitness levels.`,
    difficulty,
    category,
    muscleGroups: muscles,
    instructions: [
      `Set up in a stable starting position with feet shoulder-width apart.`,
      `Engage your core and maintain a neutral spine throughout the movement.`,
      `Perform the primary movement in a slow, controlled manner.`,
      `Pause briefly at the peak contraction and feel the target muscles working.`,
      `Return to the starting position with full control to complete one rep.`,
    ],
    commonMistakes: [
      `Rushing through the movement — prioritise control over speed.`,
      `Holding your breath — exhale on exertion, inhale on return.`,
      `Allowing form to break down as fatigue sets in — reduce reps if needed.`,
      `Using momentum instead of muscle strength to complete the rep.`,
    ],
    aiMonitors: [
      `Spine alignment and neutral posture throughout the movement`,
      `Shoulder symmetry — both sides moving evenly`,
      `Hip alignment and pelvic tilt during the exercise`,
    ],
  }
}

// ── Exercise card ─────────────────────────────────────────────────────────────

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

  return (
    <div className={`animate-fade-in-up ${stagger} relative`}>
      <button
        onClick={onTap}
        className={[
          'w-full rounded-2xl text-left overflow-hidden',
          'transition-transform duration-150 active:scale-[0.98]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        ].join(' ')}
        style={{
          boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}
        aria-label={`View details for ${exercise.name}`}
      >
        {/* Card background with gradient accent */}
        <div
          className="p-4"
          style={{
            background: accent.gradient,
          }}
        >
          <div className="flex items-start gap-4">
            {/* Illustration badge — glassmorphism */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(255,255,255,0.60)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.75)',
              }}
            >
              <Illustration className={['w-10 h-10', accent.text].join(' ')} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-900 text-base leading-tight">{exercise.name}</p>
                <ChevronRight size={16} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              </div>

              <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                {exercise.shortDescription ?? exercise.description}
              </p>

              {/* Tags row */}
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {exercise.difficulty && (
                  <span
                    className={['text-[10px] font-semibold px-2 py-0.5 rounded-full', accent.pill].join(' ')}
                    style={{ background: 'rgba(255,255,255,0.65)' }}
                  >
                    {difficultyLabel[exercise.difficulty] ?? exercise.difficulty}
                  </span>
                )}
                {exercise.category && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-slate-600"
                    style={{ background: 'rgba(255,255,255,0.65)' }}
                  >
                    {exercise.category}
                  </span>
                )}
                {exercise.muscleGroups.slice(0, 2).map((m) => (
                  <span
                    key={m}
                    className="text-[10px] px-2 py-0.5 rounded-full text-slate-500"
                    style={{ background: 'rgba(255,255,255,0.50)' }}
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

      {/* Delete button for custom exercises */}
      {isCustom && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          aria-label={`Delete ${exercise.name}`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

// ── Add Exercise Modal ────────────────────────────────────────────────────────

type ModalStep = 'input' | 'generating' | 'preview' | 'success'

interface AddExerciseModalProps {
  onClose: () => void
  onAdd: (exercise: ExerciseDefinition) => void
}

function AddExerciseModal({ onClose, onAdd }: AddExerciseModalProps) {
  const [step, setStep] = useState<ModalStep>('input')
  const [exerciseName, setExerciseName] = useState('')
  const [generated, setGenerated] = useState<AIGeneratedExercise | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'input') inputRef.current?.focus()
  }, [step])

  const handleGenerate = async () => {
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
  }

  const handleConfirmAdd = () => {
    if (!generated) return
    const id = `custom_${exerciseName.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`
    const exercise: ExerciseDefinition = {
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
      // Custom exercises use generic landmarks since we can't infer from name alone
      primaryAngles: [
        { name: 'leftShoulderAngle',  pointA: PoseLandmark.LEFT_ELBOW,  vertex: PoseLandmark.LEFT_SHOULDER,  pointC: PoseLandmark.LEFT_HIP },
        { name: 'rightShoulderAngle', pointA: PoseLandmark.RIGHT_ELBOW, vertex: PoseLandmark.RIGHT_SHOULDER, pointC: PoseLandmark.RIGHT_HIP },
      ],
      requiredLandmarks: [
        PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER,
        PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP,
      ],
    }
    onAdd(exercise)
    setStep('success')
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-lg animate-scale-in"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(32px)',
          borderRadius: '28px 28px 0 0',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center"
                style={{ boxShadow: '0 2px 8px rgba(139,92,246,0.35)' }}>
                <Sparkles size={15} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base leading-tight">Add Exercise</h2>
                <p className="text-[11px] text-slate-400">AI-powered rule generation</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
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
                  <input
                    ref={inputRef}
                    value={exerciseName}
                    onChange={(e) => setExerciseName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
                    placeholder="e.g. Romanian Deadlift, Plank, Jump Squat…"
                    className={[
                      'w-full px-4 py-3.5 rounded-2xl text-sm text-slate-900',
                      'border-2 border-slate-200 focus:border-primary focus:outline-none',
                      'transition-colors placeholder:text-slate-400',
                      'bg-white',
                    ].join(' ')}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Type any exercise name. Our AI will generate instructions, common mistakes, and form checkpoints automatically.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
                  <AlertCircle size={15} className="text-rose-500 shrink-0" />
                  <p className="text-xs text-rose-600">{error}</p>
                </div>
              )}

              {/* AI tip */}
              <div
                className="p-3 rounded-xl"
                style={{ background: 'linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)', border: '1px solid rgba(139,92,246,0.15)' }}
              >
                <div className="flex items-start gap-2">
                  <Sparkles size={13} className="text-violet-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-violet-700 leading-relaxed">
                    <strong>AI-powered:</strong> Rules, instructions & form checks are generated automatically from the exercise name using AI.
                    {!import.meta.env.VITE_GEMINI_KEY && !(window as unknown as Record<string, unknown>)._GEMINI_KEY && (
                      <> Set <code className="bg-white/60 px-1 rounded">VITE_GEMINI_KEY</code> in <code className="bg-white/60 px-1 rounded">.env.local</code> for live Gemini AI, or use the smart offline fallback.</>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!exerciseName.trim()}
                className={[
                  'w-full py-3.5 rounded-2xl font-bold text-sm transition-all',
                  'flex items-center justify-center gap-2',
                  exerciseName.trim()
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                ].join(' ')}
                style={exerciseName.trim() ? { boxShadow: '0 4px 14px rgba(139,92,246,0.35)' } : {}}
              >
                <Sparkles size={16} />
                Generate with AI
              </button>
            </div>
          )}

          {/* ── Step: Generating ── */}
          {step === 'generating' && (
            <div className="animate-fade-in flex flex-col items-center py-10 gap-4">
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  <Loader2 size={28} className="text-white animate-spin-slow" />
                </div>
                <div className="absolute -inset-2 rounded-full animate-pulse-glow"
                  style={{ background: 'rgba(139,92,246,0.15)' }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800">Generating exercise rules…</p>
                <p className="text-xs text-slate-400 mt-1">AI is analysing "{exerciseName}"</p>
              </div>
              <div className="w-full space-y-2">
                {['Instructions', 'Form checks', 'Common mistakes', 'Muscle groups'].map((item, i) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="animate-shimmer h-3 rounded-full flex-1" style={{ animationDelay: `${i * 0.15}s` }} />
                    <span className="text-[10px] text-slate-400 shrink-0">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && generated && (
            <div className="animate-fade-in-up space-y-4">
              {/* Exercise name badge */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{exerciseName}</p>
                  <p className="text-[11px] text-slate-400">{generated.category} · {difficultyLabel[generated.difficulty]}</p>
                </div>
              </div>

              {/* Description */}
              <div className="p-3 rounded-xl bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{generated.shortDescription}</p>
              </div>

              {/* Muscle groups */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Muscles</p>
                <div className="flex flex-wrap gap-1.5">
                  {generated.muscleGroups.map((m) => (
                    <span key={m} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-xl bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Instructions</p>
                <ol className="space-y-1.5">
                  {generated.instructions.map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-700 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* AI Monitors */}
              <div className="p-3 rounded-xl bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">AI Form Checks</p>
                <ul className="space-y-1.5">
                  {generated.aiMonitors.map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-xs text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Common mistakes */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Common Mistakes</p>
                <ul className="space-y-1.5">
                  {generated.commonMistakes.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                      <span className="text-xs text-amber-800">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setGenerated(null); setStep('input') }}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Re-generate
                </button>
                <button
                  onClick={handleConfirmAdd}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
                  }}
                >
                  <Plus size={15} />
                  Add Exercise
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Success ── */}
          {step === 'success' && (
            <div className="animate-scale-in flex flex-col items-center py-10 gap-4 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}
              >
                <CheckCircle2 size={30} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-lg">"{exerciseName}" Added!</p>
                <p className="text-sm text-slate-500 mt-1">Your custom exercise is ready to use.</p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-8 py-3 rounded-2xl font-bold text-white text-sm"
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  boxShadow: '0 4px 14px rgba(22,163,74,0.30)',
                }}
              >
                View Exercises
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
  const [activeCategory, setActiveCategory] = useState('All')
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
      const isCustom = ex.id.startsWith('custom_')
      const matchesCategory =
        activeCategory === 'All' ||
        (activeCategory === 'Custom' ? isCustom : ex.category === activeCategory)
      return matchesSearch && matchesCategory
    })
  }, [allExercises, searchQuery, activeCategory])

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

      {/* ── Header ── */}
      <div className="flex items-end justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Exercises</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {allExercises.length} exercises available
          </p>
        </div>
        {/* Add Exercise CTA */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 animate-bounce-soft"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow: '0 4px 14px rgba(109,40,217,0.35)',
          }}
          aria-label="Add custom exercise"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* ── Search bar ── */}
      <div
        className="relative animate-fade-in-up stagger-1"
      >
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search exercises, muscles…"
          className={[
            'w-full pl-10 pr-4 py-3 rounded-2xl text-sm text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-primary/40',
            'transition-all placeholder:text-slate-400',
          ].join(' ')}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(229,231,235,0.8)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Category filter pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 animate-fade-in-up stagger-2 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={[
              'shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
              activeCategory === cat
                ? 'text-white scale-105'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
            style={
              activeCategory === cat
                ? {
                    background: cat === 'Custom'
                      ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                      : 'linear-gradient(135deg, #16a34a, #15803d)',
                    boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                  }
                : {
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid rgba(229,231,235,0.8)',
                  }
            }
          >
            {cat}
          </button>
        ))}
      </div>

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
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Search size={22} className="text-slate-300" />
          </div>
          <p className="font-semibold text-slate-500">No exercises found</p>
          <p className="text-xs text-slate-400">Try a different search or category</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-1 px-5 py-2.5 rounded-2xl text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 14px rgba(109,40,217,0.30)',
            }}
          >
            <span className="flex items-center gap-1.5"><Sparkles size={14} /> Create "{searchQuery}" with AI</span>
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
