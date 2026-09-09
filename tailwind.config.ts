import type { Config } from 'tailwindcss';

/**
 * Isoko Market design tokens.
 * Brand: deep teal/green (trust, growth) + warm orange (energy, commerce),
 * per Section 8.1 of the development brief.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1200px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Soft, layered shadows tinted with the deep-teal brand hue instead of pure
      // black — the single biggest lever for a premium, professional surface feel.
      // Overrides the default scale, so every existing shadow-sm/md/lg upgrades.
      boxShadow: {
        sm: '0 1px 2px 0 hsl(185 45% 12% / 0.06)',
        DEFAULT: '0 1px 3px 0 hsl(185 45% 12% / 0.08), 0 1px 2px -1px hsl(185 45% 12% / 0.05)',
        md: '0 4px 14px -3px hsl(185 45% 12% / 0.10), 0 2px 6px -2px hsl(185 45% 12% / 0.06)',
        lg: '0 12px 26px -6px hsl(185 45% 12% / 0.12), 0 4px 10px -4px hsl(185 45% 12% / 0.07)',
        xl: '0 24px 48px -12px hsl(185 45% 12% / 0.18)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
