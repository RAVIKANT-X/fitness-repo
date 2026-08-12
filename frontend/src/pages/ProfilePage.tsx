import { User, Bell, Shield, ChevronRight } from 'lucide-react'
import Card from '../components/ui/Card'

const settingsGroups = [
  {
    heading: 'Account',
    items: [
      { icon: User, label: 'Profile Details', description: 'Name, age, fitness goals' },
    ],
  },
  {
    heading: 'Preferences',
    items: [
      { icon: Bell, label: 'Notifications', description: 'Workout reminders' },
      { icon: Shield, label: 'Privacy', description: 'Camera and data permissions' },
    ],
  },
]

/**
 * Profile / Settings page — Phase 1 placeholder.
 *
 * Will eventually:
 *  - Allow users to set name, age, and fitness goals
 *  - Configure notification preferences
 *  - Manage camera / data permissions
 *  - Show app version and phase
 */
export default function ProfilePage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Profile</h2>
        <p className="text-slate-500 text-sm mt-0.5">Settings and preferences</p>
      </div>

      {/* Avatar placeholder */}
      <Card elevated className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center shrink-0">
          <User size={26} className="text-primary" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Your Name</p>
          <p className="text-xs text-slate-500 mt-0.5">Profile setup coming soon</p>
        </div>
      </Card>

      {/* Settings groups */}
      {settingsGroups.map((group) => (
        <div key={group.heading}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {group.heading}
          </h3>
          <Card noPadding>
            {group.items.map(({ icon: Icon, label, description }, idx) => (
              <div
                key={label}
                className={[
                  'flex items-center justify-between px-5 py-4',
                  idx < group.items.length - 1
                    ? 'border-b border-slate-50'
                    : '',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center">
                    <Icon size={16} className="text-slate-500" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{description}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
              </div>
            ))}
          </Card>
        </div>
      ))}

      {/* App info */}
      <Card className="text-center bg-surface-muted border border-dashed border-slate-200">
        <p className="text-xs text-slate-400">FitCoach AI · Phase 1 — Foundation</p>
        <p className="text-xs text-slate-300 mt-0.5">v0.1.0</p>
      </Card>
    </div>
  )
}
