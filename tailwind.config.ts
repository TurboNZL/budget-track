import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-mode="dark"]'],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // The shadcn colour names, pointed at the variables turbothemes palettes set (see turboengine: themes/docs/CONTRACT.md)
      colors: {
        border: "hsl(var(--line))",
        input: "hsl(var(--line))",
        ring: "hsl(var(--accent))",
        background: "hsl(var(--bg))",
        foreground: "hsl(var(--fg))",
        positive: "hsl(var(--good))",
        negative: "hsl(var(--bad))",
        warning: "hsl(var(--warn))",
        primary: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-fg))",
        },
        secondary: {
          DEFAULT: "hsl(var(--raised))",
          foreground: "hsl(var(--fg))",
        },
        destructive: {
          DEFAULT: "hsl(var(--bad))",
          foreground: "hsl(var(--accent-fg))",
        },
        muted: {
          DEFAULT: "hsl(var(--raised))",
          foreground: "hsl(var(--muted))",
        },
        accent: {
          DEFAULT: "hsl(var(--hover))",
          foreground: "hsl(var(--fg))",
        },
        popover: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--fg))",
        },
        card: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--fg))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
