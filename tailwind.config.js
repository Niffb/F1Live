/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          red: '#E10600',
          white: '#FFFFFF',
          black: '#15151E',
          grey: '#949498',
          silver: '#C0C0C0',
        }
      },
      fontFamily: {
        'f1': ['Titillium Web', 'Arial', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
