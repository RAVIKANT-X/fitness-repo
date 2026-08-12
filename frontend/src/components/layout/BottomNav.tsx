import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, TrendingUp, User } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/profile', label: 'Profile', icon: User },
] as const

/**
 * Fixed bottom navigation bar — visible on mobile, hidden on md+ screens.
 * Active route is highlighted with the primary green colour.
 */
export default function BottomNav() {
  return (
    <nav
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-surface border-t border-slate-100',
        'nav-safe-bottom',
        // Hidden on desktop — desktop uses sidebar/header nav (future)
        'md:hidden',
      ].join(' ')}
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'} // exact match for root only
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-0.5',
                  'py-2 min-h-[56px] w-full',
                  'text-xs font-medium transition-colors duration-150',
                  isActive
                    ? 'text-primary'
                    : 'text-slate-400 hover:text-slate-600',
                ].join(' ')
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
