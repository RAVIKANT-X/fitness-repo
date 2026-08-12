/**
 * True Reference poses — landmark-based ideal form data for all exercises.
 *
 * Coordinate system: normalised [0..1] image space, same as MediaPipe output.
 * x: 0=left, 1=right (from camera's perspective)
 * y: 0=top, 1=bottom
 * z: negative = closer to camera
 *
 * These are biomechanically derived ideal positions, not stock images.
 * They represent a generic adult in standard exercise execution.
 *
 * MediaPipe 33 landmark indices:
 *  0=NOSE, 11=L_SHOULDER, 12=R_SHOULDER,
 *  13=L_ELBOW, 14=R_ELBOW, 15=L_WRIST, 16=R_WRIST,
 *  23=L_HIP, 24=R_HIP, 25=L_KNEE, 26=R_KNEE,
 *  27=L_ANKLE, 28=R_ANKLE
 */

import type { ReferencePose } from './referenceTypes'
import type { NormalizedLandmark } from '../pose/poseTypes'

/** Build a full 33-landmark array with all joints initialised to a
 *  neutral standing position, then override individual joints. */
function makePose(overrides: Partial<Record<number, Partial<NormalizedLandmark>>>): ReferencePose {
  // Neutral standing: person centred in frame, arms at sides
  const base: NormalizedLandmark[] = [
    { x: 0.50, y: 0.08, z: 0.00, visibility: 0.9 },  // 0 NOSE
    { x: 0.52, y: 0.09, z: -0.01, visibility: 0.7 }, // 1 L_EYE_INNER
    { x: 0.54, y: 0.09, z: -0.01, visibility: 0.7 }, // 2 L_EYE
    { x: 0.56, y: 0.09, z: -0.01, visibility: 0.6 }, // 3 L_EYE_OUTER
    { x: 0.48, y: 0.09, z: -0.01, visibility: 0.7 }, // 4 R_EYE_INNER
    { x: 0.46, y: 0.09, z: -0.01, visibility: 0.7 }, // 5 R_EYE
    { x: 0.44, y: 0.09, z: -0.01, visibility: 0.6 }, // 6 R_EYE_OUTER
    { x: 0.57, y: 0.12, z: 0.00, visibility: 0.8 },  // 7 L_EAR
    { x: 0.43, y: 0.12, z: 0.00, visibility: 0.8 },  // 8 R_EAR
    { x: 0.51, y: 0.14, z: 0.00, visibility: 0.8 },  // 9 MOUTH_L
    { x: 0.49, y: 0.14, z: 0.00, visibility: 0.8 },  // 10 MOUTH_R
    { x: 0.58, y: 0.28, z: 0.00, visibility: 0.95 }, // 11 L_SHOULDER
    { x: 0.42, y: 0.28, z: 0.00, visibility: 0.95 }, // 12 R_SHOULDER
    { x: 0.62, y: 0.42, z: 0.02, visibility: 0.9 },  // 13 L_ELBOW
    { x: 0.38, y: 0.42, z: 0.02, visibility: 0.9 },  // 14 R_ELBOW
    { x: 0.64, y: 0.56, z: 0.03, visibility: 0.85 }, // 15 L_WRIST
    { x: 0.36, y: 0.56, z: 0.03, visibility: 0.85 }, // 16 R_WRIST
    { x: 0.65, y: 0.60, z: 0.03, visibility: 0.7 },  // 17 L_PINKY
    { x: 0.35, y: 0.60, z: 0.03, visibility: 0.7 },  // 18 R_PINKY
    { x: 0.64, y: 0.61, z: 0.03, visibility: 0.7 },  // 19 L_INDEX
    { x: 0.36, y: 0.61, z: 0.03, visibility: 0.7 },  // 20 R_INDEX
    { x: 0.63, y: 0.59, z: 0.03, visibility: 0.7 },  // 21 L_THUMB
    { x: 0.37, y: 0.59, z: 0.03, visibility: 0.7 },  // 22 R_THUMB
    { x: 0.56, y: 0.62, z: 0.00, visibility: 0.95 }, // 23 L_HIP
    { x: 0.44, y: 0.62, z: 0.00, visibility: 0.95 }, // 24 R_HIP
    { x: 0.57, y: 0.78, z: 0.01, visibility: 0.9 },  // 25 L_KNEE
    { x: 0.43, y: 0.78, z: 0.01, visibility: 0.9 },  // 26 R_KNEE
    { x: 0.58, y: 0.94, z: 0.02, visibility: 0.85 }, // 27 L_ANKLE
    { x: 0.42, y: 0.94, z: 0.02, visibility: 0.85 }, // 28 R_ANKLE
    { x: 0.58, y: 0.97, z: 0.02, visibility: 0.7 },  // 29 L_HEEL
    { x: 0.42, y: 0.97, z: 0.02, visibility: 0.7 },  // 30 R_HEEL
    { x: 0.59, y: 0.99, z: 0.02, visibility: 0.7 },  // 31 L_FOOT_INDEX
    { x: 0.41, y: 0.99, z: 0.02, visibility: 0.7 },  // 32 R_FOOT_INDEX
  ]

  for (const [idx, patch] of Object.entries(overrides)) {
    const i = Number(idx)
    base[i] = { ...base[i], ...patch }
  }
  return base
}

// ── SQUAT reference poses ─────────────────────────────────────────────────────

/** Phase 1 — STANDING: legs straight, hip angle ~170°, knee angle ~170° */
export const SQUAT_STANDING: ReferencePose = makePose({
  11: { x: 0.58, y: 0.26, z: 0.00 }, // L_SHOULDER
  12: { x: 0.42, y: 0.26, z: 0.00 }, // R_SHOULDER
  23: { x: 0.56, y: 0.56, z: 0.00 }, // L_HIP
  24: { x: 0.44, y: 0.56, z: 0.00 }, // R_HIP
  25: { x: 0.57, y: 0.74, z: 0.01 }, // L_KNEE — near straight
  26: { x: 0.43, y: 0.74, z: 0.01 }, // R_KNEE
  27: { x: 0.57, y: 0.94, z: 0.01 }, // L_ANKLE
  28: { x: 0.43, y: 0.94, z: 0.01 }, // R_ANKLE
})

/** Phase 2 — DESCENDING: quarter squat, knee ~135° */
export const SQUAT_DESCENDING: ReferencePose = makePose({
  0:  { x: 0.50, y: 0.11, z: 0.00 },
  11: { x: 0.58, y: 0.29, z: 0.00 },
  12: { x: 0.42, y: 0.29, z: 0.00 },
  23: { x: 0.56, y: 0.58, z: 0.01 },
  24: { x: 0.44, y: 0.58, z: 0.01 },
  25: { x: 0.59, y: 0.77, z: 0.04 }, // knee bends forward
  26: { x: 0.41, y: 0.77, z: 0.04 },
  27: { x: 0.57, y: 0.95, z: 0.01 },
  28: { x: 0.43, y: 0.95, z: 0.01 },
})

/** Phase 3 — BOTTOM: parallel squat, knee ~90°, hip ~90° */
export const SQUAT_BOTTOM: ReferencePose = makePose({
  0:  { x: 0.50, y: 0.16, z: 0.00 },
  11: { x: 0.58, y: 0.34, z: 0.02 }, // torso leans slightly forward
  12: { x: 0.42, y: 0.34, z: 0.02 },
  23: { x: 0.57, y: 0.62, z: 0.04 }, // hips drop
  24: { x: 0.43, y: 0.62, z: 0.04 },
  25: { x: 0.61, y: 0.78, z: 0.08 }, // knee at 90°, tracked over toes
  26: { x: 0.39, y: 0.78, z: 0.08 },
  27: { x: 0.60, y: 0.94, z: 0.01 },
  28: { x: 0.40, y: 0.94, z: 0.01 },
})

/** Phase 4 — ASCENDING: returning from bottom, knee ~120° */
export const SQUAT_ASCENDING: ReferencePose = makePose({
  0:  { x: 0.50, y: 0.13, z: 0.00 },
  11: { x: 0.58, y: 0.31, z: 0.01 },
  12: { x: 0.42, y: 0.31, z: 0.01 },
  23: { x: 0.56, y: 0.60, z: 0.02 },
  24: { x: 0.44, y: 0.60, z: 0.02 },
  25: { x: 0.59, y: 0.76, z: 0.05 },
  26: { x: 0.41, y: 0.76, z: 0.05 },
  27: { x: 0.57, y: 0.94, z: 0.01 },
  28: { x: 0.43, y: 0.94, z: 0.01 },
})

// ── PUSH-UP reference poses ───────────────────────────────────────────────────

/** Phase 1 — TOP: high plank, arms extended (~165°) */
export const PUSHUP_TOP: ReferencePose = makePose({
  0:  { x: 0.50, y: 0.12, z: -0.05 },
  11: { x: 0.58, y: 0.28, z: -0.02 }, // L_SHOULDER
  12: { x: 0.42, y: 0.28, z: -0.02 }, // R_SHOULDER
  13: { x: 0.64, y: 0.40, z: 0.00 },  // L_ELBOW
  14: { x: 0.36, y: 0.40, z: 0.00 },  // R_ELBOW
  15: { x: 0.67, y: 0.52, z: 0.02 },  // L_WRIST
  16: { x: 0.33, y: 0.52, z: 0.02 },  // R_WRIST
  23: { x: 0.56, y: 0.58, z: -0.02 }, // L_HIP — level with body
  24: { x: 0.44, y: 0.58, z: -0.02 }, // R_HIP
  25: { x: 0.57, y: 0.75, z: -0.02 }, // L_KNEE
  26: { x: 0.43, y: 0.75, z: -0.02 }, // R_KNEE
  27: { x: 0.58, y: 0.92, z: 0.00 },  // L_ANKLE
  28: { x: 0.42, y: 0.92, z: 0.00 },  // R_ANKLE
})

/** Phase 2 — DESCENDING: halfway, elbow ~120° */
export const PUSHUP_DESCENDING: ReferencePose = makePose({
  0:  { x: 0.50, y: 0.18, z: -0.02 },
  11: { x: 0.58, y: 0.32, z: 0.01 },
  12: { x: 0.42, y: 0.32, z: 0.01 },
  13: { x: 0.64, y: 0.42, z: 0.05 },
  14: { x: 0.36, y: 0.42, z: 0.05 },
  15: { x: 0.67, y: 0.52, z: 0.02 },
  16: { x: 0.33, y: 0.52, z: 0.02 },
  23: { x: 0.56, y: 0.60, z: 0.00 },
  24: { x: 0.44, y: 0.60, z: 0.00 },
  25: { x: 0.57, y: 0.77, z: -0.01 },
  26: { x: 0.43, y: 0.77, z: -0.01 },
  27: { x: 0.58, y: 0.93, z: 0.00 },
  28: { x: 0.42, y: 0.93, z: 0.00 },
})

/** Phase 3 — BOTTOM: chest near floor, elbow ~80° */
export const PUSHUP_BOTTOM: ReferencePose = makePose({
  0:  { x: 0.50, y: 0.24, z: 0.01 },
  11: { x: 0.58, y: 0.36, z: 0.02 },
  12: { x: 0.42, y: 0.36, z: 0.02 },
  13: { x: 0.62, y: 0.44, z: 0.08 },
  14: { x: 0.38, y: 0.44, z: 0.08 },
  15: { x: 0.67, y: 0.52, z: 0.02 },
  16: { x: 0.33, y: 0.52, z: 0.02 },
  23: { x: 0.56, y: 0.58, z: 0.02 },
  24: { x: 0.44, y: 0.58, z: 0.02 },
  25: { x: 0.57, y: 0.76, z: 0.00 },
  26: { x: 0.43, y: 0.76, z: 0.00 },
  27: { x: 0.58, y: 0.92, z: 0.00 },
  28: { x: 0.42, y: 0.92, z: 0.00 },
})

/** Phase 4 — ASCENDING: pushing up, elbow ~120° */
export const PUSHUP_ASCENDING: ReferencePose = PUSHUP_DESCENDING // symmetric

// ── CURL reference poses ──────────────────────────────────────────────────────

/** Phase 1 — EXTENDED: arms hanging at sides, elbow ~165° */
export const CURL_EXTENDED: ReferencePose = makePose({
  11: { x: 0.58, y: 0.28, z: 0.00 },
  12: { x: 0.42, y: 0.28, z: 0.00 },
  13: { x: 0.63, y: 0.43, z: 0.01 },
  14: { x: 0.37, y: 0.43, z: 0.01 },
  15: { x: 0.65, y: 0.58, z: 0.02 },
  16: { x: 0.35, y: 0.58, z: 0.02 },
  23: { x: 0.56, y: 0.60, z: 0.00 },
  24: { x: 0.44, y: 0.60, z: 0.00 },
})

/** Phase 2 — CURLING: halfway, elbow ~90° */
export const CURL_CURLING: ReferencePose = makePose({
  11: { x: 0.58, y: 0.28, z: 0.00 },
  12: { x: 0.42, y: 0.28, z: 0.00 },
  13: { x: 0.60, y: 0.42, z: 0.01 }, // upper arm stays still
  14: { x: 0.40, y: 0.42, z: 0.01 },
  15: { x: 0.58, y: 0.36, z: 0.04 }, // forearm raises to 90°
  16: { x: 0.42, y: 0.36, z: 0.04 },
  23: { x: 0.56, y: 0.60, z: 0.00 },
  24: { x: 0.44, y: 0.60, z: 0.00 },
})

/** Phase 3 — PEAK: full contraction, elbow ~55° */
export const CURL_PEAK: ReferencePose = makePose({
  11: { x: 0.58, y: 0.28, z: 0.00 },
  12: { x: 0.42, y: 0.28, z: 0.00 },
  13: { x: 0.60, y: 0.41, z: 0.01 }, // upper arm stays still — no shoulder swing
  14: { x: 0.40, y: 0.41, z: 0.01 },
  15: { x: 0.58, y: 0.26, z: 0.06 }, // forearm near shoulder level
  16: { x: 0.42, y: 0.26, z: 0.06 },
  23: { x: 0.56, y: 0.60, z: 0.00 },
  24: { x: 0.44, y: 0.60, z: 0.00 },
})

/** Phase 4 — RETURNING: lowering the arm, elbow ~90° */
export const CURL_RETURNING: ReferencePose = CURL_CURLING // symmetric
