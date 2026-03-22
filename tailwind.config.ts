import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: ["Manrope", "sans-serif"],
    },
    extend: {
      colors: {
        surface: {
          0: "#F8F6FC",
          1: "#FFFFFF",
          2: "#F0ECF7",
          3: "#E6E0F0",
          4: "#D9D1E6",
        },
        ink: {
          900: "#1A1225",
          700: "#3D2E54",
          500: "#6B5A82",
          400: "#8E7FA6",
          300: "#B3A8C6",
          200: "#D1CADF",
        },
        accent: {
          DEFAULT: "#7C3AED",
          light: "#A78BFA",
          surface: "rgba(124, 58, 237, 0.06)",
        },
        bull: { DEFAULT: "#16A34A" },
        bear: { DEFAULT: "#DC2626" },
        clear: "#16A34A",
        storm: "#DC2626",
        fog: "#7C3AED",
      },
      borderColor: {
        DEFAULT: "rgba(26, 18, 37, 0.08)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-up-1": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s forwards",
        "fade-up-2": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s forwards",
        "fade-up-3": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s forwards",
        "fade-up-4": "fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s forwards",
        "slide-down": "slideDown 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "breathe": "breathe 4s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.03" },
          "50%": { opacity: "0.06" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
