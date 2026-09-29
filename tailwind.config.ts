import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        blush: {
          50: "#fdf6f7",
          100: "#fcecee",
          200: "#f8d5da",
          300: "#f0aeb8",
          400: "#e47d90",
          500: "#d2556f",
          600: "#bc3a58",
          700: "#9e2d49",
          800: "#842940",
          900: "#71263a",
        },
        ink: {
          50: "#f6f5f4",
          100: "#e8e6e3",
          200: "#d2cec8",
          700: "#3f3a36",
          800: "#2a2623",
          900: "#1c1917",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -18px rgba(44, 24, 16, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
