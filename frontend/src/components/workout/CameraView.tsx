/**
 * CameraView — renders the <video> element and all camera permission states.
 *
 * This component owns the visual camera container. It does NOT run pose
 * inference — that is handled by PoseOverlay which is layered on top.
 *
 * Props:
 *  - videoRef: must be attached to the <video> element
 *  - status: current CameraStatus from useCamera
 *  - error: CameraError when status === 'error'
 *  - facing: which camera is active (controls CSS mirror transform)
 *  - children: rendered on top of the video (used to slot in PoseOverlay)
 */

import type { ReactNode } from 'react'
import { Camera } from 'lucide-react'
import type { CameraStatus, CameraError, CameraFacing } from '../../features/camera/cameraTypes'

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement>
  status: CameraStatus
  error: CameraError | null
  facing: CameraFacing
  children?: ReactNode
}

export default function CameraView({
  videoRef,
  status,
  error,
  facing,
  children,
}: CameraViewProps) {
  /**
   * Mirror the video for the front camera so the user sees a natural
   * "mirror image" of themselves — this is the standard mobile UX.
   * The canvas overlay must apply the same transform (handled in poseRenderer).
   */
  const videoMirrorClass = facing === 'user' ? 'scale-x-[-1]' : ''

  return (
    /*
     * Outer container: fills 100% of its parent (which is the .camera-section
     * flex child).  The aspect-ratio approach only works for scrollable pages;
     * for camera pages the parent already constrains height via flex layout.
     *
     * We keep rounded corners on desktop (md+) where the page is centred and
     * has extra space, but go edge-to-edge on mobile.
     */
    <div className="relative w-full h-full overflow-hidden bg-slate-900 md:rounded-card">

      {/* ── Live video element ─────────────────────────────────────────── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline     // required for iOS to play inline (no fullscreen)
        muted           // muted so autoPlay works without user gesture
        className={[
          'absolute inset-0 w-full h-full object-cover',
          videoMirrorClass,
          // Hide the video element until the stream is active
          status === 'active' ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-label="Camera feed"
      />

      {/* ── Canvas overlay slot (PoseOverlay) ─────────────────────────── */}
      {status === 'active' && children}

      {/* ── Idle state ────────────────────────────────────────────────── */}
      {status === 'idle' && (
        <CameraPlaceholder>
          <Camera size={36} className="text-white/40" aria-hidden="true" />
          <p className="text-white/70 font-medium mt-3">Camera not started</p>
          <p className="text-white/40 text-sm mt-1">Press &ldquo;Enable Camera&rdquo; below</p>
        </CameraPlaceholder>
      )}

      {/* ── Requesting / loading state ────────────────────────────────── */}
      {status === 'requesting' && (
        <CameraPlaceholder>
          <div className="w-10 h-10 border-2 border-primary/60 border-t-primary rounded-full animate-spin" />
          <p className="text-white/70 font-medium mt-4">Starting camera&hellip;</p>
        </CameraPlaceholder>
      )}

      {/* ── Stopped state ─────────────────────────────────────────────── */}
      {status === 'stopped' && (
        <CameraPlaceholder>
          <Camera size={36} className="text-white/40" aria-hidden="true" />
          <p className="text-white/70 font-medium mt-3">Camera stopped</p>
          <p className="text-white/40 text-sm mt-1">Press &ldquo;Enable Camera&rdquo; to restart</p>
        </CameraPlaceholder>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {status === 'error' && (
        <CameraPlaceholder>
          <div className="w-12 h-12 rounded-full bg-error/20 flex items-center justify-center">
            <Camera size={24} className="text-error" aria-hidden="true" />
          </div>
          <p className="text-white font-semibold mt-3">Camera unavailable</p>
          <p className="text-white/60 text-sm mt-2 max-w-xs text-center leading-relaxed">
            {error?.message ?? 'An unknown camera error occurred.'}
          </p>
        </CameraPlaceholder>
      )}

      {/* ── Corner bracket decorations (active only) ──────────────────── */}
      {status === 'active' && (
        <>
          <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-primary/70 rounded-tl pointer-events-none" />
          <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-primary/70 rounded-tr pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-primary/70 rounded-bl pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-primary/70 rounded-br pointer-events-none" />
        </>
      )}
    </div>
  )
}

/** Shared centred overlay for non-active camera states. */
function CameraPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
      {children}
    </div>
  )
}
