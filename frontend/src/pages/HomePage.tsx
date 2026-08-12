import { Activity, Dumbbell, TrendingUp, Zap } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'

const statCards = [
  { label: 'Total Sessions', value: '—', icon: Activity, color: 'text-primary' },
  { label: 'This Week', value: '—', icon: Zap, color: 'text-warning' },
  { label: 'Avg. Accuracy', value: '—', icon: TrendingUp, color: 'text-success' },
  { label: 'Exercises Done', value: '—', icon: Dumbbell, color: 'text-slate-400' },
]

/**
 * Home / Dashboard page — Phase 1 placeholder.
 *
 * Will eventually show:
 *  - Daily activity summary
 *  - Recent sessions
 *  - Quick-start workout button
 *  - Streak / progress ring
 *
 * Data will come from the Progress module (Phase 7).
 */
export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      {/* ── Welcome banner ── */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Good morning 👋</h2>
        <p className="text-slate-500 mt-0.5 text-sm">Ready for today's workout?</p>
      </div>

      {/* ── Quick-start CTA ── */}
      <Card elevated className="bg-primary text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-light text-sm font-medium">Start a session</p>
            <p className="text-xl font-bold mt-0.5">Begin Workout</p>
            <p className="text-primary-light text-xs mt-1">
              Camera + pose analysis available in Phase 2
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/exercises')}
            className="shrink-0"
          >
            Go
          </Button>
        </div>
      </Card>

      {/* ── Stat grid ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Your Stats
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <Icon size={20} className={color} aria-hidden="true" />
              <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Phase notice ── */}
      <Card className="border border-dashed border-slate-200 bg-surface-muted">
        <p className="text-xs text-slate-400 text-center">
          Phase 1 — Foundation. Session data will appear here in Phase 7.
        </p>
      </Card>
    </div>
  )
}
