import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom color variables moved from :root
        accent: {
          DEFAULT: '#3b82f6', // blue-500
          dark: '#2563eb', // blue-600
        },
        navy: '#1e3a8a', // blue-900
        gray: {
          DEFAULT: '#6b7280', // gray-500
          light: '#f3f4f6', // gray-100
        },
        'light-blue': '#38bdf8', // sky-400
        'text-dark': '#374151', // gray-700
      },
    },
  },
  plugins: [],
} satisfies Config
