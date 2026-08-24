/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          bg: "#0B0F17",
          card: "#131B2A",
          cardBorder: "#1E293B",
          cardHover: "#182236",
          accent: "#3B82F6",
          accentHover: "#2563EB",
          accentGlow: "rgba(59, 130, 246, 0.15)",
          textMuted: "#94A3B8",
          textLight: "#F8FAFC",
          safe: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
