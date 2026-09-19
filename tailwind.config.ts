import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          50: '#eef2ff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        accent: '#8b5cf6',
        surface: {
          DEFAULT: '#111120',
          2: '#1a1a2e',
        },
        border: 'rgba(99,102,241,0.18)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease forwards',
        'slide-left': 'slideInLeft 0.4s ease forwards',
        'slide-right': 'slideInRight 0.4s ease forwards',
        'scale-in': 'scaleIn 0.3s ease forwards',
        'pulse-ring': 'pulse-ring 2s infinite',
        'shimmer': 'shimmer 1.8s infinite',
      },
      borderRadius: {
        DEFAULT: '12px',
        sm: '6px',
        lg: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
