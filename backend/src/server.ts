/**
 * Local development / Docker entry point.
 *
 * Starts the Express server on PORT (default 8000).
 * Vercel does NOT use this file — see api/index.ts instead.
 */

import { app } from './app.js'

const PORT = parseInt(process.env.PORT ?? '8000', 10)

app.listen(PORT, () => {
  console.log(`AI Fitness Coach API running on http://localhost:${PORT}`)
})
