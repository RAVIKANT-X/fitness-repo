/**
 * Camera service — pure browser API, no React.
 *
 * Responsible for:
 *  - requesting getUserMedia() with appropriate constraints
 *  - attaching/detaching the stream to a <video> element
 *  - stopping all tracks cleanly
 *  - switching facing mode
 *
 * This module has no dependency on React state; it is consumed by
 * the useCamera hook which bridges it into the React lifecycle.
 */

import type { CameraFacing, CameraError, StartCameraResult } from './cameraTypes'

/** Video constraints per facing mode. */
function buildConstraints(facing: CameraFacing): MediaStreamConstraints {
  return {
    video: {
      facingMode: facing,
      // 4:3 is the most common mobile camera ratio; the browser may round
      // to the nearest supported resolution.
      width: { ideal: 1280 },
      height: { ideal: 960 },
      aspectRatio: { ideal: 4 / 3 },
    },
    audio: false,
  }
}

/**
 * Converts a browser MediaError name into a user-friendly message.
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#exceptions
 */
function mapBrowserError(err: unknown): CameraError {
  if (err instanceof DOMException || err instanceof Error) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          name: err.name,
          message:
            'Camera access was denied. Please allow camera access in your browser settings and reload the page.',
        }
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          name: err.name,
          message: 'No camera was found on this device.',
        }
      case 'NotReadableError':
      case 'TrackStartError':
        return {
          name: err.name,
          message:
            'Your camera is already in use by another application. Close it and try again.',
        }
      case 'OverconstrainedError':
        return {
          name: err.name,
          message: 'The requested camera configuration is not supported by this device.',
        }
      case 'SecurityError':
        return {
          name: err.name,
          message:
            'Camera access requires a secure connection (HTTPS). Please use HTTPS in production.',
        }
      default:
        return {
          name: err.name ?? 'UnknownError',
          message: 'An unexpected camera error occurred. Please try again.',
        }
    }
  }
  return {
    name: 'UnknownError',
    message: 'An unexpected camera error occurred. Please try again.',
  }
}

/** Returns true if the browser supports getUserMedia at all. */
export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

/**
 * Requests the camera stream and attaches it to the provided video element.
 * Does NOT touch React state — call from useCamera.
 */
export async function startCamera(
  videoEl: HTMLVideoElement,
  facing: CameraFacing,
): Promise<StartCameraResult> {
  if (!isCameraSupported()) {
    return {
      ok: false,
      error: {
        name: 'NotSupportedError',
        message: 'Your browser does not support camera access.',
      },
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(buildConstraints(facing))
    videoEl.srcObject = stream
    // Wait for the video to be ready to play before returning
    await new Promise<void>((resolve, reject) => {
      videoEl.onloadedmetadata = () => resolve()
      videoEl.onerror = () => reject(new Error('Video element error'))
    })
    await videoEl.play()
    return { ok: true, stream }
  } catch (err) {
    return { ok: false, error: mapBrowserError(err) }
  }
}

/**
 * Stops all tracks on the given stream and clears the video element.
 * Safe to call even if the stream is already stopped.
 */
export function stopCamera(videoEl: HTMLVideoElement, stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  videoEl.srcObject = null
}

/**
 * Attempts to switch to the opposite facing mode.
 * Stops the current stream first, then starts a new one.
 * Returns an error result if the device does not support the requested mode.
 */
export async function switchCamera(
  videoEl: HTMLVideoElement,
  currentStream: MediaStream | null,
  newFacing: CameraFacing,
): Promise<StartCameraResult> {
  stopCamera(videoEl, currentStream)
  return startCamera(videoEl, newFacing)
}
