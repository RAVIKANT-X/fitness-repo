/**
 * Ghost Synchronization — phase-based reference landmark interpolation.
 *
 * Instead of playing the reference animation on an independent timer,
 * we synchronise the ghost to the USER's current movement phase and
 * interpolate smoothly between reference phase poses.
 *
 * Key design:
 *  - Determine the user's movement "progress" within a phase (0–1)
 *  - Map that to a position in the reference sequence
 *  - Interpolate reference landmarks between adjacent phase poses
 *  - Apply body-relative normalisation: adapt to user position/scale
 *  - Apply temporal smoothing to prevent jitter
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import type { MovementPhase } from '../analysis/analysisTypes'
import type { TrueReference } from './referenceTypes'

// ── Body-relative normalisation ───────────────────────────────────────────────

/**
 * Key anchor landmarks used for body-relative normalisation.
 * We compute the body bounding box from these and rescale the reference
 * ghost to match the user's actual body size/position in frame.
 */
const LEFT_SHOULDER  = 11
const RIGHT_SHOULDER = 12
const LEFT_HIP       = 23
const RIGHT_HIP      = 24

export interface BodyFrame {
  /** Centre of body (mid-shoulder) */
  cx: number
  cy: number
  /** Half-width of shoulders */
  hw: number
  /** Torso height (shoulder to hip) */
  th: number
}

/**
 * Computes the user's body frame (position + scale) from live landmarks.
 * Returns null if required landmarks are not visible.
 */
export function computeBodyFrame(landmarks: NormalizedLandmark[]): BodyFrame | null {
  const ls = landmarks[LEFT_SHOULDER]
  const rs = landmarks[RIGHT_SHOULDER]
  const lh = landmarks[LEFT_HIP]
  const rh = landmarks[RIGHT_HIP]

  if (!ls || !rs || !lh || !rh) return null
  if ((ls.visibility ?? 0) < 0.3 || (rs.visibility ?? 0) < 0.3) return null

  const cx = (ls.x + rs.x) / 2
  const cy = (ls.y + rs.y) / 2
  const hw = Math.abs(ls.x - rs.x) / 2
  const hipCy = (lh.y + rh.y) / 2
  const th = Math.max(Math.abs(cy - hipCy), 0.05)

  return { cx, cy, hw: Math.max(hw, 0.05), th }
}

/**
 * Computes the reference pose's body frame from its landmarks.
 */
export function computeRefBodyFrame(landmarks: NormalizedLandmark[]): BodyFrame | null {
  return computeBodyFrame(landmarks)
}

/**
 * Transforms reference landmarks into user-relative coordinates.
 * Maps the reference body frame onto the user's body frame,
 * so the ghost stays aligned regardless of scale/position.
 */
export function adaptReferenceToUser(
  refLandmarks: NormalizedLandmark[],
  refFrame: BodyFrame,
  userFrame: BodyFrame,
): NormalizedLandmark[] {
  const scaleX = userFrame.hw / refFrame.hw
  const scaleY = userFrame.th / refFrame.th

  return refLandmarks.map((lm) => ({
    x: userFrame.cx + (lm.x - refFrame.cx) * scaleX,
    y: userFrame.cy + (lm.y - refFrame.cy) * scaleY,
    z: lm.z * scaleX,
    visibility: lm.visibility,
  }))
}

// ── Phase-based interpolation ─────────────────────────────────────────────────

/** Phase ordering for each exercise — the temporal sequence. */
const PHASE_ORDER: Record<string, MovementPhase[]> = {
  squat:  ['STANDING', 'DESCENDING', 'BOTTOM', 'ASCENDING'],
  pushup: ['TOP', 'DESCENDING', 'BOTTOM', 'ASCENDING'],
  curl:   ['EXTENDED', 'CURLING', 'PEAK', 'RETURNING'],
}

/**
 * Get the phase index (0-based) in the canonical sequence.
 */
function phaseIndex(exerciseId: string, phase: MovementPhase): number {
  return PHASE_ORDER[exerciseId]?.indexOf(phase) ?? 0
}

/**
 * Linearly interpolate between two landmark arrays.
 * alpha = 0 → posesA, alpha = 1 → posesB
 */
export function interpolatePoses(
  poseA: NormalizedLandmark[],
  poseB: NormalizedLandmark[],
  alpha: number,
): NormalizedLandmark[] {
  const t = Math.max(0, Math.min(1, alpha))
  const len = Math.min(poseA.length, poseB.length)
  const result: NormalizedLandmark[] = new Array(len)

  for (let i = 0; i < len; i++) {
    const a = poseA[i]
    const b = poseB[i]
    result[i] = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
    }
  }

  return result
}

// ── Temporal smoothing ────────────────────────────────────────────────────────

const SMOOTH_ALPHA = 0.35  // EMA factor — higher = more responsive, lower = smoother

/**
 * Applies exponential moving average smoothing to a landmark array.
 * Prevents jitter in the ghost pose.
 */
export function smoothLandmarks(
  prev: NormalizedLandmark[],
  next: NormalizedLandmark[],
  alpha: number = SMOOTH_ALPHA,
): NormalizedLandmark[] {
  if (prev.length === 0) return next
  return interpolatePoses(prev, next, alpha)
}

// ── Ghost pose resolver ───────────────────────────────────────────────────────

/**
 * Computes the phase-synchronised, body-adapted, smoothed reference ghost
 * for the current frame.
 *
 * @param reference      - Full TrueReference for the exercise
 * @param currentPhase   - User's detected movement phase
 * @param exerciseId     - Exercise identifier
 * @param userLandmarks  - User's live pose landmarks
 * @param prevGhost      - Previous smoothed ghost (for temporal smoothing)
 * @param phaseProgress  - Optional 0–1 progress within the current phase
 * @returns              - Adapted, smoothed landmark array for the ghost
 */
export function resolveGhostPose(
  reference: TrueReference,
  currentPhase: MovementPhase,
  exerciseId: string,
  userLandmarks: NormalizedLandmark[],
  prevGhost: NormalizedLandmark[],
  phaseProgress = 0.5,
): NormalizedLandmark[] {
  // 1. Find current and next reference phase poses
  const phases  = PHASE_ORDER[exerciseId]
  const refMap  = Object.fromEntries(reference.phases.map((p) => [p.phase, p.pose]))

  const currentRefPose = refMap[currentPhase] ?? reference.phases[0]?.pose
  if (!currentRefPose) return prevGhost

  const idx      = phases ? phaseIndex(exerciseId, currentPhase) : 0
  const nextPhase = phases?.[idx + 1]
  const nextRefPose = nextPhase ? refMap[nextPhase] : null

  // 2. Interpolate between current and next phase based on progress
  const rawRef = nextRefPose
    ? interpolatePoses(currentRefPose, nextRefPose, phaseProgress)
    : currentRefPose

  // 3. Adapt reference to user body frame
  const userFrame = computeBodyFrame(userLandmarks)
  const refFrame  = computeRefBodyFrame(rawRef)

  const adaptedRef = userFrame && refFrame
    ? adaptReferenceToUser(rawRef, refFrame, userFrame)
    : rawRef

  // 4. Temporal smoothing
  return smoothLandmarks(prevGhost, adaptedRef)
}
