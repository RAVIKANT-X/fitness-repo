/**
 * HumanValidationOverlay — glassmorphism camera overlay for human scene status.
 *
 * Renders one of three states on top of the camera feed:
 *
 *   NO_HUMAN / LOW_CONFIDENCE:
 *     ┌────────────────────────────┐
 *     │ ⚠ NO PERSON DETECTED      │
 *     │ Step into the frame.       │
 *     └────────────────────────────┘
 *
 *   MULTIPLE_HUMANS:
 *     ┌────────────────────────────┐
 *     │ ⚠ MULTIPLE PEOPLE         │
 *     │ Only one person should     │
 *     │ be visible.                │
 *     └────────────────────────────┘
 *
 *   SINGLE_HUMAN:
 *     ┌────────────────────────────┐
 *     │ ● ONE PERSON DETECTED      │
 *     │ You're ready to continue.  │
 *     └────────────────────────────┘
 *
 * The SINGLE_HUMAN badge auto-hides after `readyHideDuration` ms (default 2s).
 *
 * Props:
 *   status        — current HumanSceneStatus
 *   message       — override message (from validateHumanScene result)
 *   contextHint   — short extra line, e.g. "Step into the camera frame."
 *   position      — where on the camera to place the overlay (default 'bottom')
 *   showReady     — whether to show the ✓ READY badge (default true)
 */

import { useEffect, useState } from 'react'
import type { HumanSceneStatus } from '../../features/camera/humanValidation'

interface HumanValidationOverlayProps {
  status: HumanSceneStatus
  message?: string
  contextHint?: string
  position?: 'top' | 'center' | 'bottom'
  showReady?: boolean
  personCount?: number
}

export default function HumanValidationOverlay({
  status,
  message,
  contextHint,
  position = 'bottom',
  showReady = true,
  personCount,
}: HumanValidationOverlayProps) {
  // Auto-hide the SINGLE_HUMAN "ready" badge after 2 s
  const [readyVisible, setReadyVisible] = useState(false)

  useEffect(() => {
    if (status === 'SINGLE_HUMAN') {
      setReadyVisible(true)
      const t = setTimeout(() => setReadyVisible(false), 2000)
      return () => clearTimeout(t)
    } else {
      setReadyVisible(false)
    }
  }, [status])

  // Only render something when not a clean single human (or briefly on ready)
  const shouldRender =
    status === 'NO_HUMAN' ||
    status === 'LOW_CONFIDENCE' ||
    status === 'MULTIPLE_HUMANS' ||
    (status === 'SINGLE_HUMAN' && showReady && readyVisible)

  if (!shouldRender) return null

  const positionClass =
    position === 'top'
      ? 'absolute top-16 left-3 right-3'
      : position === 'center'
      ? 'absolute top-1/2 -translate-y-1/2 left-3 right-3'
      : 'absolute bottom-24 left-3 right-3'

  return (
    <div className={`${positionClass} flex justify-center pointer-events-none z-30`}>
      {status === 'SINGLE_HUMAN' && readyVisible && <ReadyBadge />}
      {status === 'NO_HUMAN' && (
        <NoHumanBadge
          message={message ?? 'No person detected.'}
          contextHint={contextHint ?? 'Please make sure you are visible in the camera.'}
        />
      )}
      {status === 'LOW_CONFIDENCE' && (
        <NoHumanBadge
          message={message ?? 'Low confidence detection.'}
          contextHint={contextHint ?? 'Move closer or improve lighting.'}
          lowConfidence
        />
      )}
      {status === 'MULTIPLE_HUMANS' && (
        <MultipleHumansBadge
          count={personCount}
          message={message}
        />
      )}
    </div>
  )
}

// ── Sub-badges ────────────────────────────────────────────────────────────────

function ReadyBadge() {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
      style={{
        background:           'rgba(16, 185, 129, 0.20)',
        border:               '1px solid rgba(16, 185, 129, 0.50)',
        backdropFilter:       'blur(16px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
        boxShadow:            '0 4px 20px rgba(0,0,0,0.30)',
      }}
    >
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
      <div>
        <p className="text-[11px] font-black text-emerald-300 uppercase tracking-widest leading-none">
          ONE PERSON DETECTED
        </p>
        <p className="text-white/70 text-[11px] font-medium mt-0.5 leading-snug">
          You&rsquo;re ready to continue.
        </p>
      </div>
    </div>
  )
}

function NoHumanBadge({
  message,
  contextHint,
  lowConfidence = false,
}: {
  message: string
  contextHint: string
  lowConfidence?: boolean
}) {
  return (
    <div
      className="w-full max-w-xs rounded-2xl px-4 py-3"
      style={{
        background:           lowConfidence
          ? 'rgba(245, 158, 11, 0.18)'
          : 'rgba(15, 23, 42, 0.82)',
        border:               lowConfidence
          ? '1px solid rgba(245, 158, 11, 0.45)'
          : '1px solid rgba(255, 255, 255, 0.12)',
        backdropFilter:       'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow:            '0 6px 28px rgba(0,0,0,0.40)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber-400 text-sm font-black shrink-0">⚠</span>
        <p
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: lowConfidence ? '#fbbf24' : 'rgba(255,255,255,0.55)' }}
        >
          {lowConfidence ? 'LOW CONFIDENCE' : 'NO PERSON DETECTED'}
        </p>
      </div>
      <p className="text-white/80 text-sm font-semibold leading-snug">{message}</p>
      {contextHint && (
        <p className="text-white/50 text-[11px] mt-1 leading-snug">{contextHint}</p>
      )}
    </div>
  )
}

function MultipleHumansBadge({ count, message }: { count?: number; message?: string }) {
  const countLabel = count != null && count >= 2 ? `${count} PEOPLE DETECTED` : 'MULTIPLE PEOPLE'
  return (
    <div
      className="w-full max-w-xs rounded-2xl px-4 py-3"
      style={{
        background:           'rgba(239, 68, 68, 0.18)',
        border:               '1px solid rgba(239, 68, 68, 0.50)',
        backdropFilter:       'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow:            '0 6px 28px rgba(0,0,0,0.40)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-red-400 text-sm font-black shrink-0">⚠</span>
        <p className="text-[11px] font-black text-red-300 uppercase tracking-widest">
          {countLabel}
        </p>
      </div>
      <p className="text-white/85 text-sm font-semibold leading-snug">
        {message ?? 'FitCoach works with one person at a time.'}
      </p>
      <p className="text-white/50 text-[11px] mt-1 leading-snug">
        Please make sure only one person is visible.
      </p>
    </div>
  )
}
