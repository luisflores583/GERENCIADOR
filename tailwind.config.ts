import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0e2a47",
        ink: "#1c1915",
        sand: "#f6ead7",
        dune: "#e7d3b0",
        coral: "#e36a3a",
        ocean: "#1f7a8c",
        foam: "#fbf7f1",
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-fraunces)", "ui-serif", "Georgia"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(14, 42, 71, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
