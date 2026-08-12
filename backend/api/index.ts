/**
 * Vercel serverless entry point.
 *
 * Vercel discovers this file because it lives at api/index.ts relative to
 * the backend/ root directory (set in vercel.json).
 *
 * The ONLY job of this file is to re-export the Express app as the default
 * export. All business logic stays in src/.
 */

import { app } from '../src/app.js'

export default app
