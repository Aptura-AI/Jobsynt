import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        accent: '#10B981',
        ink: '#0F172A',
        muted: '#6B7280',
        surface: '#F8FAFC',
      },
    },
  },
  plugins: [],
};

export default config;

