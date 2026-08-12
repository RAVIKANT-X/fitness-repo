import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary (green — health, activity, progress) ──
        primary: {
          DEFAULT: '#16a34a', // green-600
          light: '#dcfce7',   // green-100
          dark: '#15803d',    // green-700
        },
        // ── Backgrounds ──
        background: '#f4f6f8', // soft warm-neutral page background
        surface: {
          DEFAULT: '#ffffff',  // card background
          muted: '#f0f2f5',    // subtle section background
        },
        // ── Border ──
        border: '#e5e7eb',
        // ── Semantic status ──
        success: '#22c55e',
        warning: '#f59e0b',
        error:   '#ef4444',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '1rem',    // rounded-card — standard card radius
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}

export default config
