import { type ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark ' +
    'disabled:bg-primary/40 disabled:cursor-not-allowed',
  secondary:
    'bg-primary-light text-primary hover:bg-green-200 active:bg-green-200 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'border border-primary text-primary bg-transparent hover:bg-primary-light ' +
    'active:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-base rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-xl',
}

/**
 * Reusable button component.
 * Supports primary, secondary, and outline variants with three sizes.
 * Touch-friendly minimum target size enforced via min-h.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-colors duration-150 select-none',
        'min-h-[44px]', // WCAG touch target minimum
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
