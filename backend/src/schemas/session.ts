/**
 * Shared Zod schemas and TypeScript types for WorkoutSession.
 *
 * Mirrors the Python Pydantic schemas exactly so the API contract is unchanged.
 */

import { z } from 'zod'

// ── Deviation ─────────────────────────────────────────────────────────────────

export const DeviationSchema = z.object({
  id: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR']),
  angleName: z.string().optional(),
  observed: z.number(),
  threshold: z.number(),
})

export type Deviation = z.infer<typeof DeviationSchema>

// ── Session create (request body) ─────────────────────────────────────────────

export const SessionCreateSchema = z.object({
  exercise_id: z.string().min(1).max(64),
  exercise_name: z.string().min(1).max(128),
  reps: z.number().int().min(0),
  form_status: z.enum(['GOOD', 'WARNING', 'INVALID']),
  deviations: z.array(DeviationSchema).default([]),
  started_at: z.string().datetime({ offset: true }),
  completed_at: z.string().datetime({ offset: true }),
})

export type SessionCreate = z.infer<typeof SessionCreateSchema>

// ── Session response ──────────────────────────────────────────────────────────

export interface SessionResponse {
  id: number
  exercise_id: string
  exercise_name: string
  reps: number
  form_status: string
  deviations: Deviation[]
  started_at: string
  completed_at: string
  created_at: string
}

/** Map a raw DB row to the SessionResponse shape. */
export function rowToResponse(row: Record<string, unknown>): SessionResponse {
  return {
    id: row.id as number,
    exercise_id: row.exercise_id as string,
    exercise_name: row.exercise_name as string,
    reps: row.reps as number,
    form_status: row.form_status as string,
    deviations: (row.deviations ?? []) as Deviation[],
    started_at: (row.started_at as Date).toISOString(),
    completed_at: (row.completed_at as Date).toISOString(),
    created_at: (row.created_at as Date).toISOString(),
  }
}
