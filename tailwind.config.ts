import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-tajawal)", "Tahoma", "sans-serif"]
      },
      colors: {
        // لمسة "كنسي دافئ": عنابي وذهبي على خلفية كريمية — بدّلنا هنا بس قيم نفس
        // الأسماء القديمة (primary/gold/parchment/line)، فكل الصفحات اللي كانت
        // بتستخدم bg-primary أو text-gold من الأول بقت بالألوان الجديدة تلقائيًا
        // من غير ما نلمس كل صفحة لوحدها.
        parchment: "#FBF3E7",
        ink: {
          DEFAULT: "#2E2117",
          soft: "#7A6A55"
        },
        primary: {
          DEFAULT: "#7A1F2B",
          light: "#9C3B45",
          dark: "#5A1620"
        },
        gold: {
          DEFAULT: "#C7A24A",
          light: "#E3C896",
          dark: "#A17F32"
        },
        good: "#2F7D52",
        warn: "#B45309",
        bad: "#B3261E",
        line: "#ECDFC8"
      },
      borderRadius: {
        card: "14px"
      }
    }
  },
  plugins: []
};
export default config;
