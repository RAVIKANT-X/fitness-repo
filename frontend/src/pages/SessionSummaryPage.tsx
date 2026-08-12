import { CheckCircle, AlertCircle } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'

/**
 * Session Summary page — Phase 1 placeholder.
 *
 * Will eventually:
 *  - Display reps completed, sets, duration, and accuracy score (Phase 6)
 *  - Show a breakdown of detected form deviations (Phase 4)
 *  - Provide a coaching summary from the AI coaching engine (Phase 5+)
 *  - Allow the user to save or discard the session (Phase 6)
 */
export default function SessionSummaryPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Session Summary</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Your workout results and coaching feedback
        </p>
      </div>

      {/* Summary metrics placeholder */}
      <Card elevated className="text-center space-y-2">
        <CheckCircle size={40} className="text-primary mx-auto" aria-hidden="true" />
        <p className="text-xl font-bold text-slate-900">Session Complete</p>
        <p className="text-slate-500 text-sm">Detailed results will appear here after Phase 6.</p>
      </Card>

      {/* Metric placeholders */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Reps', value: '—' },
          { label: 'Duration', value: '—' },
          { label: 'Form Score', value: '—' },
          { label: 'Deviations', value: '—' },
        ].map(({ label, value }) => (
          <Card key={label} className="text-center">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Coaching feedback placeholder */}
      <Card className="bg-surface-muted">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-700">Coaching Feedback</p>
            <p className="text-xs text-slate-500 mt-1">
              AI coaching cues and form deviation details will appear here in Phase 5.
            </p>
          </div>
        </div>
      </Card>

      <Button
        variant="primary"
        fullWidth
        onClick={() => navigate('/')}
      >
        Back to Dashboard
      </Button>

      <Button
        variant="outline"
        fullWidth
        onClick={() => navigate('/exercises')}
      >
        Start Another Session
      </Button>
    </div>
  )
}
