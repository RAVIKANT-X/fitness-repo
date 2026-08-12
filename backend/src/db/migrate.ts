/**
 * Database migration — creates the workout_sessions table if it does not exist.
 *
 * Run once before starting the server:
 *   npm run migrate
 *
 * Replaces the Alembic migration from the Python backend.
 */

import { pool } from './client.js'

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS workout_sessions (
    id           SERIAL PRIMARY KEY,
    exercise_id  VARCHAR(64)  NOT NULL,
    exercise_name VARCHAR(128) NOT NULL,
    reps         INTEGER      NOT NULL DEFAULT 0,
    form_status  VARCHAR(16)  NOT NULL DEFAULT 'GOOD',
    deviations   JSONB        NOT NULL DEFAULT '[]',
    started_at   TIMESTAMPTZ  NOT NULL,
    completed_at TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_workout_sessions_exercise_id
    ON workout_sessions (exercise_id);

  CREATE INDEX IF NOT EXISTS idx_workout_sessions_created_at
    ON workout_sessions (created_at DESC);
`

async function migrate(): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query(CREATE_TABLE_SQL)
    console.log('Migration complete: workout_sessions table is ready.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
