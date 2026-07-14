/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        ui: ['Instrument Sans', 'system-ui', 'sans-serif'],
        data: ['DM Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand — RGB-triplet var so slash opacity (bg-primary/20) works
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          strong: 'var(--color-primary-strong)',
          soft: 'var(--color-primary-soft)',
        },
        'on-primary': 'var(--color-on-primary)',
        // Old blue "primary" scale renamed info (chart/info blue) — hexes unchanged
        info: {
          50: '#e6f4ff',
          100: '#bae0ff',
          200: '#91caff',
          300: '#69b1ff',
          400: '#4096ff',
          500: '#1890ff',
          600: '#0958d9',
          700: '#003eb3',
          800: '#002c8c',
          900: '#001d66',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        accent: {
          blue: '#36A2EB',
          purple: '#9B59B6',
          green: '#2ECC71',
          orange: '#F39C12',
          cyan: '#00BCD4',
          pink: '#E91E63',
        },
        // Semantic surfaces (flip with .dark via tokens.css); rgb form for slash opacity
        bg: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised-rgb) / <alpha-value>)',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
        },
        night: {
          DEFAULT: '#0A0F1C',
          50: '#1A1F2E',
          100: '#141929',
          200: '#0F1629',
          300: '#0A0F1C',
          400: '#070B15',
          500: '#04060D',
        },
        // pulse remapped onto primary var (spec §1.2); numbered fallbacks live in tokens.css comment
        pulse: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          600: 'var(--color-primary-strong)',
        },
      },
      textColor: {
        token: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
      },
      borderColor: {
        token: 'var(--color-border)',
      },
      divideColor: {
        token: 'var(--color-border)',
      },
      borderRadius: {
        'xl': 'var(--radius-lg)',
        '2xl': 'var(--radius-xl)',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': 'var(--elevation-card)',
        'card-hover': 'var(--elevation-card-hover)',
        'dropdown': 'var(--elevation-raised)',
        'stat': 'var(--elevation-hero)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-blue': 'linear-gradient(135deg, #36A2EB 0%, #4FC3F7 100%)',
        'gradient-purple': 'linear-gradient(135deg, #9B59B6 0%, #8E44AD 100%)',
        'gradient-green': 'linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)',
        'gradient-orange': 'linear-gradient(135deg, #F39C12 0%, #E67E22 100%)',
      },
    },
  },
  plugins: [],
}
