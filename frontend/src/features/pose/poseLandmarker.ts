/**
 * Pose landmarker — MediaPipe Tasks Vision wrapper.
 *
 * Responsibilities:
 *  - create and hold a singleton PoseLandmarker instance
 *  - expose detectForVideo() for use by the inference loop
 *  - run in VIDEO mode (temporal smoothing enabled by MediaPipe internally)
 *
 * This module has NO React dependency.
 * It is consumed by usePoseLandmarker which bridges it into the React lifecycle.
 *
 * Architecture note:
 *  The model URL is defined in POSE_MODEL_URL below.
 *  To switch from CDN hosting to a local asset:
 *    1. Copy pose_landmarker_lite.task into frontend/public/models/
 *    2. Change POSE_MODEL_URL to '/models/pose_landmarker_lite.task'
 *    3. No other code needs to change.
 */

import {
  PoseLandmarker,
  FilesetResolver,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { PoseResult, NormalizedLandmark } from './poseTypes'

// ── Model configuration ─────────────────────────────────────────────────────
// Lite model: best real-time performance on mobile devices.
// Full / Heavy models are available for higher accuracy at the cost of speed.
// CDN URL — swap to '/models/pose_landmarker_lite.task' for offline use.
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

// MediaPipe WASM bundle — served from the @mediapipe/tasks-vision npm package.
// Using the CDN path supplied by the package itself.
const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

// ── Singleton state ──────────────────────────────────────────────────────────
let landmarkerInstance: PoseLandmarker | null = null
let initPromise: Promise<PoseLandmarker> | null = null

/**
 * Initialises the PoseLandmarker singleton.
 * Calling this multiple times returns the same promise — safe to call from
 * multiple components or after hot-reloads.
 */
export async function initPoseLandmarker(): Promise<PoseLandmarker> {
  // Already ready
  if (landmarkerInstance) return landmarkerInstance
  // Init already in flight — return the same promise
  if (initPromise) return initPromise

  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH)

    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        // Use GPU delegate where available; falls back to CPU automatically.
        delegate: 'GPU',
      },
      // VIDEO mode applies temporal smoothing between frames.
      runningMode: 'VIDEO',
      // Detect at most one person for Phase 2.
      // Increase in a future phase if multi-person support is needed.
      numPoses: 1,
      // Only return landmarks when confidence >= 50%.
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    landmarkerInstance = landmarker
    return landmarker
  })()

  return initPromise
}

/**
 * Converts a raw MediaPipe result into our typed PoseResult[].
 * Returns an empty array when no person is detected.
 */
function mapResult(raw: PoseLandmarkerResult): PoseResult[] {
  return raw.landmarks.map((lmList, i) => ({
    landmarks: lmList as NormalizedLandmark[],
    worldLandmarks: (raw.worldLandmarks[i] ?? []) as NormalizedLandmark[],
  }))
}

/**
 * Runs pose detection on a single video frame.
 *
 * @param video   - The playing <video> element.
 * @param timestamp - Performance.now() timestamp for this frame.
 * @returns Array of detected poses (empty if no person found).
 */
export function detectPoseForVideo(
  video: HTMLVideoElement,
  timestamp: number,
): PoseResult[] {
  if (!landmarkerInstance) return []
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return []

  const raw = landmarkerInstance.detectForVideo(video, timestamp)
  return mapResult(raw)
}

/**
 * Releases the MediaPipe instance and resets singleton state.
 * Call when the user fully leaves the workout section.
 * The model will be re-initialised on next use.
 */
export function disposePoseLandmarker(): void {
  if (landmarkerInstance) {
    landmarkerInstance.close()
    landmarkerInstance = null
    initPromise = null
  }
}
