import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        goblin: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        gold: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        profit: "#22c55e",
        loss: "#ef4444",
        neutral: "#6b7280",
      },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 2s infinite",
        "float-slow": "float 8s ease-in-out 1s infinite",
        "goblin-glow": "goblin-glow 2s ease-in-out infinite",
        "gold-shimmer": "gold-shimmer 3s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "coin-spin": "coin-spin 8s linear infinite",
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "particle-rise": "particle-rise 4s ease-out infinite",
        "log-flash": "log-flash 0.5s ease-out",
        "goblin-blink": "goblin-blink 4s ease-in-out infinite",
        "goblin-breathe": "goblin-breathe 3s ease-in-out infinite",
        "scan-line": "scan-line 8s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "goblin-glow": {
          "0%, 100%": { boxShadow: "0 0 5px rgba(34,197,94,0.3), 0 0 20px rgba(34,197,94,0.1)" },
          "50%": { boxShadow: "0 0 20px rgba(34,197,94,0.6), 0 0 40px rgba(34,197,94,0.2)" },
        },
        "gold-shimmer": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7", filter: "brightness(1.3)" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "coin-spin": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34,197,94,0.4)" },
          "50%": { boxShadow: "0 0 0 10px rgba(34,197,94,0)" },
        },
        "particle-rise": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "1" },
          "100%": { transform: "translateY(-100px) scale(0)", opacity: "0" },
        },
        "log-flash": {
          "0%": { backgroundColor: "rgba(34,197,94,0.15)" },
          "100%": { backgroundColor: "transparent" },
        },
        "goblin-blink": {
          "0%, 90%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.1)" },
        },
        "goblin-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        "scan-line": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      backgroundImage: {
        "goblin-gradient": "linear-gradient(135deg, #14532d 0%, #030712 50%, #1a1a2e 100%)",
        "gold-gradient": "linear-gradient(135deg, #f59e0b, #fbbf24, #f59e0b)",
        "card-gradient": "linear-gradient(180deg, rgba(22,101,52,0.1) 0%, rgba(3,7,18,0) 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
