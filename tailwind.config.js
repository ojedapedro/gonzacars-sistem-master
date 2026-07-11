/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        metal: {
          darkest: '#08090d',
          darker:  '#0c0e14',
          dark:    '#10131a',
          base:    '#161922',
          mid:     '#1c2030',
          light:   '#252a3a',
          lighter: '#2f3549',
          border:  '#2a2f42',
        },
        chrome: {
          100: '#e8eaf0',
          200: '#c8ccd8',
          300: '#a8aebf',
          400: '#8890a6',
          500: '#6b7394',
        },
      },
    },
  },
  plugins: [],
}
