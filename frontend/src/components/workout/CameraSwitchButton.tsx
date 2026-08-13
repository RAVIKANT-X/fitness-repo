/**
 * CameraSwitchButton — floating glassmorphism camera-flip button.
 *
 * Renders as a 48×48 circular button in the top-right corner of the
 * camera area. Visible while the camera is active (or in requesting state).
 *
 * Props:
 *   onSwitch  — called when the user taps the button
 *   disabled  — disable during transitions (default: false)
 *   facing    — current camera direction; used for aria-label
 */

import { RefreshCw } from 'lucide-react'
import type { CameraFacing } from '../../features/camera/cameraTypes'

interface CameraSwitchButtonProps {
  onSwitch: () => void
  disabled?: boolean
  facing?: CameraFacing
}

export default function CameraSwitchButton({
  onSwitch,
  disabled = false,
  facing = 'user',
}: CameraSwitchButtonProps) {
  const label = facing === 'user' ? 'Switch to back camera' : 'Switch to front camera'

  return (
    <button
      onClick={onSwitch}
      disabled={disabled}
      aria-label="Switch camera"
      title={label}
      className="absolute top-3 right-3 z-20 flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-40"
      style={{
        width:               '48px',
        height:              '48px',
        background:          'rgba(0, 0, 0, 0.45)',
        backdropFilter:      'blur(16px) saturate(1.6)',
        WebkitBackdropFilter:'blur(16px) saturate(1.6)',
        border:              '1px solid rgba(255, 255, 255, 0.22)',
        boxShadow:           '0 4px 20px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.12)',
        // Ensure button is always on top of pose overlays
        touchAction:         'manipulation',
      }}
    >
      <RefreshCw
        size={20}
        strokeWidth={2.2}
        style={{ color: 'rgba(255,255,255,0.90)' }}
        aria-hidden="true"
      />
    </button>
  )
}
