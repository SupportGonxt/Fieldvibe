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
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        ui: ['Instrument Sans', 'Inter', 'system-ui', 'sans-serif'],
        data: ['DM Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: {
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
        accent: {
          blue: '#36A2EB',
          purple: '#9B59B6',
          green: '#2ECC71',
          orange: '#F39C12',
          cyan: '#00BCD4',
          pink: '#E91E63',
        },
        surface: {
          DEFAULT: '#ffffff',
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
        pulse: {
          DEFAULT: '#00E87B',
          50: '#E6FFF3',
          100: '#B3FFD9',
          200: '#80FFBF',
          300: '#4DFFA6',
          400: '#1AFF8C',
          500: '#00E87B',
          600: '#00B862',
          700: '#008849',
          800: '#005830',
          900: '#002817',
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'dropdown': '0 10px 40px rgba(0, 0, 0, 0.12)',
        'stat': '0 4px 20px rgba(0, 0, 0, 0.08)',
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
