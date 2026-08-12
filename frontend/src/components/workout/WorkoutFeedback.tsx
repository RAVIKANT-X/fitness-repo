/**
 * WorkoutFeedback — compact, mobile-friendly real-time feedback strip.
 *
 * Visual hierarchy:
 *   REP COUNT         — largest, most prominent
 *   PHASE             — secondary badge
 *   FORM STATUS       — prominent coloured indicator
 *   ANGLE VALUES      — small supporting row
 *   DEVIATION         — clear warning when present
 *
 * No analysis logic here — purely presentational.
 */

import type { AnalysisResult, MovementPhase, FormStatus, Deviation } from '../../features/analysis/analysisTypes'
import type { JointAngles } from '../../features/biomechanics/biomechanicsTypes'

interface WorkoutFeedbackProps {
  result: AnalysisResult | null
  isActive: boolean
  exerciseId?: string
}

export default function WorkoutFeedback({ result, isActive, exerciseId }: WorkoutFeedbackProps) {
  if (!isActive) return null

  // ── Landmarks not visible ─────────────────────────────────────────────────
  if (result && !result.landmarksValid) {
    return (
      <div className="flex items-center gap-2.5 bg-warning/10 rounded-2xl px-4 py-3">
        <span className="w-2 h-2 rounded-full bg-warning animate-pulse shrink-0" />
        <p className="text-sm font-semibold text-warning">
          Move into frame — body not fully visible
        </p>
      </div>
    )
  }

  const repCount  = result?.repCount ?? 0
  const phase     = result?.currentPhase ?? 'UNKNOWN'
  const formStatus = result?.formStatus ?? 'GOOD'
  const deviations = result?.activeDeviations ?? []

  return (
    <div className="space-y-2.5">

      {/* ── Primary row: reps + phase ──────────────────────────────── */}
      <div className="flex items-center justify-between bg-surface rounded-2xl shadow-card px-5 py-4">

        {/* Rep count — dominant */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-none mb-1">
            Reps
          </p>
          <p className="text-5xl font-extrabold text-slate-900 tabular-nums leading-none">
            {String(repCount).padStart(2, '0')}
          </p>
        </div>

        {/* Phase + form status stacked right */}
        <div className="flex flex-col items-end gap-2">
          <PhaseBadge phase={phase} />
          <FormBadge status={formStatus} />
        </div>
      </div>

      {/* ── Angle values row ───────────────────────────────────────── */}
      {result && exerciseId && (
        <AngleRow angles={result.angles} exerciseId={exerciseId} />
      )}

      {/* ── Active deviations ──────────────────────────────────────── */}
      {deviations.length > 0 && (
        <div className="bg-warning/8 border border-warning/20 rounded-2xl px-4 py-3 space-y-1.5">
          {deviations.map((d) => (
            <DeviationRow key={d.id} deviation={d} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: MovementPhase }) {
  return (
    <span className={['text-[11px] font-semibold px-2.5 py-1 rounded-full', phaseStyle(phase)].join(' ')}>
      {phaseLabel(phase)}
    </span>
  )
}

function FormBadge({ status }: { status: FormStatus }) {
  const styles: Record<FormStatus, string> = {
    GOOD:    'bg-success/15 text-success',
    WARNING: 'bg-warning/15 text-warning',
    INVALID: 'bg-slate-100 text-slate-500',
  }
  const labels: Record<FormStatus, string> = {
    GOOD:    '✓ Good form',
    WARNING: '⚠ Check form',
    INVALID: 'Paused',
  }
  return (
    <span className={['text-[11px] font-semibold px-2.5 py-1 rounded-full', styles[status]].join(' ')}>
      {labels[status]}
    </span>
  )
}

function AngleRow({ angles, exerciseId }: { angles: JointAngles; exerciseId: string }) {
  const entries = getAngleEntries(angles, exerciseId)
  if (entries.length === 0) return null

  return (
    <div className="flex gap-3 flex-wrap px-4 py-2.5 bg-surface-muted rounded-2xl">
      {entries.map(({ label, value }) => (
        <div key={label} className="flex items-baseline gap-1">
          <span className="text-[11px] text-slate-400">{label}</span>
          <span className="text-sm font-bold text-slate-700 tabular-nums">
            {value !== null ? `${value.toFixed(0)}°` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function DeviationRow({ deviation }: { deviation: Deviation }) {
  const message = deviationMessage(deviation.id)
  return (
    <div className="flex items-start gap-2">
      <span className="text-warning text-xs mt-0.5 shrink-0">●</span>
      <p className="text-sm text-slate-700 leading-snug">{message}</p>
    </div>
  )
}

// ── Angle entries by exercise ─────────────────────────────────────────────────

function getAngleEntries(
  angles: JointAngles,
  exerciseId: string,
): Array<{ label: string; value: number | null }> {
  const getDeg = (name: string): number | null => {
    const a = angles[name]
    if (!a || !a.valid) return null
    return a.degrees
  }

  if (exerciseId === 'squat') {
    return [
      { label: 'L Knee', value: getDeg('leftKneeAngle') },
      { label: 'R Knee', value: getDeg('rightKneeAngle') },
    ]
  }
  if (exerciseId === 'pushup') {
    return [
      { label: 'L Elbow', value: getDeg('leftElbowAngle') },
      { label: 'R Elbow', value: getDeg('rightElbowAngle') },
    ]
  }
  if (exerciseId === 'curl') {
    return [
      { label: 'L Elbow', value: getDeg('leftElbowAngle') },
      { label: 'R Elbow', value: getDeg('rightElbowAngle') },
    ]
  }
  return []
}

// ── Label / style maps ────────────────────────────────────────────────────────

function phaseLabel(phase: MovementPhase): string {
  const map: Partial<Record<MovementPhase, string>> = {
    UNKNOWN:    'Ready',
    INVALID:    'Adjust',
    STANDING:   'Standing',
    DESCENDING: 'Descending',
    BOTTOM:     'Bottom',
    ASCENDING:  'Ascending',
    TOP:        'Top',
    EXTENDED:   'Extended',
    CURLING:    'Curling',
    PEAK:       'Peak',
    RETURNING:  'Returning',
  }
  return map[phase] ?? phase
}

function phaseStyle(phase: MovementPhase): string {
  switch (phase) {
    case 'BOTTOM':
    case 'PEAK':
      return 'bg-primary-light text-primary'
    case 'ASCENDING':
    case 'RETURNING':
      return 'bg-success/15 text-success'
    case 'DESCENDING':
    case 'CURLING':
      return 'bg-slate-100 text-slate-600'
    case 'INVALID':
      return 'bg-warning/15 text-warning'
    default:
      return 'bg-slate-100 text-slate-500'
  }
}

function deviationMessage(id: string): string {
  const messages: Record<string, string> = {
    DEPTH_TOO_SHALLOW:   'Squat a little deeper — aim to get thighs parallel to the floor',
    KNEE_ASYMMETRY:      'Keep your knees tracking evenly — one side is bending more than the other',
    HIP_ASYMMETRY:       'Try to keep your hips level throughout the movement',
    ELBOW_ASYMMETRY:     'Keep both elbows bending evenly — one side is lagging behind',
    SHOULDER_ALIGNMENT:  'Keep your shoulders from flaring — elbows closer to your body',
    INCOMPLETE_CURL:     'Curl all the way up — squeeze at the top for full range of motion',
    INCOMPLETE_EXTENSION:'Fully extend your arm on the way down for complete range of motion',
    SHOULDER_MOVEMENT:   'Keep your shoulder stable — avoid swinging for momentum',
  }
  return messages[id] ?? id
}
