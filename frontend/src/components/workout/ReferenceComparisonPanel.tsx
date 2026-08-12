/**
 * ReferenceComparisonPanel — a compact panel showing True Reference vs
 * Your Movement comparison at joint level.
 *
 * Used in:
 *  - CalibrationPage STEP_FAILED state: shows what was wrong
 *  - LiveWorkoutPage: floating deviation summary
 *  - CalibrationPage REPORT: per-step breakdown
 *
 * Design: glassmorphism card, mobile-first, bold labels, colour-coded.
 *  - GREEN: reference value
 *  - NEUTRAL (white/slate): user value
 *  - RED highlight: significant deviation
 *  - Amber arrow: correction direction
 */

import type { ReferenceComparison, JointDeviation } from '../../features/reference'

interface ReferenceComparisonPanelProps {
  comparison: ReferenceComparison
  /** Whether to show full joint list (false = only primary deviation) */
  expanded?: boolean
  /** Compact mode for live overlay */
  compact?: boolean
}

export default function ReferenceComparisonPanel({
  comparison,
  expanded = false,
  compact = false,
}: ReferenceComparisonPanelProps) {
  const { primaryDeviation, jointDeviations, overallMatchScore, phaseLabel, matched } = comparison

  if (compact) {
    // Minimal floating badge — only primary deviation
    if (!primaryDeviation) return null
    return (
      <CompactBadge deviation={primaryDeviation} matchScore={overallMatchScore} matched={matched} />
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(15,20,30,0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-white/80 uppercase tracking-wider">
            True Reference
          </span>
          <span className="text-white/30 text-xs">vs</span>
          <span className="text-xs font-bold text-white/60 uppercase tracking-wider">
            Your Movement
          </span>
        </div>
        <MatchScoreBadge score={overallMatchScore} matched={matched} />
      </div>

      {/* Phase label */}
      <div className="px-4 pt-2.5 pb-1">
        <p className="text-[10px] text-white/40 uppercase tracking-wide">{phaseLabel}</p>
      </div>

      {/* Primary deviation — always shown */}
      {primaryDeviation ? (
        <div className="px-4 pb-3">
          <DeviationRow deviation={primaryDeviation} isPrimary />
        </div>
      ) : (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-sm text-emerald-300 font-semibold">Matched reference form</span>
        </div>
      )}

      {/* Expanded: all deviations */}
      {expanded && jointDeviations.length > 1 && (
        <div className="border-t border-white/10 px-4 py-3 space-y-2.5">
          <p className="text-[10px] text-white/40 uppercase tracking-wide mb-2">All deviations</p>
          {jointDeviations.slice(1).map((d) => (
            <DeviationRow key={d.affectedJoint} deviation={d} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MatchScoreBadge({ score, matched }: { score: number; matched: boolean }) {
  const color = matched
    ? 'text-emerald-400'
    : score >= 60
    ? 'text-amber-400'
    : 'text-red-400'
  return (
    <span className={['text-sm font-black tabular-nums', color].join(' ')}>
      {score}<span className="text-[10px] font-normal text-white/30">%</span>
    </span>
  )
}

function DeviationRow({ deviation, isPrimary = false }: { deviation: JointDeviation; isPrimary?: boolean }) {
  const severityColor =
    deviation.severity === 'ERROR'   ? 'text-red-400 border-red-400/30 bg-red-400/10' :
    deviation.severity === 'WARNING' ? 'text-amber-400 border-amber-400/30 bg-amber-400/10' :
    'text-slate-400 border-slate-600 bg-slate-800/40'

  const directionArrow: Record<string, string> = {
    UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
    INWARD: '↙', OUTWARD: '↗', FORWARD: '→', BACK: '←', NONE: '•',
  }
  const arrow = directionArrow[deviation.correctionDirection] ?? '•'

  return (
    <div className={['rounded-xl border p-3', isPrimary ? severityColor : 'border-white/8 bg-white/5'].join(' ')}>
      {/* Joint name + values */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={['text-xs font-bold', isPrimary ? '' : 'text-white/70'].join(' ')}>
          {deviation.affectedJoint}
        </span>
        <div className="flex items-center gap-2 text-[11px] tabular-nums">
          {/* Reference */}
          <span className="text-emerald-400 font-bold">{deviation.referenceAngle.toFixed(0)}°</span>
          <span className="text-white/20">→</span>
          {/* User */}
          <span className={deviation.severity === 'INFO' ? 'text-white/60' : 'text-red-400 font-bold'}>
            {deviation.userAngle.toFixed(0)}°
          </span>
        </div>
      </div>

      {/* Correction text */}
      <div className="flex items-start gap-1.5">
        <span className="text-amber-400 text-sm shrink-0 mt-0.5">{arrow}</span>
        <p className="text-[11px] text-white/70 leading-relaxed">{deviation.correctionText}</p>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500/60"
            style={{ width: `${(deviation.confidence * 100).toFixed(0)}%` }}
          />
        </div>
        <span className="text-[9px] text-white/25 tabular-nums">
          {(deviation.confidence * 100).toFixed(0)}% conf
        </span>
      </div>
    </div>
  )
}

function CompactBadge({
  deviation, matchScore, matched,
}: {
  deviation: JointDeviation
  matchScore: number
  matched: boolean
}) {
  const bg = matched
    ? 'rgba(34,197,94,0.85)'
    : deviation.severity === 'ERROR'
    ? 'rgba(239,68,68,0.85)'
    : 'rgba(245,158,11,0.85)'

  const directionArrow: Record<string, string> = {
    UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→',
    INWARD: '↙', OUTWARD: '↗', FORWARD: '→', BACK: '←', NONE: '•',
  }
  const arrow = directionArrow[deviation.correctionDirection] ?? '•'

  return (
    <div
      className="rounded-2xl px-3 py-2.5 text-white max-w-xs"
      style={{
        background: bg,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
          {deviation.affectedJoint}
        </span>
        <span className="ml-auto text-xs font-black tabular-nums">{matchScore}%</span>
      </div>
      <div className="flex items-start gap-1.5">
        <span className="text-sm shrink-0">{arrow}</span>
        <p className="text-xs font-semibold leading-snug">{deviation.correctionText}</p>
      </div>
    </div>
  )
}

// ── Label row for report view ─────────────────────────────────────────────────

export function ReferenceVsUserHeader() {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">True Reference</span>
      </div>
      <span className="text-slate-300 text-xs">vs</span>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0" />
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Your Movement</span>
      </div>
    </div>
  )
}
