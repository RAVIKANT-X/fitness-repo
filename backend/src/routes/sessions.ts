/**
 * Session routes — replicates the Python FastAPI session endpoints.
 *
 * POST   /api/v1/sessions          Create a new workout session
 * GET    /api/v1/sessions/:id      Retrieve a session by id
 * GET    /api/v1/sessions          List the 50 most recent sessions
 */

import { Router, type Request, type Response } from 'express'
import { pool } from '../db/client.js'
import {
  SessionCreateSchema,
  rowToResponse,
  type SessionResponse,
} from '../schemas/session.js'
import { ZodError } from 'zod'

export const sessionsRouter = Router()

// ── POST /api/v1/sessions ─────────────────────────────────────────────────────

sessionsRouter.post('/', async (req: Request, res: Response) => {
  let payload
  try {
    payload = SessionCreateSchema.parse(req.body)
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(422).json({ detail: err.errors })
      return
    }
    throw err
  }

  const { rows } = await pool.query<Record<string, unknown>>(
    `INSERT INTO workout_sessions
       (exercise_id, exercise_name, reps, form_status, deviations, started_at, completed_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING *`,
    [
      payload.exercise_id,
      payload.exercise_name,
      payload.reps,
      payload.form_status,
      JSON.stringify(payload.deviations),
      payload.started_at,
      payload.completed_at,
    ],
  )

  const record: SessionResponse = rowToResponse(rows[0])
  res.status(201).json(record)
})

// ── GET /api/v1/sessions/:id ──────────────────────────────────────────────────

sessionsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10)

  if (isNaN(id)) {
    res.status(422).json({ detail: 'id must be an integer' })
    return
  }

  const { rows } = await pool.query<Record<string, unknown>>(
    'SELECT * FROM workout_sessions WHERE id = $1',
    [id],
  )

  if (rows.length === 0) {
    res.status(404).json({ detail: `Session ${id} not found` })
    return
  }

  res.json(rowToResponse(rows[0]))
})

// ── GET /api/v1/sessions ──────────────────────────────────────────────────────

sessionsRouter.get('/', async (_req: Request, res: Response) => {
  const { rows } = await pool.query<Record<string, unknown>>(
    'SELECT * FROM workout_sessions ORDER BY created_at DESC LIMIT 50',
  )

  res.json(rows.map(rowToResponse))
})
