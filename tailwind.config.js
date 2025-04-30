// tailwind.config.js
module.exports = {
	darkMode: ['class'],
	content: [
	  './app/**/*.{js,ts,jsx,tsx}',
	  './pages/**/*.{js,ts,jsx,tsx}',
	  './components/**/*.{js,ts,jsx,tsx}',
	],
	
	theme: {
	  extend: {
		borderRadius: {
		  lg: 'var(--radius)',
		  md: 'calc(var(--radius) - 2px)',
		  sm: 'calc(var(--radius) - 4px)'
		},
		colors: {
		  // Your existing HSL variables
		  background: 'hsl(var(--background))',
		  foreground: 'hsl(var(--foreground))',
		  card: {
			DEFAULT: 'hsl(var(--card))',
			foreground: 'hsl(var(--card-foreground))'
		  },
		  popover: {
			DEFAULT: 'hsl(var(--popover))',
			foreground: 'hsl(var(--popover-foreground))'
		  },
		  primary: {
			DEFAULT: 'hsl(var(--primary))',
			foreground: 'hsl(var(--primary-foreground))'
		  },
		  secondary: {
			DEFAULT: 'hsl(var(--secondary))',
			foreground: 'hsl(var(--secondary-foreground))'
		  },
		  muted: {
			DEFAULT: 'hsl(var(--muted))',
			foreground: 'hsl(var(--muted-foreground))'
		  },
		  accent: {
			DEFAULT: 'hsl(var(--accent))',
			foreground: 'hsl(var(--accent-foreground))'
		  },
		  destructive: {
			DEFAULT: 'hsl(var(--destructive))',
			foreground: 'hsl(var(--destructive-foreground))'
		  },
		  border: 'hsl(var(--border))',
		  input: 'hsl(var(--input))',
		  ring: 'hsl(var(--ring))',
		  chart: {
			'1': 'hsl(var(--chart-1))',
			'2': 'hsl(var(--chart-2))',
			'3': 'hsl(var(--chart-3))',
			'4': 'hsl(var(--chart-4))',
			'5': 'hsl(var(--chart-5))'
		  },
		  
		  // Jobsynt's purple theme colors (new additions)
		  jobsynt: {
			dark: {
			  900: '#0a0515',
			  800: '#12052a',
			  700: '#1a063a',
			  600: '#2e0b6e',
			},
			purple: {
			  100: '#f3e8ff',
			  200: '#e9d5ff',
			  300: '#d8b4fe',
			  400: '#c084fc',
			  500: '#a855f7',
			  600: '#9333ea',
			  700: '#7e22ce',
			  800: '#6b21a8',
			},
			indigo: {
			  800: '#3730a3',
			  900: '#312e81',
			}
		  }
		},
		// Gradient color stops for Jobsynt
		gradientColorStops: {
		  'jobsynt-start': '#1a063a',
		  'jobsynt-mid': '#2e0b6e',
		  'jobsynt-end': '#0a0515',
		}
	  }
	},
	plugins: [
	  require("tailwindcss-animate"),
	  // Additional plugin for better gradients
	  function({ addUtilities }) {
		const newUtilities = {
		  '.bg-jobsynt-gradient': {
			background: 'linear-gradient(to bottom right, var(--tw-gradient-stops))',
		  },
		}
		addUtilities(newUtilities)
	  }
	],
  }