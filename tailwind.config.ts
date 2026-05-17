import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        "foreground-muted": "rgb(var(--foreground-muted) / <alpha-value>)",
        "foreground-subtle": "rgb(var(--foreground-subtle) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-strong": "rgb(var(--accent-strong) / <alpha-value>)",
      },
      fontFamily: {
        inter: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fluid display scale — KFK heading-xl / Axis hero
        display: ["clamp(2.75rem, 8vw, 5.75rem)", { lineHeight: "0.9", letterSpacing: "-0.04em", fontWeight: "700" }],
        headline: ["clamp(2rem, 5.5vw, 3.5rem)", { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "700" }],
      },
      maxWidth: {
        content: "64rem", // 1024px — the one width everything aligns to
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
        "4xl": "2.25rem",
        "5xl": "2.75rem",
      },
    },
  },
  plugins: [],
};

export default config;
