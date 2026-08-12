import { type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a slightly elevated shadow — useful for featured/hero cards */
  elevated?: boolean
  /** Removes default padding — useful when building custom card layouts */
  noPadding?: boolean
}

/**
 * Reusable surface card.
 *
 * Used for:
 *  - Exercise info
 *  - Statistics / metrics
 *  - Session summaries
 *  - Coaching feedback
 *  - Progress cards
 *  - Dashboard content
 */
export default function Card({
  elevated = false,
  noPadding = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={[
        'bg-surface rounded-card',
        elevated ? 'shadow-card-md' : 'shadow-card',
        noPadding ? '' : 'p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
