import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-elevated": "rgb(var(--surface-elevated) / <alpha-value>)",
        "surface-glass": "rgb(var(--surface-glass) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        "foreground-muted": "rgb(var(--foreground-muted) / <alpha-value>)",
        "foreground-subtle": "rgb(var(--foreground-subtle) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-subtle": "rgb(var(--border-subtle) / <alpha-value>)",
        "accent-blue": "rgb(var(--accent-blue) / <alpha-value>)",
        "accent-cyan": "rgb(var(--accent-cyan) / <alpha-value>)",
        "accent-violet": "rgb(var(--accent-violet) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        inter: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        'display': ['clamp(2.5rem, 8vw, 4.5rem)', { lineHeight: '0.9', letterSpacing: '-0.02em' }],
        'headline': ['clamp(1.5rem, 4vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.015em' }],
        'title': ['clamp(1.25rem, 3vw, 1.5rem)', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      spacing: {
        'xs': 'var(--space-xs)',
        'sm': 'var(--space-sm)',
        'md': 'var(--space-md)',
        'lg': 'var(--space-lg)',
        'xl': 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        '4xl': 'var(--space-4xl)',
        '6xl': 'var(--space-6xl)',
        '8xl': 'var(--space-8xl)',
      },
      borderRadius: {
        'card': '16px',
        'card-lg': '24px',
        'hero': '32px',
        'hero-lg': '40px',
      },
      boxShadow: {
        'ambient': 'var(--shadow-ambient)',
        'elevated': 'var(--shadow-elevated)',
      },
      transitionTimingFunction: {
        'out-quart': 'var(--ease-out-quart)',
      },
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "shimmer": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in var(--duration-normal) var(--ease-out-quart) forwards",
        "slide-up": "slide-up var(--duration-normal) var(--ease-out-quart) forwards",
        "scale-in": "scale-in var(--duration-normal) var(--ease-out-quart) forwards",
        "shimmer": "shimmer 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
