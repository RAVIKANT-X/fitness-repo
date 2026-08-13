/**
 * ProgressPage — major upgrade to a premium fitness analytics dashboard.
 *
 * Features (all driven by real session data from the backend):
 *  - Overall Score: computed from form quality, consistency, and session history
 *  - Streak: current and best streak, daily activity grid
 *  - Exercise performance breakdown
 *  - Real insights based on actual data
 *  - Empty state for new users
 *
 * Rules:
 *  - NEVER fabricates data or statistics
 *  - Empty state shown clearly when no sessions exist
 *  - Score components are transparent and explained
 *  - No fake AI insights — only data-driven statements
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Dumbbell, TrendingUp, ChevronRight,
  Flame, Target, Star, Award, BarChart2, Clock, ScanLine,
} from 'lucide-react'
import { listSessions } from '../services/sessionService'
import type { SessionRecord } from '../services/sessionService'
import { getRecentPostureData } from '../features/scanSpace/postureDataStore'
import type { DailyPostureRecord } from '../features/scanSpace/postureDataStore'

// ── Score computation ─────────────────────────────────────────────────────────

interface ScoreBreakdown {
  overall: number
  formQuality: number
  consistency: number
  progress: number
  hasEnoughData: boolean
}

function computeScores(sessions: SessionRecord[]): ScoreBreakdown {
  if (sessions.length < 2) {
    return { overall: 0, formQuality: 0, consistency: 0, progress: 0, hasEnoughData: false }
  }

  // Form quality: % of GOOD form sessions
  const goodCount = sessions.filter((s) => s.form_status === 'GOOD').length
  const formQuality = Math.round((goodCount / sessions.length) * 100)

  // Consistency: how many of last 7 days had a session
  const now = Date.now()
  const day = 86400000
  const activeDaysIn7 = new Set(
    sessions
      .filter((s) => now - new Date(s.completed_at).getTime() <= 7 * day)
      .map((s) => new Date(s.completed_at).toDateString()),
  ).size
  const consistency = Math.min(100, Math.round((activeDaysIn7 / 7) * 100))

  // Progress: average reps per session (recent vs earlier), capped to 0–100
  const recent = sessions.slice(0, Math.ceil(sessions.length / 2))
  const older  = sessions.slice(Math.ceil(sessions.length / 2))
  const recentAvg = recent.reduce((s, r) => s + r.reps, 0) / recent.length
  const olderAvg  = older.reduce((s, r) => s + r.reps, 0) / older.length
  const progressRaw = olderAvg > 0 ? Math.min(100, Math.round((recentAvg / olderAvg) * 80)) : 70
  const progress = Math.max(10, progressRaw)

  const overall = Math.round((formQuality * 0.45 + consistency * 0.35 + progress * 0.20))

  return { overall, formQuality, consistency, progress, hasEnoughData: true }
}

// ── Streak computation ────────────────────────────────────────────────────────

interface StreakData {
  current: number
  best: number
  totalSessions: number
  activeDays: Set<string>
}

function computeStreak(sessions: SessionRecord[]): StreakData {
  if (sessions.length === 0) {
    return { current: 0, best: 0, totalSessions: 0, activeDays: new Set() }
  }

  // Build set of unique active days (one per calendar day)
  const dayStrings = sessions.map((s) =>
    new Date(s.completed_at).toLocaleDateString('en-CA'), // YYYY-MM-DD
  )
  const activeDays = new Set(dayStrings)
  const sortedDays = Array.from(activeDays).sort()

  // Compute current streak (counting backwards from today)
  const today = new Date().toLocaleDateString('en-CA')
  let current = 0
  const checkDate = new Date()
  while (true) {
    const ds = checkDate.toLocaleDateString('en-CA')
    if (activeDays.has(ds)) {
      current++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      // Allow one day gap (session logged yesterday still counts today)
      if (current === 0 && ds === today) {
        checkDate.setDate(checkDate.getDate() - 1)
        const yesterday = checkDate.toLocaleDateString('en-CA')
        if (activeDays.has(yesterday)) {
          current++
          checkDate.setDate(checkDate.getDate() - 1)
          continue
        }
      }
      break
    }
  }

  // Compute best streak from sorted days
  let best = 0
  let run = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diffDays === 1) {
      run++
      best = Math.max(best, run)
    } else {
      run = 1
    }
  }
  best = Math.max(best, current, sortedDays.length > 0 ? 1 : 0)

  return {
    current,
    best,
    totalSessions: sessions.length,
    activeDays: new Set(sortedDays),
  }
}

// ── Exercise performance breakdown ────────────────────────────────────────────

interface ExercisePerf {
  id: string
  name: string
  sessions: number
  goodFormPct: number
  totalReps: number
}

function computeExercisePerf(sessions: SessionRecord[]): ExercisePerf[] {
  const map = new Map<string, SessionRecord[]>()
  for (const s of sessions) {
    const list = map.get(s.exercise_id) ?? []
    list.push(s)
    map.set(s.exercise_id, list)
  }

  return Array.from(map.entries())
    .map(([id, recs]) => ({
      id,
      name: recs[0].exercise_name,
      sessions: recs.length,
      goodFormPct: Math.round((recs.filter((r) => r.form_status === 'GOOD').length / recs.length) * 100),
      totalReps: recs.reduce((s, r) => s + r.reps, 0),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 5)
}

// ── Insights builder ──────────────────────────────────────────────────────────

function buildInsights(sessions: SessionRecord[], streak: StreakData, scores: ScoreBreakdown): string[] {
  const insights: string[] = []
  if (!scores.hasEnoughData) return insights

  if (scores.formQuality >= 80) {
    insights.push(`Your form quality is excellent — ${scores.formQuality}% good-form sessions.`)
  } else if (scores.formQuality < 60) {
    insights.push(`Focus on form — ${100 - scores.formQuality}% of sessions had form notes.`)
  }

  if (streak.current >= 3) {
    insights.push(`You're on a ${streak.current}-day streak. Keep it going!`)
  }

  const perf = computeExercisePerf(sessions)
  const best = perf.find((p) => p.goodFormPct >= 85)
  if (best) {
    insights.push(`You perform ${best.name} with ${best.goodFormPct}% good form.`)
  }

  if (scores.consistency >= 60) {
    insights.push(`You're training consistently — active on ${Math.round(scores.consistency / 100 * 7).toFixed(0)} of the last 7 days.`)
  }

  return insights.slice(0, 3)
}

// ── Weekly activity grid ──────────────────────────────────────────────────────

function WeeklyActivity({ activeDays }: { activeDays: Set<string> }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const today = new Date()
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    // Start from Monday of current week
    const dow = today.getDay() // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    d.setDate(today.getDate() + mondayOffset + i)
    return d.toLocaleDateString('en-CA')
  })

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-slate-400" aria-hidden="true" />
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Weekly Activity</span>
      </div>
      <div className="flex gap-2">
        {days.map((day, i) => {
          const active = activeDays.has(weekDates[i])
          const isToday = weekDates[i] === today.toLocaleDateString('en-CA')
          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full aspect-square rounded-xl flex items-center justify-center"
                style={{
                  background: active
                    ? 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                    : 'rgba(241,245,249,1)',
                  boxShadow: active ? '0 2px 8px rgba(14,165,233,0.30)' : 'none',
                  border: isToday && !active ? '2px solid #0ea5e9' : 'none',
                }}
              >
                {active && (
                  <div className="w-2 h-2 rounded-full bg-white/90" />
                )}
              </div>
              <span className={[
                'text-[9px] font-semibold',
                isToday ? 'text-sky-500' : 'text-slate-400',
              ].join(' ')}>
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, label, size = 96 }: { score: number; label: string; size?: number }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={10} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={color} strokeWidth={10}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{score}</span>
          <span className="text-[9px] text-slate-400 font-semibold">/100</span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-600 text-center">{label}</span>
    </div>
  )
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-700 font-medium">{label}</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ── Session row ───────────────────────────────────────────────────────────────

function SessionRow({ session, onTap }: { session: SessionRecord; onTap: () => void }) {
  const formGood = session.form_status === 'GOOD'
  const date = new Date(session.completed_at)
  const dateStr = date.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 py-3.5 border-b border-border last:border-0 text-left active:bg-surface-muted transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
        <Dumbbell size={16} className="text-sky-500" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{session.exercise_name}</p>
        <p className="text-xs text-slate-500 mt-0.5">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900 tabular-nums">{session.reps}</p>
          <p className="text-[10px] text-slate-400">reps</p>
        </div>
        <span className={[
          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
          formGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
        ].join(' ')}>
          {formGood ? 'Good' : 'Fair'}
        </span>
        <ChevronRight size={14} className="text-slate-300" aria-hidden="true" />
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [postureRecords, setPostureRecords] = useState<DailyPostureRecord[]>([])

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setError('Could not load sessions. Check your connection.'))
      .finally(() => setLoading(false))

    // Load local posture data — never throws, localStorage is best-effort
    setPostureRecords(getRecentPostureData(7))
  }, [])

  const scores = computeScores(sessions)
  const streak = computeStreak(sessions)
  const exercisePerf = computeExercisePerf(sessions)
  const insights = buildInsights(sessions, streak, scores)

  // ── Posture summary ───────────────────────────────────────────────────────
  const totalSittingMin = Math.round(
    postureRecords.reduce((s, r) => s + r.totalSittingMs, 0) / 60_000
  )
  const avgPostureScore = postureRecords.length > 0
    ? Math.round(
        postureRecords.filter((r) => r.avgPostureScore > 0)
          .reduce((s, r) => s + r.avgPostureScore, 0) /
        (postureRecords.filter((r) => r.avgPostureScore > 0).length || 1)
      )
    : 0
  const totalBreaks = postureRecords.reduce((s, r) => s + r.movementBreaks, 0)
  const hasPostureData = postureRecords.some((r) => r.totalSittingMs > 0)

  return (
    <div className="space-y-5 pt-1 pb-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Progress</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your fitness analytics</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
          <BarChart2 size={18} className="text-sky-500" aria-hidden="true" />
        </div>
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-surface rounded-2xl shadow-card py-10 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-sky-400/40 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading your progress…</p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <p className="text-sm text-slate-500 text-center">{error}</p>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!loading && !error && sessions.length === 0 && (
        <div className="space-y-4">
          {/* Empty score card */}
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(241,245,249,1) 100%)',
              border: '1px solid rgba(226,232,240,1)',
            }}
          >
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Star size={28} className="text-slate-300" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-slate-700 mb-2">No sessions yet</h2>
            <p className="text-sm text-slate-500 leading-relaxed mb-1">
              Complete your first session to see your score and analytics here.
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Your overall score is based on real workout data — it won't be fabricated.
            </p>
            <button
              onClick={() => navigate('/exercises')}
              className="bg-primary text-white font-bold rounded-2xl px-6 py-3 min-h-[48px] active:bg-primary-dark transition-colors text-sm"
            >
              Start Your First Workout
            </button>
          </div>

          {/* Empty streak card */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Flame size={16} className="text-slate-300" />} value="0" label="Current Streak" />
            <StatCard icon={<Award size={16} className="text-slate-300" />} value="0" label="Best Streak" />
            <StatCard icon={<Clock size={16} className="text-slate-300" />} value="0" label="Sessions" />
          </div>

          <div className="bg-surface rounded-2xl shadow-card p-5">
            <WeeklyActivity activeDays={new Set()} />
          </div>
        </div>
      )}

      {/* ── Data view (sessions exist) ────────────────────────────────── */}
      {!loading && !error && sessions.length > 0 && (
        <>
          {/* ── Overall Score card ──────────────────────────────────── */}
          {scores.hasEnoughData ? (
            <div
              className="rounded-2xl p-5 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Star size={14} className="text-amber-400" aria-hidden="true" />
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Overall Score</span>
              </div>
              <div className="flex items-center gap-5">
                <ScoreRing score={scores.overall} label="Movement Quality" />
                <div className="flex-1 space-y-3">
                  <ScoreBar label="Form Quality"  value={scores.formQuality}  color="#22c55e" />
                  <ScoreBar label="Consistency"   value={scores.consistency}  color="#0ea5e9" />
                  <ScoreBar label="Progress"      value={scores.progress}     color="#a855f7" />
                </div>
              </div>
              <p className="text-[10px] text-white/25 mt-4 leading-relaxed">
                Score based on form quality, training consistency, and performance improvement.
                Not medically validated.
              </p>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl shadow-card p-5 text-center">
              <p className="text-sm font-semibold text-slate-700 mb-1">Score needs more data</p>
              <p className="text-xs text-slate-400">Complete at least 2 sessions to see your overall score.</p>
            </div>
          )}

          {/* ── Streak + Stats ───────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Flame size={16} className={streak.current > 0 ? 'text-orange-500' : 'text-slate-300'} />}
              value={String(streak.current)}
              label={streak.current === 1 ? 'Day Streak' : 'Day Streak'}
              accent={streak.current > 0}
              accentColor="orange"
            />
            <StatCard
              icon={<Award size={16} className="text-amber-500" />}
              value={String(streak.best)}
              label="Best Streak"
              accentColor="amber"
            />
            <StatCard
              icon={<Dumbbell size={16} className="text-sky-500" />}
              value={String(streak.totalSessions)}
              label="Sessions"
              accentColor="sky"
            />
          </div>

          {/* ── Weekly Activity ──────────────────────────────────────── */}
          <div className="bg-surface rounded-2xl shadow-card p-5">
            <WeeklyActivity activeDays={streak.activeDays} />
          </div>

          {/* ── Streak motivation ────────────────────────────────────── */}
          {streak.current === 0 && sessions.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-3">
              <Flame size={16} className="text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-amber-700">
                Train today to start a new streak! Your best was <strong>{streak.best}</strong> day{streak.best !== 1 ? 's' : ''}.
              </p>
            </div>
          )}

          {/* ── Exercise Performance ─────────────────────────────────── */}
          {exercisePerf.length > 0 && (
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target size={14} className="text-slate-400" aria-hidden="true" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Exercise Performance</span>
              </div>
              <div className="space-y-4">
                {exercisePerf.map((ex) => (
                  <div key={ex.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-sm font-semibold text-slate-800">{ex.name}</span>
                        <span className="text-xs text-slate-400 ml-2">
                          {ex.sessions} session{ex.sessions !== 1 ? 's' : ''} · {ex.totalReps} reps
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">{ex.goodFormPct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${ex.goodFormPct}%`,
                          background: ex.goodFormPct >= 80
                            ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                            : ex.goodFormPct >= 60
                            ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                            : 'linear-gradient(90deg, #ef4444, #dc2626)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Insights ─────────────────────────────────────────────── */}
          {insights.length > 0 && (
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-slate-400" aria-hidden="true" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Insights</span>
              </div>
              <div className="space-y-2.5">
                {insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-2" />
                    <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Not enough data for insights ─────────────────────────── */}
          {insights.length === 0 && sessions.length < 4 && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs text-slate-500 text-center">
                Complete more sessions to unlock personalised insights.
              </p>
            </div>
          )}

          {/* ── Session history ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-slate-400" aria-hidden="true" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Session History ({sessions.length})
              </span>
            </div>
            <div className="bg-surface rounded-2xl shadow-card px-4">
              {sessions.slice(0, 10).map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onTap={() => navigate('/session-summary', { state: { sessionId: s.id } })}
                />
              ))}
              {sessions.length > 10 && (
                <p className="text-xs text-slate-400 text-center py-3">
                  Showing 10 of {sessions.length} sessions
                </p>
              )}
            </div>
          </div>

          {/* ── Posture & Space data ──────────────────────────────────── */}
          <PostureDataSection
            records={postureRecords}
            hasData={hasPostureData}
            totalSittingMin={totalSittingMin}
            avgPostureScore={avgPostureScore}
            totalBreaks={totalBreaks}
            onScan={() => navigate('/scan-space')}
          />
        </>
      )}

      {/* ── Posture section in empty state too ───────────────────────── */}
      {!loading && !error && sessions.length === 0 && (
        <PostureDataSection
          records={postureRecords}
          hasData={hasPostureData}
          totalSittingMin={totalSittingMin}
          avgPostureScore={avgPostureScore}
          totalBreaks={totalBreaks}
          onScan={() => navigate('/scan-space')}
        />
      )}
    </div>
  )
}

// ── Posture Data Section ──────────────────────────────────────────────────────

function PostureDataSection({
  records, hasData, totalSittingMin, avgPostureScore, totalBreaks, onScan,
}: {
  records: DailyPostureRecord[]
  hasData: boolean
  totalSittingMin: number
  avgPostureScore: number
  totalBreaks: number
  onScan: () => void
}) {
  const scoreColor = avgPostureScore >= 70 ? 'text-emerald-600'
    : avgPostureScore >= 45 ? 'text-amber-600'
    : 'text-rose-600'

  const sittingHours = (totalSittingMin / 60).toFixed(1)

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine size={14} className="text-sky-500" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Posture & Space (7 days)</span>
        </div>
        <button
          onClick={onScan}
          className="flex items-center gap-1 text-xs text-sky-500 font-semibold active:opacity-70"
        >
          Open <ChevronRight size={12} />
        </button>
      </div>

      {!hasData ? (
        /* Empty state */
        <div
          className="rounded-2xl p-5 text-center"
          style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}
        >
          <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center mx-auto mb-3">
            <ScanLine size={22} className="text-sky-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 mb-1">No posture data yet</h3>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Use Scan Your Space to start tracking your desk posture and workspace habits.
          </p>
          <button
            onClick={onScan}
            className="bg-sky-500 text-white font-bold text-xs rounded-2xl px-5 py-2.5 active:bg-sky-600"
          >
            Start Scanning
          </button>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-surface rounded-2xl shadow-card p-3.5 text-center">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${scoreColor}`}>
                {avgPostureScore > 0 ? avgPostureScore : '—'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">Avg Posture</p>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-3.5 text-center">
              <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">
                {sittingHours}h
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">Desk Time</p>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-3.5 text-center">
              <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">
                {totalBreaks}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">Breaks Taken</p>
            </div>
          </div>

          {/* Per-day posture bars */}
          {records.length > 0 && (
            <div className="bg-surface rounded-2xl shadow-card p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Daily Posture Score</p>
              <div className="flex items-end gap-1.5 h-10">
                {records.slice(0, 7).reverse().map((rec, i) => {
                  const score = Math.round(rec.avgPostureScore)
                  const height = score > 0 ? Math.max(6, (score / 100) * 40) : 4
                  const barColor = score >= 70 ? 'bg-emerald-400' : score >= 45 ? 'bg-amber-400' : score > 0 ? 'bg-rose-400' : 'bg-slate-200'
                  const label = new Date(rec.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-sm ${barColor} transition-all`}
                        style={{ height: `${height}px` }}
                        title={score > 0 ? `${label}: ${score}/100` : `${label}: no data`}
                      />
                      <span className="text-[8px] text-slate-400 font-medium">{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Small stat card ───────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, accent = false, accentColor = 'slate',
}: {
  icon: React.ReactNode
  value: string
  label: string
  accent?: boolean
  accentColor?: string
}) {
  const bg = accent
    ? accentColor === 'orange' ? 'bg-orange-50' : 'bg-amber-50'
    : 'bg-surface'

  return (
    <div className={`${bg} rounded-2xl shadow-card p-3.5 text-center`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xl font-extrabold text-slate-900 tabular-nums leading-none">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1 leading-tight">{label}</p>
    </div>
  )
}
