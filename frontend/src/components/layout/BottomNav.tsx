import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, TrendingUp, User } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/profile', label: 'Profile', icon: User },
] as const

/**
 * Fixed bottom navigation — mobile only (hidden at md+ where sidebar takes over).
 * Active item gets a filled green pill background for clear affordance.
 */
export default function BottomNav() {
  return (
    <nav
      className={[
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-surface border-t border-border',
        'nav-safe-bottom',
        'md:hidden',
      ].join(' ')}
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch">
        {navItems.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={to === '/'}
              className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[60px] w-full"
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      'flex items-center justify-center w-10 h-7 rounded-full transition-colors duration-150',
                      isActive ? 'bg-primary-light' : '',
                    ].join(' ')}
                  >
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 1.8}
                      className={isActive ? 'text-primary' : 'text-slate-400'}
                      aria-hidden="true"
                    />
                  </span>
                  <span
                    className={[
                      'text-[10px] font-medium transition-colors duration-150',
                      isActive ? 'text-primary font-semibold' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
