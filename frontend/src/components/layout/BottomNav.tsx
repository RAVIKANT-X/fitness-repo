import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, TrendingUp, User } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/exercises', label: 'Exercises', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/profile', label: 'Profile', icon: User },
] as const

/**
 * Floating glassmorphism bottom navigation — mobile only (hidden at md+).
 * Frosted-glass pill that floats above the page content with blur backdrop.
 */
export default function BottomNav() {
  return (
    <nav
      className={[
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'md:hidden',
        'nav-safe-bottom',
      ].join(' ')}
      aria-label="Main navigation"
      style={{ width: 'min(calc(100vw - 2rem), 360px)' }}
    >
      {/* Glass pill container */}
      <div
        className="rounded-[28px] px-2 py-1.5 flex items-center"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.55)',
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <ul className="flex items-stretch w-full">
          {navItems.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className="flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px] w-full"
                aria-label={label}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'flex items-center justify-center w-11 h-8 rounded-2xl transition-all duration-200',
                        isActive
                          ? 'bg-primary shadow-sm scale-105'
                          : 'hover:bg-slate-100',
                      ].join(' ')}
                      style={
                        isActive
                          ? { boxShadow: '0 2px 8px rgba(22,163,74,0.35)' }
                          : {}
                      }
                    >
                      <Icon
                        size={19}
                        strokeWidth={isActive ? 2.5 : 1.8}
                        className={isActive ? 'text-white' : 'text-slate-500'}
                        aria-hidden="true"
                      />
                    </span>
                    <span
                      className={[
                        'text-[9px] font-semibold tracking-wide transition-colors duration-200',
                        isActive ? 'text-primary' : 'text-slate-400',
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
      </div>
    </nav>
  )
}
