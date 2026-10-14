import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "3xl": "1680px",
    },
    fontSize: {
      display: ["var(--display)", { lineHeight: "0.88", letterSpacing: "-0.05em", fontWeight: "600" }],
      statement: ["var(--statement)", { lineHeight: "1.04", letterSpacing: "-0.035em", fontWeight: "500" }],
      read: ["var(--read)", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "450" }],
      body: ["16px", { lineHeight: "1.45", letterSpacing: "-0.005em", fontWeight: "450" }],
    },
    extend: {
      colors: {
        paper: "#EEEAE4",
        ink: "#160C0D",
        ox: "#14060A",
        bone: "#F3EDE8",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(.16,1,.3,1)",
        quint: "cubic-bezier(.22,1,.36,1)",
        text: "cubic-bezier(.215,.61,.355,1)",
        std: "cubic-bezier(.4,0,.2,1)",
        exit: "cubic-bezier(.4,0,1,1)",
        media: "cubic-bezier(.25,.46,.45,.94)",
      },
    },
  },
  plugins: [],
};

export default config;
