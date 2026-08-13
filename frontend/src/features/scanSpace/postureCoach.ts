/**
 * Posture Coach — persistent-deviation detector and coaching message selector.
 *
 * The coach uses a temporal accumulator per issue type to avoid false positives
 * from brief, transient posture changes (e.g. turning head quickly).
 *
 * An issue is only "triggered" when it has been present for a configurable
 * number of consecutive analysis frames (PERSISTENCE_FRAMES).
 *
 * After an issue triggers, a cooldown prevents the same message from being
 * delivered again too quickly.
 *
 * Usage:
 *   const coach = new PostureCoach()
 *   // Each analysis frame:
 *   const message = coach.update(postureResult, spaceResult)
 *   if (message) speak(message)
 */

import type { PostureAnalysisResult } from './postureAnalysis'
import type { SpaceAnalysisResult } from './spaceAnalysis'

// ── Config ────────────────────────────────────────────────────────────────────

/** Frames a POOR/FAIR issue must persist before a coaching message is triggered */
const PERSISTENCE_FRAMES = 25     // ~2s at 12fps analysis rate

/** ms cooldown before the same coaching message can be repeated */
const COACHING_COOLDOWN_MS = 25_000

/** ms cooldown before any coaching message is spoken again */
const GLOBAL_COOLDOWN_MS = 8_000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CoachingMessage {
  text: string
  /** Higher priority = should be spoken over a lower-priority pending message */
  priority: number
  issueKey: string
}

// ── PostureCoach class ────────────────────────────────────────────────────────

export class PostureCoach {
  /** frame count per issue key */
  private persistenceCounters: Map<string, number> = new Map()
  /** last time each message was delivered */
  private lastDeliveredAt: Map<string, number> = new Map()
  /** last time ANY message was delivered */
  private lastGlobalAt = 0

  /**
   * Feed the latest analysis results and get back a coaching message if one
   * should be surfaced, or null if nothing new needs to be said.
   */
  update(
    posture: PostureAnalysisResult,
    space: SpaceAnalysisResult,
  ): CoachingMessage | null {
    if (!posture.reliable) {
      this.persistenceCounters.clear()
      return null
    }

    const now = Date.now()
    const candidates: CoachingMessage[] = []

    // ── Collect posture issues ────────────────────────────────────────────
    const checks = [
      posture.checks.headForwardProtraction,
      posture.checks.torsoInclination,
      posture.checks.headNeck,
      posture.checks.shoulderAlignment,
    ]

    for (const check of checks) {
      if (!check.measured || !check.coaching) continue
      if (check.rating === 'GOOD') {
        // Reset counter on improvement
        this.persistenceCounters.set(check.label, 0)
        continue
      }

      const key = check.label
      const count = (this.persistenceCounters.get(key) ?? 0) + 1
      this.persistenceCounters.set(key, count)

      if (count >= PERSISTENCE_FRAMES) {
        const lastAt = this.lastDeliveredAt.get(key) ?? 0
        if (now - lastAt >= COACHING_COOLDOWN_MS) {
          candidates.push({
            text: check.coaching,
            priority: check.rating === 'POOR' ? 2 : 1,
            issueKey: key,
          })
        }
      }
    }

    // ── Space coaching issue ──────────────────────────────────────────────
    if (space.userPosition.coaching && !space.userPosition.optimized) {
      const key = 'space_position'
      const count = (this.persistenceCounters.get(key) ?? 0) + 1
      this.persistenceCounters.set(key, count)

      if (count >= PERSISTENCE_FRAMES) {
        const lastAt = this.lastDeliveredAt.get(key) ?? 0
        if (now - lastAt >= COACHING_COOLDOWN_MS) {
          candidates.push({
            text: space.userPosition.coaching,
            priority: 1,
            issueKey: key,
          })
        }
      }
    } else {
      this.persistenceCounters.set('space_position', 0)
    }

    if (candidates.length === 0) return null

    // Global cooldown check
    if (now - this.lastGlobalAt < GLOBAL_COOLDOWN_MS) return null

    // Pick highest priority candidate
    const best = candidates.reduce((a, b) => b.priority > a.priority ? b : a)
    this.lastDeliveredAt.set(best.issueKey, now)
    this.lastGlobalAt = now

    return best
  }

  /** Reset all state (e.g. on unmount or camera stop). */
  reset(): void {
    this.persistenceCounters.clear()
    this.lastDeliveredAt.clear()
    this.lastGlobalAt = 0
  }
}
