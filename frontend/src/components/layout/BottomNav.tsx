import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Dumbbell, TrendingUp, User, ScanLine } from 'lucide-react'

const navItems = [
  { to: '/',           label: 'Home',      icon: Home,         activeColor: '#16a34a', glowColor: 'rgba(22,163,74,0.35)'    },
  { to: '/exercises',  label: 'Exercises', icon: Dumbbell,     activeColor: '#7c3aed', glowColor: 'rgba(124,58,237,0.35)'   },
  { to: '/scan-space', label: 'Scan',      icon: ScanLine,     activeColor: '#0ea5e9', glowColor: 'rgba(14,165,233,0.35)'   },
  { to: '/progress',   label: 'Progress',  icon: TrendingUp,   activeColor: '#f59e0b', glowColor: 'rgba(245,158,11,0.35)'   },
  { to: '/profile',    label: 'Profile',   icon: User,         activeColor: '#f59e0b', glowColor: 'rgba(245,158,11,0.35)'   },
] as const

type NavItem = typeof navItems[number]

/**
 * Floating glassmorphism bottom navigation — mobile only (hidden at md+).
 *
 * Positioning:
 *   fixed; bottom = env(safe-area-inset-bottom) so the pill sits above the
 *   Android gesture bar / iOS home indicator.  The --nav-height CSS variable
 *   is written to :root so that camera pages and scrollable pages can reserve
 *   exactly the right amount of bottom clearance without guessing.
 *
 * Height budget (must match --nav-height in index.css):
 *   pill (py-1.5 × 2 = 12px) + item (min-h-[48px]) ≈ 60px
 *   + bottom gap (env safe area ≥ 0px, clamped to ≥ 8px) ≈ 8–34px
 *   Total visual space reserved from viewport bottom: ~64px pill + safe area
 */
export default function BottomNav() {
  const { pathname } = useLocation()
  const [popKey, setPopKey] = useState<string | null>(null)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname
      setPopKey(pathname)
      const t = setTimeout(() => setPopKey(null), 450)
      return () => clearTimeout(t)
    }
  }, [pathname])

  function isActive(item: NavItem): boolean {
    if (item.to === '/') return pathname === '/'
    return pathname.startsWith(item.to)
  }

  return (
    /*
     * The nav is positioned:
     *   fixed
     *   left/right: 0  (full width background slot)
     *   bottom: 0
     *
     * The pill itself is centred inside with a left auto / right auto margin
     * and has bottom padding = safe-area-inset-bottom so it never overlaps
     * the Android system bar.
     *
     * We do NOT use "bottom: 4" (16px) as a fixed offset because that ignores
     * the safe area and leaves a gap on notched devices.
     */
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-center"
      aria-label="Main navigation"
      style={{
        // Transparent background — only the pill itself is visible
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        paddingLeft:  '12px',
        paddingRight: '12px',
        paddingTop:   '8px',
      }}
    >
      {/* Glass pill container */}
      <div
        className="rounded-[32px] px-1.5 py-1.5 flex items-center w-full"
        style={{
          maxWidth: '400px',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(32px) saturate(2.0) brightness(1.05)',
          WebkitBackdropFilter: 'blur(32px) saturate(2.0) brightness(1.05)',
          border: '1px solid rgba(255,255,255,0.70)',
          boxShadow: [
            '0 12px 40px rgba(0,0,0,0.14)',
            '0 4px 12px rgba(0,0,0,0.08)',
            '0 1px 3px rgba(0,0,0,0.06)',
            'inset 0 1px 0 rgba(255,255,255,0.95)',
          ].join(', '),
        }}
      >
        <ul className="flex items-stretch w-full">
          {navItems.map((item) => {
            const active = isActive(item)
            const popping = popKey === item.to
            const Icon = item.icon

            return (
              <li key={item.to} className="flex-1">
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className="flex flex-col items-center justify-center gap-0.5 py-1.5 min-h-[48px] w-full"
                  aria-label={item.label}
                >
                  {/* Icon pill */}
                  <span
                    className={[
                      'flex items-center justify-center w-10 h-7 rounded-2xl transition-all duration-300',
                      popping ? 'animate-nav-pop' : '',
                    ].join(' ')}
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${item.activeColor}, ${item.activeColor}cc)`,
                            boxShadow: `0 3px 12px ${item.glowColor}, 0 1px 4px rgba(0,0,0,0.10)`,
                            transform: popping ? undefined : 'scale(1.05)',
                          }
                        : {
                            background: 'transparent',
                          }
                    }
                  >
                    <Icon
                      size={17}
                      strokeWidth={active ? 2.5 : 1.8}
                      style={{ color: active ? '#ffffff' : '#94a3b8' }}
                      aria-hidden="true"
                    />
                  </span>

                  {/* Label */}
                  <span
                    className="text-[8.5px] font-semibold tracking-wide transition-all duration-300 leading-none"
                    style={{ color: active ? item.activeColor : '#94a3b8' }}
                  >
                    {item.label}
                  </span>

                  {/* Active dot indicator */}
                  <span
                    className="h-1 rounded-full transition-all duration-300"
                    style={{
                      width: active ? '18px' : '4px',
                      background: active ? item.activeColor : 'transparent',
                      opacity: active ? 0.5 : 0,
                      marginTop: '-1px',
                    }}
                  />
                </NavLink>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
