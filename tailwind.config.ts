import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#f3eee4",
        ink: "#14221e",
        pine: "#1c6b4a",
        lime: "#d6f25c",
        clay: "#e24b2b",
        paper: "#fffdf8",
        line: "#e4d9c6",
        mist: "#f7f4ee",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 40px rgba(20, 34, 30, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
