/**
 * ProfilePage — minimal mobile profile and settings.
 *
 * Sections:
 *  - Profile card (placeholder — no auth)
 *  - Workout preferences (placeholder)
 *  - About / app info
 *  - Consult a doctor link
 */

import { useNavigate } from 'react-router-dom'
import { User, Shield, Info, ChevronRight, HeartHandshake } from 'lucide-react'

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon: Icon,
  label,
  description,
  onTap,
  accent = false,
}: {
  icon: typeof User
  label: string
  description: string
  onTap?: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      className={[
        'w-full flex items-center gap-3 px-5 py-4 text-left',
        'border-b border-border last:border-0',
        onTap ? 'active:bg-surface-muted transition-colors' : 'cursor-default',
      ].join(' ')}
    >
      <div className={[
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
        accent ? 'bg-blue-50' : 'bg-surface-muted',
      ].join(' ')}>
        <Icon size={17} className={accent ? 'text-blue-500' : 'text-slate-500'} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={['text-sm font-semibold', accent ? 'text-blue-700' : 'text-slate-800'].join(' ')}>
          {label}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      {onTap && (
        <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5 pt-1">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-slate-500 text-sm mt-0.5">Settings and preferences</p>
      </div>

      {/* ── Profile card ─────────────────────────────────────────────── */}
      <div className="bg-surface rounded-2xl shadow-card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center shrink-0">
          <User size={26} className="text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="font-bold text-slate-900">Your Profile</p>
          <p className="text-xs text-slate-400 mt-0.5">Sign-in not required for this demo</p>
        </div>
      </div>

      {/* ── Preferences section ───────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">
          Preferences
        </p>
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <SettingsRow
            icon={Shield}
            label="Camera & Privacy"
            description="Camera is only used during active workout sessions"
          />
        </div>
      </div>

      {/* ── Medical advice ────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">
          Health
        </p>
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <SettingsRow
            icon={HeartHandshake}
            label="Consult a Doctor"
            description="Important guidance before starting exercise"
            onTap={() => navigate('/consult-doctor')}
            accent
          />
        </div>
      </div>

      {/* ── About section ─────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1 mb-2">
          About
        </p>
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <SettingsRow
            icon={Info}
            label="FitCoach AI"
            description="AI-powered posture and form coach · v0.2.0"
          />
        </div>
      </div>

      {/* ── Disclaimer ────────────────────────────────────────────────── */}
      <p className="text-xs text-slate-400 text-center leading-relaxed px-4">
        This application is for fitness demonstration purposes only.
        It does not provide medical advice, diagnosis, or treatment.
      </p>

    </div>
  )
}
