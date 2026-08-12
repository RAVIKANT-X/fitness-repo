/**
 * useSelectedExercise — React Context for sharing the selected exercise
 * between ExerciseSelectionPage and LiveWorkoutPage.
 *
 * Design rationale:
 *  - React Context is the simplest approach for one shared value across
 *    two sibling pages — no external state library needed at this stage.
 *  - If the app grows to need more shared workout state (reps, session data),
 *    this context can be expanded or replaced with Zustand without changing
 *    the consumer call sites.
 *
 * Usage:
 *  // In App.tsx — wrap the router:
 *  <ExerciseProvider>...</ExerciseProvider>
 *
 *  // In any component:
 *  const { selectedExercise, setSelectedExercise } = useSelectedExercise()
 */

import { createContext, useContext, useState, type ReactNode } from 'react'
import type { ExerciseDefinition } from '../features/exercise/exerciseTypes'

interface ExerciseContextValue {
  /** The exercise the user has chosen. Null until a selection is made. */
  selectedExercise: ExerciseDefinition | null
  /** Update the selected exercise (called from ExerciseSelectionPage). */
  setSelectedExercise: (exercise: ExerciseDefinition | null) => void
}

const ExerciseContext = createContext<ExerciseContextValue | null>(null)

/** Wraps the application to provide exercise selection state. */
export function ExerciseProvider({ children }: { children: ReactNode }) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseDefinition | null>(null)

  return (
    <ExerciseContext.Provider value={{ selectedExercise, setSelectedExercise }}>
      {children}
    </ExerciseContext.Provider>
  )
}

/**
 * Hook to access exercise selection state.
 * Must be used within <ExerciseProvider>.
 */
export function useSelectedExercise(): ExerciseContextValue {
  const ctx = useContext(ExerciseContext)
  if (!ctx) {
    throw new Error('useSelectedExercise must be used within <ExerciseProvider>')
  }
  return ctx
}
