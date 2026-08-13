/**
 * Tests for smartBreak.ts — SmartBreakTracker class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SmartBreakTracker } from '../features/scanSpace/smartBreak'

describe('SmartBreakTracker', () => {
  let tracker: SmartBreakTracker

  beforeEach(() => {
    tracker = new SmartBreakTracker()
    vi.useRealTimers()
  })

  it('does not show break suggestion before minimum sitting time', () => {
    // Simulate 5 minutes of sitting
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(true, 80)

    vi.setSystemTime(new Date('2024-01-01T09:05:00Z'))
    const sug = tracker.getSuggestion()
    expect(sug.show).toBe(false)
    vi.useRealTimers()
  })

  it('shows break suggestion after minimum sitting time with good posture', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(true, 80)   // start sitting with good posture

    // Advance 21 minutes (> MIN_SITTING_MS of 20 min)
    vi.setSystemTime(new Date('2024-01-01T09:21:00Z'))
    const sug = tracker.getSuggestion()
    expect(sug.show).toBe(true)
    expect(sug.message.length).toBeGreaterThan(0)
    expect(sug.sittingMinutes).toBeGreaterThanOrEqual(21)
    vi.useRealTimers()
  })

  it('suggests break sooner when posture is consistently poor', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(true, 40)   // poor posture

    // After 13 minutes (> POOR_POSTURE_INTERVAL_MS of 12 min)
    vi.setSystemTime(new Date('2024-01-01T09:13:00Z'))
    const sug = tracker.getSuggestion()
    expect(sug.show).toBe(true)
    vi.useRealTimers()
  })

  it('does not show break when not sitting', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(false, 0)   // not sitting

    vi.setSystemTime(new Date('2024-01-01T09:25:00Z'))
    const sug = tracker.getSuggestion()
    expect(sug.show).toBe(false)
    vi.useRealTimers()
  })

  it('snoozeBreak prevents immediate re-suggestion', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(true, 80)

    vi.setSystemTime(new Date('2024-01-01T09:21:00Z'))
    expect(tracker.getSuggestion().show).toBe(true)

    tracker.snoozeBreak()
    // Immediately after snooze — no suggestion
    const after = tracker.getSuggestion()
    expect(after.show).toBe(false)
    vi.useRealTimers()
  })

  it('getSittingMinutes returns 0 when not sitting', () => {
    expect(tracker.getSittingMinutes()).toBe(0)
  })

  it('getSittingMinutes tracks sitting duration', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(true, 75)

    vi.setSystemTime(new Date('2024-01-01T09:10:00Z'))
    expect(tracker.getSittingMinutes()).toBe(10)
    vi.useRealTimers()
  })

  it('reset() clears all state', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T09:00:00Z'))
    tracker.update(true, 80)
    vi.setSystemTime(new Date('2024-01-01T09:25:00Z'))

    tracker.reset()
    expect(tracker.getSittingMinutes()).toBe(0)
    expect(tracker.getSuggestion().show).toBe(false)
    vi.useRealTimers()
  })
})
