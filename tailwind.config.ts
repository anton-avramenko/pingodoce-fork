import type { Config } from 'tailwindcss';

/**
 * Brand tokens replicating the target app's design system:
 * signature green, white surfaces, gray typography and a red accent
 * used for discount values.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3C8C40', // primary UI green (text, active states, prices)
          dark: '#2E7D32', // darker green (active nav, emphasis)
          deep: '#1F5E24', // darkest green
          mid: '#5A9E30', // buttons / floating action
          lime: '#8CC63F', // bright card accent
          card1: '#A2CD4F', // digital card gradient top
          card2: '#6FB02F', // digital card gradient bottom
          tint: '#EAF4DE', // light green surface tint (balance rows, active coupon)
          tintDark: '#DCEBC6',
        },
        accent: {
          red: '#D8231C', // promo tags / partner badges
        },
        cream: '#F4ECD8', // cream disc inside green coupon art
        campaign: {
          from: '#B4DA5A', // campaign banner gradient
          to: '#8CC63F',
          disc: '#7CB534', // darker circle on the banner
        },
        ink: {
          DEFAULT: '#1D1F18', // near-black headings
          soft: '#5B5E54', // secondary text
          faint: '#8A8D82', // tertiary text / disabled
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F2F3EF', // app background gray
          line: '#E6E7E1', // hairline borders
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 2px 10px rgba(0, 0, 0, 0.07)',
        nav: '0 -2px 12px rgba(0, 0, 0, 0.08)',
        sheet: '0 -8px 30px rgba(0, 0, 0, 0.22)',
      },
      keyframes: {
        'view-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'view-in': 'view-in 180ms ease-out',
        'sheet-up': 'sheet-up 240ms cubic-bezier(0.2, 0.8, 0.3, 1)',
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
