import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
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
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
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
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Custom tech theme colors
				tech: {
					cyan: 'hsl(var(--tech-cyan))',
					'cyan-glow': 'hsl(var(--tech-cyan-glow))',
					blue: 'hsl(var(--tech-blue))',
					purple: 'hsl(var(--tech-purple))',
					orange: 'hsl(var(--tech-orange))',
					green: 'hsl(var(--tech-green))',
					red: 'hsl(var(--tech-red))'
				}
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
				},
				// Orb animations
				'pulse-slow': {
					'0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
					'50%': { opacity: '0.8', transform: 'scale(1.05)' }
				},
				'pulse-slower': {
					'0%, 100%': { opacity: '0.3', transform: 'scale(0.95)' },
					'50%': { opacity: '0.7', transform: 'scale(1.1)' }
				},
				'pulse-fastest': {
					'0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
					'50%': { opacity: '1', transform: 'scale(1.02)' }
				},
				'shimmer': {
					'0%, 100%': { opacity: '0.8', transform: 'rotate(0deg)' },
					'50%': { opacity: '1', transform: 'rotate(180deg)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
					'25%': { transform: 'translateY(-5px) translateX(2px)' },
					'50%': { transform: 'translateY(-2px) translateX(-3px)' },
					'75%': { transform: 'translateY(-7px) translateX(1px)' }
				},
				'twinkle': {
					'0%, 100%': { opacity: '0', transform: 'scale(0.5)' },
					'50%': { opacity: '1', transform: 'scale(1.5)' }
				},
				'spin-slow': {
					from: { transform: 'rotate(0deg)' },
					to: { transform: 'rotate(360deg)' }
				},
				'spin-reverse': {
					from: { transform: 'rotate(360deg)' },
					to: { transform: 'rotate(0deg)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				// Orb animations
				'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
				'pulse-slower': 'pulse-slower 6s ease-in-out infinite',
				'pulse-fastest': 'pulse-fastest 2s ease-in-out infinite',
				'shimmer': 'shimmer 3s ease-in-out infinite',
				'float': 'float 4s ease-in-out infinite',
				'twinkle': 'twinkle 2s ease-in-out infinite',
				'spin-slow': 'spin-slow 10s linear infinite',
				'spin-reverse': 'spin-reverse 8s linear infinite'
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;