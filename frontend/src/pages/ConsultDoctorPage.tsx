/**
 * ConsultDoctorPage — /consult-doctor
 *
 * Purpose: clearly communicate that FitCoach AI is not a medical product,
 * does not replace professional medical advice, and that users should consult
 * a qualified healthcare professional before starting or changing a fitness
 * programme — especially if they have any existing health concerns.
 *
 * What this page does NOT contain:
 *  - Fake doctor profiles, credentials, or booking functionality
 *  - Claims of medical validity or clinical benefit
 *  - Any external API or third-party healthcare service
 *  - Diagnostic or treatment language
 */

import { useNavigate } from 'react-router-dom'
import { ArrowLeft, HeartHandshake, AlertTriangle, CheckCircle, Info } from 'lucide-react'

// ── Section component ─────────────────────────────────────────────────────────

function GuidanceCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface rounded-2xl shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-3">
        {icon}
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsultDoctorPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5 pt-1 pb-4">

      {/* ── Back navigation ──────────────────────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 font-medium active:opacity-70 -ml-0.5"
        aria-label="Go back"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 rounded-2xl p-5">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
          <HeartHandshake size={24} className="text-blue-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 leading-tight">
          Before you train
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          FitCoach AI is a fitness coaching tool, not a medical product.
          Please read this guidance before starting any exercise programme.
        </p>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────────────── */}
      <GuidanceCard
        title="This app is not medical advice"
        icon={
          <div className="w-7 h-7 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
            <AlertTriangle size={15} className="text-error" aria-hidden="true" />
          </div>
        }
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          FitCoach AI analyses joint angles and movement patterns to provide
          general form feedback. It is designed for informational and fitness
          demonstration purposes only.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mt-2">
          It does not diagnose injury, assess medical conditions, provide
          rehabilitation guidance, or replace the advice of a qualified
          healthcare professional.
        </p>
      </GuidanceCard>

      {/* ── When to consult ──────────────────────────────────────────── */}
      <GuidanceCard
        title="When to speak to a professional"
        icon={
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Info size={15} className="text-blue-600" aria-hidden="true" />
          </div>
        }
      >
        <p className="text-sm text-slate-500 mb-3">
          Consider consulting a doctor, physiotherapist, or qualified fitness
          professional before starting or resuming exercise if you:
        </p>
        <ul className="space-y-2.5">
          {[
            'Have a known cardiovascular, respiratory, or metabolic condition',
            'Are recovering from surgery, injury, or illness',
            'Experience pain, dizziness, or breathlessness during exercise',
            'Have not been physically active for an extended period',
            'Are pregnant or have recently given birth',
            'Have been advised by a doctor to limit physical activity',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />
              <span className="text-sm text-slate-700">{item}</span>
            </li>
          ))}
        </ul>
      </GuidanceCard>

      {/* ── What the app does ─────────────────────────────────────────── */}
      <GuidanceCard
        title="What FitCoach AI does"
        icon={
          <div className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center shrink-0">
            <CheckCircle size={15} className="text-primary" aria-hidden="true" />
          </div>
        }
      >
        <ul className="space-y-2.5">
          {[
            'Uses your device camera to detect body pose in real time',
            'Calculates joint angles from visible landmarks',
            'Counts repetitions based on movement patterns',
            'Highlights common form deviations for general awareness',
            'Stores session data locally on your device\'s network',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
              <span className="text-sm text-slate-700">{item}</span>
            </li>
          ))}
        </ul>
      </GuidanceCard>

      {/* ── What the app does NOT do ──────────────────────────────────── */}
      <GuidanceCard
        title="What FitCoach AI does not do"
        icon={
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={15} className="text-slate-400" aria-hidden="true" />
          </div>
        }
      >
        <ul className="space-y-2.5">
          {[
            'Diagnose pain, injury, or medical conditions',
            'Provide rehabilitation or therapeutic exercise programmes',
            'Validate that any exercise is safe for your specific health status',
            'Replace assessment by a qualified fitness or medical professional',
            'Guarantee medically correct form thresholds',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mt-1.5" />
              <span className="text-sm text-slate-600">{item}</span>
            </li>
          ))}
        </ul>
      </GuidanceCard>

      {/* ── Footer note ────────────────────────────────────────────────── */}
      <div className="bg-surface-muted rounded-2xl p-4">
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          This guidance does not constitute medical advice. Always seek
          the advice of a qualified healthcare professional with any
          questions about your health or fitness programme.
        </p>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/exercises')}
        className="w-full bg-primary text-white font-bold rounded-2xl py-4 min-h-[56px] active:bg-primary-dark transition-colors"
      >
        Browse Exercises
      </button>

    </div>
  )
}
