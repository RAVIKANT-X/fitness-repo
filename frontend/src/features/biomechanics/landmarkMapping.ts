/**
 * MediaPipe Pose Landmarker — semantic landmark index mapping.
 *
 * PoseLandmark is a numeric enum whose values match the official MediaPipe
 * 33-landmark body model indices:
 * https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 *
 * Exercise definitions reference enum members (e.g. PoseLandmark.LEFT_KNEE)
 * rather than raw integers so the code remains self-documenting and
 * refactoring-safe.
 *
 * getLandmark() is the only place in the codebase that converts an enum value
 * to an array index — all other code uses the semantic names.
 */

import type { NormalizedLandmark } from '../pose/poseTypes'

export enum PoseLandmark {
  NOSE            = 0,
  LEFT_EYE_INNER  = 1,
  LEFT_EYE        = 2,
  LEFT_EYE_OUTER  = 3,
  RIGHT_EYE_INNER = 4,
  RIGHT_EYE       = 5,
  RIGHT_EYE_OUTER = 6,
  LEFT_EAR        = 7,
  RIGHT_EAR       = 8,
  MOUTH_LEFT      = 9,
  MOUTH_RIGHT     = 10,
  LEFT_SHOULDER   = 11,
  RIGHT_SHOULDER  = 12,
  LEFT_ELBOW      = 13,
  RIGHT_ELBOW     = 14,
  LEFT_WRIST      = 15,
  RIGHT_WRIST     = 16,
  LEFT_PINKY      = 17,
  RIGHT_PINKY     = 18,
  LEFT_INDEX      = 19,
  RIGHT_INDEX     = 20,
  LEFT_THUMB      = 21,
  RIGHT_THUMB     = 22,
  LEFT_HIP        = 23,
  RIGHT_HIP       = 24,
  LEFT_KNEE       = 25,
  RIGHT_KNEE      = 26,
  LEFT_ANKLE      = 27,
  RIGHT_ANKLE     = 28,
  LEFT_HEEL       = 29,
  RIGHT_HEEL      = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32,
}

/** Total number of landmarks the MediaPipe Pose Landmarker produces. */
export const POSE_LANDMARK_COUNT = 33

/**
 * Retrieves a single landmark by semantic name.
 * Returns `undefined` if the landmarks array is shorter than expected
 * (e.g. partial detection) so callers can handle missing joints gracefully.
 */
export function getLandmark(
  landmarks: NormalizedLandmark[],
  id: PoseLandmark,
): NormalizedLandmark | undefined {
  return landmarks[id]
}

/**
 * Returns true if all landmarks in `ids` are present and have a visibility
 * score above `minVisibility`.
 *
 * Phase 4 uses this to decide whether to run angle calculations on a frame.
 * A landmark with low visibility (occluded, out of frame) produces unreliable
 * angle results even if the value is numerically non-zero.
 */
export function areLandmarksVisible(
  landmarks: NormalizedLandmark[],
  ids: PoseLandmark[],
  minVisibility = 0.5,
): boolean {
  return ids.every((id) => {
    const lm = getLandmark(landmarks, id)
    return lm !== undefined && (lm.visibility ?? 1) >= minVisibility
  })
}
