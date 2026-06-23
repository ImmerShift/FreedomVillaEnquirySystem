/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Freedom Villa palette — light theme from the Claude Design handoff
        fv: {
          accent: '#15A3A0',        // primary teal
          'accent-deep': '#0E8482', // deep teal (labels/icons)
          'accent-text': '#0E7E7C',
          'accent-tint': '#6FD0CE', // teal on dark band
          'accent-soft': '#E7F4F3', // soft teal bg
          'accent-soft-border': '#A6DAD8',
          'accent-label': '#2E8E8C',
          ink: '#1B3A5B',           // navy headings
          band: '#1B3A5B',          // dark navy band
          'app-bg': '#EEF3F3',      // app background (mint)
          card: '#FFFFFF',
          'card-border': '#E2EAEA',
          'side-bg': '#F6FAFA',
          'side-border': '#E0E9E9',
          gold: '#C5A880',          // document letterhead gold
          alert: '#ED6B3F',         // balance due / warnings
          // colour code (mirrors the Excel manual)
          'type-bg': '#EEF3FA',     // blue — you type
          'type-border': '#C2D3E6',
          'type-text': '#3F77AC',
          'pull-bg': '#EDF5E8',     // green — pulled in
          'pull-border': '#9FC98A',
          'pull-text': '#5E8C49',
        },
        ink: {
          900: '#213547',
          700: '#3F4B55',
          600: '#56636D',
          500: '#6B7780',
          400: '#8A97A1',
          300: '#9AA7AE',
        },
      },
      fontFamily: {
        sans: ['Raleway', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
