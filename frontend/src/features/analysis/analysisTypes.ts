/**
 * Analysis feature — shared types for Phase 4.
 *
 * Separation of concerns:
 *
 *   MovementPhase    — what the body is physically doing right now
 *   RepCycleState    — where the rep-counting state machine is
 *   Deviation        — a structured form-quality observation
 *   FormStatus       — aggregate quality signal for the UI
 *   AnalysisResult   — the complete output of one analysis frame
 *   AnalysisState    — mutable state threaded between frames (passed to engine, returned)
 *
 * No React types. No UI strings. No MediaPipe imports.
 * The engine is fully testable without a browser.
 */

import type { JointAngles } from '../biomechanics/biomechanicsTypes'

// ── Movement Phase ────────────────────────────────────────────────────────────

/**
 * Describes the user's current physical position in an exercise movement.
 *
 * These names are exercise-agnostic; contextual meaning is applied by each
 * exercise analyser:
 *
 *   Squat:   STANDING | DESCENDING | BOTTOM   | ASCENDING
 *   Push-up: TOP      | DESCENDING | BOTTOM   | ASCENDING
 *   Curl:    EXTENDED | CURLING    | PEAK     | RETURNING
 *
 * UNKNOWN is the initial state before any reliable reading is available.
 * INVALID is used when required landmarks are not visible.
 */
export type MovementPhase =
  | 'UNKNOWN'
  | 'INVALID'
  | 'STANDING'      // Squat: upright position
  | 'DESCENDING'    // Squat/Push-up: moving downward
  | 'BOTTOM'        // Squat/Push-up: lowest point
  | 'ASCENDING'     // Squat/Push-up: moving upward
  | 'TOP'           // Push-up: arms extended at top
  | 'EXTENDED'      // Curl: arm(s) fully extended
  | 'CURLING'       // Curl: flexing the elbow
  | 'PEAK'          // Curl: maximum contraction
  | 'RETURNING'     // Curl: returning to extended

// ── Rep Cycle State ───────────────────────────────────────────────────────────

/**
 * Tracks where the repetition-counting state machine is.
 *
 * Intentionally separate from MovementPhase:
 *  - MovementPhase can oscillate (DESCENDING ↔ ASCENDING due to noise)
 *  - RepCycleState only advances forward; never regresses
 *
 * IDLE     → waiting for the movement to begin
 * STARTED  → movement has begun (passed the start threshold)
 * DEPTH    → confirmed deepest position (passed the bottom threshold)
 * RETURNING→ confirmed moving back toward start
 * COMPLETE → full cycle confirmed; rep will be counted
 */
export type RepCycleState = 'IDLE' | 'STARTED' | 'DEPTH' | 'RETURNING' | 'COMPLETE'

// ── Deviation ─────────────────────────────────────────────────────────────────

export type DeviationSeverity = 'INFO' | 'WARNING' | 'ERROR'

/**
 * A single form observation. Contains structured data — NOT human-readable text.
 * The UI layer maps `id` to a display string.
 *
 * Identifiers (id) are namespaced to their exercise:
 *   DEPTH_TOO_SHALLOW, KNEE_ASYMMETRY, ELBOW_ASYMMETRY,
 *   INCOMPLETE_CURL, INCOMPLETE_EXTENSION, SHOULDER_MOVEMENT, ...
 */
export interface Deviation {
  /** Structured identifier — maps to a UI message in WorkoutFeedback. */
  id: string
  severity: DeviationSeverity
  /** The angle name that triggered this deviation (optional). */
  angleName?: string
  /** The value that was observed (degrees). */
  observed: number
  /** The threshold that was violated. */
  threshold: number
}

// ── Form Status ───────────────────────────────────────────────────────────────

/**
 * Aggregate form quality signal:
 *   GOOD    → no WARNING or ERROR deviations
 *   WARNING → one or more WARNING deviations
 *   INVALID → required landmarks not visible; analysis paused
 */
export type FormStatus = 'GOOD' | 'WARNING' | 'INVALID'

// ── Active Arm (Curl) ─────────────────────────────────────────────────────────

/**
 * For curl analysis: which arm is performing the movement.
 * BILATERAL means both arms are tracked (future extension).
 * NONE means no arm has been selected yet (initial / invalid state).
 */
export type ActiveArm = 'LEFT' | 'RIGHT' | 'BILATERAL' | 'NONE'

// ── Analysis State (inter-frame mutable state) ────────────────────────────────

/**
 * All mutable state that the analysis engine carries between frames.
 * The engine receives the previous state and returns a new (updated) state.
 *
 * Fields:
 *   repCount         — total reps completed so far
 *   repCycleState    — current position in the rep-counting state machine
 *   currentPhase     — detected MovementPhase for the current frame
 *   repDeviations    — deviations accumulated during the current rep cycle
 *   minAngleDuringCycle  — deepest angle observed since the rep started (degrees)
 *   maxAngleDuringCycle  — most extended angle observed since the rep started
 *   activeArm        — for curl: which arm is being tracked
 *   shoulderBaseline — for curl: initial shoulder angle(s) captured at EXTENDED
 *   lastCompletedRepDeviations — deviations from the most recently completed rep
 */
export interface AnalysisState {
  repCount: number
  repCycleState: RepCycleState
  currentPhase: MovementPhase
  /** Deviations collected during the in-progress cycle (evaluated at rep-complete). */
  repDeviations: Deviation[]
  /** Minimum joint angle observed during the current rep cycle (deepest position). */
  minAngleDuringCycle: number
  /** Maximum joint angle observed during the current rep cycle (most extended). */
  maxAngleDuringCycle: number
  /** Curl-specific: which arm is actively being tracked. */
  activeArm: ActiveArm
  /** Curl-specific: shoulder angle at the start position (baseline). */
  shoulderBaseline: number | null
  /** Deviations attached to the most recently completed rep (for stable UI display). */
  lastCompletedRepDeviations: Deviation[]
}

// ── Analysis Result ───────────────────────────────────────────────────────────

/**
 * The complete output produced by the analysis engine for one frame.
 * Consumed by React UI — contains no React types.
 *
 * `landmarksValid` false → UI shows "Adjust position / body not fully visible".
 */
export interface AnalysisResult {
  exerciseId: string
  /** Whether required landmarks were visible this frame. */
  landmarksValid: boolean
  currentPhase: MovementPhase
  repCycleState: RepCycleState
  repCount: number
  formStatus: FormStatus
  /**
   * Active deviations for display. During an in-progress rep: empty.
   * After rep completes: deviations from that rep (stable until next rep).
   */
  activeDeviations: Deviation[]
  /** Calculated joint angles for this frame (for debug / angle display). */
  angles: JointAngles
  /** Updated state to pass back into the engine on the next frame. */
  nextState: AnalysisState
}

// ── Initial State Factory ─────────────────────────────────────────────────────

/** Returns a clean initial AnalysisState for a given exercise. */
export function createInitialAnalysisState(): AnalysisState {
  return {
    repCount: 0,
    repCycleState: 'IDLE',
    currentPhase: 'UNKNOWN',
    repDeviations: [],
    minAngleDuringCycle: Infinity,
    maxAngleDuringCycle: -Infinity,
    activeArm: 'NONE',
    shoulderBaseline: null,
    lastCompletedRepDeviations: [],
  }
}
