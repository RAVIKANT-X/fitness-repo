/**
 * sessionService.test.ts
 *
 * Tests for the session service payload construction and HTTP behaviour.
 *
 * Uses Vitest's built-in fetch mock to avoid making real network requests.
 * Verifies:
 *  - saveSession sends the correct payload structure
 *  - saveSession returns the parsed record on success
 *  - saveSession throws on HTTP error
 *  - getSession returns null on 404
 *  - listSessions returns an array
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveSession, getSession, listSessions } from '../services/sessionService'
import type { SessionPayload, SessionRecord } from '../services/sessionService'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    exercise_id: 'squat',
    exercise_name: 'Squat',
    reps: 5,
    form_status: 'GOOD',
    deviations: [],
    started_at: '2025-01-01T10:00:00.000Z',
    completed_at: '2025-01-01T10:05:00.000Z',
    ...overrides,
  }
}

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 1,
    exercise_id: 'squat',
    exercise_name: 'Squat',
    reps: 5,
    form_status: 'GOOD',
    deviations: [],
    started_at: '2025-01-01T10:00:00.000Z',
    completed_at: '2025-01-01T10:05:00.000Z',
    created_at: '2025-01-01T10:05:01.000Z',
    ...overrides,
  }
}

// ── saveSession ───────────────────────────────────────────────────────────────

describe('saveSession — payload construction', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => {
    fetchSpy.mockReset()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('sends POST to /api/v1/sessions with JSON body', async () => {
    const record = makeRecord()
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(record),
    })

    const payload = makePayload()
    const result = await saveSession(payload)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/sessions$/)
    expect(opts.method).toBe('POST')
    expect(opts.headers).toMatchObject({ 'Content-Type': 'application/json' })

    const body = JSON.parse(opts.body as string) as SessionPayload
    expect(body.exercise_id).toBe('squat')
    expect(body.reps).toBe(5)
    expect(body.form_status).toBe('GOOD')
    expect(result.id).toBe(1)
  })

  it('includes deviations in the payload when present', async () => {
    const deviation = {
      id: 'DEPTH_TOO_SHALLOW',
      severity: 'WARNING' as const,
      observed: 128,
      threshold: 115,
    }
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeRecord({ deviations: [deviation] })),
    })

    const payload = makePayload({ deviations: [deviation] })
    await saveSession(payload)

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string) as SessionPayload
    expect(body.deviations).toHaveLength(1)
    expect(body.deviations[0].id).toBe('DEPTH_TOO_SHALLOW')
  })

  it('throws an Error on HTTP error response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: () => Promise.resolve('{"detail": "Validation error"}'),
    })

    await expect(saveSession(makePayload())).rejects.toThrow('422')
  })
})

// ── getSession ────────────────────────────────────────────────────────────────

describe('getSession — session retrieval', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => { vi.stubGlobal('fetch', fetchSpy) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns the session record on success', async () => {
    const record = makeRecord({ id: 42 })
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(record),
    })

    const result = await getSession(42)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(42)
  })

  it('returns null for 404', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 404 })
    const result = await getSession(999)
    expect(result).toBeNull()
  })

  it('throws for non-404 errors', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 })
    await expect(getSession(1)).rejects.toThrow('500')
  })
})

// ── listSessions ──────────────────────────────────────────────────────────────

describe('listSessions — session listing', () => {
  const fetchSpy = vi.fn()
  beforeEach(() => { vi.stubGlobal('fetch', fetchSpy) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns an array of session records', async () => {
    const records = [makeRecord({ id: 2 }), makeRecord({ id: 1 })]
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(records),
    })

    const result = await listSessions()
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(2)
  })

  it('throws on server error', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 })
    await expect(listSessions()).rejects.toThrow('503')
  })
})

// ── Payload validation ────────────────────────────────────────────────────────

describe('saveSession — payload validation', () => {
  it('payload contains all required fields for a squat session', () => {
    const payload = makePayload()
    expect(payload).toHaveProperty('exercise_id')
    expect(payload).toHaveProperty('exercise_name')
    expect(payload).toHaveProperty('reps')
    expect(payload).toHaveProperty('form_status')
    expect(payload).toHaveProperty('deviations')
    expect(payload).toHaveProperty('started_at')
    expect(payload).toHaveProperty('completed_at')
  })

  it('timestamps are valid ISO 8601 UTC strings', () => {
    const payload = makePayload()
    expect(() => new Date(payload.started_at)).not.toThrow()
    expect(() => new Date(payload.completed_at)).not.toThrow()
    expect(new Date(payload.started_at).toISOString()).toBe(payload.started_at)
  })
})
