/**
 * True Reference — types.
 *
 * A TrueReference is a structured, landmark-based representation of the
 * ideal form for an exercise, broken into named movement phases.
 *
 * It is NOT a static image. It is a set of normalised landmark positions
 * that can be rendered as a ghost skeleton over the camera feed.
 *
 * Design principles:
 *  - Modular: a trained ML temporal model can replace or augment the
 *    static reference poses at any time without changing consumers.
 *  - Phase-aware: each exercise has 3-5 named phases with their own
 *    reference pose and expected angle targets.
 *  - Comparison-ready: ReferenceComparison is the output of comparing
 *    a live pose against the appropriate reference phase.
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import type { MovementPhase } from '../analysis/analysisTypes'

// ── Reference pose ────────────────────────────────────────────────────────────

/**
 * A single reference position: 33 normalised landmark positions.
 * All coordinates are in [0..1] image space matching MediaPipe output.
 * Visibility is set to 1 for landmarks that are well-defined for this phase,
 * and < 0.5 for landmarks that are irrelevant / occluded in the reference.
 */
export type ReferencePose = NormalizedLandmark[]

/**
 * One phase of an exercise with its reference pose and expected angles.
 */
export interface ReferencePhase {
  /** Maps to MovementPhase from analysis engine. */
  phase: MovementPhase
  /** Human-readable label shown in the UI. */
  label: string
  /** Brief instruction for this phase. */
  instruction: string
  /** The ideal landmark positions for this phase. */
  pose: ReferencePose
  /**
   * Expected joint angles for key joints at this phase.
   * Used for reference comparison display.
   */
  expectedAngles: Record<string, number>
  /**
   * Joints that are most critical to monitor during this phase.
   * Deviations at these joints should be highlighted prominently.
   */
  keyJoints: string[]
}

/**
 * The full True Reference for one exercise.
 * Contains all movement phases in temporal order.
 */
export interface TrueReference {
  exerciseId: string
  exerciseName: string
  phases: ReferencePhase[]
}

// ── Reference comparison output ───────────────────────────────────────────────

export type DeviationSeverity = 'INFO' | 'WARNING' | 'ERROR'
export type CorrectionDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'INWARD' | 'OUTWARD' | 'FORWARD' | 'BACK' | 'NONE'

/**
 * A single joint-level deviation from the True Reference.
 * This is the structured output of comparing a live pose to a reference phase.
 */
export interface JointDeviation {
  /** e.g. "Left Knee", "Right Elbow", "Hip Alignment" */
  affectedJoint: string
  /** Landmark index(es) involved (for highlighting on canvas). */
  landmarkIndices: number[]
  /** The reference angle value (degrees). */
  referenceAngle: number
  /** The user's measured angle (degrees). */
  userAngle: number
  /** Absolute difference in degrees. */
  deviationValue: number
  severity: DeviationSeverity
  /** Which way the user should move to correct. */
  correctionDirection: CorrectionDirection
  /** Human-readable correction instruction. */
  correctionText: string
  /** Confidence of this deviation measurement [0–1]. */
  confidence: number
  /** Timestamp (ms since session start) or frame index. */
  timestamp: number
}

/**
 * Full comparison result for one frame against one reference phase.
 */
export interface ReferenceComparison {
  exerciseId: string
  phase: MovementPhase
  phaseLabel: string
  /** All joint deviations detected this frame. */
  jointDeviations: JointDeviation[]
  /** The single most significant deviation (for concise UI display). */
  primaryDeviation: JointDeviation | null
  /** 0–100 overall match score for this frame. 100 = perfect match. */
  overallMatchScore: number
  /** Whether the user's pose sufficiently matches the reference. */
  matched: boolean
  /** Snapshot of user's landmarks at this frame (for exact mistake display). */
  userLandmarkSnapshot: NormalizedLandmark[]
  /** The reference phase used for comparison. */
  referencePhase: ReferencePhase
}

/**
 * Accumulated per-rep reference analysis result.
 * Built up during a rep and finalised at rep completion.
 */
export interface RepReferenceAnalysis {
  repIndex: number
  /** Per-phase best comparison result (lowest deviation). */
  phaseResults: Partial<Record<MovementPhase, ReferenceComparison>>
  /** Worst deviation frame across all phases — the "exact mistake frame". */
  worstMistakeFrame: ReferenceComparison | null
  /** Average match score across all phases. */
  averageMatchScore: number
}
