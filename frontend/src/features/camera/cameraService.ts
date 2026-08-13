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

/**
 * How long (ms) to wait for the video element to emit loadedmetadata and
 * for video.play() to resolve before we treat the attempt as hung.
 * On slow Android devices 10 s is plenty generous.
 */
const VIDEO_READY_TIMEOUT_MS = 10_000

/**
 * Video constraints per facing mode.
 *
 * We try `{ exact: facing }` first so Android browsers reliably switch to the
 * rear camera. If that fails (OverconstrainedError — device has only one
 * camera, or browser doesn't support exact facingMode) we fall back to the
 * plain string value which will at least open *some* camera.
 */
function buildConstraints(facing: CameraFacing, exact = false): MediaStreamConstraints {
  return {
    video: {
      facingMode: exact ? { exact: facing } : facing,
      width:       { ideal: 1280 },
      height:      { ideal: 960 },
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
      case 'TimeoutError':
        return {
          name: err.name,
          message: 'Camera could not start in time. Please check camera permission and try again.',
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
 * Waits for the video element to have valid dimensions and a ready state that
 * allows drawing frames.  Resolves immediately if the video is already ready.
 *
 * This is the fix for the mobile "Opening camera…" hang:
 *  - On Android Chrome, `loadedmetadata` can fire BEFORE the srcObject listener
 *    is attached (race condition), so we first check readyState synchronously.
 *  - A 10-second timeout prevents an indefinite hang if the event never fires.
 */
function waitForVideoReady(videoEl: HTMLVideoElement): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Already has data — no need to wait for any event.
    if (
      videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      videoEl.videoWidth > 0 &&
      videoEl.videoHeight > 0
    ) {
      console.log('[ScanSpace] video already ready (readyState=%d %dx%d)',
        videoEl.readyState, videoEl.videoWidth, videoEl.videoHeight)
      resolve()
      return
    }

    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      const e = new DOMException('Video metadata timeout', 'TimeoutError')
      reject(e)
    }, VIDEO_READY_TIMEOUT_MS)

    const onReady = () => {
      if (settled) return
      // Guard: ensure we actually have valid dimensions (some browsers fire
      // loadedmetadata before videoWidth/videoHeight are non-zero).
      if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return
      settled = true
      cleanup()
      console.log('[ScanSpace] video metadata loaded (%dx%d)',
        videoEl.videoWidth, videoEl.videoHeight)
      resolve()
    }

    const onError = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('Video element error'))
    }

    function cleanup() {
      clearTimeout(timeout)
      videoEl.removeEventListener('loadedmetadata', onReady)
      videoEl.removeEventListener('loadeddata', onReady)
      videoEl.removeEventListener('canplay', onReady)
      videoEl.removeEventListener('error', onError)
    }

    // Listen on multiple events: loadedmetadata fires first but may carry
    // zero dimensions; loadeddata / canplay are safer fallbacks.
    videoEl.addEventListener('loadedmetadata', onReady)
    videoEl.addEventListener('loadeddata', onReady)
    videoEl.addEventListener('canplay', onReady)
    videoEl.addEventListener('error', onError)
  })
}

/**
 * Requests the camera stream and attaches it to the provided video element.
 * Does NOT touch React state — call from useCamera.
 *
 * Fix summary:
 *  1. Uses `addEventListener` instead of assigning `onloadedmetadata` so
 *     we never miss an event that already fired.
 *  2. Checks `readyState` synchronously after attaching srcObject in case
 *     the metadata event already fired before the listener was registered.
 *  3. Listens on loadedmetadata + loadeddata + canplay so slow mobile
 *     browsers that skip events don't get stuck.
 *  4. 10-second hard timeout prevents permanent "Opening camera…" hang.
 *  5. Retries once (with a 500 ms gap) on AbortError, which is transient
 *     on some Android devices.
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

  console.log('[Camera] requesting camera (facing=%s)', facing)

  /**
   * One attempt with the given constraints.
   * Returns ok:true on success or ok:false with a mapped error.
   */
  const attempt = async (exact: boolean): Promise<StartCameraResult> => {
    let stream: MediaStream

    try {
      stream = await navigator.mediaDevices.getUserMedia(buildConstraints(facing, exact))
    } catch (err) {
      return { ok: false, error: mapBrowserError(err) }
    }

    console.log('[Camera] stream received — attaching to video element')
    videoEl.srcObject = stream

    try {
      await waitForVideoReady(videoEl)
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop())
      videoEl.srcObject = null
      return { ok: false, error: mapBrowserError(err) }
    }

    console.log('[Camera] video dimensions: %dx%d — calling play()',
      videoEl.videoWidth, videoEl.videoHeight)

    try {
      await videoEl.play()
    } catch (playErr) {
      if (!videoEl.paused) {
        // Already playing — ignore the rejection.
      } else {
        stream.getTracks().forEach((t) => t.stop())
        videoEl.srcObject = null
        return { ok: false, error: mapBrowserError(playErr) }
      }
    }

    console.log('[Camera] CAMERA READY (exact=%s)', exact)
    return { ok: true, stream }
  }

  // First try with exact facingMode so Android rear camera works reliably.
  let result = await attempt(true)

  // Fall back to non-exact if OverconstrainedError (single-camera device)
  // or any other constraint error.
  if (!result.ok && (
    result.error.name === 'OverconstrainedError' ||
    result.error.name === 'ConstraintNotSatisfiedError' ||
    result.error.name === 'NotFoundError' ||
    result.error.name === 'DevicesNotFoundError'
  )) {
    console.log('[Camera] exact facingMode failed (%s) — retrying without exact', result.error.name)
    result = await attempt(false)
  }

  // Retry once on AbortError (transient on Android Chrome).
  if (!result.ok && result.error.name === 'AbortError') {
    console.log('[Camera] AbortError — retrying in 500 ms')
    await new Promise<void>((r) => setTimeout(r, 500))
    result = await attempt(false)
  }

  return result
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
 * Uses exact facingMode first (reliable on Android) with non-exact fallback.
 */
export async function switchCamera(
  videoEl: HTMLVideoElement,
  currentStream: MediaStream | null,
  newFacing: CameraFacing,
): Promise<StartCameraResult> {
  stopCamera(videoEl, currentStream)
  return startCamera(videoEl, newFacing)
}
