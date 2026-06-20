/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        deep: '#0A0F1D',
        card: '#121829',
        'card-hover': '#1A2235',
        border: '#1E294B',
        'border-light': '#2A3558',
        cyan: '#00F2FE',
        violet: '#7000FF',
        pink: '#FF007A',
        success: '#10B981',
        warning: '#F59E0B',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
      },
      backdropBlur: {
        glass: '16px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 242, 254, 0.15)',
        'glow-violet': '0 0 20px rgba(112, 0, 255, 0.15)',
        'glow-pink': '0 0 20px rgba(255, 0, 122, 0.15)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
    },
  },
  plugins: [],
};
