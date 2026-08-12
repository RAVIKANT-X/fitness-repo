import { ChevronRight, Dumbbell } from 'lucide-react'
import Card from '../components/ui/Card'

/** Placeholder exercise entries — will be replaced by real data in Phase 3 */
const placeholderExercises = [
  { id: 'squat', name: 'Squat', muscles: 'Quads · Glutes · Core', difficulty: 'Beginner' },
  { id: 'pushup', name: 'Push-Up', muscles: 'Chest · Triceps · Shoulders', difficulty: 'Beginner' },
  { id: 'lunge', name: 'Lunge', muscles: 'Quads · Glutes · Hamstrings', difficulty: 'Beginner' },
  { id: 'curl', name: 'Bicep Curl', muscles: 'Biceps · Forearms', difficulty: 'Beginner' },
  { id: 'shoulder-press', name: 'Shoulder Press', muscles: 'Deltoids · Triceps', difficulty: 'Intermediate' },
  { id: 'deadlift', name: 'Deadlift', muscles: 'Hamstrings · Back · Glutes', difficulty: 'Intermediate' },
]

/**
 * Exercise Selection page — Phase 1 placeholder.
 *
 * Will eventually:
 *  - Load exercises from the backend exercise library (Phase 3)
 *  - Allow filtering by muscle group and difficulty
 *  - Navigate to LiveWorkoutPage with the selected exercise
 */
export default function ExerciseSelectionPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Choose an Exercise</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Select an exercise to begin your session
        </p>
      </div>

      <div className="space-y-3">
        {placeholderExercises.map((exercise) => (
          <Card
            key={exercise.id}
            className="flex items-center justify-between cursor-pointer hover:shadow-card-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center shrink-0">
                <Dumbbell size={18} className="text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{exercise.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{exercise.muscles}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-primary-dark bg-primary-light px-2 py-0.5 rounded-full font-medium">
                {exercise.difficulty}
              </span>
              <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
            </div>
          </Card>
        ))}
      </div>

      <Card className="border border-dashed border-slate-200 bg-surface-muted">
        <p className="text-xs text-slate-400 text-center">
          Phase 1 — Foundation. Exercise logic and camera integration arrive in Phases 2–3.
        </p>
      </Card>
    </div>
  )
}
