import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#0d0d0d",
        ink: "#e8e8e8",
        muted: "#8a8a8a",
        pill: "#1c1c1c",
        line: "#2a2a2a",
        accent: "#ffffff",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tag: "0.12em",
      },
      lineHeight: {
        body: "1.65",
      },
    },
  },
  plugins: [],
};
export default config;
