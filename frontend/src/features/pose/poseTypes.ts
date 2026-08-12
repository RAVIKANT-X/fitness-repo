/**
 * Pose feature — shared types.
 *
 * These mirror the MediaPipe Tasks Vision types but are re-exported here so
 * the rest of the application never imports directly from @mediapipe/tasks-vision.
 * Future phases consume NormalizedLandmark[] from this module.
 */

/** A single body landmark in normalised coordinates [0..1]. */
export interface NormalizedLandmark {
  /** Normalised x position (0 = left edge of image, 1 = right edge). */
  x: number
  /** Normalised y position (0 = top edge of image, 1 = bottom edge). */
  y: number
  /**
   * Normalised z depth. Negative values are closer to the camera.
   * Scale is roughly the same as x.
   */
  z: number
  /** Confidence that this landmark is visible [0..1]. May be undefined. */
  visibility?: number
}

/**
 * A single pose result for one detected person.
 * MediaPipe can detect multiple people; we use the first result.
 */
export interface PoseResult {
  /** 33 body landmarks in normalised image coordinates. */
  landmarks: NormalizedLandmark[]
  /**
   * World-space landmarks in metres, centred on the person's hips.
   * Useful for future 3-D angle calculations (Phase 3+).
   */
  worldLandmarks: NormalizedLandmark[]
}

/** Possible states of the pose landmarker. */
export type PoseLandmarkerStatus =
  | 'uninitialized' // not yet started
  | 'loading'       // model download / WASM init in progress
  | 'ready'         // model loaded, ready to run inference
  | 'error'         // initialization failed
