/**
 * Activity Recognition Engine — identifies coarse user activity from pose landmarks.
 *
 * Activities:
 *   DESK_SITTING  — seated, upper body present, minimal leg movement
 *   STANDING      — full body visible, hip height suggests standing
 *   READING       — sitting, head downward (neck flexion)
 *   PHONE_USE     — arm raised to face level
 *   IDLE          — insufficient movement to classify
 *   UNKNOWN       — no valid pose
 *
 * Uses a temporal smoother (majority-vote over a sliding window) to prevent
 * rapid flipping between states.
 */

import type { NormalizedLandmark } from '../pose/poseTypes'
import { PoseLandmark } from '../biomechanics/landmarkMapping'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'DESK_SITTING'
  | 'STANDING'
  | 'READING'
  | 'PHONE_USE'
  | 'IDLE'
  | 'UNKNOWN'

export interface ActivityResult {
  activity: ActivityType
  confidence: number
  label: string
  icon: string
}

// ── Temporal smoother ─────────────────────────────────────────────────────────

const WINDOW_SIZE = 20      // ~20 frames ≈ ~650ms at 30fps
const activityHistory: ActivityType[] = []

function smoothActivity(raw: ActivityType): ActivityType {
  activityHistory.push(raw)
  if (activityHistory.length > WINDOW_SIZE) activityHistory.shift()

  const counts: Partial<Record<ActivityType, number>> = {}
  for (const a of activityHistory) {
    counts[a] = (counts[a] ?? 0) + 1
  }

  let best: ActivityType = raw
  let bestCount = 0
  for (const [k, v] of Object.entries(counts)) {
    if ((v ?? 0) > bestCount) { bestCount = v ?? 0; best = k as ActivityType }
  }
  return best
}

// ── Helper: landmark visibility ───────────────────────────────────────────────

function vis(lm: NormalizedLandmark | undefined, threshold = 0.4): boolean {
  return (lm?.visibility ?? 0) >= threshold
}

function getLm(lms: NormalizedLandmark[], idx: PoseLandmark): NormalizedLandmark | undefined {
  return lms[idx]
}

// ── Classification logic ──────────────────────────────────────────────────────

/**
 * Raw single-frame activity classification.
 * Callers should pass the result through smoothActivity().
 */
function classifyRaw(landmarks: NormalizedLandmark[]): { activity: ActivityType; confidence: number } {
  if (!landmarks || landmarks.length < 25) return { activity: 'UNKNOWN', confidence: 0 }

  const nose      = getLm(landmarks, PoseLandmark.NOSE)
  const lShoulder = getLm(landmarks, PoseLandmark.LEFT_SHOULDER)
  const rShoulder = getLm(landmarks, PoseLandmark.RIGHT_SHOULDER)
  const lHip      = getLm(landmarks, PoseLandmark.LEFT_HIP)
  const rHip      = getLm(landmarks, PoseLandmark.RIGHT_HIP)
  const lKnee     = getLm(landmarks, PoseLandmark.LEFT_KNEE)
  const rKnee     = getLm(landmarks, PoseLandmark.RIGHT_KNEE)
  const lAnkle    = getLm(landmarks, PoseLandmark.LEFT_ANKLE)
  const rAnkle    = getLm(landmarks, PoseLandmark.RIGHT_ANKLE)
  const lWrist    = getLm(landmarks, PoseLandmark.LEFT_WRIST)
  const rWrist    = getLm(landmarks, PoseLandmark.RIGHT_WRIST)

  const hasUpperBody = vis(lShoulder) && vis(rShoulder) && (vis(lHip) || vis(rHip))
  const hasLegs      = (vis(lKnee) || vis(rKnee))
  const hasAnkles    = (vis(lAnkle) || vis(rAnkle))

  if (!vis(nose) && !hasUpperBody) return { activity: 'UNKNOWN', confidence: 0 }

  // ── PHONE_USE: wrist near face level ─────────────────────────────────────
  // Tightened to prevent false triggers during bicep curls:
  //   - require BOTH wrists to be visible (phone held with both hands or at least
  //     wrist tracking is stable), OR require the wrist to be very close to the face
  //   - use a tighter vertical window: wrist must be within 0.05 above to 0.08 below ear
  //   - additionally require that the wrist is near the horizontal centre of the face
  //     (not off to the side like during a curl)
  if (vis(lWrist) || vis(rWrist)) {
    const wristY = vis(lWrist) ? (lWrist?.y ?? 1) : (rWrist?.y ?? 1)
    const wristX = vis(lWrist) ? (lWrist?.x ?? 0.5) : (rWrist?.x ?? 0.5)
    const noseY  = nose?.y ?? 0.3
    const noseX  = nose?.x ?? 0.5
    const earY   = noseY - 0.05
    const inVerticalWindow = wristY < earY + 0.05 && wristY > earY - 0.12
    // Horizontal proximity: wrist must be within ~25% of frame width of the nose
    const inHorizontalWindow = Math.abs(wristX - noseX) < 0.25
    if (inVerticalWindow && inHorizontalWindow) {
      return { activity: 'PHONE_USE', confidence: 0.80 }
    }
  }

  // ── Need shoulder + hip for SITTING vs STANDING ───────────────────────────
  if (!hasUpperBody) {
    return { activity: 'IDLE', confidence: 0.50 }
  }

  const hipY      = ((lHip?.y ?? 0) + (rHip?.y ?? 0)) / (vis(lHip) && vis(rHip) ? 2 : 1)
  const shoulderY = ((lShoulder?.y ?? 0) + (rShoulder?.y ?? 0)) / 2
  const torsoLen  = Math.abs(shoulderY - hipY)

  // ── STANDING: full body visible and hips are mid-frame ───────────────────
  if (hasLegs && hasAnkles) {
    const kneeY   = (vis(lKnee) ? (lKnee?.y ?? 0) : 0) + (vis(rKnee) ? (rKnee?.y ?? 0) : 0)
    const kneeAvg = kneeY / ((vis(lKnee) ? 1 : 0) + (vis(rKnee) ? 1 : 0) || 1)
    const ankleY  = (vis(lAnkle) ? (lAnkle?.y ?? 0) : 0) + (vis(rAnkle) ? (rAnkle?.y ?? 0) : 0)
    const ankleAvg = ankleY / ((vis(lAnkle) ? 1 : 0) + (vis(rAnkle) ? 1 : 0) || 1)

    // Standing: knees are below hips and ankles are near bottom of frame
    const legLen = ankleAvg - kneeAvg
    if (legLen > torsoLen * 0.6 && ankleAvg > 0.70) {
      return { activity: 'STANDING', confidence: 0.85 }
    }
  }

  // ── DESK_SITTING: upper body dominant, hips present, knees bent or not visible ─
  if (hasUpperBody && (!hasLegs || (vis(lKnee) && (lKnee?.y ?? 0) > hipY))) {
    // ── READING: head pitched significantly forward/down ─────────────────
    // Tightened thresholds to prevent false positives from normal
    // seated posture variation:
    //   - noseBelowShoulders: raised threshold to 0.45 of torso length
    //     (was 0.30 — too easy to trigger just by leaning slightly)
    //   - headForward: raised to 0.18 horizontal offset
    //     (was 0.12 — most seated desk users have ±0.10 of natural sway)
    //   - Both conditions must be true together for READING (was OR logic)
    if (vis(nose)) {
      const noseBelowShoulders = (nose?.y ?? 0) > shoulderY + torsoLen * 0.45
      const headForward = Math.abs((nose?.x ?? 0.5) - ((lShoulder?.x ?? 0) + (rShoulder?.x ?? 0)) / 2) > 0.18
      // Require BOTH cues rather than OR — reduces false positives
      if (noseBelowShoulders && headForward && torsoLen > 0.1) {
        return { activity: 'READING', confidence: 0.72 }
      }
    }
    return { activity: 'DESK_SITTING', confidence: 0.88 }
  }

  // ── DESK_SITTING: upper body visible without legs (partial frame) ─────────
  if (hasUpperBody && !hasLegs) {
    return { activity: 'DESK_SITTING', confidence: 0.75 }
  }

  return { activity: 'IDLE', confidence: 0.50 }
}

// ── Activity labels ───────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<ActivityType, { label: string; icon: string }> = {
  DESK_SITTING: { label: 'Sitting at desk', icon: '🪑' },
  STANDING:     { label: 'Standing',        icon: '🧍' },
  READING:      { label: 'Reading',          icon: '📖' },
  PHONE_USE:    { label: 'Using phone',      icon: '📱' },
  IDLE:         { label: 'Idle',             icon: '⏸️' },
  UNKNOWN:      { label: 'Detecting…',       icon: '🔍' },
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify user activity with temporal smoothing.
 * Call once per analysis frame (throttled to ~8–15fps).
 */
export function recogniseActivity(landmarks: NormalizedLandmark[]): ActivityResult {
  const { activity: raw, confidence } = classifyRaw(landmarks)
  const activity = smoothActivity(raw)
  const meta = ACTIVITY_LABELS[activity]
  return { activity, confidence, label: meta.label, icon: meta.icon }
}

/** Reset the temporal smoother (e.g. on page unmount or camera switch). */
export function resetActivitySmoother(): void {
  activityHistory.length = 0
}
