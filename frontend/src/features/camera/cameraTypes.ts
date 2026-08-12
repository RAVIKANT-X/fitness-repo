/**
 * Camera feature — shared types.
 *
 * These types are consumed by cameraService, useCamera, and CameraView.
 * No UI or MediaPipe logic lives here.
 */

/** Which physical camera to prefer. */
export type CameraFacing = 'user' | 'environment'

/** Lifecycle states of the camera stream. */
export type CameraStatus =
  | 'idle'        // initial — no stream requested yet
  | 'requesting'  // getUserMedia() in flight
  | 'active'      // stream running, video playing
  | 'stopped'     // user or code stopped the stream cleanly
  | 'error'       // irrecoverable error (permission denied, no device, etc.)

/** Structured camera error with a user-readable message. */
export interface CameraError {
  /** Technical error name from the browser (e.g. "NotAllowedError") */
  name: string
  /** Human-readable message safe to display in the UI */
  message: string
}

/** Result returned by cameraService.start() */
export type StartCameraResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; error: CameraError }
