/**
 * sessionService — HTTP client for the WorkoutSession API.
 *
 * Implements the minimal Phase 4.5 session persistence:
 *   POST /api/v1/sessions  — save a completed session
 *   GET  /api/v1/sessions/{id} — retrieve a session
 *   GET  /api/v1/sessions  — list sessions
 *
 * Uses import.meta.env.VITE_API_URL with a local-development fallback
 * of http://localhost:8001 (matches the Docker port mapping 8001:8000).
 *
 * Do NOT save sessions on every camera frame.
 * Call saveSession() only once, after the user clicks Finish Workout.
 */

import type { Deviation } from '../features/analysis/analysisTypes'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8001'

// ── Request / response types ──────────────────────────────────────────────────

export interface SessionPayload {
  exercise_id: string
  exercise_name: string
  reps: number
  form_status: string
  deviations: Deviation[]
  started_at: string   // ISO 8601 UTC
  completed_at: string // ISO 8601 UTC
}

export interface SessionRecord extends SessionPayload {
  id: number
  created_at: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/sessions
 *
 * Saves a completed workout session.
 * Throws an Error if the request fails so the caller can show an error state.
 */
export async function saveSession(payload: SessionPayload): Promise<SessionRecord> {
  const response = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`Failed to save session (${response.status}): ${text}`)
  }

  return response.json() as Promise<SessionRecord>
}

/**
 * GET /api/v1/sessions/{id}
 *
 * Retrieves a saved session by id.
 * Returns null if the session is not found (404).
 * Throws an Error for other failures.
 */
export async function getSession(id: number): Promise<SessionRecord | null> {
  const response = await fetch(`${API_BASE}/api/v1/sessions/${id}`)

  if (response.status === 404) return null

  if (!response.ok) {
    throw new Error(`Failed to fetch session ${id} (${response.status})`)
  }

  return response.json() as Promise<SessionRecord>
}

/**
 * GET /api/v1/sessions
 *
 * Lists recent sessions, newest first.
 */
export async function listSessions(): Promise<SessionRecord[]> {
  const response = await fetch(`${API_BASE}/api/v1/sessions`)

  if (!response.ok) {
    throw new Error(`Failed to list sessions (${response.status})`)
  }

  return response.json() as Promise<SessionRecord[]>
}
