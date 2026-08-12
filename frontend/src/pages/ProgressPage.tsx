import { TrendingUp, Calendar, BarChart2 } from 'lucide-react'
import Card from '../components/ui/Card'

/**
 * Progress / History page — Phase 1 placeholder.
 *
 * Will eventually:
 *  - Show workout streak and weekly volume charts (Phase 7)
 *  - List past sessions with date, exercise, reps, and accuracy (Phase 7)
 *  - Display progression trends per exercise (Phase 7)
 *  - Data sourced from the backend progress endpoints (Phase 7)
 */
export default function ProgressPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Progress</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Your workout history and performance trends
        </p>
      </div>

      {/* Streak placeholder */}
      <Card elevated className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary-light flex items-center justify-center shrink-0">
          <TrendingUp size={26} className="text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-900">—</p>
          <p className="text-sm text-slate-500">Day streak</p>
        </div>
      </Card>

      {/* Chart placeholder */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-slate-700">Weekly Volume</p>
          <BarChart2 size={18} className="text-slate-400" aria-hidden="true" />
        </div>
        <div className="h-32 flex items-end gap-1.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day) => (
            <div key={day} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-slate-100 rounded-t-sm h-full flex items-end">
                <div className="w-full bg-slate-200 rounded-t-sm h-0" />
              </div>
              <span className="text-[10px] text-slate-400">{day}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Session history placeholder */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Recent Sessions
        </h3>
        <Card className="border border-dashed border-slate-200 bg-surface-muted">
          <div className="flex items-center gap-3 py-2">
            <Calendar size={18} className="text-slate-300" aria-hidden="true" />
            <p className="text-sm text-slate-400">
              No sessions recorded yet. Complete a workout to see your history here.
            </p>
          </div>
        </Card>
      </div>

      <Card className="border border-dashed border-slate-200 bg-surface-muted">
        <p className="text-xs text-slate-400 text-center">
          Phase 1 — Foundation. Progress data will be loaded from the backend in Phase 7.
        </p>
      </Card>
    </div>
  )
}
