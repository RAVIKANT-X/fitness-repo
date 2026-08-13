import { Outlet, useLocation, NavLink } from 'react-router-dom'
import { Home, Dumbbell, TrendingUp, User } from 'lucide-react'
import BottomNav from './BottomNav'

/**
 * Routes where the mobile top header is hidden (camera-first full-screen pages).
 * These pages also get no bottom padding from Layout — they manage their own
 * safe-area clearance via the .camera-controls CSS class.
 */
const HEADER_HIDDEN_ROUTES = new Set(['/workout', '/calibrate', '/scan-space'])

/** Returns true when the current path is a camera-first page. */
function isCameraRoute(pathname: string): boolean {
  return HEADER_HIDDEN_ROUTES.has(pathname)
    || pathname.startsWith('/calibrate/')
}

/** Desktop sidebar nav items — mirrors BottomNav. */
const sidebarItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/profile', label: 'Profile', icon: User },
] as const

/**
 * Application shell.
 *
 * Mobile  : sticky minimal header + fixed BottomNav
 * Desktop : persistent left sidebar, no BottomNav, centred content (max 480px)
 */
export default function Layout() {
  const { pathname } = useLocation()
  const showHeader = !isCameraRoute(pathname)

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop sidebar (md+) ──────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-border sticky top-0 h-screen">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <FitCoachIcon />
          </span>
          <span className="font-bold text-slate-900 text-base tracking-tight">FitCoach AI</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
          {sidebarItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-primary-light text-primary font-semibold'
                    : 'text-slate-500 hover:bg-surface-muted hover:text-slate-800',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} aria-hidden="true" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Version stamp */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-xs text-slate-400">FitCoach AI · v0.2.0</p>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Mobile header (hidden on desktop) ─────────────────── */}
        {showHeader && (
          <header
            className="md:hidden sticky top-0 z-40"
            style={{
              background: 'rgba(244,246,248,0.80)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              borderBottom: '1px solid rgba(229,231,235,0.6)',
            }}
          >
            <div className="flex items-center gap-2.5 px-4 h-14">
              <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0"
                style={{ boxShadow: '0 2px 8px rgba(22,163,74,0.30)' }}>
                <FitCoachIcon />
              </span>
              <span className="font-bold text-slate-900 text-sm tracking-tight">FitCoach AI</span>
            </div>
          </header>
        )}

        {/* ── Page content ──────────────────────────────────────── */}
        <main
          className={[
            'flex-1 md:max-w-[480px] md:mx-auto md:w-full',
            showHeader
              // Normal scrollable pages: horizontal padding + bottom clearance
              // for the fixed BottomNav. Uses the CSS custom property so it
              // stays in sync with the actual navbar height + device safe area.
              ? 'overflow-y-auto px-4 py-5 md:pb-8'
              // Camera pages: no padding at all — the page fills 100dvh itself
              // and manages its own bottom clearance via .camera-controls.
              : 'overflow-hidden p-0',
          ].join(' ')}
          style={showHeader ? {
            // scrollable pages: reserve space below last content item
            paddingBottom: 'var(--page-bottom-clearance)',
          } : undefined}
        >
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom navigation ──────────────────────────── */}
      <BottomNav />
    </div>
  )
}

/** Inline SVG brand icon — human figure / pose silhouette. */
function FitCoachIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 6v5M9 8l3 3 3-3M12 11l-2 5M12 11l2 5" />
    </svg>
  )
}
