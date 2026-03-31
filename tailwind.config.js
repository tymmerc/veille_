/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Inter Fallback", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        "border-hover": "var(--border-hover)",
        input: "var(--input)",
        ring: "var(--ring)",
        rose: "var(--rose)",
        cyber: "var(--cyber)",
        tech: "var(--tech)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
      },
      borderRadius: {
        lg: "0.625rem",
        md: "0.425rem",
        sm: "0.225rem",
      },
    },
  },
  plugins: [],
};
