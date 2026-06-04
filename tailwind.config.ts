import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind config — scoped & firewalled for shadcn/ui + Tailark Pro ONLY.
 * ──────────────────────────────────────────────────────────────────────
 * This project's own look is the neumorphic system (inline styles) + Remotion
 * print stills, NOT Tailwind. Two deliberate safety choices keep Tailwind from
 * touching any of that:
 *   1. `corePlugins.preflight = false` — no base/UA reset is emitted, so the
 *      neumorphic widgets, the keynote, the print GUI and (critically) the
 *      deterministic Remotion print rasters keep their exact box model. Pulled
 *      shadcn/Tailark blocks carry their own backgrounds/borders, so they don't
 *      need preflight.
 *   2. `content` is scoped to where shadcn/Tailark code actually lives
 *      (src/components/** + lib/utils) — utilities are generated only for those
 *      files, never for the inline-styled neumorphic/Remotion trees.
 * The Tailwind stylesheet (src/tailwind.css) is imported ONLY by the two app
 * entries (src/main.tsx, src/print/main.tsx) — never by the Remotion graph.
 */
export default {
  darkMode: ['class'],
  corePlugins: { preflight: false },
  content: [
    './src/components/**/*.{ts,tsx}',
    './src/hooks/**/*.{ts,tsx}',
    './src/lib/utils.ts',
    // Stories that render shadcn/Tailark components (e.g. the document
    // illustration) need their utility classes generated too. Scoped to story
    // files only — narrow enough not to scan the inline-styled neo widgets.
    './src/stories/**/*.stories.tsx',
  ],
  theme: {
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			// Tailark Pro illustration tokens (the `document` block paints its sheet
  			// with bg-illustration + ring-border-illustration). Authored for Tailwind
  			// v4 (bg-X → var(--color-X)); mapped here to v3 hsl(var()) tokens.
  			illustration: 'hsl(var(--illustration))',
  			'border-illustration': 'hsl(var(--border-illustration))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
