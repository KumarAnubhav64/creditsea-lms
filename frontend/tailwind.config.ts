import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce7fd',
          200: '#c0d4fc',
          300: '#94b8fa',
          400: '#6193f6',
          500: '#3d6df0',
          600: '#274ce5',
          700: '#1e3ad1',
          800: '#1f31a9',
          900: '#1f2f86',
          950: '#171f51',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
