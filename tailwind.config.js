/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'gw-gold':   '#C8A84B',
        'gw-gold-light': '#E8C96B',
        'gw-dark':   '#1A1510',
        'gw-panel':  '#2C2318',
        'gw-panel-light': '#3A2E20',
        'gw-border': '#5C4A20',
        'gw-text':   '#D4C09A',
        'gw-text-muted': '#8A7A5A',
        'gw-elite':  '#D4AF37',
        'gw-red':    '#8B1A1A',
      },
      fontFamily: {
        gw: ['Roboto Condensed', 'Roboto', 'sans-serif'],
        sans: ['Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'gw-panel-grad': 'linear-gradient(180deg, #3A2E20 0%, #2C2318 100%)',
      },
      boxShadow: {
        'gw': '0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(200,168,75,0.1)',
        'gw-elite': '0 0 8px rgba(212,175,55,0.5), 0 2px 8px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
