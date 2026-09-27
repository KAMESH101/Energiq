/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: { 0: 'var(--surface-0)', 1: 'var(--surface-1)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        ink: { 1: 'var(--text-primary)', 2: 'var(--text-secondary)', 3: 'var(--text-tertiary)' },
        line: { subtle: 'var(--border-subtle)', DEFAULT: 'var(--border-default)', strong: 'var(--border-strong)' },
        energy: {
          green: 'var(--energy-green)', amber: 'var(--energy-amber)', red: 'var(--energy-red)',
          blue: 'var(--energy-blue)', purple: 'var(--energy-purple)', cyan: 'var(--energy-cyan)',
        },
      },
    },
  },
  plugins: [],
};
