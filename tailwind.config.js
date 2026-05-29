/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        // insight-flow exact font names
        sans:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // aliases used in existing codebase
        tight:   ['"Inter Tight"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // shadcn system colours (HSL vars — must stay for compat)
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:    { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary:  { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive:{ DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:      { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent:     { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover:    { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card:       { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        // ── insight-flow design tokens ────────────────────────────────
        brand:     { DEFAULT: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-ink)" },
        positive:  "var(--positive)",
        negative:  "var(--negative)",
        violet:    "var(--violet)",
        amber:     "var(--amber)",
        warning:   "var(--warning)",
        ink:       "var(--ink)",
        surface:   { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        hairline:  "var(--hairline)",
      },
      boxShadow: {
        pane: "var(--shadow-pane)",
        pop:  "var(--shadow-pop)",
        glow: "var(--shadow-glow)",
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: {
        "accordion-down": { from: { height: 0 }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: 0 } },
        shimmer:          { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
        "bar-fill":       { from: { width: "0%" }, to: { width: "var(--fill-width, 100%)" } },
        "fade-up":        { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        entrance:         { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "count-pulse":    { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.6 } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        shimmer:          "shimmer 1.8s infinite",
        "bar-fill":       "bar-fill 1.2s cubic-bezier(0.19,1,0.22,1) both",
        "fade-up":        "fade-up 0.6s cubic-bezier(0.19,1,0.22,1) both",
        entrance:         "entrance 0.5s cubic-bezier(0.19,1,0.22,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
