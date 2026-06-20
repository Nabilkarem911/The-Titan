/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Background layers ──
        void: '#0A0E1A',
        surface: '#111827',
        elevated: '#1A2234',
        sidebar: '#0D1320',
        // ── Borders ──
        'border-subtle': '#1E293B',
        'border-default': '#334155',
        // ── Text ──
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        // ── Accents ──
        accent: {
          primary: '#06B6D4',
          secondary: '#8B5CF6',
          tertiary: '#10B981',
        },
        // ── Status ──
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        queued: '#6366F1',
        running: '#06B6D4',
        // ── Legacy compat ──
        deep: '#0A0E1A',
        card: '#111827',
        'card-hover': '#1A2234',
        border: '#1E293B',
        'border-light': '#334155',
        cyan: '#06B6D4',
        violet: '#8B5CF6',
        pink: '#FF007A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
        'h1': ['28px', { lineHeight: '1.3', fontWeight: '700' }],
        'h2': ['22px', { lineHeight: '1.4', fontWeight: '600' }],
        'h3': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['15px', { lineHeight: '1.6' }],
        'small': ['13px', { lineHeight: '1.5' }],
        'label': ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        'caption': ['11px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        badge: '6px',
        tag: '4px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.3)',
        'md': '0 4px 12px rgba(0,0,0,0.4)',
        'lg': '0 8px 24px rgba(0,0,0,0.5)',
        'glow': '0 0 20px rgba(6,182,212,0.15)',
        'glow-cyan': '0 0 20px rgba(6,182,212,0.15)',
        'glow-violet': '0 0 20px rgba(139,92,246,0.15)',
        'glow-pink': '0 0 20px rgba(255,0,122,0.15)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%)',
        'gradient-surface': 'linear-gradient(180deg, #111827 0%, #0A0E1A 100%)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
        '150': '150ms',
        '250': '250ms',
      },
      keyframes: {
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'shimmer': 'shimmer 1.5s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 300ms ease-out',
        'scale-in': 'scale-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
