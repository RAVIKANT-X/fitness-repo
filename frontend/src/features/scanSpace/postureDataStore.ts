/**
 * Posture Data Store — persists daily posture tracking data to localStorage.
 *
 * Tracks real measured data only. Never fabricates entries.
 *
 * Data model (per calendar day):
 *   - totalSittingMs           total desk-sitting time
 *   - goodPostureMs            sitting time with posture score >= 70
 *   - warningPostureMs         sitting time with posture score < 70
 *   - movementBreaks           number of times user took/was prompted for a break
 *   - avgPostureScore          running average
 *   - commonIssue              most frequently triggered coaching key
 *   - longestContinuousSitMs   longest single sitting stretch
 *
 * Data is stored per ISO date key (YYYY-MM-DD) to support the ProgressPage.
 */

const STORAGE_KEY = 'fitcoach_posture_data_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyPostureRecord {
  date: string              // ISO YYYY-MM-DD
  totalSittingMs: number
  goodPostureMs: number
  warningPostureMs: number
  movementBreaks: number
  avgPostureScore: number
  scoreReadings: number     // count used for rolling average
  commonIssue: string | null
  issueCounts: Record<string, number>
  longestContinuousSitMs: number
  currentSitStartMs: number | null   // transient: null when not sitting
}

export type PostureDataMap = Record<string, DailyPostureRecord>

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadAll(): PostureDataMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PostureDataMap) : {}
  } catch {
    return {}
  }
}

function saveAll(data: PostureDataMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage quota exceeded — silently skip
  }
}

function getOrCreate(data: PostureDataMap, date: string): DailyPostureRecord {
  if (!data[date]) {
    data[date] = {
      date,
      totalSittingMs:         0,
      goodPostureMs:          0,
      warningPostureMs:       0,
      movementBreaks:         0,
      avgPostureScore:        0,
      scoreReadings:          0,
      commonIssue:            null,
      issueCounts:            {},
      longestContinuousSitMs: 0,
      currentSitStartMs:      null,
    }
  }
  return data[date]
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a posture analysis frame.
 * Call at analysis rate (~8fps) when the user is sitting.
 *
 * @param postureScore  0–100 from analysePosture()
 * @param isSitting     whether user is currently in a sitting activity
 * @param deltaMs       time since last call in milliseconds
 * @param triggedIssueKey  coaching key that triggered this frame (if any)
 */
export function recordPostureFrame(
  postureScore: number,
  isSitting: boolean,
  deltaMs: number,
  triggeredIssueKey: string | null = null,
): void {
  const data = loadAll()
  const today = todayKey()
  const rec = getOrCreate(data, today)

  if (isSitting) {
    rec.totalSittingMs += deltaMs

    // Start of a new continuous sitting stretch
    if (rec.currentSitStartMs === null) {
      rec.currentSitStartMs = Date.now()
    }

    // Sitting quality
    if (postureScore > 0) {
      // Running average
      rec.scoreReadings++
      rec.avgPostureScore =
        (rec.avgPostureScore * (rec.scoreReadings - 1) + postureScore) / rec.scoreReadings

      if (postureScore >= 70) {
        rec.goodPostureMs += deltaMs
      } else {
        rec.warningPostureMs += deltaMs
      }
    }

    // Track triggered issues
    if (triggeredIssueKey) {
      rec.issueCounts[triggeredIssueKey] = (rec.issueCounts[triggeredIssueKey] ?? 0) + 1
      // Update commonIssue
      const entries = Object.entries(rec.issueCounts)
      if (entries.length > 0) {
        rec.commonIssue = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
      }
    }
  } else {
    // Just stood up — close the continuous sit stretch
    if (rec.currentSitStartMs !== null) {
      const stretchMs = Date.now() - rec.currentSitStartMs
      if (stretchMs > rec.longestContinuousSitMs) {
        rec.longestContinuousSitMs = stretchMs
      }
      rec.currentSitStartMs = null
    }
  }

  data[today] = rec
  saveAll(data)
}

/** Record a movement break. */
export function recordBreak(): void {
  const data = loadAll()
  const today = todayKey()
  const rec = getOrCreate(data, today)
  rec.movementBreaks++

  // Close current sit stretch
  if (rec.currentSitStartMs !== null) {
    const stretchMs = Date.now() - rec.currentSitStartMs
    if (stretchMs > rec.longestContinuousSitMs) rec.longestContinuousSitMs = stretchMs
    rec.currentSitStartMs = null
  }

  data[today] = rec
  saveAll(data)
}

/** Returns posture data for the last N days (most recent first). */
export function getRecentPostureData(days = 7): DailyPostureRecord[] {
  const data = loadAll()
  const results: DailyPostureRecord[] = []

  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (data[key]) {
      results.push(data[key])
    }
  }
  return results
}

/** Returns today's record or null if no data yet. */
export function getTodayPostureRecord(): DailyPostureRecord | null {
  const data = loadAll()
  return data[todayKey()] ?? null
}
