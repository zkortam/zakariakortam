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
        giant: ["clamp(3.75rem, 12vw, 10.5rem)", { lineHeight: "0.9", letterSpacing: "-0.04em", fontWeight: "400" }],
        title: ["clamp(3.25rem, 8vw, 7.5rem)", { lineHeight: "0.92", letterSpacing: "-0.04em", fontWeight: "400" }],
        statement: ["clamp(1.6rem, 2.7vw, 2.6rem)", { lineHeight: "1.14", letterSpacing: "-0.03em", fontWeight: "400" }],
        prose: ["clamp(1.2rem, 1.6vw, 1.5rem)", { lineHeight: "1.4", letterSpacing: "-0.02em" }],
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
