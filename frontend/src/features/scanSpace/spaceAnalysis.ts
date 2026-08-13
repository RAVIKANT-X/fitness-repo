/**
 * Space Analysis Engine — estimates user position relative to workspace objects.
 *
 * Because we only have a 2D camera without depth sensors we use:
 *   - Relative landmark positions (normalised [0..1] image coords)
 *   - Body proportions as a ruler (shoulder width ≈ known reference)
 *   - Heuristics for desk/chair proximity
 *
 * We do NOT claim exact centimetre distances.
 * We DO produce relative categories: TOO_CLOSE / GOOD / TOO_FAR / SHIFTED_LEFT / SHIFTED_RIGHT
 *
 * Space analysis is cached and re-evaluated at a low frequency (~2–4fps) to
 * avoid thrashing.
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SpaceCategory = 'VERY_SMALL' | 'SMALL' | 'MEDIUM' | 'LARGE'
export type PositionStatus =
  | 'TOO_CLOSE'
  | 'GOOD'
  | 'TOO_FAR'
  | 'SHIFTED_LEFT'
  | 'SHIFTED_RIGHT'
  | 'UNKNOWN'

export interface DetectedObject {
  type: 'desk' | 'chair' | 'screen' | 'wall' | 'open_space'
  confidence: number
  label: string
}

export interface UserPosition {
  status: PositionStatus
  /** Directional arrow to show user (null when GOOD or UNKNOWN) */
  arrow: '←' | '→' | '↑' | '↓' | null
  coaching: string | null
  optimized: boolean
}

export interface SpaceAnalysisResult {
  /** Estimated workspace size category */
  workspaceSize: SpaceCategory
  /** Objects we have reasonable evidence for */
  detectedObjects: DetectedObject[]
  /** User's position relative to workspace */
  userPosition: UserPosition
  /** Overall space analysis message */
  summary: string
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function vis(lm: NormalizedLandmark | undefined, threshold = 0.35): boolean {
  return (lm?.visibility ?? 0) >= threshold
}

/**
 * Estimates shoulder width in normalised coords.
 * This is our body-proportional "ruler" for distance estimation.
 */
function shoulderWidthNorm(lms: NormalizedLandmark[]): number | null {
  const l = lms[PoseLandmark.LEFT_SHOULDER]
  const r = lms[PoseLandmark.RIGHT_SHOULDER]
  if (!vis(l) || !vis(r)) return null
  return Math.abs((l?.x ?? 0) - (r?.x ?? 0))
}

/**
 * Body centre X in image space (0=left, 1=right).
 * For front-camera (mirrored video), left/right in image matches user's left/right.
 */
function bodyCentreX(lms: NormalizedLandmark[]): number | null {
  const lS = lms[PoseLandmark.LEFT_SHOULDER]
  const rS = lms[PoseLandmark.RIGHT_SHOULDER]
  const lH = lms[PoseLandmark.LEFT_HIP]
  const rH = lms[PoseLandmark.RIGHT_HIP]

  const pts: NormalizedLandmark[] = []
  if (vis(lS)) pts.push(lS!)
  if (vis(rS)) pts.push(rS!)
  if (vis(lH)) pts.push(lH!)
  if (vis(rH)) pts.push(rH!)

  if (pts.length === 0) return null
  return pts.reduce((s, p) => s + p.x, 0) / pts.length
}

/**
 * Estimates how far the user is from the camera using shoulder width.
 * Larger shoulder-width in frame → closer to camera.
 * Typical comfortable desk distance: 0.20–0.35 normalised shoulder width.
 */
function estimateProximity(swNorm: number): 'TOO_CLOSE' | 'GOOD' | 'TOO_FAR' {
  if (swNorm > 0.42)  return 'TOO_CLOSE'
  if (swNorm < 0.15)  return 'TOO_FAR'
  return 'GOOD'
}

/**
 * Estimates centering: body centre should be near 0.5 (image midpoint).
 * Offset > 0.12 is shifted.
 */
function estimateCentering(centreX: number): 'GOOD' | 'SHIFTED_LEFT' | 'SHIFTED_RIGHT' {
  const offset = centreX - 0.5
  if (offset < -0.12) return 'SHIFTED_RIGHT'   // body is left in image = user shifted right in mirror
  if (offset >  0.12) return 'SHIFTED_LEFT'
  return 'GOOD'
}

// ── Object detection via heuristics ──────────────────────────────────────────

/**
 * "Detects" workspace objects from pose context.
 * We cannot do real object detection without an OD model,
 * so we use body-context clues and conservative confidence values.
 */
function detectObjects(lms: NormalizedLandmark[], activity: string): DetectedObject[] {
  const objects: DetectedObject[] = []

  const lS = lms[PoseLandmark.LEFT_SHOULDER]
  const rS = lms[PoseLandmark.RIGHT_SHOULDER]
  const lH = lms[PoseLandmark.LEFT_HIP]
  const rH = lms[PoseLandmark.RIGHT_HIP]

  const upperBodyPresent = vis(lS) || vis(rS)
  const hipsPresent      = vis(lH) || vis(rH)

  // Desk inference: if upper body visible at bottom half of frame
  // and user is sitting, a desk is likely in front
  if (upperBodyPresent && (activity === 'DESK_SITTING' || activity === 'READING')) {
    objects.push({ type: 'desk', confidence: 0.72, label: 'Desk' })
    objects.push({ type: 'chair', confidence: 0.65, label: 'Chair' })
  }

  // Screen inference: upper body sitting + forward head posture context
  if (upperBodyPresent && hipsPresent && (activity === 'DESK_SITTING')) {
    objects.push({ type: 'screen', confidence: 0.55, label: 'Screen (likely)' })
  }

  if (objects.length === 0 && upperBodyPresent) {
    objects.push({ type: 'open_space', confidence: 0.60, label: 'Open area' })
  }

  return objects
}

/**
 * Estimates workspace size from body proportion in frame.
 * Very large body fill → small space (or very close camera).
 * Very small body fill → larger detected area.
 */
function estimateWorkspaceSize(swNorm: number | null): SpaceCategory {
  if (swNorm === null) return 'MEDIUM'
  if (swNorm > 0.50) return 'VERY_SMALL'
  if (swNorm > 0.35) return 'SMALL'
  if (swNorm > 0.18) return 'MEDIUM'
  return 'LARGE'
}

// ── Position coaching ─────────────────────────────────────────────────────────

function buildUserPosition(
  proximity: 'TOO_CLOSE' | 'GOOD' | 'TOO_FAR' | 'UNKNOWN',
  centering: 'GOOD' | 'SHIFTED_LEFT' | 'SHIFTED_RIGHT' | 'UNKNOWN',
): UserPosition {
  // Centering takes priority for direction arrows
  if (centering === 'SHIFTED_LEFT') {
    return {
      status: 'SHIFTED_LEFT',
      arrow: '←',
      coaching: 'Center yourself with your screen — move slightly left.',
      optimized: false,
    }
  }
  if (centering === 'SHIFTED_RIGHT') {
    return {
      status: 'SHIFTED_RIGHT',
      arrow: '→',
      coaching: 'Center yourself with your screen — move slightly right.',
      optimized: false,
    }
  }

  if (proximity === 'TOO_CLOSE') {
    return {
      status: 'TOO_CLOSE',
      arrow: '↑',
      coaching: 'Move your chair slightly backward — you appear too close to your desk.',
      optimized: false,
    }
  }
  if (proximity === 'TOO_FAR') {
    return {
      status: 'TOO_FAR',
      arrow: '↓',
      coaching: 'Move your chair slightly closer to your desk.',
      optimized: false,
    }
  }
  if (proximity === 'GOOD' && centering === 'GOOD') {
    return {
      status: 'GOOD',
      arrow: null,
      coaching: null,
      optimized: true,
    }
  }

  return { status: 'UNKNOWN', arrow: null, coaching: null, optimized: false }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyse the user's spatial relationship with their workspace.
 *
 * @param landmarks  - 33 normalised MediaPipe landmarks
 * @param activity   - Current activity string from activityRecognition
 */
export function analyseSpace(
  landmarks: NormalizedLandmark[],
  activity: string,
): SpaceAnalysisResult {
  if (!landmarks || landmarks.length < 13) {
    return {
      workspaceSize: 'MEDIUM',
      detectedObjects: [],
      userPosition: { status: 'UNKNOWN', arrow: null, coaching: null, optimized: false },
      summary: 'Move into frame for space analysis.',
    }
  }

  const swNorm       = shoulderWidthNorm(landmarks)
  const centreX      = bodyCentreX(landmarks)
  const workspaceSize = estimateWorkspaceSize(swNorm)

  const proximity   = swNorm !== null ? estimateProximity(swNorm) : 'UNKNOWN' as const
  const centering   = centreX !== null ? estimateCentering(centreX) : 'UNKNOWN' as const

  const userPosition    = buildUserPosition(proximity, centering)
  const detectedObjects = detectObjects(landmarks, activity)

  const sizeName: Record<SpaceCategory, string> = {
    VERY_SMALL: 'Very small workspace',
    SMALL:      'Small workspace',
    MEDIUM:     'Medium workspace',
    LARGE:      'Spacious area',
  }

  const summary = userPosition.optimized
    ? `You're in a good working position. ${sizeName[workspaceSize]}.`
    : (userPosition.coaching ?? `${sizeName[workspaceSize]} detected.`)

  return { workspaceSize, detectedObjects, userPosition, summary }
}
