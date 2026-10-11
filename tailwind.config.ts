import type { Config } from "tailwindcss";

/**
 * KurdEvents marka paleti.
 * primary = mürekkep ölçeği (aksiyon, link, odak) — açık zeminde yüksek kontrast.
 * Token adı `gold` korundu (sınıflar değişmesin diye); değerler marka kırmızısı.
 */
const ink = {
  50: "#F6F6F5",
  100: "#E8E8E6",
  200: "#D2D2CF",
  300: "#B0B0AC",
  400: "#878783",
  500: "#6B6B67",
  600: "#555552",
  700: "#444442",
  800: "#2A2A28",
  900: "#181818",
  950: "#0E0E0D",
};

const gold = {
  50: "#FDF1F0",
  100: "#FBDFDC",
  200: "#F7BDB6",
  300: "#F09189",
  400: "#E96B60",
  500: "#E23B2E",
  600: "#C22D22",
  700: "#9C231A",
  800: "#771B14",
  900: "#5C1610",
  950: "#3F0F0A",
};

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/context/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/utils/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    /** Geniş monitörlerde içerik 1536px’e kadar uzamasın; yerel dar pencere ile benzer okuma genişliği (≈max-w-7xl). */
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1280px",
      },
    },
    extend: {
      colors: {
        primary: { ...ink, DEFAULT: ink[900] },
        gold: { ...gold, DEFAULT: gold[500] },
        /** amber sınıfları kahve/kehribar tonlarında; aynı kırmızı ölçeğe bağlandı. */
        amber: { ...gold, DEFAULT: gold[500] },
        ink,
        paper: "#FAF5F4",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.22em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,24,24,0.05), 0 8px 24px -12px rgba(24,24,24,0.12)",
        lift: "0 2px 4px rgba(24,24,24,0.06), 0 16px 40px -16px rgba(24,24,24,0.18)",
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".5" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
