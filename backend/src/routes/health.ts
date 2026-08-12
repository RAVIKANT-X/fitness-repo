/**
 * Health check routes.
 *
 * GET /health          — primary (root-level, matches Python main.py)
 * GET /api/v1/health   — versioned alias
 */

import { Router, type Request, type Response } from 'express'

export const healthRouter = Router()

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})
