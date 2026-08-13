/**
 * SpecialistPage — /specialist
 *
 * A functional specialist contact directory.
 * Each card shows specialist name, specialization, description, and a
 * tel: link Call button.
 *
 * Phone numbers come from a centralized config (specialistConfig.ts).
 * Numbers are clearly marked as demo placeholders until real ones are
 * configured.
 *
 * IMPORTANT:
 *  - Does NOT invent real specialist identities or real phone numbers.
 *  - Demo numbers are clearly labelled.
 *  - Privacy: no user data is sent anywhere from this page.
 */

import { Phone, Stethoscope, AlertTriangle, ExternalLink } from 'lucide-react'
import { SPECIALISTS, type SpecialistEntry } from '../config/specialistConfig'

// ── Accent colours ─────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<SpecialistEntry['accent'], {
  bg: string; badge: string; iconBg: string; iconColor: string; btnBg: string; btnText: string
}> = {
  emerald: {
    bg:         'rgba(236,253,245,0.95)',
    badge:      'bg-emerald-100 text-emerald-700',
    iconBg:     'bg-emerald-100',
    iconColor:  'text-emerald-600',
    btnBg:      'bg-emerald-600 hover:bg-emerald-700',
    btnText:    'text-white',
  },
  blue: {
    bg:         'rgba(239,246,255,0.95)',
    badge:      'bg-blue-100 text-blue-700',
    iconBg:     'bg-blue-100',
    iconColor:  'text-blue-600',
    btnBg:      'bg-blue-600 hover:bg-blue-700',
    btnText:    'text-white',
  },
  rose: {
    bg:         'rgba(255,241,242,0.95)',
    badge:      'bg-rose-100 text-rose-700',
    iconBg:     'bg-rose-100',
    iconColor:  'text-rose-600',
    btnBg:      'bg-rose-600 hover:bg-rose-700',
    btnText:    'text-white',
  },
  violet: {
    bg:         'rgba(245,243,255,0.95)',
    badge:      'bg-violet-100 text-violet-700',
    iconBg:     'bg-violet-100',
    iconColor:  'text-violet-600',
    btnBg:      'bg-violet-600 hover:bg-violet-700',
    btnText:    'text-white',
  },
  amber: {
    bg:         'rgba(255,251,235,0.95)',
    badge:      'bg-amber-100 text-amber-700',
    iconBg:     'bg-amber-100',
    iconColor:  'text-amber-600',
    btnBg:      'bg-amber-500 hover:bg-amber-600',
    btnText:    'text-white',
  },
}

// ── Specialist card ────────────────────────────────────────────────────────────

function SpecialistCard({ specialist }: { specialist: SpecialistEntry }) {
  const a = ACCENT_MAP[specialist.accent]
  const isDemo = specialist.phone.startsWith('+100000')

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-card border border-white/60"
      style={{
        background: a.bg,
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${a.iconBg}`}>
            <Stethoscope size={20} className={a.iconColor} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.badge}`}>
                {specialist.badge}
              </span>
              {isDemo && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  DEMO
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">{specialist.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{specialist.specialization}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-700 leading-relaxed mb-4">
          {specialist.description}
        </p>

        {/* Phone + Call button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Phone size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
            <span className="text-xs text-slate-500 font-mono truncate">
              {isDemo ? 'Demo — not a real number' : specialist.phone}
            </span>
          </div>

          {/* Call button — tel: link */}
          <a
            href={`tel:${specialist.phone}`}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold',
              'transition-opacity active:opacity-70 shrink-0 min-h-[40px]',
              a.btnBg, a.btnText,
              isDemo ? 'opacity-50 pointer-events-none' : '',
            ].join(' ')}
            aria-label={`Call ${specialist.name}`}
            aria-disabled={isDemo}
            tabIndex={isDemo ? -1 : 0}
          >
            <Phone size={13} aria-hidden="true" />
            Call
          </a>
        </div>

        {/* Demo notice */}
        {isDemo && (
          <div className="mt-3 flex items-start gap-1.5 bg-amber-50 rounded-xl px-3 py-2">
            <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[10px] text-amber-700 leading-snug">
              This is a demo entry with a placeholder number. Replace in <code className="font-mono">specialistConfig.ts</code> before deployment.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpecialistPage() {
  return (
    <div className="space-y-5 pt-1 pb-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Stethoscope size={20} className="text-rose-500" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-slate-900">Specialists</h1>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Contact a fitness or healthcare professional for personalised guidance.
        </p>
      </div>

      {/* ── Medical disclaimer ────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: 'rgba(239,246,255,0.90)',
          border: '1px solid rgba(147,197,253,0.50)',
        }}
      >
        <AlertTriangle size={16} className="text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold text-blue-800 mb-1">Medical Disclaimer</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            FitCoach AI is not a medical product. These contacts are for
            informational purposes only. Always consult a qualified
            professional before starting or changing a fitness programme.
          </p>
        </div>
      </div>

      {/* ── Specialist cards ──────────────────────────────────────────── */}
      <div className="space-y-4">
        {SPECIALISTS.map((s) => (
          <SpecialistCard key={s.id} specialist={s} />
        ))}
      </div>

      {/* ── "Find more" note ──────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl shadow-card p-4">
        <div className="flex items-start gap-2.5">
          <ExternalLink size={14} className="text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-1">Looking for more options?</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Search for registered fitness professionals or physiotherapists
              in your area through your national professional registry or
              healthcare provider.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
