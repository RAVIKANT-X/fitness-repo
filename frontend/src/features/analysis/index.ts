/**
 * Analysis feature — public API barrel.
 *
 * External consumers import from this file, not from individual modules.
 * This keeps the internal module structure refactoring-safe.
 */

// Types
export type {
  MovementPhase,
  RepCycleState,
  Deviation,
  DeviationSeverity,
  FormStatus,
  ActiveArm,
  AnalysisState,
  AnalysisResult,
} from './analysisTypes'
export { createInitialAnalysisState } from './analysisTypes'

// Engine entry point
export { analyze } from './analysisEngine'

// Thresholds (exported for testing / tuning)
export { SQUAT, PUSHUP, CURL, GENERAL } from './analysisThresholds'
