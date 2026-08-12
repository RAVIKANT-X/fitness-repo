/**
 * PostgreSQL connection pool.
 *
 * Reads DATABASE_URL from the environment.
 * Shared by all route modules — import { pool } from './client.js'
 */

import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep connections alive across serverless warm starts
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})
