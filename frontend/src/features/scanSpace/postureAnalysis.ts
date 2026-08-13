/**
 * Posture Analysis Engine — desk/sitting posture scoring.
 *
 * Analyses MediaPipe 33-landmark pose output for desk-sitting scenarios.
 * Works entirely from landmark data — no image processing required.
 *
 * Output:
 *   PostureAnalysisResult — per-joint scores, overall score, coaching issues
 *
 * All angle arithmetic uses normalised image-space landmarks (x,y) for
 * 2-D analysis and world landmarks (z) where useful for depth hints.
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Public types ──────────────────────────────────────────────────────────────

export type PostureRating = 'GOOD' | 'FAIR' | 'POOR'

export interface PostureCheck {
  label: string
  rating: PostureRating
  /** Short human-readable description of what was found */
  detail: string
  /** If POOR/FAIR, the coaching message to show/speak */
  coaching: string | null
  /** 0–100 sub-score for this check */
  score: number
  /** Whether sufficient landmark data was available */
  measured: boolean
}

export interface PostureAnalysisResult {
  /** 0–100 overall posture score from measured checks only */
  overallScore: number
  /** Whether enough landmarks are visible to produce a reliable score */
  reliable: boolean
  checks: {
    headNeck: PostureCheck
    shoulderAlignment: PostureCheck
    torsoInclination: PostureCheck
    headForwardProtraction: PostureCheck
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function vis(lm: NormalizedLandmark | undefined): number {
  return lm?.visibility ?? 0
}

/** Returns true if the landmark has sufficient visibility */
function visible(lm: NormalizedLandmark | undefined, threshold = 0.4): boolean {
  return vis(lm) >= threshold
}

/**
 * Computes the angle (degrees) that vector (b→a) makes with vertical (upward y-axis).
 * In image space y increases downward, so "upward" is negative-y direction.
 * A perfectly upright torso gives ~0°. Forward lean gives positive degrees.
 */
function angleDegFromVertical(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by   // dy negative = a is above b in image space
  // Vector from b to a in image space. Upward = (0, -1)
  // angle = atan2(horizontal displacement, upward displacement)
  const angleRad = Math.atan2(Math.abs(dx), -dy)   // negative dy = upward
  return (angleRad * 180) / Math.PI
}

/**
 * Absolute horizontal offset between two points in normalised coords.
 */
function horizontalOffset(ax: number, bx: number): number {
  return Math.abs(ax - bx)
}

// ── Head/Neck tilt ────────────────────────────────────────────────────────────

/**
 * Measures head-tilt angle: angle of nose-to-ear midpoint vector from vertical.
 * Ideal: ~0–5°. Fair: 5–15°. Poor: >15°.
 */
function analyseHeadNeckTilt(lms: NormalizedLandmark[]): PostureCheck {
  const nose      = lms[PoseLandmark.NOSE]
  const lEar      = lms[PoseLandmark.LEFT_EAR]
  const rEar      = lms[PoseLandmark.RIGHT_EAR]
  const lShoulder = lms[PoseLandmark.LEFT_SHOULDER]
  const rShoulder = lms[PoseLandmark.RIGHT_SHOULDER]

  const hasHead      = visible(nose) && (visible(lEar) || visible(rEar))
  const hasShoulder  = visible(lShoulder) && visible(rShoulder)

  if (!hasHead || !hasShoulder) {
    return {
      label: 'Head Position',
      rating: 'FAIR',
      detail: 'Head not fully visible',
      coaching: null,
      score: 60,
      measured: false,
    }
  }

  const shoulderMidX = ((lShoulder?.x ?? 0) + (rShoulder?.x ?? 0)) / 2
  const shoulderMidY = ((lShoulder?.y ?? 0) + (rShoulder?.y ?? 0)) / 2

  const tiltAngle = angleDegFromVertical(
    nose!.x, nose!.y,
    shoulderMidX, shoulderMidY,
  )

  let rating: PostureRating
  let coaching: string | null
  let score: number
  let detail: string

  // Tightened thresholds (v2): normal seated tilt is ±6°; flag earlier
  if (tiltAngle <= 6) {
    rating = 'GOOD'; score = 100; detail = 'Neutral'; coaching = null
  } else if (tiltAngle <= 15) {
    rating = 'FAIR'; score = 65; detail = 'Slightly tilted'
    coaching = 'Try to keep your head directly above your shoulders.'
  } else {
    rating = 'POOR'; score = 25; detail = 'Tilted'
    coaching = 'Gently bring your head back over your shoulders to reduce neck strain.'
  }

  return { label: 'Head Position', rating, detail, coaching, score, measured: true }
}

// ── Forward head protraction (ear vs shoulder) ────────────────────────────────

/**
 * Classic "ear-over-shoulder" check.
 * When sitting the ear should be roughly above the shoulder.
 * Forward-head posture: ear is significantly in front of shoulder.
 * In normalised image-space: for a front-facing camera sitting person,
 * we compare the horizontal distance between ear and shoulder. A large
 * horizontal offset means the head is forward.
 */
function analyseForwardHead(lms: NormalizedLandmark[]): PostureCheck {
  const lEar      = lms[PoseLandmark.LEFT_EAR]
  const rEar      = lms[PoseLandmark.RIGHT_EAR]
  const lShoulder = lms[PoseLandmark.LEFT_SHOULDER]
  const rShoulder = lms[PoseLandmark.RIGHT_SHOULDER]

  // Prefer the more visible side
  const useLeft  = visible(lEar, 0.45) && visible(lShoulder, 0.45)
  const useRight = visible(rEar, 0.45) && visible(rShoulder, 0.45)

  if (!useLeft && !useRight) {
    return { label: 'Forward Head', rating: 'FAIR', detail: 'Not measurable', coaching: null, score: 60, measured: false }
  }

  // In image-space (front camera, mirrored): ear x-position vs shoulder x
  // A large offset indicates forward-head posture
  let earX = 0, shoulderX = 0, earY = 0, shoulderY = 0
  if (useLeft) {
    earX = lEar!.x; earY = lEar!.y
    shoulderX = lShoulder!.x; shoulderY = lShoulder!.y
  } else {
    earX = rEar!.x; earY = rEar!.y
    shoulderX = rShoulder!.x; shoulderY = rShoulder!.y
  }

  // Vertical separation: ear should be above shoulder
  const dyNorm = shoulderY - earY   // positive = ear above shoulder (good)
  // Horizontal separation normalised relative to vertical
  const dxNorm = horizontalOffset(earX, shoulderX)
  const forwardRatio = dyNorm > 0.02 ? dxNorm / dyNorm : dxNorm * 2

  let rating: PostureRating; let score: number; let detail: string; let coaching: string | null

  // Tightened: ideal ear-over-shoulder ratio < 0.20 (stricter than 0.25)
  if (forwardRatio < 0.20) {
    rating = 'GOOD'; score = 100; detail = 'Good'; coaching = null
  } else if (forwardRatio < 0.45) {
    rating = 'FAIR'; score = 60; detail = 'Slightly forward'
    coaching = 'Bring your screen closer to eye level to reduce forward head posture.'
  } else {
    rating = 'POOR'; score = 20; detail = 'Forward'
    coaching = 'Your head appears to be leaning forward. Raise your screen height or move it closer.'
  }

  return { label: 'Forward Head', rating, detail, coaching, score, measured: true }
}

// ── Shoulder alignment ────────────────────────────────────────────────────────

/**
 * Checks if shoulders are level (y-axis alignment).
 * A significant height difference indicates a raised or dropped shoulder.
 */
function analyseShoulderAlignment(lms: NormalizedLandmark[]): PostureCheck {
  const lShoulder = lms[PoseLandmark.LEFT_SHOULDER]
  const rShoulder = lms[PoseLandmark.RIGHT_SHOULDER]

  if (!visible(lShoulder) || !visible(rShoulder)) {
    return { label: 'Shoulder Alignment', rating: 'FAIR', detail: 'Not fully visible', coaching: null, score: 60, measured: false }
  }

  const shoulderWidth = horizontalOffset(lShoulder!.x, rShoulder!.x)
  // Avoid division by zero for edge-on cameras
  if (shoulderWidth < 0.05) {
    return { label: 'Shoulder Alignment', rating: 'FAIR', detail: 'Side view — limited data', coaching: null, score: 60, measured: false }
  }

  const heightDiff = Math.abs((lShoulder?.y ?? 0) - (rShoulder?.y ?? 0))
  const relativeOffset = heightDiff / shoulderWidth

  let rating: PostureRating; let score: number; let detail: string; let coaching: string | null

  // Tightened slightly: flag at 0.06 rather than 0.07
  if (relativeOffset < 0.06) {
    rating = 'GOOD'; score = 100; detail = 'Level'; coaching = null
  } else if (relativeOffset < 0.14) {
    rating = 'FAIR'; score = 65; detail = 'Slight unevenness'
    coaching = 'Try to relax both shoulders evenly — avoid hiking one shoulder up.'
  } else {
    rating = 'POOR'; score = 25; detail = 'Uneven'
    coaching = 'Relax your raised shoulder. Both shoulders should rest at the same height.'
  }

  return { label: 'Shoulder Alignment', rating, detail, coaching, score, measured: true }
}

// ── Torso inclination ─────────────────────────────────────────────────────────

/**
 * Measures forward lean of the torso using shoulder-to-hip vector angle from vertical.
 * Ideal for desk sitting: slight lean (0–10°). Over 20° = forward-leaning.
 */
function analyseTorsoInclination(lms: NormalizedLandmark[]): PostureCheck {
  const lShoulder = lms[PoseLandmark.LEFT_SHOULDER]
  const rShoulder = lms[PoseLandmark.RIGHT_SHOULDER]
  const lHip      = lms[PoseLandmark.LEFT_HIP]
  const rHip      = lms[PoseLandmark.RIGHT_HIP]

  const hasData = visible(lShoulder) && visible(rShoulder) && (visible(lHip) || visible(rHip))

  if (!hasData) {
    return { label: 'Torso Position', rating: 'FAIR', detail: 'Hips not visible', coaching: null, score: 60, measured: false }
  }

  const shoulderMidX = ((lShoulder?.x ?? 0) + (rShoulder?.x ?? 0)) / 2
  const shoulderMidY = ((lShoulder?.y ?? 0) + (rShoulder?.y ?? 0)) / 2

  const hipLandmarks = [lHip, rHip].filter(Boolean) as NormalizedLandmark[]
  const hipMidX = hipLandmarks.reduce((s, h) => s + h.x, 0) / hipLandmarks.length
  const hipMidY = hipLandmarks.reduce((s, h) => s + h.y, 0) / hipLandmarks.length

  const tiltAngle = angleDegFromVertical(shoulderMidX, shoulderMidY, hipMidX, hipMidY)

  let rating: PostureRating; let score: number; let detail: string; let coaching: string | null

  // Tightened: acceptable desk-sitting lean is ~8°; flag earlier at 10°
  if (tiltAngle <= 10) {
    rating = 'GOOD'; score = 100; detail = 'Upright'; coaching = null
  } else if (tiltAngle <= 20) {
    rating = 'FAIR'; score = 60; detail = 'Slight forward lean'
    coaching = 'Sit back slightly and let your chair support your lower back.'
  } else {
    rating = 'POOR'; score = 20; detail = 'Leaning forward'
    coaching = 'Sit back in your chair and relax your shoulders. Avoid hunching toward your screen.'
  }

  return { label: 'Torso Position', rating, detail, coaching, score, measured: true }
}

// ── Main analysis function ────────────────────────────────────────────────────

/**
 * Runs all posture checks against the provided landmarks.
 *
 * @param landmarks - 33 normalised MediaPipe landmarks (image-space)
 */
export function analysePosture(landmarks: NormalizedLandmark[]): PostureAnalysisResult {
  if (!landmarks || landmarks.length < 25) {
    return {
      overallScore: 0,
      reliable: false,
      checks: {
        headNeck:             { label: 'Head Position',      rating: 'FAIR', detail: 'No data', coaching: null, score: 0, measured: false },
        shoulderAlignment:    { label: 'Shoulder Alignment', rating: 'FAIR', detail: 'No data', coaching: null, score: 0, measured: false },
        torsoInclination:     { label: 'Torso Position',     rating: 'FAIR', detail: 'No data', coaching: null, score: 0, measured: false },
        headForwardProtraction: { label: 'Forward Head',     rating: 'FAIR', detail: 'No data', coaching: null, score: 0, measured: false },
      },
    }
  }

  const headNeck               = analyseHeadNeckTilt(landmarks)
  const shoulderAlignment      = analyseShoulderAlignment(landmarks)
  const torsoInclination       = analyseTorsoInclination(landmarks)
  const headForwardProtraction = analyseForwardHead(landmarks)

  const allChecks = [headNeck, shoulderAlignment, torsoInclination, headForwardProtraction]
  const measured  = allChecks.filter((c) => c.measured)
  const reliable  = measured.length >= 2

  // Weighted average: torso inclination and forward head carry more weight
  // because they cause the most ergonomic impact at a desk.
  const WEIGHTS: Record<string, number> = {
    'Head Position':      1.0,
    'Shoulder Alignment': 1.0,
    'Torso Position':     1.5,
    'Forward Head':       1.5,
  }

  const totalWeight = measured.reduce((s, c) => s + (WEIGHTS[c.label] ?? 1.0), 0)
  const weightedSum  = measured.reduce((s, c) => s + c.score * (WEIGHTS[c.label] ?? 1.0), 0)

  const overallScore = reliable
    ? Math.round(weightedSum / totalWeight)
    : 0

  return { overallScore, reliable, checks: { headNeck, shoulderAlignment, torsoInclination, headForwardProtraction } }
}
