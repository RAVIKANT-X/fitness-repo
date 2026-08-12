import { Camera, Wifi } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

/**
 * Live Workout page — Phase 1 placeholder.
 *
 * Will eventually:
 *  - Request camera permission via getUserMedia (Phase 2)
 *  - Render a <video> feed with a <canvas> landmark overlay (Phase 2)
 *  - Run MediaPipe Pose Landmarker on each frame (Phase 2)
 *  - Calculate joint angles and detect form deviations (Phases 3–4)
 *  - Count repetitions and display real-time coaching feedback (Phases 4–5)
 */
export default function LiveWorkoutPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Live Workout</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Real-time pose analysis and coaching
        </p>
      </div>

      {/* Camera placeholder */}
      <div className="aspect-[3/4] sm:aspect-video rounded-card bg-slate-900 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          <Camera size={32} className="text-white/60" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold">Camera feed</p>
          <p className="text-white/50 text-sm mt-1">Available in Phase 2</p>
        </div>
        {/* Corner indicators — decorative skeleton for future overlay UI */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-primary/60 rounded-tl-md" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-primary/60 rounded-tr-md" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-primary/60 rounded-bl-md" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-primary/60 rounded-br-md" />
      </div>

      {/* Rep counter placeholder */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Reps', value: '—' },
          { label: 'Sets', value: '—' },
          { label: 'Accuracy', value: '—' },
        ].map(({ label, value }) => (
          <Card key={label} className="text-center">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {/* Architecture note */}
      <Card className="border border-dashed border-slate-200 bg-surface-muted">
        <div className="flex items-start gap-3">
          <Wifi size={16} className="text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-slate-400">
            The pose analysis loop will run entirely in the browser. No video frames
            will be sent to the server — only discrete session events.
          </p>
        </div>
      </Card>

      <Button variant="outline" fullWidth disabled>
        Start Session (Phase 2)
      </Button>
    </div>
  )
}
