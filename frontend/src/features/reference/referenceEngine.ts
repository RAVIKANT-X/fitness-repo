/**
 * Reference comparison engine — compares a live pose frame against the
 * True Reference for the current movement phase.
 *
 * Pure functions — no React, no side effects, no singletons.
 * Designed to be swapped for a trained ML temporal model in a future phase.
 *
 * Pipeline:
 *  1. Find the matching reference phase for the current MovementPhase
 *  2. Calculate joint angles for both user and reference poses
 *  3. Compare each key angle pair → produce JointDeviation[]
 *  4. Select the primary (worst) deviation
 *  5. Score overall match (0–100)
 *  6. Return ReferenceComparison
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import type { MovementPhase } from '../analysis/analysisTypes'
import type {
  ReferenceComparison,
  JointDeviation,
  ReferencePhase,
  CorrectionDirection,
} from './referenceTypes'
import { calculateExerciseAngles } from '../biomechanics/angles'
import { PoseLandmark } from '../biomechanics/landmarkMapping'
import type { AngleDefinition } from '../biomechanics/biomechanicsTypes'

// ── Angle definitions used for comparison ─────────────────────────────────────

const COMPARISON_ANGLES: AngleDefinition[] = [
  { name: 'leftKneeAngle',          pointA: PoseLandmark.LEFT_HIP,       vertex: PoseLandmark.LEFT_KNEE,      pointC: PoseLandmark.LEFT_ANKLE },
  { name: 'rightKneeAngle',         pointA: PoseLandmark.RIGHT_HIP,      vertex: PoseLandmark.RIGHT_KNEE,     pointC: PoseLandmark.RIGHT_ANKLE },
  { name: 'leftHipAngle',           pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_HIP,       pointC: PoseLandmark.LEFT_KNEE },
  { name: 'rightHipAngle',          pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_HIP,      pointC: PoseLandmark.RIGHT_KNEE },
  { name: 'leftElbowAngle',         pointA: PoseLandmark.LEFT_SHOULDER,  vertex: PoseLandmark.LEFT_ELBOW,     pointC: PoseLandmark.LEFT_WRIST },
  { name: 'rightElbowAngle',        pointA: PoseLandmark.RIGHT_SHOULDER, vertex: PoseLandmark.RIGHT_ELBOW,    pointC: PoseLandmark.RIGHT_WRIST },
  { name: 'leftShoulderStability',  pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,  pointC: PoseLandmark.LEFT_HIP },
  { name: 'rightShoulderStability', pointA: PoseLandmark.RIGHT_ELBOW,    vertex: PoseLandmark.RIGHT_SHOULDER, pointC: PoseLandmark.RIGHT_HIP },
  { name: 'leftShoulderAngle',      pointA: PoseLandmark.LEFT_ELBOW,     vertex: PoseLandmark.LEFT_SHOULDER,  pointC: PoseLandmark.LEFT_HIP },
  { name: 'rightShoulderAngle',     pointA: PoseLandmark.RIGHT_ELBOW,    vertex: PoseLandmark.RIGHT_SHOULDER, pointC: PoseLandmark.RIGHT_HIP },
]

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Deviation < this → no deviation reported for this joint */
const INFO_THRESHOLD    = 10   // degrees
const WARNING_THRESHOLD = 20   // degrees
const ERROR_THRESHOLD   = 35   // degrees

/** Match score: at this deviation (degrees) the score hits 0 for that joint */
const SCORE_ZERO_AT = 60

// ── Joint metadata ────────────────────────────────────────────────────────────

interface JointMeta {
  label: string
  landmarkIndices: number[]
  angleName: string
  getCorrectionDirection: (ref: number, user: number) => CorrectionDirection
  getCorrectionText: (ref: number, user: number, dir: CorrectionDirection) => string
}

const JOINT_META: JointMeta[] = [
  {
    label: 'Left Knee',
    landmarkIndices: [PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE, PoseLandmark.LEFT_ANKLE],
    angleName: 'leftKneeAngle',
    getCorrectionDirection: (ref, user) => user < ref ? 'UP' : 'DOWN',
    getCorrectionText: (ref, user, dir) =>
      dir === 'UP'
        ? `Straighten your left knee — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`
        : `Bend your left knee more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`,
  },
  {
    label: 'Right Knee',
    landmarkIndices: [PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE, PoseLandmark.RIGHT_ANKLE],
    angleName: 'rightKneeAngle',
    getCorrectionDirection: (ref, user) => user < ref ? 'UP' : 'DOWN',
    getCorrectionText: (ref, user, dir) =>
      dir === 'UP'
        ? `Straighten your right knee — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`
        : `Bend your right knee more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`,
  },
  {
    label: 'Left Hip',
    landmarkIndices: [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP, PoseLandmark.LEFT_KNEE],
    angleName: 'leftHipAngle',
    getCorrectionDirection: (ref, user) => user < ref ? 'UP' : 'DOWN',
    getCorrectionText: (ref, user, dir) =>
      dir === 'UP'
        ? `Open your left hip — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`
        : `Hinge your left hip more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`,
  },
  {
    label: 'Right Hip',
    landmarkIndices: [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP, PoseLandmark.RIGHT_KNEE],
    angleName: 'rightHipAngle',
    getCorrectionDirection: (ref, user) => user < ref ? 'UP' : 'DOWN',
    getCorrectionText: (ref, user, dir) =>
      dir === 'UP'
        ? `Open your right hip — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`
        : `Hinge your right hip more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`,
  },
  {
    label: 'Left Elbow',
    landmarkIndices: [PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_WRIST],
    angleName: 'leftElbowAngle',
    getCorrectionDirection: (ref, user) => user < ref ? 'OUTWARD' : 'INWARD',
    getCorrectionText: (ref, user, dir) =>
      dir === 'OUTWARD'
        ? `Extend your left elbow more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`
        : `Bend your left elbow more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`,
  },
  {
    label: 'Right Elbow',
    landmarkIndices: [PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_WRIST],
    angleName: 'rightElbowAngle',
    getCorrectionDirection: (ref, user) => user < ref ? 'OUTWARD' : 'INWARD',
    getCorrectionText: (ref, user, dir) =>
      dir === 'OUTWARD'
        ? `Extend your right elbow more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`
        : `Bend your right elbow more — reference: ${ref.toFixed(0)}°, yours: ${user.toFixed(0)}°`,
  },
  {
    label: 'Left Shoulder',
    landmarkIndices: [PoseLandmark.LEFT_ELBOW, PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP],
    angleName: 'leftShoulderStability',
    getCorrectionDirection: () => 'BACK',
    getCorrectionText: (_ref, _user) => 'Keep your left shoulder still — avoid swinging forward',
  },
  {
    label: 'Right Shoulder',
    landmarkIndices: [PoseLandmark.RIGHT_ELBOW, PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP],
    angleName: 'rightShoulderStability',
    getCorrectionDirection: () => 'BACK',
    getCorrectionText: (_ref, _user) => 'Keep your right shoulder still — avoid swinging forward',
  },
]

// ── Main comparison function ───────────────────────────────────────────────────

/**
 * Compares a live pose frame against a reference phase.
 *
 * @param userLandmarks   - 33 normalised landmarks from the live camera
 * @param refPhase        - The reference phase to compare against
 * @param currentPhase    - Current detected MovementPhase
 * @param exerciseId      - Exercise identifier
 * @param timestamp       - Frame timestamp (ms)
 * @param confidenceBoost - Optional confidence modifier for filtered frames
 */
export function compareToReference(
  userLandmarks: NormalizedLandmark[],
  refPhase: ReferencePhase,
  currentPhase: MovementPhase,
  exerciseId: string,
  timestamp: number,
  confidenceBoost = 1.0,
): ReferenceComparison {
  // Calculate angles for both user and reference
  const userAngles  = calculateExerciseAngles(COMPARISON_ANGLES, userLandmarks)
  const refAngles   = calculateExerciseAngles(COMPARISON_ANGLES, refPhase.pose)

  const jointDeviations: JointDeviation[] = []

  for (const meta of JOINT_META) {
    const expectedAngle = refPhase.expectedAngles[meta.angleName]
    if (expectedAngle === undefined) continue  // not relevant for this phase

    const userAngleResult = userAngles[meta.angleName]
    // refAngles available for future use (e.g. rendering reference skeleton)
    void refAngles[meta.angleName]

    if (!userAngleResult?.valid) continue  // landmark not visible

    const userAngle = userAngleResult.degrees
    // Use pre-defined expectedAngles as the canonical reference (more stable)
    const refAngle  = expectedAngle

    const deviationValue = Math.abs(userAngle - refAngle)
    if (deviationValue < INFO_THRESHOLD) continue  // within tolerance, no deviation

    const severity =
      deviationValue >= ERROR_THRESHOLD   ? 'ERROR'   :
      deviationValue >= WARNING_THRESHOLD ? 'WARNING' : 'INFO'

    const correctionDirection = meta.getCorrectionDirection(refAngle, userAngle)
    const correctionText      = meta.getCorrectionText(refAngle, userAngle, correctionDirection)

    // Confidence: average visibility of involved landmarks
    const visibilities = meta.landmarkIndices
      .map((i) => userLandmarks[i]?.visibility ?? 0.5)
    const confidence = (visibilities.reduce((a, b) => a + b, 0) / visibilities.length) * confidenceBoost

    jointDeviations.push({
      affectedJoint: meta.label,
      landmarkIndices: meta.landmarkIndices,
      referenceAngle: refAngle,
      userAngle,
      deviationValue,
      severity,
      correctionDirection,
      correctionText,
      confidence,
      timestamp,
    })
  }

  // Sort by deviation magnitude (worst first)
  jointDeviations.sort((a, b) => b.deviationValue - a.deviationValue)

  // Primary deviation = worst severity, then worst deviation
  const primaryDeviation =
    jointDeviations.find((d) => d.severity === 'ERROR') ??
    jointDeviations.find((d) => d.severity === 'WARNING') ??
    jointDeviations[0] ??
    null

  // Score: average of per-joint scores for relevant joints
  const relevantAngles = Object.keys(refPhase.expectedAngles)
  let totalScore = 0
  let scoreCount = 0
  for (const angleName of relevantAngles) {
    const userResult = userAngles[angleName]
    if (!userResult?.valid) continue
    const refAngle   = refPhase.expectedAngles[angleName]
    const dev        = Math.abs(userResult.degrees - refAngle)
    const score      = Math.max(0, 100 - (dev / SCORE_ZERO_AT) * 100)
    totalScore      += score
    scoreCount      += 1
  }
  const overallMatchScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 50
  const matched = overallMatchScore >= 75 && (primaryDeviation?.severity !== 'ERROR')

  return {
    exerciseId,
    phase: currentPhase,
    phaseLabel: refPhase.label,
    jointDeviations,
    primaryDeviation,
    overallMatchScore,
    matched,
    userLandmarkSnapshot: [...userLandmarks],
    referencePhase: refPhase,
  }
}

/**
 * Smooths a rolling window of match scores using exponential moving average.
 * Used by the live session to avoid jitter.
 */
export function smoothMatchScore(prevScore: number, newScore: number, alpha = 0.25): number {
  return Math.round(alpha * newScore + (1 - alpha) * prevScore)
}
