/**
 * useVoiceCoach — Web Speech API wrapper.
 *
 * Speaks deviation messages and step instructions aloud.
 * Silently no-ops in browsers that don't support SpeechSynthesis.
 *
 * Rules:
 *  - Never speaks the same message twice in a row (de-dupe).
 *  - Cancels any in-progress utterance before speaking a new one.
 *  - Respects the `enabled` toggle — when false, all calls are no-ops.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

const COOLDOWN_MS = 3_000   // minimum gap between two identical messages

export interface UseVoiceCoachReturn {
  enabled: boolean
  supported: boolean
  toggle: () => void
  speak: (text: string, priority?: boolean) => void
}

export function useVoiceCoach(): UseVoiceCoachReturn {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [enabled, setEnabled] = useState(false)   // off by default

  const lastTextRef    = useRef('')
  const lastSpokenRef  = useRef(0)   // timestamp

  // Cancel speech when disabled
  useEffect(() => {
    if (!enabled && supported) window.speechSynthesis.cancel()
  }, [enabled, supported])

  // Cancel on unmount
  useEffect(() => {
    return () => { if (supported) window.speechSynthesis.cancel() }
  }, [supported])

  const speak = useCallback((text: string, priority = false) => {
    if (!enabled || !supported) return
    const now = Date.now()
    // De-dupe: skip if same text was spoken within COOLDOWN_MS
    if (!priority && text === lastTextRef.current && now - lastSpokenRef.current < COOLDOWN_MS) return

    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate   = 0.95
    utt.pitch  = 1.0
    utt.volume = 1.0
    window.speechSynthesis.speak(utt)

    lastTextRef.current   = text
    lastSpokenRef.current = now
  }, [enabled, supported])

  const toggle = useCallback(() => {
    setEnabled((v) => !v)
  }, [])

  return { enabled, supported, toggle, speak }
}
