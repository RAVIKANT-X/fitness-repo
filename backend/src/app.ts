/**
 * Express application — replaces Python FastAPI main.py.
 *
 * Exported as `app` so it can be consumed by:
 *   - src/server.ts     (local dev / Docker)
 *   - api/index.ts      (Vercel serverless)
 */

import express from 'express'
import cors from 'cors'
import { sessionsRouter } from './routes/sessions.js'
import { healthRouter } from './routes/health.js'

export const app = express()

// ── CORS ──────────────────────────────────────────────────────────────────────
const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,https://posture-fitness.vercel.app'
const allowedOrigins = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
)

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/health', healthRouter)
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/sessions', sessionsRouter)

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ detail: 'Internal server error' })
})
