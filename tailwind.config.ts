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
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Fluid display scale — optical serif, tuned for large sizes
        giant: ["clamp(3.5rem, 13vw, 11.5rem)", { lineHeight: "0.88", letterSpacing: "-0.035em", fontWeight: "400" }],
        display: ["clamp(2.75rem, 7.5vw, 6.25rem)", { lineHeight: "0.95", letterSpacing: "-0.03em", fontWeight: "400" }],
        headline: ["clamp(2rem, 4.6vw, 3.75rem)", { lineHeight: "1.02", letterSpacing: "-0.025em", fontWeight: "400" }],
        lede: ["clamp(1.35rem, 2.3vw, 2rem)", { lineHeight: "1.22", letterSpacing: "-0.022em" }],
      },
      maxWidth: {
        content: "96rem",
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
