import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-tajawal)", "Tahoma", "sans-serif"]
      },
      colors: {
        parchment: "#F6F3EC",
        ink: {
          DEFAULT: "#23201A",
          soft: "#6B655A"
        },
        primary: {
          DEFAULT: "#1E3A34",
          light: "#2E534B",
          dark: "#122622"
        },
        gold: {
          DEFAULT: "#B8862E",
          light: "#D3A54E",
          dark: "#8F6A20"
        },
        good: "#2F7D52",
        warn: "#B45309",
        bad: "#B3261E",
        line: "#E4DFD3"
      },
      borderRadius: {
        card: "14px"
      }
    }
  },
  plugins: []
};
export default config;
