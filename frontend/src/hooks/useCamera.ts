/**
 * useCamera — React hook wrapping cameraService.
 *
 * Manages the full camera lifecycle inside React:
 *  - holds camera status and error state
 *  - owns the <video> ref
 *  - exposes start / stop / switchCamera actions
 *
 * The actual browser API calls are delegated to cameraService so this
 * hook stays focused on React state management only.
 *
 * Fix: added an overall 15-second wall-clock timeout so a hung
 * getUserMedia / metadata wait can never leave the UI permanently on
 * "Opening camera…".  The cameraService already has its own 10-second
 * video-ready timeout; this outer timeout is a belt-and-suspenders
 * guard for any other hang path (e.g. getUserMedia itself hanging on
 * some Android OEM browsers).
 */

import { useCallback, useRef, useState } from 'react'
import {
  startCamera,
  stopCamera,
  switchCamera as switchCameraService,
} from '../features/camera/cameraService'
import type { CameraFacing, CameraStatus, CameraError } from '../features/camera/cameraTypes'

/** Maximum ms we will wait for the whole camera start sequence. */
const CAMERA_START_TIMEOUT_MS = 15_000

export interface UseCameraReturn {
  /** Ref to attach to the <video> element. */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Current camera lifecycle state. */
  status: CameraStatus
  /** Set when status === 'error'. */
  error: CameraError | null
  /** Which camera is currently active (or was last requested). */
  facing: CameraFacing
  /** Whether the camera is currently streaming. */
  isActive: boolean
  /** Request camera access and start the stream. */
  start: (facing?: CameraFacing) => Promise<void>
  /** Stop the camera stream. */
  stop: () => void
  /** Switch between front and rear camera. */
  switchCamera: () => Promise<void>
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null!)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<CameraError | null>(null)
  const [facing, setFacing] = useState<CameraFacing>('user')

  const start = useCallback(async (requestedFacing: CameraFacing = 'user') => {
    if (!videoRef.current) {
      console.log('[ScanSpace] useCamera.start — videoRef not yet available')
      return
    }

    setStatus('requesting')
    setError(null)
    console.log('[ScanSpace] useCamera.start — status → requesting')

    // Race the actual camera initialisation against a hard timeout so the
    // UI is never permanently stuck on "Opening camera…".
    const timeoutPromise: Promise<{ ok: false; error: CameraError }> = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: false,
          error: {
            name: 'TimeoutError',
            message: 'Camera could not start in time. Please check camera permission and try again.',
          },
        })
      }, CAMERA_START_TIMEOUT_MS)
    })

    const result = await Promise.race([
      startCamera(videoRef.current, requestedFacing),
      timeoutPromise,
    ])

    if (result.ok) {
      streamRef.current = result.stream
      setFacing(requestedFacing)
      setStatus('active')
      console.log('[ScanSpace] useCamera.start — status → active')
    } else {
      streamRef.current = null
      setError(result.error)
      setStatus('error')
      console.log('[ScanSpace] camera error:', result.error.name, result.error.message)
    }
  }, [])

  const stop = useCallback(() => {
    if (!videoRef.current) return
    stopCamera(videoRef.current, streamRef.current)
    streamRef.current = null
    setStatus('stopped')
    console.log('[ScanSpace] useCamera.stop — status → stopped')
  }, [])

  const switchCamera = useCallback(async () => {
    if (!videoRef.current) return
    const newFacing: CameraFacing = facing === 'user' ? 'environment' : 'user'

    setStatus('requesting')
    setError(null)

    const result = await switchCameraService(videoRef.current, streamRef.current, newFacing)

    if (result.ok) {
      streamRef.current = result.stream
      setFacing(newFacing)
      setStatus('active')
    } else {
      streamRef.current = null
      setError(result.error)
      setStatus('error')
    }
  }, [facing])

  return {
    videoRef,
    status,
    error,
    facing,
    isActive: status === 'active',
    start,
    stop,
    switchCamera,
  }
}
