import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

/** Maps route paths to human-readable page titles */
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/exercises': 'Exercises',
  '/workout': 'Live Workout',
  '/session-summary': 'Session Summary',
  '/progress': 'Progress',
  '/profile': 'Profile',
}

/**
 * Application shell.
 *
 * Structure:
 *   ┌─────────────────────┐
 *   │       Header        │
 *   ├─────────────────────┤
 *   │   Main (scrollable) │
 *   ├─────────────────────┤
 *   │   BottomNav (mobile)│
 *   └─────────────────────┘
 *
 * On desktop (md+) the bottom nav is hidden.
 * The main area has bottom padding on mobile to clear the fixed BottomNav.
 */
export default function Layout() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'AI Fitness Coach'

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface border-b border-slate-100 shadow-sm">
        <div className="max-w-screen-lg mx-auto px-4 h-14 flex items-center justify-between">
          {/* App brand mark */}
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
                aria-hidden="true"
              >
                {/* Simple human figure / pose icon */}
                <circle cx="12" cy="4" r="1.5" />
                <path d="M12 6v5M9 8l3 3 3-3M12 11l-2 5M12 11l2 5" />
              </svg>
            </span>
            <span className="font-semibold text-slate-900 text-sm tracking-tight">
              FitCoach AI
            </span>
          </div>

          {/* Current page title — centred on mobile */}
          <h1 className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-slate-700 pointer-events-none">
            {title}
          </h1>

          {/* Placeholder for future header actions (notifications, avatar) */}
          <div className="w-7" aria-hidden="true" />
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────── */}
      <main
        className={[
          'flex-1 overflow-y-auto',
          'max-w-screen-lg mx-auto w-full',
          'px-4 py-6',
          // Clear fixed BottomNav on mobile; no extra padding on desktop
          'pb-24 md:pb-6',
        ].join(' ')}
      >
        <Outlet />
      </main>

      {/* ── Bottom navigation (mobile only) ──────────────── */}
      <BottomNav />
    </div>
  )
}
