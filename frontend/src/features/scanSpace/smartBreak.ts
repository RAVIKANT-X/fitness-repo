/**
 * Smart Break Tracker — monitors continuous sitting time and posture quality
 * to suggest movement breaks at appropriate moments.
 *
 * NOT a simple fixed timer. The suggestion integrates:
 *   - Cumulative sitting duration
 *   - Average posture score over the sitting period
 *   - Whether a break was recently taken
 *
 * Exposed as a simple class — instantiate once per ScanYourSpace session.
 */

// ── Config ────────────────────────────────────────────────────────────────────

/** Minimum sitting time (ms) before a break can be suggested */
const MIN_SITTING_MS = 20 * 60 * 1000     // 20 minutes

/**
 * If average posture score is below this threshold, shorten the interval
 * before a break is suggested (bad posture → suggest sooner).
 */
const POOR_POSTURE_THRESHOLD = 60

/** Shortened interval when posture is poor */
const POOR_POSTURE_INTERVAL_MS = 12 * 60 * 1000   // 12 minutes

/** Cooldown after a break is dismissed or taken */
const BREAK_COOLDOWN_MS = 15 * 60 * 1000           // 15 minutes

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BreakSuggestion {
  show: boolean
  message: string
  /** Minutes of continuous sitting */
  sittingMinutes: number
}

// ── SmartBreakTracker class ───────────────────────────────────────────────────

export class SmartBreakTracker {
  private sittingStartMs: number | null = null
  private lastBreakMs: number | null = null
  private postureScoreHistory: number[] = []
  private isSitting = false

  /** Called each analysis frame with the current activity and posture score */
  update(isSittingActivity: boolean, postureScore: number): void {
    const now = Date.now()

    if (isSittingActivity) {
      if (!this.isSitting) {
        // Transition into sitting
        this.sittingStartMs = now
        this.isSitting = true
      }
      if (postureScore > 0) {
        this.postureScoreHistory.push(postureScore)
        // Keep history bounded
        if (this.postureScoreHistory.length > 500) this.postureScoreHistory.shift()
      }
    } else {
      if (this.isSitting) {
        // Transitioned out of sitting — record as a natural break
        this.lastBreakMs = now
        this.sittingStartMs = null
        this.isSitting = false
        this.postureScoreHistory = []
      }
    }
  }

  /** Returns break suggestion state. Call from UI to decide whether to show the prompt. */
  getSuggestion(): BreakSuggestion {
    if (!this.isSitting || this.sittingStartMs === null) {
      return { show: false, message: '', sittingMinutes: 0 }
    }

    const now = Date.now()
    const sittingMs = now - this.sittingStartMs
    const sittingMinutes = Math.floor(sittingMs / 60_000)

    // Check cooldown
    if (this.lastBreakMs !== null && now - this.lastBreakMs < BREAK_COOLDOWN_MS) {
      return { show: false, message: '', sittingMinutes }
    }

    const avgScore = this.postureScoreHistory.length > 0
      ? this.postureScoreHistory.reduce((a, b) => a + b, 0) / this.postureScoreHistory.length
      : 100

    const interval = avgScore < POOR_POSTURE_THRESHOLD
      ? POOR_POSTURE_INTERVAL_MS
      : MIN_SITTING_MS

    if (sittingMs < interval) {
      return { show: false, message: '', sittingMinutes }
    }

    const quality = avgScore >= 75 ? '' : ' Your posture score has been low too.'
    const message = `You've been sitting for ${sittingMinutes} minutes.${quality} Take a short movement break?`

    return { show: true, message, sittingMinutes }
  }

  /** Record that the user acknowledged the break (either took it or dismissed). */
  snoozeBreak(): void {
    this.lastBreakMs = Date.now()
    this.sittingStartMs = Date.now()   // reset sitting clock
    this.postureScoreHistory = []
  }

  /** Record that the user took the break. */
  takeBreak(): void {
    this.lastBreakMs = Date.now()
    this.sittingStartMs = null
    this.isSitting = false
    this.postureScoreHistory = []
  }

  /** Reset everything (page unmount / camera stop). */
  reset(): void {
    this.sittingStartMs = null
    this.lastBreakMs = null
    this.isSitting = false
    this.postureScoreHistory = []
  }

  getSittingMinutes(): number {
    if (!this.sittingStartMs) return 0
    return Math.floor((Date.now() - this.sittingStartMs) / 60_000)
  }
}
