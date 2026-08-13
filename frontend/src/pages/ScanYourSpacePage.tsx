/**
 * ScanYourSpacePage — click a photo or upload one, then get AI coaching.
 *
 * ── User flow ──────────────────────────────────────────────────────────────────
 *  1. Landing screen — two options:
 *       [📷 Take Photo]   opens camera live preview
 *       [🖼 Upload Photo] opens native file picker
 *  2. Camera mode: full-screen live preview with a large shutter button
 *       • Human validation still runs (pose model)
 *       • Camera-switch button top-right
 *       • Tap shutter → captures frame → Gemini analyse
 *  3. Upload mode: user picks image → preview → Gemini analyse
 *  4. Analysing: pulsing overlay while waiting for Gemini
 *  5. Result: score header + swipeable flashcard deck (5–8 cards)
 *       • Each card: category badge, headline, detail, action pill
 *       • Swipe left/right or tap arrows
 *       • Bottom progress dots
 *  6. Actions: "Rescan", "Try Exercise", "Share"
 *
 * Preserved from original:
 *   HumanValidation, TTS voice coach, camera switch, pose skeleton,
 *   multiple-human rejection, activity detection, on-device posture tracking.
 */

import { useRef, useEffect, useState, useCallback, useMemo, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Volume2, VolumeX, Camera, ScanLine,
  RotateCcw, CheckCircle, AlertTriangle, Sparkles,
  Loader2, ChevronLeft, ChevronRight, Upload, Image,
  Zap,
} from 'lucide-react'
import { useCamera }          from '../hooks/useCamera'
import { usePoseLandmarker }  from '../hooks/usePoseLandmarker'
import { useVoiceCoach }      from '../hooks/useVoiceCoach'
import {
  validateHumanScene,
  ValidationSmoother,
  getValidationTtsMessage,
} from '../features/camera/humanValidation'
import HumanValidationOverlay from '../components/workout/HumanValidationOverlay'
import CameraSwitchButton from '../components/workout/CameraSwitchButton'
import { analyseWorkspaceFrame } from '../services/geminiVision'
import { analysePosture }        from '../features/scanSpace/postureAnalysis'
import { recogniseActivity, resetActivitySmoother } from '../features/scanSpace/activityRecognition'
import { PostureCoach }          from '../features/scanSpace/postureCoach'
import { SmartBreakTracker }     from '../features/scanSpace/smartBreak'
import { recordPostureFrame, recordBreak } from '../features/scanSpace/postureDataStore'
import { EXERCISE_LIBRARY }      from '../features/exercise/exerciseLibrary'
import { useSelectedExercise }   from '../hooks/useSelectedExercise'
import type { GeminiScanResult, FlashTip } from '../services/geminiVision'

// ── Constants ─────────────────────────────────────────────────────────────────

const ANALYSIS_EVERY_N   = 4
const CAPTURE_QUALITY    = 0.82
const MAX_CAPTURE_DIM    = 768

// ── Frame capture helpers ─────────────────────────────────────────────────────

function captureFrameFromVideo(
  video: HTMLVideoElement,
  mirrored: boolean,
  quality = CAPTURE_QUALITY,
): string {
  const vw = video.videoWidth  || 640
  const vh = video.videoHeight || 480
  const scale = Math.min(1, MAX_CAPTURE_DIM / Math.max(vw, vh))
  const cw = Math.round(vw * scale)
  const ch = Math.round(vh * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  if (mirrored) {
    ctx.translate(cw, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0, cw, ch)
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '')
}

function fileToBase64Jpeg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, MAX_CAPTURE_DIM / Math.max(img.width, img.height))
      const cw = Math.round(img.width  * scale)
      const ch = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width  = cw
      canvas.height = ch
      canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', CAPTURE_QUALITY)
      resolve(dataUrl.replace(/^data:image\/jpeg;base64,/, ''))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load selected image.'))
    }
    img.src = url
  })
}

// ── Phase type ─────────────────────────────────────────────────────────────────

type ScanPhase =
  | 'idle'        // landing screen
  | 'camera'      // live camera preview (manual shutter)
  | 'preview'     // uploaded image preview
  | 'analysing'   // Gemini in-flight
  | 'result'      // flashcard deck shown
  | 'error'

// ── Flashcard category meta ───────────────────────────────────────────────────

const CATEGORY_META: Record<FlashTip['category'], { label: string; color: string; bg: string; icon: string }> = {
  posture:     { label: 'POSTURE',    color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',   icon: '🦴' },
  space:       { label: 'WORKSPACE',  color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: '📐' },
  activity:    { label: 'ACTIVITY',   color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: '⚡' },
  'quick-win': { label: 'QUICK WIN',  color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  icon: '⚡' },
}

const SEVERITY_META: Record<FlashTip['severity'], { icon: string; accent: string }> = {
  good:    { icon: '✓', accent: '#34d399' },
  warning: { icon: '⚠', accent: '#fbbf24' },
  tip:     { icon: '💡', accent: '#38bdf8' },
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r    = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size < 56 ? 12 : 17} fontWeight="800">{score}</text>
    </svg>
  )
}

// ── Glass panel ───────────────────────────────────────────────────────────────

function GlassPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl p-4 ${className}`}
      style={{
        background:           'rgba(8,12,28,0.82)',
        backdropFilter:       'blur(28px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
        border:               '1px solid rgba(255,255,255,0.11)',
        boxShadow:            '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      {children}
    </div>
  )
}

// ── Swipeable flashcard deck ──────────────────────────────────────────────────

function FlashcardDeck({ tips, onDone }: { tips: FlashTip[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const startXRef = useRef<number | null>(null)
  const isDragging = useRef(false)

  const tip = tips[idx]
  if (!tip) return null

  const meta     = CATEGORY_META[tip.category]
  const sevMeta  = SEVERITY_META[tip.severity]
  const isFirst  = idx === 0
  const isLast   = idx === tips.length - 1

  const prev = () => setIdx((i) => Math.max(0, i - 1))
  const next = () => {
    if (isLast) { onDone(); return }
    setIdx((i) => Math.min(tips.length - 1, i + 1))
  }

  // Touch/mouse swipe
  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    isDragging.current = true
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current || startXRef.current === null) return
    const dx = e.changedTouches[0].clientX - startXRef.current
    isDragging.current = false
    startXRef.current = null
    if (dx < -40) next()
    else if (dx > 40) prev()
  }
  const onMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX
    isDragging.current = true
  }
  const onMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current || startXRef.current === null) return
    const dx = e.clientX - startXRef.current
    isDragging.current = false
    startXRef.current = null
    if (dx < -40) next()
    else if (dx > 40) prev()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none">

      {/* ── Card area ─────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
      >
        {/* The card itself */}
        <div
          className="flex-1 rounded-3xl flex flex-col justify-between overflow-hidden"
          key={idx}
          style={{
            background: meta.bg,
            border: `1px solid ${meta.color}40`,
            animation: 'fadeInUp 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          {/* Card top */}
          <div className="px-5 pt-5">
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg leading-none">{meta.icon}</span>
              <span
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
              <span className="ml-auto text-base leading-none">{sevMeta.icon}</span>
            </div>

            {/* Headline */}
            <h2
              className="text-2xl font-black leading-tight mb-3"
              style={{ color: 'rgba(255,255,255,0.96)' }}
            >
              {tip.headline}
            </h2>

            {/* Detail */}
            <p className="text-white/70 text-sm leading-relaxed">
              {tip.detail}
            </p>
          </div>

          {/* Card bottom — action pill */}
          <div className="px-5 pb-5 pt-4">
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: `${meta.color}22`,
                border: `1px solid ${meta.color}55`,
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-1"
                style={{ color: meta.color }}
              >
                Do this now
              </p>
              <p className="text-white font-semibold text-sm leading-snug">
                {tip.action}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation row ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pb-2">
        <button
          onClick={prev}
          disabled={isFirst}
          aria-label="Previous tip"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <ChevronLeft size={20} className="text-white" />
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {tips.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Tip ${i + 1}`}
              className="transition-all duration-200 rounded-full"
              style={{
                width:   i === idx ? '20px' : '6px',
                height:  '6px',
                background: i === idx
                  ? CATEGORY_META[tips[i].category].color
                  : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          aria-label={isLast ? 'Finish' : 'Next tip'}
          className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          {isLast
            ? <CheckCircle size={20} className="text-emerald-400" />
            : <ChevronRight size={20} className="text-white" />}
        </button>
      </div>

      {/* Swipe hint — only on first card */}
      {idx === 0 && (
        <p className="text-center text-white/25 text-[10px] pb-2 font-medium tracking-wide">
          Swipe or tap arrows to browse tips
        </p>
      )}
    </div>
  )
}

// ── Landing screen ────────────────────────────────────────────────────────────

function LandingScreen({
  onCamera,
  onUpload,
  fileInputId,
}: {
  onCamera: () => void
  onUpload: (file: File) => void
  fileInputId: string
}) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
    e.target.value = ''
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-7 overflow-y-auto">
      {/* Hero */}
      <div className="text-center">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}
        >
          <ScanLine size={36} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-1">Scan Your Space</h1>
        <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
          Take a photo of yourself at your activity — FitCoach AI will give you
          personalised posture tips as swipeable cards.
        </p>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={onCamera}
          className="w-full flex items-center justify-center gap-3 bg-primary text-white font-black rounded-2xl px-6 py-4 text-base active:bg-primary-dark transition-all shadow-card"
        >
          <Camera size={22} />
          Take a Photo
        </button>

        <label
          htmlFor={fileInputId}
          className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 text-slate-700 font-bold rounded-2xl px-6 py-4 text-base active:bg-slate-50 transition-all cursor-pointer"
        >
          <Upload size={20} className="text-slate-500" />
          Upload a Photo
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFile}
          />
        </label>
      </div>

      {/* How it works */}
      <div className="w-full max-w-xs space-y-2.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">How it works</p>
        {[
          { icon: '📷', text: 'Capture yourself at your desk, gaming setup, or any activity' },
          { icon: '🤖', text: 'Gemini Vision AI analyses your posture & workspace' },
          { icon: '🃏', text: 'Get 5–8 personalised coaching cards to swipe through' },
          { icon: '⚡', text: 'Each card has a specific action to do right now' },
          { icon: '🔒', text: 'Only one photo is sent — no continuous upload' },
        ].map((item) => (
          <div key={item.text} className="flex items-start gap-3 text-sm text-slate-600">
            <span className="text-base w-6 text-center shrink-0 mt-0.5">{item.icon}</span>
            <span className="leading-snug">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Analysing overlay ─────────────────────────────────────────────────────────

function AnalysingOverlay({ imageSrc }: { imageSrc?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-30"
      style={{ background: 'rgba(5,8,20,0.88)', backdropFilter: 'blur(8px)' }}>
      {imageSrc && (
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden mb-1">
          <img src={imageSrc} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 border-2 border-sky-400/60 rounded-2xl animate-ping" />
        </div>
      )}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-20 h-20 rounded-full border-2 border-sky-400/30 animate-ping" />
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(14,165,233,0.15)', border: '2px solid rgba(14,165,233,0.4)' }}>
          <Sparkles size={24} className="text-sky-300" />
        </div>
      </div>
      <div className="text-center px-8">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Loader2 size={16} className="text-sky-400 animate-spin" />
          <p className="text-white font-bold text-sm">Analysing your photo…</p>
        </div>
        <p className="text-white/40 text-xs">Gemini Vision AI is reviewing the image</p>
      </div>
    </div>
  )
}

// ── Result screen ─────────────────────────────────────────────────────────────

function ResultScreen({
  result,
  imageSrc,
  onRescan,
  onSelectExercise,
}: {
  result:           GeminiScanResult
  imageSrc:         string
  onRescan:         () => void
  onSelectExercise: (id: string) => void
}) {
  const [showDeck, setShowDeck] = useState(true)
  const [deckDone, setDeckDone] = useState(false)
  const exercises = EXERCISE_LIBRARY.filter((ex) => ['squat', 'pushup', 'curl'].includes(ex.id))

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-950">

      {/* ── Score header ────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pt-3 pb-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Thumbnail */}
        <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 border border-white/10">
          <img src={imageSrc} alt="Scanned photo" className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest leading-none mb-0.5">
            AI Coaching
          </p>
          <p className="text-white font-bold text-sm leading-snug line-clamp-2">
            {result.detectedActivity}
          </p>
          <p className="text-white/40 text-[10px] mt-0.5">
            {result.flashTips.length} personalised tips
          </p>
        </div>

        <ScoreRing score={result.postureScore} size={54} />
      </div>

      {/* ── Top action banner ───────────────────────────────────────── */}
      {result.topAction && (
        <div
          className="mx-4 mt-3 rounded-2xl px-4 py-3 flex items-start gap-2.5 flex-shrink-0"
          style={{
            background: 'rgba(14,165,233,0.14)',
            border:     '1px solid rgba(14,165,233,0.30)',
          }}
        >
          <Zap size={14} className="text-sky-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest mb-0.5">
              Most Important Right Now
            </p>
            <p className="text-white text-xs font-semibold leading-snug">
              {result.topAction}
            </p>
          </div>
        </div>
      )}

      {/* ── Toggle: flashcards ↔ exercises ─────────────────────────── */}
      {deckDone && (
        <div className="flex gap-1.5 mx-4 mt-3 flex-shrink-0">
          <button
            onClick={() => { setShowDeck(true); setDeckDone(false) }}
            className={[
              'flex-1 py-2 rounded-xl text-[11px] font-bold transition-colors',
              showDeck ? 'bg-sky-500/25 text-sky-300' : 'bg-white/5 text-white/40',
            ].join(' ')}
          >
            🃏 Tips
          </button>
          <button
            onClick={() => setShowDeck(false)}
            className={[
              'flex-1 py-2 rounded-xl text-[11px] font-bold transition-colors',
              !showDeck ? 'bg-emerald-500/25 text-emerald-300' : 'bg-white/5 text-white/40',
            ].join(' ')}
          >
            🏋 Exercises
          </button>
        </div>
      )}

      {/* ── Flashcard deck ──────────────────────────────────────────── */}
      {showDeck && result.flashTips.length > 0 && (
        <FlashcardDeck
          tips={result.flashTips}
          onDone={() => setDeckDone(true)}
        />
      )}

      {/* ── Empty tip state ─────────────────────────────────────────── */}
      {showDeck && result.flashTips.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <CheckCircle size={36} className="text-emerald-400" />
          <p className="text-white font-bold">Great posture detected!</p>
          <p className="text-white/50 text-sm">{result.summary}</p>
        </div>
      )}

      {/* ── Exercise list (after swiping all cards) ──────────────────── */}
      {!showDeck && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-2">
          <p className="text-white/40 text-[11px] mb-3 font-semibold uppercase tracking-wide">
            Micro-workouts to do at your desk
          </p>
          {exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onSelectExercise(ex.id)}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 text-left active:bg-white/10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-emerald-400 text-base">🏋</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{ex.name}</p>
                <p className="text-white/40 text-[10px]">{ex.muscleGroups[0]}</p>
              </div>
              <ChevronRight size={14} className="text-white/30 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* ── Bottom actions ───────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex gap-2 px-4 pt-2 pb-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <button
          onClick={onRescan}
          className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold active:bg-white/10 transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.70)' }}
        >
          <RotateCcw size={15} />
          New Scan
        </button>
      </div>
    </div>
  )
}

// ── Error overlay ─────────────────────────────────────────────────────────────

function ErrorOverlay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-24 px-6 pointer-events-none z-30">
      <GlassPanel className="w-full max-w-sm pointer-events-auto">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <p className="text-white font-semibold text-sm">Scan failed</p>
        </div>
        <p className="text-white/60 text-xs leading-relaxed mb-4">{message}</p>
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white font-bold text-sm rounded-2xl py-3 active:bg-sky-600"
        >
          <RotateCcw size={14} />
          Try Again
        </button>
      </GlassPanel>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScanYourSpacePage() {
  const navigate           = useNavigate()
  const { setSelectedExercise } = useSelectedExercise()
  const fileInputId        = useId()

  // Camera + pose
  const camera    = useCamera()
  const poser     = usePoseLandmarker()
  const voice     = useVoiceCoach()
  const canvasRef = useRef<HTMLCanvasElement>(null!)

  // Page state
  const [phase, setPhase]           = useState<ScanPhase>('idle')
  const [geminiResult, setGeminiResult] = useState<GeminiScanResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  // The image sent to Gemini / shown as thumbnail
  const [previewSrc, setPreviewSrc] = useState<string>('')

  // On-device tracking
  const validationSmoother = useMemo(() => new ValidationSmoother(), [])
  const coach        = useMemo(() => new PostureCoach(), [])
  const breakTracker = useMemo(() => new SmartBreakTracker(), [])
  const frameCount   = useRef(0)
  const lastFrameMs  = useRef(Date.now())
  const poseLoopStartedRef = useRef(false)
  const lastSpokenSceneStatus = useRef<string>('')

  // ── Step 1: user taps "Take Photo" ─────────────────────────────────────────
  // We ONLY flip the phase here.  The camera.start() call lives in the effect
  // below so it always runs AFTER the <video> element is mounted in the DOM.
  const handleGoCamera = useCallback(() => {
    poseLoopStartedRef.current = false
    setPhase('camera')
  }, [])

  // ── Start camera once phase flips to 'camera' AND videoRef is in the DOM ──
  useEffect(() => {
    if (phase !== 'camera') return
    if (camera.status === 'requesting' || camera.status === 'active') return
    // videoRef is now attached because the camera-mode render branch is active
    camera.start('user')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Step 2: user taps "Upload Photo" ───────────────────────────────────────
  const handleUpload = useCallback(async (file: File) => {
    setPhase('analysing')
    setPreviewSrc(URL.createObjectURL(file))
    try {
      const b64 = await fileToBase64Jpeg(file)
      const dataUri = `data:image/jpeg;base64,${b64}`
      setPreviewSrc(dataUri)
      const result = await analyseWorkspaceFrame(b64)
      if (result.analysisStatus === 'invalid_human_scene') {
        setErrorMsg('Could not detect a single person in the photo. Please try a clearer photo.')
        setPhase('error')
        return
      }
      setGeminiResult(result)
      setPhase('result')
      if (voice.enabled && result.topAction) voice.speak(result.topAction, true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }, [voice])

  // ── Camera becomes active in camera mode → start pose loop ─────────────────
  // Also re-triggers when camera.facing changes (camera switch) by resetting
  // poseLoopStartedRef so the loop restarts on the new stream.
  useEffect(() => {
    if (!camera.isActive || phase !== 'camera') return
    // Reset the started-flag whenever the facing changes so we restart the loop
    // on the new camera stream (happens after camera switch).
    poseLoopStartedRef.current = false
  }, [camera.facing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      camera.isActive &&
      camera.videoRef.current &&
      canvasRef.current &&
      poser.modelStatus === 'ready' &&
      !poseLoopStartedRef.current &&
      phase === 'camera'
    ) {
      poseLoopStartedRef.current = true
      poser.startLoop(camera.videoRef.current, canvasRef.current, camera.facing)
    }
  }, [camera.isActive, camera.facing, poser.modelStatus, poser, camera.videoRef, phase])

  // ── On-device analysis loop (camera mode only) ──────────────────────────────
  useEffect(() => {
    if (phase !== 'camera') return

    frameCount.current++
    if (frameCount.current % ANALYSIS_EVERY_N !== 0) return

    const now     = Date.now()
    const deltaMs = now - lastFrameMs.current
    lastFrameMs.current = now

    const rawScene = validateHumanScene(poser.poses)
    const scene    = validationSmoother.update(rawScene)

    if (voice.enabled) {
      const tts = getValidationTtsMessage(scene.status)
      if (tts && tts !== lastSpokenSceneStatus.current) {
        lastSpokenSceneStatus.current = tts
        voice.speak(tts)
      }
    }

    if (scene.canProceed) {
      const landmarks = poser.poses[0]?.landmarks ?? []
      const act       = recogniseActivity(landmarks)
      const isSitting = act.activity === 'DESK_SITTING' || act.activity === 'READING'
      const posture   = isSitting ? analysePosture(landmarks) : null
      breakTracker.update(isSitting, posture?.overallScore ?? 0)
      recordPostureFrame(posture?.overallScore ?? 0, isSitting, deltaMs, null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poser.poses, phase])

  // ── Shutter: user taps the capture button in camera mode ───────────────────
  const handleShutter = useCallback(async () => {
    const video = camera.videoRef.current
    if (!video) return

    // Capture frame
    const mirrored = camera.facing === 'user'
    const b64  = captureFrameFromVideo(video, mirrored)
    const dataUri = `data:image/jpeg;base64,${b64}`
    setPreviewSrc(dataUri)

    // Stop live camera before analysing
    camera.stop()
    poser.stopLoop()
    setPhase('analysing')

    try {
      const result = await analyseWorkspaceFrame(b64)
      if (result.analysisStatus === 'invalid_human_scene') {
        setErrorMsg('Could not detect a single person. Make sure you are clearly visible.')
        setPhase('error')
        return
      }
      setGeminiResult(result)
      setPhase('result')
      if (voice.enabled && result.topAction) voice.speak(result.topAction, true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
      setPhase('error')
    }
  }, [camera, poser, voice])

  // ── Rescan ─────────────────────────────────────────────────────────────────
  const handleRescan = useCallback(() => {
    poseLoopStartedRef.current = false
    validationSmoother.reset()
    lastSpokenSceneStatus.current = ''
    setGeminiResult(null)
    setErrorMsg(null)
    setPreviewSrc('')
    setPhase('idle')
    camera.stop()
    poser.stopLoop()
  }, [validationSmoother, camera, poser])

  // ── Navigate to exercise ───────────────────────────────────────────────────
  const handleSelectExercise = useCallback((id: string) => {
    const ex = EXERCISE_LIBRARY.find((e) => e.id === id)
    if (!ex) return
    setSelectedExercise(ex)
    camera.stop()
    poser.stopLoop()
    navigate(`/exercises/${id}`)
  }, [navigate, camera, poser, setSelectedExercise])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      poser.stopLoop()
      camera.stop()
      coach.reset()
      breakTracker.reset()
      resetActivitySmoother()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Break handler (future use) ─────────────────────────────────────────────
  const handleTakeBreak = useCallback(() => { recordBreak(); breakTracker.takeBreak() }, [breakTracker])
  void handleTakeBreak

  // ── RENDER ─────────────────────────────────────────────────────────────────

  // ── IDLE — landing screen ──────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="camera-page bg-background overflow-y-auto">
        <LandingScreen
          onCamera={handleGoCamera}
          onUpload={handleUpload}
          fileInputId={fileInputId}
        />
      </div>
    )
  }

  // ── RESULT — swipeable flashcard deck ──────────────────────────────────────
  if (phase === 'result' && geminiResult) {
    return (
      <div className="camera-page bg-slate-950">
        <ResultScreen
          result={geminiResult}
          imageSrc={previewSrc}
          onRescan={handleRescan}
          onSelectExercise={handleSelectExercise}
        />
        {/* Reserve space for BottomNav */}
        <div className="camera-controls" style={{ paddingTop: 0 }} />
      </div>
    )
  }

  // ── CAMERA mode — live preview with manual shutter ─────────────────────────
  const isMirrored = camera.facing === 'user'

  const cameraErrorHeading = (() => {
    const name = camera.error?.name ?? ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Camera Permission Required'
    if (name === 'NotFoundError'   || name === 'DevicesNotFoundError')  return 'No Camera Found'
    if (name === 'NotReadableError'|| name === 'TrackStartError')       return 'Camera Busy'
    if (name === 'SecurityError')                                        return 'Camera Access Blocked'
    if (name === 'TimeoutError')                                         return 'Camera Could Not Start'
    return 'Camera Unavailable'
  })()

  const rawSceneForRender   = validateHumanScene(poser.poses)
  const humanSceneForRender = validationSmoother.update(rawSceneForRender)

  return (
    <div className="camera-page bg-slate-950">
      <div className="camera-section">

        {/* ── Live video ──────────────────────────────────────────────── */}
        <video
          ref={camera.videoRef}
          autoPlay playsInline muted
          className={[
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            isMirrored ? 'scale-x-[-1]' : '',
            camera.isActive ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-label="Camera preview"
        />

        {/* ── Pose skeleton canvas ─────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          className={[
            'absolute inset-0 w-full h-full pointer-events-none',
            isMirrored ? 'scale-x-[-1]' : '',
          ].join(' ')}
          style={{ opacity: 0.55 }}
        />

        {/* ── Loading spinner ──────────────────────────────────────────── */}
        {(phase === 'camera' && !camera.isActive && camera.status === 'requesting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 gap-4 z-10">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-16 h-16 rounded-full border-2 border-sky-400/20 animate-ping" />
              <div className="w-12 h-12 border-2 border-sky-400/40 border-t-sky-400 rounded-full animate-spin" />
            </div>
            <p className="text-white/70 text-sm font-medium">Opening camera…</p>
          </div>
        )}

        {/* ── Camera error ─────────────────────────────────────────────── */}
        {camera.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-8 gap-4 z-10">
            <Camera size={40} className="text-white/25" />
            <p className="text-white font-bold text-center text-base">{cameraErrorHeading}</p>
            <p className="text-white/55 text-sm text-center leading-relaxed max-w-xs">
              {camera.error?.message ?? 'Unknown camera error.'}
            </p>
            <button
              onClick={() => camera.start('user')}
              className="mt-2 flex items-center gap-2 bg-sky-500 text-white font-bold text-sm rounded-2xl px-5 py-3 active:bg-sky-600"
            >
              <RotateCcw size={14} />
              Try Again
            </button>
            <button onClick={() => navigate(-1)} className="text-white/40 text-xs underline">
              Back
            </button>
          </div>
        )}

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        {camera.isActive && (
          <div className="absolute top-0 left-0 right-0 px-4 pt-3 pb-2 flex items-center justify-between z-20 pointer-events-none">
            <button
              onClick={handleRescan}
              className="pointer-events-auto w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)' }}
              aria-label="Back"
            >
              <ArrowLeft size={18} className="text-white" />
            </button>

            <span
              className="text-[11px] font-black text-white/80 uppercase tracking-widest"
              style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
            >
              Position yourself &amp; tap
            </span>

            <button
              onClick={voice.toggle}
              className="pointer-events-auto w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(12px)' }}
              aria-label={voice.enabled ? 'Mute' : 'Enable voice'}
            >
              {voice.enabled
                ? <Volume2  size={16} className="text-emerald-400" />
                : <VolumeX  size={16} className="text-white/40" />}
            </button>
          </div>
        )}

        {/* ── Camera switch button (floating top-right, below top bar) ─── */}
        {camera.isActive && (
          <CameraSwitchButton
            onSwitch={camera.switchCamera}
            disabled={camera.status === 'requesting'}
            facing={camera.facing}
          />
        )}

        {/* ── Corner brackets ──────────────────────────────────────────── */}
        {camera.isActive && (
          <>
            <div className="absolute top-16 left-4 w-6 h-6 border-t-2 border-l-2 border-sky-400/60 rounded-tl pointer-events-none" />
            <div className="absolute top-16 right-4 w-6 h-6 border-t-2 border-r-2 border-sky-400/60 rounded-tr pointer-events-none" />
            <div className="absolute bottom-28 left-4 w-6 h-6 border-b-2 border-l-2 border-sky-400/60 rounded-bl pointer-events-none" />
            <div className="absolute bottom-28 right-4 w-6 h-6 border-b-2 border-r-2 border-sky-400/60 rounded-br pointer-events-none" />
          </>
        )}

        {/* ── Human validation overlay ──────────────────────────────────── */}
        {camera.isActive && (
          <HumanValidationOverlay
            status={humanSceneForRender.status}
            message={humanSceneForRender.message}
            contextHint={
              humanSceneForRender.status === 'NO_HUMAN'
                ? 'Make sure your full body is visible.'
                : humanSceneForRender.status === 'MULTIPLE_HUMANS'
                ? 'Only one person should be in frame.'
                : undefined
            }
            personCount={humanSceneForRender.personCount}
            position="top"
            showReady={true}
          />
        )}

        {/* ── Analysing overlay ─────────────────────────────────────────── */}
        {phase === 'analysing' && (
          <AnalysingOverlay imageSrc={previewSrc || undefined} />
        )}

        {/* ── Error overlay ─────────────────────────────────────────────── */}
        {phase === 'error' && (
          <ErrorOverlay
            message={errorMsg ?? 'Something went wrong.'}
            onRetry={handleRescan}
          />
        )}
      </div>

      {/* ── Camera controls bar — shutter button ──────────────────────── */}
      <div
        className="camera-controls flex flex-col items-center gap-3 pt-3 px-4"
        style={{ background: 'rgba(5,8,20,0.92)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {camera.isActive && (
          <>
            {/* Shutter button — always tappable; Gemini validates the photo */}
            <button
              onClick={handleShutter}
              disabled={!camera.isActive}
              aria-label="Take photo"
              className="relative transition-all active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              {/* Outer ring — brighter when a person is detected */}
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: '72px',
                  height: '72px',
                  background: 'rgba(255,255,255,0.15)',
                  border: `3px solid ${humanSceneForRender.canProceed ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.40)'}`,
                  transition: 'border-color 0.3s ease',
                }}
              >
                {/* Inner disc */}
                <div
                  className="rounded-full"
                  style={{
                    width: '52px',
                    height: '52px',
                    background: 'white',
                    opacity: humanSceneForRender.canProceed ? 1 : 0.5,
                    transition: 'opacity 0.3s ease',
                  }}
                />
              </div>
            </button>

            {/* Hint text under shutter */}
            <p className="text-white/30 text-[10px] font-semibold tracking-wide -mt-1">
              Tap to capture
            </p>

            {/* Upload shortcut */}
            <label
              htmlFor={`${fileInputId}-camera`}
              className="flex items-center gap-1.5 text-white/35 text-[11px] font-semibold cursor-pointer active:text-white/60 transition-colors"
            >
              <Image size={13} />
              Upload instead
              <input
                id={`${fileInputId}-camera`}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                  e.target.value = ''
                }}
              />
            </label>
          </>
        )}
      </div>
    </div>
  )
}
